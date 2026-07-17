/**
 * smoke.js — Thinking Hub smoke suite (dev-only; the app has no build step).
 *
 * What it does:
 *  1. Serves the repo root over http with a tiny embedded static server.
 *  2. Static consistency check: every app *.html and *.js file must be listed
 *     in sw.js's PRECACHE (the offline cache manifest) — catches the classic
 *     "added a tool, forgot the service worker" mistake.
 *  3. Loads EVERY *.html page in the repo root in headless Chromium and fails
 *     on any real JS error (pageerror, or console.error that isn't network
 *     noise). New tools are covered automatically — no list to maintain.
 *  4. Shell checks on index.html: sidebar builds, HubStorage round-trips,
 *     Cmd+K opens the global search overlay (regression guard for the P57
 *     silent-breakage), service worker registers.
 *
 * Run: node smoke.js   (from tests/; needs `npm install` first)
 * Local chromium override: PW_CHROMIUM=/path/to/chrome node smoke.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8471;
const BASE = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.md': 'text/markdown', '.ico': 'image/x-icon',
};

// Console noise that is environment-dependent, not an app bug: failed network
// resource loads (fonts/CDN/favicon fetches vary by sandbox and network).
const NOISE = /Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|fonts\.g/;

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, BASE).pathname);
      let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function appFiles(ext) {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(ext) && !f.startsWith('.'));
}

(async () => {
  // ── 1. sw.js PRECACHE consistency ──
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const precached = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
  const mustCache = [
    ...appFiles('.html'),
    ...appFiles('.js').filter((f) => f !== 'sw.js'),
    'theme.css', 'manifest.json', 'favicon.svg',
  ];
  const missing = mustCache.filter((f) => !precached.has(f));
  check('sw.js PRECACHE covers all app files', missing.length === 0,
    missing.length ? 'missing: ' + missing.join(', ') : precached.size + ' entries');

  // ── 2. every page loads clean ──
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  // abort font requests: they're visual-only, already noise-filtered, and in a
  // network-restricted sandbox each page would otherwise stall on them
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

  const pages = appFiles('.html');
  for (const file of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text());
    });
    try {
      await page.goto(`${BASE}/${file}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(500);
      check(`${file} loads with no JS errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    } catch (e) {
      check(`${file} loads with no JS errors`, false, String(e).slice(0, 120));
    }
    await page.close();
  }

  // ── 3. shell functionality (service workers allowed in this context) ──
  const swCtx = await browser.newContext();
  await swCtx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const shell = await swCtx.newPage();
  await shell.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 20000 });
  await shell.waitForTimeout(1000);

  const navCount = await shell.evaluate(() => document.querySelectorAll('.nav-item').length);
  check('sidebar builds (nav items)', navCount >= 10, navCount + ' items');

  const roundTrip = await shell.evaluate(() => {
    window.HubStorage.set('__smoke-test', { ok: 1 });
    const v = window.HubStorage.get('__smoke-test');
    window.HubStorage.set('__smoke-test', null);
    return v && v.ok === 1 && window.HubStorage.get('__smoke-test') === null;
  });
  check('HubStorage set/get/delete round-trip', roundTrip === true);

  await shell.keyboard.press('Control+k');
  await shell.waitForTimeout(300);
  const searchOpen = await shell.evaluate(() => {
    const el = document.getElementById('hub-search-overlay');
    return !!el && el.style.display !== 'none';
  });
  check('Cmd/Ctrl+K opens global search overlay', searchOpen);

  const swRegistered = await shell.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    for (let i = 0; i < 20; i++) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  });
  check('service worker registers on http', swRegistered === true, String(swRegistered));

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
