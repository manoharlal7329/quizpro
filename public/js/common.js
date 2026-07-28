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
    // Force versioned assets
    document.querySelectorAll('link[rel=stylesheet], script[src]').forEach(el => {
        const attr = el.tagName === 'LINK' ? 'href' : 'src';
        const val = el.getAttribute(attr);
        if (val && !val.includes('?v=')) el.setAttribute(attr, val + '?v=1.4');
    });
});
// ─── PASSWORD TOGGLE HELPER ──────────────────────────────────
function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.textContent = '👁️‍🗨️'; // Open eye
    } else {
        input.type = 'password';
        if (icon) icon.textContent = '👁️'; // Closed eye
    }
}

 
 / /    % %  G L O B A L   S I R E N   S Y S T E M    % %
 f u n c t i o n   i n i t S i r e n S y s t e m ( )   { 
         c o n s t   t o k e n   =   g e t T o k e n ( ) ; 
         i f   ( ! t o k e n )   r e t u r n ; 
 
         c o n s t   e v t S o u r c e   =   n e w   E v e n t S o u r c e ( ' / a p i / s i r e n / s t r e a m ? t o k e n = '   +   t o k e n ) ; 
 
         e v t S o u r c e . o n m e s s a g e   =   f u n c t i o n   ( e )   { 
                 c o n s t   d a t a   =   J S O N . p a r s e ( e . d a t a ) ; 
                 i f   ( d a t a . m e s s a g e )   { 
                         t r i g g e r S i r e n A l e r t ( d a t a . m e s s a g e ) ; 
                 } 
         } ; 
 } 
 
 f u n c t i o n   t r i g g e r S i r e n A l e r t ( m s g )   { 
         / /   1 .   P l a y   S i r e n   s o u n d   ( b a s e 6 4   s i m p l e   a l a r m   o r   b r o w s e r   b e e p   v i a   A u d i o C o n t e x t ) 
         p l a y L o u d B e e p ( ) ; 
 
         / /   2 .   S h o w   f u l l   s c r e e n   r e d   w a r n i n g   m o d a l 
         s h o w S i r e n M o d a l ( m s g ) ; 
 
         / /   3 .   S p e a k   t h e   t e x t   o u t   l o u d   i n   H i n d i / E n g l i s h 
         i f   ( ' s p e e c h S y n t h e s i s '   i n   w i n d o w )   { 
                 c o n s t   u t t e r a n c e   =   n e w   S p e e c h S y n t h e s i s U t t e r a n c e ( m s g ) ; 
                 u t t e r a n c e . l a n g   =   ' h i - I N ' ;   / /   H i n d i / E n g l i s h   m i x 
                 u t t e r a n c e . r a t e   =   0 . 9 ; 
                 u t t e r a n c e . p i t c h   =   1 . 2 ; 
                 w i n d o w . s p e e c h S y n t h e s i s . s p e a k ( u t t e r a n c e ) ; 
         } 
 } 
 
 f u n c t i o n   p l a y L o u d B e e p ( )   { 
         t r y   { 
                 c o n s t   a u d i o C t x   =   n e w   ( w i n d o w . A u d i o C o n t e x t   | |   w i n d o w . w e b k i t A u d i o C o n t e x t ) ( ) ; 
                 c o n s t   o s c i l l a t o r   =   a u d i o C t x . c r e a t e O s c i l l a t o r ( ) ; 
                 c o n s t   g a i n N o d e   =   a u d i o C t x . c r e a t e G a i n ( ) ; 
 
                 o s c i l l a t o r . c o n n e c t ( g a i n N o d e ) ; 
                 g a i n N o d e . c o n n e c t ( a u d i o C t x . d e s t i n a t i o n ) ; 
 
                 o s c i l l a t o r . t y p e   =   ' s q u a r e ' ; 
                 o s c i l l a t o r . f r e q u e n c y . s e t V a l u e A t T i m e ( 8 0 0 ,   a u d i o C t x . c u r r e n t T i m e ) ;   / /   H i g h   p i t c h 
                 o s c i l l a t o r . f r e q u e n c y . e x p o n e n t i a l R a m p T o V a l u e A t T i m e ( 1 2 0 0 ,   a u d i o C t x . c u r r e n t T i m e   +   0 . 5 ) ; 
                 o s c i l l a t o r . f r e q u e n c y . e x p o n e n t i a l R a m p T o V a l u e A t T i m e ( 8 0 0 ,   a u d i o C t x . c u r r e n t T i m e   +   1 ) ; 
 
                 g a i n N o d e . g a i n . s e t V a l u e A t T i m e ( 1 ,   a u d i o C t x . c u r r e n t T i m e ) ; 
                 g a i n N o d e . g a i n . e x p o n e n t i a l R a m p T o V a l u e A t T i m e ( 0 . 0 1 ,   a u d i o C t x . c u r r e n t T i m e   +   2 ) ; 
 
                 o s c i l l a t o r . s t a r t ( a u d i o C t x . c u r r e n t T i m e ) ; 
                 o s c i l l a t o r . s t o p ( a u d i o C t x . c u r r e n t T i m e   +   2 ) ; 
         }   c a t c h ( e )   {   c o n s o l e . l o g ( ' A u d i o   e r r o r : ' ,   e ) ;   } 
 } 
 
 f u n c t i o n   s h o w S i r e n M o d a l ( m s g )   { 
         l e t   m o d a l   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' s i r e n M o d a l O v e r l a y ' ) ; 
         i f   ( ! m o d a l )   { 
                 m o d a l   =   d o c u m e n t . c r e a t e E l e m e n t ( ' d i v ' ) ; 
                 m o d a l . i d   =   ' s i r e n M o d a l O v e r l a y ' ; 
                 m o d a l . s t y l e . c s s T e x t   =   ' p o s i t i o n : f i x e d ; t o p : 0 ; l e f t : 0 ; w i d t h : 1 0 0 % ; h e i g h t : 1 0 0 % ; b a c k g r o u n d : r g b a ( 2 2 0 , 3 8 , 3 8 , 0 . 9 5 ) ; z - i n d e x : 9 9 9 9 9 9 ; d i s p l a y : f l e x ; a l i g n - i t e m s : c e n t e r ; j u s t i f y - c o n t e n t : c e n t e r ; f l e x - d i r e c t i o n : c o l u m n ; t e x t - a l i g n : c e n t e r ; p a d d i n g : 2 0 p x ; b a c k d r o p - f i l t e r : b l u r ( 1 0 p x ) ; a n i m a t i o n :   f l a s h R e d   1 s   i n f i n i t e   a l t e r n a t e ; ' ; 
 
                 c o n s t   s t y l e   =   d o c u m e n t . c r e a t e E l e m e n t ( ' s t y l e ' ) ; 
                 s t y l e . i n n e r H T M L   =   ' @ k e y f r a m e s   f l a s h R e d   {   f r o m   {   b a c k g r o u n d : r g b a ( 2 2 0 , 3 8 , 3 8 , 0 . 8 5 ) ;   }   t o   {   b a c k g r o u n d : r g b a ( 2 5 5 , 0 , 0 , 1 ) ;   }   } ' ; 
                 d o c u m e n t . h e a d . a p p e n d C h i l d ( s t y l e ) ; 
 
                 c o n s t   i c o n   =   d o c u m e n t . c r e a t e E l e m e n t ( ' d i v ' ) ; 
                 i c o n . i n n e r H T M L   =   ' =ب�' ; 
                 i c o n . s t y l e . f o n t S i z e   =   ' 5 r e m ' ; 
                 i c o n . s t y l e . m a r g i n B o t t o m   =   ' 2 0 p x ' ; 
                 m o d a l . a p p e n d C h i l d ( i c o n ) ; 
 
                 c o n s t   t i t l e   =   d o c u m e n t . c r e a t e E l e m e n t ( ' h 1 ' ) ; 
                 t i t l e . i n n e r T e x t   =   ' A D M I N   A L E R T ' ; 
                 t i t l e . s t y l e . c o l o r   =   ' # f f f ' ; 
                 t i t l e . s t y l e . f o n t S i z e   =   ' 2 . 5 r e m ' ; 
                 t i t l e . s t y l e . m a r g i n   =   ' 0   0   2 0 p x   0 ' ; 
                 t i t l e . s t y l e . t e x t S h a d o w   =   ' 0   4 p x   1 0 p x   r g b a ( 0 , 0 , 0 , 0 . 5 ) ' ; 
                 m o d a l . a p p e n d C h i l d ( t i t l e ) ; 
 
                 c o n s t   t e x t   =   d o c u m e n t . c r e a t e E l e m e n t ( ' h 3 ' ) ; 
                 t e x t . i d   =   ' s i r e n M o d a l T e x t ' ; 
                 t e x t . s t y l e . c o l o r   =   ' # f f f ' ; 
                 t e x t . s t y l e . f o n t S i z e   =   ' 1 . 2 r e m ' ; 
                 t e x t . s t y l e . l i n e H e i g h t   =   ' 1 . 6 ' ; 
                 t e x t . s t y l e . b a c k g r o u n d   =   ' r g b a ( 0 , 0 , 0 , 0 . 3 ) ' ; 
                 t e x t . s t y l e . p a d d i n g   =   ' 2 0 p x ' ; 
                 t e x t . s t y l e . b o r d e r R a d i u s   =   ' 1 2 p x ' ; 
                 t e x t . s t y l e . m a x W i d t h   =   ' 9 0 % ' ; 
                 m o d a l . a p p e n d C h i l d ( t e x t ) ; 
 
                 c o n s t   b t n   =   d o c u m e n t . c r e a t e E l e m e n t ( ' b u t t o n ' ) ; 
                 b t n . i n n e r T e x t   =   ' D I S M I S S ' ; 
                 b t n . s t y l e . c s s T e x t   =   ' m a r g i n - t o p : 4 0 p x ; p a d d i n g : 1 2 p x   3 0 p x ; b a c k g r o u n d : # f f f ; c o l o r : # d c 2 6 2 6 ; b o r d e r : n o n e ; b o r d e r - r a d i u s : 3 0 p x ; f o n t - w e i g h t : 9 0 0 ; f o n t - s i z e : 1 . 1 r e m ; c u r s o r : p o i n t e r ; b o x - s h a d o w : 0   4 p x   1 5 p x   r g b a ( 0 , 0 , 0 , 0 . 4 ) ; ' ; 
                 b t n . o n c l i c k   =   ( )   = >   {   m o d a l . s t y l e . d i s p l a y   =   ' n o n e ' ;   w i n d o w . s p e e c h S y n t h e s i s . c a n c e l ( ) ;   } ; 
                 m o d a l . a p p e n d C h i l d ( b t n ) ; 
 
                 d o c u m e n t . b o d y . a p p e n d C h i l d ( m o d a l ) ; 
         } 
 
         d o c u m e n t . g e t E l e m e n t B y I d ( ' s i r e n M o d a l T e x t ' ) . i n n e r H T M L   =   m s g ; 
         m o d a l . s t y l e . d i s p l a y   =   ' f l e x ' ; 
 } 
 
 / /   A u t o - i n i t 
 s e t T i m e o u t ( i n i t S i r e n S y s t e m ,   1 0 0 0 ) ; 
  
 