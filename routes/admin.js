const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

// ── Admin guard middleware ────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  // Check if token has explicit admin role (from adminAuth.js)
  if (req.user && req.user.role === 'admin') return next();

  // Check if user ID in database has is_admin flag (old auth)
  const user = (data.users || []).find(u => u.id == req.user.id);
  if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, adminOnly, (req, res) => {
  const sessions = data.sessions || [];
  const users = data.users || [];
  const seats = data.seats || [];
  const wallets = data.wallets || [];

  const totalUsers = users.filter(u => !u.is_admin).length;
  const totalSessions = sessions.length;
  const totalRevenue = sessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.platform_cut || 0), 0);
  const totalPrize = sessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.prize_pool || 0), 0);

  const stats = {
    total_users: totalUsers,
    total_sessions: totalSessions,
    total_revenue: totalRevenue,
    total_prize: totalPrize
  };

  // Recent sessions (last 5)
  const recentSessions = sessions
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 5)
    .map(s => {
      const cat = (data.categories || []).find(c => c.id == s.category_id);
      return { ...s, category_name: cat?.name || 'Category' };
    });

  res.json({ stats, recentSessions });
});

// ─── SESSIONS — LIST ──────────────────────────────────────────────────────────
router.get('/sessions', authMiddleware, adminOnly, (req, res) => {
  const sessions = (data.sessions || [])
    .sort((a, b) => b.created_at - a.created_at)
    .map(s => {
      const cat = (data.categories || []).find(c => c.id == s.category_id);
      const qCount = (data.questions || []).filter(q => q.session_id == s.id).length;
      return { ...s, category_name: cat?.name, question_count: qCount };
    });
  res.json(sessions);
});

// ─── SESSIONS — CREATE ────────────────────────────────────────────────────────
router.post('/sessions', authMiddleware, adminOnly, (req, res) => {
  const { category_id, title, seat_limit, entry_fee, quiz_delay_minutes } = req.body;
  if (!category_id || !title || !seat_limit || entry_fee === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ✅ PLAN RULE: Only 1 active session per category
  const existing = (data.sessions || []).find(
    s => s.category_id == category_id && ['open', 'confirmed'].includes(s.status)
  );
  if (existing) {
    return res.status(400).json({
      error: `Is category mein already ek active session hai: "${existing.title}". Pehle use cancel ya complete karo.`
    });
  }

  if (!data.sessions) data.sessions = [];
  const session = {
    id: Date.now(),
    category_id: Number(category_id),
    title,
    seat_limit: Number(seat_limit),
    seats_booked: 0,
    entry_fee: Number(entry_fee),
    quiz_delay_minutes: Number(quiz_delay_minutes) || 60,
    status: 'open',
    created_at: Math.floor(Date.now() / 1000)
  };
  data.sessions.push(session);
  save();
  res.json({ success: true, session });
});

// ─── SESSIONS — QUESTIONS LIST ────────────────────────────────────────────────
router.get('/sessions/:id/questions', authMiddleware, adminOnly, (req, res) => {
  const questions = (data.questions || []).filter(q => q.session_id == req.params.id);
  res.json(questions);
});

// ─── SESSIONS — FORCE START ───────────────────────────────────────────────────
router.post('/sessions/:id/start', authMiddleware, adminOnly, (req, res) => {
  const session = (data.sessions || []).find(s => s.id == req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const now = Math.floor(Date.now() / 1000);
  session.quiz_start_at = now;
  session.quiz_end_at = now + 1800;
  session.pdf_at = now;
  session.status = 'live';
  session.prize_pool = Math.floor(session.entry_fee * session.seats_booked * 0.75);
  session.platform_cut = Math.floor(session.entry_fee * session.seats_booked * 0.25);
  save();

  // SSE broadcast
  try {
    const sessionsRouter = require('./sessions');
    if (sessionsRouter.broadcastSession) {
      sessionsRouter.broadcastSession(session.id, {
        status: 'live',
        quiz_start_at: session.quiz_start_at,
        pdf_at: session.pdf_at,
        seats_booked: session.seats_booked
      });
    }
  } catch (e) { }

  res.json({ success: true, message: 'Quiz is NOW LIVE!', quiz_start_at: session.quiz_start_at });
});

// ─── SESSIONS — CANCEL (with auto-refund) ────────────────────────────────────
router.post('/sessions/:id/cancel', authMiddleware, adminOnly, (req, res) => {
  const session = (data.sessions || []).find(s => s.id == req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.status = 'cancelled';

  // ✅ Auto refund all bookers to real wallet
  const seats = (data.seats || []).filter(s => s.session_id == session.id);
  let refundCount = 0;
  seats.forEach(seat => {
    const w = (data.wallets || []).find(w => w.user_id == seat.user_id);
    if (w) {
      w.real = (w.real || 0) + session.entry_fee;
      if (!data.transactions) data.transactions = [];
      if (!data.wallet_txns) data.wallet_txns = [];
      data.wallet_txns.push({
        id: Date.now() + Math.random(),
        user_id: seat.user_id,
        wallet: 'real',
        type: 'credit',
        amount: session.entry_fee,
        note: `♻️ Refund: Session cancelled — ${session.title}`,
        at: Math.floor(Date.now() / 1000)
      });
      refundCount++;
    }
  });
  save();
  res.json({ success: true, message: `Session cancelled. ${refundCount} refunds issued.` });
});

// ─── SESSIONS — COMPLETE ──────────────────────────────────────────────────────
router.post('/sessions/:id/complete', authMiddleware, adminOnly, (req, res) => {
  const session = (data.sessions || []).find(s => s.id == req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.status = 'completed';
  save();
  res.json({ success: true });
});

// ─── SESSIONS — RESET SEATS ───────────────────────────────────────────────────
router.post('/sessions/:id/reset-seats', authMiddleware, adminOnly, (req, res) => {
  const session = (data.sessions || []).find(s => s.id == req.params.id);
  if (session) {
    session.seats_booked = 0;
    session.status = 'open';
    data.seats = (data.seats || []).filter(s => s.session_id != req.params.id);
    save();
  }
  res.json({ success: true, message: 'Seats reset to zero' });
});

// ─── SESSIONS — DELETE ────────────────────────────────────────────────────────
router.delete('/sessions/:id', authMiddleware, adminOnly, (req, res) => {
  data.sessions = (data.sessions || []).filter(s => s.id != req.params.id);
  data.questions = (data.questions || []).filter(q => q.session_id != req.params.id);
  data.seats = (data.seats || []).filter(s => s.session_id != req.params.id);
  save();
  res.json({ success: true });
});

// ─── SESSIONS — COPY QUESTIONS ────────────────────────────────────────────────
router.post('/sessions/:id/copy-questions', authMiddleware, adminOnly, (req, res) => {
  const targetId = Number(req.params.id);
  const { source_id } = req.body;

  if (!source_id) return res.status(400).json({ error: 'source_id required' });

  const sourceQuestions = (data.questions || []).filter(q => Number(q.session_id) === Number(source_id));
  if (!sourceQuestions.length) return res.status(404).json({ error: 'Source session questions not found' });

  // Clear existing questions in target session first
  data.questions = (data.questions || []).filter(q => Number(q.session_id) !== targetId);

  // Copy questions with new IDs
  const copied = sourceQuestions.map(q => ({
    ...q,
    id: Date.now() + Math.random(),
    session_id: targetId
  }));

  data.questions.push(...copied);
  save();

  res.json({ success: true, count: copied.length });
});

// ─── QUESTIONS — EXCEL UPLOAD ─────────────────────────────────────────────────
router.post('/questions/upload', authMiddleware, adminOnly, upload.single('file'), (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    if (!rows.length) return res.status(400).json({ error: 'Excel is empty' });

    if (!data.questions) data.questions = [];
    const added = [];
    rows.forEach(row => {
      const q = {
        id: Date.now() + Math.random(),
        session_id: Number(session_id),
        question_text: row['question'] || row['Question'] || row['question_text'] || '',
        option_a: row['option_a'] || row['Option A'] || row['A'] || '',
        option_b: row['option_b'] || row['Option B'] || row['B'] || '',
        option_c: row['option_c'] || row['Option C'] || row['C'] || '',
        option_d: row['option_d'] || row['Option D'] || row['D'] || '',
        correct: (row['correct'] || row['Correct'] || row['answer'] || 'a').toString().toLowerCase().trim(),
        explanation: row['explanation'] || row['Explanation'] || ''
      };
      if (q.question_text) { data.questions.push(q); added.push(q); }
    });
    save();
    res.json({ success: true, added: added.length, questions: added });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

// ─── QUESTIONS — MANUAL ADD ───────────────────────────────────────────────────
router.post('/questions', authMiddleware, adminOnly, (req, res) => {
  const { session_id, questions } = req.body;
  if (!session_id || !Array.isArray(questions)) return res.status(400).json({ error: 'Invalid data' });

  if (!data.questions) data.questions = [];
  questions.forEach(q => {
    data.questions.push({
      id: Date.now() + Math.random(),
      session_id: Number(session_id),
      question_text: q.question_text,
      option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c, option_d: q.option_d,
      correct: q.correct, explanation: q.explanation || ''
    });
  });
  save();
  res.json({ success: true });
});

// ─── QUESTIONS — DELETE ───────────────────────────────────────────────────────
router.delete('/questions/:id', authMiddleware, adminOnly, (req, res) => {
  data.questions = (data.questions || []).filter(q => q.id != req.params.id);
  save();
  res.json({ success: true });
});

// ─── USERS — LIST ─────────────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = (data.users || []).map(u => {
    const w = (data.wallets || []).find(w => w.user_id == u.id) || { demo: 0, win_bal: 0, dep_bal: 0 };
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name || u.name,
      username: u.username || u.name,
      phone: u.phone || u.mobile,
      is_admin: u.is_admin,
      wallet_demo: w.demo,
      wallet_real: (w.dep_bal || 0) + (w.win_bal || 0),
      withdrawable: w.win_bal || 0,
      quizzes_solved: u.quizzes_solved || 0,
      created_at: u.created_at || Math.floor(Date.now() / 1000)
    };
  });
  res.json(users);
});

// ─── USERS — DELETE ───────────────────────────────────────────────────────────
router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const user = (data.users || []).find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_admin) return res.status(403).json({ error: 'Cannot delete admin' });
  data.users = data.users.filter(u => u.id != req.params.id);
  save();
  res.json({ success: true });
});

// ─── CATEGORIES — LIST ────────────────────────────────────────────────────────
router.get('/categories', authMiddleware, adminOnly, (req, res) => {
  res.json(data.categories || []);
});

// ─── CATEGORIES — CREATE ──────────────────────────────────────────────────────
router.post('/categories', authMiddleware, adminOnly, (req, res) => {
  const { name, icon, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  if (!data.categories) data.categories = [];
  const cat = {
    id: Date.now(),
    name,
    icon: icon || '📚',
    description: description || '',
    level: data.categories.length + 1,
    color: '#7c3aed'
  };
  data.categories.push(cat);
  save();
  res.json({ success: true, category: cat });
});

// ─── WALLET TOPUP ─────────────────────────────────────────────────────────────
router.post('/wallet/topup', authMiddleware, adminOnly, (req, res) => {
  const { user_id, wallet_type, amount, note } = req.body;
  if (!user_id || !wallet_type || !amount) return res.status(400).json({ error: 'Missing params' });

  const { getWallet, addTxn } = require('./wallet');
  const w = getWallet(user_id);
  const type = wallet_type === 'real' ? 'real' : 'demo';
  w[type] += Number(amount);
  addTxn(user_id, type, 'credit', Number(amount), note || 'Admin top-up');
  save();
  res.json({ success: true, new_balance: w[type] });
});

// ─── REWARDS — LOG MANUAL PAYOUT ─────────────────────────────────────────────
router.post('/rewards', authMiddleware, adminOnly, (req, res) => {
  const { mobile, type, detail } = req.body;
  if (!data.rewards) data.rewards = [];
  data.rewards.push({
    id: Date.now(),
    mobile, type, detail,
    at: Math.floor(Date.now() / 1000)
  });
  save();
  res.json({ success: true });
});

// ─── REWARDS — LIST ───────────────────────────────────────────────────────────
router.get('/rewards', authMiddleware, adminOnly, (req, res) => {
  res.json((data.rewards || []).sort((a, b) => b.at - a.at));
});

module.exports = router;