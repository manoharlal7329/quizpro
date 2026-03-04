const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const Book = require('../database/models/Book');
const Question = require('../database/models/Question');
const BookPurchase = require('../database/models/BookPurchase');
const { getWallet, addTxn } = require('./wallet_utils');

const upload = multer({ storage: multer.memoryStorage() });

// ── Admin guard ────────────────────────────────────────────────────────────────
const User = require('../database/models/User');
async function adminOnly(req, res, next) {
    const user = await User.findOne({ id: Number(req.user.id) }).lean();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
}

// ─── PUBLIC: List all active books ────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const books = await Book.find({ status: 'active' }).sort({ created_at: -1 }).lean();
        const userId = req.user.id;

        const result = await Promise.all(books.map(async (b) => {
            const q_count = await Question.countDocuments({ book_id: b.id });
            const purchased = await BookPurchase.findOne({ user_id: userId, book_id: b.id }).lean();
            return { ...b, q_count, purchased: !!purchased };
        }));

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PUBLIC: Get one book's info ───────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const book = await Book.findOne({ id: Number(req.params.id) }).lean();
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const q_count = await Question.countDocuments({ book_id: book.id });
        const purchased = await BookPurchase.findOne({ user_id: req.user.id, book_id: book.id }).lean();

        res.json({ ...book, q_count, purchased: !!purchased });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PUBLIC: Purchase / Unlock a book ─────────────────────────────────────────
router.post('/:id/purchase', authMiddleware, async (req, res) => {
    try {
        const book = await Book.findOne({ id: Number(req.params.id) }).lean();
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const alreadyPurchased = await BookPurchase.findOne({ user_id: req.user.id, book_id: book.id });
        if (alreadyPurchased) return res.json({ success: true, message: 'Already unlocked' });

        const price = book.offer_price > 0 ? book.offer_price : book.base_price;

        if (price > 0) {
            const wallet = await getWallet(req.user.id);
            const totalReal = (wallet.dep_bal || 0) + (wallet.win_bal || 0);
            if (totalReal < price) return res.status(400).json({ error: 'Insufficient balance. Please add funds.' });

            // Deduct from dep_bal first, then win_bal
            let remaining = price;
            if (wallet.dep_bal >= remaining) {
                wallet.dep_bal -= remaining;
                remaining = 0;
            } else {
                remaining -= wallet.dep_bal;
                wallet.dep_bal = 0;
                wallet.win_bal -= remaining;
            }
            await wallet.save();
            await addTxn(req.user.id, 'real', 'debit', price, `📖 Book Unlocked: ${book.title}`);
        }

        const purchase = new BookPurchase({
            id: Date.now(),
            user_id: req.user.id,
            book_id: book.id,
            amount_paid: price
        });
        await purchase.save();

        res.json({ success: true, message: `"${book.title}" unlocked successfully!` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PUBLIC: Get questions from a purchased book (for quiz) ───────────────────
router.get('/:id/questions', authMiddleware, async (req, res) => {
    try {
        const book = await Book.findOne({ id: Number(req.params.id) }).lean();
        if (!book) return res.status(404).json({ error: 'Book not found' });

        // If book is paid, verify purchase
        const price = book.offer_price > 0 ? book.offer_price : book.base_price;
        if (price > 0) {
            const purchased = await BookPurchase.findOne({ user_id: req.user.id, book_id: book.id });
            if (!purchased) return res.status(403).json({ error: 'Please purchase this book first' });
        }

        const questions = await Question.find({ book_id: book.id }).lean();
        // Shuffle and return all questions
        const shuffled = questions.sort(() => Math.random() - 0.5);
        res.json(shuffled);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ADMIN: Create a new book ──────────────────────────────────────────────────
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { title, subject, description, cover_emoji, cover_color, base_price, offer_price, offer_label } = req.body;
        if (!title || !subject) return res.status(400).json({ error: 'Title and subject are required' });

        const book = new Book({
            id: Date.now(),
            title, subject,
            description: description || '',
            cover_emoji: cover_emoji || '📚',
            cover_color: cover_color || '#7c3aed',
            base_price: Number(base_price) || 0,
            offer_price: Number(offer_price) || 0,
            offer_label: offer_label || '',
            status: 'active'
        });
        await book.save();
        res.json({ success: true, book });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ADMIN: Update a book ──────────────────────────────────────────────────────
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const book = await Book.findOne({ id: Number(req.params.id) });
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const fields = ['title', 'subject', 'description', 'cover_emoji', 'cover_color', 'base_price', 'offer_price', 'offer_label', 'status'];
        fields.forEach(f => { if (req.body[f] !== undefined) book[f] = req.body[f]; });
        await book.save();
        res.json({ success: true, book });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ADMIN: Upload questions for a book from Excel ────────────────────────────
router.post('/:id/upload', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
    try {
        const book = await Book.findOne({ id: Number(req.params.id) });
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (!rows.length) return res.status(400).json({ error: 'Excel is empty' });

        const added = [];
        for (const row of rows) {
            const q = new Question({
                id: Date.now() + Math.random(),
                book_id: book.id,
                session_id: null,
                question_text: row['question'] || row['Question'] || row['question_text'] || '',
                option_a: row['option_a'] || row['Option A'] || row['A'] || '',
                option_b: row['option_b'] || row['Option B'] || row['B'] || '',
                option_c: row['option_c'] || row['Option C'] || row['C'] || '',
                option_d: row['option_d'] || row['Option D'] || row['D'] || '',
                correct: (row['correct'] || row['Correct'] || row['answer'] || 'a').toString().toLowerCase().trim(),
                explanation: row['explanation'] || row['Explanation'] || ''
            });
            if (q.question_text) {
                await q.save();
                added.push(q);
            }
        }

        // Update question count on book
        book.total_questions = await Question.countDocuments({ book_id: book.id });
        await book.save();

        res.json({ success: true, added: added.length, message: `${added.length} questions uploaded to "${book.title}"` });
    } catch (e) {
        res.status(500).json({ error: 'Upload failed: ' + e.message });
    }
});

// ─── ADMIN: Delete a book (and its questions) ─────────────────────────────────
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const bid = Number(req.params.id);
        await Book.deleteOne({ id: bid });
        await Question.deleteMany({ book_id: bid });
        await BookPurchase.deleteMany({ book_id: bid });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ADMIN: List all books (with question counts) ─────────────────────────────
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
    try {
        const books = await Book.find({}).sort({ created_at: -1 }).lean();
        const result = await Promise.all(books.map(async (b) => {
            const q_count = await Question.countDocuments({ book_id: b.id });
            const purchases = await BookPurchase.countDocuments({ book_id: b.id });
            return { ...b, q_count, purchases };
        }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
