const Withdrawal = require('../database/models/Withdrawal');
const FraudLog = require('../database/models/FraudLog');
const { getWallet, addTxn } = require('./wallet_utils');
const antiFraud = require('../utils/antiFraud');

const DAILY_WITHDRAW_LIMIT = 5;

/**
 * Request a withdrawal with anti-fraud checks
 * @param {Object} params { userId, amount, upi }
 */
async function requestWithdrawal({ userId, amount, payment_mode, upi, bank_account_number, bank_ifsc, bank_account_name }) {
    try {
        const wallet = await getWallet(userId);

        // 1. Requirement: Min ₹100, Max ₹10,000
        if (amount < 100 || amount > 10000) {
            return { error: "INVALID_AMOUNT", message: "Withdrawal amount must be between ₹100 and ₹10,000." };
        }

        // 2. Requirement: Only from winnings
        if (!wallet || (wallet.win_bal || 0) < amount) {
            await logFraud(userId, "INSUFFICIENT_WINNINGS", { requested: amount, win_bal: wallet.win_bal });
            return { error: "INSUFFICIENT_WINNINGS", message: `Insufficient winnings. Aap sirf winning balance hi nikal sakte hain. Available: ₹${wallet.win_bal || 0}` };
        }

        // 5. Requirement: Limit maximum withdrawals per day
        const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
        const todayCount = await Withdrawal.countDocuments({
            user_id: Number(userId),
            created_at: { $gte: todayStart },
            status: { $ne: 'rejected' }
        });

        if (todayCount >= DAILY_WITHDRAW_LIMIT) {
            return { error: "DAILY_LIMIT_EXCEEDED", message: `Aap ek din mein sirf ${DAILY_WITHDRAW_LIMIT} withdrawals hi kar sakte hain.` };
        }

        // 🛡️ ANTI-FRAUD RATE LIMIT (5 min between calls)
        if (!antiFraud.canWithdraw(wallet)) {
            await logFraud(userId, "RAPID_WITHDRAW", { amount });
            return { error: "RATE_LIMIT", message: "Kripya agle withdrawal ke liye thoda intezar karein (5 min)." };
        }

        // 3. Requirement: Prevent duplicate requests
        const pending = await Withdrawal.findOne({ user_id: Number(userId), status: { $in: ["pending", "approved", "processing"] } });
        if (pending) {
            return { error: "PENDING_EXISTS", message: "Aapka ek withdrawal pehle se processing ya approval mein hai." };
        }

        // 4. Requirement: Deduct ONLY from win_bal (Locks funds)
        wallet.win_bal -= amount;
        wallet.last_withdraw_at = new Date();
        await wallet.save();

        const withdrawId = "WD_" + Date.now();
        const wdData = {
            id: withdrawId,
            user_id: Number(userId),
            amount: amount,
            status: "pending",
            created_at: Math.floor(Date.now() / 1000),
            payment_mode: payment_mode || 'UPI'
        };
        if (payment_mode === 'UPI') {
            wdData.upi = upi;
        } else if (payment_mode === 'BANK') {
            wdData.bank_account_number = bank_account_number;
            wdData.bank_ifsc = bank_ifsc;
            wdData.bank_account_name = bank_account_name;
        } else if (payment_mode === 'REFUND') {
            wdData.original_payment_id = arguments[0].original_payment_id;
        }
        const wd = new Withdrawal(wdData);
        await wd.save();

        console.log(`🔒 [Withdrawal] Locked ₹${amount} from winnings for ${withdrawId}. Status: pending (Awaiting Admin Approval)`);

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
        type: reason,
        details: metadata,
        amount: metadata.amount || 0,
        at: Math.floor(Date.now() / 1000)
    });
    await log.save();
}

module.exports = { requestWithdrawal, logFraud };
