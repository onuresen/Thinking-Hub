'use strict';
const HubObsidian = (() => {
  let _dirHandle = null;

  function isAvailable() {
    return typeof window.showDirectoryPicker === 'function';
  }

  async function pickVault() {
    if (!isAvailable()) return false;
    try {
      _dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      await indexVault();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[HubObsidian] pickVault:', e);
      return false;
    }
  }

  async function indexVault() {
    if (!_dirHandle) return [];
    const notes = [];
    await _walkDir(_dirHandle, '', notes);
    const s = HubStorage.get('hub-settings-v1') || {};
    HubStorage.set('hub-settings-v1', { ...s, obsidianIndex: notes, obsidianIndexedAt: new Date().toISOString() });
    return notes;
  }

  async function _walkDir(dirHandle, prefix, notes) {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'directory' && !name.startsWith('.')) {
        await _walkDir(entry, prefix ? `${prefix}/${name}` : name, notes);
      } else if (entry.kind === 'file' && name.endsWith('.md')) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          const fm = _parseFrontmatter(text);
          const path = prefix ? `${prefix}/${name}` : name;
          notes.push({
            path,
            title: fm.title || name.replace(/\.md$/, ''),
            tags: fm.tags || [],
            aliases: fm.aliases || [],
          });
        } catch (_) {}
      }
    }
  }

  function _parseFrontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return {};
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).trim();
      const raw = line.slice(colon + 1).trim();
      if (raw.startsWith('[')) {
        out[key] = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
      } else {
        out[key] = raw.replace(/^['"]|['"]$/g, '');
      }
    }
    return out;
  }

  function search(query) {
    if (!query) return [];
    const s = HubStorage.get('hub-settings-v1') || {};
    const index = s.obsidianIndex || [];
    const q = query.toLowerCase();
    return index
      .filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.path.toLowerCase().includes(q) ||
        (n.aliases || []).some(a => a.toLowerCase().includes(q)) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }

  function getIndex() {
    const s = HubStorage.get('hub-settings-v1') || {};
    return s.obsidianIndex || [];
  }

  function getIndexedAt() {
    const s = HubStorage.get('hub-settings-v1') || {};
    return s.obsidianIndexedAt || null;
  }

  const _esc = typeof HubUtils !== 'undefined' ? s => HubUtils.esc(s) : s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function attachAutocomplete(inputEl) {
    if (!inputEl || inputEl.dataset.obsidianAc) return;
    inputEl.dataset.obsidianAc = '1';

    const wrap = inputEl.parentElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    const drop = document.createElement('div');
    drop.style.cssText = 'display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);z-index:var(--z-popover,200);background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);box-shadow:0 4px 16px rgba(0,0,0,.25);max-height:200px;overflow-y:auto;';
    wrap.appendChild(drop);

    function hide() { drop.style.display = 'none'; }
    function show(results) {
      if (!results.length) { hide(); return; }
      drop.innerHTML = results.map(n =>
        `<div data-path="${_esc(n.path)}" style="padding:7px 10px;cursor:pointer;font-size:12px;line-height:1.4;border-bottom:1px solid var(--surface3)">
          <div style="font-weight:500;color:var(--text)">${_esc(n.title)}</div>
          <div style="color:var(--text3);font-family:var(--font-mono);font-size:10px">${_esc(n.path)}</div>
        </div>`
      ).join('');
      drop.style.display = '';
      drop.querySelectorAll('[data-path]').forEach(item => {
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface3)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          inputEl.value = item.dataset.path;
          hide();
        });
      });
    }

    inputEl.addEventListener('input', () => show(search(inputEl.value)));
    inputEl.addEventListener('blur', () => setTimeout(hide, 150));
    inputEl.addEventListener('focus', () => { if (inputEl.value) show(search(inputEl.value)); });
  }

  function hasHandle() { return !!_dirHandle; }

  return { isAvailable, hasHandle, pickVault, indexVault, search, getIndex, getIndexedAt, attachAutocomplete };
})();
