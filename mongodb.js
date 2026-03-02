const mongoose = require("mongoose");
require('dns').setServers(['8.8.8.8']); // Fixes ECONNREFUSED for MongoDB Atlas

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error("\n❌ ERROR: MONGODB_URI is not set in Environment Variables!");
        console.error("👉 Please add it to your Render Dashboard -> Environment tab.");
        console.error("👉 URI should be: mongodb+srv://quizuser:quizuser%402005@cluster0.nuxswgz.mongodb.net/QuizPro_Winner\n");
        return; // Don't exit, let server start so we can see health check but log error
    }

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
        });
        console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error.message);
        console.error("👉 Check if your IP is whitelisted in MongoDB Atlas (Network Access).");
    }
};

module.exports = connectDB;
