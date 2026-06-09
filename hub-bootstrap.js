/**
 * hub-bootstrap.js
 * Centralized bootstrapping for all Thinking Hub tools
 */

window.HubBootstrap = (() => {
    let _started = false;

    function start(toolId) {
        if (_started) return;
        _started = true;

        if (!toolId) {
            console.warn('[HubBootstrap] toolId missing');
            return;
        }

        // Data layer
        if (window.HubData) {
            HubData.init(toolId);
        }

        // Cross-tool links
        if (window.HubLinks) {
            HubLinks.init(toolId);
        }

        // Global search (Cmd+K)
        if (window.HubSearch) {
            HubSearch.init();
        }
    }

    return { start };
})();

// ── Global modal keyboard shortcuts ───────────────────────────────────────────
// Escape = close topmost visible modal
// Enter  = confirm (click .btn-primary), except in textarea / button / select
//
// Loaded in every tool page via hub-bootstrap.js so no per-tool wiring needed.
// Selectors cover both class-toggle patterns (.is-open / .open) and the
// display:flex pattern used by a few tools.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' && e.key !== 'Enter') return;
  if (e.defaultPrevented) return;

  // Find topmost visible modal overlay
  const modal = [...document.querySelectorAll(
    '.ui-modal-overlay, .modal-overlay, .modal-backdrop, .asm-modal-overlay, .send-modal-overlay'
  )].filter(el =>
    el.classList.contains('is-open') || el.classList.contains('open') ||
    el.style.display === 'flex'      || el.style.display === 'block'
  ).pop();

  if (!modal) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    // 1. Dedicated close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) { closeBtn.click(); return; }
    // 2. Cancel / ghost button in actions row
    const cancelBtn = modal.querySelector('.modal-actions .btn-ghost, .modal-footer .btn-ghost');
    if (cancelBtn) { cancelBtn.click(); return; }
    // 3. Click the overlay itself — its onclick attr calls closeModal()
    modal.click();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const tag = (document.activeElement?.tagName || '').toUpperCase();
    // Let textareas, buttons, links, and selects handle Enter natively
    if (['TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(tag)) return;
    if (document.activeElement?.isContentEditable) return;
    const btn = modal.querySelector('.btn-primary');
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  }
});
