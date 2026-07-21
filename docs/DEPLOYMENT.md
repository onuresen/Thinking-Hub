# Enterprise Deployment and Administration Guide

Thinking Hub is a no-build static web application. Deploy the repository's
application files to an HTTPS-capable static web server; there is no database,
application server, account service, or environment-variable configuration.

## 1. Decide the operating mode

### Standard connected deployment

All fonts, icons, and runtime libraries are self-hosted. The only application
egress to consider is `api.anthropic.com`, and only if optional AI is approved
and `enterprise-config.js` keeps `aiEnabled: true`.

### Restricted deployment

Set `aiEnabled: false` in `enterprise-config.js` and block
`api.anthropic.com` at the proxy, DNS, firewall, and/or managed-browser layer.
The application then uses same-origin resources only and can be deployed on an
isolated intranet. The policy switch hides AI controls and rejects all Thinking
Hub AI calls before fetch; network blocking is the defense-in-depth control.

Do not configure an Anthropic API key where external AI use is prohibited.
The service worker treats `enterprise-config.js` as network-first with an
offline cache fallback, so an online policy change is not delayed by the
normal stale-while-revalidate asset strategy. Network blocking remains the
authoritative defense if a previously installed device is indefinitely
offline with an older cached policy.

## 2. Hosting requirements

- Serve the files from one stable origin over HTTPS. `localhost` is acceptable
  for evaluation.
- Preserve the repository directory structure and filenames.
- Serve `.html`, `.js`, `.css`, `.json`, `.svg`, `.png`, and font/media types
  with correct MIME types.
- Allow service-worker registration with scope at the application directory.
- Do not rewrite tool HTML requests to `index.html`; tools are real files loaded
  in the shell iframe.
- A subdirectory deployment is supported by relative application URLs, but the
  service-worker scope and all files must remain under that same directory.
- `file://` can be used for a limited personal evaluation, but service workers,
  PWA installation, and some browser APIs require HTTP(S). It is not the
  recommended enterprise deployment.

Example layout:

```text
/thinking-hub/
  index.html
  sw.js
  manifest.json
  theme.css
  hub-*.js
  *-hub.html
  styles/
  vendor/
  icons/
```

No `npm install` or build command is needed for the application. The `tests/`
package is development-only and does not need to be hosted.

## 3. Recommended web-server controls

At minimum:

- HTTPS with the organization's normal certificate and TLS policy;
- access restrictions appropriate to the data classification;
- `X-Content-Type-Options: nosniff`;
- a deliberate `Referrer-Policy` (for example,
  `strict-origin-when-cross-origin`);
- framing policy that permits Thinking Hub's own shell to iframe same-origin
  tool pages while denying unrelated origins, for example
  `Content-Security-Policy: frame-ancestors 'self'` at the HTTP-header layer;
- no shared intermediary caching of user-generated backup downloads;
- documented retention and access controls for ordinary web-server logs.

Every HTML page includes a tested meta Content Security Policy restricting
default resources to self, images to self/data/blob, fonts/frames/workers to
self, objects to none, and connections to self plus the optional Anthropic API.
The current no-build architecture still requires `unsafe-inline` for inline
scripts, styles, and event handlers. `frame-ancestors` is not enforced from a
meta policy, so operators should keep the HTTP-header `frame-ancestors 'self'`
control above. A deployment may add stricter headers, but must test all tools,
iframes, workers, exports, and the chosen AI policy.

## 4. Browser and profile management

- Chromium-based Edge or Chrome is the recommended managed desktop target.
- Core tools also load in other modern browsers, but File System Access
  features such as Obsidian directory selection and MCP file sync require a
  compatible Chromium browser.
- Browser storage is isolated by exact origin and browser profile. Keep the
  scheme, host, port, and application path stable.
- Thinking Hub has no login, SSO, role model, or per-workspace access control.
  On shared computers, assign separate managed OS or browser profiles. Do not
  treat the future workspace switcher as a security boundary.
- Apply organizational browser-extension, download, clipboard, and local-file
  policies according to the data classification.

## 5. Predeployment checklist

1. Review `LICENSE`, `THIRD-PARTY-NOTICES`, `SECURITY.md`, and `PRIVACY.md`.
2. Select a published release, verify its SHA-256 checksum, and record both the
   release tag and full commit SHA. Do not deploy from a moving branch or an
   unverified source archive. See `RELEASING.md`.
3. Run the repository test suite:

   ```powershell
   Set-Location tests
   npm ci
   npx playwright install chromium
   npm test
   ```

4. Confirm `sw.js` precache coverage passes.
5. Confirm the required network allowlist/denylist with the security team.
6. Decide whether AI is permitted. If it is not, set `aiEnabled: false` in
   `enterprise-config.js`, block `api.anthropic.com`, and instruct users not to
   store a key.
7. Open every approved browser profile against the final HTTPS origin and test
   a synthetic Full Backup export, read-only verification, wipe in a disposable
   profile, and restore.
8. Record the release tag, commit, checksum, deployment origin, browser policy,
   external-host policy, reviewer, and rollback owner.

## 6. Data protection and recovery

- Application records reside in localStorage on each browser profile; the web
  server does not hold them.
- IndexedDB snapshots provide local point-in-time recovery but are lost if site
  data or the browser profile is removed.
- Require periodic Full Backup downloads at a frequency matching the business
  impact. Store them under the organization's approved encryption, retention,
  and access-control policy.
- Current Full Backups exclude the Anthropic API key and Obsidian index.
- Use the read-only backup verifier before relying on or restoring a backup.
- Treat exported JSON as potentially confidential even though credentials are
  stripped.
- Test restores using synthetic data and a disposable browser profile before
  relying on the process operationally.

## 7. Upgrade procedure

1. Read `CHANGELOG.md`, verify the release archive checksum, and review the
   source diff and enterprise documents for changed storage keys, dependencies,
   network destinations, and service-worker entries.
2. Run `npm ci` and `npm test` from `tests/`.
3. Export and verify a Full Backup from a representative profile.
4. Deploy all static files atomically; do not mix files from different commits.
5. Load the application online once so the service worker can refresh assets.
   The stale-while-revalidate strategy can serve the previous cached file on
   the first load and use the refreshed copy on the next load.
6. Reload again, then confirm the shell, a representative tool, backup export,
   and browser console.
7. Keep the previous reviewed static-file set available for rollback. Data
   schema rollback must be evaluated separately; restoring old application
   files does not reverse data changes.

## 8. Incident and offboarding procedure

- For suspected application vulnerabilities, follow `SECURITY.md` and avoid
  publishing secrets or exploit details.
- Preserve a verified backup before clearing data unless containment requires
  immediate deletion.
- Clear site data for the deployment origin to remove localStorage, IndexedDB,
  Cache Storage, service workers, and stored permissions from that profile.
- Delete exported backups and MCP-synced files separately according to policy.
- Revoke or rotate the Anthropic API key through Anthropic if it may have been
  exposed; clearing Thinking Hub storage does not revoke the credential.
- Review web-server, proxy, DNS, and browser-management logs available to the
  organization. Thinking Hub itself emits no telemetry or remote audit log.

## 9. Known limitations

- No central admin console, SSO, RBAC, remote wipe, server-side audit log, or
  policy distribution.
- Optional Anthropic key stored in plaintext browser localStorage.
- Optional direct requests to Anthropic when both deployment policy and the
  user enable AI, as described in `PRIVACY.md`.
- The repository CSP retains `unsafe-inline` because the no-build application
  uses inline scripts, styles, and event handlers.
- Only the latest published release is maintained; there is no long-term
  support release line or staffed response-time SLA.

These limitations must be assessed against the organization's threat model;
they should not be represented as features that already exist.
