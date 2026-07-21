# Thinking Hub — Personal Productivity Suite

<div align="center">

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-active-brightgreen)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-no_framework-f7df1e)
![No Build Step](https://img.shields.io/badge/build-none-lightgrey)
![Tools](https://img.shields.io/badge/tools-20%2B-blueviolet)
![Obsidian](https://img.shields.io/badge/Obsidian-integrated-483699)
![Local First](https://img.shields.io/badge/data-100%25_local-3ecf8e)

*Think clearly, plan deliberately, decide confidently — 20+ tools in one shell, no build step required.*

</div>

---

## What is Thinking Hub?

Thinking Hub is a multi-tool personal productivity suite that runs entirely in the browser — no Node.js, no build step, no framework. A single shell (`index.html`) loads individual tools inside an `<iframe>` and they all share state through `HubStorage` (localStorage — **all data stays on your machine**).

> **"One shell. All the tools you actually need."**

It covers the full arc of knowledge work: capturing raw ideas, structuring projects, making decisions, running retrospectives, tracking OKRs, managing risks, and logging daily reflections. All tools talk to each other through a cross-linking system and a global Cmd+K search.

Works fully offline as an installable PWA. **Deliberately local-first:** application records stay in browser storage — there is no cloud database, third-party sync, account, telemetry, or analytics. Move data between machines with Full Backup export/import in ⚙️ Data & Backup. Optional AI actions send the context shown for that action directly to Anthropic using a user-supplied API key; Google Fonts and favicon images are currently fetched from their documented external services.

---

## Tools

Tools are grouped by the phase of work they support.

### Thinking & Decisions

| Tool | What it does |
|------|-------------|
| **Idea Swiper** | Rapid triage — swipe ideas into Like / Super / Nope piles, send survivors straight to Project Hub |
| **Decision Hub** | Structured decision log with Cynefin domain tags, confidence scores, Assumption tracker, alignment matrix, revisit dates + outcome calibration |
| **Argument Hub** | Build a case top-down with the Pyramid Principle — SCQA intro, governing thought, MECE supporting pyramid, Markdown export |
| **Canvas Hub** | Infinite spatial canvas for freeform notes, diagrams, and sticky thoughts |
| **Assumption Tracker** | Assumption-Based Planning lanes (Assumed → Testing → Validated → Invalidated), accessible via Decision Hub |

### Planning & Execution

| Tool | What it does |
|------|-------------|
| **Project Hub** | Projects + tasks with member roles, WIP-limited kanban, priority matrix view, and cross-tool badges |
| **Schedule** | Calendar / timeline view that auto-syncs due dates from Project Hub |
| **Graph Hub** | Task dependency graph powered by vis-network — trace paths, filter orphans, annotate edges |
| **Risk Register** | Heat-map risk register with treatment plans, owners, and review dates |
| **Stakeholder Map** | Power/interest grid with engagement levels (PMBOK-aligned) |

### Review & Reflection

| Tool | What it does |
|------|-------------|
| **Weekly Review** | Structured weekly ritual — wins, blockers, next actions, energy check |
| **Retrospective** | Async team retro: Went Well / Improve / Actions |
| **Daily Log** | Private captain's log with mood heatmap, Bullet Journal mode chips, and Feynman learning prompts |
| **Focus Hub** | Pomodoro timer with GTD energy levels, context tags, and session history |
| **Profile** | Your identity (name, role, who-is-me) plus milestones, badges, streaks, and an activity heatmap |

### AI Assistant

| Tool | What it does |
|------|-------------|
| **AI Assistant** | Floating chat panel (bottom-right, `Ctrl+Shift+Space`) — three modes: **capture** (NL → structured item), **query** (ask anything about your workspace), **act** (propose multi-step changes with per-action confirm before applying). Add your Anthropic API key in ⚙️ Settings → Integrations. |

> **API key note:** The key is stored in plaintext in your browser's localStorage and sent directly to Anthropic from your browser. Nothing is stored on a Thinking Hub server. The app uses `dangerouslyAllowBrowser: true` in the Anthropic SDK — this is intentional for a local-first tool. Full Backups created by current versions strip the API key and bulky Obsidian index; do not share browser storage or pre-2026-06-17 backups without inspecting them first.

### Knowledge & Goals

| Tool | What it does |
|------|-------------|
| **Goals / OKR Hub** | Quarterly OKR tracking with 0.0–1.0 scoring, committed vs. aspirational key results, and project links |
| **Learning Log** | Reading and learning log with Feynman "explain it simply" key-insight field |
| **Meeting Notes** | Structured meeting notes with automatic action-item extraction |
| **Tool Portfolio** | Curated tool/vendor directory with Technology Radar rings and TOGAF architecture layers |
| **Help & Guide** | Tool directory, 37-framework reference, and 4 pre-built workflow guides |

---

## Architecture

```
index.html  (shell — sidebar, home dashboard, iframe router, cloud panel)
    │
    ▼
<iframe id="app-frame">  (one tool loaded at a time)
    │
    ▼
HubStorage  (localStorage — local-only by design)
    │
postMessage ◄────────────────────────────────────────────────────► hub-links.js
                              cross-tool linking, picker modal, badges
```

### Shared modules (load order is enforced)

| Module | Role |
|--------|------|
| `hub-storage.js` | Storage adapter — `get / set / subscribe`, quota guard |
| `hub-utils.js` | Shared escaping, focus, and record-timestamp utilities |
| `hub-starter-data.js` | First-run sample-data seeder (shell only) |
| `hub-obsidian.js` | Obsidian vault reader — File System Access API, index notes, autocomplete |
| `hub-tags.js` | Central tag/topic registry and cross-tool rename support |
| `hub-links.js` | Cross-tool linking via postMessage, picker modal, badges |
| `hub-search.js` | Global Cmd+K search — injected into shell only |
| `hub-tutorial.js` | Shell onboarding and workflow tour |
| `hub-toast.js` | Lightweight toast notifications |
| `hub-bootstrap.js` | Init coordinator — call last in each tool |
| `hub-ai.js` | Optional AI assistant — pinned Anthropic SDK, loaded by the shell and manual AI surfaces |
| `hub-snapshots.js` | IndexedDB rolling snapshots and point-in-time restore (shell only) |

Required order where applicable: `hub-storage.js` → `hub-utils.js` → `hub-starter-data.js` (shell only) → `hub-obsidian.js` → `hub-tags.js` → `hub-links.js` → `hub-search.js` (shell only) → `hub-toast.js` → `hub-bootstrap.js` → `hub-ai.js` (manual AI surfaces).

---

## Key Features

### Cross-tool linking
Items across supported tools (projects, decisions, canvas nodes, meetings, risks, goals, and others) can be linked to one another. The `hub-links.js` picker opens with `Ctrl+L`, embeds links as badges, and navigates on click. It works entirely via postMessage — no server needed.

### Global Cmd+K search
`hub-search.js` indexes all tools' localStorage data and surfaces results in a fuzzy command palette. Selecting a result navigates to the tool and highlights the item.

### Obsidian vault integration
`hub-obsidian.js` uses the browser's File System Access API (`showDirectoryPicker()`) to read your vault folder directly — no backend, no Obsidian running. Indexes note titles, frontmatter, and tags. Task and decision modals get live autocomplete suggestions.

### Scoped data export
Three export scopes from the ⚙️ Data & Backup modal:

| Scope | Contents | Restorable |
|-------|----------|-----------|
| **Full Backup** | All 28 registered data keys | ✓ Yes |
| **AI Context** | 13 high-signal keys (curated, noise-stripped) | Read-only |
| **Current Tool** | Active tool's key(s) only | Read-only |

### Local-only data (a feature, not a gap)
Application records live in your browser's localStorage, with automatic daily snapshots in IndexedDB for point-in-time restore. Thinking Hub has no application backend, accounts, cloud persistence, telemetry, or analytics. Cloud sync was prototyped once and intentionally removed. Optional AI actions are the exception: when explicitly triggered, they send selected workspace context directly to Anthropic with the user's API key. Fonts and favicon images currently use the external services described above.

### Framework-grounded design
Each tool is mapped to one or more established frameworks:

| Framework | Tools |
|-----------|-------|
| Cynefin | Decision Hub |
| OKR | Goals Hub |
| GTD | Focus Hub |
| Eisenhower Matrix | Project Hub (Priority Matrix view) |
| Assumption-Based Planning (RAND) | Decision Hub → Assumptions tab |
| Technology Radar (ThoughtWorks) | Tool Portfolio |
| TOGAF | Tool Portfolio |
| PMBOK Stakeholder Engagement | Stakeholder Map |
| Feynman Technique | Learning Log, Daily Log |
| Kanban WIP limits | Project Hub |
| Bullet Journal | Daily Log |

Full framework reference (37 frameworks) is available inside **Help & Guide**.

---

## Getting Started

This project runs entirely in the browser — no build step, no install required.

**Option A — Open directly (quickest)**
```
Double-click index.html
```
Open in Chrome, Edge, or Firefox. File System Access API features (Obsidian integration) require Chrome or Edge.

**Option B — Local static server (recommended)**
```bash
npx http-server -p 5500 .
# then open http://localhost:5500
```
Or with Python:
```bash
python -m http.server 5500
```

**First run**
1. The onboarding tour starts automatically on first open.
2. Create your first project in **Project Hub** to kick off the workflow tour (covers Schedule sync, Idea Swiper pipeline, Decision Hub, and Graph + Cmd+K).
3. Optional: pick your Obsidian vault folder via ⚙️ → Obsidian Vault to enable note autocomplete.

<details>
<summary>Keyboard shortcuts</summary>

| Key | Action |
|-----|--------|
| `Cmd/Ctrl+K` | Global search across all tools |
| `Ctrl+L` | Open cross-tool link picker (in any tool) |

</details>

---

## Directory Structure

```
index.html              # Shell — sidebar, iframe router, onboarding
theme.css               # Global CSS token source — dark/light, all variables
hub-storage.js          # Storage adapter (localStorage, quota guard)
hub-utils.js            # Shared utilities (HubUtils.esc)
hub-obsidian.js         # Obsidian vault reader (File System Access API)
hub-links.js            # Cross-tool linking (postMessage + picker modal)
hub-search.js           # Global Cmd+K search
hub-toast.js            # Toast notifications
hub-bootstrap.js        # Init coordinator
hub-data.js             # Read API for project/task/member data

project-hub.html        # Project + task tracking
schedule.html           # Calendar / timeline
idea-swiper.html        # Rapid idea triage (swipe)
decision-hub.html       # Decision log + assumptions + alignment matrix + calibration
argument-hub.html       # Pyramid Principle argument builder (SCQA, MECE, export)
canvas-hub.html         # Infinite spatial canvas
graph-hub.html          # Task dependency graph (vis-network)
focus-hub.html          # Pomodoro focus timer + GTD context
log-hub.html            # Daily captain's log
retro-hub.html          # Async retrospective board
review-hub.html         # Structured weekly review
goals-hub.html          # OKR / quarterly goals
meetings-hub.html       # Meeting notes + action items
learning-hub.html       # Reading & learning log
stakeholder-hub.html    # Stakeholder power/interest grid
risk-hub.html           # Risk register
achievements-hub.html   # Profile (identity) + milestones & achievements
tool-portfolio.html     # Tool/vendor directory (Technology Radar)
help-hub.html           # Help, framework reference, workflow guides
```

---

## Design Principles

- **No build step, no npm** — open `index.html` and it works. Every tool is a single self-contained HTML file.
- **Shell + iframe** — the shell handles navigation, theming, cloud config, and cross-tool state. Tools are isolated and load on demand.
- **Single CSS token source** — `theme.css` defines every color, font, radius, and z-index. No hardcoded hex values in tools. Both dark (default) and light themes are fully defined.
- **postMessage for cross-tool communication** — tools never import each other directly. All coordination goes through the shell via `hub-navigate`, `hub-highlight`, `hub-project-active`, and `hub-links` messages.
- **Fail-safe storage** — every tool reads from `HubStorage` with a default fallback. Missing or corrupt keys don't break other tools.

## Enterprise-readiness foundation

- **Local-first and serverless** — no Thinking Hub backend, accounts, cloud persistence, telemetry, or analytics.
- **Offline-capable PWA** — the shell, tools, and pinned runtime libraries are precached for offline use.
- **Pinned runtime libraries** — vis-network and html2canvas are self-hosted in `vendor/`; the Anthropic SDK is pinned to an explicit version while self-hosting is planned.
- **Automated safeguards** — GitHub Actions runs auto-discovered page smoke tests, service-worker coverage checks, and interaction flows on every pull request and push to `main`.
- **Data recovery** — full export/import, a read-only backup verifier, storage quota warnings, and IndexedDB point-in-time snapshots.
- **Secret-aware exports** — current Full Backups strip the Anthropic API key and bulky Obsidian index.
- **Accessibility baseline** — keyboard focus trapping, semantic modal/navigation attributes, and global reduced-motion support.

The current external-service boundary and remaining hardening work are documented in the enterprise-readiness roadmap in [`CLAUDE.md`](CLAUDE.md). The review documents below describe today's implementation; repository CSP, self-hosted remaining dependencies, and organization-level AI controls remain planned for Group C.

### Security and deployment documents

- [Security policy and vulnerability reporting](SECURITY.md)
- [Privacy and network-egress statement](PRIVACY.md)
- [Enterprise deployment and administration guide](docs/DEPLOYMENT.md)
- [Third-party notices](THIRD-PARTY-NOTICES)

---

## Contributing

Issues, ideas, and PRs are welcome.

- Keep tool files self-contained — no new shared dependencies without updating `hub-bootstrap.js` and the script load order in all HTML files.
- Use CSS variables from `theme.css` only — never hardcode hex values.
- Add new localStorage keys to the `EXPORT_KEY_LABELS` and `SCOPE_KEYS` maps in `index.html` so they appear in the export system.
- Update `CLAUDE.md` if you add a new tool, storage key, or architectural decision.

For AI-assisted development, see [`CLAUDE.md`](CLAUDE.md) for project conventions, file map, and script load order.

---

## License

Thinking Hub is licensed under the [Apache License 2.0](LICENSE). Third-party components and fonts remain under their own permissive licenses; see [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES).
