/* ── COMMON JS — Shared utility functions for all pages ── */

// ─── PWA Service Worker Registration ──────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => { });
    });
}

// ─── API HELPER ───────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {}
    };
    if (!(body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) {
        opts.body = (body instanceof FormData) ? body : JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(url, opts);
    } catch (e) {
        throw new Error('Network error — server se connect nahi ho pa raha. Server chal raha hai?');
    }
    const data = await res.json().catch(() => ({}));

    // Auto-redirect on 401 (stale/invalid token)
    if (res.status === 401) {
        const isAdminPage = window.location.pathname.includes('admin');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (isAdminPage) {
            window.location.href = '/admin_login.html';
        } else {
            window.location.href = '/login.html';
        }
        return;
    }

    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), data);
    return data;
}

// ─── AUTH HELPERS ─────────────────────────────────────────────
function getToken() { return localStorage.getItem('token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }

function requireLogin() {
    if (!getToken()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function requireAdmin() {
    const token = getToken();
    const user = getUser();
    if (!token || (user && user.is_admin === 0)) {
        window.location.href = '/admin_login.html';
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// ─── TOAST NOTIFICATION ───────────────────────────────────────
function toast(msg, type = 'info') {
    let container = document.getElementById('toast');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast-item toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { if (el && el.parentNode) el.remove(); }, 3500);
    return el;
}

// ─── HIDE LOADING HELPER ──────────────────────────────────────
// Call this to safely hide any loading spinner by ID
function hideLoading(id = 'loadingState') {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

// ─── GLOBAL FOOTER (Liquid Glass Luxury) ──────────────────────
function renderFooter() {
    const existing = document.querySelector('footer.footer');
    if (existing) return;

    const footer = document.createElement('footer');
    footer.className = 'footer luxury-reveal';
    footer.innerHTML = `
    <div class="container footer-wrap" style="text-align:center; padding-bottom: 40px;">
        <div style="display:flex; gap:20px; justify-content:center; margin-bottom:32px; flex-wrap:wrap;">
            <a href="https://instagram.com/quiz_pro_24" target="_blank" class="social-pill insta-glow">
                <span>📸</span> INSTAGRAM
            </a>
            <a href="https://youtube.com/@therealjourney-t4j" target="_blank" class="social-pill yt-glow">
                <span>▶️</span> YOUTUBE
            </a>
        </div>
        <p class="trust-line" style="font-size: 0.82rem; color: rgba(255,255,255,0.4); max-width: 600px; margin: 0 auto 16px;">
            QuizPro is a skill-based educational quiz platform.
            <br>Participation fees are charged only for access.
            <br>No gambling, betting, or real-money cash rewards are offered.
            <br/><span style="color:var(--gold); font-weight:700;">✅ Purely Knowledge and Skill Based</span>
        </p>
        <div style="margin-bottom: 24px; font-size: 0.75rem;">
            <a href="/plan.html" style="color:var(--gold); font-weight:700; text-decoration:none; margin: 0 8px;">Plan & Benefits 🎁</a> |
            <a href="/about.html" style="color:var(--blue); text-decoration:none; margin: 0 8px;">About Us</a> |
            <a href="/privacy.html" style="color:var(--blue); text-decoration:none; margin: 0 8px;">Privacy Policy</a> |
            <a href="/terms.html" style="color:var(--blue); text-decoration:none; margin: 0 8px;">Terms & Conditions</a> |
            <a href="/shipping.html" style="color:var(--blue); text-decoration:none; margin: 0 8px;">Shipping Policy</a> |
            <a href="/refund.html" style="color:var(--blue); text-decoration:none; margin: 0 8px;">Cancellation & Refunds</a> |
            <a href="/contact.html" style="color:var(--blue); text-decoration:none; margin: 0 8px;">Contact Us</a>
        </div>
        <div class="copyright" style="font-size: 0.75rem; color: rgba(255,255,255,0.25); letter-spacing: 1px;">
            © ${new Date().getFullYear()} QUIZPRO ARENA OFFICIAL • ALL RIGHTS RESERVED
        </div>
    </div>`;
    document.body.appendChild(footer);
}
// ─── GLOBAL NAVIGATION (Luxury) ───────────────────────────────
function renderAppNav() {
    const user = getUser();
    const path = window.location.pathname;

    // Navbar
    const nav = document.createElement('nav');
    nav.className = 'navbar glass-card';
    nav.innerHTML = `
        <a href="/" class="logo" style="font-size: 1.3rem;">💎 QuizPro Arena</a>
        <div class="nav-links">
            ${user ? `<span style="color:var(--muted); font-size:.88rem; font-weight: 500;">${user.name || ''}</span>
            <a href="/dashboard.html" class="${path.includes('dashboard') ? 'active' : ''}" style="${path.includes('dashboard') ? 'color: var(--blue);' : ''}">Dashboard</a>
            <a href="/wallet.html" class="${path.includes('wallet') ? 'active' : ''}" style="${path.includes('wallet') ? 'color: var(--blue);' : ''}">Account</a>
            <button class="btn btn-outline" style="padding:6px 16px; font-size:.85rem; border-radius: 12px;" onclick="logout()">Logout</button>` :
            `<a href="/login.html" class="btn btn-primary" style="padding:8px 20px; border-radius:12px;">Login</a>`}
        </div>`;

    // Bottom Nav (Mobile Only)
    const bNav = document.createElement('div');
    bNav.className = 'bottom-nav';
    bNav.innerHTML = `
        <a href="/dashboard.html" class="nav-item ${path.includes('dashboard') ? 'active' : ''}">
            <i style="font-style: normal; font-size: 1.6rem;">🏠</i>
            <span>Home</span>
            <div class="icon-dot"></div>
        </a>
        <a href="/wallet.html" class="nav-item ${path.includes('wallet') ? 'active' : ''}">
            <i style="font-style: normal; font-size: 1.6rem;">👤</i>
            <span>Account</span>
            <div class="icon-dot"></div>
        </a>
        <a href="/leaderboard.html" class="nav-item ${path.includes('leaderboard') ? 'active' : ''}">
            <i style="font-style: normal; font-size: 1.6rem;">🏆</i>
            <span>Rewards</span>
            <div class="icon-dot"></div>
        </a>
        <button onclick="logout()" class="nav-item" style="background:none; border:none; padding:0; font-family:inherit;">
            <i style="font-style: normal; font-size: 1.6rem;">🚪</i>
            <span>Logout</span>
            <div class="icon-dot"></div>
        </button>`;

    // Prepend to body so it stays at the top/bottom
    if (!document.querySelector('.navbar')) document.body.prepend(nav);
    if (!document.querySelector('.bottom-nav')) document.body.appendChild(bNav);
}

// ─── INTERACTION ENGINE (3D Physics & Audio) ──────────────────
class InteractionEngine {
    constructor() {
        this.ctx = null;
        this.tiltElements = [];
        this.clickCount = 0;
        this.currentPaletteIndex = 0;
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        this.palettes = [
            { name: 'Royal Blue', blue: '#3b82f6', violet: '#8b5cf6', indigo: '#6366f1' },
            { name: 'Emerald Elite', blue: '#10b981', violet: '#059669', indigo: '#047857' },
            { name: 'Gold Empire', blue: '#fbbf24', violet: '#d97706', indigo: '#b45309' },
            { name: 'Ruby Royalty', blue: '#f43f5e', violet: '#be123c', indigo: '#9f1239' },
            { name: 'Cyber Cyan', blue: '#06b6d4', violet: '#7c3aed', indigo: '#4338ca' },
            { name: 'Sunset Silk', blue: '#f97316', violet: '#ec4899', indigo: '#db2777' }
        ];

        this.applyDynamicTheme();
        this.init();
    }

    applyDynamicTheme() {
        // Random pick on start
        this.currentPaletteIndex = Math.floor(Math.random() * this.palettes.length);
        this.updateStyles();
    }

    cycleTheme() {
        this.currentPaletteIndex = (this.currentPaletteIndex + 1) % this.palettes.length;
        this.updateStyles();
        this.soundSuccess(); // Theme change sound
    }

    updateStyles() {
        const p = this.palettes[this.currentPaletteIndex];
        const root = document.documentElement;
        root.style.setProperty('--blue', p.blue);
        root.style.setProperty('--violet', p.violet);
        root.style.setProperty('--indigo', p.indigo);
        console.log(`🎨 Theme Shift: ${p.name}`);
    }


    init() {
        window.addEventListener('scroll', () => renderFooter());
        this.hookButtons();

        // Ripple effect on every click
        document.addEventListener('click', (e) => this.createRipple(e));

        // Unlock audio on first interaction
        const unlock = () => {
            this.initAudio();
            if (this.ctx) this.ctx.resume();
            document.removeEventListener('mousedown', unlock);
            document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('mousedown', unlock);
        document.addEventListener('touchstart', unlock);

        this.initObserver();
    }

    createRipple(e) {
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            width: 0; height: 0;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(59,130,246,0.18) 50%, transparent 70%);
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 99999;
            animation: waterRipple 0.7s ease-out forwards;
        `;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    }


    initAudio() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { /* Audio not supported */ }
    }

    playTone(freq, type = 'sine', duration = 0.2, vol = 0.1) {
        if (!this.userActivated) return; // Wait for user gesture
        if (!this.ctx) this.initAudio();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Diverse Sound Profiles
    soundCrystal() { this.playTone(1200, 'sine', 0.15, 0.03); }
    soundGold()    { this.playTone(600, 'triangle', 0.2, 0.04); }
    soundGlass()   { this.playTone(900, 'sine', 0.1, 0.02); }
    soundSuccess() { this.playTone(880, 'sine', 0.3, 0.05); setTimeout(() => this.playTone(1100, 'sine', 0.3, 0.05), 100); }

    hover() { this.soundGlass(); }
    click() {
        this.clickCount++;
        // Cycle through frequencies for infinite variety
        const baseFreq = 440 + ((this.clickCount % 12) * 40); // Melodic shifts
        const type = this.clickCount % 2 === 0 ? 'sine' : 'triangle';
        this.playTone(baseFreq, type, 0.2, 0.05);

        // Theme shift on significant clicks
        if (this.clickCount % 10 === 0) {
            this.cycleTheme();
        }

        // Occasional harmonic chime
        if (this.clickCount % 5 === 0) {
            setTimeout(() => this.playTone(baseFreq * 1.5, 'sine', 0.2, 0.03), 50);
        }
    }

    hookButtons() {
        // Broad selector for 100% site coverage
        const selector = 'button, a, .btn, .glass-card, .nav-item, .tab-btn, input[type="button"], input[type="submit"], select, label';
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.hooked) return;
            el.addEventListener('mouseenter', () => this.hover());
            el.addEventListener('click', () => this.click());
            // Form specific coverage
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                el.addEventListener('focus', () => this.hover());
            }
            el.dataset.hooked = "true";
        });
    }

    activateAudio() {
        if (this.userActivated) return;
        this.userActivated = true;
        this.initAudio();
    }

    initObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (m.addedNodes.length) {
                    this.hookButtons();
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

// Global initialization
const engine = new InteractionEngine();

window.addEventListener('DOMContentLoaded', () => {
    renderAppNav();
    renderFooter();
    // Activate audio only after first real user interaction
    const activateOnce = () => { engine.activateAudio(); };
    document.addEventListener('click', activateOnce, { once: true });
    document.addEventListener('keydown', activateOnce, { once: true });
});


// ── GLOBAL SIREN SYSTEM ──
function initSirenSystem() {
    const token = getToken();
    if (!token) return;

    const evtSource = new EventSource('/api/siren/stream?token=' + token);

    evtSource.onmessage = function (e) {
        const data = JSON.parse(e.data);
        if (data.type === 'alert' && data.message) {
            playLoudBeep();
            showSirenModal(data.message);
        } else if (data.type === 'stop') {
            const modal = document.getElementById('sirenModalOverlay');
            if (modal) modal.style.display = 'none';
            window.speechSynthesis.cancel();
            stopSirenBeep();
        }
    };
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
        btn.onclick = () => { 
            modal.style.display = 'none'; 
            window.speechSynthesis.cancel();
            stopSirenBeep(); 
        };
        modal.appendChild(btn);

        document.body.appendChild(modal);
    }

    document.getElementById('sirenModalText').innerHTML = msg;
    modal.style.display = 'flex';
}

// Auto-init
setTimeout(initSirenSystem, 1000);

let globalAudioCtx = null;
function initAudioCtx() {
    if(!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
}
document.addEventListener('click', initAudioCtx);
document.addEventListener('touchstart', initAudioCtx);

let sirenOscillators = [];
function playLoudBeep() {
    try {
        initAudioCtx();
        const oscillator = globalAudioCtx.createOscillator();
        const gainNode = globalAudioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(globalAudioCtx.destination);

        oscillator.type = 'square';
        const now = globalAudioCtx.currentTime;
        gainNode.gain.setValueAtTime(0.5, now);
        
        for (let i = 0; i < 60; i++) { 
            oscillator.frequency.setValueAtTime(800, now + i);
            oscillator.frequency.linearRampToValueAtTime(1200, now + i + 0.5);
            oscillator.frequency.linearRampToValueAtTime(800, now + i + 1);
        }

        oscillator.start(now);
        sirenOscillators.push(oscillator);
    } catch(e) { console.log('Audio error:', e); }
}

function stopSirenBeep() {
    sirenOscillators.forEach(osc => {
        try { osc.stop(); } catch(e){}
    });
    sirenOscillators = [];
}



// --- LIVE BROADCAST LISTENER (PCM) ---
let liveAudioCtx;
let nextStartTime = 0;
let broadcastMuted = false;

function initLiveBroadcast() {
    if(window.liveBroadcastInitDone) return;
    window.liveBroadcastInitDone = true;

    // Load socket.io
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = () => {
        const socket = io();
        
        socket.on('audio-pcm', (arrayBuffer) => {
            if(broadcastMuted) return;
            
            if(!liveAudioCtx) liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            if(liveAudioCtx.state === 'suspended') liveAudioCtx.resume();
            
            const int16 = new Int16Array(arrayBuffer);
            const float32 = new Float32Array(int16.length);
            for(let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 0x8000;
            }
            
            const audioBuffer = liveAudioCtx.createBuffer(1, float32.length, 16000);
            audioBuffer.getChannelData(0).set(float32);
            
            const source = liveAudioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(liveAudioCtx.destination);
            
            if (nextStartTime < liveAudioCtx.currentTime) {
                nextStartTime = liveAudioCtx.currentTime + 0.05; // 50ms buffer
            }
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
        });
    };
    document.head.appendChild(script);

    // Add UI Toggle for Mute nicely in the navbar
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        const muteBtn = document.createElement('button');
        muteBtn.className = 'btn btn-outline';
        muteBtn.id = 'liveAudioMuteBtn';
        // By default it is UNMUTED
        muteBtn.innerHTML = '??';
        muteBtn.title = 'Mute Admin Broadcast';
        muteBtn.style.cssText = 'padding:6px; font-size:1.2rem; min-width:38px; border-radius:50%; margin-left: 10px; cursor:pointer;';
        
        muteBtn.onclick = () => {
            broadcastMuted = !broadcastMuted;
            muteBtn.innerHTML = broadcastMuted ? '??' : '??';
            muteBtn.style.borderColor = broadcastMuted ? '#ef4444' : 'var(--border)';
            if(broadcastMuted && liveAudioCtx) {
                liveAudioCtx.suspend();
                nextStartTime = 0;
            } else if (!broadcastMuted && liveAudioCtx) {
                liveAudioCtx.resume();
            }
        };
        navLinks.appendChild(muteBtn);
    }
}

document.addEventListener('click', initLiveBroadcast);
document.addEventListener('touchstart', initLiveBroadcast);
