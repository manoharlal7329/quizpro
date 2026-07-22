const mongoose = require('mongoose');

const upiDepositSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    user_id: { type: Number, required: true },
    amount: { type: Number, required: true },
    approved_amount: { type: Number, default: null },
    utr: { type: String, required: true, trim: true },
    screenshot_url: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['PENDING', 'APPROVED', 'REJECTED'], 
        default: 'PENDING' 
    },
    admin_note: { type: String, default: '' },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    processed_at: { type: Number, default: null }
});

module.exports = mongoose.model('UpiDeposit', upiDepositSchema);
