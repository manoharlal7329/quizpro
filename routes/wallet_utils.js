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

module.exports = { getWallet, addTxn };
