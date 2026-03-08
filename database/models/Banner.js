const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    title: { type: String, required: true },
    subtitle: String,
    image_url: String, // Optional image
    action_url: String, // Where it redirects when clicked
    bg_color: { type: String, default: '#7c3aed' }, // Theme color
    is_active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});

module.exports = mongoose.model('Banner', bannerSchema);
