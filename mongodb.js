const mongoose = require("mongoose");
mongoose.set('bufferCommands', false); // Fail fast if not connected
require('dns').setServers(['8.8.8.8']); // Fixes ECONNREFUSED for MongoDB Atlas

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error("\n❌ ERROR: MONGODB_URI is not set!");
        console.error("👉 Please add it to Render -> Environment tab.");
        return;
    }

    try {
        console.log("🔄 Connecting to MongoDB...");
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });
        console.log(`✅ MongoDB Atlas Connected.`);
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error.message);
        console.error("👉 Fix: Add 0.0.0.0/0 to MongoDB Atlas Network Access.");
    }
};

module.exports = connectDB;
