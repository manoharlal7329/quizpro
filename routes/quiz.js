const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Session = require('../database/models/Session');
const Question = require('../database/models/Question');
const Seat = require('../database/models/Seat');
const QuizAttempt = require('../database/models/QuizAttempt');
const User = require('../database/models/User');
const Badge = require('../database/models/Badge');

// ─── GET QUESTIONS FOR USER ───────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
    const sessId = req.params.id;
    try {
        const session = await Session.findOne({ id: Number(sessId) }).lean();
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const seat = await Seat.findOne({ session_id: Number(sessId), user_id: Number(req.user.id) }).lean();
        if (!seat) return res.status(403).json({ error: 'No seat booked. Please book your seat first.' });

        const now = Math.floor(Date.now() / 1000);
        if (!session.quiz_start_at || now < session.quiz_start_at) {
            return res.status(403).json({ error: 'Quiz not started yet', starts_in: session.quiz_start_at ? session.quiz_start_at - now : null });
        }

        const checkAttempt = await QuizAttempt.findOne({ session_id: Number(sessId), user_id: Number(req.user.id) }).lean();
        if (checkAttempt) return res.status(403).json({ error: 'Already submitted' });

        const questionsRaw = await Question.find({ session_id: Number(sessId) }).lean();
        const questions = questionsRaw.map(q => ({
            id: q.id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d
        }));

        const seed = parseInt(req.user.id);
        const randomized = questions.sort((a, b) => Math.sin(a.id + seed) - Math.sin(b.id + seed));

        res.json({
            session: {
                ...session,
                time_remaining: (session.quiz_start_at + 1800) - now
            },
            questions: randomized
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── BADGE HELPER ─────────────────────────────────────────────────────────────
async function awardBadge(userId, badgeId, name, icon, desc) {
    const already = await Badge.findOne({ user_id: Number(userId), badge_id: badgeId });
    if (already) return null;
    const badge = new Badge({
        user_id: Number(userId),
        badge_id: badgeId,
        name,
        icon,
        desc,
        earned_at: Math.floor(Date.now() / 1000)
    });
    await badge.save();
    return badge;
}

// ─── SUBMIT ANSWERS ───────────────────────────────────────────────────────────
router.post('/:id/submit', authMiddleware, async (req, res) => {
    const sessId = req.params.id;
    const { answers, timings } = req.body;

    try {
        const session = await Session.findOne({ id: Number(sessId) }).lean();
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const existing = await QuizAttempt.findOne({ session_id: Number(sessId), user_id: Number(req.user.id) }).lean();
        if (existing) return res.status(403).json({ error: 'Already submitted' });

        const questions = await Question.find({ session_id: Number(sessId) }).lean();
        let score = 0;
        questions.forEach(q => {
            if (answers[q.id] === q.correct) score++;
        });

        const total_ms = Object.values(timings || {}).reduce((sum, ms) => sum + ms, 0);

        const user = await User.findOne({ id: Number(req.user.id) });
        if (user) {
            user.quizzes_solved = (user.quizzes_solved || 0) + 1;
            await user.save();
        }

        const attempt = new QuizAttempt({
            id: Date.now(),
            session_id: Number(sessId),
            user_id: Number(req.user.id),
            answers: JSON.stringify(answers),
            timings: JSON.stringify(timings),
            score,
            total_ms,
            submitted_at: Math.floor(Date.now() / 1000)
        });
        await attempt.save();

        // Ranks
        const allAttempts = await QuizAttempt.find({ session_id: Number(sessId) })
            .sort({ score: -1, total_ms: 1 });

        let myRank = 0;
        for (let i = 0; i < allAttempts.length; i++) {
            if (Number(allAttempts[i].user_id) === Number(req.user.id)) {
                myRank = i + 1;
                break;
            }
        }

        // ── BADGE AWARDS ─────────────────────────────────────────────────────────
        const newBadges = [];
        if (myRank === 1) {
            const b = await awardBadge(req.user.id, 'first_win', 'First Win 🥇', '🥇', 'Won rank #1 in a session');
            if (b) newBadges.push(b);
        }
        if (myRank <= 3) {
            const b = await awardBadge(req.user.id, 'top3', 'Podium Finisher 🏆', '🏆', 'Finished in top 3');
            if (b) newBadges.push(b);
        }
        if (score === questions.length && questions.length > 0) {
            const b = await awardBadge(req.user.id, 'perfect_score', 'Perfect Score 🎯', '🎯', 'Answered all questions correctly');
            if (b) newBadges.push(b);
        }
        if (score === questions.length && total_ms < 60000) {
            const b = await awardBadge(req.user.id, 'speed_demon', 'Speed Demon ⚡', '⚡', 'Perfect score in under 60 seconds');
            if (b) newBadges.push(b);
        }
        const userAttemptsCount = await QuizAttempt.countDocuments({ user_id: Number(req.user.id) });
        if (userAttemptsCount >= 10) {
            const b = await awardBadge(req.user.id, 'veteran', 'Veteran 🎖️', '🎖️', 'Participated in 10+ sessions');
            if (b) newBadges.push(b);
        }

        res.json({ score, total: questions.length, rank: myRank, new_badges: newBadges });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

module.exports = router;
