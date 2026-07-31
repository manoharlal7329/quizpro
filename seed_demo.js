require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const Session = require('./database/models/Session');
const Question = require('./database/models/Question');

async function seedDemoSessions() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error("MONGODB_URI missing!");
            process.exit(1);
        }
        await mongoose.connect(uri);
        console.log("Connected to MongoDB.");

        const existingDemos = await Session.countDocuments({ is_demo: true, cloned_from: null });
        if (existingDemos >= 20) {
            console.log("Demo sessions already exist. Exiting.");
            process.exit(0);
        }

        const fees = [50, 100, 200, 250, 500];
        const limits = [20, 50, 100, 200, 300, 500, 1000];

        let createdCount = 0;
        let feeIndex = 0;
        let limitIndex = 0;
        
        // Let's create some dummy questions that can be assigned to the demo sessions
        const sampleQuestions = [
            { question_text: "What is 2 + 2?", option_a: "3", option_b: "4", option_c: "5", option_d: "6", correct: "b", explanation: "Basic math." },
            { question_text: "Capital of France?", option_a: "Paris", option_b: "London", option_c: "Berlin", option_d: "Madrid", correct: "a", explanation: "Geography." },
            { question_text: "Color of the sky?", option_a: "Green", option_b: "Blue", option_c: "Red", option_d: "Yellow", correct: "b", explanation: "Common knowledge." },
            { question_text: "Number of days in a week?", option_a: "5", option_b: "6", option_c: "7", option_d: "8", correct: "c", explanation: "Calendar." },
            { question_text: "Which is a vowel?", option_a: "B", option_b: "C", option_c: "A", option_d: "D", correct: "c", explanation: "Alphabet." }
        ];

        while (createdCount < (20 - existingDemos)) {
            const entryFee = fees[feeIndex % fees.length];
            const seatLimit = limits[limitIndex % limits.length];
            
            const sid = Date.now() + createdCount;
            const session = new Session({
                id: sid,
                category_id: 1, // Category ID 1 (Assuming general category)
                title: `Demo Quiz (Fee: ₹${entryFee})`,
                seat_limit: seatLimit,
                entry_fee: entryFee,
                quiz_delay_minutes: 60,
                status: 'open',
                is_demo: true,
                seats_booked: seatLimit - 1
            });
            await session.save();

            // Insert questions for this demo session
            for (let i = 0; i < sampleQuestions.length; i++) {
                const q = new Question({
                    id: Date.now() + createdCount * 10 + i,
                    session_id: sid,
                    ...sampleQuestions[i]
                });
                await q.save();
            }

            createdCount++;
            feeIndex++;
            limitIndex++;
        }

        console.log(`Successfully created ${createdCount} demo sessions with questions.`);
        process.exit(0);
    } catch (error) {
        console.error("Error seeding demo sessions:", error);
        process.exit(1);
    }
}

seedDemoSessions();
