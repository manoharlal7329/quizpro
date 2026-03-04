require('dotenv').config();
const mongoose = require('mongoose');
const Session = require('./database/models/Session');

const sessions50 = [
    // ── ROOKIE (category_id: 1) ──────────────────────────────────────────────
    { title: 'Hindi Vyakaran — Rookie Battle #1', category_id: 1, entry_fee: 100, seat_limit: 20, days_ago: 1 },
    { title: 'English Grammar Quiz — Beginner Cup', category_id: 1, entry_fee: 100, seat_limit: 30, days_ago: 2 },
    { title: 'Samanya Gyan — Daily Arena', category_id: 1, entry_fee: 100, seat_limit: 50, days_ago: 3 },
    { title: 'Math Basics Blitz', category_id: 1, entry_fee: 100, seat_limit: 40, days_ago: 4 },
    { title: 'Computer Gyan Quiz', category_id: 1, entry_fee: 100, seat_limit: 60, days_ago: 5 },
    { title: 'Science Rookie Rumble', category_id: 1, entry_fee: 100, seat_limit: 50, days_ago: 6 },
    { title: 'Current Affairs — 7-Day Blast', category_id: 1, entry_fee: 100, seat_limit: 100, days_ago: 7 },
    { title: 'Geography Starter League', category_id: 1, entry_fee: 100, seat_limit: 80, days_ago: 8 },
    { title: 'Indian History — Level 1', category_id: 1, entry_fee: 100, seat_limit: 60, days_ago: 9 },
    { title: 'Sports & Games Trivia Cup', category_id: 1, entry_fee: 100, seat_limit: 40, days_ago: 10 },
    { title: 'Economics Basics — Daily Quiz', category_id: 1, entry_fee: 100, seat_limit: 50, days_ago: 11 },
    { title: 'Polity & Constitution Rookie', category_id: 1, entry_fee: 100, seat_limit: 30, days_ago: 12 },
    { title: 'Environment & Ecology Starter', category_id: 1, entry_fee: 100, seat_limit: 20, days_ago: 13 },
    { title: 'Art & Culture — Rookie Sprint', category_id: 1, entry_fee: 100, seat_limit: 25, days_ago: 14 },
    { title: 'Vigyan Samagra — Beginner', category_id: 1, entry_fee: 100, seat_limit: 50, days_ago: 15 },

    // ── SHARP (category_id: 2) ───────────────────────────────────────────────
    { title: 'Hindi Sahitya — Sharp League', category_id: 2, entry_fee: 150, seat_limit: 50, days_ago: 2 },
    { title: 'Advanced English Grammar Showdown', category_id: 2, entry_fee: 150, seat_limit: 40, days_ago: 3 },
    { title: 'GK Sprint — Sharp Edition', category_id: 2, entry_fee: 200, seat_limit: 80, days_ago: 4 },
    { title: 'Mathematics Sharp Championship', category_id: 2, entry_fee: 150, seat_limit: 60, days_ago: 5 },
    { title: 'Science Explorer — Level 2', category_id: 2, entry_fee: 200, seat_limit: 100, days_ago: 6 },
    { title: 'Modern History Sharp Cup', category_id: 2, entry_fee: 150, seat_limit: 50, days_ago: 7 },
    { title: 'World Geography — Sharp Arena', category_id: 2, entry_fee: 200, seat_limit: 80, days_ago: 8 },
    { title: 'Indian Polity — Madhyam Level', category_id: 2, entry_fee: 150, seat_limit: 60, days_ago: 9 },
    { title: 'Physics & Chemistry Sharp Quiz', category_id: 2, entry_fee: 200, seat_limit: 40, days_ago: 10 },
    { title: 'Economics Advanced League', category_id: 2, entry_fee: 150, seat_limit: 50, days_ago: 11 },
    { title: 'Current Affairs — Weekly Sharp', category_id: 2, entry_fee: 200, seat_limit: 100, days_ago: 12 },
    { title: 'Computer Science Sharp Cup', category_id: 2, entry_fee: 150, seat_limit: 30, days_ago: 13 },
    { title: 'Biology Deep Dive — Sharp', category_id: 2, entry_fee: 200, seat_limit: 60, days_ago: 14 },
    { title: 'Art, Culture & Sports — Sharp', category_id: 2, entry_fee: 150, seat_limit: 40, days_ago: 15 },
    { title: 'Environment Science Sharp Battle', category_id: 2, entry_fee: 200, seat_limit: 50, days_ago: 16 },
    { title: 'Ganit Pratiyogita — Level 2', category_id: 2, entry_fee: 150, seat_limit: 80, days_ago: 17 },
    { title: 'Rajniti Vigyan — Sharp Series', category_id: 2, entry_fee: 200, seat_limit: 60, days_ago: 18 },
    { title: 'Census & Statistics Sharp Quiz', category_id: 2, entry_fee: 150, seat_limit: 40, days_ago: 19 },
    { title: 'Tech & Innovation Sharp League', category_id: 2, entry_fee: 200, seat_limit: 100, days_ago: 20 },

    // ── LEGEND (category_id: 3) ──────────────────────────────────────────────
    { title: '🔴 Legend Championship — GK Grand', category_id: 3, entry_fee: 500, seat_limit: 100, days_ago: 1 },
    { title: '🔴 Math Legend Final — Season 1', category_id: 3, entry_fee: 300, seat_limit: 60, days_ago: 3 },
    { title: '🔴 Science Legend Battle Royale', category_id: 3, entry_fee: 500, seat_limit: 80, days_ago: 5 },
    { title: '🔴 Indian History Grand Finale', category_id: 3, entry_fee: 300, seat_limit: 50, days_ago: 7 },
    { title: '🔴 Polity & Law Legend Cup', category_id: 3, entry_fee: 500, seat_limit: 100, days_ago: 9 },
    { title: '🔴 English Legend Mastery Quiz', category_id: 3, entry_fee: 300, seat_limit: 60, days_ago: 11 },
    { title: '🔴 Current Affairs Legend Series', category_id: 3, entry_fee: 500, seat_limit: 80, days_ago: 13 },
    { title: '🔴 Geography World Champion Cup', category_id: 3, entry_fee: 300, seat_limit: 50, days_ago: 15 },
    { title: '🔴 Physics Legend Grand Prix', category_id: 3, entry_fee: 500, seat_limit: 100, days_ago: 17 },
    { title: '🔴 Economics Finance Legend', category_id: 3, entry_fee: 300, seat_limit: 60, days_ago: 19 },
    { title: '🔴 Computer Science Legend Final', category_id: 3, entry_fee: 500, seat_limit: 80, days_ago: 21 },
    { title: '🔴 Biology & Environment Legend', category_id: 3, entry_fee: 300, seat_limit: 50, days_ago: 23 },
    { title: '🔴 All India GK Champion 2025', category_id: 3, entry_fee: 500, seat_limit: 100, days_ago: 25 },
    { title: '🔴 Samanya Gyan Samrat — Grand', category_id: 3, entry_fee: 300, seat_limit: 60, days_ago: 27 },
    { title: '🔴 QuizPro Season 1 — Grand Final', category_id: 3, entry_fee: 500, seat_limit: 100, days_ago: 30 },
];

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    let created = 0;
    for (const s of sessions50) {
        const now = Math.floor(Date.now() / 1000);
        const daysAgo = s.days_ago * 86400;
        const quiz_start_at = now - daysAgo;
        const totalCollection = s.entry_fee * s.seat_limit;
        const prize_pool = Math.floor(totalCollection * 0.75);
        const platform_cut = totalCollection - prize_pool;

        const sess = new Session({
            id: Date.now() + Math.floor(Math.random() * 9999),
            category_id: s.category_id,
            title: s.title,
            seat_limit: s.seat_limit,
            seats_booked: s.seat_limit,     // 💯 All seats filled
            entry_fee: s.entry_fee,
            quiz_delay_minutes: 60,
            status: 'completed',            // ✅ Completed
            created_at: now - daysAgo - 7200,
            quiz_start_at,
            pdf_at: quiz_start_at - 1800,
            prize_pool,
            platform_cut,
            prizes_paid: true
        });

        await sess.save();
        created++;
        // Small delay to avoid duplicate IDs
        await new Promise(r => setTimeout(r, 5));
        console.log(`[${created}/50] ✅ ${s.title}`);
    }

    console.log(`\n🎉 Done! ${created} completed sessions seeded.`);
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
