const { data, save } = require('./database/db');

const sessionId = 1771960018676;
const session = data.sessions.find(s => s.id === sessionId);

if (session) {
    const now = Math.floor(Date.now() / 1000);
    session.quiz_start_at = now + 300; // 5 minutes from now
    session.pdf_at = now - 60; // Available now
    session.status = 'confirmed';

    save();
    console.log(`✅ Session updated: Quiz in 5 mins (${new Date(session.quiz_start_at * 1000).toLocaleTimeString()})`);
} else {
    console.error('Session not found');
}
