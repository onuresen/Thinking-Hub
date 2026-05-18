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
| `hub-utils.js` | Shared utilities (`HubUtils.esc` for HTML escaping). Load second. |
| `hub-starter-data.js` | First-run sample data seeder (`HubStarter.seed()` / `HubStarter.hasAnyData()`). Loaded in `index.html` only. |
| `hub-obsidian.js` | Obsidian vault reader: `HubObsidian.pickVault/indexVault/search/attachAutocomplete` |
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
| `decision-hub.html` | Decision log + alignment matrix + **Assumptions tab** (reads `assumptions-hub-v1`) |
| `canvas-hub.html` | Infinite spatial canvas |
| `graph-hub.html` | Task dependency graph (vis-network) |
| `tool-portfolio.html` | Curated tool/vendor directory |
| `scrum-hub.html` | Scrum Board — product backlog (MoSCoW), sprint planning, kanban, velocity chart, DoD |
| `focus-hub.html` | Pomodoro focus timer, task session log |
| `log-hub.html` | Private daily captain's log with mood heatmap |
| `retro-hub.html` | Async team retrospective (Went Well / Improve / Actions) |
| `assumptions-hub.html` | ⚠ Retired from sidebar — data lives on in `assumptions-hub-v1`, accessed via Decision Hub → Assumptions tab |
| `review-hub.html` | Structured weekly review ritual |
| `matrix-hub.html` | ⚠ Retired from sidebar — data lives on in `matrix-hub-v1`, accessed via Project Hub → Priority Matrix view |
| `meetings-hub.html` | Meeting notes with action-item extraction |
| `goals-hub.html` | OKR / quarterly goals hub |
| `learning-hub.html` | Reading & learning log |
| `stakeholder-hub.html` | Visual power/interest stakeholder grid |
| `risk-hub.html` | Risk register with heat-map |
| `achievements-hub.html` | Achievements & milestones tracker |
| `help-hub.html` | Help & Guide — tool directory, framework reference (37 frameworks), 4 suggested workflows |

## Script load order (required)
`hub-storage.js` → `hub-utils.js` → `hub-starter-data.js` (index.html only) → `hub-obsidian.js` → `hub-links.js` → `hub-search.js` → `hub-toast.js` → `hub-bootstrap.js`

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
`hub-session-v1`, `project-hub-v1`, `schedule-v1`, `decision-hub-v1`, `kmqt_current_v2`, `canvas-v1`, `hub-links-v1`, `ideaswipe_history_v6`, `hub-cloud-config-v1`, `th-theme`, `tutorial-seen-v1`, `quick-tour-seen-v1`, `focus-hub-v1`, `log-hub-v1`, `retro-hub-v1`, `assumptions-hub-v1`, `review-hub-v1`, `matrix-hub-v1`, `meetings-hub-v1`, `goals-hub-v1`, `learning-hub-v1`, `stakeholder-hub-v1`, `risk-hub-v1`, `scrum-hub-v1`, `hub-activity-v1`, `hub-settings-v1`, `tool-portfolio-v1`

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
- `_esc(s)` now lives in `hub-utils.js` (`HubUtils.esc`); `hub-links.js` and `hub-search.js` fall back to an inline copy if `HubUtils` is not loaded — intentional resilience
- HubStorage safety shim in both `hub-data.js` and `hub-links.js` — intentional fallback

---

## File Editing Safety
- **Never use PowerShell `-replace` regex for multi-file bulk edits.** Use `.Replace()` (literal string method) in PowerShell, or the Edit tool with an exact `old_string`. The `-replace` operator with concatenated strings causes a parse error that silently writes `$null` to files, truncating them to 3 bytes.
- **Dry-run bulk operations mentally before running.** If a replacement string touches a substring that also appears inside other strings (e.g. `hub.html` inside `project-hub.html`), it will corrupt those filenames too. Use `replace_all: false` and a unique context window.
- **Preserve straight quotes in verbatim strings.** Never let an editor substitute smart quotes (`"` / `"`) inside JS template literals or C# verbatim strings — they break silently.
- **After any innerHTML-heavy refactor, verify event handlers still fire.** Reassigning `innerHTML` strips all attached listeners; re-check buttons/form submits after the change.
- **Read a file before editing it.** The Edit tool requires at least one prior Read in the session. For files not yet read, use Read first rather than guessing content.

## Workflow Conventions
- **Default workflow: rank → group → execute → update.** When given a backlog or feature list, always propose a ranked plan grouped into 2–4 efficient batches before touching any code. Wait for approval, then implement one group at a time. Update CLAUDE.md at the end to mark items done and capture any new follow-up work.
- **Checkpoint after each group.** Before starting the next group, confirm the previous one is working. For pure HTML/JS this means a quick sanity check on logic and storage keys; for compiled projects it means a clean build.
- **Keep CLAUDE.md in sync.** Mark backlog items ✓ Done as soon as they ship. Add new decisions, conventions, or file-map entries in the same session they're introduced — don't defer.
- **Search for existing bindings before adding shortcuts.** Grep for the key combo across all HTML files to avoid collisions.
- **Always edit the main project files, never the worktree copies.** Worktrees live at `.claude/worktrees/*/` — these are isolated git branches for sandboxed work and changes there do NOT affect the real app. Always confirm you are editing `C:\Users\onure\Documents\GitHub\Thinking-Hub\*.html` (or equivalent), not a path containing `.claude/worktrees/`.

---

## Obsidian integration — current state (Option A, done)

**What's in place:**
- Vault name stored in `hub-settings-v1` → `{ obsidianVault: string }` via index.html ⚙️ modal
- `project-hub.html` tasks: `obsidianNote` field on task objects; `⟡ Note` badge in task-meta opens `obsidian://` URI; `⟡` action button on hover calls `promptObsidianNote()` for any task (new or existing); field in Add Task modal
- `decision-hub.html` decisions: `obsidianNote` field; input + `⟡ Open` button in Log tab; saved in `saveCurrent()`
- Link format: `obsidian://open?vault={vaultName}&file={notePath}` — one-way, opens note in Obsidian

**Known limitation:** One-way only — app can open notes but cannot read content back.

---

## ~~Obsidian integration — Option B~~ ✓ Done

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

**Implemented files:**
| File | Change |
|------|--------|
| `hub-obsidian.js` ✓ | Full vault reader + index module (`HubObsidian` singleton) |
| `index.html` ✓ | Loads `hub-obsidian.js`; vault picker UI in ⚙️ modal (File System Access API) |
| `project-hub.html` ✓ | Autocomplete on `#task-obsidian` input via `HubObsidian.attachAutocomplete()` |
| `decision-hub.html` ✓ | Autocomplete on `#i-obsidian` input in log tab |

---

## Export system — current state (done)

The ⚙️ Data & Backup modal in `index.html` has a scoped export with three radio-card options:

| Scope | Storage keys | Filename | Restorable? |
|-------|-------------|----------|-------------|
| **Full Backup** | All 20 data keys (no cloud creds, no UI prefs) | `thinking-hub-backup-YYYY-MM-DD.json` | ✓ Yes |
| **AI Context** | 13 high-signal keys (projects, goals, decisions, reviews, risks, meetings, assumptions, KMQT, schedule, learning, matrix, stakeholders, retros) | `thinking-hub-ai-context-YYYY-MM-DD.json` | ✗ Read-only |
| **Current Tool** | Active tool's key(s) only | `{tool-id}-export-YYYY-MM-DD.json` | ✗ Read-only |

**Export format (v2):**
```json
{
  "version": 2,
  "app": "Thinking Hub",
  "exportedAt": "...",
  "scope": "curated",
  "summary": { "projects": 3, "open_tasks": 12, ... },
  "storageKeys": { "projects": "project-hub-v1", ... },
  "data": { "projects": {...}, "goals": {...}, ... }
}
```

**Key implementation details (`index.html`):**
- `EXPORT_KEY_LABELS` — maps storage keys to human-readable JSON section names
- `SCOPE_KEYS.full / .curated` — arrays defining which keys each scope covers
- `APP_FILE_STORAGE_KEYS` — maps tool HTML filenames to their storage key(s) (used by Current Tool scope)
- `stripAINoise(value)` — recursively removes `color`, `taskId`, `taskCreated`, `obsidianNote` from AI Context exports only
- `buildExportSummary(data)` — generates the `summary` block (counts) for AI Context exports
- `buildExportPayload(scope, storageKeys)` — assembles the v2 JSON payload
- `updateExportSizeEstimate()` — called on radio `onchange` and modal open; updates `#data-size-str` with scope-specific KB + tool count
- Import (`handleImportFile`) handles both v2 (restores via `storageKeys` map) and v1 legacy (flat key→string) formats; blocks restore of non-Full-Backup scopes

**Excluded from all exports:** `hub-cloud-config-v1` (Supabase credentials), `hub-session-v1`, `th-theme`, `tutorial-seen-v1`, `quick-tour-seen-v1` (ephemeral UI state).

---

## Improvement Backlog

Prioritized list. Items marked with the same **group tag** can be implemented together in one session for efficiency.

---

### ~~Workstream UI disabled~~ ✓ Done
Workstreams tab, panel, and task-form field removed from `project-hub.html`. Data (`proj.workstreams`, `task.workstreamId`) preserved in localStorage untouched.
**Files:** `project-hub.html`

---

### ~~Per-project member roles~~ ✓ Done
`proj.members` migrated from `[string]` to `[{memberId, role}]`. `normalizeProjMembers()`, `getProjMemberIds()`, `getProjMemberRole()`, `saveProjMemberRole()` helpers added. Settings tab now shows an inline role `<input list="proj-role-suggestions">` per assigned member (Owner / Lead / Contributor / Reviewer / Sponsor / Consulted / Informed). People tab shows project-specific role, falling back to global role if unset.
**Files:** `project-hub.html`

---

### ~~New tool: Scrum Board~~ ✓ Done `[group: new-tools-solo]`
Full PSPO-aligned scrum tool: **Backlog** (MoSCoW priority, story points, type icons, status groups), **Sprint Board** (kanban drag-drop, sprint meta bar, burndown), **Review & Retro** (velocity chart, review notes, Went Well / Improve / Actions), **Definition of Done** (categorised checklist). Storage key: `scrum-hub-v1`. Sidebar: EXECUTE group, IT/Dev profile.
**Files:** `scrum-hub.html` (new), `index.html`, `CLAUDE.md`

---

---

### ~~Group C — Health & hygiene~~ ✓ Done
- **C6 — Auto-unassign on member removal** — already implemented in both `removeProjectMember` and `deleteMember`. No change needed.
- **C7 — Staleness indicators** — `latestTimestamp()` + `relativeAge()` helpers added to `index.html`; each of the 5 dashboard stat cards shows "updated Xd ago" in the footer, amber-tinted if > 13 days.
- **C8 — Achievements Hub audit + cross-link** — fixed two data-reading bugs (`decision-hub-v1` is a plain array, not `{decisions:[]}`, and goals objectives are nested under `quarters[].objectives`); added 🏅 button to project detail panel header navigating to achievements via `hub-navigate` postMessage.
**Files:** `index.html`, `achievements-hub.html`, `project-hub.html`

---

### ~~Group A — Tool consolidation~~ ✓ Done
- **A1 — Assumptions Hub → Decision Hub "Assumptions" tab** — full lane view (Assumed / Testing / Validated / Invalidated), inline edit modal, "+ New assumption" pre-linked to current decision, "Show all" toggle. Data stays in `assumptions-hub-v1`. Standalone `assumptions-hub.html` retired from sidebar (file kept).
- **A2 — Priority Matrix → Project Hub "Priority Matrix" view** — full 2×2 Eisenhower grid with drag-drop, card CRUD, "Import tasks" modal pulling from project state. Badge in sidebar shows open item count. Data stays in `matrix-hub-v1`. Standalone `matrix-hub.html` retired from sidebar (file kept).
**Files:** `decision-hub.html`, `project-hub.html`, `index.html`, `CLAUDE.md`

---

### ~~Group B — Project as gravity center~~ ✓ Done
- **B3 — Goals ↔ Project Hub bridge** — `projectId` + `projectName` fields added to objectives in `goals-hub.html`; project select in objective modal populated from `HubData.getProjects()`; project badge shown on objective cards. Project Hub overview reads `goals-hub-v1` and renders "🎯 X" chip on each project card.
- **B4 — Risk Register → Project Hub badge** — Project Hub overview reads `risk-hub-v1` and renders "⚠ X" chip on each project card (risks already had `projectId` field).
- **B5 — Project context panel in shell sidebar** — Persistent mini-card between sidebar-nav and sidebar-footer in `index.html`; shown/hidden via new `hub-project-active` postMessage sent from `openProject()`/`closePanel()` in project-hub; displays project name (with color bar), open task count, next due date, OKR count, risk count. Auto-hides when navigating to a different tool or going home.
**Files:** `goals-hub.html`, `project-hub.html`, `index.html`

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

### ~~Priority 6 — Better cross-tool onboarding tour~~ ✓ Done `[group: hub-shell]`
**ID:** 2F — **Implemented.** `startWorkflowTour()` added to `index.html` — 5 steps covering Project Hub → Schedule sync → Idea Swiper pipeline → Decision Hub → Graph + Cmd+K. Triggered by `hub-first-project` postMessage from `project-hub.html` when the first project is created (guarded by `quick-tour-seen-v1` storage key). Reuses `HubTutorial.start()`.  
**Files:** `index.html`, `project-hub.html`

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

### ~~Priority 16 — Escape utility deduplication~~ ✓ Done `[group: tech-hygiene]`
**ID:** 5D — **Implemented.** Created `hub-utils.js` exposing `HubUtils.esc()`; both `hub-links.js` and `hub-search.js` use it with an inline fallback. Added `hub-utils.js` before `hub-links.js` in all 21 HTML files. Script load order updated.  
**Files:** `hub-utils.js` (new), `hub-links.js`, `hub-search.js`, all HTML files, `CLAUDE.md`

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

---

### ~~Priority 32 — Framework Tier 1 & 2 improvements~~ ✓ Done `[group: framework-grounding]`
Framework-grounded enhancements across 7 tools, matching each tool to its primary methodologies.

- **Scrum Board — Sprint Goal field**: Sprint meta bar now has a plain-text `#sprint-goal-input` field. Stored in `state.sprintGoal`, persisted to `scrum-hub-v1`. Grounds the sprint in Scrum's official Sprint Goal concept.
- **Decision Hub — Cynefin domain tag**: Log tab now has a `<select>` for `#i-cynefin` (Clear / Complicated / Complex / Chaotic / Disorder). Stored on decision object as `cynefin`. Badge rendered on decision cards. Helps users frame decisions using Dave Snowden's sense-making model.
- **Goals Hub — OKR scoring (0.0–1.0) + committed vs. aspirational**: Each Key Result now has a `score` field (0.0–1.0 number input) and a `krType` field ('committed'|'aspirational'). Score averaged per objective. Type shown as a colored badge.
- **Tool Portfolio — Technology Radar ring**: Each tool now has a `ring` field (Adopt / Trial / Assess / Hold). Shown as a colored badge in the detail panel and sidebar list. Based on ThoughtWorks Technology Radar framework.
- **Risk Register — Treatment plan + owner + review date**: Each risk now has `treatment` (text), `owner` (text), and `reviewDate` (date) fields in the add/edit modal, rendered in the risk detail card.
- **Stakeholder Map — Engagement level**: Each stakeholder card now has an engagement level field (Unaware / Resistant / Neutral / Supportive / Leading). Grounded in PMBOK stakeholder engagement assessment matrix.
- **Learning Log — Key insight field (Feynman)**: Each log entry now has a `keyInsight` textarea field ("explain it simply"). Grounded in the Feynman Technique — learning by articulating in plain language.

**Files:** `scrum-hub.html`, `decision-hub.html`, `goals-hub.html`, `tool-portfolio.html`, `risk-hub.html`, `stakeholder-hub.html`, `learning-hub.html`

---

### ~~Priority 33 — Framework Quick Wins (10 improvements)~~ ✓ Done `[group: framework-quick-wins]`
Second wave of framework-grounded enhancements, addressing remaining gaps from the tool→framework mapping.

- **Scrum Board — WIP limits on Sprint kanban**: Each kanban column (To Do / In Progress / Done) now has a WIP limit input. Columns turn red when over limit. Stored in `state.wipLimits`. Grounded in Kanban's core WIP constraint principle.
- **Project Hub — WIP limits on Kanban view**: Same WIP limit inputs added to the Project Hub kanban. Stored in `state.kanbanWip`, persisted to `project-hub-v1`.
- **Focus Timer — Energy level (GTD)**: Session form now has an Energy select (⚡ High / 🌤 Medium / 🌙 Low). Stored in `timerState.energy`, saved to session records. Aligns with GTD's context-based task selection.
- **Focus Timer — Context tagging (GTD)**: `<input list>` with datalist suggestions (`@deep-work`, `@admin`, `@calls`, `@creative`, `@learning`, `@errands`). Stored in `timerState.context`. Shown as badge on session history.
- **Focus Timer — Pomodoro estimation**: Number input (1–20 pomodoros). Stored in `timerState.pomodoroEst`, shown as `🍅 X` badge in session history.
- **Decision Hub — ABP Signpost + Hedging Action**: Assumption cards now have two new fields: `signpost` (observable confirmation event) and `hedge` (fallback action if assumption fails). Grounded in RAND Corp's Assumption-Based Planning methodology.
- **Daily Log — Bullet Journal mode chips**: Three mode chips (📓 Journal / ✅ Tasks / 📅 Events) switch the textarea placeholder to match the Bullet Journal Method's rapid-logging entry types.
- **Daily Log — Feynman "What did I learn?" prompt**: Dedicated learning textarea below each entry. Stored as `entry.learning`. Grounded in the Feynman Technique.
- **Tool Portfolio — TOGAF Architecture Layer**: Each tool now has an `archLayer` field (Business / Data / Application / Technology). Shown as a select in the detail panel. Grounded in TOGAF's four architecture domains.
- **Goals Hub — Risk count chip**: Objective cards now show a `⚠ X risks` badge when the objective's linked project has open risks in the Risk Register. Reads `risk-hub-v1` live.
- **KMQT Board — Tags on items**: Each KMQT item now has a `tags` array (comma-input in edit modal). Tags shown as pills in each column. Enables Kaizen-style categorization of improvement themes.

**Files:** `scrum-hub.html`, `project-hub.html`, `focus-hub.html`, `decision-hub.html`, `log-hub.html`, `tool-portfolio.html`, `goals-hub.html`, `kmqt-board.html`

---

### ~~Priority 34 — New tool: Help & Guide~~ ✓ Done `[group: new-tools-solo]`
Dedicated help/about page surfacing all 19 tools with framework connections, when-to-use guidance, key features, and sample scenarios. Also includes a Framework Reference (37 frameworks) and 4 pre-built workflow guides.

**Three view modes:**
- **Tools** — sidebar lists all 19 tools grouped by workflow cycle; detail panel shows frameworks used, when to use, key features, sample scenario
- **Frameworks** — sidebar lists all 37 frameworks grouped by domain; detail panel shows what it is, certifications, which tools use it
- **Workflows** — 4 workflow cards: Project Kickoff, Weekly Rhythm, Decision Sprint, Idea → Delivery

**Framework domains covered:** Project & Task (blue), Agile & Lean (green), Goal-Setting (yellow), Decision-Making (purple), Risk & Governance (red), Stakeholder & People (orange), Personal Productivity (cyan), Knowledge & Learning, Design & Ideation.

**Files:** `help-hub.html` (new), `index.html` (APPS array), `CLAUDE.md` (file map)
