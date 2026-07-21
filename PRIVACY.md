# Privacy and Network-Egress Statement

Last updated: 2026-07-21

Thinking Hub is a local-first static application. The project maintainer does
not operate an application backend and does not receive workspace records,
accounts, telemetry, or analytics from the application. A deployment operator
may separately collect ordinary web-server or network logs; that operator is
responsible for documenting and governing them.

This statement describes the source code in this repository. A fork, modified
copy, browser extension, reverse proxy, or hosting platform can change the
privacy behavior.

## Data stored on the device

| Browser facility | Purpose | Retention |
| --- | --- | --- |
| localStorage | Tool records, settings, links, UI state, and the optional Anthropic API key | Until the user imports/replaces data, resets a tool, clears site data, or the browser removes it |
| IndexedDB | Automatic, manual, and pre-restore snapshots of localStorage | Automatic daily snapshots: 14 days; older Monday snapshots: up to 60 days; newest 10 manual/safety snapshots |
| Cache Storage | Offline application assets and Google Font responses | Until replaced by service-worker cache maintenance or cleared as site data |
| Selected local files/directories | Backup import, Obsidian read access, and explicit MCP file sync | Governed by the browser permission and the user's selected location |

Browser storage is scoped to the exact origin: scheme, host, and port. Moving a
deployment to a different origin creates a separate data store unless the user
exports and imports a Full Backup.

## Outbound network inventory

| Destination | Trigger | Information sent or exposed | Required for core use? |
| --- | --- | --- | --- |
| `fonts.googleapis.com` | Each page requests the font stylesheet | Normal request metadata such as IP address, user agent, and referrer | No; system-font fallbacks render if blocked |
| `fonts.gstatic.com` | The Google Fonts stylesheet requests font files; the service worker may cache responses | Normal request metadata and requested font asset | No |
| `www.google.com/s2/favicons` | Stakeholder Map or Tool Portfolio renders an entry with a URL | The URL's domain in the query string plus normal request metadata | No; the UI falls back to generated initials |
| `esm.sh` | The first explicit AI action or API-key test in a page session loads `@anthropic-ai/sdk@0.52.0` | Requested package/version plus normal request metadata; the Anthropic API key and workspace context are not intentionally sent to esm.sh | No; AI features fail if blocked |
| `api.anthropic.com` | A user explicitly tests a key or invokes an AI capture, query, act, briefing, drafting, or insight feature | Anthropic API key, prompt, applicable system instructions, and feature-dependent workspace context | No |
| `console.anthropic.com` | User clicks the API-key help link | Normal browser navigation metadata | No |
| User-entered URLs | User follows a saved resource link | Normal browser navigation metadata to that destination | No |

The Open Graph and Twitter preview URLs in `index.html` may be fetched by
social/link-preview crawlers when a public deployment URL is shared. They are
not workspace-data transfer paths.

Thinking Hub does not contain `sendBeacon`, WebSocket, analytics, advertising,
crash-reporting, or telemetry code. Same-origin service-worker requests fetch
application assets from the deployment host and may appear in that host's
access logs.

## What optional AI can include

AI traffic is sent directly from the browser to Anthropic, not through a
Thinking Hub server. Depending on the chosen feature, the request can include:

- the text the user entered and up to four recent AI conversation turns;
- active project and task names, status, priority, due dates, assignees, and
  milestone names;
- selected summaries of decisions, risks, goals, meetings and action items,
  schedule entries, learning insights, reflection items, assumptions,
  stakeholders, people, journal excerpts, focus totals, capture items, and
  cross-tool links.

The capture feature uses a narrower context of active project names and known
people. The API-key test sends only a short connectivity message. Users should
review organizational policy and avoid AI features for data that may not be
sent to Anthropic.

Anthropic independently governs its processing and retention under the terms
applicable to the user's API account. Thinking Hub does not control those
terms.

## Exports and local files

- Full Backups are created in the browser and downloaded to a user-selected or
  browser-default location.
- Current exports remove `hub-settings-v1.anthropicKey`, `obsidianIndex`, and
  `obsidianIndexedAt`.
- Backups created before 2026-06-17 may contain an Anthropic API key and should
  be inspected before sharing.
- The read-only backup verifier parses the selected file locally and does not
  write it into workspace storage.
- Obsidian indexing reads the directory selected by the user. Its generated
  note index remains in browser storage and is excluded from current exports.
- MCP file sync writes only after the user selects a directory and explicitly
  enables that workflow.

## Access, deletion, and portability

Thinking Hub has no central account from which the maintainer can access,
correct, export, or delete a user's records. Users control their data through
the browser and operating system:

- use Full Backup for portability;
- use the backup verifier before relying on or restoring a file;
- clear the deployment origin's browser site data to remove localStorage,
  IndexedDB snapshots, Cache Storage, and permissions from that browser
  profile;
- separately delete downloaded backups or MCP-synced files from their storage
  locations.

Clearing site data is destructive and cannot be undone unless a separate valid
backup exists.

## Enterprise deployment note

For an organization-hosted copy, the organization operating the web server and
managing devices determines access, logging, retention, and acceptable-use
policy. Thinking Hub provides no SSO or central administration because it has
no accounts or server. Separate managed browser/OS profiles are required for
user isolation on shared devices.

See [`SECURITY.md`](SECURITY.md) and
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the associated controls and
deployment boundary.
