const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const auth = req.headers.authorization;
    let token = '';

    if (auth && auth.startsWith('Bearer ')) {
        token = auth.slice(7);
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Token missing.' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('[AUTH ERROR] JWT_SECRET is not defined in environment variables.');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`[AUTH] JWT verified successfully for ID: ${decoded.id}`);
        req.user = decoded;
        next();
    } catch (err) {
        console.warn(`[AUTH] Invalid token attempt: ${err.message}`);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
