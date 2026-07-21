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

  // ── Timestamp convention (P90) ─────────────────────────────────────────
  // Standard record lifecycle stamps used across every data tool so future
  // "outdated / busy / stale" insights have a consistent base to read.
  //   createdAt  — set ONCE when a record is first created (never overwritten,
  //                never fabricated for pre-existing records → blank = unknown)
  //   updatedAt  — bumped on every meaningful edit
  //   archivedAt — set when a record is archived, cleared when un-archived
  const nowISO = () => new Date().toISOString();

  // Call on a brand-new record before pushing it into storage.
  function stampCreate(o) {
    if (o && !o.createdAt) o.createdAt = nowISO();
    return o;
  }
  // Call whenever a record is edited. Best-effort backfills createdAt if the
  // record predates the convention (so it isn't left with an update but no create).
  function stampUpdate(o) {
    if (!o) return o;
    const t = nowISO();
    o.updatedAt = t;
    if (!o.createdAt) o.createdAt = t;
    return o;
  }
  // Toggle archive state with a timestamp. Pass the desired archived boolean.
  function stampArchive(o, archived) {
    if (!o) return o;
    o.archived = !!archived;
    o.archivedAt = archived ? nowISO() : '';
    return o;
  }

  // Human "3w ago" / "just now" / "" (unknown) from an ISO string — for age badges.
  function relativeAge(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const s = Math.max(0, (Date.now() - then) / 1000);
    if (s < 45) return 'just now';
    const m = s / 60; if (m < 45) return Math.round(m) + 'm ago';
    const h = m / 60; if (h < 24) return Math.round(h) + 'h ago';
    const d = h / 24; if (d < 7) return Math.round(d) + 'd ago';
    const w = d / 7; if (w < 5) return Math.round(w) + 'w ago';
    const mo = d / 30; if (mo < 12) return Math.round(mo) + 'mo ago';
    return Math.round(d / 365) + 'y ago';
  }
  // Days since an ISO timestamp (Infinity if unknown) — for staleness thresholds.
  function daysSince(iso) {
    if (!iso) return Infinity;
    const then = new Date(iso).getTime();
    if (isNaN(then)) return Infinity;
    return (Date.now() - then) / 86400000;
  }

  return { esc, trapFocus, stampCreate, stampUpdate, stampArchive, relativeAge, daysSince };
})();
