const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');

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
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase().trim();
    if (data.users.find(u => u.email === emailLower)) {
        return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Auto-generate name from email (e.g., user@example.com -> user)
    const name = emailLower.split('@')[0];

    // Generate referral code (internal system requirement, though not exposed in UI)
    let refCode;
    do { refCode = makeReferralCode(name); }
    while (data.users.find(u => u.referral_code === refCode));

    const user = {
        id: Date.now(),
        email: emailLower,
        password: hashedPassword,
        name: name,
        is_admin: 0,
        referral_code: refCode,
        referred_by: null,
        created_at: Math.floor(Date.now() / 1000)
    };

    data.users.push(user);

    // Welcome demo wallet bonus
    if (!data.wallets) data.wallets = [];
    if (!data.wallet_txns) data.wallet_txns = [];
    const bonus = Number(process.env.WELCOME_DEMO_BONUS) || 100;
    let wallet = data.wallets.find(w => String(w.user_id) === String(user.id));
    if (!wallet) { wallet = { user_id: user.id, demo: 0, real: 0 }; data.wallets.push(wallet); }
    wallet.demo += bonus;
    data.wallet_txns.push({
        id: Date.now(),
        user_id: user.id,
        wallet: 'demo',
        type: 'credit',
        amount: bonus,
        note: '🎁 Welcome bonus',
        at: Math.floor(Date.now() / 1000)
    });

    // Track referral
    if (ref_code) {
        const referrer = data.users.find(u => u.referral_code === ref_code);
        if (referrer) {
            if (!data.referrals) data.referrals = [];
            data.referrals.push({
                id: Date.now(),
                referrer_id: referrer.id,
                referred_id: user.id,
                bonus_given: false,
                at: Math.floor(Date.now() / 1000)
            });
        }
    }

    save();

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
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    console.log(`[AUTH] User login attempt: ${req.body.email}`);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase().trim();
    const user = data.users.find(u => u.email === emailLower);

    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET || 'fallback_secret_key_dont_use_in_production',
        { expiresIn: '7d' }
    );

    res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }
    });
});

// ─── GET ME ───────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
    const user = data.users.find(u => u.id == req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
router.post('/update-profile', authMiddleware, async (req, res) => {
    const { name, upi_id } = req.body;
    const user = data.users.find(u => u.id == req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name) user.name = name;

    // Same UPI → block (1 UPI = 1 identity)
    if (upi_id !== undefined) {
        const upiTrimmed = upi_id.trim().toLowerCase();
        if (upiTrimmed) {
            const duplicate = data.users.find(u =>
                u.id !== user.id &&
                u.upi_id &&
                u.upi_id.trim().toLowerCase() === upiTrimmed
            );
            if (duplicate) {
                return res.status(400).json({
                    error: 'Yeh UPI ID already kisi aur account se linked hai. Ek UPI = Ek account rule.'
                });
            }
        }
        user.upi_id = upi_id;
    }

    save();
    res.json({ message: 'Profile updated', user: { name: user.name, upi_id: user.upi_id } });
});

// ─── GET USER BADGES ─────────────────────────────────────────────────────────
router.get('/badges', authMiddleware, (req, res) => {
    const badges = (data.badges || []).filter(b => String(b.user_id) === String(req.user.id));
    res.json(badges);
});

module.exports = router;
