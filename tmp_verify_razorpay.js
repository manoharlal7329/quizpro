require('dotenv').config();
const Razorpay = require('razorpay');

async function test() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    const account_number = process.env.RAZORPAY_PAYOUT_ACCOUNT;

    console.log('--- Razorpay X Config Check ---');
    console.log('Key ID:', key_id ? 'SET' : 'MISSING');
    console.log('Key Secret:', key_secret ? 'SET' : 'MISSING');
    console.log('Account Number:', account_number || 'MISSING');

    if (!key_id || !key_secret || !account_number) {
        console.error('❌ Missing configuration in .env');
        process.exit(1);
    }

    const rzp = new Razorpay({ key_id, key_secret });

    try {
        console.log('\n--- Fetching Account Details (Balances) ---');
        // Note: Razorpay X balance fetch is often hidden or requires specific permissions
        // We'll try to fetch fund accounts or payouts to verify connectivity
        const fundAccounts = await rzp.fundAccounts.all();
        console.log('✅ Connectivity Success: Successfully fetched Fund Accounts list.');
        console.log('Total Fund Accounts found:', fundAccounts.items ? fundAccounts.items.length : 0);

        // Attempt to fetch balance if it's a newer SDK version support
        // Or via axios directly if needed.
        console.log('\n--- Payout Config Verification ---');
        if (!/^\d{14}$/.test(account_number)) {
            console.warn('⚠️ WARNING: RAZORPAY_PAYOUT_ACCOUNT should usually be a 14-digit number. Current:', account_number);
        } else {
            console.log('✅ Payout Account ID format looks correct (14 digits).');
        }

    } catch (err) {
        console.error('❌ Razorpay API Error:', err.message);
        if (err.description) console.error('Description:', err.description);
    }
}

test();
