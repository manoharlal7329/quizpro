const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { creditWallet, isDuplicatePayment } = require('./wallet_utils');
const { data, save } = require('../database/db');

// ─── RAZORPAY WEBHOOK HANDLER ────────────────────────────────────────────────
// NOTE: express.raw() is manually applied in server.js for this route
router.post('/webhook', (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || !signature) {
        console.error('❌ Webhook Error: Secret or Signature missing');
        return res.status(400).send("Webhook configuration error");
    }

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

    if (signature !== expectedSignature) {
        console.error('🚨 [FRAUD] Webhook Error: Invalid signature');
        return res.status(403).send("Fraud detected");
    }

    let event;
    try {
        event = JSON.parse(req.body.toString());
    } catch (e) {
        console.error('❌ Webhook Error: Failed to parse body');
        return res.status(400).send("Invalid JSON");
    }

    if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;
        const notes = payment.notes || {};
        const userId = notes.user_id || notes.userId; // Support both naming styles
        const sessionId = notes.session_id || notes.sessionId;
        const amount = payment.amount / 100; // converted from paise

        console.log(`✅ [Webhook] Payment Captured: ${payment.id} | Amount: ₹${amount} | User ID: ${userId}`);

        if (notes.type === 'wallet_deposit' || notes.purpose === 'wallet_topup') {
            if (!userId) return res.status(400).send("Missing userId in notes");
            // 💸 Handle Wallet Deposit
            const success = creditWallet(userId, amount, payment.id);
            if (!success) return res.status(409).send("Duplicate payment blocked");
            console.log(`💰 Wallet Credited: ₹${amount} for User ${userId}`);
        } else if (sessionId && userId) {
            // 🎮 Handle Session Booking
            const success = bookSeatAfterPayment(userId, sessionId, payment.id);
            if (!success) return res.status(409).send("Duplicate or invalid session booking blocked");
        } else {
            console.warn('⚠️ Webhook Error: Captured payment missing context (userId/sessionId)');
            return res.status(400).send("Invalid payment context");
        }
    }

    res.json({ status: "ok" });
});

// Helper: Logic to book a seat (Refactored from payments.js)
function bookSeatAfterPayment(userId, sessionId, paymentId) {
    // 🛡️ ANTI-FRAUD DUPLICATE CHECK
    if (isDuplicatePayment(paymentId)) {
        console.log(`⏩ [Webhook] Duplicate booking blocked: ID ${paymentId}`);
        return false;
    }

    const session = (data.sessions || []).find(s => s.id == sessionId);
    if (!session) {
        console.error(`❌ Webhook error: Session ${sessionId} not found`);
        return false;
    }

    // Prevent double booking for same user/session
    const already = (data.seats || []).find(s => s.session_id == sessionId && String(s.user_id) === String(userId));
    if (already) {
        console.log(`⏩ [Webhook] User ${userId} already booked for session ${sessionId}`);
        return true;
    }

    if (!data.seats) data.seats = [];
    const seat = {
        id: Date.now(),
        session_id: parseInt(sessionId),
        user_id: userId,
        paid_at: Math.floor(Date.now() / 1000),
        payment_id: paymentId
    };
    data.seats.push(seat);
    session.seats_booked = (session.seats_booked || 0) + 1;

    // Check for auto-confirmation
    if (session.seats_booked >= session.seat_limit) {
        const delaySeconds = (session.quiz_delay_minutes || 60) * 60;
        session.status = 'confirmed';
        session.quiz_start_at = Math.floor(Date.now() / 1000) + delaySeconds;
        session.pdf_at = session.quiz_start_at - 1800;
        session.prize_pool = Math.floor(session.entry_fee * session.seat_limit * 0.75);
        session.platform_cut = Math.floor(session.entry_fee * session.seat_limit * 0.25);
        console.log(`✅ Session ${session.id} CONFIRMED via Webhook`);
    }

    save();

    // Broadcast SSE
    try {
        const sessionsRouter = require('./sessions');
        if (sessionsRouter.broadcastSession) {
            sessionsRouter.broadcastSession(String(sessionId), {
                seats_booked: session.seats_booked,
                status: session.status,
                quiz_start_at: session.quiz_start_at || null,
                pdf_at: session.pdf_at || null
            });
        }
    } catch (e) { }
}

module.exports = router;
