# Changelog

All notable changes to Thinking Hub are recorded here. Releases follow
[Semantic Versioning](https://semver.org/) from version 1.1.0 onward.

## [Unreleased]

### Removed

- Canvas PNG export no longer falls back to a visible-area capture on browsers that block full export (Safari). Use Chrome or Edge. The bundled html2canvas library is gone.
- Storage from deleted tools (KMQT Board, Argument Hub, Reflection Board, War Room, Scrum Board, Retro Board) is dropped from this browser after a safety snapshot, left out of backups, and skipped when an old backup is imported. The two retrospective achievements are gone.
- Project Hub Priority Matrix view. It copied every task in automatically and was not used. Its saved data stays in Full Backup.
- Settings → Local MCP Sync. Move data with Full Backup instead.
- Home: the Exec and Analytics tabs. Overview now shows the headline cards (Projects, OKRs, Risks), the tool cards and Pulse. The focus heatmap, tasks-per-week chart and capture breakdown are gone.
- Seven old standalone pages with no sidebar entry: Time Journal, Daily Log, Weekly Review, Retro Board, Assumptions, Priority Matrix and Blocked Depth. Their features live on as tabs in Journal Hub, Decision Hub and Project Hub. All saved data is kept and still restores from backups.
- The home Retro widget, which opened a page with no UI.

### Changed

- Canvas Hub: all exports are in one **Export ▾** menu (PNG, slides, interactive HTML, Markdown, Obsidian Canvas, board file). The board menu (⋯) is shorter. "Send lines" and "Pull lines" are one **Sync lines with Dependency Graph**.
- Phones: Dependency Graph and Machi Hub fit the screen (graph button bar scrolls sideways). Decision, Goals and Risk toolbars wrap, and the Project Hub detail panel fills the screen, so no button is cut off.

- Touch screens: buttons that only showed on hover (task actions, drag handles, edit/delete icons) are always visible, and buttons, chips and tabs are at least 40px.

- Project Hub Concept Matrix: concept columns are wider with names written flat (no tilt, no cut-off), the project column is fixed, and ∑ stays visible while scrolling.
- "Spatial Canvas" is now "Canvas Hub" everywhere (sidebar, Help, Machi, README). The tool id and saved data are unchanged.

### Added

- Canvas Hub color key: board menu (⋯) → **Color key…** names what each color means on that board. A small key shows the named colors and the line types the board uses. Click a color to light up its cards. The card color menu lists colors by name. The key goes into PNG, slides, interactive HTML, Markdown, board files, duplicates and templates. The Capability Map template comes with one.
- Canvas Hub: paste a table (Markdown, or cells copied from Excel). Each header becomes a column layer and each cell a card, with rows lined up. One undo step. Right-click → Paste outline / table…, or Ctrl+V on the canvas.
- Canvas Hub: hover a card to light up its own lines. Other lines fade and the cards at the other end get an outline. Mouse only; nothing changes on touch or in exports.
- Canvas Hub on phones: one finger pans, two fingers pinch-zoom, tap selects, double-tap on empty canvas makes a note, hold opens the right-click menu, and a selected card can be dragged. The bottom bar scrolls sideways instead of running off the screen, menus stay on screen, and buttons are bigger on touch screens. Desktop is unchanged.
- Canvas Hub tags: **🏷 Tags** highlights cards by tag. Matches glow, the rest soften, and nothing is hidden. Lines stay as they are, and lines between two matches get thicker. Pick several tags to highlight any of them. Works on project, decision and meeting cards; task and goal cards use their project's tags. **Layout → By tag** (or Group by tag in the Tags menu) makes one block per shared tag, each in a labelled frame. One undo step.
- Project tags now work as chips with suggestions. Type to see existing tags (most used first), press Enter to pick one or create a new one. "Shop-drawing" suggests the existing "Shop drawing". Typing a comma also adds the tag.
- Tool Portfolio: upload your own icon for a tool (stored locally, resized to 64px). Sites on github.io, gitlab.io, pages.dev, netlify.app and vercel.app now show the tool's emoji instead of Google's generic globe.
- Canvas Hub Connect mode: a dashed line now follows the cursor from the armed source card, so you can see the connection while you draw it.
- Schedule day tags: Telework 💻, Seminar 🎤 and Training 🎓, next to Out of Office, Business Trip, Public Holiday and Day Off. Saved days keep working.
- Project tags: Project Hub → project Settings → Tags. They show in Tags Hub (as "Project Hub"), as tag nodes in the Dependency Graph, and in the Overview search.
- Project Hub vault note (⟡): link a project to its Obsidian note once. Its open checkboxes are offered as tasks, and boxes ticked there offer to mark the task done. Nothing is added until you press Add. Ignored items stay hidden.
- Meeting Hub vault note (⟡): link a meeting (or one week of a series) to its Obsidian note, suggested by the meeting date. Its decisions go to Decision Hub and its asks become action items.
- Dependency Graph "💡 Suggested": items that name a project but aren't linked to it. Link or Ignore each one.
- Machi Hub: tool buildings come alive. Learning Hub is a library (a floor per finished item, lamps for key insights). Capture Hub is a post office (mail sacks; vans leave when the inbox shrinks). Meeting Hub has a bus stop (weekly meetings are buses on their day, one-offs are taxis). Spatial Canvas is an art studio (an easel per board). Pigeons carry Dependency Graph links between tools. Clicks sparkle.
- Canvas Hub speaker notes: right-click a frame → Add speaker notes. They show under the frame in Present mode. N hides them. Not included in PNG exports.
- Canvas Hub "Export frames as slides": one 2× PNG per frame, in Present order, in one .zip with a `slides.md` of titles and notes.
- Canvas Hub "Export interactive HTML": one self-contained file with zoom, pan, clickable cards with connections, and frame stepping. It makes no network requests. Speaker notes are included only if you say yes.
- Spatial Canvas: board templates. "+" offers five built-in layouts
  (Wardley, Capability, Dependency, Enterprise, R&D Transformation) and
  your own templates saved from any board. A System map board is built
  from the hub (goals → projects → tools, one row per project group) and
  can be rebuilt. Dependency Graph links can be pulled onto a board.

- Spatial Canvas: Expand a project card into its open tasks, goals,
  decisions, open risks, meetings and stakeholders, each joined by a line.
  Paste a Markdown outline or a Mermaid flowchart to create cards and lines.
  Layout → Flow arranges cards along their lines (left to right or top down).

- Spatial Canvas: live cards for tasks, decisions, risks, meetings and
  stakeholders, next to projects, goals and tools. Right-click a note to make
  it a real task, decision or risk. Project Hub and Tool Portfolio show which
  boards an item sits on. A line between two live cards can be sent to the
  Dependency Graph as a real link.

- Spatial Canvas: export and import Obsidian Canvas (`.canvas`, JSON Canvas
  1.0) files. Frames and layers become groups; lines keep arrows and labels.

- Spatial Canvas: column and row layers. A layer is a named band that runs
  across the whole board. Its name stays pinned to the screen edge while you
  scroll, like frozen spreadsheet headers. Layers are a visual guide only;
  they never move nodes.

- Spatial Canvas: Jump menu, saved views and present mode. Jump goes to any
  frame, layer or saved view. Shift+1–9 saves the current view; 1–9 jumps
  back. Present steps through frames in reading order (or saved views when a
  board has no frames), with the toolbars hidden. Esc returns to where you were.

- Spatial Canvas: Undo/Redo for node and connection edits (Ctrl+Z / Ctrl+Y,
  plus toolbar icon buttons), scoped per board and coalesced to one entry
  per drag/resize/text-edit gesture rather than every intermediate change.

- **Vault Bridge** — the Obsidian integration can now read the vault as a
  source, not only open notes from it. After connecting a vault folder,
  Thinking Hub reports days your vault has a daily note for but the workspace
  has no record of, and offers any decisions written in the canonical
  Decision / Why / Alternative / Revisit-when / Confidence schema as a review
  queue. Nothing is imported until you accept an individual proposal, and
  accepted records link back to the source note. The selected directory is
  remembered between sessions so access can be re-granted with one click
  instead of picking the folder again. Reading is local and read-only: no note
  content leaves the browser, and the vault is never written to. The feature
  requires the File System Access API (Chromium-based desktop browsers) and is
  hidden where it is unavailable. New storage key `hub-vault-bridge-v1` is
  included in Full Backup, because it records which proposals were already
  accepted or ignored.

### Changed

- Spatial Canvas: Export PNG now saves the whole board, not just the visible
  screen, at 2× resolution whatever the zoom. It uses the browser's own
  renderer, so fonts, colors, frames, layers and line labels match the canvas.
  Layer names get their own margin. Browsers that block this fall back to the
  old visible-area capture.
- Spatial Canvas: drag on empty canvas now draws a selection box. Pan with
  right-drag, middle-drag or Space+drag. A right-click without moving still
  opens the menu.

- Tool Portfolio and Stakeholder Map fetch favicons again for records with a
  URL set (falling back to the local emoji/initials icon on failure),
  reversing a P93 zero-egress decision at the user's request. Pages other
  than these two remain favicon-fetch-free.
  `img-src` in the shared Content-Security-Policy now allows
  `https://www.google.com` and `https://*.gstatic.com` on every page to keep
  one CSP contract app-wide. Both hosts are required: Google's favicon
  endpoint redirects to a per-domain `gstatic.com` shard, and CSP is enforced
  against redirect targets, so allowing only the entry host blocks every icon.

### Fixed

- Machi Hub: the Portfolio legend said adopt/trial/assess/hold, but buildings are colored by status. It now reads using/piloting/exploring/retired.
- Machi Hub: retired Portfolio tools no longer catch fire for going unused.
- Machi Hub: the Civic landmarks now update live when decisions or Vault Bridge change.

- Tool Portfolio, Decision Hub, and Idea Swiper no longer render blank when
  their stored data has an unexpected shape (bad import or hand-edited
  storage). Each now normalizes the value to an array on read and shows its
  normal empty state instead of failing silently with a console error.
- Spatial Canvas: a node positioned underneath the floating toolbar or board
  bar was completely unclickable — those bars occupied their full
  rectangular area (including the gaps between buttons), silently
  intercepting clicks meant for a node beneath them. This was the real cause
  of persistent "Connect does nothing" reports once a board filled up
  through normal use. Both bars now only capture clicks on their actual
  buttons.

## [1.2.0] - 2026-07-22

### Added

- Provider-neutral AI configuration with a no-key Microsoft Copilot handoff:
  Thinking Hub previews the exact prompt, then copies it and opens Microsoft
  365 Copilot only after confirmation; no Microsoft API, token, or automatic
  submission is involved.
- Deployment-owned AI provider allowlist and reviewer documentation covering
  Copilot handoff, Anthropic direct, disabled mode, privacy, and deferred direct
  Microsoft API/Copilot Studio integration.
- Machine-readable security contact at `/.well-known/security.txt` (RFC 9116).
- A CycloneDX Software Bill of Materials (`sbom.cdx.json`) inventorying the
  pinned runtime and development dependencies.
- An accessibility statement (`docs/ACCESSIBILITY.md`) documenting the current
  WCAG posture and known limitations.
- Project One-Pager: a printable / copy-as-Markdown per-project brief that
  aggregates open tasks, milestones, goals, decisions, risks, upcoming
  meetings, and stakeholders onto a single page (📄 in the project panel).
- Pulse section in the home Analytics view: completed-task throughput plus a
  "what's going stale" readout (untouched open tasks, quiet projects,
  decisions overdue to score) built on the record-timestamp base.

### Changed

- Refreshed the app identity to the golden network-hub mark: the browser tab
  favicon, in-app sidebar logo, welcome header, and all PWA install icons now
  share the same design. Added 16px/32px favicons and an apple-touch-icon.
- Repurposed the Focus Timer into a **Time Journal**: the primary flow is now
  logging a work block after the fact (task, duration, energy, context, note)
  with a running daily total, while the Pomodoro countdown is kept as an
  optional collapsed section. Existing session data and the ⏱ time badges are
  unchanged. Fixed a latent missing-toast-module bug in the same tool.

### Security

- Made the Anthropic API-key field's plaintext-at-rest and shared-device risk
  explicit in the Settings panel (the key input was already masked).

## [1.1.0] - 2026-07-21

### Added

- Apache-2.0 licensing, third-party notices, and reviewer-facing security,
  privacy, and enterprise deployment documentation.
- A deployment-owned `enterprise-config.js` policy that can hide all AI
  surfaces and reject AI calls before a network request is created.
- A consistent Content Security Policy across every application page.
- Self-hosted font assets and automated checks for runtime egress, CSP,
  release metadata, offline coverage, backup fidelity, and core user flows.
- A repeatable tagged-release workflow that validates, packages, checksums,
  and publishes the reviewed source version.

### Changed

- Replaced the former TH-letter PWA icon and unrelated lightbulb favicon with
  the Convergence mark: three thoughts joining into a clear insight spark.
- Replaced the runtime Anthropic SDK/CDN with a small direct Messages API
  client while preserving the existing opt-in behavior.
- Removed Google Fonts and remote favicon requests; fonts and icons now remain
  local to the deployment.
- Made enterprise policy retrieval network-first while online, with cached
  fallback for offline use.
- Expanded Full Backup safety and verification to cover every registered data
  key while excluding the Anthropic key and bulky Obsidian index.

### Security

- Reduced normal runtime egress to same-origin resources. The only optional
  application destination is `api.anthropic.com`, when both deployment policy
  and the user permit an explicit AI action.
- Documented the plaintext browser-local API-key limitation, shared-profile
  boundary, deployment responsibilities, and current CSP `unsafe-inline`
  limitation.

## [1.0] - 2026-05-31

First tagged project snapshot. This historical tag predates the formal
release process, Semantic Versioning policy, and enterprise review package.

[Unreleased]: https://github.com/onuresen/Thinking-Hub/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/onuresen/Thinking-Hub/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/onuresen/Thinking-Hub/releases/tag/v1.1.0
[1.0]: https://github.com/onuresen/Thinking-Hub/releases/tag/v1.0
