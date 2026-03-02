const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    id: { type: Number, unique: true, default: () => Date.now() },
    session_id: { type: Number, ref: 'Session', required: true },
    question_text: { type: String, required: true },
    option_a: String,
    option_b: String,
    option_c: String,
    option_d: String,
    correct: String,
    explanation: String
});

module.exports = mongoose.model('Question', questionSchema);
