const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const { getWallet, addTxn } = require('./wallet_utils');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

const cf = new Cashfree();
cf.XClientId = process.env.CF_CLIENT_ID || '';
cf.XClientSecret = process.env.CF_SECRET_KEY || '';
// HARDENED: Webhook verification MUST use PRODUCTION environment
cf.XEnvironment = CFEnvironment.PRODUCTION;
console.log('💳 [CASHFREE] Webhook instance forced to PRODUCTION mode.');

// ─── WEBHOOK HANDLER ─────────────────────────────────────────────────────────
router.post('/webhook', (req, res) => {
    console.log('[Cashfree Webhook] Received event');

    try {
        const payload = req.body;
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];

        if (!signature || !timestamp) {
            console.error('[Cashfree Webhook] Missing signature or timestamp');
            return res.status(400).send('Missing signature/timestamp');
        }

        // Verify Signature
        try {
            cf.PGVerifyWebhookSignature(signature, JSON.stringify(payload), timestamp);
        } catch (err) {
            console.error('[Cashfree Webhook] Signature verification failed:', err.message);
            return res.status(400).send('Invalid signature');
        }

        const event = payload.type;
        const orderData = payload.data.order;
        const orderId = orderData.order_id;
        const amount = orderData.order_amount;
        const status = orderData.order_status;

        console.log(`[Cashfree Webhook] Event: ${event}, Order: ${orderId}, Status: ${status}`);

        if (status === 'PAID') {
            // Logic to identify if it's a wallet deposit or session booking
            if (orderId.startsWith('order_')) {
                // Wallet Deposit
                const userId = orderId.split('_')[1];
                const wallet = getWallet(userId);

                // Double credit check
                const alreadyCredited = (data.wallet_txns || []).find(t => t.note && t.note.includes(orderId));
                if (!alreadyCredited) {
                    wallet.dep_bal += Number(amount);
                    addTxn(userId, 'real', 'credit', Number(amount), `💰 Wallet Deposit via Webhook (ID: ${orderId})`);
                    save();
                    console.log(`[Cashfree Webhook] Credited ₹${amount} to User ${userId}`);
                }
            } else if (orderId.startsWith('seat_')) {
                // Session Booking
                const parts = orderId.split('_');
                const sessionId = parts[1];
                const userId = parts[2];

                const session = (data.sessions || []).find(s => String(s.id) === String(sessionId));
                if (session && session.status === 'open') {
                    // Check if seat already exists
                    const existingSeat = (data.seats || []).find(s => s.session_id == sessionId && String(s.user_id) === String(userId));
                    if (!existingSeat) {
                        if (!data.seats) data.seats = [];
                        data.seats.push({
                            id: Date.now(),
                            session_id: parseInt(sessionId),
                            user_id: parseInt(userId),
                            paid_at: Math.floor(Date.now() / 1000),
                            payment_id: orderId
                        });

                        const pay = (data.payments || []).find(p => p.order_id === orderId);
                        if (pay) { pay.status = 'paid'; pay.payment_id = orderId; }

                        session.seats_booked = (session.seats_booked || 0) + 1;

                        // Auto-confirm if full
                        if (session.seats_booked >= session.seat_limit) {
                            const delaySeconds = (session.quiz_delay_minutes || 60) * 60;
                            session.status = 'confirmed';
                            session.quiz_start_at = Math.floor(Date.now() / 1000) + delaySeconds;
                            session.pdf_at = session.quiz_start_at - 1800;
                            session.prize_pool = Math.floor(session.entry_fee * session.seat_limit * 0.75);
                            session.platform_cut = Math.floor(session.entry_fee * session.seat_limit * 0.25);
                        }

                        save();
                        console.log(`[Cashfree Webhook] Booked seat for User ${userId} in Session ${sessionId}`);

                        // Broadcast update
                        const sessionsRouter = require('./sessions');
                        if (sessionsRouter.broadcastSession) {
                            sessionsRouter.broadcastSession(String(sessionId), {
                                seats_booked: session.seats_booked,
                                status: session.status,
                                quiz_start_at: session.quiz_start_at || null,
                                pdf_at: session.pdf_at || null
                            });
                        }
                    }
                }
            }
        }

        res.status(200).send('Webhook processed');
    } catch (e) {
        console.error('[Cashfree Webhook] Error:', e.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
