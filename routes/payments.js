const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// Razorpay init (real keys or demo mode)
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RZP_REAL = RZP_KEY_ID.startsWith('rzp_') && !RZP_KEY_ID.includes('PLACEHOLDER');

let Razorpay;
if (RZP_REAL) {
    try { Razorpay = require('razorpay'); } catch (e) { console.warn('[Razorpay] Package not installed — run: npm install razorpay'); }
}

// ─── CREATE RAZORPAY ORDER ───────────────────────────────────────────────────────────────────
router.post('/create-order', authMiddleware, async (req, res) => {
    const { session_id } = req.body;
    const session = (data.sessions || []).find(s => s.id == session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'open') return res.status(400).json({ error: 'Session is not open' });

    const existingSeat = (data.seats || []).find(s => s.session_id == session_id && String(s.user_id) === String(req.user.id));
    if (existingSeat) return res.status(400).json({ error: 'Already booked' });

    if (RZP_REAL && Razorpay) {
        try {
            const rzp = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
            const order = await rzp.orders.create({
                amount: session.entry_fee * 100, // paise
                currency: 'INR',
                receipt: `quiz_${session_id}_${Date.now()}`,
                notes: { session_id: String(session_id), user_id: String(req.user.id) }
            });
            if (!data.payments) data.payments = [];
            data.payments.push({ id: Date.now(), user_id: req.user.id, session_id, order_id: order.id, amount: session.entry_fee, status: 'pending' });
            save();
            return res.json({ order_id: order.id, amount: order.amount, currency: 'INR', key: RZP_KEY_ID });
        } catch (e) {
            console.error('[Razorpay] Order create error:', e.message);
        }
    }

    // Strict mode: Fail if Razorpay is not configured (preventing accidental demo bookings)
    return res.status(500).json({ error: 'Real Payment Gateway is not configured. Please use QR Code method.' });
});

// ─── VERIFY PAYMENT ─────────────────────────────────────────────────────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
    const { order_id, payment_id, razorpay_signature, session_id } = req.body;
    const session = (data.sessions || []).find(s => s.id == session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.seats_booked >= session.seat_limit) return res.status(400).json({ error: 'Session full' });

    // Razorpay signature verification (real mode)
    if (RZP_REAL && razorpay_signature) {
        const body = order_id + '|' + payment_id;
        const expectedSig = crypto.createHmac('sha256', RZP_KEY_SECRET).update(body).digest('hex');
        if (expectedSig !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }
    }

    // Duplicate payment check
    const dup = (data.seats || []).find(s => s.session_id == session_id && s.payment_id == payment_id);
    if (dup) return res.status(400).json({ error: 'Payment ID already used' });

    if (!data.seats) data.seats = [];
    data.seats.push({ id: Date.now(), session_id: parseInt(session_id), user_id: req.user.id, paid_at: Math.floor(Date.now() / 1000), payment_id: payment_id || 'demo' });

    const pay = (data.payments || []).find(p => p.order_id === order_id);
    if (pay) { pay.status = 'paid'; pay.payment_id = payment_id; }

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
});

// Dummy pay removed for production launch
module.exports = router;
