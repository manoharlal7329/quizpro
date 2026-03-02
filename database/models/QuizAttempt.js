const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    session_id: Number,
    user_id: Number,
    score: Number,
    total_ms: Number,
    submitted_at: Number,
    rank: Number,
    answers: String, // JSON string
    timings: String  // JSON string
}, { strict: false });

module.exports = mongoose.model('QuizAttempt', attemptSchema);
