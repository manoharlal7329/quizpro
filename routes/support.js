const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const SupportMessage = require('../database/models/SupportMessage');
const User = require('../database/models/User');

// POST /api/support/message - Submit a support message
router.post('/message', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.trim().length < 5) {
            return res.status(400).json({ error: 'Message must be at least 5 characters long.' });
        }

        const user = await User.findOne({ id: Number(req.user.id) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const supportMsg = new SupportMessage({
            id: Date.now(),
            user_id: user.id,
            name: user.full_name || user.username,
            email: user.email,
            message: message.trim(),
            status: 'PENDING',
            created_at: Math.floor(Date.now() / 1000)
        });

        await supportMsg.save();

        res.json({ success: true, message: 'Message sent successfully! We will get back to you soon.' });
    } catch (e) {
        console.error('[Support API] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/support/my-messages - Get user's past messages
router.get('/my-messages', authMiddleware, async (req, res) => {
    try {
        const messages = await SupportMessage.find({ user_id: Number(req.user.id) }).sort({ created_at: -1 }).limit(20);
        res.json({ success: true, messages });
    } catch (e) {
        console.error('[Support API] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
