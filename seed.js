/**
 * seed.js - Run once to verify/fix admin user in MongoDB
 * Usage: node seed.js
 */
require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    full_name: String,
    username: String,
    phone: String,
    name: String,
    is_admin: { type: Number, default: 0 },
    referral_code: { type: String, unique: true },
    referred_by: String,
    quizzes_solved: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
}, { collection: 'users' });

const WalletSchema = new mongoose.Schema({
    user_id: { type: Number },
    demo: { type: Number, default: 0 },
    dep_bal: { type: Number, default: 0 },
    win_bal: { type: Number, default: 0 },
}, { collection: 'wallets' });

(async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('❌ MONGODB_URI not set in .env');
            process.exit(1);
        }

        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB Atlas');

        const User = mongoose.model('User', UserSchema);
        const Wallet = mongoose.model('Wallet', WalletSchema);

        // === CHECK ADMIN USER ===
        let admin = await User.findOne({ email: 'manoharlala02911@gmail.com' });

        if (admin) {
            console.log('✅ Admin user EXISTS in MongoDB:', admin.email, '| is_admin:', admin.is_admin);
            console.log('   Admin id:', admin.id, '| name:', admin.name);

            // Verify/fix is_admin flag
            if (admin.is_admin !== 1) {
                admin.is_admin = 1;
                await admin.save();
                console.log('✅ Fixed: is_admin set to 1');
            }

            // Reset password to known value
            const newHash = await bcrypt.hash('Manohar2005@@', 10);
            admin.password = newHash;
            await admin.save();
            console.log('✅ Password reset to: Manohar2005@@');

        } else {
            console.log('⚠️ Admin user NOT found. Creating...');
            const hash = await bcrypt.hash('Manohar2005@@', 10);
            admin = new User({
                id: 1,
                email: 'manoharlala02911@gmail.com',
                password: hash,
                full_name: 'Manohar Lal Prajapati',
                username: 'manohar',
                phone: '0000000000',
                name: 'Manohar Lal Prajapati',
                is_admin: 1,
                referral_code: 'ADMIN001',
            });
            await admin.save();
            console.log('✅ Admin user created!');
        }

        // === CHECK ADMIN WALLET ===
        let wallet = await Wallet.findOne({ user_id: admin.id });
        if (!wallet) {
            wallet = new Wallet({ user_id: admin.id, demo: 0, dep_bal: 0, win_bal: 0 });
            await wallet.save();
            console.log('✅ Admin wallet created!');
        } else {
            console.log('✅ Admin wallet EXISTS:', wallet);
        }

        // === LIST ALL USERS ===
        const users = await User.find({}).select('id email name is_admin');
        console.log('\n📋 All Users in MongoDB:');
        users.forEach(u => console.log(`  [${u.is_admin === 1 ? 'ADMIN' : 'USER '}] ${u.email} | id:${u.id}`));

        console.log('\n🎉 Seed complete! Login with: manoharlala02911@gmail.com / Manohar2005@@');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
})();
