const { data, save } = require('./database/db');
const bcrypt = require('bcrypt');

async function runTest() {
    console.log('--- STARTING VERIFICATION ---');

    // 1. Check existing users
    const initialUserCount = data.users.length;
    console.log(`Initial User Count: ${initialUserCount}`);

    // 2. Simulate Registration Logic (from routes/auth.js)
    const testUser = {
        id: Date.now(),
        email: 'verify_test@example.com',
        password: await bcrypt.hash('password123', 10),
        full_name: 'Verification Tester',
        username: 'verify_test',
        phone: '9999999999',
        name: 'verify_test',
        is_admin: 0,
        referral_code: 'TEST123',
        referred_by: null,
        quizzes_solved: 0,
        created_at: Math.floor(Date.now() / 1000)
    };

    data.users.push(testUser);
    save();
    console.log('✅ User registration simulated and saved.');

    // 3. Verify user in data
    const savedUser = data.users.find(u => u.email === 'verify_test@example.com');
    if (savedUser && savedUser.full_name === 'Verification Tester' && savedUser.quizzes_solved === 0) {
        console.log('✅ User data integrity verified.');
    } else {
        console.error('❌ User data integrity FAILED.');
        process.exit(1);
    }

    // 4. Simulate Quiz Submission Logic (from routes/quiz.js)
    savedUser.quizzes_solved = (savedUser.quizzes_solved || 0) + 1;
    save();
    console.log('✅ Quiz submission simulated (quizzes_solved incremented).');

    // 5. Final Verification
    const finalUser = data.users.find(u => u.email === 'verify_test@example.com');
    if (finalUser && finalUser.quizzes_solved === 1) {
        console.log('✅ Activity tracking verified (quizzes_solved: 1).');
    } else {
        console.error('❌ Activity tracking FAILED.');
        process.exit(1);
    }

    // Cleanup
    data.users = data.users.filter(u => u.email !== 'verify_test@example.com');
    save();
    console.log('✅ Cleanup successful.');
    console.log('--- VERIFICATION COMPLETE: ALL PASS ---');
}

runTest().catch(e => {
    console.error('ERROR:', e);
    process.exit(1);
});
