/**
 * hub-tags.js — Centralized tag/topic registry for Thinking Hub
 *
 * Exposes a global `HubTags` singleton. Load after hub-storage.js (and
 * hub-utils.js if available, for HTML escaping in autocomplete datalists).
 *
 * Storage key: hub-tags-v1 → { tags: [{ name, createdAt }] }
 *
 * TAG_SOURCES describes every place a free-text `tags` field already lives
 * across the app, via a uniform { get(), set(arr) } accessor — so scanning,
 * renaming and merging work the same regardless of whether the underlying
 * field is an array of strings (most tools) or a comma-separated string
 * (decision-hub).
 */

// Fallback shim: keep working if hub-storage.js failed to load.
if (typeof window.HubStorage === 'undefined') {
  window.HubStorage = {
    get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
    subscribe: () => (() => { }),
  };
}

window.HubTags = (() => {

  const STORAGE_KEY = 'hub-tags-v1';

  const TAG_SOURCES = [
    {
      id: 'learning-hub', label: 'Learning Log',
      storageKey: 'learning-hub-v1',
      collect(data) {
        return (data.items || []).map(it => ({
          get: () => it.tags || [],
          set: arr => { it.tags = arr; },
        }));
      }
    },
    {
      id: 'reflection-hub', label: 'Reflection Board',
      storageKey: 'reflection-hub-v1',
      collect(data) {
        const out = [];
        (data.boards || []).forEach(b => {
          Object.keys(b.columns || {}).forEach(col => {
            (b.columns[col] || []).forEach(it => out.push({
              get: () => it.tags || [],
              set: arr => { it.tags = arr; },
            }));
          });
        });
        return out;
      }
    },
    {
      id: 'meetings-hub', label: 'Meeting Hub',
      storageKey: 'meetings-hub-v1',
      collect(data) {
        return (data.meetings || []).map(m => ({
          get: () => m.tags || [],
          set: arr => { m.tags = arr; },
        }));
      }
    },
    {
      id: 'decision-hub', label: 'Decision Hub',
      storageKey: 'decision-hub-v1',
      collect(data) {
        // decision-hub-v1 stores tags as a CSV string, but several other
        // tools (capture-hub, journal-hub, review-hub, meetings-hub,
        // log-hub) push new decisions with `tags: []` — normalize both
        // shapes on read; writes always go back out as CSV.
        return (Array.isArray(data) ? data : []).map(d => ({
          get: () => Array.isArray(d.tags)
            ? d.tags.filter(Boolean)
            : (d.tags || '').split(',').map(s => s.trim()).filter(Boolean),
          set: arr => { d.tags = arr.join(', '); },
        }));
      }
    },
  ];

  // ── Registry CRUD ─────────────────────────────────────────────────────────

  function getRegistry() {
    const data = HubStorage.get(STORAGE_KEY);
    return (data && Array.isArray(data.tags)) ? data.tags : [];
  }

  function saveRegistry(tags) {
    HubStorage.set(STORAGE_KEY, { tags });
  }

  function normalize(name) {
    return (name || '').trim();
  }

  // Case-insensitive lookup against the registry, falling back to any
  // already-in-use tag (so typing "bim" when "BIM" is used in Learning Log
  // but not yet registered doesn't create a duplicate-casing entry).
  function findCanonical(name) {
    const key = normalize(name).toLowerCase();
    if (!key) return null;
    const reg = getRegistry().find(t => t.name.toLowerCase() === key);
    if (reg) return reg.name;
    const used = scanUsage().find(u => u.name.toLowerCase() === key && u.count > 0);
    return used ? used.name : null;
  }

  // Ensure a tag exists in the registry (case-insensitive). Returns the
  // canonical name (existing casing wins if already registered).
  function ensure(name) {
    const n = normalize(name);
    if (!n) return n;
    const canonical = findCanonical(n);
    if (canonical) return canonical;
    const reg = getRegistry();
    reg.push({ name: n, createdAt: new Date().toISOString() });
    saveRegistry(reg);
    return n;
  }

  function removeFromRegistry(name) {
    const key = normalize(name).toLowerCase();
    saveRegistry(getRegistry().filter(t => t.name.toLowerCase() !== key));
  }

  // Removes a tag everywhere: strips it (case-insensitive) from every item
  // across all TAG_SOURCES and drops it from the registry. Returns the
  // number of items it was removed from.
  function removeTag(name) {
    const key = normalize(name).toLowerCase();
    if (!key) return 0;
    let itemCount = 0;

    for (const src of TAG_SOURCES) {
      const data = HubStorage.get(src.storageKey);
      if (!data) continue;
      let entries;
      try { entries = src.collect(data) || []; } catch { continue; }
      let changed = false;
      for (const entry of entries) {
        const arr = entry.get() || [];
        if (!arr.length) continue;
        const out = arr.filter(t => t.toLowerCase() !== key);
        if (out.length !== arr.length) {
          entry.set(out);
          changed = true;
          itemCount++;
        }
      }
      if (changed) HubStorage.set(src.storageKey, data);
    }

    removeFromRegistry(name);
    return itemCount;
  }

  // ── Usage scan ───────────────────────────────────────────────────────────
  // Returns [{ name, count, sources: [{id, label, count}] }], sorted by
  // usage descending. Registry-only (unused) tags are included with count 0.

  function scanUsage() {
    const usage = new Map(); // lowercase -> { name, count, sources: Map(id -> count) }

    function bump(name, sourceId) {
      const key = (name || '').toLowerCase();
      if (!key) return;
      if (!usage.has(key)) usage.set(key, { name, count: 0, sources: new Map() });
      const u = usage.get(key);
      u.count++;
      u.sources.set(sourceId, (u.sources.get(sourceId) || 0) + 1);
    }

    for (const src of TAG_SOURCES) {
      const data = HubStorage.get(src.storageKey);
      if (!data) continue;
      let entries;
      try { entries = src.collect(data) || []; } catch { continue; }
      for (const entry of entries) {
        (entry.get() || []).forEach(t => { if (t) bump(t, src.id); });
      }
    }

    for (const t of getRegistry()) {
      const key = t.name.toLowerCase();
      if (!usage.has(key)) usage.set(key, { name: t.name, count: 0, sources: new Map() });
    }

    return Array.from(usage.values())
      .map(u => ({
        name: u.name,
        count: u.count,
        sources: TAG_SOURCES.filter(s => u.sources.has(s.id))
          .map(s => ({ id: s.id, label: s.label, count: u.sources.get(s.id) })),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  // ── Rename / merge ───────────────────────────────────────────────────────
  // Renames oldName to newName everywhere (case-insensitive match on oldName).
  // If newName already exists on an item, the two are merged (no duplicates).
  // Returns true if anything changed.

  function rename(oldName, newName) {
    oldName = normalize(oldName);
    newName = normalize(newName);
    if (!oldName || !newName) return false;
    const oldKey = oldName.toLowerCase();
    const newKey = newName.toLowerCase();
    if (oldKey === newKey && oldName === newName) return false;

    for (const src of TAG_SOURCES) {
      const data = HubStorage.get(src.storageKey);
      if (!data) continue;
      let entries;
      try { entries = src.collect(data) || []; } catch { continue; }
      let changed = false;
      for (const entry of entries) {
        const arr = entry.get() || [];
        if (!arr.length) continue;
        const seen = new Set();
        let localChanged = false;
        const out = [];
        for (const t of arr) {
          const repl = t.toLowerCase() === oldKey ? newName : t;
          const replKey = repl.toLowerCase();
          if (seen.has(replKey)) { localChanged = true; continue; }
          seen.add(replKey);
          if (t.toLowerCase() === oldKey) localChanged = true;
          out.push(repl);
        }
        if (localChanged) { entry.set(out); changed = true; }
      }
      if (changed) HubStorage.set(src.storageKey, data);
    }

    // Registry: drop the old entry, ensure the new one exists with the given casing
    let reg = getRegistry().filter(t => t.name.toLowerCase() !== oldKey);
    const existingNew = reg.find(t => t.name.toLowerCase() === newKey);
    if (existingNew) {
      existingNew.name = newName;
    } else {
      reg.push({ name: newName, createdAt: new Date().toISOString() });
    }
    saveRegistry(reg);
    return true;
  }

  // ── Autocomplete ─────────────────────────────────────────────────────────
  // Attaches a <datalist> of all known tag names (registry + in-use) to a
  // text input via the `list` attribute.

  function attachAutocomplete(inputEl) {
    if (!inputEl) return;
    const esc = (typeof HubUtils !== 'undefined' && HubUtils.esc) ? HubUtils.esc
      : s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let listId = inputEl.getAttribute('list');
    if (!listId) {
      listId = (inputEl.id || 'hubtags') + '-list';
      inputEl.setAttribute('list', listId);
    }
    let datalist = document.getElementById(listId);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = listId;
      document.body.appendChild(datalist);
    }

    const names = new Set(getRegistry().map(t => t.name));
    scanUsage().forEach(u => names.add(u.name));
    datalist.innerHTML = Array.from(names).sort((a, b) => a.localeCompare(b))
      .map(n => `<option value="${esc(n)}"></option>`).join('');
  }

  return {
    STORAGE_KEY,
    TAG_SOURCES,
    getRegistry, saveRegistry,
    ensure, findCanonical, removeFromRegistry, removeTag,
    scanUsage, rename,
    attachAutocomplete,
  };
})();
