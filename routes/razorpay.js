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
            console.error('Invalid signature');
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
            const orderId = payment.order_id;
            const paymentStatus = payment.status;

            if (paymentStatus !== 'captured') {
                console.error('Payment not captured');
            }

            console.log(`✅ [Webhook] Captured: ${payment.id} | User: ${userId}`);

            if (notes.type === 'wallet_deposit' || notes.purpose === 'wallet_topup') {
                const success = await creditWallet(userId, amount, payment.id, "webhook", orderId, paymentStatus);
                if (!success) {
                    console.log(`Duplicate payment handled gracefully in Webhook: ${payment.id}`);
                }
            } else if (sessionId && userId) {
                const success = await bookSeatAfterPayment(userId, sessionId, payment.id);
                if (!success) console.log(`Duplicate booking handled gracefully in Webhook: ${payment.id}`);
            }
        } else if (event.event === "payout.processed" || event.event === "payout.updated" && event.payload.payout.entity.status === 'processed') {
            const payout = event.payload.payout.entity;
            const withdrawId = payout.reference_id || (payout.notes && payout.notes.withdraw_id);
            if (!withdrawId) return res.json({ status: "ignored_no_ref" });

            const Withdrawal = require('../database/models/Withdrawal');
            const wd = await Withdrawal.findOne({ id: withdrawId });
            if (wd && wd.status !== 'completed') {
                wd.status = 'completed';
                wd.paid_at = Math.floor(Date.now() / 1000);
                await wd.save();

                const wallet = await getWallet(wd.user_id);
                if (wallet) {
                    wallet.total_withdrawn = (wallet.total_withdrawn || 0) + wd.amount;
                    await wallet.save();
                }
                console.log(`✅ [Webhook] Payout Processed: ${withdrawId}`);
            }
        } else if (event.event === "payout.reversed" || event.event === "payout.failed") {
            const payout = event.payload.payout.entity;
            const withdrawId = payout.reference_id || (payout.notes && payout.notes.withdraw_id);
            if (!withdrawId) return res.json({ status: "ignored_no_ref" });

            const Withdrawal = require('../database/models/Withdrawal');
            const wd = await Withdrawal.findOne({ id: withdrawId });
            if (wd && wd.status !== 'failed' && wd.status !== 'rejected') {
                wd.status = 'failed';
                wd.error = event.payload.payout.entity.status_details?.description || 'Payout reversed by bank';
                await wd.save();

                const wallet = await getWallet(wd.user_id);
                if (wallet) {
                    wallet.win_bal += wd.amount;
                    await wallet.save();
                    await addTxn(wd.user_id, 'real', 'credit', wd.amount, `🔄 Auto-Refund: Withdrawal Failed (${withdrawId})`);
                }
                console.log(`❌ [Webhook] Payout Failed/Reversed: ${withdrawId} | User #${wd.user_id} Refunded`);
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

