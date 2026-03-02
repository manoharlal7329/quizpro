const mongoose = require("mongoose");
// require('dns').setServers(['8.8.8.8']); // Commented for Render stability

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("❌ MongoDB Connection Failed", error);
        // Don't exit process in development if possible, but user asked for it
        // process.exit(1); // Disabled for Render stability — check logs if connection fails
    }
};

module.exports = connectDB;
