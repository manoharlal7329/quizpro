const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Check Header first, then Query Param (for direct PDF links)
    const auth = req.headers.authorization;
    let token = '';

    if (auth && auth.startsWith('Bearer ')) {
        token = auth.slice(7);
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
