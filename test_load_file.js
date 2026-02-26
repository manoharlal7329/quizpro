const fs = require('fs');
let log = 'Testing module load...\n';
try {
    const cf = require('cashfree-pg');
    log += 'Load SUCCESS\n';
    log += 'Keys: ' + Object.keys(cf).join(', ') + '\n';
    if (cf.Cashfree) {
        log += 'Cashfree exists\n';
        const instance = new cf.Cashfree();
        const proto = Object.getPrototypeOf(instance);
        log += 'Instance methods: ' + Object.getOwnPropertyNames(proto).join(', ') + '\n';
    }
} catch (e) {
    log += 'FAILED TO LOAD: ' + e.message + '\n';
}
fs.writeFileSync('test_load.txt', log);
console.log('Done');
