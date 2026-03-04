const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    id: { type: Number, unique: true, default: () => Date.now() },
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    cover_emoji: { type: String, default: '📚' },
    cover_color: { type: String, default: '#7c3aed' },
    base_price: { type: Number, default: 0 },
    offer_price: { type: Number, default: 0 },
    offer_label: { type: String, default: '' },   // e.g. "50% OFF", "Special Offer"
    total_questions: { type: Number, default: 0 },
    status: { type: String, default: 'active' },  // active, inactive
    created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
}, { collection: 'books' });

module.exports = mongoose.models.Book || mongoose.model('Book', bookSchema);
