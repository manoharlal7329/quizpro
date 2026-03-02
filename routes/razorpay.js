const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { creditWallet, isDuplicatePayment } = require('./wallet_utils');
const Session = require('../database/models/Session');
const Seat = require('../database/models/Seat');

// ─── RAZORPAY WEBHOOK HANDLER ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
    try {
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
            return res.status(400).send("Invalid JSON");
        }

        if (event.event === "payment.captured") {
            const payment = event.payload.payment.entity;
            const notes = payment.notes || {};
            const userId = notes.user_id || notes.userId;
            const sessionId = notes.session_id || notes.sessionId;
            const amount = payment.amount / 100;

            console.log(`✅ [Webhook] Captured: ${payment.id} | User: ${userId}`);

            if (notes.type === 'wallet_deposit' || notes.purpose === 'wallet_topup') {
                const success = await creditWallet(userId, amount, payment.id);
                if (!success) return res.status(409).send("Duplicate payment");
            } else if (sessionId && userId) {
                const success = await bookSeatAfterPayment(userId, sessionId, payment.id);
                if (!success) return res.status(409).send("Duplicate booking");
            }
        }
        res.json({ status: "ok" });
    } catch (e) {
        console.error('Webhook processing error:', e);
        res.status(500).send("Internal Server Error");
    }
});

// Helper: Logic to book a seat
async function bookSeatAfterPayment(userId, sessionId, paymentId) {
    const isDup = await isDuplicatePayment(paymentId);
    if (isDup) return false;

    const session = await Session.findOne({ id: Number(sessionId) });
    if (!session) return false;

    const already = await Seat.findOne({ session_id: Number(sessionId), user_id: Number(userId) });
    if (already) return true;

    const seat = new Seat({
        id: Date.now(),
        session_id: Number(sessionId),
        user_id: Number(userId),
        paid_at: Math.floor(Date.now() / 1000),
        payment_id: paymentId
    });
    await seat.save();

    session.seats_booked = (session.seats_booked || 0) + 1;

    if (session.seats_booked >= session.seat_limit) {
        const delaySeconds = (session.quiz_delay_minutes || 60) * 60;
        session.status = 'confirmed';
        session.quiz_start_at = Math.floor(Date.now() / 1000) + delaySeconds;
        session.pdf_at = session.quiz_start_at - 1800;
        session.prize_pool = Math.floor(session.entry_fee * session.seat_limit * 0.75);
        session.platform_cut = Math.floor(session.entry_fee * session.seat_limit * 0.25);
    }
    await session.save();

    // Broadcast
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
    return true;
}


module.exports = router;
