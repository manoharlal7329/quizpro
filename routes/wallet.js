const express = require('express');
const router = express.Router();
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

const User = require('../database/models/User');
const WalletModel = require('../database/models/Wallet');
const WalletTxnModel = require('../database/models/WalletTxn');
const Session = require('../database/models/Session');
const Seat = require('../database/models/Seat');
const Withdrawal = require('../database/models/Withdrawal');

const { getWallet, addTxn, creditWallet } = require('./wallet_utils');
const { requestWithdrawal, logFraud } = require('./withdraw_utils');
const { processPayout } = require('../utils/razorpayPayout');

// ── GET /api/wallet/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const w = await getWallet(req.user.id);
        const totalReal = (w.dep_bal || 0) + (w.win_bal || 0);
        res.json({
            demo: w.demo || 0,
            real: totalReal,
            withdrawable: totalReal, // Students can withdraw full real balance (dep + win)
            has_pin: !!w.pin
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/wallet/txns ──────────────────────────────────────────────────────
router.get('/txns', authMiddleware, async (req, res) => {
    try {
        const txns = await WalletTxnModel.find({ user_id: Number(req.user.id) })
            .sort({ at: -1 })
            .limit(30);
        res.json(txns);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /api/wallet/pay ─────────────────────────────────────────────────────
// Deduct from wallet and book a session seat
router.post('/pay', authMiddleware, async (req, res) => {
    const { session_id, wallet_type, pin } = req.body;
    const userId = req.user.id;

    try {
        const session = await Session.findOne({ id: Number(session_id) });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status !== 'open') return res.status(400).json({ error: 'Session not open' });
        if (session.seats_booked >= session.seat_limit) return res.status(400).json({ error: 'Seats full' });

        const already = await Seat.findOne({ session_id: Number(session_id), user_id: Number(userId) });
        if (already) return res.status(400).json({ error: 'Already booked' });

        const wallet = await getWallet(userId);
        const type = wallet_type === 'real' ? 'real' : 'demo';
        const fee = session.entry_fee;

        if (type === 'real') {
            if (!wallet.pin) return res.status(400).json({ error: 'Please set your Wallet PIN first.' });
            if (String(wallet.pin) !== String(pin)) return res.status(403).json({ error: 'Incorrect Wallet PIN' });

            const totalReal = wallet.dep_bal + wallet.win_bal;
            if (totalReal < fee) return res.status(400).json({ error: `Insufficient balance. Need ₹${fee}` });

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

        await wallet.save();
        await addTxn(userId, type, 'debit', fee, `Seat booked: ${session.title}`);

        const { finalizeBooking } = require('./booking_utils');
        const paymentId = `WALLET_${type.toUpperCase()}_${Date.now()}`;
        const booking = await finalizeBooking(userId, session_id, paymentId);

        if (booking.error) return res.status(400).json({ error: booking.error });

        res.json({
            success: true,
            seat_id: Date.now(),
            wallet_type: type,
            balance_after: type === 'real' ? (wallet.dep_bal + wallet.win_bal) : wallet.demo,
            session_confirmed: booking.confirmed
        });



    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── POST /api/wallet/set-pin ─────────────────────────────────────────────────
router.post('/set-pin', authMiddleware, async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });

    try {
        const wallet = await getWallet(req.user.id);
        wallet.pin = String(pin);
        await wallet.save();
        res.json({ success: true, message: 'Wallet PIN set successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
    const { order_id, payment_id, razorpay_signature, amount } = req.body;

    try {
        if (RZP_REAL && razorpay_signature) {
            const body = order_id + '|' + payment_id;
            const expectedSig = crypto.createHmac('sha256', RZP_KEY_SECRET).update(body).digest('hex');
            if (expectedSig !== razorpay_signature) return res.status(400).json({ error: 'Invalid payment signature' });
        } else {
            return res.status(400).json({ error: 'Signature verification required' });
        }

        const { isDuplicatePayment } = require('./wallet_utils');
        const isDup = await isDuplicatePayment(payment_id);

        if (isDup) {
            // Processed by webhook already (or older payment), return success to avoid frontend error
            const wallet = await getWallet(req.user.id);
            return res.json({ success: true, message: "Payment verified and wallet credited", new_balance: (wallet.dep_bal || 0) + (wallet.win_bal || 0) });
        }

        let verifiedAmount = Number(amount);
        let paymentStatus = "success";

        // Fetch actual payment details from Razorpay to prevent amount tampering
        if (RZP_REAL && Razorpay) {
            const rzp = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
            try {
                const paymentDetails = await rzp.payments.fetch(payment_id);

                if (paymentDetails.order_id !== order_id) {
                    console.error(`🚨 [FRAUD] Order ID mismatch: Expected ${order_id}, got ${paymentDetails.order_id}`);
                    return res.status(400).json({ error: 'Order ID mismatch' });
                }
                if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
                    console.error(`🚨 [FRAUD] Payment not captured: Status is ${paymentDetails.status}`);
                    return res.status(400).json({ error: 'Payment not captured' });
                }

                verifiedAmount = paymentDetails.amount / 100; // Razorpay returns paise
                paymentStatus = paymentDetails.status;
            } catch (err) {
                console.error(`❌ Razorpay API Error: ${err.message}`);
                return res.status(500).json({ error: 'Failed to fetch payment details from Razorpay' });
            }
        }

        const success = await creditWallet(req.user.id, verifiedAmount, payment_id, "razorpay_sync", order_id, paymentStatus);
        if (!success) return res.status(409).json({ error: 'Duplicate or invalid payment' });

        const wallet = await getWallet(req.user.id);
        res.json({ success: true, message: "Payment verified and wallet credited", new_balance: (wallet.dep_bal || 0) + (wallet.win_bal || 0) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── POST /api/wallet/admin/topup ─────────────────────────────────────────────
// Admin credits demo or real balance to any user
router.post('/admin/topup', authMiddleware, async (req, res) => {
    try {
        const liveUser = await User.findOne({ id: Number(req.user.id) });
        if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

        const { user_id, wallet_type, amount, note } = req.body;
        if (!user_id || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid params' });

        const targetUser = await User.findOne({ id: Number(user_id) });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        const wallet = await getWallet(user_id);
        wallet.win_bal = (wallet.win_bal || 0) + Number(amount);
        await wallet.save();

        await addTxn(user_id, 'real', 'credit', Number(amount), note || `Admin topup by ${liveUser.name}`);

        res.json({ success: true, user: targetUser.phone || targetUser.email, new_balance: (wallet.dep_bal || 0) + (wallet.win_bal || 0) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/wallet/admin/list ────────────────────────────────────────────────
router.get('/admin/list', authMiddleware, async (req, res) => {
    try {
        const liveUser = await User.findOne({ id: Number(req.user.id) });
        if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

        const users = await User.find({});
        const wallets = await WalletModel.find({});

        const result = users.map(u => {
            const w = wallets.find(w => String(w.user_id) === String(u.id)) || { dep_bal: 0, win_bal: 0 };
            return {
                id: u.id,
                mobile: u.phone || u.mobile || 'N/A',
                name: u.full_name || u.name,
                real: (w.dep_bal || 0) + (w.win_bal || 0),
                dep_bal: w.dep_bal || 0,
                win_bal: w.win_bal || 0
            };
        });

        // res.json(result); // Removed double response
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── POST /api/wallet/admin/credit-prize ──────────────────────────────────────
router.post('/admin/credit-prize', authMiddleware, async (req, res) => {
    try {
        const liveUser = await User.findOne({ id: Number(req.user.id) });
        if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

        const prizes = req.body.prizes;
        if (!Array.isArray(prizes)) return res.status(400).json({ error: 'prizes array required' });

        for (const p of prizes) {
            const winnerWallet = await getWallet(p.user_id);
            const winnerUser = await User.findOne({ id: Number(p.user_id) });

            let finalPrize = Number(p.amount);
            let referralComm = 0;

            if (winnerUser && winnerUser.referred_by) {
                const referrer = await User.findOne({ referral_code: winnerUser.referred_by });
                if (referrer && String(referrer.id) !== String(p.user_id)) {
                    referralComm = Math.floor(finalPrize * 0.05);
                    finalPrize = finalPrize - referralComm;

                    const referrerWallet = await getWallet(referrer.id);
                    referrerWallet.win_bal = (referrerWallet.win_bal || 0) + referralComm;
                    await referrerWallet.save();
                    await addTxn(referrer.id, 'real', 'credit', referralComm, `📩 Referral Win Comm: ${winnerUser.username} — ${p.session_title}`);
                }
            }

            winnerWallet.win_bal = (winnerWallet.win_bal || 0) + finalPrize;
            await winnerWallet.save();
            await addTxn(p.user_id, 'real', 'credit', finalPrize, `🏆 Prize #${p.rank} — ${p.session_title}${referralComm > 0 ? ' (Net after 5% Ref)' : ''}`);
        }

        res.json({ success: true, credited: prizes.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── POST /api/wallet/withdraw (Anti-Fraud & Fund Lock) ─────────────────────
router.post('/withdraw', authMiddleware, async (req, res) => {
    const { amount, upi_id, pin } = req.body;
    const userId = req.user.id;

    try {
        if (!amount || amount < 1) return res.status(400).json({ error: 'MIN_WITHDRAW', message: 'Minimum withdrawal is ₹1' });
        if (!upi_id || !upi_id.includes('@')) return res.status(400).json({ error: 'INVALID_UPI', message: 'Valid UPI ID required.' });

        const wallet = await getWallet(userId);
        if (!wallet.pin) return res.status(400).json({ error: 'PIN_NOT_SET', message: 'Please set your Wallet PIN first.' });
        if (String(wallet.pin) !== String(pin)) {
            await logFraud(userId, "INVALID_PIN_WITHDRAW", { amount, upi_id });
            return res.status(403).json({ error: 'INVALID_PIN', message: 'Incorrect Wallet PIN' });
        }

        const result = await requestWithdrawal({ userId, amount: Number(amount), upi: upi_id });
        if (result.error) return res.status(403).json(result);

        // 🚀 AUTO-PAYOUT (Pro Level)
        if (process.env.AUTO_PAYOUT_ENABLED === "true" && result.withdrawId) {
            try {
                await processPayout(result.withdrawId);
            } catch (payoutErr) {
                console.error(`⚠️ Auto-payout failed for ${result.withdrawId}:`, payoutErr.message);
                // We don't fail the request here, as the withdrawal is already created/pending
            }
        }

        res.json({ success: true, message: 'Withdraw request submitted.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── POST /api/wallet/admin/approve-withdraw ──────────────────────────────────
router.post('/admin/approve-withdraw', authMiddleware, async (req, res) => {
    try {
        const liveUser = await User.findOne({ id: Number(req.user.id) });
        if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

        const { withdraw_id } = req.body;
        const wd = await Withdrawal.findOne({ id: withdraw_id });
        if (!wd || wd.status !== 'PENDING') return res.status(400).json({ error: 'Invalid or already processed' });

        wd.status = 'PAID';
        wd.paid_at = Math.floor(Date.now() / 1000);
        await wd.save();

        res.json({ success: true, message: 'Withdrawal marked as PAID.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

