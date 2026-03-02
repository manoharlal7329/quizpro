const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Session = require('../database/models/Session');
const Category = require('../database/models/Category');
const Question = require('../database/models/Question');
const Seat = require('../database/models/Seat');

const sseClients = new Map();

// ─── LIST SESSIONS ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const sessionsRaw = await Session.find({
            status: { $nin: ['completed', 'cancelled'] }
        }).sort({ created_at: -1 }).lean();

        const categories = await Category.find({}).lean();

        const sessions = sessionsRaw.map(s => {
            const cat = categories.find(c => String(c.id) === String(s.category_id));
            return { ...s, category_name: cat?.name, level: cat?.level, color: cat?.color };
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ALL CATEGORIES ───────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find({}).lean();
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── SESSION DETAIL ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const session = await Session.findOne({ id: Number(req.params.id) }).lean();
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const cat = await Category.findOne({ id: Number(session.category_id) }).lean();
        const questionsRaw = await Question.find({ session_id: Number(session.id) }).lean();

        const questions = questionsRaw.map(q => {
            const { correct, explanation, ...publicQ } = q;
            return publicQ;
        });

        res.json({ ...session, category_name: cat?.name, level: cat?.level, color: cat?.color, questions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── CHECK USER SEAT ──────────────────────────────────────────────────────────
router.get('/:id/my-seat', authMiddleware, async (req, res) => {
    try {
        const seat = await Seat.findOne({ session_id: Number(req.params.id), user_id: Number(req.user.id) }).lean();
        res.json({ has_seat: !!seat, seat });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── STUDY MATERIAL ──────────────────────────────────────────────────────────
router.get('/:id/study', authMiddleware, async (req, res) => {
    try {
        const session = await Session.findOne({ id: Number(req.params.id) }).lean();
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const seat = await Seat.findOne({ session_id: Number(req.params.id), user_id: Number(req.user.id) }).lean();
        if (!seat) return res.status(403).json({ error: 'You have not booked a seat' });

        const now = Math.floor(Date.now() / 1000);
        if (session.pdf_at && now < session.pdf_at) {
            return res.status(403).json({ error: 'Study material not yet available', available_at: session.pdf_at });
        }

        const questions = await Question.find({ session_id: Number(req.params.id) }).lean();
        res.json({ ...session, questions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── SSE ────────────────────────────────────────────────────────
router.get('/:id/events', async (req, res) => {
    const sid = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    if (!sseClients.has(sid)) sseClients.set(sid, []);
    sseClients.get(sid).push(res);

    try {
        const s = await Session.findOne({ id: Number(sid) }).lean();
        if (s) res.write(`data: ${JSON.stringify({ seats_booked: s.seats_booked, status: s.status })}\n\n`);
    } catch (e) { }

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
