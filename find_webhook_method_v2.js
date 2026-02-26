const CF_PKG = require('cashfree-pg');
const { Cashfree } = CF_PKG;
const cf = new Cashfree();

console.log('CF_PKG keys:', Object.keys(CF_PKG));
console.log('Cashfree static keys:', Object.keys(Cashfree));

const proto = Object.getPrototypeOf(cf);
console.log('Instance prototype methods:', Object.getOwnPropertyNames(proto).filter(m => !m.startsWith('_')));
