const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    id: { type: Number, unique: true, default: () => Date.now() },
    category_id: Number,
    title: { type: String, required: true },
    seat_limit: { type: Number, default: 100 },
    seats_booked: { type: Number, default: 0 },
    entry_fee: { type: Number, default: 0 },
    quiz_delay_minutes: { type: Number, default: 60 },
    status: { type: String, default: 'open' },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    quiz_start_at: Number,
    pdf_at: Number,
    prize_pool: Number,
    platform_cut: Number,
    prizes_paid: { type: Boolean, default: false }
});

module.exports = mongoose.model('Session', sessionSchema);

