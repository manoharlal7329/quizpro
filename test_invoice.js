require('dotenv').config();
const { sendMailHTML } = require('./utils/mailer');

const sampleQuestions = [
    { id: 1, question_text: 'भारत की राजधानी कौन सी है?', option_a: 'मुंबई', option_b: 'दिल्ली', option_c: 'कोलकाता', option_d: 'चेन्नई', correct: 'b' },
    { id: 2, question_text: 'भारत की सबसे लंबी नदी कौन सी है?', option_a: 'यमुना', option_b: 'ब्रहमपुत्र', option_c: 'गंगा', option_d: 'कावेरी', correct: 'c' },
    { id: 3, question_text: '2 + 2 = ?', option_a: '3', option_b: '5', option_c: '4', option_d: '6', correct: 'c' },
    { id: 4, question_text: 'भारत का राष्ट्रीय पक्षी कौन सा है?', option_a: 'तोता', option_b: 'मोर', option_c: 'कौआ', option_d: 'बाज', correct: 'b' },
    { id: 5, question_text: 'सूर्य किस दिशा में उगता है?', option_a: 'पश्चिम', option_b: 'उत्तर', option_c: 'दक्षिण', option_d: 'पूर्व', correct: 'd' },
];

const sampleAnswers = { 1: 'b', 2: 'a', 3: 'c', 4: 'b', 5: 'd' };
// User got Q1✅ Q2❌ Q3✅ Q4✅ Q5✅ = 4/5 = 80%

function buildInvoiceHTML() {
    const score = 4, total = 5, pct = 80, rank = 2, totalPlayers = 50;
    const totalMs = 245000;
    const mins = Math.floor(totalMs / 60000), secs = Math.floor((totalMs % 60000) / 1000);
    const timeStr = `${mins}m ${secs}s`;
    const invoiceNo = `QP-${Date.now()}`;
    const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
    const rankBadge = '🥈';
    const optLabels = { a: 'A', b: 'B', c: 'C', d: 'D' };

    const qRows = sampleQuestions.map((q, i) => {
        const userAns = sampleAnswers[q.id];
        const isCorrect = userAns === q.correct;
        const ansLabel = optLabels[userAns] || '—';
        const correctLabel = optLabels[q.correct] || '—';
        return `
        <tr style="border-bottom:1px solid #1e1a2e;">
          <td style="padding:10px 12px;color:#9ca3af;font-size:12px;white-space:nowrap;">Q${i + 1}</td>
          <td style="padding:10px 12px;color:#e5e7eb;font-size:12px;line-height:1.4;">${q.question_text}</td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:${isCorrect ? '#34d399' : '#f87171'};">${ansLabel}</td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:#34d399;">${correctLabel}</td>
          <td style="padding:10px 12px;text-align:center;">${isCorrect ? '✅' : '❌'}</td>
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
    <div style="font-size:1.6rem;font-weight:900;color:#fff;margin-bottom:4px;">Quiz Invoice &amp; Result</div>
    <div style="font-size:.8rem;color:rgba(255,255,255,.35);">Invoice No: #${invoiceNo}</div>
  </div>

  <!-- Score Banner (Green = 80%+) -->
  <div style="background:linear-gradient(135deg,#064e3b,#065f46);padding:28px 24px;text-align:center;border-left:1px solid rgba(201,168,76,0.3);border-right:1px solid rgba(201,168,76,0.3);">
    <div style="font-size:3.5rem;margin-bottom:4px;">🏆</div>
    <div style="font-size:2.8rem;font-weight:900;color:#fff;margin-bottom:4px;">${pct}%</div>
    <div style="font-size:.9rem;color:rgba(255,255,255,.6);">${score} / ${total} Questions Correct</div>
  </div>

  <!-- Stats Grid -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);background:#0f0c1e;border:1px solid rgba(201,168,76,0.3);border-top:none;border-bottom:none;">
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
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Student Name</td><td style="padding:8px 0;color:#fff;font-size:.82rem;font-weight:700;text-align:right;">Manohar Lal</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Email</td><td style="padding:8px 0;color:#fff;font-size:.82rem;text-align:right;">manoharlala02911@gmail.com</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Quiz / Session</td><td style="padding:8px 0;color:#fff;font-size:.82rem;font-weight:700;text-align:right;">Samanya Gyan — Level 2 Championship</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Category</td><td style="padding:8px 0;color:#c9a84c;font-size:.82rem;text-align:right;">General Knowledge 🎯</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,.45);font-size:.82rem;">Date &amp; Time</td><td style="padding:8px 0;color:#fff;font-size:.82rem;text-align:right;">${dateStr}</td></tr>
      <tr style="border-top:1px solid rgba(255,255,255,.07);">
        <td style="padding:12px 0;color:#34d399;font-size:.88rem;font-weight:800;">Entry Fee Paid</td>
        <td style="padding:12px 0;color:#34d399;font-size:1.1rem;font-weight:900;text-align:right;">₹150</td>
      </tr>
    </table>
  </div>

  <!-- Answer Review -->
  <div style="background:#0f0c1e;border:1px solid rgba(201,168,76,0.3);border-top:none;border-bottom:none;padding:24px 24px 0;">
    <div style="font-size:.65rem;letter-spacing:2px;color:rgba(255,255,255,.35);font-weight:800;margin-bottom:16px;">📋 ANSWER REVIEW</div>
    <table style="width:100%;border-collapse:collapse;">
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
  <div style="background:#070512;border:1px solid rgba(201,168,76,0.3);border-top:1px solid rgba(201,168,76,0.15);border-radius:0 0 20px 20px;padding:24px;text-align:center;">
    <div style="font-size:.75rem;color:rgba(255,255,255,.25);line-height:1.8;">
      This is your official QuizPro Arena participation invoice.<br/>
      Keep it for your records. &nbsp;|&nbsp; quizpro.in
    </div>
  </div>

</div>
</body></html>`;
}

async function main() {
    console.log('📧 Sending sample invoice to manoharlala02911@gmail.com ...');
    try {
        await sendMailHTML(
            'manoharlala02911@gmail.com',
            '🏆 Sample Quiz Invoice — Samanya Gyan Championship | Score: 4/5 (80%)',
            buildInvoiceHTML()
        );
        console.log('✅ Invoice email sent successfully!');
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }
    process.exit(0);
}

main();
