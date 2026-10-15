// machi-fun.js — Thinking Hub's playful layer for Machi Hub (P140).
// NOT a stamped copy: this file is Thinking-Hub-specific and lives only here.
// It draws through the engine's setDecorator() hook and reads Hub data directly.
//
// Goal: fun and cute, not insight. Each tool building gets its own little life:
//   Learning Hub   → a library. One floor per finished item; a lamp per key insight.
//   Capture Hub    → a post office. Mail sacks pile up with the inbox; clearing it
//                    sends a delivery van off down the road.
//   Meeting Hub    → a bus stop. Weekly meetings are buses that run on their day;
//                    today's one-off meetings are taxis.
//   Canvas Hub → an art studio. An easel per board, gallery lights per card,
//                    bunting for lines.
//   Dependency Graph links → pigeons carrying letters between tool buildings.
//   Every Hub page → its own landmark (clock tower, café, shrine…); tools → trees;
//                    police box, hospital and festival ground appear from data (P161).
//   Journal Line   → a raised train above the town. One carriage per day you wrote
//                    in the Daily Log this week (both the street and bird's-eye view).
// Plus sparkles wherever you click.

const MachiFun = (() => {
  const STATE_KEY = 'machi-milestones-v1'; // ephemeral, never backed up (Codex P81C)
  const NODE_HEX = {
    'c-gray': '#9aa0aa', 'c-yellow': '#ffd24d', 'c-green': '#5bd67a',
    'c-blue': '#5b8cff', 'c-red': '#ff6b6b', 'c-purple': '#b28ae8',
  };
  const PAINT = ['#ff6b6b', '#ffd24d', '#5bd67a', '#5b8cff', '#b28ae8', '#ff9fc4'];
  const BUS_COLORS = ['#ffb84d', '#5bd67a', '#5b8cff', '#ff9fc4', '#b28ae8'];
  const SPINES = ['#8f3311', '#3a6ea8', '#4a9465', '#b29245', '#7a4aa8', '#a84040'];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let data = emptyData();
  let lastTime = null;
  let motion = true;
  const sparkles = [];
  const pigeons = new Map();   // link id → flight state
  const vehicles = new Map();  // meeting id → bus/taxi state
  let vans = [];               // departing delivery vans
  let pendingVans = 0;

  function emptyData() {
    return {
      library: { done: 0, insights: 0, reading: 0, total: 0 },
      post: { inbox: 0 },
      buses: [],     // { id, title, weekday, todayTime, riders, color, today }
      taxis: [],     // { id, title, time, riders }
      studio: { boards: [], cards: 0, lines: 0 },
      links: [],     // { id, from, to, relType, note, fromLabel, toLabel }
      journal: { week: 0 },
      projects: { total: 0, open: 0 },
      responders: 0,
      festival: [],  // names of projects finished in the last 14 days
      tags: 0,
      burning: false,
    };
  }

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  }

  function arr(v) { return Array.isArray(v) ? v : []; }

  // ── Data ──────────────────────────────────────────────────────────────────
  function readLibrary() {
    const raw = HubStorage.get('learning-hub-v1') || {};
    const items = arr(raw.items).filter((it) => it && !it.archived);
    return {
      total: items.length,
      done: items.filter((it) => it.status === 'done').length,
      reading: items.filter((it) => it.status === 'reading').length,
      insights: items.filter((it) => String(it.keyInsight || '').trim()).length,
    };
  }

  function readMeetings() {
    const raw = HubStorage.get('meetings-hub-v1') || {};
    const today = HubUtils.todayLocal();
    const todayDow = new Date().getDay();
    const buses = [];
    const taxis = [];
    for (const m of arr(raw.meetings)) {
      if (!m || m.archived) continue;
      const riders = Math.min(4, arr(m.attendeesList).length || 1);
      if (m.recurring) {
        const occ = arr(m.occurrenceDates);
        if (!occ.length) continue;
        const todayOcc = occ.find((o) => o && o.date === today);
        const sample = todayOcc || occ.find((o) => o && o.date >= today) || occ[occ.length - 1];
        const weekday = sample && sample.date ? new Date(sample.date + 'T12:00:00').getDay() : todayDow;
        buses.push({
          id: m.id, title: m.title || 'Weekly meeting', weekday, riders,
          today: Boolean(todayOcc), todayTime: todayOcc ? (todayOcc.time || m.time || '') : '',
          color: BUS_COLORS[Math.floor(seeded(String(m.id))() * BUS_COLORS.length)],
        });
      } else if (m.date === today) {
        taxis.push({ id: m.id, title: m.title || 'Meeting', time: m.time || '', riders });
      }
    }
    return { buses, taxis };
  }

  function readStudio() {
    const raw = HubStorage.get('canvas-v1') || {};
    const boards = Array.isArray(raw.boards) ? raw.boards
      : (raw.nodes ? [{ id: 'legacy', name: 'Canvas', nodes: raw.nodes, edges: raw.edges }] : []);
    let cards = 0, lines = 0;
    const list = boards.map((b) => {
      const nodes = arr(b.nodes).filter((n) => n && n.kind !== 'frame');
      const edges = arr(b.edges);
      cards += nodes.length;
      lines += edges.length;
      const colors = nodes.map((n) => NODE_HEX[n.color]).filter(Boolean).slice(0, 4);
      return { id: b.id, name: b.name || 'Board', cards: nodes.length, lines: edges.length, colors };
    });
    return { boards: list, cards, lines };
  }

  function labelFor(cache, end) {
    if (!end || !end.tool) return '';
    if (!cache[end.tool]) {
      try { cache[end.tool] = window.HubLinks ? HubLinks.resolveItems(end.tool) || [] : []; }
      catch (_) { cache[end.tool] = []; }
    }
    const hit = cache[end.tool].find((it) => it.id === end.itemId);
    return (hit && hit.label) || end.label || '';
  }

  function readLinks() {
    const links = arr(HubStorage.get('hub-links-v1'))
      .filter((l) => l && l.a && l.b && l.a.tool && l.b.tool)
      .sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')))
      .slice(0, 6);
    const cache = {};
    return links.map((l) => ({
      id: l.id, from: l.a.tool, to: l.b.tool, relType: l.relType || 'relates', note: l.note || '',
      fromLabel: labelFor(cache, l.a), toLabel: labelFor(cache, l.b),
    }));
  }

  // Days in the last 7 (today included) with a Daily Log entry.
  function readJournal() {
    const raw = HubStorage.get('log-hub-v1') || {};
    const entries = raw.entries && typeof raw.entries === 'object' ? raw.entries : {};
    let week = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const e = entries[HubUtils.localYmd(d)];
      if (e && (String(e.text || '').trim() || e.mood)) week++;
    }
    return { week };
  }

  // Project counts, a festival for projects marked done in the last 14 days
  // (only with a real updatedAt — unknown age never counts, P90), risks being
  // treated (hospital), and the tag count (market stalls).
  function readCity() {
    const projects = arr((HubStorage.get('project-hub-v1') || {}).projects).filter(Boolean);
    const cutoff = Date.now() - 14 * 86400000;
    const festival = projects
      .filter((p) => p.status === 'done' && p.updatedAt && new Date(p.updatedAt).getTime() >= cutoff)
      .map((p) => p.name || 'Project');
    const responders = arr((HubStorage.get('risk-hub-v1') || {}).risks)
      .filter((r) => r && r.status === 'mitigating' && r.owner).length;
    return {
      projects: { total: projects.length, open: projects.filter((p) => p.status !== 'done').length },
      responders, festival,
      tags: arr((HubStorage.get('hub-tags-v1') || {}).tags).length,
    };
  }

  /** Re-reads Hub data. Cheap: a handful of storage reads. */
  function refresh() {
    const m = readMeetings();
    data = {
      library: readLibrary(),
      post: { inbox: arr((HubStorage.get('capture-hub-v1') || {}).inbox).length },
      buses: m.buses,
      taxis: m.taxis,
      studio: readStudio(),
      links: readLinks(),
      journal: readJournal(),
      ...readCity(),
      burning: false,
    };
    // Inbox cleared since the last visit (or since the last refresh)? Send vans.
    const st = HubStorage.get(STATE_KEY) || {};
    if (typeof st.inboxSeen === 'number' && data.post.inbox < st.inboxSeen) {
      pendingVans = Math.min(3, pendingVans + Math.max(1, Math.ceil((st.inboxSeen - data.post.inbox) / 3)));
    }
    if (st.inboxSeen !== data.post.inbox) HubStorage.set(STATE_KEY, { ...st, inboxSeen: data.post.inbox });
  }

  /** Data-driven tweaks to a Hub-page entity before the engine lays it out. */
  function tweak(entity) {
    const appId = entity.meta && entity.meta.appId;
    if (LANDMARKS[appId]) {
      entity.hostDrawn = true;
      entity.meta = { ...entity.meta, look: LANDMARKS[appId] };
    }
    if (appId === 'learning-hub') {
      // Smallest height that fits one floor per finished item (3px floors).
      let tier = 1;
      while (tier < 5 && Math.floor((3 + tier * 5) / 3) < data.library.done) tier++;
      entity.tier = tier;
    } else if (appId === 'canvas-hub') {
      entity.tier = Math.max(entity.tier || 1, Math.min(5, 1 + Math.ceil(data.studio.cards / 25)));
    }
    return entity;
  }

  /** Tools whose building should exist even before it is opened, because it has data. */
  function wantedBuildings() {
    const out = [];
    if (data.library.total) out.push('learning-hub');
    if (data.post.inbox) out.push('capture-hub');
    if (data.buses.length || data.taxis.length) out.push('meetings-hub');
    if (data.studio.boards.length) out.push('canvas-hub');
    return out;
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────
  function px(ctx, color, x, y, w = 1, h = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function boxFor(api, appId) {
    if (!api.buildingsVisible) return null;
    return api.hitboxes.find((b) => b.entity.id === 'hub-' + appId) || null;
  }

  // Spare sidewalk space to the right of a building, inside its own cell.
  function spareRight(api, b) {
    return Math.max(0, api.layout.CELL_W - 3 - b.w - 1);
  }

  function roadY(api, row, lane) {
    const { TOP_SKY, ROW_H, BUILD_ZONE, SIDEWALK_H, ROAD_H } = api.layout;
    const top = TOP_SKY + row * ROW_H + BUILD_ZONE + SIDEWALK_H;
    return lane === 0 ? top + 1 : top + ROAD_H - 4;
  }

  function avenueX(api) {
    const g = api.grid;
    return g.hasAvenue ? api.layout.MARGIN_X + g.avenueAfter * api.layout.CELL_W : -999;
  }

  // Same red-light rule the engine's own cars follow, for lane-0 (→) traffic.
  function driveRight(api, a, dt, speed, stopAt) {
    let nx = a.x + speed * dt;
    const ax = avenueX(api);
    if (ax > 0 && !api.lightGreen && a.x + 9 <= ax && nx + 9 > ax - 1) nx = ax - 10;
    if (stopAt !== undefined && a.x < stopAt && nx >= stopAt) nx = stopAt;
    a.x = nx;
  }

  // ── Library ───────────────────────────────────────────────────────────────
  function drawLibrary(ctx, api, b) {
    const { x, y, w, h } = b;
    const lib = data.library;
    const t = api.time;
    const night = api.dayness < 0.45;
    // stone walls + pediment roof
    px(ctx, '#d8c9a8', x, y, w, h);
    for (let r = 0; r < 3; r++) px(ctx, '#b8a888', x - 1 + r, y - 3 + r, w + 2 - r * 2, 1);
    px(ctx, '#8a7a5a', x, y, w, 1);
    // floors: one per finished item, books on shelves, lamp if a key insight exists
    const cap = Math.floor((h - 4) / 3);
    const floors = Math.min(lib.done, cap);
    const rand = seeded('library-books');
    for (let f = 0; f < floors; f++) {
      const fy = y + h - 5 - f * 3;
      for (let i = 1; i < w - 1; i++) {
        if (rand() < 0.82) px(ctx, SPINES[Math.floor(rand() * SPINES.length)], x + i, fy, 1, 2);
      }
      if (f < lib.insights) {
        const lx = x + 1 + ((f * 5) % Math.max(1, w - 3));
        px(ctx, '#ffd98a', lx, fy, 2, 2);
        if (night) px(ctx, 'rgba(255,217,138,0.22)', lx - 1, fy - 1, 4, 4);
      }
    }
    if (lib.done > cap) {
      // more finished than floors: a little golden dome on top
      px(ctx, '#ffd24d', x + Math.floor(w / 2) - 2, y - 5, 4, 2);
      px(ctx, '#ffd24d', x + Math.floor(w / 2) - 1, y - 6, 2, 1);
    }
    // columns + door
    px(ctx, '#efe4cc', x + 1, y + h - 3, 1, 3);
    px(ctx, '#efe4cc', x + w - 2, y + h - 3, 1, 3);
    px(ctx, '#5c3d1a', x + Math.floor(w / 2) - 1, y + h - 3, 2, 3);
    // readers on the steps, page flipping
    for (let i = 0; i < Math.min(2, lib.reading); i++) {
      const rx = x + 2 + i * 4;
      const ry = b.baseline - 3;
      px(ctx, '#5b8cff', rx, ry + 1, 1, 2);
      px(ctx, '#e8d5c0', rx, ry, 1, 1);
      px(ctx, Math.floor(t * 1.5 + i) % 2 ? '#ffffff' : '#ffd98a', rx + 1, ry + 1, 1, 1);
    }
  }

  // ── Post office ───────────────────────────────────────────────────────────
  function drawPostOffice(ctx, api, b, dt) {
    const { x, y, w, h } = b;
    const n = data.post.inbox;
    px(ctx, '#c8553d', x, y, w, h);
    px(ctx, '#8f3311', x - 1, y - 1, w + 2, 2);
    // windows
    for (let wx = x + 1; wx < x + w - 1; wx += 3) {
      for (let wy = y + 2; wy < y + h - 5; wy += 4) px(ctx, api.dayness < 0.45 ? '#ffe07a' : '#2a2f3a', wx, wy, 2, 2);
    }
    // envelope sign + door
    px(ctx, '#ffffff', x + Math.floor(w / 2) - 2, y + h - 7, 4, 3);
    px(ctx, '#c8553d', x + Math.floor(w / 2) - 1, y + h - 6, 2, 1);
    px(ctx, '#3a1f1f', x + Math.floor(w / 2) - 1, y + h - 3, 2, 3);
    // red mailbox on the sidewalk
    const spare = spareRight(api, b);
    px(ctx, '#e34d4d', x - 2, b.baseline - 3, 2, 3);
    px(ctx, '#ffd24d', x - 2, b.baseline - 3, 2, 1);
    // mail sacks pile up with the inbox
    const sacks = Math.min(6, Math.ceil(n / 3));
    for (let i = 0; i < sacks; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const sx = x + w + 1 + col * 3;
      if (sx + 2 > x + w + 1 + spare) continue;
      const sy = b.baseline - 3 - row * 3;
      px(ctx, '#d8c9a8', sx, sy, 3, 3);
      px(ctx, '#8a7a5a', sx + 1, sy, 1, 1);
    }
    if (n === 0) {
      // inbox zero: a cat naps on the step, tail swishing
      const cx = x + Math.floor(w / 2) + 2;
      const cy = b.baseline - 2;
      px(ctx, '#ff9f5b', cx, cy, 3, 2);
      px(ctx, '#ff9f5b', cx + 3, cy - 1, 1, 1);
      px(ctx, '#ff9f5b', cx - 1, cy - (Math.floor(api.time * 1.2) % 2), 1, 1);
    }
    // departing delivery vans
    if (pendingVans > 0 && motion) {
      vans.push({ x: x + w, row: b.row, wait: vans.length * 1.6 });
      pendingVans--;
    }
    if (!motion) pendingVans = 0;
    for (const v of vans) {
      if (v.wait > 0) { v.wait -= dt; continue; }
      driveRight(api, v, dt, 16);
      const vy = roadY(api, v.row, 0);
      px(ctx, '#f2f2f2', v.x, vy, 7, 3);
      px(ctx, '#e34d4d', v.x, vy + 1, 7, 1);
      px(ctx, '#2a2f3a', v.x + 5, vy, 1, 1);
      px(ctx, '#10131c', v.x + 1, vy + 3, 1, 1);
      px(ctx, '#10131c', v.x + 5, vy + 3, 1, 1);
      if (Math.floor(api.time * 4) % 2) px(ctx, '#ff9fc4', v.x - 2, vy, 1, 1); // a little heart puff
    }
    vans = vans.filter((v) => v.x < api.grid.width + 10);
  }

  // ── Bus stop + buses + taxis ──────────────────────────────────────────────
  function drawBusStop(ctx, api, b, dt) {
    const sx = b.x - 2;
    const sy = b.baseline;
    px(ctx, '#8a95a3', sx, sy - 6, 1, 6);
    px(ctx, '#5b8cff', sx - 1, sy - 8, 3, 2);
    px(ctx, '#ffffff', sx, sy - 8, 1, 1);
    api.addHitbox({
      entity: { id: 'fun-busstop', name: 'Bus Stop', kind: 'fun', meta: { lens: 'fun-busstop' } },
      x: sx - 2, y: sy - 9, w: 5, h: 10,
    });

    const today = data.buses.filter((bus) => bus.today);
    const riding = today.map((bus) => ({ ...bus, kind: 'bus' }))
      .concat(data.taxis.map((tx) => ({ ...tx, kind: 'taxi', color: '#ffd24d' })));
    const live = new Set(riding.map((r) => r.id));
    for (const id of vehicles.keys()) if (!live.has(id)) vehicles.delete(id);

    if (!riding.length && data.buses.length) {
      // no bus today: one sleepy bus parked at the stop
      const bx = sx + 2;
      const by = roadY(api, b.row, 0);
      drawBus(ctx, bx, by, data.buses[0].color, 0);
      const z = Math.floor(api.time * 1.5) % 3;
      px(ctx, '#c9cfdb', bx + 8 + z, by - 2 - z, 1, 1);
      api.addHitbox({
        entity: { id: 'fun-bus-sleep', name: 'Sleepy bus', kind: 'fun', meta: { lens: 'fun-busstop' } },
        x: bx - 1, y: by - 1, w: 11, h: 6,
      });
      return;
    }

    const stopX = sx + 2;
    riding.forEach((r, i) => {
      let a = vehicles.get(r.id);
      if (!a) {
        const rand = seeded('bus-' + r.id);
        // first arrival is close to the stop, so you see it pull in soon after opening
        a = { x: Math.max(-12, sx - 30 - i * 16 - rand() * 10), pause: 0, riders: [], stopped: false };
        vehicles.set(r.id, a);
      }
      const by = roadY(api, b.row, 0);
      if (motion) {
        if (a.pause > 0) {
          a.pause -= dt;
        } else {
          const before = a.x;
          driveRight(api, a, dt, r.kind === 'taxi' ? 14 : 9, a.stopped ? undefined : stopX);
          if (!a.stopped && a.x === stopX && before <= stopX) {
            a.stopped = true;
            a.pause = 2.6;
            // riders hop off and stroll to the door
            for (let k = 0; k < r.riders; k++) a.riders.push({ x: stopX + 2 + k * 2, age: 0 });
          }
          if (a.x > api.grid.width + 12) { a.x = -14; a.stopped = false; }
        }
      }
      for (const p of a.riders) {
        p.age += dt;
        p.x += (b.x + Math.floor(b.w / 2) - p.x) * Math.min(1, dt * 1.2);
        px(ctx, '#d8c9a8', p.x, b.baseline - 2, 1, 2);
        px(ctx, '#e8d5c0', p.x, b.baseline - 3, 1, 1);
      }
      a.riders = a.riders.filter((p) => p.age < 2.2);
      if (r.kind === 'taxi') drawTaxi(ctx, a.x, by, api.time);
      else drawBus(ctx, a.x, by, r.color, api.time);
      api.addHitbox({
        entity: { id: 'fun-ride-' + r.id, name: r.title, kind: 'fun',
          meta: { lens: 'fun-ride', ride: r.kind, title: r.title, time: r.todayTime || r.time, riders: r.riders } },
        x: Math.round(a.x) - 1, y: by - 1, w: 11, h: 6,
      });
    });
  }

  function drawBus(ctx, x, y, color, t) {
    px(ctx, color, x, y, 9, 3);
    for (let i = 1; i < 8; i += 2) px(ctx, '#cfe6ff', x + i, y, 1, 1);
    px(ctx, '#10131c', x + 1, y + 3, 1, 1);
    px(ctx, '#10131c', x + 6, y + 3, 1, 1);
    px(ctx, '#ffe07a', x + 8, y + 1, 1, 1);
    if (Math.floor(t * 2) % 2) px(ctx, '#ffffff', x + 8, y - 1, 1, 1);
  }

  function drawTaxi(ctx, x, y, t) {
    px(ctx, '#ffd24d', x, y + 1, 6, 2);
    px(ctx, '#ffd24d', x + 1, y, 4, 1);
    px(ctx, Math.floor(t * 3) % 2 ? '#ff6b6b' : '#ffffff', x + 2, y - 1, 2, 1);
    px(ctx, '#10131c', x + 1, y + 3, 1, 1);
    px(ctx, '#10131c', x + 4, y + 3, 1, 1);
  }

  // ── Art studio ────────────────────────────────────────────────────────────
  function drawStudio(ctx, api, b) {
    const { x, y, w, h } = b;
    const st = data.studio;
    const t = api.time;
    px(ctx, '#f2ece0', x, y, w, h);
    // paint splatters (stable)
    const rand = seeded('studio-splat');
    for (let i = 0; i < Math.min(14, 3 + Math.floor(st.cards / 6)); i++) {
      px(ctx, PAINT[Math.floor(rand() * PAINT.length)], x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 1);
    }
    // big gallery windows, softly colour-cycling — more cards, more lights
    const lights = Math.min(Math.floor((w - 2) / 3) * Math.floor((h - 5) / 4), Math.max(1, Math.ceil(st.cards / 5)));
    let k = 0;
    for (let wy = y + 2; wy < y + h - 4 && k < lights; wy += 4) {
      for (let wx = x + 1; wx < x + w - 2 && k < lights; wx += 3) {
        px(ctx, PAINT[(k + Math.floor(t * 0.7)) % PAINT.length], wx, wy, 2, 2);
        k++;
      }
    }
    // bunting along the roof: one flag per line, up to the roof width
    if (st.lines) {
      const flags = Math.min(st.lines, Math.floor(w / 2));
      for (let i = 0; i < flags; i++) {
        px(ctx, PAINT[i % PAINT.length], x + i * 2, y - 1 - (i % 2), 1, 1);
      }
    }
    px(ctx, '#5c3d1a', x + Math.floor(w / 2) - 1, y + h - 3, 2, 3);
    // easels: one per board (cap by spare space), with that board's colours
    const spare = spareRight(api, b);
    const fits = Math.max(1, Math.floor((spare + 1) / 4));
    st.boards.slice(0, Math.min(4, fits)).forEach((board, i) => {
      const ex = x + w + 1 + i * 4;
      const ey = b.baseline - 6;
      px(ctx, '#8a6f3f', ex, ey + 3, 1, 3);
      px(ctx, '#8a6f3f', ex + 2, ey + 3, 1, 3);
      px(ctx, '#ffffff', ex, ey, 3, 3);
      const cols = board.colors.length ? board.colors : ['#c9cfdb'];
      px(ctx, cols[0], ex, ey, 2, 1);
      px(ctx, cols[1 % cols.length], ex + 1, ey + 1, 2, 1);
      px(ctx, cols[2 % cols.length], ex, ey + 2, 1, 1);
      api.addHitbox({
        entity: { id: 'fun-easel-' + board.id, name: board.name, kind: 'fun',
          meta: { lens: 'fun-easel', cards: board.cards, lines: board.lines } },
        x: ex - 1, y: ey - 1, w: 5, h: 8,
      });
    });
    // the painter, beret and all, pacing in front
    const walk = Math.sin(t * 0.6) * Math.max(2, w / 3);
    const ax = x + w / 2 + walk;
    const ay = b.baseline - 3;
    px(ctx, '#5b8cff', ax, ay + 1, 1, 2);
    px(ctx, '#e8d5c0', ax, ay, 1, 1);
    px(ctx, '#e34d4d', ax - 1, ay - 1, 2, 1);
  }

  // ── Pigeons ───────────────────────────────────────────────────────────────
  function roofPoint(b) { return { x: b.x + b.w / 2, y: b.y - 2 }; }

  function drawPigeons(ctx, api, dt) {
    const live = new Set();
    data.links.forEach((link, i) => {
      const A = boxFor(api, link.from);
      const B = boxFor(api, link.to);
      if (!A || !B) return;
      live.add(link.id);
      let p = pigeons.get(link.id);
      if (!p) {
        const rand = seeded('pigeon-' + link.id);
        p = { t: rand(), dir: 1, rest: 0, speed: 0.12 + rand() * 0.08 };
        pigeons.set(link.id, p);
      }
      const a = roofPoint(A), b = roofPoint(B);
      let x, y, flying = true;
      if (A === B) {
        // same building: little loops above the roof
        const ang = api.time * (0.9 + p.speed) + i;
        x = a.x + Math.cos(ang) * 6;
        y = a.y - 6 + Math.sin(ang) * 2;
      } else {
        if (motion) {
          if (p.rest > 0) p.rest -= dt;
          else {
            p.t += p.dir * p.speed * dt;
            if (p.t >= 1 || p.t <= 0) { p.t = Math.max(0, Math.min(1, p.t)); p.dir *= -1; p.rest = 1.5 + (i % 3); }
          }
        }
        flying = p.rest <= 0;
        const s = p.t;
        const cx = (a.x + b.x) / 2;
        const cy = Math.max(3, Math.min(a.y, b.y) - 10 - Math.abs(a.x - b.x) * 0.08);
        x = (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * cx + s * s * b.x;
        y = (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * cy + s * s * b.y;
      }
      const flap = flying && Math.floor(api.time * 8 + i) % 2;
      px(ctx, '#9aa0aa', x, y, 3, 1);
      px(ctx, '#d6dae2', x + (flap ? 0 : 1), y - (flap ? 1 : 0), 2, 1);
      px(ctx, '#5b8cff', x + 3, y, 1, 1);
      // the letter it carries — seal colour by relationship
      const seal = link.relType === 'blocks' ? '#e34d4d' : link.relType === 'depends-on' ? '#ffb84d' : '#ffd24d';
      px(ctx, '#ffffff', x + 1, y + 1, 2, 1);
      px(ctx, seal, x + 1, y + 1, 1, 1);
      api.addHitbox({
        entity: { id: 'fun-pigeon-' + link.id, name: 'Carrier pigeon', kind: 'fun',
          meta: { lens: 'fun-pigeon', ...link } },
        x: Math.round(x) - 2, y: Math.round(y) - 2, w: 7, h: 5,
      });
    });
    for (const id of pigeons.keys()) if (!live.has(id)) pigeons.delete(id);
  }

  // ══ Places (P161): a landmark per Hub page, trees for tools, city services ══
  // Shared by both views: tweak()/treeify()/civicBuildings() tag entities with
  // meta.look; the street view draws them here, machi-iso.js draws its own version.
  const LANDMARKS = {
    'project-hub': 'depot', 'schedule': 'clocktower', 'meetings-hub': 'terminal', 'capture-hub': 'post',
    'journal-hub': 'cafe', 'graph-hub': 'dovecote', 'people-hub': 'apartments', 'stakeholder-hub': 'embassy',
    'tool-portfolio': 'greenhouse', 'town-hub': 'cityhall', 'learning-hub': 'library', 'idea-swiper': 'ferris',
    'canvas-hub': 'studio', 'decision-hub': 'shrine', 'goals-hub': 'stadium', 'risk-hub': 'firestation',
    'achievements-hub': 'home', 'tags-hub': 'market', 'help-hub': 'school',
  };
  const PLACE_NOTES = {
    depot: '🚗 Car depot · your projects start their trips here',
    clocktower: '🕰 Clock tower · the hands show the real time',
    terminal: '🚌 Bus terminal',
    cafe: '☕ Café · fresh coffee for every journal day',
    dovecote: '🕊 Dovecote · home of the carrier pigeons',
    apartments: '🏢 Apartments · your people live here',
    embassy: '🏛 Embassy · flags for every partner',
    greenhouse: '🌱 Greenhouse · where tool trees start',
    cityhall: '🏙 City hall',
    ferris: '🎡 Amusement park · the wheel never stops',
    shrine: '⛩ Shrine · a quiet place to decide',
    stadium: '🏟 Stadium · cheering for your goals',
    firestation: '🚒 Fire station · sends a truck when a building burns',
    home: '🏠 Your home',
    market: '🧺 Market · a stall for each tag',
    school: '🏫 School · learn how the Hub works',
  };
  const TREE_KINDS = { using: 'round', piloting: 'pine', exploring: 'sapling', retired: 'bare' };
  const LEAF = {
    spring: ['#ff9fc4', '#ffc4dc'], summer: ['#3f8a4f', '#5bd67a'],
    autumn: ['#e0803a', '#ffb84d'], winter: ['#c9d3de', '#f4f8fc'],
  };
  let seasonOf = () => 'summer';
  const placeSmoke = [];
  const SHORT_PLACES = new Set(['market', 'festival', 'koban', 'stadium', 'ferris', 'shrine', 'home', 'school', 'clocktower', 'dovecote']);

  function setSeasonSource(fn) { if (typeof fn === 'function') seasonOf = fn; }

  function lookOf(e) { return e && e.meta && e.meta.look; }

  /** Tool Portfolio entity → a tree in the Tool Park. */
  function treeify(entity) {
    entity.hostDrawn = true;
    entity.district = 'Tool Park';
    entity.meta = { ...entity.meta, look: 'tree', tree: TREE_KINDS[entity.meta && entity.meta.status] || 'round' };
    return entity;
  }

  /** City services that appear on their own, from data the Hub already has. */
  function civicBuildings() {
    const out = [];
    if (data.projects.total) {
      out.push({ id: 'fun-koban', name: 'Police box', kind: 'building', district: 'Civic', tier: 1,
        activity: 0.5, hostDrawn: true, meta: { lens: 'fun-koban', look: 'koban' } });
    }
    if (data.responders) {
      out.push({ id: 'fun-hospital', name: 'Hospital', kind: 'building', district: 'Civic', tier: 3,
        activity: 0.7, hostDrawn: true, meta: { lens: 'fun-hospital', look: 'hospital' } });
    }
    if (data.festival.length) {
      out.push({ id: 'fun-festival', name: 'Festival', kind: 'building', district: 'Civic', tier: 3,
        activity: 1, hostDrawn: true, meta: { lens: 'fun-festival', look: 'festival' } });
    }
    return out;
  }

  // ── street drawing helpers ────────────────────────────────────────────────
  function lit(api, e, i) {
    if (api.dayness >= 0.45) return false;
    const r = seeded(e.id + '-w' + i + '-' + Math.floor(api.time / 5 + i * 0.3));
    return r() < 0.25 + e.activity * 0.6;
  }
  function windowsIn(ctx, api, e, x0, y0, x1, y1, sx = 3, sy = 3) {
    let i = 0;
    for (let wy = y0; wy <= y1; wy += sy) {
      for (let wx = x0; wx <= x1; wx += sx) {
        px(ctx, lit(api, e, i) ? '#ffe07a' : api.dayness < 0.45 ? '#10131c' : '#2a2f3a', wx, wy, 1, 1);
        i++;
      }
    }
  }
  function shadow(ctx, b) { px(ctx, 'rgba(20,16,24,0.35)', b.x + 2, b.baseline, b.w, 2); }
  function door(ctx, x, b, color = '#5c3d1a') { px(ctx, color, x, b.baseline - 3, 2, 3); }

  // Fire, weeds and badges for host-drawn buildings (the engine skips them).
  function drawStatus(ctx, api, b, dt) {
    const e = b.entity;
    if (e.staleness > 0.3 && lookOf(e) !== 'tree') {
      const r = seeded(e.id + '-weeds');
      for (let s = 0; s < Math.floor(e.staleness * b.w); s++) px(ctx, '#5f9a63', b.x + Math.floor(r() * b.w), b.baseline - 1, 1, 1);
    }
    // badges sit on the roof, so only for places that fill their slot to the top
    if (!SHORT_PLACES.has(lookOf(e))) {
      const badges = (e.achievements || []).filter((a) => a.id !== 'shipped').slice(0, 3);
      badges.forEach((_, i) => px(ctx, '#ffd24d', b.x + 1 + i * 3, b.y - 3, 2, 2));
    }
    if (e.incident === 'fire' && lookOf(e) !== 'tree') {
      const r = seeded(e.id + '-fire-' + Math.floor(api.time * 6));
      const cols = ['#ffb84d', '#ff5b3d', '#ffe07a'];
      for (let i = 0; i < Math.max(2, Math.floor(b.w / 3)); i++) {
        if (r() < 0.7) px(ctx, cols[Math.floor(r() * 3)], b.x + 1 + i * 3, b.y - 1 - Math.floor(r() * 2), 2, 2);
      }
      if (motion && Math.random() < dt * 2.2 && placeSmoke.length < 80) {
        placeSmoke.push({ x: b.x + Math.random() * b.w, y: b.y - 2, age: 0, life: 1.2 + Math.random() });
      }
    }
  }

  // ── street landmarks ──────────────────────────────────────────────────────
  const PLACE_DRAW = {
    depot(ctx, api, b) {
      const { x, y, w, h } = b;
      px(ctx, '#7a8699', x, y, w, h);
      px(ctx, '#565c6b', x - 1, y, w + 2, 2);
      windowsIn(ctx, api, b.entity, x + 1, y + 3, x + w - 2, b.baseline - 9);
      const doors = Math.max(1, Math.floor((w - 1) / 6));
      for (let i = 0; i < doors; i++) {
        const dx = x + 1 + i * 6;
        px(ctx, '#2a2f3a', dx, b.baseline - 6, 5, 6);
        for (let ly = b.baseline - 5; ly < b.baseline; ly += 2) px(ctx, '#4a5162', dx, ly, 5, 1);
      }
      if (data.projects.open) { px(ctx, PAINT[data.projects.open % PAINT.length], x + 2, b.baseline - 2, 3, 2); }
      px(ctx, '#5b8cff', x + w - 4, y + 3, 3, 3); px(ctx, '#ffffff', x + w - 3, y + 4, 1, 1);
    },
    clocktower(ctx, api, b) {
      const tw = Math.min(b.w, 9), tx = b.x + Math.floor((b.w - tw) / 2);
      px(ctx, '#e8dcc0', tx, b.y + 4, tw, b.h - 4);
      for (let r = 0; r < 4; r++) px(ctx, '#3f6b5a', tx + 3 - r + Math.floor((tw - 7) / 2), b.y + r, 1 + r * 2, 1);
      const cx = tx + Math.floor(tw / 2), cy = b.y + 8;
      px(ctx, '#ffffff', cx - 2, cy - 2, 5, 5);
      px(ctx, '#2a2f3a', cx, cy, 1, 1);
      const now = new Date();
      const hand = (frac, len) => { const a = frac * Math.PI * 2 - Math.PI / 2; px(ctx, '#2a2f3a', cx + Math.round(Math.cos(a) * len), cy + Math.round(Math.sin(a) * len), 1, 1); };
      hand(now.getMinutes() / 60, 2);
      hand((now.getHours() % 12) / 12, 1);
      windowsIn(ctx, api, b.entity, tx + 2, cy + 5, tx + tw - 3, b.baseline - 5, 3, 4);
      door(ctx, cx - 1, b);
    },
    terminal(ctx, api, b) {
      const { x, y, w, h } = b;
      const glass = api.dayness < 0.45 ? '#c9b46a' : '#9ec9e8';
      px(ctx, glass, x, y + 2, w, h - 2);
      for (let mx = x; mx < x + w; mx += 3) px(ctx, '#4a5162', mx, y + 2, 1, h - 2);
      px(ctx, '#5b8cff', x - 1, y, w + 2, 2);
      px(ctx, '#ffd24d', x + 1, y + 3, Math.min(5, w - 2), 1);
      door(ctx, x + Math.floor(w / 2) - 1, b, '#2a2f3a');
    },
    cafe(ctx, api, b) {
      const { x, y, w } = b;
      px(ctx, '#b07a4a', x, y, w, b.h);
      px(ctx, '#7a4f2a', x - 1, y, w + 2, 1);
      windowsIn(ctx, api, b.entity, x + 2, y + 3, x + w - 3, b.baseline - 10);
      for (let i = 0; i < w + 2; i += 2) px(ctx, (i / 2) % 2 ? '#ffffff' : '#e34d4d', x - 1 + i, b.baseline - 8, 2, 2);
      px(ctx, '#ffe9c4', x + 1, b.baseline - 5, 3, 3);
      px(ctx, '#ffffff', x + 2, b.baseline - 4, 1, 1);
      if (Math.floor(api.time * 1.5) % 2) px(ctx, '#e8ecf5', x + 2, b.baseline - 7, 1, 1);
      door(ctx, x + w - 4, b);
      const sx = x + w + 2;
      if (spareRight(api, b) >= 6) {
        px(ctx, '#e34d4d', sx, b.baseline - 6, 4, 1); px(ctx, '#8a8f9c', sx + 1, b.baseline - 5, 1, 5);
        px(ctx, '#d8c9a8', sx, b.baseline - 2, 3, 1);
      }
    },
    dovecote(ctx, api, b) {
      const tw = Math.min(b.w, 10), tx = b.x + Math.floor((b.w - tw) / 2);
      px(ctx, '#a89f91', tx, b.y + 3, tw, b.h - 3);
      for (let r = 0; r < 3; r++) px(ctx, '#7a5a3a', tx + 2 - r, b.y + r, tw - 4 + r * 2, 1);
      for (let hy = b.y + 5; hy < b.baseline - 4; hy += 3) for (let hx = tx + 1; hx < tx + tw - 1; hx += 3) px(ctx, '#3a3f4a', hx, hy, 1, 1);
      for (let i = 0; i < 2; i++) {
        const bob = Math.floor(api.time * 2 + i) % 2;
        px(ctx, '#9aa0aa', tx + 2 + i * 4, b.y - 1 - bob, 2, 1);
        px(ctx, '#5b8cff', tx + 4 + i * 4, b.y - 1 - bob, 1, 1);
      }
      door(ctx, tx + Math.floor(tw / 2) - 1, b);
    },
    apartments(ctx, api, b) {
      const { x, y, w, h } = b;
      px(ctx, '#f2c4a8', x, y, w, h);
      px(ctx, '#c88f72', x, y, w, 1);
      windowsIn(ctx, api, b.entity, x + 1, y + 2, x + w - 2, b.baseline - 4, 3, 4);
      for (let by = y + 5; by < b.baseline - 3; by += 4) {
        px(ctx, '#ffffff', x - 1, by, w + 2, 1);
        if ((by / 4) % 2) px(ctx, '#5bd67a', x, by - 1, 1, 1);
      }
      door(ctx, x + Math.floor(w / 2) - 1, b);
    },
    embassy(ctx, api, b) {
      const { x, y, w, h } = b;
      px(ctx, '#efe9df', x, y + 2, w, h - 2);
      for (let r = 0; r < 2; r++) px(ctx, '#d8c9a8', x - 1 + r, y + r, w + 2 - r * 2, 1);
      for (let cx = x + 1; cx < x + w - 1; cx += 2) px(ctx, '#ffffff', cx, b.baseline - 6, 1, 6);
      windowsIn(ctx, api, b.entity, x + 2, y + 4, x + w - 3, b.baseline - 9);
      for (let i = 0; i < 3; i++) {
        const fx = x + 1 + Math.floor(i * (w - 3) / 2);
        px(ctx, '#c9cfdb', fx, y - 5, 1, 5);
        px(ctx, PAINT[(i * 2 + 1) % PAINT.length], fx + 1, y - 5 + (Math.floor(api.time * 2 + i) % 2), 2, 2);
      }
    },
    greenhouse(ctx, api, b) {
      const { x, y, w, h } = b;
      const top = y + Math.floor(h / 3);
      for (let r = 0; r < top - y; r++) {
        const inset = Math.max(0, Math.round((top - y - r) * 0.8));
        px(ctx, '#bfe6d0', x + inset, y + r, w - inset * 2, 1);
      }
      px(ctx, '#bfe6d0', x, top, w, b.baseline - top);
      for (let fx = x; fx < x + w; fx += 3) px(ctx, '#e8ecf5', fx, top, 1, b.baseline - top);
      px(ctx, '#e8ecf5', x, top, w, 1);
      const r = seeded('greenhouse');
      for (let i = 0; i < w; i++) px(ctx, r() < 0.5 ? '#3f8a4f' : '#5bd67a', x + i, b.baseline - 2 - Math.floor(r() * 4), 1, 2);
      if (api.dayness < 0.45) px(ctx, 'rgba(255,224,122,0.25)', x, top, w, b.baseline - top);
    },
    cityhall(ctx, api, b) {
      const { x, y, w, h } = b;
      const dome = Math.max(2, Math.floor(w / 4));
      px(ctx, '#e8dcc0', x, y + dome + 1, w, h - dome - 1);
      for (let r = 0; r <= dome; r++) {
        const half = Math.round(Math.sqrt(dome * dome - (dome - r) * (dome - r)));
        px(ctx, '#ffd24d', x + Math.floor(w / 2) - half, y + r + 1, half * 2, 1);
      }
      px(ctx, '#c9cfdb', x + Math.floor(w / 2), y - 4, 1, 5);
      px(ctx, '#5bd67a', x + Math.floor(w / 2) + 1, y - 4 + (Math.floor(api.time * 2) % 2), 3, 2);
      for (let cx = x + 1; cx < x + w - 1; cx += 2) px(ctx, '#ffffff', cx, b.baseline - 7, 1, 7);
      windowsIn(ctx, api, b.entity, x + 2, y + dome + 3, x + w - 3, b.baseline - 10);
      door(ctx, x + Math.floor(w / 2) - 1, b);
    },
    ferris(ctx, api, b) {
      const r = Math.max(4, Math.min(Math.floor(b.w / 2), Math.floor((b.h - 3) / 2)));
      const cx = b.x + Math.floor(b.w / 2), cy = b.baseline - r - 3;
      px(ctx, '#8a8f9c', cx - Math.floor(r / 2), cy + 1, 1, b.baseline - cy - 1);
      px(ctx, '#8a8f9c', cx + Math.floor(r / 2), cy + 1, 1, b.baseline - cy - 1);
      const night = api.dayness < 0.45;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        px(ctx, night ? PAINT[(i + Math.floor(api.time * 3)) % PAINT.length] : '#ff9fc4', cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 1, 1);
      }
      const spin = motion ? api.time * 0.5 : 0;
      for (let i = 0; i < 6; i++) {
        const a = spin + (i / 6) * Math.PI * 2;
        const gx = cx + Math.round(Math.cos(a) * r), gy = cy + Math.round(Math.sin(a) * r);
        for (let k = 1; k < r; k += 2) px(ctx, '#c9cfdb', cx + Math.round(Math.cos(a) * k), cy + Math.round(Math.sin(a) * k), 1, 1);
        px(ctx, PAINT[i % PAINT.length], gx - 1, gy, 3, 2);
      }
      px(ctx, '#ffd24d', cx, cy, 1, 1);
    },
    shrine(ctx, api, b) {
      const { x, w } = b;
      const hx = x + Math.floor(w * 0.4), hw = w - Math.floor(w * 0.4);
      const hy = b.baseline - Math.min(b.h, 12);
      px(ctx, '#8f5a3a', hx, hy + 3, hw, b.baseline - hy - 3);
      px(ctx, '#3a3f4a', hx - 2, hy + 1, hw + 4, 2);
      px(ctx, '#3a3f4a', hx - 2, hy, 1, 1); px(ctx, '#3a3f4a', hx + hw + 1, hy, 1, 1);
      px(ctx, '#ffd98a', hx + Math.floor(hw / 2) - 1, b.baseline - 4, 2, 2);
      // torii in front
      const tx = x, th = 9;
      px(ctx, '#e34d4d', tx, b.baseline - th + 2, 1, th - 2);
      px(ctx, '#e34d4d', tx + 5, b.baseline - th + 2, 1, th - 2);
      px(ctx, '#e34d4d', tx - 1, b.baseline - th, 8, 1);
      px(ctx, '#e34d4d', tx, b.baseline - th + 2, 6, 1);
      if (api.dayness < 0.45) px(ctx, 'rgba(255,217,138,0.3)', hx, b.baseline - 6, hw, 4);
    },
    stadium(ctx, api, b) {
      const { x, w } = b;
      const sh = Math.min(b.h, 12), sy = b.baseline - sh;
      for (let r = 0; r < sh; r++) px(ctx, r % 3 === 0 ? '#565c6b' : '#8a8f9c', x + Math.max(0, 3 - Math.floor(r / 2)), sy + r, w - Math.max(0, 3 - Math.floor(r / 2)) * 2, 1);
      const rand = seeded('crowd');
      for (let r = 1; r < sh - 2; r += 3) {
        for (let cx = x + 2; cx < x + w - 2; cx += 2) {
          const jump = motion && Math.floor(api.time * 4 + cx / 3) % 6 === 0 ? 1 : 0;
          px(ctx, PAINT[Math.floor(rand() * PAINT.length)], cx, sy + r - jump, 1, 1);
        }
      }
      const night = api.dayness < 0.45;
      for (const lx of [x, x + w - 1]) {
        px(ctx, '#6b707c', lx, sy - 8, 1, 8);
        px(ctx, night ? '#ffffff' : '#c9cfdb', lx - 1, sy - 9, 3, 1);
        if (night) px(ctx, 'rgba(255,255,255,0.18)', lx - 3, sy - 8, 7, 5);
      }
      px(ctx, '#5bd67a', x + Math.floor(w / 2), sy - 3 + (Math.floor(api.time * 2) % 2), 2, 1);
    },
    firestation(ctx, api, b) {
      const { x, y, w, h } = b;
      px(ctx, '#b8402e', x, y, w, h);
      px(ctx, '#ffffff', x, y + 2, w, 1);
      windowsIn(ctx, api, b.entity, x + 1, y + 4, x + w - 2, b.baseline - 9);
      const dw = Math.min(w - 2, 8), dx = x + 1;
      px(ctx, '#2a2f3a', dx, b.baseline - 6, dw, 6);
      if (!data.burning) { px(ctx, '#e34d4d', dx + 1, b.baseline - 4, dw - 2, 3); px(ctx, '#ffe07a', dx + 1, b.baseline - 3, 1, 1); }
      const alarm = data.burning && Math.floor(api.time * 4) % 2;
      px(ctx, alarm ? '#ff5b5b' : '#8f3311', x + w - 3, y - 2, 2, 2);
    },
    home(ctx, api, b) {
      const { x, w } = b;
      const wall = Math.min(b.h, 10), wy = b.baseline - wall;
      px(ctx, '#f2e3c6', x + 1, wy, w - 2, wall);
      const rh = Math.ceil(w / 2);
      for (let r = 0; r < rh; r++) px(ctx, '#c8553d', x + rh - 1 - r, wy - rh + r, Math.max(1, (r + 1) * 2 - (w % 2 ? 1 : 0)), 1);
      px(ctx, '#8f3311', x + w - 4, wy - rh, 2, 3);
      if (Math.floor(api.time) % 3 === 0) px(ctx, 'rgba(200,204,216,0.6)', x + w - 4, wy - rh - 2, 1, 1);
      px(ctx, '#5c3d1a', x + 2, b.baseline - 4, 2, 4);
      px(ctx, '#ffd24d', x + 3, b.baseline - 3, 1, 1);
      px(ctx, lit(api, b.entity, 0) ? '#ffe07a' : '#9ec9e8', x + w - 5, wy + 2, 3, 2);
      for (let fx = x - 1; fx < x + w + 1; fx += 2) px(ctx, '#ffffff', fx, b.baseline - 2, 1, 2);
      px(ctx, '#ff6b8b', x + w - 2, b.baseline - 1, 1, 1);
    },
    market(ctx, api, b) {
      const stalls = Math.max(1, Math.min(Math.floor((b.w + 1) / 5), Math.max(1, data.tags)));
      for (let i = 0; i < stalls; i++) {
        const sx = b.x + i * 5;
        const c = PAINT[(i * 2) % PAINT.length];
        for (let k = 0; k < 4; k++) px(ctx, k % 2 ? '#ffffff' : c, sx + k, b.baseline - 8, 1, 2);
        px(ctx, '#8a6f3f', sx, b.baseline - 6, 1, 6); px(ctx, '#8a6f3f', sx + 3, b.baseline - 6, 1, 6);
        px(ctx, '#d8c9a8', sx, b.baseline - 3, 4, 1);
        px(ctx, PAINT[(i + 3) % PAINT.length], sx + 1, b.baseline - 4, 1, 1);
        px(ctx, PAINT[(i + 1) % PAINT.length], sx + 2, b.baseline - 4, 1, 1);
      }
    },
    school(ctx, api, b) {
      const { x, w } = b;
      const bh = Math.min(b.h, 14), by = b.baseline - bh;
      px(ctx, '#f2d58a', x, by, w, bh);
      px(ctx, '#b29245', x - 1, by, w + 2, 1);
      const tx = x + Math.floor(w / 2) - 2;
      px(ctx, '#f2d58a', tx, by - 5, 4, 5);
      px(ctx, '#b29245', tx - 1, by - 6, 6, 1);
      px(ctx, '#ffffff', tx + 1, by - 4, 2, 2);
      windowsIn(ctx, api, b.entity, x + 1, by + 3, x + w - 2, b.baseline - 4, 3, 4);
      door(ctx, x + Math.floor(w / 2) - 1, b);
      if (api.dayness >= 0.45 && motion) {
        for (let i = 0; i < 2; i++) {
          const kx = b.x + Math.floor((Math.sin(api.time * 0.8 + i * 2) + 1) / 2 * (w - 1));
          px(ctx, i ? '#5b8cff' : '#ff6b6b', kx, b.baseline - 2, 1, 2);
          px(ctx, '#e8d5c0', kx, b.baseline - 3, 1, 1);
        }
      }
    },
    hospital(ctx, api, b) {
      const { x, y, w, h } = b;
      px(ctx, '#f2f4f8', x, y, w, h);
      px(ctx, '#c9cfdb', x, y, w, 1);
      const cx = x + Math.floor(w / 2);
      px(ctx, '#e34d4d', cx - 1, y + 2, 3, 1); px(ctx, '#e34d4d', cx, y + 1, 1, 3);
      windowsIn(ctx, api, b.entity, x + 1, y + 6, x + w - 2, b.baseline - 5, 3, 3);
      px(ctx, '#9ec9e8', cx - 2, b.baseline - 4, 4, 4);
    },
    koban(ctx, api, b) {
      const kw = 7, kx = b.x + Math.floor((b.w - kw) / 2), kh = 8, ky = b.baseline - kh;
      px(ctx, '#e8ecf5', kx, ky, kw, kh);
      px(ctx, '#3a3f4a', kx - 1, ky - 1, kw + 2, 1);
      px(ctx, Math.floor(api.time * 1.5) % 2 ? '#ff5b5b' : '#e34d4d', kx + 3, ky - 3, 1, 2);
      if (api.dayness < 0.45) px(ctx, 'rgba(255,91,91,0.25)', kx + 2, ky - 4, 3, 3);
      px(ctx, '#9ec9e8', kx + 1, ky + 2, 2, 2);
      px(ctx, '#2a2f3a', kx + 4, b.baseline - 4, 2, 4);
      const ox = kx + kw + 1;
      px(ctx, '#2a3f7a', ox, b.baseline - 3, 1, 3);
      px(ctx, '#e8d5c0', ox, b.baseline - 4, 1, 1);
      px(ctx, '#2a3f7a', ox, b.baseline - 5, 1, 1);
      px(ctx, '#e8d5c0', ox + 1, b.baseline - 3 - (Math.floor(api.time * 2) % 2), 1, 1);
    },
    festival(ctx, api, b) {
      const n = Math.max(1, Math.min(3, Math.floor((b.w + 1) / 5)));
      for (let i = 0; i < n; i++) {
        const tx = b.x + i * 5, c = PAINT[(i * 2 + 1) % PAINT.length];
        for (let r = 0; r < 3; r++) px(ctx, r % 2 ? '#ffffff' : c, tx + 2 - r, b.baseline - 7 + r, 1 + r * 2, 1);
        px(ctx, c, tx, b.baseline - 4, 5, 4);
        px(ctx, '#2a2f3a', tx + 2, b.baseline - 2, 1, 2);
      }
      const night = api.dayness < 0.45;
      for (let lx = b.x - 1; lx < b.x + b.w + 1; lx += 2) {
        px(ctx, (lx / 2) % 2 ? '#ffffff' : '#e34d4d', lx, b.baseline - 9 + ((lx / 2) % 2), 1, 1);
        if (night) px(ctx, 'rgba(255,120,90,0.2)', lx - 1, b.baseline - 10, 3, 3);
      }
    },
  };

  // ── trees (Tool Park) ─────────────────────────────────────────────────────
  function drawTree(ctx, api, b) {
    const e = b.entity;
    const season = seasonOf();
    const withered = e.incident === 'fire';
    const [leaf, leaf2] = withered ? ['#8a6f3f', '#b29245'] : LEAF[season];
    const kind = e.meta.tree;
    const cx = b.x + Math.floor(b.w / 2);
    const night = api.dayness < 0.45;
    px(ctx, 'rgba(20,16,24,0.3)', cx - 3, b.baseline, 7, 1);
    if (kind === 'sapling') {
      px(ctx, '#8a6f3f', cx + 2, b.baseline - 6, 1, 6);
      px(ctx, '#6b4a2a', cx, b.baseline - 4, 1, 4);
      px(ctx, leaf, cx - 1, b.baseline - 5, 1, 1); px(ctx, leaf2, cx + 1, b.baseline - 6, 1, 1);
      px(ctx, '#ffffff', cx + 3, b.baseline - 6, 2, 1);
      return;
    }
    const trunkH = Math.max(3, Math.floor(b.h * 0.35));
    px(ctx, '#6b4a2a', cx - (b.w > 13 ? 1 : 0), b.baseline - trunkH, b.w > 13 ? 2 : 1, trunkH);
    const top = b.y + 1, bottom = b.baseline - trunkH + 1;
    if (kind === 'bare') {
      for (let i = 0; i < 4; i++) {
        const by = bottom - 2 - i * 2, dir = i % 2 ? 1 : -1;
        for (let k = 1; k <= 2 + (i % 2); k++) px(ctx, '#6b4a2a', cx + dir * k, by - k, 1, 1);
      }
      return;
    }
    if (kind === 'pine') {
      const ht = bottom - top;
      for (let r = 0; r < ht; r++) {
        const half = Math.max(0, Math.round((r % Math.max(3, Math.floor(ht / 3)) + r / 3) * 0.6 * (b.w / 14)));
        px(ctx, withered ? leaf : season === 'winter' && r < 2 ? '#ffffff' : '#2f6b3f', cx - half, top + r, half * 2 + 1, 1);
      }
    } else {
      const rx = Math.floor(b.w / 2), ry = Math.max(3, Math.floor((bottom - top) / 2));
      const my = top + ry;
      for (let dy = -ry; dy <= ry; dy++) {
        const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
        if (half <= 0) continue;
        px(ctx, dy < -ry / 3 ? leaf2 : leaf, cx - half, my + dy, half * 2 + 1, 1);
      }
      if (!withered && e.activity > 0.6) {
        const r = seeded(e.id + '-bloom');
        const dot = season === 'summer' ? '#e34d4d' : season === 'autumn' ? '#ffd24d' : season === 'spring' ? '#ffffff' : null;
        if (dot) for (let i = 0; i < 4; i++) px(ctx, dot, cx - rx + 1 + Math.floor(r() * (rx * 2 - 1)), my - ry + 2 + Math.floor(r() * ry * 1.5), 1, 1);
      }
    }
    if (withered && motion) {
      const t = (api.time * 0.4 + (e.id.length % 5) / 5) % 1;
      px(ctx, leaf2, cx + Math.round(Math.sin(t * 9) * 3), top + Math.round(t * (b.baseline - top)), 1, 1);
    }
    if (season === 'winter' && night && !withered) {
      for (let i = 0; i < 5; i++) {
        const on = Math.floor(api.time * 2 + i) % 3;
        if (on) px(ctx, PAINT[(i + Math.floor(api.time)) % PAINT.length], b.x + 1 + ((i * 5) % Math.max(2, b.w - 2)), top + 2 + ((i * 3) % Math.max(2, bottom - top - 2)), 1, 1);
      }
    }
    if (season === 'spring' && kind === 'round' && !withered) {
      px(ctx, '#e34d4d', cx + 2, b.baseline - 1, 2, 1); px(ctx, '#ffffff', cx + 4, b.baseline - 1, 2, 1);
    }
  }

  // ── seasonal festivals + fire trucks (street) ─────────────────────────────
  function drawSeason(ctx, api) {
    const season = seasonOf();
    const night = api.dayness < 0.45;
    const { TOP_SKY, ROW_H, BUILD_ZONE } = api.layout;
    if (season === 'summer') {
      // matsuri lanterns strung along every street
      // a red and a white lantern on every street lamp
      for (let r = 0; r < api.grid.rows; r++) {
        const y = TOP_SKY + r * ROW_H + BUILD_ZONE - 6;
        for (let c = 0; c <= api.grid.cols; c++) {
          const lx = slotX(api, c) - 1;
          if (lx < 2 || lx > api.grid.width - 3) continue;
          px(ctx, '#e34d4d', lx - 2, y, 1, 2);
          px(ctx, '#ffffff', lx + 2, y, 1, 2);
          if (night) { px(ctx, 'rgba(255,120,90,0.25)', lx - 3, y - 1, 3, 4); px(ctx, 'rgba(255,255,255,0.15)', lx + 1, y - 1, 3, 4); }
        }
      }
    } else if (season === 'autumn' && night) {
      // tsukimi: a big full moon
      const mx = api.grid.width - 16;
      for (let dy = -3; dy <= 3; dy++) {
        const half = Math.round(Math.sqrt(9 - dy * dy));
        px(ctx, '#fff3c4', mx - half, 8 + dy, half * 2 + 1, 1);
      }
    }
  }

  function drawFireTrucks(ctx, api, dt) {
    if (!api.hitboxes.some((b) => lookOf(b.entity) === 'firestation')) return;
    api.hitboxes.filter((b) => b.entity.incident === 'fire' && lookOf(b.entity) !== 'tree').slice(0, 2).forEach((b) => {
      const ty = roadY(api, b.row, 0);
      const tx = b.x + Math.floor(b.w / 2) - 4;
      px(ctx, '#e34d4d', tx, ty, 9, 3);
      px(ctx, '#ffffff', tx + 1, ty, 6, 1);
      px(ctx, '#10131c', tx + 1, ty + 3, 1, 1); px(ctx, '#10131c', tx + 6, ty + 3, 1, 1);
      px(ctx, Math.floor(api.time * 4) % 2 ? '#ff5b5b' : '#5b8cff', tx + 7, ty - 1, 1, 1);
      if (!motion) return;
      for (let i = 0; i < 6; i++) {
        const t = ((api.time * 1.2 + i / 6) % 1);
        const wx = tx + 4 + (b.x + b.w / 2 - tx - 4) * t * 0.3 + Math.sin(i) * 2;
        const wy = ty - 1 - (ty - b.y) * Math.sin(t * Math.PI) * 0.9;
        px(ctx, '#9fd0f0', wx, wy, 1, 1);
      }
    });
  }


  // ── Street: fill the gaps (P162) ──────────────────────────────────────────
  // The engine gives every place a fixed slot and starts each district on a new
  // row, so park rows looked like lone trees between lamp posts and row ends sat
  // empty. Park rows get one continuous park; empty slots get small scenery.
  // Scenery is decoration only: no hitbox, no data.
  function slotX(api, c) {
    const { MARGIN_X, CELL_W, AVENUE_W } = api.layout;
    return MARGIN_X + c * CELL_W + (api.grid.hasAvenue && c >= api.grid.avenueAfter ? AVENUE_W : 0);
  }
  function slotOf(api, b) {
    const { MARGIN_X, CELL_W, AVENUE_W } = api.layout;
    let rel = b.x - 3 - MARGIN_X;
    if (api.grid.hasAvenue && rel >= api.grid.avenueAfter * CELL_W + AVENUE_W) rel -= AVENUE_W;
    return Math.round(rel / CELL_W);
  }
  function rowBase(api, r) { return api.layout.TOP_SKY + r * api.layout.ROW_H + api.layout.BUILD_ZONE; }

  function smallTree(ctx, x, base, h, leaf, leaf2) {
    px(ctx, '#5c3d1a', x, base - Math.ceil(h / 3), 1, Math.ceil(h / 3));
    const r = Math.max(2, Math.floor(h / 3)), my = base - Math.ceil(h / 3) - r + 1;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(r * Math.sqrt(1 - (dy * dy) / (r * r)));
      px(ctx, dy < 0 ? leaf2 : leaf, x - half, my + dy, half * 2 + 1, 1);
    }
  }

  function hedge(ctx, x0, x1, base, rand, season, night) {
    const [leaf, leaf2] = LEAF.summer; // hedges stay green; winter adds snow on top
    for (let x = x0; x < x1; x++) {
      const h = 2 + Math.floor(rand() * 2);
      px(ctx, x % 5 === 0 ? leaf2 : leaf, x, base - h, 1, h);
      if (season === 'winter') px(ctx, '#f4f8fc', x, base - h, 1, 1);
    }
    // spring/summer flowers, autumn fallen leaves, winter night lights
    for (let x = x0 + 2; x < x1; x += 5 + Math.floor(rand() * 5)) {
      const dot = season === 'autumn' ? '#e0803a'
        : season === 'winter' ? (night ? PAINT[Math.floor(rand() * PAINT.length)] : null)
          : PAINT[Math.floor(rand() * PAINT.length)];
      if (dot) px(ctx, dot, x, base - 3, 1, 1);
    }
  }

  function drawParkRows(ctx, api) {
    const season = seasonOf(), night = api.dayness < 0.45;
    const rows = new Map();
    for (const b of api.hitboxes) {
      if (lookOf(b.entity) !== 'tree') continue;
      const c = slotOf(api, b);
      const set = rows.get(b.row) || new Set();
      set.add(c); rows.set(b.row, set);
    }
    for (const [r, cols] of rows) {
      const base = rowBase(api, r);
      const rand = seeded('park-row-' + r);
      const [leaf, leaf2] = season === 'autumn' ? ['#b8662e', '#e0803a'] : season === 'winter' ? ['#8aa0a8', '#c9d3de'] : ['#3f7a4a', '#4f9a5a'];
      for (const c of cols) {
        const x0 = slotX(api, c) - 2, x1 = x0 + api.layout.CELL_W + 2;
        // small trees at the slot edges only, so the tool tree in the middle stays clear
        for (const ex of [x0 + 3, x0 + api.layout.CELL_W - 1]) {
          if (rand() < 0.3) continue;
          const h = 6 + Math.floor(rand() * 4);
          if (rand() < 0.35) {
            for (let r = 0; r < h - 2; r++) px(ctx, '#2f6b3f', ex - Math.floor(r / 3), base - h + r, 1 + Math.floor(r / 3) * 2, 1);
            px(ctx, '#5c3d1a', ex, base - 2, 1, 2);
          } else smallTree(ctx, ex, base - 1, h, leaf, leaf2);
        }
        hedge(ctx, x0, x1, base, rand, season, night);
      }
    }
  }

  const FILLERS_TOWN = ['houses', 'vending', 'playground', 'garden', 'parking', 'pond'];
  const FILLERS_PARK = ['grove', 'pond', 'garden'];

  function drawFiller(ctx, api, kind, x, base, seedKey) {
    const rand = seeded('filler-' + seedKey);
    const night = api.dayness < 0.45, season = seasonOf(), t = api.time;
    const W = api.layout.CELL_W;
    if (kind === 'houses') {
      for (let i = 0; i < 2; i++) {
        const hx = x + 2 + i * 12, hw = 9, hh = 6 + Math.floor(rand() * 4);
        const wall = ['#f2e3c6', '#e8dcc0', '#d8e4f0', '#f2d5c4'][Math.floor(rand() * 4)];
        const roof = ['#3a4a6a', '#6b3a3a', '#3f5a4a', '#5c432a'][Math.floor(rand() * 4)];
        px(ctx, wall, hx, base - hh, hw, hh);
        for (let r = 0; r < 3; r++) px(ctx, roof, hx - 1 + r, base - hh - 3 + r, hw + 2 - r * 2, 1);
        px(ctx, roof, hx - 1, base - hh, hw + 2, 1);
        const lit = night && rand() < 0.7;
        px(ctx, lit ? '#ffe07a' : '#9ec9e8', hx + 1, base - hh + 2, 2, 2);
        px(ctx, '#5c3d1a', hx + hw - 3, base - 3, 2, 3);
        if (season === 'winter') px(ctx, '#ffffff', hx, base - hh - 3, hw, 1);
      }
      if (rand() < 0.5) px(ctx, '#ff9f5b', x + 13, base - 2 - (Math.floor(t) % 2 ? 0 : 0), 2, 1); // a sleeping cat
    } else if (kind === 'vending') {
      for (let i = 0; i < 2; i++) {
        const vx = x + 4 + i * 5;
        px(ctx, i ? '#e34d4d' : '#5b8cff', vx, base - 9, 4, 9);
        px(ctx, night ? '#fff3c4' : '#e8ecf5', vx + 1, base - 8, 2, 4);
        if (night) px(ctx, 'rgba(255,243,196,0.2)', vx - 1, base - 9, 6, 10);
      }
      px(ctx, '#8a6f3f', x + 15, base - 3, 6, 1); px(ctx, '#8a6f3f', x + 15, base - 2, 1, 2); px(ctx, '#8a6f3f', x + 20, base - 2, 1, 2);
      px(ctx, '#565c6b', x + 22, base - 3, 3, 1); px(ctx, '#2a2f3a', x + 21, base - 2, 2, 2); px(ctx, '#2a2f3a', x + 24, base - 2, 2, 2);
    } else if (kind === 'playground') {
      px(ctx, '#e34d4d', x + 3, base - 8, 1, 8); px(ctx, '#e34d4d', x + 3, base - 8, 4, 1);
      for (let k = 0; k < 6; k++) px(ctx, '#ffd24d', x + 4 + k, base - 7 + k, 1, 1);
      px(ctx, '#8a8f9c', x + 13, base - 9, 1, 9); px(ctx, '#8a8f9c', x + 21, base - 9, 1, 9); px(ctx, '#8a8f9c', x + 13, base - 9, 9, 1);
      const sw = motion ? Math.round(Math.sin(t * 2) * 2) : 0;
      px(ctx, '#5c3d1a', x + 16 + sw, base - 3, 3, 1);
      if (!night) { px(ctx, '#5b8cff', x + 17 + sw, base - 5, 1, 2); px(ctx, '#e8d5c0', x + 17 + sw, base - 6, 1, 1); }
      px(ctx, '#d8c9a8', x + 1, base - 1, W - 4, 1);
    } else if (kind === 'garden') {
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
        const col = season === 'winter' ? '#c9d3de' : season === 'autumn' ? '#e0803a' : k % 2 ? '#5bd67a' : '#3f8a4f';
        px(ctx, col, x + 3 + k * 3, base - 2 - r * 2, 2, 1);
      }
      px(ctx, '#8a6f3f', x + 22, base - 8, 1, 8); px(ctx, '#8a6f3f', x + 20, base - 6, 5, 1);
      px(ctx, '#e8d5c0', x + 21, base - 10, 3, 2); px(ctx, '#ffd24d', x + 20, base - 11, 5, 1);
    } else if (kind === 'parking') {
      px(ctx, '#3a3f4a', x + 1, base - 1, W - 2, 1);
      for (let i = 0; i < 3; i++) {
        const cx = x + 2 + i * 8;
        px(ctx, '#c9cfdb', cx - 1, base - 4, 1, 3);
        if (rand() < 0.8) {
          const col = PAINT[Math.floor(rand() * PAINT.length)];
          px(ctx, col, cx, base - 3, 6, 2); px(ctx, col, cx + 1, base - 4, 4, 1);
          px(ctx, '#10131c', cx + 1, base - 1, 1, 1); px(ctx, '#10131c', cx + 4, base - 1, 1, 1);
        }
      }
    } else if (kind === 'pond') {
      const water = season === 'winter' ? '#c9e0f0' : '#4a8fc9';
      for (let r = 0; r < 3; r++) px(ctx, water, x + 3 + (2 - r), base - 1 - r, W - 6 - (2 - r) * 2, 1);
      if (season !== 'winter') {
        const dx = motion ? Math.round((Math.sin(t * 0.4) + 1) / 2 * (W - 12)) : 4;
        px(ctx, '#ffffff', x + 5 + dx, base - 3, 2, 1); px(ctx, '#ffd24d', x + 7 + dx, base - 3, 1, 1);
        px(ctx, '#9fd0f0', x + 6 + ((Math.floor(t * 2) * 3) % (W - 10)), base - 2, 2, 1);
      }
      for (const rx of [x + 2, x + W - 4]) { px(ctx, '#4f7a3a', rx, base - 5, 1, 4); px(ctx, '#8a6f3f', rx, base - 6, 1, 1); }
    } else if (kind === 'grove') {
      const [leaf, leaf2] = season === 'autumn' ? ['#b8662e', '#e0803a'] : season === 'winter' ? ['#8aa0a8', '#c9d3de'] : ['#3f7a4a', '#4f9a5a'];
      for (let k = 0; k < 3; k++) smallTree(ctx, x + 4 + k * 8 + Math.floor(rand() * 2), base - 1, 9 + Math.floor(rand() * 7), leaf, leaf2);
      px(ctx, '#8a6f3f', x + 8, base - 3, 6, 1); px(ctx, '#8a6f3f', x + 8, base - 2, 1, 2); px(ctx, '#8a6f3f', x + 13, base - 2, 1, 2);
    }
  }

  function drawFillers(ctx, api) {
    const used = new Set();
    const parkRow = new Map();
    for (const b of api.hitboxes) {
      used.add(b.row + ':' + slotOf(api, b));
      const tree = lookOf(b.entity) === 'tree';
      parkRow.set(b.row, (parkRow.get(b.row) ?? true) && tree);
    }
    for (let r = 0; r < api.grid.rows; r++) {
      const base = rowBase(api, r);
      const park = parkRow.get(r) === true;
      let prev = null; // no two of the same scenery side by side
      for (let c = 0; c < api.grid.cols; c++) {
        if (used.has(r + ':' + c)) continue;
        const rand = seeded('slot-' + r + '-' + c);
        const list = park ? FILLERS_PARK : FILLERS_TOWN;
        let kind = list[Math.floor(rand() * list.length)];
        if (kind === prev) kind = list[(list.indexOf(kind) + 1 + Math.floor(rand() * (list.length - 1))) % list.length];
        prev = kind;
        const x = slotX(api, c);
        if (park) hedge(ctx, x - 2, x + api.layout.CELL_W, base, rand, seasonOf(), api.dayness < 0.45);
        drawFiller(ctx, api, kind, x, base, r + '-' + c);
      }
    }
  }

  function drawPlaces(ctx, api, dt) {
    data.burning = api.hitboxes.some((b) => b.entity.incident === 'fire' && lookOf(b.entity) !== 'tree');
    for (const b of api.hitboxes) {
      const look = lookOf(b.entity);
      if (!b.entity.hostDrawn || !look) continue;
      if (look === 'tree') { drawTree(ctx, api, b); continue; }
      if (PLACE_DRAW[look]) { shadow(ctx, b); PLACE_DRAW[look](ctx, api, b); }
      drawStatus(ctx, api, b, dt);
    }
    for (const s of placeSmoke) {
      s.age += dt; s.y -= 4 * dt; s.x += Math.sin(s.age * 3) * dt * 2;
      px(ctx, `rgba(60,58,56,${(0.55 * (1 - s.age / s.life)).toFixed(2)})`, s.x, s.y, 2, 2);
    }
    for (let i = placeSmoke.length - 1; i >= 0; i--) if (placeSmoke[i].age >= placeSmoke[i].life) placeSmoke.splice(i, 1);
  }

  // ── Journal Line (raised train) ───────────────────────────────────────────
  // Runs on a viaduct just above the first row's skyline (tallest building + flag
  // stays below it). Pillars only go down in the gaps between buildings.
  let trainX = -40;
  function drawTrain(ctx, api, dt) {
    const { TOP_SKY, BUILD_ZONE } = api.layout;
    const width = api.grid.width;
    const railY = TOP_SKY - 1;
    const groundY = TOP_SKY + BUILD_ZONE;
    const spans = api.hitboxes.filter((b) => b.row === 0).map((b) => [b.x - 2, b.x + b.w + 2]);
    px(ctx, '#6b707c', 0, railY, width, 1);
    px(ctx, '#8a8f9c', 0, railY + 1, width, 1);
    for (let x = 14; x < width - 2; x += 44) {
      let pxX = x;
      while (spans.some(([a, b]) => pxX >= a && pxX <= b) && pxX < x + 20) pxX++;
      if (spans.some(([a, b]) => pxX >= a && pxX <= b)) continue;
      px(ctx, '#8a8f9c', pxX, railY + 2, 2, groundY - railY - 2);
    }
    const cars = data.journal.week;
    const len = 8 + cars * 8;
    if (motion) trainX += dt * 18;
    if (trainX > width + 4) trainX = -len - 4;
    const night = api.dayness < 0.45;
    const y = railY - 4;
    for (let i = 0; i <= cars; i++) {
      const cx = Math.round(trainX) + (cars - i) * 8; // engine leads on the right
      const head = i === 0;
      px(ctx, head ? '#5bd67a' : '#f2f2f2', cx, y, 7, 4);
      px(ctx, head ? '#2f6b3f' : '#5bd67a', cx, y + 2, 7, 1);
      for (let w = 1; w < 6; w += 2) px(ctx, night ? '#ffe07a' : '#5b8cff', cx + w, y + 1, 1, 1);
      if (head) px(ctx, '#ffe07a', cx + 6, y + 3, 1, 1);
    }
    api.addHitbox({
      entity: { id: 'fun-train', name: 'Journal Line', kind: 'fun', meta: { lens: 'fun-train' } },
      x: Math.round(trainX) - 1, y: y - 1, w: len + 2, h: 6,
    });
  }

  // ── Sparkles ──────────────────────────────────────────────────────────────
  function sparkle(box) {
    if (!motion || !box) return;
    for (let i = 0; i < 9; i++) {
      sparkles.push({
        x: box.x + Math.random() * box.w, y: box.y + Math.random() * Math.min(box.h, 6),
        vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 8, age: 0,
        life: 0.8 + Math.random() * 0.6, heart: Math.random() < 0.35,
        color: PAINT[Math.floor(Math.random() * PAINT.length)],
      });
    }
  }

  function drawSparkles(ctx, dt) {
    for (const s of sparkles) {
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 6 * dt;
      const fade = Math.max(0, 1 - s.age / s.life);
      ctx.globalAlpha = fade;
      if (s.heart) {
        px(ctx, '#ff6b8b', s.x, s.y, 1, 1); px(ctx, '#ff6b8b', s.x + 2, s.y, 1, 1);
        px(ctx, '#ff6b8b', s.x, s.y + 1, 3, 1); px(ctx, '#ff6b8b', s.x + 1, s.y + 2, 1, 1);
      } else {
        px(ctx, s.color, s.x, s.y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    for (let i = sparkles.length - 1; i >= 0; i--) if (sparkles[i].age >= sparkles[i].life) sparkles.splice(i, 1);
  }

  // ── Decorator entry point ─────────────────────────────────────────────────
  function draw(ctx, api) {
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, api.time - lastTime));
    lastTime = api.time;
    drawSeason(ctx, api);
    drawFillers(ctx, api);
    drawParkRows(ctx, api);
    drawPlaces(ctx, api, dt);
    drawFireTrucks(ctx, api, dt);
    const lib = boxFor(api, 'learning-hub');
    if (lib) drawLibrary(ctx, api, lib);
    const post = boxFor(api, 'capture-hub');
    if (post) drawPostOffice(ctx, api, post, dt);
    const studio = boxFor(api, 'canvas-hub');
    if (studio) drawStudio(ctx, api, studio);
    const meet = boxFor(api, 'meetings-hub');
    if (meet && (data.buses.length || data.taxis.length)) drawBusStop(ctx, api, meet, dt);
    drawPigeons(ctx, api, dt);
    drawTrain(ctx, api, dt);
    drawSparkles(ctx, dt);
  }

  /** Bird's-eye view decorator: only the parts that are not tied to street layout. */
  function drawIso(ctx, api) {
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, api.time - lastTime));
    lastTime = api.time;
    drawSparkles(ctx, dt);
  }

  function trainCars() { return data.journal.week; }

  // ── Detail text for the popover ───────────────────────────────────────────
  let toolNames = {};
  function setToolNames(map) { toolNames = map || {}; }
  function toolName(id) { return toolNames[id] || id; }

  /** Extra line for a tool building's popover, or ''. */
  function buildingNote(appId) {
    if (appId === 'learning-hub') {
      const l = data.library;
      return `📚 Library · ${l.done} finished (one floor each) · ${l.insights} lamp${l.insights === 1 ? '' : 's'} lit by key insights`
        + (l.reading ? ` · ${l.reading} reading on the steps` : '');
    }
    if (appId === 'capture-hub') {
      const n = data.post.inbox;
      return n ? `📮 Post office · ${n} letter${n === 1 ? '' : 's'} waiting in the inbox`
        : '📮 Post office · inbox zero — the cat is napping';
    }
    if (appId === 'canvas-hub') {
      const s = data.studio;
      return `🎨 Art studio · ${s.boards.length} easel${s.boards.length === 1 ? '' : 's'} · ${s.cards} cards · ${s.lines} lines of bunting`;
    }
    if (appId === 'meetings-hub') {
      const today = data.buses.filter((b) => b.today).length;
      return `🚏 Bus stop · ${data.buses.length} weekly line${data.buses.length === 1 ? '' : 's'}`
        + (today ? ` · ${today} running today` : '') + (data.taxis.length ? ` · ${data.taxis.length} taxi${data.taxis.length === 1 ? '' : 's'}` : '');
    }
    return PLACE_NOTES[LANDMARKS[appId]] || '';
  }

  /** One line for a tool tree's popover. */
  function treeNote(m, incident, activity) {
    if (incident === 'fire') return '🍂 Wilting · not used for 60+ days';
    const base = {
      using: '🌳 A big leafy tree · you use this tool',
      piloting: '🌲 A young pine · piloting',
      exploring: '🌱 A sapling · still exploring',
      retired: '🪵 A bare tree · retired',
    }[m.status] || '🌳 A tree in the Tool Park';
    return base + (activity > 0.6 && m.status !== 'retired' ? ' · in bloom, used recently' : '');
  }

  /** {title, status, note, link:[href,label]} for a fun entity. */
  function describe(e) {
    const m = e.meta || {};
    if (m.lens === 'fun-pigeon') {
      const rel = m.relType === 'blocks' ? 'blocks' : m.relType === 'depends-on' ? 'depends on' : 'relates to';
      return {
        title: '🕊 Carrier pigeon',
        status: `${toolName(m.from)} → ${toolName(m.to)}`,
        note: [m.fromLabel || '(item)', rel, m.toLabel || '(item)'].join(' ') + (m.note ? ` — “${m.note}”` : ''),
        link: ['graph-hub.html', 'Open Dependency Graph →'],
      };
    }
    if (m.lens === 'fun-koban') {
      return { title: '🚓 Police box', status: 'The officer waves at every car', note: '',
        link: ['project-hub.html', 'Open Project Hub →'] };
    }
    if (m.lens === 'fun-hospital') {
      const n = data.responders;
      return { title: '🏥 Hospital', status: `${n} risk${n === 1 ? '' : 's'} being treated`,
        note: 'The ambulances drive out from here.', link: ['risk-hub.html', 'Open Risk Register →'] };
    }
    if (m.lens === 'fun-festival') {
      return { title: '🎪 Festival', status: 'Celebrating projects finished in the last two weeks',
        note: data.festival.join('\n'), link: ['project-hub.html', 'Open Project Hub →'] };
    }
    if (m.lens === 'fun-train') {
      const n = data.journal.week;
      return {
        title: '🚃 Journal Line',
        status: n ? `${n} carriage${n === 1 ? '' : 's'} · one per day you wrote this week` : 'Just the engine today',
        note: n ? '' : 'Write in the Daily Log and a carriage joins the train.',
        link: ['journal-hub.html', 'Open Journal Hub →'],
      };
    }
    if (m.lens === 'fun-busstop') {
      const lines = data.buses.slice()
        .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))
        .map((b) => `${DAY_NAMES[b.weekday]} · ${b.title}`);
      const taxis = data.taxis.map((t) => `🚕 today${t.time ? ' ' + t.time : ''} · ${t.title}`);
      return {
        title: '🚏 Bus stop',
        status: data.buses.some((b) => b.today) ? 'Buses running today' : 'No bus today — zzz',
        note: lines.concat(taxis).join('\n') || 'No weekly meetings yet.',
        link: ['meetings-hub.html', 'Open Meeting Hub →'],
      };
    }
    if (m.lens === 'fun-ride') {
      return {
        title: (m.ride === 'taxi' ? '🚕 ' : '🚌 ') + m.title,
        status: [m.ride === 'taxi' ? 'One-off meeting today' : 'Weekly meeting · today', m.time || null,
          `${m.riders} rider${m.riders === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
        note: '',
        link: ['meetings-hub.html', 'Open Meeting Hub →'],
      };
    }
    if (m.lens === 'fun-easel') {
      return {
        title: '🎨 ' + e.name,
        status: `${m.cards} card${m.cards === 1 ? '' : 's'} · ${m.lines} line${m.lines === 1 ? '' : 's'}`,
        note: '',
        link: ['canvas-hub.html', 'Open Canvas Hub →'],
      };
    }
    return null;
  }

  function setMotion(on) { motion = Boolean(on); }

  return {
    refresh, tweak, treeify, civicBuildings, setSeasonSource, treeNote, wantedBuildings, draw, drawIso, trainCars, sparkle, buildingNote, describe, setMotion, setToolNames,
    _debug: () => ({ data, pigeons: pigeons.size, vehicles: vehicles.size, vans: vans.length, pendingVans }),
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MachiFun;
