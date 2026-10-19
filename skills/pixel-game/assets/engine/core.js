/* Pixel Game engine · core: the namespace every script shares (window.R), the logical screen, seeded
   RNG, maths, storage, canvases, colour helpers, small drawing helpers and the two pixel fonts. */
(function () {
  'use strict';
  const R = (window.R = window.R || {});

  // Logical screen. 9:16, and five times this is exactly 1080 × 1920.
  R.W = 216;
  R.H = 384;

  // ---------- maths ----------
  R.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  R.lerp = (a, b, t) => a + (b - a) * t;
  R.approach = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);
  R.easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
  R.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  R.easeBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  R.DEG = Math.PI / 180;

  // mulberry32: small, fast and deterministic, so a run replays exactly from its seed.
  R.rng = function (seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    return next;
  };
  // Cosmetic randomness that never touches the simulation.
  R.fx = R.rng((Date.now() ^ 0x5eed) >>> 0);
  // A fresh seed for a run or a round. Tests and demo videos can queue their own in R.seeds.
  R.seeds = [];
  R.nextSeed = () => (R.seeds.length ? R.seeds.shift() >>> 0 : (Math.random() * 4294967296) >>> 0);

  // ---------- storage (every access may throw: private windows, previews) ----------
  // Pages on one site share storage, so each game sets its own namespace: R.store.ns = '<project>:<game>:'.
  R.store = {
    ns: 'pixel-game:',
    get(k, d) {
      try {
        const v = localStorage.getItem(this.ns + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(this.ns + k, JSON.stringify(v));
      } catch (e) {
        /* storage unavailable: the game still runs */
      }
    },
  };

  // ---------- canvases ----------
  R.canvas = function (w, h, readback) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const x = c.getContext('2d', readback ? { willReadFrequently: true } : undefined);
    x.imageSmoothingEnabled = false;
    return { c, x, w: c.width, h: c.height };
  };

  // ---------- colour ----------
  R.hex = function (h) {
    const n = parseInt(h.slice(1), 16);
    return h.length === 4
      ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]
      : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  R.rgb = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  R.mix = function (h1, h2, t) {
    const a = typeof h1 === 'string' ? R.hex(h1) : h1;
    const b = typeof h2 === 'string' ? R.hex(h2) : h2;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  R.mixHex = function (h1, h2, t) {
    const c = R.mix(h1, h2, t);
    return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  };

  // ---------- drawing helpers ----------
  // Per-row colour bands, crisp at low resolution. stops: [[t, '#hex'], ...] from 0 to 1.
  R.vgrad = function (x, y0, y1, stops, cx, cw) {
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0 - 1);
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const a = stops[i];
      const b = stops[i + 1];
      const u = R.clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
      x.fillStyle = R.rgb(R.mix(a[1], b[1], u));
      x.fillRect(cx || 0, y, cw || R.W, 1);
    }
  };
  // A filled pixel disc.
  R.disc = function (x, cx, cy, r, col) {
    x.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const hw = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
      x.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  };
  // A soft radial light, for the glow buffer mostly.
  R.softGlow = function (x, cx, cy, r, col, a) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, R.rgb(R.hex(col), a));
    g.addColorStop(1, R.rgb(R.hex(col), 0));
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  // A pixel-exact scanline polygon fill: crisp edges, no anti-aliasing. pts: [[x, y], ...].
  R.poly = function (x, pts, col) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    x.fillStyle = col;
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]);
        const b = Math.round(xs[i + 1]);
        if (b > a) x.fillRect(a, y, b - a, 1);
      }
    }
  };
  // A 1 px outline around everything opaque in a canvas (4-neighbours), padding it by 1 on every
  // side. Returns a new canvas.
  R.outlined = function (src, col) {
    const w = src.width + 2;
    const h = src.height + 2;
    const out = R.canvas(w, h, true);
    out.x.drawImage(src, 1, 1);
    const d = out.x.getImageData(0, 0, w, h);
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d.data[(y * w + x) * 4 + 3]);
    const rgb = R.hex(col);
    const edge = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) edge.push(x, y);
    for (let i = 0; i < edge.length; i += 2) {
      const o = (edge[i + 1] * w + edge[i]) * 4;
      d.data[o] = rgb[0];
      d.data[o + 1] = rgb[1];
      d.data[o + 2] = rgb[2];
      d.data[o + 3] = 255;
    }
    out.x.putImageData(d, 0, 0);
    return out.c;
  };
  // Pixel art from rows of characters: rows ['.ab.', ...], pal { a: '#hex', ..., glow: 'ab' }.
  // Returns { c, g, w, h }: the sprite and its emissive twin (the characters listed in pal.glow).
  R.sprite = function (rows, pal) {
    const h = rows.length;
    const w = rows[0].length;
    const c = R.canvas(w, h);
    const g = R.canvas(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        c.x.fillStyle = col;
        c.x.fillRect(x, y, 1, 1);
        if (pal.glow && pal.glow.includes(ch)) {
          g.x.fillStyle = col;
          g.x.fillRect(x, y, 1, 1);
        }
      }
    return { c: c.c, g: g.c, w, h };
  };

  // ---------- pixel fonts ----------
  // Big: 5×7 (digits fixed-width so the score never jitters). Small: 3×5.
  const BIG = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
    B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.',
    D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####',
    F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
    H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '###|.#.|.#.|.#.|.#.|.#.|###',
    J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
    L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
    N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
    P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
    R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.',
    T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
    V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
    X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
    Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
    1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
    3: '####.|....#|....#|.###.|....#|....#|####.',
    4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
    5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '.###.|#....|#....|####.|#...#|#...#|.###.',
    7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
    8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
    9: '.###.|#...#|#...#|.####|....#|....#|.###.',
    '.': '.|.|.|.|.|.|#',
    ',': '..|..|..|..|..|.#|#.',
    '!': '#|#|#|#|#|.|#',
    '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
    ':': '.|#|.|.|.|#|.',
    ';': '..|.#|..|..|..|.#|#.',
    '-': '....|....|....|####|....|....|....',
    '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
    '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
    '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
    "'": '#|#|.|.|.|.|.',
    '"': '#.#|#.#|...|...|...|...|...',
    '(': '.#|#.|#.|#.|#.|#.|.#',
    ')': '#.|.#|.#|.#|.#|.#|#.',
    '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
    '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
    $: '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
    '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
    '=': '.....|.....|#####|.....|#####|.....|.....',
    '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
    '>': '#...|.#..|..#.|...#|..#.|.#..|#...',
    _: '.....|.....|.....|.....|.....|.....|#####',
    '×': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
    '·': '.|.|.|#|.|.|.',
    '–': '.....|.....|.....|#####|.....|.....|.....',
    '™': '###.#...#|.#..##.##|.#..#.#.#|.........|.........|.........|.........',
    '▶': '#...|##..|###.|####|###.|##..|#...',
    '◀': '...#|..##|.###|####|.###|..##|...#',
    '⚡': '...##|..##.|.##..|#####|..##.|.##..|##...',
    '●': '.....|.###.|#####|#####|#####|.###.|.....',
    '★': '..#..|..#..|#####|.###.|.#.#.|#...#|.....',
    '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|..#..',
    '↓': '..#..|..#..|..#..|..#..|#.#.#|.###.|..#..',
    '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.',
  };
  const SMALL = {
    A: '.#.|#.#|###|#.#|#.#',
    B: '##.|#.#|##.|#.#|##.',
    C: '.##|#..|#..|#..|.##',
    D: '##.|#.#|#.#|#.#|##.',
    E: '###|#..|##.|#..|###',
    F: '###|#..|##.|#..|#..',
    G: '.##|#..|#.#|#.#|.##',
    H: '#.#|#.#|###|#.#|#.#',
    I: '###|.#.|.#.|.#.|###',
    J: '..#|..#|..#|#.#|.#.',
    K: '#.#|#.#|##.|#.#|#.#',
    L: '#..|#..|#..|#..|###',
    M: '#...#|##.##|#.#.#|#...#|#...#',
    N: '#..#|##.#|#.##|#..#|#..#',
    O: '.#.|#.#|#.#|#.#|.#.',
    P: '##.|#.#|##.|#..|#..',
    Q: '.#.|#.#|#.#|##.|.##',
    R: '##.|#.#|##.|#.#|#.#',
    S: '.##|#..|.#.|..#|##.',
    T: '###|.#.|.#.|.#.|.#.',
    U: '#.#|#.#|#.#|#.#|###',
    V: '#.#|#.#|#.#|#.#|.#.',
    W: '#...#|#...#|#.#.#|##.##|#...#',
    X: '#.#|#.#|.#.|#.#|#.#',
    Y: '#.#|#.#|.#.|.#.|.#.',
    Z: '###|..#|.#.|#..|###',
    0: '###|#.#|#.#|#.#|###',
    1: '.#.|##.|.#.|.#.|###',
    2: '##.|..#|.#.|#..|###',
    3: '##.|..#|.#.|..#|##.',
    4: '#.#|#.#|###|..#|..#',
    5: '###|#..|##.|..#|##.',
    6: '.##|#..|###|#.#|###',
    7: '###|..#|.#.|.#.|.#.',
    8: '###|#.#|###|#.#|###',
    9: '###|#.#|###|..#|##.',
    '.': '.|.|.|.|#',
    ',': '.|.|.|#|#',
    '!': '#|#|#|.|#',
    '?': '##.|..#|.#.|...|.#.',
    ':': '.|#|.|#|.',
    '-': '...|...|###|...|...',
    '–': '...|...|###|...|...',
    '+': '...|.#.|###|.#.|...',
    '/': '..#|..#|.#.|#..|#..',
    "'": '#|#|.|.|.',
    '"': '#.#|#.#|...|...|...',
    '(': '.#|#.|#.|#.|.#',
    ')': '#.|.#|.#|.#|#.',
    '%': '#.#|..#|.#.|#..|#.#',
    $: '.##|##.|.#.|.##|##.',
    '#': '#.#|###|#.#|###|#.#',
    '*': '...|#.#|.#.|#.#|...',
    '=': '...|###|...|###|...',
    '<': '..#|.#.|#..|.#.|..#',
    '>': '#..|.#.|..#|.#.|#..',
    '&': '.#.|#.#|.#.|#.#|.##',
    _: '...|...|...|...|###',
    '·': '.|.|#|.|.',
    '×': '...|#.#|.#.|#.#|...',
    '™': '###.#.#|.#.#.#.|.#.#.#.|.......|.......',
    '▶': '#..|##.|###|##.|#..',
    '◀': '..#|.##|###|.##|..#',
    '⚡': '..#|.#.|###|.#.|#..',
    '●': '.#.|###|###|.#.|...',
    '★': '.#.|###|.#.|#.#|...',
    '↑': '.#.|###|.#.|.#.|.#.',
    '↓': '.#.|.#.|.#.|###|.#.',
    '@': '.###.|#..##|#.#.#|#..##|.##..',
  };

  function compile(table, h, space, gap) {
    const glyphs = {};
    for (const k in table) {
      const rows = table[k].split('|');
      glyphs[k] = { rows, w: rows[0].length };
    }
    glyphs[' '] = { rows: new Array(h).fill('.'.repeat(space)), w: space };
    return {
      h,
      gap,
      get(ch) {
        return glyphs[ch] || glyphs[ch.toUpperCase()] || glyphs['?'];
      },
    };
  }
  R.FONTS = { big: compile(BIG, 7, 3, 1), small: compile(SMALL, 5, 2, 1) };

  R.measure = function (str, o) {
    const f = R.FONTS[(o && o.font) || 'big'];
    let w = 0;
    for (const ch of String(str)) w += f.get(ch).w + f.gap;
    return Math.max(0, w - f.gap) * ((o && o.scale) || 1);
  };

  // Rendered strings are cached as small canvases; scores and labels repeat constantly.
  const cache = new Map();
  const CACHE_MAX = 600;
  function render(str, o) {
    const key = [str, o.font, o.color, o.outline, o.shadow, o.italic ? 1 : 0, o.gradient ? o.gradient.join() : '', o.scale].join('\u0001');
    let hit = cache.get(key);
    if (hit) return hit;
    const f = R.FONTS[o.font || 'big'];
    const s = o.scale || 1;
    const px = [];
    let w = 0;
    const shear = o.italic && (o.scale || 1) >= 2; // big type is sheared after scaling
    const slant = o.italic && !shear ? Math.ceil((f.h - 1) / 2) : 0;
    for (const ch of String(str)) {
      const g = f.get(ch);
      for (let ry = 0; ry < f.h; ry++) {
        const row = g.rows[ry] || '';
        const off = o.italic && !shear ? Math.floor((f.h - 1 - ry) / 2) : 0;
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') px.push(w + rx + off, ry);
      }
      w += g.w + f.gap;
    }
    w = Math.max(0, w - f.gap) + slant;
    const pad = o.outline ? 1 : 0;
    const sh = o.shadow ? 1 : 0;
    const cv = R.canvas((w + pad * 2 + sh) * s || 1, (f.h + pad * 2 + sh) * s);
    const x = cv.x;
    const put = (dx, dy, col) => {
      x.fillStyle = col;
      for (let i = 0; i < px.length; i += 2) x.fillRect((px[i] + dx) * s, (px[i + 1] + dy) * s, s, s);
    };
    if (o.shadow) put(pad + 1, pad + 1, o.shadow);
    if (o.outline) {
      put(pad - 1, pad, o.outline);
      put(pad + 1, pad, o.outline);
      put(pad, pad - 1, o.outline);
      put(pad, pad + 1, o.outline);
      put(pad - 1, pad - 1, o.outline);
      put(pad + 1, pad - 1, o.outline);
      put(pad - 1, pad + 1, o.outline);
      put(pad + 1, pad + 1, o.outline);
    }
    if (o.gradient) {
      for (let i = 0; i < px.length; i += 2) {
        x.fillStyle = o.gradient[Math.min(o.gradient.length - 1, px[i + 1])];
        x.fillRect((px[i] + pad) * s, (px[i + 1] + pad) * s, s, s);
      }
    } else put(pad, pad, o.color || '#fff');
    let out = cv.c;
    let extra = 0;
    if (shear) {
      // Lean the finished bitmap row by row: a smooth slant instead of broken strokes.
      const slope = 0.24;
      extra = Math.ceil(cv.h * slope);
      const sh = R.canvas(cv.w + extra, cv.h);
      for (let y = 0; y < cv.h; y++) sh.x.drawImage(cv.c, 0, y, cv.w, 1, Math.round((cv.h - 1 - y) * slope), y, cv.w, 1);
      out = sh.c;
    }
    hit = { c: out, w: w * s + extra, h: f.h * s, pad: pad * s };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, hit);
    return hit;
  }

  // Draw text with its top-left (or top-centre / top-right) at x, y. Returns the drawn width.
  R.text = function (ctx, str, x, y, o) {
    o = o || {};
    const r = render(String(str), o);
    let dx = x - r.pad;
    if (o.align === 'center') dx = x - Math.round(r.w / 2) - r.pad;
    else if (o.align === 'right') dx = x - r.w - r.pad;
    let dy = y - r.pad;
    if (o.valign === 'middle') dy = y - Math.round(r.h / 2) - r.pad;
    if (o.alpha != null && o.alpha < 1) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * o.alpha;
      ctx.drawImage(r.c, Math.round(dx), Math.round(dy));
      ctx.globalAlpha = a;
    } else ctx.drawImage(r.c, Math.round(dx), Math.round(dy));
    return r.w;
  };
  R.textCanvas = (str, o) => render(String(str), o || {});

  // Greedy word wrap in logical pixels.
  R.wrap = function (str, maxW, o) {
    const words = String(str).split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (R.measure(t, o) <= maxW || !line) line = t;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
})();
