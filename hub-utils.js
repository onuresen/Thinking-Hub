/**
 * hub-utils.js — Shared utilities for Thinking Hub
 * Load before hub-links.js and hub-search.js.
 */

const HubUtils = (() => {

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { esc };
})();
