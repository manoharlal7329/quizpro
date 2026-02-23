const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { data, save } = db;
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({ dest: 'uploads/' });

// Always check live DB for admin status; fallback to JWT if user not found (e.g. old cached token)
const adminOnly = (req, res, next) => {
    const liveUser = data.users.find(u => u.id == req.user.id);
    if (liveUser && liveUser.is_admin) return next();
    // Fallback: JWT itself has is_admin (for old sessions / cached tokens)
    if (!liveUser && req.user.is_admin) return next();
    res.status(403).json({ error: 'Admin access required' });
};

router.use(authMiddleware, adminOnly);

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    const completed = data.sessions.filter(s => s.status === 'completed');
    const revenue = completed.reduce((acc, s) => acc + (s.platform_cut || 0), 0);
    const prizePaid = completed.reduce((acc, s) => acc + (s.prize_pool || 0), 0);

    const recentSessions = data.sessions
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 5)
        .map(s => {
            const cat = data.categories.find(c => c.id == s.category_id);
            return { ...s, category_name: cat?.name };
        });

    res.json({
        stats: {
            total_users: data.users.length,
            total_sessions: data.sessions.length,
            total_revenue: revenue,
            total_prize: prizePaid
        },
        recentSessions
    });
});

// ─── ALL SESSIONS ─────────────────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
    const sessions = data.sessions.map(s => {
        const cat = data.categories.find(c => c.id == s.category_id);
        return { ...s, category_name: cat?.name };
    });
    res.json(sessions);
});

// ─── CREATE SESSION ───────────────────────────────────────────────────────────
router.post('/sessions', async (req, res) => {
    const { category_id, title, seat_limit, entry_fee, quiz_delay_minutes } = req.body;

    // ✅ PLAN RULE: Sirf 1 active session per category
    const existing = (data.sessions || []).find(
        s => s.category_id == category_id && ['open', 'confirmed'].includes(s.status)
    );
    if (existing) {
        return res.status(400).json({
            error: `Is category mein already ek active session hai: "${existing.title}". Pehle use cancel ya complete karo.`
        });
    }

    const newSess = {
        id: Date.now(),
        category_id: parseInt(category_id),
        title,
        seat_limit: parseInt(seat_limit),
        seats_booked: 0,
        entry_fee: parseInt(entry_fee),
        quiz_delay_minutes: parseInt(quiz_delay_minutes) || 60,
        status: 'open',
        created_at: Math.floor(Date.now() / 1000)
    };
    data.sessions.push(newSess);
    save();
    res.json({ id: newSess.id, message: 'Session created' });
});

// ─── ADD QUESTIONS ────────────────────────────────────────────────────────────
router.post('/questions', async (req, res) => {
    const { session_id, questions } = req.body;
    questions.forEach(q => {
        data.questions.push({
            id: Date.now() + Math.random(),
            session_id: parseInt(session_id),
            ...q
        });
    });
    save();
    res.json({ message: 'Questions added' });
});

router.get('/sessions/:id/questions', async (req, res) => {
    res.json(data.questions.filter(q => q.session_id == req.params.id));
});

router.delete('/questions/:id', async (req, res) => {
    data.questions = data.questions.filter(q => q.id != req.params.id);
    save();
    res.json({ message: 'Deleted' });
});

// ─── ADD QUESTIONS (BULK VIA EXCEL) ──────────────────────────────────────────
router.post('/questions/upload', upload.single('file'), async (req, res) => {
    const { session_id } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const formatted = sheetData.map(row => ({
            id: Date.now() + Math.random(),
            session_id: parseInt(session_id),
            question_text: row.question || row.question_text || row.Question,
            option_a: row.a || row.option_a || row.A,
            option_b: row.b || row.option_b || row.B,
            option_c: row.c || row.option_c || row.C,
            option_d: row.d || row.option_d || row.D,
            correct: String(row.correct || row.Answer || 'a').toLowerCase(),
            explanation: row.explanation || row.Explanation || ''
        }));

        data.questions.push(...formatted);
        save();

        const fs = require('fs');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({ message: `${formatted.length} questions uploaded successfully` });
    } catch (e) {
        res.status(500).json({ error: 'Excel parsing failed: ' + e.message });
    }
});

// ─── MANAGE USERS (ENHANCED) ──────────────────────────────────────────────────
router.get('/users', async (req, res) => {
    res.json(data.users);
});

router.delete('/users/:id', async (req, res) => {
    const uid = parseInt(req.params.id);
    if (uid === 1) return res.status(400).json({ error: 'Cannot delete primary admin' });

    data.users = data.users.filter(u => u.id != uid);
    data.seats = data.seats.filter(s => s.user_id != uid);
    data.quiz_attempts = data.quiz_attempts.filter(a => a.user_id != uid);
    save();
    res.json({ message: 'User and all related data deleted' });
});

// ─── MANUAL STATE OVERRIDES ───────────────────────────────────────────────────
router.post('/sessions/:id/complete', async (req, res) => {
    const session = data.sessions.find(s => s.id == req.params.id);
    if (session) {
        session.status = 'completed';
        save();
    }
    res.json({ message: 'Session marked as completed' });
});

router.post('/sessions/:id/reset-seats', async (req, res) => {
    const session = data.sessions.find(s => s.id == req.params.id);
    if (session) {
        session.seats_booked = 0;
        session.status = 'open';
        data.seats = data.seats.filter(s => s.session_id != req.params.id);
        save();
    }
    res.json({ message: 'Session seats reset to zero' });
});

// ─── FORCE START / CANCEL ─────────────────────────────────────────────────────
router.post('/sessions/:id/force-start', async (req, res) => {
    const session = data.sessions.find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const now = Math.floor(Date.now() / 1000);
    session.quiz_start_at = now;
    session.quiz_end_at = now + 1800;    // 30 min quiz
    session.pdf_at = now;            // PDF unlocks immediately on force start
    session.status = 'live';
    session.prize_pool = Math.floor(session.entry_fee * session.seats_booked * 0.75);
    session.platform_cut = Math.floor(session.entry_fee * session.seats_booked * 0.25);
    save();

    // ✅ SSE broadcast — all connected users get real-time "LIVE" notification
    try {
        const sessionsRouter = require('./sessions');
        if (sessionsRouter.broadcastSession) {
            sessionsRouter.broadcastSession(session.id, {
                status: 'live',
                quiz_start_at: session.quiz_start_at,
                pdf_at: session.pdf_at,
                seats_booked: session.seats_booked
            });
        }
    } catch (e) { }

    res.json({ message: 'Quiz is NOW LIVE! Users can join immediately.', quiz_start_at: session.quiz_start_at });
});

router.post('/sessions/:id/cancel', async (req, res) => {
    const session = data.sessions.find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'cancelled';

    // ✅ PLAN RULE: Platform cancels → auto refund all bookers to real wallet
    const seats = (data.seats || []).filter(s => s.session_id == session.id);
    let refundCount = 0;
    seats.forEach(seat => {
        const userWallet = (data.wallets || []).find(w => w.user_id == seat.user_id);
        if (userWallet) {
            userWallet.real = (userWallet.real || 0) + session.entry_fee;
            if (!data.transactions) data.transactions = [];
            data.transactions.push({
                id: Date.now() + refundCount,
                user_id: seat.user_id,
                type: 'real',
                direction: 'credit',
                amount: session.entry_fee,
                note: `Auto-refund: Session "${session.title}" cancelled by admin`,
                created_at: Math.floor(Date.now() / 1000)
            });
            refundCount++;
        }
    });

    save();
    console.log(`🚫 Session ${session.id} cancelled — ${refundCount} users auto-refunded ₹${session.entry_fee} each`);
    res.json({ message: `Session cancelled. ${refundCount} users auto-refunded ₹${session.entry_fee} to their wallet.` });
});

// ─── DELETE SESSION PERMANENTLY ──────────────────────────────────────────────
router.delete('/sessions/:id', async (req, res) => {
    const sid = req.params.id;
    const session = data.sessions.find(s => s.id == sid);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Remove session and all related data
    data.sessions = data.sessions.filter(s => s.id != sid);
    data.questions = data.questions.filter(q => q.session_id != sid);
    data.seats = data.seats.filter(s => s.session_id != sid);
    data.payments = data.payments.filter(p => p.session_id != sid);
    data.quiz_attempts = data.quiz_attempts.filter(a => a.session_id != sid);
    save();

    res.json({ message: 'Session permanently deleted' });
});

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
    res.json(data.categories || []);
});

router.post('/categories', async (req, res) => {
    const { name, icon, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const newCat = { id: Date.now(), name, icon, description };
    data.categories = data.categories || [];
    data.categories.push(newCat);
    save();
    res.json(newCat);
});

// ─── REWARDS ──────────────────────────────────────────────────────────────────
router.post('/rewards', async (req, res) => {
    const { mobile, type, detail } = req.body;
    if (!mobile || !type) return res.status(400).json({ error: 'Missing details' });

    const reward = {
        id: Date.now(),
        mobile,
        type,
        detail,
        assigned_at: Math.floor(Date.now() / 1000)
    };
    data.rewards = data.rewards || [];
    data.rewards.push(reward);
    save();
    res.json(reward);
});

router.get('/rewards', async (req, res) => {
    res.json(data.rewards || []);
});

// ─── GO LIVE — Manually start a session quiz ──────────────────────────────────
router.post('/sessions/:id/start', async (req, res) => {
    const session = (data.sessions || []).find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'live') return res.status(400).json({ error: 'Already live' });
    if (session.status === 'completed') return res.status(400).json({ error: 'Already completed' });

    const now = Math.floor(Date.now() / 1000);
    session.quiz_start_at = now;
    session.pdf_at = now - 1;   // PDF already available
    session.status = 'live';
    session.prize_pool = session.prize_pool || Math.floor((session.entry_fee || 0) * (session.seats_booked || 0) * 0.75);
    session.platform_cut = session.platform_cut || Math.floor((session.entry_fee || 0) * (session.seats_booked || 0) * 0.25);
    save();

    // Broadcast SSE to all connected users in this session
    try {
        const sessionsRouter = require('./sessions');
        if (sessionsRouter.broadcastSession) {
            sessionsRouter.broadcastSession(session.id, {
                seats_booked: session.seats_booked,
                status: 'live',
                quiz_start_at: session.quiz_start_at
            });
        }
    } catch (e) { }

    res.json({ success: true, message: 'Quiz is now LIVE 🔥', session_id: session.id, quiz_start_at: session.quiz_start_at });
});

// ─── CANCEL SESSION ─────────────────────────────────────────────────────────
router.post('/sessions/:id/cancel', async (req, res) => {
    const session = (data.sessions || []).find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.status = 'cancelled';
    save();
    res.json({ success: true });
});

module.exports = router;
