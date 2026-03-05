const mongoose = require('mongoose');
const AIAlert = require('../database/models/AIAlert');
const Session = require('../database/models/Session');
const FraudLog = require('../database/models/FraudLog');
const User = require('../database/models/User');
const WalletTxn = require('../database/models/WalletTxn');

class AutoAdminService {
    constructor() {
        this.intervalTime = 60 * 1000; // 60 seconds
        this.timer = null;
        this.lastCheckedTime = Math.floor(Date.now() / 1000) - 60;
    }

    start() {
        if (this.timer) return;
        console.log('🤖 AI Auto Admin monitoring service STARTED.');
        this.detectServerCrash();
        this.timer = setInterval(() => this.scanSystem(), this.intervalTime);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('🤖 AI Auto Admin monitoring service STOPPED.');
        }
    }

    async scanSystem() {
        const now = Math.floor(Date.now() / 1000);
        try {
            await Promise.all([
                this.detectCheating(now),
                this.detectPaymentAnomalies(now),
                // Bot detection can be added here
            ]);
            this.lastCheckedTime = now;
        } catch (error) {
            console.error('🤖 AI Auto Admin cycle error:', error);
            await this.logAlert('system', 'critical', `Auto Admin Scanner crashed: ${error.message}`);
        }
    }

    async detectCheating(now) {
        // Find recently completed sessions in the last interval
        const recentSessions = await Session.find({
            status: 'completed',
            quiz_end_at: { $gte: this.lastCheckedTime, $lte: now }
        }).lean();

        for (const session of recentSessions) {
            // Note: Since leaderboard logic lives in another file and uses db.js,
            // the AI Admin could directly scan the raw responses if a model existed.
            // For now, if we detect any session completing abnormally fast without questions,
            // we flag it. (QuizPro uses a file structure that makes direct answer scanning here complex without Score/Answers model).

            // Abstract cheating check placeholder for Phase 8.1
            if (session.seats_booked === session.seat_limit && session.title.includes('Test Cheat')) {
                await this.logAlert('cheating', 'high', `Possible cheat bot ring detected in Session ${session.id}`, { session_id: session.id });
            }
        }
    }

    async detectPaymentAnomalies(now) {
        // Check for sudden spikes in FraudLogs within the last 5 minutes
        const fraudSpikeTime = now - (5 * 60);
        const recentFrauds = await FraudLog.countDocuments({ at: { $gte: fraudSpikeTime } });

        if (recentFrauds > 5) { // Threshold: 5 frauds in 5 mins
            // Prevent duplicate alerts
            const hasAlert = await AIAlert.findOne({ type: 'payment', resolved: false, created_at: { $gte: fraudSpikeTime } });
            if (!hasAlert) {
                await this.logAlert('payment', 'critical', `CRITICAL PAYMENT ANOMALY: ${recentFrauds} fraud logs in the last 5 minutes. Check Razorpay integration and Webhooks immediately!`);
            }
        }
    }

    async detectServerCrash() {
        // If the server starts and the DB is connected, we check if the last alert was a crash.
        // We log a bootup message. If uptime is < 2min upon start, it implies a restart.
        const uptime = process.uptime();
        if (uptime < 60) {
            await this.logAlert('crash', 'high', 'System successfully recovered from a sudden restart/crash.', { uptime_seconds: uptime });
        }
    }

    async logAlert(type, severity, message, details = {}) {
        try {
            const alert = new AIAlert({ type, severity, message, details });
            await alert.save();
            console.log(`[🤖 AI ADMIN ALERT] ${severity.toUpperCase()} (${type}): ${message}`);
        } catch (e) {
            console.error('Failed to save AI Alert:', e);
        }
    }
}

module.exports = new AutoAdminService();
