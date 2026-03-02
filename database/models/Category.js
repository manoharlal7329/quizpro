const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: { type: String, required: true },
    level: String,
    color: String,
    icon: String,
    description: String
});

module.exports = mongoose.model('Category', categorySchema);
