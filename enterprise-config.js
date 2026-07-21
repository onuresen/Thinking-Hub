/**
 * enterprise-config.js — deployment-owned Thinking Hub policy.
 *
 * Administrators may change these values in the static deployment. Keep this
 * file before hub-ai.js in script order. It deliberately does not use browser
 * storage, so an imported backup cannot override organization policy.
 */
(function () {
  'use strict';

  const policy = Object.freeze({
    // Set false to remove Thinking Hub's AI controls and reject every AI call
    // before a network request is created. A network deny rule remains the
    // strongest defense-in-depth control for restricted deployments.
    aiEnabled: true,

    // Provider allowlist, in deployment-preference order. Supported values:
    // 'copilot-handoff' (local preview/copy/open; no Microsoft API or secret)
    // 'anthropic' (direct browser API request with a user-supplied key).
    // Use ['copilot-handoff'] for a no-key Microsoft-first deployment.
    allowedAiProviders: Object.freeze(['copilot-handoff', 'anthropic']),
  });

  Object.defineProperty(window, 'ThinkingHubPolicy', {
    value: policy,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  document.documentElement.setAttribute(
    'data-ai-enabled',
    policy.aiEnabled && policy.allowedAiProviders.length ? 'true' : 'false'
  );
})();
