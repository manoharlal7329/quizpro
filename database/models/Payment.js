const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    id: { type: Number, unique: true, default: () => Date.now() },
    user_id: { type: Number, ref: 'User', required: true },
    session_id: String,
    order_id: String,
    amount: Number,
    status: { type: String, default: 'pending' } // pending, completed, failed
});

module.exports = mongoose.model('Payment', paymentSchema);
