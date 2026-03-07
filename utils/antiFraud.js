module.exports = {
    canDeposit(wallet) {
        if (!wallet || !wallet.last_deposit_at) return true;
        const diff = Date.now() - new Date(wallet.last_deposit_at).getTime();
        return diff > 60 * 1000; // 1 minute gap
    },

    canWithdraw(wallet) {
        if (!wallet || !wallet.last_withdraw_at) return true;
        const diff = Date.now() - new Date(wallet.last_withdraw_at).getTime();
        return diff > 1 * 60 * 1000; // 1 minute gap
    }
};
