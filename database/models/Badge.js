const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
    user_id: Number,
    badge_id: String,
    name: String,
    icon: String,
    desc: String,
    earned_at: Number
}, { strict: false });

module.exports = mongoose.model('Badge', badgeSchema);
