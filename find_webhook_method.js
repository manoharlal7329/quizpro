const { Cashfree } = require('cashfree-pg');
const cf = new Cashfree();
console.log('--- Instance Methods ---');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(cf)).filter(m => m.toLowerCase().includes('webhook') || m.toLowerCase().includes('verify')));
console.log('--- static Methods ---');
console.log(Object.getOwnPropertyNames(Cashfree).filter(m => m.toLowerCase().includes('webhook') || m.toLowerCase().includes('verify')));
