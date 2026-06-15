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
| `hub-ai.js` | AI Assistant module: `HubAI.capture/chat/testKey/getKey/saveKey/isConfigured` — calls Claude Haiku API. Self-contained (reads `hub-settings-v1` directly), so any tool can load it — currently `index.html` and `focus-hub.html` |
| `supabase-schema.sql` | Cloud DB schema |
| `project-hub.html` | Project + task tracking |
| `schedule.html` | Calendar / timeline |
| `idea-swiper.html` | Rapid idea triage (swipe) |
| `kmqt-board.html` | ⚠ Retired from sidebar — data can be imported into Reflection Board via "Import KMQT" button |
| `decision-hub.html` | Decision log + alignment matrix + **Assumptions tab** (reads `assumptions-hub-v1`). Canonical schema fields (alternative / revisit-when / revisit-date / outcome) + `⚖ Calibration` modal (P51) |
| `canvas-hub.html` | Infinite spatial canvas |
| `graph-hub.html` | Task dependency graph (vis-network) |
| `tool-portfolio.html` | Curated tool/vendor directory |
| ~~`scrum-hub.html`~~ | ❌ **Deleted 2026-06-13** (Priority 50) — file removed. `scrum-hub-v1` localStorage data is NOT purged (still in Full Backup + MCP sync key lists) but no tool reads it. |
| `focus-hub.html` | Pomodoro focus timer, task session log |
| `log-hub.html` | ⚠ Retired from sidebar — data lives on in `log-hub-v1`, accessed via Journal Hub → Daily tab |
| `retro-hub.html` | ⚠ Retired from sidebar — data can be imported into Reflection Board via "Import Retro" button |
| `reflection-hub.html` | Reflection Board — Signal / Friction / Question / Action board; replaces KMQT + Retro; cross-column SVG links, snapshots, reactions, drag-drop, inline editing |
| `assumptions-hub.html` | ⚠ Retired from sidebar — data lives on in `assumptions-hub-v1`, accessed via Decision Hub → Assumptions tab |
| `review-hub.html` | ⚠ Retired from sidebar — data lives on in `review-hub-v1`, accessed via Journal Hub → Weekly tab |
| `journal-hub.html` | Journal Hub — Daily Log + Weekly Review under one tab bar; day chips link weekly → daily; data stays in `log-hub-v1` + `review-hub-v1` |
| `matrix-hub.html` | ⚠ Retired from sidebar — data lives on in `matrix-hub-v1`, accessed via Project Hub → Priority Matrix view |
| `meetings-hub.html` | Meeting Hub — structured meetings with type templates, RACI-lite attendee roles, decision register, schedule sync, recurring templates, dependency graph links, and .ics calendar import (Outlook/Teams) |
| `argument-hub.html` | Argument Hub — structure a case top-down with the Pyramid Principle (Barbara Minto): SCQA intro, governing thought, recursive MECE supporting pyramid (inductive/deductive logic + time/structure/degree ordering per group), live structure checks, Markdown export. Storage `argument-hub-v1` |
| `goals-hub.html` | OKR / quarterly goals hub |
| `learning-hub.html` | Reading & learning log |
| `stakeholder-hub.html` | Visual power/interest stakeholder grid |
| `risk-hub.html` | Risk register with heat-map |
| `achievements-hub.html` | Achievements & milestones tracker + **Profile** (identity header: name / role / who-is-me, edits `hub-settings-v1.profile`; P53) |
| `help-hub.html` | Help & Guide — tool directory, framework reference (37 frameworks), 4 suggested workflows |
| `frameworks-hub.html` | Frameworks — experiment sandbox; tabbed container for method tools: Blocked Depth (iceberg) and V-Model. (Scrum Board tab removed 2026-06-13, Priority 50.) |
| `blocked-depth.html` | Blocked Depth — iceberg cascade view (now surfaced as a tab inside `frameworks-hub.html`); shows every task, milestone, and person frozen downstream of a blocked task |

## Script load order (required)
`hub-storage.js` → `hub-utils.js` → `hub-starter-data.js` (index.html only) → `hub-obsidian.js` → `hub-links.js` → `hub-search.js` → `hub-toast.js` → `hub-bootstrap.js` → `hub-ai.js` (index.html + any tool with a manual AI feature, e.g. `focus-hub.html`)

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
`hub-session-v1`, `project-hub-v1`, `schedule-v1`, `decision-hub-v1`, `kmqt_current_v2`, `canvas-v1`, `hub-links-v1`, `ideaswipe_history_v6`, `hub-cloud-config-v1`, `th-theme`, `tutorial-seen-v1`, `quick-tour-seen-v1`, `focus-hub-v1`, `log-hub-v1`, `retro-hub-v1`, `assumptions-hub-v1`, `review-hub-v1`, `matrix-hub-v1`, `meetings-hub-v1`, `goals-hub-v1`, `learning-hub-v1`, `stakeholder-hub-v1`, `risk-hub-v1`, `argument-hub-v1`, `scrum-hub-v1` ⚠ orphaned (tool deleted P50, data retained), `hub-activity-v1`, `hub-settings-v1`, `tool-portfolio-v1`, `reflection-hub-v1`, `hub-warroom-v1` ⚠ orphaned (War Room deleted P50, data retained), `hub-resurface-v1` (ephemeral — Resurface dismiss-state, P51; excluded from backup/sync like other UI-state keys)

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
- **Record decisions, not just outcomes.** When a completed item involves a non-obvious choice (a tradeoff, a "why this approach over the alternative", a convention that future work should follow or avoid), add a **"Key decisions"** bullet list under that backlog entry — one line per decision, framed as *what was chosen* + *why* (not just what changed). Skip this for purely mechanical changes (typo fixes, simple wiring) where the "why" is self-evident. This is what lets future sessions reuse reasoning instead of re-litigating it.
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

---

### ~~Priority 35 — UX Safety & Polish (A1+A2+A3)~~ ✓ Done `[group: ux-polish]`
Three quality-of-life passes across multiple tools.

- **A1 — Delete confirmations**: `canvas-hub` (`deleteNode`), `matrix-hub` (`deleteItem`), `retro-hub` (`deleteItem`), `review-hub` (`removeRock`) — all guard with `confirm()` before mutation.
- **A2 — Save toast feedback**: 9 tools now call `showToast()` after save: `goals-hub`, `meetings-hub`, `risk-hub`, `assumptions-hub`, `matrix-hub`, `graph-hub`, `focus-hub`, `tool-portfolio`, `scrum-hub`. (`log-hub` and `review-hub` already had save-status feedback; `canvas-hub` auto-saves silently by design.)
- **A3 — Empty state messages**: Upgraded 4 tools that showed blank screens to first-time users: `goals-hub`, `meetings-hub`, `risk-hub`, `learning-hub`. Others already had adequate empties.

**Files:** `canvas-hub.html`, `matrix-hub.html`, `retro-hub.html`, `review-hub.html`, `goals-hub.html`, `meetings-hub.html`, `risk-hub.html`, `assumptions-hub.html`, `graph-hub.html`, `focus-hub.html`, `tool-portfolio.html`, `learning-hub.html`, `theme.css`

---

### ~~Priority 36 — Cross-tool Data Surfacing (B1+B2+B3)~~ ✓ Done `[group: cross-tool-data]`
Three data-surfacing improvements across tools.

- **B1 — Project badges on tool list rows**: `meetings-hub`, `risk-hub`, `scrum-hub` backlog now show a `.proj-badge` chip when no project filter is active. `decision-hub` already groups by project; `stakeholder-hub` doesn't store `projectId`.
- **B2 — Weekly Review auto-summary**: `review-hub` Done column now auto-pulls activity chips from decisions, risks, meetings, focus sessions, retro actions, and learning entries made in the review week — displayed as `buildActivityHTML()` section below existing task rows.
- **B3 — Focus sessions → task time badges**: `project-hub` task rows show a `⏱ Xm` focus badge (monospace, surface3 bg) when `focus-hub` has sessions logged for that task ID. Uses module-level `_focusMap` built by `buildFocusMap()`.

**Files:** `meetings-hub.html`, `risk-hub.html`, `scrum-hub.html`, `review-hub.html`, `project-hub.html`

---

### ~~Priority 37 — Global Search Expansion (C1)~~ ✓ Done `[group: search]`
Cmd+K expanded from 6 to 13 tools. Added resolvers in `hub-links.js` for `meetings-hub`, `goals-hub`, `risk-hub`, `learning-hub`, `retro-hub`, `stakeholder-hub`, `scrum-hub`. Added all 7 to `TOOLS` array in `hub-search.js`. Each resolver returns `{id, label, subtitle}` items navigable via `hub-highlight` postMessage.

**Files:** `hub-links.js`, `hub-search.js`

---

### ~~Priority 38 — Dashboard Widgets & Profile Filtering (D1+D2)~~ ✓ Done `[group: dashboard]`
Four new home dashboard status widgets + profile-aware filtering.

- **D1 — New widgets**: Open risks (with severity color dots), meeting action items (unresolved, non-task-created), focus sessions today (total time + completed count), retro actions from latest retro board. All subscribe to their storage keys for live updates.
- **D2 — Profile filtering**: `buildHomeDashboard()` filters the app grid to only show tools in the active profile. `buildStatusWidgets()` filters widgets the same way. Profile chip onclick triggers both rebuilds. The `everything` profile (default) shows all tools and all widgets.

**Files:** `index.html`

---

### ~~Priority 39 — Retro-hub drag-drop between columns (E1)~~ ✓ Done `[group: retro-ux]`
Cards in retro-hub are now draggable across columns. Each card gets `draggable="true"` and `data-col` attributes. `initDragDrop()` wires a single delegated `dragstart`/`dragend` pair on document (so listeners survive innerHTML re-renders) plus `dragover`/`dragleave`/`drop` on each `.col-body`. Dropping on a different column splices the item from the source array, appends it to the target, saves, and re-renders both columns. Also fixed two hardcoded hex values in retro-hub CSS (`#f59e0b` → `var(--accent-super)`, `#a78bfa` → `var(--border-purple)`).

**Files:** `retro-hub.html`

---

### ~~Priority 40 — New tool: Blocked Depth~~ ✓ Done `[group: new-tools-solo]`
Iceberg cascade view: surface a blocked task above the waterline, reveal every open task, at-risk milestone, and affected person frozen beneath it. Proportional card heights encode cascade impact at a glance.

**Concept:** Inspired by SmartPM's "size up the iceberg" risk-depth framing. Above the waterline = the visible blocked task (severity bar, owner chip, project chip, reason). Below the waterline = cascade depth (waiting tasks, milestones at risk, people affected). Impact score = `tasks × 1 + milestones × 1.8 + people × 0.8`. Cards are proportionally sized and sortable by deepest / longest blocked / milestone risk. Click any layer row to expand the item list.

**Key decisions:**
- Cascade heuristic: open, non-done siblings in the same project = "downstream" (no explicit `dependsOn` field in the data model)
- Sea gradient uses tool-local CSS vars (`--_sea-top/mid/deep`) — decorative, not in theme.css
- All semantic colors use theme.css tokens: `--accent-nope` (blocked), `--accent-super` (tasks), `--border-purple` (milestones), `--border-blue` (people)
- Profiles: `dx` and `dev` (not `bim` — less relevant to BIM authoring workflow)

**Files:** `blocked-depth.html` (new), `index.html` (APPS + PROFILES), `CLAUDE.md` (file map)

---

### ~~Priority 41 — Design identity pass (3 groups)~~ ✓ Done `[group: design-identity]`
Frontend-design review found the app read as "generic dark dashboard + one neon-lime accent + DM Sans everywhere." Three-group pass to give it a distinctive, memorable identity. All Group 1 work is token-level (`theme.css`), so it propagates to all tools automatically.

- **Group 1 — Token foundation (`theme.css`):**
  - **Typography**: `--font-display` split from `--font-body` and set to **Fraunces** (editorial serif, `opsz` axis, `font-optical-sizing: auto`); `--font-body` stays DM Sans; `.logo` + the sidebar logo mark stay Syne. Display serif lands on headings/greetings/card names/section titles only.
  - **Secondary identity tokens**: `--accent2` / `--accent2-dim` / `--accent2-glow` added to all themes (dark = warm coral `#ff8a5c`, light = terracotta `#e0603a`).
  - **Background atmosphere**: `body` now layers two corner gradient meshes (`--atmo-1`, `--atmo-2`) + a tiling inline-SVG `feTurbulence` grain (~3.5%). `background-attachment: scroll` (NOT `fixed` — fixed risks scroll-raster jank inside the 20 iframe tools).
  - **New 3rd theme `ink`**: paper background + **terracotta/oxblood** pivoted accent + ink-indigo secondary, full node/border palette. Theme toggle now cycles `dark → light → ink` (🌙→🌞→🖋) via a `cycle` array in `applyTheme`'s click handler.
  - **Micro**: scrollbars 3px→7px; new `--r-chip` (5px) radius tier applied to the shared `.proj-badge` primitive.
- **Group 2 — Shell motion (`index.html`):**
  - **Staggered entrance**: `.app-card` uses the existing `card-enter` keyframe with index-based `animationDelay` (`i * 0.035s`) set in `buildHomeDashboard`. Deliberately NOT applied to stat cards (their `buildStatusWidgets` re-runs on every storage subscribe — would flicker).
  - **Differentiated hover**: app-cards lift + soft shadow; stat-cards get a left accent-bar reveal via `::before` `scaleY` (replacing the old identical accent-dim flood); nav-items keep their flat fill.
  - **Logo**: solid accent mark, Syne face, `--accent-glow` shadow + inset highlight, a `--accent2` corner dot via `::after`, and a subtle scale/rotate on `.sidebar-logo:hover`.
- **Group 3 — Layout break (`index.html`):**
  - **Hero card**: first tool in the active profile (Project Hub in `everything`) gets `.app-card--hero` — `grid-column: span 2`, dual-tone `--accent-dim → --accent2-dim` gradient, 44px icon, 23px serif name (18px on mobile). Breaks the uniform `auto-fill` rhythm. Mobile (2-col grid) renders it full-width.

**Verification note:** preview screenshots were infra-flaky this session (renderer raster hung while the page stayed responsive to `eval`); changes were verified via computed-style inspection + zero console errors. Hero confirmed at 2× sibling width.

**Files:** `theme.css`, `index.html`

**Follow-up — tool consistency propagation (Groups A + B):** Group 1's tokens reach all tools via `theme.css`, but tools that *hardcoded* the old lime (`#b8f033` / `rgba(184,240,51,…)`) broke under `ink`/light. Swept 32 occurrences across 12 files:
- **Group A (CSS `<style>` blocks → tokens):** `focus-hub`, `decision-hub`, `graph-hub`, `stakeholder-hub`, `matrix-hub`, `tool-portfolio`, `project-hub` (×4), `index.html` (×4), + one inline-style template in `schedule` (CSS vars resolve in inline `style=""`). Mapped to `--accent-dim` / `--accent-glow` / `--accent`.
- **Group B (JS canvas/SVG — vars don't resolve there):** `canvas-hub` SVG edges now use inline `style.stroke = 'var(--accent-glow)'` (auto theme-reactive, incl. delete-hover → `--accent-nope`); `canvas-hub` minimap `ctx.strokeStyle` + `graph-hub` vis-network highlight/hover colors resolved at render via `getComputedStyle('--accent' / '--accent-glow')`. Verified: accent resolves to terracotta inside the iframe under `ink`.
- **Deliberately left as-is:** fixed color *palettes* (`goals-hub` `OBJ_COLORS`, `achievements-hub` `COLORS`, `schedule` swatch list) and `project-hub` kanban "Done" semantic color — these are user-selectable/saved color choices, not theme accents.

**Follow-up — app-wide hover signature ✓ Done:** carried the home `.stat-card` left accent-bar reveal into tool interiors so the app feels authored beyond the shell. Implemented as ONE grouped rule in `theme.css` (no per-tool HTML edits) using `::after` (dodges existing `::before` decorations), applied to the primary clickable list-item class of each list-style tool: `.task-item .risk-row .meeting-row .list-item .obj-card .bl-item .session-row .assumption-card .asm-card .lh-entry-item`. Cascade-safe — tool `<style>` loads after theme.css, so any tool already styling its row's `::after`/position wins and the rule silently no-ops. **Scope is intentional:** spatial/board tools (canvas, graph, matrix & stakeholder 2×2 grids, kanban columns) and sidebar `nav-item` lists keep their own idiom; the bar suits vertical content lists only. Bar uses `var(--accent)` so it tracks all three themes (verified terracotta under `ink`).

**Follow-up — canvas-hub minimap ink fix ✓ Done:** the minimap previously classified `ink` as dark (`_isDark = theme !== 'light'`), drawing dark node tiles on ink's paper background. Removed the `_isDark` branch and the hardcoded `colorFillDark`/`colorFillLight` maps entirely; node fills now read the theme-aware `--node-*` tokens via `getComputedStyle` (`--node-` + class.slice(2)), node borders use `--border2`, and the viewport rectangle uses `--text2`. Correct in all three themes. Verified: under `ink`, tokens resolve to paper values (`--node-blue #cdd9ec`, `--border2`/`--text2` dark ink) with no console errors. `_isDark` no longer appears anywhere in canvas-hub.

**Files:** `theme.css`, `index.html`, `focus-hub.html`, `decision-hub.html`, `graph-hub.html`, `stakeholder-hub.html`, `matrix-hub.html`, `tool-portfolio.html`, `project-hub.html`, `schedule.html`, `canvas-hub.html`

---

### ~~Priority 42 — War Room Mode~~ ✓ Done `[group: war-room]`
Fullscreen "glanceable status board" overlay, toggled by `W` key (`toggleWarRoom()`), always-dark hardcoded palette (intentional — not theme-aware). Auto-refreshes every 60s; live clock ticks every 1s.

**6 panels:**
- **Today's Focus** — read-only display of pinned tasks (✓ mark done / × unpin), plus today's focus-session summary. Picking happens in **Project Hub** via the new 🎯 task action button (see below); empty state points users there. Persisted to `hub-warroom-v1` (`{ date, focusIds: ['projId::taskId', ...] }`, max 8, resets daily).
- **My Active Projects** — ALL active projects (no cap), filtered to `selfMemberId` if set, with progress bar + open/mine counts.
- **This Month** — full-panel month calendar grid (current month, leading/trailing days from adjacent months dimmed), days with schedule items get a dot; today outlined. No upcoming-list below — calendar fills the whole panel like the Schedule tool.
- **Today's Web** — single unified radial dependency graph (`_wrTodayWebGraph()`): a center "hub" node (today's date number) connects to up to 5 first-ring "today" items (pinned focus tasks, due-today tasks, today's meetings — color-coded), each of which can have up to 2 second-ring satellite nodes for cross-tool linked items via `HubLinks.getLinksFor()` (glyph + tooltip with tool name/label). Animated dashed connector lines (hub→item solid dash, item→satellite finer dash). Item labels render toward the hub side (not away) to avoid overlapping satellite nodes. Empty state if no items today.
- **Key Metrics** — 4 rows / 12 chips: open/blocked/overdue tasks; decisions/risks/OKR avg; % tasks done/focus time today/project count; team members/meetings in next 7d/tasks done in last 7d.
- **Needs Attention** — blocked / overdue / due-today tasks.

**Visual pass:** `.wr-atmo` ambient drifting gradient-mesh background (`@keyframes wr-atmo-drift`, 32s loop, 4 gradients, higher opacity/blur); `.wr-body`/`.wr-panel`/`.wr-header` backgrounds further lightened (`rgba`) so the atmo glow bleeds through clearly.

**Project Hub → War Room focus picker:** Each task row in `project-hub.html` has a 🎯 action button (`toggleWarRoomFocus()`) that pins/unpins the task to/from `hub-warroom-v1` (max 8, resets daily, shows a toast). `_warroomFocusSet` / `buildWarroomFocusSet()` track today's pinned keys (`projectId::taskId`); the button shows active (green) state and the task's action bar stays visible without hover via `.task-item:has(.task-action-btn.warroom.active)`.

**Files:** `index.html`, `project-hub.html`, `CLAUDE.md`

---

### ~~Priority 43 — Meeting Hub: ICS calendar import~~ ✓ Done `[group: meetings-import]`
"📥 Import .ics" button in the Meeting Hub topbar lets users import meetings from an Outlook/Teams/Google calendar export (`.ics` file), including weekly recurring meetings.

**Implementation (`meetings-hub.html`):**
- Inline RFC5545-ish parser: `unfoldICS` (line continuation), `parseICS` (VEVENT → object: uid, summary, description, location, status, dtstart/dtend, rrule, exdates, attendees via `CN=` extraction), `parseICSDateValue` (UTC / local / all-day formats), `parseRRULE`.
- `expandEventOccurrences(ev, windowStart, windowEnd)` expands DAILY/WEEKLY (incl. BYDAY)/MONTHLY/YEARLY RRULEs with INTERVAL/COUNT/UNTIL/EXDATE support, capped at 5000 iterations.
- Import window: today − 7 days to today + 90 days. `STATUS:CANCELLED` events are skipped.
- `guessMeetingType(title)` maps keywords (standup, 1:1, retro, planning, kickoff, review, decision, weekly/sync) to `MEETING_TYPES` keys; defaults to `custom`.
- Each imported meeting gets `icsUid` + `icsKey` (`${uid}::${date}`) fields for dedup on re-import. Time/location/description go into the `notes` field (no schema changes).
- `handleIcsImport(event)` reads the file via `FileReader`, calls `importICSText(text)`, shows a toast with import counts.

**Files:** `meetings-hub.html`, `CLAUDE.md`

---

### ~~Priority 44 — Meeting Hub: attendee management + repeat~~ ✓ Done `[group: meetings-import]`
Follow-up to ICS import — large imported attendee lists were unwieldy, attendee names had no link to registered members, and recurring meeting types were tags only with no way to create the next occurrence.

**Implementation (`meetings-hub.html`):**
- **Attendee pill collapse** — `ATTENDEE_COLLAPSE_THRESHOLD = 15`; lists longer than that show the first 15 + a "+N more" toggle (`toggleAttendeesExpanded()`, module-level `attendeesExpanded` flag).
- **Bulk attendee edit** — "✎ Edit list" button opens a modal (`#attendees-modal-overlay`) with a one-name-per-line textarea; `saveAttendeesBulk()` re-diffs against the existing list (preserving roles for names that still match) and `clearAllAttendees()` wipes the list with a confirm.
- **Member-aware autocomplete** — `getHubMembers()` reads `HubData.getMembers()`; the "+ Add" name input gets a `<datalist id="att-member-suggestions">` of registered member names (free text still allowed). Attendees whose name matches a registered member show a small colored `.att-member-dot` (member's saved color) in their pill.
- **Repeat / duplicate meeting** — "🔁 Repeat" button opens `#repeat-modal-overlay` with quick-pick chips (+1 day / +1 week / +2 weeks / +1 month, default based on meeting type) and a date input. `confirmRepeatMeeting()` creates a new meeting copying title/type/attendees/agenda/project, with notes/action items/decisions/schedule sync reset to fresh. `addDaysToDate`/`addMonthToDate` reuse the `dateFromYMD`/`ymdFromDate` helpers from ICS import.

**Files:** `meetings-hub.html`, `CLAUDE.md`

---

### ~~Priority 45 — War Room polish + AI Smart Priorities + home page integration~~ ✓ Done `[group: war-room-polish]`
Follow-up to Priority 42 (War Room Mode) — readability, calendar, animation, AI, and discoverability improvements.

- **Readability colors** — `.wr-clock`, `.wr-date`, `.wr-exit-hint` (+ `kbd`), and `.wr-footer` brightened from near-invisible dark blues (`#1e3050`/`#2a3a50`/`#3a5a78`) to the existing readable palette (`#b8d0e8`/`#7a98b8`/`#5a7a98`).
- **Weekend calendar styling** — "This Month" panel: Sat/Sun `.wr-cal-dow` headers and `.wr-cal-day` cells get `.is-weekend` (warm terracotta tint `#d97757`/`#d99a85`), placed before `.is-today` in source order so today's styling still wins when both apply.
- **Panel entrance + refresh animation** — `.wr-panel` plays a staggered `wr-panel-enter` (translateY+scale fade-in, `nth-child` delays) each time War Room opens; `.wr-panel-list` gets a `wr-refreshing` flash class re-triggered via reflow on every 60s `_buildWarRoom()` cycle.
- **AI Smart Priorities panel** — replaces "Needs Attention". New `✦ Smart Priorities` panel (purple `--_wra:#a78bfa`) with a `↻` refresh button (`#wr-briefing-refresh`, spins while loading). Manual-trigger only (no auto token spend). `_wrGenerateBriefing()` sends today's blocked/overdue/due-today tasks + open risks to `HubAI.chat()` with a system prompt asking for the top 3-5 items to tackle first, each as one short "<item> — <reason>" line. Result cached in `hub-warroom-v1.aiBriefing {text, generatedAt}`, reset daily alongside `focusIds` via new `_wrLoadState()`. Shows a "Settings → Integrations" hint link if `HubAI.isConfigured()` is false.
- **Home page War Room button** — `⚔` icon button in the session bar (next to the tour `?` button) calls `toggleWarRoom()`, for users who don't know the `W` shortcut.
- **Today tab "Today's Focus" card** — `buildTodayView()` now reads pinned tasks from `hub-warroom-v1` (today's `focusIds`) and renders them first in the Today grid, each with a `.today-focus-check` ○ button calling `_wrToggleDone()`. `_wrToggleDone`/`_wrRemoveFocus` now also call `buildTodayView()` so the card updates live.

**Files:** `index.html`, `CLAUDE.md`

---

### ~~Priority 46 — Schedule Calendar: meetings, full-height grid, weekend styling~~ ✓ Done `[group: schedule-calendar]`
Three improvements to the Calendar view in `schedule.html`.

- **Meetings on calendar** — `getMeetingsByDate()` reads `meetings-hub-v1` and groups meetings by `date`. `meetingPillHtml(m)` renders each as a `.cal-pill.meeting` (▣ icon, `--node-blue`/`--border-blue` styling) that calls `parent.postMessage({type:'hub-navigate', tool:'meetings-hub', itemId:m.id}, ...)` on click. Both `renderCalMonth()` and `renderCalWeek()` show meeting pills first, then schedule-item pills, up to a combined `shownLimit` of 4 per day (month view), with a `+N more` overflow indicator.
- **Full-height grid** — `.cal-grid` now uses `grid-template-rows: repeat(var(--cal-rows, 6), minmax(0, 1fr))` + `height: 100%` + `min-height: 480px`; JS sets `--cal-rows` per render (`days.length / 7` for month view — 5 or 6 depending on the month, `1` for week view). Eliminates the gap below the grid and gives each day cell more room. `.cal-day-cell` switched from fixed `min-height: 88px` to `min-height: 0; overflow-y: auto`.
- **Weekend styling** — `.cal-week-label.weekend` (Sat/Sun headers) uses `var(--accent2)`; `.cal-day-cell.weekend` / `:hover` use `var(--accent2-dim)` / `var(--accent2-glow)` — same secondary-identity tokens as the War Room weekend calendar (Priority 45), theme-aware across dark/light/ink.

**Key decisions:**
- **`--cal-rows` over a fixed `repeat(6, ...)`** — months render 5 or 6 week-rows depending on layout; computing the actual row count (`days.length / 7`) and feeding it into `grid-template-rows` via a CSS custom property lets every row stretch evenly to fill `.cal-grid-wrap`, whether the month has 5 or 6 rows, with no leftover gap.
- **Token-based weekend color, not War Room's hardcoded hex** — War Room's calendar uses a fixed terracotta hex because War Room is intentionally non-theme-aware (always-dark). `schedule.html` IS theme-aware (dark/light/ink), so `--accent2` / `--accent2-dim` / `--accent2-glow` were used instead — same visual language, but correct across all three themes.
- **Meetings get a distinct pill style (`.cal-pill.meeting`, `--node-blue`/`--border-blue`)** rather than reusing the per-item color system schedule items use — meetings don't carry a `color` field, and a fixed style makes them instantly distinguishable from project tasks/milestones at a glance.
- **Meeting pills are prioritized first, then schedule items fill remaining slots** (combined `shownLimit = 4`, raised from the old `3` now that cells are taller) — meetings are fixed-time commitments and arguably more "calendar-native" than multi-day task bars, so they get visual priority when a day is crowded.
- **Hardcoded `▣` icon instead of importing `MEETING_TYPES`** — `MEETING_TYPES` (per-type icons) is defined only in `meetings-hub.html`'s scope and isn't accessible from `schedule.html`. Rather than duplicating that map across files, reused the single glyph `index.html` already uses for the Meeting Hub tool itself — keeps the cross-tool icon vocabulary consistent without a second source of truth.

**Files:** `schedule.html`, `CLAUDE.md`

---

### ~~Priority 47 — Time-block week grid + drag/resize + AI energy insights~~ ✓ Done `[group: time-grid-and-insights]`
Inspired by external time-blocking tools (Sunsama/Akiflow-style). Four-part build: time fields on items/meetings, a real hourly week grid, drag/resize for blocks, and an AI panel correlating focus energy with daily mood.

- **Time-of-day fields** — `schedule-v1` items gained optional `startTime`/`endTime` (HH:MM, `null`/`null` = all-day); `meetings-hub-v1` meetings gained `time` (HH:MM, `''` = no time) and `durationMins`. Drawer/detail forms expose `<input type="time" step="1800">` pairs; saving with only a start time defaults the end to `start + 30min` via new `timeToMinutes`/`minutesToTime`/`addMinutesToTime` helpers in `schedule.html`. ICS import and `confirmRepeatMeeting()` carry `time`/`durationMins` through; `syncToSchedule()` derives `endTime` from `time + durationMins`.
- **Hourly week grid** — Calendar week view in `schedule.html` replaced with a 06:00–22:00 grid (30-min slots, `WG_START_MIN`/`WG_END_MIN`/`WG_SLOT_MIN`/`WG_PX_PER_MIN` constants). A sticky all-day row holds multi-day items, date-only items, and untimed meetings. Day columns show `WORK_PERIODS` bands (`08:30-12:00`, `13:00-17:30`, `var(--accent-dim)`) on weekdays and `--accent2-dim` weekend tint. Single-day timed items and timed meetings render as positioned `.wg-block`s via `layoutLanes()` (greedy overlap → side-by-side lanes). Clicking empty grid space (`handleGridClick`) opens the Add Item drawer with the clicked time pre-filled (`openDrawer(id, prefillDate, prefillTime)`).
- **Drag & resize** — `.wg-block`s support drag-to-move (reassigns day + snaps time to 30 min, `wgBlockMouseDown`/`wgDragMove`/`wgDragEnd`) and drag-to-resize from a bottom-edge handle (`wgResizeMouseDown`, min 30-min duration). A <4px mouse movement is treated as a click (opens drawer / navigates to meeting) instead of a drag. Items persist via `saveState()`; meetings persist via `HubStorage.set('meetings-hub-v1', data)` (`moveItem`/`resizeItem`/`moveMeeting`/`resizeMeeting`).
- **AI Energy Insights (Focus Hub)** — New "✦ Energy Insights" panel in `focus-hub.html`'s sidebar, manual-trigger (`↻` button, no auto token spend, mirrors War Room's Smart Priorities pattern). `generateInsights()` builds a 14-day digest of completed focus sessions (time of day, duration, energy, GTD context, task) joined with that day's mood (1-5) from `log-hub-v1.entries`, sends it to `HubAI.chat()` with a pattern-finding system prompt, and caches the 3-5 result lines in `focus-hub-v1.aiInsights {text, generatedAt}`.

**Key decisions:**
- **06:00-22:00 grid range with hardcoded `WORK_PERIODS`** — user explicitly wants 08:30-12:00 / 13:00-17:30 visualized as a fixed reference band (including as a soft check against their own overworking past 17:30), not a configurable setting — simplicity over flexibility here is intentional.
- **Greedy global lane assignment, not per-cluster** — `layoutLanes()` assigns lanes per day-column across all blocks rather than computing independent overlap clusters; acceptable v1 simplification given typical low item density per day, avoids more complex interval-graph coloring.
- **Drag preview reparents the live `.wg-block` node** (not a separate ghost element) — simplest way to get real-time visual feedback across day columns without duplicating render logic; lane position (left/width) is reset to full-width during drag and recomputed correctly on the post-drop `renderCalendar()`.
- **Click vs. drag disambiguation via movement threshold** (4px), not a separate drag handle — blocks can be as short as one 30-min slot (24px), too small to carve out a dedicated handle area without hurting usability.
- **`hub-ai.js` loaded directly in `focus-hub.html`** — previously "index.html only" by convention, but the module is self-contained (reads `hub-settings-v1` via plain `localStorage`, dynamically imports its own SDK) so it works identically inside any same-origin iframe. Loading it per-tool (rather than relaying through `index.html` via postMessage) keeps the `HubAI.chat()` call-site identical to the established War Room pattern. Convention updated: `hub-ai.js` may be loaded by index.html *and* any tool with its own manual AI feature.
- **Insights are per-day digests, not raw session dumps** — grouping sessions by day and pairing each day's session list with that single day's mood keeps the prompt compact (≤14 lines) and gives the model an explicit unit of correlation (a "day"), rather than asking it to infer day boundaries from timestamps itself.

**Files:** `schedule.html`, `meetings-hub.html`, `focus-hub.html`, `CLAUDE.md`

---

### ~~Priority 48 — ICS UTC time fix, Timeline label dedup, Meeting Hub time picker~~ ✓ Done `[group: meetings-and-timeline-followups]`
Three follow-up fixes from real-world use of Priority 47's time-block grid.

- **ICS import dropped time for UTC events** — `parseICSDateValue` correctly parsed `Z`-suffixed (UTC) `DTSTART`/`DTEND` values, but `importICSText` only assigned `time`/`durationMins` when `!ev.dtstart.utc`, so any UTC-stamped event (the default for Outlook/Teams/Google exports) silently fell back to `time: ''` and rendered in the all-day row instead of its hour slot. New `icsUtcToLocal(dateStr, timeStr)` converts the UTC instant to the browser's local date+time via `Date.UTC(...)` + local getters; `importICSText` now uses the converted local time and shifts the meeting's `date` if the conversion crosses midnight (dedup `key`/`icsKey` still use the original UTC date, so re-import dedup is unaffected).
- **Timeline view "ITEMS" label column removed** — the Gantt/Timeline view had item titles rendered in three places: the persistent left sidebar (`#item-list`), a frozen 220px "ITEMS" label column (`.gantt-labels`/`#gantt-label-rows`), and inline inside each `.gantt-bar`. Removed the `.gantt-labels` column entirely (HTML, CSS, the `gantt-labels-scroll` ↔ `gantt-scroll` vertical scroll-sync IIFE, and the label-row rendering in `renderTimeline()`) — the sidebar already provides the title+date list with click-to-select, and `.gantt-bar`/`.gantt-milestone` already get a `.selected` highlight independent of the label column. `.gantt-scroll` (flex:1) now fills the full width.
- **Meeting Hub time picker redone** — `#dt-time` was a native `<input type="time" step="1800">` (locale AM/PM, 1-min spinner granularity). Replaced with a `<select>` populated by `meetingTimeOptions()`: 24h `HH:MM` values every 15 min from `06:00` to `22:00` (mirrors the Schedule week-grid's `WG_START_MIN`/`WG_END_MIN` range), plus a `— no time —` empty option. If a meeting's stored `time` doesn't fall on the 15-min grid (e.g. an odd ICS-imported time), an extra `<option>` preserves and selects that exact value so it isn't silently changed.

**Key decisions:**
- **UTC→local conversion shifts the date but keeps dedup keyed on the original UTC date** — `existingKeys`/`icsKey` are computed from `expandEventOccurrences`'s UTC-based `dateStr` *before* the local conversion, so re-importing the same ICS file still dedups correctly even though the displayed `m.date` may differ by ±1 day from that key.
- **`;TZID=` (non-`Z`) ICS timestamps are left as-is** — only `Z`-suffixed UTC timestamps get converted; events with an explicit `TZID` parameter are rare in the exports this app targets (Teams/Outlook default to UTC) and would need an IANA timezone table to convert correctly, which is out of scope.
- **Timeline dedup removes the column, not the inline bar label** — the frozen label column and the sidebar showed identical title lists; the inline bar label is the only one that's contextually useful while scanning the timeline (tells you what a bar is without looking away), so it stays.
- **Meeting time picker is a plain `<select>`, not a custom popup** — matches the existing `.type-select`/`.project-select` pattern already in the same toolbar row, needs no new CSS/JS widget, and browsers' native select search-by-typed-text still works for quick navigation.

**Follow-up — Meeting Hub `hub-highlight` listener ✓ Done:** clicking a meeting pill/block in `schedule.html` sends `hub-navigate` → `index.html` opens `meetings-hub.html` and posts `hub-highlight` with the `itemId`, but `meetings-hub.html` had no listener for it, so the first meeting in the list stayed selected regardless of which one was clicked. Added the same `hub-highlight` → `openMeeting(id)` pattern already used by `decision-hub.html`.

**Files:** `meetings-hub.html`, `schedule.html`, `CLAUDE.md`

---

### ~~Priority 49 — Project Hub: "Maintenance" project status~~ ✓ Done `[group: project-ux]`
Added `maintenance` as a project status, alongside `planning`/`active`/`onhold`/`done`. Previously only existed as an option in the new-project modal (`#proj-status`) — the existing-project Settings tab dropdown (`#ps-status`) was missing it, so projects already marked Maintenance couldn't be changed back via Settings and the status wasn't selectable for existing projects at all.

- `.s-maintenance` badge CSS added (uses `--node-purple`/`--border-purple`, already defined in all 3 themes).
- `statusClass()`/`statusLabel()` map `maintenance` → `'s-maintenance'` / `'Maintenance'`.
- `<option value="maintenance">Maintenance</option>` added to both `#proj-status` (new project modal) and `#ps-status` (Settings tab), positioned between "On Hold" and "Done".
- Overview filter chips gained a "Maintenance" chip; sort-by-status `ord` map gained `maintenance: 3` (between `onhold` and `done`, which shifted to `4`).

**Key decisions:**
- **`--node-purple`/`--border-purple` for the badge** — both tokens already exist in dark/light/ink themes, satisfying the "no new hex values" rule without adding new tokens.
- **`tool-portfolio.html`'s project-status color map (`statusColor`) was left unchanged** — `maintenance` falls through its `|| 'var(--text3)'` default, the same as `done` already does; not worth a special color for a small inline checkbox-list label.
- **Dashboard "active projects" filters (`index.html`) were left unchanged** — they already use `status !== 'done' && status !== 'archived'`, so `maintenance` projects correctly count as active/ongoing without any edit.

**Files:** `project-hub.html`, `CLAUDE.md`
### ~~Priority 49 — Declutter: retire Scrum Board into Frameworks~~ ✓ Done `[group: tool-consolidation]`
Scrum Board removed from the sidebar (solo/strategy work doesn't run sprints — it was unused) and moved into `frameworks-hub.html` as a third tab alongside Blocked Depth and V-Model. Frameworks is now the explicit home for parked/experimental method tools.

**Key decisions:**
- **Move into Frameworks, don't delete** — keeps `scrum-hub.html` + `scrum-hub-v1` data intact and the tool reachable, just out of the main nav. *Why:* may be revisited; deletion is irreversible and the file is cheap to keep. *Alternative rejected:* delete the file (loses data and the option to return). *Confidence:* high.
- **Nested iframe, lazy-loaded on first tab open** — *Why:* Scrum is a full tool, not an inline panel like Blocked Depth/V-Model; an iframe avoids re-implementing it, and lazy-load avoids loading Scrum every time Frameworks opens. *Tradeoff:* cross-tool links from inside the nested Scrum won't reach the shell (2-level nesting) — acceptable for a parked experiment.

**Files:** `index.html` (removed APPS entry), `frameworks-hub.html` (Scrum tab + panel + lazy-load), `CLAUDE.md`

---

### ~~Priority 50 — Delete War Room + Scrum Board~~ ✓ Done `[group: declutter]`
Removed two tools the user confirmed they don't use. This is the **follow-through on Priority 49's reasoning** — P49 retired Scrum from the sidebar but kept it parked "in case it's revisited"; one month of non-use (and the same logic now applied to War Room) converted "park it" into "delete it." The 🎯 "Today's Focus" picker — which only ever fed War Room — went with it.

**What was removed:**
- **War Room** (lived entirely in `index.html`): CSS (`#war-room` + all `.wr-*`, ~192 lines), the `⚔` session-bar button, the `W`/`Esc` keyboard handlers, the whole JS module (`toggleWarRoom`, `_buildWarRoom`, `_wr*` helpers, `_wrTodayWebGraph`, AI Smart Priorities briefing — ~414 lines), and the 6-panel HTML overlay (~49 lines). Plus the dependent **🎯 Today's Focus picker** in `project-hub.html` (button, `toggleWarRoomFocus`/`buildWarroomFocusSet`, `.warroom` CSS) and the "Today's Focus" section in `index.html`'s `buildTodayView()`.
- **Scrum Board**: deleted `scrum-hub.html`; removed the Frameworks tab/panel/lazy-load (`frameworks-hub.html`); the `add_backlog_item` AI action + system-prompt line + context digest (`index.html`, `hub-ai.js`); the graph node/color/label/resolver entries (`graph-hub.html`); the Cmd+K resolver + search entry (`hub-links.js`, `hub-search.js`); the starter seed (`hub-starter-data.js`); the tool card + workflow step + framework `tools:` references (`help-hub.html`); and doc rows (`README.md`).

**Key decisions:**
- **Decision:** Delete both tools outright rather than retire-into-Frameworks again. **Why:** P49 already proved "retire but keep" just produces dead weight nobody returns to; the user explicitly confirmed non-use of both. **Alternative rejected:** another sidebar-hide (P49's approach) — it leaves the maintenance + cognitive cost without the upside. **Confidence:** high.
- **Decision:** Do NOT purge `scrum-hub-v1` / `hub-warroom-v1` from localStorage; keep both in the Full Backup + MCP-sync key lists. **Why:** code deletion is reversible via git, but silently dropping a user's historical data from backups is not — preserving the keys keeps any existing data recoverable while the tools are gone. **Alternative rejected:** strip the keys everywhere for a "clean" removal — fails the safety principle of never destroying data the user didn't ask to delete. **Confidence:** high. **Revisit when:** the user explicitly asks to wipe the orphaned data.
- **Decision:** Keep the abstract Scrum / Kanban / MoSCoW / Agile-Retrospectives **framework reference entries** in `help-hub.html`, only repointing their `tools:` lists off the deleted Scrum Board. **Why:** they're methodology education, valid independent of whether a Scrum *tool* ships. **Alternative rejected:** delete the framework entries too — loses reference value for no benefit. **Confidence:** med.
- **Lesson for future tool-building:** both deleted tools were team/sprint-shaped (War Room "glanceable command center", Scrum sprints) in what is actually a **solo strategy/thinking app**. The recurring failure mode is building for an imagined team cadence rather than the single user's real workflow. Weight new-tool proposals against *"would the solo user open this weekly?"* before building. Focus Timer was kept precisely because it passes that test (it's load-bearing for Project Hub time badges, Weekly Review, and AI Energy Insights).

**Files:** `index.html`, `project-hub.html`, `frameworks-hub.html`, `graph-hub.html`, `help-hub.html`, `hub-ai.js`, `hub-links.js`, `hub-search.js`, `hub-starter-data.js`, `README.md`, `CLAUDE.md` · **Deleted:** `scrum-hub.html`

---

### ~~Priority 51 — Resurface loop + Decision calibration~~ ✓ Done `[group: decision-loop]`
Two paired features built together because they share the revisit-date plumbing. Origin: a vault-audit observation — **Thinking Hub is all *capture*, almost no *resurface*.** Every tool is a write surface; nothing brings the past back. The esen-vault roadmap independently flagged the same disease from the other side (decisions never calibrated, ~44/45 missing confidence, orphaned drafts, learnings logged but never revisited). The fix is the Readwise/Anki bet: capture is worthless until something resurfaces it at the right moment.

**Phase B — Decision Hub canonical-schema parity + calibration (`decision-hub.html`):**
- Decision object gained `alternative`, `revisitWhen` (condition text), `revisitDate` (optional date — drives resurfacing), `outcome` `{result, note, scoredAt}`, and `createdAt` (new decisions). All graceful for existing records.
- Log "More fields" collapse now has *Alternative considered*, a *Revisit when* row (condition + date), and an *Outcome* block (held / partly / didn't / too-early + note) that flags "↻ revisit due" when the date has passed. This completes the canonical **Decision / Why / Alternative / Revisit-when / Confidence** schema the vault uses.
- `⚖ Calibration` topbar button → modal: hit-rate per confidence band (held=1, partly=½, didn't=0), an overconfidence read ("high-confidence calls hold ~half the time → widen options"), and a count of decisions past their revisit date waiting to be scored. Makes the never-run monthly calibration ritual trivial.
- Sidebar nav-items show a `↻` when a decision's revisit date has passed and it's unscored.

**Phase A — Resurface widget (`index.html`):**
- New `↻ Resurface` card at the top of the **Today** dashboard (the default landing), pulling three high-signal sources via `buildResurfaceItems()`: (1) decisions due for revisit (`revisitDate ≤ today`, no outcome) — the keystone bridge to Phase B; (2) stale assumptions in "testing" untouched 14+ days; (3) on-this-day learning — a finished Learning item's `keyInsight`/first highlight from 30/90/180/365 days ago (±3d).
- Each row opens the item (`hub-highlight` via `_pendingHighlight` + `openApp`); a `✕` dismisses it for 30 days via new `hub-resurface-v1` store (`{ dismissed: { key: ISO } }`). Recording a decision's Outcome removes it from the queue → the loop closes.

**Key decisions:**
- **Decision:** Build #1 (resurface) + #2 (calibration) as one group. **Why:** both hinge on `revisitDate` — the resurface card's #1 source *is* the calibration trigger; splitting them would build the same date-plumbing twice and ship a resurface card with nothing to surface. **Alternative rejected:** ship calibration first, resurface later — leaves Phase B's revisit dates with no surfacing, so users would never notice a decision came due. **Confidence:** high.
- **Decision:** Put the Resurface card on the **Today** view, not the Overview status grid. **Why:** Today is the default landing and a daily ritual surface; resurfacing is a daily habit (Readwise's whole model). Overview is opt-in. **Alternative rejected:** the status-widget grid (original plan) — lower visibility, profile-filtered. **Confidence:** med. **Revisit when:** if Today gets too crowded, demote to a collapsible strip.
- **Decision:** `hub-resurface-v1` is ephemeral — excluded from Full Backup + MCP sync (like `tutorial-seen-v1`). **Why:** it's just dismiss-timing state that regenerates naturally; backing it up would resurrect stale dismissals on restore. **Confidence:** high.
- **Decision:** Calibration weights partly=½ and *excludes* "too-early" from the denominator. **Why:** a not-yet-resolved decision shouldn't count against (or for) calibration; only resolved outcomes measure whether confidence was right. **Confidence:** med.
- **Why this passes the solo test ([[build-for-solo-not-team]]):** resurfacing past insights and scoring your own past calls are pure solo-metacognition rituals — the opposite of the team-cadence tools deleted in P50. They make the *existing* write-only tools (Decision Hub, Learning Log, Assumptions) pay off instead of adding a new surface.

**Files:** `decision-hub.html`, `index.html`, `CLAUDE.md`

---

### ~~Priority 52 — New tool: Argument Hub (Pyramid Principle)~~ ✓ Done `[group: new-tools-solo]`
A structured-argument builder grounded in Barbara Minto's *The Pyramid Principle* — chosen by the user *while reading the book*, and justified by real recurring uses (the dormant Publishing pipeline of orphaned LinkedIn drafts, SBS management asks currently written as ad-hoc decks, and decision rationales). Fills a genuine gap: Thinking Hub had **no writing/structuring surface** at all.

**What it does (`argument-hub.html`, storage `argument-hub-v1`):**
- **SCQA introduction** — Situation / Complication / Question fields with inline guidance; the *Answer* is explicitly the governing thought (Minto's intro-as-story leading the reader to the question).
- **Governing thought** — the single apex assertion; everything below supports it.
- **Recursive supporting pyramid** — each grouping node carries a **logic type** (Grouping=inductive / Argument=deductive) and an **ordering principle** (time / structure / degree). Inline editing (text edits don't re-render → focus preserved; structural ops do).
- **Live structure checks** — only the Minto rules that are *truly* checkable: SCQA complete; governing thought stated; **no single-child groups** ("a point can't have one sub-point"); ordering set on each group; >5-per-group breadth nudge; plus a non-automatable "does each box *summarise* the ones below (insight, not topic)?" prompt.
- **Markdown export** in document order (intro → answer → points top-down) — copy or download `.md`, drops into a post/memo/decision.
- **"Load worked example"** (a complete Minto-style argument) so the method is obvious on first open.

**Wiring:** APPS entry (Strategy & Decisions group, icon `△`); `dx`/Strategy profile; backup + MCP-sync + EXPORT_KEY_LABELS + APP_FILE_STORAGE_KEYS; Cmd+K resolver (`hub-links.js`) + label + `hub-search.js` TOOLS; `hub-highlight` listener; help-hub tool card + three framework reference entries (Pyramid-Principle, SCQA, MECE under Knowledge & Learning).

**Key decisions:**
- **Decision:** Build a *new tool*, not a panel inside Decision Hub. **Why:** structuring a persuasive case is a distinct activity from logging a decision (Decision Hub records *what* you chose; Argument Hub structures *how you make the case*); they're complementary and would crowd each other. **Alternative rejected:** a "structure" tab in Decision Hub — overloads an already 4-tab tool. **Confidence:** med.
- **Decision:** Only automate checks that are genuinely verifiable (single-child groups, missing ordering, breadth), and make MECE/summary *prompts* rather than fake validations. **Why:** MECE ("no overlaps, no gaps") and "does this summarise?" are semantic judgments a heuristic can't honestly verify; a false ✓ would be worse than a prompt. **Confidence:** high.
- **Decision:** Model the governing thought as the tree *root node* (`root.text`), with `root.logic`/`root.order` describing the key line. **Why:** makes the pyramid uniformly recursive (apex and every sub-group share one node shape and one render fn) instead of special-casing the top level. **Confidence:** high.
- **Why this passes the solo test ([[build-for-solo-not-team]]):** drafting an argument is solo work, and it serves the user's own real outputs (posts, management asks, decision write-ups). Unlike the deleted War Room/Scrum, it isn't team-cadence-shaped — and the user pull-requested it themselves while reading the source book, the strongest possible "would the solo user open this weekly?" signal.

**Files:** `argument-hub.html` (new), `index.html`, `hub-links.js`, `hub-search.js`, `help-hub.html`, `CLAUDE.md`

---

### ~~Priority 53 — Rename "Profile" → "Mode", and a real Profile (identity) page~~ ✓ Done `[group: profile]`
Two-phase job triggered by a naming-correctness observation from the user: the app's "Profile" strip (Everything / Strategy / Project / Core) is **not** a profile — it's a tool-filter — and the conventional meaning of "Profile" (user identity) was the more correct claim. So we fixed the misnomer first, then built the real thing.

**Phase 0 — rename the tool-filter `Profile → Mode` (`index.html` only):**
- `PROFILES → MODES`, `_activeProfile → _activeMode`, `buildProfileStrip → buildModeStrip`, `.profile-chip/.profile-strip → .mode-chip/.mode-strip`, `selectWelcomeProfile → selectWelcomeMode`, `_welcomeProfile → _welcomeMode`, `data-profile → data-mode`, the welcome-modal "role cards" copy, and the onboarding string.
- **Backward-compatible storage migration:** the session field moved `profile → mode`, but `loadSession()` reads `mode ?? profile ?? 'everything'` and `saveSession` writes `mode`, so any existing user's saved selection survives untouched. Verified: a seeded legacy `{profile:'dx'}` resolved to Strategy mode; clicking a chip wrote the new `mode` field; filtering correct across all modes (Project=10, Everything=21, Core=8 tools).
- Done with **literal `.Replace()`** (never regex `-replace`, per the file-safety rule) for the unique identifiers, then hand-fixed the bare-`profile` stragglers (session field, two local vars, comments, onboarding copy).

**Phase 1 — Profile page, folded into Achievements (`achievements-hub.html`):**
- The Achievements hero already had an avatar + username + level (a GitHub-profile-shaped surface). Added an identity layer on top: **name, role, and "this is me"** (a dropdown of People Hub members), edited via an **"✎ Edit profile"** modal.
- Identity persists in **`hub-settings-v1.profile = { name, role, selfMemberId }`** (backed up + synced). The hero reads it with a fallback chain `profile.name → selfMember.name → sessionName → 'Thinking Hub'`; avatar tints to the linked member's color.
- **`selfMemberId` stays canonical in `hub-session-v1`** (where People Hub's "Me View" and the home "My Work" widget already read it) — the Profile page writes *both* session (for those readers) and `settings.profile.selfMemberId` (for backup). A `_healSelfMemberId()` on load restores session from settings if a backup-restore wiped the ephemeral session. Verified end-to-end incl. the restore case.

**Key decisions:**
- **Decision:** Rename the tool-filter to **Mode**, not Workspace/Layout/View. **Why:** "Mode" accurately names a *working state you switch into* (which is what filtering tools by context does); "Layout" implies spatial rearrangement that doesn't happen, "View" collides with the dashboard views, "Role" collides with People Hub member roles, "Workspace" was the user's second choice but they picked Mode. **Confidence:** high.
- **Decision:** Fix the misnomer *before* building Profile, rather than calling the new page "Me" to dodge the collision. **Why:** the user's point — incumbency isn't correctness; if the existing usage is wrong, free the right word for the right meaning. **Confidence:** high.
- **Decision:** Fold Profile into Achievements rather than a new tool or the ⚙️ modal. **Why:** the achievements heatmap already reads like a GitHub contribution graph, so identity-on-top is the natural GitHub-profile pattern; a new tool fails the solo "don't add surfaces" test ([[build-for-solo-not-team]]). **Alternative rejected:** moving *all* settings (backup, cloud, API keys) there too — that's utility plumbing, not identity; it would clutter a personal page. Those stay in the ⚙️ modal. **Confidence:** high.
- **Decision:** Keep `selfMemberId` canonical in `hub-session-v1` and dual-write to settings, rather than moving it wholesale. **Why:** avoids touching every existing reader (People Hub, My Work widget) while still surviving backup via the settings mirror + self-heal. **Confidence:** med.

**Phase 2 — relabel the tool `Achievements → Profile`** (user chose "Profile"): updated the sidebar label + icon (`🏅 → 👤`) and `desc` in `index.html` APPS, the `help-hub.html` tool card (label/icon/whenToUse/features) + the Systems-Thinking framework `tools:` list, the `<title>` in `achievements-hub.html`, the Project Hub detail-panel button title, and `README.md`. The id (`achievements-hub`), filename, and all internal code (`_allAchievements`, `hub-activity-v1`, etc.) stay unchanged for stability — only user-facing strings moved.

**Still open (minor):** People Hub also exposes a who-is-me setter (harmless — same canonical `selfMemberId` key, stays in sync); could later become a read-only link to Profile.

**Files:** `index.html`, `achievements-hub.html`, `help-hub.html`, `project-hub.html`, `README.md`, `CLAUDE.md`

---

### ~~Priority 54 — Profile/Achievements bug fixes + Link-modal scroll fix~~ ✓ Done `[group: bugfix]`
Two small bug-fix passes found via real use.

- **Sticky streak badges** (`achievements-hub.html`) — "Hub Fanatic" and "Week Warrior" (login-streak achievements) re-locked every time the streak broke, even after being earned once. `evaluate()` re-runs from live data on every load with no memory of past unlocks. Fix: on load, any achievement whose id is in `hub-activity-v1.seenAchievements` is forced to `unlocked: true` / `progress = total` regardless of what `evaluate()` returns — achievements are now permanent once earned.
- **Canvas Painter fix** (`achievements-hub.html`) — never unlocked because the evaluator read `canvas-v1.items`, but `canvas-hub.html` actually stores nodes under `canvas-v1.nodes`. Fixed the key.
- **Ink theme hero** (`achievements-hub.html`) — the hero/"Top badger" block had no `[data-theme="ink"]` overrides for its local `--_ach-*` vars, so it inherited the dark theme's near-black "night sky" palette on the paper-themed `ink` UI. Added an ink-appropriate palette (warm paper gradient, amber star tones, indigo heatmap tints) plus extended the existing light-theme `.ach-hero::before` / `.ach-edit-btn` overrides to also apply under `ink`.
- **Link-to-another-tool modal horizontal scroll** (`hub-links.js`) — the `.hl-tool-tabs` row (Schedule, Idea Swiper, ... Tool Portfolio) was technically `overflow-x: auto` but had no usable scroll affordance, so tabs past "Goal..." were unreachable. Added a visible custom scrollbar (themed via `rgba` overlay, not hardcoded against `theme.css` tokens since it's an overlay), a wheel→horizontal-scroll handler, and `scrollIntoView({inline:'nearest'})` when a tab is selected/activated.

**Files:** `achievements-hub.html`, `hub-links.js`, `CLAUDE.md`

---

### ~~Priority 55 — Project Hub: "Groupings" view (custom group ordering)~~ ✓ Done `[group: project-ux]`
Project cards can be tagged with a free-text `proj.group`, and the Overview groups cards under these labels — but group order was always alphabetical with no way to customize it. Added a dedicated **Groupings** view (Views sidebar, badge = number of named groups) showing one **compact row per group**: drag handle (`⠿`), color accent dot, group name, and a stats line (project count, open tasks, avg progress %, and avg goal % if any project in the group has goals). A trailing non-draggable "Ungrouped" row appears if any projects have no group. Dragging rows reorders `state.groupOrder` (persisted to `project-hub-v1`), and the Overview's group order now reads from the same `groupOrder` via a shared `getGroupOrder(names)` helper (known groups in saved order, any newly-discovered groups appended alphabetically — no migration needed). Empty state shown when no projects have a group set.

**Key decisions:**
- **Decision:** Compact one-row-per-group layout (not draggable Overview section headers). **Why:** the user pointed out that with 5+ projects per group, Overview group sections already fill the screen — dragging a header far enough to reorder against another group would require scrolling while dragging. A dedicated view where every group fits in a few lines keeps all drop targets visible at once. **Alternative rejected:** making Overview's existing group headers draggable in place — same ordering data, but unusable once groups have any real size. **Confidence:** high.
- **Decision:** Single shared `getGroupOrder(names)` helper feeding both the new Groupings view and Overview's group rendering, with graceful alphabetical fallback for groups not yet in `state.groupOrder`. **Why:** one ordering source avoids drift between the two views and needs no backfill/migration — any project's group that isn't yet in `groupOrder` just sorts to the end alphabetically until the user drags it. **Confidence:** high.
- **Decision:** "avg goal %" only shown when at least one project in the group has goals; "avg progress %" always shown (based on task completion). **Why:** most groups won't have OKR-style goals set, so an always-present "avg goal 0%" would be noise; task-based progress is universal. **Confidence:** med.

**Files:** `project-hub.html`, `CLAUDE.md`

---

## Decision Log Convention
<!-- decision-schema v1 · canonical: esen-vault/work/playbook/Decision Schema (Canonical).md -->
Formalizes the "Record decisions, not just outcomes" rule under Workflow Conventions
above into a shared schema used across all repos. When a non-obvious choice is made
(a tradeoff, "why this over that", a convention to follow or avoid), record it — as a
"Key decisions" bullet under the backlog entry / in the Decision Hub — using:
- **Decision:** what was chosen
- **Why:** the reasoning (the cause behind the effect)
- **Alternative:** what was rejected, and why
- **Revisit when:** the condition that would reopen this *(optional)*
- **Confidence:** low / med / high

Only for decisions that are hard to reverse or likely to recur. Skip mechanical changes.
