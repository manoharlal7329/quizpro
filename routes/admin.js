const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const User = require('../database/models/User');
const Session = require('../database/models/Session');
const Category = require('../database/models/Category');
const Question = require('../database/models/Question');
const Seat = require('../database/models/Seat');
const Reward = require('../database/models/Reward');
const { getWallet, addTxn } = require('./wallet_utils');

const upload = multer({ storage: multer.memoryStorage() });

// ── Admin guard middleware ────────────────────────────────────────────────────
async function adminOnly(req, res, next) {
  try {
    if (req.user && req.user.role === 'admin') return next();
    const user = await User.findOne({ id: Number(req.user.id) });
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch (e) {
    res.status(500).json({ error: 'Admin check failed' });
  }
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ is_admin: { $ne: true } });
    const totalSessionsCount = await Session.countDocuments({});

    const completedSessions = await Session.find({ status: 'completed' }).lean();
    const totalRevenue = completedSessions.reduce((sum, s) => sum + (s.platform_cut || 0), 0);
    const totalPrize = completedSessions.reduce((sum, s) => sum + (s.prize_pool || 0), 0);

    const stats = {
      total_users: totalUsers,
      total_sessions: totalSessionsCount,
      total_revenue: totalRevenue,
      total_prize: totalPrize
    };

    const recentSessionsRaw = await Session.find({})
      .sort({ created_at: -1 })
      .limit(5)
      .lean();

    const recentSessions = [];
    for (const s of recentSessionsRaw) {
      const cat = await Category.findOne({ id: Number(s.category_id) }).lean();
      recentSessions.push({ ...s, category_name: cat?.name || 'Category' });
    }

    res.json({ stats, recentSessions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — LIST ──────────────────────────────────────────────────────────
router.get('/sessions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sessionsRaw = await Session.find({}).sort({ created_at: -1 }).lean();
    const sessions = [];
    for (const s of sessionsRaw) {
      const cat = await Category.findOne({ id: Number(s.category_id) }).lean();
      const qCount = await Question.countDocuments({ session_id: Number(s.id) });
      sessions.push({ ...s, category_name: cat?.name, question_count: qCount });
    }
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — CREATE ────────────────────────────────────────────────────────
router.post('/sessions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { category_id, title, seat_limit, entry_fee, quiz_delay_minutes } = req.body;
    if (!category_id || !title || !seat_limit || entry_fee === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await Session.findOne({
      category_id: Number(category_id),
      status: { $in: ['open', 'confirmed'] }
    }).lean();

    if (existing) {
      return res.status(400).json({
        error: `Is category mein already ek active session hai: "${existing.title}". Pehle use cancel ya complete karo.`
      });
    }

    const session = new Session({
      id: Date.now(),
      category_id: Number(category_id),
      title,
      seat_limit: Number(seat_limit),
      seats_booked: 0,
      entry_fee: Number(entry_fee),
      quiz_delay_minutes: Number(quiz_delay_minutes) || 60,
      status: 'open',
      created_at: Math.floor(Date.now() / 1000)
    });
    await session.save();
    res.json({ success: true, session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — QUESTIONS LIST ────────────────────────────────────────────────
router.get('/sessions/:id/questions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const questions = await Question.find({ session_id: Number(req.params.id) }).lean();
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — FORCE START ───────────────────────────────────────────────────
router.post('/sessions/:id/start', authMiddleware, adminOnly, async (req, res) => {
  try {
    const session = await Session.findOne({ id: Number(req.params.id) });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const now = Math.floor(Date.now() / 1000);
    session.quiz_start_at = now;
    session.quiz_end_at = now + 1800;
    session.pdf_at = now;
    session.status = 'live';
    session.prize_pool = Math.floor(session.entry_fee * session.seats_booked * 0.75);
    session.platform_cut = Math.floor(session.entry_fee * session.seats_booked * 0.25);
    await session.save();

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — CANCEL (with auto-refund) ────────────────────────────────────
router.post('/sessions/:id/cancel', authMiddleware, adminOnly, async (req, res) => {
  try {
    const session = await Session.findOne({ id: Number(req.params.id) });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'cancelled';
    await session.save();

    const seats = await Seat.find({ session_id: Number(session.id) }).lean();
    let refundCount = 0;

    for (const seat of seats) {
      const wallet = await getWallet(seat.user_id);
      if (wallet) {
        wallet.dep_bal = (wallet.dep_bal || 0) + session.entry_fee;
        await wallet.save();
        await addTxn(seat.user_id, 'real', 'credit', session.entry_fee, `♻️ Refund: Session cancelled — ${session.title}`);
        refundCount++;
      }
    }

    res.json({ success: true, message: `Session cancelled. ${refundCount} refunds issued.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — COMPLETE ──────────────────────────────────────────────────────
router.post('/sessions/:id/complete', authMiddleware, adminOnly, async (req, res) => {
  try {
    const session = await Session.findOne({ id: Number(req.params.id) });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.status = 'completed';
    await session.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — RESET SEATS ───────────────────────────────────────────────────
router.post('/sessions/:id/reset-seats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const session = await Session.findOne({ id: Number(req.params.id) });
    if (session) {
      session.seats_booked = 0;
      session.status = 'open';
      await session.save();
      await Seat.deleteMany({ session_id: Number(req.params.id) });
    }
    res.json({ success: true, message: 'Seats reset to zero' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — DELETE ────────────────────────────────────────────────────────
router.delete('/sessions/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sid = Number(req.params.id);
    await Session.deleteOne({ id: sid });
    await Question.deleteMany({ session_id: sid });
    await Seat.deleteMany({ session_id: sid });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SESSIONS — COPY QUESTIONS ────────────────────────────────────────────────
router.post('/sessions/:id/copy-questions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { source_id } = req.body;

    if (!source_id) return res.status(400).json({ error: 'source_id required' });

    const sourceQuestions = await Question.find({ session_id: Number(source_id) }).lean();
    if (!sourceQuestions.length) return res.status(404).json({ error: 'Source session questions not found' });

    await Question.deleteMany({ session_id: targetId });

    const copied = sourceQuestions.map(q => {
      const { _id, ...cleanQ } = q;
      return {
        ...cleanQ,
        id: Date.now() + Math.random(),
        session_id: targetId
      };
    });

    await Question.insertMany(copied);
    res.json({ success: true, count: copied.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── QUESTIONS — EXCEL UPLOAD ─────────────────────────────────────────────────
router.post('/questions/upload', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    if (!rows.length) return res.status(400).json({ error: 'Excel is empty' });

    const added = [];
    for (const row of rows) {
      const q = new Question({
        id: Date.now() + Math.random(),
        session_id: Number(session_id),
        question_text: row['question'] || row['Question'] || row['question_text'] || '',
        option_a: row['option_a'] || row['Option A'] || row['A'] || '',
        option_b: row['option_b'] || row['Option B'] || row['B'] || '',
        option_c: row['option_c'] || row['Option C'] || row['C'] || '',
        option_d: row['option_d'] || row['Option D'] || row['D'] || '',
        correct: (row['correct'] || row['Correct'] || row['answer'] || 'a').toString().toLowerCase().trim(),
        explanation: row['explanation'] || row['Explanation'] || ''
      });
      if (q.question_text) {
        await q.save();
        added.push(q);
      }
    }
    res.json({ success: true, added: added.length, questions: added });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

// ─── QUESTIONS — MANUAL ADD ───────────────────────────────────────────────────
router.post('/questions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { session_id, questions } = req.body;
    if (!session_id || !Array.isArray(questions)) return res.status(400).json({ error: 'Invalid data' });

    for (const q of questions) {
      const newQ = new Question({
        id: Date.now() + Math.random(),
        session_id: Number(session_id),
        question_text: q.question_text,
        option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d,
        correct: q.correct, explanation: q.explanation || ''
      });
      await newQ.save();
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── QUESTIONS — DELETE ───────────────────────────────────────────────────────
router.delete('/questions/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Question.deleteOne({ id: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── USERS — LIST ─────────────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).lean();
    const result = [];
    for (const u of users) {
      const w = await getWallet(u.id);
      result.push({
        id: u.id,
        email: u.email,
        full_name: u.full_name || u.name,
        username: u.username || u.name,
        phone: u.phone || u.mobile,
        is_admin: u.is_admin,
        referral_code: u.referral_code || 'N/A',
        referred_by: u.referred_by || 'Organic',
        wallet_demo: w?.demo || 0,
        wallet_real: (w?.dep_bal || 0) + (w?.win_bal || 0),
        withdrawable: w?.win_bal || 0,
        quizzes_solved: u.quizzes_solved || 0,
        created_at: u.created_at || Math.floor(Date.now() / 1000)
      });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── USERS — DELETE ───────────────────────────────────────────────────────────
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.params.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_admin) return res.status(403).json({ error: 'Cannot delete admin' });
    await User.deleteOne({ id: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CATEGORIES — LIST ────────────────────────────────────────────────────────
router.get('/categories', authMiddleware, adminOnly, async (req, res) => {
  try {
    const categories = await Category.find({}).lean();
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CATEGORIES — CREATE ──────────────────────────────────────────────────────
router.post('/categories', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, icon, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const totalCats = await Category.countDocuments({});
    const cat = new Category({
      id: Date.now(),
      name,
      icon: icon || '📚',
      description: description || '',
      level: totalCats + 1,
      color: '#7c3aed'
    });
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WALLET TOPUP ─────────────────────────────────────────────────────────────
router.post('/wallet/topup', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { user_id, wallet_type, amount, note } = req.body;
    if (!user_id || !wallet_type || !amount) return res.status(400).json({ error: 'Missing params' });

    const w = await getWallet(user_id);
    const typeKey = wallet_type === 'real' ? 'dep_bal' : 'demo';
    w[typeKey] = (w[typeKey] || 0) + Number(amount);
    await w.save();

    await addTxn(user_id, wallet_type === 'real' ? 'real' : 'demo', 'credit', Number(amount), note || 'Admin top-up');
    res.json({ success: true, new_balance: w[typeKey] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REWARDS — LOG MANUAL PAYOUT ─────────────────────────────────────────────
router.post('/rewards', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { mobile, type, detail } = req.body;
    const reward = new Reward({
      mobile, type, detail,
      assigned_at: Math.floor(Date.now() / 1000)
    });
    await reward.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REWARDS — LIST ───────────────────────────────────────────────────────────
router.get('/rewards', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rewards = await Reward.find({}).sort({ assigned_at: -1 }).lean();
    res.json(rewards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
