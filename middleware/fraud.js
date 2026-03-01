module.exports = (req, res, next) => {
    // 🛡️ ANTI-FRAUD: Block direct external calls to sensitive internal endpoints
    // These endpoints should only be reached via internal logic or verified webhooks
    if (!req.headers["x-quizpro-internal"]) {
        console.warn(`🚨 [SECURITY] Blocked unauthorized internal-only access to: ${req.url}`);
        return res.status(403).json({ error: "Access Blocked: Internal Only" });
    }
    next();
};
