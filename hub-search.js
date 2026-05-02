/**
 * hub-search.js — Unified Global Search for Thinking Hub
 * 
 * Includes the Cmd+K UI overlay and the cross-tool search logic.
 */

const HubSearch = (() => {

  const TOOLS = ['project-hub', 'schedule', 'idea-swiper', 'kmqt-board', 'decision-hub', 'canvas-hub'];

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

  function renderResults(query) {
    _results = doSearch(query);
    const list = document.getElementById('hub-search-list');
    list.innerHTML = '';
    _selectedIndex = _results.length > 0 ? 0 : -1;

    if (!query) {
      list.innerHTML = '<div class="hs-empty">Type to search projects, tasks, ideas, decisions...</div>';
      return;
    }

    if (_results.length === 0) {
      list.innerHTML = '<div class="hs-empty">No results found for "' + _esc(query) + '"</div>';
      return;
    }

    // Group by tool
    const groups = {};
    _results.forEach(r => {
      if (!groups[r.tool]) groups[r.tool] = [];
      groups[r.tool].push(r);
    });

    let globalIndex = 0;

    for (const tool of TOOLS) {
      if (!groups[tool]) continue;
      
      const groupHeader = document.createElement('div');
      groupHeader.className = 'hs-group-header';
      // Use label from APPS array if available, else format nicely
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
    closeSearch();
    if (typeof window.openApp === 'function') {
      window.openApp(item.tool);
      // Wait for app load
      setTimeout(() => {
        const frame = document.getElementById('app-frame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'hub-highlight', itemId: item.id }, window.location.origin || '*');
        }
      }, 500);
    }
  }

  function _esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

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
          <div class="hs-empty">Type to search projects, tasks, ideas, decisions...</div>
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
