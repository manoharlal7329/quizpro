const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');

const sseClients = new Map();

// ─── LIST SESSIONS ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const sessions = data.sessions
        .filter(s => !['completed', 'cancelled'].includes(s.status))
        .sort((a, b) => b.created_at - a.created_at)
        .map(s => {
            const cat = data.categories.find(c => c.id == s.category_id);
            return { ...s, category_name: cat?.name, level: cat?.level, color: cat?.color };
        });
    res.json(sessions);
});

// ─── ALL CATEGORIES ───────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
    res.json(data.categories);
});

// ─── SESSION DETAIL ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const session = data.sessions.find(s => String(s.id) === String(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const cat = data.categories.find(c => c.id == session.category_id);
    const questions = data.questions
        .filter(q => String(q.session_id) === String(session.id))
        .map(q => {
            const { correct, explanation, ...publicQ } = q;
            return publicQ;
        });

    res.json({ ...session, category_name: cat?.name, level: cat?.level, color: cat?.color, questions });
});

// ─── CHECK USER SEAT ──────────────────────────────────────────────────────────
router.get('/:id/my-seat', authMiddleware, async (req, res) => {
    const seat = data.seats.find(s => String(s.session_id) === String(req.params.id) && String(s.user_id) === String(req.user.id));
    res.json({ has_seat: !!seat, seat });
});

// ─── STUDY MATERIAL (JSON with Answers) ──────────────────────────────────────
router.get('/:id/study', authMiddleware, async (req, res) => {
    const session = data.sessions.find(s => String(s.id) === String(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const seat = data.seats.find(s => String(s.session_id) === String(req.params.id) && String(s.user_id) === String(req.user.id));
    if (!seat) return res.status(403).json({ error: 'You have not booked a seat' });

    const now = Math.floor(Date.now() / 1000);
    if (session.pdf_at && now < session.pdf_at) {
        return res.status(403).json({ error: 'Study material not yet available', available_at: session.pdf_at });
    }

    const questions = data.questions.filter(q => parseInt(q.session_id) === parseInt(req.params.id));
    res.json({ ...session, questions });
});

// ─── STUDY PDF (with UserID + SessionID watermark on every page) ──────────────
router.get('/:id/pdf', authMiddleware, async (req, res) => {
    res.status(403).json({ error: 'PDF downloading is disabled. Please use the online Study Material page.' });
});

// SSE
router.get('/:id/events', async (req, res) => {
    const sid = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(sid)) sseClients.set(sid, []);
    sseClients.get(sid).push(res);

    const s = data.sessions.find(x => String(x.id) === String(sid));
    if (s) res.write(`data: ${JSON.stringify({ seats_booked: s.seats_booked, status: s.status })}\n\n`);

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
        const clients = sseClients.get(sid) || [];
        sseClients.set(sid, clients.filter(c => c !== res));
    });
});

router.broadcastSession = (sessionId, update) => {
    const clients = sseClients.get(String(sessionId)) || [];
    clients.forEach(c => c.write(`data: ${JSON.stringify(update)}\n\n`));
};

module.exports = router;
