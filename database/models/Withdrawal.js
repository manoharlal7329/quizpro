
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    id: { type: String, unique: true, default: () => 'WD' + Date.now() },
    user_id: { type: Number, ref: 'User', required: true },
    amount: { type: Number, required: true }, // Requested amount
    tds_amount: { type: Number, default: 0 }, // 30% Tax
    net_amount: { type: Number, required: true }, // Amount to be paid (amount - tds)
    // Payment mode: UPI or BANK or REFUND
    payment_mode: { type: String, enum: ['UPI', 'BANK', 'REFUND'], default: 'UPI' },
    // UPI field (used when payment_mode is UPI)
    upi: { type: String },
    // Refund field (used when payment_mode is REFUND)
    original_payment_id: { type: String },
    // Bank transfer fields (used when payment_mode is BANK)
    bank_account_number: { type: String },
    bank_ifsc: { type: String },
    bank_account_name: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed', 'processing', 'failed'], default: 'pending' },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    paid_at: Number,
    payout_id: String,
    error: String,
    retry_count: { type: Number, default: 0 }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
