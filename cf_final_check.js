const fs = require('fs');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

try {
    const cf = new Cashfree();
    const info = {
        has_XClientId: 'XClientId' in cf,
        has_PGCreateOrder: typeof cf.PGCreateOrder === 'function',
        has_PGOrderFetchPayments: typeof cf.PGOrderFetchPayments === 'function',
        env_sandbox: CFEnvironment.SANDBOX,
        env_production: CFEnvironment.PRODUCTION
    };
    fs.writeFileSync('cf_final_check.json', JSON.stringify(info, null, 2));
} catch (e) {
    fs.writeFileSync('cf_final_check.json', JSON.stringify({ error: e.message }, null, 2));
}
