/* STAMPED COPY — canonical source: Vibe_Coding/MachiHub/machi-neon.js (Machi Hub project).
   Edit there, then re-copy here. Do not edit this copy directly. */

/* machi-neon.js — Cyberpunk "Neon District" renderer for Machi Hub.
   Deliberately independent from machi-engine.js's Town class — shares nothing at the
   code level, only the entity shape (MachiHub.createEntity output). Nothing in here
   can regress the tested City/Fantasy town; this is a second, separate skin on the
   same data (buildings = tools, cars = projects, etc.), drawn at a finer logical
   resolution with its own visual language. */

const MachiNeon = (() => {
  // ── Layout constants (buffer/pixel space, scaled up on blit) ───────────────
  // Roughly 1.8x the logical density of the Town engine's grid, so facades/signage
  // get real detail instead of just being blown up bigger.
  const CELL_W = 48;
  const BUILD_ZONE = 74;
  const SIDEWALK_H = 4;
  const ROAD_H = 16;
  const ROW_H = BUILD_ZONE + SIDEWALK_H + ROAD_H;
  const TOP_SKY = 46;
  const AVENUE_W = 24;
  const MARGIN_X = 16;

  const NEON_HUES = [320, 185, 55, 265, 150]; // magenta, cyan, yellow, violet, mint — assigned per building

  function seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v || 0)); }
  function hueFromId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return NEON_HUES[h % NEON_HUES.length];
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
      this._windows = new Map();     // entity id -> bool[] lit state
      this._flyers = new Map();      // entity id -> {y, dir, speed, phase, lane} (vehicles + responders, flying)
      this._walkers = new Map();     // entity id -> {x, dir, speed, phase}
      this._weather = 0;
      this._hoveredId = null;
      this._rain = [];
      this._nextRainIn = 0;
      this._stars = [];
      this._haze = [];
    }

    setEntities(entities) {
      this.entities = entities.slice();
      this._windows.clear();
      this._flyers.clear();
      this._walkers.clear();
      return this;
    }

    setMaxPerRow(n) {
      this.maxPerRow = Math.max(2, Math.floor(n) || this.maxPerRow);
      return this;
    }

    setWeather(level) {
      this._weather = clamp01(level);
      return this;
    }

    setKindVisible(kind, visible) {
      if (visible) this._hiddenKinds.delete(kind);
      else this._hiddenKinds.add(kind);
      if (!this._raf && this.grid) this.#drawFrame();
      return this;
    }

    get buildings() { return this.entities.filter((e) => e.kind === 'building'); }

    /** Computes district-grouped grid positions, sizes the canvases, seeds stars/haze. */
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

      const srand = seedFrom('machi-neon-stars-' + this.entities.map((e) => e.id).join(','));
      this._stars = Array.from({ length: Math.floor(width / 10) }, () => ({
        x: Math.floor(srand() * width),
        y: 2 + Math.floor(srand() * (TOP_SKY - 10)),
        phase: srand() * Math.PI * 2,
        period: 1.5 + srand() * 3,
      }));
      // distant building glow haze — soft blobs low in the sky band, ambient city light
      this._haze = Array.from({ length: 6 }, () => ({
        x: srand() * width,
        w: 30 + srand() * 50,
        hue: NEON_HUES[Math.floor(srand() * NEON_HUES.length)],
      }));

      // flying lanes: two fixed altitudes spanning the whole vertical extent of the district
      this._lanes = [TOP_SKY + height * 0.18, TOP_SKY + height * 0.55].map((y) => Math.min(y, height - 12));
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
        const rand = seedFrom(entity.id + '-neon-windows');
        st = Array.from({ length: count }, () => rand() > 0.35);
        this._windows.set(entity.id, st);
      }
      return st;
    }

    #ensureFlyer(e, i) {
      if (this._flyers.has(e.id)) return this._flyers.get(e.id);
      const rand = seedFrom(e.id + '-neon-flyer');
      const lane = this._lanes[i % this._lanes.length];
      const dir = rand() > 0.5 ? 1 : -1;
      const f = {
        y: lane + (rand() - 0.5) * 10,
        dir,
        x: rand() * (this.grid.width || 200),
        speed: 14 + clamp01(e.activity) * 22 + rand() * 8,
        trail: [],
      };
      this._flyers.set(e.id, f);
      return f;
    }

    #ensureWalker(e) {
      if (this._walkers.has(e.id)) return this._walkers.get(e.id);
      const rand = seedFrom(e.id + '-neon-walker');
      const w = {
        row: Math.floor(rand() * Math.max(1, this.grid.rows)),
        x: rand() * (this.grid.width || 100),
        dir: rand() > 0.5 ? 1 : -1,
        speed: 4 + rand() * 4,
        bob: rand() * Math.PI * 2,
      };
      this._walkers.set(e.id, w);
      return w;
    }

    #tick(dt) {
      this._time += dt;
      const { width, height } = this.grid || {};
      if (!width) return;

      // flying vehicles + responders drift horizontally along their lane, wrapping around
      const flyers = this.entities.filter((e) => e.kind === 'vehicle' || e.kind === 'responder');
      flyers.forEach((e, i) => {
        if (this._hiddenKinds.has(e.kind)) return;
        const f = this.#ensureFlyer(e, i);
        f.x += f.dir * f.speed * dt;
        if (f.x > width + 12) f.x = -12;
        if (f.x < -12) f.x = width + 12;
        f.trail.unshift({ x: f.x, y: f.y });
        if (f.trail.length > 6) f.trail.pop();
      });

      // walkers pace the sidewalk of their row
      const walkers = this.entities.filter((e) => e.kind === 'walker');
      walkers.forEach((e) => {
        if (this._hiddenKinds.has('walker')) return;
        const w = this.#ensureWalker(e);
        w.x += w.dir * w.speed * dt;
        if (w.x > width - MARGIN_X) { w.x = width - MARGIN_X; w.dir = -1; }
        if (w.x < MARGIN_X) { w.x = MARGIN_X; w.dir = 1; }
        w.bob += dt * 6;
      });

      // ambient neon rain — always a light drizzle, heavier with weather
      const targetRain = Math.floor(6 + this._weather * 40);
      while (this._rain.length < targetRain) {
        this._rain.push({ x: Math.random() * width, y: Math.random() * height, speed: 60 + Math.random() * 60, hue: NEON_HUES[Math.floor(Math.random() * NEON_HUES.length)] });
      }
      if (this._rain.length > targetRain) this._rain.length = targetRain;
      for (const d of this._rain) {
        d.y += d.speed * dt;
        d.x -= d.speed * 0.15 * dt;
        if (d.y > height) { d.y = -2; d.x = Math.random() * width; }
      }

      this.#drawFrame();
    }

    #drawFrame() {
      const ctx = this.bctx;
      const { width, height, hasAvenue, avenueAfter, rows, avenueTop } = this.grid;
      this._actorBoxes = [];

      // sky — deep gradient, near-black to a hazy purple-navy near the skyline
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#05040c');
      grad.addColorStop(0.6, '#0c0a1e');
      grad.addColorStop(1, '#1a1230');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // distant glow haze — soft colored blobs low in the sky, implying a lit skyline beyond
      for (const hz of this._haze) {
        const g = ctx.createRadialGradient(hz.x, TOP_SKY, 0, hz.x, TOP_SKY, hz.w);
        g.addColorStop(0, `hsla(${hz.hue},90%,55%,0.18)`);
        g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g;
        ctx.fillRect(hz.x - hz.w, 0, hz.w * 2, TOP_SKY + 10);
      }

      // stars — sparse, dim (neon glow drowns most of them)
      for (const s of this._stars) {
        const tw = 0.15 + 0.25 * Math.abs(Math.sin(this._time / s.period + s.phase));
        ctx.fillStyle = `rgba(210,220,255,${tw.toFixed(2)})`;
        ctx.fillRect(s.x, s.y, 1, 1);
      }

      // vertical avenue — starts at the first row's street line, matches the Town fix
      if (hasAvenue) {
        const ax = MARGIN_X + avenueAfter * CELL_W;
        ctx.fillStyle = '#0e0e18';
        ctx.fillRect(ax, avenueTop, AVENUE_W, height - avenueTop);
        ctx.fillStyle = 'rgba(255,47,208,0.55)';
        for (let y = avenueTop + 4; y < height; y += 10) ctx.fillRect(ax + Math.floor(AVENUE_W / 2) - 1, y, 2, 5);
      }

      // rows: sidewalk + wet road + neon lane lines
      for (let r = 0; r < rows; r++) {
        const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;

        ctx.fillStyle = '#141420';
        if (hasAvenue) {
          const ax = MARGIN_X + avenueAfter * CELL_W;
          ctx.fillRect(0, baseline, ax, SIDEWALK_H);
          ctx.fillRect(ax + AVENUE_W, baseline, width - (ax + AVENUE_W), SIDEWALK_H);
        } else {
          ctx.fillRect(0, baseline, width, SIDEWALK_H);
        }

        const roadY = baseline + SIDEWALK_H;
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, roadY, width, ROAD_H);
        // wet-street sheen — a soft vertical gradient over the road implying reflected light
        const sheen = ctx.createLinearGradient(0, roadY, 0, roadY + ROAD_H);
        sheen.addColorStop(0, 'rgba(120,90,200,0.10)');
        sheen.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, roadY, width, ROAD_H);
        // neon dashed lane line
        ctx.fillStyle = 'rgba(47,242,255,0.65)';
        const midY = roadY + Math.floor(ROAD_H / 2);
        for (let x = 3; x < width; x += 9) ctx.fillRect(x, midY, 5, 1);

        if (hasAvenue) {
          const ax = MARGIN_X + avenueAfter * CELL_W;
          ctx.fillStyle = 'rgba(255,47,208,0.85)';
          ctx.fillRect(ax - 2, baseline - 3, 2, 3 + SIDEWALK_H);
        }
      }

      // buildings (sorted back-to-front by row so nearer rows can overlap shadows correctly)
      for (const b of this.hitboxes) {
        if (this._hiddenKinds.has('building')) break;
        this.#drawBuilding(ctx, b);
      }

      // walkers — small neon glyphs pacing the sidewalk of their row
      if (!this._hiddenKinds.has('walker')) {
        const walkerEntities = this.entities.filter((e) => e.kind === 'walker');
        for (const e of walkerEntities) {
          const w = this.#ensureWalker(e);
          const baseline = TOP_SKY + Math.min(w.row, Math.max(0, rows - 1)) * ROW_H + BUILD_ZONE;
          const by = Math.round(baseline + SIDEWALK_H - 1 + Math.sin(w.bob) * 0.6);
          const bx = Math.round(w.x);
          const hue = hueFromId(e.id);
          ctx.fillStyle = `hsl(${hue},85%,65%)`;
          ctx.fillRect(bx, by - 2, 1, 2);
          ctx.fillRect(bx, by - 3, 1, 1);
          this._actorBoxes.push({ entity: e, x: bx - 1, y: by - 4, w: 3, h: 5 });
        }
      }

      // flying vehicles + responders — light trail then the craft itself
      const flyerKindsHidden = (k) => this._hiddenKinds.has(k);
      const flyerEntities = this.entities.filter((e) => e.kind === 'vehicle' || e.kind === 'responder');
      for (let i = 0; i < flyerEntities.length; i++) {
        const e = flyerEntities[i];
        if (flyerKindsHidden(e.kind)) continue;
        const f = this.#ensureFlyer(e, i);
        const hue = e.kind === 'responder' ? (Math.floor(this._time * 4) % 2 === 0 ? 0 : 210) : hueFromId(e.id);
        for (let t = 0; t < f.trail.length; t++) {
          const p = f.trail[t];
          const alpha = (1 - t / f.trail.length) * 0.35;
          ctx.fillStyle = `hsla(${hue},90%,60%,${alpha.toFixed(2)})`;
          ctx.fillRect(Math.round(p.x - f.dir * t), Math.round(p.y), 2, 1);
        }
        const bx = Math.round(f.x), by = Math.round(f.y);
        ctx.fillStyle = '#c9ccd8';
        ctx.fillRect(bx, by, 5, 2);
        ctx.fillStyle = `hsl(${hue},95%,60%)`;
        ctx.fillRect(bx + (f.dir === 1 ? 4 : -1), by, 1, 1);
        ctx.fillRect(bx + (f.dir === 1 ? -1 : 4), by + 1, 1, 1);
        this._actorBoxes.push({ entity: e, x: bx - 1, y: by - 1, w: 7, h: 4 });
      }

      // sky entity (badge count) — holographic ad-blimp
      if (!this._hiddenKinds.has('sky')) {
        const skyEntities = this.entities.filter((e) => e.kind === 'sky');
        for (const e of skyEntities) {
          const f = this.#ensureFlyer(e, 0);
          const bx = Math.round(f.x), by = Math.round(TOP_SKY * 0.4);
          const pulse = (Math.sin(this._time * 2) + 1) / 2;
          ctx.fillStyle = `hsla(185,90%,60%,${(0.5 + pulse * 0.3).toFixed(2)})`;
          ctx.fillRect(bx, by, 12, 4);
          ctx.strokeStyle = 'rgba(47,242,255,0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx - 0.5, by - 0.5, 13, 5);
          this._actorBoxes.push({ entity: e, x: bx - 1, y: by - 1, w: 14, h: 6 });
        }
      }

      // rain — neon-tinted streaks
      for (const d of this._rain) {
        ctx.fillStyle = `hsla(${d.hue},80%,70%,0.35)`;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
      }

      // hover outline
      if (this._hoveredId) {
        const box = this.hitboxes.find((b) => b.entity.id === this._hoveredId) || this._actorBoxes.find((b) => b.entity.id === this._hoveredId);
        if (box) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1;
          ctx.strokeRect(box.x - 1.5, box.y - 1.5, box.w + 3, box.h + 3);
        }
      }

      // blit to screen at scale
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.buffer, 0, 0, width, height, 0, 0, width * this.scale, height * this.scale);
    }

    #drawBuilding(ctx, b) {
      const e = b.entity;
      const { x, y, w, h } = b;
      const hue = hueFromId(e.id);

      // contact shadow
      ctx.fillStyle = 'rgba(5,4,10,0.5)';
      ctx.fillRect(x + 2, y + h, w, 3);
      // wet-street reflection — a soft downward smear of the building's own hue
      const refl = ctx.createLinearGradient(0, y + h, 0, y + h + 10);
      refl.addColorStop(0, `hsla(${hue},70%,45%,0.16)`);
      refl.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = refl;
      ctx.fillRect(x, y + h + 3, w, 10);

      // facade base — dark, so neon reads against it rather than a flat color block
      const stale = e.staleness > 0.5;
      ctx.fillStyle = stale ? '#1c1c26' : '#161622';
      ctx.fillRect(x, y, w, h);

      // neon outline glow — two layered strokes, wider/fainter then tight/bright
      ctx.strokeStyle = `hsla(${hue},90%,60%,0.28)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
      ctx.strokeStyle = `hsla(${hue},95%,68%,${stale ? 0.35 : 0.85})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      // windows — denser grid, neon flicker, dimmer when stale
      const wcols = Math.max(1, Math.floor(w / 6));
      const wrows = Math.max(1, Math.floor(h / 6));
      const st = this.#windowState(e, wcols * wrows);
      for (let r = 0; r < wrows; r++) {
        for (let c = 0; c < wcols; c++) {
          const lit = st[r * wcols + c] && !stale;
          ctx.fillStyle = lit ? `hsl(${(hue + 40) % 360},95%,70%)` : 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 3 + c * 6, y + 3 + r * 6, 2, 2);
        }
      }

      // rooftop antenna + blinking beacon
      const blink = Math.floor(this._time * 2 + hue) % 2 === 0;
      ctx.strokeStyle = 'rgba(200,205,220,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y - 6);
      ctx.stroke();
      if (blink) {
        ctx.fillStyle = `hsl(${hue},100%,65%)`;
        ctx.fillRect(x + w / 2 - 1, y - 8, 2, 2);
      }

      // shipped flag -> holographic beacon column instead of cloth flag (fits the skin)
      if (e.shipped) {
        const pulse = (Math.sin(this._time * 3) + 1) / 2;
        ctx.fillStyle = `hsla(${hue},100%,70%,${(0.3 + pulse * 0.4).toFixed(2)})`;
        ctx.fillRect(x + w - 3, y - 10, 2, 10);
      }

      // achievement badges -> small holo tags along the roofline
      const badges = (e.achievements || []).filter((a) => a.id !== 'shipped').slice(0, 3);
      badges.forEach((_, i) => {
        ctx.fillStyle = `hsl(${(hue + i * 40) % 360},90%,65%)`;
        ctx.fillRect(x + 2 + i * 5, y - 3, 3, 2);
      });

      if (e.incident === 'fire') {
        const rand = seedFrom(e.id + '-neon-fire-' + Math.floor(this._time * 6));
        for (let i = 0; i < Math.max(2, Math.floor(w / 6)); i++) {
          if (rand() < 0.7) {
            ctx.fillStyle = ['#ffb84d', '#ff5b3d', '#ffe07a'][Math.floor(rand() * 3)];
            ctx.fillRect(x + 2 + i * 5, y - 2 - Math.floor(rand() * 3), 3, 3);
          }
        }
      } else if (e.incident === 'crane') {
        const sway = Math.sin(this._time * 0.8) * 3;
        ctx.strokeStyle = '#d9d9d9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w - 2, y - 12);
        ctx.lineTo(x + w - 2, y);
        ctx.moveTo(x + w - 2, y - 12);
        ctx.lineTo(x + w - 2 + 6 + sway, y - 12);
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

    downloadPNG(filename = 'machi-neon-district.png') {
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

window.MachiNeon = MachiNeon;
