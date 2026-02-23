const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');

// ── Helper: get or create wallet ─────────────────────────────────────────────
function getWallet(userId) {
    if (!data.wallets) data.wallets = [];
    let w = data.wallets.find(w => String(w.user_id) === String(userId));
    if (!w) {
        w = { user_id: userId, demo: 0, real: 0 };
        data.wallets.push(w);
    }
    return w;
}

// ── Helper: record transaction ────────────────────────────────────────────────
function addTxn(userId, wallet, type, amount, note) {
    if (!data.wallet_txns) data.wallet_txns = [];
    data.wallet_txns.push({
        id: Date.now() + Math.floor(Math.random() * 999),
        user_id: userId,
        wallet,       // 'demo' or 'real'
        type,         // 'credit' or 'debit'
        amount,
        note,
        at: Math.floor(Date.now() / 1000)
    });
}

// ── GET /api/wallet/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
    const w = getWallet(req.user.id);
    res.json({ demo: w.demo, real: w.real });
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
    const { session_id, wallet_type } = req.body; // wallet_type: 'demo' or 'real'
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

    if (wallet[type] < fee) {
        return res.status(400).json({
            error: `Insufficient ${type} balance. Have ₹${wallet[type]}, need ₹${fee}`
        });
    }

    // Deduct
    wallet[type] -= fee;
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
    const type = wallet_type === 'real' ? 'real' : 'demo';
    wallet[type] += Number(amount);
    addTxn(user_id, type, 'credit', Number(amount), note || `Admin topup by ${liveUser.name}`);

    save();
    res.json({ success: true, user: targetUser.mobile, wallet_type: type, new_balance: wallet[type] });
});

// ── GET /api/wallet/admin/list ────────────────────────────────────────────────
router.get('/admin/list', authMiddleware, (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const result = (data.users || []).map(u => {
        const w = getWallet(u.id);
        return { id: u.id, mobile: u.mobile, name: u.name, demo: w.demo, real: w.real };
    });

    res.json(result);
});

// ── POST /api/wallet/admin/credit-prize ──────────────────────────────────────
// Credit prize money to real wallet (called by results route)
router.post('/admin/credit-prize', authMiddleware, (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const prizes = req.body.prizes; // [{ user_id, amount, session_title, rank }]
    if (!Array.isArray(prizes)) return res.status(400).json({ error: 'prizes array required' });

    prizes.forEach(p => {
        const wallet = getWallet(p.user_id);
        wallet.real += p.amount;
        addTxn(p.user_id, 'real', 'credit', p.amount, `🏆 Prize #${p.rank} — ${p.session_title}`);
    });

    save();
    res.json({ success: true, credited: prizes.length });
});

module.exports = router;
module.exports.getWallet = getWallet;
module.exports.addTxn = addTxn;
