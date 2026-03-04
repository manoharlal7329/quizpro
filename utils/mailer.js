const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendMail(to, subject, text) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP Credentials missing. Email not sent.');
        return;
    }
    return transporter.sendMail({
        from: `QuizPro Arena <${process.env.EMAIL_USER}>`,
        to, subject, text
    });
}

async function sendMailHTML(to, subject, html) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP Credentials missing. Email not sent.');
        return;
    }
    return transporter.sendMail({
        from: `QuizPro Arena <${process.env.EMAIL_USER}>`,
        to, subject, html
    });
}

module.exports = { sendMail, sendMailHTML };

