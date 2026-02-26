console.log('--- START FIX CF TEST ---');
require('dotenv').config();
console.log('Dotenv loaded');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
console.log('Cashfree SDK loaded');

const cf = new Cashfree();
console.log('Instance created');
cf.XClientId = process.env.CF_CLIENT_ID || process.env.CASHFREE_APP_ID;
cf.XClientSecret = process.env.CF_SECRET_KEY || process.env.CASHFREE_SECRET_KEY;
cf.XEnvironment = CFEnvironment.SANDBOX;
cf.XApiVersion = "2023-08-01";
console.log('Config set');

async function test() {
    try {
        console.log('Testing PGCreateOrder...');
        const request = {
            "order_amount": 10.00,
            "order_currency": "INR",
            "order_id": "test_fix_" + Date.now(),
            "customer_details": {
                "customer_id": "test_user_1",
                "customer_phone": "9999999999",
                "customer_email": "test@example.com"
            },
            "order_meta": {
                "return_url": "https://example.com"
            }
        };

        console.log('Calling PGCreateOrder...');
        const response = await cf.PGCreateOrder(request);
        console.log('SUCCESS! Order ID:', response.data.order_id);
    } catch (e) {
        console.error('ERROR:', e.response?.data || e.message);
    }
}

test().then(() => console.log('--- END FIX CF TEST ---'));
