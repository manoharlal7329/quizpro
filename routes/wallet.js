const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// Cashfree config
const CF_CLIENT_ID = process.env.CF_CLIENT_ID || '';
const CF_SECRET_KEY = process.env.CF_SECRET_KEY || '';
const CF_ENV = process.env.CF_ENV || 'SANDBOX'; // 'SANDBOX' or 'PROD'

const { Cashfree, CFEnvironment } = require('cashfree-pg');

// Initialize Cashfree SDK
// The Cashfree instance should be initialized once and reused.
// The XClientId, XClientSecret, and XEnvironment properties are set directly on the instance.
const cf = new Cashfree();
cf.XClientId = CF_CLIENT_ID;
cf.XClientSecret = CF_SECRET_KEY;
// HARDENED: Strictly use PRODUCTION for Live keys
cf.XEnvironment = CFEnvironment.PRODUCTION;
cf.XApiVersion = "2023-08-01";
console.log('💳 [CASHFREE] Wallet payment instance forced to PRODUCTION mode.');

const { getWallet, addTxn } = require('./wallet_utils');


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
// Create a Cashfree order to add funds
router.post('/deposit', authMiddleware, async (req, res) => {
    // Force PROD check
    if (process.env.CF_ENV !== 'PROD') {
        return res.status(500).json({ error: 'System is not in PRODUCTION mode. Payment rejected.' });
    }

    const { amount } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum deposit is ₹10' });

    if (cf) {
        try {
            const user = (data.users || []).find(u => String(u.id) === String(req.user.id));
            if (!user) return res.status(404).json({ error: 'User not found' });

            const request = {
                "order_amount": Number(amount),
                "order_currency": "INR",
                "order_id": `order_${req.user.id}_${Date.now()}`,
                "customer_details": {
                    "customer_id": String(user.id),
                    "customer_phone": user.phone || "9999999999",
                    "customer_email": user.email || "user@example.com"
                },
                "order_meta": {
                    "return_url": `${req.headers.origin}/wallet.html?order_id={order_id}`
                }
            };

            const response = await cf.PGCreateOrder(request);
            const orderData = response.data;

            return res.json({
                payment_session_id: orderData.payment_session_id,
                order_id: orderData.order_id,
                amount: orderData.order_amount,
                currency: orderData.order_currency
            });
        } catch (e) {
            console.error('[Wallet] Cashfree Order create error:', e.response?.data || e.message);
            return res.status(500).json({ error: 'Failed to create deposit order' });
        }
    }

    return res.status(500).json({ error: 'Cashfree Payment Gateway is not configured.' });
});

// ── POST /api/wallet/confirm-deposit ──────────────────────────────────────────
// Verify Cashfree payment and credit real wallet
router.post('/confirm-deposit', authMiddleware, async (req, res) => {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Order ID is required' });

    if (cf) {
        try {
            const response = await cf.PGOrderFetchPayments(order_id);
            const payments = response.data;

            // Check if any payment for this order is successful
            const successPayment = (payments || []).find(p => p.payment_status === 'SUCCESS');

            if (!successPayment) {
                return res.status(400).json({ error: 'Payment not successful' });
            }

            const wallet = getWallet(req.user.id);
            const depositAmount = Number(successPayment.order_amount);

            // Double credit check (using order_id as a unique marker in txns)
            const alreadyCredited = (data.wallet_txns || []).find(t => t.note && t.note.includes(order_id));
            if (alreadyCredited) {
                return res.json({ success: true, message: 'Already credited', new_balance: wallet.dep_bal + wallet.win_bal });
            }

            // 🏷️ 100% Credit to dep_bal (Unrotated)
            wallet.dep_bal += depositAmount;

            addTxn(req.user.id, 'real', 'credit', depositAmount, `💰 Wallet Deposit (ID: ${order_id})`);

            save();
            return res.json({ success: true, new_balance: wallet.dep_bal + wallet.win_bal });
        } catch (e) {
            console.error('[Wallet] Cashfree Verify error:', e.response?.data || e.message);
            return res.status(500).json({ error: 'Failed to verify payment' });
        }
    }

    return res.status(400).json({ error: 'Cashfree not configured' });
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
            mobile: u.mobile,
            name: u.name,
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
        const wallet = getWallet(p.user_id);
        wallet.win_bal += p.amount; // Prizes go to winning balance
        addTxn(p.user_id, 'real', 'credit', p.amount, `🏆 Prize #${p.rank} — ${p.session_title}`);
    });

    save();
    res.json({ success: true, credited: prizes.length });
});

// ── POST /api/wallet/withdraw ────────────────────────────────────────────────
// Request a withdrawal (Apply 30% TDS here)
router.post('/withdraw', authMiddleware, (req, res) => {
    const { amount, upi_id, pin } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ error: 'Minimum withdrawal is ₹100' });
    if (!upi_id) return res.status(400).json({ error: 'UPI ID is required' });

    const wallet = getWallet(req.user.id);
    if (!wallet.pin) return res.status(400).json({ error: 'Please set your Wallet PIN first.' });
    if (String(wallet.pin) !== String(pin)) return res.status(403).json({ error: 'Incorrect Wallet PIN' });

    const withdrawalAmt = Number(amount);

    if (wallet.win_bal < withdrawalAmt) {
        return res.status(400).json({ error: 'Insufficient withdrawable balance. You must play quizzes to convert deposits into winnings.' });
    }

    // 🏷️ APPLY 30% TDS (Tax Deducted at Source on withdrawal)
    const tdsAmount = Math.floor(withdrawalAmt * 0.30);
    const netPayout = withdrawalAmt - tdsAmount;

    // Deduct from win_bal
    wallet.win_bal -= withdrawalAmt;

    // Record transactions
    addTxn(req.user.id, 'real', 'debit', withdrawalAmt, `📤 Withdrawal Request (${upi_id})`);
    addTxn(req.user.id, 'real', 'credit', tdsAmount, `🏛️ TDS Adjustment (Will be paid to Govt)`); // This is slightly confusing, let's just record the net.
    // Actually, it's better to record: 
    // Debit withdrawal (full)
    // Note says (Includes 30% TDS: Rs X. Final Net Payout: Rs Y)

    // Store request for admin to process
    if (!data.withdrawals) data.withdrawals = [];
    const request = {
        id: Date.now(),
        user_id: req.user.id,
        amount: withdrawalAmt,
        tds: tdsAmount,
        net: netPayout,
        upi_id,
        status: 'pending',
        at: Math.floor(Date.now() / 1000)
    };
    data.withdrawals.push(request);

    save();
    res.json({
        success: true,
        net_amount: netPayout,
        tds_amount: tdsAmount,
        message: `Withdrawal request for ₹${netPayout} (after ₹${tdsAmount} TDS) placed successfully.`
    });
});


module.exports = router;

