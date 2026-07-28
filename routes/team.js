const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../database/models/User');

// GET /api/team/me - Fetch 6 levels of referrals
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const me = await User.findOne({ id: userId });
        
        if (!me || !me.referral_code) {
            return res.json({ success: true, levels: {}, total: 0 });
        }

        const team = {
            1: [], 2: [], 3: [], 4: [], 5: [], 6: []
        };
        let total = 0;

        // Level 1: Users who were referred by my referral code
        const level1 = await User.find({ referred_by: me.referral_code });
        team[1] = level1.map(u => ({ id: u.id, name: u.full_name || u.username, joined: u.created_at, ref: u.referral_code }));
        total += level1.length;

        // Level 2: Users who were referred by Level 1 users
        if (level1.length > 0) {
            const l1Codes = level1.map(u => u.referral_code).filter(c => c);
            const level2 = await User.find({ referred_by: { $in: l1Codes } });
            team[2] = level2.map(u => ({ id: u.id, name: u.full_name || u.username, joined: u.created_at, ref: u.referral_code }));
            total += level2.length;

            // Level 3
            if (level2.length > 0) {
                const l2Codes = level2.map(u => u.referral_code).filter(c => c);
                const level3 = await User.find({ referred_by: { $in: l2Codes } });
                team[3] = level3.map(u => ({ id: u.id, name: u.full_name || u.username, joined: u.created_at, ref: u.referral_code }));
                total += level3.length;

                // Level 4
                if (level3.length > 0) {
                    const l3Codes = level3.map(u => u.referral_code).filter(c => c);
                    const level4 = await User.find({ referred_by: { $in: l3Codes } });
                    team[4] = level4.map(u => ({ id: u.id, name: u.full_name || u.username, joined: u.created_at, ref: u.referral_code }));
                    total += level4.length;

                    // Level 5
                    if (level4.length > 0) {
                        const l4Codes = level4.map(u => u.referral_code).filter(c => c);
                        const level5 = await User.find({ referred_by: { $in: l4Codes } });
                        team[5] = level5.map(u => ({ id: u.id, name: u.full_name || u.username, joined: u.created_at, ref: u.referral_code }));
                        total += level5.length;

                        // Level 6
                        if (level5.length > 0) {
                            const l5Codes = level5.map(u => u.referral_code).filter(c => c);
                            const level6 = await User.find({ referred_by: { $in: l5Codes } });
                            team[6] = level6.map(u => ({ id: u.id, name: u.full_name || u.username, joined: u.created_at, ref: u.referral_code }));
                            total += level6.length;
                        }
                    }
                }
            }
        }

        // Calculate total earnings from referrals
        const WalletTxn = require('../database/models/WalletTxn');
        const txns = await WalletTxn.find({ 
            user_id: userId, 
            type: 'credit', 
            note: { $regex: /Ref (Join|Comm)/i } 
        });
        const total_earnings = txns.reduce((sum, t) => sum + (t.amount || 0), 0);

        res.json({ success: true, levels: team, total, total_earnings });
    } catch (e) {
        console.error('[Team API] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
