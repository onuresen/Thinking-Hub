# Thinking Hub — Claude Context

Short on purpose. Full priority history (P1–P157, every decision and verification note): `docs/HISTORY.md`. Grep it when you need the "why" behind old code.

## What this is
Multi-tool personal productivity web app for one user. **No build step, no Node.js.** Pure HTML/CSS/JS loaded directly in the browser. `index.html` (shell) loads each tool in `<iframe id="app-frame">`; tools share state through `HubStorage` (localStorage).

## ⛔ Standing decision: NO cloud sync (P84)
The app holds **confidential work data**. No Supabase, Firebase or any server persistence, telemetry, or feature that sends user data to a server. Supabase was built once and deliberately removed. Fonts and libraries are self-hosted. Optional AI is deployment-controlled: Anthropic direct is the only automatic API egress; Copilot handoff only previews/copies locally and opens a browser tab after confirmation. Durability is local: Full Backup export/import + IndexedDB snapshots (`hub-snapshots.js`). Hub backups never go into the esen-vault repo (it gitignores them).

## File map
Sidebar tools (19, must match `APPS` in `index.html` and `HUB_PAGES` in `town-hub.html` — smoke-tested):

| File | Role |
|------|------|
| `project-hub.html` | Projects + tasks. Views: Overview, Groupings, All Tasks, Milestones, Goals, Concept Matrix. Kanban, One-Pager, linked vault note review |
| `schedule.html` | Calendar (month / hourly week grid with drag-resize) + timeline. Shows meetings |
| `meetings-hub.html` | Meetings: type templates, attendee roles, decision register, weekly series, .ics import, linked vault note review |
| `capture-hub.html` | Brain-dump inbox with routing to other tools. Also the PWA share target |
| `journal-hub.html` | Tabs: Daily Log (`log-hub-v1`), Weekly Review (`review-hub-v1`), Time Journal (`focus-hub-v1`) |
| `graph-hub.html` | Dependency graph (vis-network): critical path, reasoning/impact trace, shortest path, suggested links, tag nodes |
| `people-hub.html` | Member roster, org tree, load matrix, "Me View" |
| `stakeholder-hub.html` | Organizations roster (default) + Power/Interest grid |
| `tool-portfolio.html` | Tool directory: radar ring, Freshness × Mastery matrix, own icon upload |
| `town-hub.html` | Machi Hub — pixel city from hub data. Fun, not insight (see below) |
| `learning-hub.html` | Reading & learning log |
| `idea-swiper.html` | Swipe triage of ideas |
| `canvas-hub.html` | Canvas Hub — boards, live cards, frames, layers, color key. See "Canvas Hub" below |
| `decision-hub.html` | Decision log + Assumptions tab (`assumptions-hub-v1`) + Calibration |
| `goals-hub.html` | OKRs by quarter |
| `risk-hub.html` | Risk register + heat map |
| `achievements-hub.html` | Profile (identity) + achievements |
| `tags-hub.html` | Central tag registry: rename, merge, delete everywhere |
| `help-hub.html` | Help & Guide: tool cards, framework reference, workflows |

Shared modules and other files:

| File | Role |
|------|------|
| `index.html` | Shell: sidebar, home (Today · Overview), iframe router, Settings (AI, Obsidian/Vault Bridge, snapshots, backup), Cmd+K |
| `theme.css` | **Only** global CSS — every tool uses its tokens. Dark + light + ink themes |
| `hub-storage.js` | `get/set/subscribe` + quota guard. Loads first |
| `hub-utils.js` | `esc`, `trapFocus`, timestamp helpers (P90), local-day helpers (P126), AI visibility pref (P109) |
| `hub-data.js` | Read API for `project-hub-v1` (`getProjects`, `getProjectsSorted` for grouped lists only) |
| `hub-links.js` | Cross-tool links, picker, `resolveItems(tool)`, `suggestLinks`, canvas placements |
| `hub-tags.js` | Tag registry + `TAG_SOURCES` (every tool with `tags`) + `attachTagInput` chip input |
| `hub-search.js` | Cmd+K search + quick actions (`task:`, `capture:`, `decide:`, `focus`) |
| `hub-obsidian.js` | Vault index for note autocomplete |
| `hub-vault-bridge.js` | Vault Bridge (P104): persisted vault handle, unrecorded-day scan, decision-block parser, propose/accept queue |
| `hub-vault-notes.js` | Linked-note review dialog (P138) for Project Hub + Meeting Hub |
| `hub-snapshots.js` | Daily IndexedDB snapshots of all localStorage + restore |
| `hub-starter-data.js` | First-run sample data |
| `hub-tutorial.js`, `hub-toast.js`, `hub-bootstrap.js` | Tour, toasts, init (call last) |
| `enterprise-config.js` + `hub-ai.js` | Immutable AI policy + provider-neutral AI (Anthropic direct, Copilot handoff) |
| `machi-engine.js`, `machi-achievements.js` | ⚠ STAMPED COPIES from `Vibe_Coding/MachiHub` — edit there. Local `setDecorator()` (P140) not yet upstream |
| `machi-fun.js` | Thinking-Hub-only Machi decorations (library, post office, bus stop, studio, pigeons) |
| `sw.js` | Service worker, stale-while-revalidate. ⚠ New app files go in `PRECACHE`; bump `CACHE` for bigger changes |
| `styles/` | `fonts.css` + extracted CSS for index, project-hub, idea-swiper, schedule, meetings-hub |
| `vendor/` | `vis-network.min.js` 9.1.9 + OFL font subsets |
| `tests/` | Dev-only Node + Playwright: `smoke.js` (every page, CSP, egress, PRECACHE, shell), `flows.js`, `vault-bridge.js`. Run `npm test` in `tests/`; CI runs all three |
| `VERSION`, `CHANGELOG.md`, `docs/RELEASING.md`, `.github/workflows/release.yml` | Release contract (tag = `v` + `VERSION`) |
| `SECURITY.md`, `PRIVACY.md`, `docs/DEPLOYMENT.md`, `docs/AI-PROVIDERS.md`, `docs/ACCESSIBILITY.md`, `THIRD-PARTY-NOTICES`, `sbom.cdx.json`, `.well-known/security.txt` | Reviewer package |
| `favicon.svg`, `icons/`, `manifest.json`, `scripts/render-icons.js` | App identity + PWA |

Deleted tools (code in git history, data handling in `docs/HISTORY.md`): KMQT Board, Scrum Board, War Room, Reflection Board, Argument Hub, Frameworks, Blocked Depth, standalone Daily Log / Weekly Review / Time Journal / Retro / Assumptions / Priority Matrix pages, Priority Matrix view, Local MCP Sync.

## Script load order (required)
`hub-storage.js` → `hub-utils.js` → `hub-starter-data.js` (index.html only) → `hub-obsidian.js` → `hub-vault-bridge.js` (index.html, project-hub, meetings-hub) → `hub-vault-notes.js` (project-hub, meetings-hub) → `hub-tags.js` (tools with tag inputs + `tags-hub.html`) → `hub-links.js` → `hub-search.js` → `hub-toast.js` → `hub-bootstrap.js` → `enterprise-config.js` → `hub-ai.js` (last two on index.html + tools with a manual AI feature)

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
Backed up (`SCOPE_KEYS.full` in `index.html`): `project-hub-v1`, `goals-hub-v1`, `decision-hub-v1`, `review-hub-v1`, `risk-hub-v1`, `meetings-hub-v1`, `assumptions-hub-v1`, `schedule-v1`, `learning-hub-v1`, `matrix-hub-v1` (no UI since P155, data kept), `stakeholder-hub-v1`, `focus-hub-v1`, `log-hub-v1`, `canvas-v1`, `ideaswipe_history_v6`, `hub-links-v1`, `hub-activity-v1`, `hub-settings-v1` (API key stripped on export), `tool-portfolio-v1`, `hub-tags-v1`, `capture-hub-v1`, `people-hub-v1`, `hub-vault-bridge-v1` (its `seen` map dedupes imports, so it must be backed up).

Not backed up (ephemeral UI state): `hub-session-v1`, `th-theme`, `tutorial-seen-v1`, `quick-tour-seen-v1`, `hub-resurface-v1`, `hub-last-backup-v1`, `hub-briefing-v1`, `ai-drawer-pos-v1`, `machi-milestones-v1`.

Retired (P157, `RETIRED_KEYS`): `kmqt_current_v2`, `argument-hub-v1`, `reflection-hub-v1`, `hub-warroom-v1`, `scrum-hub-v1`, `retro-hub-v1`, `rb-*`. Dropped from the browser once after a `retired-keys` snapshot; skipped on import.

Adding a key: add it to `SCOPE_KEYS.full` and `EXPORT_KEY_LABELS`. `tests/flows.js` round-trips every full-backup key.

## Runtime dependencies
| Component | Used in | Source |
|-----|---------|---------|
| DM Sans, Fraunces, JetBrains Mono, Syne | All pages via `styles/fonts.css` | Self-hosted WOFF2 + OFL in `vendor/fonts/` |
| vis-network 9.1.9 | graph-hub.html | `vendor/vis-network.min.js` |
| Anthropic Messages API | Manual AI features | Direct fetch in `hub-ai.js`, no SDK |
| Microsoft 365 Copilot | Manual AI features | Preview → clipboard → open tab. No API |

## What NOT to do
- **Do not add cloud sync or any server-side persistence** — standing P84 decision (confidential work data); see the ⛔ section at the top
- Do not add new color hex values — extend `theme.css` tokens instead
- Do not use `var(--font-m)` — it doesn't exist, use `var(--font-mono)`
- Do not use `color-mix()` without a fallback property above it
- Do not break `hub-storage.js` load order
- Do not hardcode colors in JS-injected CSS strings
- Do not load runtime libraries or fonts from a CDN; keep the P93 zero-egress boundary. Favicon fetches are allowed only in Tool Portfolio, Stakeholder Map and Canvas Hub (P101–P112; smoke-tested)
- Do not bypass `ThinkingHubPolicy.aiEnabled` or `allowedAiProviders`; every AI surface needs `.ai-surface` and every operation must go through guarded `HubAI`
- Do not add a Microsoft/Direct Line/Graph secret to browser code. Direct Copilot APIs stay deferred until an explicitly approved identity/backend architecture exists.
- Do not use `var(--font-b)` or `var(--font-d)` (undefined aliases) — use `var(--font-body)` / `var(--font-display)`

## ⏱ Timestamp convention (P90)
Every persisted **record** should carry a consistent lifecycle-timestamp trio so cross-tool "outdated / busy / stale" insights have a stable base to read. Use the shared helpers in `hub-utils.js` — never hand-roll `new Date().toISOString()` per field:
- `HubUtils.stampCreate(o)` — set **once** on a brand-new record (`createdAt`). Never overwrites.
- `HubUtils.stampUpdate(o)` — bump `updatedAt` on every meaningful edit (best-effort backfills `createdAt`).
- `HubUtils.stampArchive(o, archived)` — sets `archived` + `archivedAt` (cleared on un-archive).
- `HubUtils.relativeAge(iso)` / `daysSince(iso)` — for age badges + staleness thresholds.

**Cardinal rule: never fabricate `createdAt` for pre-existing records.** Missing timestamp = *unknown age*, which must NOT be treated as "stale" (would flood the Resurface widget / Health Check with every legacy record). Staleness features only surface items that carry a real timestamp, so they "activate" naturally as records get stamped going forward. Stamp at the mutation site (where the record object is in hand), not centrally in a `save()` that doesn't know which record changed.

## Shared UI primitives (already in theme.css — reuse, don't duplicate)
`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input/.select/.textarea`, `.label`, `.empty-state`, `.ui-modal-overlay / .ui-modal`, `.ui-section-header / .ui-section-title / .ui-section-line`, `.ai-badge`


## 📅 Local day (P126)
"Today" is the **local** day. Use `HubUtils.todayLocal()` / `localYmd(date)` / `isoToLocalDay(iso)`. Never `toISOString().slice(0,10)` — in Tokyo that is yesterday until 09:00. Compare local days with local days on both sides.

## ⚠ AI feature marker convention (P86)
**Every control that invokes an AI provider MUST carry the `.ai-badge` marker** — a small coral `✦ AI` pill (theme.css, uses `--accent2`) with provider-aware guidance. This is a standing convention so external processing or token/cost implications are never a surprise. Current AI surfaces all carry it: the shell AI drawer, Today Briefing, Journal Draft, and Focus Energy Insights. Any new AI control must add the badge and route through `HubAI`; Copilot handoff must preview before clipboard/navigation, while Anthropic direct must remain explicit and key-aware.

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
- **Keep docs in sync.** Each shipped item gets a short entry at the top of `docs/HISTORY.md` (Priority number, what, key decisions, files). Update this file only when a rule, the file map or the key list changes.
- **Record decisions, not just outcomes.** When a completed item involves a non-obvious choice (a tradeoff, a "why this approach over the alternative", a convention that future work should follow or avoid), add a **"Key decisions"** bullet list under that backlog entry — one line per decision, framed as *what was chosen* + *why* (not just what changed). Skip this for purely mechanical changes (typo fixes, simple wiring) where the "why" is self-evident. This is what lets future sessions reuse reasoning instead of re-litigating it.
- **Search for existing bindings before adding shortcuts.** Grep for the key combo across all HTML files to avoid collisions.
- **Always edit the main project files, never the worktree copies.** Worktrees live at `.claude/worktrees/*/` — these are isolated git branches for sandboxed work and changes there do NOT affect the real app. Always confirm you are editing `C:\Users\onure\Documents\GitHub\Thinking-Hub\*.html` (or equivalent), not a path containing `.claude/worktrees/`.

---


## Key decisions that still bind
- **Build for the solo user.** Ask "would one person open this weekly?" Team-cadence tools (War Room, Scrum) were built and deleted. Board-shaped "thinking boards" (KMQT, Reflection) never stuck.
- **Lean (P152–P157, Onur 2026-10-06):** keep code and flows lean. Prefer removing a surface over adding one. Keep the AI layer and Journal/Schedule hubs for now.
- **Delete the code, keep the data** for one release, then retire the keys with a snapshot (P157 pattern).
- **Propose, never auto-import** anything parsed from vault prose (P104, P138).
- **Missing timestamp = unknown age, never stale** (P90).
- **One CSP for every page** (P93). Favicon egress only in the three opted-in pages.
- **Rejected, don't re-propose:** Stakeholder Map inside Project Hub; People Hub → Profile; multi-device folder sync (P84).
- **Parked:** Workspaces (Model A, in-browser switcher). Do not start until Onur asks.
- **Test UI with real mouse timing** (`mouse.down` → 80 ms → `mouse.up`), not `page.click()`. Six Canvas Connect bugs hid behind synthetic clicks (P113–P124).

## Canvas Hub (most-edited file)
- `canvas-v1 = { boards: [{ id, name, nodes, edges, lanes, views, colorKey, panX, panY, zoom }], activeBoardId, templates, snapToGrid, dimParked }`. `db` is a live reference to the active board.
- Node kinds: note, rd, frame, and live cards (`LINKED` table: project, goal, tool, task, decision, risk, meeting, stakeholder) with `link: {tool, id, label}`. Status is read fresh at render; only the link is stored.
- Edges: `{from, to, relType: relates|blocks|depends-on, label}`. Frames are nodes. Layers (`lanes`) are visual guides, never containers.
- Menus: right-click via `gateMenu()`; popovers close on capture-phase `mousedown`. Every content change is one undo step (`pushHistory`).
- Bottom bar: Undo/Redo, Zoom, Reset, Connect, Layout ▾, Tags, Jump ▾, Export ▾. Board menu (⋯): Duplicate, Sync with graph, Color key, Template, Paste outline/table, Import.
- PNG export uses SVG `foreignObject` (`buildExportScene`). No fallback since html2canvas was removed (P156).
- Imported board files are untrusted: note HTML is cleaned with an allowlist.

## Machi Hub
Built by a Codex agent (history in `docs/HISTORY.md`). **For fun, not insight** (Onur, 2026-10-01): add playful, data-driven life; no stats or dashboards. Buildings burn only on evidence of neglect (real `lastUsedAt` ≥ 60 days). `machi-milestones-v1` stays out of backups.

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

