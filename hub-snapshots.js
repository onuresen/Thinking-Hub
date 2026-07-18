/**
 * hub-snapshots.js — rolling local snapshots for Thinking Hub (P84).
 *
 * Automatic daily snapshots of ALL localStorage keys into IndexedDB
 * (gigabytes of quota vs localStorage's ~5 MB), with point-in-time restore.
 * 100% local — nothing leaves the machine (standing no-cloud decision, P84).
 *
 * Snapshotting every key verbatim (raw strings) means there is no key list
 * to drift out of date — the lesson from the P81 backup-key audit.
 *
 * Retention: daily snapshots kept 14 days; older ones kept only if taken on
 * a Monday; everything auto-pruned after 60 days. Manual + safety snapshots
 * ("pre-restore" / "pre-repair") keep the newest 10.
 *
 * API (loaded in index.html only):
 *   HubSnapshots.init()            — take today's auto snapshot if due + prune
 *   HubSnapshots.take(label)       — manual/safety snapshot, returns id
 *   HubSnapshots.list()            — [{id, label, takenAt, keyCount, bytes}]
 *   HubSnapshots.restore(id)       — overwrite localStorage from snapshot
 *                                    (caller confirms + reloads; a
 *                                    'pre-restore' safety snapshot is taken
 *                                    automatically first)
 */

window.HubSnapshots = (() => {
  const DB_NAME = 'thinking-hub-snapshots';
  const STORE = 'snapshots';
  const DAY_MS = 86400000;

  function _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function _tx(db, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const out = fn(store);
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  }

  function _captureAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      data[k] = localStorage.getItem(k);
    }
    return data;
  }

  function _sizeOf(data) {
    let bytes = 0;
    for (const [k, v] of Object.entries(data)) bytes += (k.length + (v || '').length) * 2;
    return bytes;
  }

  async function take(label) {
    const db = await _open();
    const now = new Date();
    const isAuto = label === 'auto';
    const id = isAuto ? 'auto-' + now.toISOString().slice(0, 10) : `${label}-${now.getTime()}`;
    const data = _captureAll();
    const rec = {
      id, label: label || 'manual',
      takenAt: now.toISOString(),
      keyCount: Object.keys(data).length,
      bytes: _sizeOf(data),
      data,
    };
    await _tx(db, 'readwrite', (s) => s.put(rec));
    db.close();
    return id;
  }

  async function list() {
    const db = await _open();
    const all = await _tx(db, 'readonly', (s) => s.getAll());
    db.close();
    return (all || [])
      .map(({ id, label, takenAt, keyCount, bytes }) => ({ id, label, takenAt, keyCount, bytes }))
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }

  async function restore(id) {
    const db = await _open();
    const rec = await _tx(db, 'readonly', (s) => s.get(id));
    db.close();
    if (!rec || !rec.data) throw new Error('Snapshot not found: ' + id);
    await take('pre-restore'); // safety net: the current state is itself snapshotted
    // Overwrite every snapshotted key; remove keys that didn't exist back then
    // (excluding this-session ephemera would risk resurrecting stale state).
    const current = Object.keys(localStorage);
    for (const k of current) {
      if (!(k in rec.data)) localStorage.removeItem(k);
    }
    for (const [k, v] of Object.entries(rec.data)) localStorage.setItem(k, v);
    return rec.takenAt;
  }

  async function _prune() {
    const db = await _open();
    const all = await _tx(db, 'readonly', (s) => s.getAll());
    const now = Date.now();
    const toDelete = [];
    const autos = [];
    const others = [];
    (all || []).forEach((r) => (r.label === 'auto' ? autos : others).push(r));

    autos.forEach((r) => {
      const age = now - new Date(r.takenAt).getTime();
      const isMonday = new Date(r.takenAt).getDay() === 1;
      if (age > 60 * DAY_MS) toDelete.push(r.id);
      else if (age > 14 * DAY_MS && !isMonday) toDelete.push(r.id);
    });
    others.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      .slice(10).forEach((r) => toDelete.push(r.id));

    if (toDelete.length) {
      await _tx(db, 'readwrite', (s) => { toDelete.forEach((id) => s.delete(id)); });
    }
    db.close();
  }

  async function init() {
    try {
      if (!('indexedDB' in window)) return;
      const todayId = 'auto-' + new Date().toISOString().slice(0, 10);
      const db = await _open();
      const existing = await _tx(db, 'readonly', (s) => s.get(todayId));
      db.close();
      if (!existing) await take('auto');
      await _prune();
    } catch (e) {
      console.warn('[HubSnapshots] init failed:', e);
    }
  }

  return { init, take, list, restore };
})();
