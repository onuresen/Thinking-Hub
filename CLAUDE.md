# Thinking Hub — Claude Context

## What this is
Multi-tool personal productivity web app. **No build step, no Node.js.** Pure HTML/CSS/JS loaded directly in browser. Standalone tool pages share one shell (`index.html`) via iframe + postMessage.

## Architecture in one sentence
`index.html` (shell) → loads tools in `<iframe id="app-frame">` → tools share state via `HubStorage` (localStorage + optional Supabase sync).

## File map
| File | Role |
|------|------|
| `index.html` | Shell: sidebar, home dashboard, iframe router, cloud panel |
| `theme.css` | **Only** global CSS — all tools must use its variables |
| `hub-storage.js` | Storage adapter: `get/set/subscribe` + optional Supabase. Must load first. |
| `hub-data.js` | Read API for project/task/member data (`project-hub-v1`) |
| `hub-links.js` | Cross-tool linking via postMessage + UI (picker modal, badges) |
| `hub-search.js` | Global Cmd+K search, injected into index.html only |
| `hub-tutorial.js` | Onboarding tour, injected into index.html only |
| `hub-toast.js` | Toast notifications — tiny, self-contained |
| `hub-bootstrap.js` | Init coordinator (35 lines) — call last in each tool |
| `supabase-schema.sql` | Cloud DB schema |
| `project-hub.html` | Project + task tracking |
| `schedule.html` | Calendar / timeline |
| `idea-swiper.html` | Rapid idea triage (swipe) |
| `kmqt-board.html` | Known / Messy / Questions / Thinking board |
| `decision-hub.html` | Decision log + alignment matrix |
| `canvas-hub.html` | Infinite spatial canvas |
| `graph-hub.html` | Task dependency graph (vis-network) |
| `tool-portfolio.html` | Curated tool/vendor directory |
| `focus-hub.html` | Pomodoro focus timer, task session log |
| `log-hub.html` | Private daily captain's log with mood heatmap |
| `retro-hub.html` | Async team retrospective (Went Well / Improve / Actions) |
| `assumptions-hub.html` | Assumption tracker linked to decisions |
| `review-hub.html` | Structured weekly review ritual |
| `matrix-hub.html` | Eisenhower 2×2 priority/impact matrix |
| `meetings-hub.html` | Meeting notes with action-item extraction |
| `goals-hub.html` | OKR / quarterly goals hub |
| `learning-hub.html` | Reading & learning log |
| `stakeholder-hub.html` | Visual power/interest stakeholder grid |
| `risk-hub.html` | Risk register with heat-map |
| `achievements-hub.html` | Achievements & milestones tracker |

## Script load order (required)
`hub-storage.js` → `hub-tutorial.js` → `hub-links.js` → `hub-search.js` → `hub-toast.js` → `hub-bootstrap.js`

## CSS token conventions
All color, font, radius via CSS variables from `theme.css`. Never hardcode hex values — use:
- `var(--accent)` not `#b8f033`
- `var(--accent-dim)` for low-opacity tint (~0.1)
- `var(--accent-glow)` for medium-opacity tint (~0.25)
- `var(--accent-like/super/nope)` for status colors (green/orange/red)
- `var(--node-*)` / `var(--border-*)` for colored card variants
- `var(--font-body/display/mono)` for fonts
- `var(--surface/surface2/surface3)` for backgrounds
- `var(--text/text2/text3)` for text
- `var(--r/r-sm)` for border radius

Both dark (default) and light (`[data-theme="light"]`) are fully defined. Both must be kept in sync whenever adding new tokens.

## JS injected CSS rule
When JS modules inject `<style>` blocks (hub-links.js, hub-search.js, hub-tutorial.js), use CSS vars — not hardcoded hex. CSS vars resolve correctly in injected stylesheets.

## localStorage keys (source of truth)
`hub-session-v1`, `project-hub-v1`, `schedule-v1`, `decision-hub-v1`, `kmqt_current_v2`, `canvas-v1`, `hub-links-v1`, `ideaswipe_history_v6`, `hub-cloud-config-v1`, `th-theme`, `tutorial-seen-v1`, `focus-hub-v1`, `log-hub-v1`, `retro-hub-v1`, `assumptions-hub-v1`, `review-hub-v1`, `matrix-hub-v1`, `meetings-hub-v1`, `goals-hub-v1`, `learning-hub-v1`, `stakeholder-hub-v1`, `risk-hub-v1`

## External dependencies
| Lib | Used in | Version |
|-----|---------|---------|
| Google Fonts (Syne, DM Sans, JetBrains Mono) | All HTML files | latest |
| vis-network | graph-hub.html | **9.1.9** (pinned) |
| html2canvas | canvas-hub.html | **1.4.1** (pinned) |
| @supabase/supabase-js | hub-storage.js (dynamic) | **@2** |

## What NOT to do
- Do not add new color hex values — extend `theme.css` tokens instead
- Do not use `var(--font-m)` — it doesn't exist, use `var(--font-mono)`
- Do not use `color-mix()` without a fallback property above it
- Do not break `hub-storage.js` load order
- Do not hardcode colors in JS-injected CSS strings
- Do not use `var(--font-b)` or `var(--font-d)` (undefined aliases) — use `var(--font-body)` / `var(--font-display)`

## Shared UI primitives (already in theme.css — reuse, don't duplicate)
`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input/.select/.textarea`, `.label`, `.empty-state`, `.ui-modal-overlay / .ui-modal`, `.ui-section-header / .ui-section-title / .ui-section-line`

## Known duplication (accepted, don't add more)
- `_esc(s)` HTML-escape utility exists in both `hub-links.js` and `hub-search.js` — intentional isolation
- HubStorage safety shim in both `hub-data.js` and `hub-links.js` — intentional fallback

---

## Obsidian integration — current state (Option A, done)

**What's in place:**
- Vault name stored in `hub-settings-v1` → `{ obsidianVault: string }` via index.html ⚙️ modal
- `project-hub.html` tasks: `obsidianNote` field on task objects; `⟡ Note` badge in task-meta opens `obsidian://` URI; `⟡` action button on hover calls `promptObsidianNote()` for any task (new or existing); field in Add Task modal
- `decision-hub.html` decisions: `obsidianNote` field; input + `⟡ Open` button in Log tab; saved in `saveCurrent()`
- Link format: `obsidian://open?vault={vaultName}&file={notePath}` — one-way, opens note in Obsidian

**Known limitation:** One-way only — app can open notes but cannot read content back.

---

## Obsidian integration — next plan (Option B)

**Goal:** Read the Obsidian vault folder directly in the browser, index note titles/frontmatter, and surface related notes next to items — no backend, no Obsidian running required.

**Approach:** File System Access API (`window.showDirectoryPicker()`)

**Implementation steps when ready:**

1. **New shared module `hub-obsidian.js`** — exposes `HubObsidian` singleton:
   - `HubObsidian.pickVault()` — calls `showDirectoryPicker()`, stores the `FileSystemDirectoryHandle` in memory and (if available) the persisted handle via `navigator.storage.getDirectory()`
   - `HubObsidian.indexVault()` — walks the dir recursively, reads all `.md` files, parses YAML frontmatter (`---` block), returns `[{ path, title, tags, aliases, frontmatter, snippet }]`
   - `HubObsidian.search(query)` — fuzzy match against indexed titles/aliases/tags
   - `HubObsidian.isAvailable()` — returns `typeof window.showDirectoryPicker === 'function'`
   - Store index in `hub-settings-v1` → `{ ..., obsidianIndex: [...], obsidianIndexedAt: ISO }` (refresh on demand)

2. **Frontmatter parsing** — inline micro-parser (no npm): split on `---`, parse `key: value` and `key: [a, b]` lines. No dependency needed for basic Obsidian frontmatter.

3. **UI additions:**
   - In index.html ⚙️ modal: "Pick Vault Folder" button (shown only when `HubObsidian.isAvailable()`); shows indexed note count + last-indexed time; "Re-index" button
   - In `project-hub.html` task modal: autocomplete suggestions for `task-obsidian` field — as user types, show matching note titles from the index
   - In `decision-hub.html` log tab: same autocomplete on `i-obsidian` input
   - Optional: "Related notes" panel next to a task — shows notes whose title/tags overlap with task title

4. **Browser compatibility fallback:** If `showDirectoryPicker` not available, show a message pointing user to set the vault name manually (Option A still works without B).

5. **Storage key:** Vault `FileSystemDirectoryHandle` cannot be serialised to localStorage — must be re-requested each session. Store only the index (titles/paths/frontmatter) in `hub-settings-v1`. Handle stale index gracefully (show "last indexed X ago, re-index?").

**Files to create/modify:**
| File | Change |
|------|--------|
| `hub-obsidian.js` (new) | Full vault reader + index module |
| `index.html` | Load `hub-obsidian.js`; add vault picker UI to ⚙️ modal |
| `project-hub.html` | Autocomplete on `task-obsidian` input |
| `decision-hub.html` | Autocomplete on `i-obsidian` input |
| `CLAUDE.md` | Move Option B to "done" when complete |

---

## Improvement Backlog

Prioritized list. Items marked with the same **group tag** can be implemented together in one session for efficiency.

### ~~Priority 1 — Schedule ↔ Project Hub sync~~ ✓ Done `[group: data-layer]`
**ID:** 1C — **Implemented.** `schedule.html` has `syncFromProjectHub()` called on `HubData.onChange()` — fixed a `JSON.parse()` double-parse bug that was silently preventing it from running. After the first manual import, due-date changes in Project Hub auto-sync to Schedule.  
**Files:** `schedule.html`

---

### ~~Priority 2 — Graph Hub: create links + edge notes + orphan filter~~ ✓ Done `[group: graph-links]`
**ID:** 1D — **Implemented.** "+ New Link" modal already existed; edge note panel already existed (fixed `JSON.parse` double-parse bug in `saveEdgeNote`); added "Orphans" filter button that hides all connected nodes, showing only items with zero links.  
**Files:** `graph-hub.html`

---

### ~~Priority 3 — Hub dashboard widget items clickable~~ ✓ Done `[group: hub-shell]`
**ID:** 2B — **Implemented.** All stat widgets (projects, schedule, decisions, questions) already have `data-tool` + `data-item-id` and the click handler navigates + highlights.  
**Files:** `index.html`

---

### ~~Priority 4 — Decision Hub progressive disclosure~~ ✓ Done `[group: decision-ux]`
**ID:** 2A — **Implemented.** Log tab now shows only Title + Summary by default; Project/Type/Confidence/Tags/Reasoning/Obsidian collapse behind "More fields ↓" (auto-opens if any of those fields have values). Workspace tab already had show/hide via `toggleWsExtra`.  
**Files:** `decision-hub.html`

---

### ~~Priority 5 — Project Hub task filtering~~ ✓ Done `[group: project-ux]`
**ID:** 2E — **Implemented.**  
- Task filter bar (status + priority chips) exists in the single-project detail panel.  
- Overview filter bar added: **multi-select member chips**, project **status chips** (Active/Planning/On Hold/Done), **search input**, and **sort** (Manual/Name/Status/Open Tasks). Count badge shows "X of Y projects".  
- All Tasks view filter bar added: **multi-select member chips**, status chips (All/Open/Done), priority chips (All/High/Med/Low).  
- Kanban view respects `allTasksFilter` (member + priority).  
- Sidebar member pills now multi-select and sync with overview filter.  
- State keys: `overviewFilter { members[], status, search, sort }` and `allTasksFilter { members[], status, priority }` — session memory only, no new storage key.  
**Files:** `project-hub.html`

---

### Priority 6 — Better cross-tool onboarding tour `[group: hub-shell]`
**ID:** 2F  
Current tutorial covers tools in isolation. Add a "Quick Tour" that walks the power workflow: create project → swipe ideas → link to decision → graph view. 5 steps, triggered on first project creation. Reuses `hub-tutorial.js` step format.  
**Files:** `index.html`, `hub-tutorial.js`

---

### ~~Priority 7 — New tool: Focus Timer~~ ✓ Done `[group: new-tools-solo]`
**ID:** 3B — **Implemented.**  
**Files:** `focus-hub.html`

---

### ~~Priority 8 — New tool: Daily Log~~ ✓ Done `[group: new-tools-solo]`
**ID:** 3D — **Implemented.**  
**Files:** `log-hub.html`

---

### ~~Priority 9 — New tool: Retrospective Board~~ ✓ Done `[group: new-tools-team]`
**ID:** 3C — **Implemented.**  
**Files:** `retro-hub.html`

---

### ~~Priority 10 — New tool: Assumption Tracker~~ ✓ Done `[group: new-tools-team]`
**ID:** 3E — **Implemented.**  
**Files:** `assumptions-hub.html`

---

### ~~Priority 11–14 — Visual polish pass~~ ✓ Done `[group: visual-polish]`
**ID:** 4A, 4B, 4C, 4D — all implemented.

**~~4A — Dark/light Canvas node colors~~** ✓ Done: Light mode `--node-*` tokens already saturated in `theme.css` (e.g. blue = `#bed8f5` with `--border-blue: #4a90c8`).

**~~4B — Micro-animations on card interactions~~** ✓ Done: `@keyframes card-enter`, `check-pop`, `task-fade-done` in `theme.css`; wired in `project-hub.html` (`saveTask` + `toggleTask`), `kmqt-board.html` (`addItem`), `decision-hub.html` (`createNew`).

**~~4C — Empty state illustrations~~** ✓ Done: Inline SVG illustrations already present in `graph-hub.html`, `kmqt-board.html` column empties, and others.

**~~4D — Iframe loading progress bar~~** ✓ Done: `#load-bar` with `@keyframes progress-run` + `.active` class toggled on iframe load/unload in `index.html`.

---

### ~~Priority 15 — Project Hub compact mode~~ ✓ Done `[group: project-ux]`
**ID:** 4E — **Implemented.** `.compact-mode` CSS + `compactMode` session state + `.tf-compact` toggle button already present.  
**Files:** `project-hub.html`

---

### Priority 16 — Escape utility deduplication `[group: tech-hygiene]`
**ID:** 5D  
`_esc()` exists in `hub-links.js` and `hub-search.js`; `escapeHtml()` / `escapeAttr()` in other tools. Extract to `hub-utils.js`, load before `hub-links.js`. Update Known Duplication note in this file.  
**Files:** New `hub-utils.js`, `hub-links.js`, `hub-search.js`, `hub-bootstrap.js` (load order), tool HTML files

---

### ~~Priority 17 — Fix postMessage wildcard origin~~ ✓ Done `[group: tech-hygiene]`
**ID:** 5A — **Implemented.** `hub-links.js` already uses `window.location.origin || '*'`.  
**Files:** `hub-links.js`

---

### ~~Priority 18 — z-index tokens~~ ✓ Done `[group: tech-hygiene]`
**ID:** 5B — **Implemented.** `theme.css` already defines `--z-base`, `--z-sticky`, `--z-popover`, `--z-overlay`, `--z-modal`, `--z-tooltip`, `--z-toast`.  
**Files:** `theme.css`

---

### ~~Priority 19 — New tool: Weekly Review~~ ✓ Done `[group: new-tools-solo]`
**ID:** 3A — **Implemented.**  
**Files:** `review-hub.html`

---

### ~~Priority 20 — KMQT keyboard shortcut overlay~~ ✓ Done `[group: kmqt-ux]`
**ID:** 2C — **Implemented.** `?` button in header opens `shortcut-overlay` modal listing all shortcuts.  
**Files:** `kmqt-board.html`

---

### ~~Priority 21 — Tool Portfolio search~~ ✓ Done `[group: solo-quick]`
**ID:** 2D — **Implemented.** Search input (`#sidebar-search`) + clear button already exist; `renderList()` filters by name/category/description.  
**Files:** `tool-portfolio.html`

---

### ~~Priority 22 — Idea Swiper → Project Hub pipeline~~ ✓ Done `[group: cross-tool-bridges]`
**ID:** 1A — **Implemented.** `→ Hub` button exists on Like/Super results. Fixed `confirmSendToHub()` which was writing to a nonexistent top-level `raw.tasks`; now correctly pushes into `project.tasks` within `raw.projects`.  
**Files:** `idea-swiper.html`

---

### ~~Priority 23 — KMQT "Thinking" → Decision Hub~~ ✓ Done `[group: kmqt-ux]`
**ID:** 1B — **Implemented.** `→ Decision` button in KMQT panel (visible when T-column item selected). Fixed `logAsDecision()` to create a proper decision object (correct `dh-` ID format, all required fields). Added `hub-highlight` postMessage listener to `decision-hub.html` so the new decision is automatically opened on arrival.  
**Files:** `kmqt-board.html`, `decision-hub.html`

---

### ~~Priority 24 — Decision Hub → KMQT question bridge~~ ✓ Done `[group: decision-ux]`
**ID:** 1E — **Implemented.** "⊞ Send as KMQT Question" button in the Decision Hub workspace action bar; `sendToKmqt()` writes to `kmqt_current_v2` Q-column directly.  
**Files:** `decision-hub.html`

---

### ~~Priority 25 — Canvas nodes searchable via Cmd+K~~ ✓ Done `[group: cross-tool-bridges]`
**ID:** 1F — **Implemented.** `resolveItems('canvas-hub')` resolver already exists in `hub-links.js`; `canvas-hub.html` already has `hub-highlight` postMessage listener that pans to and flashes the node.  
**Files:** `hub-links.js`, `canvas-hub.html`

---

### ~~Priority 26 — New tool: Priority / Impact Matrix~~ ✓ Done `[group: new-tools-solo]`
**ID:** 3F — **Implemented.**  
**Files:** `matrix-hub.html`

---

### ~~Priority 27 — New tool: Meeting Notes~~ ✓ Done `[group: new-tools-team]`
**ID:** 3G — **Implemented.**  
**Files:** `meetings-hub.html`

---

### ~~Priority 28 — New tool: OKR / Goals Hub~~ ✓ Done `[group: new-tools-solo]`
**ID:** 3H — **Implemented.**  
**Files:** `goals-hub.html`

---

### ~~Priority 29 — New tool: Reading & Learning Log~~ ✓ Done `[group: new-tools-solo]`
**ID:** 3I — **Implemented.**  
**Files:** `learning-hub.html`

---

### ~~Priority 30 — New tool: Stakeholder Map~~ ✓ Done `[group: new-tools-team]`
**ID:** 3J — **Implemented.**  
**Files:** `stakeholder-hub.html`

---

### ~~Priority 31 — New tool: Risk Register~~ ✓ Done `[group: new-tools-team]`
**ID:** 3K — **Implemented.**  
**Files:** `risk-hub.html`
