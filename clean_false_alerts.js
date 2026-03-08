
require('dotenv').config();
const mongoose = require('mongoose');
const AIAlert = require('./database/models/AIAlert');

async function cleanAlerts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const result = await AIAlert.deleteMany({
            type: 'crash',
            message: 'System successfully recovered from a sudden restart/crash.'
        });
        console.log(`✅ Deleted ${result.deletedCount} false positive crash alerts.`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
cleanAlerts();
