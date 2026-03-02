const mongoose = require('mongoose');

const fraudLogSchema = new mongoose.Schema({
    type: String,
    user_id: Number,
    payment_id: String,
    amount: Number,
    details: mongoose.Schema.Types.Mixed,
    at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('FraudLog', fraudLogSchema);
