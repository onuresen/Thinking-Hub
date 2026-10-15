// machi-iso.js — Machi Hub bird's-eye (isometric) view. Thinking-Hub-only, NOT a stamped copy.
// Same entities as the street view (machi-engine.js), drawn on a small island town:
// a road grid with gaps, a river with bridges, a park with a pond, a rail loop with a train.
// Public surface mirrors the parts of MachiHub.Town that town-hub.html uses, so the host
// can swap views without knowing which one is active.

const MachiIso = (() => {
  const HW = 8, HH = 4;      // half tile, screen px (a tile diamond is 16 × 8)
  const HEADROOM = 44;       // sky above the island: tall buildings, blimp, fireworks
  const PAD = 6;
  const ISLAND = 5;          // earth thickness under the island edge

  const SEASONS = {
    spring: { grass: '#6fa86a', park: '#82c27a', leaf: '#ff9fc4', leaf2: '#ffc4dc', daySky: '#a7d8e8', particle: '#ffc4dc' },
    summer: { grass: '#5f9a63', park: '#74b874', leaf: '#3f8a4f', leaf2: '#5bd67a', daySky: '#6fa8c9', particle: null },
    autumn: { grass: '#8a8f55', park: '#9aa25e', leaf: '#e0803a', leaf2: '#ffb84d', daySky: '#b9d2df', particle: '#e0803a' },
    winter: { grass: '#dfe6ee', park: '#eef3f8', leaf: '#f4f8fc', leaf2: '#c9d3de', daySky: '#c3d9e8', particle: '#ffffff' },
  };
  const CATEGORY = { assigned: '#5b8cff', personal: '#ff9f5b', shipped: '#5bd67a', queued: '#8a8f9c', default: '#7a86a3' };
  // Civic landmarks keyed by entity id; every other place by meta.look (set by machi-fun.js,
  // shared with the street view). hw = half width, h = wall height, extra = accessory.
  const LOOKS = {
    'civic-calibration': { color: '#b28ae8', roof: 'pyramid', roofColor: '#7a4aa8', columns: true },
    'civic-vault-gap': { signpost: true },
  };
  const PLACES = {
    depot: { color: '#7a8699', h: 12, extra: 'doors' },
    clocktower: { color: '#e8dcc0', hw: 4, h: 26, roof: 'pyramid', roofColor: '#3f6b5a', extra: 'clock' },
    terminal: { color: '#9ec9e8', h: 10, extra: 'canopy', sign: 'busstop' },
    post: { color: '#c8553d', sign: 'envelope' },
    cafe: { color: '#b07a4a', h: 10, extra: 'awning' },
    dovecote: { color: '#a89f91', hw: 4, h: 16, roof: 'pyramid', roofColor: '#7a5a3a', extra: 'pigeons' },
    apartments: { color: '#f2c4a8', hmul: 1.2, extra: 'balconies' },
    embassy: { color: '#efe9df', columns: true, extra: 'flags' },
    greenhouse: { color: '#bfe6d0', h: 8, roof: 'pyramid', roofColor: '#e2f4ea', extra: 'plants', noWindows: true },
    cityhall: { color: '#e8dcc0', columns: true, extra: 'dome' },
    library: { color: '#d8c9a8', roof: 'pyramid', roofColor: '#8a6f3f' },
    studio: { color: '#f2ece0', windows: 'rainbow' },
    shrine: { color: '#8f5a3a', hw: 4, h: 7, roof: 'pyramid', roofColor: '#3a3f4a', extra: 'torii', noWindows: true },
    firestation: { color: '#b8402e', h: 11, extra: 'firedoor' },
    home: { color: '#f2e3c6', hw: 5, h: 7, roof: 'pyramid', roofColor: '#c8553d', extra: 'chimney' },
    school: { color: '#f2d58a', h: 10, extra: 'belltower' },
    hospital: { color: '#f2f4f8', extra: 'cross' },
    koban: { color: '#e8ecf5', hw: 3, h: 6, extra: 'redlamp', noWindows: true },
    ferris: { custom: true, hw: 7, h: 20 },
    stadium: { custom: true, hw: 7, h: 8 },
    market: { custom: true, hw: 6, h: 9 },
    festival: { custom: true, hw: 7, h: 12 },
    tree: { custom: true },
  };
  const RAINBOW = ['#ff6b6b', '#ffd24d', '#5bd67a', '#5b8cff', '#b28ae8', '#ff9fc4'];

  function clamp01(n) { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  }
  function hash01(a, b) {
    let h = Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x85ebca6b, 2246822519);
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return ((h >>> 0) % 1000) / 1000;
  }
  function strHash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  function rgb(hex) {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return [138, 143, 156];
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  }
  function shade(hex, f) {
    const c = rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + f)))));
    return `rgb(${c.join(',')})`;
  }
  function toHex(css) {
    if (/^#[0-9a-f]{6}$/i.test(css)) return css;
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(css);
    return m ? '#' + m.slice(1).map((v) => Number(v).toString(16).padStart(2, '0')).join('') : '#8a8f9c';
  }

  // ── Map ────────────────────────────────────────────────────────────────────
  // Roads every 4 tiles inside a rail ring. Some inner road segments are dropped
  // so blocks merge; one block row becomes a river; one block becomes a park.
  function makeMap(kx, ky) {
    const W = 4 * kx + 7, H = 4 * ky + 7;
    const rand = seeded(`machi-iso-${kx}x${ky}`);
    const t = Array.from({ length: H }, () => Array(W).fill('grass'));
    const roadLine = (v, max) => v >= 3 && v <= max - 4 && (v - 3) % 4 === 0;
    for (let y = 3; y <= H - 4; y++) {
      for (let x = 3; x <= W - 4; x++) {
        if (roadLine(x, W) || roadLine(y, H)) t[y][x] = 'road';
      }
    }
    // drop some inner segments (never the outer road ring, so the town stays connected)
    for (let rx = 7; rx <= W - 8; rx += 4) {
      for (let ry = 3; ry < H - 4; ry += 4) {
        if (rand() < 0.3) for (let y = ry + 1; y < ry + 4; y++) t[y][rx] = 'grass';
      }
    }
    for (let ry = 7; ry <= H - 8; ry += 4) {
      for (let rx = 3; rx < W - 4; rx += 4) {
        if (rand() < 0.3) for (let x = rx + 1; x < rx + 4; x++) t[ry][x] = 'grass';
      }
    }
    // river through the middle block row, full width
    const riverBlock = Math.floor(ky / 2);
    const riverY = 3 + riverBlock * 4 + 1;
    for (let y = riverY; y < riverY + 2; y++) {
      for (let x = 0; x < W; x++) t[y][x] = t[y][x] === 'road' ? 'bridge' : 'water';
    }
    // rail ring
    const ring = [];
    for (let x = 1; x <= W - 2; x++) ring.push([x, 1]);
    for (let y = 2; y <= H - 2; y++) ring.push([W - 2, y]);
    for (let x = W - 3; x >= 1; x--) ring.push([x, H - 2]);
    for (let y = H - 3; y >= 2; y--) ring.push([1, y]);
    for (const [x, y] of ring) t[y][x] = t[y][x] === 'water' ? 'railbridge' : 'rail';
    // park: the block nearest the middle of the top half
    const blocks = [];
    for (let bx = 0; bx < kx; bx++) {
      for (let by = 0; by < ky; by++) if (by !== riverBlock) blocks.push([bx, by]);
    }
    const cx = kx / 2 - 0.5, cy = Math.max(0, riverBlock - 1);
    blocks.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    let park = null;
    if (blocks.length > 1) {
      const [bx, by] = blocks[0];
      park = { x: 3 + bx * 4 + 1, y: 3 + by * 4 + 1 };
      for (let y = park.y; y < park.y + 3; y++) for (let x = park.x; x < park.x + 3; x++) t[y][x] = 'park';
      t[park.y + 1][park.x + 1] = 'pond';
    }
    // lots: buildable grass next to a road
    const isRoad = (x, y) => t[y] && (t[y][x] === 'road' || t[y][x] === 'bridge');
    const lots = [];
    for (let y = 2; y <= H - 3; y++) {
      for (let x = 2; x <= W - 3; x++) {
        if (t[y][x] !== 'grass') continue;
        if (isRoad(x + 1, y) || isRoad(x - 1, y) || isRoad(x, y + 1) || isRoad(x, y - 1)) {
          lots.push({ x, y, garden: rand() < 0.2 });
        }
      }
    }
    return { W, H, t, ring, lots, riverY, park };
  }

  function buildMap(nBuildings) {
    let kx = 2, ky = 2, map = makeMap(kx, ky);
    const need = (m) => m.lots.filter((l) => !l.garden).length >= nBuildings + 2;
    for (let i = 0; i < 12 && !need(map); i++) {
      if (kx <= ky) kx++; else ky++;
      map = makeMap(kx, ky);
    }
    return map;
  }

  class Town {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buffer = document.createElement('canvas');
      this.bctx = this.buffer.getContext('2d');
      this.scale = opts.scale || 3;
      this.fitWidth = opts.fitWidth || 900;
      this.entities = [];
      this.hitboxes = [];
      this._actorBoxes = [];
      this._actors = new Map();
      this._time = 0;
      this._raf = null;
      this._lastTs = 0;
      this._celebration = 0;
      this._weather = 0;
      this._fireworks = [];
      this._nextFireworkIn = 5;
      this._smoke = [];
      this._rain = [];
      this._particles = [];
      this._timeMode = 'auto';
      this._manualTime = 0.5;
      this._seasonMode = 'auto';
      this._manualSeason = 'spring';
      this._hoveredId = null;
      this._decorator = null;
      this._train = { s: 0, cars: 1 };
      this._boats = [{ x: 2, speed: 0.5 }, { x: 9, speed: -0.35 }];
    }

    // ── host API (same names as MachiHub.Town) ──────────────────────────────
    setEntities(list) { this.entities = list.slice(); this._actors.clear(); this._smoke = []; return this; }
    setCelebration(v) { this._celebration = clamp01(v); return this; }
    setWeather(v) { this._weather = clamp01(v); return this; }
    setDecorator(fn) { this._decorator = typeof fn === 'function' ? fn : null; return this; }
    setTrainCars(n) { this._train.cars = Math.max(0, Math.min(7, n | 0)); return this; }
    setFitWidth(px) { this.fitWidth = px; return this; }
    setTimeOfDay(v) {
      if (v === 'auto') this._timeMode = 'auto';
      else { this._timeMode = 'manual'; this._manualTime = clamp01(v); }
      if (!this._raf && this.map) this.#draw();
      return this;
    }
    getTimeOfDay() {
      if (this._timeMode !== 'auto') return this._manualTime;
      const d = new Date();
      return (d.getHours() * 60 + d.getMinutes()) / 1440;
    }
    setSeason(v) {
      if (v === 'auto') this._seasonMode = 'auto';
      else if (SEASONS[v]) { this._seasonMode = 'manual'; this._manualSeason = v; }
      this._groundKey = null;
      if (!this._raf && this.map) this.#draw();
      return this;
    }
    getSeason() {
      if (this._seasonMode !== 'auto') return this._manualSeason;
      const m = new Date().getMonth();
      return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
    }
    celebrate(count = 12) {
      if (!this.map) return this;
      for (let i = 0; i < count; i++) this.#spawnFirework();
      return this;
    }
    downloadPNG(filename = 'machi-town.png') {
      this.canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      });
      return this;
    }
    render() { this.#layout(); this.#draw(); return this; }
    start() {
      if (this._raf) return this;
      const step = (ts) => {
        if (!this._lastTs) this._lastTs = ts;
        const dt = Math.max(0, Math.min(0.1, (ts - this._lastTs) / 1000));
        this._lastTs = ts;
        this.#tick(dt);
        this.#draw();
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
      return this;
    }
    stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; this._lastTs = 0; return this; }

    boxAt(canvasX, canvasY) {
      const bx = canvasX / this.scale, by = canvasY / this.scale;
      const inBox = (b) => bx >= b.x && bx < b.x + b.w && by >= b.y && by < b.y + b.h;
      for (let i = this._actorBoxes.length - 1; i >= 0; i--) if (inBox(this._actorBoxes[i])) return this._actorBoxes[i];
      // front-most building wins where boxes overlap
      let best = null;
      for (const b of this.hitboxes) if (inBox(b) && (!best || b.depth > best.depth)) best = b;
      return best;
    }

    enableInteraction(handlers = {}) {
      const toLocal = (ev) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
        return this.boxAt((ev.clientX - rect.left) * sx, (ev.clientY - rect.top) * sy);
      };
      this.canvas.addEventListener('click', (ev) => {
        const box = toLocal(ev);
        if (box && handlers.onClick) handlers.onClick(box.entity, box);
      });
      this.canvas.addEventListener('mousemove', (ev) => {
        const box = toLocal(ev);
        this.canvas.style.cursor = box ? 'pointer' : 'default';
        this._hoveredId = box ? box.entity.id : null;
        if (!this._raf) this.#draw();
      });
      this.canvas.addEventListener('mouseleave', () => {
        this._hoveredId = null;
        if (!this._raf) this.#draw();
      });
      return this;
    }

    // ── geometry ─────────────────────────────────────────────────────────────
    // Screen point of the tile-space coordinate (x, y). Tile centres sit at +0.5.
    #P(x, y) { return [this._ox + (x - y) * HW, this._oy + (x + y) * HH]; }

    #layout() {
      const buildings = this.entities.filter((e) => e.kind === 'building');
      const map = buildMap(buildings.length);
      this.map = map;
      const { W, H } = map;
      const width = (W + H) * HW + PAD * 2;
      const height = HEADROOM + (W + H) * HH + ISLAND + PAD;
      this._ox = PAD + H * HW;
      this._oy = HEADROOM;
      this.width = width; this.height = height;
      this.buffer.width = width; this.buffer.height = height;
      this.scale = Math.max(2, Math.min(5, Math.floor(this.fitWidth / width)));
      this.canvas.width = width * this.scale;
      this.canvas.height = height * this.scale;
      this.canvas.style.imageRendering = 'pixelated';
      this._groundKey = null;

      // districts cluster around anchors: Hub pages downtown, tools by the park, civic by the river
      const anchors = {
        'Hub Pages': [W / 2, Math.max(3, map.riverY / 2)],
        'Tool Park': map.park ? [map.park.x + 1, map.park.y + 1] : [W * 0.3, H * 0.3],
        Civic: [W * 0.7, map.riverY + 3],
      };
      const free = map.lots.filter((l) => !l.garden);
      const spare = map.lots.filter((l) => l.garden);
      this.hitboxes = [];
      for (const e of buildings) {
        if (!free.length && spare.length) free.push(spare.shift());
        if (!free.length) break;
        const [ax, ay] = anchors[e.district] || [W / 2, H / 2];
        let bi = 0, bd = Infinity;
        free.forEach((l, i) => { const d = Math.hypot(l.x - ax, l.y - ay); if (d < bd) { bd = d; bi = i; } });
        const lot = free.splice(bi, 1)[0];
        this.hitboxes.push(this.#buildingBox(e, lot.x, lot.y));
      }
      this._gardens = spare.concat(free).map((l) => ({ ...l, kind: hash01(l.x * 7, l.y * 13) < 0.65 ? 'tree' : 'flowers' }));

      // road graph + actors
      const t = map.t;
      const isRoad = (x, y) => t[y] && (t[y][x] === 'road' || t[y][x] === 'bridge');
      this._roads = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isRoad(x, y)) this._roads.push([x, y]);
      this._isRoad = isRoad;
      let vi = 0;
      for (const e of this.entities) {
        if (e.kind !== 'vehicle' && e.kind !== 'responder' && e.kind !== 'walker' && e.kind !== 'sky') continue;
        const rand = seeded('iso-' + e.id);
        if (e.kind === 'sky') {
          this._actors.set(e.id, { x: rand() * width, y: 8 + rand() * 8, dir: rand() < 0.5 ? 1 : -1 });
          continue;
        }
        const start = this._roads[Math.floor(rand() * this._roads.length) || 0] || [3, 3];
        const walker = e.kind === 'walker';
        this._actors.set(e.id, {
          fx: start[0], fy: start[1], tx: start[0], ty: start[1], t: 1,
          speed: walker ? 0.35 + rand() * 0.25 : 0.7 + e.activity * 1.4,
          side: walker ? (rand() < 0.5 ? 0.36 : -0.36) : 0.18,
          pause: walker ? rand() * 3 : 0,
          seed: vi++,
        });
      }
      this._train.s = 0;
    }

    #buildingBox(e, x, y) {
      const look = LOOKS[e.id] || PLACES[e.meta && e.meta.look] || {};
      const tier = e.tier || 2;
      const isTree = e.meta && e.meta.look === 'tree';
      const hw = look.signpost ? 3 : isTree ? 2 + tier : look.hw || Math.min(7, 3 + tier);
      const h = look.signpost ? 9 : isTree ? 6 + tier * 4 : look.h || Math.round((tier === 1 ? 7 : 4 + tier * 6) * (look.hmul || 1));
      const roof = look.signpost || look.custom ? 'none' : (look.roof || (tier === 1 ? 'pyramid' : 'flat'));
      const roofH = roof === 'pyramid' ? hw : 0;
      const [cx, cy] = this.#P(x + 0.5, y + 0.5);
      // x/y/w/h = the click rect in buffer space (what the host anchors its popover to)
      return {
        entity: e, tx: x, ty: y, cx, cy, hw, bodyH: h, roof, roofH, look, depth: x + y,
        x: cx - hw, y: cy - h - roofH - 3, w: hw * 2, h: h + roofH + hw / 2 + 3,
      };
    }

    // ── simulation ───────────────────────────────────────────────────────────
    #nextTile(a) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const opts = dirs.map(([dx, dy]) => [a.tx + dx, a.ty + dy])
        .filter(([x, y]) => this._isRoad(x, y) && !(x === a.fx && y === a.fy));
      const pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : [a.fx, a.fy];
      a.fx = a.tx; a.fy = a.ty; a.tx = pick[0]; a.ty = pick[1]; a.t = 0;
    }

    #spawnFirework() {
      this._fireworks.push({
        x: PAD + Math.random() * (this.width - PAD * 2), y: 6 + Math.random() * (HEADROOM - 10),
        age: 0, life: 0.9 + Math.random() * 0.4, hue: Math.floor(Math.random() * 360),
      });
    }

    #tick(dt) {
      this._time += dt;
      for (const e of this.entities) {
        const a = this._actors.get(e.id);
        if (!a) continue;
        if (e.kind === 'sky') {
          a.x += a.dir * 2.5 * dt;
          if (a.x > this.width + 10) a.x = -10;
          if (a.x < -10) a.x = this.width + 10;
          continue;
        }
        if (e.incident === 'crash' || e.incident === 'stalled') continue; // parked where it broke down
        if (a.pause > 0) { a.pause -= dt; continue; }
        a.t += a.speed * dt;
        if (a.t >= 1) {
          this.#nextTile(a);
          if (e.kind === 'walker' && Math.random() < 0.15) a.pause = 1 + Math.random() * 3;
        }
      }
      const ring = this.map.ring.length;
      this._train.s = (this._train.s + dt * 2.2) % ring;
      for (const b of this._boats) {
        b.x += b.speed * dt;
        if (b.x > this.map.W + 1) b.x = -1;
        if (b.x < -1) b.x = this.map.W + 1;
      }
      // smoke from fires
      for (const hb of this.hitboxes) {
        if (hb.entity.incident === 'fire' && !hb.look.custom && Math.random() < dt * 3) {
          this._smoke.push({ x: hb.cx - 2 + Math.random() * 4, y: hb.cy - hb.bodyH - 2, age: 0, life: 1.6 });
        }
      }
      for (const s of this._smoke) { s.age += dt; s.y -= 5 * dt; s.x += Math.sin(s.age * 3) * dt * 2; }
      this._smoke = this._smoke.filter((s) => s.age < s.life);
      // fireworks
      this._nextFireworkIn -= dt;
      if (this._celebration > 0 && this._nextFireworkIn <= 0) {
        this.#spawnFirework();
        this._nextFireworkIn = 7 - this._celebration * 5 + Math.random() * 4;
      }
      for (const f of this._fireworks) f.age += dt;
      this._fireworks = this._fireworks.filter((f) => f.age < f.life);
      // rain
      if (this._weather > 0.05) {
        while (this._rain.length < Math.floor(this._weather * 60)) {
          this._rain.push({ x: Math.random() * this.width, y: Math.random() * this.height });
        }
        for (const d of this._rain) { d.y += 70 * dt; d.x -= 12 * dt; if (d.y > this.height) { d.y = -2; d.x = Math.random() * this.width; } }
      } else this._rain = [];
      // season particles
      const season = SEASONS[this.getSeason()];
      const want = season.particle ? 18 : 10;
      while (this._particles.length < want) this._particles.push({ x: Math.random() * this.width, y: Math.random() * this.height, sp: 4 + Math.random() * 5, ph: Math.random() * 6 });
      if (this._particles.length > want) this._particles.length = want;
      for (const p of this._particles) {
        p.y += p.sp * dt; p.x += Math.sin(this._time * 1.4 + p.ph) * dt * 5;
        if (p.y > this.height) { p.y = -2; p.x = Math.random() * this.width; }
      }
    }

    // ── drawing ──────────────────────────────────────────────────────────────
    #diamond(ctx, x, y, color, w = 1, h = 1) {
      const [ax, ay] = this.#P(x, y), [bx, by] = this.#P(x + w, y), [cx, cy] = this.#P(x + w, y + h), [dx, dy] = this.#P(x, y + h);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
    }

    #poly(ctx, color, pts) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fill();
    }

    // A box standing on its footprint diamond (centre cx,cy). Returns the top-face y.
    #box(ctx, cx, cy, hw, h, color) {
      const hh = hw / 2;
      this.#poly(ctx, shade(toHex(color), -0.18), [[cx - hw, cy], [cx, cy + hh], [cx, cy + hh - h], [cx - hw, cy - h]]);
      this.#poly(ctx, shade(toHex(color), -0.38), [[cx + hw, cy], [cx, cy + hh], [cx, cy + hh - h], [cx + hw, cy - h]]);
      this.#poly(ctx, color, [[cx, cy - hh - h], [cx + hw, cy - h], [cx, cy + hh - h], [cx - hw, cy - h]]);
      return cy - h;
    }

    #ground(season) {
      const key = season + this.width + 'x' + this.height;
      if (this._groundKey === key) return this._groundCanvas;
      const c = this._groundCanvas || document.createElement('canvas');
      c.width = this.width; c.height = this.height;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      const th = SEASONS[season];
      const { W, H, t } = this.map;
      // island sides
      const [lx, ly] = this.#P(0, H), [bx, by] = this.#P(W, H), [rx, ry] = this.#P(W, 0);
      this.#poly(g, '#7a5a3a', [[lx, ly], [bx, by], [bx, by + ISLAND], [lx, ly + ISLAND]]);
      this.#poly(g, '#5c432a', [[bx, by], [rx, ry], [rx, ry + ISLAND], [bx, by + ISLAND]]);
      const colors = {
        grass: th.grass, park: th.park, water: '#4a8fc9', pond: '#5aa0d8', road: '#4a4d56',
        bridge: '#9a8f80', rail: '#7a6a5a', railbridge: '#8a7a6a',
      };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const k = t[y][x];
          let col = colors[k] || th.grass;
          if (k === 'grass' && (x + y) % 2) col = mix(toHex(col), '#000000', 0.04);
          this.#diamond(g, x, y, col);
          const [sx, sy] = this.#P(x + 0.5, y + 0.5);
          if (k === 'road' || k === 'bridge') {
            const horiz = this._isRoad(x - 1, y) || this._isRoad(x + 1, y);
            const vert = this._isRoad(x, y - 1) || this._isRoad(x, y + 1);
            g.fillStyle = '#c9c3b5';
            if (horiz && !vert) { g.fillRect(sx - 3, sy - 2, 2, 1); g.fillRect(sx + 1, sy, 2, 1); }
            else if (vert && !horiz) { g.fillRect(sx + 1, sy - 2, 2, 1); g.fillRect(sx - 3, sy, 2, 1); }
            if (k === 'bridge') { g.fillStyle = '#5c432a'; g.fillRect(sx - 7, sy, 1, 1); g.fillRect(sx + 6, sy, 1, 1); }
          } else if (k === 'rail' || k === 'railbridge') {
            g.fillStyle = '#c9c3b5';
            g.fillRect(sx - 2, sy - 1, 1, 1); g.fillRect(sx + 1, sy, 1, 1); g.fillRect(sx - 1, sy + 1, 1, 1);
          } else if (k === 'park' && hash01(x, y) < 0.5) {
            g.fillStyle = mix(toHex(th.park), '#ffffff', 0.25);
            g.fillRect(sx - 1, sy, 1, 1);
          }
        }
      }
      this._groundCanvas = c;
      this._groundKey = key;
      return c;
    }

    // A tool tree: size from tier, kind from status, blossoms when used recently,
    // wilts (no fire) after 60+ days unused, fairy lights on winter nights.
    #toolTree(ctx, b, night, lights) {
      const e = b.entity, season = this._season, th = SEASONS[season];
      const withered = e.incident === 'fire';
      const leaf = withered ? '#8a6f3f' : th.leaf, leaf2 = withered ? '#b29245' : th.leaf2;
      const { cx, cy } = b;
      const kind = e.meta.tree;
      const size = b.hw; // 3..7
      ctx.fillStyle = 'rgba(20,16,24,0.25)';
      ctx.beginPath(); ctx.ellipse(cx, cy, size, size / 2, 0, 0, Math.PI * 2); ctx.fill();
      if (kind === 'sapling') {
        ctx.fillStyle = '#8a6f3f'; ctx.fillRect(cx + 2, cy - 6, 1, 6);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx, cy - 4, 1, 4);
        ctx.fillStyle = leaf; ctx.fillRect(cx - 1, cy - 5, 1, 1);
        ctx.fillStyle = leaf2; ctx.fillRect(cx + 1, cy - 6, 1, 1);
        return;
      }
      const trunk = Math.max(3, Math.round(b.bodyH * 0.35));
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx - (size > 4 ? 1 : 0), cy - trunk, size > 4 ? 2 : 1, trunk);
      const top = cy - b.bodyH;
      if (kind === 'bare') {
        for (let i = 0; i < 4; i++) {
          const dir = i % 2 ? 1 : -1, by = cy - trunk - i * 2;
          for (let k = 1; k <= 2 + (i % 2); k++) ctx.fillRect(cx + dir * k, by - k, 1, 1);
        }
        return;
      }
      if (kind === 'pine') {
        this.#poly(ctx, withered ? leaf : '#2f6b3f', [[cx, top], [cx - size, cy - trunk + 1], [cx + size, cy - trunk + 1]]);
        this.#poly(ctx, withered ? leaf2 : '#3f8a4f', [[cx, top], [cx - size / 2, cy - trunk - (b.bodyH - trunk) / 2], [cx, cy - trunk]]);
        if (season === 'winter' && !withered) this.#poly(ctx, '#ffffff', [[cx, top], [cx - 2, top + 4], [cx + 2, top + 4]]);
      } else {
        const r = size, my = cy - trunk - r + 2;
        ctx.fillStyle = leaf; ctx.beginPath(); ctx.arc(cx, my, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = leaf2; ctx.beginPath(); ctx.arc(cx - r / 3, my - r / 3, r / 2, 0, Math.PI * 2); ctx.fill();
        if (!withered && e.activity > 0.6) {
          const dot = season === 'summer' ? '#e34d4d' : season === 'autumn' ? '#ffd24d' : season === 'spring' ? '#ffffff' : null;
          if (dot) for (let i = 0; i < 4; i++) { ctx.fillStyle = dot; ctx.fillRect(cx - r + 1 + Math.floor(hash01(i, strHash(e.id)) * (r * 2 - 1)), my - r + 2 + Math.floor(hash01(strHash(e.id), i) * r), 1, 1); }
        }
      }
      if (withered) {
        const t = (this._time * 0.4 + (e.id.length % 5) / 5) % 1;
        ctx.fillStyle = leaf2; ctx.fillRect(Math.round(cx + Math.sin(t * 9) * 3), Math.round(top + t * (cy - top)), 1, 1);
      } else if (season === 'winter' && night) {
        for (let i = 0; i < 5; i++) {
          if (Math.floor(this._time * 2 + i) % 3) lights.push([cx - size + 1 + ((i * 3) % (size * 2 - 1)), top + 2 + ((i * 5) % Math.max(2, b.bodyH - trunk - 2)), 1, 1, RAINBOW[(i + Math.floor(this._time)) % RAINBOW.length]]);
        }
      }
    }

    // Fill a w×h patch on one wall. side -1 = left wall, 1 = right wall; u runs from the
    // outer corner toward the front corner, v is height above the ground.
    #face(ctx, b, side, u, v, w, h, color) {
      ctx.fillStyle = color;
      for (let i = 0; i < w; i++) {
        const k = u + i;
        if (k >= b.hw) break;
        const x = side < 0 ? b.cx - b.hw + k : b.cx + b.hw - k - 1;
        ctx.fillRect(x, Math.round(b.cy + k / 2 - v - h), 1, h);
      }
    }

    #customPlace(ctx, b, night, lights) {
      const look = b.entity.meta.look, { cx, cy } = b, t = this._time;
      if (look === 'tree') return this.#toolTree(ctx, b, night, lights);
      if (look === 'ferris') {
        const r = 8, wy = cy - 11;
        ctx.fillStyle = '#8a8f9c'; ctx.fillRect(cx - 4, wy, 1, 11); ctx.fillRect(cx + 4, wy, 1, 11);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, px = Math.round(cx + Math.cos(a) * r * 0.8), py = Math.round(wy + Math.sin(a) * r);
          if (night) lights.push([px, py, 1, 1, RAINBOW[(i + Math.floor(t * 3)) % RAINBOW.length]]);
          else { ctx.fillStyle = '#ff9fc4'; ctx.fillRect(px, py, 1, 1); }
        }
        for (let i = 0; i < 6; i++) {
          const a = t * 0.5 + (i / 6) * Math.PI * 2;
          ctx.fillStyle = RAINBOW[i % RAINBOW.length];
          ctx.fillRect(Math.round(cx + Math.cos(a) * r * 0.8) - 1, Math.round(wy + Math.sin(a) * r), 3, 2);
        }
        ctx.fillStyle = '#ffd24d'; ctx.fillRect(cx, wy, 1, 1);
        return;
      }
      if (look === 'stadium') {
        this.#box(ctx, cx, cy, b.hw, 4, '#8a8f9c');
        const hw = b.hw - 1;
        this.#poly(ctx, '#5f9a63', [[cx, cy - 4 - hw / 2], [cx + hw, cy - 4], [cx, cy - 4 + hw / 2], [cx - hw, cy - 4]]);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 2, cy - 4, 5, 1);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2, jump = Math.floor(t * 4 + i) % 5 === 0 ? 1 : 0;
          ctx.fillStyle = RAINBOW[i % RAINBOW.length];
          ctx.fillRect(Math.round(cx + Math.cos(a) * (b.hw - 0.5)), Math.round(cy - 4 + Math.sin(a) * (b.hw / 2) - jump), 1, 1);
        }
        for (const lx of [cx - b.hw, cx + b.hw - 1]) {
          ctx.fillStyle = '#6b707c'; ctx.fillRect(lx, cy - 13, 1, 10);
          if (night) { lights.push([lx - 1, cy - 14, 3, 1, '#ffffff']); lights.push([lx - 3, cy - 13, 7, 3, 'rgba(255,255,255,0.15)']); }
          else { ctx.fillStyle = '#c9cfdb'; ctx.fillRect(lx - 1, cy - 14, 3, 1); }
        }
        return;
      }
      if (look === 'market') {
        [[-3, -1], [2, 0], [-1, 2]].forEach(([dx, dy], i) => {
          const sx = cx + dx, sy = cy + dy;
          ctx.fillStyle = '#8a6f3f'; ctx.fillRect(sx - 2, sy - 5, 1, 5); ctx.fillRect(sx + 2, sy - 5, 1, 5);
          ctx.fillStyle = '#d8c9a8'; ctx.fillRect(sx - 2, sy - 2, 5, 1);
          ctx.fillStyle = RAINBOW[(i * 2) % RAINBOW.length]; ctx.fillRect(sx - 3, sy - 7, 7, 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 2, sy - 7, 1, 2); ctx.fillRect(sx, sy - 7, 1, 2); ctx.fillRect(sx + 2, sy - 7, 1, 2);
        });
        return;
      }
      if (look === 'festival') {
        [[-4, -1], [3, -1], [0, 2]].forEach(([dx, dy], i) => {
          const sx = cx + dx, sy = cy + dy, c = RAINBOW[(i * 2 + 1) % RAINBOW.length];
          this.#poly(ctx, c, [[sx, sy - 8], [sx - 3, sy], [sx, sy + 1]]);
          this.#poly(ctx, shade(toHex(c), -0.3), [[sx, sy - 8], [sx, sy + 1], [sx + 3, sy]]);
          ctx.fillStyle = '#2a2f3a'; ctx.fillRect(sx, sy - 2, 1, 2);
        });
        for (let i = 0; i < 9; i++) {
          const lx = cx - 7 + i * 1.75, ly = cy - 11 + Math.abs(i - 4) * 0.5;
          const col = i % 2 ? '#ffffff' : '#e34d4d';
          if (night) lights.push([Math.round(lx), Math.round(ly), 1, 1, col]); else { ctx.fillStyle = col; ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1); }
        }
      }
    }

    // Small extras on top of a place's box.
    #extras(ctx, b, top, night, lights) {
      const x = b.look.extra, { cx, cy, hw } = b, t = this._time;
      if (x === 'doors') {
        this.#face(ctx, b, -1, 1, 0, 4, 5, '#2a2f3a');
        this.#face(ctx, b, -1, 1, 1, 4, 1, '#4a5162'); this.#face(ctx, b, -1, 1, 3, 4, 1, '#4a5162');
      } else if (x === 'clock') {
        this.#face(ctx, b, -1, 0, b.bodyH - 6, 3, 3, '#ffffff');
        const now = new Date();
        ctx.fillStyle = '#2a2f3a'; ctx.fillRect(cx - hw + 1, Math.round(cy + 0.5 - (b.bodyH - 5) - (now.getMinutes() < 30 ? 1 : 0)), 1, 1);
      } else if (x === 'canopy') {
        this.#box(ctx, cx, top + 2, hw + 1, 1, '#5b8cff');
      } else if (x === 'awning') {
        for (let k = 0; k < hw; k++) this.#face(ctx, b, -1, k, 4, 1, 2, k % 2 ? '#ffffff' : '#e34d4d');
      } else if (x === 'pigeons') {
        for (let i = 0; i < 2; i++) { ctx.fillStyle = '#9aa0aa'; ctx.fillRect(cx - 2 + i * 3, top - b.roofH - 1 - (Math.floor(t * 2 + i) % 2), 2, 1); }
      } else if (x === 'balconies') {
        for (let v = 4; v < b.bodyH - 2; v += 4) { this.#face(ctx, b, -1, 0, v, hw, 1, '#ffffff'); this.#face(ctx, b, 1, 0, v, hw, 1, '#ffffff'); }
      } else if (x === 'flags') {
        [-3, 0, 3].forEach((dx, i) => {
          ctx.fillStyle = '#c9cfdb'; ctx.fillRect(cx + dx, top - 5, 1, 5);
          ctx.fillStyle = RAINBOW[(i * 2 + 1) % RAINBOW.length]; ctx.fillRect(cx + dx + 1, top - 5 + (Math.floor(t * 2 + i) % 2), 2, 2);
        });
      } else if (x === 'plants') {
        for (let k = 1; k < hw; k += 2) { this.#face(ctx, b, -1, k, 1, 1, 2 + (k % 3), '#3f8a4f'); this.#face(ctx, b, 1, k, 1, 1, 1 + (k % 2), '#5bd67a'); }
        if (night) lights.push([cx - hw + 1, top + 1, hw * 2 - 2, 2, 'rgba(255,224,122,0.3)']);
      } else if (x === 'dome') {
        const r = Math.max(2, Math.round(hw * 0.6));
        ctx.fillStyle = '#ffd24d'; ctx.beginPath(); ctx.arc(cx, top, r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c9cfdb'; ctx.fillRect(cx, top - r - 5, 1, 5);
        ctx.fillStyle = '#5bd67a'; ctx.fillRect(cx + 1, top - r - 5 + (Math.floor(t * 2) % 2), 3, 2);
      } else if (x === 'torii') {
        const fx = cx, fy = cy + hw / 2 + 2;
        ctx.fillStyle = '#e34d4d';
        ctx.fillRect(fx - 4, fy - 8, 1, 8); ctx.fillRect(fx + 3, fy - 8, 1, 8);
        ctx.fillRect(fx - 5, fy - 9, 10, 1); ctx.fillRect(fx - 4, fy - 7, 8, 1);
        if (night) lights.push([cx - 1, cy - 3, 2, 2, '#ffd98a']);
      } else if (x === 'firedoor') {
        this.#face(ctx, b, -1, 1, 0, 5, 6, '#2a2f3a');
        if (!this._burning) this.#face(ctx, b, -1, 2, 1, 3, 3, '#e34d4d');
        const alarm = this._burning && Math.floor(t * 4) % 2;
        lights.push([cx, top - 2, 1, 2, alarm ? '#ff5b5b' : '#8f3311']);
      } else if (x === 'chimney') {
        ctx.fillStyle = '#8f3311'; ctx.fillRect(cx + 2, top - b.roofH + 1, 2, 4);
        if (Math.floor(t) % 3 === 0) { ctx.fillStyle = 'rgba(200,204,216,0.6)'; ctx.fillRect(cx + 2, top - b.roofH - 2, 1, 1); }
        ctx.fillStyle = '#ffd24d'; ctx.fillRect(cx - 2, cy + 1, 1, 1);
      } else if (x === 'belltower') {
        this.#box(ctx, cx, top + 1, 2, 5, '#f2d58a');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, top - 3, 1, 1);
        ctx.fillStyle = '#c9cfdb'; ctx.fillRect(cx + 3, top - 8, 1, 7);
        ctx.fillStyle = '#5b8cff'; ctx.fillRect(cx + 4, top - 8 + (Math.floor(t * 2) % 2), 2, 2);
      } else if (x === 'cross') {
        this.#face(ctx, b, -1, 2, b.bodyH - 6, 3, 1, '#e34d4d');
        this.#face(ctx, b, -1, 3, b.bodyH - 7, 1, 3, '#e34d4d');
      } else if (x === 'redlamp') {
        lights.push([cx, top - 3, 1, 2, Math.floor(t * 1.5) % 2 ? '#ff5b5b' : '#e34d4d']);
        const ox = cx + hw + 2, oy = cy + 2;
        ctx.fillStyle = '#2a3f7a'; ctx.fillRect(ox, oy - 3, 1, 3);
        ctx.fillStyle = '#e8d5c0'; ctx.fillRect(ox, oy - 4, 1, 1); ctx.fillRect(ox + 1, oy - 3 - (Math.floor(t * 2) % 2), 1, 1);
      }
    }

    #tree(ctx, sx, sy, kind, th, season) {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(sx - 0.5, sy - 3, 1, 3);
      if (kind === 'pine') {
        this.#poly(ctx, '#2f6b3f', [[sx, sy - 12], [sx - 4, sy - 2], [sx + 4, sy - 2]]);
        if (season === 'winter') this.#poly(ctx, '#ffffff', [[sx, sy - 12], [sx - 1.5, sy - 8], [sx + 1.5, sy - 8]]);
      } else {
        ctx.fillStyle = th.leaf;
        ctx.beginPath(); ctx.arc(sx, sy - 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = th.leaf2;
        ctx.fillRect(sx - 2, sy - 8, 2, 1);
      }
    }

    #drawBuilding(ctx, b, night, lights) {
      const e = b.entity, look = b.look;
      const { cx, cy, hw } = b;
      if (look.custom) {
        this.#customPlace(ctx, b, night, lights);
        if (e.incident === 'fire' && e.meta.look !== 'tree') this.#flames(cy - b.bodyH, cx, lights);
        return;
      }
      if (look.signpost) {
        ctx.fillStyle = '#6b707c'; ctx.fillRect(cx, cy - 9, 1, 9);
        ctx.fillStyle = '#d8c9a8'; ctx.fillRect(cx - 3, cy - 9, 7, 3);
        ctx.fillStyle = '#5c3d1a'; ctx.fillRect(cx - 2, cy - 8, 5, 1);
        return;
      }
      let color = look.color || e.color || CATEGORY[e.category] || CATEGORY.default;
      if (e.staleness > 0) color = mix(toHex(color), '#8a8f9c', e.staleness * 0.7);
      const top = this.#box(ctx, cx, cy, hw, b.bodyH, color);
      // windows on both faces; lit ones go to the light layer at night
      const seed = strHash(e.id);
      let wi = 0;
      for (const side of look.noWindows ? [] : [-1, 1]) {
        for (let dx = 2; dx <= hw - 2; dx += 3) {
          // face bottom slopes from the side corner (cy) to the front corner (cy + hw/2)
          const wx = side === -1 ? cx - hw + dx : cx + hw - dx - 1;
          const bottom = cy + dx / 2;
          for (let wy = bottom - b.bodyH + 3; wy < bottom - 3; wy += 4) {
            const lit = hash01(seed + wi, Math.floor(this._time / 4 + wi * 0.37)) < Math.max(0.15, e.activity);
            const rainbow = look.windows === 'rainbow';
            const col = rainbow ? RAINBOW[(wi + Math.floor(this._time * 0.7)) % RAINBOW.length]
              : night ? (lit ? '#ffe07a' : '#1e2230') : '#bcd4e6';
            if ((night && lit) || rainbow) lights.push([wx, Math.round(wy), 1, 2, col]);
            else { ctx.fillStyle = col; ctx.fillRect(wx, Math.round(wy), 1, 2); }
            wi++;
          }
        }
      }
      if (look.columns) {
        ctx.fillStyle = '#f2ece0';
        for (let i = 1; i < hw; i += 2) ctx.fillRect(cx - hw + i, cy - b.bodyH + i / 2 + 3, 1, b.bodyH - 4);
      }
      if (look.sign === 'envelope') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - hw + 2, cy - 5, 3, 2);
        ctx.fillStyle = '#c8553d'; ctx.fillRect(cx - hw + 3, cy - 5, 1, 1);
      }
      if (look.sign === 'busstop') {
        ctx.fillStyle = '#8a95a3'; ctx.fillRect(cx + hw + 1, cy - 5, 1, 6);
        ctx.fillStyle = '#5b8cff'; ctx.fillRect(cx + hw, cy - 7, 3, 2);
      }
      if (b.roof === 'pyramid') {
        const roofCol = look.roofColor || shade(toHex(color), -0.45);
        const apex = [cx, top - b.roofH];
        this.#poly(ctx, shade(toHex(roofCol), 0.1), [[cx - hw, top], [cx, top + hw / 2], apex]);
        this.#poly(ctx, shade(toHex(roofCol), -0.2), [[cx, top + hw / 2], [cx + hw, top], apex]);
      }
      if (look.extra) this.#extras(ctx, b, top, night, lights);
      const roofTop = top - b.roofH;
      if (e.shipped) {
        ctx.fillStyle = '#c9cfdb'; ctx.fillRect(cx, roofTop - 6, 1, 6);
        ctx.fillStyle = '#5bd67a'; ctx.fillRect(cx + 1, roofTop - 6 + (Math.floor(this._time * 2) % 2), 3, 2);
      }
      if (e.staleness > 0.4) {
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(cx - hw + 1, cy - 1, 1, 2); ctx.fillRect(cx + hw - 2, cy - 1, 1, 2);
      }
      if (e.incident === 'fire') {
        this.#flames(roofTop, cx, lights);
      } else if (e.incident === 'crane') {
        ctx.fillStyle = '#ffd24d';
        ctx.fillRect(cx + hw, roofTop - 8, 1, b.bodyH + 8);
        const swing = Math.round(Math.sin(this._time * 0.6) * 3);
        ctx.fillRect(cx + hw - 6 + swing, roofTop - 8, 9, 1);
        ctx.fillStyle = '#6b707c'; ctx.fillRect(cx + hw - 5 + swing, roofTop - 7, 1, 3);
      }
    }

    #flames(roofTop, cx, lights) {
      for (let i = 0; i < 4; i++) {
        const fx = cx - 3 + i * 2, fh = 2 + Math.floor(hash01(i, Math.floor(this._time * 8)) * 3);
        lights.push([fx, roofTop - fh, 1, fh, i % 2 ? '#ffd24d' : '#ff6b3d']);
      }
    }

    #drawCar(ctx, sx, sy, color, e, lights, dir) {
      const hw = 3;
      this.#box(ctx, sx, sy, hw, 2, color);
      this.#box(ctx, sx, sy - 2, 2, 1, shade(toHex(color), 0.25));
      if (e.kind === 'responder') {
        lights.push([sx - 0.5, sy - 5, 1, 1, Math.floor(this._time * 4) % 2 ? '#ff5b5b' : '#5b8cff']);
      } else if (e.incident === 'stalled') {
        if (Math.floor(this._time * 3) % 2) { lights.push([sx - 3, sy - 1, 1, 1, '#ffb84d']); lights.push([sx + 2, sy - 1, 1, 1, '#ffb84d']); }
      } else if (e.incident === 'crash') {
        lights.push([sx, sy - 7, 1, 2, '#ffb84d']);
      } else if (dir) {
        lights.push([sx + dir[0], sy + dir[1] - 1, 1, 1, '#ffe07a', true]);
      }
    }

    #draw() {
      if (!this.map) return;
      const ctx = this.bctx;
      const season = this.getSeason();
      const th = SEASONS[season];
      this._season = season;
      this._burning = this.hitboxes.some((b) => b.entity.incident === 'fire' && !b.look.custom);
      const tod = this.getTimeOfDay();
      const dayness = (Math.cos((tod - 0.5) * 2 * Math.PI) + 1) / 2;
      const night = dayness < 0.45;
      const golden = clamp01(1 - Math.abs(dayness - 0.5) * 4);
      this._actorBoxes = [];
      const lights = [];

      // sky
      ctx.fillStyle = mix('#1c2130', th.daySky, dayness);
      ctx.fillRect(0, 0, this.width, this.height);
      if (dayness < 0.6) {
        const r = seeded('iso-stars');
        for (let i = 0; i < 40; i++) {
          const x = r() * this.width, y = r() * this.height * 0.8, p = r() * 6;
          ctx.fillStyle = `rgba(220,228,255,${((1 - dayness) * (0.4 + 0.6 * Math.abs(Math.sin(this._time / 2 + p)))).toFixed(2)})`;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      }
      const sunX = clamp01((tod - 0.2) / 0.6) * (this.width - 10) + 5;
      if (dayness > 0.05) { ctx.fillStyle = `rgba(255,230,150,${dayness.toFixed(2)})`; ctx.fillRect(Math.round(sunX), 6, 3, 3); }
      if (season === 'autumn' && night) {
        // tsukimi: a big full moon
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(this.width - 22, 14, 5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.drawImage(this.#ground(season), 0, 0);

      // water shimmer
      const { W, H, t, riverY } = this.map;
      ctx.fillStyle = '#9fd0f0';
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if ((t[y][x] === 'water' || t[y][x] === 'pond') && (x * 3 + y + Math.floor(this._time * 2)) % 4 === 0) {
            const [sx, sy] = this.#P(x + 0.5, y + 0.5);
            ctx.fillRect(sx - 2, sy, 3, 1);
          }
        }
      }
      // boats
      for (const b of this._boats) {
        const [sx, sy] = this.#P(b.x, riverY + 1);
        ctx.fillStyle = '#f2f2f2'; ctx.fillRect(Math.round(sx) - 3, Math.round(sy), 6, 2);
        ctx.fillStyle = '#ff6b6b'; ctx.fillRect(Math.round(sx), Math.round(sy) - 4, 1, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(sx) + 1, Math.round(sy) - 4, 2, 3);
      }

      // depth-sorted scene
      const items = [];
      for (const b of this.hitboxes) items.push({ d: b.depth + 0.5, fn: () => this.#drawBuilding(ctx, b, night, lights) });
      for (const gd of this._gardens) {
        const [sx, sy] = this.#P(gd.x + 0.5, gd.y + 0.5);
        if (gd.kind === 'tree') {
          const kind = hash01(gd.x, gd.y * 3) < 0.4 ? 'pine' : 'round';
          items.push({ d: gd.x + gd.y + 0.5, fn: () => this.#tree(ctx, sx, sy, kind, th, season) });
        } else {
          items.push({ d: gd.x + gd.y + 0.4, fn: () => {
            for (let i = 0; i < 4; i++) { ctx.fillStyle = RAINBOW[(gd.x + gd.y + i) % RAINBOW.length]; ctx.fillRect(sx - 3 + i * 2, sy - 1 + (i % 2), 1, 1); }
          } });
        }
      }
      if (this.map.park) {
        const p = this.map.park;
        const spots = [[0, 0, 'round'], [2, 0, 'pine'], [0, 2, 'round'], [2, 2, 'round'], [1, 0, 'round'], [0, 1, 'pine']];
        for (const [dx, dy, kind] of spots) {
          const [sx, sy] = this.#P(p.x + dx + 0.5, p.y + dy + 0.5);
          items.push({ d: p.x + dx + p.y + dy + 0.5, fn: () => this.#tree(ctx, sx, sy, kind, th, season) });
        }
        if (season === 'spring') {
          // hanami: picnic blankets under the cherry trees
          for (const [dx, dy] of [[0.5, 1.5], [1.5, 2.5]]) {
            const [qx, qy] = this.#P(p.x + dx + 0.5, p.y + dy + 0.5);
            items.push({ d: p.x + dx + p.y + dy + 0.2, fn: () => {
              for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#e34d4d'; ctx.fillRect(qx - 3 + i * 1.5, qy - 1 + (i % 2) * 0.5, 2, 1); }
              ctx.fillStyle = '#5b8cff'; ctx.fillRect(qx + 2, qy - 3, 1, 2); ctx.fillStyle = '#e8d5c0'; ctx.fillRect(qx + 2, qy - 4, 1, 1);
            } });
          }
        }
        const [bx, by] = this.#P(p.x + 2.5, p.y + 1.5);
        items.push({ d: p.x + p.y + 3.5, fn: () => { ctx.fillStyle = '#8a6f3f'; ctx.fillRect(bx - 2, by - 2, 4, 1); ctx.fillRect(bx - 2, by - 1, 1, 1); ctx.fillRect(bx + 1, by - 1, 1, 1); } });
      }
      // outer verge trees
      for (let i = 0; i < W + H; i += 3) {
        const x = i < W ? i : W - 1, y = i < W ? H - 1 : i - W;
        if (this.map.t[y] && this.map.t[y][x] === 'grass' && hash01(x, y) < 0.6) {
          const [sx, sy] = this.#P(x + 0.5, y + 0.5);
          items.push({ d: x + y + 0.5, fn: () => this.#tree(ctx, sx, sy, hash01(y, x) < 0.5 ? 'pine' : 'round', th, season) });
        }
      }
      // train
      const ring = this.map.ring;
      const trainEntity = { id: 'fun-train', name: 'Journal Line', kind: 'fun', meta: { lens: 'fun-train' } };
      for (let i = 0; i <= this._train.cars; i++) {
        const s = (this._train.s - i * 0.9 + ring.length * 2) % ring.length;
        const a = ring[Math.floor(s)], b = ring[(Math.floor(s) + 1) % ring.length], f = s - Math.floor(s);
        const x = a[0] + (b[0] - a[0]) * f + 0.5, y = a[1] + (b[1] - a[1]) * f + 0.5;
        const [sx, sy] = this.#P(x, y);
        items.push({ d: x + y, fn: () => {
          const top = this.#box(ctx, sx, sy, 4, 4, i === 0 ? '#5bd67a' : '#f2f2f2');
          ctx.fillStyle = i === 0 ? '#2f6b3f' : '#5bd67a'; ctx.fillRect(sx - 4, sy - 1, 4, 1);
          if (night) lights.push([sx - 2, top + 2, 1, 1, '#ffe07a']);
          this._actorBoxes.push({ entity: trainEntity, x: sx - 5, y: top - 3, w: 10, h: 9 });
        } });
      }
      // fire trucks: the fire station sends one to each burning place (max 2)
      if (this.hitboxes.some((b) => b.entity.meta && b.entity.meta.look === 'firestation')) {
        this.hitboxes.filter((b) => b.entity.incident === 'fire' && !b.look.custom).slice(0, 2).forEach((b) => {
          const road = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => [b.tx + dx, b.ty + dy]).find(([x, y]) => this._isRoad(x, y));
          if (!road) return;
          const [sx, sy] = this.#P(road[0] + 0.5, road[1] + 0.5);
          items.push({ d: road[0] + road[1] + 0.3, fn: () => {
            this.#box(ctx, sx, sy, 4, 3, '#e34d4d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 3, sy - 4, 5, 1);
            lights.push([sx, sy - 5, 1, 1, Math.floor(this._time * 4) % 2 ? '#ff5b5b' : '#5b8cff']);
            for (let i = 0; i < 6; i++) {
              const k = (this._time * 1.2 + i / 6) % 1;
              const wx = sx + (b.cx - sx) * k, wy = sy - 4 + (b.cy - b.bodyH - sy + 4) * k - Math.sin(k * Math.PI) * 6;
              lights.push([Math.round(wx), Math.round(wy), 1, 1, '#9fd0f0']);
            }
          } });
        });
      }

      // moving actors
      for (const e of this.entities) {
        const a = this._actors.get(e.id);
        if (!a || e.kind === 'sky') continue;
        const f = Math.min(1, a.t);
        const dx = a.tx - a.fx, dy = a.ty - a.fy;
        const x = a.fx + dx * f + 0.5 - dy * a.side, y = a.fy + dy * f + 0.5 + dx * a.side;
        const [sx, sy] = this.#P(x, y).map(Math.round);
        if (e.kind === 'walker') {
          items.push({ d: x + y + 0.1, fn: () => {
            const col = e.color || '#d8c9a8';
            ctx.fillStyle = col; ctx.fillRect(sx, sy - 3, 1, 2);
            ctx.fillStyle = '#e8d5c0'; ctx.fillRect(sx, sy - 4, 1, 1);
            if (a.pause <= 0 && Math.floor(this._time * 4) % 2) { ctx.fillStyle = col; ctx.fillRect(sx + 1, sy - 1, 1, 1); }
            this._actorBoxes.push({ entity: e, x: sx - 2, y: sy - 6, w: 5, h: 7 });
          } });
        } else {
          const color = e.kind === 'responder' ? '#e8ecf5' : (e.color || CATEGORY[e.category] || CATEGORY.default);
          const dir = [Math.sign(dx - dy) * 3, Math.sign(dx + dy) * 1];
          items.push({ d: x + y + 0.1, fn: () => {
            this.#drawCar(ctx, sx, sy, color, e, lights, night ? dir : null);
            this._actorBoxes.push({ entity: e, x: sx - 4, y: sy - 7, w: 9, h: 9 });
          } });
        }
      }
      items.sort((p, q) => p.d - q.d);
      for (const it of items) it.fn();

      // smoke
      for (const s of this._smoke) {
        ctx.fillStyle = `rgba(60,58,56,${(0.5 * (1 - s.age / s.life)).toFixed(2)})`;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      }

      // blimp
      for (const e of this.entities) {
        if (e.kind !== 'sky') continue;
        const a = this._actors.get(e.id);
        if (!a) continue;
        const bx = Math.round(a.x), by = Math.round(a.y);
        ctx.fillStyle = e.color || '#b28ae8';
        ctx.fillRect(bx, by, 10, 4); ctx.fillRect(bx + 1, by - 1, 8, 1); ctx.fillRect(bx + 1, by + 4, 8, 1);
        ctx.fillStyle = '#565c6b'; ctx.fillRect(bx + 4, by + 5, 3, 1);
        if (Math.floor(this._time * 2) % 2) lights.push([bx + (a.dir === 1 ? 9 : 0), by + 1, 1, 1, '#ffd24d']);
        this._actorBoxes.push({ entity: e, x: bx - 1, y: by - 2, w: 12, h: 9 });
      }

      // night + golden-hour tint, then lights glow through it
      if (golden > 0.02) { ctx.fillStyle = `rgba(255,120,70,${(golden * 0.25).toFixed(2)})`; ctx.fillRect(0, 0, this.width, this.height); }
      if (dayness < 0.95) { ctx.fillStyle = `rgba(10,14,36,${((1 - dayness) * 0.5).toFixed(2)})`; ctx.fillRect(0, 0, this.width, this.height); }
      if (night) {
        // street lamps at crossings
        for (const [x, y] of this._roads) {
          let n = 0;
          for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this._isRoad(x + ddx, y + ddy)) n++;
          if (n >= 3) {
            const [sx, sy] = this.#P(x, y + 0.5);
            ctx.fillStyle = 'rgba(255,217,138,0.18)'; ctx.fillRect(sx - 3, sy - 2, 7, 4);
            ctx.fillStyle = '#ffd98a'; ctx.fillRect(sx, sy - 1, 1, 1);
            if (season === 'summer') {
              // matsuri: red and white lanterns at every crossing
              ctx.fillStyle = '#e34d4d'; ctx.fillRect(sx - 3, sy - 4, 1, 2);
              ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 3, sy - 4, 1, 2);
            }
          }
        }
      }
      for (const [x, y, w, h, col, beam] of lights) {
        if (beam) { ctx.fillStyle = 'rgba(255,224,122,0.25)'; ctx.fillRect(x - 1, y - 1, 3, 3); }
        ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h);
      }
      if (this._weather > 0.05) {
        ctx.fillStyle = `rgba(50,54,66,${(this._weather * 0.25).toFixed(2)})`; ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = 'rgba(180,200,230,0.45)';
        for (const d of this._rain) ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
      }
      for (const f of this._fireworks) {
        const k = f.age / f.life, r = 1 + k * 7;
        ctx.fillStyle = `hsla(${f.hue},90%,70%,${(1 - k).toFixed(2)})`;
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          ctx.fillRect(Math.round(f.x + Math.cos(ang) * r), Math.round(f.y + Math.sin(ang) * r), 1, 1);
        }
      }
      if (th.particle) {
        for (const p of this._particles) {
          ctx.fillStyle = th.particle;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      } else if (night) {
        // summer: fireflies glow only after dark
        for (const p of this._particles.slice(0, 10)) {
          ctx.fillStyle = `rgba(214,255,120,${(0.4 + 0.6 * Math.abs(Math.sin(this._time * 2 + p.ph))).toFixed(2)})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      }

      if (this._decorator) {
        try { this._decorator(ctx, { time: this._time, dayness, addHitbox: (b) => b && b.entity && this._actorBoxes.push(b) }); }
        catch (err) { console.error('Machi iso decorator failed', err); }
      }

      // hover outline
      const hov = this._hoveredId && (this._actorBoxes.find((b) => b.entity.id === this._hoveredId)
        || this.hitboxes.find((b) => b.entity.id === this._hoveredId));
      if (hov) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(hov.x) - 0.5, Math.round(hov.y) - 0.5, Math.round(hov.w) + 1, Math.round(hov.h) + 1);
      }

      const out = this.ctx;
      out.imageSmoothingEnabled = false;
      out.drawImage(this.buffer, 0, 0, this.width * this.scale, this.height * this.scale);
      if (hov) {
        out.font = `700 ${Math.max(11, this.scale * 4)}px monospace`;
        const label = hov.entity.name;
        const tw = out.measureText(label).width;
        const lx = Math.max(4, Math.min(this.canvas.width - tw - 10, (hov.x + hov.w / 2) * this.scale - tw / 2));
        const ly = Math.max(16, hov.y * this.scale - 8);
        out.fillStyle = 'rgba(16,19,28,0.8)'; out.fillRect(lx - 4, ly - 13, tw + 8, 18);
        out.fillStyle = '#ffffff'; out.fillText(label, lx, ly);
      }
    }
  }

  return { Town, buildMap };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MachiIso;
