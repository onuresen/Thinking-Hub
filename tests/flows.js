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

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL FLOW CHECKS PASSED' : `\n${failures} FLOW CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
