const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Models
const User = require('../database/models/User');
const Wallet = require('../database/models/Wallet');
const Session = require('../database/models/Session');
const Category = require('../database/models/Category');
const Question = require('../database/models/Question');
const Seat = require('../database/models/Seat');
const WalletTxn = require('../database/models/WalletTxn');
const Withdrawal = require('../database/models/Withdrawal');
const FraudLog = require('../database/models/FraudLog');
const Payment = require('../database/models/Payment');
const Reward = require('../database/models/Reward');

const DB_FILE = path.join(__dirname, '..', 'db_store.json');

async function migrate() {
    if (!fs.existsSync(DB_FILE)) {
        console.error("❌ db_store.json not found!");
        return;
    }

    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    console.log("📂 Loaded db_store.json");

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB Atlas");

        // 1. Users
        if (data.users?.length) {
            console.log(`👤 Migrating ${data.users.length} Users...`);
            for (const u of data.users) {
                await User.findOneAndUpdate({ id: u.id }, u, { upsert: true });
            }
        }

        // 2. Wallets
        if (data.wallets?.length) {
            console.log(`💰 Migrating ${data.wallets.length} Wallets...`);
            for (const w of data.wallets) {
                await Wallet.findOneAndUpdate({ user_id: w.user_id }, w, { upsert: true });
            }
        }

        // 3. Sessions
        if (data.sessions?.length) {
            console.log(`🗂️ Migrating ${data.sessions.length} Sessions...`);
            for (const s of data.sessions) {
                await Session.findOneAndUpdate({ id: s.id }, s, { upsert: true });
            }
        }

        // 4. Categories
        if (data.categories?.length) {
            console.log(`📁 Migrating ${data.categories.length} Categories...`);
            for (const c of data.categories) {
                await Category.findOneAndUpdate({ id: c.id }, c, { upsert: true });
            }
        }

        // 5. Questions
        if (data.questions?.length) {
            console.log(`📝 Migrating ${data.questions.length} Questions...`);
            for (const q of data.questions) {
                await Question.findOneAndUpdate({ id: q.id }, q, { upsert: true });
            }
        }

        // 6. Seats
        if (data.seats?.length) {
            console.log(`🎟️ Migrating ${data.seats.length} Seats...`);
            for (const st of data.seats) {
                await Seat.findOneAndUpdate({ id: st.id }, st, { upsert: true });
            }
        }

        // 7. Wallet Txns
        if (data.wallet_txns?.length) {
            console.log(`💸 Migrating ${data.wallet_txns.length} Wallet Transactions...`);
            for (const t of data.wallet_txns) {
                await WalletTxn.findOneAndUpdate({ id: t.id }, t, { upsert: true });
            }
        }

        // 8. Withdrawals
        if (data.withdraw_requests?.length) {
            console.log(`🏧 Migrating ${data.withdraw_requests.length} Withdrawals...`);
            for (const w of data.withdraw_requests) {
                await Withdrawal.findOneAndUpdate({ id: w.id }, w, { upsert: true });
            }
        }

        // 9. Fraud Logs
        if (data.fraud_logs?.length) {
            console.log(`🚨 Migrating ${data.fraud_logs.length} Fraud Logs...`);
            for (const f of data.fraud_logs) {
                await FraudLog.create(f); // No unique ID for fraud logs usually
            }
        }

        // 10. Payments
        if (data.payments?.length) {
            console.log(`💳 Migrating ${data.payments.length} Payments...`);
            for (const p of data.payments) {
                await Payment.findOneAndUpdate({ id: p.id }, p, { upsert: true });
            }
        }

        // 11. Rewards
        if (data.rewards?.length) {
            console.log(`🎁 Migrating ${data.rewards.length} Rewards...`);
            for (const r of data.rewards) {
                await Reward.create(r);
            }
        }

        console.log("\n🔥 MIGRATION COMPLETE! Saara data MongoDB Atlas par shift ho gaya hai.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Migration Failed:", error);
        process.exit(1);
    }
}

migrate();
