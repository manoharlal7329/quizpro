const mongoose = require('mongoose');

const walletTxnSchema = new mongoose.Schema({
    id: { type: Number, unique: true, default: () => Date.now() },
    user_id: { type: Number, ref: 'User', required: true },
    wallet: String, // demo, real
    type: String,   // credit, debit
    amount: Number,
    note: String,
    at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    payment_id: String,
    order_id: String,
    status: String,
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WalletTxn', walletTxnSchema);
