# Security Policy

Thinking Hub is a local-first, static web application. It has no application
server, user accounts, cloud database, telemetry, or analytics. This reduces
the remote attack surface, but it does not remove browser, deployment,
dependency, local-device, or optional AI risks.

## Supported versions

For releases from `v1.1.0` onward, security fixes target only the latest
published GitHub Release. The `main` branch is development state and is not a
supported deployment channel. The historical `v1.0` tag predates this policy
and is not maintained. Older releases remain available for audit and rollback;
fixes ship as a new version rather than changing an existing tag or asset.
Forks and modified deployments are maintained by their operators. See
`VERSION`, `CHANGELOG.md`, and `docs/RELEASING.md` for the current release line,
change history, and verification contract.

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

A machine-readable copy of this contact information is published at
`/.well-known/security.txt` (RFC 9116).

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

Thinking Hub supports two optional providers. Microsoft Copilot handoff builds
and displays the exact prompt locally. It copies the prompt and opens Microsoft
365 Copilot only after user confirmation; it stores no Microsoft credential,
calls no Microsoft API, and submits nothing automatically. The user decides
whether to paste the prompt into their organization-managed Copilot session.

Anthropic direct requires a user-supplied API key stored in plaintext
localStorage. When an AI action is explicitly triggered, Thinking Hub sends a
Messages API request directly from the browser to Anthropic. Depending on the
feature, that request can include the user's prompt and selected context
derived from projects, tasks, people, decisions, risks, goals, meetings,
schedule, learning, reflection, assumptions, stakeholders, journal, focus,
capture, and links.

AI output must be treated as untrusted. Integrated Anthropic changes are
proposed for confirmation; Copilot handoff responses are transferred manually
and are never auto-applied. `enterprise-config.js` controls a deployment-owned
provider allowlist plus the master `aiEnabled` switch. Organizations should
allow only approved providers and block unapproved destinations at the network
layer. A disabled provider fails before clipboard or network activity. See
[`docs/AI-PROVIDERS.md`](docs/AI-PROVIDERS.md).

### Local-file access

Obsidian integration requests read-only access through the browser's File
System Access API after an explicit directory-picker action. MCP file sync
requests read/write directory access after an explicit picker action. Browser
permission indicators and the selected directory define that boundary.
Thinking Hub does not upload selected files to its own server.

### Supply chain and browser controls

- `vis-network`, `html2canvas`, and all font subsets are pinned and distributed
  locally from `vendor/`.
- Optional AI uses a small local direct client; there is no runtime SDK/CDN.
- Third-party attributions are recorded in `THIRD-PARTY-NOTICES`.
- CI runs page smoke checks, service-worker precache coverage, and interaction
  flows on pushes to `main` and pull requests.
- Every application page carries a repository Content Security Policy. It
  limits runtime connections to same-origin resources and the optional
  Anthropic API, while retaining `unsafe-inline` for the current no-build
  inline-script/event-handler architecture. Operators can add a stricter
  HTTP-header policy after testing their deployment.

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
- availability or policy decisions made by Anthropic, GitHub, or an
  organization's hosting provider;
- AI output being incorrect when it has not bypassed the confirmation boundary.
