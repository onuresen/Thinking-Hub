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

  // ── Flow 2b: encrypted export (P168) ──
  // Real button + modal + download. Decrypts with Node's Web Crypto and checks the
  // plain text equals the plain Full Backup export byte for byte (clock frozen so
  // exportedAt matches). A wrong passphrase must fail. esen-vault hub_changes.py
  // `decrypt` reads the same envelope.
  {
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-10-22T03:00:00Z'));
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      HubStorage.set('people-hub-v1', { members: [{ id: 'm1', name: 'Test Person', email: 'test@example.com' }] });
    });
    const grab = async (fn) => {
      const [dl] = await Promise.all([page.waitForEvent('download'), fn()]);
      return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
    };
    const plain = await grab(() => page.evaluate(() => {
      document.querySelector('input[name="export-scope"][value="full"]').checked = true;
      exportHubData();
    }));
    const pass = 'correct horse battery staple';
    await page.evaluate(() => openEncryptedExport());
    await page.fill('#enc-pass', 'short');
    await page.fill('#enc-pass2', 'short');
    await page.click('#enc-export-go');
    const shortMsg = await page.textContent('#enc-export-msg');
    await page.fill('#enc-pass', pass);
    await page.fill('#enc-pass2', pass + 'x');
    await page.click('#enc-export-go');
    const mismatchMsg = await page.textContent('#enc-export-msg');
    await page.fill('#enc-pass2', pass);
    const enc = await grab(() => page.click('#enc-export-go'));
    const passCleared = await page.evaluate(() => document.getElementById('enc-pass').value === '' &&
      !Object.values(localStorage).some(v => v.includes('correct horse')));
    const env = JSON.parse(enc.bytes.toString('utf8'));
    const { subtle } = require('crypto').webcrypto;
    const decrypt = async (p) => {
      const base = await subtle.importKey('raw', Buffer.from(p), 'PBKDF2', false, ['deriveKey']);
      const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(env.salt, 'base64'), iterations: env.iterations },
        base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      return Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(env.iv, 'base64') }, key, Buffer.from(env.ciphertext, 'base64')));
    };
    const out = await decrypt(pass);
    let wrongFailed = false;
    try { await decrypt(pass + '!'); } catch { wrongFailed = true; }
    check('flow2b: short passphrase refused', /12/.test(shortMsg));
    check('flow2b: mismatched passphrase refused', /match/.test(mismatchMsg));
    check('flow2b: file name', /^thinking-hub-backup-\d{4}-\d\d-\d\d\.enc\.json$/.test(enc.name), enc.name);
    check('flow2b: envelope fields', env.format === 'thinking-hub-encrypted' && env.v === 1 && env.kdf === 'PBKDF2-SHA256' &&
      env.iterations >= 600000 && Buffer.from(env.salt, 'base64').length === 16 && Buffer.from(env.iv, 'base64').length === 12);
    check('flow2b: no plain data in the envelope', !enc.bytes.toString('utf8').includes('test@example.com'));
    check('flow2b: decrypted == plain export, byte for byte', out.equals(plain.bytes), `${out.length} vs ${plain.bytes.length}`);
    check('flow2b: wrong passphrase fails', wrongFailed);
    check('flow2b: passphrase not kept', passCleared);
    if (process.env.ENC_FIXTURE_DIR) {
      fs.writeFileSync(path.join(process.env.ENC_FIXTURE_DIR, 'plain.json'), plain.bytes);
      fs.writeFileSync(path.join(process.env.ENC_FIXTURE_DIR, 'export.enc.json'), enc.bytes);
    }
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

  // ── Flow 4: ICS import lands meetings in the right place (P164) ──
  {
    // The bugs this covers only show in Tokyo time (UTC+9), so run there.
    const tokyo = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo' });
    const page = await tokyo.newPage();
    await page.goto(`${BASE}/meetings-hub.html`, { waitUntil: 'load' });
    // Dates relative to today so the import window (−30 / +90 days) keeps them.
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // An ICS UTC stamp for a Tokyo (UTC+9) wall-clock time on a given day.
    const jst = (d, h, m) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h - 9, m))
      .toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const D1 = day(3), D2 = day(4);
    const ev = (uid, title, d, h1, m1, h2, m2) =>
      `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${title}\r\nDTSTART:${jst(d, h1, m1)}\r\nDTEND:${jst(d, h2, m2)}\r\nEND:VEVENT\r\n`;
    const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'
      + ev('u-bucho', '戦略企画部会', D1, 9, 0, 10, 0)
      + ev('u-is06', '大林組様_IS06定例MTG', D1, 16, 0, 17, 0)
      + ev('u-early', '研開打合せ', D1, 8, 35, 9, 0)
      + ev('u-ak', 'AKEBONO2026_最終プレゼン', D2, 13, 0, 18, 0)
      + 'END:VCALENDAR\r\n';

    const r = await page.evaluate(({ ics, d2 }) => {
      HubStorage.set('project-hub-v1', { members: [], concepts: [], projects: [
        { id: 'p-sp', name: 'Strategic Planning Department', status: 'maintenance', tasks: [] },
        { id: 'p-is04', name: 'Autodesk IS04', status: 'done', tasks: [] },
        { id: 'p-is06', name: 'Autodesk IS06', status: 'active', tasks: [] },
        { id: 'p-ak', name: 'Akebono', status: 'active', tasks: [] },
      ] });
      data.meetings = [
        { id: 'm-old', title: '戦略企画部会', date: '2026-09-29', projectId: 'p-sp', projectName: 'Strategic Planning Department' },
        { id: 'm-hand', title: 'AKEBONO 最終プレゼン', date: d2, time: '13:00', projectId: 'p-ak', projectName: 'Akebono' },
      ].map(normalizeMeeting);
      const res = importICSText(ics, { attendees: true, location: true, description: true });
      renderList();
      const by = (t) => data.meetings.find((m) => m.title === t);
      const dupRows = [...document.querySelectorAll('.meeting-row')]
        .filter((row) => row.querySelector('.mr-dup-badge')).map((row) => row.querySelector('.mr-title').textContent);
      return {
        res, bucho: by('戦略企画部会' ) && data.meetings.filter((m) => m.title === '戦略企画部会').map((m) => m.projectId),
        is06: by('大林組様_IS06定例MTG').projectId, early: by('研開打合せ'), ak: by('AKEBONO2026_最終プレゼン').projectId,
        utcNotes: data.meetings.filter((m) => /UTC/.test(m.notes || '')).length, dupRows,
      };
    }, { ics, d2: ymd(D2) });
    check('flow4: a known title reuses its last project', r.bucho.every((p) => p === 'p-sp'), JSON.stringify(r.bucho));
    check('flow4: a project code in the title finds its project', r.is06 === 'p-is06' && r.ak === 'p-ak', `${r.is06} ${r.ak}`);
    check('flow4: no match → no project', r.early.projectId === null);
    check('flow4: import counts the guesses', r.res.guessed === 3, JSON.stringify(r.res));
    check('flow4: no "🕐 … UTC" line in notes', r.utcNotes === 0);
    check('flow4: 08:35–09:00 JST (crosses UTC midnight) keeps its 25 min', r.early.durationMins === 25 && r.early.time === '08:35',
      `${r.early.time} ${r.early.durationMins}`);
    check('flow4: same day + same title is flagged as a possible duplicate', r.dupRows.length === 2, r.dupRows.join(' | '));
    await tokyo.close();
  }

  // ── Flow 5: Schedule opens a meeting in its own panel (P164) ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/schedule.html`, { waitUntil: 'load' });
    await page.evaluate((today) => {
      HubStorage.set('project-hub-v1', { members: [], concepts: [], projects: [{ id: 'p1', name: 'Alpha', status: 'active', tasks: [] }] });
      HubStorage.set('meetings-hub-v1', { templates: [], meetings: [
        { id: 'mt1', title: 'Weekly sync', date: today, time: '10:00', durationMins: 30, projectId: null, notes: 'Agenda here',
          actionItems: [{ id: 'a1', text: 'Send the deck', done: false }], createdAt: '2026-10-01T00:00:00.000Z' },
      ] });
    }, today);
    await page.reload({ waitUntil: 'load' });
    const navs = [];
    await page.exposeFunction('__nav', (t) => navs.push(t));
    await page.evaluate(() => { window.parent.postMessage = (msg) => window.__nav(msg.type); });
    const pillCalls = await page.evaluate(() => {
      const html = meetingPillHtml({ id: 'mt1', date: '2026-10-21', title: 'Weekly sync' });
      return /openMeetingPanel\('mt1', '2026-10-21'\)/.test(html) && !/hub-navigate/.test(html);
    });
    check('flow5: a meeting pill opens the panel, not Meeting Hub', pillCalls);
    await page.evaluate((today) => openMeetingPanel('mt1', today), today);
    const shown = await page.evaluate(() => ({
      open: document.getElementById('sch-meeting-drawer').classList.contains('open'),
      text: document.getElementById('mp-body').textContent.replace(/\s+/g, ' '),
    }));
    check('flow5: the panel shows time, notes and open actions',
      shown.open && /10:00/.test(shown.text) && /Agenda here/.test(shown.text) && /Send the deck/.test(shown.text), shown.text.slice(0, 120));
    await page.selectOption('#mp-project', 'p1');
    await page.fill('#mp-outcome', 'Agree the plan');
    await page.waitForTimeout(250);   // drawer slide-in
    const box = await page.evaluate(() => {
      const r = document.querySelector('#sch-meeting-drawer .sch-save-btn').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    const saved = await page.evaluate(() => HubStorage.get('meetings-hub-v1').meetings[0]);
    check('flow5: Save writes project and outcome to the meeting',
      saved.projectId === 'p1' && saved.projectName === 'Alpha' && saved.desiredOutcome === 'Agree the plan'
      && saved.updatedAt > '2026-10-01', JSON.stringify({ p: saved.projectId, o: saved.desiredOutcome }));
    check('flow5: saving does not leave Schedule', !navs.includes('hub-navigate'), navs.join(','));
    await page.close();
  }

  // ── Flow 6: Project Hub shows what moves next (P165) ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/project-hub.html`, { waitUntil: 'load' });
    const later = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    await page.evaluate(({ soon, past, far }) => {
      HubStorage.set('project-hub-v1', { members: [], concepts: [], projects: [
        { id: 'pa', name: 'Alpha', status: 'active', color: '#888', members: [], goals: [], milestones: [], tasks: [
          { id: 't1', title: 'Write the draft', status: 'inprogress', done: false },
          { id: 't2', title: 'Old work', status: 'inprogress', done: false, archived: true },
          { id: 't3', title: 'Later', status: 'todo', done: false }] },
        { id: 'pb', name: 'Beta', status: 'active', color: '#888', members: [], goals: [], milestones: [], tasks: [] },
      ] });
      HubStorage.set('meetings-hub-v1', { templates: [], meetings: [
        { id: 'm1', title: 'Past review', date: past, projectId: 'pa' },
        { id: 'm2', title: 'Far review', date: far, projectId: 'pa' },
        { id: 'm3', title: 'Bucho review', date: soon, time: '10:00', projectId: 'pa' },
      ] });
    }, { soon: later(2), past: later(-3), far: later(20) });
    await page.reload({ waitUntil: 'load' });
    const cards = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.project-card')].map((c) =>
      [c.querySelector('.project-name').textContent, (c.querySelector('.project-next') || {}).textContent || ''])));
    const a = (cards.Alpha || '').replace(/\s+/g, ' ');
    check('flow6: the card shows the task in progress (not archived ones)', /▶ Write the draft/.test(a) && !/Old work|\+1/.test(a), a);
    check('flow6: the card shows the next upcoming meeting, not past or later ones',
      /▣ .* · Bucho review/.test(a) && !/Past review|Far review/.test(a), a);
    check('flow6: a project with nothing in motion shows no Next line', cards.Beta === '', JSON.stringify(cards.Beta));
    await page.close();
  }

  // ── Flow 7: Canvas Hub shelves a board instead of deleting it (P165) ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/canvas-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      const b = (id, name) => ({ id, name, nodes: [{ id: id + 'n', x: 0, y: 0, text: 'card', color: 'yellow' }], edges: [], lanes: [], views: [], panX: 0, panY: 0, zoom: 1 });
      HubStorage.set('canvas-v1', { boards: [b('b1', 'Keep'), b('b2', 'Old map')], activeBoardId: 'b2' });
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => toggleShelveBoard());
    await page.waitForTimeout(700);   // pulseSave debounce
    const r = await page.evaluate(() => ({
      stored: HubStorage.get('canvas-v1'),
      main: [...document.querySelectorAll('#board-select > option')].map((o) => o.textContent),
      shelved: [...document.querySelectorAll('#board-select optgroup[label="Shelved"] option')].map((o) => o.textContent),
      active: db.id,
    }));
    const old = r.stored.boards.find((b) => b.id === 'b2');
    check('flow7: a shelved board keeps its cards and is saved as shelved', old.shelved === true && old.nodes.length === 1);
    check('flow7: it leaves the main list and shows under "Shelved"',
      r.main.every((t) => !/Old map/.test(t)) && r.shelved.some((t) => /Old map/.test(t)), JSON.stringify(r));
    check('flow7: the canvas moves to a board still in the list', r.active === 'b1');
    await page.evaluate(() => { switchBoard('b2'); toggleShelveBoard(); });
    await page.waitForTimeout(700);
    const back = await page.evaluate(() => HubStorage.get('canvas-v1').boards.find((b) => b.id === 'b2'));
    check('flow7: "Bring board back" returns it to the list', !back.shelved);
    await page.close();
  }

  // ── Flow 8: a milestone can be marked reached ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/project-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      HubStorage.set('project-hub-v1', { members: [], concepts: [], projects: [
        { id: 'pa', name: 'Alpha', status: 'active', color: '#888', members: [], goals: [], tasks: [],
          milestones: [{ id: 'ms1', name: 'Pilot <b>signed</b>', date: '2026-01-10' }] },
      ] });
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => { setView('milestones'); openEditMilestone('ms1', 'pa'); });
    await page.waitForTimeout(300);   // modal transition
    await page.check('#ms-done');
    const box = await page.locator('#modal-milestone .btn-primary').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({
      ms: HubStorage.get('project-hub-v1').projects[0].milestones[0],
      text: document.querySelector('#main-content').innerText,
      html: document.querySelector('.milestone-name').innerHTML,
    }));
    check('flow8: "Reached" saves done and a completion time', r.ms.done === true && !!r.ms.completedAt, r.ms);
    check('flow8: a reached milestone shows ✓ Reached, not overdue', /✓ Reached/.test(r.text) && !/overdue/.test(r.text), r.text.slice(0, 200));
    check('flow8: the milestone name is escaped', r.html.includes('&lt;b&gt;'), r.html);
    await page.evaluate(() => openEditMilestone('ms1', 'pa'));
    await page.waitForTimeout(300);
    await page.uncheck('#ms-done');
    await page.evaluate(() => saveMilestone());
    const back = await page.evaluate(() => HubStorage.get('project-hub-v1').projects[0].milestones[0]);
    check('flow8: unticking clears it again', back.done === false && back.completedAt === '', back);
    await page.close();
  }

  // ── Flow 9: Canvas cleans card text when it draws it ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/canvas-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      const bad = 'hello <b>bold</b><img src="x" onerror="window.__pwned=1"><script>window.__pwned=2<\/script>';
      HubStorage.set('canvas-v1', { activeBoardId: 'b1', boards: [{ id: 'b1', name: 'B', edges: [], lanes: [], views: [],
        panX: 0, panY: 0, zoom: 1, nodes: [{ id: 'n1', x: 0, y: 0, w: 260, text: bad, color: 'c-gray' }] }] });
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({
      pwned: window.__pwned,
      html: document.querySelector('.node-body').innerHTML,
      label: nodeLabel(db.nodes[0]),
      lines: noteLines(db.nodes[0]),
    }));
    check('flow9: card text from storage runs no code', r.pwned === undefined, r);
    check('flow9: allowed formatting stays, the rest goes', /<b>bold<\/b>/.test(r.html) && !/img|script/i.test(r.html), r.html);
    check('flow9: labels and outlines read text without loading it', r.label === 'hello bold' && r.pwned === undefined, r.label);
    await page.close();
  }

  // ── Flow 10: a Mermaid draft (e.g. from Copilot) lands as colored cards ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/canvas-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      HubStorage.set('canvas-v1', { activeBoardId: 'b1', boards: [{ id: 'b1', name: 'B', nodes: [], edges: [], lanes: [], views: [], panX: 0, panY: 0, zoom: 1 }] });
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => openOutlineModal(''));
    await page.waitForTimeout(300);
    await page.fill('#om-text', [
      'flowchart LR',
      '  subgraph IS06 follow-up',
      '    A[Ask the steel team]:::yellow -->|blocks| B[Decide the door ID rule]',
      '  end',
      '  B --> C[Collation pilot]',
      '  class C green',
      '  D[Plain card]:::nosuchcolor',
    ].join('\n'));
    const box = await page.locator('#om-create').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const by = t => db.nodes.find(n => (n.text || '').includes(t));
      return { a: by('steel').color, c: by('Collation').color, d: by('Plain').color,
        frame: db.nodes.some(n => n.kind === 'frame' && /IS06/.test(n.text)),
        rel: db.edges.map(e => e.relType).sort().join(',') };
    });
    check('flow10: ":::yellow" and "class C green" color the cards', r.a === 'c-yellow' && r.c === 'c-green', r);
    check('flow10: an unknown class leaves the card gray', r.d === 'c-gray', r.d);
    check('flow10: subgraph → frame, "blocks" → a blocks line', r.frame && r.rel === 'blocks,relates', r);
    await page.close();
  }

  // ── Flow 11: many boards fold into one chip (P172) ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/project-hub.html`, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const card = (pid, i) => ({ id: 'n' + i, x: 0, y: 0, text: '', link: { tool: 'project-hub', id: pid, label: pid } });
      const boards = Array.from({ length: 9 }, (_, i) => ({ id: 'b' + i, name: 'Board ' + i, nodes: [card('pBig', i)].concat(i < 2 ? [card('pSmall', 100 + i)] : []) }));
      boards[0].nodes.push(card('pBig', 50));   // same board twice counts once
      HubStorage.set('canvas-v1', { boards, activeBoardId: 'b0' });
      const big = HubLinks.canvasPlacementsEl('project-hub', 'pBig');
      const small = HubLinks.canvasPlacementsEl('project-hub', 'pSmall');
      document.body.appendChild(big);
      const shownBefore = [...big.querySelectorAll('button.hl-board-chip')].filter(b => b.checkVisibility()).length;
      big.open = true;
      const shownAfter = [...big.querySelectorAll('button.hl-board-chip')].filter(b => b.checkVisibility()).length;
      return { bigTag: big.tagName, label: big.querySelector('summary').textContent, shownBefore, shownAfter,
        smallTag: small.tagName, smallChips: small.querySelectorAll('.hl-board-chip').length,
        none: HubLinks.canvasPlacementsEl('project-hub', 'nope') };
    });
    check('flow11: 9 boards fold into one "On 9 boards" chip', r.bigTag === 'DETAILS' && r.label === '▦ On 9 boards', r);
    check('flow11: folded board chips are hidden until opened', r.shownBefore === 0 && r.shownAfter === 9, JSON.stringify(r));
    check('flow11: two boards still show inline', r.smallTag === 'DIV' && r.smallChips === 2, r);
    check('flow11: no boards → nothing', r.none === null);
    await page.close();
  }

  // ── Flow 12: Signals Hub reads files on its own (P175) ──
  // Imports a reading with its request and a news file, taps Follow with real
  // mouse timing, and checks the taps file and the backup key.
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/signals-hub.html`, { waitUntil: 'load' });
    const imported = await page.evaluate(async () => {
      const request = { schema: 'signals-hub-review-request-v1', id: 'req-2026-11-08-abc', createdAt: '2026-11-08T22:45:00Z',
        evidence: [{ id: 'item:1', title: 'IFC check tools gain AI', url: 'https://a.example/1', source: 'A', date: '2026-11-07' }] };
      const review = { schema: 'signals-hub-review-v1', requestId: 'req-2026-11-08-abc', reviewer: 'Claude Code (morning run)',
        weekPlan: 'Do one thing.', followUps: [],
        newEvidence: [{ id: 'web:1', title: 'Vendor blog', url: 'https://b.example/2', source: 'B', date: '2026-11-08', summary: '' }],
        insights: [{ headline: 'Checking is the bottleneck', summary: 's', citations: ['item:1', 'web:1', 'item:404'] }],
        directions: [{ title: 'Ask a vendor about rules', kind: 'reach-out', by: '2026-11-20', whyNow: 'w', firstStep: 'f',
          draft: 'Hello', citations: ['web:1'] }] };
      const news = { schema: 'signals-hub-news-v1', createdAt: '2026-11-08T22:44:00Z',
        items: [{ title: 'News one', url: 'https://c.example/3', sourceName: 'C', publishedAt: '2026-11-08' }] };
      const file = (name, obj) => new File([JSON.stringify(obj)], name, { type: 'application/json' });
      return SignalsHubTool.importFiles([file('review.json', review), file('req.json', request), file('news-2026-11-08.json', news)]);
    });
    check('flow12: reading and news imported from files', imported.readings === 1 && imported.news === 1, JSON.stringify(imported));
    const shown = await page.evaluate(() => ({
      lead: document.querySelector('#place-radar .hero h1').textContent, sources: document.querySelectorAll('#place-radar .srcs a').length,
      missing: /1 citation without a known source/.test(document.querySelector('#place-radar .side').textContent),
      radar: document.querySelectorAll('#place-radar svg .ins').length + document.querySelectorAll('#place-radar svg .new').length,
      library: document.querySelectorAll('#place-library .item').length,
      brief: /Your calls/.test(document.querySelector('#place-brief .paper').textContent),
    }));
    check('flow12: lead insight and its sources shown; unknown citation left out', shown.lead === 'Checking is the bottleneck' && shown.sources === 3 && shown.missing, JSON.stringify(shown));
    check('flow12: radar, library and brief are drawn', shown.radar === 2 && shown.library === 3 && shown.brief, JSON.stringify(shown));
    const follow = page.locator('[data-tap="follow"]').first();
    const box = await follow.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    const after = await page.evaluate(() => ({
      on: document.querySelector('[data-tap="follow"]').classList.contains('on'),
      state: SignalsHubTool.stateFile(), stored: HubStorage.get('signals-hub-v1'),
    }));
    check('flow12: Follow tap is shown and stored', after.on && after.stored.reactions.length === 1 && after.stored.reactions[0].reaction === 'follow');
    check('flow12: taps file names the request and the move', after.state.schema === 'signals-hub-hub-state-v1' &&
      after.state.reactions[0].requestId === 'req-2026-11-08-abc' && after.state.reactions[0].index === 0 && !!after.state.updatedAt);
    check('flow12: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Flow 13: your own signals (P177) ──
  // Add a signal, link it to a project through the hub picker, move it to
  // Emerging, all with real mouse timing; the taps file carries it and other
  // tools can find it.
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/signals-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      HubStorage.set('project-hub-v1', { projects: [{ id: 'p-cdi', name: 'CDI', tasks: [] }] });
      HubStorage.set('hub-links-v1', []);
      SignalsHubTool.showPlace('mine');
    });
    const click = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    };
    await page.fill('#sig-title', 'Ontology may become an integration layer');
    await page.fill('#sig-why', 'It could connect project knowledge with AI.');
    await click(page.locator('#add-sig button[type="submit"]'));
    await click(page.locator('[data-sig="link"]').first());
    await click(page.locator('.hl-tool-tab', { hasText: 'Project Hub' }));
    await click(page.locator('.hl-item-row', { hasText: 'CDI' }).first());
    await click(page.locator('#hl-btn-confirm'));
    await page.waitForTimeout(100);
    await click(page.locator('[data-stage="emerging"]').first());
    const r = await page.evaluate(() => {
      const sig = SignalsHubTool.data.signals[0];
      return {
        n: SignalsHubTool.data.signals.length, state: sig.state, created: !!sig.createdAt, stateAt: !!sig.stateAt,
        conv: document.querySelector('#place-mine .conv').textContent.trim(),
        lane: document.querySelector('#place-mine .lanes > div:nth-child(2) .sig h3').textContent,
        file: SignalsHubTool.stateFile().signals.map((x) => x.state),
        found: HubLinks.resolveItems('signals-hub').map((x) => x.label),
      };
    });
    check('flow13: a signal is added from the form', r.n === 1 && r.created, JSON.stringify(r));
    check('flow13: linking through the hub picker counts as convergence', /1 project item/.test(r.conv), r.conv);
    check('flow13: the stage button moves it to Emerging', r.state === 'emerging' && r.stateAt && r.lane === 'Ontology may become an integration layer');
    check('flow13: the taps file and other tools see the signal', r.file[0] === 'emerging' && r.found[0] === 'Ontology may become an integration layer', JSON.stringify(r));
    check('flow13: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Flow 14: Capture is a buffer (P178) ──
  // Process saves every line to the Inbox and writes nothing elsewhere.
  // Capture never creates a project; tasks have no send button.
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/capture-hub.html`, { waitUntil: 'load' });
    const before = await page.evaluate(() => {
      HubStorage.set('capture-hub-v1', { inbox: [] });
      HubStorage.set('project-hub-v1', { projects: [{ id: 'p1', name: 'CDI', tasks: [] }] });
      HubStorage.set('decision-hub-v1', []);
      return { projects: JSON.stringify(HubStorage.get('project-hub-v1')), decisions: JSON.stringify(HubStorage.get('decision-hub-v1')) };
    });
    await page.reload({ waitUntil: 'load' });
    const click = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    };
    await page.fill('#dump-area', 'Update Digital Census with the feedback\nShould we hire a contractor?\nDecided to use Postgres');
    await page.dispatchEvent('#dump-area', 'input');
    const label = await page.textContent('#btn-parse');
    await click(page.locator('#btn-parse'));
    await click(page.locator('#btn-save-inbox'));
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({
      inbox: (HubStorage.get('capture-hub-v1').inbox || []).map((i) => i.cat).sort(),
      projects: JSON.stringify(HubStorage.get('project-hub-v1')), decisions: JSON.stringify(HubStorage.get('decision-hub-v1')),
      oldSend: document.querySelectorAll('.ic-route-btn').length,
      promote: [...document.querySelectorAll('.ic-card')].map((c) => [...c.querySelectorAll('.ic-act')].some((x) => /Promote/.test(x.textContent))),
      sendAll: typeof window.sendAll,
    }));
    check('flow14: the button says Process', /Process/.test(label) && !/Route/.test(label), label);
    check('flow14: Process saves every line to the Inbox', JSON.stringify(r.inbox) === JSON.stringify(['decision', 'question', 'task']), JSON.stringify(r.inbox));
    check('flow14: nothing is written to other tools; no Capture project', r.projects === before.projects && r.decisions === before.decisions && r.sendAll === 'undefined', r.projects);
    check('flow14: no direct send buttons; every card has Promote (P179)', r.oldSend === 0 && r.promote.length === 3 && r.promote.every(Boolean), JSON.stringify(r));
    check('flow14: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Flow 15: Inbox lifespan, Done · Keep · Promote, Journal links (P179) ──
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/capture-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      const now = new Date().toISOString();
      HubStorage.set('project-hub-v1', { projects: [{ id: 'p1', name: 'CDI', status: 'active', tasks: [] }, { id: 'p2', name: 'Old', status: 'done', tasks: [] }] });
      HubStorage.set('signals-hub-v1', { signals: [] });
      HubStorage.set('log-hub-v1', { entries: {} });
      HubStorage.set('capture-hub-v1', { inbox: [
        { id: 'c1', text: 'Update Digital Census with the feedback', cat: 'task', capturedAt: now },
        { id: 'c2', text: 'Geometry generation readiness as its own theme', cat: 'idea', capturedAt: now },
        { id: 'c3', text: 'Bay Area Council follow-up', cat: 'task', capturedAt: now },
        { id: 'c4', text: 'Good talk on IDS today', cat: 'note', capturedAt: now },
        { id: 'c5', text: 'Read the KIR paper', cat: 'learning', capturedAt: now },
      ] });
    });
    await page.reload({ waitUntil: 'load' });
    const click = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    };
    const card = (id) => page.locator(`.ic-card[data-id="${id}"]`);
    const sugg = await page.evaluate(() => [...document.querySelectorAll('.ic-card')].map((c) => [c.dataset.id, c.querySelector('.ic-life').textContent.trim(), c.querySelector('.ic-life').classList.contains('suggested')]));
    check('flow15: every item gets a suggested lifespan', sugg.every(([, , s]) => s) && sugg.find(([id]) => id === 'c1')[1].includes('Quick') && sugg.find(([id]) => id === 'c2')[1].includes('Develop'), JSON.stringify(sugg));
    await click(card('c4').locator('.ic-life'));
    await click(card('c3').locator('.ic-act', { hasText: 'Done' }));
    await click(card('c5').locator('.ic-act', { hasText: 'Keep' }));
    await click(card('c1').locator('.ic-act', { hasText: 'Promote' }));
    const projectsInMenu = await page.evaluate(() => [...document.querySelectorAll('.pm-opt')].map((o) => o.textContent.trim()));
    await click(page.locator('.pm-opt', { hasText: 'CDI' }));
    await click(card('c2').locator('.ic-act', { hasText: 'Promote' }));
    await click(page.locator('.pm-opt', { hasText: 'Signal' }));
    await click(card('c4').locator('.ic-act', { hasText: 'Promote' }));
    await click(page.locator('.pm-opt', { hasText: "Today's journal" }));
    const r = await page.evaluate(() => {
      const cap = HubStorage.get('capture-hub-v1');
      const today = HubUtils.todayLocal();
      return {
        inbox: cap.inbox.map((i) => [i.id, !!i.keptAt]), log: cap.log.map((l) => [l.id, l.outcome, l.to]),
        tasks: HubStorage.get('project-hub-v1').projects[0].tasks.map((t) => [t.title, !!t.createdAt]),
        projects: HubStorage.get('project-hub-v1').projects.length,
        signal: (HubStorage.get('signals-hub-v1').signals[0] || {}).title,
        journal: ((HubStorage.get('log-hub-v1').entries || {})[today] || {}).text || '',
        badge: document.getElementById('inbox-badge').textContent, keptHead: !!document.querySelector('.ic-kept-head'),
      };
    });
    check('flow15: Promote lists only active projects, no new project is made', projectsInMenu.some((x) => x.startsWith('✓ CDI')) && !projectsInMenu.some((x) => x.includes('Old')) && r.projects === 2, JSON.stringify(projectsInMenu));
    check('flow15: Promote to a project adds a stamped task there', JSON.stringify(r.tasks) === JSON.stringify([['Update Digital Census with the feedback', true]]), JSON.stringify(r.tasks));
    check('flow15: Promote to Signal and to the journal', r.signal === 'Geometry generation readiness as its own theme' && /^• \d\d:\d\d Good talk on IDS today$/.test(r.journal), r.journal);
    check('flow15: Done and Keep; the badge counts only waiting items', JSON.stringify(r.inbox) === JSON.stringify([['c5', true]]) && r.badge === '' && r.keptHead, JSON.stringify(r));
    check('flow15: the log records where each thought went', r.log.length === 4 && r.log.some(([id, o]) => id === 'c3' && o === 'done') && r.log.some(([id, , to]) => id === 'c1' && to === 'CDI · task'), JSON.stringify(r.log));
    await page.goto(`${BASE}/journal-hub.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const j = await page.evaluate(() => { const el = document.getElementById('lh-captures'); return { hidden: el.hidden, text: el.textContent }; });
    check('flow15: the Daily Log shows what the day\'s captures became', !j.hidden && /5 captured/.test(j.text) && /1 done/.test(j.text) && /3 moved into the hub/.test(j.text) && /1 still in Capture/.test(j.text), j.text.replace(/\s+/g, ' ').slice(0, 200));
    check('flow15: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Flow 16: read-only project hints and nicknames (P180) ──
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/capture-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      const now = new Date().toISOString();
      HubStorage.set('project-hub-v1', { projects: [
        { id: 'p1', name: 'Digital Census', status: 'active', tasks: [] },
        { id: 'p2', name: 'CDI (Construction Decision Intelligence)', status: 'active', tasks: [] },
        { id: 'p3', name: 'bSI Tokyo 2026', status: 'active', tasks: [] },
        { id: 'p4', name: 'Akebono', status: 'active', tasks: [] },
        { id: 'p5', name: 'ONES', status: 'active', tasks: [] },
      ] });
      HubStorage.set('capture-hub-v1', { inbox: [
        { id: 'i1', text: 'Update Digital Census with 部会 feedback', cat: 'task', capturedAt: now },
        { id: 'i2', text: 'continue work on the summit report', cat: 'task', capturedAt: now },
        { id: 'i3', text: 'Town Reboot slides for Friday', cat: 'task', capturedAt: now },
        { id: 'i4', text: 'the cdi of things and ONESIE jokes', cat: 'note', capturedAt: now },
        { id: 'i5', text: 'Talk on construction decision intelligence', cat: 'note', capturedAt: now },
      ] });
    });
    await page.reload({ waitUntil: 'load' });
    const click = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    };
    const before = await page.evaluate(() => JSON.stringify(HubStorage.get('project-hub-v1')));
    await click(page.locator('.nick-btn'));
    await page.fill('#nick-p3', 'bSI, summit');
    await page.fill('#nick-p4', 'Town Reboot、タウンリブート');
    await click(page.locator('#nick-save'));
    await page.waitForTimeout(100);
    const hints = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ic-card')].map((c) => [c.dataset.id, (c.querySelector('.ic-likely b') || {}).textContent || ''])));
    check('flow16: project names give hints; short names match whole words only', hints.i1 === 'Digital Census' && hints.i5 === 'CDI (Construction Decision Intelligence)' && hints.i4 === '', JSON.stringify(hints));
    check('flow16: nicknames saved in the editor give hints', hints.i2 === 'bSI Tokyo 2026' && hints.i3 === 'Akebono', JSON.stringify(hints));
    await click(page.locator('.ic-card[data-id="i3"] .ic-act', { hasText: 'Promote' }));
    const first = await page.evaluate(() => { const o = document.querySelector('.pm-opt'); return { text: o.textContent, likely: o.classList.contains('likely') }; });
    await page.keyboard.press('Escape');
    const r = await page.evaluate(() => ({ projects: JSON.stringify(HubStorage.get('project-hub-v1')), nick: HubStorage.get('capture-hub-v1').nicknames }));
    check('flow16: Promote lists the likely project first', first.likely && /Akebono/.test(first.text), JSON.stringify(first));
    check('flow16: hints write nothing; nicknames are stored in Capture', r.projects === before && JSON.stringify(r.nick.p4) === JSON.stringify(['Town Reboot', 'タウンリブート']), JSON.stringify(r.nick));
    check('flow16: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Flow 17: one place to write (P181) ──
  // The Home box sends a line to Capture or to today's journal; `log:` in
  // Cmd+K does the same as the journal option; Capture labels the line.
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      HubStorage.set('capture-hub-v1', { inbox: [] });
      HubStorage.set('log-hub-v1', { entries: {} });
      if (typeof switchDashView === 'function') switchDashView('today');
      if (typeof closeApp === 'function') closeApp();
    });
    const click = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    };
    await click(page.locator('#home-write-text'));
    await page.keyboard.type('Follow up Bay Area Council');
    await page.keyboard.press('Enter');
    await click(page.locator('.hw-opt[data-to="log"]'));
    await page.keyboard.type('Good talk on IDS today');
    await page.keyboard.press('Enter');
    await page.evaluate(() => HubSearch.openSearch());
    await page.fill('#hub-search-input', 'log: Shipped the Capture plan');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({
      inbox: (HubStorage.get('capture-hub-v1').inbox || []).map((i) => i.text),
      log: ((HubStorage.get('log-hub-v1').entries || {})[HubUtils.todayLocal()] || {}).text || '',
      box: document.getElementById('home-write-text').value,
    }));
    check('flow17: the Home box captures by default', JSON.stringify(r.inbox) === JSON.stringify(['Follow up Bay Area Council']), JSON.stringify(r.inbox));
    check('flow17: the journal option and log: add timed lines to today', /^• \d\d:\d\d Good talk on IDS today\n• \d\d:\d\d Shipped the Capture plan$/.test(r.log) && r.box === '', r.log);
    await page.goto(`${BASE}/capture-hub.html`, { waitUntil: 'load' });
    const label = await page.evaluate(() => document.querySelector('.ic-card .ic-cat-label').textContent);
    check('flow17: Capture labels a line that came from Home', label === 'Task', label);
    check('flow17: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Flow 18: Project Hub Compact display (P182) ──
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/project-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      const mk = (id, name, group) => ({ id, name, group, color: '#5b8def', status: 'active', desc: '', tasks: [{ id: id + 't', title: 'Draft', done: false, status: 'inprogress' }], members: [] });
      HubStorage.set('project-hub-v1', { members: [], projects: [mk('a', 'Autodesk IS06', 'Industrial'), mk('b', 'CDI', 'Decision'), mk('c', 'Digital Census', 'Strategy'), mk('d', 'Akebono', '')] });
      const sess = JSON.parse(localStorage.getItem('hub-session-v1') || '{}'); delete sess.projectDisplay; localStorage.setItem('hub-session-v1', JSON.stringify(sess));
    });
    await page.reload({ waitUntil: 'load' });
    errors.length = 0; // the first load still saw thin sample data from earlier flows
    const click = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    };
    const before = await page.evaluate(() => ({ cards: document.querySelectorAll('.project-card').length, tiles: document.querySelectorAll('.compact-tile').length }));
    check('flow18: Cards stay the default', before.cards === 4 && before.tiles === 0, JSON.stringify(before));
    await click(page.locator('.ov-view-btn', { hasText: 'Compact' }));
    const compact = await page.evaluate(() => ({
      tiles: document.querySelectorAll('.compact-tile').length, jump: document.querySelectorAll('.ct-jump-chip').length,
      saved: JSON.parse(localStorage.getItem('hub-session-v1') || '{}').projectDisplay,
      data: Object.keys(HubStorage.get('project-hub-v1')).sort().join(','),
    }));
    check('flow18: Compact shows tiles and a Jump-to row; the choice is a per-browser view setting', compact.tiles === 4 && compact.jump === 4 && compact.saved === 'compact' && !/display/i.test(compact.data), JSON.stringify(compact));
    await page.mouse.click(5, 5);
    await page.keyboard.press('/');
    await page.keyboard.type('census');
    await page.waitForTimeout(450);
    const found = await page.evaluate(() => ({ tiles: [...document.querySelectorAll('.compact-tile')].map((t) => t.querySelector('.ct-name').innerHTML) }));
    check('flow18: "/" focuses search; matches are highlighted', found.tiles.length === 1 && /<mark>Census<\/mark>/.test(found.tiles[0]), JSON.stringify(found));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => state.selectedProject);
    check('flow18: Enter opens the first match', opened === 'c', String(opened));
    await page.reload({ waitUntil: 'load' });
    const kept = await page.evaluate(() => document.querySelectorAll('.compact-tile').length > 0 || document.querySelector('.view-title, h1') !== null);
    check('flow18: the display choice survives a reload', await page.evaluate(() => JSON.parse(localStorage.getItem('hub-session-v1')).projectDisplay === 'compact') && kept);
    check('flow18: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL FLOW CHECKS PASSED' : `\n${failures} FLOW CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
