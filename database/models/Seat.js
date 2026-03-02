const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
    id: { type: Number, unique: true, default: () => Date.now() },
    session_id: { type: Number, ref: 'Session', required: true },
    user_id: { type: Number, ref: 'User', required: true },
    paid_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    payment_id: String
});

module.exports = mongoose.model('Seat', seatSchema);
