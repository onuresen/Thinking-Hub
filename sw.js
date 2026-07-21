/**
 * sw.js — Thinking Hub service worker
 *
 * Strategy (no build step, so no per-deploy version bumps needed):
 *  - Precache every app asset on install → the whole app works offline.
 *  - Same-origin GETs: stale-while-revalidate — serve from cache instantly,
 *    refresh the cache in the background so updates land on the next load.
 *    Matching uses ignoreSearch because the shell loads tools with a
 *    ?v=<timestamp> cache-buster (index.html APP_LOAD_TS).
 *  - Fonts and all runtime libraries are self-hosted and precached.
 *  - The optional Anthropic API origin is passed straight to the network and
 *    never cached; enterprise-config.js can disable the application call path.
 *
 * NOTE: when a new file is added to the app, add it to PRECACHE below.
 */

const CACHE = 'thinking-hub-v1';

const PRECACHE = [
  './index.html',
  './manifest.json',
  './favicon.svg',
  './theme.css',
  './styles/fonts.css',
  // extracted tool stylesheets (P85 — inline <style> moved out for caching)
  './styles/project-hub.css',
  './styles/idea-swiper.css',
  './styles/index.css',
  './styles/schedule.css',
  './styles/meetings-hub.css',
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
  './enterprise-config.js',
  './machi-engine.js',
  './machi-achievements.js',
  './machi-hires.js',
  // vendored libraries (pinned)
  './vendor/vis-network.min.js',
  './vendor/html2canvas.min.js',
  // self-hosted Google Fonts WOFF2 subsets + OFL/source record (P93)
  './vendor/fonts/6NU58FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChjdfeQ_5Y.woff2',
  './vendor/fonts/6NU58FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChjdPeQ_5Y.woff2',
  './vendor/fonts/6NU58FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChjeveQ.woff2',
  './vendor/fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2',
  './vendor/fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxCBTeO-U.woff2',
  './vendor/fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxCFTeO-U.woff2',
  './vendor/fonts/8vIH7w4qzmVxm25L9Hz_.woff2',
  './vendor/fonts/8vIH7w4qzmVxm2BL9A.woff2',
  './vendor/fonts/8vIH7w4qzmVxm2NL9Hz_.woff2',
  './vendor/fonts/rP2Fp2ywxg089UriCZa4ET-DNl0.woff2',
  './vendor/fonts/rP2Fp2ywxg089UriCZa4Hz-D.woff2',
  './vendor/fonts/rP2Hp2ywxg089UriCZ2IHSeH.woff2',
  './vendor/fonts/rP2Hp2ywxg089UriCZOIHQ.woff2',
  './vendor/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwhsk.woff2',
  './vendor/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwhsk.woff2',
  './vendor/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwhsk.woff2',
  './vendor/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2',
  './vendor/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwhsk.woff2',
  './vendor/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwhsk.woff2',
  './vendor/fonts/OFL.txt',
  './vendor/fonts/SOURCES.md',
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
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Deployment policy is security-sensitive: when online, never serve a
    // stale aiEnabled value before checking the server. The cached copy is
    // only an offline fallback.
    if (url.pathname.endsWith('/enterprise-config.js')) {
      event.respondWith(networkFirstPolicy(req));
      return;
    }
    event.respondWith(staleWhileRevalidate(event, req));
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

async function networkFirstPolicy(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || new Response('Policy unavailable', { status: 503, statusText: 'Offline' });
  }
}
