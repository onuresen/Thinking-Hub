# Changelog

All notable changes to Thinking Hub are recorded here. Releases follow
[Semantic Versioning](https://semver.org/) from version 1.1.0 onward.

## [Unreleased]

### Added

- Provider-neutral AI configuration with a no-key Microsoft Copilot handoff:
  Thinking Hub previews the exact prompt, then copies it and opens Microsoft
  365 Copilot only after confirmation; no Microsoft API, token, or automatic
  submission is involved.
- Deployment-owned AI provider allowlist and reviewer documentation covering
  Copilot handoff, Anthropic direct, disabled mode, privacy, and deferred direct
  Microsoft API/Copilot Studio integration.

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

[Unreleased]: https://github.com/onuresen/Thinking-Hub/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/onuresen/Thinking-Hub/releases/tag/v1.1.0
[1.0]: https://github.com/onuresen/Thinking-Hub/releases/tag/v1.0
