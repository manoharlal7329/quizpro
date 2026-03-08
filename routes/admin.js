const express = require('express');
const router = express.Router();
const path = require('path');
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
const os = require('os');
const mongoose = require('mongoose');
const FraudLog = require('../database/models/FraudLog');
const WalletTxn = require('../database/models/WalletTxn');
const Wallet = require('../database/models/Wallet');
const AIAlert = require('../database/models/AIAlert');
const Withdrawal = require('../database/models/Withdrawal');
const Notification = require('../database/models/Notification');
const Banner = require('../database/models/Banner');
const PlatformConfig = require('../database/models/PlatformConfig');

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

// (Duplicate system-status route removed and merged below)

// ─── WITHDRAWALS — LIST ───────────────────────────────────────────────────────
router.get('/withdrawals', authMiddleware, adminOnly, async (req, res) => {
  try {
    const listRaw = await Withdrawal.find({}).sort({ created_at: -1 }).limit(100).lean();

    // Enrich with user info
    const enriched = [];
    for (const wd of listRaw) {
      const u = await User.findOne({ id: Number(wd.user_id) }).select('full_name phone username name').lean();
      enriched.push({
        ...wd,
        user_name: u?.full_name || u?.name || u?.username || 'N/A',
        user_phone: u?.phone || 'N/A'
      });
    }

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WITHDRAWALS — APPROVE ────────────────────────────────────────────────────
router.post('/withdrawals/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const wdId = String(req.params.id).trim();
    console.log(`[Admin] Attempting to approve WD: "${wdId}"`);
    const wd = await Withdrawal.findOne({ id: wdId });
    if (!wd) {
      console.error(`[Admin] WD Not Found: "${wdId}"`);
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    if (wd.status !== 'pending') {
      console.error(`[Admin] WD Status Mismatch: ID ${wdId} is "${wd.status}", expected "pending"`);
      return res.status(400).json({ error: 'Already processed or invalid status', status: wd.status });
    }

    wd.status = 'approved';
    await wd.save();

    // Trigger Razorpay Payout
    const { processPayout } = require('../utils/razorpayPayout');
    try {
      console.log(`[Admin] Initializing Payout Transfer for WD: ${wdId} | Mode: ${wd.payment_mode}`);
      await processPayout(wd.id);
      res.json({ success: true, message: 'Withdrawal approved and payout initiated.' });
    } catch (err) {
      console.error(`[Admin] Payout trigger failed for ${wdId}:`, err.message);
      res.status(500).json({ error: 'Approval semi-success', message: 'Marked as approved but Payout API failed. Check logs.', details: err.message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WITHDRAWALS — REJECT ─────────────────────────────────────────────────────
router.post('/withdrawals/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const wdId = String(req.params.id).trim();
    console.log(`[Admin] Attempting to reject WD: "${wdId}"`);
    const wd = await Withdrawal.findOne({ id: wdId });
    if (!wd || wd.status !== 'pending') {
      console.error(`[Admin] Reject failed: Row not found or status not pending for ID ${wdId}`);
      return res.status(400).json({ error: 'Invalid or processed' });
    }

    wd.status = 'rejected';
    await wd.save();

    // Return funds to winnings
    const wallet = await getWallet(wd.user_id);
    if (wallet) {
      wallet.win_bal = (wallet.win_bal || 0) + wd.amount;
      await wallet.save();
      await addTxn(wd.user_id, 'real', 'credit', wd.amount, `🔄 REJECTED: Withdrawal #${wd.id} returned to winnings.`);
    }

    res.json({ success: true, message: 'Withdrawal rejected and funds restored.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WITHDRAWALS — RESET/RETRY ───────────────────────────────────────────────
router.post('/withdrawals/:id/reset', authMiddleware, adminOnly, async (req, res) => {
  try {
    const wdId = String(req.params.id).trim();
    const wd = await Withdrawal.findOne({ id: wdId });
    if (!wd) return res.status(404).json({ error: 'Withdrawal not found' });

    // If it was already failed/rejected, we lock funds again to try retry
    if (wd.status === 'failed' || wd.status === 'rejected') {
      const { getWallet } = require('./wallet_utils');
      const wallet = await getWallet(wd.user_id);
      if (wallet.win_bal < wd.amount) {
        return res.status(400).json({ error: 'User has insufficient winnings balance to re-lock for retry' });
      }
      wallet.win_bal -= wd.amount;
      await wallet.save();
    }

    wd.status = 'pending';
    wd.error = null;
    await wd.save();

    res.json({ message: 'Withdrawal reset to pending. You can approve it again now.' });
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
    let typeKey = 'dep_bal';
    if (wallet_type === 'demo') typeKey = 'demo';
    if (wallet_type === 'winnings') typeKey = 'win_bal';
    if (wallet_type === 'deposit' || wallet_type === 'real') typeKey = 'dep_bal';

    w[typeKey] = (w[typeKey] || 0) + Number(amount);
    await w.save();

    await addTxn(user_id, wallet_type === 'demo' ? 'demo' : 'real', 'credit', Number(amount), note || `Admin top-up (${wallet_type})`);
    res.json({ success: true, new_balance: w[typeKey], type: wallet_type });
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

// ─── SEED DEMO SESSIONS (secret key protected) ───────────────────────────────
router.post('/seed-sessions', async (req, res) => {
  const key = req.headers['x-seed-key'] || req.query.key;
  if (key !== 'quizpro2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    const SESSIONS = [
      // ROOKIE (cat 1)
      { title: 'Hindi Vyakaran Rookie Battle', cat: 1, fee: 100, seats: 20, day: 1 },
      { title: 'English Grammar Beginner Cup', cat: 1, fee: 100, seats: 30, day: 2 },
      { title: 'Samanya Gyan Daily Arena', cat: 1, fee: 100, seats: 50, day: 3 },
      { title: 'Math Basics Blitz', cat: 1, fee: 100, seats: 40, day: 4 },
      { title: 'Computer Gyan Quiz', cat: 1, fee: 100, seats: 60, day: 5 },
      { title: 'Science Rookie Rumble', cat: 1, fee: 100, seats: 50, day: 6 },
      { title: 'Current Affairs 7-Day Blast', cat: 1, fee: 100, seats: 100, day: 7 },
      { title: 'Geography Starter League', cat: 1, fee: 100, seats: 80, day: 8 },
      { title: 'Indian History Level 1', cat: 1, fee: 100, seats: 60, day: 9 },
      { title: 'Sports & Games Trivia Cup', cat: 1, fee: 100, seats: 40, day: 10 },
      { title: 'Polity Rookie Arena', cat: 1, fee: 100, seats: 30, day: 11 },
      { title: 'Environment Ecology Starter', cat: 1, fee: 100, seats: 25, day: 12 },
      { title: 'Art & Culture Rookie Sprint', cat: 1, fee: 100, seats: 50, day: 13 },
      { title: 'Economics Basics Daily Quiz', cat: 1, fee: 100, seats: 40, day: 14 },
      { title: 'Vigyan Samagra Beginner', cat: 1, fee: 100, seats: 50, day: 15 },
      // SHARP (cat 2)
      { title: 'Hindi Sahitya Sharp League', cat: 2, fee: 150, seats: 50, day: 2 },
      { title: 'Advanced English Showdown', cat: 2, fee: 150, seats: 40, day: 3 },
      { title: 'GK Sprint Sharp Edition', cat: 2, fee: 200, seats: 80, day: 4 },
      { title: 'Mathematics Sharp Championship', cat: 2, fee: 150, seats: 60, day: 5 },
      { title: 'Science Explorer Level 2', cat: 2, fee: 200, seats: 100, day: 6 },
      { title: 'Modern History Sharp Cup', cat: 2, fee: 150, seats: 50, day: 7 },
      { title: 'World Geography Sharp Arena', cat: 2, fee: 200, seats: 80, day: 8 },
      { title: 'Indian Polity Madhyam Level', cat: 2, fee: 150, seats: 60, day: 9 },
      { title: 'Physics & Chemistry Sharp Quiz', cat: 2, fee: 200, seats: 40, day: 10 },
      { title: 'Economics Advanced League', cat: 2, fee: 150, seats: 50, day: 11 },
      { title: 'Current Affairs Weekly Sharp', cat: 2, fee: 200, seats: 100, day: 12 },
      { title: 'Computer Science Sharp Cup', cat: 2, fee: 150, seats: 30, day: 13 },
      { title: 'Biology Deep Dive Sharp', cat: 2, fee: 200, seats: 60, day: 14 },
      { title: 'Art Culture Sports Sharp', cat: 2, fee: 150, seats: 40, day: 15 },
      { title: 'Ganit Pratiyogita Level 2', cat: 2, fee: 150, seats: 80, day: 16 },
      { title: 'Tech Innovation Sharp League', cat: 2, fee: 200, seats: 100, day: 17 },
      { title: 'Rajniti Vigyan Sharp Series', cat: 2, fee: 200, seats: 60, day: 18 },
      { title: 'Census Statistics Sharp Quiz', cat: 2, fee: 150, seats: 40, day: 19 },
      { title: 'Hindi Kaushal Sharp Arena', cat: 2, fee: 150, seats: 60, day: 20 },
      { title: 'History Modern Sharp Cup', cat: 2, fee: 150, seats: 70, day: 21 },
      // LEGEND (cat 3)
      { title: '🔴 Legend Championship GK Grand', cat: 3, fee: 500, seats: 100, day: 1 },
      { title: '🔴 Math Legend Final Season 1', cat: 3, fee: 300, seats: 60, day: 3 },
      { title: '🔴 Science Legend Battle Royale', cat: 3, fee: 500, seats: 80, day: 5 },
      { title: '🔴 Indian History Grand Finale', cat: 3, fee: 300, seats: 50, day: 7 },
      { title: '🔴 Polity & Law Legend Cup', cat: 3, fee: 500, seats: 100, day: 9 },
      { title: '🔴 English Legend Mastery Quiz', cat: 3, fee: 300, seats: 60, day: 11 },
      { title: '🔴 Current Affairs Legend Series', cat: 3, fee: 500, seats: 80, day: 13 },
      { title: '🔴 Geography World Champion Cup', cat: 3, fee: 300, seats: 50, day: 15 },
      { title: '🔴 Physics Legend Grand Prix', cat: 3, fee: 500, seats: 100, day: 17 },
      { title: '🔴 Economics Finance Legend', cat: 3, fee: 300, seats: 60, day: 19 },
      { title: '🔴 Computer Science Legend Final', cat: 3, fee: 500, seats: 80, day: 21 },
      { title: '🔴 Biology Environment Legend', cat: 3, fee: 300, seats: 50, day: 23 },
      { title: '🔴 All India GK Champion 2025', cat: 3, fee: 500, seats: 100, day: 25 },
      { title: '🔴 Samanya Gyan Samrat Grand', cat: 3, fee: 300, seats: 60, day: 27 },
      { title: '🔴 QuizPro Season 1 Grand Final', cat: 3, fee: 500, seats: 100, day: 30 },
    ];

    const now = Math.floor(Date.now() / 1000);
    let created = 0;
    for (let i = 0; i < SESSIONS.length; i++) {
      const s = SESSIONS[i];
      const da = s.day * 86400;
      const pp = Math.floor(s.fee * s.seats * 0.75);
      await Session.create({
        id: Date.now() + i * 500 + Math.round(Math.random() * 499),
        category_id: s.cat,
        title: s.title,
        seat_limit: s.seats,
        seats_booked: s.seats,
        entry_fee: s.fee,
        quiz_delay_minutes: 60,
        status: 'completed',
        created_at: now - da - 7200,
        quiz_start_at: now - da,
        pdf_at: now - da - 1800,
        prize_pool: pp,
        platform_cut: s.fee * s.seats - pp,
        prizes_paid: true
      });
      created++;
    }
    res.json({ success: true, created, message: `${created} demo sessions seeded successfully!` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SYSTEM STATUS — Health Check Metrics ─────────────────────────────────────
router.get('/system-status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const uptime = process.uptime();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const loadAvg = os.loadavg();

    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';

    const requestedWD = await Withdrawal.countDocuments({ status: { $in: ['pending', 'approved'] } });
    const processingWD = await Withdrawal.countDocuments({ status: 'processing' });
    const failedWD = await Withdrawal.countDocuments({ status: { $in: ['failed', 'rejected'] } });
    const successWD = await Withdrawal.countDocuments({ status: { $in: ['completed', 'paid'] } });

    const totalTxns = await WalletTxn.countDocuments({});
    const recentFraudsCount = await FraudLog.countDocuments({ at: { $gte: Math.floor(Date.now() / 1000) - 86400 } });
    const latestFrauds = await FraudLog.find({}).sort({ at: -1 }).limit(5).lean();

    const activeSessions = await Session.countDocuments({ status: { $in: ['open', 'confirmed', 'live'] } });
    const completedSessions = await Session.countDocuments({ status: 'completed' });

    const unresolvedAlerts = await AIAlert.find({ resolved: false }).sort({ created_at: -1 }).lean();

    // Granular DB Counts
    const userCount = await User.countDocuments({});
    const sessionCount = await Session.countDocuments({});
    const quizCount = await Question.countDocuments({});
    const bookCount = await (mongoose.models.Book ? mongoose.models.Book.countDocuments({}) : Promise.resolve(0));

    const rzpKey = process.env.RAZORPAY_KEY_ID || '';
    const rzpConfigured = rzpKey.startsWith('rzp_') ? 'YES' : 'NO';
    const rzpMode = rzpKey.startsWith('rzp_live') ? 'LIVE' : 'TEST';

    const data = {
      server: {
        status: 'OK',
        uptime: Math.floor(uptime),
        env: process.env.NODE_ENV || 'production',
        node_version: process.version,
        cpu_load: loadAvg[0] * 100, // percentage
        memory_usage_mb: Math.floor((totalMem - freeMem) / 1024 / 1024),
        total_mem_mb: Math.floor(totalMem / 1024 / 1024)
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'OK' : 'ERROR',
        state: dbState
      },
      payment: {
        api_configured: rzpConfigured,
        mode: rzpMode,
        webhook: 'ACTIVE' // Simplified pattern
      },
      quiz: {
        active_sessions: activeSessions,
        completed_sessions: completedSessions
      },
      wallet: {
        total_txns: totalTxns
      },
      withdraw: {
        requested: requestedWD,
        processing: processingWD,
        failed: failedWD,
        success: successWD
      },
      fraud: {
        recent_alerts_24h: recentFraudsCount,
        latest: latestFrauds.map(f => ({
          at: f.at,
          type: f.type || 'Anomaly',
          user_id: f.user_id,
          amount: f.amount || 0
        }))
      },
      ai_admin: {
        active_alerts: unresolvedAlerts
      },
      stats: {
        users: userCount,
        sessions: sessionCount,
        questions: quizCount,
        books: bookCount
      }
    };
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/logs', authMiddleware, adminOnly, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '../sync.log');
    if (!fs.existsSync(logPath)) return res.json({ logs: ['No log file found.'] });

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').slice(-50).reverse();
    res.json({ logs: lines });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/actions/clear-sessions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await Session.deleteMany({ status: { $in: ['open', 'confirmed'] } });
    res.json({ success: true, message: `Cleared ${result.deletedCount} unstarted sessions.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/actions/sync-wallets', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { getWallet } = require('./wallet_utils');
    const users = await User.find({});
    let fixed = 0;
    for (const u of users) {
      await getWallet(u.id);
      fixed++;
    }
    res.json({ success: true, message: `Pinged ${fixed} wallets for integrity.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
router.get('/notifications', authMiddleware, adminOnly, async (req, res) => {
  try {
    const list = await Notification.find({}).sort({ created_at: -1 }).limit(50).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/notifications', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { user_id, title, message, type } = req.body;
    const count = await Notification.countDocuments({});
    const notif = new Notification({
      id: count + 1,
      user_id: user_id || 0,
      title,
      message,
      type: type || 'info'
    });
    await notif.save();
    res.json({ success: true, notif });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── BANNERS ─────────────────────────────────────────────────────────────────
router.get('/banners', authMiddleware, adminOnly, async (req, res) => {
  try {
    const list = await Banner.find({}).sort({ order: 1 }).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/banners', authMiddleware, adminOnly, async (req, res) => {
  try {
    const count = await Banner.countDocuments({});
    const banner = new Banner({ ...req.body, id: count + 1 });
    await banner.save();
    res.json({ success: true, banner });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/banners/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Banner.findOneAndUpdate({ id: req.params.id }, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────
router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const list = await PlatformConfig.find({}).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { key, value, description } = req.body;
    await PlatformConfig.findOneAndUpdate(
      { key },
      { value, description, updated_at: Math.floor(Date.now() / 1000) },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

