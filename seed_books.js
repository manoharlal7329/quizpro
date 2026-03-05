require('dotenv').config();
const connectDB = require('./mongodb');
const mongoose = require('mongoose');
const Book = require('./database/models/Book');
const Question = require('./database/models/Question');

const SUBJECTS = [
    'Mathematics', 'General Knowledge', 'Hindi Grammar', 'Indian History',
    'General Science', 'Geography', 'Computer Awareness', 'English Language',
    'Reasoning', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Political Science'
];

const COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
const EMOJIS = ['📚', '📖', '🧠', '✍️', '🔬', '🌍', '💻', '🧪', '⚖️', '📊'];

async function seed() {
    console.log('🚀 Starting Bulk Book Seeding...');

    for (let i = 1; i <= 60; i++) {
        const subject = SUBJECTS[i % SUBJECTS.length];
        const color = COLORS[i % COLORS.length];
        const emoji = EMOJIS[i % EMOJIS.length];

        const book = new Book({
            id: Date.now() + i,
            title: `${subject} Master Guide Vol. ${Math.ceil(i / SUBJECTS.length)}`,
            subject: subject,
            description: `Comprehensive study material and 2000+ practice questions for ${subject}. Perfect for competitive exams.`,
            cover_emoji: emoji,
            cover_color: color,
            base_price: 499,
            offer_price: 149,
            offer_label: 'SPECIAL LAUNCH OFFER',
            status: 'active'
        });

        await book.save();
        console.log(`✅ Created Book ${i}/60: ${book.title}`);

        const questions = [];
        for (let q = 1; q <= 2000; q++) {
            questions.push({
                id: Date.now() + i * 10000 + q,
                book_id: book.id,
                question_text: `[${subject}] Practice Question #${q}: What is the correct property of ${subject} in context of secondary research?`,
                option_a: `Option A for Q${q}`,
                option_b: `Option B for Q${q}`,
                option_c: `Correct Answer C`,
                option_d: `Option D for Q${q}`,
                correct: 'c',
                explanation: `This is a detailed explanation for question ${q} in the ${subject} book. It explains why Option C is the most logically sound answer based on standard curriculum.`
            });

            if (questions.length === 500) {
                await Question.insertMany(questions);
                questions.length = 0;
                process.stdout.write('.');
            }
        }
        if (questions.length > 0) {
            await Question.insertMany(questions);
        }
        console.log(`\n   ∟ Inserted 2000 questions for ${book.title}`);
    }

    console.log('\n✨ BULK SEEDING COMPLETE!');
    process.exit(0);
}

async function start() {
    try {
        await connectDB();
        await seed();
    } catch (e) {
        console.error('Fatal error during seed:', e);
        process.exit(1);
    }
}

start();
