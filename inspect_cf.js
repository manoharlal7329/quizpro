const CF = require('cashfree-pg');
console.log('Keys:', Object.keys(CF));
if (CF.Cashfree) {
    console.log('Cashfree Keys:', Object.keys(CF.Cashfree));
}
