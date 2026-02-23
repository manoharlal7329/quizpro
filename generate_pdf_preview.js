const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');

// Mock data based on session 120
const session = { title: "World History Pro #20" };
const questions = [
    {
        question_text: "What is the capital of France?",
        option_a: "Paris", option_b: "London", option_c: "Berlin", option_d: "Madrid",
        correct: "a",
        explanation: "Paris is the iconic capital city of France, known for the Eiffel Tower."
    },
    {
        question_text: "Which planet is known as the Red Planet?",
        option_a: "Mars", option_b: "Venus", option_c: "Jupiter", option_d: "Saturn",
        correct: "a",
        explanation: "Mars has a reddish appearance due to iron oxide on its surface."
    }
];

const doc = new PDFDocument({ margin: 50 });
const previewPath = path.join(__dirname, 'Study_Material_Preview.pdf');
const stream = fs.createWriteStream(previewPath);

doc.pipe(stream);

// Header
doc.fontSize(22).fillColor('#1e293b').text('📘 Study Material', { align: 'center' });
doc.fontSize(14).fillColor('#64748b').text(session.title, { align: 'center' });
doc.moveDown(2);

// Watermark (Simulated)
doc.save();
doc.opacity(0.1);
doc.fontSize(60).fillColor('#000').text('CONFIDENTIAL - PAID USER', 50, 400, { rotation: 45 });
doc.restore();

questions.forEach((q, i) => {
    // Question box
    doc.fillColor('#1e293b').fontSize(13).text(`Q${i + 1}. ${q.question_text}`, { bold: true });
    doc.moveDown(0.5);

    // Options
    doc.fillColor('#475569').fontSize(11).text(`  A) ${q.option_a}`);
    doc.text(`  B) ${q.option_b}`);
    doc.text(`  C) ${q.option_c}`);
    doc.text(`  D) ${q.option_d}`);
    doc.moveDown(0.5);

    // Answer & Explanation
    doc.fillColor('#10b981').fontSize(12).text(`  ✅ Correct Answer: ${q.correct.toUpperCase()}`, { bold: true });
    doc.fillColor('#334155').fontSize(10).text(`  💡 Explanation: ${q.explanation}`);

    doc.moveDown(2);
});

// Footer
doc.fontSize(10).fillColor('#94a3b8').text('This document is for registered participants of QuizPro only.', { align: 'center', bottom: 50 });

doc.end();

stream.on('finish', () => {
    console.log(`✅ Sample PDF generated: ${previewPath}`);
});
