const PlatformConfig = require('./models/PlatformConfig');

let cache = {};
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function getConfig(key, defaultValue = null) {
    const now = Date.now();
    if (cache[key] !== undefined && (now - lastFetch < CACHE_TTL)) {
        return cache[key];
    }

    try {
        const config = await PlatformConfig.findOne({ key }).lean();
        if (config) {
            cache[key] = config.value;
        } else {
            cache[key] = defaultValue;
        }
        lastFetch = now;
        return cache[key];
    } catch (e) {
        return defaultValue;
    }
}

module.exports = { getConfig };
