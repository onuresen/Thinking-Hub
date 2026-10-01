/**
 * hub-vault-bridge.js — read the Obsidian vault as a SOURCE, not just a link target.
 *
 * Thinking Hub's Obsidian integration has always flowed one way: the app can
 * open a note (Option A) and index note titles for autocomplete (Option B).
 * Nothing ever flowed vault → hub. In practice that means work logged in the
 * vault — where the real daily record lives — never reaches the operational
 * tools, and every hub view silently goes stale.
 *
 * This module closes that direction:
 *
 *   1. Cheap scan (automatic)  — enumerate daily-note filenames only, no file
 *      reads, and report days the vault has a note for but the hub has no
 *      record of. Fast enough to run on load.
 *   2. Deep scan (on demand)   — read those notes and extract decision blocks
 *      written in the canonical schema (Decision / Why / Alternative /
 *      Revisit when / Confidence), offered as a review queue.
 *
 * Nothing is ever imported automatically. Every extracted decision is
 * proposed and must be accepted — same discipline the manual reconciliation
 * passes used, because a parser guessing at prose is exactly the kind of thing
 * that should not write to a decision log unattended.
 *
 * 100% local: File System Access API reads a folder the user picked. No
 * network, no upload — consistent with the standing no-cloud decision (P84).
 *
 * API (loaded in index.html only):
 *   HubVaultBridge.isSupported()        — File System Access API present?
 *   HubVaultBridge.init()               — restore stored handle, cheap scan if permitted
 *   HubVaultBridge.connect()            — pick a vault folder (user gesture)
 *   HubVaultBridge.reconnect()          — re-request permission on a stored handle
 *   HubVaultBridge.status()             — {connected, needsPermission, lastScanAt, ...}
 *   HubVaultBridge.scanDays()           — cheap: unrecorded days
 *   HubVaultBridge.scanDecisions(days)  — deep: proposed decisions from those days
 *   HubVaultBridge.accept(proposal)     — write one proposal into decision-hub-v1
 *   HubVaultBridge.ignore(proposal)     — never propose this block again
 *   HubVaultBridge.dismissDay(date)     — stop reporting one unrecorded day
 *   HubVaultBridge.getState()           — raw hub-vault-bridge-v1 record
 */

window.HubVaultBridge = (() => {
  const KEY = 'hub-vault-bridge-v1';
  const DB_NAME = 'thinking-hub-vault';
  const STORE = 'handles';
  const HANDLE_ID = 'vault-root';

  // How far back an unrecorded day is worth reporting. Beyond this the gap is
  // history, not something anyone is going to act on.
  const LOOKBACK_DAYS = 60;

  // Storage keys whose timestamps say nothing about real work happening.
  const NON_EVIDENCE_KEYS = new Set([
    'hub-session-v1', 'th-theme', 'tutorial-seen-v1', 'quick-tour-seen-v1',
    'hub-resurface-v1', 'hub-last-backup-v1', 'machi-milestones-v1',
    'rb-migration-done-v1', 'rb-reacted-v1', 'ai-drawer-pos-v1',
    'hub-briefing-v1', KEY,
  ]);

  let _handle = null;
  let _needsPermission = false;

  // ── state ───────────────────────────────────────────────────────────────────

  function getState() {
    const s = HubStorage.get(KEY);
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      return { dailyFolder: 'daily', lastScanAt: '', unrecordedDays: [], seen: {}, dismissedDays: {} };
    }
    return {
      dailyFolder: s.dailyFolder || 'daily',
      lastScanAt: s.lastScanAt || '',
      unrecordedDays: Array.isArray(s.unrecordedDays) ? s.unrecordedDays : [],
      seen: (s.seen && typeof s.seen === 'object') ? s.seen : {},
      dismissedDays: (s.dismissedDays && typeof s.dismissedDays === 'object') ? s.dismissedDays : {},
    };
  }

  function _setState(patch) {
    const next = { ...getState(), ...patch };
    HubStorage.set(KEY, next);
    return next;
  }

  // ── persisted directory handle (IndexedDB) ──────────────────────────────────
  // Without this the folder must be re-picked from scratch every session, which
  // is the friction that makes a vault bridge not get used. Chromium can
  // structured-clone a FileSystemDirectoryHandle straight into IndexedDB.

  function _openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function _saveHandle(handle) {
    try {
      const db = await _openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(handle, HANDLE_ID);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) { console.warn('[VaultBridge] could not persist handle:', e); }
  }

  async function _loadHandle() {
    try {
      const db = await _openDb();
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(HANDLE_ID);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return handle;
    } catch { return null; }
  }

  function isSupported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  // opts.scan === false: restore the handle only (tools in iframes use this;
  // the day scan belongs to the shell).
  async function init(opts) {
    const doScan = !(opts && opts.scan === false);
    if (!isSupported()) return status();
    const handle = await _loadHandle();
    if (!handle) return status();
    _handle = handle;
    let perm = 'prompt';
    try { perm = await handle.queryPermission({ mode: 'read' }); } catch { }
    if (perm === 'granted') {
      _needsPermission = false;
      _shareHandleWithObsidian();
      if (doScan) { try { await scanDays(); } catch (e) { console.warn('[VaultBridge] scan on init:', e); } }
    } else {
      // Handle survives, permission does not. A single click restores it —
      // but the browser requires that click, so surface it rather than
      // silently pretending the vault is disconnected.
      _needsPermission = true;
    }
    return status();
  }

  async function connect() {
    if (!isSupported()) return false;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read', id: 'thinking-hub-vault' });
      _handle = handle;
      _needsPermission = false;
      await _saveHandle(handle);
      _shareHandleWithObsidian();
      await scanDays();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[VaultBridge] connect:', e);
      return false;
    }
  }

  async function reconnect(opts) {
    if (!_handle) return connect();
    try {
      const perm = await _handle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') return false;
      _needsPermission = false;
      _shareHandleWithObsidian();
      if (!(opts && opts.scan === false)) await scanDays();
      return true;
    } catch (e) {
      console.warn('[VaultBridge] reconnect:', e);
      return false;
    }
  }

  // The autocomplete index (hub-obsidian.js) has always needed its own pick
  // each session because it never persisted the handle. Hand ours over so
  // "Re-index" works after a reload too.
  function _shareHandleWithObsidian() {
    if (typeof HubObsidian !== 'undefined' && typeof HubObsidian.adoptHandle === 'function' && _handle) {
      HubObsidian.adoptHandle(_handle);
    }
  }

  function status() {
    const s = getState();
    return {
      supported: isSupported(),
      connected: !!_handle && !_needsPermission,
      needsPermission: _needsPermission,
      hasStoredHandle: !!_handle,
      dailyFolder: s.dailyFolder,
      lastScanAt: s.lastScanAt,
      unrecordedDays: s.unrecordedDays,
    };
  }

  // ── which days does the hub already have evidence for? ───────────────────────

  /**
   * Every date the hub has a real timestamp for, across ALL storage keys.
   * Scanning raw strings rather than a curated key list is deliberate — the
   * P81 audit showed curated lists silently drift, and this only needs to
   * recognise ISO timestamps, not understand any tool's schema.
   *
   * Anchored on the `T` so plain `YYYY-MM-DD` fields (task due dates, meeting
   * dates, milestone dates) are excluded: a task *due* on a date is not
   * evidence that anything was recorded that day.
   */
  function _hubActiveDays() {
    const days = new Set();
    // Capture the whole timestamp so a UTC instant is credited to the LOCAL
    // day — daily-note filenames are local dates (P126).
    const re = /(20\d\d-\d\d-\d\d)T(\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?)/g;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || NON_EVIDENCE_KEYS.has(k)) continue;
      const v = localStorage.getItem(k);
      if (!v) continue;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(v)) !== null) days.add(HubUtils.isoToLocalDay(m[1] + 'T' + m[2]));
    }
    return days;
  }

  // ── cheap scan: daily-note filenames only, no file reads ────────────────────

  const DATE_IN_NAME = /(20\d\d-\d\d-\d\d)/;

  async function _resolveDailyFolder() {
    if (!_handle) return null;
    const wanted = getState().dailyFolder;
    if (!wanted) return _handle;
    let dir = _handle;
    for (const part of wanted.split('/').filter(Boolean)) {
      try { dir = await dir.getDirectoryHandle(part); }
      catch { return null; }
    }
    return dir;
  }

  /** Collect `YYYY-MM-DD` dates from .md filenames, one level of year folders deep. */
  async function _collectDailyDates(dir, depth = 0) {
    const found = new Map(); // date -> path
    if (!dir || depth > 2) return found;
    for await (const [name, entry] of dir.entries()) {
      if (entry.kind === 'directory') {
        if (name.startsWith('.')) continue;
        const nested = await _collectDailyDates(entry, depth + 1);
        for (const [d, p] of nested) found.set(d, `${name}/${p}`);
      } else if (entry.kind === 'file' && name.endsWith('.md')) {
        const m = name.match(DATE_IN_NAME);
        if (m) found.set(m[1], name);
      }
    }
    return found;
  }

  function _todayStr() { return HubUtils.todayLocal(); }

  function _cutoff() {
    return HubUtils.localYmd(new Date(Date.now() - LOOKBACK_DAYS * 86400000));
  }

  /**
   * Days where the vault has a daily note and the hub has nothing.
   * Today is excluded — a note written this morning is not yet a gap.
   */
  async function scanDays() {
    if (!_handle || _needsPermission) return getState().unrecordedDays;
    const dir = await _resolveDailyFolder();
    if (!dir) {
      _setState({ lastScanAt: new Date().toISOString(), unrecordedDays: [] });
      return [];
    }
    const dates = await _collectDailyDates(dir);
    _dailyPaths = dates;

    const active = _hubActiveDays();
    const st = getState();
    const from = _cutoff();
    const today = _todayStr();

    const unrecorded = [...dates.keys()]
      .filter(d => d >= from && d < today)
      .filter(d => !active.has(d))
      .filter(d => !st.dismissedDays[d])
      .sort()
      .reverse();

    _setState({ lastScanAt: new Date().toISOString(), unrecordedDays: unrecorded });
    return unrecorded;
  }

  let _dailyPaths = new Map();

  function dismissDay(date) {
    const st = getState();
    _setState({
      dismissedDays: { ...st.dismissedDays, [date]: new Date().toISOString() },
      unrecordedDays: st.unrecordedDays.filter(d => d !== date),
    });
  }

  // ── deep scan: decision blocks in the canonical schema ───────────────────────

  // Field labels seen across the vault's own notes. The schema is stable but
  // the phrasing is not ("Alternative" vs "Alternative rejected" vs
  // "Alternative — open-ended access"), so match on prefix, not equality.
  const FIELD_ALIASES = [
    ['decision', ['decision', 'chosen direction', 'chosen']],
    ['why', ['why', 'reason', 'rationale']],
    ['alternative', ['alternative', 'alternatives', 'rejected']],
    ['revisitWhen', ['revisit when', 'revisit']],
    ['confidence', ['confidence']],
    ['consequence', ['consequence', 'consequences']],
  ];

  function _fieldFor(rawLabel) {
    const l = String(rawLabel).toLowerCase().replace(/[:：]\s*$/, '').trim();
    for (const [field, prefixes] of FIELD_ALIASES) {
      for (const p of prefixes) {
        if (l === p || l.startsWith(p + ' ') || l.startsWith(p + ' —') || l.startsWith(p + ' -')) {
          return field;
        }
      }
    }
    return null;
  }

  // A bold run anywhere in the text. Labels are distinguished from ordinary
  // emphasis by carrying a colon (inside or outside the bold — the vault has
  // both) — "**Why:**" is a label, "**Secure Service Account**" is not.
  // Matching anywhere (not just line-start) is required: notes routinely put
  // "**Decision:** … **Why:** … **Confidence:** …" on one wrapped paragraph.
  const LABEL_RE = /\*\*([^*\n]{1,80}?)\*\*\s*[:：]?/g;
  const HEADING_RE = /^#{1,6}\s+.*$/gm;

  function _cleanInline(s) {
    return String(s)
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')   // [[path|alias]] → alias
      .replace(/\[\[([^\]]+)\]\]/g, '$1')              // [[path]] → path
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\s)\*([^*]+)\*/g, '$1$2')
      .replace(/\s+/g, ' ')
      .replace(/\s*[-*+]\s*$/, '')                     // next bullet's marker
      .trim();
  }

  /**
   * A field's text ends at the first blank line. Continuation lines inside a
   * field are indented or wrapped without a blank line, so this cleanly stops
   * the *last* field of a block from swallowing the note's following prose.
   */
  function _upToBlankLine(s) {
    const i = String(s).search(/\n[ \t]*\n/);
    return i === -1 ? s : s.slice(0, i);
  }

  // A heading only supplies the title when it is itself a decision heading
  // ("### Decision — verify findings before recording"). A generic section
  // heading must NOT become the title, or every decision under one section
  // ends up with the same name.
  const DECISION_HEADING_RE = /^decisions?\s*[—–:-]\s*(.+)$/i;

  function _headingText(h) {
    return _cleanInline(String(h).replace(/^#+\s*/, ''));
  }

  function _titleFromHeading(h) {
    const m = DECISION_HEADING_RE.exec(_headingText(h));
    return m ? m[1].trim() : '';
  }

  function _titleFromText(text) {
    const first = String(text).split(/(?<=[.;])\s/)[0] || String(text);
    const t = first.trim().replace(/[.;]$/, '');
    return t.length > 110 ? t.slice(0, 107).trimEnd() + '…' : t;
  }

  const CONFIDENCE_RE = /\b(high|medium|med|low)\b/i;
  function _normConfidence(raw) {
    const m = CONFIDENCE_RE.exec(String(raw || ''));
    if (!m) return 'medium';
    const v = m[1].toLowerCase();
    return v === 'med' ? 'medium' : v;
  }

  /** Stable identity for a block so an accepted/ignored one never returns. */
  function _sourceKey(path, decisionText) {
    let h = 5381;
    const s = path + '::' + decisionText;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return path + '#' + h.toString(36);
  }

  /**
   * Parse one note into decision proposals.
   *
   * Works on absolute offsets rather than line by line, because the canonical
   * schema appears in two shapes in the same vault: one label per bullet line,
   * and several labels inside one wrapped paragraph. Offsets handle both, and
   * let a field's text be cleaned once *after* joining — a bold run split
   * across a line break ("**Secure\nService Account**") only strips correctly
   * when the whole span is cleaned together.
   *
   * A block opens on `Decision:`/`Chosen direction:` and closes at the next
   * such label, at any heading, or at end of file.
   */
  function parseNote(text, path, date) {
    const src = String(text);

    // 1. Collect boundaries: headings, and bold runs that are schema labels.
    const marks = [];
    HEADING_RE.lastIndex = 0;
    for (let m; (m = HEADING_RE.exec(src)) !== null;) {
      marks.push({ kind: 'heading', start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    LABEL_RE.lastIndex = 0;
    for (let m; (m = LABEL_RE.exec(src)) !== null;) {
      const raw = m[1];
      const hasColon = /[:：]\s*$/.test(raw) || /[:：]\s*$/.test(m[0]);
      if (!hasColon) continue;               // emphasis, not a label
      const field = _fieldFor(raw);
      marks.push({
        kind: field ? 'field' : 'other',
        field, raw,
        start: m.index, end: m.index + m[0].length,
      });
    }
    marks.sort((a, b) => a.start - b.start);

    // 2. Walk them, slicing each field's content up to the next boundary.
    const out = [];
    let cur = null, heading = '';

    const close = () => {
      if (cur && cur.decision) out.push(cur);
      cur = null;
    };

    for (let i = 0; i < marks.length; i++) {
      const mk = marks[i];
      const sliceEnd = i + 1 < marks.length ? marks[i + 1].start : src.length;
      const body = () => _cleanInline(_upToBlankLine(src.slice(mk.end, sliceEnd)));

      if (mk.kind === 'heading') { close(); heading = mk.text; continue; }
      if (mk.kind === 'other') continue;      // e.g. "**Finding:**" — ends the field, keeps the block

      if (mk.field === 'decision') {
        close();
        cur = {
          decision: body(), why: '', alternative: '', revisitWhen: '',
          confidence: '', consequence: '', heading,
        };
        continue;
      }
      if (!cur) continue;

      // "**Alternative — open-ended access:** rejected because…" — the label
      // itself carries meaning, so keep it (minus its trailing colon).
      const label = _cleanInline(mk.raw).replace(/[:：]\s*$/, '');
      const extra = /[—–-]/.test(label) ? label + ': ' : '';
      cur[mk.field] = (cur[mk.field] ? cur[mk.field] + ' ' : '') + extra + body();
    }
    close();

    return out
      .filter(b => b.decision && b.decision.length > 3)
      .map(b => {
        const fromHeading = b.heading ? _titleFromHeading(b.heading) : '';
        const context = b.heading ? _headingText(b.heading) : '';
        return {
          sourceKey: _sourceKey(path, b.decision),
          path, date,
          title: fromHeading || _titleFromText(b.decision),
          // Section heading, kept as provenance when it wasn't used as the title.
          context: fromHeading ? '' : context,
          summary: b.decision,
          why: b.why.trim(),
          alternative: b.alternative.trim(),
          revisitWhen: b.revisitWhen.trim(),
          consequence: b.consequence.trim(),
          confidence: _normConfidence(b.confidence),
          hasConfidence: !!b.confidence.trim(),
        };
      });
  }

  async function _readNote(relPath) {
    if (!_handle) return null;
    const parts = relPath.split('/').filter(Boolean);
    const fileName = parts.pop();
    let dir = _handle;
    for (const p of parts) {
      try { dir = await dir.getDirectoryHandle(p); } catch { return null; }
    }
    try {
      const fh = await dir.getFileHandle(fileName);
      const file = await fh.getFile();
      return await file.text();
    } catch { return null; }
  }

  /**
   * Read the given days' notes and return proposals not already accepted or
   * ignored. Defaults to the cached unrecorded days.
   */
  async function scanDecisions(days) {
    if (!_handle || _needsPermission) return [];
    const st = getState();
    const targets = (days && days.length) ? days : st.unrecordedDays;
    if (!targets.length) return [];

    if (!_dailyPaths.size) {
      const dir = await _resolveDailyFolder();
      if (dir) _dailyPaths = await _collectDailyDates(dir);
    }

    const folder = st.dailyFolder ? st.dailyFolder + '/' : '';
    const proposals = [];
    for (const date of targets) {
      const rel = _dailyPaths.get(date);
      if (!rel) continue;
      const text = await _readNote(folder + rel);
      if (!text) continue;
      for (const p of parseNote(text, folder + rel, date)) {
        if (st.seen[p.sourceKey]) continue;
        proposals.push(p);
      }
    }
    return proposals.sort((a, b) => b.date.localeCompare(a.date));
  }


  // ── linked notes: a project's or meeting's own vault note (P138) ─────────────
  // Tasks live as checkboxes in project notes, and meeting notes are their own
  // files. Name-matching those to hub items is unreliable (IS04/IS05/IS06 all
  // match "Autodesk"), so the user links a note once and we read that note.

  function normNotePath(p) {
    let s = String(p || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    s = s.replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].trim();
    if (!s) return '';
    return /\.md$/i.test(s) ? s : s + '.md';
  }

  async function readNote(path) {
    const rel = normNotePath(path);
    if (!rel || !_handle || _needsPermission) return null;
    return _readNote(rel);
  }

  let _noteList = null;
  /** Every .md path in the vault (names only, no reads). Cached per page. */
  async function listNotes() {
    if (_noteList) return _noteList;
    if (!_handle || _needsPermission) return [];
    const out = [];
    const walk = async (dir, prefix, depth) => {
      if (depth > 6) return;
      for await (const [name, entry] of dir.entries()) {
        if (name.startsWith('.') || (depth === 0 && name === 'raw')) continue;
        const rel = prefix ? prefix + '/' + name : name;
        if (entry.kind === 'directory') await walk(entry, rel, depth + 1);
        else if (/\.md$/i.test(name)) out.push(rel.replace(/\.md$/i, ''));
      }
    };
    try { await walk(_handle, '', 0); } catch (e) { console.warn('[VaultBridge] listNotes:', e); }
    _noteList = out.sort();
    return _noteList;
  }

  function itemKey(kind, path, text) {
    return kind + ':' + _sourceKey(normNotePath(path), String(text).toLowerCase());
  }

  function markSeen(key, value) {
    const st = getState();
    _setState({ seen: { ...st.seen, [key]: value || 'ignored' } });
  }

  function isSeen(key) { return !!getState().seen[key]; }

  const CHECK_RE = /^([ \t]*)[-*+][ \t]+\[([ xX])\][ \t]+(.+)$/;
  const ACTION_HEADING_RE = /(action|next step|to-?do|follow[- ]?up|\basks?\b|宿題|アクション|対応|次回|タスク)/i;
  // "Terminology decisions", "Decisions", "決定事項". Not "the discussion
  // behind the decision" — that section is narrative, not a list of calls.
  const DECISION_SECTION_RE = /(^(\d+\.\s*)?decisions?\b|\bdecisions\s*$|決定|合意)/i;
  const DONE_STATE_RE = /^(done|closed|resolved|complete|completed|cancel+ed|完了|済|対応済)/i;

  /**
   * Checkboxes in a note: [{ text, done, heading }]. Nested checkboxes keep
   * their own text; the nearest heading is kept as context.
   */
  function parseChecklist(text) {
    const out = [];
    let heading = '';
    for (const line of String(text || '').split(/\r?\n/)) {
      const h = /^#{1,6}\s+(.*)$/.exec(line);
      if (h) { heading = _cleanInline(h[1]); continue; }
      const m = CHECK_RE.exec(line);
      if (!m) continue;
      const t = _cleanInline(m[3]);
      if (t.length < 2) continue;
      out.push({ text: _clip(t), done: m[2] !== ' ', heading });
    }
    return out;
  }

  function _clip(t) { return t.length > 200 ? t.slice(0, 197) + '…' : t; }

  function _cells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => _cleanInline(c));
  }

  /**
   * A meeting note, in the shapes the vault really uses:
   * - decisions: canonical **Decision:** blocks, and top-level bullets under a
   *   "…decisions" heading;
   * - actions: open checkboxes anywhere, plus bullets and table rows under an
   *   "Asks / Follow-ups / Next steps / 宿題" heading. Table rows whose State
   *   column says Done/Closed are skipped.
   */
  function parseMeetingNote(text, path) {
    const src = String(text || '');
    const rel = normNotePath(path);
    const decisions = parseNote(src, rel, '');
    const decSeen = new Set(decisions.map(d => d.summary.toLowerCase()));
    const actions = [];
    const actSeen = new Set();
    const pushAction = (t, heading, owner) => {
      if (!t || t.length < 2 || /^[-:| ]+$/.test(t)) return;
      const k = t.toLowerCase();
      if (actSeen.has(k)) return;
      actSeen.add(k);
      actions.push({ text: _clip(t), heading, owner: owner || '' });
    };

    const lines = src.split(/\r?\n/);
    let heading = '', inActions = false, inDecisions = false;
    let table = null;        // { stateCol, ownerCol } while inside a table
    let bullet = null;       // open decision bullet being collected

    const closeBullet = () => {
      if (!bullet) return;
      const body = _cleanInline(bullet.lines.join(' '));
      if (body.length > 3 && !decSeen.has(body.toLowerCase())) {
        decSeen.add(body.toLowerCase());
        const lead = /^\*\*([^*]+)\*\*/.exec(bullet.lines[0].trim());
        const title = lead ? _cleanInline(lead[1]).replace(/[.:：]\s*$/, '') : _titleFromText(body);
        decisions.push({
          sourceKey: _sourceKey(rel, body), path: rel, date: '',
          title: title.length > 110 ? title.slice(0, 107) + '…' : title,
          context: bullet.heading, summary: body,
          why: '', alternative: '', revisitWhen: '', consequence: '',
          confidence: 'medium', hasConfidence: false,
        });
      }
      bullet = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const h = /^#{1,6}\s+(.*)$/.exec(line);
      if (h) {
        closeBullet(); table = null;
        heading = _cleanInline(h[1]);
        inActions = ACTION_HEADING_RE.test(heading);
        inDecisions = !inActions && DECISION_SECTION_RE.test(heading);
        continue;
      }
      const c = CHECK_RE.exec(line);
      if (c) { closeBullet(); if (c[2] === ' ') pushAction(_cleanInline(c[3]), heading); continue; }

      if (inActions && /^\s*\|/.test(line)) {
        const next = lines[i + 1] || '';
        if (!table && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(next)) {
          const head = _cells(line).map(x => x.toLowerCase());
          table = {
            stateCol: head.findIndex(x => /^(state|status|状態|ステータス)/.test(x)),
            ownerCol: head.findIndex(x => /^(owner|who|担当)/.test(x)),
          };
          i++;                       // skip the separator row
          continue;
        }
        if (table) {
          const cells = _cells(line);
          const state = table.stateCol >= 0 ? (cells[table.stateCol] || '') : '';
          if (!DONE_STATE_RE.test(state)) pushAction(cells[0], heading, table.ownerCol >= 0 ? cells[table.ownerCol] : '');
        }
        continue;
      }
      if (table && !/^\s*\|/.test(line)) table = null;

      if (inActions) {
        // Top-level bullet only; its text is the bold lead, else its first
        // sentence (wrapped bullets carry the detail on later lines).
        const b = /^(?:[-*+]|\d+[.)])[ \t]+(.+)$/.exec(line);
        if (b) {
          const lead = /^\*\*([^*]+)\*\*/.exec(b[1].trim());
          const t = lead ? _cleanInline(lead[1]).replace(/[.:：]\s*$/, '') : _titleFromText(_cleanInline(b[1]));
          pushAction(t, heading);
        }
        continue;
      }
      if (inDecisions) {
        const b = /^[-*+][ \t]+(.+)$/.exec(line);              // top-level only
        if (b) { closeBullet(); bullet = { lines: [b[1]], heading }; continue; }
        if (bullet && /^\s+\S/.test(line)) { bullet.lines.push(line.trim()); continue; }
        if (!line.trim()) closeBullet();
      }
    }
    closeBullet();
    return { decisions, actions };
  }

  function _normTitle(s) {
    return String(s || '').toLowerCase().replace(/[*_`~\[\]()]/g, '').replace(/[\s.,;:!?。、・]+/g, ' ').trim();
  }

  // ── accept / ignore ─────────────────────────────────────────────────────────

  /**
   * Write one proposal into decision-hub-v1, matching the record shape
   * decision-hub.html's own createNew() produces so nothing downstream has to
   * special-case an imported decision.
   */
  function accept(p, opts) {
    const projectId = (opts && opts.projectId) || '';
    const raw = HubStorage.get('decision-hub-v1');
    const arr = Array.isArray(raw) ? raw : [];

    const dec = {
      id: 'dh-vb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      projectId,
      title: p.title,
      type: 'decision',
      confidence: p.confidence,
      summary: p.summary,
      reason: [p.why, p.consequence && ('Consequence: ' + p.consequence)].filter(Boolean).join(' '),
      alternative: p.alternative || '',
      revisitWhen: p.revisitWhen || '',
      revisitDate: '',
      outcome: null,
      tags: '',
      links: '',
      obsidianNote: p.path,
      createdAt: new Date().toISOString(),
    };
    if (typeof HubUtils !== 'undefined' && HubUtils.stampCreate) HubUtils.stampCreate(dec);
    arr.push(dec);
    HubStorage.set('decision-hub-v1', arr);

    const st = getState();
    _setState({ seen: { ...st.seen, [p.sourceKey]: 'accepted' } });
    return dec;
  }

  function ignore(p) {
    const st = getState();
    _setState({ seen: { ...st.seen, [p.sourceKey]: 'ignored' } });
  }

  function setDailyFolder(folder) {
    _setState({ dailyFolder: String(folder || '').replace(/^\/+|\/+$/g, '') });
  }

  return {
    isSupported, init, connect, reconnect, status, getState,
    scanDays, scanDecisions, accept, ignore, dismissDay, setDailyFolder,
    readNote, listNotes, normNotePath, parseChecklist, parseMeetingNote,
    itemKey, markSeen, isSeen, normTitle: _normTitle,
    parseNote, // exported for tests
  };
})();
