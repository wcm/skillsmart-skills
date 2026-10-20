/*
 * Path: a mark drawn along a path, as a thick striped ribbon that draws itself and then never
 * stops flowing, and / or a line of type running along it. The ∞ that opens a reel, a spiral
 * of words winding into its centre, a wave, a rose, a logo's own outline. With a title set
 * under it, it is a title scene; with text and no stripes, it is type on a path.
 *
 *   path     "infinity" (a lemniscate), "spiral" (a log spiral, outside in), "circle", "wave",
 *            "rose-5", an svg path ({ d, view }) or [[x, y], …] (in -1..1, a smooth curve through)
 *   stripes  the ribbon's bands, outside in: [role, width px]; [] for none
 *   draw     when the ribbon draws itself on: [from, to], fractions of the scene
 *   flow     how fast its dashes run along it (px per beat); dash: [on, off] px
 *   text     a line of type to run along the path (it repeats to fill it); textFlow: px per beat
 *   words    the title's heavy lines, line its serif line; title: "below" | "above" | "none"
 *   push     how much it pushes in about its anchor over the scene (0.3 = 30 %)
 *   anchor   the point it hands on: "crossing" (the ∞'s centre), "centre", "end", or [x, y]
 */
(() => {
const TAU = Math.PI * 2, SPIRAL_TURNS = 5;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
Reel.scene("path", {
  label: "PATH",
  bg: "deep",
  beats: 4,
  params: {
    path: "infinity",
    size: 0.86, /* the path's width, a fraction of the stage width (over 1 runs off the frame) */
    stripes: [["accent", 64], ["sun", 40], ["paper", 18]],
    draw: [0.05, 0.42],
    ease: "inOutCubic", /* the draw-on */
    flow: 260,
    dash: [70, 46],
    text: null,
    textSize: 46,
    textFlow: 220,
    textColor: "paper",
    spin: 0, /* degrees it turns over the scene */
    words: ["ZOOM IN"],
    line: "forever",
    title: "below",
    push: 0.35,
    anchor: "crossing",
    readout: ["PATH / {name}", "L = {len} px", "s = {s}"], /* top-left (case kept): {name} {len} {s} */
    name: null, /* the readout's name; default from the path */
  },
  prepare(s, g) {
    const st = g.stage, Wd = (st.w * s.size) / 2, cx = st.cx, cy = st.cy - (s.title === "below" ? st.h * 0.12 : s.title === "above" ? -st.h * 0.1 : 0);
    const pts = curve(g, s.path, Wd, cx, cy), n = pts.length, len = new Float32Array(n);
    for (let i = 1; i < n; i++) len[i] = len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const L = len[n - 1] || 1;
    const anchor = Array.isArray(s.anchor) ? s.anchor : s.anchor === "end" ? pts[n - 1] : [cx, cy];
    /* the title, fitted under (or over) the mark */
    const lines = [];
    if (s.title !== "none") {
      let y = s.title === "below" ? cy + Wd * 0.56 + 40 : st.y + 90;
      for (const w of [].concat(s.words || [])) { const size = g.fit(w, { kind: "display", size: 150 }, st.w * 0.92, 20); y += size * 0.86; lines.push({ str: w, x: st.cx, y, o: { kind: "display", size } }); y += size * 0.22; }
      if (s.line) { const size = g.fit(s.line, { kind: "serif", size: 132, style: "italic" }, st.w * 0.8, 20); y += size * 0.76; lines.push({ str: s.line, x: st.cx, y, o: { kind: "serif", size, style: "italic" }, serif: true }); }
    }
    const name = s.name || (typeof s.path === "string" ? s.path.split(/[-:]/)[0].toUpperCase() : "PATH");
    /* a spiral's length all the way in (its sampled part stops short of the centre) */
    const [xe, ye] = pts[n - 1], Lc = s.path === "spiral" ? L + Math.hypot(xe - cx, ye - cy) * Math.sqrt(1 + (SPIRAL_TURNS * TAU / Math.log(18)) ** 2) : 0;
    return { pts, len, L, Lc, cx, cy, anchor, lines, name, anchorR: 0 };
  },
  draw(g, s, t) {
    const _ = s._, ctx = g.ctx, p = clamp(t.b / s.beats), [d0, d1] = s.draw;
    const E = g.ease[s.ease] || g.ease.inOutCubic, k = E(clamp((p - d0) / Math.max(1e-6, d1 - d0)));
    const push = 1 + s.push * g.ease.inQuad(p), rot = ((s.spin || 0) * Math.PI) / 180 * g.ease.inOutSine(p), [ax, ay] = _.anchor;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot); ctx.scale(push, push); ctx.translate(-ax, -ay);
    /* the ribbon: in two halves, the later on top, so it crosses over itself like a ribbon */
    const upTo = _.L * k, stripes = [].concat(s.stripes || []);
    if (stripes.length && upTo > 0.5) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const half = _.L / 2, parts = [[0, Math.min(upTo, half)], [half, upTo]];
      for (const [a, b] of parts) {
        if (b <= a) continue;
        const path = sub(_.pts, _.len, a, b);
        stripes.forEach(([role, w], j) => {
          ctx.strokeStyle = g.col(role); ctx.lineWidth = w;
          /* the innermost band flows: dashes running along it, forever */
          if (j === stripes.length - 1 && s.flow) { ctx.setLineDash(s.dash); ctx.lineDashOffset = -t.b * s.flow - a; } else ctx.setLineDash([]);
          ctx.stroke(path);
        });
      }
      ctx.setLineDash([]);
      /* the pen at the head while it draws */
      if (k < 1) { const [hx, hy] = at(_.pts, _.len, upTo); g.circle(hx, hy, (stripes[0][1] / 2) * 1.15, g.c.paper); }
    }
    /* the text along it */
    if (s.text) {
      /* along a spiral the type shrinks with the radius, its spacing too (an arc length s for a text
         position τ of Lc·(1 − e^(−τ/Lc)), Lc the length to the very centre): it winds in forever */
      const str = String(s.text), size = s.textSize, o = { kind: "display", size, weight: 800 }, spiral = !!_.Lc, Lc = _.Lc || _.L;
      const step = g.measure(str, o) + size * 0.8, off = (t.b * s.textFlow) % step, col = g.col(s.textColor);
      ctx.save(); ctx.font = g.font("display", size, 800); ctx.textBaseline = "middle"; ctx.fillStyle = col; ctx.letterSpacing = "0px";
      const lt = g.letters(str, o), far = spiral ? Lc * 3.4 : upTo + step;
      for (let base = -step + off; base < far; base += step) {
        for (const l of lt) {
          const tau = base + l.x + l.w / 2;
          if (tau < 0) continue;
          const e = spiral ? Math.exp(-tau / Lc) : 1, sAt = spiral ? Lc * (1 - e) : tau;
          if (sAt > upTo || e < 0.035) continue;
          const [x, y, dx, dy] = at(_.pts, _.len, sAt, true);
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx)); if (e !== 1) ctx.scale(e, e); ctx.fillText(l.ch, -l.w / 2, 0); ctx.restore();
        }
      }
      ctx.restore();
    }
    ctx.restore();
    /* the title: heavy lines rise in one by one, the serif line after them */
    _.lines.forEach((ln, i) => {
      const a = clamp((p - (0.28 + 0.08 * i)) / 0.1);
      if (a <= 0) return;
      const y = ln.y + 40 * (1 - g.ease.outCubic(a));
      g.text(ln.str, ln.x, y, Object.assign({ align: "center", color: ln.serif ? g.c.sun : g.on(s.bg), alpha: a }, ln.o));
    });
    /* the readout */
    const fade = g.smoothstep(0.03, 0.15, p), ink = g.on(s.bg), vars = { name: _.name, len: Math.round(_.L), s: k.toFixed(3) };
    [].concat(s.readout || []).forEach((str, i) => { if (str) g.text(String(str).replace(/\{(\w+)\}/g, (m, q) => (q in vars ? vars[q] : m)), g.box.x + 27.5, g.box.y + 63.5 + i * 23.7 * g.grow(16), { kind: "mono", size: 16, weight: i ? 400 : 600, track: 1.9, color: ink, alpha: fade * (i ? 0.53 : 0.82) }); });
    /* where it hands on: its anchor, pushed with it */
    _.anchor = [ax, ay]; _.anchorR = 26 * push;
  },
});

/* the path as dense points, screen px */
function curve(g, spec, W, cx, cy) {
  const out = [];
  if (spec === "infinity") {
    for (let i = 0; i <= 720; i++) { const t = (i / 720) * TAU, d = 1 + Math.sin(t) ** 2; out.push([cx + (W * Math.cos(t)) / d, cy + (W * Math.sin(t) * Math.cos(t)) / d]); }
  } else if (spec === "spiral") {
    /* a log spiral from outside in: r = R e^(-bθ) */
    const R = W, turns = SPIRAL_TURNS, b = Math.log(18) / (turns * TAU);
    for (let i = 0; i <= 1600; i++) { const th = (i / 1600) * turns * TAU, r = R * Math.exp(-b * th); out.push([cx + r * Math.cos(th - Math.PI / 2), cy + r * Math.sin(th - Math.PI / 2)]); }
  } else if (spec === "circle") {
    for (let i = 0; i <= 480; i++) { const t = (i / 480) * TAU - Math.PI / 2; out.push([cx + W * 0.8 * Math.cos(t), cy + W * 0.8 * Math.sin(t)]); }
  } else if (spec === "wave") {
    for (let i = 0; i <= 600; i++) { const u = i / 600; out.push([cx - W + 2 * W * u, cy + W * 0.25 * Math.sin(u * TAU * 2.5)]); }
  } else if (typeof spec === "string" && spec.startsWith("rose")) {
    const k = +spec.split("-")[1] || 5;
    for (let i = 0; i <= 1440; i++) { const t = (i / 1440) * TAU * (k % 2 ? 1 : 2), r = W * 0.85 * Math.cos(k * t); out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  } else if (Array.isArray(spec)) {
    const P = spec.map(([x, y]) => [cx + x * W, cy + y * W]);
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let j = 0; j < 24; j++) { const t = j / 24, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))); }
    }
    out.push(P[P.length - 1]);
  } else if (spec && spec.d) {
    /* an svg path: sampled along its length */
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path"); el.setAttribute("d", spec.d);
    const [vx, vy, vw, vh] = spec.view || [0, 0, 100, 100], k = (2 * W) / Math.max(vw, vh), L = el.getTotalLength();
    for (let i = 0; i <= 900; i++) { const q = el.getPointAtLength((i / 900) * L); out.push([cx + (q.x - vx - vw / 2) * k, cy + (q.y - vy - vh / 2) * k]); }
  }
  return out.length > 1 ? out : [[cx - W, cy], [cx + W, cy]];
}
/* the point (and its direction) at arc length d */
function at(pts, len, d, dir = false) {
  const n = pts.length;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] < d) lo = m; else hi = m; }
  const seg = len[hi] - len[lo] || 1, f = clamp((d - len[lo]) / seg), x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, y = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f;
  return dir ? [x, y, pts[hi][0] - pts[lo][0], pts[hi][1] - pts[lo][1]] : [x, y];
}
/* the part of the path between arc lengths a and b, as a Path2D */
function sub(pts, len, a, b) {
  const p = new Path2D(), [x0, y0] = at(pts, len, a);
  p.moveTo(x0, y0);
  for (let i = 0; i < pts.length; i++) if (len[i] > a && len[i] < b) p.lineTo(pts[i][0], pts[i][1]);
  const [x1, y1] = at(pts, len, b); p.lineTo(x1, y1);
  return p;
}
})();
