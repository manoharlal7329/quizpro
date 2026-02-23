// QuizPro Service Worker — Caches static shell for offline access
const CACHE = 'quizpro-v2';
const SHELL = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/leaderboard.html',
    '/css/style.css',
    '/js/common.js',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    '/manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => { }))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Network-first for API calls
    if (url.includes('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() =>
                new Response(JSON.stringify({ error: 'Offline — server se connect nahi ho pa raha' }), {
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    // Cache-first for static assets (CSS, JS, icons)
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
            // Cache new static files automatically
            if (resp.ok && !url.includes('dashboard') && !url.includes('session')) {
                caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
            }
            return resp;
        }))
    );
});
