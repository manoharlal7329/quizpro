const Withdrawal = require('../database/models/Withdrawal');
const { getWallet, addTxn } = require('../routes/wallet_utils');
const razorpay = require('./razorpayClient');

/**
 * Process a Razorpay X Payout for a withdrawal request
 * @param {string} withdrawId 
 */
async function processPayout(withdrawId) {
    const wd = await Withdrawal.findOne({ id: withdrawId });

    if (!wd || wd.status !== "REQUESTED") {
        throw new Error("INVALID_WITHDRAW: Request not found or not in REQUESTED state.");
    }

    try {
        if (wd.payment_mode === 'REFUND') {
            console.log(`🔄 [Refund] Initiating refund for WD: ${withdrawId} | PaymentID: ${wd.original_payment_id}`);
            const refund = await razorpay.payments.refund(wd.original_payment_id, {
                amount: wd.amount * 100, // convert to paise
                notes: { withdraw_id: withdrawId, user_id: String(wd.user_id) }
            });

            wd.status = "SUCCESS";
            wd.payout_id = refund.id; // Refund ID
            wd.paid_at = Math.floor(Date.now() / 1000);
            await wd.save();

            // Notify via ledger txn
            await addTxn(wd.user_id, 'real', 'debit', wd.amount, `Withdrawal: Refund to Source (${withdrawId})`);
            console.log(`✅ [Refund] Success: ${withdrawId} | Refund ID: ${refund.id}`);
            return refund;
        }

        const payoutPayload = {
            account_number: process.env.RAZORPAY_PAYOUT_ACCOUNT,
            amount: wd.amount * 100, // convert to paise
            currency: "INR",
            purpose: "payout",
            queue_if_low_balance: true,
            narration: "QuizPro Arena Reward"
        };

        if (wd.payment_mode === 'BANK') {
            payoutPayload.mode = "IMPS";
            payoutPayload.fund_account = {
                account_type: "bank_account",
                bank_account: {
                    name: wd.bank_account_name,
                    ifsc: wd.bank_ifsc,
                    account_number: wd.bank_account_number
                }
            };
        } else {
            payoutPayload.mode = "UPI";
            payoutPayload.fund_account = {
                account_type: "vpa",
                vpa: {
                    address: wd.upi_id || wd.upi
                }
            };
        }

        const payout = await razorpay.payouts.create(payoutPayload);

        // Bank is processing it. We wait for monitorPayouts (AI) to hit SUCCESS.
        wd.status = "PROCESSING";
        wd.payout_id = payout.id;
        await wd.save();

        console.log(`⏳ [Payout] Processing: ${withdrawId} | Mode: ${wd.payment_mode} | Payout ID: ${payout.id}`);
        return payout;

    } catch (err) {
        // Instant Failure -> Refund Locked Amount
        console.error(`❌ [Payout] Immediate Failure: ${withdrawId} | Error: ${err.message}`);

        wd.status = "FAILED";
        wd.error = err.message;
        await wd.save();

        // Unlock funds safely
        try {
            const wallet = await getWallet(wd.user_id);
            wallet.win_bal += wd.amount;
            await wallet.save();
            await addTxn(wd.user_id, 'real', 'credit', wd.amount, `🔄 Auto-Refund: Payout Rejected (${withdrawId})`);
            console.log(`✅ [Refund] Wallet Restored: ₹${wd.amount} for User #${wd.user_id}`);
        } catch (walletErr) {
            console.error(`🚨 CRITICAL REFUND FAILURE for ${withdrawId}:`, walletErr);
        }

        throw err;
    }
}

module.exports = { processPayout };
