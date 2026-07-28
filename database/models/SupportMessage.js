const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    user_id: { type: Number, required: true },
    name: { type: String },
    email: { type: String },
    message: { type: String, required: true },
    status: { type: String, default: 'PENDING' },
    admin_reply: { type: String },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
