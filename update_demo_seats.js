require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const Session = require('./database/models/Session');

async function updateDemoSeats() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error("MONGODB_URI missing!");
            process.exit(1);
        }
        await mongoose.connect(uri);
        console.log("Connected to MongoDB.");

        const demoSessions = await Session.find({ is_demo: true, cloned_from: null });
        let updatedCount = 0;
        
        for (const session of demoSessions) {
            session.seats_booked = session.seat_limit - 1;
            await session.save();
            updatedCount++;
        }

        console.log(`Successfully updated ${updatedCount} demo sessions.`);
        process.exit(0);
    } catch (error) {
        console.error("Error updating demo sessions:", error);
        process.exit(1);
    }
}

updateDemoSeats();
