const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const Session = require('../database/models/Session');
const Seat = require('../database/models/Seat');
const Payment = require('../database/models/Payment');
const User = require('../database/models/User');
const Wallet = require('../database/models/Wallet');
const WalletTxn = require('../database/models/WalletTxn');


// Razorpay init (real keys or demo mode)
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RZP_REAL = RZP_KEY_ID.startsWith('rzp_') && !RZP_KEY_ID.includes('PLACEHOLDER');

let Razorpay;
if (RZP_REAL) {
    try { Razorpay = require('razorpay'); } catch (e) { console.warn('[Razorpay] Package not installed'); }
}

// ─── CREATE RAZORPAY ORDER ───────────────────────────────────────────────────────────────────
router.post('/create-order', authMiddleware, async (req, res) => {
    try {
        const { session_id } = req.body;
        const session = await Session.findOne({ id: Number(session_id) }).lean();
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status !== 'open') return res.status(400).json({ error: 'Session is not open' });

        const existingSeat = await Seat.findOne({ session_id: Number(session_id), user_id: Number(req.user.id) }).lean();
        if (existingSeat) return res.status(400).json({ error: 'Already booked' });

        if (RZP_REAL && Razorpay) {
            const rzp = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
            const order = await rzp.orders.create({
                amount: session.entry_fee * 100,
                currency: 'INR',
                receipt: `quiz_${session_id}_${Date.now()}`,
                notes: { session_id: String(session_id), user_id: String(req.user.id) }
            });

            const payment = new Payment({
                id: Date.now(),
                user_id: Number(req.user.id),
                session_id: Number(session_id),
                order_id: order.id,
                amount: session.entry_fee,
                status: 'pending'
            });
            await payment.save();

            return res.json({ order_id: order.id, amount: order.amount, currency: 'INR', key: RZP_KEY_ID });
        }

        return res.status(500).json({ error: 'Real Payment Gateway is not configured.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── VERIFY PAYMENT ─────────────────────────────────────────────────────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const { order_id, payment_id, razorpay_signature, session_id } = req.body;
        const session = await Session.findOne({ id: Number(session_id) });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.seats_booked >= session.seat_limit) return res.status(400).json({ error: 'Session full' });

        if (RZP_REAL && razorpay_signature) {
            const body = order_id + '|' + payment_id;
            const expectedSig = crypto.createHmac('sha256', RZP_KEY_SECRET).update(body).digest('hex');
            if (expectedSig !== razorpay_signature) {
                return res.status(400).json({ error: 'Invalid payment signature' });
            }
        }

        const { finalizeBooking } = require('./booking_utils');
        const booking = await finalizeBooking(req.user.id, session_id, payment_id);

        if (booking.error) return res.status(400).json({ error: booking.error });

        const pay = await Payment.findOne({ order_id: order_id });
        if (pay) {
            pay.status = 'paid';
            pay.payment_id = payment_id;
            await pay.save();
        }

        res.json({
            booked: true,
            session_confirmed: booking.confirmed,
            seats_remaining: booking.seats_remaining
        });


        // Result is sent above within the res.json block
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

