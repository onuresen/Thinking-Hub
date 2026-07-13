/* STAMPED COPY — canonical source: Vibe_Coding/MachiHub/machi-engine.js (Machi Hub project).
   Edit there, then re-copy here. Do not edit this copy directly. */
// machi-engine.js — portable core for Machi Hub.
// Host-agnostic: knows nothing about vault / Thinking Hub / One+. Adapters live outside this file.
// No DOM assumptions beyond a <canvas> element passed in by the caller.

const MachiHub = (() => {
  const CATEGORY_COLORS = {
    assigned: '#5b8cff',
    personal: '#ff9f5b',
    shipped: '#5bd67a',
    queued: '#8a8f9c',
    default: '#7a86a3',
  };

  function clamp01(n) {
    return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  }

  // Deterministic pseudo-random from a string seed, so a given entity's static features
  // (star field, initial window pattern) are stable across reloads instead of reshuffling.
  function seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
  }

  function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + '…';
  }

  function mix(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }

  /**
   * @typedef {Object} MachiEntity
   * @property {string} id
   * @property {string} name
   * @property {string} [category]     Free-form; unrecognized values fall back to a neutral color.
   * @property {number} [tier]         1-5, maps to building footprint/height. Default 2.
   * @property {number} [activity]     0-1, recency/intensity of work. Drives lit windows. Default 0.
   * @property {number} [staleness]    0-1, how neglected. Drives desaturation + overgrowth. Default 0.
   * @property {boolean} [shipped]     Draws a flag on the roof. Default false.
   * @property {Array<{id:string,label:string,icon:string}>} [achievements] Gold badge pixels above the roof.
   * @property {Object} [meta]         Host-specific passthrough (e.g. a vault note path). Untouched here.
   */

  /** Fills defaults and clamps ranges. Throws if id/name are missing — those are the only required fields. */
  function createEntity(partial) {
    if (!partial || !partial.id || !partial.name) {
      throw new Error('MachiHub.createEntity requires { id, name }');
    }
    return {
      id: String(partial.id),
      name: String(partial.name),
      category: partial.category || 'default',
      tier: Math.max(1, Math.min(5, partial.tier ?? 2)),
      activity: clamp01(partial.activity),
      staleness: clamp01(partial.staleness),
      shipped: !!partial.shipped,
      achievements: partial.achievements || [],
      meta: partial.meta || {},
    };
  }

  // ── Layout constants (buffer/pixel space, scaled up on blit) ───────────────
  const CELL_W = 26;        // horizontal slot per building
  const BUILD_ZONE = 38;    // tallest building (33) + headroom for flags/badges
  const SIDEWALK_H = 2;
  const ROAD_H = 9;
  const ROW_H = BUILD_ZONE + SIDEWALK_H + ROAD_H;
  const TOP_SKY = 24;       // plane + star territory
  const AVENUE_W = 12;      // vertical road through the middle of the town
  const MARGIN_X = 8;

  const FLICKER_MS = 450;   // how often window lights get resampled
  const PLANE_SPEED = 7;    // buffer px per second — slow drift

  class Town {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.scale = opts.scale || 4;
      this.maxPerRow = opts.maxPerRow || 6;
      this.entities = [];
      this.hitboxes = []; // buffer-space rects, filled on layout; used by entityAt()
      this.buffer = document.createElement('canvas');
      this.bctx = this.buffer.getContext('2d');
      this.ctx = canvas.getContext('2d');

      // animation state
      this._raf = null;
      this._lastTs = 0;
      this._flickerAcc = 0;
      this._windows = new Map();  // entity id → bool[] lit state
      this._planes = [];
      this._nextPlaneIn = 2 + Math.random() * 5; // first plane arrives quickly
      this._stars = [];
      this._time = 0;
    }

    setEntities(entities) {
      this.entities = entities.map(createEntity);
      this._windows.clear();
      return this;
    }

    /** Computes grid positions, sizes the canvases, seeds stars. Call via render(). */
    #layout() {
      const n = this.entities.length;
      const cols = Math.max(1, Math.min(this.maxPerRow, n));
      const rows = Math.ceil(n / cols);
      // vertical avenue only when a row is wide enough to feel like a city block
      const avenueAfter = cols >= 4 ? Math.ceil(cols / 2) : Infinity;
      const hasAvenue = avenueAfter !== Infinity;

      const width = MARGIN_X * 2 + cols * CELL_W + (hasAvenue ? AVENUE_W : 0);
      const height = TOP_SKY + rows * ROW_H;

      this.grid = { cols, rows, avenueAfter, hasAvenue, width, height };

      this.hitboxes = this.entities.map((e, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = MARGIN_X + c * CELL_W + (c >= avenueAfter ? AVENUE_W : 0) + 3;
        const w = 8 + e.tier * 2;
        const h = 8 + e.tier * 5;
        const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;
        return { entity: e, x, y: baseline - h, w, h, baseline, row: r };
      });

      this.buffer.width = width;
      this.buffer.height = height;
      this.canvas.width = width * this.scale;
      this.canvas.height = height * this.scale;
      this.canvas.style.imageRendering = 'pixelated';

      // star field: seeded so it doesn't reshuffle on reload
      const srand = seedFrom('machi-stars-' + this.entities.map((e) => e.id).join(','));
      this._stars = Array.from({ length: Math.floor(width / 7) }, () => ({
        x: Math.floor(srand() * width),
        y: 2 + Math.floor(srand() * (TOP_SKY - 8)),
        phase: srand() * Math.PI * 2,
        period: 1.5 + srand() * 3,
      }));
    }

    /** Lazily creates + returns the persistent lit/dark state for a building's windows. */
    #windowState(e, count) {
      let st = this._windows.get(e.id);
      if (!st || st.length !== count) {
        const rand = seedFrom(e.id);
        st = Array.from({ length: count }, () => rand() < e.activity);
        this._windows.set(e.id, st);
      }
      return st;
    }

    /** One static frame. Also the base the animation loop redraws every tick. */
    render() {
      this.#layout();
      this.#drawFrame();
      return this;
    }

    /** Starts the ambient animation loop (window flicker, lamps, stars, planes). */
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

    #tick(dt) {
      this._time += dt;

      // window flicker: resample a couple of windows per building at a slow tick,
      // biased by activity so busy buildings feel lively and stale ones stay dark
      this._flickerAcc += dt * 1000;
      if (this._flickerAcc >= FLICKER_MS) {
        this._flickerAcc = 0;
        for (const e of this.entities) {
          const st = this._windows.get(e.id);
          if (!st) continue;
          const toggles = 1 + (e.activity > 0.5 ? 1 : 0);
          for (let k = 0; k < toggles; k++) {
            const idx = Math.floor(Math.random() * st.length);
            st[idx] = Math.random() < e.activity;
          }
        }
      }

      // planes: spawn occasionally, drift across the top sky
      this._nextPlaneIn -= dt;
      if (this._nextPlaneIn <= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this._planes.push({
          x: dir === 1 ? -6 : this.grid.width + 6,
          y: 3 + Math.random() * (TOP_SKY - 12),
          dir,
        });
        this._nextPlaneIn = 12 + Math.random() * 20;
      }
      for (const p of this._planes) p.x += p.dir * PLANE_SPEED * dt;
      this._planes = this._planes.filter((p) => p.x > -10 && p.x < this.grid.width + 10);

      this.#drawFrame();
    }

    #drawFrame() {
      const ctx = this.bctx;
      const { width, height, cols, rows, avenueAfter, hasAvenue } = this.grid;

      // sky backdrop
      ctx.fillStyle = '#1c2130';
      ctx.fillRect(0, 0, width, height);

      // stars — slow sine twinkle
      for (const s of this._stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(this._time / s.period + s.phase));
        ctx.fillStyle = `rgba(220,228,255,${tw.toFixed(2)})`;
        ctx.fillRect(s.x, s.y, 1, 1);
      }

      // planes — pixel body + blinking beacon
      for (const p of this._planes) {
        const px = Math.round(p.x), py = Math.round(p.y);
        ctx.fillStyle = '#c8ccd8';
        ctx.fillRect(px, py, 4, 1);
        ctx.fillRect(px + (p.dir === 1 ? 0 : 3), py - 1, 1, 1); // tail fin at the back
        if (Math.floor(this._time * 2.5) % 2 === 0) {
          ctx.fillStyle = '#ff5b5b';
          ctx.fillRect(px + (p.dir === 1 ? 4 : -1), py, 1, 1); // beacon at the nose
        }
      }

      // vertical avenue, running the full height of the blocks
      if (hasAvenue) {
        const ax = MARGIN_X + avenueAfter * CELL_W;
        ctx.fillStyle = '#262b36';
        ctx.fillRect(ax, TOP_SKY, AVENUE_W, height - TOP_SKY);
        ctx.fillStyle = '#4a5162';
        for (let y = TOP_SKY + 2; y < height; y += 6) {
          ctx.fillRect(ax + Math.floor(AVENUE_W / 2), y, 1, 3);
        }
      }

      // rows: sidewalk + road + lamps + buildings
      for (let r = 0; r < rows; r++) {
        const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;

        ctx.fillStyle = '#3a4a3a'; // sidewalk / verge
        ctx.fillRect(0, baseline, width, SIDEWALK_H);

        ctx.fillStyle = '#262b36'; // asphalt
        ctx.fillRect(0, baseline + SIDEWALK_H, width, ROAD_H);
        ctx.fillStyle = '#4a5162'; // dashed centerline
        const midY = baseline + SIDEWALK_H + Math.floor(ROAD_H / 2);
        for (let x = 2; x < width; x += 6) ctx.fillRect(x, midY, 3, 1);

        // street lamps at each slot boundary in this row
        const rowCount = Math.min(cols, this.entities.length - r * cols);
        for (let c = 0; c <= rowCount; c++) {
          const lx = MARGIN_X + c * CELL_W + (c > avenueAfter || (c === avenueAfter && c !== 0) ? AVENUE_W : 0) - 1;
          if (lx < 1 || lx > width - 2) continue;
          const lampOn = Math.random() > 0.005; // very rare blink keeps them alive
          ctx.fillStyle = '#565c6b';
          ctx.fillRect(lx, baseline - 5, 1, 5); // pole
          if (lampOn) {
            ctx.fillStyle = '#ffd98a';
            ctx.fillRect(lx, baseline - 6, 1, 1); // bulb
            ctx.fillStyle = 'rgba(255,217,138,0.18)'; // soft pool of light
            ctx.fillRect(lx - 2, baseline - 6, 5, 3);
          }
        }
      }

      // buildings (drawn after roads so nothing overlaps them)
      for (const b of this.hitboxes) this.#drawBuilding(ctx, b);

      // blit to screen at scale, then labels in screen space
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
      this.#drawLabels();
    }

    #drawBuilding(ctx, b) {
      const e = b.entity;
      const { x, y, w, h } = b;
      const base = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.default;

      ctx.fillStyle = e.staleness > 0.5 ? mix(base, '#6b6f76', (e.staleness - 0.5) * 2) : base;
      ctx.fillRect(x, y, w, h);

      // windows from persistent animated state
      const wcols = Math.max(1, Math.floor(w / 3));
      const wrows = Math.max(1, Math.floor(h / 3));
      const st = this.#windowState(e, wcols * wrows);
      for (let r = 0; r < wrows; r++) {
        for (let c = 0; c < wcols; c++) {
          ctx.fillStyle = st[r * wcols + c] ? '#ffe07a' : '#10131c';
          ctx.fillRect(x + 1 + c * 3, y + 1 + r * 3, 1, 1);
        }
      }

      // overgrowth speckle at the base when stale (seeded — stays put between frames)
      if (e.staleness > 0.3) {
        const rand = seedFrom(e.id + '-weeds');
        const speckles = Math.floor(e.staleness * w);
        for (let s = 0; s < speckles; s++) {
          ctx.fillStyle = '#3f6b3f';
          ctx.fillRect(x + Math.floor(rand() * w), y + h - 1, 1, 1);
        }
      }

      // flag on shipped buildings — gentle wave
      if (e.shipped) {
        const wave = Math.floor(this._time * 2) % 2;
        ctx.fillStyle = '#e34d4d';
        ctx.fillRect(x + w - 1, y - 4, 1, 4);
        ctx.fillRect(x + w - 1, y - 4 + wave, 3, 2);
      }

      // gold badge pixels above the roof, one per achievement (capped at 3).
      // 'shipped' is skipped — the flag already tells that story.
      const badges = (e.achievements || []).filter((a) => a.id !== 'shipped').slice(0, 3);
      ctx.fillStyle = '#ffd24d';
      badges.forEach((_, i) => {
        ctx.fillRect(x + 1 + i * 3, y - 3, 2, 2);
      });
    }

    #drawLabels() {
      const ctx = this.ctx;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#c9cfdb';
      ctx.textAlign = 'center';
      const maxWidth = (CELL_W - 2) * this.scale;
      for (const b of this.hitboxes) {
        const cx = (b.x + b.w / 2) * this.scale;
        const ly = (b.baseline + SIDEWALK_H + ROAD_H - 2) * this.scale;
        ctx.fillText(truncate(ctx, b.entity.name, maxWidth), cx, ly);
      }
    }

    /** Entity whose building contains the given canvas-pixel point, or null. */
    entityAt(canvasX, canvasY) {
      const bx = canvasX / this.scale;
      const by = canvasY / this.scale;
      const hit = this.hitboxes.find(
        (b) => bx >= b.x && bx < b.x + b.w && by >= b.y && by < b.y + b.h
      );
      return hit ? hit.entity : null;
    }

    /**
     * Wires click + hover on the canvas. The engine only reports which entity
     * was hit — what happens next (detail panel, navigation) is the host's job.
     * @param {{onClick?: (entity) => void, onHover?: (entity|null) => void}} handlers
     */
    enableInteraction(handlers = {}) {
      const toLocal = (ev) => {
        const rect = this.canvas.getBoundingClientRect();
        // account for CSS scaling of the canvas element, if any
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        return this.entityAt((ev.clientX - rect.left) * sx, (ev.clientY - rect.top) * sy);
      };
      this.canvas.addEventListener('click', (ev) => {
        const e = toLocal(ev);
        if (e && handlers.onClick) handlers.onClick(e);
      });
      this.canvas.addEventListener('mousemove', (ev) => {
        const e = toLocal(ev);
        this.canvas.style.cursor = e ? 'pointer' : 'default';
        if (handlers.onHover) handlers.onHover(e);
      });
      this.canvas.addEventListener('mouseleave', () => {
        this.canvas.style.cursor = 'default';
        if (handlers.onHover) handlers.onHover(null);
      });
      return this;
    }
  }

  return { createEntity, Town, CATEGORY_COLORS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MachiHub;
