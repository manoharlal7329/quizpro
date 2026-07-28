const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../database/models/User');

async function adminOnly(req, res, next) {
  try {
    if (req.user && req.user.role === 'admin') return next();
    const user = await User.findOne({ id: Number(req.user.id) });
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch (e) {
    res.status(500).json({ error: 'Admin check failed' });
  }
}

let clients = [];

// SSE Stream endpoint for all users
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Keep alive
    const keepAlive = setInterval(() => {
        res.write(':\n\n');
    }, 15000);

    const client = { id: Date.now(), res };
    clients.push(client);

    req.on('close', () => {
        clearInterval(keepAlive);
        clients = clients.filter(c => c.id !== client.id);
    });
});

// Broadcast message (Admin only)
router.post('/trigger', authMiddleware, adminOnly, (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    clients.forEach(c => {
        c.res.write(`data: ${JSON.stringify({ type: 'alert', message })}\n\n`);
    });

    res.json({ success: true, count: clients.length });
});

// Broadcast stop command (Admin only)
router.post('/stop', authMiddleware, adminOnly, (req, res) => {
    clients.forEach(c => {
        c.res.write(`data: ${JSON.stringify({ type: 'stop' })}\n\n`);
    });
    res.json({ success: true });
});

module.exports = router;
