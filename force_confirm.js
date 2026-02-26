const { data, save } = require('./database/db');

const sessionId = 1771960018676;
const session = data.sessions.find(s => s.id === sessionId);

if (session) {
    console.log('Found session:', session.title);
    session.seats_booked = session.seat_limit;
    session.status = 'confirmed';

    // Set quiz start to 29 minutes from now to trigger the 30-min alert
    const now = Math.floor(Date.now() / 1000);
    session.quiz_start_at = now + 1740;
    session.pdf_at = session.quiz_start_at - 1800;

    // Add dummy seats to fill the gap
    if (!data.seats) data.seats = [];
    const currentSeats = data.seats.filter(s => s.session_id === sessionId).length;
    const needed = session.seat_limit - currentSeats;

    for (let i = 0; i < needed; i++) {
        data.seats.push({
            id: Date.now() + i,
            session_id: sessionId,
            user_id: 999 + i,
            paid_at: now,
            payment_id: 'SYSTEM_FILL_' + (Date.now() + i)
        });
    }

    save();
    console.log(`✅ Session ${sessionId} forced to FULL & CONFIRMED.`);
    console.log(`⏱️ Quiz starts at: ${new Date(session.quiz_start_at * 1000).toLocaleTimeString()}`);
    console.log(`📘 PDF unlocks at: ${new Date(session.pdf_at * 1000).toLocaleTimeString()}`);
} else {
    console.error('Session not found!');
}
