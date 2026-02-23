const express = require('express');
const router = express.Router();
const { data } = require('../database/db');

// ── GET /api/leaderboard ─────────────────────────────────────────────────────
// Public — no auth needed. Returns top winners + live sessions.
router.get('/', (req, res) => {
    // Aggregate winners from all completed sessions
    const completedSessions = (data.sessions || []).filter(s => s.status === 'completed' || s.status === 'confirmed');
    const attempts = data.quiz_attempts || [];
    const users = data.users || [];

    // Aggregate each user's stats
    const statsMap = {};
    attempts.forEach(a => {
        const uid = String(a.user_id);
        if (!statsMap[uid]) statsMap[uid] = { user_id: a.user_id, sessions_played: 0, total_score: 0, total_prize: 0, best_rank: Infinity };
        statsMap[uid].sessions_played++;
        statsMap[uid].total_score += (a.score || 0);
        if (a.rank) statsMap[uid].best_rank = Math.min(statsMap[uid].best_rank, a.rank);
        if (a.prize) statsMap[uid].total_prize += a.prize;
    });

    // Enrich with user info
    const leaderboard = Object.values(statsMap)
        .map(s => {
            const user = users.find(u => String(u.id) === String(s.user_id));
            return {
                ...s,
                name: user ? user.name : 'Unknown',
                best_rank: s.best_rank === Infinity ? null : s.best_rank
            };
        })
        .sort((a, b) => b.total_prize - a.total_prize || b.sessions_played - a.sessions_played)
        .slice(0, 50);

    // Live/upcoming sessions
    const liveSessions = (data.sessions || [])
        .filter(s => s.status === 'open' || s.status === 'confirmed')
        .map(s => ({
            id: s.id, title: s.title, status: s.status,
            seats_booked: s.seats_booked, seat_limit: s.seat_limit,
            entry_fee: s.entry_fee, prize_pool: s.prize_pool,
            quiz_start_at: s.quiz_start_at
        }));

    res.json({ leaderboard, live_sessions: liveSessions });
});

module.exports = router;
