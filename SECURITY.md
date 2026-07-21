# Security Policy

Thinking Hub is a local-first, static web application. It has no application
server, user accounts, cloud database, telemetry, or analytics. This reduces
the remote attack surface, but it does not remove browser, deployment,
dependency, local-device, or optional AI risks.

## Supported versions

Until versioned releases begin, security fixes target the latest commit on
`main`. Older commits, forks, downloaded copies, and modified deployments are
not maintained by this project. Versioned support information will replace
this section when the release process is introduced in Enterprise Group D.

## Reporting a vulnerability

Please do not open a public issue containing exploit details, credentials,
confidential workspace data, or a proof of concept that could put users at
risk.

1. Prefer GitHub's private vulnerability-reporting form:
   `https://github.com/onuresen/Thinking-Hub/security/advisories/new`
2. If that form is unavailable, contact the maintainer through
   `https://github.com/onuresen` with only a short, non-sensitive request for a
   private reporting channel. Do not include exploit details in a public issue
   or discussion.

Include, when safe to do so:

- the affected commit, deployment URL pattern, and browser version;
- the impact and prerequisites;
- minimal reproduction steps using synthetic data;
- whether the issue involves localStorage, IndexedDB, Cache Storage, backup
  import/export, File System Access, the service worker, or optional AI calls;
- suggested mitigations, if known.

Reports are handled on a best-effort basis. This community project does not
currently promise a response or remediation SLA. Confirmed issues will be
coordinated privately until a fix or safe disclosure plan is ready.

## Security architecture

### Data boundary

- Workspace records are stored under the deployment origin in browser
  `localStorage`.
- Rolling point-in-time snapshots are stored under the same origin in
  IndexedDB.
- The service worker stores application assets and Google Font responses in
  Cache Storage.
- There is no Thinking Hub backend, account, remote persistence, telemetry, or
  analytics endpoint.
- Full Backups are generated locally as JSON downloads. Current exports remove
  the Anthropic API key and the locally generated Obsidian index.

Browser storage is not encryption. Any person, extension, script, or process
that can access the same browser profile and origin may be able to read it.
Thinking Hub workspaces do not currently provide authentication, user
isolation, or access control. On shared devices, use separate managed OS or
browser profiles.

### Optional AI boundary

The Anthropic integration is opt-in and requires a user-supplied API key. The
key is stored in plaintext localStorage. When an AI action is explicitly
triggered, Thinking Hub loads a pinned Anthropic SDK from `esm.sh` and sends a
request directly from the browser to Anthropic. Depending on the feature, that
request can include the user's prompt and selected context derived from
projects, tasks, people, decisions, risks, goals, meetings, schedule, learning,
reflection, assumptions, stakeholders, journal, focus, capture, and links.

AI-generated changes are proposed for user confirmation before application,
but AI output must still be treated as untrusted. Organizations that do not
approve external AI should not configure an API key and should block
`esm.sh` and `api.anthropic.com` at the network layer until the planned
organization-level AI control ships in Enterprise Group C.

### Local-file access

Obsidian integration requests read-only access through the browser's File
System Access API after an explicit directory-picker action. MCP file sync
requests read/write directory access after an explicit picker action. Browser
permission indicators and the selected directory define that boundary.
Thinking Hub does not upload selected files to its own server.

### Supply chain and browser controls

- `vis-network` and `html2canvas` are pinned and distributed from `vendor/`.
- The Anthropic SDK is version-pinned but currently fetched from `esm.sh`.
- Fonts are currently fetched from Google Fonts.
- Third-party attributions are recorded in `THIRD-PARTY-NOTICES`.
- CI runs page smoke checks, service-worker precache coverage, and interaction
  flows on pushes to `main` and pull requests.
- A repository Content Security Policy and self-hosted remaining runtime
  dependencies are planned for Enterprise Group C.

## Operator responsibilities

Deployment operators are responsible for HTTPS, access to the hosting origin,
web-server logs, browser/device management, network allowlists, backup policy,
and compliance with their organization's rules. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`PRIVACY.md`](PRIVACY.md).

## Out of scope

The following are not security vulnerabilities in Thinking Hub by themselves:

- another user reading data from an intentionally shared browser/OS profile;
- loss of browser storage without a current exported backup;
- a modified or third-party deployment behaving differently from this source;
- availability or policy decisions made by Google, esm.sh, Anthropic, GitHub,
  or an organization's hosting provider;
- AI output being incorrect when it has not bypassed the confirmation boundary.
