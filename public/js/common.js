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

// Auto-render if not admin page
if (!window.location.pathname.includes('admin')) {
    window.addEventListener('DOMContentLoaded', renderAppNav);
}
