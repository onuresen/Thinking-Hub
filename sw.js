/**
 * sw.js — Thinking Hub service worker
 *
 * Strategy (no build step, so no per-deploy version bumps needed):
 *  - Precache every app asset on install → the whole app works offline.
 *  - Same-origin GETs: stale-while-revalidate — serve from cache instantly,
 *    refresh the cache in the background so updates land on the next load.
 *    Matching uses ignoreSearch because the shell loads tools with a
 *    ?v=<timestamp> cache-buster (index.html APP_LOAD_TS).
 *  - Google Fonts (googleapis/gstatic): cache-first — fonts are immutable.
 *  - Every other origin (Anthropic API, favicon services…):
 *    untouched — passed straight to the network, never cached.
 *
 * NOTE: when a new file is added to the app, add it to PRECACHE below.
 */

const CACHE = 'thinking-hub-v1';
const FONT_CACHE = 'thinking-hub-fonts-v1';

const PRECACHE = [
  './index.html',
  './manifest.json',
  './favicon.svg',
  './theme.css',
  // shared JS modules
  './hub-storage.js',
  './hub-snapshots.js',
  './hub-utils.js',
  './hub-starter-data.js',
  './hub-obsidian.js',
  './hub-data.js',
  './hub-tags.js',
  './hub-links.js',
  './hub-search.js',
  './hub-tutorial.js',
  './hub-toast.js',
  './hub-bootstrap.js',
  './hub-ai.js',
  './machi-engine.js',
  './machi-achievements.js',
  './machi-hires.js',
  // vendored libraries (pinned)
  './vendor/vis-network.min.js',
  './vendor/html2canvas.min.js',
  // PWA icons
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  // tool pages
  './achievements-hub.html',
  './argument-hub.html',
  './assumptions-hub.html',
  './blocked-depth.html',
  './canvas-hub.html',
  './capture-hub.html',
  './decision-hub.html',
  './focus-hub.html',
  './frameworks-hub.html',
  './goals-hub.html',
  './graph-hub.html',
  './help-hub.html',
  './idea-swiper.html',
  './journal-hub.html',
  './kmqt-board.html',
  './learning-hub.html',
  './log-hub.html',
  './matrix-hub.html',
  './meetings-hub.html',
  './people-hub.html',
  './project-hub.html',
  './reflection-hub.html',
  './retro-hub.html',
  './review-hub.html',
  './risk-hub.html',
  './schedule.html',
  './stakeholder-hub.html',
  './tags-hub.html',
  './tool-portfolio.html',
  './town-hub.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, req));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }
  // any other origin: fall through to the network untouched
});

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(CACHE);
  let cached = await cache.match(req, { ignoreSearch: true });
  // a navigation to a bare directory URL ("/") maps to the cached index.html
  if (!cached && req.mode === 'navigate') {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/')) {
      cached = await cache.match(url.pathname + 'index.html', { ignoreSearch: true });
    }
  }
  const update = fetch(req)
    .then((res) => {
      if (res && res.ok) {
        // store under the search-stripped URL so ?v= busters hit one entry
        const clean = new URL(req.url);
        clean.search = '';
        cache.put(clean.href, res.clone());
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(update);
  if (cached) return cached;
  const fresh = await update;
  if (fresh) return fresh;
  return new Response('Offline and not cached', { status: 503, statusText: 'Offline' });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}
