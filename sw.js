// Bouncer offline support + automatic updates.
// Our own files: shown instantly from the saved copy, updated in the background (works offline too).
// Libraries from other sites: use the saved copy (they never change), refresh it in the background.
const CACHE = 'bouncer-v42';
const SHELL = [
  'app.html', 'index.html', 'join.html', 'camtest.html', 'scanner.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'archivo.woff2',
  'html5-qrcode.min.js', 'jsQR.min.js', 'qrcode.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                        // calls to the sheet always go to the network
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  if (url.origin === self.location.origin) {
    // Speed: open instantly from the saved copy, and fetch the newest version in the background.
    // A new upload changes this file, so the app reloads itself with the new version a few seconds later.
    const key = url.origin + url.pathname;
    e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => {
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) c.put(key, res.clone());
        return res;
      });
      if (hit) { e.waitUntil(net.catch(() => null)); return hit; }
      return net.catch(() => req.mode === 'navigate' ? c.match(url.origin + url.pathname.replace(/[^/]*$/, 'app.html')) : undefined);
    })));
    return;
  }

  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
