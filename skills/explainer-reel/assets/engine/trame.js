/*
 * Trame: a script becomes an animated vector-illustration reel.
 *
 * A reel file exports { title, look, palette, ..., build(api) }. build() reads like the script:
 * beat("caption with *bold* words") moves the playhead to the start of that line of voice-over, and
 * everything added or changed after it happens there (offset with `at`: seconds, or a word of the
 * caption). compile() turns the reel into a scene: elements with property tracks keyed to absolute
 * time, the captions with a time for every word, and the sound cues. drawFrame(scene, t, art, ui)
 * paints any instant, so preview scrubbing and frame-by-frame export are the same code.
 *
 * Nothing here touches the DOM until drawFrame, so scripts/voice.mjs can compile a reel in Node
 * to read its script.
 */
import * as G from "./geom.js";
import * as S from "./shapes.js";
import { PALETTES, LOOKS, FONTS, colour, rgbCss } from "./theme.js";

export const W = 1080, H = 1920;
/** Output formats. A reel is written once, in 1080 × 1920 design coordinates. Each format maps the design's picture
 *  (the band y 110–1360) into its frame, scaled by s round (x, y), and places the captions and the pill in the frame.
 *  16:9 puts the picture on the left and the captions in a column on the right. */
export const FORMATS = {
  "9x16": { W: 1080, H: 1920, s: 1, x: 540, y: 735, caption: { x: 540, y: 1440, maxWidth: 820, k: 1 }, pill: [540, 1640], rail: true },
  "4x5": { W: 1080, H: 1350, s: 0.86, x: 540, y: 560, caption: { x: 540, y: 1175, maxWidth: 860, k: 0.96 }, pill: [540, 1285] },
  "1x1": { W: 1080, H: 1080, s: 0.7, x: 540, y: 440, caption: { x: 540, y: 920, maxWidth: 900, k: 0.92 }, pill: [540, 1032] },
  "16x9": { W: 1920, H: 1080, s: 0.86, x: 600, y: 540, caption: { x: 1480, y: 540, maxWidth: 660, k: 1.08 }, pill: [1480, 700] },
};
const DESIGN = [540, 735];
export const STAGE = { cx: 540, cy: 900, captionY: 1440, dotsY: 150, pillY: 1640 };

/* ---------- easing ---------- */

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  spring: (t) => 1 - Math.exp(-6 * t) * Math.cos(11 * t),
  step: (t) => (t > 0 ? 1 : 0),
};
const ease = (e) => (typeof e === "function" ? e : EASE[e] || EASE.inOut);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function lerp(a, b, k) {
  if (typeof a === "number") return a + (b - a) * k;
  if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * k);
  return k < 1 ? a : b;
}

/* ---------- timing: words to seconds ---------- */

/** caption words: emphasis marks dropped, [audio tags] (spoken, never shown) removed */
export const plainWords = (text) => String(text).replace(/\[[^\]]*\]/g, " ").replace(/\*/g, "").split(/\s+/).filter(Boolean);
/** what the voice says: the caption with its [audio tags], or the beat's own `say` */
export const spokenText = (text, say) => String(say ?? text).replace(/\*/g, "").replace(/\s+/g, " ").trim();

function syllables(w) {
  const d = w.replace(/[^0-9]/g, "");
  if (d.length) return Math.ceil(d.length * 1.4) + (w.includes(":") ? 1 : 0);
  const s = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return 0;
  let n = (s.match(/[aeiouy]+/g) || []).length;
  if (s.length > 2 && s.endsWith("e") && !s.endsWith("le") && n > 1) n--;
  return Math.max(1, n);
}
function pauseAfter(w) {
  if (/(\.\.\.|…)$/.test(w)) return 0.42;
  if (/[.!?]["”’)]*$/.test(w)) return 0.3;
  if (/[:;—–]$/.test(w)) return 0.22;
  if (/,["”’)]*$/.test(w)) return 0.16;
  return 0;
}
/** Estimated word times for one caption at a speaking rate (1 ≈ 170 words a minute). */
export function estimate(text, rate = 1) {
  let t = 0;
  const words = plainWords(text).map((w) => {
    const d = (0.08 + 0.135 * syllables(w)) / rate;
    const out = { start: t, end: t + d };
    t += d + pauseAfter(w) / rate;
    return out;
  });
  return { words, dur: t };
}

/* ---------- tracks ---------- */

class Track {
  constructor(base) { this.base = base; this.segs = []; this.ready = true; }
  add(t0, dur, to, e = "inOut") {
    this.segs.push({ t0, t1: t0 + Math.max(dur, 1e-4), to, e: ease(e) });
    this.ready = false;
  }
  prep() {
    this.segs.sort((a, b) => a.t0 - b.t0);
    for (let i = 0; i < this.segs.length; i++) this.segs[i].from = i ? this.val(i - 1, this.segs[i].t0) : this.base;
    this.ready = true;
  }
  val(i, t) {
    const s = this.segs[i];
    return lerp(s.from, s.to, s.e(clamp((t - s.t0) / (s.t1 - s.t0))));
  }
  at(t) {
    if (!this.ready) this.prep();
    const s = this.segs;
    if (!s.length || t < s[0].t0) return this.base;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].t0 <= t) lo = m; else hi = m - 1; }
    return this.val(lo, t);
  }
  /** the value it settles on (after every segment) */
  last() { if (!this.ready) this.prep(); return this.segs.length ? this.segs[this.segs.length - 1].to : this.base; }
}

/* ---------- affine ---------- */

const I = [1, 0, 0, 1, 0, 0];
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
function local(x, y, s, r) {
  const c = Math.cos((r * Math.PI) / 180) * s, d = Math.sin((r * Math.PI) / 180) * s;
  return [c, d, -d, c, x, y];
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function aabb(m, x0, y0, x1, y1) {
  const c = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)];
  return [Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))];
}
const mscale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

/* ---------- elements ---------- */

let UID = 0;

class El {
  constructor(sc, kind, o = {}) {
    this.sc = sc; this.kind = kind; this.id = ++UID; this.o = o;
    this.z = o.z ?? sc.z++;
    this.parent = o.parent || null;
    this.layer = o.layer || "art";
    this.tracks = {};
    this.loops = [];
    this.born = sc.time(o.at, o.delay);
    this.base = { x: o.x ?? 0, y: o.y ?? 0, scale: o.scale ?? 1, rot: o.rot ?? 0, opacity: 0, draw: 1, drawStart: 0 };
    sc.els.push(this);
  }
  tr(name) { return (this.tracks[name] ||= new Track(this.base[name])); }
  v(name, t) { const tr = this.tracks[name]; return tr ? tr.at(t) : this.base[name]; }
  col(t) { const tr = this.tracks.color; return tr ? tr.at(t) : this.base.color; }
  /** Tween properties: el.to({ x, y, scale, rot, opacity, color, ... }, { at, dur, ease, delay }) */
  to(props, o = {}) {
    const t0 = this.sc.time(o.at, o.delay), dur = o.dur ?? 0.8, e = o.ease || "inOut";
    for (const k in props) {
      let v = props[k];
      if (k === "color") v = colour(this.sc.pal, v);
      if (!(k in this.base)) this.base[k] = typeof v === "number" ? 0 : v;
      this.tr(k).add(t0, dur, v, e);
    }
    return this;
  }
  set(props, o = {}) { return this.to(props, { ...o, dur: 1e-4, ease: "linear" }); }
  defaultIn() { return "fade"; }
  inDur() { return 0.45; }
  /** Entrance: draw, fade, pop, grow, rise, type, flicker, cut. */
  in(how, o = {}) {
    how = how && how !== true ? how : this.defaultIn();
    const t = this.sc.time(o.at, o.delay), d = o.dur ?? this.inDur(how);
    this.shown = t;
    const op = o.opacity ?? 1;
    switch (how) {
      case "draw":
        this.tr("opacity").add(t, 0.06, op, "linear");
        this.tr("draw").add(t - 1e-3, 1e-4, 0, "linear");
        this.tr("draw").add(t, d, 1, o.ease || "inOut");
        this.drawing = { t0: t, t1: t + d };
        if (this.sfxDraw !== false) this.sc.cue("draw", t, { dur: d, gain: this.big ? 1 : 0.5 });
        break;
      case "pop":
        this.tr("opacity").add(t, 0.1, op, "linear");
        this.tr("scale").add(t - 1e-3, 1e-4, this.base.scale * 0.55, "linear");
        this.tr("scale").add(t, d, this.base.scale, "back");
        this.sc.cue("pop", t);
        break;
      case "grow":
        this.tr("opacity").add(t, 0.15, op, "linear");
        this.tr("scale").add(t - 1e-3, 1e-4, 0.001, "linear");
        this.tr("scale").add(t, d, this.base.scale, "out");
        break;
      case "rise":
        this.tr("opacity").add(t, d * 0.8, op, "out");
        this.tr("y").add(t - 1e-3, 1e-4, this.base.y + 36, "linear");
        this.tr("y").add(t, d, this.base.y, "out");
        break;
      case "flicker": {
        const k = [0, 0.04, 0.08, 0.13, 0.2, 0.26, 0.34];
        k.forEach((f, i) => this.tr("opacity").add(t + f * d * 2.5, 1e-4, i % 2 ? 0.1 : op, "linear"));
        this.tr("opacity").add(t + d, 1e-4, op, "linear");
        this.sc.cue("tick", t);
        break;
      }
      case "type":
        this.tr("opacity").add(t, 0.05, op, "linear");
        this.tr("chars").add(t - 1e-3, 1e-4, 0, "linear");
        this.tr("chars").add(t, d, 1, "linear");
        this.sc.cue("type", t, { dur: d });
        break;
      case "cut":
        this.tr("opacity").add(t, 1e-4, op, "linear");
        break;
      default:
        this.tr("opacity").add(t, d, op, "out");
    }
    return this;
  }
  /** Exit: fade, undraw, shrink, drop, cut. */
  out(how = "fade", o = {}) {
    const t = this.sc.time(o.at, o.delay), d = o.dur ?? (how === "undraw" ? 0.7 : 0.4);
    this.gone = t;
    if (how === "undraw") {
      this.tr("drawStart").add(t, d, 1, "inOut");
      this.tr("opacity").add(t + d, 1e-4, 0, "linear");
    } else if (how === "shrink") {
      this.tr("scale").add(t, d, 0.001, "in");
      this.tr("opacity").add(t + d * 0.6, d * 0.4, 0, "linear");
    } else if (how === "drop") {
      this.tr("y").add(t, d, this.v("y", t) + 40, "in");
      this.tr("opacity").add(t, d, 0, "in");
    } else if (how === "cut") {
      this.tr("opacity").add(t, 1e-4, 0, "linear");
    } else this.tr("opacity").add(t, d, 0, "inOut");
    return this;
  }
  /** Fade back to make room for something new (and back with .to({ opacity: 1 })). */
  dim(o = {}) { return this.to({ opacity: o.opacity ?? 0.3 }, { dur: 0.5, ...o }); }
  /** Ambient motion from now on: breathe, float, spin, sway, blink, flicker, pulse. */
  loop(kind, o = {}) {
    this.loops.push({ kind, t0: this.sc.time(o.at, o.delay), t1: o.until != null ? this.sc.time(o.until) : Infinity, ...o });
    return this;
  }
  stop(kind, o = {}) {
    const t = this.sc.time(o.at, o.delay);
    for (const l of this.loops) if (!kind || l.kind === kind) l.t1 = Math.min(l.t1, t);
    return this;
  }
  /** A ring that ripples out from this element once (or `count` times). */
  pulse(o = {}) {
    const [x, y] = this.world(o.anchor, this.sc.time(o.at, o.delay));
    this.sc.api.add.pulse({ x, y, color: o.color ?? this.o.color, r0: o.r0 ?? 10, r1: o.r1 ?? 120, count: o.count ?? 1, at: o.at, delay: o.delay, every: o.every });
    return this;
  }
  /** The world position of an anchor (or of the element) at time t (default: the playhead). */
  world(anchor, t) {
    t ??= this.sc.time();
    const m = this.matrix(t);
    let p = [0, 0];
    if (Array.isArray(anchor)) p = anchor;
    else if (anchor) {
      const all = this.anchors ? this.anchors(t) : {};
      if (all[anchor]) p = all[anchor];
      else console.warn(`trame: no anchor "${anchor}" on this ${this.kind} at ${t.toFixed(2)} s (it has: ${Object.keys(all).join(", ") || "none"}); using its centre`);
    }
    return apply(m, p[0], p[1]);
  }
  /** Where an anchor is on the frame, at the playhead or at a word: el.at("throat"), el.at("throat", "vagus") */
  at(anchor, when) { return this.world(anchor, when === undefined ? undefined : this.sc.time(when)); }
  matrix(t) {
    const m = local(this.v("x", t), this.v("y", t), this.v("scale", t) * this.loopScale(t), this.v("rot", t) + this.loopRot(t));
    const lm = this.loopMove(t);
    if (lm) { m[4] += lm[0]; m[5] += lm[1]; }
    return this.parent ? mul(this.parent.matrix(t), m) : mul(this.sc.camera(t, this.follow ? "art" : this.layer, this.screen), m);
  }
  alpha(t) {
    let a = this.v("opacity", t) * this.loopAlpha(t);
    return this.parent ? a * this.parent.alpha(t) : a;
  }
  loopK(l, t) { return t < l.t0 || t > l.t1 + 0.6 ? 0 : smooth(l.t0, l.t0 + 0.6, t) * (l.t1 === Infinity ? 1 : 1 - smooth(l.t1, l.t1 + 0.6, t)); }
  loopScale(t) {
    let s = 1;
    for (const l of this.loops) if (l.kind === "breathe") s *= 1 + (l.amp ?? 0.025) * Math.sin(((t - l.t0) / (l.period ?? 4)) * Math.PI * 2) * this.loopK(l, t);
    return s;
  }
  loopRot(t) {
    let r = 0;
    for (const l of this.loops) {
      if (l.kind === "spin") r += (l.speed ?? 12) * (Math.min(t, l.t1) - l.t0) * (t > l.t0 ? 1 : 0);
      if (l.kind === "sway") r += (l.amp ?? 4) * Math.sin(((t - l.t0) / (l.period ?? 3)) * Math.PI * 2) * this.loopK(l, t);
    }
    return r;
  }
  loopMove(t) {
    let dx = 0, dy = 0;
    for (const l of this.loops) if (l.kind === "float") {
      const k = this.loopK(l, t), a = ((t - l.t0) / (l.period ?? 5)) * Math.PI * 2;
      dy += (l.amp ?? 10) * Math.sin(a) * k; dx += (l.amp ?? 10) * 0.35 * Math.sin(a * 0.5 + 1) * k;
    }
    return dx || dy ? [dx, dy] : null;
  }
  loopAlpha(t) {
    let a = 1;
    for (const l of this.loops) {
      if (t < l.t0 || t > l.t1) continue;
      if (l.kind === "blink") a *= Math.sin(((t - l.t0) / (l.period ?? 1)) * Math.PI * 2) > -0.2 ? 1 : 0.15;
      if (l.kind === "flicker") a *= 0.82 + 0.18 * G.noise1(t * 14 + this.id);
    }
    return a;
  }
  pulses(t) { return this.loops.filter((l) => l.kind === "pulse" && t >= l.t0 && t <= l.t1 + 2); }
  draw() {}
}

/* ---------- stroke drawing ---------- */

let LINE = { scale: 1, min: 0 };
const lw = (w) => (w > 0 ? Math.max(w * LINE.scale, LINE.min) : 0);

function strokePts(ctx, pts, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (closed) ctx.closePath();
}
function boil(pts, seed, t, amp) {
  const f = Math.floor(t * 8), out = new Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    const k = i * 0.04;
    out[i] = pts[i] + (G.noise2(k + seed, f * 3.1) - 0.5) * amp;
    out[i + 1] = pts[i + 1] + (G.noise2(k + seed + 40, f * 3.1 + 9) - 0.5) * amp;
  }
  return out;
}
/** Stroke a world-space polyline in a style: mono, dotted, dashed, sketch, points. */
function paint(ctx, poly, st) {
  const { pts, closed } = poly;
  if (pts.length < 4) return;
  const w = lw(st.width);
  ctx.strokeStyle = st.css; ctx.fillStyle = st.css; ctx.lineWidth = w;
  if (st.stroke === "points") {
    // sparkling points along the path, a little scattered and twinkling: dust that settled into a line
    const p = { pts, closed: false }, L = G.pathLength(p), gap = st.gap ?? Math.max(5, w * 1.8), a0 = ctx.globalAlpha;
    for (let d = 0, i = 0; d <= L; d += gap, i++) {
      const [x, y] = G.pointAt(p, d), h1 = G.hash(st.seed + i * 1.7), h2 = G.hash(st.seed + i * 3.1 + 7);
      ctx.globalAlpha = a0 * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(st.t * (1.5 + h1 * 2) + h2 * 6.28)));
      ctx.beginPath(); ctx.arc(x + (h1 - 0.5) * w * 1.6, y + (h2 - 0.5) * w * 1.6, w * (0.3 + 0.45 * h2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = a0;
    return;
  }
  if (st.stroke === "dotted") {
    const p = { pts, closed: false }, L = G.pathLength(p), gap = st.gap ?? Math.max(7, w * 2.6);
    for (let d = 0; d <= L; d += gap) {
      const [x, y] = G.pointAt(p, d);
      ctx.beginPath(); ctx.arc(x, y, w * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (st.stroke === "dashed") ctx.setLineDash(st.dash || [w * 3, w * 3]);
  if (st.stroke === "sketch") {
    const a = ctx.globalAlpha;
    strokePts(ctx, boil(pts, st.seed, st.t, w * 0.9), closed); ctx.stroke();
    ctx.globalAlpha = a * 0.55; ctx.lineWidth = w * 0.6;
    strokePts(ctx, boil(pts, st.seed + 17, st.t, w * 1.6), closed); ctx.stroke();
    ctx.globalAlpha = a; ctx.lineWidth = w;
    return;
  }
  strokePts(ctx, pts, closed); ctx.stroke();
  if (st.dash || st.stroke === "dashed") ctx.setLineDash([]);
}
function tipDot(ctx, x, y, w, css) {
  ctx.save();
  ctx.fillStyle = css;
  ctx.shadowColor = css; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(x, y, w * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, w * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A drawing: any shape, stroked; draws on, undraws, morphs into another shape. */
class Line extends El {
  constructor(sc, sh, o = {}) {
    super(sc, "line", o);
    this.stages = [{ sh: S.shape(sh), t0: -Infinity, t1: -Infinity }];
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.base.width = o.width ?? (o.thin ? 2 : sc.look.width);
    this.stroke = o.stroke ?? sc.stroke;
    this.mode = o.mode || "all";
    this.fill = o.fill ? colour(sc.pal, o.fill) : null;
    this.fillAlpha = o.fillAlpha ?? 0.18;
    // a halftone dot grid inside the closed parts: tone and volume, the way the reference shades a form
    this.dots = o.dots ? { size: 0.8, shade: "flat", light: [-0.55, -0.85], alpha: 0.8, ...(o.dots === true ? {} : o.dots) } : null;
    if (this.dots) this.dots.rgb = colour(sc.pal, this.dots.color ?? o.color ?? "ink");
    // engraved hatching inside the closed parts: parallel lines where the form turns from the light, crossed in the shadows
    this.hatch = o.hatch ? { gap: 7, angle: -35, shade: "light", light: [-0.55, -0.85], alpha: 0.75, width: 1.1, cross: true, ...(o.hatch === true ? {} : o.hatch) } : null;
    if (this.hatch) this.hatch.rgb = colour(sc.pal, this.hatch.color ?? o.color ?? "ink");
    this.tip = o.tip ?? true;
    this.seed = G.hash(this.id) * 100;
    const b = G.bounds(this.stages[0].sh);
    this.big = Math.max(b.w, b.h) * (o.scale ?? 1) > 300;
    if (o.in !== false) this.in(o.in, { at: o.at, delay: o.delay, dur: o.dur, ease: o.ease });
  }
  defaultIn() { return "draw"; }
  inDur(how) {
    if (how !== "draw") return 0.45;
    let L = 0;
    for (const p of this.stages[0].sh.paths) L += G.pathLength(p);
    return clamp((L * (this.o.scale ?? 1)) / (this.mode === "seq" ? 1400 : 1100), 0.45, 1.5);
  }
  /** Morph into another shape: el.morph(S.bust(), { at, dur, ease }) */
  morph(sh, o = {}) {
    const t0 = this.sc.time(o.at, o.delay), dur = o.dur ?? 1.1;
    this.stages.push({ sh: S.shape(sh), t0, t1: t0 + dur, e: ease(o.ease || "inOut") });
    this.stages.sort((a, b) => a.t0 - b.t0);
    this.sc.cue("morph", t0, { dur });
    return this;
  }
  stageAt(t) {
    let i = 0;
    while (i + 1 < this.stages.length && this.stages[i + 1].t0 <= t) i++;
    return i;
  }
  paths(t) {
    const i = this.stageAt(t), st = this.stages[i];
    if (i === 0 || t >= st.t1) return st.sh.paths;
    st.pairs ||= G.morphPairs(this.stages[i - 1].sh, st.sh);
    return G.morphAt(st.pairs, st.e((t - st.t0) / (st.t1 - st.t0)));
  }
  anchors(t) { return this.stages[this.stageAt(t ?? this.sc.time())].sh.anchors; }
  /** world points, for the layout audit (only once drawn) */
  points(t) {
    if (this.v("draw", t) < 0.99 || this.v("drawStart", t) > 0.01) return [];
    const m = this.matrix(t), out = [];
    for (const p of this.paths(t)) for (let i = 0; i < p.pts.length; i += 6) out.push(apply(m, p.pts[i], p.pts[i + 1]));
    return out;
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), css = rgbCss(this.col(t)), w = this.v("width", t);
    const d1 = this.v("draw", t), d0 = this.v("drawStart", t);
    if (d1 <= d0) return;
    const paths = this.paths(t);
    const world = paths.map((p) => {
      const pts = new Array(p.pts.length);
      for (let i = 0; i < p.pts.length; i += 2) { const q = apply(m, p.pts[i], p.pts[i + 1]); pts[i] = q[0]; pts[i + 1] = q[1]; }
      return { pts, closed: p.closed, alpha: p.alpha ?? 1 };
    });
    ctx.save();
    if (this.dots && d0 <= 0) this.drawDots(ctx, world, a * this.dots.alpha * smooth(0.3, 1, d1), m);
    if (this.hatch && d0 <= 0) this.drawHatch(ctx, world, a * this.hatch.alpha * smooth(0.3, 1, d1));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const st = { css, width: w, stroke: this.stroke, seed: this.seed, t, dash: this.o.dash, gap: this.o.gap };
    let tips = [];
    const whole = d0 <= 0 && d1 >= 1;
    const total = this.mode === "seq" ? world.reduce((s, p) => s + G.pathLength(p), 0) : 0;
    let acc = 0;
    for (const p of world) {
      ctx.globalAlpha = a * p.alpha;
      let lo = d0, hi = d1;
      if (this.mode === "seq" && !whole) {
        const L = G.pathLength(p), s0 = acc / total, s1 = (acc + L) / total;
        acc += L;
        lo = clamp((d0 - s0) / (s1 - s0)); hi = clamp((d1 - s0) / (s1 - s0));
        if (hi <= lo) continue;
      }
      if (this.fill && p.closed && whole) {
        ctx.save(); ctx.globalAlpha = a * this.fillAlpha; ctx.fillStyle = css;
        strokePts(ctx, p.pts, true); ctx.fill(); ctx.restore();
      }
      const part = lo <= 0 && hi >= 1 ? p : { pts: G.slice(p, lo, hi), closed: false };
      paint(ctx, part, st);
      if (!whole && this.tip && this.drawing && t > this.drawing.t0 && t < this.drawing.t1 + 0.05 && hi < 0.999 && part.pts.length >= 2)
        tips.push([part.pts[part.pts.length - 2], part.pts[part.pts.length - 1]]);
    }
    ctx.globalAlpha = a;
    for (const [x, y] of tips.slice(0, 6)) tipDot(ctx, x, y, w, css);
    drawPulses(ctx, this, t, m);
    ctx.restore();
  }
  /** hatching, clipped to the closed paths: line density follows the shade (dark where the form turns away) */
  drawHatch(ctx, world, a) {
    const shut = world.filter((p) => p.closed && p.pts.length >= 6), H = this.hatch;
    if (!shut.length || a <= 0.002) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of shut) for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]); x1 = Math.max(x1, p.pts[i]); y0 = Math.min(y0, p.pts[i + 1]); y1 = Math.max(y1, p.pts[i + 1]);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 || 1, diag = Math.hypot(x1 - x0, y1 - y0) / 2 + H.gap;
    const n = Math.hypot(H.light[0], H.light[1]) || 1, lx = H.light[0] / n, ly = H.light[1] / n;
    const dark = (x, y) => {
      const u = (x - cx) / R, v = (y - cy) / R, lit = clamp(0.5 + 0.5 * (u * lx + v * ly));
      return H.shade === "sphere" ? clamp(Math.hypot(u, v) ** 2 * 0.8 + (1 - lit) * 0.5) : H.shade === "flat" ? 0.7 : clamp(1.15 - 1.2 * lit);
    };
    ctx.save();
    ctx.beginPath();
    for (const p of shut) { ctx.moveTo(p.pts[0], p.pts[1]); for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]); ctx.closePath(); }
    ctx.clip(H.rule || "nonzero");
    ctx.strokeStyle = rgbCss(H.rgb); ctx.lineWidth = H.width; ctx.lineCap = "round";
    const LV = 5, buckets = Array.from({ length: LV }, () => []), seg = 6;
    const pass = (deg, min) => {
      const ca = Math.cos((deg * Math.PI) / 180), sa = Math.sin((deg * Math.PI) / 180);
      for (let off = -diag; off <= diag; off += H.gap) for (let s = -diag; s < diag; s += seg) {
        const xa = cx - sa * off + ca * s, ya = cy + ca * off + sa * s, xb = xa + ca * seg, yb = ya + sa * seg, k = dark((xa + xb) / 2, (ya + yb) / 2);
        if (k <= min) continue;
        buckets[Math.min(LV - 1, Math.floor(((k - min) / (1 - min)) * LV))].push(xa, ya, xb, yb);
      }
    };
    pass(H.angle, 0.12);
    if (H.cross) pass(H.angle + 90, 0.55);
    buckets.forEach((b, i) => {
      if (!b.length) return;
      ctx.globalAlpha = a * ((i + 1) / LV);
      ctx.beginPath();
      for (let j = 0; j < b.length; j += 4) { ctx.moveTo(b[j], b[j + 1]); ctx.lineTo(b[j + 2], b[j + 3]); }
      ctx.stroke();
    });
    ctx.restore();
  }
  /** the dot grid, clipped to the closed paths; shade: flat, sphere (round form), light (lit from `light`), edge (rim) */
  drawDots(ctx, world, a, m) {
    const shut = world.filter((p) => p.closed && p.pts.length >= 6), D = this.dots;
    if (!shut.length || a <= 0.002) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of shut) for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]); x1 = Math.max(x1, p.pts[i]); y0 = Math.min(y0, p.pts[i + 1]); y1 = Math.max(y1, p.pts[i + 1]);
    }
    // on a look with a dot screen the grid snaps to its cells (a multiple of the pitch, on the cell centres), so they never beat
    const cell = this.sc.look.cell, want = D.gap ?? cell ?? 8, g = cell ? Math.max(cell, Math.round(want / cell) * cell) : want;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 || 1;
    const n = Math.hypot(D.light[0], D.light[1]) || 1, lx = D.light[0] / n, ly = D.light[1] / n;
    ctx.save();
    ctx.beginPath();
    for (const p of shut) { ctx.moveTo(p.pts[0], p.pts[1]); for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]); ctx.closePath(); }
    ctx.clip(D.rule || "nonzero"); // "evenodd" leaves holes (a pupil, a ring)
    ctx.globalAlpha = a; ctx.fillStyle = rgbCss(D.rgb);
    ctx.beginPath();
    const ox = cell ? cell / 2 : ((m[4] % g) + g) % g, oy = cell ? cell / 2 : ((m[5] % g) + g) % g; // else the grid travels with the drawing
    for (let y = Math.floor((y0 - oy) / g) * g + oy; y <= y1 + g; y += g) {
      for (let x = Math.floor((x0 - ox) / g) * g + ox; x <= x1 + g; x += g) {
        const u = (x - cx) / R, v = (y - cy) / R, lit = clamp(0.5 + 0.5 * (u * lx + v * ly));
        const k = D.shade === "sphere" ? Math.sqrt(Math.max(0, 1 - u * u - v * v)) * (0.55 + 0.45 * lit)
          : D.shade === "light" ? 0.15 + 0.85 * lit
          : D.shade === "edge" ? clamp(Math.hypot(u, v)) ** 1.5
          : 1;
        const r = 0.5 * g * D.size * k;
        if (r < 0.4) continue;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawPulses(ctx, el, t, m) {
  for (const l of el.pulses(t)) {
    const per = l.period ?? 1.6, c = rgbCss(colour(el.sc.pal, l.color ?? el.o.color ?? "accent"));
    const [x, y] = apply(m, ...(l.anchor ? el.anchors(t)[l.anchor] || [0, 0] : [0, 0]));
    for (let k = 0; k < 2; k++) {
      const age = (t - l.t0) / per - k * 0.5;
      if (age < 0) continue;
      const f = age - Math.floor(age), born = l.t0 + (Math.floor(age) + k * 0.5) * per;
      if (born > l.t1) continue;
      ctx.globalAlpha = el.alpha(t) * (1 - f) * 0.8;
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, (l.r0 ?? 8) + ((l.r1 ?? 60) - (l.r0 ?? 8)) * EASE.out(f), 0, Math.PI * 2); ctx.stroke();
    }
  }
}

/** A wavy ring: the breathing waveform circle round the hero, or a soft blob (n small). */
class Wave extends El {
  constructor(sc, o = {}) {
    super(sc, "wave", o);
    Object.assign(this.base, { r: o.r ?? 330, amp: o.amp ?? 9, jag: o.jag ?? 0, color: colour(sc.pal, o.color ?? "calm"), width: o.width ?? 3 });
    this.n = o.n ?? 34; this.speed = o.speed ?? 1.2; this.seed = o.seed ?? G.hash(this.id) * 50; this.wobble = o.wobble ?? 0.5;
    this.big = true;
    this.stroke = o.stroke ?? "mono";
    if (o.in !== false) this.in(o.in, { at: o.at, delay: o.delay, dur: o.dur });
  }
  defaultIn() { return "draw"; }
  inDur() { return 1.1; }
  points(t) {
    const m = this.matrix(t), r = this.v("r", t), out = [];
    for (let i = 0; i < 180; i++) { const a = (i / 180) * Math.PI * 2; out.push(apply(m, Math.sin(a) * r, -Math.cos(a) * r)); }
    return out;
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), r = this.v("r", t), amp = this.v("amp", t), jag = this.v("jag", t);
    const d1 = this.v("draw", t), d0 = this.v("drawStart", t), N = 360;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const k = i / N;
      if (k < d0 - 1e-6 || k > d1 + 1e-6) continue;
      let rr = r + amp * (0.6 * Math.sin(this.n * th + t * this.speed * 2) + this.wobble * (G.noise2(Math.cos(th) * 1.6 + this.seed, Math.sin(th) * 1.6 + t * 0.35) - 0.5) * 2);
      if (jag) rr += jag * (G.noise2(i * 0.9 + this.seed, t * 9) - 0.5) * 2;
      const q = apply(m, Math.sin(th) * rr, -Math.cos(th) * rr);
      pts.push(q[0], q[1]);
    }
    if (pts.length < 4) return;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = "round"; ctx.lineJoin = "round";
    paint(ctx, { pts, closed: d0 <= 0 && d1 >= 1 }, { css: rgbCss(this.col(t)), width: this.v("width", t), stroke: this.stroke, seed: this.seed, t });
    ctx.restore();
  }
}

/** A circle or arc (degrees, 0 = up, clockwise), optional ticks round it and knots on it. */
class Ring extends El {
  constructor(sc, o = {}) {
    super(sc, "ring", o);
    Object.assign(this.base, { r: o.r ?? 300, from: o.from ?? 0, to: o.to ?? 360, color: colour(sc.pal, o.color ?? "dim"), width: o.width ?? 2 });
    this.dash = o.dash; this.ticks = o.ticks; this.knots = o.knots; this.stroke = o.stroke ?? (o.dash ? "dashed" : "mono");
    if (o.in !== false) this.in(o.in, { at: o.at, delay: o.delay, dur: o.dur });
  }
  defaultIn() { return "draw"; }
  inDur() { return 0.9; }
  points(t) {
    if (this.v("width", t) <= 0) return [];
    const m = this.matrix(t), r = this.v("r", t), f = this.v("from", t), to = this.v("to", t), out = [];
    const n = Math.max(12, Math.ceil(Math.abs(to - f) / 2));
    for (let i = 0; i <= n; i++) { const a = ((f + ((to - f) * i) / n) * Math.PI) / 180; out.push(apply(m, Math.sin(a) * r, -Math.cos(a) * r)); }
    return out;
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), r = this.v("r", t), f = this.v("from", t), to = this.v("to", t);
    const d1 = this.v("draw", t), d0 = this.v("drawStart", t);
    const A = f + (to - f) * d0, B = f + (to - f) * d1;
    const css = rgbCss(this.col(t)), w = this.v("width", t), s = mscale(m);
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = "round";
    const pt = (deg, rr) => apply(m, Math.sin((deg * Math.PI) / 180) * rr, -Math.cos((deg * Math.PI) / 180) * rr);
    if (B > A && w > 0) {
      const n = Math.max(8, Math.ceil(Math.abs(B - A) * r * s / 400)), pts = [];
      for (let i = 0; i <= n; i++) pts.push(...pt(A + ((B - A) * i) / n, r));
      paint(ctx, { pts, closed: false }, { css, width: w, stroke: this.stroke, dash: this.dash, t, seed: this.id });
    }
    if (this.ticks) {
      const tk = this.ticks, n = tk.n ?? 60;
      ctx.strokeStyle = tk.color ? rgbCss(colour(this.sc.pal, tk.color)) : css; ctx.lineWidth = lw(tk.width ?? 1.5);
      for (let i = 0; i < n; i++) {
        const deg = (i / n) * 360;
        if (deg > (B - f) + f + 1e-6 && !(B >= to)) continue;
        const major = tk.every && i % tk.every === 0, len = major ? (tk.major ?? (tk.len ?? 8) * 2) : tk.len ?? 8;
        const p0 = pt(deg, r + (tk.offset ?? 6)), p1 = pt(deg, r + (tk.offset ?? 6) + len);
        ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke();
      }
    }
    if (this.knots) {
      ctx.fillStyle = css;
      for (const deg of this.knots) if (deg >= A && deg <= B) {
        const [x, y] = pt(deg, r);
        ctx.beginPath(); ctx.arc(x, y, w * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawPulses(ctx, this, t, m);
    ctx.restore();
  }
}

/* ---------- text ---------- */

const GLITCH = "▮▯01#%*+=-/<>";
function fontCss(sc, o) {
  const fam = FONTS[o.font] || o.font || FONTS[sc.look.hud] || FONTS.mono;
  return `${o.weight ?? (o.font === "sans" ? 600 : 500)} ${o.size}px "${fam}", ${o.font === "serif" ? "Georgia, serif" : o.font === "sans" ? "Helvetica, Arial, sans-serif" : "ui-monospace, Menlo, monospace"}`;
}

/** Text: HUD labels and readouts (mono, tracked, uppercase) by default; any font with `font`. */
class Text extends El {
  constructor(sc, str, o = {}) {
    super(sc, "text", { ...o });
    const hud = !o.font || o.font === "hud";
    this.f = { font: hud ? sc.look.hud : o.font, size: o.size ?? 22, weight: o.weight };
    if (this.f.font === "pixel") this.f.size = Math.round(this.f.size * 1.35);
    if (this.f.font === "hand") this.f.size = Math.round(this.f.size * 1.3);
    if (!o.layer && (sc.crispText || (sc.look.smallText && this.f.size < sc.look.smallText))) { this.layer = "ui"; this.follow = true; }
    // a format that shows the picture smaller keeps its words closer to their size, so they stay readable
    if (sc.textBoost !== 1) this.f.size = Math.round(this.f.size * sc.textBoost);
    this.upper = o.upper ?? hud;
    this.track = o.track ?? (hud ? 0.16 : 0);
    this.align = o.align ?? "center";
    this.texts = new Track(this.fmt(str));
    this.base.chars = 1;
    this.base.color = colour(sc.pal, o.color ?? "ink");
    if (o.in !== false) this.in(o.in, { at: o.at, delay: o.delay, dur: o.dur });
  }
  fmt(s) { s = String(s); return this.upper ? s.toUpperCase() : s; }
  defaultIn() { return "type"; }
  inDur(how) { return how === "type" ? clamp(this.texts.base.length * 0.035, 0.25, 0.9) : 0.4; }
  /** Change the words: el.swap("ON ITS WAY", { at, how: "type" | "cut" }) */
  swap(str, o = {}) {
    const t = this.sc.time(o.at, o.delay);
    this.texts.add(t, 1e-4, this.fmt(str), "step");
    if ((o.how ?? "type") === "type") {
      this.tr("chars").add(t - 1e-3, 1e-4, 0, "linear");
      this.tr("chars").add(t, clamp(String(str).length * 0.035, 0.2, 0.8), 1, "linear");
      this.sc.cue("type", t, { dur: 0.4 });
    }
    return this;
  }
  str(t) { return this.texts.at(t); }
  /** the frame-space box of the words, for the layout audit */
  box(ctx, t) {
    const s = this.str(t);
    if (!s || this.v("chars", t) < 0.99) return null;
    ctx.save(); ctx.font = fontCss(this.sc, this.f);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${this.track * this.f.size}px`;
    const w = ctx.measureText(s).width; ctx.restore();
    const x0 = this.align === "center" ? -w / 2 : this.align === "right" ? -w : 0, h = this.f.size * 0.4;
    return aabb(this.matrix(t), x0, -h, x0 + w, h);
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    let s = this.str(t);
    const k = this.v("chars", t);
    if (k < 1) {
      const n = Math.floor(s.length * k), q = Math.floor(t * 30);
      s = s.slice(0, n) + (n < s.length ? [0, 1].map((i) => GLITCH[Math.floor(G.hash(q + i + this.id) * GLITCH.length)]).join("").slice(0, s.length - n) : "");
    }
    const m = this.matrix(t);
    ctx.save();
    ctx.globalAlpha = a;
    const k2 = this.sc.rs || 1;
    ctx.setTransform(m[0] * k2, m[1] * k2, m[2] * k2, m[3] * k2, m[4] * k2, m[5] * k2);
    ctx.font = fontCss(this.sc, this.f);
    ctx.fillStyle = rgbCss(this.col(t));
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${this.track * this.f.size}px`;
    const w = ctx.measureText(s).width;
    const x = this.align === "center" ? -w / 2 : this.align === "right" ? -w : 0;
    ctx.fillText(s, x + (this.align === "center" ? (this.track * this.f.size) / 2 : 0), 0);
    ctx.restore();
  }
}

/** A number that counts: format int, clock (HH:MM:SS), mmss, pct, money, x (0.5×), or a function. */
class Counter extends Text {
  constructor(sc, o = {}) {
    super(sc, "", { ...o, in: false, upper: false });
    this.base.value = o.from ?? o.value ?? 0;
    this.format = o.format || "int";
    this.texts = { at: (t) => this.render(this.v("value", t)), base: "00000" };
    if (o.to != null) this.to({ value: o.to }, { at: o.at, delay: o.delay, dur: o.dur ?? 2, ease: o.ease || "linear" });
    if (o.in !== false) this.in(o.in ?? "fade", { at: o.at, delay: o.delay, dur: 0.3 });
  }
  render(v) {
    const f = this.format;
    if (typeof f === "function") return f(v);
    const p = (n) => String(Math.floor(n)).padStart(2, "0");
    if (f === "clock") { v = Math.max(0, Math.ceil(v)); return `${p(v / 3600)}:${p((v % 3600) / 60)}:${p(v % 60)}`; }
    if (f === "mmss") { v = Math.max(0, Math.ceil(v)); return `${Math.floor(v / 60)}:${p(v % 60)}`; }
    if (f === "pct") return `${Math.round(v)}%`;
    if (f === "money") return `$${Math.round(v).toLocaleString("en-US")}`;
    if (f === "x") return `${v.toFixed(1)}×`;
    if (f === "1") return v.toFixed(1);
    return String(Math.round(v));
  }
}

/* ---------- groups and composites ---------- */

class Group extends El {
  constructor(sc, o = {}) {
    super(sc, "group", o);
    this.kids = [];
    if (o.in !== false) this.in("cut", { at: o.at, delay: o.delay });
  }
  draw() {}
}

/** Particles: stars, dust, rise, fall, orbit, converge, burst. Deterministic per index. */
class Particles extends El {
  constructor(sc, o = {}) {
    super(sc, "particles", o);
    this.k = o.kind || "stars";
    this.n = o.count ?? 60;
    this.area = { w: o.w ?? 900, h: o.h ?? 900, r: o.r ?? 300 };
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.size = o.size ?? 2.4; this.speed = o.speed ?? 1; this.seed = o.seed ?? this.id;
    this.dur = o.dur ?? 1.4;
    if (o.in !== false) this.in(o.in ?? (this.k === "burst" ? "cut" : "fade"), { at: o.at, delay: o.delay, dur: o.inDur ?? 0.8 });
    if (this.k === "burst") sc.cue("sparkle", this.shown ?? this.born);
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), r = G.rng(this.seed), css = rgbCss(this.col(t)), age = t - (this.shown ?? this.born);
    const { w, h, r: R } = this.area;
    ctx.save(); ctx.fillStyle = css; ctx.strokeStyle = css;
    for (let i = 0; i < this.n; i++) {
      const u = r(), v = r(), ph = r() * 10, sp = (0.4 + r()) * this.speed, sz = this.size * (0.5 + r());
      let x, y, al = 1, trail = 0;
      switch (this.k) {
        case "stars": x = (u - 0.5) * w; y = (v - 0.5) * h; al = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * sp * 2.2 + ph)); break;
        case "dust": x = ((u * w + t * sp * 14) % w) - w / 2; y = ((v * h - t * sp * 9 + h * 10) % h) - h / 2; al = 0.6 * (0.5 + 0.5 * Math.sin(t * sp + ph)); break;
        case "rise": { const f = (v + t * sp * 0.12) % 1; x = (u - 0.5) * w + Math.sin(t + ph) * 8; y = h / 2 - f * h; al = Math.sin(f * Math.PI); break; }
        case "fall": { const f = (v + t * sp * 0.15) % 1; x = (u - 0.5) * w; y = -h / 2 + f * h; al = Math.sin(f * Math.PI); trail = 26 * sp; break; }
        case "orbit": { const ang = ph + t * sp * 0.6, rr = R * (0.55 + u * 0.6); x = Math.cos(ang) * rr; y = Math.sin(ang) * rr * (this.o.tilt ?? 0.35); al = 0.5 + 0.5 * Math.sin(ang); break; }
        case "converge": { const f = (v + t * sp * 0.25) % 1, ang = u * Math.PI * 2, rr = R * (1 - EASE.in(f)); x = Math.cos(ang) * rr; y = Math.sin(ang) * rr; al = smooth(0, 0.2, f) * (1 - smooth(0.85, 1, f)); break; }
        case "burst": { const f = clamp(age / (this.dur * (0.6 + 0.4 * v))), ang = u * Math.PI * 2, rr = R * EASE.out(f) * (0.4 + 0.6 * v); x = Math.cos(ang) * rr; y = Math.sin(ang) * rr; al = 1 - f; trail = 14 * (1 - f); break; }
      }
      if (al <= 0.01) continue;
      const [X, Y] = apply(m, x, y);
      ctx.globalAlpha = a * al;
      if (trail) {
        ctx.lineWidth = sz * 0.7;
        const [X2, Y2] = this.k === "fall" ? apply(m, x, y - trail) : apply(m, x * (1 - trail / R / 2), y * (1 - trail / R / 2));
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X2, Y2); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(X, Y, sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

/** A glowing orb: a solid core with a halftone halo (the reference's light, "you", a sun, a blessing). */
class Orb extends El {
  constructor(sc, o = {}) {
    super(sc, "orb", o);
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.r = o.r ?? 12; this.halo = o.halo ?? 4.5; this.gap = o.gap ?? 7;
    if (o.in !== false) this.in(o.in ?? "pop", { at: o.at, delay: o.delay, dur: o.dur });
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), s = mscale(m), X = m[4], Y = m[5], R = this.r * s, H = R * this.halo, rgb = this.col(t), css = rgbCss(rgb);
    const cell = this.sc.look.cell, g = cell ? Math.max(cell, Math.round(this.gap / cell) * cell) : this.gap, o = cell ? cell / 2 : 0;
    ctx.save();
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = css;
    ctx.beginPath();
    // halo dots on the screen's grid (or round the centre), smaller as they leave the core
    const gx0 = cell ? Math.floor((X - H - o) / g) * g + o : X - Math.floor(H / g) * g, gy0 = cell ? Math.floor((Y - H - o) / g) * g + o : Y - Math.floor(H / g) * g;
    for (let y = gy0; y <= Y + H; y += g) for (let x = gx0; x <= X + H; x += g) {
      const d = Math.hypot(x - X, y - Y) / H;
      if (d >= 1 || d * H < R * 0.9) continue;
      const r = g * 0.46 * (1 - d) ** 1.4;
      if (r < 0.35) continue;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = a; ctx.shadowColor = css; ctx.shadowBlur = R * 1.6;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = rgbCss(rgb.map((c) => c + (255 - c) * 0.7));
    ctx.beginPath(); ctx.arc(X, Y, R * 0.7, 0, Math.PI * 2); ctx.fill();
    drawPulses(ctx, this, t, m);
    ctx.restore();
  }
}

/* ---------- matter: particles that take shapes, 3D forms, flow fields ----------
 * Everything here is a pure function of time (no state carried from frame to frame), so the preview can scrub
 * and the renderer's workers can draw any frame on its own. */

/** Points for a swarm target, in frame coordinates: a shape (on its outline and inside its closed parts,
 *  denser where `shade` says), a kind (cloud, field, ring, disc, line, point) or a list of [x, y]. */
function samplePoints(n, src, o, seed) {
  const r = G.rng(seed), out = new Float32Array(n * 2);
  if (Array.isArray(src)) {
    for (let i = 0; i < n; i++) { const p = src[i % src.length]; out[2 * i] = p[0]; out[2 * i + 1] = p[1]; }
    return out;
  }
  if (typeof src === "string" || (src && src.kind)) {
    const k = typeof src === "string" ? { kind: src } : src, X = k.x ?? o.x ?? STAGE.cx, Y = k.y ?? o.y ?? STAGE.cy;
    for (let i = 0; i < n; i++) {
      let x = X, y = Y;
      if (k.kind === "cloud") {
        const a = r() * Math.PI * 2, d = Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * 0.42;
        x += (Math.cos(a) * d * (k.w ?? 600)) / 2; y += (Math.sin(a) * d * (k.h ?? k.w ?? 600)) / 2;
      } else if (k.kind === "field") { x += (r() - 0.5) * (k.w ?? 1080); y += (r() - 0.5) * (k.h ?? 1920); }
      else if (k.kind === "ring") { const a = r() * Math.PI * 2, rr = (k.r ?? 300) * (1 + (r() - 0.5) * (k.spread ?? 0.08)); x += Math.cos(a) * rr; y += Math.sin(a) * rr; }
      else if (k.kind === "disc") { const a = r() * Math.PI * 2, rr = (k.r ?? 300) * Math.sqrt(r()); x += Math.cos(a) * rr; y += Math.sin(a) * rr; }
      else if (k.kind === "line") { const f = r(), s = k.spread ?? 4; x = k.x1 + (k.x2 - k.x1) * f + (r() - 0.5) * s; y = k.y1 + (k.y2 - k.y1) * f + (r() - 0.5) * s; }
      else { x += (r() - 0.5) * (k.r ?? 3); y += (r() - 0.5) * (k.r ?? 3); }
      out[2 * i] = x; out[2 * i + 1] = y;
    }
    return out;
  }
  const sh = S.place(S.shape(src), { x: o.x ?? STAGE.cx, y: o.y ?? STAGE.cy, scale: o.scale ?? 1, rot: o.rot ?? 0 });
  const paths = sh.paths.filter((p) => p.pts.length >= 4), closed = paths.filter((p) => p.closed);
  const nEdge = Math.round(n * (closed.length ? o.edge ?? 0.35 : 1));
  const lens = paths.map((p) => G.pathLength(p)), total = lens.reduce((a, b) => a + b, 0) || 1, jit = o.jitter ?? 2.5;
  for (let i = 0; i < nEdge; i++) {
    let d = r() * total, k = 0;
    while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
    const [x, y] = G.pointAt(paths[k], d);
    out[2 * i] = x + (r() - 0.5) * jit; out[2 * i + 1] = y + (r() - 0.5) * jit;
  }
  if (nEdge < n) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of closed) for (let j = 0; j < p.pts.length; j += 2) { x0 = Math.min(x0, p.pts[j]); x1 = Math.max(x1, p.pts[j]); y0 = Math.min(y0, p.pts[j + 1]); y1 = Math.max(y1, p.pts[j + 1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 || 1, L = o.light ?? [-0.55, -0.85], ln = Math.hypot(L[0], L[1]) || 1;
    const inside = (x, y) => {
      let c = false;
      for (const p of closed) { const q = p.pts; for (let a = 0, b = q.length - 2; a < q.length; b = a, a += 2) if ((q[a + 1] > y) !== (q[b + 1] > y) && x < ((q[b] - q[a]) * (y - q[a + 1])) / (q[b + 1] - q[a + 1]) + q[a]) c = !c; }
      return c;
    };
    const keep = (x, y) => {
      const u = (x - cx) / R, v = (y - cy) / R, lit = clamp(0.5 + 0.5 * ((u * L[0]) / ln + (v * L[1]) / ln));
      return o.shade === "sphere" ? Math.sqrt(Math.max(0, 1 - u * u - v * v)) * (0.5 + 0.5 * lit) : o.shade === "light" ? 0.15 + 0.85 * lit : o.shade === "edge" ? clamp(Math.hypot(u, v)) ** 1.5 : 1;
    };
    let i = nEdge;
    for (let tries = 0; i < n && tries < n * 80; tries++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (!inside(x, y) || r() > keep(x, y)) continue;
      out[2 * i] = x; out[2 * i + 1] = y; i++;
    }
    for (let j = i; j < n; j++) { const s = Math.floor(r() * Math.max(1, i)); out[2 * j] = out[2 * s]; out[2 * j + 1] = out[2 * s + 1]; }
  }
  return out;
}
/** Reorder points so particle i lands somewhere related to where it came from: by angle round the centre, or by x / y. */
function orderPts(p, mode) {
  if (mode === "random") return p;
  const n = p.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cy += p[2 * i + 1]; }
  cx /= n; cy /= n;
  const key = new Float32Array(n), idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i++) key[i] = mode === "x" ? p[2 * i] : mode === "y" ? p[2 * i + 1] : Math.atan2(p[2 * i + 1] - cy, p[2 * i] - cx);
  idx.sort((a, b) => key[a] - key[b]);
  const out = new Float32Array(p.length);
  idx.forEach((j, i) => { out[2 * i] = p[2 * j]; out[2 * i + 1] = p[2 * j + 1]; });
  return out;
}
const rotAbout = (x, y, c, deg) => {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), dx = x - c[0], dy = y - c[1];
  return [c[0] + dx * ca - dy * sa, c[1] + dx * sa + dy * ca];
};

/** A swarm: thousands of glowing points that take a shape, then fly (swirling, in a wave) into the next one,
 *  scatter into a cloud or burst outwards. add.swarm({ shape, count, size, color, mix }) then .form(shape, o). */
class Swarm extends El {
  constructor(sc, o = {}) {
    super(sc, "swarm", { ...o, x: 0, y: 0, scale: 1 });
    this.n = o.count ?? 2400;
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.mix = o.mix ? { rgb: colour(sc.pal, o.mix.color ?? "accent"), share: o.mix.share ?? 0.15 } : null;
    this.size = o.size ?? 2.2; this.drift = o.drift ?? 4; this.twinkle = o.twinkle ?? 0.45;
    this.seed = o.seed ?? Math.floor(G.hash(this.id + 0.5) * 9973);
    this.h = new Float32Array(this.n * 3);
    const r = G.rng(this.seed + 7);
    for (let i = 0; i < this.h.length; i++) this.h[i] = r();
    this.stages = [{ t0: -Infinity, t1: -Infinity, pts: this.make(o.shape ?? "cloud", o, 0), spin: o.spin ?? 0, c: [o.x ?? STAGE.cx, o.y ?? STAGE.cy] }];
    if (o.in !== false) this.in(o.in ?? "fade", { at: o.at, delay: o.delay, dur: o.dur ?? 0.8 });
  }
  make(src, o, k) { return orderPts(samplePoints(this.n, src, o, this.seed + k * 101), o.order ?? "angle"); }
  /** Become a new shape: { x, y, scale, rot, at, delay, dur, swirl (px), stagger (0–1), from (left|right|top|bottom|center), edge, shade, order, spin (°/s), ease } */
  form(src, o = {}) {
    const t0 = this.sc.time(o.at, o.delay), dur = o.dur ?? 1.6;
    this.stages.push({ t0, t1: t0 + dur, pts: this.make(src, o, this.stages.length), e: ease(o.ease || "inOut"), swirl: o.swirl ?? 90, stagger: o.stagger ?? 0.35, from: o.from ?? null, spin: o.spin ?? 0, c: [o.x ?? (src && src.x) ?? STAGE.cx, o.y ?? (src && src.y) ?? STAGE.cy] });
    this.stages.sort((a, b) => a.t0 - b.t0);
    this.sc.cue("whoosh", t0, { dur: Math.min(dur, 1.4), gain: 0.6 });
    return this;
  }
  scatter(o = {}) { return this.form({ kind: "cloud", x: o.x, y: o.y, w: o.w ?? 1100, h: o.h ?? 1500 }, { order: "random", swirl: 140, ...o }); }
  burst(o = {}) { this.sc.cue("sparkle", this.sc.time(o.at, o.delay)); return this.form({ kind: "ring", x: o.x, y: o.y, r: o.r ?? 700, spread: 0.7 }, { ease: "out", dur: 1.3, swirl: 40, stagger: 0.12, ...o }); }
  where(i, t, s) {
    const st = this.stages[s], P = st.pts;
    let x = P[2 * i], y = P[2 * i + 1];
    if (st.spin && t > st.t1) [x, y] = rotAbout(x, y, st.c, st.spin * (t - Math.max(st.t1, this.born)));
    return [x, y];
  }
  pos(i, t) {
    let s = this.stages.length - 1;
    while (s > 0 && this.stages[s].t0 > t) s--;
    const st = this.stages[s];
    let x, y;
    if (s > 0 && t < st.t1) {
      const [qx, qy] = this.where(i, st.t0, s - 1), [px, py] = [st.pts[2 * i], st.pts[2 * i + 1]];
      const h0 = this.h[3 * i], h1 = this.h[3 * i + 1];
      const lag = st.from === "left" ? px / 1080 : st.from === "right" ? 1 - px / 1080 : st.from === "top" ? py / 1920 : st.from === "bottom" ? 1 - py / 1920 : st.from === "center" ? clamp(Math.hypot(px - STAGE.cx, py - STAGE.cy) / 900) : h0;
      const k = st.e(clamp(((t - st.t0) / (st.t1 - st.t0) - lag * st.stagger) / (1 - st.stagger)));
      const sw = Math.sin(Math.PI * k) * st.swirl * (0.35 + h1), ang = G.noise2(i * 0.013 + 3.1, k * 1.8 + this.seed * 0.01) * Math.PI * 4;
      x = qx + (px - qx) * k + Math.cos(ang) * sw; y = qy + (py - qy) * k + Math.sin(ang) * sw;
    } else [x, y] = this.where(i, t, s);
    const d = this.drift;
    if (d) { x += (G.noise2(i * 0.71, t * 0.3 + 11) - 0.5) * 2 * d; y += (G.noise2(i * 0.71 + 50, t * 0.3 + 3) - 0.5) * 2 * d; }
    return [x, y];
  }
  draw(ctx, t) {
    const a = this.alpha(t) * (this.o.alpha ?? 1);
    if (a <= 0.002) return;
    const m = this.matrix(t), s0 = this.size * mscale(m), tw = this.twinkle;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pass of this.mix ? [0, 1] : [0]) {
      ctx.fillStyle = rgbCss(pass ? this.mix.rgb : this.col(t));
      for (let i = 0; i < this.n; i++) {
        const h2 = this.h[3 * i + 2];
        if (this.mix && (this.h[3 * i] < this.mix.share) !== !!pass) continue;
        const [x, y] = this.pos(i, t), [X, Y] = apply(m, x, y), s = s0 * (0.45 + h2 * 1.1);
        ctx.globalAlpha = a * (1 - tw + tw * (0.5 + 0.5 * Math.sin(t * (1.2 + 2.4 * this.h[3 * i + 1]) + h2 * 6.283)));
        ctx.fillRect(X - s / 2, Y - s / 2, s, s);
      }
    }
    ctx.restore();
  }
}

/** A 3D form that turns: sphere (dots, with craters), globe (latitude and longitude lines), rings (stacked
 *  dotted rings), torus, helix (a double strand with rungs), or your own points / lines (unit coordinates). */
class Shape3D extends El {
  constructor(sc, o = {}) {
    super(sc, "shape3d", o);
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.alt = o.altColor ? colour(sc.pal, o.altColor) : null;
    this.r = o.r ?? 260; this.size = o.size ?? 2.2; this.f = o.persp ?? 3.5; this.width = o.width ?? 1.4;
    this.tilt = o.tilt ?? 20; this.yaw = o.yaw ?? 0; this.spin = o.spin ?? 12; this.roll = o.roll ?? 0;
    // a light fixed in the view (like the Sun on the Moon): the far side of the form fades into a terminator
    this.light = o.light ? (() => { const n = Math.hypot(...o.light) || 1; return o.light.map((v) => v / n); })() : null;
    this.pts = []; this.lines = [];
    const r = G.rng(o.seed ?? 5), n = o.count ?? 2600, k = o.kind ?? "sphere", P = (x, y, z, w = 1) => this.pts.push([x, y, z, w]);
    if (k === "sphere") {
      const craters = Array.from({ length: o.craters ?? 0 }, () => { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return { c: [s * Math.cos(a), u, s * Math.sin(a)], r: 0.06 + r() * r() * 0.22 }; });
      const g = Math.PI * (3 - Math.sqrt(5));
      const jit = (o.jitter ?? 0.6) * Math.sqrt(4 / n);
      for (let i = 0; i < n; i++) {
        const y0 = 1 - (2 * (i + 0.5)) / n, s0 = Math.sqrt(1 - y0 * y0);
        let x = Math.cos(g * i) * s0 + (r() - 0.5) * jit, y = y0 + (r() - 0.5) * jit, z = Math.sin(g * i) * s0 + (r() - 0.5) * jit;
        const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
        let w = 1;
        for (const c of craters) { const d = Math.acos(clamp(x * c.c[0] + y * c.c[1] + z * c.c[2], -1, 1)); if (d < c.r) w = Math.min(w, 0.1 + 0.4 * (d / c.r) ** 2); }
        if (o.mask) w *= o.mask(Math.asin(y), Math.atan2(z, x));
        if (w > 0.02) P(x, y, z, w);
      }
      // each crater's rim: a bright ring of points round its centre
      for (const c of craters) {
        const [cx, cy, cz] = c.c, u = Math.abs(cy) < 0.9 ? [cz, 0, -cx] : [0, -cz, cy], ul = Math.hypot(...u), U = u.map((v) => v / ul);
        const V = [cy * U[2] - cz * U[1], cz * U[0] - cx * U[2], cx * U[1] - cy * U[0]], m = Math.round(c.r * 900);
        for (let q = 0; q < m; q++) {
          const a = (q / m) * Math.PI * 2 + r() * 0.05, rr = c.r * (1.02 + r() * 0.12), cr = Math.cos(rr), sr = Math.sin(rr);
          P(cr * cx + sr * (Math.cos(a) * U[0] + Math.sin(a) * V[0]), cr * cy + sr * (Math.cos(a) * U[1] + Math.sin(a) * V[1]), cr * cz + sr * (Math.cos(a) * U[2] + Math.sin(a) * V[2]), 1.6);
        }
      }
    } else if (k === "rings" || k === "globe") {
      const lat = o.lat ?? (k === "globe" ? 11 : 14), lon = o.lon ?? (k === "globe" ? 12 : 0);
      for (let j = 1; j < lat; j++) {
        const phi = -Math.PI / 2 + (Math.PI * j) / lat, y = Math.sin(phi), s = Math.cos(phi), line = [];
        for (let q = 0; q <= 72; q++) { const a = (q / 72) * Math.PI * 2; line.push([Math.cos(a) * s, y, Math.sin(a) * s]); }
        if (k === "globe") this.lines.push(line); else for (let q = 0; q < Math.round(110 * s); q++) { const a = (q / Math.round(110 * s)) * Math.PI * 2; P(Math.cos(a) * s, y, Math.sin(a) * s); }
      }
      for (let j = 0; j < lon; j++) {
        const a = (j / lon) * Math.PI, line = [];
        for (let q = 0; q <= 48; q++) { const phi = -Math.PI / 2 + (q / 48) * Math.PI; line.push([Math.cos(a) * Math.cos(phi), Math.sin(phi), Math.sin(a) * Math.cos(phi)]); }
        this.lines.push(line);
      }
    } else if (k === "torus") {
      const R = o.major ?? 0.72, rr = o.minor ?? 0.28;
      for (let i = 0; i < n; i++) { const u = r() * Math.PI * 2, v = r() * Math.PI * 2; P((R + rr * Math.cos(v)) * Math.cos(u), rr * Math.sin(v), (R + rr * Math.cos(v)) * Math.sin(u), 0.6 + 0.4 * Math.cos(v)); }
    } else if (k === "helix") {
      const turns = o.turns ?? 2.5, h = 1;
      for (const off of [0, Math.PI]) {
        const line = [];
        for (let q = 0; q <= 200; q++) { const f = q / 200, a = f * turns * Math.PI * 2 + off; line.push([Math.cos(a) * 0.38, -h + 2 * h * f, Math.sin(a) * 0.38]); }
        this.lines.push(line);
      }
      for (let q = 0; q <= turns * 10; q++) { const f = q / (turns * 10), a = f * turns * Math.PI * 2, y = -h + 2 * h * f; this.lines.push([[Math.cos(a) * 0.38, y, Math.sin(a) * 0.38], [Math.cos(a + Math.PI) * 0.38, y, Math.sin(a + Math.PI) * 0.38]]); }
    }
    for (const p of o.points || []) P(p[0], p[1], p[2], p[3] ?? 1);
    for (const l of o.lines || []) this.lines.push(l);
    if (o.in !== false) this.in(o.in ?? "fade", { at: o.at, delay: o.delay, dur: o.dur ?? 1 });
  }
  project(p, yaw, tilt) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y2 = p[1] * ct - z1 * st, z2 = p[1] * st + z1 * ct;
    const s = this.f / (this.f - z2);
    return [x1 * s, y2 * s, z2, s];
  }
  draw(ctx, t) {
    const a = this.alpha(t) * (this.o.alpha ?? 1);
    if (a <= 0.002) return;
    const m = this.matrix(t), [X, Y] = apply(m, 0, 0), K = this.r * mscale(m);
    const yaw = ((this.yaw + this.spin * (t - this.born)) * Math.PI) / 180, tilt = (this.tilt * Math.PI) / 180;
    const depth = (z) => 0.12 + 0.88 * clamp((z + 1) / 2) ** 1.4;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgbCss(this.col(t)); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = this.width; ctx.lineCap = "round";
    for (const l of this.lines) {
      let prev = null;
      for (const p of l) {
        const q = this.project(p, yaw, tilt);
        if (prev) { ctx.globalAlpha = a * depth((q[2] + prev[2]) / 2); ctx.beginPath(); ctx.moveTo(X + prev[0] * K, Y + prev[1] * K); ctx.lineTo(X + q[0] * K, Y + q[1] * K); ctx.stroke(); }
        prev = q;
      }
    }
    const L = this.light;
    for (const p of this.pts) {
      const q = this.project(p, yaw, tilt), s = this.size * q[3] * (p[3] > 1.2 ? 1.3 : 1);
      const lit = L ? clamp(0.06 + 1.1 * ((q[0] / q[3]) * L[0] + (q[1] / q[3]) * L[1] + q[2] * L[2])) : 1;
      if (lit <= 0.02) continue;
      ctx.globalAlpha = a * depth(q[2]) * Math.min(1, p[3]) * lit;
      ctx.fillRect(X + q[0] * K - s / 2, Y + q[1] * K - s / 2, s, s);
    }
    ctx.restore();
  }
}

/** A flow field: hundreds of particles streaming along a moving noise field with fading trails.
 *  kind: curl (wandering), stream (a current in `dir`), vortex (round `target`), converge (into `target`). */
class FlowField extends El {
  constructor(sc, o = {}) {
    super(sc, "field", { ...o, x: 0, y: 0, scale: 1 });
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.n = o.count ?? 420; this.life = o.life ?? 2.4; this.trail = o.trail ?? 12; this.width = o.width ?? 1.3;
    this.area = { x: o.x ?? STAGE.cx, y: o.y ?? STAGE.cy, w: o.w ?? 1080, h: o.h ?? 1300 };
    this.kind = o.kind ?? "curl"; this.speed = o.speed ?? 110; this.scl = o.noise ?? 0.0028; this.dir = o.dir ?? [1, 0];
    this.target = o.target ?? [this.area.x, this.area.y]; this.seed = o.seed ?? 3.7;
    if (o.in !== false) this.in(o.in ?? "fade", { at: o.at, delay: o.delay, dur: o.dur ?? 0.8 });
  }
  vel(x, y, t) {
    const n = G.noise2(x * this.scl + this.seed, y * this.scl + t * 0.12) * Math.PI * 4;
    let vx = Math.cos(n), vy = Math.sin(n);
    const [tx, ty] = this.target, dx = x - tx, dy = y - ty, d = Math.hypot(dx, dy) + 1;
    if (this.kind === "stream") { vx = vx * 0.45 + this.dir[0]; vy = vy * 0.45 + this.dir[1]; }
    else if (this.kind === "vortex") { vx = vx * 0.3 - dy / d; vy = vy * 0.3 + dx / d; }
    else if (this.kind === "converge") { vx = vx * 0.35 - dx / d; vy = vy * 0.35 - dy / d; }
    return [vx * this.speed, vy * this.speed];
  }
  draw(ctx, t) {
    const a = this.alpha(t) * (this.o.alpha ?? 1);
    if (a <= 0.002) return;
    const m = this.matrix(t), dt = 1 / 30, A = this.area;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgbCss(this.col(t)); ctx.lineWidth = this.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const trail = new Float32Array(this.trail * 2);
    for (let i = 0; i < this.n; i++) {
      const ph = G.hash(i * 1.37 + this.seed) * this.life, cyc = Math.floor((t + ph) / this.life), age = t + ph - cyc * this.life;
      const h1 = G.hash(i * 7.1 + cyc * 13.3 + this.seed), h2 = G.hash(i * 3.3 + cyc * 5.9 + this.seed + 1);
      let x = A.x + (h1 - 0.5) * A.w, y = A.y + (h2 - 0.5) * A.h;
      if (this.kind === "stream" && Math.abs(this.dir[0]) >= Math.abs(this.dir[1])) x = this.dir[0] > 0 ? A.x - A.w / 2 + h1 * A.w * 0.5 : A.x + A.w / 2 - h1 * A.w * 0.5;
      const steps = Math.floor(age / dt);
      let k = 0;
      for (let s = 0; s <= steps; s++) {
        trail[(k % this.trail) * 2] = x; trail[(k % this.trail) * 2 + 1] = y; k++;
        if (s === steps) break;
        const [vx, vy] = this.vel(x, y, t - age + s * dt);
        x += vx * dt; y += vy * dt;
      }
      const cnt = Math.min(k, this.trail);
      if (cnt < 2) continue;
      ctx.globalAlpha = a * Math.sin((Math.PI * age) / this.life) * 0.85;
      ctx.beginPath();
      for (let q = 0; q < cnt; q++) {
        const j = ((k - cnt + q) % this.trail) * 2, [X, Y] = apply(m, trail[j], trail[j + 1]);
        if (q) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** A spiral galaxy of particles with a bright core; spins slowly; grows out of its core. */
class Galaxy extends El {
  constructor(sc, o = {}) {
    super(sc, "galaxy", o);
    this.R = o.r ?? 200; this.arms = o.arms ?? 2; this.n = o.count ?? 900; this.spin = o.spin ?? 6; this.turns = o.turns ?? 1.25;
    this.base.color = colour(sc.pal, o.color ?? "ink");
    this.core = colour(sc.pal, o.core ?? "accent");
    this.base.grow = 1;
    if (o.in !== false) {
      const t = sc.time(o.at, o.delay);
      this.tr("opacity").add(t, 0.3, 1, "linear");
      if ((o.in ?? "grow") === "grow") { this.tr("grow").add(t - 1e-3, 1e-4, 0, "linear"); this.tr("grow").add(t, o.dur ?? 1.6, 1, "out"); }
      this.shown = t;
    }
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), g = this.v("grow", t), r = G.rng(7 + this.id), css = rgbCss(this.col(t)), core = rgbCss(this.core);
    const rot = (this.spin * t * Math.PI) / 180;
    ctx.save();
    for (let i = 0; i < this.n; i++) {
      const arm = i % this.arms, f = Math.pow(r(), 0.75), sp = (r() - 0.5) * (0.35 + f * 0.5), br = r();
      if (f > g) continue;
      const ang = (arm / this.arms) * Math.PI * 2 + f * this.turns * Math.PI * 2 + sp + rot * (1.4 - f * 0.6);
      const rr = f * this.R + (r() - 0.5) * 10;
      const [X, Y] = apply(m, Math.cos(ang) * rr, Math.sin(ang) * rr * 0.86);
      ctx.globalAlpha = a * (0.25 + 0.75 * br) * (1 - f * 0.55) * (0.6 + 0.4 * Math.sin(t * 2 + i));
      ctx.fillStyle = f < 0.18 ? core : css;
      const s = f < 0.15 ? 2.6 : 1.3 + br * 1.3;
      ctx.fillRect(X - s / 2, Y - s / 2, s, s);
    }
    const [cx, cy] = apply(m, 0, 0), s = mscale(m);
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.R * 0.28 * s * g + 1);
    grd.addColorStop(0, core); grd.addColorStop(0.25, rgbCss(this.core, 0.6)); grd.addColorStop(1, rgbCss(this.core, 0));
    ctx.globalAlpha = a; ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, this.R * 0.28 * s * g + 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Straight rays out from a point: a sunburst, or a fan (from/to in degrees). */
class Rays extends El {
  constructor(sc, o = {}) {
    super(sc, "rays", o);
    Object.assign(this.base, { r0: o.r0 ?? 60, r1: o.r1 ?? 160, color: colour(sc.pal, o.color ?? "accent"), width: o.width ?? 2 });
    this.n = o.count ?? 16; this.from = o.from ?? 0; this.toA = o.to ?? 360; this.dash = o.dash; this.vary = o.vary ?? 0;
    if (o.in !== false) this.in(o.in ?? "draw", { at: o.at, delay: o.delay, dur: o.dur ?? 0.7 });
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), r0 = this.v("r0", t), r1 = this.v("r1", t), d = this.v("draw", t), d0 = this.v("drawStart", t);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = rgbCss(this.col(t)); ctx.lineWidth = lw(this.v("width", t)); ctx.lineCap = "round";
    if (this.dash) ctx.setLineDash(this.dash);
    const full = Math.abs(this.toA - this.from) >= 360;
    for (let i = 0; i < this.n; i++) {
      const deg = this.from + ((this.toA - this.from) * (i + (full ? 0 : 0))) / (full ? this.n : Math.max(1, this.n - 1));
      const rad = (deg * Math.PI) / 180, c = Math.sin(rad), s = -Math.cos(rad);
      const len = r1 * (1 - this.vary * G.hash(i + this.id)), A = r0 + (len - r0) * d0, B = r0 + (len - r0) * d;
      if (B <= A) continue;
      ctx.beginPath(); ctx.moveTo(...apply(m, c * A, s * A)); ctx.lineTo(...apply(m, c * B, s * B)); ctx.stroke();
    }
    ctx.restore();
  }
}

/** Expanding rings that fade, once or every `every` seconds. */
class Pulse extends El {
  constructor(sc, o = {}) {
    super(sc, "pulse", o);
    this.base.color = colour(sc.pal, o.color ?? "accent");
    this.r0 = o.r0 ?? 10; this.r1 = o.r1 ?? 140; this.d = o.dur ?? 1.2; this.count = o.count ?? 1; this.every = o.every ?? this.d * 0.5;
    this.t0 = sc.time(o.at, o.delay);
    this.in("cut", { at: o.at, delay: o.delay });
    sc.cue("thump", this.t0, { gain: 0.6 });
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), s = mscale(m), [cx, cy] = apply(m, 0, 0);
    ctx.save(); ctx.strokeStyle = rgbCss(this.col(t)); ctx.lineWidth = 2.5;
    const n = this.count === Infinity ? Math.floor((t - this.t0) / this.every) + 1 : this.count;
    for (let k = Math.max(0, n - 4); k < n; k++) {
      const f = (t - this.t0 - k * this.every) / this.d;
      if (f < 0 || f > 1) continue;
      ctx.globalAlpha = a * (1 - f) * 0.9;
      ctx.beginPath(); ctx.arc(cx, cy, (this.r0 + (this.r1 - this.r0) * EASE.out(f)) * s, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

/** Dots travelling along a path (packets, energy, attention). */
class Flow extends El {
  constructor(sc, sh, o = {}) {
    super(sc, "flow", o);
    this.sh = S.shape(sh);
    this.base.color = colour(sc.pal, o.color ?? "accent");
    this.n = o.count ?? 3; this.speed = o.speed ?? 0.5; this.size = o.size ?? 5; this.once = o.once ?? false;
    if (o.in !== false) this.in(o.in ?? "fade", { at: o.at, delay: o.delay, dur: 0.3 });
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), p = this.sh.paths[0];
    if (!p) return;
    const L = G.pathLength(p), age = t - (this.shown ?? this.born), css = rgbCss(this.col(t));
    ctx.save(); ctx.fillStyle = css; ctx.shadowColor = css; ctx.shadowBlur = 12;
    for (let i = 0; i < this.n; i++) {
      let f = age * this.speed - i / this.n;
      if (this.once ? f < 0 || f > 1 : f < 0) continue;
      f = this.once ? EASE.inOut(f) : f % 1;
      const [x, y] = G.pointAt(p, f * L), [X, Y] = apply(m, x, y);
      ctx.globalAlpha = a * (this.once ? 1 : Math.sin(f * Math.PI));
      ctx.beginPath(); ctx.arc(X, Y, this.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

/** The CTA pill: rounded, filled with the caption colour, dark words; swaps to a confirmation. */
class Pill extends El {
  constructor(sc, str, o = {}) {
    super(sc, "pill", { layer: "ui", ...o, x: sc.fmt.pill[0], y: sc.fmt.pill[1] });
    this.screen = true; // placed in the frame, not in the design
    this.texts = new Track(String(str).toUpperCase());
    this.icons = new Track(o.icon ?? "chat");
    this.base.color = colour(sc.pal, o.color ?? "caption");
    this.size = o.size ?? 22;
    if (o.in !== false) this.in(o.in ?? "pop", { at: o.at, delay: o.delay, dur: 0.5 });
  }
  box(ctx, t) {
    ctx.save(); ctx.font = `700 ${this.size}px "${FONTS.sans}", Helvetica, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${this.size * 0.06}px`;
    const w = ctx.measureText(this.texts.at(t)).width + this.size * 3.9; ctx.restore();
    return aabb(this.matrix(t), -w / 2, -this.size * 1.3, w / 2, this.size * 1.3);
  }
  swap(str, o = {}) {
    const t = this.sc.time(o.at, o.delay);
    this.texts.add(t, 1e-4, String(str).toUpperCase(), "step");
    this.icons.add(t, 1e-4, o.icon ?? "check", "step");
    this.tr("scale").add(t, 0.12, 0.92, "out"); this.tr("scale").add(t + 0.12, 0.35, 1, "back");
    this.sc.cue("chime", t, { gain: 0.6, step: 6 });
    return this;
  }
  draw(ctx, t) {
    const a = this.alpha(t);
    if (a <= 0.002) return;
    const m = this.matrix(t), s = this.texts.at(t), icon = this.icons.at(t);
    const k2 = this.sc.rs || 1;
    ctx.save(); ctx.globalAlpha = a; ctx.setTransform(m[0] * k2, m[1] * k2, m[2] * k2, m[3] * k2, m[4] * k2, m[5] * k2);
    ctx.font = `700 ${this.size}px "${FONTS.sans}", Helvetica, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${this.size * 0.06}px`;
    const tw = ctx.measureText(s).width, iw = icon ? this.size * 1.3 : 0, w = tw + iw + this.size * 2.6, h = this.size * 2.6, r = h / 2;
    ctx.fillStyle = rgbCss(this.col(t));
    ctx.shadowColor = rgbCss(this.col(t), 0.6); ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.fill();
    ctx.shadowBlur = 0;
    const ink = rgbCss(colour(this.sc.pal, this.sc.pal.light ? "caption" : "bg"));
    ctx.fillStyle = this.sc.pal.light ? rgbCss(colour(this.sc.pal, "bg")) : ink; ctx.strokeStyle = ctx.fillStyle;
    ctx.textBaseline = "middle";
    const x0 = -w / 2 + this.size * 1.3;
    ctx.fillText(s, x0 + iw, 1);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const z = this.size * 0.42, cx = x0 + z;
    if (icon === "check") { ctx.beginPath(); ctx.moveTo(cx - z, 0); ctx.lineTo(cx - z * 0.3, z * 0.7); ctx.lineTo(cx + z, -z * 0.7); ctx.stroke(); }
    else if (icon === "chat") { ctx.beginPath(); ctx.roundRect(cx - z, -z * 0.8, z * 2, z * 1.4, z * 0.5); ctx.moveTo(cx - z * 0.4, z * 0.6); ctx.lineTo(cx - z * 0.7, z * 1.1); ctx.lineTo(cx, z * 0.6); ctx.stroke(); }
    else if (icon === "heart") { ctx.beginPath(); ctx.moveTo(cx, z * 0.8); ctx.bezierCurveTo(cx - z * 1.6, -z * 0.3, cx - z * 0.5, -z * 1.3, cx, -z * 0.3); ctx.bezierCurveTo(cx + z * 0.5, -z * 1.3, cx + z * 1.6, -z * 0.3, cx, z * 0.8); ctx.stroke(); }
    else if (icon === "bookmark") { ctx.beginPath(); ctx.moveTo(cx - z * 0.7, -z); ctx.lineTo(cx + z * 0.7, -z); ctx.lineTo(cx + z * 0.7, z); ctx.lineTo(cx, z * 0.4); ctx.lineTo(cx - z * 0.7, z); ctx.closePath(); ctx.stroke(); }
    ctx.restore();
  }
}

/* ---------- the scene ---------- */

class Scene {
  constructor(reel, timing, opts = {}) {
    this.reel = reel;
    this.fmtName = FORMATS[opts.format] ? opts.format : FORMATS[reel.format] ? reel.format : "9x16";
    if ((opts.format && !FORMATS[opts.format]) || (reel.format && !FORMATS[reel.format])) console.warn(`trame: no format "${opts.format || reel.format}" (${Object.keys(FORMATS).join(", ")}); using ${this.fmtName}`);
    this.fmt = FORMATS[this.fmtName];
    const fs = this.fmt.s;
    this.F = [fs, 0, 0, fs, this.fmt.x - DESIGN[0] * fs, this.fmt.y - DESIGN[1] * fs];
    this.textBoost = fs < 1 ? (1 / fs) ** 0.7 : 1;
    this.lookName = reel.look || "halftone";
    this.look = LOOKS[this.lookName] || LOOKS.halftone;
    // text in the scene skips the screen (it stays readable) but still moves with the camera
    this.crispText = reel.crispText ?? !!this.look.crispText;
    this.palName = reel.palette || this.look.palette;
    if (!PALETTES[this.palName]) { console.warn(`trame: no palette "${this.palName}"; using ${this.look.palette}`); this.palName = this.look.palette; }
    // riso multiplies ink onto paper, every other look adds light to a dark ground
    if ((this.lookName === "riso") !== !!PALETTES[this.palName].light) {
      console.warn(`trame: palette "${this.palName}" doesn't suit the ${this.lookName} look (riso takes a light palette, the others a dark one); using ${this.look.palette}`);
      this.palName = this.look.palette;
    }
    this.pal = { ...PALETTES[this.palName], ...(reel.colors || {}) };
    this.stroke = reel.stroke || this.look.stroke;
    this.rate = reel.voice?.rate ?? 1;
    this.timing = timing;
    this.els = []; this.beats = []; this.cues = []; this.script = [];
    this.z = 1; this.t = 0; this.cur = null;
    this.cam = { x: new Track(STAGE.cx), y: new Track(STAGE.cy), zoom: new Track(1), rot: new Track(0) };
    const fc = this.fmt.caption, rc = reel.caption || {};
    this.caption = { y: fc.y, x: fc.x, maxWidth: fc.maxWidth, ...(this.look.caption || {}), ...(this.fmtName === "9x16" ? rc : Object.fromEntries(Object.entries(rc).filter(([k]) => ["font", "hide", "size"].includes(k)))) };
    this.caption.size = Math.round((this.caption.size ?? 50) * fc.k);
    if (this.caption.font === "pixel" && !reel.caption?.size) this.caption.size = this.look.caption.size;
  }
  /** Resolve `at` to absolute seconds: number (from the beat start), word, "end", or nothing. */
  time(at, delay = 0) {
    const b = this.cur;
    let t = b ? b.start : this.t;
    if (typeof at === "number") t += at;
    else if (typeof at === "string") {
      if (at === "end" && b) t = b.end;
      else if (at === "start") t = b ? b.start : this.t;
      else if (b && b.words) {
        const [want, nth] = at.toLowerCase().split("#"), clean = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
        let seen = 0, hit = null;
        for (const w of b.words) if (clean(w.text) === clean(want) && ++seen >= (nth ? +nth : 1)) { hit = w; break; }
        if (!hit) for (const w of b.words) if (clean(w.text).startsWith(clean(want))) { hit = w; break; }
        if (hit) t = hit.start; else console.warn(`trame: no word "${at}" in "${b.text}"`);
      }
    }
    return t + (delay || 0);
  }
  cue(kind, t, o = {}) { this.cues.push({ kind, t, ...o }); }
  camera(t, layer, screen) {
    if (screen) return I;
    if (layer === "ui") return this.F;
    const z = this.cam.zoom.at(t), x = this.cam.x.at(t), y = this.cam.y.at(t), r = this.cam.rot.at(t);
    return mul(this.F, mul(mul([1, 0, 0, 1, STAGE.cx, STAGE.cy], local(0, 0, z, r)), [1, 0, 0, 1, -x, -y]));
  }
}

/** Compile a reel into a scene. timing: the voice-over timing file (scripts/voice.mjs), or null. */
export function compile(reel, timing = null, opts = {}) {
  // Voice-over timing is matched to the script as a whole: an in-order alignment (longest common subsequence)
  // of the reel's beats with the voiced lines by their words, so a moved, added or repeated line can't take
  // another line's audio. Punctuation doesn't count. A dry pass (no timing) reads the reel's beats first.
  const voiced = timing?.beats || [];
  const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const key = (s) => plainWords(s).map(norm).filter(Boolean).join(" ");
  const match = [];
  if (voiced.length) {
    const warn = console.warn;
    console.warn = () => {};
    let dry;
    try { dry = compile(reel, null); } finally { console.warn = warn; }
    const a = dry.script.filter((s) => s.kind === "beat").map((s) => key(s.text)), v = voiced.map((b) => key(b.text));
    const L = Array.from({ length: a.length + 1 }, () => new Array(v.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = v.length - 1; j >= 0; j--) L[i][j] = a[i] === v[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    for (let i = 0, j = 0; i < a.length; ) {
      if (j < v.length && a[i] === v[j]) { match[i++] = j++; }
      else if (j < v.length && L[i][j + 1] >= L[i + 1][j]) j++;
      else match[i++] = -1;
    }
  }
  /** a voiced line's word times for this beat's words; punctuation-only tokens ride with the word before */
  const timesFor = (vo, words) => {
    if (!vo.words) return null;
    if (vo.words.length === words.length) return vo.words;
    const said = plainWords(vo.text).map((w, i) => (norm(w) ? vo.words[i] : null)).filter(Boolean);
    const mine = words.map((w) => !!norm(w));
    if (said.length !== mine.filter(Boolean).length) return null;
    let k = 0, lastEnd = vo.start;
    return mine.map((m) => { if (m) { const t = said[k++]; lastEnd = t[1]; return t; } return [lastEnd, lastEnd]; });
  };
  UID = 0;
  const sc = new Scene(reel, timing, opts);
  let bi = 0, pauseBefore = 0;
  const gap = reel.voice?.gap ?? 0.12;

  const beat = (text, o, fn) => {
    if (typeof o === "function") { fn = o; o = {}; }
    o ||= {};
    const words = plainWords(text), raw = String(text).replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean);
    const vo = match[bi] >= 0 ? voiced[match[bi]] : null, times = vo ? timesFor(vo, words) : null;
    let start, ws, end;
    if (times) {
      start = vo.start; ws = times.map(([s, e]) => ({ start: s, end: e })); end = vo.end;
      const prevEnd = sc.beats.length ? sc.beats[sc.beats.length - 1].end : -Infinity;
      // the voice-over was laid out with this beat's hold and the pauses before it
      const redo = timing.provider === "recording" ? `run scripts/voice.mjs again (it re-lays your recording${timing.source ? ` ${timing.source}` : ""}; free)` : "run scripts/voice.mjs again (free: it re-lays the cached take)";
      if (vo.hold != null && (Math.abs(vo.hold - (o.hold ?? 0)) > 1e-3 || Math.abs((vo.pause ?? 0) - pauseBefore) > 1e-3))
        console.warn(`trame: beat ${bi + 1} "${words.join(" ")}": its hold or the pause before it changed since the voice-over (voiced with hold ${vo.hold} s, pause ${vo.pause ?? 0} s); ${redo}`);
      // timing files from before holds and pauses were recorded: at least catch an overlap, pauses included
      else if (start < (pauseBefore ? sc.t - gap : prevEnd) - 0.05) console.warn(`trame: beat ${bi + 1} "${words.join(" ")}" starts before the one before it (or the pause before it) ends; ${redo}`);
    } else {
      if (voiced.length) console.warn(`trame: beat ${bi + 1} "${words.join(" ")}" isn't in the voice-over; run scripts/voice.mjs again`);
      const est = estimate(text, sc.rate);
      start = sc.t;
      ws = est.words.map((w) => ({ start: start + w.start, end: start + w.end }));
      end = start + Math.max(est.dur, 0.7);
    }
    end += o.hold ?? 0;
    pauseBefore = 0;
    const b = { i: bi++, text, start, end, words: ws.map((w, i) => ({ ...w, text: words[i], bold: false })) };
    // a word is bold if it sits between *…*; a token of only '*' opens or closes bold but is not a word
    let on = false, wi = 0;
    for (const r of raw) {
      const opens = r.startsWith("*"), closes = r.replace(/[.,!?…:;"”’)]+$/, "").endsWith("*") && (r.length > 1 || on);
      if (opens) on = true;
      if (r.replace(/\*/g, "") && b.words[wi]) b.words[wi++].bold = on;
      if (closes) on = false;
    }
    sc.beats.push(b);
    sc.script.push({ kind: "beat", text: words.join(" "), say: spokenText(text, o.say), hold: o.hold ?? 0 });
    sc.cur = b;
    sc.t = b.end + gap;
    if (fn) fn(b);
    return b;
  };
  const pause = (sec = 1, fn) => {
    pauseBefore += sec;
    const start = sc.t, b = { i: -1, text: null, start, end: start + sec, words: [] };
    sc.cur = b; sc.t = b.end;
    sc.script.push({ kind: "pause", dur: sec });
    if (fn) fn(b);
    return b;
  };

  const make = (Cls, ...a) => new Cls(sc, ...a);
  const add = {
    /** any shape: add.line(S.bust(), { x, y, scale, color, width, stroke, in, at }) */
    line: (sh, o) => make(Line, sh, { x: STAGE.cx, y: STAGE.cy, ...o }),
    wave: (o) => make(Wave, { x: STAGE.cx, y: STAGE.cy, ...o }),
    blob: (o) => make(Wave, { x: STAGE.cx, y: STAGE.cy, n: 6, amp: 22, wobble: 1.4, speed: 0.6, color: "accent", ...o }),
    ring: (o) => make(Ring, { x: STAGE.cx, y: STAGE.cy, ...o }),
    text: (s, o) => make(Text, s, { x: STAGE.cx, y: STAGE.cy, ...o }),
    counter: (o) => make(Counter, { x: STAGE.cx, y: STAGE.cy, ...o }),
    group: (o) => make(Group, { x: STAGE.cx, y: STAGE.cy, ...o }),
    particles: (o) => make(Particles, { x: STAGE.cx, y: STAGE.cy, ...o }),
    orb: (o) => make(Orb, { x: STAGE.cx, y: STAGE.cy, ...o }),
    swarm: (o) => make(Swarm, o),
    shape3d: (o) => make(Shape3D, { x: STAGE.cx, y: STAGE.cy, ...o }),
    flowfield: (o) => make(FlowField, o),
    galaxy: (o) => make(Galaxy, { x: STAGE.cx, y: STAGE.cy, ...o }),
    rays: (o) => make(Rays, { x: STAGE.cx, y: STAGE.cy, ...o }),
    pulse: (o) => make(Pulse, { x: STAGE.cx, y: STAGE.cy, ...o }),
    flow: (sh, o) => make(Flow, sh, { x: 0, y: 0, ...o }),
    pill: (s, o) => make(Pill, s, o),
    node: (o = {}) => {
      const g = make(Group, { x: o.x ?? STAGE.cx, y: o.y ?? STAGE.cy, at: o.at, delay: o.delay, parent: o.parent });
      g.dot = make(Line, S.circle(o.r ?? 6), { parent: g, color: o.color ?? "ink", fill: o.color ?? "ink", fillAlpha: 1, width: 2, in: o.in ?? "pop", at: o.at, delay: o.delay });
      if (o.label) g.label = make(Text, o.label, { parent: g, y: (o.r ?? 6) + 26, size: o.size ?? 18, color: o.labelColor ?? "dim", at: o.at, delay: (o.delay ?? 0) + 0.15 });
      if (o.pulse) g.dot.loop("pulse", { period: o.pulse === true ? 1.6 : o.pulse, r1: 46, color: o.color ?? "ink", at: o.at, delay: o.delay });
      return g;
    },
    /** a label with a leader line: add.label("VAGUS NERVE", { from: hero.at("throat"), to: [800, 850], sub, color }) */
    label: (s, o = {}) => {
      const from = o.from || [STAGE.cx, STAGE.cy], to = o.to || [from[0] + 260, from[1] - 40];
      const right = to[0] >= from[0], t0 = sc.time(o.at, o.delay);
      const g = make(Group, { x: 0, y: 0, at: o.at, delay: o.delay });
      const c = o.color ?? "accent", gapX = right ? -14 : 14;
      const end = [to[0] + gapX, to[1]];
      g.dot = make(Line, S.circle(5), { parent: g, x: from[0], y: from[1], color: c, fill: c, fillAlpha: 1, width: 2, in: "pop", at: o.at, delay: o.delay });
      g.lead = make(Line, S.line(from[0], from[1], end[0], end[1]), { parent: g, x: 0, y: 0, color: c, width: 1.6, tip: false, in: "draw", dur: 0.35, at: o.at, delay: (o.delay ?? 0) + 0.08 });
      g.text = make(Text, s, { parent: g, x: to[0], y: to[1] - (o.sub ? 12 : 0), align: right ? "left" : "right", color: c, size: o.size ?? 24, at: o.at, delay: (o.delay ?? 0) + 0.35 });
      if (o.sub) g.sub = make(Text, o.sub, { parent: g, x: to[0], y: to[1] + 20, align: right ? "left" : "right", color: o.subColor ?? "ink", size: (o.size ?? 24) * 0.78, at: o.at, delay: (o.delay ?? 0) + 0.5 });
      sc.cue("tick", t0);
      return g;
    },
    /** a round timer: tick ring, a sweeping arc, the number, a label under it */
    timer: (o = {}) => {
      const r = o.r ?? 54, c = o.color ?? "accent";
      const g = make(Group, { x: o.x ?? 860, y: o.y ?? 700, at: o.at, delay: o.delay, parent: o.parent });
      g.ticks = make(Ring, { parent: g, x: 0, y: 0, r: r + 4, color: c, width: 0, ticks: { n: 60, len: 7, every: 5, major: 14, offset: 2, width: 1.6 }, in: "draw", dur: 0.6, at: o.at, delay: o.delay });
      g.face = make(Ring, { parent: g, x: 0, y: 0, r, color: c, width: 2.2, in: "draw", dur: 0.5, at: o.at, delay: o.delay });
      g.sweep = make(Ring, { parent: g, x: 0, y: 0, r: r - 9, color: c, width: 3, opacity: 1, in: false });
      g.sweep.in("draw", { at: o.at, delay: (o.delay ?? 0) + 0.3, dur: o.sweep ?? 3, ease: "linear" });
      g.num = make(Counter, { parent: g, x: 0, y: 2, from: o.value ?? 30, to: o.countdown ? (o.value ?? 30) - (o.countdown === true ? (o.sweep ?? 3) : o.countdown) : undefined, dur: o.countdown ? (o.sweep ?? 3) : undefined, format: o.format, size: o.size ?? r * 0.62, font: o.font, weight: 700, color: c, at: o.at, delay: (o.delay ?? 0) + 0.15 });
      if (o.label) g.label = make(Text, o.label, { parent: g, x: 0, y: r + 40, size: 17, color: o.labelColor ?? "ink", at: o.at, delay: (o.delay ?? 0) + 0.3 });
      sc.cue("pop", sc.time(o.at, o.delay));
      return g;
    },
    /** a clock face: 24 h (00/06/12/18) or 12 h, a hand you turn, arcs for spans of time */
    clock: (o = {}) => {
      const r = o.r ?? 230, hours = o.hours ?? 24, c = o.color ?? "ink";
      const g = make(Group, { x: o.x ?? STAGE.cx, y: o.y ?? STAGE.cy, at: o.at, delay: o.delay, parent: o.parent });
      const deg = (h) => (h / hours) * 360;
      g.face = make(Ring, { parent: g, x: 0, y: 0, r, color: c, width: 3, ticks: { n: hours * 4, len: 6, every: 4, major: 14, offset: -22, width: 1.2, color: "dim" }, in: "draw", dur: 1, at: o.at, delay: o.delay });
      const nums = hours === 24 ? [0, 6, 12, 18] : [12, 3, 6, 9];
      g.nums = nums.map((h) => {
        const a = (deg(h % hours) * Math.PI) / 180;
        return make(Text, hours === 24 ? String(h).padStart(2, "0") : String(h), { parent: g, x: Math.sin(a) * (r - 52), y: -Math.cos(a) * (r - 52), size: 20, color: "dim", at: o.at, delay: (o.delay ?? 0) + 0.4 });
      });
      g.hand = make(Line, S.line(0, 0, 0, -(r - 30)), { parent: g, x: 0, y: 0, rot: deg(o.hand ?? 0), color: o.handColor ?? c, width: 2.5, tip: false, in: "draw", dur: 0.5, at: o.at, delay: (o.delay ?? 0) + 0.5 });
      g.center = make(Line, S.circle(6), { parent: g, x: 0, y: 0, fill: o.handColor ?? c, fillAlpha: 1, color: o.handColor ?? c, width: 2, in: "pop", at: o.at, delay: (o.delay ?? 0) + 0.5 });
      g.r = r; g.hours = hours;
      /** turn the hand to an hour (it goes the long way round if you ask) */
      g.turn = (h, oo = {}) => { g.hand.to({ rot: deg(h) }, { dur: 1.2, ...oo }); sc.cue("whoosh", sc.time(oo.at, oo.delay), { gain: 0.4 }); return g; };
      /** an arc outside the face for a span of hours, with an optional label */
      g.span = (h0, h1, oo = {}) => {
        const arc = make(Ring, { parent: g, x: 0, y: 0, r: r + (oo.offset ?? 18), from: deg(h0), to: deg(h1 < h0 ? h1 + hours : h1), color: oo.color ?? "calm", width: oo.width ?? 5, in: "draw", dur: oo.dur ?? 1, at: oo.at, delay: oo.delay });
        if (oo.label) {
          const mid = ((deg(h0) + deg(h1 < h0 ? h1 + hours : h1)) / 2) * (Math.PI / 180), rr = r + (oo.offset ?? 18) + 46;
          arc.label = make(Text, oo.label, { parent: g, x: Math.sin(mid) * rr, y: -Math.cos(mid) * rr, size: 18, color: oo.color ?? "calm", at: oo.at, delay: (oo.delay ?? 0) + 0.5 });
        }
        return arc;
      };
      return g;
    },
    /** a chart: data is a preset (ecg, chaos, sine, decay, growth, sleep, rise, drop, flat), an array, or a function of 0..1 */
    chart: (o = {}) => {
      const w = o.w ?? 560, h = o.h ?? 220, c = o.color ?? "accent";
      const g = make(Group, { x: o.x ?? STAGE.cx, y: o.y ?? 1180, at: o.at, delay: o.delay, parent: o.parent });
      if (o.axes !== false) g.axes = make(Line, S.path(`M${-w / 2} ${-h / 2} V${h / 2} H${w / 2}`), { parent: g, x: 0, y: 0, color: "dim", width: 1.5, tip: false, in: "draw", dur: 0.5, at: o.at, delay: o.delay });
      if (o.title) g.title = make(Text, o.title, { parent: g, x: -w / 2, y: -h / 2 - 26, align: "left", size: 16, color: c, at: o.at, delay: o.delay });
      if (o.value) g.value = make(Text, o.value, { parent: g, x: w / 2, y: -h / 2 - 26, align: "right", size: 16, color: o.valueColor ?? "ink", at: o.at, delay: (o.delay ?? 0) + 0.2 });
      (o.xlabels || []).forEach((s, i, arr) => make(Text, s, { parent: g, x: -w / 2 + (w * i) / Math.max(1, arr.length - 1), y: h / 2 + 24, size: 14, color: "dim", at: o.at, delay: (o.delay ?? 0) + 0.2 }));
      (o.ylabels || []).forEach((s, i, arr) => make(Text, s, { parent: g, x: -w / 2 - 14, y: h / 2 - (h * i) / Math.max(1, arr.length - 1), align: "right", size: 14, color: "dim", at: o.at, delay: (o.delay ?? 0) + 0.2 }));
      g.series = make(Line, chartShape(o.data ?? "sine", w, h, o), { parent: g, x: 0, y: 0, color: c, width: o.width ?? 3, mode: "all", in: "draw", dur: o.dur ?? 1.4, ease: "linear", at: o.at, delay: (o.delay ?? 0) + 0.3 });
      g.series.tip = true;
      /** morph to another data set: chart.morph("sine", { dur }) */
      g.morph = (data, oo = {}) => { g.series.morph(chartShape(data, w, h, { ...o, ...oo }), oo); if (oo.color) g.series.to({ color: oo.color }, oo); return g; };
      g.w = w; g.h = h;
      return g;
    },
    /** a ruler: ticks along a line, a marker you move (0..1), labels at fractions */
    ruler: (o = {}) => {
      const w = o.w ?? 640, n = o.ticks ?? 40, c = o.color ?? "ink";
      const g = make(Group, { x: o.x ?? STAGE.cx, y: o.y ?? STAGE.cy, at: o.at, delay: o.delay, parent: o.parent });
      const ticks = [];
      for (let i = 0; i <= n; i++) { const x = -w / 2 + (w * i) / n, l = i % (o.major ?? 5) === 0 ? 14 : 7; ticks.push(`M${x} 0 V${l}`); }
      g.rule = make(Line, S.merge(S.line(-w / 2, 0, w / 2, 0), S.path(ticks.join(" "))), { parent: g, x: 0, y: 0, color: c, width: 1.6, tip: false, mode: "all", in: "draw", dur: 0.8, at: o.at, delay: o.delay });
      Object.entries(o.labels || {}).forEach(([f, s]) => make(Text, s, { parent: g, x: -w / 2 + w * +f, y: 36, size: 15, color: "dim", at: o.at, delay: (o.delay ?? 0) + 0.4 }));
      if (o.marker != null) {
        g.marker = make(Line, S.path("M0 -6 L-9 -22 H9 Z"), { parent: g, x: -w / 2 + w * o.marker, y: 0, color: o.markerColor ?? "accent", fill: o.markerColor ?? "accent", fillAlpha: 1, width: 2, in: "pop", at: o.at, delay: (o.delay ?? 0) + 0.5 });
        g.move = (f, oo = {}) => { g.marker.to({ x: -w / 2 + w * f }, { dur: 0.9, ...oo }); return g; };
      }
      return g;
    },
    /** a viewfinder: four corner brackets, labels in the corners, a blinking REC dot */
    frame: (o = {}) => {
      const w = o.w ?? 420, h = o.h ?? 420, k = o.corner ?? 34, c = o.color ?? "ink";
      const g = make(Group, { x: o.x ?? STAGE.cx, y: o.y ?? STAGE.cy, at: o.at, delay: o.delay, parent: o.parent });
      const x = w / 2, y = h / 2;
      g.corners = make(Line, S.path(`M${-x} ${-y + k} V${-y} H${-x + k} M${x - k} ${-y} H${x} V${-y + k} M${x} ${y - k} V${y} H${x - k} M${-x + k} ${y} H${-x} V${y - k}`), { parent: g, x: 0, y: 0, color: c, width: 2.4, tip: false, in: "pop", at: o.at, delay: o.delay });
      if (o.tl) g.tl = make(Text, o.tl, { parent: g, x: -x, y: -y - 20, align: "left", size: 16, color: c, at: o.at, delay: (o.delay ?? 0) + 0.2 });
      if (o.rec) {
        g.rec = make(Text, o.rec === true ? "REC" : o.rec, { parent: g, x: x, y: -y - 20, align: "right", size: 16, color: "alert", at: o.at, delay: (o.delay ?? 0) + 0.2 });
        g.rec.loop("blink", { period: 1, at: o.at, delay: (o.delay ?? 0) + 0.4 });
      }
      if (o.bl) g.bl = make(Text, o.bl, { parent: g, x: -x, y: y + 22, align: "left", size: 16, color: "dim", at: o.at, delay: (o.delay ?? 0) + 0.3 });
      return g;
    },
    /** a curved link between two points: arrow, dashes, travelling dots, a label at the top of the bend */
    link: (from, to, o = {}) => {
      const [x1, y1] = from, [x2, y2] = to, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), bend = o.bend ?? 0.3;
      const cx = mx + (dy / L) * L * bend, cy = my - (dx / L) * L * bend;
      const sh = S.path(`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`);
      const g = make(Group, { x: 0, y: 0, at: o.at, delay: o.delay });
      g.line = make(Line, sh, { parent: g, x: 0, y: 0, color: o.color ?? "accent", width: o.width ?? 2.4, stroke: o.dashed ? "dashed" : undefined, in: "draw", dur: o.dur ?? 0.9, at: o.at, delay: o.delay });
      if (o.arrow !== false) {
        const ang = Math.atan2(y2 - cy, x2 - cx), a1 = ang + 2.6, a2 = ang - 2.6, k = 16;
        g.head = make(Line, S.path(`M${x2 + Math.cos(a1) * k} ${y2 + Math.sin(a1) * k} L${x2} ${y2} L${x2 + Math.cos(a2) * k} ${y2 + Math.sin(a2) * k}`), { parent: g, x: 0, y: 0, color: o.color ?? "accent", width: o.width ?? 2.4, tip: false, in: "pop", at: o.at, delay: (o.delay ?? 0) + (o.dur ?? 0.9) });
      }
      if (o.flow) g.flow = make(Flow, sh, { parent: g, count: o.flow === true ? 3 : o.flow, color: o.color ?? "accent", at: o.at, delay: (o.delay ?? 0) + (o.dur ?? 0.9) });
      if (o.label) g.label = make(Text, o.label, { parent: g, x: (mx + cx) / 2, y: (my + cy) / 2 - 24, size: 17, color: o.color ?? "accent", at: o.at, delay: (o.delay ?? 0) + 0.4 });
      return g;
    },
  };

  /** fade out (or undraw) everything on screen except what you keep */
  const clear = (o = {}) => {
    const keep = new Set(o.keep || []);
    const t = sc.time(o.at, o.delay);
    for (const e of sc.els) {
      if (e.parent || keep.has(e) || e.dotsHud) continue;
      if (e.gone != null && e.gone <= t) continue;
      if ((e.shown ?? Infinity) > t) continue;
      e.out(o.how || "fade", { at: o.at, delay: o.delay, dur: o.dur });
    }
  };

  /** the progress dots across the top (one per item in a list) */
  const dots = { n: reel.dots || 0, els: [], set(k, o = {}) {
    const t = sc.time(o.at, o.delay);
    this.els.forEach((d, i) => d.fill.to({ opacity: i < k ? 1 : 0 }, { at: o.at, delay: o.delay, dur: 0.3 }));
    if (this.els[k - 1]) this.els[k - 1].ring.pulse({ at: o.at, delay: o.delay, r0: 6, r1: 26, color: "caption" });
    sc.cue("chime", t, { step: Math.max(1, k) });
  } };
  if (dots.n) {
    const sp = 26, x0 = STAGE.cx - ((dots.n - 1) * sp) / 2;
    for (let i = 0; i < dots.n; i++) {
      const ring = make(Line, S.circle(5), { x: x0 + i * sp, y: STAGE.dotsY, color: "caption", width: 1.6, in: "fade", tip: false });
      const fill = make(Line, S.circle(5), { x: x0 + i * sp, y: STAGE.dotsY, color: "caption", fill: "caption", fillAlpha: 1, width: 2, in: false, tip: false });
      fill.tr("opacity");
      ring.dotsHud = fill.dotsHud = true;
      dots.els.push({ ring, fill });
    }
  }

  const camera = {
    /** move the camera: camera.to({ zoom, x, y, rot }, { at, dur }) — x, y is the point at the centre */
    to(p, o = {}) {
      const t = sc.time(o.at, o.delay);
      for (const k of ["x", "y", "zoom", "rot"]) if (p[k] != null) sc.cam[k].add(t, o.dur ?? 1.2, p[k], o.ease || "inOut");
    },
  };

  const api = sc.api = {
    beat, pause, add, clear, dots, camera, S, shapes: S,
    sfx: (kind, o = {}) => sc.cue(kind, sc.time(o.at, o.delay), o),
    W, H, cx: STAGE.cx, cy: STAGE.cy, stage: STAGE, format: sc.fmtName,
    pal: sc.pal, rng: G.rng,
    /** the playhead now (seconds) */
    now: () => sc.time(),
  };
  reel.build(api);
  const used = new Set(match.filter((j) => j >= 0)), stale = voiced.filter((_, j) => !used.has(j));
  if (stale.length) console.warn(`trame: the voice-over says lines the reel no longer has (${stale.map((b) => `"${b.text}"`).slice(0, 3).join(", ")}${stale.length > 3 ? ", …" : ""}); run scripts/voice.mjs again`);
  const last = sc.beats.length ? sc.beats[sc.beats.length - 1].end : 0;
  sc.duration = reel.duration ?? Math.max(sc.t, last) + (reel.tail ?? 0.8);
  if (timing?.duration) sc.duration = Math.max(sc.duration, timing.duration + 0.3);
  sc.els.sort((a, b) => a.z - b.z);
  for (const e of sc.els) for (const k in e.tracks) e.tracks[k].prep();
  sc.cues.sort((a, b) => a.t - b.t);
  return sc;
}

/* ---------- chart data ---------- */

export function chartData(kind, n = 240, o = {}) {
  const r = G.rng(o.seed ?? 3);
  const f = {
    ecg: (x) => { const p = (x * (o.beats ?? 4)) % 1; return p > 0.42 && p < 0.46 ? 0.95 : p > 0.46 && p < 0.5 ? 0.1 : p > 0.38 && p < 0.42 ? 0.4 : p > 0.6 && p < 0.7 ? 0.42 + 0.06 * Math.sin((p - 0.6) * 31) : 0.4; },
    chaos: (x) => 0.5 + 0.38 * (G.noise1(x * 34 + 2) - 0.5) * 2 * (0.6 + 0.4 * Math.sin(x * 50)),
    sine: (x) => 0.5 + 0.32 * Math.sin(x * Math.PI * 2 * (o.cycles ?? 3)),
    decay: (x) => (x < 0.12 ? EASE.out(x / 0.12) * 0.9 : 0.9 * Math.exp(-(x - 0.12) * 4.2)) + 0.04,
    growth: (x) => 0.04 + 0.9 * (Math.exp(x * 3.2) - 1) / (Math.exp(3.2) - 1),
    rise: (x) => 0.1 + 0.75 * x + 0.06 * (G.noise1(x * 24) - 0.5),
    drop: (x) => 0.85 - 0.75 * x + 0.06 * (G.noise1(x * 24) - 0.5),
    flat: () => 0.5,
    sleep: (x) => { const s = [0.9, 0.6, 0.35, 0.1, 0.35, 0.6, 0.9, 0.55, 0.3, 0.1, 0.3, 0.6, 0.9, 0.6, 0.35, 0.6, 0.9, 0.6, 0.9]; return s[Math.min(s.length - 1, Math.floor(x * s.length))]; },
  }[kind];
  if (typeof kind === "function") return Array.from({ length: n }, (_, i) => kind(i / (n - 1)));
  if (Array.isArray(kind)) return kind;
  return Array.from({ length: n }, (_, i) => (f || (() => 0.5))(i / (n - 1)));
}
function chartShape(data, w, h, o = {}) {
  const ys = chartData(data, 240, o), n = ys.length;
  const [lo, hi] = o.range || [0, 1];
  const steps = o.kind === "steps" || data === "sleep";
  const pts = [];
  ys.forEach((v, i) => {
    const x = -w / 2 + (w * i) / (n - 1), y = h / 2 - ((v - lo) / (hi - lo)) * h;
    if (steps && i) pts.push([x, pts[pts.length - 1][1]]);
    pts.push([x, y]);
  });
  if (o.kind === "bars") return S.path(ys.map((v, i) => { const x = -w / 2 + (w * (i + 0.5)) / n; return `M${x} ${h / 2} V${h / 2 - ((v - lo) / (hi - lo)) * h}`; }).join(" "));
  return S.poly(pts);
}

/* ---------- drawing a frame ---------- */

/** Paint time t into the art and ui 2D contexts (both W × H, cleared here). */
export function drawFrame(sc, t, art, ui, scale = 1) {
  sc.rs = scale;
  LINE = { scale: 1, min: 0, ...(sc.look.line || {}) };
  for (const c of [art, ui]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.setTransform(scale, 0, 0, scale, 0, 0); }
  for (const e of sc.els) {
    if (e.kind === "group") continue;
    const ctx = e.layer === "ui" ? ui : art;
    ctx.save();
    e.draw(ctx, t);
    ctx.restore();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  drawCaptions(sc, t, ui, scale);
}

/* ---------- layout audit ---------- */

/**
 * What a person would catch by eye at time t: words off the frame or under Instagram's buttons,
 * words over the caption, words over other words, words crossed by a drawing (other than their
 * own leader line or instrument). Returns a list of sentences.
 */
export function audit(sc, t, ctx) {
  const out = new Set(), root = (e) => { while (e.parent) e = e.parent; return e; };
  const shown = sc.els.filter((e) => e.kind !== "group" && !e.dotsHud && e.alpha(t) > 0.5);
  const words = shown.filter((e) => e.box).map((e) => ({ e, b: e.box(ctx, t) })).filter((w) => w.b);
  const name = (e) => `"${e.kind === "pill" ? e.texts.at(t) : e.str(t)}"`;
  const hit = (a, b, m = 2) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;
  const talking = sc.beats.some((b) => t >= b.start - 0.05 && t <= b.end + 0.3);
  const c = sc.caption, FW = sc.fmt.W, FH = sc.fmt.H;
  // the captions on screen, as laid out (two or three lines reach further than one)
  const caps = sc.beats.filter((b) => b.words?.length && t >= b.start - 0.05 && t <= b.end + 0.3).map((b) => {
    const ws = (b.layout ||= layoutBeat(sc, ctx, b));
    return [Math.min(...ws.map((w) => w.x)), Math.min(...ws.map((w) => w.y)) - c.size * 0.6, Math.max(...ws.map((w) => w.x + w.w)), Math.max(...ws.map((w) => w.y)) + c.size * 0.6];
  });
  for (const { e, b } of words) {
    if (b[0] < 6 || b[2] > FW - 6 || b[1] < 6 || b[3] > FH - 6) out.add(`${name(e)} runs off the frame`);
    else if (sc.fmt.rail && b[2] > FW * 0.86 && b[3] > 1000 && b[1] < 1650) out.add(`${name(e)} sits under Instagram's buttons (x > 930, y 1000–1650)`);
    if (talking && caps.some((cb) => hit(b, cb, 0))) out.add(`${name(e)} overlaps the caption`);
  }
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j < words.length; j++)
      if (hit(words[i].b, words[j].b)) out.add(`${name(words[i].e)} overlaps ${name(words[j].e)}`);
  const drawings = shown.filter((e) => e.points);
  for (const { e, b } of words) {
    const r = root(e), inner = [b[0] + 3, b[1] + 3, b[2] - 3, b[3] - 3];
    for (const d of drawings) {
      if (root(d) === r || (r.kind !== "group" && d === r)) continue;
      if ((d.pts ||= new Map()).get(t) === undefined) d.pts.set(t, d.points(t));
      if (d.pts.get(t).some(([x, y]) => x > inner[0] && x < inner[2] && y > inner[1] && y < inner[3])) { out.add(`${name(e)} is crossed by a ${d.kind === "line" ? "drawing" : d.kind}`); break; }
    }
  }
  return [...out];
}

/* ---------- captions ---------- */

function layoutBeat(sc, ctx, b) {
  const c = sc.caption, fam = FONTS[c.font] || c.font, size = c.size;
  const font = (bold) => `${bold ? (c.font === "pixel" || c.font === "hand" ? 700 : 700) : c.font === "serif" ? 400 : 400} ${size}px "${fam}", Helvetica, Arial, sans-serif`;
  const space = (() => { ctx.font = font(false); return ctx.measureText(" ").width; })();
  const ws = b.words.map((w) => { ctx.font = font(w.bold); return { ...w, w: ctx.measureText(w.text).width, font: font(w.bold) }; });
  const total = ws.reduce((s, w) => s + w.w, 0) + space * (ws.length - 1);
  let lines;
  const widthOf = (arr) => arr.reduce((s, w) => s + w.w, 0) + space * (arr.length - 1);
  if (total <= c.maxWidth * 0.62 || ws.length < 3) lines = [ws];
  else if (total <= c.maxWidth * 1.9) {
    let best = null;
    for (let i = 1; i < ws.length; i++) {
      const a = ws.slice(0, i), z = ws.slice(i), m = Math.max(widthOf(a), widthOf(z)) + (widthOf(a) > widthOf(z) * 1.05 ? 0 : 1);
      if (!best || m < best.m) best = { m, lines: [a, z] };
    }
    lines = best.lines;
  } else {
    lines = [[]];
    for (const w of ws) { const l = lines[lines.length - 1]; if (l.length && widthOf([...l, w]) > c.maxWidth) lines.push([w]); else l.push(w); }
  }
  const lh = size * (c.font === "pixel" ? 1.05 : 1.32), y0 = c.y - ((lines.length - 1) * lh) / 2;
  const out = [];
  lines.forEach((l, li) => {
    let x = c.x - widthOf(l) / 2;
    for (const w of l) { out.push({ ...w, x, y: y0 + li * lh }); x += w.w + space; }
  });
  return out;
}

function drawCaptions(sc, t, ctx, scale) {
  const c = sc.caption;
  if (c.hide) return;
  const pal = sc.pal, on = colour(pal, "caption"), off = colour(pal, "captionDim");
  for (let i = 0; i < sc.beats.length; i++) {
    const b = sc.beats[i], next = sc.beats[i + 1];
    const tOut = next ? Math.min(next.start - 0.04, b.end + 1.2) : b.end + 0.6;
    if (t < b.start - 0.25 || t > tOut + 0.2) continue;
    const fadeIn = smooth(b.start - 0.06, b.start + 0.14, t), fadeOut = 1 - smooth(tOut - 0.16, tOut, t);
    const a = fadeIn * fadeOut;
    if (a <= 0.003) continue;
    b.layout ||= layoutBeat(sc, ctx, b);
    ctx.save();
    ctx.textBaseline = "middle";
    if (c.font === "pixel" && "letterSpacing" in ctx) ctx.letterSpacing = "1px";
    const blur = (1 - fadeIn) * 8;
    if (blur > 0.3 && "filter" in ctx) ctx.filter = `blur(${blur}px)`;
    for (const w of b.layout) {
      const k = smooth(w.start - 0.05, w.start + 0.09, t);
      ctx.font = w.font;
      const col = lerp(off, on, k);
      ctx.globalAlpha = a;
      if (k > 0.02 && !pal.light) { ctx.shadowColor = rgbCss(on, 0.55 * k); ctx.shadowBlur = 18; }
      else ctx.shadowBlur = 0;
      ctx.fillStyle = rgbCss(col);
      ctx.fillText(w.text, w.x, w.y);
    }
    ctx.restore();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
}

export { PALETTES, LOOKS, FONTS, S, G };
