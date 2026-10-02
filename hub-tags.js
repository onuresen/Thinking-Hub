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
      id: 'project-hub', label: 'Project Hub',
      storageKey: 'project-hub-v1',
      collect(data) {
        return (data.projects || []).map(p => ({
          get: () => Array.isArray(p.tags) ? p.tags : [],
          set: arr => { p.tags = arr; },
        }));
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


  // ── Chip input with suggestions ──────────────────────────────────────────
  // Turns a comma-separated text input into chips + a suggestion list.
  // The original input stays in the DOM (hidden) and always holds the CSV,
  // so existing save code that reads `input.value` keeps working.
  //   Type      → matching existing tags appear; Enter/Tab/click picks one.
  //   No match  → the last row reads Create "x"; Enter makes a new tag.
  //   Near-miss → "Shop-drawing" vs "Shop drawing" suggests the existing one first.
  let _chipStyle = false;
  function _injectChipStyle() {
    if (_chipStyle) return;
    _chipStyle = true;
    const st = document.createElement('style');
    st.textContent = `
      .ht-wrap{position:relative;display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:5px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);cursor:text}
      .ht-wrap:focus-within{border-color:var(--accent)}
      .ht-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 9px;border-radius:999px;background:var(--accent-dim);border:1px solid var(--accent-glow);color:var(--text);font-size:12px;font-weight:500}
      .ht-chip button{all:unset;cursor:pointer;color:var(--text3);font-size:14px;line-height:1;padding:0 4px;border-radius:50%}
      .ht-chip button:hover{color:var(--accent-nope)}
      .ht-in{flex:1;min-width:120px;background:none;border:none;outline:none;color:var(--text);font:inherit;font-size:13px;padding:3px 0}
      .ht-menu{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:var(--z-popover,50);background:var(--surface);border:1px solid var(--border2,var(--border));border-radius:var(--r-sm);box-shadow:0 8px 24px rgba(0,0,0,.35);max-height:220px;overflow:auto;display:none}
      .ht-opt{display:flex;justify-content:space-between;gap:10px;padding:7px 12px;font-size:13px;color:var(--text);cursor:pointer}
      .ht-opt small{color:var(--text3);font-size:11px}
      .ht-opt.on,.ht-opt:hover{background:var(--accent-dim)}
      .ht-opt.new{color:var(--accent)}
    `;
    document.head.appendChild(st);
  }

  const _key = s => (s || '').toLowerCase().replace(/[^a-z0-9À-￿]/g, '');

  function attachTagInput(inputEl) {
    if (!inputEl || inputEl.dataset.htChip) return;
    inputEl.dataset.htChip = '1';
    _injectChipStyle();
    const esc = (typeof HubUtils !== 'undefined' && HubUtils.esc) ? HubUtils.esc
      : s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let tags = (inputEl.value || '').split(',').map(x => x.trim()).filter(Boolean);
    let known = [];            // [{name, count}]
    let active = -1;
    let items = [];            // current menu rows

    const wrap = document.createElement('div');
    wrap.className = 'ht-wrap';
    const typed = document.createElement('input');
    typed.className = 'ht-in';
    typed.type = 'text';
    typed.placeholder = inputEl.getAttribute('placeholder') || 'Add tag…';
    typed.setAttribute('autocomplete', 'off');
    const menu = document.createElement('div');
    menu.className = 'ht-menu';
    wrap.appendChild(typed);
    wrap.appendChild(menu);
    inputEl.style.display = 'none';
    inputEl.insertAdjacentElement('afterend', wrap);

    function loadKnown() {
      const m = new Map();
      getRegistry().forEach(t => m.set(t.name, 0));
      scanUsage().forEach(u => m.set(u.name, u.count || 0));
      known = Array.from(m, ([name, count]) => ({ name, count }));
    }
    function canonical(txt) {
      const k = _key(txt);
      const hit = known.find(t => t.name.toLowerCase() === txt.toLowerCase())
        || known.find(t => _key(t.name) === k);
      return hit ? hit.name : txt;
    }
    function sync() {
      inputEl.value = tags.join(', ');
      wrap.querySelectorAll('.ht-chip').forEach(n => n.remove());
      tags.forEach((t, i) => {
        const c = document.createElement('span');
        c.className = 'ht-chip';
        c.innerHTML = `${esc(t)}<button type="button" aria-label="Remove ${esc(t)}">×</button>`;
        c.querySelector('button').addEventListener('mousedown', e => { e.preventDefault(); tags.splice(i, 1); sync(); typed.focus(); });
        wrap.insertBefore(c, typed);
      });
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function add(txt) {
      txt = (txt || '').trim().replace(/,+$/, '').trim();
      if (!txt) return;
      const name = canonical(txt);
      if (!tags.some(t => t.toLowerCase() === name.toLowerCase())) tags.push(name);
      typed.value = '';
      sync();
      render();
    }
    function render() {
      const q = typed.value.trim();
      const qk = _key(q);
      const have = new Set(tags.map(t => t.toLowerCase()));
      let rows = known.filter(t => !have.has(t.name.toLowerCase()) && (!qk || _key(t.name).includes(qk)));
      rows.sort((a, b) => {
        if (qk) {
          const ea = _key(a.name) === qk ? 0 : _key(a.name).startsWith(qk) ? 1 : 2;
          const eb = _key(b.name) === qk ? 0 : _key(b.name).startsWith(qk) ? 1 : 2;
          if (ea !== eb) return ea - eb;
        }
        return b.count - a.count || a.name.localeCompare(b.name);
      });
      items = rows.slice(0, 8).map(t => ({ name: t.name, hint: t.count ? t.count + ' use' + (t.count > 1 ? 's' : '') : 'topic' }));
      const exact = q && known.some(t => _key(t.name) === qk);
      if (q && !exact && !have.has(q.toLowerCase())) items.push({ name: q, isNew: true });
      active = items.length ? 0 : -1;
      draw();
    }
    function draw() {
      if (!items.length) { menu.style.display = 'none'; return; }
      menu.innerHTML = items.map((it, i) =>
        `<div class="ht-opt${it.isNew ? ' new' : ''}${i === active ? ' on' : ''}" data-i="${i}">` +
        (it.isNew ? `<span>Create “${esc(it.name)}”</span><small>new tag</small>` : `<span>${esc(it.name)}</span><small>${esc(it.hint)}</small>`) + `</div>`).join('');
      menu.style.display = 'block';
    }
    menu.addEventListener('mousedown', e => {
      const o = e.target.closest('.ht-opt');
      if (!o) return;
      e.preventDefault();
      add(items[+o.dataset.i].name);
      typed.focus();
    });
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) { e.preventDefault(); typed.focus(); } });
    typed.addEventListener('focus', () => { loadKnown(); render(); });
    typed.addEventListener('input', () => {
      if (typed.value.includes(',')) {
        const parts = typed.value.split(',');
        typed.value = parts.pop();
        parts.forEach(add);
      }
      render();
    });
    typed.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        draw();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (typed.value.trim()) {
          e.preventDefault();
          add(items[active] ? items[active].name : typed.value);
        } else if (e.key === 'Enter') e.preventDefault();
      } else if (e.key === 'Backspace' && !typed.value && tags.length) {
        tags.pop(); sync(); render();
      } else if (e.key === 'Escape' && menu.style.display === 'block') {
        e.stopPropagation(); menu.style.display = 'none';
      }
    });
    typed.addEventListener('blur', () => {
      if (typed.value.trim()) add(typed.value);
      menu.style.display = 'none';
    });
    loadKnown();
    sync();
  }

  return {
    STORAGE_KEY,
    TAG_SOURCES,
    getRegistry, saveRegistry,
    ensure, findCanonical, removeFromRegistry, removeTag,
    scanUsage, rename,
    attachAutocomplete, attachTagInput,
  };
})();
