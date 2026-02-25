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
    const session = data.sessions.find(s => String(s.id) === String(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const cat = data.categories.find(c => c.id == session.category_id);
    const questions = data.questions
        .filter(q => String(q.session_id) === String(session.id))
        .map(q => {
            const { correct, explanation, ...publicQ } = q;
            return publicQ;
        });

    res.json({ ...session, category_name: cat?.name, level: cat?.level, color: cat?.color, questions });
});

// ─── CHECK USER SEAT ──────────────────────────────────────────────────────────
router.get('/:id/my-seat', authMiddleware, async (req, res) => {
    const seat = data.seats.find(s => String(s.session_id) === String(req.params.id) && String(s.user_id) === String(req.user.id));
    res.json({ has_seat: !!seat, seat });
});

// ─── STUDY MATERIAL (JSON with Answers) ──────────────────────────────────────
router.get('/:id/study', authMiddleware, async (req, res) => {
    const session = data.sessions.find(s => String(s.id) === String(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const seat = data.seats.find(s => String(s.session_id) === String(req.params.id) && String(s.user_id) === String(req.user.id));
    if (!seat) return res.status(403).json({ error: 'You have not booked a seat' });

    const now = Math.floor(Date.now() / 1000);
    if (session.pdf_at && now < session.pdf_at) {
        return res.status(403).json({ error: 'Study material not yet available', available_at: session.pdf_at });
    }

    const questions = data.questions.filter(q => parseInt(q.session_id) === parseInt(req.params.id));
    res.json({ ...session, questions });
});

// ─── STUDY PDF (with UserID + SessionID watermark on every page) ──────────────
router.get('/:id/pdf', authMiddleware, async (req, res) => {
    const session = data.sessions.find(s => String(s.id) === String(req.params.id));
    if (!session) return res.status(404).json({ error: 'Not found' });

    const seat = data.seats.find(s => String(s.session_id) === String(req.params.id) && String(s.user_id) === String(req.user.id));
    if (!seat) return res.status(403).json({ error: 'You have not booked a seat' });

    const now = Math.floor(Date.now() / 1000);
    if (session.pdf_at && now < session.pdf_at) {
        return res.status(403).json({ error: 'PDF not yet available', available_at: session.pdf_at });
    }

    // Use parseInt for reliable matching between URL string and DB number
    const targetId = parseInt(req.params.id);
    const questions = (data.questions || []).filter(q => parseInt(q.session_id) === targetId);

    console.log(`📄 PDF GEN LOG: SessionID=${targetId}, QuestionsFound=${questions.length}`);

    if (questions.length === 0) {
        console.warn(`🛑 PDF GEN FAIL: No questions in DB for session ${targetId}`);
        return res.status(404).json({ error: 'No questions found for this session in database.' });
    }

    const PDFDocument = require('pdfkit');
    const user = (data.users || []).find(u => parseInt(u.id) === parseInt(req.user.id));
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
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#1e293b').text('📘 QuizPro Study Material', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(16).fillColor('#475569').text(session.title, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#94a3b8').text(`Participant: ${user?.name || user?.mobile || 'Student'}`, { align: 'center' });
    doc.text(`User ID: ${req.user.id}  |  Session ID: ${session.id}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(11).fillColor('#64748b').text('THIS DOCUMENT CONTAINS ALL QUESTIONS AND CORRECT ANSWERS.', { align: 'center' });
    doc.moveDown(0.5);
    doc.text('SHARING OR DISTRIBUTION IS PROHIBITED.', { align: 'center' });
    doc.moveDown(2);

    // ── Questions ────────────────────────────────────────────────────────────
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    questions.forEach((q, i) => {
        // Page break if needed
        if (doc.y > 600) doc.addPage();

        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13)
            .text(`Q${i + 1}. ${q.question_text}`);
        doc.moveDown(0.3);

        const opts = [
            { key: 'a', text: q.option_a || '---' },
            { key: 'b', text: q.option_b || '---' },
            { key: 'c', text: q.option_c || '---' },
            { key: 'd', text: q.option_d || '---' }
        ];
        shuffleArray(opts);

        let correctLabel = '';
        let correctVal = '';
        opts.forEach((opt, idx) => {
            const label = String.fromCharCode(65 + idx);
            if (opt.key === (q.correct || '').toLowerCase()) {
                correctLabel = label;
                correctVal = opt.text;
            }
            doc.fillColor('#475569').font('Helvetica').fontSize(11)
                .text(`    ${label})  ${opt.text}`);
        });

        doc.moveDown(0.4);
        doc.fillColor('#10b981').font('Helvetica-Bold').fontSize(12)
            .text(`  ✅ Correct Answer: ${correctLabel}) ${correctVal}`);

        if (q.explanation) {
            doc.fillColor('#334155').font('Helvetica').fontSize(10)
                .text(`  💡 Explanation: ${q.explanation}`);
        }

        doc.moveDown(1.5);
    });

    // Footer on last page
    doc.moveDown();
    doc.fontSize(9).fillColor('#94a3b8')
        .text('© QuizPro — Professional Skill-Based Platform. All Rights Reserved.', { align: 'center' });

    doc.end();
});

// SSE
router.get('/:id/events', async (req, res) => {
    const sid = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(sid)) sseClients.set(sid, []);
    sseClients.get(sid).push(res);

    const s = data.sessions.find(x => String(x.id) === String(sid));
    if (s) res.write(`data: ${JSON.stringify({ seats_booked: s.seats_booked, status: s.status })}\n\n`);

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
        const clients = sseClients.get(sid) || [];
        sseClients.set(sid, clients.filter(c => c !== res));
    });
});

router.broadcastSession = (sessionId, update) => {
    const clients = sseClients.get(String(sessionId)) || [];
    clients.forEach(c => c.write(`data: ${JSON.stringify(update)}\n\n`));
};

module.exports = router;
