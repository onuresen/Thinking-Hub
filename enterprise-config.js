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
  });

  Object.defineProperty(window, 'ThinkingHubPolicy', {
    value: policy,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  document.documentElement.setAttribute(
    'data-ai-enabled',
    policy.aiEnabled ? 'true' : 'false'
  );
})();
