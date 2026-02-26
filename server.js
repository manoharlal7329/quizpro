require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Webhook-Signature', 'X-Webhook-Timestamp']
}));
app.use(express.json());

// ─── STATIC FILES — HTML pages must NOT be cached ─────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            // Always serve fresh HTML — fixes "loading stuck" on page switch
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// REQUEST LOGGING (DEBUG)
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/results', require('./routes/results'));
app.use('/api/admin-auth', require('./routes/adminAuth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/cashfree', require('./routes/cashfree'));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── LEGAL PAGES (Play Store required URLs) ──────────────────────────────────
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
app.get('/refund', (req, res) => res.sendFile(path.join(__dirname, 'public', 'refund.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact.html')));
app.get('/pitch', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pitch.html')));

// ─── SEO FILES (Google Search Console) ──────────────────────────────────────
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sitemap.xml')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'public', 'robots.txt')));

// NOTE: No catch-all app.get('*') here — it was intercepting .html pages!
// express.static() already handles all public/*.html files correctly.

// ─── SERVER START ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 9988;
const server = app.listen(PORT, '0.0.0.0', () => {
    const ip = require('os').networkInterfaces();
    const localIP = Object.values(ip).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
    console.log(`🚀 QuizPro Server running on Port ${PORT}`);
    console.log(`🌍 Production URL: https://quizpro-takb.onrender.com`);
    console.log(`🔥 Cashfree ENV: ${process.env.CF_ENV}`);
    console.log(`🔥 Payment Gateway: ${process.env.PAYMENT_GATEWAY}`);
    console.log(`🛡️ Simulation Mode: ${process.env.SIMULATION_MODE === 'false' ? 'DISABLED (LIVE)' : 'ENABLED (TEST)'}`);
    console.log(`🔥 Cashfree Client ID present: ${!!process.env.CF_CLIENT_ID}`);
    console.log(`🔥 Cashfree Secret present: ${!!process.env.CF_SECRET_KEY}`);
    console.log(`🛡️ JWT_SECRET present: ${!!process.env.JWT_SECRET}`);
    console.log(`🔗 Webhook: Listening at /api/cashfree/webhook\n`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`❌ PORT ${PORT} busy. Run: Get-Process -Name node | Stop-Process -Force`);
    } else {
        console.error('❌ Server Error:', e.message);
    }
    process.exit(1);
});

// ─── Error handlers — log but DON'T crash the server ────────────────────────
process.on('uncaughtException', (e) => {
    console.error('⚠️  Uncaught Exception (server still running):', e.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️  Unhandled Rejection (server still running):', reason?.message || reason);
});

module.exports = server;
