const express = require('express');
const router = express.Router();
const { data, save } = require('../database/db');
const authMiddleware = require('../middleware/auth');

const sseClients = new Map();

// ─── LIST SESSIONS ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const sessions = data.sessions
        .filter(s => !['completed', 'cancelled'].includes(s.status))
        .sort((a, b) => b.created_at - a.created_at)
        .map(s => {
            const cat = data.categories.find(c => c.id == s.category_id);
            return { ...s, category_name: cat?.name, level: cat?.level, color: cat?.color };
        });
    res.json(sessions);
});

// ─── ALL CATEGORIES ───────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
    res.json(data.categories);
});

// ─── SESSION DETAIL ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const session = data.sessions.find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const cat = data.categories.find(c => c.id == session.category_id);
    const questions = data.questions
        .filter(q => q.session_id == session.id)
        .map(q => {
            const { correct, explanation, ...publicQ } = q;
            return publicQ;
        });

    res.json({ ...session, category_name: cat?.name, level: cat?.level, color: cat?.color, questions });
});

// ─── CHECK USER SEAT ──────────────────────────────────────────────────────────
router.get('/:id/my-seat', authMiddleware, async (req, res) => {
    const seat = data.seats.find(s => s.session_id == req.params.id && s.user_id == req.user.id);
    res.json({ has_seat: !!seat, seat });
});

// ─── STUDY PDF (with UserID + SessionID watermark on every page) ──────────────
router.get('/:id/pdf', authMiddleware, async (req, res) => {
    const session = data.sessions.find(s => s.id == req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const seat = data.seats.find(s => s.session_id == req.params.id && s.user_id == req.user.id);
    if (!seat) return res.status(403).json({ error: 'You have not booked a seat' });

    const now = Math.floor(Date.now() / 1000);
    if (session.pdf_at && now < session.pdf_at) {
        return res.status(403).json({ error: 'PDF not yet available', available_at: session.pdf_at });
    }

    const questions = data.questions.filter(q => q.session_id == req.params.id);
    const PDFDocument = require('pdfkit');
    const user = data.users.find(u => u.id == req.user.id);
    const watermarkText = `USER-${req.user.id} | SESSION-${session.id} | QuizPro Confidential`;

    const doc = new PDFDocument({ margin: 50, autoFirstPage: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="StudyMaterial_Session${session.id}.pdf"`);
    doc.pipe(res);

    // Helper: add watermark on every page
    const addWatermark = () => {
        doc.save();
        doc.opacity(0.07);
        doc.fontSize(28).fillColor('#7c3aed');
        // Diagonal watermark
        for (let y = 0; y < 800; y += 150) {
            doc.text(watermarkText, -20, y, { rotation: -35, lineBreak: false });
        }
        doc.opacity(1);
        doc.restore();
    };

    doc.on('pageAdded', addWatermark);

    // ── Title Page ───────────────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(24).fillColor('#1e293b').text('📘 QuizPro Study Material', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(14).fillColor('#475569').text(session.title, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#94a3b8').text(`Prepared for: ${user?.name || user?.mobile || 'Participant'}`, { align: 'center' });
    doc.fontSize(10).fillColor('#94a3b8').text(`User ID: ${req.user.id}  |  Session ID: ${session.id}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(11).fillColor('#64748b').text('This document is for registered participants only. Sharing or distribution is prohibited.', { align: 'center' });
    doc.moveDown(2);

    // ── Questions ────────────────────────────────────────────────────────────
    questions.forEach((q, i) => {
        // Page break if needed
        if (doc.y > 680) doc.addPage();

        doc.fillColor('#1e293b').fontSize(13)
            .text(`Q${i + 1}. ${q.question_text}`, { bold: true });
        doc.moveDown(0.3);

        doc.fillColor('#475569').fontSize(11)
            .text(`  A)  ${q.option_a}`)
            .text(`  B)  ${q.option_b}`)
            .text(`  C)  ${q.option_c}`)
            .text(`  D)  ${q.option_d}`);

        doc.moveDown(0.3);
        doc.fillColor('#10b981').fontSize(12)
            .text(`  ✅ Correct Answer: ${q.correct.toUpperCase()}`);
        doc.fillColor('#334155').fontSize(10)
            .text(`  💡 Explanation: ${q.explanation || 'Refer to standard textbooks.'}`);

        doc.moveDown(1.5);
    });

    // ── Footer on last page ──────────────────────────────────────────────────
    doc.moveDown();
    doc.fontSize(9).fillColor('#94a3b8')
        .text('© QuizPro — Skill-Based Educational Quiz Platform. All Rights Reserved.', { align: 'center' });

    doc.end();
});

// SSE
router.get('/:id/events', async (req, res) => {
    const sid = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.flushHeaders();
    if (!sseClients.has(sid)) sseClients.set(sid, []);
    sseClients.get(sid).push(res);
    const s = data.sessions.find(x => x.id == sid);
    if (s) res.write(`data: ${JSON.stringify({ seats_booked: s.seats_booked, status: s.status })}\n\n`);
    req.on('close', () => {
        const clients = sseClients.get(sid) || [];
        sseClients.set(sid, clients.filter(c => c !== res));
    });
});

router.broadcastSession = (sessionId, update) => {
    const clients = sseClients.get(String(sessionId)) || [];
    clients.forEach(c => c.write(`data: ${JSON.stringify(update)}\n\n`));
};

module.exports = router;
