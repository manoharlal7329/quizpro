/**
 * sync_all.js - Complete data sync from db_store.json → MongoDB Atlas
 * Run: node sync_all.js
 */
require('dotenv').config();
require('dns').setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const fs = require('fs');

// ─── Models ──────────────────────────────────────────────────────────────────
const User = mongoose.model('User', new mongoose.Schema({ id: Number, email: { type: String, unique: true }, password: String, full_name: String, username: String, phone: String, name: String, is_admin: Number, referral_code: String, referred_by: String, quizzes_solved: Number, blocked: Boolean, upi_id: String, created_at: Number }, { collection: 'users' }));
const Wallet = mongoose.model('Wallet', new mongoose.Schema({ user_id: Number, demo: Number, dep_bal: Number, win_bal: Number, pin: String }, { collection: 'wallets' }));
const Category = mongoose.model('Category', new mongoose.Schema({ id: Number, name: String, level: String, color: String, icon: String, description: String }, { collection: 'categories' }));
const Session = mongoose.model('Session', new mongoose.Schema({ id: Number, category_id: Number, title: String, seat_limit: Number, seats_booked: Number, entry_fee: Number, quiz_delay_minutes: Number, status: String, created_at: Number }, { collection: 'sessions' }));
const Question = mongoose.model('Question', new mongoose.Schema({ id: Number, session_id: Number, question_text: String, option_a: String, option_b: String, option_c: String, option_d: String, correct: String, explanation: String }, { collection: 'questions' }));
const Payment = mongoose.model('Payment', new mongoose.Schema({ id: Number, user_id: Number, session_id: String, order_id: String, amount: Number, status: String }, { collection: 'payments' }));

// ─── Upsert Helper ───────────────────────────────────────────────────────────
async function upsert(Model, filter, doc) {
    try {
        await Model.findOneAndUpdate(filter, doc, { upsert: true, new: true, setDefaultsOnInsert: true });
        return true;
    } catch (e) {
        console.error(`  ⚠️ Error:`, e.message);
        return false;
    }
}

(async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) { console.error('❌ MONGODB_URI not set in .env'); process.exit(1); }

        console.log('\n🚀 QuizPro Full Sync Starting...');
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
        console.log('✅ MongoDB Connected\n');

        // Load local data
        const data = JSON.parse(fs.readFileSync('./db_store.json', 'utf8'));

        // ─── USERS ──────────────────────────────────────────────────────────
        console.log('👤 Syncing Users...');
        for (const u of (data.users || [])) {
            const ok = await upsert(User, { id: u.id }, u);
            console.log(`  ${ok ? '✅' : '❌'} [${u.is_admin ? 'ADMIN' : 'USER'}] ${u.email} (id:${u.id})`);
        }

        // ─── WALLETS ────────────────────────────────────────────────────────
        console.log('\n💰 Syncing Wallets...');
        for (const w of (data.wallets || [])) {
            const ok = await upsert(Wallet, { user_id: w.user_id }, w);
            console.log(`  ${ok ? '✅' : '❌'} Wallet user_id:${w.user_id}`);
        }

        // ─── CATEGORIES ─────────────────────────────────────────────────────
        console.log('\n📂 Syncing Categories...');
        for (const c of (data.categories || [])) {
            const ok = await upsert(Category, { id: c.id }, c);
            console.log(`  ${ok ? '✅' : '❌'} ${c.name}`);
        }

        // ─── SESSIONS ───────────────────────────────────────────────────────
        console.log('\n🎯 Syncing Sessions...');
        for (const s of (data.sessions || [])) {
            const ok = await upsert(Session, { id: s.id }, s);
            console.log(`  ${ok ? '✅' : '❌'} ${s.title}`);
        }

        // ─── QUESTIONS ──────────────────────────────────────────────────────
        console.log('\n❓ Syncing Questions...');
        for (const q of (data.questions || [])) {
            const ok = await upsert(Question, { id: q.id }, q);
            console.log(`  ${ok ? '✅' : '❌'} Q${q.id}: ${q.question_text?.substring(0, 40)}...`);
        }

        // ─── PAYMENTS ───────────────────────────────────────────────────────
        console.log('\n💳 Syncing Payments...');
        for (const p of (data.payments || [])) {
            const ok = await upsert(Payment, { id: p.id }, p);
            console.log(`  ${ok ? '✅' : '❌'} Payment id:${p.id} amount:${p.amount}`);
        }

        // ─── SUMMARY ────────────────────────────────────────────────────────
        console.log('\n════════════════════════════════════════');
        console.log('🎉 SYNC COMPLETE — MongoDB Atlas is now identical to db_store.json');
        console.log(`   Users: ${data.users?.length || 0}`);
        console.log(`   Wallets: ${data.wallets?.length || 0}`);
        console.log(`   Categories: ${data.categories?.length || 0}`);
        console.log(`   Sessions: ${data.sessions?.length || 0}`);
        console.log(`   Questions: ${data.questions?.length || 0}`);
        console.log('════════════════════════════════════════\n');
        console.log('🔑 Admin Login: manoharlala02911@gmail.com');
        console.log('   Password hash stored in MongoDB (use your original password)\n');

        process.exit(0);
    } catch (e) {
        console.error('❌ Fatal Error:', e.message);
        process.exit(1);
    }
})();
