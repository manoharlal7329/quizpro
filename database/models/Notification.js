const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    user_id: { type: Number, default: 0 }, // 0 = Global (All users)
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, // info, success, warning, reward
    is_read: { type: Boolean, default: false },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('Notification', notificationSchema);
