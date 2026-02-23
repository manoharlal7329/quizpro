const fs = require('fs');
const db = JSON.parse(fs.readFileSync('./db_store.json', 'utf8'));
const now = Math.floor(Date.now() / 1000);

// Fix session 120
const s = db.sessions.find(s => s.id === 120);
if (!s) { console.log('Session 120 not found!'); process.exit(1); }

s.status = 'confirmed';
s.quiz_start_at = now - 1;    // already started
s.pdf_at = now - 3600;        // PDF already unlocked
s.prize_pool = Math.floor(s.entry_fee * s.seat_limit * 0.75);
s.platform_cut = Math.floor(s.entry_fee * s.seat_limit * 0.25);
console.log(`✅ Session 120 confirmed. quiz_start_at = ${s.quiz_start_at}`);

// Add a seat for ALL existing users who don't have one (for the logged-in admin)
if (!db.seats) db.seats = [];

db.users.forEach(u => {
    const hasSeat = db.seats.find(seat => seat.session_id === 120 && seat.user_id === u.id);
    if (!hasSeat) {
        db.seats.push({
            id: Date.now() + Math.random(),
            session_id: 120,
            user_id: u.id,
            paid_at: now,
            payment_id: 'DUMMY_DIRECT_' + u.id
        });
        console.log(`✅ Seat added for user ${u.mobile || u.id}`);
    }
});

if (!db.payments) db.payments = [];

fs.writeFileSync('./db_store.json', JSON.stringify(db, null, 2));
console.log('✅ db_store.json saved. Ab server restart karo!');
