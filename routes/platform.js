const express = require('express');
const router = express.Router();
const Banner = require('../database/models/Banner');
const Notification = require('../database/models/Notification');
const authMiddleware = require('../middleware/auth');

// ─── GET ACTIVE BANNERS ──────────────────────────────────────────────────────
router.get('/banners', async (req, res) => {
    try {
        const banners = await Banner.find({ is_active: true }).sort({ order: 1 }).lean();
        res.json(banners);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET USER NOTIFICATIONS ──────────────────────────────────────────────────
router.get('/notifications', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification.find({
            $or: [{ user_id: 0 }, { user_id: userId }]
        }).sort({ created_at: -1 }).limit(20).lean();
        res.json(notifications);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── MARK AS READ ────────────────────────────────────────────────────────────
router.post('/notifications/read', authMiddleware, async (req, res) => {
    try {
        const { id } = req.body;
        await Notification.updateOne({ id, user_id: { $in: [0, req.user.id] } }, { is_read: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET PUBLIC UPI CONFIG ───────────────────────────────────────────────────
router.get('/upi-config', async (req, res) => {
    try {
        const PlatformConfig = require('../database/models/PlatformConfig');
        const upiIdConfig = await PlatformConfig.findOne({ key: 'UPI_ID' }).lean();
        const upiNameConfig = await PlatformConfig.findOne({ key: 'UPI_NAME' }).lean();
        const upiQrConfig = await PlatformConfig.findOne({ key: 'UPI_QR_URL' }).lean();

        const upi_id = upiIdConfig?.value || process.env.PLATFORM_UPI_ID || 'manoharlala02911-1@okaxis';
        const upi_name = upiNameConfig?.value || process.env.PLATFORM_UPI_NAME || 'Manohar Lal Prajapat';
        const custom_qr = upiQrConfig?.value || '';

        res.json({
            upi_id,
            upi_name,
            qr_url: custom_qr
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

