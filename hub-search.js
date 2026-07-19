/**
 * hub-search.js — Unified Global Search for Thinking Hub
 * 
 * Includes the Cmd+K UI overlay and the cross-tool search logic.
 */

window.HubSearch = (() => {

  const TOOLS = [
    'project-hub', 'schedule', 'idea-swiper', 'decision-hub', 'canvas-hub',
    'meetings-hub', 'goals-hub', 'risk-hub', 'learning-hub', 'retro-hub', 'stakeholder-hub', 'argument-hub',
    'tags-hub', 'reflection-hub', 'tool-portfolio', 'journal-hub', 'focus-hub'
  ];

  function init() {
    _injectStyles();
    _injectModal();
    
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && _isOpen) {
        closeSearch();
      }
    });

    // Listen to iframe keydowns as well
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'hub-search-hotkey') {
        openSearch();
      }
    });
  }

  let _isOpen = false;
  let _selectedIndex = -1;
  let _results = [];

  function openSearch() {
    _isOpen = true;
    document.getElementById('hub-search-overlay').style.display = 'flex';
    const input = document.getElementById('hub-search-input');
    input.value = '';
    input.focus();
    renderResults('');
  }

  function closeSearch() {
    _isOpen = false;
    document.getElementById('hub-search-overlay').style.display = 'none';
  }

  function doSearch(query) {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase();
    const results = [];
    
    // Ensure HubLinks exists
    if (typeof HubLinks === 'undefined') return [];

    TOOLS.forEach(tool => {
      const items = HubLinks.resolveItems(tool);
      items.forEach(item => {
        if ((item.label && item.label.toLowerCase().includes(q)) || 
            (item.subtitle && item.subtitle.toLowerCase().includes(q))) {
          results.push({ tool, ...item });
        }
      });
    });

    return results;
  }

  // Quick actions: `task: …`, `capture: …`, `decide: …`, or bare `focus`.
  // Parsed first and shown as a distinct row above search results.
  function parseAction(query) {
    const q = (query || '').trim();
    const m = q.match(/^(task|capture|decide)\s*:\s*(.+)$/i);
    if (m) return { type: m[1].toLowerCase(), text: m[2].trim() };
    if (/^focus\s*:?\s*$/i.test(q)) return { type: 'focus', text: '' };
    return null;
  }

  function _actionMeta(a) {
    const t = _esc(a.text);
    switch (a.type) {
      case 'task': return { icon: '✓', label: `New task: “${t}”`, sub: '→ Capture Hub' };
      case 'capture': return { icon: '⊕', label: `Capture: “${t}”`, sub: '→ Capture Hub' };
      case 'decide': return { icon: '⊖', label: `Log decision: “${t}”`, sub: '→ Decision Hub' };
      case 'focus': return { icon: '◷', label: 'Start Focus', sub: '→ Focus Timer' };
      default: return { icon: '›', label: t, sub: '' };
    }
  }

  function renderResults(query) {
    const action = parseAction(query);
    const searchResults = doSearch(query);
    _results = action ? [{ _isAction: true, ...action }, ...searchResults] : searchResults;

    const list = document.getElementById('hub-search-list');
    list.innerHTML = '';
    _selectedIndex = _results.length > 0 ? 0 : -1;

    if (!_results.length) {
      list.innerHTML = !query
        ? '<div class="hs-empty">Type to search — or run a quick action:<br><b>task:</b> …&nbsp;&nbsp;<b>capture:</b> …&nbsp;&nbsp;<b>decide:</b> …&nbsp;&nbsp;<b>focus</b></div>'
        : '<div class="hs-empty">No results found for "' + _esc(query) + '"</div>';
      return;
    }

    let globalIndex = 0;

    // Action row first (distinct style)
    if (_results[0] && _results[0]._isAction) {
      const meta = _actionMeta(_results[0]);
      const row = document.createElement('div');
      row.className = 'hs-row hs-action-row selected';
      row.dataset.index = globalIndex;
      row.innerHTML = `
        <div class="hs-row-label"><span class="hs-action-icon">${meta.icon}</span> ${meta.label}</div>
        <div class="hs-row-sub">${_esc(meta.sub)}</div>
      `;
      const idx = globalIndex;
      row.onmouseover = () => setSelection(idx);
      row.onclick = () => selectItem(idx);
      list.appendChild(row);
      globalIndex++;
    }

    // Group the search results by tool (same TOOLS order as doSearch → index-aligned)
    const groups = {};
    _results.forEach(r => {
      if (r._isAction) return;
      if (!groups[r.tool]) groups[r.tool] = [];
      groups[r.tool].push(r);
    });

    for (const tool of TOOLS) {
      if (!groups[tool]) continue;

      const groupHeader = document.createElement('div');
      groupHeader.className = 'hs-group-header';
      const appInfo = (typeof APPS !== 'undefined' ? APPS.find(a => a.id === tool) : null);
      groupHeader.textContent = appInfo ? `${appInfo.icon} ${appInfo.label}` : tool.replace('-', ' ').toUpperCase();
      list.appendChild(groupHeader);

      groups[tool].forEach(item => {
        const row = document.createElement('div');
        row.className = 'hs-row' + (globalIndex === 0 ? ' selected' : '');
        row.dataset.index = globalIndex;
        row.innerHTML = `
          <div class="hs-row-label">${_esc(item.label)}</div>
          <div class="hs-row-sub">${_esc(item.subtitle)}</div>
        `;

        const idx = globalIndex;
        row.onmouseover = () => setSelection(idx);
        row.onclick = () => selectItem(idx);

        list.appendChild(row);
        globalIndex++;
      });
    }
  }

  function setSelection(index) {
    _selectedIndex = index;
    const rows = document.querySelectorAll('.hs-row');
    rows.forEach(r => r.classList.remove('selected'));
    const selected = document.querySelector(`.hs-row[data-index="${index}"]`);
    if (selected) {
      selected.classList.add('selected');
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectItem(index) {
    if (index < 0 || index >= _results.length) return;
    const item = _results[index];
    if (item._isAction) { executeAction(item); return; }
    closeSearch();
    _navigate(item.tool, item.id);
  }

  function _navigate(tool, itemId) {
    if (typeof window.openApp !== 'function') return;
    window.openApp(tool);
    if (itemId) {
      setTimeout(() => {
        const frame = document.getElementById('app-frame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'hub-highlight', itemId }, window.location.origin || '*');
        }
      }, 500);
    }
  }

  function executeAction(action) {
    closeSearch();
    const ts = new Date().toISOString();
    const toast = (m) => { if (typeof window.showToast === 'function') window.showToast(m); };
    try {
      if (action.type === 'task' || action.type === 'capture') {
        const raw = HubStorage.get('capture-hub-v1') || { inbox: [] };
        if (!Array.isArray(raw.inbox)) raw.inbox = [];
        raw.inbox.unshift({
          id: 'cap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          text: action.text,
          cat: action.type === 'task' ? 'task' : null,
          capturedAt: ts,
        });
        HubStorage.set('capture-hub-v1', raw);
        toast('Captured — route it in Capture Hub');
      } else if (action.type === 'decide') {
        const decisions = HubStorage.get('decision-hub-v1') || [];
        const arr = Array.isArray(decisions) ? decisions : [];
        const id = 'dh-' + Date.now();
        arr.push({ id, title: action.text, summary: '', status: 'open', confidence: 'medium', projectId: null, createdAt: ts });
        HubStorage.set('decision-hub-v1', arr);
        toast('Decision logged');
        _navigate('decision-hub', id);
      } else if (action.type === 'focus') {
        _navigate('focus-hub', null);
      }
    } catch (e) {
      toast('Action failed: ' + (e.message || e));
    }
  }

  const _esc = typeof HubUtils !== 'undefined' ? HubUtils.esc
    : str => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function _injectModal() {
    if (document.getElementById('hub-search-overlay')) return;
    const div = document.createElement('div');
    div.id = 'hub-search-overlay';
    div.innerHTML = `
      <div id="hub-search-modal">
        <div class="hs-input-wrap">
          <span class="hs-icon">🔍</span>
          <input type="text" id="hub-search-input" placeholder="Search Thinking Hub... (Cmd+K)" autocomplete="off" spellcheck="false">
        </div>
        <div id="hub-search-list">
          <div class="hs-empty">Type to search — or run a quick action:<br><b>task:</b> …&nbsp;&nbsp;<b>capture:</b> …&nbsp;&nbsp;<b>decide:</b> …&nbsp;&nbsp;<b>focus</b></div>
        </div>
        <div class="hs-footer">
          Navigate with <span>↑</span> <span>↓</span> and press <span>Enter</span> to select
        </div>
      </div>
    `;
    document.body.appendChild(div);

    const input = document.getElementById('hub-search-input');
    
    div.addEventListener('click', e => {
      if (e.target === div) closeSearch();
    });

    input.addEventListener('input', e => {
      renderResults(e.target.value);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_selectedIndex < _results.length - 1) setSelection(_selectedIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_selectedIndex > 0) setSelection(_selectedIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(_selectedIndex);
      }
    });
  }

  function _injectStyles() {
    if (document.getElementById('hs-style')) return;
    const style = document.createElement('style');
    style.id = 'hs-style';
    style.textContent = `
      #hub-search-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: none; align-items: flex-start; justify-content: center; z-index: 10000;
        padding-top: 15vh;
      }
      #hub-search-modal {
        width: 600px; max-width: 90vw; background: #1a1a1f; 
        border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4); display: flex; flex-direction: column;
        overflow: hidden;
      }
      .hs-input-wrap {
        display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .hs-icon { opacity: 0.5; font-size: 18px; margin-right: 12px; }
      #hub-search-input {
        flex: 1; border: none; background: transparent; color: #f0efe8;
        font-family: 'DM Sans', sans-serif; font-size: 18px; padding: 18px 0; outline: none;
      }
      #hub-search-input::placeholder { color: #6d6c78; }
      #hub-search-list {
        max-height: 400px; overflow-y: auto; padding: 10px 0;
      }
      .hs-empty { padding: 30px 20px; text-align: center; color: #6d6c78; font-size: 14px; }
      .hs-group-header {
        font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800; color: #6d6c78;
        text-transform: uppercase; letter-spacing: 1.5px; padding: 12px 16px 6px;
      }
      .hs-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 16px; cursor: pointer; border-left: 3px solid transparent;
      }
      .hs-row.selected { background: var(--accent-dim); border-left-color: var(--accent); }
      .hs-action-row { border-left-color: var(--accent); background: var(--accent-dim); }
      .hs-action-row .hs-row-label { font-weight: 600; }
      .hs-action-icon {
        display: inline-block; width: 18px; text-align: center; color: var(--accent);
        font-family: monospace; margin-right: 4px;
      }
      .hs-row-label { font-size: 14px; color: #f0efe8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
      .hs-row-sub { font-size: 12px; color: #6d6c78; white-space: nowrap; margin-left: 10px; font-family: monospace; }
      .hs-footer {
        padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.08);
        font-size: 11px; color: #6d6c78; background: rgba(0,0,0,0.2);
        display: flex; align-items: center; gap: 8px;
      }
      .hs-footer span {
        background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  return { init, openSearch, closeSearch, search: doSearch };
})();
