const Session = require('../database/models/Session');
const { broadcastSession } = require('../routes/sessions');

let monitorInterval;

const start = () => {
    if (monitorInterval) return;
    
    console.log('🤖 Session Monitor Started');
    monitorInterval = setInterval(async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            
            // Find all confirmed sessions that haven't started yet
            const sessions = await Session.find({ 
                status: 'confirmed', 
                quiz_start_at: { $gt: now } 
            });

            for (const s of sessions) {
                const remaining = s.quiz_start_at - now;
                
                // 30 mins left (actually rings at 30 mins remaining, i.e., 1 min after 31min delay)
                if (remaining <= 1800 && remaining > 1790 && !s.alert_30m) {
                    s.alert_30m = true;
                    broadcastSession(s.id, { type: 'alert', message: 'Session is starting in 30 minutes! Get ready.', countdown: remaining });
                    await s.save();
                }
                
                // 10 mins left
                if (remaining <= 600 && remaining > 590 && !s.alert_10m) {
                    s.alert_10m = true;
                    broadcastSession(s.id, { type: 'alert', message: 'Session is starting in 10 minutes!', countdown: remaining });
                    await s.save();
                }

                // 5 mins left
                if (remaining <= 300 && remaining > 290 && !s.alert_5m) {
                    s.alert_5m = true;
                    broadcastSession(s.id, { type: 'alert', message: 'Hurry up! Session starts in 5 minutes!', countdown: remaining });
                    await s.save();
                }

                // 10 seconds left - Trigger countdown and auto-start
                if (remaining <= 10 && remaining > 0 && !s.alert_10s) {
                    s.alert_10s = true;
                    broadcastSession(s.id, { type: 'countdown', seconds: remaining });
                    await s.save();
                }
            }
        } catch (e) {
            console.error('[SessionMonitor] Error:', e.message);
        }
    }, 5000); // Poll every 5 seconds
};

module.exports = { start };
