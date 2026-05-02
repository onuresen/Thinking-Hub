/**
 * hub-storage.js — Pluggable storage adapter for Thinking Hub
 *
 * Provides a unified get/set/subscribe interface that works in two modes:
 *   - "local"  : pure localStorage (default, zero-config, works offline)
 *   - "cloud"  : Supabase-backed with real-time sync across collaborators
 *
 * Architecture: write-through cache
 *   - get()  is always synchronous (reads from localStorage cache)
 *   - set()  writes localStorage immediately, then mirrors to Supabase async
 *   - Real-time subscriptions push remote changes into localStorage and
 *     fire registered callbacks — tools need no changes to their read paths.
 *
 * Load order: this file must come before hub-links.js and hub-data.js.
 *
 * Usage:
 *   <script src="hub-storage.js"></script>
 *   // Default: localStorage mode, works immediately
 *   HubStorage.get('my-key');
 *   HubStorage.set('my-key', { foo: 'bar' });
 *   HubStorage.subscribe('my-key', (value) => console.log('changed', value));
 *
 *   // Connect to Supabase (from hub.html cloud panel):
 *   await HubStorage.useSupabase('https://xxx.supabase.co', 'anon-key', 'ws-id');
 */
window.HubStorage = (() => {

  // ── State ─────────────────────────────────────────────────────────────────

  let _supabaseClient  = null;   // Supabase JS client (null = local mode)
  let _workspaceId     = null;   // Namespaces all cloud writes
  let _connected       = false;
  let _subscribers     = {};     // key -> Set of callback functions
  let _realtimeSubs    = {};     // key -> Supabase realtime channel handle
  let _writeQueue      = [];     // { key, value } pairs missed while offline
  let _statusListeners = [];     // callbacks for connection state changes
  let _storageListener = null;   // window 'storage' event handler

  const CONFIG_KEY = 'hub-cloud-config-v1';

  // ── Core: get (synchronous, always localStorage) ──────────────────────────

  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // ── Core: set (write-through cache) ──────────────────────────────────────

  function set(key, value) {
    // 1. Write to localStorage immediately — callers get synchronous feedback
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('[HubStorage] localStorage write failed:', e);
    }

    // 2. Notify same-tab subscribers directly
    //    (window 'storage' event only fires in OTHER tabs)
    _notifySubscribers(key, value);

    // 3. Mirror to Supabase async (fire-and-forget with queue on failure)
    if (_connected && _supabaseClient) {
      _pushToSupabase(key, value).catch(err => {
        console.warn('[HubStorage] push failed, queuing for retry:', key, err);
        _writeQueue.push({ key, value });
      });
    }
  }

  // ── Core: subscribe ───────────────────────────────────────────────────────
  // Registers fn to be called whenever key changes (locally OR from remote).
  // Returns an unsubscribe function.

  function subscribe(key, fn) {
    if (!_subscribers[key]) _subscribers[key] = new Set();
    _subscribers[key].add(fn);

    // If already connected to Supabase, set up realtime for this key
    if (_connected) _ensureRealtimeSub(key);

    return () => {
      if (_subscribers[key]) _subscribers[key].delete(fn);
    };
  }

  // ── Connect to Supabase ───────────────────────────────────────────────────

  async function useSupabase(supabaseUrl, anonKey, workspaceId) {
    // Dynamically load Supabase JS SDK from CDN if not already present
    if (!window.supabase) {
      await _loadScript(
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
      );
    }

    if (!window.supabase) {
      throw new Error('Supabase SDK failed to load from CDN');
    }

    _supabaseClient = window.supabase.createClient(supabaseUrl, anonKey, {
      realtime: { params: { eventsPerSecond: 10 } }
    });

    _workspaceId = workspaceId || _generateWorkspaceId();
    _connected   = true;

    // Persist config so connection survives page reload
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        url: supabaseUrl,
        key: anonKey,
        workspaceId: _workspaceId
      }));
    } catch {}

    // Subscribe realtime for all already-registered keys
    for (const key of Object.keys(_subscribers)) {
      if (_subscribers[key].size > 0) _ensureRealtimeSub(key);
    }

    // Set up cross-tab storage listener (belt-and-suspenders)
    _attachStorageListener();

    // Flush any pending writes from before connect
    await _flushWriteQueue();

    _notifyStatusListeners();
    return { workspaceId: _workspaceId };
  }

  // ── Disconnect ────────────────────────────────────────────────────────────

  function disconnect() {
    // Tear down realtime channels
    for (const ch of Object.values(_realtimeSubs)) {
      try { _supabaseClient.removeChannel(ch); } catch {}
    }
    _realtimeSubs = {};

    // Remove window storage listener
    if (_storageListener) {
      window.removeEventListener('storage', _storageListener);
      _storageListener = null;
    }

    _supabaseClient = null;
    _workspaceId    = null;
    _connected      = false;
    _writeQueue     = [];

    // Remove persisted config
    try { localStorage.removeItem(CONFIG_KEY); } catch {}

    _notifyStatusListeners();
  }

  // ── Migration helpers (used by hub.html) ─────────────────────────────────

  async function migrateToCloud(keys) {
    if (!_connected) throw new Error('Not connected to Supabase');
    for (const key of keys) {
      const value = get(key);
      if (value !== null) {
        await _pushToSupabase(key, value);
      }
    }
  }

  async function pullFromCloud() {
    if (!_connected || !_supabaseClient) throw new Error('Not connected to Supabase');
    const { data, error } = await _supabaseClient
      .from('workspace_data')
      .select('key, value')
      .eq('workspace_id', _workspaceId);

    if (error) throw error;

    for (const row of (data || [])) {
      try {
        const parsed = JSON.parse(row.value);
        localStorage.setItem(row.key, JSON.stringify(parsed));
      } catch {}
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  function getStatus() {
    return {
      mode:        _connected ? 'cloud' : 'local',
      workspaceId: _workspaceId,
      connected:   _connected,
    };
  }

  function onStatusChange(fn) {
    _statusListeners.push(fn);
    return () => { _statusListeners = _statusListeners.filter(l => l !== fn); };
  }

  // ── Private: Supabase push ────────────────────────────────────────────────

  async function _pushToSupabase(key, value) {
    if (value === null || value === undefined) {
      // Delete the row if value is null
      const { error } = await _supabaseClient
        .from('workspace_data')
        .delete()
        .eq('workspace_id', _workspaceId)
        .eq('key', key);
      if (error) throw error;
    } else {
      const { error } = await _supabaseClient
        .from('workspace_data')
        .upsert({
          workspace_id: _workspaceId,
          key,
          value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        }, { onConflict: 'workspace_id,key' });
      if (error) throw error;
    }
  }

  // ── Private: realtime subscription per key ────────────────────────────────

  function _ensureRealtimeSub(key) {
    if (_realtimeSubs[key] || !_supabaseClient) return;

    const channel = _supabaseClient
      .channel(`hub-${_workspaceId}-${key}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'workspace_data',
          filter: `workspace_id=eq.${_workspaceId}`
        },
        payload => {
          // Only process changes for this key
          const changedKey = payload.new?.key || payload.old?.key;
          if (changedKey !== key) return;

          if (payload.eventType === 'DELETE') {
            try { localStorage.removeItem(key); } catch {}
            _notifySubscribers(key, null);
            return;
          }

          // Parse the remote value
          let remoteValue;
          try { remoteValue = JSON.parse(payload.new.value); }
          catch { return; }

          // Self-echo prevention: skip if our localStorage already matches
          const currentRaw = localStorage.getItem(key);
          const remoteRaw  = JSON.stringify(remoteValue);
          if (currentRaw === remoteRaw) return;

          // Apply remote change to localStorage cache, then notify
          try { localStorage.setItem(key, remoteRaw); } catch {}
          _notifySubscribers(key, remoteValue);
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          // Channel is live
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[HubStorage] realtime channel error for key:', key);
        }
      });

    _realtimeSubs[key] = channel;
  }

  // ── Private: cross-tab storage event listener ────────────────────────────
  // Handles writes from tool pages that write directly to localStorage
  // (e.g. before being updated to use HubStorage.set)

  function _attachStorageListener() {
    if (_storageListener) return;
    _storageListener = e => {
      if (!e.key || !_subscribers[e.key]) return;
      let value = null;
      try { value = e.newValue ? JSON.parse(e.newValue) : null; } catch {}
      _notifySubscribers(e.key, value);
      // Also mirror to Supabase if connected and this key is a collaboration key
      if (_connected && value !== null) {
        _pushToSupabase(e.key, value).catch(() => {});
      }
    };
    window.addEventListener('storage', _storageListener);
  }

  // ── Private: notify subscribers ──────────────────────────────────────────

  function _notifySubscribers(key, value) {
    const subs = _subscribers[key];
    if (!subs || subs.size === 0) return;
    subs.forEach(fn => {
      try { fn(value, key); }
      catch (e) { console.warn('[HubStorage] subscriber error for key:', key, e); }
    });
  }

  function _notifyStatusListeners() {
    const status = getStatus();
    _statusListeners.forEach(fn => {
      try { fn(status); } catch {}
    });
  }

  // ── Private: write queue flush ────────────────────────────────────────────

  async function _flushWriteQueue() {
    const pending = [..._writeQueue];
    _writeQueue = [];
    for (const item of pending) {
      const retries = (item.retries || 0) + 1;
      try {
        await _pushToSupabase(item.key, item.value);
      } catch {
        if (retries < 3) {
          _writeQueue.push({ ...item, retries });
        } else {
          console.warn('[HubStorage] dropping queued item after 3 failures:', item.key);
        }
      }
    }
  }

  // ── Private: workspace ID generator ──────────────────────────────────────

  function _generateWorkspaceId() {
    return 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ── Private: dynamic script loader ───────────────────────────────────────

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { resolve(); return; }
      const s = document.createElement('script');
      const timer = setTimeout(() => reject(new Error('Script load timeout: ' + src)), 10000);
      s.src = src;
      s.onload  = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => { clearTimeout(timer); reject(new Error('Failed to load: ' + src)); };
      document.head.appendChild(s);
    });
  }

  // ── Auto-restore: reconnect on page load if config exists ────────────────

  function _restoreFromConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (cfg && cfg.url && cfg.key && cfg.workspaceId) {
        // Async reconnect — non-blocking, page works in local mode until done
        useSupabase(cfg.url, cfg.key, cfg.workspaceId).catch(err => {
          console.warn('[HubStorage] auto-reconnect failed:', err);
          // Clear bad config so we don't retry forever
          try { localStorage.removeItem(CONFIG_KEY); } catch {}
        });
      }
    } catch {}
  }

  // Kick off auto-restore immediately (synchronous config read, async connect)
  _restoreFromConfig();

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    get,
    set,
    subscribe,
    useSupabase,
    disconnect,
    getStatus,
    onStatusChange,
    migrateToCloud,
    pullFromCloud,
  };

})();
