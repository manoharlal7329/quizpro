const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');

// Models
const User = require('../database/models/User');
const Wallet = require('../database/models/Wallet');
const WalletTxn = require('../database/models/WalletTxn');

// ── Auto-generate unique referral code ───────────────────────────────────────
function makeReferralCode(name) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const prefix = (name || 'USER').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'U');
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return prefix + suffix;
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { email, password, fullName, username, phone, refCode: ref_code_used } = req.body;

    if (!email || !password || !fullName || !username || !phone) {
        return res.status(400).json({ error: 'All mandatory fields are required' });
    }

    try {
        const emailLower = email.toLowerCase().trim();
        const existingEmail = await User.findOne({ email: emailLower });
        if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

        const usernameTrimmed = username.trim();
        const existingUser = await User.findOne({ username: usernameTrimmed });
        if (existingUser) return res.status(400).json({ error: 'Username already taken' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate referral code
        let refCode;
        let isUnique = false;
        while (!isUnique) {
            refCode = makeReferralCode(fullName);
            const dup = await User.findOne({ referral_code: refCode });
            if (!dup) isUnique = true;
        }

        const user = new User({
            id: Date.now(),
            email: emailLower,
            password: hashedPassword,
            full_name: fullName.trim(),
            username: usernameTrimmed,
            phone: phone.trim(),
            name: usernameTrimmed,
            referral_code: refCode,
            referred_by: ref_code_used || null
        });

        await user.save();

        // Initialize Wallet
        const wallet = new Wallet({
            user_id: user.id,
            demo: 0,
            dep_bal: 0,
            win_bal: 0
        });
        await wallet.save();

        const token = jwt.sign(
            { id: user.id, email: user.email, is_admin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Registration successful',
            token,
            user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    try {
        const emailLower = email.toLowerCase().trim();
        const user = await User.findOne({ email: emailLower });

        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign(
            { id: user.id, email: user.email, is_admin: user.is_admin },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET ME ───────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id }).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
router.post('/update-profile', authMiddleware, async (req, res) => {
    const { name, upi_id } = req.body;
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (name) user.name = name;

        if (upi_id !== undefined) {
            const upiTrimmed = upi_id.trim().toLowerCase();
            if (upiTrimmed) {
                const duplicate = await User.findOne({
                    id: { $ne: user.id },
                    upi_id: { $regex: new RegExp(`^${upiTrimmed}$`, 'i') }
                });
                if (duplicate) return res.status(400).json({ error: 'Yeh UPI ID already kisi aur account se linked hai.' });
            }
            user.upi_id = upi_id;
        }

        await user.save();
        res.json({ message: 'Profile updated', user: { name: user.name, upi_id: user.upi_id } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET USER BADGES ─────────────────────────────────────────────────────────
// NOTE: Badges model not created yet, placeholder
router.get('/badges', authMiddleware, async (req, res) => {
    res.json([]);
});

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const token = Math.random().toString(36).substring(2, 15);
        user.reset_token = token;
        user.reset_expires = Date.now() + 3600000;
        await user.save();

        console.log(`[AUTH] Reset Token for ${email}: ${token}`);

        try {
            const { sendMail } = require('../utils/mailer');
            await sendMail(email, 'Password Reset', `Token: ${token}`);
        } catch (e) { }

        res.json({ message: 'Reset link sent to your email.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── RESET PASSWORD ────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    try {
        const user = await User.findOne({ reset_token: token, reset_expires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

        user.password = await bcrypt.hash(newPassword, 10);
        user.reset_token = undefined;
        user.reset_expires = undefined;
        await user.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
