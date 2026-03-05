const mongoose = require('mongoose');

const aiAlertSchema = new mongoose.Schema({
    type: { type: String, enum: ['cheating', 'bot', 'payment', 'crash', 'system'], required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    message: { type: String, required: true },
    details: mongoose.Schema.Types.Mixed,
    resolved: { type: Boolean, default: false },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    resolved_at: { type: Number }
});

module.exports = mongoose.model('AIAlert', aiAlertSchema);
