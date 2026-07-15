/* STAMPED COPY — canonical source: Vibe_Coding/MachiHub/machi-hires.js (Machi Hub project).
   Edit there, then re-copy here. Do not edit this copy directly. */

/* machi-hires.js — higher logical-resolution redesign of the City sprites, as an isolated
   experiment (same isolation principle as machi-neon.js): shares nothing at the code level
   with machi-engine.js's Town class, only the entity shape. Same visual language as the plain
   City theme — no new aesthetic, no day/night/weather/season — just more facade/window/ground
   detail per building, to see whether a finer pixel grid is worth carrying into the main Town
   engine later. Deliberately scoped down from Neon's feature set (no time-of-day cycle, no
   weather) so the comparison is about sprite detail alone, not confused by other variables. */

const MachiHiRes = (() => {
  // Same higher-density grid as machi-neon.js — proven to give buildings real facade room.
  const CELL_W = 48;
  const BUILD_ZONE = 74;
  const SIDEWALK_H = 4;
  const ROAD_H = 16;
  const ROW_H = BUILD_ZONE + SIDEWALK_H + ROAD_H;
  const TOP_SKY = 46;
  const AVENUE_W = 24;
  const MARGIN_X = 16;

  const CATEGORY_COLORS = {
    assigned: '#5b8cff',
    personal: '#ff9f5b',
    shipped: '#5bd67a',
    queued: '#8a8f9c',
    default: '#7a86a3',
  };

  function seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v || 0)); }
  // hex → {r,g,b}; lighten/darken by mixing toward white/black — used for the facade gradient
  function hexToRgb(hex) {
    const h = (hex || '#7a86a3').replace('#', '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const num = parseInt(n, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  function shade(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const mix = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }

  class District {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.scale = opts.scale || 4;
      this.maxPerRow = opts.maxPerRow || 6;
      this.entities = [];
      this.hitboxes = [];
      this._actorBoxes = [];
      this._hiddenKinds = new Set();
      this.buffer = document.createElement('canvas');
      this.bctx = this.buffer.getContext('2d');
      this.ctx = canvas.getContext('2d');

      this._raf = null;
      this._lastTs = 0;
      this._time = 0;
      this._windows = new Map();
      this._vehicles = new Map();  // entity id -> {row, lane, x, dir, speed}
      this._walkers = new Map();   // entity id -> {row, x, dir, speed, bob}
      this._sky = new Map();       // entity id -> {x, dir, speed}
      this._hoveredId = null;
      this._clouds = [];
    }

    setEntities(entities) {
      this.entities = entities.slice();
      this._windows.clear();
      this._vehicles.clear();
      this._walkers.clear();
      this._sky.clear();
      return this;
    }

    setMaxPerRow(n) {
      this.maxPerRow = Math.max(2, Math.floor(n) || this.maxPerRow);
      return this;
    }

    setKindVisible(kind, visible) {
      if (visible) this._hiddenKinds.delete(kind);
      else this._hiddenKinds.add(kind);
      if (!this._raf && this.grid) this.#drawFrame();
      return this;
    }

    get buildings() { return this.entities.filter((e) => e.kind === 'building'); }

    #layout() {
      const buildings = this.buildings;
      const cols = Math.max(1, Math.min(this.maxPerRow, Math.max(1, buildings.length)));

      const districts = [];
      const byDistrict = new Map();
      for (const b of buildings) {
        if (!byDistrict.has(b.district)) { byDistrict.set(b.district, []); districts.push(b.district); }
        byDistrict.get(b.district).push(b);
      }
      if (districts.length === 0) districts.push('');

      const avenueAfter = cols >= 4 ? Math.ceil(cols / 2) : Infinity;
      const hasAvenue = avenueAfter !== Infinity;
      const width = MARGIN_X * 2 + cols * CELL_W + (hasAvenue ? AVENUE_W : 0);

      this.hitboxes = [];
      this._districtLabels = [];
      let row = 0;
      for (const d of districts) {
        const list = byDistrict.get(d) || [];
        if (d) this._districtLabels.push({ name: d, row });
        list.forEach((e, i) => {
          const c = i % cols;
          const r = row + Math.floor(i / cols);
          const x = MARGIN_X + c * CELL_W + (c >= avenueAfter ? AVENUE_W : 0) + 5;
          const w = 16 + e.tier * 4;
          const h = 16 + e.tier * 10;
          const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;
          this.hitboxes.push({ entity: e, x, y: baseline - h, w, h, baseline, row: r });
        });
        row += Math.max(1, Math.ceil(list.length / cols));
      }
      const rows = Math.max(1, row);
      const height = TOP_SKY + rows * ROW_H;
      const avenueTop = TOP_SKY + BUILD_ZONE;

      this.grid = { cols, rows, avenueAfter, hasAvenue, width, height, avenueTop };

      this.buffer.width = width;
      this.buffer.height = height;
      this.canvas.width = width * this.scale;
      this.canvas.height = height * this.scale;
      this.canvas.style.imageRendering = 'pixelated';

      const crand = seedFrom('machi-hires-clouds-' + this.entities.map((e) => e.id).join(','));
      this._clouds = Array.from({ length: 4 }, () => ({
        x: crand() * width,
        y: 3 + crand() * (TOP_SKY - 14),
        w: 12 + Math.floor(crand() * 10),
        speed: 1.2 + crand() * 1.5,
      }));
    }

    render() {
      this.#layout();
      this.#drawFrame();
      return this;
    }

    start() {
      if (this._raf) return this;
      const step = (ts) => {
        if (!this._lastTs) this._lastTs = ts;
        const dt = Math.min(0.1, (ts - this._lastTs) / 1000);
        this._lastTs = ts;
        this.#tick(dt);
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
      return this;
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this._lastTs = 0;
      return this;
    }

    #windowState(entity, count) {
      let st = this._windows.get(entity.id);
      if (!st || st.length !== count) {
        const rand = seedFrom(entity.id + '-hires-windows');
        st = Array.from({ length: count }, () => rand() > 0.4);
        this._windows.set(entity.id, st);
      }
      return st;
    }

    #ensureVehicle(e, i) {
      if (this._vehicles.has(e.id)) return this._vehicles.get(e.id);
      const rand = seedFrom(e.id + '-hires-vehicle');
      const v = {
        row: Math.floor(rand() * Math.max(1, this.grid.rows)),
        lane: i % 2,
        x: rand() * (this.grid.width || 200),
        dir: rand() > 0.5 ? 1 : -1,
        speed: 10 + clamp01(e.activity) * 18 + rand() * 6,
      };
      this._vehicles.set(e.id, v);
      return v;
    }

    #ensureWalker(e) {
      if (this._walkers.has(e.id)) return this._walkers.get(e.id);
      const rand = seedFrom(e.id + '-hires-walker');
      const w = {
        row: Math.floor(rand() * Math.max(1, this.grid.rows)),
        x: rand() * (this.grid.width || 100),
        dir: rand() > 0.5 ? 1 : -1,
        speed: 4 + rand() * 3,
        bob: rand() * Math.PI * 2,
      };
      this._walkers.set(e.id, w);
      return w;
    }

    #ensureSky(e) {
      if (this._sky.has(e.id)) return this._sky.get(e.id);
      const rand = seedFrom(e.id + '-hires-sky');
      const s = { x: rand() * (this.grid.width || 200), dir: rand() > 0.5 ? 1 : -1, speed: 6 + rand() * 4 };
      this._sky.set(e.id, s);
      return s;
    }

    #tick(dt) {
      this._time += dt;
      const { width } = this.grid || {};
      if (!width) return;

      for (const c of this._clouds) {
        c.x += c.speed * dt;
        if (c.x > width + c.w) c.x = -c.w;
      }

      const vehicles = this.entities.filter((e) => e.kind === 'vehicle' || e.kind === 'responder');
      vehicles.forEach((e, i) => {
        if (this._hiddenKinds.has(e.kind)) return;
        const v = this.#ensureVehicle(e, i);
        v.x += v.dir * v.speed * dt;
        if (v.x > width + 10) v.x = -10;
        if (v.x < -10) v.x = width + 10;
      });

      const walkers = this.entities.filter((e) => e.kind === 'walker');
      walkers.forEach((e) => {
        if (this._hiddenKinds.has('walker')) return;
        const w = this.#ensureWalker(e);
        w.x += w.dir * w.speed * dt;
        if (w.x > width - MARGIN_X) { w.x = width - MARGIN_X; w.dir = -1; }
        if (w.x < MARGIN_X) { w.x = MARGIN_X; w.dir = 1; }
        w.bob += dt * 6;
      });

      const skyEntities = this.entities.filter((e) => e.kind === 'sky');
      skyEntities.forEach((e) => {
        if (this._hiddenKinds.has('sky')) return;
        const s = this.#ensureSky(e);
        s.x += s.dir * s.speed * dt;
        if (s.x > width + 14) s.x = -14;
        if (s.x < -14) s.x = width + 14;
      });

      this.#drawFrame();
    }

    #drawFrame() {
      const ctx = this.bctx;
      const { width, height, hasAvenue, avenueAfter, rows, avenueTop } = this.grid;
      this._actorBoxes = [];

      // fixed pleasant daytime sky — no day/night/weather/season in this pass on purpose,
      // so the comparison is about sprite detail, not lighting variables.
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#8fc7e8');
      grad.addColorStop(0.5, '#bfe3f2');
      grad.addColorStop(1, '#dff3ea');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // soft pixel clouds
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const c of this._clouds) {
        ctx.fillRect(Math.round(c.x), Math.round(c.y), c.w, 4);
        ctx.fillRect(Math.round(c.x) + 3, Math.round(c.y) - 2, c.w - 6, 2);
      }

      // vertical avenue — starts at the first row's street line, same fix as the Town engine
      if (hasAvenue) {
        const ax = MARGIN_X + avenueAfter * CELL_W;
        ctx.fillStyle = '#3a3f4c';
        ctx.fillRect(ax, avenueTop, AVENUE_W, height - avenueTop);
        ctx.fillStyle = '#d8dce4';
        for (let y = avenueTop + 4; y < height; y += 10) ctx.fillRect(ax + Math.floor(AVENUE_W / 2) - 1, y, 2, 5);
      }

      // rows: sidewalk (with subtle texture) + road (with lane markings + crosswalk at the avenue)
      for (let r = 0; r < rows; r++) {
        const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;

        ctx.fillStyle = '#c7cdb8';
        if (hasAvenue) {
          const ax = MARGIN_X + avenueAfter * CELL_W;
          ctx.fillRect(0, baseline, ax, SIDEWALK_H);
          ctx.fillRect(ax + AVENUE_W, baseline, width - (ax + AVENUE_W), SIDEWALK_H);
        } else {
          ctx.fillRect(0, baseline, width, SIDEWALK_H);
        }
        // sidewalk seam texture — a faint line every few units, like paving joints
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let x = 4; x < width; x += 8) ctx.fillRect(x, baseline, 1, SIDEWALK_H);

        const roadY = baseline + SIDEWALK_H;
        ctx.fillStyle = '#3a3f4c';
        ctx.fillRect(0, roadY, width, ROAD_H);
        ctx.fillStyle = '#eef0f4';
        const midY = roadY + Math.floor(ROAD_H / 2);
        for (let x = 3; x < width; x += 9) ctx.fillRect(x, midY, 5, 1);

        if (hasAvenue) {
          const ax = MARGIN_X + avenueAfter * CELL_W;
          // crosswalk stripes across the intersection, replacing a plain stop line
          ctx.fillStyle = 'rgba(238,240,244,0.9)';
          for (let y = roadY + 1; y < roadY + ROAD_H - 1; y += 3) ctx.fillRect(ax - 2, y, AVENUE_W + 4, 2);
        }
      }

      // buildings
      for (const b of this.hitboxes) {
        if (this._hiddenKinds.has('building')) break;
        this.#drawBuilding(ctx, b);
      }

      // walkers
      if (!this._hiddenKinds.has('walker')) {
        for (const e of this.entities.filter((x) => x.kind === 'walker')) {
          const w = this.#ensureWalker(e);
          const baseline = TOP_SKY + Math.min(w.row, Math.max(0, rows - 1)) * ROW_H + BUILD_ZONE;
          const wy = Math.round(baseline - 3 + Math.sin(w.bob) * 0.6);
          const wx = Math.round(w.x);
          const col = e.color || '#7a5a3a';
          ctx.fillStyle = col;
          ctx.fillRect(wx, wy + 1, 2, 3);
          ctx.fillStyle = '#e8d5c0';
          ctx.fillRect(wx, wy - 1, 2, 2);
          if (Math.floor(this._time * 4) % 2 === 0) {
            ctx.fillStyle = col;
            ctx.fillRect(wx + (w.dir === 1 ? 2 : -2), wy + 3, 1, 1);
          }
          this._actorBoxes.push({ entity: e, x: wx - 1, y: wy - 2, w: 4, h: 7 });
        }
      }

      // ground vehicles + responders
      const vehicleEntities = this.entities.filter((e) => e.kind === 'vehicle' || e.kind === 'responder');
      for (let i = 0; i < vehicleEntities.length; i++) {
        const e = vehicleEntities[i];
        if (this._hiddenKinds.has(e.kind)) continue;
        const v = this.#ensureVehicle(e, i);
        const baseline = TOP_SKY + Math.min(v.row, Math.max(0, rows - 1)) * ROW_H + BUILD_ZONE;
        const roadY = baseline + SIDEWALK_H;
        const laneY = roadY + (v.lane === 0 ? 2 : ROAD_H - 7);
        const vx = Math.round(v.x);
        const isResponder = e.kind === 'responder';
        const col = isResponder ? '#e8ecf5' : (e.color || CATEGORY_COLORS[e.category] || CATEGORY_COLORS.default);

        ctx.fillStyle = shade(col, -0.15);
        ctx.fillRect(vx, laneY + 2, 9, 3);
        ctx.fillStyle = col;
        ctx.fillRect(vx + 1, laneY, 6, 3);
        ctx.fillStyle = '#141824';
        ctx.fillRect(vx + 1, laneY + 5, 2, 2);
        ctx.fillRect(vx + 6, laneY + 5, 2, 2);
        ctx.fillStyle = '#ffe07a';
        ctx.fillRect(vx + (v.dir === 1 ? 8 : 0), laneY + 2, 1, 1);

        if (isResponder) {
          ctx.fillStyle = Math.floor(this._time * 4) % 2 === 0 ? '#ff5b5b' : '#5b8cff';
          ctx.fillRect(vx + 4, laneY - 1, 1, 1);
        } else if (e.incident === 'stalled') {
          if (Math.floor(this._time * 3) % 2 === 0) {
            ctx.fillStyle = '#ffb84d';
            ctx.fillRect(vx, laneY + 2, 1, 1);
            ctx.fillRect(vx + 8, laneY + 2, 1, 1);
          }
        } else if (e.incident === 'crash') {
          ctx.fillStyle = '#ffb84d';
          ctx.fillRect(vx + 4, laneY - 2, 1, 1);
        }

        this._actorBoxes.push({ entity: e, x: vx - 1, y: laneY - 2, w: 11, h: 10 });
      }

      // sky entity (badge count) — a blimp, same idea as Town, drawn a bit bigger
      if (!this._hiddenKinds.has('sky')) {
        for (const e of this.entities.filter((x) => x.kind === 'sky')) {
          const s = this.#ensureSky(e);
          const bx = Math.round(s.x), by = Math.round(TOP_SKY * 0.35);
          const col = e.color || '#b28ae8';
          ctx.fillStyle = col;
          ctx.fillRect(bx, by, 14, 5);
          ctx.fillRect(bx + (s.dir === 1 ? -2 : 14), by + 1, 2, 3);
          ctx.fillStyle = '#565c6b';
          ctx.fillRect(bx + 5, by + 5, 3, 2);
          this._actorBoxes.push({ entity: e, x: bx - 2, y: by - 1, w: 18, h: 8 });
        }
      }

      // hover outline
      if (this._hoveredId) {
        const box = this.hitboxes.find((b) => b.entity.id === this._hoveredId) || this._actorBoxes.find((b) => b.entity.id === this._hoveredId);
        if (box) {
          ctx.strokeStyle = 'rgba(0,0,0,0.65)';
          ctx.lineWidth = 1;
          ctx.strokeRect(box.x - 1.5, box.y - 1.5, box.w + 3, box.h + 3);
        }
      }

      this.ctx.imageSmoothingEnabled = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.buffer, 0, 0, width, height, 0, 0, width * this.scale, height * this.scale);
    }

    #drawBuilding(ctx, b) {
      const e = b.entity;
      const { x, y, w, h } = b;
      const base = e.color || CATEGORY_COLORS[e.category] || CATEGORY_COLORS.default;
      const stale = e.staleness > 0.5;
      const fill = stale ? shade(base, -0.35) : base;

      // contact shadow (same idea as the Town engine fix, proportioned for the bigger grid)
      ctx.fillStyle = 'rgba(20,24,20,0.30)';
      ctx.fillRect(x + 2, y + h, w, 3);

      // facade — vertical two-tone gradient instead of a flat fill, for material depth
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, shade(fill, 0.12));
      g.addColorStop(1, shade(fill, -0.1));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      // facade panel seams — subtle vertical structure lines
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      for (let px = x + 8; px < x + w - 2; px += 8) {
        ctx.beginPath(); ctx.moveTo(px + 0.5, y + 2); ctx.lineTo(px + 0.5, y + h - 2); ctx.stroke();
      }

      // roofline trim
      ctx.fillStyle = shade(fill, -0.3);
      ctx.fillRect(x - 1, y - 1, w + 2, 2);

      // windows — denser grid, warm-lit, dimmer when stale
      const wcols = Math.max(1, Math.floor(w / 6));
      const wrows = Math.max(1, Math.floor(h / 6));
      const st = this.#windowState(e, wcols * wrows);
      for (let r = 0; r < wrows; r++) {
        for (let c = 0; c < wcols; c++) {
          const lit = st[r * wcols + c] && !stale;
          ctx.fillStyle = lit ? '#ffe07a' : 'rgba(20,20,28,0.55)';
          ctx.fillRect(x + 3 + c * 6, y + 3 + r * 6, 3, 3);
          if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 3 + c * 6, y + 3 + r * 6, 1, 1); }
        }
      }

      // overgrowth speckle at the base when stale
      if (e.staleness > 0.3) {
        const rand = seedFrom(e.id + '-hires-weeds');
        const speckles = Math.floor(e.staleness * w * 0.6);
        ctx.fillStyle = '#6b7a4a';
        for (let s = 0; s < speckles; s++) ctx.fillRect(x + Math.floor(rand() * w), y + h - 1, 1, 1);
      }

      // flag on shipped buildings
      if (e.shipped) {
        const wave = Math.floor(this._time * 2) % 2;
        ctx.fillStyle = '#e34d4d';
        ctx.fillRect(x + w - 2, y - 8, 1, 8);
        ctx.fillRect(x + w - 2, y - 8 + wave, 5, 3);
      }

      // achievement badges above the roof
      const badges = (e.achievements || []).filter((a) => a.id !== 'shipped').slice(0, 3);
      ctx.fillStyle = '#ffd24d';
      badges.forEach((_, i) => ctx.fillRect(x + 2 + i * 6, y - 5, 4, 3));

      if (e.incident === 'fire') {
        const rand = seedFrom(e.id + '-hires-fire-' + Math.floor(this._time * 6));
        for (let i = 0; i < Math.max(2, Math.floor(w / 6)); i++) {
          if (rand() < 0.7) {
            ctx.fillStyle = ['#ffb84d', '#ff5b3d', '#ffe07a'][Math.floor(rand() * 3)];
            ctx.fillRect(x + 2 + i * 6, y - 3 - Math.floor(rand() * 3), 3, 3);
          }
        }
      } else if (e.incident === 'crane') {
        const sway = Math.sin(this._time * 0.8) * 3;
        ctx.strokeStyle = '#5c5f68';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w - 3, y - 14);
        ctx.lineTo(x + w - 3, y);
        ctx.moveTo(x + w - 3, y - 14);
        ctx.lineTo(x + w - 3 + 7 + sway, y - 14);
        ctx.stroke();
      }
    }

    boxAt(canvasX, canvasY) {
      const bx = canvasX / this.scale;
      const by = canvasY / this.scale;
      const inBox = (bb) => bx >= bb.x && bx < bb.x + bb.w && by >= bb.y && by < bb.y + bb.h;
      const actor = this._actorBoxes.find(inBox);
      if (actor) return actor;
      if (this._hiddenKinds.has('building')) return null;
      return this.hitboxes.find(inBox) || null;
    }

    entityAt(canvasX, canvasY) {
      const box = this.boxAt(canvasX, canvasY);
      return box ? box.entity : null;
    }

    enableInteraction(handlers = {}) {
      const toLocal = (ev) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
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
        if (!this._raf) this.#drawFrame();
        if (handlers.onHover) handlers.onHover(box ? box.entity : null, box);
      });
      this.canvas.addEventListener('mouseleave', () => {
        this.canvas.style.cursor = 'default';
        this._hoveredId = null;
        if (!this._raf) this.#drawFrame();
      });
      return this;
    }

    downloadPNG(filename = 'machi-town-hires.png') {
      this.canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
      return this;
    }
  }

  return { District, LAYOUT: { CELL_W, MARGIN_X, AVENUE_W } };
})();

window.MachiHiRes = MachiHiRes;
