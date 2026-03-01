const { data, save } = require('../database/db');
const { getWallet, addTxn } = require('./wallet_utils');

const DAILY_WITHDRAW_LIMIT = 1;

/**
 * Request a withdrawal with anti-fraud checks
 * @param {Object} params { userId, amount, upi }
 */
function requestWithdrawal({ userId, amount, upi }) {
    const wallet = getWallet(userId);

    // 1. Balance Check (Withdrawal comes from winnings/win_bal)
    if (!wallet || wallet.win_bal < amount) {
        logFraud(userId, "INSUFFICIENT_BALANCE", { requested: amount, balance: wallet.win_bal });
        return { error: "INSUFFICIENT_BALANCE", message: "Aapke paas paryapt winnings nahi hai." };
    }

    // 2. Pending Request Check
    const pending = (data.withdraw_requests || []).find(
        w => String(w.user_id) === String(userId) && w.status === "PENDING"
    );
    if (pending) {
        return { error: "PENDING_EXISTS", message: "Aapka ek withdrawal pehle se pending hai." };
    }

    // 3. Daily Limit Check
    const today = new Date().toDateString();
    const todayCount = (data.withdraw_requests || []).filter(
        w => String(w.user_id) === String(userId) && new Date(w.at * 1000).toDateString() === today
    ).length;

    if (todayCount >= DAILY_WITHDRAW_LIMIT) {
        return { error: "DAILY_LIMIT", message: "Aap din mein sirf ek hi withdrawal kar sakte hain." };
    }

    // 4. Deduct and Lock (Winnings balance deduct hota hai)
    wallet.win_bal -= amount;

    const withdrawId = "WD_" + Date.now();
    if (!data.withdraw_requests) data.withdraw_requests = [];

    data.withdraw_requests.push({
        id: withdrawId,
        user_id: userId,
        amount: amount,
        upi_id: upi,
        status: "PENDING",
        at: Math.floor(Date.now() / 1000)
    });

    // Audit Trail
    addTxn(userId, 'real', 'debit', amount, `🏦 Withdrawal Requested: ${withdrawId} | UPI: ${upi}`);

    save();
    return { success: true };
}

/**
 * Log fraud attempts for admin review
 */
function logFraud(userId, reason, metadata = {}) {
    if (!data.fraud_logs) data.fraud_logs = [];
    data.fraud_logs.push({
        user_id: userId,
        reason: reason,
        metadata: metadata,
        at: Math.floor(Date.now() / 1000)
    });
    save();
}

module.exports = { requestWithdrawal, logFraud };
