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

  const securityTxt = fs.readFileSync(path.join(ROOT, '.well-known', 'security.txt'), 'utf8');
  check('security.txt exposes a contact and expiry (RFC 9116)',
    /^Contact:\s*\S+/m.test(securityTxt) && /^Expires:\s*\S+/m.test(securityTxt));
  const sbom = JSON.parse(fs.readFileSync(path.join(ROOT, 'sbom.cdx.json'), 'utf8'));
  check('CycloneDX SBOM is valid and lists runtime components',
    sbom.bomFormat === 'CycloneDX' &&
    Array.isArray(sbom.components) &&
    sbom.components.some((c) => c.name === 'vis-network') &&
    sbom.metadata && sbom.metadata.component && sbom.metadata.component.version === version);
  check('accessibility statement is present',
    fs.existsSync(path.join(ROOT, 'docs', 'ACCESSIBILITY.md')));

  const favicon = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
  const pngDimensions = (filename) => {
    const png = fs.readFileSync(path.join(ROOT, 'icons', filename));
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  check('the golden hub is the canonical favicon',
    favicon.includes('<title id="title">Thinking Hub</title>') &&
    favicon.includes('data:image/png;base64,'));
  const shellHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('shell and welcome surfaces use the hub favicon',
    shellHtml.includes('<img class="sidebar-logo-mark" src="favicon.svg" alt="">') &&
    (shellHtml.match(/<img src="favicon\.svg" alt=""/g) || []).length >= 1 &&
    !/>TH<\//.test(shellHtml));
  {
    // Machi Hub mirrors the sidebar. A deleted tool must not linger as a building.
    const appsBlock = shellHtml.slice(shellHtml.indexOf('const APPS'), shellHtml.indexOf('];', shellHtml.indexOf('const APPS')));
    const appIds = [...appsBlock.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1]).sort();
    const townHtml = fs.readFileSync(path.join(ROOT, 'town-hub.html'), 'utf8');
    const pagesBlock = townHtml.slice(townHtml.indexOf('const HUB_PAGES'), townHtml.indexOf('};', townHtml.indexOf('const HUB_PAGES')));
    const pageIds = [...pagesBlock.matchAll(/'([a-z-]+)': \[/g)].map((m) => m[1]).sort();
    check('Machi Hub pages match the sidebar tools',
      appIds.length > 10 && JSON.stringify(appIds) === JSON.stringify(pageIds),
      'sidebar ' + appIds.length + ' / machi ' + pageIds.length);
  }
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
  const retiredHosts = /fonts\.googleapis\.com|fonts\.gstatic\.com|esm\.sh/;
  const egressHits = runtimeFiles.filter((f) => retiredHosts.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('retired runtime egress hosts are absent', egressHits.length === 0,
    egressHits.length ? 'found in: ' + egressHits.join(', ') : 'fonts CDN, esm.sh');

  // tool-portfolio.html, stakeholder-hub.html, and canvas-hub.html (Tool
  // quick-add nodes, P112) intentionally re-enabled Google's favicon service
  // (user request, 2026-07-27 / 2026-07-28 / 2026-09-25) — every OTHER page
  // must stay favicon-fetch-free.
  const faviconHost = /google\.com\/s2\/favicons/;
  const faviconPages = ['tool-portfolio.html', 'stakeholder-hub.html', 'canvas-hub.html'];
  const unexpectedFaviconUse = runtimeFiles.filter((f) => !faviconPages.includes(f) && faviconHost.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('favicon CDN use is confined to the opted-in pages', unexpectedFaviconUse.length === 0,
    unexpectedFaviconUse.length ? 'found in: ' + unexpectedFaviconUse.join(', ') : 'ok');
  const missingFaviconFetch = faviconPages.filter((f) => !faviconHost.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('all opted-in pages actually fetch favicons', missingFaviconFetch.length === 0,
    missingFaviconFetch.length ? 'missing in: ' + missingFaviconFetch.join(', ') : faviconPages.join(', '));
  // google.com/s2/favicons 301-redirects to a per-domain gstatic shard
  // (t0-t3.gstatic.com). CSP is enforced on redirect targets too, so allowing
  // only the entry host silently blocks every favicon (regression fixed
  // 2026-07-28). Both hosts must stay in img-src.
  const tpCsp = cspValues[pages.indexOf('tool-portfolio.html')];
  check('tool-portfolio.html fetches favicons and CSP allows the host',
    faviconHost.test(fs.readFileSync(path.join(ROOT, 'tool-portfolio.html'), 'utf8')) &&
    tpCsp.includes('https://www.google.com'));
  check('CSP allows the favicon redirect target (gstatic shards)',
    tpCsp.includes('https://*.gstatic.com'));

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

  // Canvas connections must actually paint. A 0×0 <svg> disables rendering
  // per the SVG spec, so edges existed in the DOM but were invisible (P125).
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/tags-hub.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('canvas-v1', JSON.stringify({
      activeBoardId: 'b1',
      boards: [{ id: 'b1', name: 'T', panX: 0, panY: 0, zoom: 1, edges: [{ id: 'e1', from: 'a', to: 'b', relType: 'relates' }],
        nodes: [{ id: 'a', x: 100, y: 100, text: 'A', color: '' }, { id: 'b', x: 500, y: 400, text: 'B', color: '' }] }],
    })));
    await page.goto(`${BASE}/canvas-hub.html`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const edge = await page.evaluate(() => {
      const svg = document.getElementById('edges-svg');
      const cs = getComputedStyle(svg);
      return { w: parseFloat(cs.width), h: parseFloat(cs.height), lines: svg.querySelectorAll('line').length };
    });
    check('canvas edge layer is renderable (non-zero SVG size) and draws the edge',
      edge.w > 0 && edge.h > 0 && edge.lines >= 1, JSON.stringify(edge));

    // Layout tools (P127): align, tidy grid, and a save must not rebuild nodes.
    const lay = await page.evaluate(() => {
      db.nodes.push({ id: 'c', x: 250, y: 30, text: 'C', color: '' });
      renderAll();
      const elBefore = document.querySelector('.node[data-id="a"]');
      pulseSave();
      return new Promise(res => setTimeout(() => {
        const kept = document.querySelector('.node[data-id="a"]') === elBefore;
        selectedIds = new Set(['a', 'b', 'c']); applySelectionClasses();
        alignNodes('left');
        const aligned = new Set(db.nodes.map(n => n.x)).size === 1;
        selectNode(null); tidyGrid();
        const r = [...document.querySelectorAll('.node')].map(e => e.getBoundingClientRect());
        let overlaps = 0;
        for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
          if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) overlaps++;
        undo(); undo();
        res({ kept, aligned, overlaps, restored: db.nodes.find(n => n.id === 'c').x === 250 });
      }, 700));
    });
    check('canvas layout: align, tidy grid, undo, and own saves keep nodes',
      lay.kept && lay.aligned && lay.overlaps === 0 && lay.restored, JSON.stringify(lay));

    // Node menu, focus, find (P128)
    const g1 = await page.evaluate(() => {
      openNodeMenu('a', 200, 200);
      const menu = [...document.querySelectorAll('#node-menu .qm-item')].map(b => b.textContent);
      closeNodeMenu();
      setFocus('a');
      const dimmed = [...document.querySelectorAll('.node.dimmed')].map(e => e.dataset.id);
      clearFocus();
      const n0 = db.nodes.length; duplicateNodes(['a']); const dup = db.nodes.length === n0 + 1; undo();
      openFind(); renderFind('B'); const found = findResults.map(r => r.node.id); closeFind();
      return { menu: menu.length, dimmed, dup, found };
    });
    check('canvas node menu, focus mode and find work',
      g1.menu >= 4 && g1.dimmed.join() === 'c' && g1.dup && g1.found.join() === 'b', JSON.stringify(g1));

    // Frames, line labels, fade parked (P129)
    const g2 = await page.evaluate(() => {
      const fid = createFrame(50, 50, 700, 600, 'Zone');
      const inside = frameContents(db.nodes.find(n => n.id === fid)).map(n => n.id).sort().join();
      const passThrough = getComputedStyle(document.querySelector('.node.frame')).pointerEvents;
      const e = db.edges[0]; e.label = 'needs'; renderEdges();
      const drawn = [...document.querySelectorAll('#edges-svg text')].some(t => t.textContent === 'needs');
      openFind();
      const typing = isTyping(); closeFind();
      undo();
      return { inside, passThrough, drawn, typing };
    });
    check('canvas frames hold their contents, lines show labels, typing guard works',
      g2.inside === 'a,b,c' && g2.passThrough === 'none' && g2.drawn && g2.typing, JSON.stringify(g2));

    // Copy/paste, duplicate board, board file import with cleaning (P130)
    const g3 = await page.evaluate(() => {
      const before = fullState.boards.length;
      selectedIds = new Set(['a', 'b']); selectedNodeId = 'b';
      copySelection(false);
      const copied = canvasClipboard.nodes.length + '/' + canvasClipboard.edges.length;
      duplicateBoard();
      const dupOk = fullState.boards.length === before + 1 && db.nodes.every(n => !['a', 'b', 'c'].includes(n.id));
      const n0 = db.nodes.length; pasteClipboard({ x: 0, y: 0 }); const pasted = db.nodes.length - n0;
      const r = importBoardText(JSON.stringify({ format: 'thinking-hub-canvas-board', board: { name: 'X',
        nodes: [{ id: 'z', x: 0, y: 0, text: '<img src=x onerror="window.__bad=1">ok<b onclick="x">b</b>' }], edges: [] } }));
      const clean = db.nodes[0].text;
      return { copied, dupOk, pasted, imported: r.nodes, clean, bad: !!window.__bad };
    });
    check('canvas copy/paste, duplicate board and safe board import work',
      g3.copied === '2/1' && g3.dupOk && g3.pasted === 2 && g3.imported === 1 && g3.clean === 'ok<b>b</b>' && !g3.bad,
      JSON.stringify(g3));

    // Layers: bands behind the board, headers pinned, undo, board file (P131)
    const g4 = await page.evaluate(() => {
      const lane = createLane('col', -30, 260, 'Col A');
      const head = document.querySelector(`.lane-head[data-id="${lane.id}"]`);
      const top0 = head.getBoundingClientRect().top;
      db.panY -= 500; updateTransform();
      const pinned = Math.abs(head.getBoundingClientRect().top - top0) < 1;
      const passThrough = getComputedStyle(document.getElementById('lane-bands')).pointerEvents;
      undo();
      const undone = (db.lanes || []).length === 0;
      const r = importBoardText(JSON.stringify({ format: 'thinking-hub-canvas-board', board: { name: 'L', nodes: [],
        lanes: [{ axis: 'row', label: 'R', start: 10, size: 100, color: 'c-blue' }, { axis: 'bad' }] } }));
      return { pinned, passThrough, undone, imported: db.lanes.length, bands: document.querySelectorAll('.lane-band').length };
    });
    check('canvas layers pin their headers, let clicks through, undo and import',
      g4.pinned && g4.passThrough === 'none' && g4.undone && g4.imported === 1 && g4.bands === 1, JSON.stringify(g4));

    // Saved views, jump to frame, present mode (P132)
    const g5 = await page.evaluate(() => {
      createFrame(0, 0, 400, 300, 'F1'); createFrame(0, 600, 400, 300, 'F2');
      db.zoom = 1; db.panX = 0; db.panY = 0; updateTransform();
      saveView(4, 'Home');
      db.panX = -2000; updateTransform();
      goView(4);
      const back = Math.abs(db.panX) < 1 || !!viewAnim; // animation may still be running
      enterPresent();
      const first = document.getElementById('pb-text').textContent;
      presentStep(1);
      const second = document.getElementById('pb-text').textContent;
      exitPresent();
      return { back, first, second, off: !document.body.classList.contains('presenting'), slot: views()[0].slot };
    });
    check('canvas saved views and present mode step through frames',
      g5.back && /^1 \/ 2 · F1/.test(g5.first) && /^2 \/ 2 · F2/.test(g5.second) && g5.off && g5.slot === 4, JSON.stringify(g5));

    // Whole-board PNG export at 2x, independent of zoom (P133)
    const g6 = await page.evaluate(async () => {
      db.zoom = 0.3; updateTransform();
      const b = exportBounds();
      const r = await buildBoardPng();
      return { w: r.width, h: r.height, type: r.blob.type, size: r.blob.size,
        minW: Math.round((b.R - b.L) * 2) };
    });
    check('canvas PNG export renders the whole board at 2x',
      g6.type === 'image/png' && g6.size > 1000 && g6.w >= g6.minW, JSON.stringify(g6));

    // Linked cards for more hubs, note → decision, lines → Dependency Graph,
    // Obsidian .canvas round trip (P134)
    const g7 = await page.evaluate(() => {
      HubStorage.set('decision-hub-v1', []);
      HubStorage.set('risk-hub-v1', { risks: [{ id: 'rk1', title: 'Vendor exits', status: 'open', probability: 2, impact: 3 }] });
      db.nodes = []; db.edges = []; db.lanes = []; renderAll();
      createLinkedNode(0, 0, 'risk', 'risk-hub', 'rk1', 'old name');
      const riskId = db.nodes[0].id;
      createNode(300, 0);
      const note = db.nodes[1];
      note.text = 'Pick one vendor<br>Cheaper to support';
      convertNote(note.id, 'decision');
      const dec = (HubStorage.get('decision-hub-v1') || [])[0] || {};
      createEdge(riskId, note.id);
      db.edges[0].relType = 'blocks';
      const sent = sendEdgeToGraph(db.edges[0]);
      const link = HubLinks.getAll().find(l => l.a.itemId === 'rk1' && l.b.itemId === dec.id) || {};
      const riskName = document.querySelector('.node.k-risk .nk-name').textContent;
      let json = null;
      const orig = window.downloadText;
      window.downloadText = (name, text) => { json = { name, data: JSON.parse(text) }; };
      exportObsidianCanvas();
      window.downloadText = orig;
      importBoardText(JSON.stringify(json.data), 'round.canvas');
      return { riskName, kind: note.kind, dec: dec.title, sum: dec.summary, sent, rel: link.relType, file: json.name,
        types: json.data.nodes.map(n => n.type).join(), back: db.nodes.map(n => n.kind).sort().join(), backRel: db.edges.map(e => e.relType).join() };
    });
    // Templates, system map, graph pull (P136)
    const g9 = await page.evaluate(() => {
      const n0 = fullState.boards.length;
      window.prompt = () => 'T';
      newBoardFrom({ builtin: BUILTIN_TEMPLATES.find(t => t.id === 'dependency') });
      const cols = db.lanes.filter(l => l.axis === 'col').length, readMe = db.nodes.some(n => n.kind === 'frame' && n.text === 'Read me');
      createNode(0, 0); db.nodes[db.nodes.length - 1].text = 'note';
      saveBoardAsTemplate();
      const tpl = fullState.templates.find(t => t.name === 'T');
      return { boards: fullState.boards.length - n0, cols, readMe, view: views()[0] && views()[0].name, tpl: tpl && tpl.nodes.length };
    });
    check('canvas creates boards from templates and saves your own',
      g9.boards === 1 && g9.cols === 5 && g9.readMe && g9.view === 'Whole map' && g9.tpl === 3, JSON.stringify(g9));

    // Speaker notes, slides zip, interactive HTML (P137)
    const g10 = await page.evaluate(async () => {
      db.nodes = []; db.edges = []; renderAll();
      createNode(0, 0); createNode(260, 0);
      const [a, b] = db.nodes;
      a.text = 'Alpha'; b.text = 'Beta';
      createEdge(a.id, b.id);
      wrapInFrame([a.id, b.id]);
      const f = db.nodes.find(n => n.kind === 'frame');
      openNotesModal(f.id); document.getElementById('nm-text').value = 'Say <b>this</b>'; saveNotesModal();
      enterPresent();
      const shown = document.getElementById('present-notes').textContent;
      exitPresent();
      const zip = makeZip([{ name: 'a.txt', data: new TextEncoder().encode('hi') }]);
      const sig = new Uint8Array(await zip.slice(0, 4).arrayBuffer()).join();
      let html = '';
      const orig = downloadBlob; downloadBlob = async bl => { html = await bl.text(); };
      window.confirm = () => true;
      await exportInteractiveHtml();
      downloadBlob = orig;
      await new Promise(r => setTimeout(r, 50));
      const back = importBoardText(JSON.stringify({ format: 'thinking-hub-canvas-board', version: 1, board: { name: 'n', nodes: db.nodes, edges: db.edges } }), 'n.json');
      return { notes: f.notes, shown, sig, csp: /default-src 'none'/.test(html), viewer: html.includes('thxViewer') || html.includes('thx-stage'),
        hasNotes: html.includes('Say <b>') === false && html.includes('Say \\u003cb>this'), kept: back.board.nodes.some(n => n.notes === 'Say <b>this</b>') };
    });
    check('canvas keeps speaker notes, zips slides and exports an interactive HTML file',
      g10.notes === 'Say <b>this</b>' && g10.shown === 'Say <b>this</b>' && g10.sig === '80,75,3,4' && g10.csp && g10.viewer && g10.hasNotes && g10.kept,
      JSON.stringify(g10));

    // Flow layout + outline/Mermaid paste (P135)
    const g8 = await page.evaluate(() => {
      db.nodes = []; db.edges = []; renderAll();
      openOutlineModal('flowchart LR\n A[One] --> B[Two] -->|needs| C[Three]\n subgraph S [Box]\n  D[Four]\n end');
      createFromOutline();
      const t = s => db.nodes.find(n => n.kind !== 'frame' && n.text === s);
      const A = t('One'), B = t('Two'), C = t('Three');
      const before = A.x;
      A.x = 900; renderAll(); selectedIds = new Set();
      arrangeFlow('lr');
      return { n: db.nodes.length, frames: db.nodes.filter(n => n.kind === 'frame').length,
        rel: db.edges.find(e => e.from === B.id).relType, order: A.x < B.x && C.x < B.x, reset: A.x === before };
    });
    check('canvas pastes Mermaid into cards and arranges them along their lines',
      g8.n === 5 && g8.frames === 1 && g8.rel === 'depends-on' && g8.order, JSON.stringify(g8));

    check('canvas links more hubs, turns notes into items, sends lines, round-trips .canvas',
      g7.riskName === 'Vendor exits' && g7.kind === 'decision' && g7.dec === 'Pick one vendor' && g7.sum === 'Cheaper to support' &&
      g7.sent === 'added' && g7.rel === 'blocks' && /\.canvas$/.test(g7.file) && g7.types === 'text,text' &&
      g7.back === 'decision,risk' && g7.backRel === 'blocks', JSON.stringify(g7));
    await page.close();
  }

  // "Today" must be the local calendar day. toISOString() is UTC, so in Tokyo
  // before 09:00 it gave yesterday's date (P126). Pin the clock to 07:30 JST.
  {
    const tzCtx = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo' });
    const page = await tzCtx.newPage();
    await page.clock.setFixedTime(new Date('2026-09-29T22:30:00Z')); // 07:30 JST on 09-30
    await page.goto(`${BASE}/journal-hub.html`, { waitUntil: 'load' });
    const tz = await page.evaluate(() => ({
      today: HubUtils.todayLocal(),
      stamp: HubUtils.isoToLocalDay('2026-09-29T22:37:32.189Z'),
      plain: HubUtils.isoToLocalDay('2026-09-29'),
      daily: lhTodayStr(),
    }));
    check('local-day helpers use the local calendar day (07:30 JST)',
      tz.today === '2026-09-30' && tz.stamp === '2026-09-30' && tz.plain === '2026-09-29' && tz.daily === '2026-09-30',
      JSON.stringify(tz));
    await tzCtx.close();
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

  // ── User preference: "Show AI Assistant" (separate from the policy above) ──
  // The trap this guards: the checkbox lives inside a .ai-surface group, so a
  // careless rule would hide the only way to switch AI back on.
  const prefCtx = await browser.newContext({ serviceWorkers: 'block' });
  const prefPage = await prefCtx.newPage();
  await prefPage.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 20000 });
  const prefOff = await prefPage.evaluate(() => {
    HubUtils.setAiVisible(false);
    return {
      attr: document.documentElement.getAttribute('data-ai-hidden'),
      drawerHidden: getComputedStyle(document.getElementById('ai-drawer')).display === 'none',
      toggleReachable: !!document.getElementById('ai-visible-toggle')
        && getComputedStyle(document.getElementById('ai-visible-toggle')).display !== 'none',
      stored: JSON.parse(localStorage.getItem('hub-settings-v1') || '{}').aiAssistantVisible,
    };
  });
  await prefPage.reload({ waitUntil: 'load', timeout: 20000 });
  const prefPersisted = await prefPage.getAttribute('html', 'data-ai-hidden');
  const prefOn = await prefPage.evaluate(() => {
    HubUtils.setAiVisible(true);
    return getComputedStyle(document.getElementById('ai-drawer')).display !== 'none';
  });
  check('AI visibility preference hides the drawer and persists',
    prefOff.attr === 'true' && prefOff.drawerHidden === true && prefOff.stored === false
    && prefPersisted === 'true' && prefOn === true);
  check('AI visibility preference never hides its own checkbox',
    prefOff.toggleReachable === true, 'otherwise AI cannot be switched back on');
  await prefCtx.close();

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
