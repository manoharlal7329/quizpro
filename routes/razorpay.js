const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { creditWallet, isDuplicatePayment, addTxn } = require('./wallet_utils');
const User = require('../database/models/User');
const WalletModel = require('../database/models/Wallet');
const WalletTxnModel = require('../database/models/WalletTxn');
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
    const { finalizeBooking } = require('./booking_utils');
    const booking = await finalizeBooking(userId, sessionId, paymentId);
    if (booking.error) return false;
    return true;
}


module.exports = router;

