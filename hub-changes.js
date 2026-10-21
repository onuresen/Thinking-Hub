/**
 * hub-changes.js — apply a change file on top of live data, after review (P163).
 *
 * Full Backup import replaces every key. That made each Claude reconciliation
 * pass a full round trip: export → pass → import. Anything edited in between
 * was lost, and a pass that was never imported was lost too (the 10-19 pass).
 *
 * A change file carries only the changes, each one aimed at an item by id:
 *
 *   { "format": "thinking-hub-changes", "version": 1,
 *     "id": "2026-10-21-cards", "title": "…", "createdAt": "…", "source": "…",
 *     "changes": [
 *       { "op": "add",    "key": "stakeholder-hub-v1", "path": ["stakeholders"], "value": {…}, "label": "…" },
 *       { "op": "set",    "key": "project-hub-v1", "path": ["projects", {"id": "p1"}],
 *         "field": "status", "from": "active", "to": "done", "label": "…" },
 *       { "op": "unset",  …, "field": "…", "from": … },
 *       { "op": "remove", …, "path": ["meetings", {"id": "m9"}], "expect": {"title": "…"} } ] }
 *
 * Each change gets a status against the live data before anything is written:
 *   new       — will apply
 *   conflict  — the field is no longer what the file expected (`from`/`expect`):
 *               it was edited since. Not selected unless the user ticks it.
 *   done      — already true (applied before, or the user did the same)
 *   exists    — an add whose id is already there with other content
 *   missing   — the target is gone (e.g. its project was deleted)
 * So a file can be applied twice, or after other edits, without harm.
 *
 * Trust: same as a Full Backup — apply files you or your own passes wrote.
 * The preview shows every change, and a snapshot is taken first (index.html).
 *
 * No DOM here, so tests can drive the same code. The review UI is index.html.
 *
 * API:
 *   HubChanges.validate(doc)              — { ok, errors }
 *   HubChanges.plan(doc, read)            — rows with a status each, in file order
 *   HubChanges.apply(doc, picked, read)   — { values, applied, skipped }; caller writes values
 *   HubChanges.scanVault()                — change files in the vault folder (needs HubVaultBridge)
 *   HubChanges.toolLabel(key)             — "Projects", "Meetings", …
 */

window.HubChanges = (() => {
  const FORMAT = 'thinking-hub-changes';
  const MAX_CHANGES = 5000;

  // The Full Backup keys (SCOPE_KEYS.full in index.html), minus settings (home
  // of the API key) and the activity log. A pass has no business in either.
  const KEYS = {
    'project-hub-v1': 'Projects', 'goals-hub-v1': 'Goals', 'decision-hub-v1': 'Decisions',
    'review-hub-v1': 'Weekly Review', 'risk-hub-v1': 'Risks', 'meetings-hub-v1': 'Meetings',
    'assumptions-hub-v1': 'Assumptions', 'schedule-v1': 'Schedule', 'learning-hub-v1': 'Learning',
    'matrix-hub-v1': 'Priority Matrix', 'stakeholder-hub-v1': 'Stakeholders',
    'focus-hub-v1': 'Focus', 'log-hub-v1': 'Daily Log', 'canvas-v1': 'Canvas',
    'ideaswipe_history_v6': 'Idea Swiper', 'hub-links-v1': 'Links',
    'tool-portfolio-v1': 'Tool Portfolio', 'hub-tags-v1': 'Tags', 'capture-hub-v1': 'Capture',
    'people-hub-v1': 'People', 'hub-vault-bridge-v1': 'Vault Bridge',
  };
  const BAD_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

  function toolLabel(key) { return KEYS[key] || key; }

  // ── value helpers ───────────────────────────────────────────────────────────

  // {"$absent": true} stands for "this field does not exist" in `from`.
  function isAbsent(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v)
      && v.$absent === true && Object.keys(v).length === 1;
  }

  // ICS import writes null, a form writes '', an old record has no field at all.
  // For a field they all mean "nothing here", so a check must not trip on them.
  function isEmpty(v) {
    return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || isAbsent(v);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
    return true;
  }

  function same(a, b) { return (isEmpty(a) && isEmpty(b)) || deepEqual(a, b); }

  function clone(v) {
    if (v === undefined) return undefined;
    return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  }

  // ── validation ──────────────────────────────────────────────────────────────

  function _segOk(seg) {
    if (typeof seg === 'string') return !BAD_NAMES.has(seg);
    if (!seg || typeof seg !== 'object' || Array.isArray(seg)) return false;
    const ks = Object.keys(seg);
    return ks.length === 1 && !BAD_NAMES.has(ks[0])
      && (typeof seg[ks[0]] === 'string' || typeof seg[ks[0]] === 'number');
  }

  function validate(doc) {
    const errors = [];
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['Not a change file.'] };
    if (doc.format !== FORMAT) errors.push('Not a change file (format).');
    if (doc.version !== 1) errors.push('Unknown change file version: ' + doc.version);
    if (typeof doc.id !== 'string' || !doc.id.trim() || doc.id.length > 120) errors.push('Missing or bad id.');
    if (!Array.isArray(doc.changes)) errors.push('No changes list.');
    else if (doc.changes.length > MAX_CHANGES) errors.push('Too many changes (' + doc.changes.length + ').');
    if (errors.length) return { ok: false, errors };

    doc.changes.forEach((ch, i) => {
      const at = `Change ${i + 1}: `;
      if (!ch || typeof ch !== 'object') { errors.push(at + 'not an object.'); return; }
      if (!['add', 'set', 'unset', 'remove'].includes(ch.op)) errors.push(at + 'unknown op ' + ch.op);
      if (!KEYS[ch.key]) errors.push(at + 'key not allowed: ' + ch.key);
      if (!Array.isArray(ch.path) || !ch.path.every(_segOk)) errors.push(at + 'bad path.');
      if ((ch.op === 'set' || ch.op === 'unset')
        && (typeof ch.field !== 'string' || !ch.field || BAD_NAMES.has(ch.field))) errors.push(at + 'bad field.');
      if (ch.op === 'set' && !('to' in ch)) errors.push(at + 'set without "to".');
      if (ch.op === 'add' && ch.value === undefined) errors.push(at + 'add without "value".');
      if (ch.op === 'remove' && !(Array.isArray(ch.path) && ch.path.length
        && typeof ch.path[ch.path.length - 1] === 'object')) errors.push(at + 'remove needs an item path.');
    });
    return { ok: !errors.length, errors };
  }

  // ── path resolution ─────────────────────────────────────────────────────────

  // Walks the path. Returns { parent, at, node } for the last segment, or null.
  function _resolve(root, path) {
    let parent = null, at = null, node = root;
    for (const seg of path) {
      if (typeof seg === 'string') {
        if (!node || typeof node !== 'object' || Array.isArray(node)
          || !Object.prototype.hasOwnProperty.call(node, seg)) return null;
        parent = node; at = seg; node = node[seg];
      } else {
        if (!Array.isArray(node)) return null;
        const k = Object.keys(seg)[0];
        const idx = node.findIndex(x => x && typeof x === 'object' && x[k] === seg[k]);
        if (idx === -1) return null;
        parent = node; at = idx; node = node[idx];
      }
    }
    return { parent, at, node };
  }

  // An add into a list field the record does not have yet ("actionItems" on a
  // meeting from an old import) creates that list instead of failing.
  function _addTarget(root, path) {
    const r = _resolve(root, path);
    if (r) return Array.isArray(r.node) ? { list: r.node } : null;
    const last = path[path.length - 1];
    if (typeof last !== 'string') return null;
    const up = _resolve(root, path.slice(0, -1));
    if (!up || !up.node || typeof up.node !== 'object' || Array.isArray(up.node)) return null;
    const cur = up.node[last];
    if (cur !== undefined && cur !== null) return null;
    return { list: null, owner: up.node, field: last };
  }

  // ── status of one change against a state { key: value } ────────────────────

  function status(state, ch) {
    const root = state[ch.key];
    if (root === undefined || root === null) return 'missing';

    if (ch.op === 'add') {
      const t = _addTarget(root, ch.path);
      if (!t) return 'missing';
      const list = t.list || [];
      const v = ch.value;
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string') {
        const ex = list.find(x => x && typeof x === 'object' && x.id === v.id);
        if (!ex) return 'new';
        return deepEqual(ex, v) ? 'done' : 'exists';
      }
      return list.some(x => deepEqual(x, v)) ? 'done' : 'new';
    }

    const r = _resolve(root, ch.path);

    if (ch.op === 'remove') {
      if (!r) return 'done';                     // already gone
      const exp = ch.expect && typeof ch.expect === 'object' ? ch.expect : {};
      for (const k of Object.keys(exp)) {
        if (!same(r.node && typeof r.node === 'object' ? r.node[k] : undefined, exp[k])) return 'conflict';
      }
      return 'new';
    }

    // set / unset
    if (!r || !r.node || typeof r.node !== 'object' || Array.isArray(r.node)) return 'missing';
    const has = Object.prototype.hasOwnProperty.call(r.node, ch.field);
    const now = has ? r.node[ch.field] : { $absent: true };
    const goal = ch.op === 'unset' ? { $absent: true } : ch.to;
    if (same(now, goal)) return 'done';
    if ('from' in ch && !same(now, ch.from)) return 'conflict';
    return 'new';
  }

  // Current value at the change's target, for the preview's "now: …" line.
  function current(state, ch) {
    const root = state[ch.key];
    if (root === undefined || root === null) return undefined;
    const r = _resolve(root, ch.path);
    if (!r) return undefined;
    if (ch.op === 'set' || ch.op === 'unset') {
      return r.node && typeof r.node === 'object' ? r.node[ch.field] : undefined;
    }
    return r.node;
  }

  // Edited records get a fresh updatedAt (P90) — only records that already
  // carry a lifecycle timestamp, so canvas cards, key results and the like are
  // not given fields they never had.
  function _touch(obj, field) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || field === 'updatedAt') return;
    if (!('updatedAt' in obj) && !('createdAt' in obj)) return;
    if (typeof HubUtils !== 'undefined' && HubUtils.stampUpdate) HubUtils.stampUpdate(obj);
    else obj.updatedAt = new Date().toISOString();
  }

  function _applyOne(state, ch) {
    const root = state[ch.key];
    if (ch.op === 'add') {
      const t = _addTarget(root, ch.path);
      if (t.list) t.list.push(clone(ch.value));
      else t.owner[t.field] = [clone(ch.value)];
      return;
    }
    const r = _resolve(root, ch.path);
    if (ch.op === 'remove') {
      if (Array.isArray(r.parent)) r.parent.splice(r.at, 1);
      else delete r.parent[r.at];
      return;
    }
    if (ch.op === 'set') r.node[ch.field] = clone(ch.to);
    else delete r.node[ch.field];
    _touch(r.node, ch.field);
  }

  function _stateFor(doc, read) {
    const state = {};
    for (const ch of doc.changes) {
      if (!(ch.key in state)) state[ch.key] = clone(read(ch.key));
    }
    return state;
  }

  /**
   * Status of every change, in file order. Earlier `new` changes are applied
   * to a scratch copy first, so a task added to a project added earlier in the
   * same file reads as `new`, not `missing`.
   */
  function plan(doc, read) {
    const state = _stateFor(doc, read);
    const rows = doc.changes.map((ch, i) => {
      const st = status(state, ch);
      const row = { index: i, change: ch, status: st, now: st === 'conflict' ? clone(current(state, ch)) : undefined };
      if (st === 'new') _applyOne(state, ch);
      return row;
    });
    const counts = { new: 0, conflict: 0, done: 0, exists: 0, missing: 0 };
    rows.forEach(r => { counts[r.status]++; });
    return { rows, counts };
  }

  /**
   * Apply the picked changes (a Set of indices) on a fresh read of the data.
   * A picked `new` or `conflict` change is applied; anything that became
   * `done`, `exists` or `missing` since the preview is skipped. Returns the new
   * value of each key that changed; the caller writes them (after a snapshot).
   */
  function apply(doc, picked, read) {
    const state = _stateFor(doc, read);
    const touched = new Set();
    let applied = 0, skipped = 0;
    doc.changes.forEach((ch, i) => {
      if (!picked.has(i)) return;
      const st = status(state, ch);
      if (st === 'new' || st === 'conflict') { _applyOne(state, ch); touched.add(ch.key); applied++; }
      else skipped++;
    });
    const values = {};
    touched.forEach(k => { values[k] = state[k]; });
    return { values, applied, skipped };
  }

  // ── change files in the vault ───────────────────────────────────────────────

  /**
   * Every *.json change file in the vault's change folder:
   * [{ file, doc, errors }], oldest first (a later file may build on an
   * earlier one). Not a change file → skipped silently; broken → listed with
   * its errors so a bad file is visible rather than ignored.
   */
  async function scanVault() {
    if (typeof HubVaultBridge === 'undefined' || !HubVaultBridge.status().connected) return [];
    const folder = HubVaultBridge.getState().changesFolder;
    const entries = await HubVaultBridge.listFolder(folder);
    if (!entries) return [];
    const out = [];
    for (const e of entries) {
      if (e.kind !== 'file' || !/\.json$/i.test(e.name)) continue;
      const text = await HubVaultBridge.readFile((folder ? folder + '/' : '') + e.name);
      if (text == null) continue;
      let doc;
      try { doc = JSON.parse(text); } catch { out.push({ file: e.name, doc: null, errors: ['Not valid JSON.'] }); continue; }
      if (!doc || doc.format !== FORMAT) continue;
      const v = validate(doc);
      out.push({ file: e.name, doc, errors: v.errors });
    }
    return out.sort((a, b) => String((a.doc && a.doc.createdAt) || a.file)
      .localeCompare(String((b.doc && b.doc.createdAt) || b.file)));
  }

  return { FORMAT, validate, plan, apply, status, scanVault, toolLabel, isEmpty, same };
})();
