const express = require('express');
const router = express.Router();
const Question = require('../database/models/Question');

// In-memory cache of marathon questions
let marathonCache = { questions: [], loadedAt: 0 };
const CACHE_TTL = 3600 * 1000; // 1 hour refresh
const QUESTION_INTERVAL = 30; // 10s question + 5s answer + 15s explanation = 30s total
const PHASE_Q_END = 10;  // 0–9s  → question only
const PHASE_A_END = 15;  // 10–14s → answer reveal
// 15–29s → explanation

async function getMarathonQuestions() {
    const now = Date.now();
    if (marathonCache.questions.length > 0 && now - marathonCache.loadedAt < CACHE_TTL) {
        return marathonCache.questions;
    }
    // Load ALL book questions (book_id != null, has explanation)
    const qs = await Question.find({
        book_id: { $ne: null },
        question_text: { $exists: true }
    }).lean();

    // Shuffle deterministically by date seed (stays same within a day)
    const seed = Math.floor(now / 86400000); // changes each day
    const shuffled = qs.sort((a, b) => {
        const ha = Math.sin(a.id + seed) * 10000;
        const hb = Math.sin(b.id + seed) * 10000;
        return ha - hb;
    });

    marathonCache = { questions: shuffled, loadedAt: now };
    return shuffled;
}

// ─── GET CURRENT MARATHON STATE ───────────────────────────────────────────────
// All users get the exact same question at the same time (server-clock-based)
router.get('/state', async (req, res) => {
    try {
        const questions = await getMarathonQuestions();
        if (!questions.length) return res.json({ empty: true, total: 0 });

        const nowSec = Math.floor(Date.now() / 1000);
        const dayStart = nowSec - (nowSec % 86400); // start of today UTC
        const elapsed = nowSec - dayStart;
        const index = Math.floor(elapsed / QUESTION_INTERVAL) % questions.length;
        const secsIntoQ = elapsed % QUESTION_INTERVAL;

        const q = questions[index];
        const optLabels = { a: 'A', b: 'B', c: 'C', d: 'D' };

        // Phase: 0–9s = question, 10–14s = answer reveal, 15–29s = explanation
        let phase = 'question';
        if (secsIntoQ >= PHASE_A_END) phase = 'explanation';
        else if (secsIntoQ >= PHASE_Q_END) phase = 'answer';

        const secondsLeft = QUESTION_INTERVAL - secsIntoQ;

        res.json({
            index,
            total: questions.length,
            phase,
            secsIntoQ,
            secondsLeft,
            question: {
                id: q.id,
                text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct: phase !== 'question' ? q.correct : null,
                correct_label: phase !== 'question' ? (optLabels[q.correct] || '') : null,
                correct_text: phase !== 'question' ? q['option_' + q.correct] : null,
                explanation: phase === 'explanation' ? (q.explanation || '') : null,
            },
            next_in: secondsLeft
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET STATS ────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const questions = await getMarathonQuestions();
        res.json({ total: questions.length, interval: QUESTION_INTERVAL });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
