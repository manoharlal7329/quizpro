const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: { type: Number, unique: true }, // Legacy ID
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    full_name: String,
    username: String,
    phone: String,
    name: String,
    is_admin: { type: Number, default: 0 },
    referral_code: { type: String, unique: true },
    referred_by: String,
    quizzes_solved: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('User', userSchema);
