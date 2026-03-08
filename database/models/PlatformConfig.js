const mongoose = require('mongoose');

const platformConfigSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: String,
    updated_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
