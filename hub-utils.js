/**
 * hub-utils.js — Shared utilities for Thinking Hub
 * Load before hub-links.js and hub-search.js.
 */

const HubUtils = (() => {

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Trap Tab / Shift+Tab focus within a modal element (P87 D2).
  // Returns an untrap() function; call it when the modal closes.
  function trapFocus(modalEl) {
    if (!modalEl) return () => {};
    const SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function onKey(e) {
      if (e.key !== 'Tab') return;
      const nodes = [...modalEl.querySelectorAll(SEL)]
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    modalEl.addEventListener('keydown', onKey);
    return () => modalEl.removeEventListener('keydown', onKey);
  }

  return { esc, trapFocus };
})();
