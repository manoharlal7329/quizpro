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
        headers: { 'Content-Type': 'application/json' }
    };
    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
        res = await fetch(url, opts);
    } catch (e) {
        throw new Error('Network error — server se connect nahi ho pa raha. Server chal raha hai?');
    }
    const data = await res.json().catch(() => ({}));
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

// ─── GLOBAL FOOTER ────────────────────────────────────────────
// Appended to body — NOT inside .main (was causing layout conflicts)
function renderFooter() {
    const existing = document.querySelector('footer.footer');
    if (existing) return; // don't add twice

    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.innerHTML = `
    <div class="container footer-wrap">
        <div class="footer-social">
            <a href="https://www.instagram.com/quiz_pro_24?igsh=MXd4cmY0bzh6NjBvcA==" target="_blank" class="btn btn-insta">📸 Follow on Instagram</a>
            <a href="https://youtube.com/@therealjourney-t4j?si=76G9-CnV98EwG6e5" target="_blank" class="btn btn-youtube">▶️ Watch on YouTube</a>
        </div>
        <p class="trust-line">
            Follow us on Instagram &amp; YouTube for updates, learning tips, and announcements.
            <br><strong>⚡ QuizPro Winner</strong> is a 100% Skill-Based platform. Not gambling.
        </p>
        <div class="copyright">© ${new Date().getFullYear()} QUIZPRO WINNER OFFICIAL • ALL RIGHTS RESERVED</div>
    </div>`;
    document.body.appendChild(footer); // append to BODY, not .main
}
// ─── GLOBAL NAVIGATION (Luxury) ───────────────────────────────
function renderAppNav() {
    const user = getUser();
    const path = window.location.pathname;

    // Navbar
    const nav = document.createElement('nav');
    nav.className = 'navbar glass-card';
    nav.innerHTML = `
        <a href="/" class="logo" style="font-size: 1.3rem;">💎 QuizPro Winner</a>
        <div class="nav-links">
            ${user ? `<span style="color:var(--muted); font-size:.88rem; font-weight: 500;">${user.name || ''}</span>
            <a href="/dashboard.html" class="${path.includes('dashboard') ? 'active' : ''}" style="${path.includes('dashboard') ? 'color: var(--blue);' : ''}">Dashboard</a>
            <a href="/wallet.html" class="${path.includes('wallet') ? 'active' : ''}" style="${path.includes('wallet') ? 'color: var(--blue);' : ''}">Wallet</a>
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
            <i style="font-style: normal; font-size: 1.6rem;">💳</i>
            <span>Wallet</span>
            <div class="icon-dot"></div>
        </a>
        <a href="/leaderboard.html" class="nav-item ${path.includes('leaderboard') ? 'active' : ''}">
            <i style="font-style: normal; font-size: 1.6rem;">🏆</i>
            <span>Ranks</span>
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
        this.bgAssets = [];
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.isMuted = localStorage.getItem('quiz_muted') === 'true';
        this.applyDynamicTheme();
        this.init();
        this.updateAudioUI();
    }

    applyDynamicTheme() {
        const palettes = [
            { name: 'Royal Blue', blue: '#3b82f6', violet: '#8b5cf6', indigo: '#6366f1' },
            { name: 'Emerald Elite', blue: '#10b981', violet: '#059669', indigo: '#047857' },
            { name: 'Gold Empire', blue: '#fbbf24', violet: '#d97706', indigo: '#b45309' },
            { name: 'Ruby Royalty', blue: '#f43f5e', violet: '#be123c', indigo: '#9f1239' },
            { name: 'Cyber Cyan', blue: '#06b6d4', violet: '#7c3aed', indigo: '#4338ca' },
            { name: 'Sunset Silk', blue: '#f97316', violet: '#ec4899', indigo: '#db2777' }
        ];
        const p = palettes[Math.floor(Math.random() * palettes.length)];
        const root = document.documentElement;
        root.style.setProperty('--blue', p.blue);
        root.style.setProperty('--violet', p.violet);
        root.style.setProperty('--indigo', p.indigo);
        console.log(`🎨 Dynamic Theme: ${p.name} Loaded`);
    }

    init() {
        window.addEventListener('scroll', () => renderFooter());
        this.initGems();
        this.hookButtons();
        this.initObserver();

        // Unlock audio on first interaction
        const unlock = () => {
            this.initAudio();
            if (this.ctx) this.ctx.resume();
            document.removeEventListener('mousedown', unlock);
            document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('mousedown', unlock);
        document.addEventListener('touchstart', unlock);

        document.addEventListener('mousemove', (e) => {
            if (!this.isMobile) {
                this.updateSpatial(e.clientX, e.clientY);
                // Update CSS variables for reflection logic
                document.documentElement.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`);
                document.documentElement.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);
            }
            this.updateTilt(e.clientX, e.clientY);
        });

        if (this.isMobile && window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                this.updateSpatial(e.gamma * 10, e.beta * 10); // Simulated
            });
        }
    }

    initAudio() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type = 'sine', vol = 0.1, duration = 0.1) {
        if (this.isMuted) return;
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
    soundCrystal() { this.initAudio(); this.playTone(1200, 'sine', 0.15, 0.03); } // High chime
    soundGold() { this.initAudio(); this.playTone(600, 'triangle', 0.2, 0.04); } // Metallic ring
    soundGlass() { this.initAudio(); this.playTone(900, 'sine', 0.1, 0.02); }   // Soft click
    soundSuccess() { this.initAudio(); this.playTone(880, 'sine', 0.3, 0.05); setTimeout(() => this.playTone(1100, 'sine', 0.3, 0.05), 100); } // Two-tone chime

    hover() { this.soundGlass(); }
    click() { this.soundSuccess(); }

    initGems() {
        const bg = document.createElement('div');
        bg.className = 'spatial-bg';

        const assets = [
            '/assets/3d/gem.png',
            '/assets/3d/coin.png'
        ];

        for (let i = 0; i < 8; i++) {
            const img = document.createElement('img');
            img.className = 'floating-asset';
            img.src = `${assets[i % assets.length]}`;

            const size = 60 + Math.random() * 120;
            img.style.width = size + 'px';
            img.style.left = Math.random() * 100 + '%';
            img.style.top = Math.random() * 100 + '%';
            img.style.opacity = 0.1 + Math.random() * 0.3;
            img.style.animation = `float-spatial ${10 + Math.random() * 20}s infinite ease-in-out`;

            this.bgAssets.push({
                el: img,
                type: assets[i % assets.length].includes('gem') ? 'gem' : 'coin',
                factor: 0.02 + Math.random() * 0.05,
                x: 0, y: 0
            });
            img.addEventListener('mouseenter', () => {
                if (img.src.includes('gem')) this.soundCrystal();
                else this.soundGold();
                img.style.transform += ' scale(1.2) translateZ(50px)';
            });
            bg.appendChild(img);
        }
        document.body.appendChild(bg);
    }

    updateSpatial(mx, my) {
        this.bgAssets.forEach(asset => {
            const dx = (mx - window.innerWidth / 2) * asset.factor;
            const dy = (my - window.innerHeight / 2) * asset.factor;
            asset.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 10}deg)`;
        });
    }

    updateTilt(mx, my) {
        const tiltAmount = getComputedStyle(document.documentElement).getPropertyValue('--tilt-amount').trim() || '15deg';
        const val = parseFloat(tiltAmount);

        document.querySelectorAll('[data-tilt]').forEach(el => {
            const rect = el.getBoundingClientRect();
            const x = mx - (rect.left + rect.width / 2);
            const y = my - (rect.top + rect.height / 2);
            const rX = -(y / rect.height) * val;
            const rY = (x / rect.width) * val;
            el.style.transform = `perspective(var(--perspective)) rotateX(${rX}deg) rotateY(${rY}deg) translateZ(30px)`;
        });
    }

    hookButtons() {
        document.querySelectorAll('.btn, .glass-card, .nav-item, .tab-btn').forEach(el => {
            if (el.dataset.hooked) return;
            el.addEventListener('mouseenter', () => this.hover());
            el.addEventListener('click', () => this.click());
            el.dataset.hooked = "true";
        });
    }

    initObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (m.addedNodes.length) {
                    this.hookButtons();
                    // Auto-tilt for new cards
                    document.querySelectorAll('.glass-card').forEach(c => {
                        if (c.parentElement.id === 'sessionsGrid') c.setAttribute('data-tilt', '');
                    });
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
    // Force versioned assets
    document.querySelectorAll('link[rel=stylesheet], script[src]').forEach(el => {
        const attr = el.tagName === 'LINK' ? 'href' : 'src';
        const val = el.getAttribute(attr);
        if (val && !val.includes('?v=')) el.setAttribute(attr, val + '?v=1.3');
    });
});
