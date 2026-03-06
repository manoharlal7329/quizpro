require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

async function discover() {
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const results = { timestamp: new Date().toISOString() };

    try {
        console.log('Fetching accounts...');
        const res = await axios.get('https://api.razorpay.com/v1/payouts/accounts', {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        results.accounts = res.data;
    } catch (e) {
        results.accounts_error = e.response?.data || e.message;
    }

    try {
        console.log('Fetching payouts...');
        const res = await axios.get('https://api.razorpay.com/v1/payouts', {
            headers: { 'Authorization': `Basic ${auth}` },
            params: { count: 1 }
        });
        results.payouts = res.data;
    } catch (e) {
        results.payouts_error = e.response?.data || e.message;
    }

    fs.writeFileSync('account_discovery.json', JSON.stringify(results, null, 2));
    console.log('Results written to account_discovery.json');
}

discover();
