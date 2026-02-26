console.log('Testing module load...');
try {
    const cf = require('cashfree-pg');
    console.log('Load SUCCESS');
    console.log('Keys:', Object.keys(cf));
} catch (e) {
    console.error('FAILED TO LOAD:', e.message);
}
