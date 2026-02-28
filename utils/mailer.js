const nodemailer = require('nodemailer');

// Configure your SMTP settings here or in .env
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendMail(to, subject, text) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP Credentials missing in .env. Email not sent.');
        return;
    }

    const mailOptions = {
        from: `QuizPro Winner <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };
