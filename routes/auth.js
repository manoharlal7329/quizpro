const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const jwt = require('jsonwebtoken');
const https = require('https');

// ── Send SMS via Fast2SMS ──────────────────────────────────────────────────────
function sendSMS(mobile, otp) {
    return new Promise((resolve) => {
        const key = process.env.FAST2SMS_KEY;
        if (!key || process.env.OTP_PROVIDER !== 'fast2sms') {
            console.log(`[OTP] Mobile: ${mobile} => OTP: ${otp} (console mode)`);
            return resolve(false);
        }
        const message = `Your QuizPro OTP is ${otp}. Valid for 5 minutes. DO NOT SHARE. -QuizPro`;
        const params = new URLSearchParams({
            authorization: key,
            message,
            language: 'english',
            route: 'q',
            numbers: mobile
        });
        const options = {
            hostname: 'www.fast2sms.com',
            path: `/dev/bulkV2?${params.toString()}`,
            method: 'GET',
            headers: { 'cache-control': 'no-cache' }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.return === true) {
                        console.log(`[OTP] ✅ SMS sent to ${mobile}`);
                        resolve(true);
                    } else {
                        console.error('[OTP] Fast2SMS error:', JSON.stringify(json));
                        resolve(false);
                    }
                } catch (e) { resolve(false); }
            });
        });
        req.on('error', e => {
            console.error('[OTP] SMS failed:', e.message);
            resolve(false);
        });
        req.end();
    });
}

// ── Auto-generate unique referral code ───────────────────────────────────────
function makeReferralCode(name) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const prefix = (name || 'USER').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'U');
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return prefix + suffix;
}

// ─── SEND OTP ─────────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
    const { mobile, ref_code } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }

    const otp = process.env.DEMO_OTP_MODE === 'true'
        ? '1234'
        : String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000;

    let user = data.users.find(u => u.mobile === mobile);

    if (!user) {
        // New user — generate referral code
        let refCode;
        do { refCode = makeReferralCode(mobile); }
        while (data.users.find(u => u.referral_code === refCode));

        user = {
            id: Date.now(),
            mobile,
            name: 'User_' + mobile.slice(-4),
            otp, otp_expires: expires,
            is_admin: 0,
            referral_code: refCode,
            referred_by: ref_code || null,
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
        data.wallet_txns.push({ id: Date.now(), user_id: user.id, wallet: 'demo', type: 'credit', amount: bonus, note: '🎁 Welcome bonus', at: Math.floor(Date.now() / 1000) });

        // Track referral
        if (ref_code) {
            const referrer = data.users.find(u => u.referral_code === ref_code);
            if (referrer) {
                if (!data.referrals) data.referrals = [];
                data.referrals.push({ id: Date.now(), referrer_id: referrer.id, referred_id: user.id, bonus_given: false, at: Math.floor(Date.now() / 1000) });
            }
        }
    } else {
        user.otp = otp;
        user.otp_expires = expires;
        // Backfill referral code for old users
        if (!user.referral_code) {
            let refCode;
            do { refCode = makeReferralCode(user.name || user.mobile); }
            while (data.users.find(u => u.referral_code === refCode));
            user.referral_code = refCode;
        }
    }
    save();

    const smsSent = await sendSMS(mobile, otp);
    // Dev: return OTP in response body. Production: hide it
    const isProd = process.env.OTP_PROVIDER === 'fast2sms' && process.env.DEMO_OTP_MODE !== 'true';
    res.json({
        message: isProd ? 'OTP sent to your mobile number' : `OTP sent (dev: ${otp})`,
        ...(isProd ? {} : { otp })
    });
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    const user = data.users.find(u => u.mobile === mobile);

    if (!user) return res.status(400).json({ error: 'User not found' });
    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (Date.now() > user.otp_expires) return res.status(400).json({ error: 'OTP expired' });

    user.otp = null;
    user.otp_expires = null;
    save();

    const token = jwt.sign(
        { id: user.id, mobile: user.mobile, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, mobile: user.mobile, name: user.name, is_admin: user.is_admin } });
});

// ─── GET ME ───────────────────────────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
    const user = data.users.find(u => u.id == req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { otp, otp_expires, ...safeUser } = user;
    res.json(safeUser);
});

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
router.post('/update-profile', authMiddleware, async (req, res) => {
    const { name, upi_id } = req.body;
    const user = data.users.find(u => u.id == req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name) user.name = name;

    // ✅ PLAN RULE: Same UPI → block (1 UPI = 1 identity)
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
