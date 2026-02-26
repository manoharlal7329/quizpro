const fs = require('fs');
try {
    const CF_PKG = require('cashfree-pg');
    const output = {
        keys: Object.keys(CF_PKG),
        Cashfree_keys: CF_PKG.Cashfree ? Object.keys(CF_PKG.Cashfree) : 'NOT FOUND'
    };
    fs.writeFileSync('cf_debug.json', JSON.stringify(output, null, 2));
} catch (e) {
    fs.writeFileSync('cf_debug.json', JSON.stringify({ error: e.message, stack: e.stack }, null, 2));
}
