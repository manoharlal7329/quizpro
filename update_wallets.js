require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const Wallet = require('./database/models/Wallet');

async function updateWallets() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error("MONGODB_URI missing!");
            process.exit(1);
        }
        await mongoose.connect(uri);
        console.log("Connected to MongoDB.");

        const res = await Wallet.updateMany(
            { $or: [{ demo: { $exists: false } }, { demo: { $lt: 10000 } }] },
            { $set: { demo: 10000 } }
        );

        console.log(`Successfully updated ${res.modifiedCount} wallets with 10000 demo coins.`);
        process.exit(0);
    } catch (error) {
        console.error("Error updating wallets:", error);
        process.exit(1);
    }
}

updateWallets();
