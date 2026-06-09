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
    }
    _notifySubscribers(key, value);
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

  return { get, set, subscribe };

})();
