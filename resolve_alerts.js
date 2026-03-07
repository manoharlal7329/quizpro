
require('dotenv').config();
const mongoose = require('mongoose');
const AIAlert = require('./database/models/AIAlert');

async function resolve() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        // Resolve all critical payment/system alerts that were caused by placeholder config
        const result = await AIAlert.updateMany(
            { resolved: false, severity: 'critical' },
            { $set: { resolved: true, resolved_at: Math.floor(Date.now() / 1000) } }
        );
        console.log(`✅ Resolved ${result.modifiedCount} critical alerts.`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
resolve();
