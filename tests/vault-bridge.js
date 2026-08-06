/**
 * vault-bridge.js — Vault Bridge (P104) behavior checks.
 *
 * Dev-only, like smoke.js / flows.js. Run: node vault-bridge.js
 *
 * `showDirectoryPicker()` opens a real OS file dialog and cannot be driven
 * headlessly, so it is stubbed with a fake FileSystemDirectoryHandle backed by
 * fixture notes written in the two markdown shapes the canonical decision
 * schema actually appears in. Everything downstream is the real code path:
 * folder resolution, recursive date collection, unrecorded-day diffing against
 * live storage, note reading, decision parsing, accept/ignore, and the shell's
 * Today card + review modal.
 *
 * NOT covered here (needs a real file dialog): persisting a genuine
 * FileSystemDirectoryHandle across a reload. A plain fake object is not
 * structured-cloneable, so this file asserts the IndexedDB round-trip itself
 * instead; real handles are serializable per the File System Access spec.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.md': 'text/markdown',
};

let pass = 0, fail = 0;
function check(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? '  — ' + JSON.stringify(extra) : ''}`);
  ok ? pass++ : fail++;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end();
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

// Dates are generated relative to today so the 60-day lookback and the
// "today is not yet a gap" rule stay meaningful as time passes.
const iso = (offsetDays) =>
  new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);

const D_RECENT = iso(2);   // bulleted schema, own "### Decision — …" heading
const D_INLINE = iso(4);   // several labels inside one wrapped paragraph
const D_KNOWN = iso(6);    // hub HAS a record this day → must not be reported
const D_OLD = iso(120);    // outside the lookback → must not be reported

const NOTES = {
  [`${D_RECENT}.md`]: `---
title: ${D_RECENT}
---

# ${D_RECENT}

## Extraction session

Some prose that is not a decision at all.

### Decision — request all properties, not a wider filter list

- **Decision:** remove \`propFilter\` entirely so APS returns every property,
  rather than extending the filter with the OB parameter names from
  \`table.csv\`.
- **Why:** any fixed list encodes an assumption about which parameters matter,
  and which matter is per project.
- **Alternative:** extend \`propFilter\` with the known OB names. Rejected —
  fixes one model, silently breaks the next.
- **Revisit when:** extraction time becomes a problem on a large model.
- **Confidence:** high.

Trailing prose after the block that must not be absorbed.
`,

  // Two decisions under ONE generic section heading, with a bold run spanning a
  // line break — the two cases that previously produced duplicate titles and
  // leaked "**" into field text.
  [`${D_INLINE}.md`]: `---
title: ${D_INLINE}
---

# ${D_INLINE}

## Access and survey

**Decision:** sign in via an existing **Secure
Service Account** instead of fixing 3-legged OAuth.
**Why:** OAuth hit an unresolved callback error and a service account suits
non-interactive access.
**Alternative rejected:** debugging the callback mismatch. Deferred.
**Confidence:** med.

- **Decision:** one survey, one wave, with in-survey branching. **Why:** acting on a hypothesis before the deeper question confirms it was judged worse. **Confidence:** med-high.

**Finding:** this bold label is not part of the schema and must not capture text.
`,

  [`${D_KNOWN}.md`]: `---
title: ${D_KNOWN}
---

# ${D_KNOWN}

- **Decision:** this day already has a Hub record, so it is not a gap.
- **Confidence:** low.
`,

  [`${D_OLD}.md`]: `---
title: ${D_OLD}
---

# ${D_OLD}

- **Decision:** far outside the lookback window.
- **Confidence:** high.
`,
};

(async () => {
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  // Fake vault: <root>/daily/<year>/*.md — mirrors a real Obsidian layout.
  await page.addInitScript(({ notes }) => {
    const fileHandle = (name, text) => ({
      kind: 'file', name, getFile: async () => ({ text: async () => text }),
    });
    const dirHandle = (name, files, subs) => ({
      kind: 'directory', name,
      async *entries() {
        for (const [n, t] of Object.entries(files || {})) yield [n, fileHandle(n, t)];
        for (const [n, d] of Object.entries(subs || {})) yield [n, d];
      },
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getDirectoryHandle: async (n) => {
        if (subs && subs[n]) return subs[n];
        throw new DOMException('NotFound', 'NotFoundError');
      },
      getFileHandle: async (n) => {
        if (files && files[n]) return fileHandle(n, files[n]);
        throw new DOMException('NotFound', 'NotFoundError');
      },
    });
    const year = dirHandle('2026', notes, {});
    const daily = dirHandle('daily', {}, { 2026: year });
    window.showDirectoryPicker = async () => dirHandle('vault', { 'README.md': '# vault' }, { daily });
  }, { notes: NOTES });

  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle' });

  // The hub has evidence on D_KNOWN only.
  await page.evaluate((known) => {
    localStorage.clear();
    localStorage.setItem('decision-hub-v1', JSON.stringify([
      { id: 'seed', title: 'existing', createdAt: known + 'T10:00:00.000Z' },
    ]));
  }, D_KNOWN);

  // ── connect + cheap scan ───────────────────────────────────────────────────
  check('connect() accepts the picked vault', await page.evaluate(() => HubVaultBridge.connect()) === true);

  const status = await page.evaluate(() => HubVaultBridge.status());
  check('status reports connected', status.connected === true && status.needsPermission === false);

  const days = await page.evaluate(() => HubVaultBridge.getState().unrecordedDays);
  check('cheap scan reports days the vault has and the hub does not',
    days.includes(D_RECENT) && days.includes(D_INLINE), days);
  check('a day with a real hub timestamp is not reported as a gap', !days.includes(D_KNOWN));
  check('days outside the 60-day lookback are not reported', !days.includes(D_OLD));
  check('today is never reported as a gap', !days.includes(new Date().toISOString().slice(0, 10)));

  // ── deep scan: canonical-schema parsing ───────────────────────────────────
  const props = await page.evaluate(() => HubVaultBridge.scanDecisions());
  check('deep scan extracts one proposal per decision block', props.length === 3, props.length);

  const titles = props.map((p) => p.title);
  check('two decisions under one generic heading get distinct titles',
    new Set(titles).size === titles.length, titles);

  const bulleted = props.find((p) => /wider filter list/.test(p.title));
  check('a "### Decision — …" heading supplies the title',
    bulleted && bulleted.title === 'request all properties, not a wider filter list', bulleted && bulleted.title);
  check('all canonical schema fields are captured',
    bulleted && /remove propFilter entirely/.test(bulleted.summary)
    && /fixed list encodes an assumption/.test(bulleted.why)
    && /Rejected/.test(bulleted.alternative)
    && /extraction time becomes a problem/.test(bulleted.revisitWhen)
    && bulleted.confidence === 'high' && bulleted.hasConfidence === true);
  check('the last field stops at the blank line (no trailing prose)',
    bulleted && !/Trailing prose/.test(bulleted.revisitWhen), bulleted && bulleted.revisitWhen);

  const spanning = props.find((p) => /Secure/.test(p.summary));
  check('a bold run spanning a line break is stripped, not leaked',
    spanning && spanning.summary.includes('Secure Service Account') && !spanning.summary.includes('**'),
    spanning && spanning.summary);
  check('a non-schema bold label ("**Finding:**") captures nothing',
    !props.some((p) => /not part of the schema/.test(p.summary + p.why + p.alternative)));

  const inline = props.find((p) => /one survey/.test(p.summary));
  check('several labels inside one paragraph all parse',
    inline && /acting on a hypothesis/.test(inline.why) && inline.confidence === 'medium',
    inline && { why: !!inline.why, confidence: inline.confidence });
  check('a generic section heading is kept as context, not used as the title',
    inline && inline.context === 'Access and survey' && !/Access and survey/.test(inline.title),
    inline && inline.context);

  // ── Today card ────────────────────────────────────────────────────────────
  await page.evaluate(() => buildTodayView());
  const cardText = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#today-view .stat-card')]
      .find((el) => el.textContent.includes('Vault Bridge'));
    return c ? c.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  check('Today surfaces the gap', !!cardText && /no record of/.test(cardText));

  // ── review modal: accept / ignore ─────────────────────────────────────────
  await page.evaluate(() => openVaultReview());
  await page.waitForFunction(() => document.querySelectorAll('#vault-review-body .vb-card').length > 0);
  check('modal lists every proposal',
    await page.evaluate(() => document.querySelectorAll('#vault-review-body .vb-card').length) === 3);

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('decision-hub-v1')).length);
  await page.evaluate(() => vbAccept(0));
  const added = await page.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('decision-hub-v1'));
    return arr[arr.length - 1];
  });
  check('accept writes one Decision Hub record',
    added && added.id.startsWith('dh-vb-')
    && (await page.evaluate(() => JSON.parse(localStorage.getItem('decision-hub-v1')).length)) === before + 1);
  check('the record matches decision-hub\'s own schema',
    added && 'alternative' in added && 'revisitWhen' in added && 'outcome' in added
    && 'problemLens' in added && added.type === 'decision' && !!added.createdAt);
  check('the record links back to its source note',
    added && /daily\/2026\/.*\.md$/.test(added.obsidianNote), added && added.obsidianNote);

  await page.evaluate(() => vbIgnore(0));
  const seenVals = Object.values(await page.evaluate(() => HubVaultBridge.getState().seen));
  check('accept and ignore are both recorded',
    seenVals.includes('accepted') && seenVals.includes('ignored'), seenVals);

  check('nothing already accepted or ignored is proposed again',
    (await page.evaluate(() => HubVaultBridge.scanDecisions())).length === 1);

  // ── day dismissal ─────────────────────────────────────────────────────────
  await page.evaluate((d) => HubVaultBridge.dismissDay(d), D_RECENT);
  check('dismissDay drops that day from the gap list',
    !(await page.evaluate(() => HubVaultBridge.getState().unrecordedDays)).includes(D_RECENT));

  // ── persistence layer ─────────────────────────────────────────────────────
  const idb = await page.evaluate(async () => {
    const DB = 'thinking-hub-vault', STORE = 'handles';
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => {
        if (!q.result.objectStoreNames.contains(STORE)) q.result.createObjectStore(STORE);
      };
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ kind: 'directory', name: 'vault' }, 'probe');
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    const got = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const q = tx.objectStore(STORE).get('probe');
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    db.close();
    return { got, handleTypeExists: typeof FileSystemDirectoryHandle !== 'undefined' };
  });
  check('the handle store round-trips a serializable value',
    idb.got && idb.got.name === 'vault' && idb.handleTypeExists === true, idb);

  check('seen-state survives a reload', await (async () => {
    await page.reload({ waitUntil: 'networkidle' });
    return Object.keys(await page.evaluate(() => HubVaultBridge.getState().seen)).length === 2;
  })());

  // ── graceful degradation ──────────────────────────────────────────────────
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { delete window.showDirectoryPicker; });
  await p2.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle' });
  const unsupported = await p2.evaluate(() => ({
    supported: HubVaultBridge.isSupported(),
    cardShown: _vaultBridgeSummary().show,
  }));
  check('degrades silently without the File System Access API',
    unsupported.supported === false && unsupported.cardShown === false, unsupported);
  await p2.close();

  check('no page or console errors throughout', errors.length === 0, errors.slice(0, 3));

  await browser.close();
  server.close();
  console.log(`\n${fail === 0 ? 'ALL VAULT BRIDGE CHECKS PASSED' : fail + ' CHECK(S) FAILED'}  (${pass} passed)`);
  process.exit(fail === 0 ? 0 : 1);
})();
