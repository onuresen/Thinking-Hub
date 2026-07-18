/**
 * hub-storage.js — localStorage adapter for Thinking Hub
 *
 * Unified get/set/subscribe interface backed by localStorage.
 * Tools use this API exclusively — no direct localStorage calls needed.
 *
 * Load order: this file must come before hub-links.js and hub-data.js.
 */

// Apply persisted theme immediately — runs before first paint so tools never
// flash dark when the user has chosen light mode.
(function () {
  try {
    var t = localStorage.getItem('th-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch {}
})();

window.HubStorage = (() => {

  let _subscribers = {};

  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function set(key, value) {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('[HubStorage] localStorage write failed:', e);
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        if (typeof window.showToast === 'function') {
          window.showToast('⚠ Storage full — this change was NOT saved. Export a backup and clean up old data.', 'error');
        }
      }
    }
    _checkQuota();
    _notifySubscribers(key, value);
  }

  // ── Storage quota guard ───────────────────────────────────────────────────
  // localStorage is ~5 MB per origin in every major browser. usage() reports
  // consumption; _checkQuota() warns (once per session, throttled scan) when
  // usage crosses 80% so the user hears about it before writes start failing.
  const QUOTA_BYTES = 5 * 1024 * 1024;
  let _quotaWarned = false;
  let _lastQuotaCheck = 0;

  function usage() {
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        bytes += (k.length + v.length) * 2; // UTF-16 code units
      }
    } catch {}
    return { bytes, quota: QUOTA_BYTES, percent: Math.min(100, (bytes / QUOTA_BYTES) * 100) };
  }

  function _checkQuota() {
    if (_quotaWarned) return;
    const now = Date.now();
    if (now - _lastQuotaCheck < 30000) return;
    _lastQuotaCheck = now;
    const u = usage();
    if (u.percent >= 80) {
      _quotaWarned = true;
      console.warn('[HubStorage] localStorage at ' + u.percent.toFixed(0) + '% of ~5 MB quota');
      if (typeof window.showToast === 'function') {
        window.showToast('⚠ Local storage is ' + u.percent.toFixed(0) + '% full — export a backup and clean up old data soon.', 'error');
      }
    }
  }

  function subscribe(key, fn) {
    if (!_subscribers[key]) _subscribers[key] = new Set();
    _subscribers[key].add(fn);
    return () => {
      if (_subscribers[key]) _subscribers[key].delete(fn);
    };
  }

  function _notifySubscribers(key, value) {
    const subs = _subscribers[key];
    if (!subs || subs.size === 0) return;
    subs.forEach(fn => {
      try { fn(value, key); }
      catch (e) { console.warn('[HubStorage] subscriber error for key:', key, e); }
    });
  }

  // Clean up any Supabase credentials left over from previous sessions
  try {
    localStorage.removeItem('hub-cloud-config-v1');
    localStorage.removeItem('hub-cloud-credentials-v1');
  } catch {}

  // Cross-tab sync: fire subscribers when another tab writes to localStorage
  window.addEventListener('storage', e => {
    if (!e.key || !_subscribers[e.key]) return;
    let value = null;
    try { value = e.newValue ? JSON.parse(e.newValue) : null; } catch {}
    _notifySubscribers(e.key, value);
  });

  return { get, set, subscribe, usage };

})();
