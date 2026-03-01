const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// Razorpay config
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RZP_REAL = RZP_KEY_ID.startsWith('rzp_') && !RZP_KEY_ID.includes('PLACEHOLDER');

let Razorpay;
if (RZP_REAL) {
    try { Razorpay = require('razorpay'); } catch (e) { console.warn('[Wallet] Razorpay package not installed'); }
}

const { getWallet, addTxn } = require('./wallet_utils');
const { requestWithdrawal, logFraud } = require('./withdraw_utils');
const { processPayout } = require('../utils/razorpayPayout');


// ── GET /api/wallet/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
    const w = getWallet(req.user.id);
    res.json({
        demo: w.demo,
        real: w.dep_bal + w.win_bal, // Total visible balance
        withdrawable: w.win_bal,     // Hidden from main view, used for withdrawal limit
        has_pin: !!w.pin
    });
});

// ── GET /api/wallet/txns ──────────────────────────────────────────────────────
router.get('/txns', authMiddleware, (req, res) => {
    const txns = (data.wallet_txns || [])
        .filter(t => String(t.user_id) === String(req.user.id))
        .sort((a, b) => b.at - a.at)
        .slice(0, 30);
    res.json(txns);
});

// ── POST /api/wallet/pay ─────────────────────────────────────────────────────
// Deduct from wallet and book a session seat
router.post('/pay', authMiddleware, (req, res) => {
    const { session_id, wallet_type, pin } = req.body; // wallet_type: 'demo' or 'real'
    const userId = req.user.id;

    const session = (data.sessions || []).find(s => s.id == session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'open') return res.status(400).json({ error: 'Session not open' });
    if (session.seats_booked >= session.seat_limit) return res.status(400).json({ error: 'Seats full' });

    // Prevent double booking
    const already = (data.seats || []).find(s => s.session_id == session_id && String(s.user_id) === String(userId));
    if (already) return res.status(400).json({ error: 'Already booked' });

    const wallet = getWallet(userId);
    const type = wallet_type === 'real' ? 'real' : 'demo';
    const fee = session.entry_fee;

    if (type === 'real') {
        if (!wallet.pin) return res.status(400).json({ error: 'Please set your Wallet PIN first in the Wallet page.' });
        if (String(wallet.pin) !== String(pin)) return res.status(403).json({ error: 'Incorrect Wallet PIN' });

        const totalReal = wallet.dep_bal + wallet.win_bal;
        if (totalReal < fee) {
            return res.status(400).json({ error: `Insufficient balance. Need ₹${fee}` });
        }

        // 🔄 ROTATE LOGIC: Use dep_bal (unrotated) first, then win_bal
        if (wallet.dep_bal >= fee) {
            wallet.dep_bal -= fee;
        } else {
            const remainder = fee - wallet.dep_bal;
            wallet.dep_bal = 0;
            wallet.win_bal -= remainder;
        }
    } else {
        if (wallet.demo < fee) return res.status(400).json({ error: `Insufficient demo balance` });
        wallet.demo -= fee;
    }

    addTxn(userId, type, 'debit', fee, `Seat booked: ${session.title}`);

    // Create seat
    if (!data.seats) data.seats = [];
    const seat = { id: Date.now(), session_id: Number(session_id), user_id: userId, paid_at: Math.floor(Date.now() / 1000), payment_id: `WALLET_${type.toUpperCase()}_${Date.now()}` };
    data.seats.push(seat);
    session.seats_booked = (session.seats_booked || 0) + 1;

    const result = { success: true, seat_id: seat.id, wallet_type: type, balance_after: wallet[type] };

    // Auto-confirm if full
    if (session.seats_booked >= session.seat_limit) {
        const delaySeconds = (session.quiz_delay_minutes || 60) * 60;
        session.status = 'confirmed';
        session.quiz_start_at = Math.floor(Date.now() / 1000) + delaySeconds;
        session.pdf_at = session.quiz_start_at - 1800; // PDF unlocks 30 min before quiz
        session.prize_pool = Math.floor(session.entry_fee * session.seat_limit * 0.75);
        session.platform_cut = Math.floor(session.entry_fee * session.seat_limit * 0.25);
        result.session_confirmed = true;
        result.quiz_start_at = session.quiz_start_at;
        result.pdf_at = session.pdf_at;
        console.log(`✅ Session ${session.id} CONFIRMED via wallet — Quiz in ${session.quiz_delay_minutes || 60} min`);
    }

    save();

    // SSE broadcast — notify all session viewers
    try {
        const sessionsRouter = require('./sessions');
        if (sessionsRouter.broadcastSession) {
            sessionsRouter.broadcastSession(String(session_id), {
                seats_booked: session.seats_booked,
                status: session.status,
                quiz_start_at: session.quiz_start_at || null,
                pdf_at: session.pdf_at || null
            });
        }
    } catch (e) { }

    res.json(result);
});


// ── POST /api/wallet/set-pin ─────────────────────────────────────────────────
router.post('/set-pin', authMiddleware, (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });

    const wallet = getWallet(req.user.id);
    wallet.pin = String(pin);
    save();
    res.json({ success: true, message: 'Wallet PIN set successfully' });
});

// ── POST /api/wallet/deposit ─────────────────────────────────────────────────
// Create a Razorpay order (or Simulation order) to add funds
router.post('/deposit', authMiddleware, async (req, res) => {
    const { amount } = req.body; // Amount in INR
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum deposit is ₹10' });

    if (RZP_REAL && Razorpay) {
        try {
            const rzp = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
            const order = await rzp.orders.create({
                amount: amount * 100, // paise
                currency: 'INR',
                receipt: `wallet_${req.user.id}_${Date.now()}`,
                notes: { user_id: String(req.user.id), type: 'wallet_deposit' }
            });

            return res.json({
                order_id: order.id,
                amount: order.amount,
                currency: 'INR',
                key: RZP_KEY_ID
            });
        } catch (e) {
            console.error('[Wallet] Order create error:', e.message);
            return res.status(500).json({ error: 'Failed to create deposit order' });
        }
    }

    // Simulation mode removed for production
    return res.status(500).json({ error: 'Real Payment Gateway is not configured. Please contact support.' });
});

// ── POST /api/wallet/confirm-deposit ──────────────────────────────────────────
// Verify Razorpay payment (or Simulation token) and credit real wallet
router.post('/confirm-deposit', authMiddleware, async (req, res) => {
    const { order_id, payment_id, razorpay_signature, amount, simulation } = req.body;

    if (RZP_REAL && razorpay_signature) {
        const body = order_id + '|' + payment_id;
        const expectedSig = crypto.createHmac('sha256', RZP_KEY_SECRET).update(body).digest('hex');

        if (expectedSig !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }
    } else {
        return res.status(400).json({ error: 'Signature verification required or simulation missing' });
    }

    // Use creditWallet helper for consistent fee cut and logging
    const success = creditWallet(req.user.id, amount, payment_id, "razorpay_sync");

    if (!success) {
        return res.status(409).json({ error: 'Duplicate or invalid payment' });
    }

    const wallet = getWallet(req.user.id);
    res.json({ success: true, new_balance: wallet.dep_bal + wallet.win_bal });
});


// ── POST /api/wallet/admin/topup ─────────────────────────────────────────────
// Admin credits demo or real balance to any user
router.post('/admin/topup', authMiddleware, (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const { user_id, wallet_type, amount, note } = req.body;
    if (!user_id || !wallet_type || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid params' });

    const targetUser = (data.users || []).find(u => String(u.id) === String(user_id));
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const wallet = getWallet(user_id);
    const type = 'real';
    wallet.win_bal += Number(amount); // Admin topups are treated as winnings/withdrawable

    addTxn(user_id, type, 'credit', Number(amount), note || `Admin topup by ${liveUser.name}`);

    save();
    res.json({ success: true, user: targetUser.mobile, wallet_type: type, new_balance: type === 'real' ? (wallet.dep_bal + wallet.win_bal) : wallet.demo });
});

// ── GET /api/wallet/admin/list ────────────────────────────────────────────────
router.get('/admin/list', authMiddleware, (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const result = (data.users || []).map(u => {
        const w = getWallet(u.id);
        return {
            id: u.id,
            mobile: u.phone || u.mobile || 'N/A',
            name: u.full_name || u.name,
            real: w.dep_bal + w.win_bal,
            dep_bal: w.dep_bal,
            win_bal: w.win_bal
        };
    });

    res.json(result);
});

// ── POST /api/wallet/admin/credit-prize ──────────────────────────────────────
// Credit prize money to real wallet (Full 100%)
router.post('/admin/credit-prize', authMiddleware, (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const prizes = req.body.prizes; // [{ user_id, amount, session_title, rank }]
    if (!Array.isArray(prizes)) return res.status(400).json({ error: 'prizes array required' });

    prizes.forEach(p => {
        const winnerWallet = getWallet(p.user_id);
        const winnerUser = (data.users || []).find(u => String(u.id) === String(p.user_id));

        let finalPrize = p.amount;
        let referralComm = 0;

        // Check for referral (referred_by stores the referral_code of the referrer)
        if (winnerUser && winnerUser.referred_by) {
            const referrer = (data.users || []).find(u => u.referral_code === winnerUser.referred_by);
            if (referrer && String(referrer.id) !== String(p.user_id)) {
                referralComm = Math.floor(p.amount * 0.05);
                finalPrize = p.amount - referralComm;

                const referrerWallet = getWallet(referrer.id);
                referrerWallet.win_bal += referralComm;
                addTxn(referrer.id, 'real', 'credit', referralComm, `📩 Referral Win Comm: ${winnerUser.username} — ${p.session_title}`);
            }
        }

        winnerWallet.win_bal += finalPrize;
        addTxn(p.user_id, 'real', 'credit', finalPrize, `🏆 Prize #${p.rank} — ${p.session_title}${referralComm > 0 ? ' (Net after 5% Ref)' : ''}`);
    });

    save();
    res.json({ success: true, credited: prizes.length });
});

// ─── POST /api/wallet/withdraw (Anti-Fraud & Fund Lock) ─────────────────────
router.post('/withdraw', authMiddleware, (req, res) => {
    const { amount, upi_id, pin } = req.body;
    const userId = req.user.id;

    if (!amount || amount < 1) return res.status(400).json({ error: 'MIN_WITHDRAW', message: 'Minimum withdrawal is ₹1' });
    if (!upi_id || !upi_id.includes('@')) return res.status(400).json({ error: 'INVALID_UPI', message: 'Valid UPI ID required.' });

    const wallet = getWallet(userId);
    if (!wallet.pin) return res.status(400).json({ error: 'PIN_NOT_SET', message: 'Please set your Wallet PIN first.' });
    if (String(wallet.pin) !== String(pin)) {
        logFraud(userId, "INVALID_PIN_WITHDRAW", { amount, upi_id });
        return res.status(403).json({ error: 'INVALID_PIN', message: 'Incorrect Wallet PIN' });
    }

    const { requestWithdrawal } = require('./withdraw_utils');
    const result = requestWithdrawal({ userId, amount: Number(amount), upi: upi_id });

    if (result.error) {
        return res.status(403).json(result);
    }

    res.json({ success: true, message: 'Withdraw request submitted. Admin will process it shortly.' });
});

// ─── POST /api/wallet/admin/approve-withdraw ──────────────────────────────────
router.post('/admin/approve-withdraw', authMiddleware, (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const { withdraw_id } = req.body;
    const wd = (data.withdraw_requests || []).find(w => w.id === withdraw_id);
    if (!wd || wd.status !== 'PENDING') return res.status(400).json({ error: 'Invalid or already processed' });

    wd.status = 'PAID';
    wd.paid_at = Math.floor(Date.now() / 1000);

    save();
    res.json({ success: true, message: 'Withdrawal marked as PAID.' });
});

// ─── POST /api/wallet/withdraw/auto (Auto-Payout via Razorpay X) ─────────────
router.post('/withdraw/auto', authMiddleware, async (req, res) => {
    // Only admins or if globally enabled
    if (process.env.AUTO_PAYOUT_ENABLED !== "true") {
        return res.status(403).json({ error: "AUTO_PAYOUT_DISABLED" });
    }

    const { withdrawId } = req.body;
    if (!withdrawId) return res.status(400).json({ error: 'Missing withdrawId' });

    try {
        const payout = await processPayout(withdrawId);
        res.json({ success: true, payout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


module.exports = router;

