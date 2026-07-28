const mongoose = require('mongoose');
const Session = require('./database/models/Session');
const Seat = require('./database/models/Seat');
const User = require('./database/models/User');

require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://quizuser:quizuser%402005@cluster0.nuxswgz.mongodb.net/QuizPro_Winner?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to DB');

        // Delete any previous fake session
        await Session.deleteMany({ title: 'Special Demo Quiz (19/20 Booked)' });
        console.log('Deleted old fake sessions');

        const session = new Session({
            id: Date.now(),
            category_id: 1, // GK
            title: 'Special Demo Quiz (19/20 Booked)',
            seat_limit: 20,
            seats_booked: 19,
            entry_fee: 10,
            quiz_delay_minutes: 5,
            status: 'open',
            is_hidden: false
        });
        
        await session.save();
        console.log('Created fake session ID:', session.id);

        // Add 19 fake seats
        const seats = [];
        for (let i = 1; i <= 19; i++) {
            seats.push({
                session_id: session.id,
                user_id: 1000 + i, // Fake user IDs
                status: 'active',
                payment_id: 'fake_pay_' + i
            });
        }
        await Seat.insertMany(seats);
        console.log('Added 19 fake seats.');

        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
