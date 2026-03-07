
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./database/models/User');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({}).limit(20).lean();
        console.log('--- USERS ---');
        users.forEach(u => {
            console.log(`ID: ${u.id} | Name: ${u.full_name || u.name} | Username: ${u.username}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
check();
