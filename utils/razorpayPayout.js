const Withdrawal = require('../database/models/Withdrawal');
const razorpay = require('./razorpayClient');

/**
 * Process a Razorpay X Payout for a withdrawal request
 * @param {string} withdrawId 
 */
async function processPayout(withdrawId) {
    const wd = await Withdrawal.findOne({ id: withdrawId });

    if (!wd || wd.status !== "PENDING") {
        throw new Error("INVALID_WITHDRAW: Request not found or not pending.");
    }

    try {
        const payout = await razorpay.payouts.create({
            account_number: process.env.RAZORPAY_PAYOUT_ACCOUNT,
            amount: wd.amount * 100, // convert to paise
            currency: "INR",
            mode: "UPI",
            purpose: "payout",
            fund_account: {
                account_type: "vpa",
                vpa: {
                    address: wd.upi_id || wd.upi
                }
            },
            queue_if_low_balance: true,
            narration: "QuizPro Arena Reward"
        });

        wd.status = "PAID";
        wd.payout_id = payout.id;
        wd.paid_at = Math.floor(Date.now() / 1000);
        await wd.save();

        console.log(`✅ [Payout] Successful: ${withdrawId} | Payout ID: ${payout.id}`);
        return payout;

    } catch (err) {
        console.error(`❌ [Payout] Failed: ${withdrawId} | Error: ${err.message}`);
        wd.status = "FAILED";
        wd.error = err.message;
        await wd.save();
        throw err;
    }
}

module.exports = { processPayout };
