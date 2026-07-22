require('dotenv').config();
const connectDB = require('../mongodb');
const PlatformConfig = require('../database/models/PlatformConfig');

async function seedUpi() {
    await connectDB();
    await PlatformConfig.findOneAndUpdate(
        { key: 'UPI_ID' },
        { value: 'manoharlala02911-1@okaxis', description: 'Admin UPI ID for deposits', updated_at: Math.floor(Date.now() / 1000) },
        { upsert: true }
    );
    await PlatformConfig.findOneAndUpdate(
        { key: 'UPI_NAME' },
        { value: 'Manohar Lal Prajapat', description: 'Platform Merchant Name for UPI', updated_at: Math.floor(Date.now() / 1000) },
        { upsert: true }
    );
    console.log('✅ UPI Settings Seeded to MongoDB:');
    console.log('UPI ID: manoharlala02911-1@okaxis');
    console.log('UPI Name: Manohar Lal Prajapat');
    process.exit(0);
}

seedUpi();
