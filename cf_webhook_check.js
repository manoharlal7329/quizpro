const fs = require('fs');
const { Cashfree } = require('cashfree-pg');

try {
    const cf = new Cashfree();
    const proto = Object.getPrototypeOf(cf);
    const methods = Object.getOwnPropertyNames(proto);
    const webhookMethods = methods.filter(m => m.toLowerCase().includes('webhook') || m.toLowerCase().includes('verify'));

    fs.writeFileSync('cf_webhook_check.json', JSON.stringify({
        webhookMethods,
        // Also check if it's a static method on Cashfree
        staticMethods: Object.getOwnPropertyNames(Cashfree).filter(m => m.toLowerCase().includes('verify'))
    }, null, 2));
} catch (e) {
    fs.writeFileSync('cf_webhook_check.json', JSON.stringify({ error: e.message }, null, 2));
}
