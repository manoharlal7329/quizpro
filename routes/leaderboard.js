const express = require('express');
const router = express.Router();
const Session = require('../database/models/Session');
const QuizAttempt = require('../database/models/QuizAttempt');
const User = require('../database/models/User');

// ── GET /api/leaderboard ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        // Simple aggregation using JS for now, or Mongoose aggregation
        const attempts = await QuizAttempt.find({}).lean();
        const statsMap = {};

        for (const a of attempts) {
            const uid = String(a.user_id);
            if (!statsMap[uid]) {
                statsMap[uid] = {
                    user_id: a.user_id,
                    sessions_played: 0,
                    total_score: 0,
                    total_prize: 0,
                    best_rank: Infinity
                };
            }
            statsMap[uid].sessions_played++;
            statsMap[uid].total_score += (a.score || 0);
            if (a.rank) statsMap[uid].best_rank = Math.min(statsMap[uid].best_rank, a.rank);
            if (a.prize) statsMap[uid].total_prize += a.prize;
        }

        const statsArray = Object.values(statsMap);
        const enrichedLeaderboard = [];

        for (const s of statsArray) {
            const user = await User.findOne({ id: Number(s.user_id) }).lean();
            enrichedLeaderboard.push({
                ...s,
                name: user ? user.name : 'Unknown',
                best_rank: s.best_rank === Infinity ? null : s.best_rank
            });
        }

        const leaderboard = enrichedLeaderboard
            .sort((a, b) => b.total_prize - a.total_prize || b.sessions_played - a.sessions_played)
            .slice(0, 50);

        // Live/upcoming sessions
        const liveSessions = await Session.find({
            status: { $in: ['open', 'confirmed'] }
        }).lean().then(docs => docs.map(s => ({
            id: s.id, title: s.title, status: s.status,
            seats_booked: s.seats_booked, seat_limit: s.seat_limit,
            entry_fee: s.entry_fee, prize_pool: s.prize_pool,
            quiz_start_at: s.quiz_start_at
        })));

        res.json({ leaderboard, live_sessions: liveSessions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
