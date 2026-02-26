const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db_store.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('--- FINAL PROD RESET START ---');

db.seats = [];
db.wallet_txns = [];
db.quiz_attempts = [];
db.payments = [];
db.withdrawals = [];

if (db.wallets) {
    db.wallets.forEach(w => {
        w.demo = 0;
        w.dep_bal = 0;
        w.win_bal = 0;
    });
}

if (db.sessions) {
    db.sessions.forEach(s => {
        s.seats_booked = 0;
        if (s.status !== 'open') s.status = 'open';
        delete s.quiz_start_at;
        delete s.pdf_at;
        delete s.prize_pool;
        delete s.platform_cut;
    });
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('--- FINAL PROD RESET DONE ---');
