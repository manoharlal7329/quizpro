const CF_PKG = require('cashfree-pg');
const { Cashfree } = CF_PKG;

console.log('Package Keys:', Object.keys(CF_PKG));
console.log('Cashfree Keys:', Object.keys(Cashfree || {}));

const cf = new Cashfree();
console.log('Instance Keys:', Object.keys(cf));
console.log('Instance Prototype Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(cf)));

if (Cashfree.Environment) {
    console.log('Environment Keys:', Object.keys(Cashfree.Environment));
} else if (CF_PKG.CFEnvironment) {
    console.log('CFEnvironment Keys:', Object.keys(CF_PKG.CFEnvironment));
}
