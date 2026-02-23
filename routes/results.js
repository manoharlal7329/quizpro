const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const { getWallet, addTxn } = require('./wallet');

// Top 15 prize distribution — strictly decreasing (% of 75% prize pool)
const PRIZE_DIST = [
    { rank: 1, pct: 25.0 },
    { rank: 2, pct: 15.0 },
    { rank: 3, pct: 11.0 },
    { rank: 4, pct: 9.0 },
    { rank: 5, pct: 8.0 },
    { rank: 6, pct: 7.0 },
    { rank: 7, pct: 5.0 },
    { rank: 8, pct: 4.5 },
    { rank: 9, pct: 4.0 },
    { rank: 10, pct: 3.5 },
    { rank: 11, pct: 2.5 },
    { rank: 12, pct: 2.0 },
    { rank: 13, pct: 1.5 },
    { rank: 14, pct: 1.0 },
    { rank: 15, pct: 1.0 },
];

function calcPrizes(prizePool) {
    const prizes = PRIZE_DIST.map(d => ({
        rank: d.rank,
        pct: d.pct,
        amount: Math.floor(prizePool * d.pct / 100)
    }));
    const distributed = prizes.reduce((sum, p) => sum + p.amount, 0);
    prizes[0].amount += (prizePool - distributed);
    return prizes;
}

// ─── GET RESULTS ──────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const sessId = req.params.id;
    const session = (data.sessions || []).find(s => s.id == sessId);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const cat = (data.categories || []).find(c => c.id == session.category_id);
    const results = (data.quiz_attempts || [])
        .filter(a => a.session_id == sessId)
        .sort((a, b) => a.rank - b.rank)
        .map(a => {
            const user = (data.users || []).find(u => u.id == a.user_id);
            return {
                ...a,
                mobile: user?.mobile,
                name: user?.name,
                answers: JSON.parse(a.answers || '{}'),
                timings: JSON.parse(a.timings || '{}')
            };
        });

    const questions = (data.questions || [])
        .filter(q => q.session_id == sessId)
        .map(q => ({ id: q.id, correct: q.correct }));

    const totalCollection = session.entry_fee * session.seats_booked;
    const prizePool = session.prize_pool || Math.floor(totalCollection * 0.75);
    const platformCut = Math.floor(totalCollection * 0.25);
    const prizes = calcPrizes(prizePool);

    res.json({
        session: { ...session, category_name: cat?.name, total_collection: totalCollection, platform_cut: platformCut },
        prizes,
        results,
        questions
    });
});

// ─── PRIZE TABLE PREVIEW ──────────────────────────────────────────────────────
router.get('/:id/prize-table', async (req, res) => {
    const session = (data.sessions || []).find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const totalCollection = session.entry_fee * session.seat_limit;
    const prizePool = Math.floor(totalCollection * 0.75);
    const platformCut = Math.floor(totalCollection * 0.25);
    const prizes = calcPrizes(prizePool);

    res.json({ totalCollection, prizePool, platformCut, prizes });
});

// ─── PUBLISH RESULTS + AUTO-CREDIT PRIZES ────────────────────────────────────
// Admin calls this once after quiz ends to credit prize money to winner wallets
router.post('/:id/publish', authMiddleware, async (req, res) => {
    const liveUser = (data.users || []).find(u => u.id == req.user.id);
    if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

    const sessId = req.params.id;
    const session = (data.sessions || []).find(s => s.id == sessId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.prizes_paid) return res.status(400).json({ error: 'Prizes already paid for this session' });

    const attempts = (data.quiz_attempts || [])
        .filter(a => a.session_id == sessId && a.rank)
        .sort((a, b) => a.rank - b.rank);

    if (!attempts.length) return res.status(400).json({ error: 'No ranked attempts found. Run quiz first.' });

    const prizePool = session.prize_pool || 0;
    const prizes = calcPrizes(prizePool);
    const credited = [];

    attempts.forEach(attempt => {
        const prizeEntry = prizes.find(p => p.rank === attempt.rank);
        if (prizeEntry && prizeEntry.amount > 0) {
            const wallet = getWallet(attempt.user_id);
            wallet.real += prizeEntry.amount;
            attempt.prize = prizeEntry.amount;
            addTxn(attempt.user_id, 'real', 'credit', prizeEntry.amount, `🏆 Prize #${attempt.rank} — ${session.title}`);
            credited.push({ user_id: attempt.user_id, rank: attempt.rank, amount: prizeEntry.amount });
        }
    });

    session.prizes_paid = true;
    session.status = 'completed';
    save();

    // ── Send SMS to winners (fire-and-forget) ──────────────────────────────
    const FAST2SMS_KEY = process.env.FAST2SMS_KEY;
    if (FAST2SMS_KEY && credited.length) {
        credited.forEach(c => {
            const user = (data.users || []).find(u => String(u.id) === String(c.user_id));
            if (!user?.mobile) return;
            const msg = `QuizPro: Congratulations! You won Rs.${c.amount} for Rank #${c.rank} in "${session.title}". Check your wallet now!`;
            const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_KEY}&route=q&message=${encodeURIComponent(msg)}&language=english&flash=0&numbers=${user.mobile}`;
            const https = require('https');
            https.get(url, () => { }).on('error', () => { });
        });
    }

    res.json({ success: true, session_id: sessId, prizes_credited: credited.length, credited });
});


module.exports = router;
module.exports.calcPrizes = calcPrizes;
module.exports.PRIZE_DIST = PRIZE_DIST;
