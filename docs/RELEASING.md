# Release Process

Thinking Hub uses Git tags and GitHub Releases so administrators can review,
pin, verify, and roll back an exact static-file set. `VERSION` is the canonical
version source. Releases from 1.1.0 onward use Semantic Versioning.

## Release contract

- Release tags are `vMAJOR.MINOR.PATCH` and must equal `v` plus the exact
  contents of `VERSION`.
- `CHANGELOG.md` must contain a dated heading for that version.
- A release tag must point to a reviewed commit on `main` whose CI checks pass.
- The release archive is produced from that tag with `git archive`; development
  and agent-only files marked `export-ignore` in `.gitattributes` are omitted.
- Every release includes a SHA-256 checksum file. Operators should verify it
  before deployment and retain both files with their review record.
- Tags and release assets are immutable. Corrections use a new patch version;
  never silently replace a published archive.

The historical `v1.0` tag predates this contract. Treat `v1.1.0` as the first
release governed by it.

## Preparing a release

1. Start from an up-to-date `main` with a clean working tree.
2. Choose the version according to Semantic Versioning:
   - patch: compatible fixes, documentation, or security hardening;
   - minor: compatible user-facing capability;
   - major: incompatible data, deployment, or behavior changes.
3. Write the exact version to `VERSION` without a leading `v`.
4. Move completed notes from `Unreleased` into a dated
   `## [MAJOR.MINOR.PATCH] - YYYY-MM-DD` section in `CHANGELOG.md`, then update
   its comparison links.
5. Review dependency, storage-key, network-egress, CSP, and service-worker
   changes. Update the enterprise documents and `THIRD-PARTY-NOTICES` where
   applicable.
6. From `tests/`, run `npm ci`, install Chromium if needed, then run `npm test`.
7. Merge the reviewed release commit to `main` and confirm CI is green.

## Publishing

Create and push an annotated tag only after the release commit is on `main`:

```powershell
$releaseVersion = (Get-Content VERSION -Raw).Trim()
git tag -a "v$releaseVersion" -m "Thinking Hub v$releaseVersion"
git push origin "v$releaseVersion"
```

The `release.yml` workflow validates the tag/version/changelog relationship,
runs the full test suite, builds the archive and checksum, and creates the
GitHub Release. A failed workflow must be investigated; do not publish a
hand-built replacement under the same tag.

## Verifying and deploying

1. Download both release assets from GitHub Releases.
2. Verify the archive against its `.sha256` file using an approved SHA-256
   tool. On PowerShell: `Get-FileHash <archive> -Algorithm SHA256`.
3. Record the release tag, full commit SHA, checksum, reviewer, deployment
   origin, policy decision, and rollback owner.
4. Follow `docs/DEPLOYMENT.md`, including backup/restore validation and atomic
   deployment of the complete archive.

## Security support and rollback

Only the latest published release receives fixes. When a security correction
ships, the changelog identifies its impact and operators should upgrade to the
new release. Older releases remain available for audit and rollback but are
not maintained. Rollback restores application files only; it does not reverse
browser data migrations, so preserve and verify a Full Backup first.
