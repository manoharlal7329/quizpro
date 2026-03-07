
require('dotenv').config();
const mongoose = require('mongoose');
const AIAlert = require('./database/models/AIAlert');
const FraudLog = require('./database/models/FraudLog');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const alerts = await AIAlert.find({ resolved: false }).lean();
        const frauds = await FraudLog.find({}).sort({ at: -1 }).limit(10).lean();
        console.log('--- ALERTS ---');
        console.log(JSON.stringify(alerts, null, 2));
        console.log('--- FRAUDS ---');
        console.log(JSON.stringify(frauds, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
check();
