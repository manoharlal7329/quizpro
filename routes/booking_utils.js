const Session = require('../database/models/Session');
const Seat = require('../database/models/Seat');
const User = require('../database/models/User');
const Wallet = require('../database/models/Wallet');
const { addTxn } = require('./wallet_utils');

/**
 * Centralized logic to book a seat in a session.
 * Handles Seat creation, Session status updates, SSE broadcasting, and Referral Commissions.
 */
async function finalizeBooking(userId, sessionId, paymentId) {
    try {
        const session = await Session.findOne({ id: Number(sessionId) });
        if (!session) return { error: 'Session not found' };
        if (session.seats_booked >= session.seat_limit) return { error: 'Session full' };

        // 1. Check for existing seat
        const already = await Seat.findOne({ session_id: Number(sessionId), user_id: Number(userId) });
        if (already) return { booked: true, already: true };

        // 2. Create Seat
        const seat = new Seat({
            id: Date.now(),
            session_id: Number(sessionId),
            user_id: Number(userId),
            paid_at: Math.floor(Date.now() / 1000),
            payment_id: paymentId
        });
        await seat.save();

        // 3. Update Session
        session.seats_booked = (session.seats_booked || 0) + 1;

        let confirmed = false;
        if (session.seats_booked >= session.seat_limit) {
            const delaySeconds = (session.quiz_delay_minutes || 60) * 60;
            session.status = 'confirmed';
            session.quiz_start_at = Math.floor(Date.now() / 1000) + delaySeconds;
            session.pdf_at = session.quiz_start_at - 1800;
            session.prize_pool = Math.floor(session.entry_fee * session.seat_limit * 0.75);
            session.platform_cut = Math.floor(session.entry_fee * session.seat_limit * 0.25);
            confirmed = true;
        }
        await session.save();

        // 4. Broadcast SSE
        try {
            const sessionsRouter = require('./sessions');
            if (sessionsRouter.broadcastSession) {
                sessionsRouter.broadcastSession(String(sessionId), {
                    seats_booked: session.seats_booked,
                    status: session.status,
                    quiz_start_at: session.quiz_start_at || null,
                    pdf_at: session.pdf_at || null
                });
            }
        } catch (e) {
            console.warn('[BookingHelper] Broadcast failed:', e.message);
        }

        // 5. 5% Referral Commission
        try {
            const payer = await User.findOne({ id: Number(userId) }).lean();
            if (payer && payer.referred_by) {
                const referrer = await User.findOne({ referral_code: payer.referred_by }).lean();
                if (referrer) {
                    const commission = Math.floor(session.entry_fee * 0.05);
                    if (commission > 0) {
                        await Wallet.findOneAndUpdate(
                            { user_id: referrer.id },
                            { $inc: { win_bal: commission } },
                            { upsert: true }
                        );
                        await addTxn(referrer.id, 'real', 'credit', commission, `🎯 Referral commission — ${payer.name || payer.email} ne join kiya`, paymentId);
                    }
                }
            }
        } catch (refErr) {
            console.warn('[BookingHelper] Referral Error:', refErr.message);
        }

        return {
            success: true,
            confirmed,
            seats_booked: session.seats_booked,
            seats_remaining: session.seat_limit - session.seats_booked
        };
    } catch (err) {
        console.error('[BookingHelper] Error:', err.message);
        return { error: err.message };
    }
}

module.exports = { finalizeBooking };
