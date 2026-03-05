const Withdrawal = require('../database/models/Withdrawal');
const FraudLog = require('../database/models/FraudLog');
const { getWallet, addTxn } = require('./wallet_utils');
const antiFraud = require('../utils/antiFraud');

const DAILY_WITHDRAW_LIMIT = 1;

/**
 * Request a withdrawal with anti-fraud checks
 * @param {Object} params { userId, amount, upi }
 */
async function requestWithdrawal({ userId, amount, payment_mode, upi, bank_account_number, bank_ifsc, bank_account_name }) {
    try {
        const wallet = await getWallet(userId);

        // 1. Balance Check (total real = dep_bal + win_bal)
        const totalReal = (wallet.dep_bal || 0) + (wallet.win_bal || 0);
        if (!wallet || totalReal < amount) {
            await logFraud(userId, "INSUFFICIENT_BALANCE", { requested: amount, balance: totalReal });
            return { error: "INSUFFICIENT_BALANCE", message: `Insufficient balance. Available: ₹${totalReal}` };
        }

        // 🛡️ ANTI-FRAUD RATE LIMIT (Pro Level)
        if (!antiFraud.canWithdraw(wallet)) {
            await logFraud(userId, "RAPID_WITHDRAW", { amount, upi });
            return { error: "RATE_LIMIT", message: "Kripya apne agle withdrawal ke liye thoda intezar karein (5 min)." };
        }

        // 2. Pending/Processing Request Check
        const pending = await Withdrawal.findOne({ user_id: Number(userId), status: { $in: ["PENDING", "REQUESTED", "PROCESSING"] } });
        if (pending) {
            return { error: "PENDING_EXISTS", message: "Aapka ek withdrawal pehle se processing mein hai." };
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

        // 4. Deduct from dep_bal first, then win_bal
        let remaining = amount;
        if (wallet.dep_bal >= remaining) {
            wallet.dep_bal -= remaining;
        } else {
            remaining -= wallet.dep_bal;
            wallet.dep_bal = 0;
            wallet.win_bal -= remaining;
        }
        wallet.last_withdraw_at = new Date();
        await wallet.save();

        const withdrawId = "WD_" + Date.now();
        const wdData = {
            id: withdrawId,
            user_id: Number(userId),
            amount: amount,
            status: "REQUESTED",
            at: Math.floor(Date.now() / 1000),
            payment_mode: payment_mode || 'UPI'
        };
        if (payment_mode === 'UPI') {
            wdData.upi = upi;
        } else if (payment_mode === 'BANK') {
            wdData.bank_account_number = bank_account_number;
            wdData.bank_ifsc = bank_ifsc;
            wdData.bank_account_name = bank_account_name;
        }
        const wd = new Withdrawal(wdData);
        await wd.save();

        // 5. NO AUDIT TRAIL YET. We only debit the ledger when the Bank returns SUCCESS.
        // We log it only for internal tracing.
        console.log(`🔒 [Withdrawal] Locked ₹${amount} for ${withdrawId}. Status: REQUESTED`);

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
