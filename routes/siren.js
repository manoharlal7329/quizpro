const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Array to hold active SSE clients
let clients = [];

// Middleware to check for Admin
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ── SSE STREAM ENDPOINT (Clients connect to this) ─────────────────────────
router.get('/stream', authMiddleware, (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE

    // Add this client to our list
    clients.push(res);

    // Remove client when connection is closed
    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

// ── ADMIN TRIGGER ENDPOINT ────────────────────────────────────────────────
router.post('/trigger', authMiddleware, adminOnly, (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    // Broadcast the message to all connected clients
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ message })}\n\n`);
    });

    res.json({ success: true, count: clients.length, message: 'Siren broadcasted to all users!' });
});

module.exports = router;
