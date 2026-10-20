/*
 * Bobine engine.
 *
 * A reel is a list of scenes laid end to end on a beat grid. Every frame is a pure function
 * of its number: the player can seek anywhere, the recorder can render frames in any order,
 * and frame N is frame 0 again, so the reel loops. The engine owns the clock, the canvas,
 * the background, the HUD frame, the transitions between scenes and the toolkit scenes draw
 * with (g). Scenes live in engine/scenes/, one technique each, registered with Reel.scene().
 *
 *   Reel.scene(type, { label, bg, beats, params, prepare(s, g), draw(g, s, t) })
 *   Reel.make(spec)        a reel: { name, brand, edition, bpm, fps, size, palette, scenes: [...] }
 *   Reel.mount(canvas)     draw into this canvas; resolves Reel.ready
 *   Reel.draw(frame)       render one frame
 *   Reel.info()            frames, fps, bpm, beats, bars, seconds and the scene list
 *   Reel.paintAt(f, ctx)   another moment of the reel, drawn into ctx (a rewind uses it)
 *
 * A reel also takes: fonts ({ display, serif, mono }: a family, or { family, weight, stretch }),
 * hud (true, false, "minimal", or { right, readout, left, beats, vars, meter }: see the HUD),
 * energy (0 off … 1 bold … 2 wild: shake, punch, flash and colour split on every hit, a pulse on
 * the beat), pulse (the beat pulse, × energy), grain (0..1 film grain) and slow.
 * Every scene also takes: in / out (a transition: engine/transitions.js, or smear / iris / wipe),
 * warp (its time remapped: reverse, boomerang, snap, rush, hold, stutter, or [[x, y], …] knots;
 * a knot list can also play just part of a scene), ground (a painted ground over bg: { gradient }
 * or { radial }), hits (beats where it hits, for energy), energy, grain, slow, samples, shutter.
 */
(function () {
  "use strict";
  const Reel = (window.Reel = window.Reel || {});
  const DEFS = (Reel.defs = {});
  Reel.scene = (type, def) => { DEFS[type] = Object.assign({ type, label: type.toUpperCase(), bg: "paper", beats: 2, params: {} }, def); };

  /* ---------------------------------------------------------------- maths */

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const smoothstep = (a, b, x) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const mod = (x, n) => ((x % n) + n) % n;

  const pow = (k) => [(t) => t ** k, (t) => 1 - (1 - t) ** k, (t) => (t < 0.5 ? 2 ** (k - 1) * t ** k : 1 - (-2 * t + 2) ** k / 2)];
  const [inQuad, outQuad, inOutQuad] = pow(2), [inCubic, outCubic, inOutCubic] = pow(3);
  const [inQuart, outQuart, inOutQuart] = pow(4), [inQuint, outQuint, inOutQuint] = pow(5);
  const ease = {
    linear: (t) => t, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inQuart, outQuart, inOutQuart, inQuint, outQuint, inOutQuint,
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
    outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
    inBack: (t, s = 1.70158) => (s + 1) * t ** 3 - s * t * t,
    inOutBack: (t, s = 2.5949) => (t < 0.5 ? ((2 * t) ** 2 * ((s + 1) * 2 * t - s)) / 2 : ((2 * t - 2) ** 2 * ((s + 1) * (t * 2 - 2) + s) + 2) / 2),
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1),
    /* step response of a damped spring, sec seconds after release: 0 → 1 with overshoot */
    spring: (sec, hz = 5, zeta = 0.35) => {
      if (sec <= 0) return 0;
      const w = TAU * hz, z = Math.min(zeta, 0.999), wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * sec) * (Math.cos(wd * sec) + ((z * w) / wd) * Math.sin(wd * sec));
    },
  };

  /* seeded randomness: rng(seed)() streams, hash(...) is stateless */
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = (seed = 1) => {
    let a = (typeof seed === "string" ? hashStr(seed) : seed) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const hash = (...n) => { let h = 0x9e3779b9; for (const v of n) h = Math.imul(h ^ (Math.floor(v * 1000) | 0), 0x85ebca6b) ^ (h >>> 13); h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /* 3D simplex noise (Gustavson), seeded; noise3(x, y, z) in about -1..1 */
  const makeNoise = (seed = 7) => {
    const r = rng(seed), p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const G = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
    const F3 = 1 / 3, G3 = 1 / 6;
    return (x, y, z) => {
      const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3, x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) { if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0]; else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1]; else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1]; }
      else { if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1]; else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1]; else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0]; }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 0.5, y3 = y0 - 1 + 0.5, z3 = z0 - 1 + 0.5, ii = i & 255, jj = j & 255, kk = k & 255;
      const c = (gi, X, Y, Z) => { const t0 = 0.6 - X * X - Y * Y - Z * Z; if (t0 < 0) return 0; const q = t0 * t0; return q * q * (G[gi * 3] * X + G[gi * 3 + 1] * Y + G[gi * 3 + 2] * Z); };
      return 32 * (c(pm12[ii + perm[jj + perm[kk]]], x0, y0, z0) + c(pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1) + c(pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2) + c(pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3));
    };
  };

  /* ---------------------------------------------------------------- colour */

  const hex = (c) => { c = c.replace("#", ""); if (c.length === 3) c = [...c].map((x) => x + x).join(""); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); };
  const rgba = (c, a = 1) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const luma = (c) => { const [r, g, b] = hex(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  /* Palettes are roles, not colours: scenes ask for ink, paper, accent, cool, sun, blush, deep, sky. */
  /* ink and paper are the type; accent is the dot and the hottest ground; cool a saturated dark ground;
     sun and blush light bright ones; deep a near-black tint; sky a pale one. */
  const PALETTES = (Reel.palettes = {
    studio: { ink: "#0E0B11", paper: "#EAE6DC", accent: "#E96536", cool: "#3C2CE9", sun: "#EFC84B", blush: "#EBABBF", deep: "#0A1225", sky: "#BACFEF" },
    tide: { ink: "#06131F", paper: "#E9EEF0", accent: "#FF5B3A", cool: "#0B5FD6", sun: "#FFD25E", blush: "#FFC2B0", deep: "#0A2236", sky: "#BFE2F2" },
    matcha: { ink: "#10140F", paper: "#ECEADF", accent: "#2E8B4B", cool: "#134E4A", sun: "#E4C65B", blush: "#F1C7B5", deep: "#0F1F1A", sky: "#CFE3D3" },
    citrus: { ink: "#1A1712", paper: "#F7F0E1", accent: "#FF6A00", cool: "#00796B", sun: "#FFD23F", blush: "#FFC4CF", deep: "#12302B", sky: "#CFEDE6" },
    clay: { ink: "#1C1612", paper: "#EFE6D8", accent: "#C2552D", cool: "#2F4A6B", sun: "#E2B54F", blush: "#E9C1AE", deep: "#241A16", sky: "#CDD8DF" },
    neon: { ink: "#0A0712", paper: "#F2EEFA", accent: "#FF2E7E", cool: "#4B1FE8", sun: "#D9FF3D", blush: "#FFB3D1", deep: "#140B2E", sky: "#CFC8FF" },
    noir: { ink: "#0B0B0B", paper: "#F1EFEA", accent: "#E0262D", cool: "#26262B", sun: "#D9D3C5", blush: "#E8C4BF", deep: "#151517", sky: "#D8D9DB" },
    /* a lab: black and white with one acid lime */
    lab: { ink: "#0A0A0B", paper: "#EDEDE8", accent: "#C8FF00", cool: "#17181B", sun: "#DADAD3", blush: "#8E8E88", deep: "#050506", sky: "#C9CBC4" },
    /* the void: violet-black, hot pink and gold */
    void: { ink: "#0B0614", paper: "#F3EEFF", accent: "#FF2D8A", cool: "#3A12A8", sun: "#FFC23D", blush: "#FF8FC6", deep: "#07030F", sky: "#B9A8FF" },
    /* the earth: sand, deep teal and vermilion */
    earth: { ink: "#15110E", paper: "#F2E8D8", accent: "#E2401C", cool: "#12585E", sun: "#F0A92E", blush: "#E7A188", deep: "#0D0A08", sky: "#CFE1DD" },
  });

  /* ---------------------------------------------------------------- the toolkit scenes draw with */

  const FAMILY = { display: '"Montserrat", sans-serif', serif: '"Instrument Serif", serif', mono: '"JetBrains Mono", monospace' };
  const WEIGHT = { display: 900, serif: 400, mono: 500 };
  /*
   * The reel's type: fonts: { display, serif, mono }, each a family name or { family, weight,
   * stretch }. stretch is a CSS width keyword (ultra-condensed … ultra-expanded) for a font with a
   * width axis (Archivo: extra-condensed 62.5 % to expanded 125 %).
   */
  const STACK = { display: "sans-serif", serif: "serif", mono: "monospace" };
  const typeOf = (fonts = {}) => {
    const out = {};
    for (const kind of ["display", "serif", "mono"]) {
      const f = typeof fonts[kind] === "string" ? { family: fonts[kind] } : fonts[kind] || {};
      out[kind] = { family: f.family ? `"${f.family}", ${STACK[kind]}` : FAMILY[kind], weight: f.weight ?? WEIGHT[kind], stretch: f.stretch || "" };
    }
    return out;
  };

  function toolkit(R, canvas) {
    const g = {
      R, canvas, ctx: canvas.getContext("2d"), W: R.w, H: R.h, scale: R.scale,
      TAU, clamp, lerp, seg, smoothstep, fract, mod, ease, rng, hash, noise3: makeNoise(R.seed), makeNoise,
      hex, toHex, mix, rgba, luma,
    };
    const c = (g.c = Object.assign({}, typeof R.palette === "string" ? PALETTES[R.palette] || PALETTES.studio : Object.assign({}, PALETTES.studio, R.palette)));
    /* a colour by role or as written; on(bg) is the ink that reads on it */
    g.col = (x) => (x && c[x]) || x || c.ink;
    g.on = (bg) => { const L = luma(g.col(bg)), k = (L + 0.05) / (luma(c.ink) + 0.05), p = (luma(c.paper) + 0.05) / (L + 0.05); return k >= p ? c.ink : c.paper; };

    /* the HUD box: the safe area inside the corner brackets. On 9:16 it clears the reel UI. */
    const tall = R.h / R.w > 1.5;
    const mx = R.w * 0.0431, top = tall ? R.h * 0.1086 : R.h * 0.06, bot = tall ? R.h * 0.1557 : R.h * 0.06;
    g.box = { x: mx, y: top, w: R.w - 2 * mx, h: R.h - top - bot, cx: R.w / 2, cy: top + (R.h - top - bot) / 2 };
    g.box.r = g.box.x + g.box.w; g.box.b = g.box.y + g.box.h;
    /* the stage: the box less the HUD's own text rows, where scenes put their subject */
    g.stage = { x: g.box.x + 28, y: g.box.y + 60, w: g.box.w - 56, h: g.box.h - 120 };
    g.stage.cx = g.stage.x + g.stage.w / 2; g.stage.cy = g.stage.y + g.stage.h / 2; g.stage.min = Math.min(g.stage.w, g.stage.h);

    /* type: a kind (display, serif, mono) in the reel's fonts, or a family name as written */
    const TYPE = (g.type = typeOf(R.fonts));
    g.font = (kind = "display", size = 48, weight, style = "normal") => {
      const T = TYPE[kind];
      return T ? `${style} ${weight ?? T.weight} ${T.stretch ? T.stretch + " " : ""}${size}px ${T.family}` : `${style} ${weight ?? 400} ${size}px ${kind}`;
    };
    /* labels never go below the reel's minText (20 px by default), so they read on a phone; text
       measured and drawn through here gets the same size, so layouts stay consistent */
    const MIN = R.minText ?? 20;
    /* how much a line set at size grows under that floor: multiply its line spacing by it */
    g.minText = MIN;
    g.grow = (size) => (MIN && size < MIN ? MIN / size : 1);
    const setText = (ctx, o) => {
      ctx.font = g.font(o.kind || "display", Math.max(MIN, o.size || 48), o.weight, o.style);
      ctx.letterSpacing = (o.track || 0) + "px";
      ctx.textBaseline = o.base || "alphabetic";
      ctx.textAlign = "left";
    };
    /* width of a string, without the trailing letter-space */
    g.measure = (str, o = {}, ctx = g.ctx) => { ctx.save(); setText(ctx, o); const w = ctx.measureText(str).width - (o.track || 0); ctx.restore(); return w; };
    /* the largest size up to o.size at which str fits maxW */
    g.fit = (str, o, maxW, min = 8) => {
      const w = g.measure(str, Object.assign({}, o, { track: 0 })) + (o.track || 0) * Math.max(0, [...str].length - 1);
      const size = Math.min(o.size, (o.size * maxW) / Math.max(1, w));
      if (size < min) Reel.warn(`"${str}" does not fit ${Math.round(maxW)}px even at ${min}px`);
      return Math.max(min, size);
    };
    /* g.text(str, x, y, { kind, size, weight, style, track, align, base, color, alpha, stroke, fit }) → width */
    g.text = (str, x, y, o = {}, ctx = g.ctx) => {
      str = String(str);
      if (o.fit) o = Object.assign({}, o, { size: g.fit(str, o, o.fit) });
      ctx.save();
      setText(ctx, o);
      const w = ctx.measureText(str).width - (o.track || 0);
      const dx = o.align === "center" ? -w / 2 : o.align === "right" ? -w : 0;
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      if (o.stroke) { ctx.lineWidth = o.stroke; ctx.lineJoin = "round"; ctx.strokeStyle = g.col(o.color); ctx.strokeText(str, x + dx, y); }
      else { ctx.fillStyle = g.col(o.color); ctx.fillText(str, x + dx, y); }
      ctx.restore();
      return w;
    };
    /* per-letter layout with kerning: [{ ch, x, w }] from the left edge */
    const graphemes = (str) => (typeof Intl !== "undefined" && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(str)].map((x) => x.segment) : [...str]);
    g.graphemes = graphemes;
    g.letters = (str, o = {}) => {
      const out = [], chars = graphemes(str);
      let prefix = "";
      for (const ch of chars) {
        const x = prefix ? g.measure(prefix, o) + (o.track || 0) : 0;
        out.push({ ch, x, w: g.measure(ch, Object.assign({}, o, { track: 0 })) });
        prefix += ch;
      }
      return out;
    };
    /* the small mono labels of the HUD and the panels */
    g.mono = (str, x, y, o = {}) => g.text(String(str).toUpperCase(), x, y, Object.assign({ kind: "mono", size: 13, weight: 500, track: 2.4 }, o));

    /* shapes: "circle", "square", "triangle", "hexagon", "star-12", "poly-5", "text:A",
       { d: "<svg path>", view: [x, y, w, h] }, { superformula: { m, n1, n2, n3 } } */
    const maskCache = new Map();
    g.shapePath = (spec, ctx, cx, cy, r) => {
      if (typeof spec === "string") {
        const [kind, arg] = spec.split(/[-:](.*)/s);
        if (kind === "circle") { ctx.arc(cx, cy, r, 0, TAU); return; }
        if (kind === "square") { ctx.rect(cx - r * 0.86, cy - r * 0.86, r * 1.72, r * 1.72); return; }
        if (kind === "triangle" || kind === "hexagon" || kind === "poly") {
          const n = kind === "triangle" ? 3 : kind === "hexagon" ? 6 : +arg || 5;
          for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * TAU) / n; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
          ctx.closePath(); return;
        }
        if (kind === "star") {
          const n = +arg || 5, inner = n > 8 ? 0.78 : 0.5;
          for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; ctx[i ? "lineTo" : "moveTo"](cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
          ctx.closePath(); return;
        }
        if (kind === "text") {
          ctx.save(); ctx.font = g.font("display", r * 1.6); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.letterSpacing = "0px";
          ctx.fillText(arg, cx, cy + r * 0.06); ctx.restore(); return "filled";
        }
        if (/^[Mm]/.test(spec)) spec = { d: spec };
      }
      if (spec && spec.d) {
        const [vx, vy, vw, vh] = spec.view || [0, 0, 100, 100], k = (2 * r) / Math.max(vw, vh);
        ctx.save(); ctx.translate(cx - (vx + vw / 2) * k, cy - (vy + vh / 2) * k); ctx.scale(k, k);
        ctx.fill(new Path2D(spec.d), spec.rule || "nonzero"); ctx.restore(); return "filled";
      }
      if (spec && spec.superformula) {
        const { m = 6, n1 = 1, n2 = 1, n3 = 1, a = 1, b = 1 } = spec.superformula;
        for (let i = 0; i <= 360; i++) { const th = (i / 360) * TAU, rr = r * g.superformula(th, m, n1, n2, n3, a, b); ctx[i ? "lineTo" : "moveTo"](cx + rr * Math.cos(th - Math.PI / 2), cy + rr * Math.sin(th - Math.PI / 2)); }
        ctx.closePath(); return;
      }
    };
    /* draw a filled shape */
    g.shape = (spec, cx, cy, r, color, ctx = g.ctx) => {
      ctx.save(); ctx.fillStyle = g.col(color); ctx.beginPath();
      if (g.shapePath(spec, ctx, cx, cy, r) !== "filled") ctx.fill();
      ctx.restore();
    };
    g.superformula = (th, m, n1, n2, n3, a = 1, b = 1) => {
      const t1 = Math.abs(Math.cos((m * th) / 4) / a) ** n2, t2 = Math.abs(Math.sin((m * th) / 4) / b) ** n3;
      return (t1 + t2) ** (-1 / n1);
    };
    /* a silhouette as an alpha mask, size × size, filling about 92% */
    g.mask = (spec, size = 256) => {
      const key = JSON.stringify(spec) + size;
      if (maskCache.has(key)) return maskCache.get(key);
      const cv = document.createElement("canvas"); cv.width = cv.height = size;
      const x = cv.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#fff"; x.beginPath();
      if (g.shapePath(spec, x, size / 2, size / 2, size * 0.46) !== "filled") x.fill();
      const data = x.getImageData(0, 0, size, size).data, a = new Uint8Array(size * size);
      for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3];
      const m = { size, a, canvas: cv, at: (u, v) => { const i = Math.floor(((v + 1) / 2) * size), j = Math.floor(((u + 1) / 2) * size); return i < 0 || j < 0 || i >= size || j >= size ? 0 : a[i * size + j] / 255; } };
      maskCache.set(key, m); return m;
    };
    /* n points inside a shape (or on its edge), in -1..1, deterministic */
    g.points = (spec, n, { seed = 1, edge = false } = {}) => {
      const m = g.mask(spec, 256), r = rng(seed), pts = [];
      let guard = 0;
      while (pts.length < n && guard++ < n * 400) {
        const u = r() * 2 - 1, v = r() * 2 - 1, a = m.at(u, v);
        if (a < 0.5) continue;
        if (edge) { const e = 3 / m.size; if (m.at(u + e, v) > 0.5 && m.at(u - e, v) > 0.5 && m.at(u, v + e) > 0.5 && m.at(u, v - e) > 0.5) continue; }
        pts.push([u, v]);
      }
      return pts;
    };
    /* r(θ) of a shape, k samples, outermost edge along each ray from the centre: morph-ready */
    g.radial = (spec, k = 240) => {
      const m = g.mask(spec, 256), out = new Float32Array(k);
      for (let i = 0; i < k; i++) {
        const th = (i / k) * TAU - Math.PI / 2, dx = Math.cos(th), dy = Math.sin(th);
        let r = 0;
        for (let s = 0; s <= 1.0; s += 1 / 256) if (m.at(dx * s, dy * s) > 0.5) r = s;
        out[i] = r;
      }
      return out;
    };
    /* trace r(θ) as a closed path */
    g.radialPath = (rs, cx, cy, R0, rot = 0, ctx = g.ctx) => {
      const k = rs.length;
      for (let i = 0; i <= k; i++) { const th = (i / k) * TAU - Math.PI / 2 + rot, r = rs[i % k] * R0; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(th), cy + r * Math.sin(th)); }
      ctx.closePath();
    };

    /* 3D: camera({ yaw, pitch, dist, fov, cx, cy, unit }) → project([x, y, z]) = { x, y, z, s } */
    g.camera = ({ yaw = 0, pitch = 0, roll = 0, dist = 4, fov = 35, cx = g.stage.cx, cy = g.stage.cy, unit = g.stage.min * 0.42 } = {}) => {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const f = 1 / Math.tan(((fov * Math.PI) / 180) / 2);
      return {
        rotate: ([x, y, z]) => {
          let X = x * cyw + z * syw, Z = -x * syw + z * cyw, Y = y;
          const Y2 = Y * cp - Z * sp, Z2 = Y * sp + Z * cp;
          return [X * cr - Y2 * sr, X * sr + Y2 * cr, Z2];
        },
        project(p) {
          const [X, Y, Z] = this.rotate(p), d = dist + Z, s = (f / Math.max(0.05, d)) * unit * (dist / f);
          return { x: cx + X * s, y: cy + Y * s, z: d, s };
        },
      };
    };

    /* offscreen layers the size of the frame, pooled by name */
    const layers = new Map();
    g.layer = (name = "a", clear = true) => {
      let L = layers.get(name);
      if (!L) { const cv = document.createElement("canvas"); cv.width = canvas.width; cv.height = canvas.height; L = { canvas: cv, ctx: cv.getContext("2d") }; layers.set(name, L); }
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (clear) L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
      L.ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
      return L;
    };
    /*
     * motion blur: draw(ctx) n times along (dx, dy), averaged, onto ctx. rect = [x, y, w, h]
     * (design px) bounds what is drawn, so only that part of the frame is composited.
     */
    g.smear = (draw, dx, dy, n = 10, ctx = g.ctx, tag = "smear", rect = null) => {
      if (Math.abs(dx) + Math.abs(dy) < 0.5 || n <= 1) { draw(ctx); return; }
      const k = R.scale, W = canvas.width, H = canvas.height;
      const box = (x0, y0, x1, y1) => { x0 = Math.max(0, Math.floor(x0 * k)); y0 = Math.max(0, Math.floor(y0 * k)); x1 = Math.min(W, Math.ceil(x1 * k)); y1 = Math.min(H, Math.ceil(y1 * k)); return [x0, y0, x1 - x0, y1 - y0]; };
      const [rx, ry, rw, rh] = rect || [0, 0, R.w, R.h];
      const A = box(rx - 2, ry - 2, rx + rw + 2, ry + rh + 2), Bx = box(rx - 2 - Math.abs(dx) / 2, ry - 2 - Math.abs(dy) / 2, rx + rw + 2 + Math.abs(dx) / 2, ry + rh + 2 + Math.abs(dy) / 2);
      if (A[2] <= 0 || A[3] <= 0) return;
      const src = g.layer(tag + "-src", false), acc = g.layer(tag + "-acc", false);
      src.ctx.setTransform(1, 0, 0, 1, 0, 0); src.ctx.clearRect(...A);
      acc.ctx.setTransform(1, 0, 0, 1, 0, 0); acc.ctx.clearRect(...Bx);
      src.ctx.setTransform(k, 0, 0, k, 0, 0); src.ctx.save(); src.ctx.beginPath(); src.ctx.rect(A[0] / k, A[1] / k, A[2] / k, A[3] / k); src.ctx.clip(); draw(src.ctx); src.ctx.restore();
      /* the copies are summed at 1/n each: a true average, transparent parts included */
      acc.ctx.globalCompositeOperation = "lighter"; acc.ctx.globalAlpha = 1 / n;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1) - 0.5;
        acc.ctx.drawImage(src.canvas, A[0], A[1], A[2], A[3], A[0] + dx * f * k, A[1] + dy * f * k, A[2], A[3]);
      }
      acc.ctx.globalAlpha = 1; acc.ctx.globalCompositeOperation = "source-over";
      if (Bx[2] > 0 && Bx[3] > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(acc.canvas, ...Bx, ...Bx); ctx.restore(); }
    };
    /* the faint dot grid paper grounds carry: x = step·k, y = 89 + step·k (60 px, r 1.1, ink at .12) */
    g.dotGrid = (color, { step = 60, r = 1.1, alpha = 0.12, ox = 0, oy = 89 } = {}, ctx = g.ctx) => {
      ctx.save(); ctx.fillStyle = rgba(g.col(color), alpha); ctx.beginPath();
      for (let y = mod(oy, step); y < R.h; y += step) for (let x = mod(ox, step) || step; x < R.w; x += step) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
      ctx.fill(); ctx.restore();
    };
    /* corner brackets around a rect */
    g.brackets = (x, y, w, h, { len = 22, width = 2, color, alpha = 1 } = {}, ctx = g.ctx) => {
      ctx.save(); ctx.strokeStyle = rgba(g.col(color), alpha); ctx.lineWidth = width; ctx.lineCap = "square"; ctx.beginPath();
      for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.moveTo(px, py + sy * len); ctx.lineTo(px, py); ctx.lineTo(px + sx * len, py); }
      ctx.stroke(); ctx.restore();
    };
    g.line = (x1, y1, x2, y2, color, width = 1, alpha = 1, ctx = g.ctx) => { ctx.save(); ctx.strokeStyle = rgba(g.col(color), alpha); ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); };
    g.circle = (x, y, r, color, ctx = g.ctx) => { ctx.save(); ctx.fillStyle = g.col(color); ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fill(); ctx.restore(); };
    g.ring = (x, y, r, color, width = 1, alpha = 1, ctx = g.ctx) => { ctx.save(); ctx.strokeStyle = rgba(g.col(color), alpha); ctx.lineWidth = width; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.stroke(); ctx.restore(); };
    g.rrect = (x, y, w, h, r, ctx = g.ctx) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    /* beat helpers: progress through [a, b) beats, eased */
    g.span = (b, a, z, e = "linear") => (typeof e === "function" ? e : ease[e])(seg(b, a, z));
    /*
     * Voronoi cells of sites inside a rect [x0, y0, x1, y1]: [{ poly: [[x, y], …], c: [cx, cy], i }]
     * (convex polygons, each cell clipped by every bisector: fine for a hundred sites or so)
     */
    g.voronoi = (sites, rect) => {
      const [x0, y0, x1, y1] = rect, out = [];
      const clipHalf = (poly, mx, my, nx, ny) => {
        const o = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length], da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
          if (da <= 0) o.push(a);
          if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
        }
        return o;
      };
      sites.forEach((p, i) => {
        let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        for (let j = 0; j < sites.length && poly.length; j++) if (j !== i) { const q = sites[j]; poly = clipHalf(poly, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, q[0] - p[0], q[1] - p[1]); }
        if (poly.length < 3) return;
        let cx = 0, cy = 0; for (const [x, y] of poly) { cx += x; cy += y; }
        out.push({ poly, c: [cx / poly.length, cy / poly.length], i });
      });
      return out;
    };
    return g;
  }

  /* ---------------------------------------------------------------- the reel */

  const warnings = new Set();
  Reel.warn = (msg) => { if (!warnings.has(msg)) { warnings.add(msg); console.warn("[reel] " + msg); } };
  Reel.warnings = () => [...warnings];

  let R = null, G = null;
  /* the formats a reel renders in: ?format=9x16 (the default), 1x1, 4x5 or 16x9, or ?w=&h= */
  const FORMATS = (Reel.formats = { "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350], "16x9": [1920, 1080] });
  Reel.make = (spec) => {
    const q = new URLSearchParams(location.search);
    const [w, h] = q.has("w") && q.has("h") ? [+q.get("w"), +q.get("h")] : FORMATS[q.get("format")] || spec.size || FORMATS["9x16"];
    R = Object.assign({ name: "reel", brand: "STUDIO", edition: "REEL " + new Date().getFullYear(), bpm: 111, fps: 60, palette: "studio", seed: 7, scale: 1, hud: true }, spec, { w, h });
    /* hud: true / false, a style ("minimal"), or the HUD's own settings (see hud below) */
    R.H = R.hud && typeof R.hud === "object" ? R.hud : typeof R.hud === "string" ? { style: R.hud } : {};
    R.hud = R.hud !== false;
    if (q.has("scale")) R.scale = +q.get("scale");
    if (q.has("fps")) R.fps = +q.get("fps");
    if (q.has("palette")) R.palette = q.get("palette");
    if (q.has("samples")) R.samples = +q.get("samples");
    /* slow: a scene plays in slow motion, taking slow × its beats on the music's timeline. A reel
       sets it for every scene (slow: 2 is half speed), a scene for itself; ?slow= multiplies both. */
    const slowBy = q.has("slow") ? +q.get("slow") || 1 : 1;
    let at = 0;
    R.scenes = spec.scenes.map((sc, i) => {
      const def = DEFS[sc.type];
      if (!def) throw new Error(`unknown scene type "${sc.type}" (scene ${i + 1}); known: ${Object.keys(DEFS).join(", ")}`);
      const s = Object.assign({}, def.params, sc, { def, i, start: at, beats: sc.beats ?? def.beats });
      s.slow = (sc.slow ?? spec.slow ?? 1) * slowBy;
      s.len = s.beats * s.slow; /* its length on the timeline, in beats of the music */
      s.bg = sc.bg ?? def.bg; s.label = sc.label ?? (typeof def.label === "function" ? def.label(s) : def.label);
      s.in = norm("in" in sc ? sc.in : def.in); s.out = norm("out" in sc ? sc.out : def.out);
      for (const [side, x] of [["in", s.in], ["out", s.out]]) if (x && !LEGACY.includes(x.type) && !(Reel.transitions || {})[x.type]) Reel.warn(`scene ${i + 1} (${sc.type}): unknown ${side} transition "${x.type}"; known: ${[...LEGACY, ...Object.keys(Reel.transitions || {})].join(", ")}`);
      s.grid = "grid" in sc ? sc.grid : def.grid ?? def.params.grid;
      s.warp = warpOf(sc.warp ?? def.warp, i);
      s.hits = [].concat(sc.hits ?? def.hits ?? []);
      for (const k of Object.keys(sc)) if (!(k in def.params) && !SCENE_KEYS.includes(k)) Reel.warn(`scene ${i + 1} (${sc.type}): unknown option "${k}"`);
      at += s.len;
      return s;
    });
    R.beats = at;
    R.bars = at / 4;
    if (!Number.isInteger(R.bars)) Reel.warn(`the scenes add up to ${at} beats (beats × slow), not whole bars of 4: the loop will not sit on the music`);
    R.seconds = (at * 60) / R.bpm;
    R.frames = Math.round(R.seconds * R.fps);
    R.spb = R.frames / R.fps / at; /* exact seconds per beat after rounding to whole frames */
    return R;
  };
  const norm = (x) => (!x ? null : typeof x === "string" ? { type: x } : x);
  /* the options every scene takes, on top of its own params */
  const SCENE_KEYS = ["type", "beats", "bg", "label", "in", "out", "grid", "hud", "theme", "note", "from", "samples", "shutter", "slow", "warp", "ground", "hits", "energy", "grain"];
  /* the transitions drawAt knows itself; the rest are registered by engine/transitions.js */
  const LEGACY = ["smear", "iris", "wipe", "cut"];

  /*
   * Time warp: a scene's own time, remapped. warp is a preset or a list of [x, y] knots, both
   * 0..1: x is how far through the scene's time on screen, y how far through its motion. A smooth
   * monotone curve runs through the knots (a knot list as { knots, smooth: false } is straight
   * segments). The motion may run backwards (y falling) or hold (y flat). Cuts and transitions
   * keep to the screen time; only what the scene draws is warped.
   */
  const WARPS = {
    reverse: { knots: [[0, 1], [1, 0]], smooth: false },
    boomerang: [[0, 0], [0.5, 1], [1, 0]],
    /* slow motion that snaps to full speed: 55 % of the time for the first 12 % of the motion */
    snap: { knots: [[0, 0], [0.55, 0.12], [0.68, 0.62], [1, 1]], smooth: true },
    /* the reverse: fast, then a long slow tail */
    rush: [[0, 0], [0.25, 0.7], [1, 1]],
    /* plays through, then holds its last moment */
    hold: { knots: [[0, 0], [0.72, 1], [1, 1]], smooth: false },
    /* a record-scratch: three quick back-and-forths at the middle */
    stutter: { knots: [[0, 0], [0.4, 0.4], [0.47, 0.32], [0.54, 0.44], [0.61, 0.36], [0.68, 0.5], [1, 1]], smooth: false },
  };
  function warpOf(w, i) {
    if (w == null || w === false) return null;
    const spec = typeof w === "string" ? WARPS[w] : w;
    if (!spec) { Reel.warn(`scene ${i + 1}: unknown warp "${w}"; known: ${Object.keys(WARPS).join(", ")}`); return null; }
    const knots = (Array.isArray(spec) ? spec : spec.knots).map(([x, y]) => [clamp(x), y]).sort((a, b) => a[0] - b[0]);
    const smooth = Array.isArray(spec) ? true : spec.smooth !== false, n = knots.length;
    if (n < 2) return null;
    /* Fritsch–Carlson tangents: no overshoot between knots, a flat tangent at every turn */
    const d = [], m = [];
    for (let k = 0; k < n - 1; k++) d.push((knots[k + 1][1] - knots[k][1]) / Math.max(1e-9, knots[k + 1][0] - knots[k][0]));
    for (let k = 0; k < n; k++) {
      if (!smooth) { m.push(0); continue; }
      if (k === 0) m.push(d[0]); else if (k === n - 1) m.push(d[n - 2]);
      else m.push(d[k - 1] * d[k] <= 0 ? 0 : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]));
    }
    return (u) => {
      if (u <= knots[0][0]) return knots[0][1];
      if (u >= knots[n - 1][0]) return knots[n - 1][1];
      let k = 0;
      while (k < n - 2 && u > knots[k + 1][0]) k++;
      const [x0, y0] = knots[k], [x1, y1] = knots[k + 1], h = x1 - x0, s = (u - x0) / h;
      if (!smooth) return y0 + (y1 - y0) * s;
      const s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m[k] + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m[k + 1];
    };
  }

  Reel.setHud = (on) => { R.hud = on; };
  Reel.info = () => ({
    name: R.name, music: R.music || {}, w: R.w, h: R.h, scale: R.scale, fps: R.fps, frames: R.frames, bpm: R.bpm, bpmExact: 60 / R.spb, beats: R.beats, bars: R.bars, seconds: R.frames / R.fps,
    scenes: R.scenes.map((s) => ({ i: s.i, type: s.type, label: s.label, start: s.start, beats: s.beats, slow: s.slow, len: s.len, shot: s.def.shot ? s.def.shot(s) * s.slow : null, bg: s.bg, in: s.in ? s.in.type : null, out: s.out ? s.out.type : null, seamless: !!s.def.seamless, rewind: s.type === "rewind" ? { to: s.to ?? 0, ease: s.ease || "inOutCubic" } : null, from: Math.ceil((s.start / R.beats) * R.frames - 1e-9), to: Math.ceil(((s.start + s.len) / R.beats) * R.frames - 1e-9) })),
  });

  Reel.mount = (canvas) => {
    if (!R) throw new Error("Reel.make(spec) first");
    canvas.width = Math.round(R.w * R.scale); canvas.height = Math.round(R.h * R.scale);
    G = toolkit(R, canvas);
    Reel.g = G;
    Reel.ready = (window.REEL_FONTS || Promise.resolve()).then(() => document.fonts.ready).then(async () => {
      for (const s of R.scenes) if (s.def.prepare) s._ = (await s.def.prepare(s, G)) || {};
      return Reel.info();
    });
    return Reel.ready;
  };

  /* the clock of one scene at global beat B. Its beats are the scene's own: in slow motion
     (s.slow > 1) each of them lasts slow beats of the music, and spb is stretched to match. */
  const clock = (s, B, f, fi = f) => {
    const k = s.slow || 1, n = R.scenes.length;
    /* rb: the scene's beat on screen (cuts and transitions keep to it); b: the beat its motion is
       at, the same unless the scene's time is warped */
    const rb = (B - s.start) / k, rq = ((fi / R.frames) * R.beats - s.start) / k;
    const W = s.warp, b = W ? W(clamp(rb / s.beats)) * s.beats : rb, bq = W ? W(clamp(rq / s.beats)) * s.beats : rq;
    return {
      /* bq: the beat of the whole frame being made, the same for every motion-blur sample of it,
         for hard changes (a flip, a cut inside a scene) that must not blend across the shutter */
      b, bq, rb, rq, p: b / s.beats, beats: s.beats, sec: b * R.spb * k, spb: R.spb * k, bpm: R.bpm, slow: k,
      f, fi, F: R.frames, fps: R.fps, B, T: B / R.beats, i: s.i, n,
      next: R.scenes[(s.i + 1) % n], prev: R.scenes[(s.i - 1 + n) % n],
    };
  };

  /*
   * A scene's ground: bg (a role or a colour) as a flat fill, or ground, a painted one over it:
   * { gradient: [role, role, …], angle } (degrees, 90 = top to bottom) or { radial: [role, …],
   * at: [x, y] (0..1 of the frame), r } (of the frame's diagonal). A stop may be [role, 0..1].
   * bg stays the colour scenes read their ink from, so give it the gradient's main colour.
   */
  const gradients = new Map();
  const groundFill = (g, s, ctx) => {
    const gr = s.ground;
    if (!gr || (!gr.gradient && !gr.radial)) return g.col(s.bg);
    const key = s.i + "|" + JSON.stringify(gr);
    if (gradients.has(key)) return gradients.get(key);
    const stops = [].concat(gr.gradient || gr.radial).map((x, k, a) => (Array.isArray(x) ? x : [x, a.length > 1 ? k / (a.length - 1) : 0]));
    let fill;
    if (gr.radial) {
      const [ax, ay] = gr.at || [0.5, 0.5], r = (gr.r ?? 0.75) * Math.hypot(R.w, R.h);
      fill = ctx.createRadialGradient(ax * R.w, ay * R.h, 0, ax * R.w, ay * R.h, r);
    } else {
      const a = ((gr.angle ?? 90) * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), half = (Math.abs(dx) * R.w + Math.abs(dy) * R.h) / 2;
      fill = ctx.createLinearGradient(R.w / 2 - dx * half, R.h / 2 - dy * half, R.w / 2 + dx * half, R.h / 2 + dy * half);
    }
    for (const [c, p] of stops) fill.addColorStop(clamp(p), g.col(c));
    gradients.set(key, fill);
    return fill;
  };
  /* a scene, at local beat b, onto ctx: its ground and its drawing */
  const paint = (s, t, ctx) => {
    const g = G, old = g.ctx;
    g.ctx = ctx;
    ctx.save();
    const bg = g.col(s.bg);
    /* the ground overshoots the frame, so a shaken or punched picture never shows its edge */
    ctx.fillStyle = groundFill(g, s, ctx); ctx.fillRect(-R.w * 0.5, -R.h * 0.5, R.w * 2, R.h * 2);
    if (s.grid) g.dotGrid(g.on(bg), typeof s.grid === "object" ? s.grid : {});
    s.def.draw(g, s, t);
    ctx.restore();
    g.ctx = old;
  };
  /* a scene frozen at its first frame (what an out-transition opens onto) */
  const frozen = (s) => Object.assign(clock(s, s.start, 0), { frozen: true, rq: 0, bq: s.warp ? s.warp(0) * s.beats : 0 });
  /* a scene frozen at its last frame (what an in-transition leaves behind) */
  const frozenEnd = (s) => {
    const fi = Math.max(0, Math.ceil(((s.start + s.len) / R.beats) * R.frames - 1e-9) - 1);
    return Object.assign(clock(s, (fi / R.frames) * R.beats, fi, fi), { frozen: true });
  };

  /*
   * One moment of the reel (frame may be fractional): the scene and its transition, no HUD.
   * Re-entrant: a scene may draw another moment of the reel inside itself (Reel.paintAt), so
   * the layers it borrows are named by depth.
   */
  let depth = 0;
  const LN = (name) => (depth > 1 ? `${name}@${depth}` : name);
  const anchorOf = (s) => {
    const a = (s._ && s._.anchor) || [G.box.cx, G.box.cy];
    return [a[0], a[1], (s._ && s._.anchorR) || 0];
  };
  const drawAt = (frame, fi = Math.round(frame)) => {
    depth++;
    try { return drawMoment(frame, fi); } finally { depth--; }
  };
  const drawMoment = (frame, fi) => {
    const g = G, ctx = g.ctx, f = mod(frame, R.frames);
    const B = (f / R.frames) * R.beats;
    const s = sceneAt(f);
    const t = clock(s, B, Math.floor(f), mod(fi, R.frames));
    ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

    const out = s.out, inn = s.in, TR = Reel.transitions || {};
    const outK = out ? seg(t.rb, s.beats - (out.beats ?? 0.5), s.beats) : 0;
    const inK = inn ? seg(t.rb, 0, inn.beats ?? 0.5) : 1;
    /* the shake and punch of hits (energy) are drawn round whatever this moment is */
    const fx = energyAt(s, t);
    const target = fx ? g.layer(LN("fx")).ctx : ctx;
    let showing = s;
    if (outK > 0 && TR[out.type]) {
      /* a registered transition at the end of this scene: onto the next one, frozen at its start */
      const nx = t.next;
      TR[out.type](target, outK, out, transit(s, (c) => paint(s, t, c), nx, (c) => paint(nx, frozen(nx), c), t, "out"));
      if (outK >= (out.handover ?? 0.85)) showing = nx;
    } else if (inK < 1 && TR[inn.type]) {
      /* a registered transition at the start of this one: from the scene before, frozen at its end */
      const pv = t.prev;
      TR[inn.type](target, inK, inn, transit(pv, (c) => paint(pv, frozenEnd(pv), c), s, (c) => paint(s, t, c), t, "in"));
      if (inK < (inn.handover ?? 0.15)) showing = pv;
    } else if (outK > 0 && out.type === "smear") {
      const k = ease.inCubic(outK), [ux, uy] = out.dir || [0, -1], d = (out.dist ?? 900) * k;
      const L = g.layer(LN("scene"));
      g.smear((c) => { c.save(); c.translate(ux * d, uy * d); paint(s, t, c); c.restore(); }, ux * d * 0.6, uy * d * 0.6, 14, L.ctx, LN("out"));
      target.fillStyle = g.col(t.next.bg); target.fillRect(0, 0, R.w, R.h);
      target.save(); target.globalAlpha = 1 - ease.inQuad(outK) * 0.6; target.setTransform(1, 0, 0, 1, 0, 0); target.drawImage(L.canvas, 0, 0); target.restore();
    } else if (inK < 1 && inn.type === "smear") {
      const k = 1 - ease.outCubic(inK), [ux, uy] = inn.dir || [0, 1], d = (inn.dist ?? 600) * k;
      g.smear((c) => { c.save(); c.translate(-ux * d, -uy * d); paint(s, t, c); c.restore(); }, ux * d * 0.6, uy * d * 0.6, 14, target, LN("in"));
    } else {
      paint(s, t, target);
    }
    /* iris and wipe hand over to the next scene frozen at its first frame, so a cut is seamless */
    if (outK > 0 && (out.type === "iris" || out.type === "wipe")) {
      const ctx = target, nx = t.next, L = g.layer(LN("next"));
      paint(nx, frozen(nx), L.ctx);
      ctx.save(); ctx.beginPath();
      if (out.type === "iris") {
        const [ax, ay] = (s._ && s._.anchor) || out.at || [g.box.cx, g.box.cy];
        const far = Math.max(...[[0, 0], [R.w, 0], [0, R.h], [R.w, R.h]].map(([x, y]) => Math.hypot(x - ax, y - ay)));
        const r0 = out.from ?? ((s._ && s._.anchorR) || 0);
        ctx.arc(ax, ay, lerp(r0, far * 1.02, ease[out.ease || "inQuart"](Math.min(1, outK / 0.94))), 0, TAU);
      } else {
        const k = ease[out.ease || "inOutCubic"](Math.min(1, outK / 0.94)), [ux, uy] = out.dir || [1, -0.35], len = Math.hypot(ux, uy), nx2 = ux / len, ny2 = uy / len;
        const span = Math.abs(nx2) * R.w + Math.abs(ny2) * R.h, d = -span / 2 + k * span * 1.02, px = -ny2, py = nx2;
        const cx = R.w / 2 + nx2 * d, cy = R.h / 2 + ny2 * d, big = R.w + R.h;
        ctx.moveTo(cx + px * big, cy + py * big); ctx.lineTo(cx + px * big - nx2 * big * 2, cy + py * big - ny2 * big * 2);
        ctx.lineTo(cx - px * big - nx2 * big * 2, cy - py * big - ny2 * big * 2); ctx.lineTo(cx - px * big, cy - py * big); ctx.closePath();
      }
      ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas, 0, 0); ctx.restore();
    }
    if (fx) applyShake(ctx, g.layer(LN("fx"), false).canvas, fx);
    /* the ground the HUD reads on: the scene's, or the one it says it is showing (s._.hudBg) */
    if (outK > 0.85 && out && (out.type === "iris" || out.type === "wipe")) showing = t.next;
    return { s, t, ground: (showing._ && showing._.hudBg) || showing.bg };
  };

  /*
   * What a transition is handed: the outgoing and incoming pictures as painters (into any ctx),
   * the two scenes, their anchors once painted (the dot each hands on: [x, y, r]), a layer per
   * picture, and the clock. a is always the scene being left, b the one arriving.
   */
  const transit = (a, paintA, b, paintB, t, side) => {
    const g = G, X = { a, b, t, g, R, LN, side };
    X.picA = (name = "tA") => { const L = g.layer(LN(name)); paintA(L.ctx); return L.canvas; };
    X.picB = (name = "tB") => { const L = g.layer(LN(name)); paintB(L.ctx); return L.canvas; };
    X.paintA = paintA; X.paintB = paintB;
    X.anchorA = () => anchorOf(a); X.anchorB = () => anchorOf(b);
    /* a scene's own ground (its gradient too), filled well past the frame, under moving pictures */
    X.fillGround = (ctx, scene) => { ctx.save(); ctx.fillStyle = groundFill(g, scene, ctx); ctx.fillRect(-R.w, -R.h, R.w * 3, R.h * 3); ctx.restore(); };
    /* the colour at a scene's frame edge: its ground's last stop, or its flat ground */
    X.edgeColor = (scene) => { const gr = scene.ground, st = gr && [].concat(gr.gradient || gr.radial || []); return g.col(st && st.length ? [].concat(st[st.length - 1])[0] : scene.bg); };
    return X;
  };

  /*
   * Energy: how hard the reel hits. energy (the reel's, or a scene's own; 0 = off) shakes and
   * punches the picture on every hit (each cut, and a scene's hits: [beats]), pulses it on the
   * beat, and flashes and splits its colour for a frame or two after a hit. 1 is bold, 2 is wild.
   */
  /* a cut hits only when it is a hard one: a transition into the scene already carries its own */
  const hardCut = (s) => {
    const n = R.scenes.length, pv = R.scenes[(s.i - 1 + n) % n];
    return !(pv.out && pv.out.type !== "cut") && !(s.in && s.in.type !== "cut") && ![].concat(s.def.continues || []).includes(pv.type) && !pv.def.seamless;
  };
  const hitSince = (s, t, rb) => {
    const sec = rb * t.spb;
    let since = s.energy === 0 || !hardCut(s) ? Infinity : sec;
    for (const h of s.hits) { const hs = h * t.spb; if (hs <= sec + 1e-9 && sec - hs < since) since = sec - hs; }
    return since;
  };
  const energyAt = (s, t) => {
    const E = s.energy ?? R.energy ?? 0;
    if (!E || depth > 1) return null;
    const since = hitSince(s, t, t.rb), env = Math.exp(-since / 0.11);
    /* the beat pulse swells and settles (no jump), so it never shows as a seam */
    const beat = (t.B - Math.floor(t.B + 1e-9)) * R.spb, x = beat / 0.045, pulse = (R.pulse ?? 1) * x * Math.exp(1 - x);
    const shake = 26 * E * env, punch = 0.06 * E * env + 0.014 * E * pulse;
    if (shake < 0.25 && punch < 0.0006) return null;
    const n = G.noise3, u = t.B * R.spb * 34;
    return { dx: shake * n(u, 0.5, s.i), dy: shake * n(u, 7.3, s.i), rot: 0.014 * E * env * n(u * 0.8, 13.1, s.i), scale: 1 + punch };
  };
  /* the picture, shaken: scaled just enough that its edges never show */
  const applyShake = (ctx, canvas, fx) => {
    const W = canvas.width, H = canvas.height, k = R.scale, c = Math.abs(Math.cos(fx.rot)), sn = Math.abs(Math.sin(fx.rot));
    const cover = Math.max((c * W + sn * H + 2 * Math.abs(fx.dx * k)) / W, (sn * W + c * H + 2 * Math.abs(fx.dy * k)) / H);
    const sc = fx.scale * cover;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "copy";
    ctx.translate(W / 2 + fx.dx * k, H / 2 + fx.dy * k); ctx.rotate(fx.rot); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  };
  /*
   * After the shutter, before the HUD: the flash and colour split of a hit (energy), and grain
   * (grain: 0..1, the reel's or a scene's). Both read the frame's own time, so every sample of
   * the shutter agrees.
   */
  let grainTile = null;
  const post = (g, f) => {
    const s = sceneAt(f), t = clock(s, (f / R.frames) * R.beats, f, f), E = s.energy ?? R.energy ?? 0;
    const ctx = g.ctx, W = g.canvas.width, H = g.canvas.height;
    if (E) {
      const since = hitSince(s, t, t.rq), frames = since * R.fps;
      if (frames < 4 && s.flash !== false) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, 0.42 * E) * Math.exp(-frames / 1.1); ctx.fillStyle = g.col(s.flash || "#ffffff"); ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      const split = 9 * E * R.scale * Math.exp(-since / 0.09);
      if (split >= 0.75) {
        /* the colour split: red pulled one way, blue the other, each channel isolated by multiply
           and summed back with lighter, so nothing is read back from the canvas */
        const frame = g.layer("fx-frame"), ch = g.layer("fx-ch");
        frame.ctx.setTransform(1, 0, 0, 1, 0, 0); frame.ctx.drawImage(g.canvas, 0, 0);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "copy"; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore();
        for (const [col, dx] of [["#ff0000", split], ["#00ff00", 0], ["#0000ff", -split]]) {
          const c = ch.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over";
          c.drawImage(frame.canvas, 0, 0); c.globalCompositeOperation = "multiply"; c.fillStyle = col; c.fillRect(0, 0, W, H);
          c.globalCompositeOperation = "source-over";
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "lighter";
          /* the shifted channel's lost edge is filled from the frame's own edge, stretched */
          ctx.drawImage(ch.canvas, dx, 0);
          if (dx > 0) ctx.drawImage(ch.canvas, 0, 0, 1, H, 0, 0, Math.ceil(dx), H); else if (dx < 0) ctx.drawImage(ch.canvas, W - 1, 0, 1, H, W + Math.floor(dx), 0, Math.ceil(-dx), H);
          ctx.restore();
        }
      }
    }
    const grain = s.grain ?? R.grain ?? 0;
    if (grain > 0) {
      if (!grainTile) {
        grainTile = document.createElement("canvas"); grainTile.width = grainTile.height = 256;
        const x = grainTile.getContext("2d"), id = x.createImageData(256, 256), r = rng(41);
        for (let i = 0; i < id.data.length; i += 4) { const v = Math.round(r() * 255); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
        x.putImageData(id, 0, 0);
      }
      const h = hash(f, 3), h2 = hash(f, 5);
      ctx.save(); ctx.setTransform(R.scale * 1.5, 0, 0, R.scale * 1.5, -h * 256, -h2 * 256);
      ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = clamp(grain);
      ctx.fillStyle = ctx.createPattern(grainTile, "repeat"); ctx.fillRect(0, 0, R.w + 512, R.h + 512); ctx.restore();
    }
  };

  /* another moment of the reel, drawn into ctx (for a scene that shows the reel itself: a rewind) */
  Reel.paintAt = (frame, ctx) => {
    const g = G, old = g.ctx;
    g.ctx = ctx;
    try { return drawAt(frame, Math.round(frame)); } finally { g.ctx = old; }
  };
  Reel.frameOf = (beat) => (beat / R.beats) * R.frames;

  /*
   * A frame. With motion blur (samples > 1) the scene is drawn at several moments across the
   * shutter (half a frame, centred on the frame) and averaged; the HUD is drawn once, sharp, on
   * top. The samples stay inside the scene that owns the frame, so a cut is a clean cut.
   */
  Reel.draw = (frame, opts = {}) => {
    const g = G, ctx = g.ctx, f = mod(Math.round(frame), R.frames);
    const s0 = sceneAt(f), cap = s0.samples ?? s0.def.samples ?? 99, shutter = s0.shutter ?? s0.def.shutter ?? R.shutter ?? 0.5;
    const n = Math.max(1, Math.min(cap, opts.samples ?? R.samples ?? 1));
    let res;
    if (n === 1) res = drawAt(f);
    else {
      const lo = (s0.start / R.beats) * R.frames, hi = ((s0.start + s0.len) / R.beats) * R.frames - 1e-4;
      const acc = g.layer("mb-acc");
      acc.ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let j = 0; j < n; j++) {
        const ft = clamp(f + ((j + 0.5) / n - 0.5) * shutter, lo, hi);
        const r = drawAt(ft, f);
        if (j === (n >> 1)) res = r;
        acc.ctx.globalAlpha = 1 / (j + 1);
        acc.ctx.drawImage(g.canvas, 0, 0);
      }
      acc.ctx.globalAlpha = 1;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "copy"; ctx.drawImage(acc.canvas, 0, 0); ctx.restore();
    }
    post(g, f);
    ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    if (R.hud && res.s.hud !== false) hud(g, res.s, Object.assign({}, res.t, { f, B: (f / R.frames) * R.beats }), res.ground);
    return f;
  };
  const sceneAt = (f) => { const B = (f / R.frames) * R.beats; return R.scenes.find((x) => B >= x.start && B < x.start + x.len) || R.scenes[R.scenes.length - 1]; };

  /* ---------------------------------------------------------------- the HUD */

  const pad = (n, k) => String(n).padStart(k, "0");
  /*
   * The instrument frame, as measured. Two themes: cream on dark and saturated grounds, ink on
   * light and warm ones (relative luminance over 0.2), each with its own alphas. A scene can force
   * one with theme: "light" | "dark", or report the ground it shows in s._.hudBg.
   */
  const THEMES = { light: { p: 0.7, s: 0.3, br: 0.65, off: 0.36, on: 0.8 }, dark: { p: 0.5, s: 0.22, br: 0.58, off: 0.33, on: 0.73 } };
  /*
   * The HUD, as the reel sets it (hud: true | false | "minimal" | { … }):
   *   style    "instrument" (the original's frame) or "minimal" (brackets and the scene only)
   *   right    the top-right line, a template ("BAR {bar}/{bars}  {bpm} BPM")
   *   readout  the bottom-right line ("F{f}  {tc}")
   *   left     the bottom-left line ("{n} / {label}")
   *   beats    the four beat squares (true)
   *   vars     live numbers for the templates, each a curve over the reel (0 → 1):
   *            { T: { curve: [[0, 0], [0.7, 400], [1, 0]], digits: 0, pad: 3 } } (or just the curve)
   *   meter    a gauge up the right edge: { v: "T", min, max, label }
   * Built-in {…}: bar bars bpm f tc n label brand edition. A scene can make the HUD read another
   * moment of the reel (s._.hudFrame, a rewind running back), another label (s._.hudLabel) or its
   * own numbers (s._.hudVars).
   */
  const fillT = (str, o) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
  const curveAt = (curve, x) => {
    const c = curve || [[0, 0]];
    if (x <= c[0][0]) return c[0][1];
    for (let k = 0; k < c.length - 1; k++) if (x <= c[k + 1][0]) return lerp(c[k][1], c[k + 1][1], (x - c[k][0]) / Math.max(1e-9, c[k + 1][0] - c[k][0]));
    return c[c.length - 1][1];
  };
  function hud(g, s, t, ground) {
    if (s.hud === "none") return;
    const H = R.H || {}, minimal = H.style === "minimal";
    const ctx = g.ctx, b = g.box, theme = s.theme || (s._ && s._.hudTheme) || s.def.theme || (luma(g.col(ground)) > 0.2 ? "dark" : "light");
    const A = THEMES[theme] || THEMES.light, fg = theme === "dark" ? g.c.ink : g.c.paper;
    const L = { size: 14, weight: 500, track: 1.9, color: fg }, Rt = { size: 14, weight: 500, track: 0.9, color: fg };
    const x0 = b.x + 27.5, x1 = b.r - 29.5, y1 = b.y + 15.5, y2 = b.b - 9;
    /* the moment the HUD reads: this frame, or the one a scene says it is showing */
    const fr = s._ && s._.hudFrame != null ? mod(Math.round(s._.hudFrame), R.frames) : t.f, Bh = (fr / R.frames) * R.beats, sec = fr / R.fps;
    const beat = Math.floor(Bh) % 4, bar = Math.floor(Bh / 4) + 1;
    const vars = { bar: pad(bar, 2), bars: pad(R.bars, 2), bpm: Number.isInteger(+R.bpm) ? R.bpm : (+R.bpm).toFixed(1), f: pad(fr, 4), tc: `${pad(Math.floor(sec / 60), 2)}:${pad(Math.floor(sec) % 60, 2)}:${pad(fr % R.fps, 2)}`, n: pad(s.i + 1, 2), label: (s._ && s._.hudLabel) || s.label, brand: R.brand, edition: R.edition };
    const num = {};
    for (const [k, v] of Object.entries(H.vars || {})) {
      const spec = Array.isArray(v) ? { curve: v } : v, x = curveAt(spec.curve, fr / R.frames);
      num[k] = x;
      const str = spec.format ? spec.format(x) : x.toFixed(spec.digits ?? 0);
      vars[k] = spec.pad ? str.padStart(spec.pad, "0") : str;
    }
    if (s._ && s._.hudVars) Object.assign(vars, s._.hudVars);
    ctx.save();
    /* brackets: 20 px arms, 2 px, on the box corners */
    ctx.strokeStyle = rgba(fg, A.br); ctx.lineWidth = 2; ctx.lineCap = "butt"; ctx.beginPath();
    for (const [cx, cy, sx, sy] of [[b.x + 1.5, b.y + 1.5, 1, 1], [b.r - 1.5, b.y + 1.5, -1, 1], [b.x + 1.5, b.b - 1, 1, -1], [b.r - 1.5, b.b - 1, -1, -1]]) { ctx.moveTo(cx + 20 * sx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + 20 * sy); }
    ctx.stroke();
    if (!minimal) {
      /* top left: brand – edition */
      const w = g.mono(R.brand, x0, y1, Object.assign({}, L, { alpha: A.p }));
      g.mono(" – " + R.edition, x0 + w + L.track, y1, Object.assign({}, L, { alpha: A.s }));
      /* top right: four beat squares, the bar, the tempo (or the reel's own line) */
      const right = fillT(H.right ?? "BAR {bar}/{bars}  {bpm} BPM", vars);
      const rw = g.measure(right.toUpperCase(), Object.assign({ kind: "mono" }, Rt));
      g.mono(right, x1, y1, Object.assign({}, Rt, { alpha: A.p, align: "right" }));
      if (H.beats !== false) for (let i = 0; i < 4; i++) { ctx.fillStyle = rgba(fg, i === beat ? A.on : A.off); ctx.fillRect(x1 - rw - 24 - 9 - (3 - i) * 14, y1 - 11, 9, 9); }
    }
    /* bottom: the scene and the frame */
    if (s.hud !== "top") {
      g.mono(fillT(H.left ?? "{n} / {label}", vars), x0, y2, Object.assign({}, L, { alpha: A.p }));
      if (!minimal) g.mono(fillT(H.readout ?? "F{f}  {tc}", vars), x1, y2, Object.assign({}, Rt, { alpha: A.p, align: "right" }));
    }
    /* the gauge: a hairline track up the right edge, filled to the value, its label at the top */
    if (H.meter && !minimal) {
      const M = H.meter, v = clamp(((num[M.v] ?? 0) - (M.min ?? 0)) / ((M.max ?? 1) - (M.min ?? 0))), gx = b.r - 12, gy0 = b.b - 70, gy1 = b.y + 70;
      ctx.fillStyle = rgba(fg, A.off); ctx.fillRect(gx - 1, gy1, 2, gy0 - gy1);
      ctx.fillStyle = M.color ? g.col(M.color) : rgba(fg, A.on); ctx.fillRect(gx - 2.5, gy0 - (gy0 - gy1) * v, 5, (gy0 - gy1) * v);
      for (let i = 0; i <= 10; i++) { const y = lerp(gy0, gy1, i / 10); ctx.fillStyle = rgba(fg, A.s); ctx.fillRect(gx - (i % 5 ? 6 : 10), y - 0.5, i % 5 ? 4 : 7, 1); }
      if (M.label) g.mono(M.label, gx + 3, gy1 - 14, Object.assign({}, Rt, { size: 12, alpha: A.p, align: "right" }));
    }
    ctx.restore();
  }
})();
