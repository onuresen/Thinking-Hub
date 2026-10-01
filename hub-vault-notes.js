/**
 * hub-vault-notes.js — "linked note" review dialog (P138)
 *
 * A project or meeting can point at its own vault note. This dialog reads that
 * note through HubVaultBridge and shows what is in it but not yet in the hub:
 * open tasks, actions, decisions. Nothing is written until you press Add.
 * Ignored items never come back (HubVaultBridge `seen` map, backed up).
 *
 * Load after hub-obsidian.js and hub-vault-bridge.js.
 *
 * HubVaultNotes.open({
 *   title,                    // dialog title
 *   notePath,                 // current linked note ('' if none)
 *   suggest(notes) -> paths,  // optional: likely notes, from the vault list
 *   saveNote(path),           // store the link on the record
 *   build(text, path) -> [{ title, addAllLabel?, items: [{ key, text, sub, label, accept() }] }]
 *   onChange(),               // after anything was added
 * })
 * HubVaultNotes.pending(cfg) -> Promise<number|null>  // for a count badge
 */
window.HubVaultNotes = (() => {
  let _ready = null;
  let _cfg = null, _text = null, _path = '', _untrap = null;

  function ready() {
    if (typeof HubVaultBridge === 'undefined') return Promise.resolve(null);
    if (!_ready) _ready = HubVaultBridge.init({ scan: false }).catch(() => HubVaultBridge.status());
    return _ready;
  }

  const esc = s => (typeof HubUtils !== 'undefined' ? HubUtils.esc(s) : String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));

  function _injectStyles() {
    if (document.getElementById('hvn-styles')) return;
    const st = document.createElement('style');
    st.id = 'hvn-styles';
    st.textContent = `
      .hvn-modal { max-width: 640px; max-height: 86vh; display: flex; flex-direction: column; gap: 12px; padding: 22px; }
      .hvn-head { display: flex; align-items: center; gap: 10px; }
      .hvn-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--text); flex: 1; min-width: 0; }
      .hvn-x { border: none; background: none; color: var(--text3); font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: var(--r-sm); }
      .hvn-x:hover { background: var(--surface3); color: var(--text); }
      .hvn-note-row { display: flex; gap: 6px; align-items: center; }
      .hvn-note-row input { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 12px; padding: 7px 9px;
        background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--r-sm); }
      .hvn-btn { font-family: var(--font-body); font-size: 12px; padding: 6px 11px; border-radius: var(--r-sm); cursor: pointer;
        border: 1px solid var(--border2); background: var(--surface3); color: var(--text); white-space: nowrap; }
      .hvn-btn:hover { border-color: var(--accent); }
      .hvn-btn.primary { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600; }
      .hvn-btn.ghost { background: none; color: var(--text3); }
      .hvn-btn:disabled { opacity: .5; cursor: default; }
      .hvn-status { font-size: 12.5px; color: var(--text2); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .hvn-sugg { display: flex; flex-wrap: wrap; gap: 5px; }
      .hvn-chip { font-family: var(--font-mono); font-size: 11px; padding: 3px 8px; border-radius: var(--r-chip, 5px); cursor: pointer;
        background: var(--accent-dim); color: var(--text); border: 1px solid var(--accent-glow); }
      .hvn-body { overflow-y: auto; display: flex; flex-direction: column; gap: 14px; min-height: 60px; }
      .hvn-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .hvn-sec-title { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); flex: 1; }
      .hvn-row { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--border);
        border-radius: var(--r-sm); background: var(--surface); margin-bottom: 5px; }
      .hvn-row-main { flex: 1; min-width: 0; }
      .hvn-row-text { font-size: 13px; color: var(--text); line-height: 1.4; }
      .hvn-row-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }
      .hvn-empty { font-size: 13px; color: var(--text3); padding: 10px 2px; }
      .hvn-foot { font-size: 11px; color: var(--text3); }
      .hvn-foot a { color: var(--accent); }
    `;
    document.head.appendChild(st);
  }

  function _ensureDom() {
    _injectStyles();
    let ov = document.getElementById('hvn-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'hvn-overlay';
    ov.className = 'ui-modal-overlay';
    ov.innerHTML = `
      <div class="ui-modal hvn-modal" role="dialog" aria-modal="true" aria-labelledby="hvn-title">
        <div class="hvn-head"><div class="hvn-title" id="hvn-title"></div>
          <button class="hvn-x" data-hvn="close" title="Close (Esc)" aria-label="Close">✕</button></div>
        <div class="hvn-status" id="hvn-status"></div>
        <div class="hvn-note-row">
          <input id="hvn-note" list="hvn-note-list" placeholder="Vault note, e.g. projects/Kit-of-Parts" autocomplete="off" spellcheck="false">
          <datalist id="hvn-note-list"></datalist>
          <button class="hvn-btn" data-hvn="link">Link note</button>
        </div>
        <div class="hvn-sugg" id="hvn-sugg"></div>
        <div class="hvn-body" id="hvn-body"></div>
        <div class="hvn-foot" id="hvn-foot"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-hvn]');
      if (!b) return;
      const act = b.dataset.hvn;
      if (act === 'close') close();
      else if (act === 'link') linkNote(document.getElementById('hvn-note').value);
      else if (act === 'connect') _connect(false);
      else if (act === 'reconnect') _connect(true);
      else if (act === 'sugg') linkNote(b.dataset.path);
      else if (act === 'add') _accept(b.dataset.sec, b.dataset.i);
      else if (act === 'ignore') _ignore(b.dataset.sec, b.dataset.i);
      else if (act === 'addall') _acceptAll(b.dataset.sec);
    });
    ov.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === 'Enter' && e.target.id === 'hvn-note') { e.preventDefault(); linkNote(e.target.value); }
    });
    return ov;
  }

  let _sections = [];

  async function open(cfg) {
    _cfg = cfg;
    _path = (typeof HubVaultBridge !== 'undefined' && cfg.notePath) ? HubVaultBridge.normNotePath(cfg.notePath) : '';
    _text = null;
    const ov = _ensureDom();
    document.getElementById('hvn-title').textContent = cfg.title || 'Vault note';
    document.getElementById('hvn-note').value = _path.replace(/\.md$/i, '');
    document.getElementById('hvn-body').innerHTML = '<div class="hvn-empty">Reading the vault…</div>';
    ov.classList.add('is-open');
    if (typeof HubUtils !== 'undefined' && HubUtils.trapFocus) _untrap = HubUtils.trapFocus(ov.querySelector('.ui-modal'));
    const note = document.getElementById('hvn-note');
    note.focus(); setTimeout(() => note.focus(), 0);
    await ready();
    await _refresh();
  }

  function close() {
    const ov = document.getElementById('hvn-overlay');
    if (ov) ov.classList.remove('is-open');
    if (_untrap) { _untrap(); _untrap = null; }
    if (document.activeElement) document.activeElement.blur();
    _cfg = null;
  }

  function isOpen() {
    const ov = document.getElementById('hvn-overlay');
    return !!ov && ov.classList.contains('is-open');
  }

  async function _connect(again) {
    const ok = again ? await HubVaultBridge.reconnect({ scan: false }) : await HubVaultBridge.connect();
    if (ok) await _refresh();
  }

  function _obsidianUrl(path) {
    let vault = '';
    try { vault = (HubStorage.get('hub-settings-v1') || {}).obsidianVault || ''; } catch { }
    if (!vault || !path) return '';
    return 'obsidian://open?vault=' + encodeURIComponent(vault) + '&file=' + encodeURIComponent(path.replace(/\.md$/i, ''));
  }

  async function _refresh() {
    if (!_cfg) return;
    const statusEl = document.getElementById('hvn-status');
    const body = document.getElementById('hvn-body');
    const foot = document.getElementById('hvn-foot');
    const sugg = document.getElementById('hvn-sugg');
    const st = typeof HubVaultBridge !== 'undefined' ? HubVaultBridge.status() : { supported: false };
    sugg.innerHTML = ''; foot.innerHTML = '';

    if (!st.supported) {
      statusEl.textContent = 'Reading the vault needs Chrome or Edge on a computer.';
      body.innerHTML = ''; return;
    }
    if (!st.connected) {
      statusEl.innerHTML = st.needsPermission
        ? 'The browser needs one click to read the vault again. <button class="hvn-btn primary" data-hvn="reconnect">Reconnect vault</button>'
        : 'No vault folder yet. <button class="hvn-btn primary" data-hvn="connect">Connect vault</button>';
      body.innerHTML = ''; return;
    }
    statusEl.textContent = '';

    const notes = await HubVaultBridge.listNotes();
    const extra = (typeof HubObsidian !== 'undefined' && HubObsidian.getIndex) ? HubObsidian.getIndex().map(n => String(n.path || '').replace(/\.md$/i, '')) : [];
    const all = [...new Set([...notes, ...extra])];
    document.getElementById('hvn-note-list').innerHTML = all.map(p => `<option value="${esc(p)}">`).join('');
    fillNoteLists(all);

    if (!_path) {
      const s = _cfg.suggest ? (_cfg.suggest(all) || []).slice(0, 5) : [];
      if (s.length) sugg.innerHTML = '<span class="hvn-row-sub">Suggested:</span>' +
        s.map(p => `<button class="hvn-chip" data-hvn="sugg" data-path="${esc(p)}">${esc(p)}</button>`).join('');
      body.innerHTML = '<div class="hvn-empty">Link a note to see its tasks and decisions here.</div>';
      return;
    }

    if (_text === null) _text = await HubVaultBridge.readNote(_path);
    const url = _obsidianUrl(_path);
    foot.innerHTML = esc(_path) + (url ? ` · <a href="${esc(url)}">Open in Obsidian</a>` : '');
    if (_text === null) {
      body.innerHTML = `<div class="hvn-empty">Note not found: ${esc(_path)}</div>`;
      return;
    }
    _render();
  }

  function _render() {
    const body = document.getElementById('hvn-body');
    _sections = (_cfg.build(_text, _path) || []).map(sec => ({
      ...sec, items: (sec.items || []).filter(it => !HubVaultBridge.isSeen(it.key)),
    }));
    const total = _sections.reduce((a, s) => a + s.items.length, 0);
    if (!total) { body.innerHTML = '<div class="hvn-empty">Nothing new in this note. Everything is already here.</div>'; return; }
    body.innerHTML = _sections.map((sec, si) => !sec.items.length ? '' : `
      <div class="hvn-sec">
        <div class="hvn-sec-head">
          <div class="hvn-sec-title">${esc(sec.title)} (${sec.items.length})</div>
          ${sec.items.length > 1 ? `<button class="hvn-btn ghost" data-hvn="addall" data-sec="${si}">${esc(sec.addAllLabel || 'Add all')}</button>` : ''}
        </div>
        ${sec.items.map((it, ii) => `
          <div class="hvn-row">
            <div class="hvn-row-main">
              <div class="hvn-row-text">${esc(it.text)}</div>
              ${it.sub ? `<div class="hvn-row-sub">${esc(it.sub)}</div>` : ''}
            </div>
            <button class="hvn-btn primary" data-hvn="add" data-sec="${si}" data-i="${ii}">${esc(it.label || 'Add')}</button>
            <button class="hvn-btn ghost" data-hvn="ignore" data-sec="${si}" data-i="${ii}" title="Don't show again">Ignore</button>
          </div>`).join('')}
      </div>`).join('');
  }

  function _item(si, ii) { const s = _sections[+si]; return s && s.items[+ii]; }

  function _accept(si, ii) {
    const it = _item(si, ii); if (!it) return;
    try { it.accept(); } catch (e) { console.error('[VaultNotes] accept:', e); return; }
    HubVaultBridge.markSeen(it.key, 'accepted');
    if (_cfg.onChange) _cfg.onChange();
    _render();
  }

  function _acceptAll(si) {
    const s = _sections[+si]; if (!s) return;
    s.items.forEach(it => {
      try { it.accept(); HubVaultBridge.markSeen(it.key, 'accepted'); } catch (e) { console.error('[VaultNotes] accept:', e); }
    });
    if (_cfg.onChange) _cfg.onChange();
    _render();
  }

  function _ignore(si, ii) {
    const it = _item(si, ii); if (!it) return;
    HubVaultBridge.markSeen(it.key, 'ignored');
    _render();
  }

  async function linkNote(path) {
    if (!_cfg) return;
    _path = HubVaultBridge.normNotePath(path);
    document.getElementById('hvn-note').value = _path.replace(/\.md$/i, '');
    _cfg.notePath = _path;
    if (_cfg.saveNote) _cfg.saveNote(_path);
    _text = null;
    await _refresh();
  }

  /** How many items are waiting, or null when the vault isn't readable. */
  async function pending(cfg) {
    if (!cfg || !cfg.notePath || typeof HubVaultBridge === 'undefined') return null;
    await ready();
    if (!HubVaultBridge.status().connected) return null;
    const path = HubVaultBridge.normNotePath(cfg.notePath);
    const text = await HubVaultBridge.readNote(path);
    if (text === null) return null;
    return (cfg.build(text, path) || []).reduce((a, s) => a + (s.items || []).filter(it => !HubVaultBridge.isSeen(it.key)).length, 0);
  }

  /** Feed any page datalist marked data-vault-notes with the note list. */
  function fillNoteLists(list) {
    document.querySelectorAll('datalist[data-vault-notes]').forEach(dl => {
      dl.innerHTML = list.map(p => `<option value="${esc(p)}">`).join('');
    });
  }

  async function primeNoteLists() {
    await ready();
    if (typeof HubVaultBridge === 'undefined' || !HubVaultBridge.status().connected) return;
    fillNoteLists(await HubVaultBridge.listNotes());
  }

  return { open, close, isOpen, pending, ready, linkNote, primeNoteLists };
})();
