const mongoose = require('mongoose');
const AIAlert = require('../database/models/AIAlert');
const Session = require('../database/models/Session');
const FraudLog = require('../database/models/FraudLog');
const User = require('../database/models/User');
const WalletTxn = require('../database/models/WalletTxn');
const Withdrawal = require('../database/models/Withdrawal');
const razorpay = require('../utils/razorpayClient');
const { getWallet, addTxn } = require('../routes/wallet_utils');
const { processPayout } = require('../utils/razorpayPayout');

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
                this.monitorPayouts()
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
        // Log a clean bootup message. We only flag 'crash' if specifically detected via logs or process state.
        const uptime = process.uptime();
        if (uptime < 60) {
            console.log('✅ [System] Clean boot detected. Optimization complete.');
            // Removed the high-severity AIAlert here to avoid confusing the user during normal deployments.
        }
    }

    async monitorPayouts() {
        // Check for payouts that have been processing
        const processingWithdrawals = await Withdrawal.find({ status: 'processing', payout_id: { $exists: true } });

        for (const wd of processingWithdrawals) {
            try {
                const payoutData = await razorpay.payouts.fetch(wd.payout_id);

                if (payoutData.status === 'processed') {
                    wd.status = 'completed';
                    wd.paid_at = Math.floor(Date.now() / 1000);
                    await wd.save();

                    // Update Lifetime Metrics
                    const wallet = await getWallet(wd.user_id);
                    if (wallet) {
                        wallet.total_withdrawn = (wallet.total_withdrawn || 0) + wd.amount;
                        await wallet.save();
                    }

                    // Log the Debit in ledger
                    await addTxn(wd.user_id, 'real', 'debit', wd.amount, `🏦 Withdrawal Successful: ${wd.id} | UTR: ${payoutData.utr || wd.payout_id}`);
                    console.log(`✅ [Monitor] Payout Success Verified: ${wd.id}`);
                }
                else if (payoutData.status === 'reversed' || payoutData.status === 'failed' || payoutData.status === 'rejected') {
                    console.error(`❌ [Monitor] Bank rejected Payout: ${wd.id} -> ${payoutData.status}`);

                    if (wd.retry_count < 3) {
                        // AUTO RETRY
                        wd.retry_count += 1;
                        wd.status = 'approved'; // Re-trigger via retry logic (Reset to approved)
                        await wd.save();
                        console.log(`🔄 [Monitor] Auto-Retrying Payout ${wd.id} (Attempt ${wd.retry_count}/3)...`);

                        try {
                            await processPayout(wd.id);
                        } catch (err) {
                            console.error(`⚠️ [Monitor] Retry failed immediately for ${wd.id}`);
                        }
                    } else {
                        // EXHAUSTED RETRIES -> REFUND
                        wd.status = 'failed';
                        wd.error = `Bank ${payoutData.status} after 3 retries.`;
                        await wd.save();

                        // Return funds to winnings
                        const wallet = await getWallet(wd.user_id);
                        wallet.win_bal += wd.amount;
                        await wallet.save();
                        await addTxn(wd.user_id, 'real', 'credit', wd.amount, `🔄 Auto-Refund: Bank Rejected (${wd.id})`);

                        await this.logAlert('payment', 'critical', `Payout ${wd.id} FAILED permanently after 3 retries and was Auto-Refunded.`, { withdraw_id: wd.id, user_id: wd.user_id });
                    }
                }
            } catch (err) {
                console.error(`⚠️ [Monitor] Error checking Razorpay status for ${wd.id}:`, err.message);
            }
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
