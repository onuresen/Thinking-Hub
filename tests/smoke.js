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
 *  4. Security checks: every page carries CSP, no retired runtime egress hosts
 *     remain, direct Anthropic requests have the expected browser headers, and
 *     the enterprise AI policy hides UI + blocks execution before fetch.
 *  5. Shell checks on index.html: sidebar builds, HubStorage round-trips,
 *     Cmd+K opens the global search overlay (regression guard for the P57
 *     silent-breakage), service worker registers.
 *
 * Run: node smoke.js   (from tests/; needs `npm install` first)
 * Local chromium override: PW_CHROMIUM=/path/to/chrome node smoke.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8471;
const BASE = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.md': 'text/markdown', '.ico': 'image/x-icon',
};

// Console noise that is environment-dependent, not an app bug.
const NOISE = /Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/;

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
  const stylesDir = path.join(ROOT, 'styles');
  const styleFiles = fs.existsSync(stylesDir)
    ? fs.readdirSync(stylesDir).filter((f) => f.endsWith('.css')).map((f) => 'styles/' + f)
    : [];
  const fontDir = path.join(ROOT, 'vendor', 'fonts');
  const fontFiles = fs.existsSync(fontDir)
    ? fs.readdirSync(fontDir).filter((f) => /\.(woff2|txt|md)$/.test(f)).map((f) => 'vendor/fonts/' + f)
    : [];
  const mustCache = [
    ...appFiles('.html'),
    ...appFiles('.js').filter((f) => f !== 'sw.js'),
    ...styleFiles,
    ...fontFiles,
    'theme.css', 'manifest.json', 'favicon.svg',
  ];
  const missing = mustCache.filter((f) => !precached.has(f));
  check('sw.js PRECACHE covers all app files', missing.length === 0,
    missing.length ? 'missing: ' + missing.join(', ') : precached.size + ' entries');
  check('service worker treats enterprise policy as network-first',
    sw.includes("url.pathname.endsWith('/enterprise-config.js')") &&
    sw.includes('networkFirstPolicy(req)') && sw.includes("cache: 'no-store'"));

  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const releaseWorkflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  check('release version follows Semantic Versioning', /^\d+\.\d+\.\d+$/.test(version), version);
  check('changelog contains the current release',
    changelog.includes(`## [${version}] - `));
  check('tagged release workflow validates and checksums artifacts',
    releaseWorkflow.includes('test "$GITHUB_REF_NAME" = "v$version"') &&
    releaseWorkflow.includes('npm test') &&
    releaseWorkflow.includes('sha256sum "$archive"') &&
    releaseWorkflow.includes('gh release create'));

  const favicon = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
  const pngDimensions = (filename) => {
    const png = fs.readFileSync(path.join(ROOT, 'icons', filename));
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  check('Convergence is the canonical favicon',
    favicon.includes('Thinking Hub Convergence') &&
    favicon.includes('#b8f033') && favicon.includes('#ff8a5c'));
  const shellHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('shell and welcome surfaces use Convergence',
    shellHtml.includes('<img class="sidebar-logo-mark" src="favicon.svg" alt="">') &&
    (shellHtml.match(/<img src="favicon\.svg" alt=""/g) || []).length >= 1 &&
    !/>TH<\//.test(shellHtml));
  check('PWA icon dimensions match the manifest',
    JSON.stringify(pngDimensions('icon-192.png')) === '[192,192]' &&
    JSON.stringify(pngDimensions('icon-512.png')) === '[512,512]' &&
    JSON.stringify(pngDimensions('icon-maskable-512.png')) === '[512,512]');

  const pages = appFiles('.html');
  const cspValues = pages.map((f) => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || '';
  });
  const missingCsp = pages.filter((_, i) => !cspValues[i]);
  check('every app page declares Content Security Policy', missingCsp.length === 0,
    missingCsp.length ? 'missing: ' + missingCsp.join(', ') : pages.length + ' pages');
  check('all app pages share one CSP contract', new Set(cspValues).size === 1);

  const runtimeFiles = [
    ...pages,
    ...appFiles('.js').filter((f) => f !== 'sw.js'),
    'theme.css',
    ...styleFiles,
  ];
  const retiredHosts = /fonts\.googleapis\.com|fonts\.gstatic\.com|esm\.sh|google\.com\/s2\/favicons/;
  const egressHits = runtimeFiles.filter((f) => retiredHosts.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('retired runtime egress hosts are absent', egressHits.length === 0,
    egressHits.length ? 'found in: ' + egressHits.join(', ') : 'fonts, favicon CDN, esm.sh');

  // ── 2. every page loads clean ──
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
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

  const filePage = await ctx.newPage();
  const fileErrors = [];
  filePage.on('pageerror', (e) => fileErrors.push(e.message));
  filePage.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) fileErrors.push(m.text());
  });
  await filePage.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load', timeout: 20000 });
  await filePage.waitForTimeout(500);
  const fileNavCount = await filePage.evaluate(() => document.querySelectorAll('.nav-item').length);
  check('file:// shell remains usable under CSP', fileErrors.length === 0 && fileNavCount >= 10,
    fileErrors.slice(0, 2).join(' | '));
  await filePage.close();

  // ── 3. shell functionality (service workers allowed in this context) ──
  const swCtx = await browser.newContext();
  const shell = await swCtx.newPage();
  await shell.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 20000 });
  await shell.waitForTimeout(1000);

  const navCount = await shell.evaluate(() => document.querySelectorAll('.nav-item').length);
  check('sidebar builds (nav items)', navCount >= 10, navCount + ' items');

  const fontProbe = await shell.evaluate(async () => {
    await document.fonts.load('400 16px "DM Sans"');
    return {
      loaded: document.fonts.check('400 16px "DM Sans"'),
      localCss: [...document.styleSheets].some((s) => /styles\/fonts\.css$/.test(s.href || '')),
      localAssets: performance.getEntriesByType('resource').some((r) => /\/vendor\/fonts\/.+\.woff2$/.test(r.name)),
    };
  });
  check('self-hosted font CSS and WOFF2 assets load',
    fontProbe.loaded && fontProbe.localCss && fontProbe.localAssets);

  let forbiddenCspRequests = 0;
  await shell.route('https://esm.sh/**', (route) => { forbiddenCspRequests++; return route.abort(); });
  const cspBlocked = await shell.evaluate(async () => {
    try { await fetch('https://esm.sh/should-be-blocked'); return false; }
    catch { return true; }
  });
  check('CSP blocks undeclared connection origins', cspBlocked && forbiddenCspRequests === 0);

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
  await shell.keyboard.press('Escape');

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

  let apiRequest = null;
  await shell.route('https://api.anthropic.com/v1/messages', async (route) => {
    apiRequest = {
      headers: route.request().headers(),
      body: route.request().postDataJSON(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }),
    });
  });
  const aiProbe = await shell.evaluate(() => HubAI.testKey('sk-ant-smoke-test'));
  check('direct Anthropic client succeeds without runtime SDK', aiProbe.ok === true && !!apiRequest);
  check('direct Anthropic request carries browser API contract',
    apiRequest?.headers?.['anthropic-version'] === '2023-06-01' &&
    apiRequest?.headers?.['anthropic-dangerous-direct-browser-access'] === 'true' &&
    apiRequest?.body?.model === 'claude-haiku-4-5');
  const anthropicProviderProbe = await shell.evaluate(async () => {
    HubAI.setProvider('anthropic');
    HubAI.saveKey('sk-ant-smoke-provider');
    return { text: await HubAI.chat('provider switch test'), provider: HubAI.getProvider() };
  });
  check('Anthropic remains an integrated selectable provider',
    anthropicProviderProbe.provider === 'anthropic' && anthropicProviderProbe.text === 'ok');

  apiRequest = null;
  await shell.evaluate(() => {
    HubAI.setProvider('copilot-handoff');
    window.__copiedPrompts = [];
    window.__openedUrls = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { window.__copiedPrompts.push(text); } },
    });
    window.open = (url) => {
      window.__openedUrls.push(url);
      return {
        opener: window,
        location: { replace: (next) => window.__openedUrls.push(next) },
        close: () => {},
      };
    };
    window.__handoffResult = null;
    HubAI.chat('private user context', 'return three priorities')
      .catch((error) => { window.__handoffResult = { code: error.code, message: error.message }; });
  });
  await shell.getByRole('dialog', { name: 'Review Microsoft Copilot prompt' }).waitFor();
  const previewPrompt = await shell.getByLabel('Exact prompt to copy').inputValue();
  const beforeCancel = await shell.evaluate(() => ({ copied: __copiedPrompts.length, opened: __openedUrls.length }));
  await shell.getByRole('button', { name: 'Cancel' }).click();
  await shell.waitForFunction(() => window.__handoffResult !== null);
  const cancelledHandoff = await shell.evaluate(() => ({ result: __handoffResult, copied: __copiedPrompts.length, opened: __openedUrls.length }));
  check('Copilot handoff previews the exact prompt before disclosure',
    previewPrompt.includes('return three priorities') && previewPrompt.includes('private user context') &&
    beforeCancel.copied === 0 && beforeCancel.opened === 0);
  check('Copilot handoff cancel has zero clipboard, navigation, or API activity',
    cancelledHandoff.result?.code === 'COPILOT_HANDOFF_CANCELLED' &&
    cancelledHandoff.copied === 0 && cancelledHandoff.opened === 0 && apiRequest === null);

  await shell.evaluate(() => {
    window.__handoffResult = null;
    HubAI.chat('approved context', 'return one recommendation')
      .catch((error) => { window.__handoffResult = { code: error.code, message: error.message }; });
  });
  await shell.getByRole('dialog', { name: 'Review Microsoft Copilot prompt' }).waitFor();
  await shell.getByRole('button', { name: 'Copy and open Copilot' }).click();
  await shell.waitForFunction(() => window.__handoffResult !== null);
  const confirmedHandoff = await shell.evaluate(() => ({
    result: __handoffResult,
    copied: __copiedPrompts.slice(),
    opened: __openedUrls.slice(),
    provider: HubAI.getProvider(),
    configured: HubAI.isConfigured(),
  }));
  check('Copilot handoff confirmation copies exact context and opens fixed destination',
    confirmedHandoff.result?.code === 'COPILOT_HANDOFF_COMPLETE' &&
    confirmedHandoff.provider === 'copilot-handoff' && confirmedHandoff.configured === true &&
    confirmedHandoff.copied.length === 1 && confirmedHandoff.copied[0].includes('approved context') &&
    confirmedHandoff.opened.includes('https://m365.cloud.microsoft/chat/') && apiRequest === null);

  const copilotOnlyCtx = await browser.newContext({ serviceWorkers: 'block' });
  let copilotOnlyApiCalls = 0;
  await copilotOnlyCtx.route(`${BASE}/enterprise-config.js`, (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `Object.defineProperty(window,'ThinkingHubPolicy',{value:Object.freeze({aiEnabled:true,allowedAiProviders:Object.freeze(['copilot-handoff'])}),writable:false,configurable:false});document.documentElement.setAttribute('data-ai-enabled','true');`,
  }));
  await copilotOnlyCtx.route('https://api.anthropic.com/v1/messages', (route) => {
    copilotOnlyApiCalls++;
    return route.abort();
  });
  const copilotOnly = await copilotOnlyCtx.newPage();
  await copilotOnly.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 20000 });
  await copilotOnly.evaluate(() => {
    localStorage.setItem('hub-settings-v1', JSON.stringify({ aiProvider: 'anthropic', anthropicKey: 'sk-ant-existing' }));
  });
  await copilotOnly.reload({ waitUntil: 'load' });
  const copilotOnlyResult = await copilotOnly.evaluate(async () => ({
    provider: HubAI.getProvider(),
    allowed: HubAI.getAllowedProviders(),
    configured: HubAI.isConfigured(),
    keyTest: await HubAI.testKey('sk-ant-must-not-send'),
    keySave: HubAI.saveKey('sk-ant-must-not-save'),
    selectValues: [...document.querySelectorAll('#ai-provider-select option')].map(option => option.value),
  }));
  check('deployment provider allowlist overrides stored user preference',
    copilotOnlyResult.provider === 'copilot-handoff' && copilotOnlyResult.configured === true &&
    JSON.stringify(copilotOnlyResult.allowed) === '["copilot-handoff"]' &&
    JSON.stringify(copilotOnlyResult.selectValues) === '["copilot-handoff"]' &&
    copilotOnlyResult.keyTest.ok === false && copilotOnlyResult.keySave === false &&
    copilotOnlyApiCalls === 0);
  await copilotOnlyCtx.close();

  const lockedCtx = await browser.newContext({ serviceWorkers: 'block' });
  let lockedApiCalls = 0;
  await lockedCtx.route(`${BASE}/enterprise-config.js`, (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `Object.defineProperty(window,'ThinkingHubPolicy',{value:Object.freeze({aiEnabled:false}),writable:false,configurable:false});document.documentElement.setAttribute('data-ai-enabled','false');`,
  }));
  await lockedCtx.route('https://api.anthropic.com/v1/messages', (route) => {
    lockedApiCalls++;
    return route.abort();
  });
  const locked = await lockedCtx.newPage();
  await locked.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 20000 });
  const lockedResult = await locked.evaluate(async () => {
    let clipboardCalls = 0;
    let navigationCalls = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { clipboardCalls++; } },
    });
    window.open = () => { navigationCalls++; return null; };
    let error = '';
    try { await HubAI.chat('must not send'); } catch (e) { error = e.message; }
    const surfaces = [...document.querySelectorAll('.ai-surface')];
    return {
      enabled: HubAI.isEnabled(),
      configured: HubAI.isConfigured(),
      allHidden: surfaces.length > 0 && surfaces.every((el) => getComputedStyle(el).display === 'none'),
      clipboardCalls,
      navigationCalls,
      error,
    };
  });
  let allPolicySurfacesHidden = lockedResult.allHidden;
  for (const file of ['focus-hub.html', 'journal-hub.html']) {
    const policyPage = await lockedCtx.newPage();
    await policyPage.goto(`${BASE}/${file}`, { waitUntil: 'load', timeout: 20000 });
    const hidden = await policyPage.evaluate(() => {
      const surfaces = [...document.querySelectorAll('.ai-surface')];
      return HubAI.isEnabled() === false && surfaces.length > 0 &&
        surfaces.every((el) => getComputedStyle(el).display === 'none');
    });
    allPolicySurfacesHidden = allPolicySurfacesHidden && hidden;
    await policyPage.close();
  }
  check('enterprise AI policy hides all marked AI surfaces', allPolicySurfacesHidden === true,
    'shell + Focus + Journal');
  check('enterprise AI policy blocks execution before network',
    lockedResult.enabled === false && lockedResult.configured === false &&
    /disabled by your organization/i.test(lockedResult.error) && lockedApiCalls === 0 &&
    lockedResult.clipboardCalls === 0 && lockedResult.navigationCalls === 0);
  await lockedCtx.close();

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
