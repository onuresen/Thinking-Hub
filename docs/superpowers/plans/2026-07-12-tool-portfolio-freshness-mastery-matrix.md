# Tool Portfolio: Freshness × Mastery Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, personal-relationship axis (freshness of use × self-rated mastery) to `tool-portfolio.html`, surfaced as a new "Matrix" tab that sits alongside the existing List/detail view — without touching the existing Technology Radar `ring` (adopt/trial/assess/hold), which stays for the subset of tools the user actually evaluates for the company.

**Architecture:** Three new persisted fields per tool (`lastUsedAt`, `useCount`, `mastery`) plus a small pure bucket-computation helper, a minimal tab-bar view switcher (a pattern already established in `journal-hub.html`, copied verbatim), a `renderMatrix()` function that lays tools into a 5×4 CSS grid, and a lightweight popover for the two write actions ("used today" tap, mastery click). All mutations reuse the existing `save()` persistence path; nothing routes through `updateField()`, which is scoped to `currentId` (the single tool open in the detail panel) and carries ring-specific side effects (decision-log prompts) this feature must not trigger.

**Tech Stack:** Plain HTML/CSS/JS, no build step, no framework, no test runner. `HubStorage` (`get`/`set`) is the only persistence dependency, already loaded by this file. Verification throughout this plan is manual (open the file in a real browser, click through, inspect `HubStorage` state via devtools console) — this matches how every other feature in this codebase is verified per `CLAUDE.md`'s own backlog entries (e.g. Priority 77: "Verified... via the real UI path").

## Global Constraints

- Never hardcode new color hex values — use existing `theme.css` tokens (`--node-*`/`--border-*` for categorical tinting, `--accent`/`--text`/`--text2`/`--text3`/`--surface`/`--surface2` for everything else), per `CLAUDE.md`'s CSS token conventions.
- Both dark (default) and light (`[data-theme="light"]`) themes must render correctly — this file's existing CSS already relies entirely on `theme.css` variables, so as long as new rules only use `var(--...)` this is automatic; do not add a theme-specific override block.
- Use `escapeHtml()` (already defined at the bottom of `tool-portfolio.html`) for every piece of tool-supplied text (name, category) interpolated into new HTML strings — this file already does this everywhere else user data is rendered.
- Do not modify `updateField()`, `renderList()`, `renderDetail()`, or `renderCompare()` — the new view is additive and must not change existing List/detail/compare behavior.
- No new dependencies, no build step — this is a single `<script>`/`<style>` block inside `tool-portfolio.html`, matching the rest of the file.

---

### Task 1: Data model — usage/mastery fields + freshness bucket helper

**Files:**
- Modify: `tool-portfolio.html` (single file — see anchors below)

**Interfaces:**
- Produces: `getFreshnessBucket(lastUsedAt)` → returns one of `'today' | 'week' | 'month' | 'stale' | 'forgotten'`. Consumed by Task 3's `renderMatrix()`.
- Produces: `FRESHNESS_BUCKETS` → `[{key, label}]` array, 5 entries, in row-display order (today → forgotten). Consumed by Task 3.
- Produces: `MASTERY_LABELS` → `['Novice', 'Comfortable', 'Skilled', 'Power-user']`, index = mastery level 0–3. Consumed by Task 3 and Task 4.
- Produces: every tool object in `tools[]` is guaranteed to have `lastUsedAt` (ISO string or `null`), `useCount` (number, ≥0), `mastery` (integer 0–3) after `load()` runs. Consumed by Tasks 3 and 4.

- [ ] **Step 1: Add the three new fields to `createTool()`'s default object**

Find this block (currently at line 489–502):

```javascript
        function createTool() {
            const t = {
                id: 'tool-' + Date.now().toString(36),
                name: 'New Tool',
                icon: '🛠',
                url: '',
                status: 'exploring',
                ring: 'assess',
                archLayer: '',
                category: '',
                note: '',
                projectIds: [],
                order: 999999 // appended at end of its category
            };
```

Replace with:

```javascript
        function createTool() {
            const t = {
                id: 'tool-' + Date.now().toString(36),
                name: 'New Tool',
                icon: '🛠',
                url: '',
                status: 'exploring',
                ring: 'assess',
                archLayer: '',
                category: '',
                note: '',
                projectIds: [],
                order: 999999, // appended at end of its category
                lastUsedAt: null,
                useCount: 0,
                mastery: 0
            };
```

- [ ] **Step 2: Add the migration function, mirroring `ensureOrderFields()`**

Find `ensureOrderFields()` (currently ends at line 487, right before `createTool()`):

```javascript
            if (changed) HubStorage.set(STORAGE_KEY, tools);
        }

        function createTool() {
```

Replace with (adds a new function between them, does not touch `ensureOrderFields()`'s body):

```javascript
            if (changed) HubStorage.set(STORAGE_KEY, tools);
        }

        // Backfill freshness/mastery fields for tools created before this feature existed
        function ensureUsageFields() {
            let changed = false;
            tools.forEach(t => {
                if (t.lastUsedAt === undefined) { t.lastUsedAt = null; changed = true; }
                if (typeof t.useCount !== 'number') { t.useCount = 0; changed = true; }
                if (typeof t.mastery !== 'number') { t.mastery = 0; changed = true; }
            });
            if (changed) HubStorage.set(STORAGE_KEY, tools);
        }

        function createTool() {
```

- [ ] **Step 3: Call the migration from `load()`**

Find (currently lines 444–450):

```javascript
        function load() {
            tools = HubStorage.get(STORAGE_KEY) || [];
            ensureOrderFields();
            renderList();
            renderStatsBar();
            renderDetail();
        }
```

Replace with:

```javascript
        function load() {
            tools = HubStorage.get(STORAGE_KEY) || [];
            ensureOrderFields();
            ensureUsageFields();
            renderList();
            renderStatsBar();
            renderDetail();
        }
```

- [ ] **Step 4: Add the freshness bucket helper and constants**

Add immediately after the `normCat()` function (currently lines 439–442, right before `function load()`):

```javascript
        function normCat(s) {
            const v = (s || '').trim();
            return v ? v : 'OTHER';
        }

        const FRESHNESS_BUCKETS = [
            { key: 'today',     label: 'Today' },
            { key: 'week',      label: 'This week' },
            { key: 'month',     label: 'This month' },
            { key: 'stale',     label: 'Stale' },
            { key: 'forgotten', label: 'Forgotten' }
        ];
        const MASTERY_LABELS = ['Novice', 'Comfortable', 'Skilled', 'Power-user'];

        // Pure function: ISO timestamp or null -> bucket key. No DOM/state access, so it's
        // directly testable from the devtools console (see Step 5).
        function getFreshnessBucket(lastUsedAt) {
            if (!lastUsedAt) return 'forgotten';
            const days = (Date.now() - new Date(lastUsedAt).getTime()) / 86400000;
            if (days < 1) return 'today';
            if (days <= 7) return 'week';
            if (days <= 30) return 'month';
            if (days <= 90) return 'stale';
            return 'forgotten';
        }

        function load() {
```

- [ ] **Step 5: Verify in the browser console**

Open `tool-portfolio.html` in a real browser (not headless — this app has no dev server, just open the file directly). Open devtools console and run:

```javascript
getFreshnessBucket(new Date().toISOString())                                  // expect 'today'
getFreshnessBucket(new Date(Date.now() - 3*86400000).toISOString())           // expect 'week'
getFreshnessBucket(new Date(Date.now() - 20*86400000).toISOString())          // expect 'month'
getFreshnessBucket(new Date(Date.now() - 60*86400000).toISOString())          // expect 'stale'
getFreshnessBucket(new Date(Date.now() - 200*86400000).toISOString())         // expect 'forgotten'
getFreshnessBucket(null)                                                       // expect 'forgotten'
```

Expected: all six calls return the bucket key shown in the comment.

Then run:

```javascript
tools.every(t => typeof t.mastery === 'number' && typeof t.useCount === 'number' && t.lastUsedAt !== undefined)
```

Expected: `true` — confirms `ensureUsageFields()` ran and every existing tool now carries the new fields.

- [ ] **Step 6: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add tool-portfolio.html
git commit -m "feat(tool-portfolio): add freshness/mastery data fields + bucket helper"
```

---

### Task 2: Tab bar — List / Matrix view switcher

**Files:**
- Modify: `tool-portfolio.html`

**Interfaces:**
- Consumes: none beyond what already exists in the file.
- Produces: `switchTpView(view)` where `view` is `'list' | 'matrix'`. Produces global `let tpView = 'list'`. Produces empty `<div id="matrix-view">` container Task 3 renders into. Consumed by Task 3 (`renderMatrix()` targets `#matrix-view`) and Task 4 (the "View details →" popover link calls `switchTpView('list')`).

- [ ] **Step 1: Add tab-bar CSS, copying the existing `journal-hub.html` pattern verbatim**

Find the end of the `<style>` block (currently line 400):

```css
    </style>
```

Replace with:

```css
    .tp-tab-bar { display: flex; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 3px; gap: 2px; margin: 0 16px 10px; width: fit-content; }
    .tp-tab { padding: 6px 14px; border: none; background: none; border-radius: 6px; font-size: 12.5px; font-weight: 600; color: var(--text3); cursor: pointer; }
    .tp-tab:hover { color: var(--text); }
    .tp-tab.active { background: var(--surface); color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,.2); }
    </style>
```

- [ ] **Step 2: Add the tab bar and the matrix container to the body**

Find (currently lines 415–426):

```html
    <div class="main">
        <div class="topbar">
            <button class="mob-nav-btn" onclick="toggleSidebar()" aria-label="Open tool list">☰</button>
            <div class="topbar-title" id="topbar-title">Select a tool</div>
            <button class="btn btn-ghost" id="compare-btn" onclick="toggleCompare()" style="display:none;font-size:12px">⇄ Compare</button>
        </div>
        <div class="stats-bar" id="stats-bar"></div>

        <div class="content" id="content">
            <div class="empty">Select a tool or add a new one.</div>
        </div>
    </div>
```

Replace with:

```html
    <div class="main">
        <div class="topbar">
            <button class="mob-nav-btn" onclick="toggleSidebar()" aria-label="Open tool list">☰</button>
            <div class="topbar-title" id="topbar-title">Select a tool</div>
            <button class="btn btn-ghost" id="compare-btn" onclick="toggleCompare()" style="display:none;font-size:12px">⇄ Compare</button>
        </div>
        <div class="tp-tab-bar">
            <button class="tp-tab active" data-view="list" onclick="switchTpView('list')">📋 List</button>
            <button class="tp-tab" data-view="matrix" onclick="switchTpView('matrix')">▦ Matrix</button>
        </div>
        <div class="stats-bar" id="stats-bar"></div>

        <div class="content" id="content">
            <div class="empty">Select a tool or add a new one.</div>
        </div>
        <div id="matrix-view" style="display:none;padding:0 16px 16px;"></div>
    </div>
```

- [ ] **Step 3: Add `switchTpView()`**

Add immediately after the `let tools = []` state block (currently lines 429–437):

```javascript
        const STORAGE_KEY = 'tool-portfolio-v1';
        let tools = [];
        let currentId = null;
        let compareMode = false;
        let compareId = null;

        // Drag state
        let dragId = null;
        let dragCat = null;

        let tpView = 'list';
        function switchTpView(view) {
            tpView = view;
            document.getElementById('content').style.display = view === 'list' ? '' : 'none';
            document.getElementById('matrix-view').style.display = view === 'matrix' ? '' : 'none';
            document.querySelectorAll('.tp-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
            if (view === 'matrix') renderMatrix();
        }

        function normCat(s) {
```

Note: `renderMatrix()` doesn't exist yet — that's Task 3. This step alone will leave `switchTpView('matrix')` throwing a `ReferenceError`, which is expected and fixed in the next task. Do not stub `renderMatrix()` here — Task 3 defines it for real.

- [ ] **Step 4: Verify list mode still works untouched**

Open `tool-portfolio.html` in a browser. Confirm: the page loads exactly as before (List tab active by default, a tool's detail shown in `#content`), and the new tab bar appears above the stats bar with "List" highlighted. Do not click "Matrix" yet — Task 3 isn't built.

- [ ] **Step 5: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add tool-portfolio.html
git commit -m "feat(tool-portfolio): add List/Matrix tab-bar scaffold"
```

---

### Task 3: `renderMatrix()` — grid skeleton, chip placement, category color

**Files:**
- Modify: `tool-portfolio.html`

**Interfaces:**
- Consumes: `FRESHNESS_BUCKETS`, `MASTERY_LABELS`, `getFreshnessBucket()` from Task 1. `tools[]`, `normCat()` (existing). `#matrix-view` container and `tpView` from Task 2.
- Produces: `renderMatrix()` — no params, renders into `#matrix-view`. Produces `categoryPaletteKey(category)` → one of `'gray'|'blue'|'green'|'yellow'|'purple'|'red'`, deterministic hash. Consumed by Task 4 (chip re-render after mutation reuses the same coloring, no new logic needed there).
- Produces: each chip element carries `data-tool-id="{id}"` and class `.tp-chip`. Consumed by Task 4, which attaches the click handler that opens the popover.

- [ ] **Step 1: Add the category color hash + grid CSS**

Find the tab-bar CSS added in Task 2 Step 1 and insert immediately before its closing `</style>`:

```css
    .tp-tab.active { background: var(--surface); color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,.2); }

    .tp-matrix { display: grid; grid-template-columns: 120px repeat(4, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--r-sm); overflow: hidden; }
    .tp-matrix-cell { background: var(--surface); padding: 8px; min-height: 64px; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6px; }
    .tp-matrix-head { background: var(--surface2); padding: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--text3); display: flex; align-items: center; }
    .tp-matrix-row-label { background: var(--surface2); padding: 8px; font-size: 12px; font-weight: 700; color: var(--text2); display: flex; align-items: center; }
    .tp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid; }
    .tp-chip-gray   { background: var(--node-gray);   border-color: var(--border-gray); }
    .tp-chip-blue   { background: var(--node-blue);   border-color: var(--border-blue); }
    .tp-chip-green  { background: var(--node-green);  border-color: var(--border-green); }
    .tp-chip-yellow { background: var(--node-yellow); border-color: var(--border-yellow); }
    .tp-chip-purple { background: var(--node-purple); border-color: var(--border-purple); }
    .tp-chip-red    { background: var(--node-red);    border-color: var(--border-red); }
    </style>
```

- [ ] **Step 2: Add `categoryPaletteKey()` and `renderMatrix()`**

Add immediately after `getFreshnessBucket()` from Task 1 (right before `function load()`):

```javascript
        const CATEGORY_PALETTE = ['gray', 'blue', 'green', 'yellow', 'purple', 'red'];
        function categoryPaletteKey(category) {
            const s = normCat(category);
            let hash = 0;
            for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
            return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
        }

        function renderMatrix() {
            const el = document.getElementById('matrix-view');
            if (!tools.length) {
                el.innerHTML = '<div class="empty">No tools yet — add one from the List tab.</div>';
                return;
            }

            let html = '<div class="tp-matrix">';
            html += '<div class="tp-matrix-head"></div>';
            MASTERY_LABELS.forEach(label => {
                html += `<div class="tp-matrix-head">${escapeHtml(label)}</div>`;
            });

            FRESHNESS_BUCKETS.forEach(bucket => {
                html += `<div class="tp-matrix-row-label">${escapeHtml(bucket.label)}</div>`;
                for (let masteryCol = 0; masteryCol < 4; masteryCol++) {
                    const cellTools = tools.filter(t =>
                        getFreshnessBucket(t.lastUsedAt) === bucket.key && (t.mastery ?? 0) === masteryCol
                    );
                    html += '<div class="tp-matrix-cell">';
                    cellTools.forEach(t => {
                        const palette = categoryPaletteKey(t.category);
                        html += `<span class="tp-chip tp-chip-${palette}" data-tool-id="${escapeAttr(t.id)}" onclick="openChipPopover('${escapeAttr(t.id)}', this)">${escapeHtml(t.icon || '🛠')} ${escapeHtml(t.name)}</span>`;
                    });
                    html += '</div>';
                }
            });
            html += '</div>';
            el.innerHTML = html;
        }

        function load() {
```

Note: `openChipPopover()` is referenced here but defined in Task 4. Until Task 4 lands, clicking a chip will throw — expected at this checkpoint, matching Task 2 Step 3's same pattern (grid renders and is visually verifiable before interactivity is wired).

- [ ] **Step 3: Verify the grid renders and places tools correctly**

Open `tool-portfolio.html` in a browser, click the "Matrix" tab. Confirm:
- A 5-row × 4-column grid appears with row labels (Today/This week/This month/Stale/Forgotten) and column headers (Novice/Comfortable/Skilled/Power-user).
- Every existing tool appears as exactly one chip, and — since Task 1's migration sets `lastUsedAt: null, mastery: 0` for all pre-existing tools — every chip should currently sit in the **Forgotten × Novice** cell (bottom-left).
- Chips are colored (not all the same color, assuming more than one category exists among your tools); the same category always produces the same color.

Then in devtools console, spot-check the count:

```javascript
document.querySelectorAll('.tp-chip').length === tools.length
```

Expected: `true`.

- [ ] **Step 4: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add tool-portfolio.html
git commit -m "feat(tool-portfolio): render freshness x mastery matrix grid"
```

---

### Task 4: Chip popover — "used today" + mastery interactions

**Files:**
- Modify: `tool-portfolio.html`

**Interfaces:**
- Consumes: `renderMatrix()`, `.tp-chip[data-tool-id]` from Task 3. `tools[]`, `save()`, `switchTpView()`, `openTool()` (existing).
- Produces: `openChipPopover(toolId, anchorEl)` — called from the chip's `onclick` (wired in Task 3 Step 2). `closeChipPopover()`. `logToolUsage(toolId)`. `setToolMastery(toolId, level)`. None of these are consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Add popover CSS**

Find the end of the matrix CSS from Task 3 Step 1 and insert before `</style>`:

```css
    .tp-chip-red    { background: var(--node-red);    border-color: var(--border-red); }

    .tp-popover-backdrop { position: fixed; inset: 0; z-index: 50; background: transparent; }
    .tp-popover { position: absolute; z-index: 51; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r-sm); box-shadow: 0 8px 24px rgba(0,0,0,.35); padding: 12px; width: 220px; }
    .tp-popover-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    .tp-popover-row { margin-bottom: 8px; }
    .tp-popover-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--text3); margin-bottom: 4px; }
    .tp-mastery-dots { display: flex; gap: 6px; }
    .tp-mastery-dot { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border2); background: var(--surface2); cursor: pointer; }
    .tp-mastery-dot.filled { background: var(--accent); border-color: var(--accent); }
    .tp-popover-link { font-size: 12px; color: var(--accent); cursor: pointer; text-decoration: none; display: block; margin-top: 8px; }
    </style>
```

- [ ] **Step 2: Add the popover functions**

Add immediately after `renderMatrix()` from Task 3 (right before `function load()`):

```javascript
        function closeChipPopover() {
            const existing = document.getElementById('tp-popover');
            if (existing) existing.remove();
            const backdrop = document.getElementById('tp-popover-backdrop');
            if (backdrop) backdrop.remove();
        }

        function openChipPopover(toolId, anchorEl) {
            closeChipPopover();
            const t = tools.find(x => x.id === toolId);
            if (!t) return;

            const backdrop = document.createElement('div');
            backdrop.id = 'tp-popover-backdrop';
            backdrop.className = 'tp-popover-backdrop';
            backdrop.onclick = closeChipPopover;
            document.body.appendChild(backdrop);

            const rect = anchorEl.getBoundingClientRect();
            const pop = document.createElement('div');
            pop.id = 'tp-popover';
            pop.className = 'tp-popover';
            pop.style.top = (rect.bottom + window.scrollY + 6) + 'px';
            pop.style.left = (rect.left + window.scrollX) + 'px';
            pop.onclick = e => e.stopPropagation();

            // 4 dots representing mastery levels 0-3 (Novice..Power-user). Dot `lvl` renders
            // filled when `mastery >= lvl` (level 0/Novice's dot is always at least filled),
            // clicking dot `lvl` sets mastery to exactly `lvl`.
            const dots = [0, 1, 2, 3].map(lvl =>
                `<span class="tp-mastery-dot${(t.mastery ?? 0) >= lvl ? ' filled' : ''}" title="${escapeAttr(MASTERY_LABELS[lvl])}" onclick="setToolMastery('${escapeAttr(t.id)}', ${lvl})"></span>`
            ).join('');

            pop.innerHTML = `
                <div class="tp-popover-title">${escapeHtml(t.icon || '🛠')} ${escapeHtml(t.name)}</div>
                <div class="tp-popover-row">
                    <div class="tp-popover-label">Used ${t.useCount || 0}× · last ${t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'never'}</div>
                    <button class="btn btn-primary" style="font-size:12px;padding:5px 10px" onclick="logToolUsage('${escapeAttr(t.id)}')">✓ Used today</button>
                </div>
                <div class="tp-popover-row">
                    <div class="tp-popover-label">Mastery — ${escapeHtml(MASTERY_LABELS[t.mastery ?? 0])}</div>
                    <div class="tp-mastery-dots" id="tp-mastery-dots">${dots}</div>
                </div>
                <a class="tp-popover-link" onclick="switchTpView('list'); openTool('${escapeAttr(t.id)}'); closeChipPopover();">View details →</a>
            `;
            document.body.appendChild(pop);
        }

        function logToolUsage(toolId) {
            const t = tools.find(x => x.id === toolId);
            if (!t) return;
            t.lastUsedAt = new Date().toISOString();
            t.useCount = (t.useCount || 0) + 1;
            save();
            renderMatrix();
            closeChipPopover();
        }

        function setToolMastery(toolId, level) {
            const t = tools.find(x => x.id === toolId);
            if (!t) return;
            t.mastery = level;
            save();
            renderMatrix();
            closeChipPopover();
        }

        function load() {
```

- [ ] **Step 3: Verify end-to-end in the browser**

Open `tool-portfolio.html`, go to Matrix tab, click any chip (currently sitting in Forgotten × Novice).

1. Confirm the popover opens near the chip, showing the tool name, "Used 0× · last never", a "✓ Used today" button, 4 mastery dots (dot 0 filled), and a "View details →" link.
2. Click "✓ Used today". Confirm: popover closes, and the chip has moved to the **Today × Novice** cell.
3. Click the same chip again, confirm the popover now shows "Used 1× · last {today's date}".
4. Click the 3rd mastery dot (index 2, "Skilled"). Confirm: popover closes, chip moves to **Today × Skilled**.
5. Click the chip once more, click "View details →". Confirm: view switches back to List tab, and the tool's detail panel opens showing that same tool (existing `renderDetail()` behavior, untouched).
6. In devtools console, confirm persistence survived a reload:

```javascript
location.reload();
```

After reload, click Matrix tab again — the tool from steps 2–4 should still be in the **Today × Skilled** cell (confirms `save()` → `HubStorage.set()` actually persisted `lastUsedAt`/`useCount`/`mastery`, not just in-memory state).

- [ ] **Step 4: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add tool-portfolio.html
git commit -m "feat(tool-portfolio): chip popover for used-today + mastery interactions"
```

---

## Post-plan note

This ships the full design from the Priority 78 backlog entry in `CLAUDE.md`. Per that entry's "Key decisions," the category-as-chip-color choice is the part of the design the user was least sure about — after living with this for 1–2 weeks, revisit whether it's pulling its weight before adding anything further (e.g. a filter dropdown, a true streak counter). Update the Priority 78 entry in `CLAUDE.md` to `✓ Done` with a "Key decisions"/"Verified"/"Files" wrap-up once all four tasks are committed, matching this repo's own backlog convention.
