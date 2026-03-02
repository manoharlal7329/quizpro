const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    mobile: String,
    type: String,   // Cash, Gift, Entry
    detail: String,
    assigned_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('Reward', rewardSchema);
