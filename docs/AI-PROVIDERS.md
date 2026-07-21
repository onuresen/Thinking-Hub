# AI Providers and Microsoft Copilot Handoff

Thinking Hub keeps AI optional and provider-neutral. Deployment policy decides
which providers users may select; user settings cannot override that policy.

## Supported providers

### Microsoft Copilot handoff

This is the recommended provider for organizations that already approve
Microsoft 365 Copilot and do not want users to manage a separate Anthropic API
key.

Thinking Hub prepares the same feature-specific prompt locally, shows a review
dialog containing the exact text, and waits for the user to choose **Copy and
open Copilot**. Only then does it copy the prompt to the clipboard and open
Microsoft 365 Copilot in a new tab. The user pastes it manually.

- No Microsoft credential, access token, client secret, or API key is stored.
- Thinking Hub does not call a Microsoft API or automatically submit data.
- Closing the review dialog sends and copies nothing.
- Microsoft receives data only after the user pastes it into Copilot, under
  the organization's Microsoft 365 policies and license terms.
- Copilot's answer is not automatically applied to Thinking Hub. For actions
  or structured drafts, the user reviews and transfers the result manually.

This deliberately preserves the static, serverless, local-first architecture.

### Anthropic direct

The existing integrated provider sends a request directly from the browser to
`api.anthropic.com` after an explicit AI action. It requires a user-supplied API
key stored in plaintext browser localStorage. Current Full Backups strip the
key. Action responses remain proposals and require confirmation before local
data changes are applied.

### Disabled

If `enterprise-config.js` sets `aiEnabled: false`, all AI surfaces are hidden
and all provider entry points fail before clipboard or network activity.

## Deployment policy

`enterprise-config.js` owns two controls:

- `aiEnabled`: master on/off switch;
- `allowedAiProviders`: allowlist containing `copilot-handoff`, `anthropic`, or
  both.

If a stored provider is no longer allowed, Thinking Hub selects the first
allowed provider. Backups may preserve the user's provider preference, but
cannot change the deployment allowlist.

Recommended enterprise configuration:

```js
aiEnabled: true,
allowedAiProviders: ['copilot-handoff'],
```

For a fully offline/restricted deployment, set `aiEnabled: false` and enforce
the relevant network deny rules as defense in depth.

## Why direct Microsoft integration is deferred

The Microsoft 365 Copilot Chat API is currently a preview Microsoft Graph API.
Microsoft documents it as unsupported for production and currently requires a
Microsoft 365 Copilot add-on license plus a broad set of delegated Graph read
permissions. Thinking Hub therefore does not register an Entra application or
call that API in the v1.1 release line.

Copilot Studio custom-web embedding is also deferred. Microsoft requires a
server-side exchange from a Direct Line secret to a short-lived conversation
token for a secured browser client; putting the secret in this static app would
be unsafe, while adding a token broker would create Thinking Hub's first
backend.

Revisit direct integration when the Chat API is generally available, its
permission model is acceptable to target organizations, and a deployment
wants to accept the new identity, audit, CSP, privacy, and support boundary.

Official references:

- [Microsoft 365 Copilot Chat API overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/overview)
- [Copilot API security and authentication](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-security-authentication)
- [Copilot Chat API permissions](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/copilotconversation-chat)
- [Copilot Studio web-channel security](https://learn.microsoft.com/en-au/microsoft-copilot-studio/configure-web-security)

## Review checklist

Before enabling a provider, confirm:

1. the organization approves that destination and the data categories users
   may provide;
2. the deployment allowlist contains only approved providers;
3. privacy and user guidance match the configured provider;
4. network policy blocks unapproved API destinations;
5. users understand that AI output is untrusted and requires review;
6. provider selection, prompt review/cancel, and AI-disabled behavior pass the
   automated checks in `tests/smoke.js`.
