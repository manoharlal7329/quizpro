const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getWallet, addTxn } = require('./wallet_utils');
const Session = require('../database/models/Session');
const Category = require('../database/models/Category');
const QuizAttempt = require('../database/models/QuizAttempt');
const Question = require('../database/models/Question');
const User = require('../database/models/User');

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
    if (prizes.length > 0) prizes[0].amount += (prizePool - distributed);
    return prizes;
}

// ─── GET RESULTS List ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const sessId = req.params.id;
    try {
        const session = await Session.findOne({ id: Number(sessId) }).lean();
        if (!session) return res.status(404).json({ error: 'Not found' });

        const cat = await Category.findOne({ id: Number(session.category_id) }).lean();
        const rawAttempts = await QuizAttempt.find({ session_id: Number(sessId) }).sort({ rank: 1 }).lean();

        const results = [];
        for (const a of rawAttempts) {
            const user = await User.findOne({ id: Number(a.user_id) }).lean();
            results.push({
                ...a,
                mobile: user?.mobile,
                name: user?.name,
                answers: JSON.parse(a.answers || '{}'),
                timings: JSON.parse(a.timings || '{}')
            });
        }

        const questionsRaw = await Question.find({ session_id: Number(sessId) }).lean();
        const questions = questionsRaw.map(q => ({ id: q.id, correct: q.correct }));

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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PRIZE TABLE PREVIEW ──────────────────────────────────────────────────────
router.get('/:id/prize-table', async (req, res) => {
    try {
        const session = await Session.findOne({ id: Number(req.params.id) }).lean();
        if (!session) return res.status(404).json({ error: 'Not found' });

        const totalCollection = session.entry_fee * (session.seat_limit || 0);
        const prizePool = Math.floor(totalCollection * 0.75);
        const platformCut = Math.floor(totalCollection * 0.25);
        const prizes = calcPrizes(prizePool);

        res.json({ totalCollection, prizePool, platformCut, prizes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PUBLISH RESULTS + AUTO-CREDIT ──────────────────────────────────────────
router.post('/:id/publish', authMiddleware, async (req, res) => {
    try {
        const liveUser = await User.findOne({ id: Number(req.user.id) });
        if (!liveUser || !liveUser.is_admin) return res.status(403).json({ error: 'Admin only' });

        const sessId = req.params.id;
        const session = await Session.findOne({ id: Number(sessId) });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.prizes_paid) return res.status(400).json({ error: 'Prizes already paid' });

        const attempts = await QuizAttempt.find({ session_id: Number(sessId), rank: { $exists: true } }).sort({ rank: 1 });
        if (!attempts.length) return res.status(400).json({ error: 'No attempts found' });

        const prizePool = session.prize_pool || 0;
        const prizes = calcPrizes(prizePool);
        const credited = [];

        for (const attempt of attempts) {
            const prizeEntry = prizes.find(p => p.rank === attempt.rank);
            if (prizeEntry && prizeEntry.amount > 0) {
                const wallet = await getWallet(attempt.user_id);
                wallet.win_bal = (wallet.win_bal || 0) + prizeEntry.amount;
                await wallet.save();

                attempt.prize = prizeEntry.amount;
                await attempt.save();

                await addTxn(attempt.user_id, 'real', 'credit', prizeEntry.amount, `🏆 Prize #${attempt.rank} — ${session.title}`);
                credited.push({ user_id: attempt.user_id, rank: attempt.rank, amount: prizeEntry.amount });
            }
        }

        session.prizes_paid = true;
        session.status = 'completed';
        await session.save();

        // Fast2SMS (background-ish)
        const FAST2SMS_KEY = process.env.FAST2SMS_KEY;
        if (FAST2SMS_KEY && credited.length) {
            for (const c of credited) {
                const winner = await User.findOne({ id: Number(c.user_id) }).lean();
                if (winner?.mobile) {
                    const msg = `QuizPro: Congrats! Won Rs.${c.amount} Rank #${c.rank} in "${session.title}". Check Wallet!`;
                    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_KEY}&route=q&message=${encodeURIComponent(msg)}&language=english&flash=0&numbers=${winner.mobile}`;
                    const https = require('https');
                    https.get(url, () => { }).on('error', () => { });
                }
            }
        }

        res.json({ success: true, session_id: sessId, prizes_credited: credited.length, credited });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
module.exports.calcPrizes = calcPrizes;
module.exports.PRIZE_DIST = PRIZE_DIST;
