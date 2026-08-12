# Thinking Hub — Personal Productivity Suite

<div align="center">

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-active-brightgreen)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-no_framework-f7df1e)
![No Build Step](https://img.shields.io/badge/build-none-lightgrey)
![Tools](https://img.shields.io/badge/tools-23-blueviolet)
![Obsidian](https://img.shields.io/badge/Obsidian-integrated-483699)
![Local First](https://img.shields.io/badge/data-100%25_local-3ecf8e)

*Think clearly, plan deliberately, decide confidently — 23 connected tools in one shell, no build step required.*

**[Open Thinking Hub](https://onuresen.github.io/Thinking-Hub/)**

</div>

---

## What is Thinking Hub?

Thinking Hub is a multi-tool personal productivity suite that runs entirely in the browser — no Node.js, no build step, no framework. A single shell (`index.html`) loads individual tools inside an `<iframe>` and they all share state through `HubStorage` (localStorage — **all data stays on your machine**).

> **"One shell. All the tools you actually need."**

It covers the full arc of knowledge work: capturing raw ideas, structuring projects, making decisions, running retrospectives, tracking OKRs, managing risks, and logging daily reflections. All tools talk to each other through a cross-linking system and a global Cmd+K search.

Works fully offline as an installable PWA. **Deliberately local-first:** application records stay in browser storage — there is no cloud database, third-party sync, account, telemetry, or analytics. Fonts, icons, and runtime libraries are self-hosted. Move data between machines with Full Backup export/import in ⚙️ Data & Backup. Optional AI can use a reviewed Microsoft Copilot copy/open handoff with no key or an explicitly triggered direct Anthropic request, subject to deployment policy.

For managed deployments, use a published [versioned release](https://github.com/onuresen/Thinking-Hub/releases) and verify its SHA-256 checksum. The canonical source version is in [`VERSION`](VERSION), with release impact recorded in [`CHANGELOG.md`](CHANGELOG.md).

---

## Tools

Tools are grouped by the kind of work they support.

### Daily Work

| Tool | What it does |
|------|-------------|
| **Project Hub** | Projects, tasks, roles, WIP-limited kanban, priority views, and cross-tool links |
| **Schedule** | Calendar and timeline views that sync due dates from Project Hub |
| **Meeting Hub** | Structured meeting notes with decisions, participants, and action items |
| **Capture Hub** | A fast inbox for notes, tasks, ideas, decisions, and references before triage |
| **Journal Hub** | Daily reflection, mood and energy patterns, Bullet Journal modes, and Feynman prompts |

### People & Network

| Tool | What it does |
|------|-------------|
| **Dependency Graph** | Visualize task dependencies, trace paths, filter orphans, and annotate edges |
| **People Hub** | See team roles and workload in one place, including who is over-allocated |
| **Stakeholder Map** | Power/interest mapping with PMBOK-aligned engagement levels |
| **Tool Portfolio** | Curate tools and vendors with Technology Radar rings and TOGAF layers |
| **Machi Hub** | Turn workspace activity into a living pixel city whose districts reflect your work |

### Learning & Ideas

| Tool | What it does |
|------|-------------|
| **Learning Hub** | Reading and learning records with Feynman-style key insights |
| **Idea Swiper** | Rapidly triage ideas into Like / Super / Nope and promote survivors into projects |
| **Spatial Canvas** | An infinite canvas for freeform notes, diagrams, and spatial thinking |

### Strategy & Decisions

| Tool | What it does |
|------|-------------|
| **Decision Hub** | Structured decisions with Cynefin domains, confidence, assumptions, alignment, and outcome calibration |
| **Goals Hub** | Quarterly OKRs with committed or aspirational key results and linked projects |
| **Risk Register** | Heat-map risk tracking with owners, treatments, and review dates |
| **Argument Hub** | Build Pyramid Principle arguments with SCQA, MECE support, and Markdown export |

### Reflection & Methods

| Tool | What it does |
|------|-------------|
| **Reflection Board** | Guided reviews and retrospectives across wins, blockers, patterns, and next actions |
| **Frameworks** | Experiment with visual methods including the blocked-work iceberg and V-Model process map |

### Tools & Focus

| Tool | What it does |
|------|-------------|
| **Time Journal** | Log what you worked on, review where time went, and optionally run a timer |
| **Profile** | Identity, milestones, badges, streaks, and an activity heatmap |
| **Tags** | A central topic registry with usage visibility and cross-tool rename support |
| **Help & Guide** | Tool directory, framework reference, and pre-built workflow guides |

### Built-in AI assistance

The floating AI assistant (`Ctrl+Shift+Space`) supports **capture**, **query**, and confirmation-gated **act** flows. Choose Microsoft Copilot handoff (no key) or Anthropic direct in ⚙️ Settings → Integrations.

> **AI boundary:** Microsoft Copilot handoff prepares and previews a prompt locally, then copies it and opens Microsoft 365 Copilot only after confirmation; Thinking Hub stores no Microsoft credential and submits nothing automatically. Anthropic direct remains optional: its key is plaintext browser localStorage and requests go directly to Anthropic. Current Full Backups strip the key and bulky Obsidian index. Organizations can allow only approved providers—or disable every AI surface—through `enterprise-config.js`. See [AI providers and Copilot handoff](docs/AI-PROVIDERS.md).

## Architecture

```
index.html  (shell — sidebar, home dashboard, iframe router, data/AI settings)
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
| `hub-vault-bridge.js` | Read-only vault-to-Hub proposal engine with explicit acceptance |
| `hub-tags.js` | Central tag/topic registry and cross-tool rename support |
| `hub-links.js` | Cross-tool linking via postMessage, picker modal, badges |
| `hub-search.js` | Global Cmd+K search — injected into shell only |
| `hub-tutorial.js` | Shell onboarding and workflow tour |
| `hub-toast.js` | Lightweight toast notifications |
| `hub-bootstrap.js` | Init coordinator — call last in each tool |
| `enterprise-config.js` | Deployment-owned policy; can disable every AI surface and call without browser storage |
| `hub-ai.js` | Optional AI assistant — direct Anthropic Messages API client, loaded by the shell and manual AI surfaces |
| `hub-snapshots.js` | IndexedDB rolling snapshots and point-in-time restore (shell only) |

Required order where applicable: `hub-storage.js` → `hub-utils.js` → `hub-starter-data.js` (shell only) → `hub-obsidian.js` → `hub-vault-bridge.js` → `hub-tags.js` → `hub-links.js` → `hub-search.js` (shell only) → `hub-toast.js` → `hub-bootstrap.js` → `enterprise-config.js` → `hub-ai.js` (manual AI surfaces).

---

## Key Features

### Cross-tool linking
Items across supported tools (projects, decisions, canvas nodes, meetings, risks, goals, and others) can be linked to one another. The `hub-links.js` picker opens with `Ctrl+L`, embeds links as badges, and navigates on click. It works entirely via postMessage — no server needed.

### Global Cmd+K search
`hub-search.js` indexes all tools' localStorage data and surfaces results in a fuzzy command palette. Selecting a result navigates to the tool and highlights the item.

### Obsidian vault integration
`hub-obsidian.js` uses the browser's File System Access API (`showDirectoryPicker()`) to read your vault folder directly — no backend, no Obsidian running. It indexes note titles, frontmatter, and tags for autocomplete. The optional **Vault Bridge** stays read-only: it turns vault signals into reviewable Hub proposals, and nothing changes until you explicitly accept an item.

### Scoped data export
Three export scopes from the ⚙️ Data & Backup modal:

| Scope | Contents | Restorable |
|-------|----------|-----------|
| **Full Backup** | All 29 registered data keys | ✓ Yes |
| **AI Context** | 16 high-signal keys (curated, noise-stripped) | Read-only |
| **Current Tool** | Active tool's key(s) only | Read-only |

### Local-only data (a feature, not a gap)
Application records live in your browser's localStorage, with automatic daily snapshots in IndexedDB for point-in-time restore. Thinking Hub has no application backend, accounts, cloud persistence, telemetry, or analytics. Cloud sync was prototyped once and intentionally removed. Optional AI is deployment-controlled: Anthropic direct is the only automatic application API egress; Microsoft Copilot handoff previews and copies locally, then opens Copilot only after user confirmation without automatic submission.

### Framework-grounded design
Each tool is mapped to one or more established frameworks:

| Framework | Tools |
|-----------|-------|
| Cynefin | Decision Hub |
| OKR | Goals Hub |
| GTD | Time Journal |
| Action Priority Matrix (Impact × Effort) | Project Hub |
| Assumption-Based Planning (RAND) | Decision Hub → Assumptions tab |
| Technology Radar (ThoughtWorks) | Tool Portfolio |
| TOGAF | Tool Portfolio |
| PMBOK Stakeholder Engagement | Stakeholder Map |
| Feynman Technique | Learning Hub, Journal Hub |
| Kanban WIP limits | Project Hub |
| Bullet Journal | Journal Hub |

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
theme.css               # Global CSS token source — dark/light/ink
hub-storage.js          # Storage adapter (localStorage, quota guard)
hub-utils.js            # Shared utilities (HubUtils.esc)
hub-obsidian.js         # Obsidian vault reader (File System Access API)
hub-vault-bridge.js     # Read-only vault signal proposals
hub-tags.js             # Central tags and cross-tool rename support
hub-links.js            # Cross-tool linking (postMessage + picker modal)
hub-search.js           # Global Cmd+K search
hub-toast.js            # Toast notifications
hub-bootstrap.js        # Init coordinator
hub-ai.js               # Optional AI assistant and provider handoffs
hub-snapshots.js        # IndexedDB point-in-time snapshots
hub-data.js             # Read API for project/task/member data

project-hub.html        # Project + task tracking
schedule.html           # Calendar / timeline
meetings-hub.html       # Meeting notes + action items
capture-hub.html        # Fast capture inbox
journal-hub.html        # Daily reflection and journal
idea-swiper.html        # Rapid idea triage (swipe)
decision-hub.html       # Decision log + assumptions + alignment matrix + calibration
argument-hub.html       # Pyramid Principle argument builder (SCQA, MECE, export)
canvas-hub.html         # Infinite spatial canvas
graph-hub.html          # Task dependency graph (vis-network)
people-hub.html         # People directory and follow-ups
town-hub.html           # Machi Hub living pixel city
focus-hub.html          # Time Journal + optional timer
reflection-hub.html     # Reviews and retrospectives
goals-hub.html          # OKR / quarterly goals
learning-hub.html       # Reading & learning log
stakeholder-hub.html    # Stakeholder power/interest grid
risk-hub.html           # Risk register
achievements-hub.html   # Profile (identity) + milestones & achievements
tags-hub.html           # Topic registry
frameworks-hub.html     # Framework reference
tool-portfolio.html     # Tool/vendor directory (Technology Radar)
help-hub.html           # Help, framework reference, workflow guides
```

---

## Design Principles

- **No build step, no npm** — open `index.html` and it works. Every tool is a single self-contained HTML file.
- **Shell + iframe** — the shell handles navigation, theming, local data and AI policy, and cross-tool state. Tools are isolated and load on demand.
- **Single CSS token source** — `theme.css` defines every color, font, radius, and z-index. No hardcoded hex values in tools. Dark (default), light, and ink themes are defined centrally.
- **postMessage for cross-tool communication** — tools never import each other directly. All coordination goes through the shell via `hub-navigate`, `hub-highlight`, `hub-project-active`, and `hub-links` messages.
- **Fail-safe storage** — every tool reads from `HubStorage` with a default fallback. Missing or corrupt keys don't break other tools.

## Enterprise-readiness foundation

- **Local-first and serverless** — no Thinking Hub backend, accounts, cloud persistence, telemetry, or analytics.
- **Offline-capable PWA** — the shell, tools, and pinned runtime libraries are precached for offline use.
- **Self-hosted runtime** — fonts, vis-network, and html2canvas are stored locally; optional Anthropic AI uses a small direct API client rather than a runtime SDK/CDN.
- **Deployment policy** — `enterprise-config.js` can allow only Microsoft Copilot handoff, only Anthropic direct, both, or no AI. Disabled providers fail before clipboard or network activity.
- **Content Security Policy** — all application pages restrict scripts, styles, fonts, images, frames, workers, forms, and connections to the documented boundary.
- **Automated safeguards** — GitHub Actions runs auto-discovered page smoke tests, service-worker coverage checks, and interaction flows on every pull request and push to `main`.
- **Data recovery** — full export/import, a read-only backup verifier, storage quota warnings, and IndexedDB point-in-time snapshots.
- **Secret-aware exports** — current Full Backups strip the Anthropic API key and bulky Obsidian index.
- **Accessibility baseline** — keyboard focus trapping, semantic modal/navigation attributes, and global reduced-motion support.

The current external-service boundary and architectural decisions are documented in [`CLAUDE.md`](CLAUDE.md). Published releases are immutable, checksummed snapshots; administrators can pin a reviewed version instead of following `main`.

### Security and deployment documents

- [Security policy and vulnerability reporting](SECURITY.md)
- [Privacy and network-egress statement](PRIVACY.md)
- [Enterprise deployment and administration guide](docs/DEPLOYMENT.md)
- [AI providers and Microsoft Copilot handoff](docs/AI-PROVIDERS.md)
- [Release, verification, and rollback process](docs/RELEASING.md)
- [Version history and security-relevant changes](CHANGELOG.md)
- [Third-party notices](THIRD-PARTY-NOTICES) and [CycloneDX SBOM](sbom.cdx.json)
- [Accessibility statement](docs/ACCESSIBILITY.md)
- [Security contact (`/.well-known/security.txt`, RFC 9116)](.well-known/security.txt)

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

More public projects: [Onur Esen's builder portfolio](https://onuresen.github.io/).
