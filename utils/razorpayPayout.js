const Razorpay = require('razorpay');
const { data, save } = require('../database/db');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Process a Razorpay X Payout for a withdrawal request
 * @param {string} withdrawId 
 */
async function processPayout(withdrawId) {
    const wd = (data.withdraw_requests || []).find(w => w.id === withdrawId);

    if (!wd || wd.status !== "PENDING") {
        throw new Error("INVALID_WITHDRAW: Request not found or not pending.");
    }

    try {
        // Razorpay X Payouts require account_number (X account)
        const payout = await razorpay.payouts.create({
            account_number: process.env.RAZORPAY_PAYOUT_ACCOUNT,
            amount: wd.amount * 100, // convert to paise
            currency: "INR",
            mode: "UPI",
            purpose: "payout",
            fund_account: {
                account_type: "vpa",
                vpa: {
                    address: wd.upi_id
                }
            },
            queue_if_low_balance: true,
            narration: "QuizPro Arena Reward"
        });

        wd.status = "PAID";
        wd.payout_id = payout.id;
        wd.paid_at = Math.floor(Date.now() / 1000);

        save();
        console.log(`✅ [Payout] Successful: ${withdrawId} | Payout ID: ${payout.id}`);
        return payout;

    } catch (err) {
        console.error(`❌ [Payout] Failed: ${withdrawId} | Error: ${err.message}`);
        // We don't mark as FAILED automatically here maybe, 
        // because it might be a temporary balance issue.
        // But user snippet marks as FAILED.
        wd.status = "FAILED";
        wd.error = err.message;
        save();
        throw err;
    }
}

module.exports = { processPayout };
