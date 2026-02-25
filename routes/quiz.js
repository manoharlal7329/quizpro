const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');

// ─── GET QUESTIONS FOR USER ───────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
    const sessId = req.params.id;
    const sessions = data.sessions || [];
    const seats = data.seats || [];
    const attempts = data.quiz_attempts || [];

    const session = sessions.find(s => s.id == sessId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const seat = seats.find(s => s.session_id == sessId && String(s.user_id) === String(req.user.id));
    if (!seat) return res.status(403).json({ error: 'No seat booked. Please book your seat first.' });

    const now = Math.floor(Date.now() / 1000);
    if (!session.quiz_start_at || now < session.quiz_start_at) {
        return res.status(403).json({ error: 'Quiz not started yet', starts_in: session.quiz_start_at ? session.quiz_start_at - now : null });
    }

    const checkAttempt = attempts.find(a => a.session_id == sessId && String(a.user_id) === String(req.user.id));
    if (checkAttempt) return res.status(403).json({ error: 'Already submitted' });

    const questions = data.questions
        .filter(q => q.session_id == sessId)
        .map(q => ({ id: q.id, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d }));

    // Deterministic randomization per user
    const seed = parseInt(req.user.id);
    const randomized = questions.sort((a, b) => Math.sin(a.id + seed) - Math.sin(b.id + seed));

    res.json({
        session: {
            ...session,
            time_remaining: (session.quiz_start_at + 1800) - now
        },
        questions: randomized
    });
});

// ─── BADGE HELPER ─────────────────────────────────────────────────────────────
function awardBadge(userId, badgeId, name, icon, desc) {
    if (!data.badges) data.badges = [];
    const already = data.badges.find(b => b.user_id == userId && b.badge_id === badgeId);
    if (already) return null;
    const badge = { user_id: userId, badge_id: badgeId, name, icon, desc, earned_at: Math.floor(Date.now() / 1000) };
    data.badges.push(badge);
    return badge;
}

// ─── SUBMIT ANSWERS ───────────────────────────────────────────────────────────
router.post('/:id/submit', authMiddleware, async (req, res) => {
    const sessId = req.params.id;
    const { answers, timings } = req.body;

    const session = (data.sessions || []).find(s => s.id == sessId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const existing = (data.quiz_attempts || []).find(a => a.session_id == sessId && a.user_id == req.user.id);
    if (existing) return res.status(403).json({ error: 'Already submitted' });

    const questions = (data.questions || []).filter(q => q.session_id == sessId);
    let score = 0;
    questions.forEach(q => {
        if (answers[q.id] === q.correct) score++;
    });

    const total_ms = Object.values(timings || {}).reduce((sum, ms) => sum + ms, 0);

    const user = (data.users || []).find(u => u.id == req.user.id);
    if (user) {
        user.quizzes_solved = (user.quizzes_solved || 0) + 1;
    }

    if (!data.quiz_attempts) data.quiz_attempts = [];
    data.quiz_attempts.push({
        id: Date.now(),
        session_id: parseInt(sessId),
        user_id: req.user.id,
        answers: JSON.stringify(answers),
        timings: JSON.stringify(timings),
        score,
        total_ms,
        submitted_at: Math.floor(Date.now() / 1000)
    });

    // Recalculate ranks: Score DESC, then total_ms ASC
    const attempts = data.quiz_attempts
        .filter(a => a.session_id == sessId)
        .sort((a, b) => b.score - a.score || a.total_ms - b.total_ms);
    attempts.forEach((a, i) => { a.rank = i + 1; });

    const myAttempt = attempts.find(a => a.user_id == req.user.id);
    const myRank = myAttempt?.rank || 999;

    // ── BADGE AWARDS ─────────────────────────────────────────────────────────
    const newBadges = [];
    // First Win
    if (myRank === 1) {
        const b = awardBadge(req.user.id, 'first_win', 'First Win 🥇', '🥇', 'Won rank #1 in a session');
        if (b) newBadges.push(b);
    }
    // Top 3
    if (myRank <= 3) {
        const b = awardBadge(req.user.id, 'top3', 'Podium Finisher 🏆', '🏆', 'Finished in top 3');
        if (b) newBadges.push(b);
    }
    // Perfect Score
    if (score === questions.length && questions.length > 0) {
        const b = awardBadge(req.user.id, 'perfect_score', 'Perfect Score 🎯', '🎯', 'Answered all questions correctly');
        if (b) newBadges.push(b);
    }
    // Speed Demon (full score in under 60 seconds)
    if (score === questions.length && total_ms < 60000) {
        const b = awardBadge(req.user.id, 'speed_demon', 'Speed Demon ⚡', '⚡', 'Perfect score in under 60 seconds');
        if (b) newBadges.push(b);
    }
    // Veteran (10+ sessions)
    const userAttempts = (data.quiz_attempts || []).filter(a => a.user_id == req.user.id);
    if (userAttempts.length >= 10) {
        const b = awardBadge(req.user.id, 'veteran', 'Veteran 🎖️', '🎖️', 'Participated in 10+ sessions');
        if (b) newBadges.push(b);
    }

    save();
    res.json({ score, total: questions.length, rank: myRank, new_badges: newBadges });
});

module.exports = router;
