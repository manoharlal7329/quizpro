const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// Cashfree config
const CF_CLIENT_ID = process.env.CF_CLIENT_ID || '';
const CF_SECRET_KEY = process.env.CF_SECRET_KEY || '';
const CF_ENV = process.env.CF_ENV || 'SANDBOX';

const { Cashfree, CFEnvironment } = require('cashfree-pg');

const cf = new Cashfree();
cf.XClientId = process.env.CF_CLIENT_ID || '';
cf.XClientSecret = process.env.CF_SECRET_KEY || '';
// HARDENED: Strictly use PRODUCTION for Live keys
cf.XEnvironment = CFEnvironment.PRODUCTION;
cf.XApiVersion = "2023-08-01";
console.log('💳 [CASHFREE] Session payment instance forced to PRODUCTION mode.');

// ─── CREATE CASHFREE ORDER ───────────────────────────────────────────────────────────────────
router.post('/create-order', authMiddleware, async (req, res) => {
    // Force PROD check
    if (process.env.CF_ENV !== 'PROD') {
        return res.status(500).json({ error: 'System is not in PRODUCTION mode. Payment rejected.' });
    }

    const { session_id } = req.body;
    const session = (data.sessions || []).find(s => s.id == session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'open') return res.status(400).json({ error: 'Session is not open' });

    const existingSeat = (data.seats || []).find(s => s.session_id == session_id && String(s.user_id) === String(req.user.id));
    if (existingSeat) return res.status(400).json({ error: 'Already booked' });

    if (cf) {
        try {
            const user = (data.users || []).find(u => String(u.id) === String(req.user.id));
            if (!user) return res.status(404).json({ error: 'User not found' });

            const request = {
                "order_amount": Number(session.entry_fee),
                "order_currency": "INR",
                "order_id": `seat_${session_id}_${req.user.id}_${Date.now()}`,
                "customer_details": {
                    "customer_id": String(user.id),
                    "customer_phone": user.phone || "9999999999",
                    "customer_email": user.email || "user@example.com"
                },
                "order_meta": {
                    "return_url": `${req.headers.origin}/session.html?id=${session_id}&order_id={order_id}`
                }
            };

            const response = await cf.PGCreateOrder(request);
            const orderData = response.data;

            if (!data.payments) data.payments = [];
            data.payments.push({ id: Date.now(), user_id: req.user.id, session_id, order_id: orderData.order_id, amount: session.entry_fee, status: 'pending' });
            save();

            return res.json({
                payment_session_id: orderData.payment_session_id,
                order_id: orderData.order_id,
                amount: orderData.order_amount,
                currency: orderData.order_currency
            });
        } catch (e) {
            console.error('[Cashfree] Order create error:', e.response?.data || e.message);
            return res.status(500).json({ error: 'Failed to create payment order' });
        }
    }

    return res.status(500).json({ error: 'Payment Gateway is not configured.' });
});

// ─── VERIFY CASHFREE PAYMENT ─────────────────────────────────────────────────────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
    const { order_id, session_id } = req.body;
    const session = (data.sessions || []).find(s => s.id == session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.seats_booked >= session.seat_limit) return res.status(400).json({ error: 'Session full' });

    if (cf) {
        try {
            const response = await cf.PGOrderFetchPayments(order_id);
            const payments = response.data;
            const successPayment = (payments || []).find(p => p.payment_status === 'SUCCESS');

            if (!successPayment) {
                return res.status(400).json({ error: 'Payment not successful' });
            }

            // Duplicate seat check (using order_id as payment_id unique marker)
            const dup = (data.seats || []).find(s => s.session_id == session_id && s.payment_id == order_id);
            if (dup) return res.status(400).json({ error: 'Seat already confirmed for this payment' });

            if (!data.seats) data.seats = [];
            data.seats.push({
                id: Date.now(),
                session_id: parseInt(session_id),
                user_id: req.user.id,
                paid_at: Math.floor(Date.now() / 1000),
                payment_id: order_id // Use order_id as unique payment reference
            });

            const pay = (data.payments || []).find(p => p.order_id === order_id);
            if (pay) { pay.status = 'paid'; pay.payment_id = order_id; }

            session.seats_booked = (session.seats_booked || 0) + 1;

            let result = { booked: true, session_confirmed: false, seats_remaining: session.seat_limit - session.seats_booked };

            if (session.seats_booked >= session.seat_limit) {
                // Use admin-configured delay (quiz_delay_minutes), default 60 min
                const delaySeconds = (session.quiz_delay_minutes || 60) * 60;
                session.status = 'confirmed';
                session.quiz_start_at = Math.floor(Date.now() / 1000) + delaySeconds;
                session.pdf_at = session.quiz_start_at - 1800; // PDF 30 min before quiz
                session.prize_pool = Math.floor(session.entry_fee * session.seat_limit * 0.75);
                session.platform_cut = Math.floor(session.entry_fee * session.seat_limit * 0.25);
                result.session_confirmed = true;
                result.quiz_start_at = session.quiz_start_at;
                result.pdf_at = session.pdf_at;
                result.seats_remaining = 0;
                console.log(`✅ Session ${session.id} CONFIRMED — Quiz starts in ${session.quiz_delay_minutes || 60} min at ${new Date(session.quiz_start_at * 1000).toLocaleTimeString('en-IN')}`);
            }
            save();

            // Broadcast SSE update to all session viewers
            const sessionsRouter = require('./sessions');
            if (sessionsRouter.broadcastSession) {
                sessionsRouter.broadcastSession(String(session_id), {
                    seats_booked: session.seats_booked,
                    status: session.status,
                    quiz_start_at: session.quiz_start_at || null,
                    pdf_at: session.pdf_at || null
                });
            }

            res.json(result);
        } catch (e) {
            console.error('[Cashfree] Verify error:', e.response?.data || e.message);
            return res.status(500).json({ error: 'Failed to verify payment' });
        }
    }
    return res.status(400).json({ error: 'Cashfree not configured' });
});

// Dummy pay removed for production launch
module.exports = router;
