const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    id: { type: String, unique: true, default: () => 'WD' + Date.now() },
    user_id: { type: Number, ref: 'User', required: true },
    amount: { type: Number, required: true },
    upi: { type: String, required: true },
    status: { type: String, default: 'PENDING' }, // PENDING, PAID, REJECTED
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    paid_at: Number,
    payout_id: String // Razorpay Payout ID
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
