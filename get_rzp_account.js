require('dotenv').config();
const axios = require('axios');

async function testVerify() {
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const payoutAccount = process.env.RAZORPAY_PAYOUT_ACCOUNT;

    console.log(`Using Key: ${key}`);
    console.log(`Using Payout Account: ${payoutAccount}`);

    const payload = {
        account_number: payoutAccount,
        fund_account: {
            account_type: 'bank_account',
            bank_account: {
                name: "Test User",
                ifsc: "PUNB0964100",
                account_number: "9641000100032215"
            }
        },
        amount: 100,
        currency: 'INR'
    };

    try {
        const response = await axios.post('https://api.razorpay.com/v1/fund_account_validations', payload, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        console.log('SUCCESS:', response.data);
    } catch (err) {
        console.log('ERROR:', JSON.stringify(err.response?.data || err.message, null, 2));
    }
}

testVerify();
