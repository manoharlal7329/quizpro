const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user_id: { type: Number, ref: 'User', required: true, unique: true },
    demo: { type: Number, default: 0 },
    dep_bal: { type: Number, default: 0 }, // Represents total_deposit
    win_bal: { type: Number, default: 0 }, // Represents total_winnings
    total_withdrawn: { type: Number, default: 0 },
    pin: String,
    last_deposit_at: Date,
    last_withdraw_at: Date
});

module.exports = mongoose.model('Wallet', walletSchema);
