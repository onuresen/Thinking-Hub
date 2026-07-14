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
  // (star field, initial window pattern, spawn positions) are stable across reloads.
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
   * @property {string} [kind]         'building' (default) | 'vehicle' | 'responder' | 'walker' | 'sky'.
   * @property {string} [district]     Buildings only: groups rows into labeled districts.
   * @property {string} [category]     Free-form; unrecognized values fall back to a neutral color.
   * @property {string} [color]        Optional hex override; wins over the category color.
   * @property {number} [tier]         1-5. Buildings: footprint/height. Other kinds: ignored.
   * @property {number} [activity]     0-1. Buildings: lit windows + chimney smoke. Vehicles: speed.
   * @property {number} [staleness]    0-1. Buildings: desaturation + overgrowth. Default 0.
   * @property {boolean} [shipped]     Buildings: flag on the roof. Default false.
   * @property {Array<{id:string,label:string,icon:string}>} [achievements] Badge pixels (buildings).
   * @property {string|null} [incident] Building: 'fire' | 'crane'. Vehicle/responder: 'crash' | 'stalled'.
   *   Null (default) = no incident. Host decides what qualifies; the engine only renders it.
   * @property {Object} [meta]         Host-specific passthrough. Untouched here.
   */

  const VALID_INCIDENTS = new Set(['fire', 'crane', 'crash', 'stalled']);

  /** Fills defaults and clamps ranges. Throws if id/name are missing — those are the only required fields. */
  function createEntity(partial) {
    if (!partial || !partial.id || !partial.name) {
      throw new Error('MachiHub.createEntity requires { id, name }');
    }
    return {
      id: String(partial.id),
      name: String(partial.name),
      kind: partial.kind || 'building',
      district: partial.district || '',
      category: partial.category || 'default',
      color: partial.color || null,
      tier: Math.max(1, Math.min(5, partial.tier ?? 2)),
      activity: clamp01(partial.activity),
      staleness: clamp01(partial.staleness),
      shipped: !!partial.shipped,
      achievements: partial.achievements || [],
      incident: VALID_INCIDENTS.has(partial.incident) ? partial.incident : null,
      meta: partial.meta || {},
    };
  }

  // ── Layout constants (buffer/pixel space, scaled up on blit) ───────────────
  const CELL_W = 26;        // horizontal slot per building
  const BUILD_ZONE = 38;    // tallest building (33) + headroom for flags/badges
  const SIDEWALK_H = 2;
  const ROAD_H = 9;
  const ROW_H = BUILD_ZONE + SIDEWALK_H + ROAD_H;
  const TOP_SKY = 24;       // plane + blimp + star territory
  const AVENUE_W = 12;      // vertical road through the middle of the town
  const MARGIN_X = 8;

  const FLICKER_MS = 450;   // how often window lights get resampled
  const PLANE_SPEED = 7;    // buffer px per second — slow drift
  const BLIMP_SPEED = 2.5;
  const LIGHT_CYCLE = 11;   // traffic light: seconds per full green+red cycle
  const LIGHT_GREEN = 7;    // seconds of green within the cycle

  // Layout knobs exposed so hosts can size the canvas to their container.
  const LAYOUT = { CELL_W, MARGIN_X, AVENUE_W };

  class Town {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.scale = opts.scale || 4;
      this.maxPerRow = opts.maxPerRow || 6;
      this.entities = [];
      this.hitboxes = [];      // buildings: buffer-space rects, filled on layout
      this._actorBoxes = [];   // moving actors: rebuilt every drawn frame
      this._hiddenKinds = new Set();
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
      this._actors = new Map();   // entity id → movement state for vehicle/walker/sky
      this._celebration = 0;      // 0..1 → fireworks frequency
      this._fireworks = [];
      this._nextFireworkIn = 4;
      this._smoke = [];
      this._hoveredId = null;
      this._weather = 0;    // 0..1 storm intensity, host-driven via setWeather()
      this._clouds = [];
      this._rain = [];
      this._timeMode = 'auto'; // 'auto' (follows the real device clock) | number 0..1 (manual override)
      this._manualTimeOfDay = 0.5;
    }

    setEntities(entities) {
      this.entities = entities.map(createEntity);
      this._windows.clear();
      this._actors.clear();
      this._smoke = [];
      return this;
    }

    /** Change how many buildings fit per row (host decides from its container width). */
    setMaxPerRow(n) {
      this.maxPerRow = Math.max(2, Math.floor(n) || this.maxPerRow);
      return this;
    }

    /** Show/hide a whole kind ('building', 'vehicle', 'responder', 'walker', 'sky'). Hidden kinds skip draw + hits. */
    setKindVisible(kind, visible) {
      if (visible) this._hiddenKinds.delete(kind);
      else this._hiddenKinds.add(kind);
      if (!this._raf && this.grid) this.#drawFrame(); // reflect immediately when static and already laid out
      return this;
    }

    /** 0..1 — how often celebratory fireworks burst over the town (0 = never). */
    setCelebration(level) {
      this._celebration = clamp01(level);
      return this;
    }

    /** 0..1 — overall system-health weather. 0 = clear starry sky. Higher = clouds + rain, driven by incident density. */
    setWeather(level) {
      this._weather = clamp01(level);
      return this;
    }

    /**
     * Sets the day/night cycle. Pass 'auto' to follow the real device clock (the default), or a
     * number 0..1 (0/1 = midnight, 0.5 = noon) for a host-driven manual override — e.g. a scrub
     * slider. The same auto/manual shape is meant to be reused by a future setSeason().
     */
    setTimeOfDay(value) {
      if (value === 'auto') {
        this._timeMode = 'auto';
      } else {
        this._timeMode = 'manual';
        this._manualTimeOfDay = clamp01(value);
      }
      if (!this._raf && this.grid) this.#drawFrame(); // reflect immediately when static and already laid out
      return this;
    }

    /** Current effective time-of-day fraction (0..1), whether auto or manual. */
    getTimeOfDay() {
      return this.#currentTimeOfDay();
    }

    #currentTimeOfDay() {
      if (this._timeMode !== 'auto') return this._manualTimeOfDay;
      const d = new Date();
      return (d.getHours() * 60 + d.getMinutes()) / 1440;
    }

    /** Downloads the current frame as a PNG — e.g. a "share your town" button. */
    downloadPNG(filename = 'machi-town.png') {
      this.canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
      return this;
    }

    get buildings() { return this.entities.filter((e) => e.kind === 'building'); }

    /** Computes district-grouped grid positions, sizes the canvases, seeds stars + actor spawns. */
    #layout() {
      const buildings = this.buildings;
      const cols = Math.max(1, Math.min(this.maxPerRow, Math.max(1, buildings.length)));

      // group buildings by district, preserving first-seen district order
      const districts = [];
      const byDistrict = new Map();
      for (const b of buildings) {
        if (!byDistrict.has(b.district)) {
          byDistrict.set(b.district, []);
          districts.push(b.district);
        }
        byDistrict.get(b.district).push(b);
      }
      if (districts.length === 0) districts.push('');

      const avenueAfter = cols >= 4 ? Math.ceil(cols / 2) : Infinity;
      const hasAvenue = avenueAfter !== Infinity;
      const width = MARGIN_X * 2 + cols * CELL_W + (hasAvenue ? AVENUE_W : 0);

      // assign rows sequentially, district by district
      this.hitboxes = [];
      this._districtLabels = [];
      let row = 0;
      for (const d of districts) {
        const list = byDistrict.get(d) || [];
        if (d) this._districtLabels.push({ name: d, row });
        list.forEach((e, i) => {
          const c = i % cols;
          const r = row + Math.floor(i / cols);
          const x = MARGIN_X + c * CELL_W + (c >= avenueAfter ? AVENUE_W : 0) + 3;
          const w = 8 + e.tier * 2;
          const h = 8 + e.tier * 5;
          const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;
          this.hitboxes.push({ entity: e, x, y: baseline - h, w, h, baseline, row: r });
        });
        row += Math.max(1, Math.ceil(list.length / cols));
      }
      const rows = Math.max(1, row);
      const height = TOP_SKY + rows * ROW_H;

      this.grid = { cols, rows, avenueAfter, hasAvenue, width, height };

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

      // cloud field for weather — a handful of drifting blobs, only visible when weather > 0
      const crand = seedFrom('machi-clouds-' + this.entities.map((e) => e.id).join(','));
      this._clouds = Array.from({ length: 5 }, () => ({
        x: crand() * width,
        y: 2 + crand() * (TOP_SKY - 10),
        w: 10 + Math.floor(crand() * 8),
        speed: 1.5 + crand() * 2,
      }));

      // seed movement state for actors (vehicles/responders/walkers/sky), spread across rows
      let vi = 0, wi = 0, si = 0;
      for (const e of this.entities) {
        if (e.kind === 'vehicle' || e.kind === 'responder') {
          const rand = seedFrom(e.id);
          const r = vi % rows;
          const lane = vi % 2; // 0: →, 1: ←
          this._actors.set(e.id, {
            row: r, lane,
            x: rand() * width,
            speed: 4 + e.activity * 10,
            dir: lane === 0 ? 1 : -1,
          });
          vi++;
        } else if (e.kind === 'walker') {
          const rand = seedFrom(e.id);
          this._actors.set(e.id, {
            row: wi % rows,
            x: MARGIN_X + rand() * (width - MARGIN_X * 2),
            speed: 1.2 + rand() * 1.6,
            dir: rand() < 0.5 ? 1 : -1,
            pauseIn: 2 + rand() * 6,
            pausedFor: 0,
          });
          wi++;
        } else if (e.kind === 'sky') {
          const rand = seedFrom(e.id);
          this._actors.set(e.id, {
            x: rand() * width,
            y: 4 + (si % 2) * 7 + rand() * 3,
            dir: rand() < 0.5 ? 1 : -1,
          });
          si++;
        }
      }
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

    /** Starts the ambient animation loop (window flicker, lamps, stars, planes, actors, fireworks). */
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

    /** Traffic light state at the avenue crossings — shared cycle for the whole town. */
    #lightIsGreen() {
      return (this._time % LIGHT_CYCLE) < LIGHT_GREEN;
    }

    #tick(dt) {
      this._time += dt;
      const { width, height, hasAvenue, avenueAfter } = this.grid;
      const ax = hasAvenue ? MARGIN_X + avenueAfter * CELL_W : -999;
      const green = this.#lightIsGreen();

      // window flicker: resample a couple of windows per building at a slow tick,
      // biased by activity so busy buildings feel lively and stale ones stay dark
      this._flickerAcc += dt * 1000;
      if (this._flickerAcc >= FLICKER_MS) {
        this._flickerAcc = 0;
        for (const e of this.buildings) {
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
          x: dir === 1 ? -6 : width + 6,
          y: 3 + Math.random() * (TOP_SKY - 12),
          dir,
        });
        this._nextPlaneIn = 12 + Math.random() * 20;
      }
      for (const p of this._planes) p.x += p.dir * PLANE_SPEED * dt;
      this._planes = this._planes.filter((p) => p.x > -10 && p.x < width + 10);

      // moving actors
      for (const e of this.entities) {
        const a = this._actors.get(e.id);
        if (!a) continue;
        if (e.kind === 'vehicle' || e.kind === 'responder') {
          if (e.incident === 'crash' || e.incident === 'stalled') {
            // parked where it broke down — no movement while the incident stands
          } else {
            let nx = a.x + a.dir * a.speed * dt;
            // red light: stop at the avenue stop line instead of entering the crossing
            if (hasAvenue && !green) {
              if (a.dir === 1 && a.x + 5 <= ax && nx + 5 > ax - 1) nx = ax - 6;
              if (a.dir === -1 && a.x >= ax + AVENUE_W && nx < ax + AVENUE_W + 1) nx = ax + AVENUE_W + 1;
            }
            a.x = nx;
            if (a.x > width + 6) a.x = -6;
            if (a.x < -6) a.x = width + 6;
          }
        } else if (e.kind === 'walker') {
          if (a.pausedFor > 0) {
            a.pausedFor -= dt;
          } else {
            a.x += a.dir * a.speed * dt;
            a.pauseIn -= dt;
            if (a.pauseIn <= 0) {
              a.pausedFor = 1 + Math.random() * 3;
              a.pauseIn = 3 + Math.random() * 8;
              if (Math.random() < 0.4) a.dir *= -1;
            }
            if (a.x < MARGIN_X) { a.x = MARGIN_X; a.dir = 1; }
            if (a.x > width - MARGIN_X) { a.x = width - MARGIN_X; a.dir = -1; }
          }
        } else if (e.kind === 'sky') {
          a.x += a.dir * BLIMP_SPEED * dt;
          if (a.x > width + 10) a.x = -10;
          if (a.x < -10) a.x = width + 10;
        }
      }

      // chimney smoke from busy buildings; heavier, darker smoke from fires
      if (!this._hiddenKinds.has('building')) {
        for (const b of this.hitboxes) {
          if (b.entity.incident === 'fire' && Math.random() < dt * 2.2 && this._smoke.length < 140) {
            this._smoke.push({ x: b.x + Math.random() * b.w, y: b.y - 1, age: 0, life: 1.2 + Math.random(), heavy: true });
          } else if (!b.entity.incident && b.entity.activity > 0.6 && Math.random() < dt * 0.5 && this._smoke.length < 140) {
            this._smoke.push({ x: b.x + 2 + Math.random() * 2, y: b.y - 1, age: 0, life: 1.8 + Math.random() });
          }
        }
      }
      // smoke from crashed vehicles
      for (const e of this.entities) {
        if (e.incident !== 'crash' || this._hiddenKinds.has(e.kind)) continue;
        const a = this._actors.get(e.id);
        if (a && Math.random() < dt * 3 && this._smoke.length < 140) {
          const baseline = TOP_SKY + a.row * ROW_H + BUILD_ZONE;
          this._smoke.push({ x: a.x + Math.random() * 5, y: baseline - 1, age: 0, life: 0.9 + Math.random() * 0.6, heavy: true });
        }
      }
      for (const s of this._smoke) { s.age += dt; s.y -= (s.heavy ? 3.5 : 2.5) * dt; s.x += Math.sin(this._time * 2 + s.y) * dt; }
      this._smoke = this._smoke.filter((s) => s.age < s.life);

      // rain: particle count tracks weather level, always falling when present
      const targetRain = Math.floor(this._weather * 50);
      while (this._rain.length < targetRain) {
        this._rain.push({ x: Math.random() * width, y: Math.random() * height, speed: 30 + Math.random() * 20 });
      }
      if (this._rain.length > targetRain) this._rain.length = targetRain;
      for (const d of this._rain) {
        d.y += d.speed * dt;
        if (d.y > height) { d.y = -2; d.x = Math.random() * width; }
      }
      // clouds drift regardless of weather so they're already in position when it picks up
      for (const c of this._clouds) {
        c.x -= c.speed * dt;
        if (c.x < -c.w) c.x = width + c.w;
      }

      // fireworks: frequency scales with celebration level
      if (this._celebration > 0) {
        this._nextFireworkIn -= dt;
        if (this._nextFireworkIn <= 0) {
          const rand = Math.random;
          this._fireworks.push({
            x: MARGIN_X + rand() * (width - MARGIN_X * 2),
            y: 6 + rand() * (TOP_SKY + 20),
            age: 0,
            life: 0.9,
            hue: Math.floor(rand() * 360),
          });
          this._nextFireworkIn = 20 - 18 * this._celebration + rand() * 4;
        }
      }
      for (const f of this._fireworks) f.age += dt;
      this._fireworks = this._fireworks.filter((f) => f.age < f.life);

      this.#drawFrame();
    }

    #drawFrame() {
      const ctx = this.bctx;
      const { width, height, cols, rows, avenueAfter, hasAvenue } = this.grid;
      const show = (kind) => !this._hiddenKinds.has(kind);
      this._actorBoxes = [];

      // day/night: dayness 0 (midnight) .. 1 (noon), symmetric so dawn/dusk both land at 0.5
      const tod = this.#currentTimeOfDay();
      const dayness = (Math.cos((tod - 0.5) * 2 * Math.PI) + 1) / 2;
      const goldenHour = clamp01(1 - Math.abs(dayness - 0.5) * 4); // peaks right at dawn/dusk

      // sky backdrop — blends night navy toward a muted day blue
      ctx.fillStyle = mix('#1c2130', '#6fa8c9', dayness);
      ctx.fillRect(0, 0, width, height);
      if (goldenHour > 0.02) {
        ctx.fillStyle = `rgba(255,120,70,${(goldenHour * 0.4).toFixed(2)})`;
        ctx.fillRect(0, 0, width, height);
      }

      // sun/moon — one shared arc formula; the moon uses the same shape 12h out of phase
      const sunProg = clamp01((tod - 0.2) / 0.6);
      const moonProg = clamp01((((tod + 0.5) % 1) - 0.2) / 0.6);
      const arcY = (prog) => 4 + (1 - Math.sin(prog * Math.PI)) * (TOP_SKY - 10);
      if (dayness > 0.03) {
        ctx.fillStyle = `rgba(255,230,150,${dayness.toFixed(2)})`;
        ctx.fillRect(Math.round(sunProg * (width - 8) + 4), Math.round(arcY(sunProg)), 2, 2);
      }
      if (dayness < 0.97) {
        ctx.fillStyle = `rgba(214,222,235,${(1 - dayness).toFixed(2)})`;
        ctx.fillRect(Math.round(moonProg * (width - 8) + 4), Math.round(arcY(moonProg)), 2, 2);
      }

      // stars — slow sine twinkle, dimmed as weather rolls in or the sun's up
      const starDim = (1 - this._weather * 0.7) * (1 - dayness);
      for (const s of this._stars) {
        const tw = (0.35 + 0.65 * Math.abs(Math.sin(this._time / s.period + s.phase))) * starDim;
        ctx.fillStyle = `rgba(220,228,255,${tw.toFixed(2)})`;
        ctx.fillRect(s.x, s.y, 1, 1);
      }

      // clouds — visible once weather picks up
      if (this._weather > 0.05) {
        const cloudAlpha = (0.25 + this._weather * 0.45).toFixed(2);
        ctx.fillStyle = `rgba(60,64,76,${cloudAlpha})`;
        for (const c of this._clouds) {
          ctx.fillRect(Math.round(c.x), Math.round(c.y), c.w, 3);
          ctx.fillRect(Math.round(c.x) + 2, Math.round(c.y) - 1, c.w - 4, 1);
        }
      }

      // rain — short falling streaks, density tracks weather
      if (this._rain.length) {
        ctx.fillStyle = 'rgba(180,200,230,0.45)';
        for (const d of this._rain) {
          ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
        }
      }

      // fireworks — expanding pixel ring with fade
      for (const f of this._fireworks) {
        const t = f.age / f.life;
        const r = 1 + t * 6;
        const alpha = (1 - t).toFixed(2);
        ctx.fillStyle = `hsla(${f.hue},90%,70%,${alpha})`;
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          ctx.fillRect(Math.round(f.x + Math.cos(ang) * r), Math.round(f.y + Math.sin(ang) * r), 1, 1);
        }
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

      // sky actors (blimps)
      if (show('sky')) {
        for (const e of this.entities) {
          if (e.kind !== 'sky') continue;
          const a = this._actors.get(e.id);
          if (!a) continue;
          const bx = Math.round(a.x), by = Math.round(a.y);
          const col = e.color || '#b28ae8';
          ctx.fillStyle = col;
          ctx.fillRect(bx, by, 8, 3);                       // envelope
          ctx.fillRect(bx + (a.dir === 1 ? -1 : 8), by + 1, 1, 1); // nose
          ctx.fillStyle = '#565c6b';
          ctx.fillRect(bx + 3, by + 3, 2, 1);               // gondola
          if (Math.floor(this._time * 2) % 2 === 0) {
            ctx.fillStyle = '#ffd24d';
            ctx.fillRect(bx + (a.dir === 1 ? 7 : 0), by + 1, 1, 1);
          }
          this._actorBoxes.push({ entity: e, x: bx - 1, y: by - 1, w: 10, h: 6 });
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

      // rows: sidewalk + road + lamps + traffic lights
      const green = this.#lightIsGreen();
      for (let r = 0; r < rows; r++) {
        const baseline = TOP_SKY + r * ROW_H + BUILD_ZONE;

        ctx.fillStyle = '#3a4a3a'; // sidewalk / verge
        ctx.fillRect(0, baseline, width, SIDEWALK_H);

        ctx.fillStyle = '#262b36'; // asphalt
        ctx.fillRect(0, baseline + SIDEWALK_H, width, ROAD_H);
        ctx.fillStyle = '#4a5162'; // dashed centerline
        const midY = baseline + SIDEWALK_H + Math.floor(ROAD_H / 2);
        for (let x = 2; x < width; x += 6) ctx.fillRect(x, midY, 3, 1);

        // street lamps at slot boundaries — only worth lighting once it's dim enough to notice
        const lampsUseful = dayness < 0.4;
        for (let c = 0; c <= cols; c++) {
          const lx = MARGIN_X + c * CELL_W + (c > avenueAfter || (c === avenueAfter && c !== 0) ? AVENUE_W : 0) - 1;
          if (lx < 1 || lx > width - 2) continue;
          const lampOn = lampsUseful && Math.random() > 0.005;
          ctx.fillStyle = '#565c6b';
          ctx.fillRect(lx, baseline - 5, 1, 5);
          if (lampOn) {
            ctx.fillStyle = '#ffd98a';
            ctx.fillRect(lx, baseline - 6, 1, 1);
            ctx.fillStyle = 'rgba(255,217,138,0.18)';
            ctx.fillRect(lx - 2, baseline - 6, 5, 3);
          }
        }

        // traffic light where this road crosses the avenue
        if (hasAvenue) {
          const ax = MARGIN_X + avenueAfter * CELL_W;
          ctx.fillStyle = '#565c6b';
          ctx.fillRect(ax - 2, baseline - 4, 1, 4 + SIDEWALK_H);
          ctx.fillStyle = green ? '#5bd67a' : '#e34d4d';
          ctx.fillRect(ax - 2, baseline - 5, 1, 1);
        }
      }

      // smoke — chimney puffs are pale + tiny; fire/crash smoke is dark + thicker
      for (const s of this._smoke) {
        const fade = 1 - s.age / s.life;
        if (s.heavy) {
          ctx.fillStyle = `rgba(60,58,56,${(0.55 * fade).toFixed(2)})`;
          ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
        } else {
          ctx.fillStyle = `rgba(200,204,216,${(0.35 * fade).toFixed(2)})`;
          ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        }
      }

      // buildings
      if (show('building')) {
        for (const b of this.hitboxes) this.#drawBuilding(ctx, b);
      }

      // walkers on sidewalks
      if (show('walker')) {
        for (const e of this.entities) {
          if (e.kind !== 'walker') continue;
          const a = this._actors.get(e.id);
          if (!a) continue;
          const baseline = TOP_SKY + a.row * ROW_H + BUILD_ZONE;
          const wx = Math.round(a.x), wy = baseline - 3;
          const col = e.color || '#d8c9a8';
          ctx.fillStyle = col;
          ctx.fillRect(wx, wy + 1, 1, 2);         // body
          ctx.fillStyle = '#e8d5c0';
          ctx.fillRect(wx, wy, 1, 1);             // head
          // simple 2-frame stride while moving
          if (a.pausedFor <= 0 && Math.floor(this._time * 4) % 2 === 0) {
            ctx.fillStyle = col;
            ctx.fillRect(wx + (a.dir === 1 ? 1 : -1), wy + 2, 1, 1);
          }
          this._actorBoxes.push({ entity: e, x: wx - 1, y: wy - 1, w: 3, h: 5 });
        }
      }

      // vehicles + responders on roads (separately toggleable kinds)
      {
        for (const e of this.entities) {
          if (e.kind !== 'vehicle' && e.kind !== 'responder') continue;
          if (!show(e.kind)) continue;
          const a = this._actors.get(e.id);
          if (!a) continue;
          const baseline = TOP_SKY + a.row * ROW_H + BUILD_ZONE;
          const laneY = baseline + SIDEWALK_H + (a.lane === 0 ? 1 : ROAD_H - 4);
          const vx = Math.round(a.x);
          const isResponder = e.kind === 'responder';
          const col = isResponder ? '#e8ecf5' : (e.color || CATEGORY_COLORS[e.category] || CATEGORY_COLORS.default);

          ctx.fillStyle = col;
          ctx.fillRect(vx, laneY + 1, 5, 2);                    // body
          ctx.fillRect(vx + 1, laneY, 3, 1);                    // cabin
          ctx.fillStyle = '#10131c';
          ctx.fillRect(vx + 1, laneY + 3, 1, 1);                // wheels
          ctx.fillRect(vx + 3, laneY + 3, 1, 1);
          ctx.fillStyle = '#ffe07a';
          ctx.fillRect(vx + (a.dir === 1 ? 4 : 0), laneY + 1, 1, 1); // headlight

          if (isResponder) {
            // flashing red/blue light bar — always alert, that's the point of a responder
            ctx.fillStyle = Math.floor(this._time * 4) % 2 === 0 ? '#ff5b5b' : '#5b8cff';
            ctx.fillRect(vx + 2, laneY - 1, 1, 1);
          } else if (e.incident === 'stalled') {
            // hazard blinkers at both ends
            if (Math.floor(this._time * 3) % 2 === 0) {
              ctx.fillStyle = '#ffb84d';
              ctx.fillRect(vx, laneY + 1, 1, 1);
              ctx.fillRect(vx + 4, laneY + 1, 1, 1);
            }
          } else if (e.incident === 'crash') {
            // tilted wreck + warning triangle
            ctx.fillStyle = '#ffb84d';
            ctx.fillRect(vx + 2, laneY - 2, 1, 1); // warning marker above
            ctx.fillStyle = '#3a1f1f';
            ctx.fillRect(vx + 1, laneY + 1, 3, 1); // scorch mark
          }

          this._actorBoxes.push({ entity: e, x: vx - 1, y: laneY - 2, w: 7, h: 7 });
        }
      }

      // hover highlight — white outline around whatever the cursor is on
      if (this._hoveredId) {
        const box = this.#boxById(this._hoveredId);
        if (box) {
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(box.x - 1.5, box.y - 1.5, box.w + 3, box.h + 3);
        }
      }

      // blit to screen at scale, then labels in screen space
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
      this.#drawLabels();
    }

    #drawBuilding(ctx, b) {
      const e = b.entity;
      const { x, y, w, h } = b;
      const base = e.color || CATEGORY_COLORS[e.category] || CATEGORY_COLORS.default;

      ctx.fillStyle = e.staleness > 0.5 ? mix(base.startsWith('#') ? base : '#7a86a3', '#6b6f76', (e.staleness - 0.5) * 2) : base;
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

      if (e.incident === 'fire') {
        // flickering flame pixels along the top of the building, replacing badges/flag visually
        const rand = seedFrom(e.id + '-fire-' + Math.floor(this._time * 6));
        const flameCols = ['#ffb84d', '#ff5b3d', '#ffe07a'];
        for (let i = 0; i < Math.max(2, Math.floor(w / 3)); i++) {
          if (rand() < 0.7) {
            ctx.fillStyle = flameCols[Math.floor(rand() * flameCols.length)];
            ctx.fillRect(x + 1 + i * 3, y - 1 - Math.floor(rand() * 2), 2, 2);
          }
        }
      } else if (e.incident === 'crane') {
        // simple construction crane on the roof: mast + swaying arm
        const sway = Math.sin(this._time * 0.8) * 2;
        ctx.fillStyle = '#d9d9d9';
        ctx.fillRect(x + w - 2, y - 9, 1, 9);                          // mast
        ctx.fillRect(x + w - 2, y - 9, Math.max(1, Math.round(4 + sway)), 1); // arm
      }
    }

    #drawLabels() {
      const ctx = this.ctx;
      ctx.textAlign = 'center';
      ctx.font = '9px monospace';
      ctx.fillStyle = '#c9cfdb';
      const maxWidth = (CELL_W - 2) * this.scale;
      if (!this._hiddenKinds.has('building')) {
        for (const b of this.hitboxes) {
          const cx = (b.x + b.w / 2) * this.scale;
          const ly = (b.baseline + SIDEWALK_H + ROAD_H - 2) * this.scale;
          ctx.fillText(truncate(ctx, b.entity.name, maxWidth), cx, ly);
        }
      }
      // district names, top-left of each district's first row
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.max(10, this.scale * 2)}px monospace`;
      ctx.fillStyle = 'rgba(201,207,219,0.5)';
      for (const d of this._districtLabels || []) {
        const y = (TOP_SKY + d.row * ROW_H + 6) * this.scale;
        ctx.fillText(d.name.toUpperCase(), MARGIN_X * this.scale, y);
      }
    }

    /** Current buffer-space box for an entity id (moving actors included), or null. */
    #boxById(id) {
      return this._actorBoxes.find((b) => b.entity.id === id) ||
             this.hitboxes.find((b) => b.entity.id === id && !this._hiddenKinds.has('building')) || null;
    }

    /** Box (buffer space) at the given canvas-pixel point, or null. Moving actors win over buildings. */
    boxAt(canvasX, canvasY) {
      const bx = canvasX / this.scale;
      const by = canvasY / this.scale;
      const inBox = (b) => bx >= b.x && bx < b.x + b.w && by >= b.y && by < b.y + b.h;
      const actor = this._actorBoxes.find(inBox);
      if (actor) return actor;
      if (this._hiddenKinds.has('building')) return null;
      return this.hitboxes.find(inBox) || null;
    }

    /** Entity at the given canvas-pixel point, or null. */
    entityAt(canvasX, canvasY) {
      const box = this.boxAt(canvasX, canvasY);
      return box ? box.entity : null;
    }

    /**
     * Wires click + hover on the canvas. The engine only reports which entity was hit
     * (plus its current buffer-space box, so hosts can anchor popovers) — what happens
     * next is the host's job. Hovered entities get a white outline drawn by the engine.
     * @param {{onClick?: (entity, box) => void, onHover?: (entity|null, box|null) => void}} handlers
     */
    enableInteraction(handlers = {}) {
      const toLocal = (ev) => {
        const rect = this.canvas.getBoundingClientRect();
        // account for CSS scaling of the canvas element, if any
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
        if (!this._raf) this.#drawFrame(); // show/clear the outline even when static
        if (handlers.onHover) handlers.onHover(box ? box.entity : null, box);
      });
      this.canvas.addEventListener('mouseleave', () => {
        this.canvas.style.cursor = 'default';
        this._hoveredId = null;
        if (!this._raf) this.#drawFrame();
        if (handlers.onHover) handlers.onHover(null, null);
      });
      return this;
    }
  }

  return { createEntity, Town, CATEGORY_COLORS, LAYOUT };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MachiHub;
