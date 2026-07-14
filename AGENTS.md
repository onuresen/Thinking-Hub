# Thinking Hub — Codex Context

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
| `hub-tags.js` | Centralized tag/topic registry: `HubTags.getRegistry/ensure/findCanonical/removeFromRegistry/scanUsage/rename/attachAutocomplete` — `scanUsage`/`rename` operate across all `TAG_SOURCES` (every tool with a `tags` field) |
| `hub-links.js` | Cross-tool linking via postMessage + UI (picker modal, badges) |
| `hub-search.js` | Global Cmd+K search, injected into index.html only |
| `hub-tutorial.js` | Onboarding tour, injected into index.html only |
| `hub-toast.js` | Toast notifications — tiny, self-contained |
| `hub-bootstrap.js` | Init coordinator (35 lines) — call last in each tool |
| `hub-ai.js` | AI Assistant module: `HubAI.capture/chat/testKey/getKey/saveKey/isConfigured` — calls Codex Haiku API. Self-contained (reads `hub-settings-v1` directly), so any tool can load it — currently `index.html` and `focus-hub.html` |
| `supabase-schema.sql` | Cloud DB schema |
| `project-hub.html` | Project + task tracking |
| `schedule.html` | Calendar / timeline |
| `idea-swiper.html` | Rapid idea triage (swipe) |
| `kmqt-board.html` | ⚠ Retired from sidebar — data can be imported into Reflection Board via "Import KMQT" button |
| `decision-hub.html` | Decision log + alignment matrix + **Assumptions tab** (reads `assumptions-hub-v1`). Canonical schema fields (alternative / revisit-when / revisit-date / outcome) + `⚖ Calibration` modal (P51) |
| `canvas-hub.html` | Infinite spatial canvas |
| `graph-hub.html` | Task dependency graph (vis-network) — Critical Path highlighting (P75); per-node Reasoning Path / Impact Analysis trace (P77) |
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
| `stakeholder-hub.html` | Stakeholder Map — Organizations roster (vendor/consultant/internal dept grouping, relationship health) as the default view, with the Power/Interest grid as a secondary tab |
| `risk-hub.html` | Risk register with heat-map |
| `achievements-hub.html` | Achievements & milestones tracker + **Profile** (identity header: name / role / who-is-me, edits `hub-settings-v1.profile`; P53) |
| `help-hub.html` | Help & Guide — tool directory, framework reference (37 frameworks), 4 suggested workflows |
| `frameworks-hub.html` | Frameworks — experiment sandbox; tabbed container for method tools: Blocked Depth (iceberg) and V-Model. (Scrum Board tab removed 2026-06-13, Priority 50.) |
| `blocked-depth.html` | Blocked Depth — iceberg cascade view (now surfaced as a tab inside `frameworks-hub.html`); shows every task, milestone, and person frozen downstream of a blocked task |
| `tags-hub.html` | Tags — central tag/topic registry; rename/merge duplicates and add topic-only tags, applies everywhere via `hub-tags.js` |

## Script load order (required)
`hub-storage.js` → `hub-utils.js` → `hub-starter-data.js` (index.html only) → `hub-obsidian.js` → `hub-tags.js` (tools with tag inputs + `tags-hub.html`) → `hub-links.js` → `hub-search.js` → `hub-toast.js` → `hub-bootstrap.js` → `hub-ai.js` (index.html + any tool with a manual AI feature, e.g. `focus-hub.html`)

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
`hub-session-v1`, `project-hub-v1`, `schedule-v1`, `decision-hub-v1`, `kmqt_current_v2`, `canvas-v1`, `hub-links-v1`, `ideaswipe_history_v6`, `hub-cloud-config-v1`, `th-theme`, `tutorial-seen-v1`, `quick-tour-seen-v1`, `focus-hub-v1`, `log-hub-v1`, `retro-hub-v1`, `assumptions-hub-v1`, `review-hub-v1`, `matrix-hub-v1`, `meetings-hub-v1`, `goals-hub-v1`, `learning-hub-v1`, `stakeholder-hub-v1`, `risk-hub-v1`, `argument-hub-v1`, `scrum-hub-v1` ⚠ orphaned (tool deleted P50, data retained), `hub-activity-v1`, `hub-settings-v1`, `tool-portfolio-v1`, `reflection-hub-v1`, `hub-warroom-v1` ⚠ orphaned (War Room deleted P50, data retained), `hub-resurface-v1` (ephemeral — Resurface dismiss-state, P51; excluded from backup/sync like other UI-state keys), `hub-tags-v1` (central tag/topic registry, P57), `machi-milestones-v1` (ephemeral Machi celebration dedupe; excluded from backup/sync)

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
- **Default workflow: rank → group → execute → update.** When given a backlog or feature list, always propose a ranked plan grouped into 2–4 efficient batches before touching any code. Wait for approval, then implement one group at a time. Update AGENTS.md at the end to mark items done and capture any new follow-up work.
- **Checkpoint after each group.** Before starting the next group, confirm the previous one is working. For pure HTML/JS this means a quick sanity check on logic and storage keys; for compiled projects it means a clean build.
- **Keep AGENTS.md in sync.** Mark backlog items ✓ Done as soon as they ship. Add new decisions, conventions, or file-map entries in the same session they're introduced — don't defer.
- **Record decisions, not just outcomes.** When a completed item involves a non-obvious choice (a tradeoff, a "why this approach over the alternative", a convention that future work should follow or avoid), add a **"Key decisions"** bullet list under that backlog entry — one line per decision, framed as *what was chosen* + *why* (not just what changed). Skip this for purely mechanical changes (typo fixes, simple wiring) where the "why" is self-evident. This is what lets future sessions reuse reasoning instead of re-litigating it.
- **Search for existing bindings before adding shortcuts.** Grep for the key combo across all HTML files to avoid collisions.
- **Always edit the main project files, never the worktree copies.** Worktrees live at `.Codex/worktrees/*/` — these are isolated git branches for sandboxed work and changes there do NOT affect the real app. Always confirm you are editing `C:\Users\onure\Documents\GitHub\Thinking-Hub\*.html` (or equivalent), not a path containing `.Codex/worktrees/`.

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

**Excluded from all exports:** `hub-cloud-config-v1` (Supabase credentials), `hub-session-v1`, `th-theme`, `tutorial-seen-v1`, `quick-tour-seen-v1` (ephemeral UI state), `hub-settings-v1.anthropicKey` (live API key — stripped from the settings block specifically, rest of `hub-settings-v1` still exports; see Priority 66).

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
**Files:** `scrum-hub.html` (new), `index.html`, `AGENTS.md`

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
**Files:** `decision-hub.html`, `project-hub.html`, `index.html`, `AGENTS.md`

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
**Files:** `hub-utils.js` (new), `hub-links.js`, `hub-search.js`, all HTML files, `AGENTS.md`

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

**Files:** `help-hub.html` (new), `index.html` (APPS array), `AGENTS.md` (file map)

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

**Files:** `blocked-depth.html` (new), `index.html` (APPS + PROFILES), `AGENTS.md` (file map)

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

**Files:** `index.html`, `project-hub.html`, `AGENTS.md`

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

**Files:** `meetings-hub.html`, `AGENTS.md`

---

### ~~Priority 44 — Meeting Hub: attendee management + repeat~~ ✓ Done `[group: meetings-import]`
Follow-up to ICS import — large imported attendee lists were unwieldy, attendee names had no link to registered members, and recurring meeting types were tags only with no way to create the next occurrence.

**Implementation (`meetings-hub.html`):**
- **Attendee pill collapse** — `ATTENDEE_COLLAPSE_THRESHOLD = 15`; lists longer than that show the first 15 + a "+N more" toggle (`toggleAttendeesExpanded()`, module-level `attendeesExpanded` flag).
- **Bulk attendee edit** — "✎ Edit list" button opens a modal (`#attendees-modal-overlay`) with a one-name-per-line textarea; `saveAttendeesBulk()` re-diffs against the existing list (preserving roles for names that still match) and `clearAllAttendees()` wipes the list with a confirm.
- **Member-aware autocomplete** — `getHubMembers()` reads `HubData.getMembers()`; the "+ Add" name input gets a `<datalist id="att-member-suggestions">` of registered member names (free text still allowed). Attendees whose name matches a registered member show a small colored `.att-member-dot` (member's saved color) in their pill.
- **Repeat / duplicate meeting** — "🔁 Repeat" button opens `#repeat-modal-overlay` with quick-pick chips (+1 day / +1 week / +2 weeks / +1 month, default based on meeting type) and a date input. `confirmRepeatMeeting()` creates a new meeting copying title/type/attendees/agenda/project, with notes/action items/decisions/schedule sync reset to fresh. `addDaysToDate`/`addMonthToDate` reuse the `dateFromYMD`/`ymdFromDate` helpers from ICS import.

**Files:** `meetings-hub.html`, `AGENTS.md`

---

### ~~Priority 45 — War Room polish + AI Smart Priorities + home page integration~~ ✓ Done `[group: war-room-polish]`
Follow-up to Priority 42 (War Room Mode) — readability, calendar, animation, AI, and discoverability improvements.

- **Readability colors** — `.wr-clock`, `.wr-date`, `.wr-exit-hint` (+ `kbd`), and `.wr-footer` brightened from near-invisible dark blues (`#1e3050`/`#2a3a50`/`#3a5a78`) to the existing readable palette (`#b8d0e8`/`#7a98b8`/`#5a7a98`).
- **Weekend calendar styling** — "This Month" panel: Sat/Sun `.wr-cal-dow` headers and `.wr-cal-day` cells get `.is-weekend` (warm terracotta tint `#d97757`/`#d99a85`), placed before `.is-today` in source order so today's styling still wins when both apply.
- **Panel entrance + refresh animation** — `.wr-panel` plays a staggered `wr-panel-enter` (translateY+scale fade-in, `nth-child` delays) each time War Room opens; `.wr-panel-list` gets a `wr-refreshing` flash class re-triggered via reflow on every 60s `_buildWarRoom()` cycle.
- **AI Smart Priorities panel** — replaces "Needs Attention". New `✦ Smart Priorities` panel (purple `--_wra:#a78bfa`) with a `↻` refresh button (`#wr-briefing-refresh`, spins while loading). Manual-trigger only (no auto token spend). `_wrGenerateBriefing()` sends today's blocked/overdue/due-today tasks + open risks to `HubAI.chat()` with a system prompt asking for the top 3-5 items to tackle first, each as one short "<item> — <reason>" line. Result cached in `hub-warroom-v1.aiBriefing {text, generatedAt}`, reset daily alongside `focusIds` via new `_wrLoadState()`. Shows a "Settings → Integrations" hint link if `HubAI.isConfigured()` is false.
- **Home page War Room button** — `⚔` icon button in the session bar (next to the tour `?` button) calls `toggleWarRoom()`, for users who don't know the `W` shortcut.
- **Today tab "Today's Focus" card** — `buildTodayView()` now reads pinned tasks from `hub-warroom-v1` (today's `focusIds`) and renders them first in the Today grid, each with a `.today-focus-check` ○ button calling `_wrToggleDone()`. `_wrToggleDone`/`_wrRemoveFocus` now also call `buildTodayView()` so the card updates live.

**Files:** `index.html`, `AGENTS.md`

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

**Files:** `schedule.html`, `AGENTS.md`

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

**Files:** `schedule.html`, `meetings-hub.html`, `focus-hub.html`, `AGENTS.md`

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

**Files:** `meetings-hub.html`, `schedule.html`, `AGENTS.md`

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

**Files:** `project-hub.html`, `AGENTS.md`
### ~~Priority 49 — Declutter: retire Scrum Board into Frameworks~~ ✓ Done `[group: tool-consolidation]`
Scrum Board removed from the sidebar (solo/strategy work doesn't run sprints — it was unused) and moved into `frameworks-hub.html` as a third tab alongside Blocked Depth and V-Model. Frameworks is now the explicit home for parked/experimental method tools.

**Key decisions:**
- **Move into Frameworks, don't delete** — keeps `scrum-hub.html` + `scrum-hub-v1` data intact and the tool reachable, just out of the main nav. *Why:* may be revisited; deletion is irreversible and the file is cheap to keep. *Alternative rejected:* delete the file (loses data and the option to return). *Confidence:* high.
- **Nested iframe, lazy-loaded on first tab open** — *Why:* Scrum is a full tool, not an inline panel like Blocked Depth/V-Model; an iframe avoids re-implementing it, and lazy-load avoids loading Scrum every time Frameworks opens. *Tradeoff:* cross-tool links from inside the nested Scrum won't reach the shell (2-level nesting) — acceptable for a parked experiment.

**Files:** `index.html` (removed APPS entry), `frameworks-hub.html` (Scrum tab + panel + lazy-load), `AGENTS.md`

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

**Files:** `index.html`, `project-hub.html`, `frameworks-hub.html`, `graph-hub.html`, `help-hub.html`, `hub-ai.js`, `hub-links.js`, `hub-search.js`, `hub-starter-data.js`, `README.md`, `AGENTS.md` · **Deleted:** `scrum-hub.html`

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

**Files:** `decision-hub.html`, `index.html`, `AGENTS.md`

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

**Files:** `argument-hub.html` (new), `index.html`, `hub-links.js`, `hub-search.js`, `help-hub.html`, `AGENTS.md`

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

**Files:** `index.html`, `achievements-hub.html`, `help-hub.html`, `project-hub.html`, `README.md`, `AGENTS.md`

---

### ~~Priority 54 — Profile/Achievements bug fixes + Link-modal scroll fix~~ ✓ Done `[group: bugfix]`
Two small bug-fix passes found via real use.

- **Sticky streak badges** (`achievements-hub.html`) — "Hub Fanatic" and "Week Warrior" (login-streak achievements) re-locked every time the streak broke, even after being earned once. `evaluate()` re-runs from live data on every load with no memory of past unlocks. Fix: on load, any achievement whose id is in `hub-activity-v1.seenAchievements` is forced to `unlocked: true` / `progress = total` regardless of what `evaluate()` returns — achievements are now permanent once earned.
- **Canvas Painter fix** (`achievements-hub.html`) — never unlocked because the evaluator read `canvas-v1.items`, but `canvas-hub.html` actually stores nodes under `canvas-v1.nodes`. Fixed the key.
- **Ink theme hero** (`achievements-hub.html`) — the hero/"Top badger" block had no `[data-theme="ink"]` overrides for its local `--_ach-*` vars, so it inherited the dark theme's near-black "night sky" palette on the paper-themed `ink` UI. Added an ink-appropriate palette (warm paper gradient, amber star tones, indigo heatmap tints) plus extended the existing light-theme `.ach-hero::before` / `.ach-edit-btn` overrides to also apply under `ink`.
- **Link-to-another-tool modal horizontal scroll** (`hub-links.js`) — the `.hl-tool-tabs` row (Schedule, Idea Swiper, ... Tool Portfolio) was technically `overflow-x: auto` but had no usable scroll affordance, so tabs past "Goal..." were unreachable. Added a visible custom scrollbar (themed via `rgba` overlay, not hardcoded against `theme.css` tokens since it's an overlay), a wheel→horizontal-scroll handler, and `scrollIntoView({inline:'nearest'})` when a tab is selected/activated.

**Files:** `achievements-hub.html`, `hub-links.js`, `AGENTS.md`

---

### ~~Priority 55 — Project Hub: "Groupings" view (custom group ordering)~~ ✓ Done `[group: project-ux]`
Project cards can be tagged with a free-text `proj.group`, and the Overview groups cards under these labels — but group order was always alphabetical with no way to customize it. Added a dedicated **Groupings** view (Views sidebar, badge = number of named groups) showing one **compact row per group**: drag handle (`⠿`), color accent dot, group name, and a stats line (project count, open tasks, avg progress %, and avg goal % if any project in the group has goals). A trailing non-draggable "Ungrouped" row appears if any projects have no group. Dragging rows reorders `state.groupOrder` (persisted to `project-hub-v1`), and the Overview's group order now reads from the same `groupOrder` via a shared `getGroupOrder(names)` helper (known groups in saved order, any newly-discovered groups appended alphabetically — no migration needed). Empty state shown when no projects have a group set.

**Key decisions:**
- **Decision:** Compact one-row-per-group layout (not draggable Overview section headers). **Why:** the user pointed out that with 5+ projects per group, Overview group sections already fill the screen — dragging a header far enough to reorder against another group would require scrolling while dragging. A dedicated view where every group fits in a few lines keeps all drop targets visible at once. **Alternative rejected:** making Overview's existing group headers draggable in place — same ordering data, but unusable once groups have any real size. **Confidence:** high.
- **Decision:** Single shared `getGroupOrder(names)` helper feeding both the new Groupings view and Overview's group rendering, with graceful alphabetical fallback for groups not yet in `state.groupOrder`. **Why:** one ordering source avoids drift between the two views and needs no backfill/migration — any project's group that isn't yet in `groupOrder` just sorts to the end alphabetically until the user drags it. **Confidence:** high.
- **Decision:** "avg goal %" only shown when at least one project in the group has goals; "avg progress %" always shown (based on task completion). **Why:** most groups won't have OKR-style goals set, so an always-present "avg goal 0%" would be noise; task-based progress is universal. **Confidence:** med.

**Files:** `project-hub.html`, `AGENTS.md`

---

### ~~Priority 56 — Dependency Graph: make Projects linkable, not just Tasks~~ ✓ Done `[group: graph-links]`
Cross-tool links to Project Hub previously only resolved to individual **tasks**, but some dependencies genuinely belong at the project level (a whole project blocks/relates to a decision, risk, etc.) or relate to multiple tasks at once. Rather than replacing task-linking, projects are now a parallel linkable item type — both remain available.

- **`hub-links.js`** — `resolveItems('project-hub')` now also returns one entry per project (`{id: p.id, label: p.name, subtitle: 'Project'}`) ahead of that project's tasks, so any tool's "Link to another tool" picker can target a project itself, distinguished from tasks by the "Project" subtitle.
- **`graph-hub.html`** — `fetchNodeMeta('project-hub', itemId)` now falls back to a project lookup (`Type: Project`, `Status`, `Open tasks`) when `itemId` doesn't match any task. The "+ New Link" modal's existing Projects/Tasks toggle already produced project-id links pointing at the project's auto-loaded parent node — only the node-panel metadata was missing.
- **`project-hub.html`** — the project detail panel header gained a `🔗` link button (`HubLinks.openModal('project-hub', proj.id, proj.name)`) and a link-count badge below the title (`HubLinks.showLinksPopover(...)`), mirroring the existing per-task link button/badge. Also added a `window.__hl_onLinkChange` hook (chained, like `canvas-hub.html`'s) so both the new project badge and the existing task badges refresh immediately after creating a link, instead of waiting for the next unrelated re-render.

**Key decisions:**
- **Decision:** Add projects as an additional linkable type, don't replace task-linking. **Why:** task-level links still carry precise "this specific task is blocked by X" info (feeds Blocked Depth's cascade view); project-level links cover the cases where the dependency isn't about one task. Users pick the right altitude per link. **Confidence:** high.
- **Decision:** No ID prefixing (e.g. `proj:<id>`) to disambiguate project vs. task link endpoints — project and task ids share the same `itemId` namespace. **Why:** `graph-hub.html`'s existing "+ New Link" Projects/Tasks toggle already created project-id links this way (itemId = raw project id, same format as `uid()` task ids), and `project-hub.html`'s `hub-highlight` listener already tries task-id-then-project-id. Introducing a prefix now would create two incompatible link formats for the same tool. Collision risk between a 7-char base36 task id and project id is negligible for a personal app. **Confidence:** high.

**Follow-up — linked tasks auto-host to their project ✓ Done:** with both tasks and projects now appearing as graph nodes, a linked task floated with no visual tie to its project — unlike decisions/risks/goals/meetings/stakeholders, which all get an auto dashed edge to their project via `projectId`. `buildGraph()`'s manual-link overlay now builds a `taskProjectMap` (task id → parent project id) from `project-hub-v1`, and for any linked task adds the same dashed "hosted by" auto-edge to its parent project node (deduped via `taskHostEdgeAdded`, only when the project node already exists — i.e. Auto Links is on). No new nodes — just one edge per linked task, keeping the project hierarchy visible without crowding.

**Files:** `hub-links.js`, `graph-hub.html`, `project-hub.html`, `AGENTS.md`

---

### Priority 57 — Tags Hub: centralized tag/topic registry (Group 1 of 3) `[group: tags-hub]`
Tags exist scattered across ~5 tools (Learning Log, Reflection Board, KMQT Board, Meeting Hub, Decision Hub) with no shared registry — duplicates like "BIM" / "bim" / "Bim" accumulate and nothing lets a tag stand alone as a "topic" (e.g. for future Dependency Graph topic nodes). Group 1 builds the foundation: a shared registry module + management UI.

- **`hub-tags.js`** (new) — `HubTags` singleton, storage `hub-tags-v1` (`{tags:[{name, createdAt}]}`). `TAG_SOURCES` is a uniform `{id, label, storageKey, collect(data) → [{get(), set(arr)}]}` list covering all 5 tag locations — including `decision-hub-v1`'s comma-separated-string tags via a `get`/`set` adapter that splits/joins, so `scanUsage()` and `rename()` treat array-tags and CSV-tags identically. `scanUsage()` returns per-tag usage counts + per-source breakdown (case-insensitive grouping); `rename(old, new)` rewrites every matching tag across all sources (deduping on merge) and updates the registry; `ensure()`/`findCanonical()`/`removeFromRegistry()` manage standalone "topic" entries; `attachAutocomplete()` wires a `<datalist>` from registry + live usage.
- **`tags-hub.html`** (new) — lists every tag (registry + in-use, including zero-use "topics") with usage counts and per-tool source chips; inline rename-with-merge (✎), delete-from-registry (✕), add new topic-only tags, search filter. `hub-highlight` listener flashes the matching row.
- **Wiring** — APPS entry (Tools & Focus group, 🏷, `dx`/Strategy mode), `hub-links.js` `TOOL_NAMES` + `resolveItems('tags-hub')` (reads `hub-tags-v1` directly via `HubStorage`, no `hub-tags.js` dependency needed in other tools), `hub-search.js` `TOOLS` array (Cmd+K), `EXPORT_KEY_LABELS`/`APP_FILE_STORAGE_KEYS`/`SCOPE_KEYS.full`/`MCP_SYNC_KEYS` in `index.html`.

**Bug found + fixed while verifying Cmd+K:** `hub-search.js` declared `const HubSearch = (() => {...})()` instead of `window.HubSearch = ...`. Top-level `const`/`let` in a non-module `<script>` does NOT become a `window` property, so `hub-bootstrap.js`'s `if (window.HubSearch) HubSearch.init()` was always false — **the Cmd+K overlay was never injected and the shortcut never worked, for any tool, since Priority 16/37**. One-line fix (`window.HubSearch = ...`); verified end-to-end with Playwright (overlay opens, "BIM" tag found under "🏷 Tags" group, click navigates to Tags Hub and flashes the row).

**Key decisions:**
- **Decision:** Unify array-tags (most tools) and CSV-string-tags (`decision-hub-v1`) behind a `{get(), set(arr)}` accessor per `TAG_SOURCES` entry. **Why:** lets `scanUsage`/`rename` be written once with no per-source special-casing. **Confidence:** high.
- **Decision:** `resolveItems('tags-hub')` reads `hub-tags-v1` directly via `HubStorage`, not through `HubTags`. **Why:** keeps the cross-tool link/search picker working in any tool without forcing `hub-tags.js` as a new dependency everywhere — same pattern `hub-links.js` already uses for every other tool's storage key. **Confidence:** high.
- **Decision:** `rename()` handles both pure renames and merges in one function (dedupes if the target name already exists on an item). **Why:** from the UI these are the same user action ("change this tag's name to X") — splitting them would need the UI to predict which case applies. **Confidence:** high.

**Files:** `hub-tags.js` (new), `tags-hub.html` (new), `hub-links.js`, `hub-search.js`, `index.html`, `AGENTS.md`

---

### ~~Priority 57 follow-up — Group 2: retrofit existing tag inputs~~ ✓ Done `[group: tags-hub]`
Group 1 built the registry; Group 2 wires it into the tag-entry UIs that already existed so new tags get canonical casing + autocomplete suggestions automatically.

- **`learning-hub.html`** — loads `hub-tags.js`; `renderDetail()` calls `HubTags.attachAutocomplete(#tag-input)`; `handleTagKey()` runs the typed tag through `HubTags.ensure()` before adding it to `item.tags`.
- **`decision-hub.html`** — loads `hub-tags.js`; new `normalizeTags(raw)` helper splits the CSV `#i-tags` value, runs each part through `HubTags.ensure()`, dedupes case-insensitively, and rejoins — called from `saveCurrent()`. `renderContent()`'s Log tab attaches `HubTags.attachAutocomplete(#i-tags)`.
- **`kmqt-board.html`** — loads `hub-tags.js`; `openEdit()` attaches autocomplete to `#edit-tags`; `saveEdit()` runs each parsed tag through `HubTags.ensure()` with the same dedup pattern before assigning `item.tags`.
- **`hub-tags.js` — `findCanonical()` enhanced**: previously only matched against registry entries; now also falls back to any tag already in use (`scanUsage()`) with a matching lowercase name. Fixes a duplicate-casing bug where typing `"bim"` when `"BIM"` was already used somewhere (but not yet in the registry) would register `"bim"` as a second, separate tag instead of normalizing to the existing `"BIM"`.

**Verified** (Playwright, local static server): all three tools — typing a lowercase/duplicate variant of an existing tag normalizes to the canonical casing, dedupes, registers in `hub-tags-v1`, and the input gets a working `<datalist>` (`list="..."` attribute populated with registry + in-use tag names). No console errors in any of the three tools.

**Key decisions:**
- **Decision:** Skip `reflection-hub.html` and `meetings-hub.html` — no retrofit. **Why:** neither tool has an actual tag-*input* UI to retrofit; reflection-hub's tags are display/copy-only and meetings-hub never sets a `tags` field anywhere in its UI. Adding new tag-entry UI to either tool would be a feature addition beyond Group 2's retrofit scope. **Alternative rejected:** build new tag-input UI for both — out of scope, not requested, and not addressing an existing pain point. **Confidence:** high. **Revisit when:** either tool gains a tag-entry field for other reasons — retrofit it then.
- **Decision:** `findCanonical()` now checks live usage (`scanUsage()`) in addition to the registry. **Why:** the registry only contains tags explicitly `ensure()`'d or added as topics; many tags already exist on items from before Tags Hub existed and were never registered. Without this fallback, `ensure("bim")` when `"BIM"` is already used (but unregistered) would create a second `"bim"` registry entry instead of normalizing to the existing casing. **Confidence:** high.

**Files:** `hub-tags.js`, `learning-hub.html`, `decision-hub.html`, `kmqt-board.html`, `AGENTS.md`

---

### ~~Priority 57 follow-up — Group 3: Dependency Graph Tag nodes~~ ✓ Done `[group: tags-hub]`
Final Tags Hub group — every tag from the central registry now appears as a node in `graph-hub.html`, linkable like any other tool via the existing "+ New Link" modal.

- **`graph-hub.html`** loads `hub-tags.js`. `loadAutoNodes()` now creates one `tags-hub::<name>` node per `HubTags.scanUsage()` entry (registry tags including zero-use "topics", plus any tag already in use anywhere but not yet registered) — built *before* the per-tool sections so item nodes can reference them. New `addTagEdges(itemId, tags)` adds a dotted (`[2,3]`) auto-edge from a node to each of its tag nodes, titled `tagged: <name>`; wired into the three auto-node sections whose source tools are also `TAG_SOURCES` and already have graph nodes — decisions (`d.tags` CSV split), meetings (`m.tags` array), learning items (`item.tags` array). `addAutoEdge()` gained an optional 4th `dashStyle` param (defaults to the existing `[5,5]` "hosted by"/"belongs to" dash) so tag edges get a visually distinct dotted style.
- **`TOOL_LABELS`/`TOOL_COLORS_DARK`/`TOOL_COLORS_LIGHT`** gained a `tags-hub` entry — label "Tags", colors reuse the existing `--node-gray`/`--border-gray` token hex values (`#2a2a30`/`#444` dark, `#e4e4ea`/`#8888a0` light) since gray was the only one of the 6 node-color tokens not yet claimed by another tool, and it suits tags' role as neutral cross-cutting connectors.
- **`fetchNodeMeta()`** gained a `tags-hub` case showing "Used in: N item(s)" + "Sources: ..." (or "— not yet used —" for zero-use topics) via `HubTags.scanUsage()`.
- Subscribed to `hub-tags-v1` so the graph rebuilds live when tags are renamed/added/removed via Tags Hub.
- **`hub-links.js`** `resolveItems('tags-hub')` subtitle changed `'Topic'` → `'Tag'` (the user flagged that introducing "Topic"/"Theme" terminology in the graph would drift from the "Tags" name used everywhere else — Tags Hub, sidebar, Cmd+K). Also enhanced: when `HubTags` is loaded (now true in `graph-hub.html`), `resolveItems('tags-hub')` returns `HubTags.scanUsage()` results (registry + any in-use-but-unregistered tags) instead of registry-only — otherwise an in-use tag like "Shop drawing" would render as a graph node (via `scanUsage()`) but be unselectable in the "+ New Link" picker and fail to preselect via right-click "Add link from here". Tools without `hub-tags.js` loaded keep the old registry-only fallback.

**Verified** (Playwright): seeded `hub-tags-v1` (BIM + zero-use "unused-topic"), a decision with CSV tags "BIM, Shop drawing", a meeting tagged "Shop drawing", a learning item tagged "BIM". After load, `nodesMap` contained `tags-hub::BIM`, `tags-hub::Shop drawing` (in-use but unregistered), and `tags-hub::unused-topic`, plus the three item nodes. `fetchNodeMeta('tags-hub','BIM')` → "Used in: 2 item(s)" / "Sources: Learning Log, Decision Hub"; `fetchNodeMeta('tags-hub','unused-topic')` → "— not yet used —". "+ New Link" modal lists "Tags" as a tool with all three tags selectable; right-click-style preselect of the unregistered "Shop drawing" tag correctly populates the picker. (vis-network itself couldn't render in the sandbox — CDN blocked — but all graph-data-layer logic, which is independent of vis, was verified directly.)

**Key decisions:**
- **Decision:** Only wire `addTagEdges` for decision-hub, meetings-hub, and learning-hub items. **Why:** these are the only `TAG_SOURCES` whose items already have auto-generated nodes in `loadAutoNodes()`; kmqt-board and reflection-hub items have no graph nodes at all (out of scope — would be a much larger addition of new node types). Tag *nodes* themselves still appear for every tag regardless of source, so kmqt/reflection tags are visible as standalone nodes, just without an edge back to their (non-existent) item node. **Alternative rejected:** add new auto-node types for kmqt/reflection items — substantial scope creep beyond "tags as graph nodes". **Confidence:** high. **Revisit when:** kmqt-board/reflection-hub items get auto-nodes in the graph for other reasons.
- **Decision:** Dotted (`[2,3]`) dash style for tag edges vs. the existing `[5,5]` dash for "belongs to project" edges. **Why:** both are auto-generated dashed edges but represent different relationships (hierarchy vs. categorization); a finer dot distinguishes them on hover/zoom without adding a legend entry or new color. **Confidence:** med.
- **Decision:** `resolveItems('tags-hub')` conditionally uses `HubTags.scanUsage()` when available, falling back to registry-only `hub-tags-v1.tags` otherwise — rather than always requiring `hub-tags.js`. **Why:** preserves Group 1's "no new dependency for every tool" decision for tools that don't need the richer view, while fixing the graph's specific need (in-use-but-unregistered tags must be link-targetable since they're already visible as nodes). **Confidence:** high.

**Files:** `graph-hub.html`, `hub-links.js`, `AGENTS.md`

---

### ~~Priority 57 follow-up — Bugfix: Tags Hub "+ Add" did nothing~~ ✓ Done `[group: tags-hub]`
User report: "when I add a tag in Tags Hub, nothing happens. no list of tags or new tag etc." Root cause: `hub-tags.js`'s `decision-hub` `TAG_SOURCES` accessor assumed `d.tags` is always a CSV string (`(d.tags || '').split(',')`), but **six other tools push new `decision-hub-v1` entries with `tags: []` (an array literal)** — `capture-hub.html`, `journal-hub.html` (×2), `review-hub.html`, `meetings-hub.html` (×2), `log-hub.html`. The instant any such decision exists, `[].split` throws `TypeError` **uncaught** inside `scanUsage()`, which both `renderList()` and `addTopic()` (via `findCanonical`→`ensure`) call directly with no try/catch around `entry.get()` — so the whole script dies before `tag-list-wrap.innerHTML` is ever set (empty list) and before `addTopic()` reaches `renderList()`/`input.value = ''` (the "+ Add" click visibly does nothing).

**Fix:** `hub-tags.js`'s `decision-hub` accessor now normalizes on read — `Array.isArray(d.tags) ? d.tags.filter(Boolean) : (d.tags || '').split(',')...` — so both the legacy/buggy array shape and the canonical CSV-string shape work. `set()` is unchanged (`arr.join(', ')`), so any decision touched by `rename()`/`ensure()` self-heals to the canonical CSV string on its next mutation.

**Key decisions:**
- **Decision:** Fix in `hub-tags.js`'s accessor (normalize on read), not in the 6 call sites that push `tags: []`. **Why:** one defensive read-side fix covers all current and future callers that get this wrong, is forward-compatible, and self-heals affected decisions to CSV the next time `rename()`/`ensure()` touches them — touching 6 files for the same one-line change is more risk for no extra benefit. **Alternative rejected:** fix all 6 push-sites to use `tags: ''` — correct in principle but doesn't fix *existing* user data already saved with `tags: []`, which is the actual failure the user hit. **Confidence:** high.
- **Decision:** Did not add blanket try/catch around every `entry.get()` in `scanUsage()`/`rename()`. **Why:** the discovered bug is a specific, real, reproducible type mismatch with a precise fix; a blanket catch would silently swallow *other* future bugs in tag scanning with no signal. **Confidence:** med. **Revisit when:** another tag-source type-mismatch bug surfaces — consider a shared "always return an array" normalization helper at that point.

**Files:** `hub-tags.js`, `AGENTS.md`

---

### ~~Priority 58 — Tool Portfolio: "Enabled Projects" list ordering~~ ✓ Done `[group: solo-quick]`
The "Enabled Projects" checklist in a tool's detail panel was listed in raw `project-hub-v1` storage order (effectively creation order). `_renderProjectLinksHTML()` now groups projects by `proj.group`, ordered per Project Hub's saved `groupOrder` (same order as its Groupings view, unseen groups appended alphabetically), with ungrouped projects last; projects are sorted alphabetically within each group. A small uppercase group-name heading is shown above each group's rows — only when more than one group exists (a single implicit "no groups" bucket renders as a flat alphabetical list, unchanged from before except for the new alphabetical sort).

**Files:** `tool-portfolio.html`, `AGENTS.md`

---

### ~~Priority 59 — Tags Hub: alphabetical sort + filters~~ ✓ Done `[group: tags-hub]`
Tags Hub's list previously inherited `HubTags.scanUsage()`'s default order (usage count desc). Added a **Sort** chip group (A–Z / Most used, default A–Z) and a **Used in** chip group (All / one chip per `TAG_SOURCES` tool / Unused) above the tag list. Filtering and sorting are applied client-side over `scanUsage()`'s result in `load()`; the search box still narrows further within the active filter. The true "no tags exist anywhere" empty state is now checked against the *unfiltered* `scanUsage()` so an active filter with zero matches shows "No tags match this filter" instead of the onboarding empty-state.

**Key decisions:**
- **Decision:** Default sort changed to alphabetical (A–Z), not usage. **Why:** that was the explicit ask — usage-desc made the list reorder as counts changed, which is harder to scan when looking for a specific tag to rename/manage. **Confidence:** high.
- **Decision:** Filter/sort state is session-only (module-level vars, not persisted). **Why:** Tags Hub is a quick management screen, not a place users return to mid-task; persisting would add a new `localStorage` write path for a low-value convenience. **Confidence:** med.

**Files:** `tags-hub.html`, `AGENTS.md`

---

### ~~Priority 60 — Tags Hub: layout space-efficiency pass~~ ✓ Done `[group: tags-hub]`
User-reported screenshot showed large empty left/right margins (`.content { max-width: 760px }`, centered) on the Tags Hub list, which doesn't need a narrow reading column. Widened `.content` to `max-width: 1100px` (full-width within that bound), kept `.intro` paragraph at `max-width: 760px` so the prose stays readable. Converted `.tag-list-head`/`.tag-row` from flex to a shared CSS grid (`grid-template-columns: 220px 90px 1fr auto`) so the name/count/source-chip/action columns align cleanly across rows at the wider width; `.tag-name-input` (rename mode) switched from `min-width: 140px` to `width: 100%` to fill its grid cell.

**Key decisions:**
- **Decision:** Split max-widths — `.content` at 1100px, `.intro` paragraph at 760px. **Why:** the tag list benefits from the extra horizontal room (more space for source chips before wrapping), but a 1100px-wide paragraph of body text would hurt readability. **Confidence:** high.

---

### ~~Priority 61 — Tags Hub: drop retired KMQT Board source + cascading tag delete~~ ✓ Done `[group: tags-hub]`
Two bug fixes from real use.

- **Stale "KMQT Board" source** — `hub-tags.js`'s `TAG_SOURCES` had a `kmqt-board` entry reading `kmqt_current_v2`, the pre-Reflection-Board tool's leftover localStorage. KMQT Board was retired long ago (its data is now only a one-time "Import KMQT" source inside Reflection Board, read directly via `HubStorage` — not through `HubTags`), but Tags Hub kept surfacing its old tags as a live "KMQT Board" source/filter chip even though Reflection Board itself was empty. Removed the `kmqt-board` entry entirely — its tags no longer appear in `scanUsage()`, the "Used in" filter, or the Dependency Graph's tag nodes. `kmqt_current_v2` itself is untouched, so "Import KMQT" in Reflection Board still works.
- **"Delete" did nothing for in-use tags** — `deleteTopic()` only ever called `HubTags.removeFromRegistry()`, which deletes the registry entry but leaves the tag on every item that has it. For a tag still in use, `scanUsage()` (which also includes any tag still attached to an item, registered or not) would still return it on the next render, so the row reappeared unchanged — looking like the click did nothing. New `HubTags.removeTag(name)` strips the tag (case-insensitive) from every item across all `TAG_SOURCES` *and* the registry, returning the affected-item count; `deleteTopic()` now calls this, with a confirm dialog and toast reflecting the cascading delete ("used on N items — delete it everywhere?").

**Key decisions:**
- **Decision:** Remove the `kmqt-board` `TAG_SOURCES` entry outright rather than special-casing it (e.g. hiding it only when Reflection Board is empty). **Why:** the tool is permanently retired and its data is a one-shot import source, not a live tag surface — there's no future state where treating `kmqt_current_v2` as an active `TAG_SOURCES` entry would be correct again. **Alternative rejected:** conditionally hide based on Reflection Board's contents — adds runtime branching for a source that should never have stayed registered post-retirement. **Confidence:** high.
- **Decision:** `removeTag()` cascades to *every* source unconditionally — no "remove from registry only" option remains. **Why:** that was the explicit ask ("no need to have orphaned tags in tools when the tag is deleted from Tag Hub"), and a registry-only removal is exactly the behavior that looked broken (tag reappears because it's still in use). **Confidence:** high.

**Files:** `hub-tags.js`, `tags-hub.html`, `AGENTS.md`

**Files:** `tags-hub.html`, `AGENTS.md`

---

### ~~Priority 62 — Schedule: remove manual import button + tab-specific sidebar~~ ✓ Done `[group: schedule-ux]`
Three improvements to `schedule.html` from user-reported issues.

- **Remove manual "↓ Import" button** — `syncFromProjectHub()` already runs automatically on `HubData.onChange()`, so the manual import button was redundant. Removed CSS (`.sch-import-btn`, `.sch-overlay`, `.sch-modal-*`, `.sch-import-*`, `.sch-btn-primary:disabled`), HTML (button + `#import-overlay` modal), and JS (`_pendingImport`, `openImportModal`, `closeImportModal`, `executeImport`, `updateImportBadge`).
- **Tab order changed to Calendar → Timeline → Projects** — Calendar is the most-used view, so it's now first. Default `activeView` changed from `'timeline'` to `'calendar'`.
- **Calendar not visible on first load** — `#view-timeline` was missing `class="view-hidden"` in HTML (so Timeline was visible on load); `#view-calendar` had `class="view-hidden"` (hidden). Fixed by swapping the classes. Init now calls `switchView(ui.activeView)` instead of `render()` so `view-hidden` classes and sidebar-filter section visibility are correctly set from the start.
- **Tab-specific sidebar content** — The sidebar showed a flat item list for all three tabs, misaligning with Timeline's fixed `ROW_H=44px` rows and providing no value on Calendar. Fix:
  - Removed `#item-list` and `#sidebar-footer` from the sidebar HTML; removed `renderSidebar()` call from `render()`; `.sch-filter` wrapped in `#sidebar-filter-section` (shown only when `view === 'timeline'`).
  - Added a frozen `.gantt-label-col` (196px) directly inside `#view-timeline`'s `.gantt-layout` flex container, with `.gantt-label-head` ("Item") and `#gantt-label-body`. `renderTimeline()` renders one `44px` `.gantt-label-row` per item (color dot + name), synchronized to `gantt-scroll`'s vertical scrollTop. Clicking a label row calls `selectAndEdit`.
  - Calendar and Projects tabs have a clean sidebar with no item list.

**Key decisions:**
- **Decision:** Add the label column *inside* `#view-timeline`'s `.gantt-layout`, not in the shared sidebar. **Why:** the gantt uses fixed `ROW_H=44px` rows — the only way to guarantee pixel-perfect alignment is to make the label column part of the same flex row as `.gantt-wrap`, using identical row heights and scroll-syncing via `scrollTop`. A sidebar-based list can't guarantee this since sidebar rows can wrap or have variable padding. **Alternative rejected:** keep sidebar list but enforce fixed height — too fragile; any font-size difference or browser zoom breaks alignment. **Confidence:** high.
- **Decision:** Filter chips remain in the sidebar (hidden on Calendar/Projects, shown on Timeline). **Why:** the filters (`#sidebar-filter-section`) are Timeline-specific (item type/status/project filters); hiding them on other tabs is cleaner than moving them into the toolbar. They share the sidebar's existing padding and width without a new layout region. **Confidence:** high.

**Files:** `schedule.html`, `AGENTS.md`

---

### ~~Priority 63 — Project list sorted by group order across all tools~~ ✓ Done `[group: data-layer]`
Project selects/lists in 7 tools previously used raw `project-hub-v1` storage order (creation order). A single `HubData.getProjectsSorted()` function in `hub-data.js` now groups projects by `groupOrder` (Project Hub's saved drag order), sorts alphabetically within each group, and appends ungrouped projects last — identical to Project Hub's Groupings view. All 7 `getProjects()` call sites swapped to `getProjectsSorted()`.

**Key decisions:**
- **Decision:** Add `getProjectsSorted()` to `hub-data.js` alongside `getProjects()` rather than replacing it. **Why:** `getProjects()` is used by `hub-links.js` and `hub-search.js` for Cmd+K resolution where any stable order is acceptable, and `getProjectsSorted()` has slightly higher overhead (reads `groupOrder`). Keeping both lets callers opt in. **Confidence:** high.

**Files:** `hub-data.js`, `meetings-hub.html`, `goals-hub.html`, `risk-hub.html`, `stakeholder-hub.html`, `decision-hub.html`, `schedule.html`, `AGENTS.md`

---

### ~~Roadmap Group B — Resurface Loop Expansion~~ ✓ Done `[group: resurface-expansion]`
Seven improvements extending the Resurface card and Today view to pull from more buried data sources.

- **B1 — Risks due for review** — `buildResurfaceItems()` now reads `risk-hub-v1` and surfaces open/mitigating risks where `reviewDate ≤ today`, up to 2 entries, dismissable for 30d. Dismiss key: `risk:<id>`.
- **B2 — Condition-only decision revisits** — Decisions with `revisitWhen` text but no `revisitDate` are surfaced at 30/60/90d cadence (±3d window) after `createdAt`. Dismiss key: `dec-cond:<id>:<days>`.
- **B3 — Liked/super ideas older than 30d** — `ideaswipe_history_v6` entries with `vote === 'like'|'super'` and age > 30d are surfaced (newest first, up to 2). Dismiss key: `idea:<ts>`.
- **B4 — This Week's Rocks card in Today view** — Reads `review-hub-v1[currentWeekKey].rocks` (up to 3 pinned tasks from the Weekly Review); renders as a "🪨 This Week's Rocks" stat-card in Today. Clicking each rock navigates to project-hub. Helper `_currentWeekKey()` added before `buildTodayView()`.
- **B5 — Overdue meeting action items** — Meeting Hub's "Add Action" modal gained an optional **Due date** `<input type="date">` field (saved as `a.dueDate`). `buildResurfaceItems()` surfaces actions where `dueDate ≤ today` and `!done`. Dismiss key: `action:<id>`.
- **B6 — Stale KRs** — `toggleKR()` and `updateKRProgress()` in `goals-hub.html` now stamp `kr.updatedAt` on every KR mutation. `buildResurfaceItems()` surfaces KRs (latest active quarter) where `updatedAt` exists and age ≥ 14d, linking to the parent objective. Dismiss key: `kr:<id>`.
- **B7 — Calibration nudge strip** — When ≥3 decisions are past `revisitDate` and unscored, a full-width amber strip appears at the top of the Today grid prompting "calibrate your calls", navigating to decision-hub on click. Rendered before the Resurface card.

**Key decisions:**
- **Decision:** B3 (ideas) surfaces all liked/super ideas >30d — not just those without a linked project — because `ideaswipe_history_v6` entries don't carry a `projectId` (the send-to-hub flow creates the task but doesn't back-mark the idea). **Why:** a resurfaced idea the user already actioned is still harmless (they dismiss it); an unsent idea that wasn't resurfaced is the actual loss. **Confidence:** high.
- **Decision:** B4 rocks card navigates to `journal-hub` (not `project-hub`) on card click, but each rock row navigates to `project-hub` for `hub-highlight`. **Why:** the rocks panel lives in the Journal/Weekly Review, so the card-level CTA goes to "manage your rocks"; item-level CTA goes to the underlying task. **Confidence:** med.
- **Decision:** B7 nudge uses inline `style.cssText` (not a CSS class) for the strip. **Why:** it's a one-off element appended to a `.status-grid` without a CSS class of its own; adding a class to `theme.css` for one element that appears only when ≥3 decisions are overdue is disproportionate. **Confidence:** high.

**Files:** `index.html`, `meetings-hub.html`, `goals-hub.html`, `AGENTS.md`

---

### Rejected — Stakeholder Map embedded in Project Hub, and People Hub → Profile consolidation `[group: tool-consolidation]`
Two consolidation ideas were proposed and one was fully implemented, then both were explicitly rejected by the user in the same session.

- **Decision:** Do NOT embed a Stakeholders view inside Project Hub. Stakeholder Map (`stakeholder-hub.html`) stays a fully standalone sidebar tool, unchanged. **Why:** implemented once (power/interest grid view + Add Stakeholder modal inside `project-hub.html`, mirroring the Priority Matrix / Assumptions precedent) and the user disliked the result in practice: *"to be honest I didn't like Stakeholders inside project hub. it's better as a separate tool as it is now."* Reverted via `git revert` — `project-hub.html`, `index.html`, `help-hub.html` restored to pre-embedding state. **Alternative rejected:** keep the embedded view as an additional surface alongside the standalone tool — user wants the standalone tool only, no embedded duplicate. **Confidence:** high. **Revisit when:** the user asks for it again — don't re-propose proactively.
- **Decision:** Do NOT add a "Team" tab to the Profile page (`achievements-hub.html`) surfacing People Hub's Org Tree + Load Matrix. People Hub (`people-hub.html`) stays exactly as it is, unmodified and in the sidebar. **Why:** this was a proposed (not yet built) alternative to deleting People Hub; user rejected the proposal outright: *"I didn't like your People Hub to profile suggestion as well so keep it as it is."* **Alternative rejected:** delete People Hub entirely — user already ruled this out earlier in the same exchange ("E1 is out, I do wanna delete People Hub" was misread by the assistant as approval to consolidate; the user's actual ask was either improve-in-place or leave alone, and the final answer is leave alone). **Confidence:** high. **Lesson:** the precedent of prior successful tool-consolidations (Assumptions → Decision Hub, Priority Matrix → Project Hub) does not generalize to every tool — Stakeholder Map and People Hub both work better as their existing standalone forms. Don't re-propose either consolidation without new user-initiated interest.

**Files:** `project-hub.html`, `index.html`, `help-hub.html`, `AGENTS.md`

---

### ~~Priority 64 — Stakeholder Map: central registry + sorted project checklist~~ ✓ Done `[group: stakeholder-ux]`
Two follow-up fixes to `stakeholder-hub.html`, prompted by real use after the E2 revert above (Stakeholder Map staying a standalone tool made these gaps visible): every "+ Add stakeholder" created a brand-new record scoped to the current project filter, so the same person added to a second project became a duplicate (with risk of casing/spelling drift), and there was no way to edit a stakeholder's project links after creation.

- **Central registry picker in the Add modal** — a new "Existing stakeholder" `<select>` (alphabetical) sits above the name field; picking one skips creating a duplicate and instead adds the current project filter to that stakeholder's `projectIds` (deduped), then opens their detail panel. Typing a name that case-insensitively matches an existing stakeholder (datalist-assisted) shows the same merge behavior on save — catches accidental retypes even if the user didn't use the dropdown. `data.stakeholders` was already a single global array (not per-project), so the "registry" already existed in the data model — the gap was purely UI (no way to reuse an existing record).
- **Projects checklist in the detail panel** — a stakeholder's `projectIds` can now be edited directly via a grouped, checkbox-style project list (buffered in `_dpProjectIds`, committed on Save), reusing the exact group-order + alphabetical-within-group sorting from `getProjectsSorted()`/`hub-data.js` (Priority 63) and the same grouped-checklist rendering pattern as Tool Portfolio's "Enabled Projects" list (Priority 58).
- **Project filter dropdown sorted plain alphabetically** — the topbar project filter (next to "+ Add stakeholder") switched from `HubData.getProjectsSorted()` (group-order-aware) to `HubData.getProjects()` sorted by name only. User explicitly asked for simple alphabetical here, opting out of group-based ordering for this one list.
- Added `hub-toast.js` (was missing) for save/link feedback, consistent with the rest of the app (Priority 35/45).

**Key decisions:**
- **Decision:** Merge-on-match is non-blocking (a hint, not a hard validation error) — typing a name that happens to match is treated as intentional reuse, not an error to dismiss. **Why:** false positives are harmless (worst case: linking an existing record to one more project, which is itself a valid action), and a hard block would force users through an extra "are you sure" for what's usually the desired outcome anyway. **Confidence:** high.
- **Decision:** Reused the exact `getProjectsSorted()`-equivalent grouping logic locally in `stakeholder-hub.html` rather than refactoring it into a shared helper. **Why:** matches the existing "known duplication, accepted" pattern in this codebase (the same logic is already inlined in `tool-portfolio.html`); a shared helper would need to move group-by-name + saved-order logic out of `hub-data.js` into something importable by tools without `hub-data.js`, which is broader scope than this fix needed. **Confidence:** med.
- **Decision:** The topbar project filter uses plain alphabetical (`getProjects()` + sort by name), not `getProjectsSorted()`'s group-aware order, even though the detail panel's checklist does use the group-aware order. **Why:** the user explicitly asked for "alphabetical, grouping is okay to skip if hard" for this specific dropdown — a flat scanning list benefits more from pure A–Z than from group clustering, whereas the checklist's grouping helps when toggling many projects at once. **Confidence:** high.

**Files:** `stakeholder-hub.html`, `AGENTS.md`

---

### ~~Priority 65 — Dependency Graph: fix Tools legend overlapping search/stats~~ ✓ Done `[group: graph-links]`
The `.legend` (Tools), `.controls` (bottom-left button row), and `#empty` empty-state were all `position: absolute` direct children of `<body>` with no positioned ancestor — so their `top`/`right`/`inset` offsets resolved against the full viewport, not the graph canvas area below the header. With `.legend { top: 20px; right: 20px }`, that placed it inside the header's vertical space, overlapping the node-search input and the "N nodes · N links" count label.

**Fix:** wrapped `.controls`, `#legend`, `#empty`, and `#mynetwork` in a new `.canvas-area` div (`position: relative; flex: 1; display: flex; flex-direction: column; overflow: hidden`) — the header stays a sibling above it. The three previously-viewport-anchored elements now position relative to `.canvas-area`, which only starts below the header, so `top: 20px` lands just under the header instead of inside it. Verified via headless-browser layout check: legend top (95.5px) now clears the header bottom (75.5px) with zero rect overlap against both the search input and stats label.

**Key decisions:**
- **Decision:** Anchor via a wrapping `position: relative` container, not by adding a hardcoded top offset (e.g. `top: 90px`) to clear the header. **Why:** the header's height isn't fixed — the filter-bar row appears/disappears depending on whether filters are active, so a hardcoded offset would either leave a gap or re-overlap when the header's height changes. Anchoring to a sibling container that starts after the header is layout-independent. **Confidence:** high.
- **Decision:** Legend stays non-draggable, made collapsible-only. **Why:** that's what was asked — the legend already had a working collapse toggle from a prior pass; fixing the anchor/overlap bug doesn't require adding drag support, which is separate scope. **Confidence:** high. **Revisit when:** the user asks for drag-to-reposition specifically.

**Files:** `graph-hub.html`, `AGENTS.md`

---

### ~~Priority 66 — Strip live Anthropic API key from exports~~ ✓ Done `[group: data-safety]`
Triggered by reviewing a real Full Backup upload — `hub-settings-v1.anthropicKey` (the user's live API key, saved in plaintext via the ⚙️ Integrations panel) was included in every export, including the Full Backup the user routinely uploads to an external AI alongside a meeting transcript for analysis. A backup file is meant to be shareable/uploadable; a live credential inside it is not.

- **`buildExportPayload()`** (`index.html`) — the existing `hub-settings-v1` field-stripping (already removing `obsidianIndex`/`obsidianIndexedAt`) now also destructures out `anthropicKey` before the section is added to the export payload. Applies to all scopes (Full Backup, AI Context, Current Tool) since all three go through the same function.
- **`handleImportFile()`** (`index.html`) — restoring a v2 backup now special-cases the `hub-settings-v1` section: instead of a blind `HubStorage.set()` overwrite, it merges in the *currently configured* local `anthropicKey` (`{ ...val, anthropicKey: existing.anthropicKey }`) so restoring a backup — old or new — never wipes (or silently re-imports a stale) key already saved in the browser.
- **`ai-upload-guide.md`** updated to state new exports are safe to share as-is; only pre-2026-06-17 backup files still need the key manually deleted before uploading externally.

**Key decisions:**
- **Decision:** Strip the key on export rather than encrypt/mask it. **Why:** there's no in-browser secret to encrypt *with* — any obfuscation reversible by the app is just as reversible by anyone reading the export, so omission is the only real fix. **Alternative rejected:** partial masking (e.g. show last 4 chars) — gives a false sense of safety since the use case (uploading to an external AI) doesn't need to see the key at all. **Confidence:** high.
- **Decision:** On import, always prefer the existing local key over whatever (if anything) is in the backup, rather than prompting or importing it. **Why:** post-fix, new exports never carry a key, so the only way a backup *would* contain one is an old export from before this change — importing a possibly-stale/different-account key automatically would be a worse default than just leaving the current browser's key alone. **Alternative rejected:** prompt the user on conflict — overkill for a field most users never look at after initial setup. **Confidence:** med.

**Files:** `index.html`, `ai-upload-guide.md`, `AGENTS.md`

---

### ~~Priority 67 — Dependency Graph: view options (animations, sizing, clustering, recency filter)~~ ✓ Done `[group: graph-view-options]`
User loves the Dependency Graph and asked for Onexus-style ambient motion plus a few structural features, all explicitly **opt-in toggles that preserve the current default look** — none of this changes what the graph shows by default.

- **Ambient Drift toggle** (`opt-ambient-drift`, default ON) — formalizes the existing physics behavior (the user-loved "nodes slowly rotate after a drag") as a named, explicit setting rather than an accidental side-effect. `physicsOptionsFor(enabled, ambientDrift)` returns the original `centralGravity:0.004`/`minVelocity:0.5` tuning when ON (unchanged default feel) or a firmer `centralGravity:0.02`/`minVelocity:2.5` when OFF, so unchecking it makes the layout settle and stay still instead of drifting indefinitely.
- **Edge Flow** (`opt-edge-flow`, default OFF) — small dots animate along each visible edge from `from` → `to`, looping. **Breathing Nodes** (`opt-breathing`, default OFF) — a pulsing accent-colored glow halo around every visible node. Both are drawn via `network.on('afterDrawing', ...)` (vis-network's raw-canvas hook, coordinates already in node-position space) driven by a single shared `requestAnimationFrame` loop (`startAnimationLoop`) that only runs while at least one of the two is enabled, calling `network.redraw()` each frame to re-trigger the hook.
- **Degree-based sizing** (`opt-degree-sizing`, default OFF, explicit checkbox per the user's request — "might disturb looking, I don't know until trying") — since every node uses `shape:'box'` (auto-sized to label, `size` has no effect), this scales `margin`/`font.size` proportionally to each node's edge-degree (most-connected node = largest) instead. Computed once per `buildGraph()` call, only when enabled.
- **Cluster by project / by tool** (`#cluster-select` dropdown in the controls bar) — uses vis-network's native `network.clusterByConnection()` (one-hop, per project node) and `network.cluster()` (joinCondition by `tool`) rather than a custom implementation. Double-clicking a cluster node opens it (`network.openCluster()`) instead of navigating; switching modes or rebuilding the graph calls `openAllClusters()` first to avoid stacking stale clusters.
- **"New since" filter** (`#new-since-select` in the header — All time / 24h / 7d / 30d) — hides *manual* cross-tool links (`edge._linkId`) created before the cutoff; auto-generated structural edges (project/task/tag relationships, which have no creation timestamp of their own and aren't "new" in a meaningful sense) are unaffected. Backed by a `linkCreatedAt` map built from `HubLinks.getAll()`'s `link.createdAt` during every `buildGraph()`.
- **"View Options" panel** — new collapsible panel (`.view-opts`, modeled on the existing `.legend` pattern) anchored top-left (top-right is Legend, bottom-left is the button row), toggled via a new "View ▾" button in the controls bar, housing the four checkboxes.
- **Export as PNG** (`⬇ PNG` button in the controls bar) — `exportGraphPNG()` reads vis-network's own canvas (`network.canvas.frame.canvas`), composites it onto a freshly-drawn `--bg`-colored canvas (vis-network's canvas itself is transparent, so a raw `toDataURL()` would export with no background), then triggers a download via a throwaway `<a download>` link. No new dependency — pure canvas API.

**Key decisions:**
- **Decision:** All four checkboxes + cluster mode are session-only state (plain module-level JS vars), not persisted to localStorage. **Why:** matches the established convention for every other graph toggle (`physicsEnabled`, `autoLinksEnabled`, `leavesOnly`, `orphansOnly`) and Tags Hub's filter/sort state (Priority 59) — these are viewing preferences for the current look-around, not data. **Confidence:** high.
- **Decision:** Edge Flow + Breathing Nodes share one `requestAnimationFrame` loop rather than two independent ones. **Why:** both only need to force a redraw each frame; a single loop that no-ops when both are off (and self-terminates) is simpler and avoids double `network.redraw()` calls per frame. **Confidence:** high.
- **Decision:** Degree-based sizing scales `margin`/`font.size`, not vis's `size` property. **Why:** every node in this graph uses `shape:'box'`, which auto-sizes to its label text — `size` is a no-op for box-shaped nodes in vis-network. **Confidence:** high.
- **Decision:** Clustering uses vis-network's native cluster API (`clusterByConnection`/`cluster`) instead of a custom group-and-hide implementation. **Why:** vis-network already handles the visual collapse, the synthetic cluster node, edge re-routing, and the open/close lifecycle — reimplementing that would duplicate well-tested library behavior for no benefit. **Confidence:** high.
- **Decision:** "New since" only filters manual links, not auto-generated structural edges. **Why:** auto edges (e.g. "task → project", "tagged: X") represent standing relationships derived from current data, not a discrete moment of creation — there's no meaningful "new" timestamp to filter on, and hiding them would make the graph look broken rather than filtered. **Confidence:** high.
- **Deferred to a later session (explicit, per user request):** shortest-path highlighting between two selected nodes.

**Files:** `graph-hub.html`, `AGENTS.md`

---

### ~~Priority 68 — Stakeholder Map: Organizations view (vendor/consultant/dept roster)~~ ✓ Done `[group: stakeholder-ux]`
The classic PMBOK Power/Interest 2×2 ("Manage Closely / Keep Satisfied / Keep Informed / Monitor") didn't match how the user actually works: managing relationships with external **vendor** companies, external **consultant** companies, and internal **departments** (same company, different team) — abstract influence-quadrant triage wasn't the relatable lens.

- **New fields on stakeholder objects:** `org` (free-text company/department name, with a shared `<datalist id="org-suggestions">` across both the Add modal and Detail panel for consistent spelling/casing), `orgType` (`'vendor'|'consultant'|'dept'|''`), `responsiveness` (unrated or 1–5 select), `lastContact` (optional date).
- **New default view — "Organizations":** a two-tab switcher in the topbar (`Organizations` default, `Power / Interest` secondary — same `.view-tab`/`.view-tab-bar` visual pattern as `journal-hub.html`'s `.jh-tab`, written fresh here since it's a small enough pattern not to warrant a new shared CSS class). `getOrgGroups(items)` groups stakeholders by `org` (alphabetical, ungrouped last); each org renders as a card showing an org-type badge (vendor=`--node-blue`/`--border-blue`, consultant=`--node-purple`/`--border-purple`, dept=`--accent2`/`--accent2-dim`, unset=gray), a relationship-health line (`orgHealth()`: most recent `lastContact` across members, colored `--accent-like` if ≤30 days / `--accent-super` if stale, plus avg `responsiveness` if any member is rated), project chips (union of all members' `projectIds`, resolved via `HubData.getProjects()`), the member roster (reusing the existing `renderCard()` person-card), and a "+ Add person to this org" button that pre-fills the Add modal's org/org-type fields via new `_addModalOrg`/`_addModalOrgType` state.
- **Power/Interest matrix kept, not deleted** — demoted to the second tab; still useful for an individual stakeholder who's politically tricky regardless of which org they belong to.

**Key decisions:**
- **Decision:** Keep the Power/Interest matrix as a secondary tab rather than removing it. **Why:** the user said it's "not very related" to their day-to-day, not useless outright — it still has a niche use for a specific hard-to-read individual. Deleting it would lose that case for no benefit, since both views read from the same `data.stakeholders` array with no migration needed. **Confidence:** high.
- **Decision:** `org` is free-text (datalist-assisted) rather than a separate "Organizations" registry object. **Why:** matches this codebase's established "registry via shared string, not a new entity table" pattern (e.g. Tags Hub's tag strings, not tag IDs) — grouping happens at render time via `getOrgGroups()`, so there's no new storage shape or migration, and a typo is just a render-time miss-group, easily fixed by editing the field, not a referential-integrity break. **Alternative rejected:** a dedicated `organizations` array with `orgId` foreign keys on stakeholders — more correct in the abstract, but adds a second CRUD surface (rename, merge, delete-cascade) for a personal app where org count is small. **Confidence:** med. **Revisit when:** org count grows large enough that typo-drift becomes a real problem — at that point a Tags-Hub-style central registry (Priority 57) would be the natural upgrade path.
- **Decision:** `responsiveness`/`lastContact` are optional with explicit "not rated"/empty defaults, not required fields. **Why:** most existing stakeholders predate these fields and backfilling every record on day one isn't realistic; the health indicator already handles "no contact logged" as a neutral (non-colored) state rather than treating missing data as automatically stale. **Confidence:** high.

**Files:** `stakeholder-hub.html`, `AGENTS.md`

---

### ~~Priority 69 — Stakeholder Map: wider detail panel + auto-favicon avatar from URL~~ ✓ Done `[group: stakeholder-ux]`
Two small follow-up polish items.

- **Wider detail panel** — `.detail-panel` width bumped `300px → 420px`; there was unused horizontal space next to it, and the panel was getting cramped after Priority 68 added 4 more fields (org, org type, responsiveness, last contact) on top of the original 7.
- **Auto-favicon avatar from URL** — new `url` field on stakeholder objects (Website / Profile URL, in the Detail panel). When set, `shAvatarHtml()` swaps the `.sh-avatar` initials circle for a Google favicon (`https://www.google.com/s2/favicons?domain=...`) resolved from the URL's hostname, with an `onerror` fallback back to the existing initials — exact same auto-icon-with-fallback pattern as `tool-portfolio.html`'s `toolIconHtml()`. A live preview row (icon + domain + "auto" tag) appears under the URL input as you type, mirroring Tool Portfolio's `_iconPreviewHtml()`.

**Key decisions:**
- **Decision:** Reuse Tool Portfolio's exact favicon-fetch + onerror-fallback pattern rather than inventing a new one. **Why:** it's already proven in this codebase, needs no new dependency, and keeps the "auto icon, fallback to initials/emoji" idiom consistent across tools. **Confidence:** high.
- **Decision:** `url` only added to the Detail panel, not the Add modal. **Why:** matches the explicit ask (the user only mentioned the right panel) — most stakeholders won't have a URL on first add, so it's a detail-panel enrichment field, not a required step. **Confidence:** med. **Revisit when:** if quick-add usage shows people want to set it immediately on creation.

**Files:** `stakeholder-hub.html`, `AGENTS.md`

---

### ~~Priority 70 — Stakeholder Map: drag-and-drop persons between orgs + draggable org reordering~~ ✓ Done `[group: stakeholder-ux]`
Two drag-and-drop interactions added to the Organizations view, mirroring the established `project-hub.html` Groupings drag-reorder pattern (Priority 55).

- **Draggable person cards** — every stakeholder card rendered inside an org card (`renderCard(sh, true)`) is now `draggable="true"`. Dragging a person onto a different org card sets `sh.org` to that org's name (and backfills `sh.orgType` from the target org if the person had none set), then re-renders. Dropping on the "No organization" bucket clears `sh.org`. Matrix-view cards (`renderGrid()`) are unaffected — `renderCard()`'s new `draggable` param defaults falsy there, so person-drag is scoped to the Organizations view only.
- **Draggable org cards** — each named org card (not the "No organization" bucket) is itself `draggable="true"` with a `⠿` drag handle in its header. Dropping one org card onto another reorders a new persisted `data.orgOrder` array (string org names), unknown orgs appended alphabetically — same backfill-on-drop pattern as `project-hub.html`'s `state.groupOrder`. `getOrgGroups()` now sorts named groups by `orgOrder` index instead of pure alphabetical.
- Both drag types share one drop target (the org card) and are disambiguated by which module-level var is set (`personDragSrc` vs `orgDragSrc`) — since a person card's own `draggable="true"` takes priority over its draggable org-card ancestor for the browser's native drag-start targeting, no extra region-restriction logic was needed.

**Key decisions:**
- **Decision:** Reuse the org card itself as the drop target for both interactions (person-move and org-reorder), rather than separate drop zones. **Why:** HTML5 drag events naturally route a `dragstart` to the most specific `draggable` ancestor under the cursor — starting a drag from a person card (also `draggable`) never bubbles to the parent org card's dragstart, so one `ondrop` handler reading `personDragSrc` vs `orgDragSrc` cleanly disambiguates which action is in flight with no separate hit-test regions. **Confidence:** high.
- **Decision:** The "No organization" bucket card is a valid drop target for persons (clears `sh.org`) but is never itself draggable and never participates in `orgOrder`. **Why:** matches Project Hub Groupings' `isUngrouped` precedent — an implicit bucket has no stable identity to reorder against. **Confidence:** high.

**Files:** `stakeholder-hub.html`, `AGENTS.md`

---

### ~~Priority 71 — Help & Guide: staleness sweep~~ ✓ Done `[group: docs-hygiene]`
After 20+ priorities of feature work (P40-P70) since `help-hub.html` was last touched, an audit found its Tools/Frameworks/Workflows reference data had drifted from the real app. Fixed all findings.

- **Added 2 missing tool cards** — **Capture Hub** (brain-dump-and-auto-route, was in `index.html` APPS but never had a help-hub entry at all) and **Tags Hub** (central tag registry, Priority 57 — shipped without a help-hub card).
- **Refreshed 7 stale tool cards** whose `features`/`desc`/`sample` text predated major capability additions: **Stakeholder Map** (Organizations view is now the default, not Power/Interest — P68/70), **Schedule** (hourly time-block grid + meetings-on-calendar — P46/47), **Meeting Hub** (.ics import, attendee bulk-edit/repeat — P43/44), **Project Hub** (Groupings view — P55), **Decision Hub** (Calibration modal + resurface schema fields — P51), **Dependency Graph** (view-options pack: Ambient Drift/Edge Flow/Breathing Nodes/clustering/PNG export — P67; Tag nodes — P57), **Focus Timer** (AI Energy Insights — P47).
- **Fixed 1 dead reference** — Decision Hub's feature list said "Send to KMQT Board as a question"; KMQT Board was retired long ago in favor of Reflection Board. Corrected.
- **Threaded Argument Hub into the Decision Sprint workflow** as a closing step (structure the case before presenting it) — it existed as a tool card (added Priority 52) but wasn't referenced by any of the 4 workflow guides.
- **Verified clean, no action needed:** Frameworks list (Pyramid Principle/SCQA/MECE present and correctly tied to Argument Hub; no Scrum Board/War Room references anywhere); the "Profile" relabel (Priority 53) already correctly reflected in both the tool card and the Systems Thinking framework's `tools:` list.

**Key decisions:**
- **Decision:** Audit via a read-only subagent pass before editing, rather than editing while auditing. **Why:** the staleness was spread across 21 tool cards plus 3 reference arrays — a structured "find everything first, then fix in one batch" pass surfaces the full scope before any edit, avoiding partial fixes that miss siblings of the same bug (e.g. catching all 7 stale cards in one sweep instead of fixing them as separately-reported issues). **Confidence:** high.
- **Decision:** Tags Hub's tool card lists `PKM` as its only framework tie-in (no new "Taxonomy"/"Tagging" framework invented). **Why:** the project's framework reference is meant to be real, named methodologies with certifications/provenance — inventing a framework just to give a new tool a longer `frameworks` array would dilute that. PKM (Personal Knowledge Management) is the closest genuine fit since tag registries are a PKM-organization concern. **Confidence:** med.

**Files:** `help-hub.html`, `AGENTS.md`

---

### ~~Priority 72 — Meeting Hub: multi-file .ics import~~ ✓ Done `[group: meetings-import]`
"📥 Import .ics" previously only accepted a single file (`event.target.files[0]`), forcing repeated imports (and repeated toasts) when a user had several calendar exports (e.g. separate personal/work calendars) to bring in at once. File input gained the `multiple` attribute; `handleIcsImport` now reads all selected files in parallel (`Promise.all` over `FileReader`), and `importICSText` was split from its side effects — it now just parses+dedupes one file's text and returns `{added, skipped}` instead of calling `save()`/`renderList()`/`showToast()` itself. The caller aggregates totals across every file, then does exactly one `save()`, one `renderList()`, and one combined toast (e.g. "Imported 5 meetings, 2 already imported, 1 file failed"). A per-file try/catch means one malformed `.ics` doesn't abort the rest of the batch. Dedup (`icsKey`) still works correctly across the batch since `data.meetings` is mutated in-place between sequential per-file `importICSText` calls, so a duplicate event repeated across two of the selected files is still caught.

**Key decisions:**
- **Decision:** Read all files in parallel (`Promise.all`) but import them sequentially inside `.then()`, rather than importing inside each file's own `reader.onload`. **Why:** sequential import (not parallel) is required for cross-file dedup correctness — `existingKeys` is rebuilt from `data.meetings` at the start of each `importICSText` call, so files must be processed one after another for a duplicate event present in two files to be caught on the second occurrence. Reading is parallelized since `FileReader` I/O has no such ordering constraint. **Confidence:** high.
- **Decision:** `importICSText` no longer performs its own save/render/toast — that responsibility moved entirely to `handleIcsImport`. **Why:** with N files needing one combined summary instead of N separate toasts, the side effects had to move to the batch-level caller; keeping `importICSText` a pure parse-and-return function also makes it easier to reason about per-file error isolation. **Confidence:** high.

**Files:** `meetings-hub.html`, `AGENTS.md`

---

### ~~Priority 73 — Meeting Hub: .ics import options (skip Attendees/Location/Description)~~ ✓ Done `[group: meetings-import]`
Follow-up to Priority 72 — imported attendee names, locations, and raw invite bodies can be confidential or simply noise the user doesn't want carried into Meeting Hub. "📥 Import .ics" now opens a small **Import Options** modal first (`#ics-opts-modal-overlay`) with three checkboxes — Attendees, Location, Description/notes (all default-checked, preserving prior full-import behavior) — before the native file picker opens. "Choose file(s)…" snapshots the checkbox states into a module-level `icsImportPrefs` object, closes the modal, and triggers the (unchanged) multi-file `#ics-file-input`. Title/date/time are always imported (not toggleable — they're required for the meeting to exist at all).

`importICSText(text, opts)` gained an `opts` param (`{attendees, location, description}`, defaulting to all-true for safety if called without one): `attendeesList` is built only when `opts.attendees` is true (otherwise `[]`, so `attendees`/`attendeesList` both end up empty); `📍 location` and the raw description line are only pushed into `notesParts` when their respective flag is true. `handleIcsImport` snapshots `icsImportPrefs` once per batch and passes it to every file's `importICSText` call, so a multi-file import applies one consistent set of choices across all selected files.

`icsImportPrefs` persists only in memory for the page session (not localStorage) — reopening the modal later in the same session shows the last-used choices as a convenience, but a fresh page load always resets to all-checked.

**Key decisions:**
- **Decision:** Options apply per-import-batch (one modal → one set of choices → all files in that selection), not per-file. **Why:** the modal opens once before the file picker, and a user importing several files in one go (e.g. work + personal calendars) is very likely to want the same privacy choice applied uniformly; per-file granularity would need a second UI pass after file selection, adding friction for a feature whose whole point is fewer surprises. **Confidence:** high.
- **Decision:** Session-only in-memory prefs (module-level var), not persisted to `localStorage`. **Why:** matches the codebase convention for viewing/session preferences (Tags Hub filter/sort, graph view-options toggles) — this is a "how do you want this specific action to behave right now" choice, not durable data; a stale "attendees off" default silently surviving a reload could cause a user to think an import silently dropped attendees they actually wanted. Confirming from a clean all-checked default on reload is safer. **Confidence:** med.
- **Decision:** All three checkboxes default to checked (preserves pre-P73 behavior) rather than defaulting Attendees to unchecked. **Why:** the ask was to make attendees *optional*, not to change the default import behavior for users who haven't hit a confidentiality concern yet — an unannounced default change would silently drop data for existing workflows. **Confidence:** high.

**Files:** `meetings-hub.html`, `AGENTS.md`

---

### ~~Priority 74 — Meeting Hub: recurring series consolidation (weekly meetings)~~ ✓ Done `[group: meetings-import]`
Real-world pain: importing a Teams .ics with weekly standing meetings (section sync, department meeting) created one flat meeting record per week — crowding the meeting list and, since Dependency Graph puts one node per meeting record, crowding the graph too. The user explicitly didn't want per-occurrence detail, just "show them in calendar and link in Dependency Graph." Four-group build across the tools that read meeting data.

- **Group 1 — Series data model + ICS import (`meetings-hub.html`):** Recurring events (`RRULE` + `UID`) are now consolidated into **one** meeting record — `recurring: true`, `occurrenceDates: [{date, time, durationMins}]`, `icsOccKeys` (internal dedup keys), and `log: [{date, notes, actionItems, decisions}]` — one lightweight per-week entry instead of a whole separate meeting. Re-importing the same series just appends new dates/log entries (dedup via `icsOccKeys`, independent of the flat-meeting `icsKey` mechanism). Non-recurring events are untouched. `normalizeMeeting()` backfills the new fields. A new `activeLogEntry(m)` helper resolves to `m` itself for flat meetings or the selected week's log entry for a series — every notes/action-item/decision read-write call site (`flushCurrentDetail`, `toggleAction`, `deleteAction`, `sendActionToProjectHub`, `saveAction`, `logDecision`, `updateDecision`, `cycleDecisionStatus`, `sendDecisionToHub`, `deleteDecision`, `initMHActionDrag`, `sendMeetingAsDecision`) routes through it, so the CRUD logic didn't need to fork on `m.recurring` beyond that one indirection. The detail panel gains a horizontal date-chip strip (`selectOccurrence()`) to pick which week's log is being viewed/edited, defaulting to today's occurrence → nearest upcoming → most recent past (`seriesAnchorOccurrence()`), plus a "+ Add week" date input for manually logging an occurrence the ICS didn't cover. Agenda/attendees/project/type stay series-level (shared); the "🔁 Repeat" and "→ Schedule" buttons are hidden for series (repeat is meaningless when re-import already grows the series; schedule sync is superseded by Group 2's native per-occurrence pills). Sidebar rows show `🔁 <next date> · N×` instead of N separate rows.
  - **Legacy-data migration, folded into the normal import flow:** `absorbLegacyOccurrences(icsUid)` — the first time a recurring `icsUid` is encountered post-upgrade, any *pre-existing flat* meeting records sharing that `icsUid` (i.e. a user's already-imported weekly-occurrence pile from before this feature existed) are folded into the new series record (preserving each week's notes/action items/decisions as log entries) and removed, so re-importing an old export cleans up instead of duplicating. `migrateLinksToSeries(oldIds, newId)` rewrites any `hub-links-v1` entries pointing at the swallowed occurrence-record ids onto the new series id so existing cross-tool links don't dangle.
- **Group 2 — Calendar (`schedule.html`):** `getMeetingsByDate()` expands a series' `occurrenceDates` into one pseudo-meeting-pill per date (spread of the series + that occurrence's own date/time/durationMins) instead of reading a single `m.date` — month view, week all-day row, and the timed week-grid all get this for free since they share one function. Dragging/resizing a week-grid block now threads the occurrence's original day-column (`drag.origIso`) through to `moveMeeting`/`resizeMeeting` as an `occDate` param, so a drag targets just that one occurrence's `occurrenceDates` entry (and its matching `log` entry's date, kept in sync) — not the whole series. Non-recurring meetings are unaffected (same single-scalar path as before).
- **Group 3 — Dependency Graph (`graph-hub.html`):** node creation needed no change at all — `loadAutoNodes()` already just iterates `meetings-hub-v1`'s array 1:1, so consolidating occurrences into one record automatically collapses the graph. Only `fetchNodeMeta()`'s meeting-detail branch changed, to show "🔁 weekly series · Next: `<date>` · Occurrences: N" instead of a single `Date` field when `m.recurring`.
- **Group 4 — Home dashboard + Achievements (`index.html`, `achievements-hub.html`):** new shared helpers `mhActionItemsOf(m)` (flattens `log[].actionItems` for a series, or returns `m.actionItems` for flat) and `mhOccursOn(m, dateStr)` (checks `occurrenceDates` membership vs. a single `m.date` match) — used across the Overview "Meeting Actions" widget, the resurface "overdue meeting action items" card, the "Attention" panel's open-actions count, and the Today view's "Today's Meetings" card (which also now shows that day's specific occurrence time, not the series anchor). Achievements' "Meeting Maker" (`Log 5 meetings`) switched from counting `meetings.length` (records) to summing occurrences across series + flat records — otherwise consolidating a heavy recurring-meeting user's dozens of weekly records into a couple of series records would have made this achievement harder to reach for exactly the users this feature serves.

**Verified end-to-end** (headless-browser tests, not just unit logic): a 3-month weekly-series ICS import collapsed 15 occurrences into 2 records (1 series + 1 one-off); per-week notes stayed correctly isolated when switching occurrence chips; dragging one week's calendar block only moved that week (verified via mouse-drag simulation) while sibling weeks and all log entries stayed untouched; legacy pre-existing flat records (with real notes/action items and an existing cross-tool link) were correctly absorbed into a new series on re-import with the link rewritten to the new id and zero orphaned records left behind; the graph detail panel and both home-dashboard/achievements fixes were confirmed against seeded series data.

**Key decisions:**
- **Decision:** Per-week log entries (`log: [{date, notes, actionItems, decisions}]`) inside one series record, not a fully shared/flat notes field. **Why:** user's explicit choice when asked — they didn't want separate *meeting records*, but still wanted to tell one week's notes/actions apart from another's. **Alternative rejected:** one shared running log for the whole series (simpler, offered as the other option) — user picked the per-week variant. **Confidence:** high (explicit user choice).
- **Decision:** Detail-panel Date/Time/Duration inputs are removed entirely for a series (replaced by a static "🔁 Weekly series · N occurrences" label); per-occurrence date/time editing lives only in the Schedule week-grid (Group 2's drag/resize), not duplicated in Meeting Hub's detail panel. **Why:** editing "the date" of a series in a single scalar field is meaningless once there are many dates, and the calendar is the more natural surface for adjusting one occurrence's time — avoiding a second editing UI for the same data cuts real implementation risk (a second `flushCurrentDetail` branch mutating `occurrenceDates` by array index) for a feature the user didn't ask for. **Confidence:** high.
- **Decision:** Legacy-record absorption runs automatically inside the normal `importICSText()` flow (triggered the first time a series' `icsUid` is seen), not as a separate one-time "migrate my data" button. **Why:** the exact trigger for the problem (re-importing an updated Teams export) is also the natural trigger for the fix — no separate UI, no separate migration state to track, and it only touches data for `icsUid`s the user is actively re-importing (never blind-migrates untouched data). **Confidence:** high.
- **Decision:** `migrateLinksToSeries` rewrites dangling link ids rather than leaving them or deleting them. **Why:** per this repo's data-safety convention (never silently destroy user data, prefer a reversible fix) — a link the user manually created (e.g. "this meeting relates to that risk") should keep pointing at *something meaningful* after consolidation, and the series is the correct new target. **Confidence:** high.
- **Decision:** Achievements' "Meeting Maker" now counts occurrences-across-series instead of raw record count. **Why:** the achievement's intent was always "you've logged meetings," and this feature's whole purpose is to stop creating a record per occurrence — counting records post-consolidation would silently regress progress for the exact users (heavy recurring-meeting importers) this feature targets. **Confidence:** high.

**Known deferred limitation:** ICS `RECURRENCE-ID` overrides (a single moved/modified occurrence of a recurring event, sharing the master's `UID` but without its own `RRULE`) are not specially parsed — they fall through the non-recurring import path and can appear as an extra flat record alongside the series rather than replacing that one occurrence. This was a pre-existing gap (not introduced by this change) and is out of scope here; revisit if a real Teams/Outlook export surfaces it in practice.

**Files:** `meetings-hub.html`, `schedule.html`, `graph-hub.html`, `index.html`, `achievements-hub.html`, `AGENTS.md`

---

### ~~Priority 74 follow-up — Manual weekly series (no ICS required)~~ ✓ Done `[group: meetings-import]`
Priority 74's series data model was built while investigating a Teams ICS import complaint, but the user's actual ask was broader: control recurrence **from inside Meeting Hub itself** — pick a meeting, mark it weekly, set a start/end date — with no calendar export involved. The data model (`recurring`/`occurrenceDates`/`log`) and every consumer (calendar, graph, dashboard, achievements) already work regardless of how a series was created, so this was purely a UI gap, not a redo.

- **"📆 Make Weekly" button** (shown on any non-recurring meeting, next to "🔁 Repeat") opens a modal: start date (defaults to the meeting's current date), an end date field, and quick-pick chips (+4 weeks / +3 months / +6 months / +1 year). `confirmMakeWeekly()` calls `weeklyDatesInRange(start, end)` — a plain weekly stepper (`addDaysToDate(cur, 7)`, capped at 520 iterations ≈ 10 years) — converts the meeting to `recurring: true`, and builds `occurrenceDates`/`log` for every week in range, same weekday as the start date. The meeting's existing notes/action items/decisions are preserved as the log entry for the start-date occurrence (nothing is lost by converting).
- **"🔁 Extend Series" button** replaces "Repeat" once a meeting is recurring — same modal, but the start-date field is hidden and the range begins the week after the series' current last occurrence, so repeated clicks keep pushing the end date out without ever creating a gap or duplicate week.
- Both flows reuse the exact `occurrenceDates`/`log`/`syncSeriesAnchor` plumbing from ICS import — a manually-created series and an ICS-imported one are indistinguishable to every other consumer (calendar, graph, dashboard widgets, achievements) once created. `icsUid` stays unset for manual series, which is intentional: it means a later ICS import can never accidentally merge into a hand-built series (they only merge when the iCal UID actually matches).

**Verified end-to-end:** creating a meeting, filling in notes, then "Make Weekly" with the "+3 months" quick-pick generated 14 same-weekday occurrences with the original notes correctly attached to the start-date week; "Extend Series" with another "+3 months" click added 13 more weeks continuing seamlessly from the prior end date (27 total, no gap or overlap).

**Key decisions:**
- **Decision:** No day-of-week picker — the series always repeats on whatever weekday the start date falls on. **Why:** matches the explicit ask ("starting date... automatically every week") without adding a control nobody asked for; changing the weekday is just changing the start date. **Confidence:** high.
- **Decision:** "Make Weekly" converts an *existing* meeting in place rather than being a separate creation flow. **Why:** reuses the whole existing title/agenda/attendees/notes editing UI with zero duplication, and directly parallels how "🔁 Repeat" already works (act on the currently open meeting) rather than introducing a second "+ New weekly meeting" entry point. **Confidence:** high.
- **Decision:** "Extend Series" always continues from the series' actual last occurrence (not from today or a user-typed start), with no way to leave a gap. **Why:** a gap in a "standing weekly meeting" is almost certainly a mistake, not intent — anchoring to the last occurrence makes the extension always contiguous by construction. **Confidence:** high.

**Files:** `meetings-hub.html`, `AGENTS.md`

---

### ~~Priority 75 — Dependency Graph: Critical Path highlighting~~ ✓ Done `[group: graph-links]`
Sourced from an esen-vault cross-pollination check: the vault's `frameworks/Critical-Path-Method.md` reference note had flagged an honest gap since May — "Dependency Graph shows the network but does not calculate or highlight the critical path" — and it was still true. Added a "⛓ Critical Path" toggle to Graph Hub that highlights the longest chain of dependency-linked, dated tasks and shows each task's schedule float.

**Implementation (`graph-hub.html`):** No schema changes — reuses two things that already existed but weren't connected: the `blocks`/`depends-on` `relType` values on manual links (already directional — `blocks` arrows a→b, `depends-on` arrows a→b meaning b is the predecessor) and Project Hub tasks' existing `due` field. `computeCriticalPath()` builds a predecessor→successor adjacency map from `hub-links-v1` entries where both endpoints are project-hub tasks with a `due` date, runs Kahn's algorithm for a topological sort (any nodes left over are in a cycle and are excluded, not crashed on), then a longest-path DP by hop count (ties broken by later due date) to find the chain. Float per task = days between its due date and its longest-chain predecessor's due date; ≤0 is flagged "at risk." The critical chain is highlighted in the graph (accent-colored thick border/edges) and listed in a new bottom-right `.cpath-panel` (finish date + task count, click a row to focus that node); `fetchNodeMeta`'s project-hub task branch gained `Due` and, when a float is computed, `Float` rows. Reapplies automatically after any `buildGraph()` rebuild (theme switch, clustering, etc.) via a silent re-apply that skips the "no chain found" toast.

**Key decisions:**
- **Decision:** Derive dependency direction from the *existing* `blocks`/`depends-on` link types instead of adding a new field or link type. **Why:** these relTypes already carry directional arrows in the graph and are already selectable in both the edge-panel and "+ New Link" modal — any user who'd already tagged links this way gets critical-path analysis for free, and it keeps the feature at zero schema/migration cost. **Alternative rejected:** infer direction purely from comparing two linked tasks' due dates (no relType needed at all) — rejected because it would silently mis-order same-day or reversed-intent links with no way for the user to correct it; requiring an explicit `blocks`/`depends-on` link keeps the computation honest about what it actually knows. **Confidence:** high.
- **Decision:** Use hop-count longest-path (not duration-weighted CPM) as the "critical path," with due-date gaps surfaced separately as "float." **Why:** this app deliberately has no task-duration/start-date fields — the `Now.md` vault note records a standing rule to avoid execution-step-level estimation overhead — so a textbook forward/backward-pass CPM would need new fields this project has intentionally avoided. Hop-count longest-path is the closest honest analogue: "longest dependency chain," with float computed from the due dates that already exist. **Confidence:** med. **Revisit when:** if task start dates are ever added for other reasons, upgrade to duration-weighted CPM.
- **Decision:** Cyclic dependencies are excluded from the ranking (reported via a small ⚠ note) rather than erroring or breaking the whole computation. **Why:** matches this codebase's general defensive-parsing convention (e.g. the Tags Hub `[].split` crash fixed in Priority 57) — a bad/contradictory link shouldn't take down an otherwise-useful feature. **Confidence:** high.

**Files:** `graph-hub.html`, `AGENTS.md`

**Follow-up — Project Hub: quick dependency link ✓ Done:** Critical Path only works if `blocks`/`depends-on` links exist, but creating one required leaving Project Hub for Graph Hub's "+ New Link" modal. Added a "⛓" action button on each task row → small modal, pick a sibling task in the same project + a direction (Depends on / Blocks) → calls `HubLinks.addLink(..., {relType})` directly. No changes to the shared `hub-links.js` picker (kept generic/cross-tool as-is); this is a project-hub-local modal scoped to same-project tasks only, since that's the only case Critical Path can use.

**Files:** `project-hub.html`, `AGENTS.md`

---

### ~~Priority 76 — Web performance audit + font-loading consolidation (Fix #1)~~ ✓ Done `[group: perf]`
Ran a runtime performance audit of the whole app (served locally, measured Navigation/Resource Timing in a real browser + static analysis of every file). Findings, worst-first: (1) **fonts loaded twice on every page** — a render-blocking `@import` in `theme.css:1` (`Syne:700;800 + DM Sans + Fraunces`) *and* a per-page `<link>` (`Syne:700 + DM Sans + JetBrains`), with **DM Sans downloaded twice** (~37KB dup) and font weight-strings inconsistent across tools (so no cross-tool cache reuse); only `capture-hub.html` had a `preconnect`. (2) Heavy tools carry a large HTML/inline-CSS parse tax paid on every open (project-hub 209KB HTML / 52KB inline CSS → ~105ms parse-to-interactive, re-parsed each switch since the iframe is torn down to `about:blank` on close). (3) `graph-hub` loads **673KB of vis-network** synchronously from unpkg (blocks its render). Non-issues confirmed: `APP_LOAD_TS = Date.now()` is per-session (caching works within a session), storage subscriptions are per-key (no re-render storm), localStorage read cost is trivial/data-dependent.

**Fix #1 shipped (fonts only — the highest-leverage, lowest-risk item; #2/#3 deferred):**
- Removed the render-blocking `@import` from `theme.css:1`.
- Gave all 29 standard tools **one byte-identical** Google Fonts `<link>` (`DM Sans:400;500;700 + Fraunces:400;500;600;700 + JetBrains Mono:400;500 + Syne:700;800` — the exact **union of what each page already fetched**, so no glyph/weight is lost and rendering is unchanged), each preceded by `preconnect` to `fonts.googleapis.com` + `fonts.gstatic.com`.
- `capture-hub.html`: kept its richer italic/opsz set, **extended** it to cover the weights it used to get from the `@import` (Fraunces 500;600;700, Syne 800) so it's self-sufficient after removal; added the gstatic preconnect.
- `blocked-depth.html`: had **no** font link of its own (relied solely on the `@import`) — added the canonical link explicitly so it didn't lose fonts.
- **31 files changed** (29 tools + capture + blocked-depth + theme.css). Both target URLs validated (HTTP 200, all four families) before any edit.

**Measured before → after (shell load):** font stylesheet requests 2 → **1**; woff2 downloads 5 (DM Sans doubled) → **4 (no dupes)**; render-blocking `@import` waterfall removed; `preconnect` now on every page; fonts now cache **once** across all tools instead of per-tool variants. Verified: no console errors, headings still render Fraunces, `font-weight:800` Fraunces still synthesizes from 700 exactly as before — **zero visual change**.

**Key decisions:**
- **Decision:** Ship Fix #1 (fonts) only; defer #2 (lazy-load/pin vis-network) and #3 (extract project-hub's inline CSS). **Why:** #1 is the widest-reach, lowest-risk change (mechanical, fully reversible, zero visual change) and touches every tool via one shared URL; #2 changes how a 673KB lib initializes (race risk) and #3 is cascade-order-sensitive (tool `<style>` intentionally loads after `theme.css`) — both are medium-risk and warrant their own session. **Confidence:** high.
- **Decision:** Canonical URL = the **exact union of currently-fetched weights**, not a "correct" superset. **Why:** the goal was a *pure delivery fix with zero visual change* — notably, `font-weight:800` on Fraunces is used widely but Fraunces 800 was never in any font URL, so those headings have **always** been faux-synthesized from 700; adding real 800 would be a visible design change, out of scope for a perf pass. Keep the synthesis behavior identical; flag 800 as a separate future design call. **Confidence:** high.
- **Decision:** `capture-hub.html` keeps its own richer (italic/opsz/weight-300) URL rather than folding into the one canonical URL. **Why:** capture genuinely renders DM Sans italic + weight 300 + optical sizing that the other 29 don't; a single universal URL would either strip those (regress capture) or add `opsz` to the other 29's DM Sans (which, with the browser-default `font-optical-sizing: auto`, could subtly shift their rendering). Two URLs = both capture and the 29 stay byte-identical. **Confidence:** high.
- **Decision:** Used a controlled Node script (literal targeted regex, per-file match-count check) for the 29-file sweep, not PowerShell `-replace`. **Why:** the repo's standing file-safety rule — `-replace` with concatenated strings can silently truncate files; a verified Node `String.replace` with a tight `fonts.googleapis.com/css2` anchor + `git diff` review is safe. **Confidence:** high.

**Deferred (not done):** #2 lazy-load + local-pin vis-network / html2canvas; #3 extract heavy tools' inline `<style>` to cached external CSS; #4 evaluate dropping/subsetting Fraunces (67KB/page); #5 iframe keep-alive (highest-risk — live timers/subscriptions; likely skip). Also noted for a future *design* (not perf) pass: Fraunces 800 headings render synthesized — add real 800 if desired.

**Files:** all 30 tool HTML files, `theme.css`, `AGENTS.md`

---

### ~~Priority 77 — Dependency Graph: Reasoning Path / Impact Analysis trace mode~~ ✓ Done `[group: graph-links]`
Sourced from cross-pollinating an esen-vault session's work on OneRoot (a decision-reasoning tool) into Thinking Hub. OneRoot's founding move is answering two questions about any node: *why does it exist* (walk backward) and *what does it affect* (walk forward). Priority 75's Critical Path already proved the underlying idea works here — a directed adjacency built from `blocks`/`depends-on` `relType`s — but only for the single longest chain among *dated project-hub tasks*. This generalizes it to **any node, any tool, on demand**: two new buttons in the node panel, "⤺ Reasoning Path" (backward) and "⤻ Impact Analysis" (forward).

**Implementation (`graph-hub.html`):** `_impactAdjacency()` builds a forward/backward adjacency map over the *whole* current graph (manual `hub-links-v1` entries **and** auto context edges — tags, task→project hosting, decision/risk/goal/meeting→project), not just dated tasks. Direction is **not** the same as raw edge direction for every `relType` — same caveat ONEXUS's `what_if` MCP tool documents for its own graph traversal: `blocks`/`leads-to` impact flows *with* the edge (a blocks b → if a slips, b is affected), but `depends-on` impact flows *against* it (a depends-on b → if b changes, a is affected, not the reverse). Auto edges and `relates` have no causal direction, so they're walked both ways. `traceFromNode(nodeId, mode)` is a depth-tracked BFS over the chosen adjacency direction, capped at 6 hops. Highlighting reuses Critical Path's exact visual language (accent-colored border/edge width) via a full `buildGraph()` reset before each new trace, so stale highlights from a prior trace or Critical Path never stack. Results render in a new bottom-left `.trace-panel` (mirrors `.cpath-panel`'s styling, kept as a separate panel so the two features can't visually collide), grouped by hop count, each row focusable.

**Key decisions:**
- **Decision:** Add an explicit `visited` set to the BFS, unlike OneRoot's own `reasoningPath()`/`impactTree()` (documented in `OneRoot_v2/AGENTS.md` as having *no* cycle guard). **Why:** OneRoot's datasets are hand-authored and kept deliberately acyclic, so it never needed one; this graph has no such guarantee — two decisions can easily end up mutually `depends-on` each other — so an unguarded walk would infinite-loop. **Confidence:** high.
- **Decision:** Include auto context edges (tags, task→project, decision/risk/goal/meeting→project) in the trace, not just manual `blocks`/`depends-on`/`leads-to` links. **Why:** excluding them would make Reasoning Path silently incomplete — e.g. two tasks under the same project sharing no manual link still share real context a "why does this exist" trace should surface. They're walked bidirectionally since they carry no causal direction, same treatment as `relates`. **Confidence:** high.
- **Decision:** Reuse Critical Path's per-`relType` direction convention verbatim (don't reinvent it) rather than defining a fresh direction table. **Why:** it was already correct, already reviewed (Priority 75), and this is exactly the "one engine, generalize the traversal" move OneRoot's own architecture is built around — keeping direction semantics in one place avoids the two features silently disagreeing later. **Confidence:** high.
- **Decision:** Full `buildGraph()` reset at the start of every `applyTrace()` call, instead of tracking + reverting the previous highlight set manually. **Why:** matches Critical Path's own reset idiom (`clearCriticalPath()` already does this) — cheap at personal-scale graph sizes, and categorically avoids a class of stale-highlight bugs (old trace or Critical Path colors lingering on nodes not in the new result) that manual bookkeeping would risk. **Confidence:** high.

**Verified** against a seeded test graph (2 decisions, 2 tasks, 1 risk, one of each `relType` including a chained `depends-on`) via the real UI path (`showNodePanel` → button click, not just the underlying function): confirmed the `depends-on` reversal in isolation (`forward[task-1]` correctly excludes `task-2`; `forward[task-2]` correctly includes `task-1`) before trusting the full BFS output, then verified the rendered panel text, hop counts, and highlighted node/edge sets end to end, and that `clearTrace()` fully resets border widths. Zero console errors.

**Files:** `graph-hub.html`, `AGENTS.md`

---

### ~~Priority 78 — Tool Portfolio: Freshness × Mastery matrix tab~~ ✓ Done `[group: tool-portfolio-personal-lens]`
Brainstormed 2026-07-12, cross-session from Vibe_Coding. The existing Technology Radar ring (adopt/trial/assess/hold) frames every tool as a company-wide adoption call — but the user isn't the one deciding Obayashi's full software portfolio, only evaluating a subset of tools they're actually asked to. Wanted a second, personal axis: how fresh/used and how well-known each tool is to *them*, presented as something interactive and a bit fun to check in on — not another rigor exercise.

**Implementation:** Three new fields on each tool object, additive to the existing schema (`lastUsedAt` ISO timestamp, `useCount` integer, `mastery` 0–3), populated via a new **Matrix** tab. `tool-portfolio.html` had no top-level view-switcher (`renderList`/`renderDetail`/`renderCompare` were simultaneous panels, not swappable pages) — added a minimal two-button tab bar (List / Matrix, `switchTpView()`) toggling which renders, without touching existing panels or the ring/status filter logic. The Matrix tab is a 5×4 CSS grid (`renderMatrix()`): freshness rows (Today / This week / This month / Stale 31–90d / Forgotten >90d or never, via `getFreshnessBucket()`) × mastery columns (Novice / Comfortable / Skilled / Power-user). Each tool renders as a chip inside its cell, tinted by `category` (`categoryPaletteKey()`, hashed into one of 6 palette colors). Tapping a chip opens a popover (`openChipPopover()`): a "✓ Used today" button (`logToolUsage()` sets `lastUsedAt = now`, `useCount += 1`, chip jumps to the Today row), a 4-dot mastery selector (`setToolMastery()`, click dot `lvl` to set mastery to exactly `lvl`, chip moves column), and a "View details →" link that switches to List and opens the existing `renderDetail` panel for ring/notes/project links. New tools default to `lastUsedAt: null` (Forgotten row) and `mastery: 0` (Novice column), so nothing is ever invisible.

**Key decisions:**
- **Decision:** Add `lastUsedAt`/`useCount`/`mastery` alongside the existing `ring`, not replacing it. **Why:** the user is only responsible for evaluating a subset of tools — `ring` still matters for those; the new axis answers a different question (personal relationship, not company adoption). **Alternative:** replace `ring` outright — rejected, would erase the smaller but real eval use case. **Confidence:** high.
- **Decision:** Track `useCount` (lifetime tap count) instead of a true consecutive-day streak. **Why:** streak logic has timezone/day-boundary edge cases not worth solving for a first version; a lifetime count is simpler and still gives a satisfying climbing number. **Alternative:** full streak tracking — deferred as a possible v2 if `useCount` doesn't hold up. **Confidence:** med.
- **Decision:** Bucketed grid (5×4 cells) over a free-floating scatter plot (continuous freshness axis, tools as drifting dots). **Why:** matches a design precedent already explored in Vibe_Coding's abandoned software-matrix table, far simpler to build and keep tappable/readable as tool count grows — a scatter plot needs collision handling and degrades past a couple dozen tools. **Alternative:** scatter plot — deferred as a possible v2 evolution. **Confidence:** high.
- **Decision:** `category` shown as chip color, not as a third grid axis or a filter dropdown. **Why:** a 2D grid can only show two axes; color preserves at-a-glance category clustering with no extra UI chrome. **Alternative:** category as filter dropdown — simpler but less immediately visible; user chose color. **Revisit when:** after real usage, if the color palette gets muddy with many categories. **Confidence:** med — this is the part of the design the user was least sure of.
- **Decision:** Build the full experience now (colors, `useCount`, popover) rather than a stripped-down trial version. **Why:** explicit user call, made despite acknowledging real uncertainty about whether the whole concept holds up under daily use. **Revisit when:** after 1–2 weeks of real usage — if it doesn't stick, prune complexity rather than add more. **Confidence:** med.

**Verified** across all 4 implementation tasks via the real UI path (chip click → popover → button/dot click, not just the underlying functions), plus a seeded test tool where `file://` browser navigation wasn't available: confirmed the popover's initial state ("Used 0× · last never", dot 0 filled), that "✓ Used today" moves the chip into the Today row and updates the usage label to "Used 1× · last {today}", that clicking mastery dot `lvl` sets `mastery` to exactly `lvl` and moves the chip to that column (verified Today × Skilled after clicking dot index 2), that "View details →" switches to List and opens the same tool's detail panel (`currentId` matched), and that all three fields (`lastUsedAt`, `useCount`, `mastery`) and the resulting grid position survive a full page reload (`HubStorage` persistence, not just in-memory state). Zero console errors throughout.

**Files:** `tool-portfolio.html` only — tab bar, `renderMatrix()`, `getFreshnessBucket()`, `categoryPaletteKey()`, popover component (`openChipPopover`/`closeChipPopover`/`logToolUsage`/`setToolMastery`), new fields on `tool-portfolio-v1` storage objects. Per the "category as chip color" decision above (confidence: med, the part of the design the user was least sure of), revisit after 1–2 weeks of real use before adding anything further (filter dropdown, true streak counter).

---

### ~~Priority 79 — Machi Town: trustworthy Portfolio fire signal~~ ✓ Done `[group: machi-town]`
The Events layer originally treated `lastUsedAt: null` as fully stale and rendered a fire. Tool Portfolio added `lastUsedAt`/`useCount` after many established tools already existed, so several adopted tools had no usage history and appeared abandoned even though the tracker simply had not observed them yet.

**Implementation (`town-hub.html`):** `buildingIncident()` now accepts whether real usage history exists. Portfolio buildings can catch fire only after they have a genuine `lastUsedAt` timestamp and that timestamp becomes 60+ days old. Hub Pages keep the existing behavior because that district is constructed only from actual `hub-activity-v1` log entries. Crane, project crash/stall, responder, and weather behavior are unchanged. `index.html` now describes Machi Town as the full six-lens city rather than only a Tool Portfolio visualization.

**Key decisions:**
- **Decision:** Treat missing usage history as "unknown," not "neglected." **Why:** the fields were introduced after the tools, so `null` cannot distinguish an unused tool from an established tool that predates tracking. A fire is an assertion and should require evidence: a real timestamp that has aged past 60 days. **Alternative:** seed or invent baseline dates for adopted tools — rejected because synthetic activity would contaminate Tool Portfolio's personal usage record. **Revisit when:** Tool Portfolio stores an explicit `trackingStartedAt` or creation timestamp that can support a real grace-period calculation. **Confidence:** high.

**Verified:** seeded rule cases cover an adopted never-tracked tool (no fire), a tracked tool at 59 days (no fire), a tracked tool at 60 days (fire), a heavily used current tool (crane), and Hub Pages' logged-history path (fire at 60 days). Script syntax, storage-key usage, script load order, and color literals remain unchanged.

**Follow-up discovered (pre-existing, not part of this change):** `people-hub-v1` is actively read by `people-hub.html`, `project-hub.html`, and Machi Town, but is missing from this file's localStorage source-of-truth list and from `index.html`'s backup key arrays. Audit and add it to backup/sync deliberately in a separate data-safety pass.

**Files:** `town-hub.html`, `index.html`, `AGENTS.md`

---

### ~~Priority 80 — Standalone MachiHub: vault-town parity pass~~ ✓ Done `[group: machi-town]`
The canonical Vibe Coding host still rendered the Phase 5 fixed-width project preview even though its shared engine already supported districts, responsive row sizing, anchored hit boxes, incidents, and weather. The host now uses those proven primitives without importing Thinking Hub-only data concepts.

**Implementation (`Vibe_Coding/MachiHub`):** `vault-adapter.js` maps the snapshot's existing `group` field into Work/Personal project districts and derives only two evidence-backed project incidents: fire for non-shipped projects with no update for 60+ days, and a crane for active projects updated very recently with 10+ open tasks. `index.html` adds Work/Personal lens chips, container-fit row sizing, internal mobile overflow, click-anchored project popovers, empty-lens state, incident legends, and fire-density weather. Shipped projects never catch fire. Missing/invalid update dates remain unknown rather than being treated as stale. The fallback sample town exercises both incident types. `README.md` and `CLAUDE.md` now describe the current host and record One+ as intentionally deferred.

**Key decisions:**
- **Decision:** The standalone host gets Work/Personal project lenses, not a copy of Thinking Hub's six lenses. **Why:** `vault-status.json` genuinely contains project group/status/freshness/task data but has no Hub-page, tool-usage, people, achievement-profile, or risk-response feeds. **Alternative:** imitate the six-lens UI with authored/sample actors — rejected because it would make a real-data status view partly fictional. **Confidence:** high.
- **Decision:** Vault incident detection lives in the vault adapter and uses only snapshot evidence. **Why:** the adapter is the host-specific translation boundary; the canonical engine should render `incident` without learning vault semantics. **Alternative:** infer overdue/stalled projects from prose or open-task counts — rejected because the snapshot has no due dates. **Confidence:** high.
- **Decision:** Mobile uses a contained horizontal town scroller instead of shrinking pixel art below the engine's 4-column minimum. **Why:** preserves readable pixels and hit targets while preventing page-level horizontal overflow. **Confidence:** high.

**Verified:** real HTTP path returned the host, engine, and 18-project snapshot; inline host and adapter scripts compile; seeded adapter cases cover fresh/cold/busy/shipped/personal mappings; the in-app browser rendered both districts with weather, toggled each lens and the both-off empty state, opened an anchored ONES detail with its Obsidian link, and reported no console warnings/errors. At 390×844 the body stayed within 375px while the 660px town scrolled internally. No storage keys or shared-engine files changed.

**Files:** `Vibe_Coding/MachiHub/index.html`, `vault-adapter.js`, `serve.js`, `README.md`, `CLAUDE.md`; `Thinking-Hub/AGENTS.md`

---

### ~~Priority 81A — Standalone MachiHub: environment controls~~ ✓ Done `[group: machi-town-parity]`
The standalone vault-town host now exposes the shared engine's existing environment features: automatic or manually previewed time of day, automatic or manually selected season, and PNG export of the current canvas.

**Key decisions:**
- **Decision:** Keep time and season as host-session state, independent of the Work/Personal project lenses. **Why:** changing data visibility or resizing the town should preserve the user's visual preview without adding a new persistent storage contract. **Confidence:** high.
- **Decision:** Use the canonical engine APIs directly rather than duplicating visual logic in `index.html`. **Why:** `setTimeOfDay`, `setSeason`, and `downloadPNG` already define the portable behavior shared with Thinking Hub. **Confidence:** high.

**Verified:** the deployed standalone file contains both environment rows and wires them to `setTimeOfDay`, `setSeason`, and `downloadPNG`; new-town construction reapplies the selected modes after lens or responsive rebuilds. No storage keys, adapters, or shared-engine files changed.

**Files:** `Vibe_Coding/MachiHub/index.html`; `Thinking-Hub/AGENTS.md`

---

### ~~Priority 81B — Standalone MachiHub: city-status HUD and town crier~~ ✓ Done `[group: machi-town-parity]`
The standalone vault town now presents the same glanceable city-status layer as Thinking Hub, adapted to evidence the vault snapshot actually contains. The header reports total projects, healthy projects, cold projects, busy construction sites, and incident-driven storm intensity. A reduced-motion-aware ticker prioritizes cold/busy project news and weather before achievement headlines.

**Key decisions:**
- **Decision:** Replace Thinking Hub's active-vehicle count with a busy-site count. **Why:** standalone MachiHub represents vault projects as buildings and has no vehicle/project-road model, while crane incidents are genuine adapter-derived evidence of active work. **Confidence:** high.
- **Decision:** Recompute the HUD and ticker from the currently visible Work/Personal lenses. **Why:** the summary should describe the town the user is looking at, and both-off mode should clear rather than retain stale counts. **Confidence:** high.

**Verified:** the standalone inline script compiles. Live browser testing against the 18-project snapshot produced 6 healthy / 3 cold / 0 busy / 42% storm; disabling Personal recalculated all visible-town totals, and disabling both lenses cleared the HUD/ticker and hid the canvas. All dynamic text enters through `textContent`; reduced-motion disables ticker animation. No adapters or shared-engine files changed.

**Files:** `Vibe_Coding/MachiHub/index.html`; `Thinking-Hub/AGENTS.md`

---

### ~~Priority 81C — Standalone MachiHub: genuine milestone celebrations~~ ✓ Done `[group: machi-town-parity]`
The standalone vault host now uses the canonical engine's `celebrate()` burst for two evidence-backed firsts: the live snapshot recovering from one or more cold projects to zero, and a live project first appearing at the reachable top tier. A transient text notice makes the milestone understandable even when reduced motion prevents the animation loop from running.

**Key decisions:**
- **Decision:** Persist only milestone dedupe/baseline state in `machi-milestones-v1`; do not persist environment controls. **Why:** recovery detection must compare live snapshots across page loads, while time/season are temporary visual previews. The key remains excluded from backup/sync as ephemeral UI state. **Confidence:** high.
- **Decision:** Never read or write milestone state for fallback sample data. **Why:** a blocked `file://` fetch must not create fictional accomplishments or contaminate the next real vault run. **Confidence:** high.
- **Decision:** Lens toggles and responsive rebuilds never run milestone evaluation. **Why:** visibility changes are not project-state changes and must not cause false recovery fireworks. **Confidence:** high.

**Verified:** the completed standalone inline script compiles; milestone evaluation is called only by a successful live-snapshot boot; both storage reads and writes fail safely; celebration notices use `textContent`. Live browser testing showed first-observation top-tier notices, then no repeat notice after reload, with no console warnings/errors. README and CLAUDE describe the environment, status, and milestone layers. No adapter or shared-engine files changed.

**Files:** `Vibe_Coding/MachiHub/index.html`, `README.md`, `CLAUDE.md`; `Thinking-Hub/AGENTS.md`

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
