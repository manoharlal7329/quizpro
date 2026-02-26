/* ── COMMON JS — Shared utility functions for all pages ── */

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

    if (res.status === 401) {
        console.warn('[AUTH] 401 Unauthorized detected. Clearing session.');
        localStorage.clear();
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/login.html?error=session_expired';
        }
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
            <a href="https://www.instagram.com/lucky_bhambhu?igsh=MXgyaHZmNGlhdDR0bA%3D%3D&utm_source=qr" target="_blank" class="btn btn-insta">📸 Follow on Instagram</a>
            <a href="https://www.youtube.com/@laxmanfunzonen" target="_blank" class="btn btn-youtube">▶️ Watch on YouTube</a>
        </div>
        <p class="trust-line">
            Follow us on Instagram &amp; YouTube for updates, learning tips, and announcements.
            <br><strong>⚡ QuizPro</strong> is a 100% Skill-Based platform. Not gambling.
        </p>
        <div class="copyright">© ${new Date().getFullYear()} QUIZPRO OFFICIAL • ALL RIGHTS RESERVED</div>
    </div>`;
    document.body.appendChild(footer); // append to BODY, not .main
}
