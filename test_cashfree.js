require('dotenv').config();
const { Cashfree } = require('cashfree-pg');

Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
Cashfree.XEnvironment = process.env.CASHFREE_ENV === 'production' ? Cashfree.Environment.PRODUCTION : Cashfree.Environment.SANDBOX;

async function test() {
    try {
        const request = {
            "order_amount": 10,
            "order_currency": "INR",
            "order_id": "test_" + Date.now(),
            "customer_details": {
                "customer_id": "test_user_1",
                "customer_phone": "9999999999",
                "customer_email": "test@example.com"
            }
        };
        const response = await Cashfree.PGCreateOrder("2023-08-01", request);
        console.log('SUCCESS:', response.data);
    } catch (e) {
        console.error('ERROR:', e.response?.data || e.message);
    }
}

test();
