const CACHE = 'pos-shell-v2';
const FILES = ['./', './index.html', './style.css', './app.js', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
// Network-first for app files (so updates arrive), cache fallback offline. Supabase API is never cached.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.url.includes('supabase.co')) return;
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; })
    .catch(() => caches.match(r)));
});
