const User = require('../database/models/User');
const WalletModel = require('../database/models/Wallet');
const WalletTxnModel = require('../database/models/WalletTxn');
const SeatModel = require('../database/models/Seat');
const FraudLogModel = require('../database/models/FraudLog');
const antiFraud = require('../utils/antiFraud');

async function getWallet(userId) {
    let w = await WalletModel.findOne({ user_id: Number(userId) });
    if (!w) {
        w = new WalletModel({
            user_id: Number(userId),
            demo: 1000,
            dep_bal: 0,
            win_bal: 0,
            pin: null
        });
        await w.save();
    }
    return w;
}

async function addTxn(userId, wallet, type, amount, note, paymentId = null) {
    const txn = new WalletTxnModel({
        id: Date.now() + Math.floor(Math.random() * 999),
        user_id: Number(userId),
        wallet,       // 'demo' or 'real'
        type,         // 'credit' or 'debit'
        amount,
        note,
        payment_id: paymentId,
        at: Math.floor(Date.now() / 1000)
    });
    await txn.save();
    return txn;
}

async function isDuplicatePayment(paymentId) {
    if (!paymentId) return false;
    const txnDup = await WalletTxnModel.findOne({ payment_id: paymentId });
    const seatDup = await SeatModel.findOne({ payment_id: paymentId });
    return !!(txnDup || seatDup);
}

async function creditWallet(userId, amount, paymentId, source = "razorpay") {
    // 🛡️ ANTI-FRAUD DUPLICATE CHECK
    const isDup = await isDuplicatePayment(paymentId);
    if (isDup) {
        const log = new FraudLogModel({
            type: "DUPLICATE_PAYMENT",
            payment_id: paymentId,
            user_id: Number(userId),
            amount: amount,
            at: Math.floor(Date.now() / 1000)
        });
        await log.save();
        console.error(`🚨 [FRAUD] Duplicate payment blocked: ${paymentId} for User ${userId}`);
        return false;
    }

    const wallet = await getWallet(userId);

    // 🛡️ ANTI-FRAUD RATE LIMIT (Pro Level)
    if (!antiFraud.canDeposit(wallet)) {
        console.warn(`🚨 [FRAUD] Rapid deposit blocked for User ${userId}`);
        const log = new FraudLogModel({
            type: "RAPID_DEPOSIT",
            payment_id: paymentId,
            user_id: Number(userId),
            amount: amount,
            at: Math.floor(Date.now() / 1000)
        });
        await log.save();
        return false;
    }

    const totalAmount = Number(amount);

    // 🏗️ PLATFORM EARNING AUTO-CUT (Set to 0% for students - fees taken at session level)
    const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
    const fee = Math.floor((totalAmount * platformFeePercent) / 100);
    const creditAmount = totalAmount - fee;

    wallet.dep_bal += creditAmount;
    wallet.last_deposit_at = new Date();
    await wallet.save();

    // 📝 FULL AUDIT TRAIL
    await addTxn(userId, 'real', 'credit', creditAmount, `💰 Deposit (ID: ${paymentId}) | Fee Cut: ₹${fee}`, paymentId);

    return true;
}

module.exports = { getWallet, addTxn, creditWallet, isDuplicatePayment };

