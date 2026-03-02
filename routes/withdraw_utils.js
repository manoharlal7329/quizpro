const Withdrawal = require('../database/models/Withdrawal');
const FraudLog = require('../database/models/FraudLog');
const { getWallet, addTxn } = require('./wallet_utils');
const antiFraud = require('../utils/antiFraud');

const DAILY_WITHDRAW_LIMIT = 1;

/**
 * Request a withdrawal with anti-fraud checks
 * @param {Object} params { userId, amount, upi }
 */
async function requestWithdrawal({ userId, amount, upi }) {
    try {
        const wallet = await getWallet(userId);

        // 1. Balance Check
        if (!wallet || (wallet.win_bal || 0) < amount) {
            await logFraud(userId, "INSUFFICIENT_BALANCE", { requested: amount, balance: wallet.win_bal });
            return { error: "INSUFFICIENT_BALANCE", message: "Aapke paas paryapt winnings nahi hai." };
        }

        // 🛡️ ANTI-FRAUD RATE LIMIT (Pro Level)
        if (!antiFraud.canWithdraw(wallet)) {
            await logFraud(userId, "RAPID_WITHDRAW", { amount, upi });
            return { error: "RATE_LIMIT", message: "Kripya apne agle withdrawal ke liye thoda intezar karein (5 min)." };
        }

        // 2. Pending Request Check
        const pending = await Withdrawal.findOne({ user_id: Number(userId), status: "PENDING" });
        if (pending) {
            return { error: "PENDING_EXISTS", message: "Aapka ek withdrawal pehle se pending hai." };
        }

        // 3. Daily Limit Check
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayCount = await Withdrawal.countDocuments({
            user_id: Number(userId),
            at: { $gte: Math.floor(startOfDay.getTime() / 1000) }
        });

        if (todayCount >= DAILY_WITHDRAW_LIMIT) {
            return { error: "DAILY_LIMIT", message: "Aap din mein sirf ek hi withdrawal kar sakte hain." };
        }

        // 4. Deduct and Lock
        wallet.win_bal -= amount;
        wallet.last_withdraw_at = new Date();
        await wallet.save();

        const withdrawId = "WD_" + Date.now();
        const wd = new Withdrawal({
            id: withdrawId,
            user_id: Number(userId),
            amount: amount,
            upi_id: upi,
            status: "PENDING",
            at: Math.floor(Date.now() / 1000)
        });
        await wd.save();

        // Audit Trail
        await addTxn(userId, 'real', 'debit', amount, `🏦 Withdrawal Requested: ${withdrawId} | UPI: ${upi}`);

        return { success: true, withdrawId };
    } catch (e) {
        console.error('Withdrawal Request Error:', e);
        return { error: "SERVER_ERROR", message: "Something went wrong." };
    }
}

/**
 * Log fraud attempts for admin review
 */
async function logFraud(userId, reason, metadata = {}) {
    const log = new FraudLog({
        user_id: Number(userId),
        reason: reason,
        metadata: metadata,
        at: Math.floor(Date.now() / 1000)
    });
    await log.save();
}

module.exports = { requestWithdrawal, logFraud };
