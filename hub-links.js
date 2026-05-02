/**
 * hub-links.js — Cross-tool linking for Thinking Hub
 *
 * Exposes a global `HubLinks` singleton. Load this file in any tool via:
 *   <script src="hub-storage.js"></script>
 *   <script src="hub-links.js"></script>
 *
 * Storage key: hub-links-v1
 * Link shape: { id, a: {tool, itemId, label}, b: {tool, itemId, label}, createdAt }
 */

// Fallback shim: keep working if hub-storage.js failed to load.
if (typeof window.HubStorage === 'undefined') {
  window.HubStorage = {
    get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
    subscribe: () => (() => { }),
  };
}

const HubLinks = (() => {

  const STORAGE_KEY = 'hub-links-v1';

  const TOOL_NAMES = {
    'project-hub': 'Project Hub',
    'schedule': 'Schedule',
    'idea-swiper': 'Idea Swiper',
    'kmqt-board': 'KMQT Board',
    'decision-hub': 'Decision Hub'
  };

  let _currentTool = null;

  // ── Storage ────────────────────────────────────────────────────────────────

  function getAll() {
    return HubStorage.get(STORAGE_KEY) || [];
  }

  function _saveAll(links) {
    HubStorage.set(STORAGE_KEY, links);
  }

  function getLinksFor(toolId, itemId) {
    return getAll().filter(l =>
      (l.a.tool === toolId && l.a.itemId === itemId) ||
      (l.b.tool === toolId && l.b.itemId === itemId)
    );
  }

  function addLink(a, b) {
    const links = getAll();
    const dupe = links.some(l =>
      (l.a.tool === a.tool && l.a.itemId === a.itemId && l.b.tool === b.tool && l.b.itemId === b.itemId) ||
      (l.a.tool === b.tool && l.a.itemId === b.itemId && l.b.tool === a.tool && l.b.itemId === a.itemId)
    );
    if (dupe) return false;
    links.push({ id: 'lk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), a, b, createdAt: new Date().toISOString() });
    _saveAll(links);
    return true;
  }

  function removeLink(id) {
    _saveAll(getAll().filter(l => l.id !== id));
  }

  // ── Item resolver ──────────────────────────────────────────────────────────
  // Returns [{id, label, subtitle}] for all linkable items in a tool

  function resolveItems(toolId) {
    try {
      if (toolId === 'project-hub') {
        const data = HubStorage.get('project-hub-v1');
        if (!data) return [];
        const items = [];
        for (const p of (data.projects || [])) {
          for (const t of (p.tasks || [])) {
            items.push({ id: t.id, label: t.title || '(untitled)', subtitle: p.name });
          }
        }
        return items;
      }

      if (toolId === 'decision-hub') {
        const data = HubStorage.get('decision-hub-v1');
        if (!data) return [];
        return data.map(e => ({
          id: e.id,
          label: e.title || '(untitled)',
          subtitle: e.type || 'decision'
        }));
      }

      if (toolId === 'idea-swiper') {
        const history = HubStorage.get('ideaswipe_history_v6');
        if (!history) return [];
        return history
          .filter(h => h.vote === 'like' || h.vote === 'super')
          .map(h => ({
            id: String(h.ts),
            label: (h.idea || '').slice(0, 60),
            subtitle: h.vote === 'super' ? '★ super' : '♥ like'
          }));
      }

      if (toolId === 'schedule') {
        const data = HubStorage.get('schedule-v1');
        if (!data) return [];
        return (data.items || []).map(i => ({
          id: i.id,
          label: i.title || '(untitled)',
          subtitle: i.projectRef || i.type || 'item'
        }));
      }

      if (toolId === 'kmqt-board') {
        const data = HubStorage.get('kmqt_current_v2');
        if (!data) return [];
        const items = [];
        for (const col of ['K', 'M', 'Q', 'T']) {
          for (const it of (data.columns?.[col] || [])) {
            const colLabel = data.labels?.[col] || col;
            items.push({ id: it.id, label: (it.text || '').slice(0, 60), subtitle: colLabel });
          }
        }
        return items;
      }

      if (toolId === 'canvas-hub') {
        const data = HubStorage.get('canvas-v1');
        if (!data || !data.nodes) return [];
        return data.nodes
          .filter(n => n.text)
          .map(n => {
            // strip HTML tags from rich-text node content
            const tmp = n.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            return { id: n.id, label: tmp.slice(0, 60) || '(canvas node)', subtitle: 'Canvas' };
          });
      }
    } catch { }
    return [];
  }

  // ── Navigation (postMessage to hub parent) ─────────────────────────────────

  function navigateTo(toolId, itemId) {
    try {
      window.parent.postMessage({ type: 'hub-navigate', tool: toolId, itemId }, window.location.origin || '*');
    } catch { }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── CSS injection ──────────────────────────────────────────────────────────

  function _injectStyles() {
    if (document.getElementById('hl-styles')) return;
    const style = document.createElement('style');
    style.id = 'hl-styles';
    style.textContent = `
      .hl-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--text3, #6d6c78);
        cursor: pointer;
        border-radius: 5px;
        font-size: 12px;
        transition: background 0.12s, color 0.12s;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.12s, background 0.12s, color 0.12s;
      }
      .hl-btn:hover {
        background: var(--accent-dim);
        color: var(--accent);
      }

      /* Show link button on parent hover */
      .task-item:hover .hl-btn,
      .card:hover .hl-btn,
      .item:hover .hl-btn,
      .hist-item:hover .hl-btn {
        opacity: 1;
      }

      .hl-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: var(--accent-dim);
        color: var(--accent);
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--accent-glow);
        transition: background 0.12s;
        flex-shrink: 0;
        line-height: 1.4;
      }
      .hl-badge:hover { background: var(--accent-glow); }

      /* ── Link picker modal ──────────────────────────────── */
      #hl-modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 9000;
        align-items: center;
        justify-content: center;
      }
      #hl-modal-overlay.open { display: flex; }

      #hl-modal {
        background: #1a1a1f;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        width: 480px;
        max-width: 92vw;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.65);
      }

      .hl-modal-hdr {
        padding: 16px 18px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      .hl-modal-title {
        font-family: 'Syne', sans-serif;
        font-weight: 800;
        font-size: 14px;
        color: #f0efe8;
      }
      .hl-modal-close {
        background: none;
        border: none;
        color: #6d6c78;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 2px 6px;
        border-radius: 6px;
      }
      .hl-modal-close:hover { color: #f0efe8; background: rgba(255,255,255,0.07); }

      .hl-tool-tabs {
        display: flex;
        gap: 4px;
        padding: 10px 14px 0;
        overflow-x: auto;
        flex-shrink: 0;
      }
      .hl-tool-tab {
        border: 1px solid rgba(255,255,255,0.1);
        background: transparent;
        color: #9998a0;
        border-radius: 6px;
        padding: 5px 11px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.1s, color 0.1s, border-color 0.1s;
        font-family: inherit;
      }
      .hl-tool-tab:hover { background: rgba(255,255,255,0.06); color: #f0efe8; }
      .hl-tool-tab.active {
        background: var(--accent-dim);
        color: var(--accent);
        border-color: var(--accent-glow);
      }

      .hl-items-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 14px 14px;
        min-height: 0;
      }
      .hl-item-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background 0.1s, border-color 0.1s;
        margin-top: 2px;
      }
      .hl-item-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
      .hl-item-row.selected {
        background: var(--accent-dim);
        border-color: var(--accent-glow);
      }
      .hl-item-row.hl-already-linked { opacity: 0.45; cursor: default; }
      .hl-item-label {
        font-size: 13px;
        color: #f0efe8;
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hl-item-sub {
        font-size: 11px;
        color: #6d6c78;
        flex-shrink: 0;
        font-family: 'JetBrains Mono', 'DM Mono', monospace;
      }
      .hl-empty {
        text-align: center;
        color: #6d6c78;
        padding: 28px 14px;
        font-size: 13px;
        line-height: 1.6;
      }

      .hl-modal-footer {
        padding: 12px 18px;
        border-top: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .hl-selected-hint {
        font-size: 12px;
        color: #6d6c78;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hl-btn-cancel {
        padding: 7px 14px;
        background: transparent;
        color: #9998a0;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        flex-shrink: 0;
        font-family: inherit;
        transition: color 0.1s, border-color 0.1s;
      }
      .hl-btn-cancel:hover { color: #f0efe8; border-color: rgba(255,255,255,0.2); }
      .hl-btn-confirm {
        padding: 7px 16px;
        background: var(--accent);
        color: #111;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
        font-family: inherit;
        transition: opacity 0.1s;
      }
      .hl-btn-confirm:disabled { opacity: 0.35; cursor: default; }
      .hl-btn-confirm:not(:disabled):hover { opacity: 0.85; }

      /* ── Links popover ──────────────────────────────── */
      #hl-popover {
        position: fixed;
        background: #1a1a1f;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        padding: 6px;
        min-width: 230px;
        max-width: 300px;
        z-index: 8500;
        box-shadow: 0 8px 30px rgba(0,0,0,0.55);
      }
      .hl-pop-title {
        font-size: 9px;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: #6d6c78;
        padding: 4px 8px 8px;
        font-family: 'JetBrains Mono', 'DM Mono', monospace;
      }
      .hl-link-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.1s;
      }
      .hl-link-row:hover { background: rgba(255,255,255,0.06); }
      .hl-link-tool {
        font-size: 10px;
        color: var(--accent);
        flex-shrink: 0;
        font-family: 'JetBrains Mono', 'DM Mono', monospace;
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hl-link-label {
        font-size: 12px;
        color: #f0efe8;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hl-link-del {
        background: none;
        border: none;
        color: #55545c;
        cursor: pointer;
        font-size: 13px;
        padding: 0 3px;
        line-height: 1;
        flex-shrink: 0;
        transition: color 0.1s;
      }
      .hl-link-del:hover { color: #e8455a; }
    `;
    document.head.appendChild(style);
  }

  // ── Modal injection ────────────────────────────────────────────────────────

  function _injectModal() {
    if (document.getElementById('hl-modal-overlay')) return;
    const div = document.createElement('div');
    div.id = 'hl-modal-overlay';
    div.innerHTML = `
      <div id="hl-modal">
        <div class="hl-modal-hdr">
          <span class="hl-modal-title">Link to another tool</span>
          <button class="hl-modal-close" id="hl-modal-close-btn">✕</button>
        </div>
        <div class="hl-tool-tabs" id="hl-tool-tabs"></div>
        <div class="hl-items-list" id="hl-items-list"></div>
        <div class="hl-modal-footer">
          <span class="hl-selected-hint" id="hl-selected-hint">Select an item above</span>
          <button class="hl-btn-cancel" id="hl-btn-cancel">Cancel</button>
          <button class="hl-btn-confirm" id="hl-btn-confirm" disabled>Link</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    div.addEventListener('click', e => { if (e.target === div) _closePickerModal(); });
    document.getElementById('hl-modal-close-btn').onclick = _closePickerModal;
    document.getElementById('hl-btn-cancel').onclick = _closePickerModal;
    document.getElementById('hl-btn-confirm').onclick = _confirmLink;
  }

  // ── Modal state ────────────────────────────────────────────────────────────

  let _modalCtx = null;       // { fromTool, fromItemId, fromLabel }
  let _selectedTarget = null; // { tool, itemId, label }

  function openModal(fromTool, fromItemId, fromLabel) {
    _modalCtx = { fromTool, fromItemId, fromLabel };
    _selectedTarget = null;

    const tabs = document.getElementById('hl-tool-tabs');
    tabs.innerHTML = '';
    const otherTools = Object.keys(TOOL_NAMES).filter(t => t !== fromTool);
    otherTools.forEach(toolId => {
      const btn = document.createElement('button');
      btn.className = 'hl-tool-tab';
      btn.textContent = TOOL_NAMES[toolId];
      btn.dataset.tool = toolId;
      btn.onclick = () => _selectTab(toolId);
      tabs.appendChild(btn);
    });

    document.getElementById('hl-btn-confirm').disabled = true;
    document.getElementById('hl-selected-hint').textContent = 'Select an item above';
    document.getElementById('hl-modal-overlay').classList.add('open');

    if (otherTools.length > 0) _selectTab(otherTools[0]);
  }

  function _selectTab(toolId) {
    _selectedTarget = null;
    document.getElementById('hl-btn-confirm').disabled = true;
    document.getElementById('hl-selected-hint').textContent = 'Select an item above';

    document.querySelectorAll('.hl-tool-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tool === toolId)
    );

    const items = resolveItems(toolId);
    const list = document.getElementById('hl-items-list');

    if (!items.length) {
      list.innerHTML = `<div class="hl-empty">No items in <b>${_esc(TOOL_NAMES[toolId])}</b> yet.<br>Add some items there first.</div>`;
      return;
    }

    const alreadyLinkedIds = _modalCtx
      ? getLinksFor(_modalCtx.fromTool, _modalCtx.fromItemId).map(l =>
        l.a.tool === toolId ? l.a.itemId : l.b.tool === toolId ? l.b.itemId : null
      ).filter(Boolean)
      : [];

    list.innerHTML = '';
    items.forEach(item => {
      const already = alreadyLinkedIds.includes(item.id);
      const row = document.createElement('div');
      row.className = 'hl-item-row' + (already ? ' hl-already-linked' : '');
      row.innerHTML = `
        <span class="hl-item-label">${_esc(item.label)}</span>
        <span class="hl-item-sub">${_esc(item.subtitle || '')}${already ? ' · linked' : ''}</span>
      `;
      if (!already) {
        row.onclick = () => {
          document.querySelectorAll('.hl-item-row').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
          _selectedTarget = { tool: toolId, itemId: item.id, label: item.label };
          document.getElementById('hl-btn-confirm').disabled = false;
          document.getElementById('hl-selected-hint').textContent = '→ ' + item.label;
        };
      }
      list.appendChild(row);
    });
  }

  function _confirmLink() {
    if (!_modalCtx || !_selectedTarget) return;
    addLink(
      { tool: _modalCtx.fromTool, itemId: _modalCtx.fromItemId, label: _modalCtx.fromLabel },
      _selectedTarget
    );
    _closePickerModal();
    if (typeof window.__hl_onLinkChange === 'function') window.__hl_onLinkChange();
  }

  function _closePickerModal() {
    const overlay = document.getElementById('hl-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    _modalCtx = null;
    _selectedTarget = null;
  }

  // ── Popover ────────────────────────────────────────────────────────────────

  function _removePopover() {
    const existing = document.getElementById('hl-popover');
    if (existing) existing.remove();
  }

  function showLinksPopover(toolId, itemId, anchorEl) {
    _removePopover();
    const links = getLinksFor(toolId, itemId);
    if (!links.length) return;

    const pop = document.createElement('div');
    pop.id = 'hl-popover';
    pop.innerHTML = `<div class="hl-pop-title">Linked items</div>`;

    links.forEach(link => {
      const other = (link.a.tool === toolId && link.a.itemId === itemId) ? link.b : link.a;
      const row = document.createElement('div');
      row.className = 'hl-link-row';
      row.innerHTML = `
        <span class="hl-link-tool">${_esc(TOOL_NAMES[other.tool] || other.tool)}</span>
        <span class="hl-link-label">${_esc(other.label)}</span>
        <button class="hl-link-del" title="Remove link">✕</button>
      `;
      const delBtn = row.querySelector('.hl-link-del');
      delBtn.onclick = e => {
        e.stopPropagation();
        removeLink(link.id);
        _removePopover();
        if (typeof window.__hl_onLinkChange === 'function') window.__hl_onLinkChange();
      };
      row.onclick = e => {
        if (e.target === delBtn) return;
        _removePopover();
        navigateTo(other.tool, other.itemId);
      };
      pop.appendChild(row);
    });

    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    const popW = 250;
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    pop.style.top = (rect.bottom + 6) + 'px';
    pop.style.left = Math.max(8, left) + 'px';

    setTimeout(() => {
      document.addEventListener('click', _removePopover, { once: true });
    }, 0);
  }

  // ── Highlight ──────────────────────────────────────────────────────────────

  function _highlightItem(itemId) {
    const el = document.querySelector(`[data-id="${itemId}"], [data-task-id="${itemId}"], [data-ts="${itemId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prev = el.style.transition;
    el.style.transition = 'box-shadow 0.25s';
    el.style.boxShadow = '0 0 0 2px var(--accent), 0 0 16px var(--accent-glow)';
    setTimeout(() => {
      el.style.boxShadow = '';
      el.style.transition = prev;
    }, 2200);
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(toolId) {
    _currentTool = toolId;
    _injectStyles();
    _injectModal();
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'hub-highlight' && e.data.itemId) {
        _highlightItem(e.data.itemId);
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    init,
    getAll,
    getLinksFor,
    addLink,
    removeLink,
    resolveItems,
    navigateTo,
    openModal,
    showLinksPopover
  };

})();
