const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Session = require('../database/models/Session');
const Question = require('../database/models/Question');
const Seat = require('../database/models/Seat');
const QuizAttempt = require('../database/models/QuizAttempt');
const User = require('../database/models/User');
const Badge = require('../database/models/Badge');
const { sendMailHTML } = require('../utils/mailer');

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
            session: { ...session, time_remaining: (session.quiz_start_at + 1800) - now },
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
    const badge = new Badge({ user_id: Number(userId), badge_id: badgeId, name, icon, desc, earned_at: Math.floor(Date.now() / 1000) });
    await badge.save();
    return badge;
}

// ─── INVOICE EMAIL BUILDER ───────────────────────────────────────────────────
function buildInvoiceHTML({ invoiceNo, userName, userEmail, sessionTitle, category, entryFee, score, total, rank, totalPlayers, totalMs, submittedAt, answers, questions }) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const timeSec = Math.round(totalMs / 1000);
    const mins = Math.floor(timeSec / 60), secs = timeSec % 60;
    const timeStr = `${mins}m ${secs}s`;
    const dateStr = new Date(submittedAt * 1000).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });

    const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    const optLabels = { a: 'A', b: 'B', c: 'C', d: 'D' };
    const qRows = questions.map((q, i) => {
        const userAns = answers[q.id];
        const isCorrect = userAns === q.correct;
        const ansLabel = optLabels[userAns] || '—';
        const correctLabel = optLabels[q.correct] || '—';
        return `
        <tr style="border-bottom:1px solid #1e1a2e;">
          <td style="padding:10px 12px;color:#9ca3af;font-size:12px;white-space:nowrap;">Q${i + 1}</td>
          <td style="padding:10px 12px;color:#e5e7eb;font-size:12px;line-height:1.4;">${q.question_text}</td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:${isCorrect ? '#34d399' : '#f87171'};">${ansLabel}</td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:#34d399;">${correctLabel}</td>
          <td style="padding:10px 12px;text-align:center;">${isCorrect ? '✅' : (userAns ? '❌' : '⬜')}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body{margin:0;padding:0;background:#0a0814;font-family:'Segoe UI',Arial,sans-serif;}
  .wrap{max-width:700px;margin:0 auto;padding:32px 16px;}
</style></head>
<body>
<div class="wrap">

  <!-- Header -->
  <div style="text-align:center;padding:32px 24px;background:linear-gradient(135deg,#0f0c1e,#1a1535);border-radius:20px 20px 0 0;border:1px solid rgba(201,168,76,0.3);border-bottom:none;">
    <div style="font-size:2.2rem;margin-bottom:8px;">🏆</div>
    <div style="font-size:.65rem;letter-spacing:3px;color:#c9a84c;font-weight:800;margin-bottom:8px;">QUIZPRO ARENA</div>
    <div style="font-size:1.6rem;font-weight:900;color:#fff;margin-bottom:4px;">Quiz Invoice & Result</div>
    <div style="font-size:.8rem;color:rgba(255,255,255,.35);">Invoice No: #${invoiceNo}</div>
  </div>

  <!-- Score Banner -->
  <div style="background:linear-gradient(135deg,${pct >= 80 ? '#064e3b,#065f46' : pct >= 60 ? '#1e3a5f,#1e40af' : '#3b0764,#4c1d95'});padding:28px 24px;text-align:center;border-left:1px solid rgba(201,168,76,0.3);border-right:1px solid rgba(201,168,76,0.3);">
    <div style="font-size:3.5rem;margin-bottom:4px;">${pct >= 80 ? '🏆' : pct >= 60 ? '🎉' : pct >= 40 ? '📚' : '💪'}</div>
    <div style="font-size:2.8rem;font-weight:900;color:#fff;margin-bottom:4px;">${pct}%</div>
    <div style="font-size:.9rem;color:rgba(255,255,255,.6);">${score} / ${total} Questions Correct</div>
  </div>

  <!-- Stats Grid -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;background:#0f0c1e;border:1px solid rgba(201,168,76,0.3);border-top:none;border-bottom:none;">
    <div style="padding:20px;text-align:center;border-right:1px solid rgba(255,255,255,.07);">
      <div style="font-size:1.6rem;font-weight:900;color:#c9a84c;">${rankBadge}</div>
      <div style="font-size:.6rem;color:rgba(255,255,255,.35);letter-spacing:1px;margin-top:4px;">YOUR RANK</div>
    </div>
    <div style="padding:20px;text-align:center;border-right:1px solid rgba(255,255,255,.07);">
      <div style="font-size:1.3rem;font-weight:900;color:#60a5fa;">${timeStr}</div>
      <div style="font-size:.6rem;color:rgba(255,255,255,.35);letter-spacing:1px;margin-top:4px;">TOTAL TIME</div>
    </div>
    <div style="padding:20px;text-align:center;">
      <div style="font-size:1.3rem;font-weight:900;color:#a78bfa;">${totalPlayers}</div>
      <div style="font-size:.6rem;color:rgba(255,255,255,.35);letter-spacing:1px;margin-top:4px;">PARTICIPANTS</div>
    </div>
  </div>

  <!-- Invoice Details -->
  <div style="background:#0f0c1e;border:1px solid rgba(201,168,76,0.3);border-top:none;border-bottom:none;padding:24px;">
    <div style="font-size:.65rem;letter-spacing:2px;color:rgba(255,255,255,.35);font-weight:800;margin-bottom:16px;">INVOICE DETAILS</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Student Name</td><td style="padding:8px 0;color:#fff;font-size:.82rem;font-weight:700;text-align:right;">${userName}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Email</td><td style="padding:8px 0;color:#fff;font-size:.82rem;text-align:right;">${userEmail}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Quiz / Session</td><td style="padding:8px 0;color:#fff;font-size:.82rem;font-weight:700;text-align:right;">${sessionTitle}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Category</td><td style="padding:8px 0;color:#c9a84c;font-size:.82rem;text-align:right;">${category}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Date & Time</td><td style="padding:8px 0;color:#fff;font-size:.82rem;text-align:right;">${dateStr}</td></tr>
      <tr style="border-top:1px solid rgba(255,255,255,.07);">
        <td style="padding:12px 0;color:#34d399;font-size:.88rem;font-weight:800;">Entry Fee Paid</td>
        <td style="padding:12px 0;color:#34d399;font-size:1.1rem;font-weight:900;text-align:right;">₹${entryFee}</td>
      </tr>
    </table>
  </div>

  <!-- Answer Review Table -->
  <div style="background:#0f0c1e;border:1px solid rgba(201,168,76,0.3);border-top:none;border-bottom:none;padding:24px 24px 0;">
    <div style="font-size:.65rem;letter-spacing:2px;color:rgba(255,255,255,.35);font-weight:800;margin-bottom:16px;">📋 ANSWER REVIEW</div>
    <table style="width:100%;border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;">
      <thead>
        <tr style="background:rgba(255,255,255,.04);">
          <th style="padding:10px 12px;text-align:left;font-size:.65rem;color:rgba(255,255,255,.35);letter-spacing:1px;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:.65rem;color:rgba(255,255,255,.35);letter-spacing:1px;">QUESTION</th>
          <th style="padding:10px 12px;text-align:center;font-size:.65rem;color:rgba(255,255,255,.35);letter-spacing:1px;">YOUR ANS</th>
          <th style="padding:10px 12px;text-align:center;font-size:.65rem;color:rgba(255,255,255,.35);letter-spacing:1px;">CORRECT</th>
          <th style="padding:10px 12px;text-align:center;font-size:.65rem;color:rgba(255,255,255,.35);letter-spacing:1px;">RESULT</th>
        </tr>
      </thead>
      <tbody>${qRows}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#0a0814;border:1px solid rgba(201,168,76,0.3);border-top:1px solid rgba(201,168,76,0.15);border-radius:0 0 20px 20px;padding:24px;text-align:center;">
    <div style="font-size:.75rem;color:rgba(255,255,255,.25);line-height:1.8;">
      This is your official QuizPro Arena participation invoice.<br/>
      Keep it for your records. &nbsp;|&nbsp; quizpro.in
    </div>
  </div>

</div>
</body></html>`;
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
        questions.forEach(q => { if (answers[q.id] === q.correct) score++; });

        const total_ms = Object.values(timings || {}).reduce((sum, ms) => sum + ms, 0);

        const user = await User.findOne({ id: Number(req.user.id) });
        if (user) { user.quizzes_solved = (user.quizzes_solved || 0) + 1; await user.save(); }

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
        const allAttempts = await QuizAttempt.find({ session_id: Number(sessId) }).sort({ score: -1, total_ms: 1 });
        let myRank = 0;
        for (let i = 0; i < allAttempts.length; i++) {
            if (Number(allAttempts[i].user_id) === Number(req.user.id)) { myRank = i + 1; break; }
        }

        // ── BADGES ──────────────────────────────────────────────────────────────
        const newBadges = [];
        if (myRank === 1) { const b = await awardBadge(req.user.id, 'first_win', 'First Win 🥇', '🥇', 'Won rank #1 in a session'); if (b) newBadges.push(b); }
        if (myRank <= 3) { const b = await awardBadge(req.user.id, 'top3', 'Podium Finisher 🏆', '🏆', 'Finished in top 3'); if (b) newBadges.push(b); }
        if (score === questions.length && questions.length > 0) { const b = await awardBadge(req.user.id, 'perfect_score', 'Perfect Score 🎯', '🎯', 'Answered all correctly'); if (b) newBadges.push(b); }
        if (score === questions.length && total_ms < 60000) { const b = await awardBadge(req.user.id, 'speed_demon', 'Speed Demon ⚡', '⚡', 'Perfect score under 60s'); if (b) newBadges.push(b); }
        const uCount = await QuizAttempt.countDocuments({ user_id: Number(req.user.id) });
        if (uCount >= 10) { const b = await awardBadge(req.user.id, 'veteran', 'Veteran 🎖️', '🎖️', '10+ sessions'); if (b) newBadges.push(b); }

        // ── INVOICE EMAIL (fire & forget) ───────────────────────────────────────
        if (user && user.email && session.entry_fee > 0) {
            const invoiceNo = `QP-${Date.now()}`;
            const html = buildInvoiceHTML({
                invoiceNo,
                userName: user.name || user.username || 'Student',
                userEmail: user.email,
                sessionTitle: session.title || `Session #${sessId}`,
                category: session.category_name || session.subject || 'Quiz',
                entryFee: session.entry_fee || 0,
                score,
                total: questions.length,
                rank: myRank,
                totalPlayers: allAttempts.length,
                totalMs: total_ms,
                submittedAt: Math.floor(Date.now() / 1000),
                answers,
                questions
            });
            sendMailHTML(user.email, `🏆 Your Quiz Invoice — ${session.title || 'Quiz'} | Score: ${score}/${questions.length}`, html)
                .then(() => console.log(`📧 Invoice sent to ${user.email}`))
                .catch(e => console.warn('Invoice email failed:', e.message));
        }

        res.json({ score, total: questions.length, rank: myRank, new_badges: newBadges });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;