const { data, save } = require('../database/db');

function getWallet(userId) {
    if (!data.wallets) data.wallets = [];
    let w = data.wallets.find(w => String(w.user_id) === String(userId));
    if (!w) {
        w = {
            user_id: userId,
            demo: 1000,
            dep_bal: 0, // 💸 Deposited (Locked for withdrawal)
            win_bal: 0,  // 🏆 Winnings (Withdrawable)
            pin: null   // 🔐 4-Digit Security PIN
        };
        data.wallets.push(w);
    }
    // Backward compatibility / Migration
    if (w.real !== undefined) {
        w.win_bal = (w.win_bal || 0) + w.real;
        delete w.real;
    }
    if (w.dep_bal === undefined) w.dep_bal = 0;
    if (w.win_bal === undefined) w.win_bal = 0;
    if (w.pin === undefined) w.pin = null;

    return w;
}

function addTxn(userId, wallet, type, amount, note) {
    if (!data.wallet_txns) data.wallet_txns = [];
    data.wallet_txns.push({
        id: Date.now() + Math.floor(Math.random() * 999),
        user_id: userId,
        wallet,       // 'demo' or 'real'
        type,         // 'credit' or 'debit'
        amount,
        note,
        at: Math.floor(Date.now() / 1000)
    });
}

function isDuplicatePayment(paymentId) {
    if (!paymentId) return false;
    const txns = data.wallet_txns || [];
    const seats = data.seats || [];
    const isTxnDup = txns.some(t => t.payment_id === paymentId);
    const isSeatDup = seats.some(s => s.payment_id === paymentId);
    return isTxnDup || isSeatDup;
}

function creditWallet(userId, amount, paymentId, source = "razorpay") {
    // 🛡️ ANTI-FRAUD DUPLICATE CHECK
    if (isDuplicatePayment(paymentId)) {
        if (!data.fraud_logs) data.fraud_logs = [];
        data.fraud_logs.push({
            type: "DUPLICATE_PAYMENT",
            payment_id: paymentId,
            user_id: userId,
            amount: amount,
            at: Math.floor(Date.now() / 1000)
        });
        save();
        console.error(`🚨 [FRAUD] Duplicate payment blocked: ${paymentId} for User ${userId}`);
        return false;
    }

    const wallet = getWallet(userId);
    const totalAmount = Number(amount);

    // 🏗️ PLATFORM EARNING AUTO-CUT (Default 25%)
    const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT || 25);
    const fee = Math.floor((totalAmount * platformFeePercent) / 100);
    const creditAmount = totalAmount - fee;

    wallet.dep_bal += creditAmount;

    // 📝 FULL AUDIT TRAIL
    addTxn(userId, 'real', 'credit', creditAmount, `💰 Deposit (ID: ${paymentId}) | Fee Cut: ₹${fee}`);

    // Track platform earning separately if needed, but for now txn is enough
    save();
    return true;
}

module.exports = { getWallet, addTxn, creditWallet, isDuplicatePayment };
