/**
 * flows.js — CI interaction flows (dev-only; the app has no build step).
 *
 * Behavior coverage beyond "pages load" (smoke.js): three real end-to-end
 * flows through the actual app. Runs in CI after the smoke suite.
 *
 *  1. Task lifecycle — complete a task via Project Hub's real toggle, and the
 *     shell's Today view reacts to the storage change.
 *  2. Export / import round-trip — Full Backup export then import restores
 *     every key byte-identically.
 *  3. Link + graph — a cross-tool link becomes graph nodes + an edge, and
 *     shortest-path connects them.
 *
 * Run: node flows.js   (from tests/; needs `npm install` first)
 * Local chromium override: PW_CHROMIUM=/path/to/chrome node flows.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8473;
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, BASE).pathname);
      const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|esm\.sh/, (r) => r.abort());
  const today = new Date().toISOString().slice(0, 10);

  // ── Flow 1: task lifecycle ──
  {
    const page = await ctx.newPage();
    await page.addInitScript((today) => {
      localStorage.setItem('project-hub-v1', JSON.stringify({
        projects: [{ id: 'p1', name: 'Flow Project', status: 'active', color: '#b8f033',
          tasks: [{ id: 't1', title: 'Do the thing', status: 'todo', due: today }] }],
        members: [],
      }));
    }, today);
    await page.goto(`${BASE}/project-hub.html`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    // open the project and complete the task via its real checkbox
    await page.evaluate(() => { if (typeof openProject === 'function') openProject('p1'); });
    await page.waitForTimeout(400);
    const clicked = await page.evaluate(() => {
      const cb = document.querySelector('.task-check');
      if (!cb) return false;
      cb.click();
      return true;
    });
    check('flow1: task checkbox present + clicked', clicked === true);
    await page.waitForTimeout(700);
    const done = await page.evaluate(() => {
      const ph = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      const t = ph.projects[0].tasks[0];
      return t.done === true && t.status === 'done' && !!t.completedAt;
    });
    check('flow1: real toggleTask marked task done in storage', done === true);
    await page.close();

    // shell reactivity: Today view reflects the open→done change
    const shell = await ctx.newPage();
    await shell.addInitScript((today) => {
      localStorage.setItem('project-hub-v1', JSON.stringify({
        projects: [{ id: 'p1', name: 'Flow Project', status: 'active',
          tasks: [{ id: 't1', title: 'Due today task', status: 'todo', due: today }] }],
        members: [],
      }));
    }, today);
    await shell.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await shell.evaluate(() => buildTodayView());
    await shell.waitForTimeout(300);
    const before = await shell.evaluate(() => document.getElementById('today-view').innerHTML.includes('Due today task'));
    check('flow1: Today view shows the open task', before === true);
    await shell.evaluate((today) => {
      const ph = JSON.parse(localStorage.getItem('project-hub-v1'));
      ph.projects[0].tasks[0].done = true;
      ph.projects[0].tasks[0].status = 'done';
      HubStorage.set('project-hub-v1', ph); // fires notify
      buildTodayView();
    }, today);
    await shell.waitForTimeout(300);
    const after = await shell.evaluate(() => {
      const html = document.getElementById('today-view').innerHTML;
      return html.includes('Due today task');
    });
    check('flow1: Today view drops the task once completed', after === false);
    await shell.close();
  }

  // ── Flow 2: export / import round-trip — EVERY backup key ──
  // Seeds a unique marker into every key in SCOPE_KEYS.full, exports a Full
  // Backup, wipes everything, re-imports, and asserts each key restored
  // byte-identical (so no key is ever silently dropped from backup — the P81
  // bug class). Also verifies the live API key is stripped from the export.
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    page.on('dialog', (d) => d.accept());
    const result = await page.evaluate(async () => {
      window.location.reload = () => {}; // prevent the post-import reload
      // Build a unique marker per backup key
      const seed = {};
      SCOPE_KEYS.full.forEach((k, i) => { seed[k] = { _marker: k, n: i }; });
      // hub-settings-v1 carries a secret + a bulky index that MUST be stripped on export,
      // plus a normal field that MUST survive.
      seed['hub-settings-v1'] = { _marker: 'hub-settings-v1', profile: { name: 'Onur' }, anthropicKey: 'sk-ant-SECRET-should-not-export', obsidianIndex: [1, 2, 3, 4] };
      for (const [k, v] of Object.entries(seed)) HubStorage.set(k, v);

      const payload = buildExportPayload('full', SCOPE_KEYS.full);
      const json = JSON.stringify(payload);

      // Every seeded key must appear as a restorable section (none dropped)
      const restoredKeysInPayload = Object.values(payload.storageKeys || {});
      const missingFromPayload = SCOPE_KEYS.full.filter(k => !restoredKeysInPayload.includes(k));

      // Secret + bulky index must be gone from the exported text
      const secretLeaked = json.includes('sk-ant-SECRET-should-not-export');
      const indexLeaked = json.includes('obsidianIndex');

      // Wipe ALL seeded keys
      for (const k of Object.keys(seed)) localStorage.removeItem(k);
      const allGone = Object.keys(seed).every(k => localStorage.getItem(k) === null);

      // Import via the real handler (File + FileReader)
      const file = new File([json], 'backup.json', { type: 'application/json' });
      handleImportFile({ target: { files: [file] } });
      await new Promise(r => setTimeout(r, 700));

      // Compare each restored key
      const mismatches = [];
      for (const k of Object.keys(seed)) {
        const restored = HubStorage.get(k);
        if (k === 'hub-settings-v1') continue; // settings is intentionally transformed
        if (JSON.stringify(restored) !== JSON.stringify(seed[k])) mismatches.push(k);
      }
      const settings = HubStorage.get('hub-settings-v1') || {};
      return {
        missingFromPayload, secretLeaked, indexLeaked, allGone, mismatches,
        totalKeys: SCOPE_KEYS.full.length,
        settingsMarkerKept: settings._marker === 'hub-settings-v1',
        settingsProfileKept: settings.profile && settings.profile.name === 'Onur',
      };
    });
    check('flow2: Full Backup covers every key (none dropped)', result.missingFromPayload.length === 0, result.missingFromPayload.join(', '));
    check('flow2: live API key stripped from export', result.secretLeaked === false);
    check('flow2: bulky obsidian index stripped from export', result.indexLeaked === false);
    check('flow2: all keys wiped before import', result.allGone === true);
    check(`flow2: every backup key restored byte-identical (${result.totalKeys} keys)`, result.mismatches.length === 0, result.mismatches.join(', '));
    check('flow2: hub-settings non-secret data restored', result.settingsMarkerKept && result.settingsProfileKept);
    await page.close();
  }

  // ── Flow 3: link + graph ──
  {
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('project-hub-v1', JSON.stringify({
        projects: [{ id: 'p1', name: 'Graph Project', status: 'active', tasks: [
          { id: 'ta', title: 'Task A', status: 'todo' },
          { id: 'tb', title: 'Task B', status: 'todo' },
        ] }], members: [],
      }));
      localStorage.setItem('hub-links-v1', JSON.stringify([
        { id: 'lk1', a: { tool: 'project-hub', itemId: 'ta', label: 'Task A' },
          b: { tool: 'project-hub', itemId: 'tb', label: 'Task B' }, relType: 'blocks', createdAt: new Date().toISOString() },
      ]));
    });
    await page.goto(`${BASE}/graph-hub.html`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const graph = await page.evaluate(() => {
      const hasA = nodesMap.has('project-hub::ta');
      const hasB = nodesMap.has('project-hub::tb');
      let edge = false;
      edgesDS.forEach(e => { if ((e.from === 'project-hub::ta' && e.to === 'project-hub::tb') || (e.from === 'project-hub::tb' && e.to === 'project-hub::ta')) edge = true; });
      const path = computeShortestPath('project-hub::ta', 'project-hub::tb');
      return { hasA, hasB, edge, pathLen: path ? path.length : 0 };
    });
    check('flow3: both linked task nodes exist in graph', graph.hasA && graph.hasB, JSON.stringify(graph));
    check('flow3: the link renders as a graph edge', graph.edge === true);
    check('flow3: shortest path connects them in 1 hop', graph.pathLen === 2, 'path nodes: ' + graph.pathLen);
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL FLOW CHECKS PASSED' : `\n${failures} FLOW CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
