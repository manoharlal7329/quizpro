const mongoose = require('mongoose');

const bookPurchaseSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    user_id: { type: Number, required: true },
    book_id: { type: Number, required: true },
    amount_paid: { type: Number, default: 0 },
    purchased_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
}, { collection: 'book_purchases' });

module.exports = mongoose.models.BookPurchase || mongoose.model('BookPurchase', bookPurchaseSchema);
