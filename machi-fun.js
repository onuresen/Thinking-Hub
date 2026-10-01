// machi-fun.js — Thinking Hub's playful layer for Machi Hub (P139).
// NOT a stamped copy: this file is Thinking-Hub-specific and lives only here.
// It draws through the engine's setDecorator() hook and reads Hub data directly.
//
// Goal: fun and cute, not insight. Each tool building gets its own little life:
//   Learning Hub   → a library. One floor per finished item; a lamp per key insight.
//   Capture Hub    → a post office. Mail sacks pile up with the inbox; clearing it
//                    sends a delivery van off down the road.
//   Meeting Hub    → a bus stop. Weekly meetings are buses that run on their day;
//                    today's one-off meetings are taxis.
//   Spatial Canvas → an art studio. An easel per board, gallery lights per card,
//                    bunting for lines.
//   Dependency Graph links → pigeons carrying letters between tool buildings.
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
    const lib = boxFor(api, 'learning-hub');
    if (lib) drawLibrary(ctx, api, lib);
    const post = boxFor(api, 'capture-hub');
    if (post) drawPostOffice(ctx, api, post, dt);
    const studio = boxFor(api, 'canvas-hub');
    if (studio) drawStudio(ctx, api, studio);
    const meet = boxFor(api, 'meetings-hub');
    if (meet && (data.buses.length || data.taxis.length)) drawBusStop(ctx, api, meet, dt);
    drawPigeons(ctx, api, dt);
    drawSparkles(ctx, dt);
  }

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
    return '';
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
        link: ['canvas-hub.html', 'Open Spatial Canvas →'],
      };
    }
    return null;
  }

  function setMotion(on) { motion = Boolean(on); }

  return {
    refresh, tweak, wantedBuildings, draw, sparkle, buildingNote, describe, setMotion, setToolNames,
    _debug: () => ({ data, pigeons: pigeons.size, vehicles: vehicles.size, vans: vans.length, pendingVans }),
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MachiFun;
