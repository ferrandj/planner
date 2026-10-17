/* Planner service worker: lets the app open (and be installed) like a real app, even with the server out of reach.
 *
 * It only ever stores the app itself (page, scripts, styles, fonts, icons, the voice recordings of the English quiz). It NEVER touches /api/ (your data, your files):
 * those always go straight to the server, and the app keeps its own safety copy of your data (see lib/sync.ts).
 * Bump VERSION to drop everything that was stored before. */
const VERSION = 'v1';
const CACHE = 'planner-' + VERSION;
const ROOT = new URL('./', self.location.href).href;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([ROOT, ROOT + 'manifest.webmanifest', ROOT + 'icon-192.png'])).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('planner-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheable = (res) => res && res.ok && res.type === 'basic';

/** After a successful page load, forget the scripts/styles of older releases (the page names the files it uses). */
async function prune(html) {
  const keep = new Set(html.match(/assets\/[\w.-]+/g) || []);
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const m = new URL(req.url).pathname.match(/assets\/[\w.-]+$/);
    if (m && !keep.has(m[0])) await cache.delete(req);
  }
}

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (cacheable(res)) {
      await cache.put(ROOT, res.clone());
      res.clone().text().then(prune).catch(() => undefined);
    }
    return res;
  } catch (err) {
    const hit = await cache.match(ROOT);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) await cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (cacheable(res)) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/healthz')) return;     // data: never cached, never intercepted
  if (req.mode === 'navigate') return event.respondWith(page(req));
  if (/\/(assets|fonts|audio)\//.test(url.pathname)) return event.respondWith(cacheFirst(req));
  event.respondWith(networkFirst(req));
});

/* Phone notifications: the server sends a message shortly before something starts. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (err) { d = { title: 'Planner', body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === 'visible' && c.focused)) return;      // the open app shows its own reminder
    await self.registration.showNotification(d.title || 'Planner', {
      body: d.body || '', tag: d.tag || undefined, renotify: true, requireInteraction: true,
      icon: ROOT + 'icon-192.png', badge: ROOT + 'icon-192.png', vibrate: [200, 100, 200, 100, 400], data: { url: ROOT }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = wins.find((c) => c.url.startsWith(ROOT));
    if (mine) return mine.focus();
    return self.clients.openWindow(ROOT);
  })());
});
