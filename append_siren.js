const fs = require('fs');
const code = `\n\n// ── GLOBAL SIREN SYSTEM ──
function initSirenSystem() {
    const token = getToken();
    if (!token) return;

    const evtSource = new EventSource('/api/siren/stream?token=' + token);

    evtSource.onmessage = function (e) {
        const data = JSON.parse(e.data);
        if (data.message) {
            triggerSirenAlert(data.message);
        }
    };
}

function triggerSirenAlert(msg) {
    // 1. Play Siren sound (base64 simple alarm or browser beep via AudioContext)
    playLoudBeep();

    // 2. Show full screen red warning modal
    showSirenModal(msg);

    // 3. Speak the text out loud in Hindi/English
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'hi-IN'; // Hindi/English mix
        utterance.rate = 0.9;
        utterance.pitch = 1.2;
        window.speechSynthesis.speak(utterance);
    }
}

function playLoudBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 1);

        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 2);
    } catch(e) { console.log('Audio error:', e); }
}

function showSirenModal(msg) {
    let modal = document.getElementById('sirenModalOverlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sirenModalOverlay';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(220,38,38,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:20px;backdrop-filter:blur(10px);animation: flashRed 1s infinite alternate;';

        const style = document.createElement('style');
        style.innerHTML = '@keyframes flashRed { from { background:rgba(220,38,38,0.85); } to { background:rgba(255,0,0,1); } }';
        document.head.appendChild(style);

        const icon = document.createElement('div');
        icon.innerHTML = '🚨';
        icon.style.fontSize = '5rem';
        icon.style.marginBottom = '20px';
        modal.appendChild(icon);

        const title = document.createElement('h1');
        title.innerText = 'ADMIN ALERT';
        title.style.color = '#fff';
        title.style.fontSize = '2.5rem';
        title.style.margin = '0 0 20px 0';
        title.style.textShadow = '0 4px 10px rgba(0,0,0,0.5)';
        modal.appendChild(title);

        const text = document.createElement('h3');
        text.id = 'sirenModalText';
        text.style.color = '#fff';
        text.style.fontSize = '1.2rem';
        text.style.lineHeight = '1.6';
        text.style.background = 'rgba(0,0,0,0.3)';
        text.style.padding = '20px';
        text.style.borderRadius = '12px';
        text.style.maxWidth = '90%';
        modal.appendChild(text);

        const btn = document.createElement('button');
        btn.innerText = 'DISMISS';
        btn.style.cssText = 'margin-top:40px;padding:12px 30px;background:#fff;color:#dc2626;border:none;border-radius:30px;font-weight:900;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.4);';
        btn.onclick = () => { modal.style.display = 'none'; window.speechSynthesis.cancel(); };
        modal.appendChild(btn);

        document.body.appendChild(modal);
    }

    document.getElementById('sirenModalText').innerHTML = msg;
    modal.style.display = 'flex';
}

// Auto-init
setTimeout(initSirenSystem, 1000);
`;
fs.appendFileSync('public/js/common.js', code, 'utf8');
console.log('Appended successfully');
