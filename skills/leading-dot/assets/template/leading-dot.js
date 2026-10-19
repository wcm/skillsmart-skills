/*
 * leading-dot.js · Leading Dot (Skillsmart, MIT)
 *
 * One dot carries the whole film. Each scene is a move: what the dot becomes next. Every move starts
 * exactly where the last one left the dot and ends with the dot whole again, so the film never cuts.
 *
 *   LeadingDot.film({ theme: "paper", scenes: [{ move: "drop", text: "…" }, …] })
 *
 * Moves: drop · bounce · grow · split · line · ring · pulse · orbit · button · type · fill · logo
 * (references/moves.md has what each one needs and how long it runs).
 */
(function () {
  "use strict";
  const { EASE: E, clamp, lerp } = Film;

  const THEMES = {
    paper: { bg: "#F2EEE5", dot: "#151515", ink: "#151515", accent: "#FF5A36" },
    night: { bg: "#11141F", dot: "#FF6A4D", ink: "#F4F0E8", accent: "#FFD25A" },
    mono: { bg: "#FFFFFF", dot: "#0B0B0B", ink: "#0B0B0B", accent: "#2F5BFF" },
    citrus: { bg: "#1C1E1B", dot: "#D7FF3B", ink: "#F1F2EC", accent: "#FF7AC6" },
    sky: { bg: "#E9F0FF", dot: "#2A57FF", ink: "#0C1742", accent: "#FF8A3D" },
  };

  /* ---------- small helpers ---------- */

  const rgb = (hex) => {
    if (Array.isArray(hex)) return hex;
    let h = hex.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const css = (c) => `rgb(${c.map(Math.round).join(",")})`;
  const mixC = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
  const Dot = (id, x, y, s, c, extra = {}) => ({ id, x, y, w: s, h: s, r: s / 2, c: rgb(c), sx: 1, sy: 1, rot: 0, o: 1, ...extra });
  const mixDot = (a, b, p) => ({
    id: b.id, x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), r: lerp(a.r, b.r, p),
    c: mixC(a.c, b.c, p), sx: lerp(a.sx, b.sx, p), sy: lerp(a.sy, b.sy, p), rot: lerp(a.rot, b.rot, p), o: lerp(a.o, b.o, p),
  });
  const seg = (l, a, b) => clamp((l - a) / Math.max(1e-6, b - a));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // a point on an arc from a to b, lifted at the middle (things travel in arcs, not lines)
  const arc = (a, b, p, lift) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - lift, q = 1 - p;
    return [q * q * a[0] + 2 * q * p * mx + p * p * b[0], q * q * a[1] + 2 * q * p * my + p * p * b[1]];
  };
  // never perfectly still: a slow breath on idle dots
  const breathe = (l, k = 0.014) => 1 + k * Math.sin((l * Math.PI * 2) / 1.8);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const md = (s) => esc(s || "").replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // offset of an element inside the stage (unaffected by the preview's scaling)
  function box(el, stage) {
    let x = 0, y = 0, n = el;
    while (n && n !== stage) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  // wrap words in spans, keeping <em>
  function words(el) {
    const out = [];
    const walk = (node) => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of ch.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = part;
            frag.appendChild(s);
            out.push(s);
          }
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && !ch.classList.contains("bl")) walk(ch);
      }
    };
    walk(el);
    return out;
  }

  // where the dot of a lowercase i sits in this font: measured from the glyph itself
  function tittle(font, size) {
    const c = document.createElement("canvas");
    const S = Math.ceil(size * 1.6);
    c.width = S; c.height = S;
    const g = c.getContext("2d");
    g.font = font;
    g.textBaseline = "alphabetic";
    g.fillStyle = "#000";
    const base = Math.round(S * 0.8);
    g.fillText("i", Math.round(S * 0.3), base);
    const d = g.getImageData(0, 0, S, S).data;
    const rowInk = (y) => { for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 120) return true; return false; };
    let top = -1, bot = -1;
    for (let y = 0; y < base; y++) {
      if (rowInk(y)) { if (top < 0) top = y; } else if (top >= 0) { bot = y; break; }
    }
    if (top < 0 || bot < 0) return null;
    let x0 = S, x1 = 0;
    for (let y = top; y < bot; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 120) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return { cx: (x0 + x1 + 1) / 2 - Math.round(S * 0.3), cy: (top + bot) / 2 - base, size: Math.max(x1 - x0 + 1, bot - top) };
  }

  /* ---------- layout per format ---------- */

  function geometry(F) {
    const { w, h, u, shape } = F;
    const L = shape === "landscape", P = shape === "portrait";
    return {
      F, u, w, h, L, P, S: !L && !P,
      C: [w / 2, h / 2],
      A: L ? [w * 0.68, h * 0.52] : P ? [w / 2, h * 0.6] : [w / 2, h * 0.6],
      s0: u * (L ? 10 : 11),
      cap: L ? { left: w * 0.075, top: h * 0.5, width: w * 0.36, align: "left", size: u * 6.8, mid: true }
        : P ? { left: w * 0.08, top: h * 0.22, width: w * 0.84, align: "center", size: u * 7.6, mid: false }
        : { left: w * 0.08, top: h * 0.11, width: w * 0.84, align: "center", size: u * 6.4, mid: false },
    };
  }

  /* ---------- the moves ---------- */
  // Each move gets ctx { G, pal, prev, scene, t0, tl, el(), caption() } and returns
  // { dur, at(local) -> { dots, goo }, end: [dot], pal? }. at(0) must equal prev.

  const MOVES = {};

  // the dot as the move finds it, or a fresh one popping in at `p` when the film starts with this move
  function entry(ctx, p) {
    if (ctx.prev.length) return { ...ctx.prev.find((d) => d.id === "m") || ctx.prev[0] };
    return Dot("m", p[0], p[1], ctx.G.s0 * 0.2, ctx.pal.dot, { o: 0 });
  }
  // travel from the entry dot to a point (and size), in an arc: returns [duration, at(l)]
  function travel(ctx, from, to, size = ctx.G.s0, opts = {}) {
    const d = dist([from.x, from.y], to);
    const dur = opts.dur ?? (from.o === 0 ? 0.45 : d < 2 ? 0.12 : clamp(0.35 + d / (ctx.G.w * 1.6), 0.4, 0.75));
    const target = Dot("m", to[0], to[1], size, ctx.pal.dot);
    const lift = opts.lift ?? Math.min(d * 0.25, ctx.G.u * 14);
    const at = (l) => {
      const p = seg(l, 0, dur);
      if (from.o === 0) { // pop in
        const k = E.spring(p);
        return Dot("m", to[0], to[1], lerp(size * 0.2, size, k), ctx.pal.dot, { o: clamp(p * 3) });
      }
      const e = E.inOut(p);
      const [x, y] = arc([from.x, from.y], to, e, lift);
      const m = mixDot(from, target, e);
      // stretch along the motion at speed
      const v = Math.sin(Math.PI * e) * clamp(d / (ctx.G.u * 60)) * 0.16;
      return { ...m, x, y, sx: m.sx * (1 + v), sy: m.sy * (1 - v * 0.6) };
    };
    return [dur, at];
  }

  MOVES.drop = (ctx) => {
    const { G, pal, scene } = ctx;
    const s = G.s0, [tx, ty] = G.A;
    const first = !ctx.prev.length;
    const from = first ? null : entry(ctx, G.A);
    const pre = first ? 0 : 0.5;
    const top = first ? -s * 0.6 : ty - G.u * 26;
    const fall = first ? 0.62 : 0.5, b1 = 0.42, b2 = 0.26;
    const L1 = pre + fall, L2 = L1 + b1, L3 = L2 + b2;
    const H = ty - top, h1 = Math.min(H * 0.24, G.u * 12), h2 = h1 * 0.28;
    const dur = scene.dur || Math.max(2.3, L3 + 1.25);
    const squash = (l) => {
      let k = 0;
      for (const [ti, a] of [[L1, 0.34], [L2, 0.16], [L3, 0.07]]) {
        const q = 1 - Math.abs(l - ti) / 0.1;
        if (q > 0 && l >= ti - 0.03) k = Math.max(k, a * q * q);
      }
      return k;
    };
    ctx.caption(scene.text, L1 + 0.12, dur);
    return {
      dur,
      at(l) {
        let x = tx, y = ty, sx = 1, sy = 1, size = s;
        if (l < pre) {
          const p = E.out(seg(l, 0, pre));
          const m = mixDot(from, Dot("m", tx, top, s, pal.dot), p);
          return { dots: [m] };
        }
        if (l < L1) { const p = seg(l, pre, L1); y = top + H * p * p; sy = 1 + 0.2 * p * p; sx = 1 - 0.1 * p * p; }
        else if (l < L2) { const q = seg(l, L1, L2); y = ty - 4 * h1 * q * (1 - q); }
        else if (l < L3) { const q = seg(l, L2, L3); y = ty - 4 * h2 * q * (1 - q); }
        const k = squash(l);
        if (k) { sx = 1 + k; sy = 1 - k; y += (size * k) / 2; }
        if (l > L3 + 0.1) { const b = breathe(l - L3 - 0.1); sx *= b; sy *= b; }
        return { dots: [Dot("m", x, y, size, pal.dot, { sx, sy })] };
      },
      end: [Dot("m", tx, ty, s, pal.dot)],
    };
  };

  MOVES.grow = (ctx) => {
    const { G, pal, scene } = ctx;
    const shape = scene.shape || (scene.image ? "phone" : "card");
    const [ax, ay] = G.A;
    let W, H, R, inset;
    if (shape === "phone") { H = G.h * (G.L ? 0.68 : G.P ? 0.42 : 0.6); W = H * (9 / 19.5); R = W * 0.13; inset = G.u * 1.1; }
    else if (shape === "browser") { W = G.w * (G.L ? 0.46 : 0.84); H = W * 0.64; R = G.u * 1.6; inset = G.u * 0.9; }
    else if (shape === "square") { W = H = Math.min(G.w, G.h) * (G.L ? 0.56 : 0.6); R = G.u * 3; inset = G.u * 1.1; }
    else { W = G.w * (G.L ? 0.36 : 0.76); H = W * 0.72; R = G.u * 3; inset = 0; }
    const from = entry(ctx, G.A);
    const [tr, go] = travel(ctx, from, G.A);
    const g0 = tr + 0.12, g1 = g0 + 0.7;
    const dur = scene.dur || g1 + 1.9 + 0.7;
    const out0 = dur - 0.75, out1 = dur;
    const s = G.s0;

    // what the screen shows: the user's image, or a simple card drawn in the film's colours
    const scr = ctx.el("div", "screen " + shape);
    Object.assign(scr.style, { left: ax - W / 2 + "px", top: ay - H / 2 + "px", width: W + "px", height: H + "px", borderRadius: R + "px", padding: inset + "px", color: css(rgb(pal.bg)) });
    if (shape === "browser") scr.innerHTML = `<div class="chrome"><i></i><i></i><i></i></div>`;
    const body = document.createElement("div");
    body.className = "body";
    body.style.borderRadius = Math.max(0, R - inset) + "px";
    scr.appendChild(body);
    let rows = [];
    if (scene.image) {
      body.innerHTML = `<img src="${esc(scene.image)}" alt="">`;
      rows = [body.firstChild];
    } else {
      const c = scene.card || { title: scene.title || "", lines: scene.lines || [] };
      const fs = shape === "phone" ? W * 0.08 : G.u * 3;
      body.style.fontSize = fs + "px";
      body.style.padding = (shape === "phone" ? fs * 1.1 : fs * 1.3) + "px";
      body.innerHTML = `${shape === "phone" ? '<div class="status"><b></b><span></span></div>' : ""}<div class="ttl">${md(c.title)}</div>` +
        (c.lines || []).map((t, i) => `<div class="row"><i style="background:${i === 0 ? pal.accent : "currentColor"}"></i><span>${md(t)}</span></div>`).join("");
      rows = [...body.children];
    }
    ctx.tl.show(scr, ctx.t0 + g1 - 0.25, ctx.t0 + out0 + 0.3);
    ctx.tl.stagger(rows, { opacity: 1, y: 0 }, ctx.t0 + g1 - 0.2, 0.5, 0.09, "out", { opacity: 0, y: G.u * 1.5 });
    ctx.tl.to(rows, { opacity: 0 }, ctx.t0 + out0, 0.25, "in");
    ctx.caption(scene.text, tr + 0.1, dur);

    const rect = Dot("m", ax, ay, s, pal.dot, { w: W, h: H, r: R });
    const dotAt = Dot("m", ax, ay, s, pal.dot);
    const springy = Film.spring(0.18);
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        if (l < g0) { const k = 1 - 0.12 * Math.sin(Math.PI * seg(l, tr, g0)); return { dots: [Dot("m", ax, ay, s * k, pal.dot)] }; }
        if (l < out0) {
          const p = springy(seg(l, g0, g1));
          const d = mixDot(dotAt, rect, p);
          d.r = lerp(s / 2, R, clamp(p * 1.4));
          return { dots: [d] };
        }
        const p = E.inOut(seg(l, out0 + 0.15, out1));
        return { dots: [mixDot(rect, dotAt, p)] };
      },
      end: [dotAt],
    };
  };

  MOVES.split = (ctx) => {
    const { G, pal, scene } = ctx;
    const items = (scene.items || []).slice(0, 4);
    const n = Math.max(2, items.length);
    const [ax, ay] = G.A;
    const s = G.s0, sc = s * 0.74;
    const row = G.L;
    const gap = row ? Math.min(G.w * 0.15, (G.w * 0.48) / (n - 1)) : Math.min(G.h * (G.P ? 0.1 : 0.14), (G.h * 0.36) / (n - 1));
    const col = 0;
    const pos = Array.from({ length: n }, (_, i) => row ? [ax + (i - (n - 1) / 2) * gap, ay - G.u * 3] : [col, ay + (i - (n - 1) / 2) * gap]);
    const fs = G.u * (row ? 4.4 : G.P ? 5.4 : 4.8);
    if (!row) {
      // centre the column of dots and labels as one group
      const c = document.createElement("canvas").getContext("2d");
      c.font = `600 ${fs}px ${ctx.font}`;
      const wmax = Math.max(...items.map((t) => c.measureText(t.replace(/\*/g, "")).width));
      const gw = sc + G.u * 3 + wmax;
      pos.forEach((p) => (p[0] = G.w / 2 - gw / 2 + sc / 2));
    }
    const from = entry(ctx, G.A);
    const [tr, go] = travel(ctx, from, G.A);
    const a0 = tr, a1 = a0 + 0.25, s1 = a1 + 0.95, beat = 0.5;
    const read = s1 + n * beat + 0.7;
    const dur = scene.dur || read + 0.8;
    const m0 = dur - 0.8, m1 = dur - 0.08;
    ctx.caption(scene.text, tr + 0.1, dur);
    items.forEach((t, i) => {
      const lab = ctx.el("div", "label");
      lab.innerHTML = md(t);
      lab.style.fontSize = fs + "px";
      lab.style.color = pal.ink;
      if (row) Object.assign(lab.style, { left: pos[i][0] - gap / 2 + "px", width: gap + "px", top: pos[i][1] + sc / 2 + G.u * 2.4 + "px", textAlign: "center" });
      else Object.assign(lab.style, { left: pos[i][0] + sc / 2 + G.u * 3 + "px", top: pos[i][1] - fs * 0.62 + "px", width: G.w * 0.55 + "px" });
      const at = ctx.t0 + s1 - 0.25 + i * beat;
      ctx.tl.fromTo(lab, { opacity: 0, y: fs * 0.45 }, { opacity: 1, y: 0 }, at, 0.5, "out");
      ctx.tl.to(lab, { opacity: 0, y: -fs * 0.3 }, ctx.t0 + m0 - 0.05, 0.3, "in");
      ctx.tl.show(lab, at - 0.01, ctx.t0 + m0 + 0.3);
    });
    const spread = Film.spring(0.2);
    return {
      dur,
      at(l) {
        if (l < a0) return { dots: [go(l)] };
        if (l < a1) {
          const k = Math.sin((Math.PI / 2) * seg(l, a0, a1));
          return { dots: [Dot("m", ax, ay, s, pal.dot, row ? { sx: 1 + 0.32 * k, sy: 1 - 0.18 * k } : { sy: 1 + 0.32 * k, sx: 1 - 0.18 * k })] };
        }
        const dots = pos.map((p, i) => {
          const e = spread(seg(l, a1 + i * 0.05, s1 + i * 0.05));
          let d = Dot("k" + i, lerp(ax, p[0], e), lerp(ay, p[1], e), lerp(s, sc, clamp(e)), pal.dot);
          // each one pulses as its label lands
          const hi = s1 - 0.25 + i * beat;
          const pk = seg(l, hi, hi + 0.45);
          if (pk > 0 && pk < 1) { const b = 1 + 0.22 * Math.sin(Math.PI * pk); d.sx = d.sy = b; }
          if (l >= m0) {
            const q = E.inOut(seg(l, m0 + i * 0.03, m1));
            d = mixDot(d, Dot("k" + i, ax, ay, s, pal.dot), q);
          }
          return d;
        });
        const goo = l < s1 + 0.15 || l > m0 - 0.05;
        return { dots, goo };
      },
      end: [Dot("m", ax, ay, s, pal.dot)],
    };
  };

  MOVES.line = (ctx) => {
    const { G, pal, scene } = ctx;
    const vals = scene.values || scene.points || [1, 2, 3];
    const n = vals.length;
    const box0 = G.L ? { x0: G.w * 0.48, x1: G.w * 0.9, top: G.h * 0.26, bot: G.h * 0.72 }
      : G.P ? { x0: G.w * 0.12, x1: G.w * 0.88, top: G.h * 0.43, bot: G.h * 0.74 }
      : { x0: G.w * 0.12, x1: G.w * 0.88, top: G.h * 0.4, bot: G.h * 0.76 };
    const vmax = Math.max(...vals) || 1;
    const pts = vals.map((v, i) => [lerp(box0.x0, box0.x1, n > 1 ? i / (n - 1) : 0.5), box0.bot - (Math.max(0, v) / vmax) * (box0.bot - box0.top)]);
    // a smooth curve through the points (Catmull-Rom)
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    const svg = ctx.svg;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    Object.assign(path.style, { fill: "none", stroke: pal.dot, strokeWidth: G.u * 0.75 + "px", strokeLinecap: "round", strokeLinejoin: "round" });
    svg.appendChild(path);
    const Ltot = path.getTotalLength();
    const N = 240, samples = [];
    for (let i = 0; i <= N; i++) { const p = path.getPointAtLength((i / N) * Ltot); samples.push([p.x, p.y]); }
    const at = (len) => { const f = clamp(len / Ltot) * N, i = Math.floor(f), k = f - i; const a = samples[i], b = samples[Math.min(N, i + 1)]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; };
    const lenAt = pts.map((p) => { let best = 0, bd = Infinity; samples.forEach((s, i) => { const dd = dist(s, p); if (dd < bd) { bd = dd; best = i; } }); return (best / N) * Ltot; });
    const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    for (const [k, v] of Object.entries({ x1: box0.x0 - G.u * 2, x2: box0.x1 + G.u * 2, y1: box0.bot + G.u * 3.5, y2: box0.bot + G.u * 3.5 })) axis.setAttribute(k, v);
    Object.assign(axis.style, { stroke: pal.ink, strokeOpacity: 0.22, strokeWidth: G.u * 0.25 + "px" });
    svg.appendChild(axis);

    const s = G.s0, sl = s * 0.5;
    const from = entry(ctx, pts[0]);
    const [tr, go] = travel(ctx, from, pts[0], sl);
    const d0 = tr + 0.1, d1 = d0 + clamp(0.9 + 0.5 * (n - 1), 1.4, 3);
    const dur = scene.dur || d1 + 1.5;
    const o0 = dur - 0.75;
    ctx.caption(scene.text, Math.min(tr, 0.4), dur);
    // the line draws behind the dot
    path.style.strokeDasharray = `${Ltot} ${Ltot}`;
    ctx.tl.fn(ctx.t0 + d0, d1 - d0, (p) => (path.style.strokeDashoffset = Ltot * (1 - p)), "inOut");
    ctx.tl.show([path, axis], ctx.t0 + d0 - 0.01, ctx.t0 + dur);
    ctx.tl.fromTo(axis, { opacity: 0 }, { opacity: 1 }, ctx.t0 + tr * 0.5, 0.5, "soft");
    ctx.tl.to([path, axis], { opacity: 0 }, ctx.t0 + o0, 0.4, "in");
    // markers and labels pop as the dot passes
    const drawE = E.inOut;
    const passT = lenAt.map((len) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (drawE(m) * Ltot < len) lo = m; else hi = m; }
      return d0 + lo * (d1 - d0);
    });
    const labs = scene.labels || [];
    pts.forEach((p, i) => {
      const mk = ctx.el("div", "mark", true);
      Object.assign(mk.style, { left: p[0] - G.u * 1.1 + "px", top: p[1] - G.u * 1.1 + "px", width: G.u * 2.2 + "px", height: G.u * 2.2 + "px", background: pal.bg, borderColor: pal.dot, borderWidth: G.u * 0.5 + "px" });
      ctx.tl.fromTo(mk, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1 }, ctx.t0 + passT[i], 0.35, "spring");
      ctx.tl.to(mk, { opacity: 0 }, ctx.t0 + o0, 0.3, "in");
      ctx.tl.show(mk, ctx.t0 + passT[i] - 0.01, ctx.t0 + dur);
      if (labs[i]) {
        const lb = ctx.el("div", "tick");
        lb.textContent = labs[i];
        Object.assign(lb.style, { left: p[0] - G.u * 8 + "px", width: G.u * 16 + "px", top: box0.bot + G.u * 5 + "px", fontSize: G.u * 3 + "px", color: pal.ink });
        ctx.tl.fromTo(lb, { opacity: 0, y: G.u }, { opacity: 0.6, y: 0 }, ctx.t0 + passT[i], 0.4, "out");
        ctx.tl.to(lb, { opacity: 0 }, ctx.t0 + o0, 0.3, "in");
        ctx.tl.show(lb, ctx.t0 + passT[i] - 0.01, ctx.t0 + dur);
      }
    });
    if (scene.value) {
      const last = pts[n - 1];
      const v = ctx.el("div", "callout");
      v.innerHTML = md(scene.value);
      const fs = G.u * (G.L ? 9 : 11);
      Object.assign(v.style, { fontSize: fs + "px", color: pal.accent, left: last[0] - G.u * 40 + "px", width: G.u * 40 - G.u * 4 + "px", top: last[1] - fs * 1.15 + "px", textAlign: "right" });
      ctx.tl.fromTo(v, { opacity: 0, y: fs * 0.3 }, { opacity: 1, y: 0 }, ctx.t0 + d1 - 0.05, 0.5, "snap");
      ctx.tl.to(v, { opacity: 0, y: -fs * 0.2 }, ctx.t0 + o0, 0.3, "in");
      ctx.tl.show(v, ctx.t0 + d1 - 0.06, ctx.t0 + dur);
    }
    const lastP = pts[n - 1];
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        if (l < d0) return { dots: [Dot("m", pts[0][0], pts[0][1], sl, pal.dot)] };
        if (l < o0) {
          const [x, y] = at(Ltot * drawE(seg(l, d0, d1)));
          const b = l > d1 ? breathe(l - d1, 0.03) : 1;
          return { dots: [Dot("m", x, y, sl, pal.dot, { sx: b, sy: b })] };
        }
        const p = E.inOut(seg(l, o0 + 0.2, dur));
        return { dots: [Dot("m", lastP[0], lastP[1], lerp(sl, s, p), pal.dot)] };
      },
      end: [Dot("m", lastP[0], lastP[1], s, pal.dot)],
    };
  };

  MOVES.ring = (ctx) => {
    const { G, pal, scene } = ctx;
    const [ax, ay] = G.A;
    const D = G.u * (G.L ? 34 : 40), T = G.u * 3, s = G.s0;
    const from = entry(ctx, G.A);
    const [tr, go] = travel(ctx, from, G.A);
    const g1 = tr + 0.6, h0 = g1 - 0.08, h1 = h0 + 0.45, a0 = h1 - 0.05, a1 = a0 + 1.4;
    const dur = scene.dur || a1 + 1.7;
    const o0 = dur - 0.85;
    const hole = ctx.el("div", "hole");
    Object.assign(hole.style, { left: ax + "px", top: ay + "px", background: pal.bg });
    ctx.tl.fromTo(hole, { width: 0, height: 0, marginLeft: 0, marginTop: 0 }, { width: D - 2 * T, height: D - 2 * T, marginLeft: -(D - 2 * T) / 2, marginTop: -(D - 2 * T) / 2 }, ctx.t0 + h0, h1 - h0, "out");
    ctx.tl.to(hole, { width: 0, height: 0, marginLeft: 0, marginTop: 0 }, ctx.t0 + o0 + 0.2, 0.35, "in");
    ctx.tl.show(hole, ctx.t0 + h0, ctx.t0 + o0 + 0.56);
    const r = D / 2 - T / 2, C = 2 * Math.PI * r;
    const arcEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    for (const [k, v] of Object.entries({ cx: ax, cy: ay, r, transform: `rotate(-90 ${ax} ${ay})` })) arcEl.setAttribute(k, v);
    Object.assign(arcEl.style, { fill: "none", stroke: pal.accent, strokeWidth: T + 0.5 + "px", strokeDasharray: `${C} ${C}`, strokeDashoffset: C });
    ctx.svgTop.appendChild(arcEl);
    const value = Number(scene.value ?? 0), frac = clamp(value / Number(scene.max ?? 100));
    ctx.tl.fn(ctx.t0 + a0, a1 - a0, (p) => (arcEl.style.strokeDashoffset = C * (1 - frac * p)), "inOut");
    ctx.tl.show(arcEl, ctx.t0 + a0, ctx.t0 + o0 + 0.3);
    ctx.tl.to(arcEl, { opacity: 0 }, ctx.t0 + o0, 0.25, "in");
    const num = ctx.el("div", "num");
    const fs = G.u * (G.L ? 9.5 : 11);
    Object.assign(num.style, { left: ax - D / 2 + "px", width: D + "px", top: ay - fs * 0.62 + "px", fontSize: fs + "px", color: pal.ink });
    num.innerHTML = `<b>0</b><small>${esc(scene.suffix ?? "%")}</small>`;
    const b = num.firstChild;
    ctx.tl.fn(ctx.t0 + a0, a1 - a0, (p) => (b.textContent = Film.formatNumber(value * p, scene.value)), "inOut");
    ctx.tl.fromTo(num, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }, ctx.t0 + a0, 0.4, "out");
    ctx.tl.to(num, { opacity: 0, scale: 0.94 }, ctx.t0 + o0, 0.25, "in");
    ctx.tl.show(num, ctx.t0 + a0, ctx.t0 + o0 + 0.3);
    ctx.caption(scene.text, tr + 0.15, dur);
    const big = Dot("m", ax, ay, D, pal.dot), dotAt = Dot("m", ax, ay, s, pal.dot);
    const springy = Film.spring(0.15);
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        if (l < o0 + 0.5) { const p = springy(seg(l, tr, g1)); return { dots: [mixDot(dotAt, big, p)] }; }
        return { dots: [mixDot(big, dotAt, E.inOut(seg(l, o0 + 0.5, dur)))] };
      },
      end: [dotAt],
    };
  };

  MOVES.pulse = (ctx) => {
    const { G, pal, scene } = ctx;
    const [ax, ay] = G.A;
    const s = G.s0 * 1.2;
    const from = entry(ctx, G.A);
    const [tr, go] = travel(ctx, from, G.A, s);
    const beats = [tr + 0.15, tr + 0.75, tr + 1.35];
    const dur = scene.dur || tr + 3;
    for (const bt of beats) {
      const ring = ctx.el("div", "ring");
      Object.assign(ring.style, { left: ax + "px", top: ay + "px", width: s + "px", height: s + "px", marginLeft: -s / 2 + "px", marginTop: -s / 2 + "px", borderColor: pal.dot, borderWidth: G.u * 0.6 + "px" });
      ctx.tl.fromTo(ring, { scale: 1, opacity: 0.9 }, { scale: 3.6, opacity: 0 }, ctx.t0 + bt, 1.3, "out");
      ctx.tl.show(ring, ctx.t0 + bt, ctx.t0 + bt + 1.3);
    }
    if (scene.badge !== undefined) {
      const bd = ctx.el("div", "badge");
      bd.textContent = scene.badge;
      const fs = G.u * 3.2;
      Object.assign(bd.style, { left: ax + s * 0.28 + "px", top: ay - s * 0.62 - fs + "px", fontSize: fs + "px", background: pal.accent, color: pal.bg });
      ctx.tl.fromTo(bd, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1 }, ctx.t0 + tr + 0.35, 0.5, "spring(0.35)");
      ctx.tl.to(bd, { scale: 0.6, opacity: 0 }, ctx.t0 + dur - 0.45, 0.3, "in");
      ctx.tl.show(bd, ctx.t0 + tr + 0.35, ctx.t0 + dur);
    }
    ctx.caption(scene.text, tr + 0.1, dur);
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        let k = 1;
        for (const bt of beats) { const q = seg(l, bt - 0.12, bt + 0.3); if (q > 0 && q < 1) k = Math.min(k, 1 - 0.14 * Math.sin(Math.PI * q)); }
        const back = E.inOut(seg(l, dur - 0.5, dur));
        const size = lerp(s, G.s0, back);
        return { dots: [Dot("m", ax, ay, size, pal.dot, { sx: k * breathe(l - tr), sy: k * breathe(l - tr) })] };
      },
      end: [Dot("m", ax, ay, G.s0, pal.dot)],
    };
  };

  MOVES.orbit = (ctx) => {
    const { G, pal, scene } = ctx;
    const items = (scene.items || []).slice(0, 6);
    const n = Math.max(1, items.length);
    const [ax, ay] = G.A;
    const s = G.s0, sm = s * 1.25, ss = s * 0.34;
    const R = G.u * (G.L ? 20 : 23);
    const from = entry(ctx, G.A);
    const [tr, go] = travel(ctx, from, G.A, sm);
    const e0 = tr + 0.05, e1 = e0 + 0.8;
    const dur = scene.dur || e1 + 2.6;
    const m0 = dur - 0.85, m1 = dur - 0.15;
    const spin = (l) => 0.22 * (l - e0); // turns per second
    const angle = (i, l) => -Math.PI / 2 + (i / n) * Math.PI * 2 + spin(l) * Math.PI * 2 * 0.35;
    const fs = G.u * (G.L ? 3.7 : 4.3);
    const labs = items.map((t, i) => {
      const lb = ctx.el("div", "olabel");
      lb.innerHTML = md(t);
      Object.assign(lb.style, { fontSize: fs + "px", color: pal.ink });
      ctx.tl.fromTo(lb, { opacity: 0 }, { opacity: 1 }, ctx.t0 + e1 - 0.3 + i * 0.08, 0.4, "soft");
      ctx.tl.to(lb, { opacity: 0 }, ctx.t0 + m0 - 0.1, 0.3, "in");
      ctx.tl.show(lb, ctx.t0 + e1 - 0.3, ctx.t0 + m0 + 0.3);
      return lb;
    });
    const out = Film.spring(0.2);
    const radius = (l) => (l < m0 ? R * out(seg(l, e0, e1)) : R * (1 - E.inOut(seg(l, m0, m1))));
    ctx.tl.fn(ctx.t0, dur, (p, t) => {
      const l = t - ctx.t0;
      labs.forEach((lb, i) => {
        const a = angle(i, l), r = radius(l) + ss / 2 + G.u * 2.2;
        const x = ax + Math.cos(a) * r, y = ay + Math.sin(a) * r;
        const right = Math.cos(a) >= -0.15;
        lb.style.transform = `translate(${x}px, ${y}px) translate(${right ? (Math.cos(a) > 0.5 ? 0 : -50) : -100}%, -50%)`;
      });
    });
    ctx.caption(scene.text, tr + 0.1, dur);
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        const r = radius(l);
        const b = breathe(l - tr, 0.02);
        const mainSize = l < m0 ? sm : lerp(sm, s, E.inOut(seg(l, m0, m1)));
        const dots = [Dot("m", ax, ay, mainSize, pal.dot, { sx: b, sy: b })];
        items.forEach((_, i) => {
          const a = angle(i, l);
          dots.push(Dot("k" + i, ax + Math.cos(a) * r, ay + Math.sin(a) * r, lerp(sm * 0.5, ss, clamp(r / R)), pal.dot));
        });
        return { dots, goo: r < R * 0.85 };
      },
      end: [Dot("m", ax, ay, s, pal.dot)],
    };
  };

  MOVES.button = (ctx) => {
    const { G, pal, scene } = ctx;
    const [ax, ay] = G.A;
    const s = G.s0;
    const fs = G.u * (G.L ? 4.4 : 5.2);
    const measure = (t) => { const c = document.createElement("canvas").getContext("2d"); c.font = `600 ${fs}px ${ctx.font}`; return c.measureText(t).width; };
    const label = scene.label || "Go", done = scene.done;
    const Hh = fs * 2.4, W1 = measure(label) + fs * 2.4, W2 = done ? measure(done) + fs * 2.4 : W1;
    const from = entry(ctx, G.A);
    const [tr, go] = travel(ctx, from, G.A);
    const g0 = tr + 0.05, g1 = g0 + 0.6, press = g1 + 0.9;
    const dur = scene.dur || press + 1.9;
    const o0 = dur - 0.65;
    const mk = (t) => {
      const e = ctx.el("div", "blabel");
      e.textContent = t;
      Object.assign(e.style, { left: ax - G.w / 2 + "px", width: G.w + "px", top: ay - fs * 0.62 + "px", fontSize: fs + "px", color: pal.bg });
      return e;
    };
    const l1 = mk(label);
    ctx.tl.fromTo(l1, { opacity: 0, y: fs * 0.3 }, { opacity: 1, y: 0 }, ctx.t0 + g1 - 0.3, 0.4, "out");
    if (done) {
      const l2 = mk(done);
      ctx.tl.to(l1, { opacity: 0, y: -fs * 0.3 }, ctx.t0 + press + 0.2, 0.25, "in");
      ctx.tl.fromTo(l2, { opacity: 0, y: fs * 0.3 }, { opacity: 1, y: 0 }, ctx.t0 + press + 0.4, 0.4, "out");
      ctx.tl.to(l2, { opacity: 0 }, ctx.t0 + o0, 0.2, "in");
      ctx.tl.show(l2, ctx.t0 + press + 0.4, ctx.t0 + o0 + 0.2);
    } else ctx.tl.to(l1, { opacity: 0 }, ctx.t0 + o0, 0.2, "in");
    ctx.tl.show(l1, ctx.t0 + g1 - 0.3, ctx.t0 + (done ? press + 0.45 : o0 + 0.2));
    const rip = ctx.el("div", "ripple");
    Object.assign(rip.style, { left: ax - W1 / 2 + "px", top: ay - Hh / 2 + "px", width: W1 + "px", height: Hh + "px", borderRadius: Hh / 2 + "px", borderColor: pal.dot, borderWidth: G.u * 0.4 + "px" });
    ctx.tl.fromTo(rip, { scale: 1, opacity: 0.7 }, { scale: 1.45, opacity: 0 }, ctx.t0 + press + 0.05, 0.7, "out");
    ctx.tl.show(rip, ctx.t0 + press + 0.05, ctx.t0 + press + 0.75);
    ctx.caption(scene.text, tr + 0.1, dur);
    const springy = Film.spring(0.2);
    const pill = (w) => Dot("m", ax, ay, s, pal.dot, { w, h: Hh, r: Hh / 2 });
    const dotAt = Dot("m", ax, ay, s, pal.dot);
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        let d;
        if (l < press + 0.3) d = mixDot(dotAt, pill(W1), springy(seg(l, g0, g1)));
        else d = mixDot(pill(W1), pill(W2), springy(seg(l, press + 0.3, press + 0.9)));
        d.r = Math.min(d.w, d.h) / 2;
        const q = seg(l, press - 0.06, press + 0.3);
        if (q > 0 && q < 1) { const k = 1 - 0.07 * Math.sin(Math.PI * q); d.sx = d.sy = k; }
        if (l >= o0) { d = mixDot(pill(W2), dotAt, E.inOut(seg(l, o0 + 0.1, dur))); d.r = Math.min(d.w, d.h) / 2; }
        return { dots: [d] };
      },
      end: [dotAt],
    };
  };

  MOVES.type = (ctx) => {
    const { G, pal, scene } = ctx;
    const prompt = scene.prompt || "";
    let fs = G.u * (G.L ? 4.6 : 5);
    const maxW = G.L ? G.w * 0.5 : G.w * 0.86;
    const mono = document.createElement("canvas").getContext("2d");
    const measure = (t) => { mono.font = `500 ${fs}px ${ctx.font}`; return mono.measureText(t).width; };
    while (measure(prompt) + fs * 3.4 > maxW && fs > G.u * 2.4) fs *= 0.94;
    const H = fs * 2.2, pad = fs * 0.85;
    const W = Math.min(maxW, measure(prompt) + pad * 2 + H * 1.1);
    const [ax, ay] = G.A;
    const left = ax - W / 2;
    const field = ctx.el("div", "field");
    Object.assign(field.style, { left: left + "px", top: ay - H / 2 + "px", width: W + "px", height: H + "px", borderRadius: H / 2 + "px", borderColor: pal.ink, borderWidth: G.u * 0.3 + "px" });
    const txt = ctx.el("div", "typed");
    Object.assign(txt.style, { left: left + pad + "px", top: ay - fs * 0.62 + "px", fontSize: fs + "px", color: pal.ink });
    txt.innerHTML = [...prompt].map((c) => `<span>${c === " " ? "&nbsp;" : esc(c)}</span>`).join("");
    const chars = [...txt.children];
    const ends = chars.map((c) => c.offsetLeft + c.offsetWidth);
    const caretX = (k) => left + pad + (k ? ends[k - 1] : 0) + fs * 0.08;
    const cw = Math.max(2, fs * 0.09), ch = fs * 1.18;
    const from = entry(ctx, [caretX(0), ay]);
    const [tr, go] = travel(ctx, from, [caretX(0), ay], G.s0);
    const m1 = tr + 0.4, ty0 = m1 + 0.5;
    const rnd = Film.rand(prompt);
    const cps = 0.04;
    const tk = chars.map((_, i) => ty0 + i * cps + rnd.range(-0.012, 0.012));
    const ty1 = tk.length ? tk[tk.length - 1] + 0.05 : ty0;
    const send = ty1 + 0.65;
    const dur = scene.dur || send + 1.1;
    const sendX = left + W - H / 2;
    ctx.tl.fromTo(field, { opacity: 0, scaleX: 0.96 }, { opacity: 0.32, scaleX: 1 }, ctx.t0 + tr - 0.05, 0.5, "out");
    ctx.tl.to(field, { opacity: 0, y: -G.u * 2 }, ctx.t0 + send + 0.35, 0.4, "in");
    ctx.tl.to(txt, { opacity: 0, y: -G.u * 2 }, ctx.t0 + send + 0.3, 0.4, "in");
    ctx.tl.show([field, txt], ctx.t0 + tr - 0.05, ctx.t0 + dur);
    ctx.tl.fn(ctx.t0, dur, (p, t) => { const l = t - ctx.t0; chars.forEach((c, i) => (c.style.opacity = l >= tk[i] ? 1 : 0)); });
    ctx.caption(scene.text, tr + 0.1, dur);
    const caret = (x, o = 1) => Dot("m", x, ay, cw, pal.ink, { w: cw, h: ch, r: cw / 2, o });
    const blink = (l) => (Math.floor(l / 0.32) % 2 === 0 ? 1 : 0);
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        if (l < m1) return { dots: [mixDot(Dot("m", caretX(0), ay, G.s0, pal.dot), caret(caretX(0)), E.out(seg(l, tr, m1)))] };
        if (l < send) {
          const k = tk.filter((x) => x <= l).length;
          const typing = l >= ty0 && l < ty1 + 0.05;
          return { dots: [caret(caretX(k), typing ? 1 : blink(l - m1))] };
        }
        // send: the caret becomes the dot again and jumps into the send button
        const p = seg(l, send, send + 0.55);
        const e = E.inOut(p);
        const [x, y] = arc([caretX(chars.length), ay], [sendX, ay], e, G.u * 6);
        const d = mixDot(caret(caretX(chars.length)), Dot("m", sendX, ay, H * 0.78, pal.dot), e);
        d.x = x; d.y = y;
        if (l > send + 0.55) { const q = E.inOut(seg(l, send + 0.6, dur)); return { dots: [Dot("m", sendX, ay, lerp(H * 0.78, G.s0, q), pal.dot)] }; }
        return { dots: [d] };
      },
      end: [Dot("m", sendX, ay, G.s0, pal.dot)],
    };
  };

  MOVES.bounce = (ctx) => {
    const { G, pal, scene } = ctx;
    const el = ctx.el("div", "sentence");
    const fs = G.u * (G.L ? 9.5 : G.P ? 10 : 9);
    Object.assign(el.style, { left: G.w * 0.09 + "px", width: G.w * 0.82 + "px", top: G.h * 0.5 - fs * 0.7 + "px", fontSize: fs + "px", color: pal.ink });
    el.innerHTML = md(scene.text);
    const ws = words(el);
    // two lines: centre the block vertically
    const bh = el.offsetHeight;
    el.style.top = G.h * (G.P ? 0.48 : 0.5) - bh / 2 + "px";
    const sb = fs * 0.2;
    const spots = ws.map((w) => { const b = box(w, ctx.stage); return [b.x + b.w / 2, b.y + fs * 0.12 - sb / 2 - G.u * 0.2]; });
    const from = entry(ctx, spots[0]);
    const hopT = 0.34;
    const [tr, go] = travel(ctx, from, spots[0], sb, { lift: G.u * 18 });
    const lands = ws.map((_, i) => tr + i * hopT);
    const last = lands[lands.length - 1];
    const hold = 1.2 + Math.max(0, ws.length - 3) * 0.25;
    const dur = scene.dur || last + hold + 0.75;
    const o0 = dur - 0.7;
    ws.forEach((w, i) => {
      ctx.tl.fromTo(w, { opacity: 0, y: fs * 0.25 }, { opacity: 1, y: 0 }, ctx.t0 + lands[i] - 0.04, 0.35, "out");
      ctx.tl.to(w, { opacity: 0, y: -fs * 0.2 }, ctx.t0 + o0 + i * 0.03, 0.3, "in");
    });
    ctx.tl.show(el, ctx.t0, ctx.t0 + dur);
    const endP = G.C;
    return {
      dur,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        if (l < last) {
          const i = Math.min(ws.length - 2, Math.floor((l - tr) / hopT));
          const q = seg(l, lands[i], lands[i + 1]);
          const a = spots[i], b = spots[i + 1];
          const far = Math.abs(b[1] - a[1]) > fs * 0.5;
          const hgt = far ? fs * 0.9 : fs * 0.55;
          const x = lerp(a[0], b[0], q), y = lerp(a[1], b[1], q) - 4 * hgt * q * (1 - q);
          const k = q < 0.12 ? 0.25 * (1 - q / 0.12) : q > 0.92 ? 0.2 * ((q - 0.92) / 0.08) : 0;
          return { dots: [Dot("m", x, y + (sb * k) / 2, sb, pal.dot, { sx: 1 + k, sy: 1 - k })] };
        }
        if (l < o0) {
          const q = seg(l, last, last + 0.12);
          const k = 0.25 * (1 - q);
          const p = spots[spots.length - 1];
          return { dots: [Dot("m", p[0], p[1] + (sb * k) / 2, sb, pal.dot, { sx: 1 + k, sy: 1 - k })] };
        }
        const p = E.inOut(seg(l, o0 + 0.05, dur));
        const s0 = spots[spots.length - 1];
        const [x, y] = arc(s0, endP, p, G.u * 10);
        return { dots: [Dot("m", x, y, lerp(sb, G.s0, p), pal.dot)] };
      },
      end: [Dot("m", endP[0], endP[1], G.s0, pal.dot)],
    };
  };

  MOVES.fill = (ctx) => {
    const { G, pal, scene } = ctx;
    const [cx, cy] = G.C;
    const s = G.s0;
    const from = entry(ctx, G.C);
    const [tr, go] = travel(ctx, from, G.C);
    const g0 = tr + 0.05, g1 = g0 + 0.75;
    const next = { bg: pal.dot, dot: pal.bg, ink: pal.bg, accent: pal.accent };
    ctx.tl.set(ctx.bg, { backgroundColor: next.bg }, ctx.t0 + g1);
    const el = ctx.el("div", "headline");
    const fs = G.u * (G.L ? 11 : 11);
    Object.assign(el.style, { left: G.w * 0.1 + "px", width: G.w * 0.8 + "px", fontSize: fs + "px", color: next.ink });
    el.innerHTML = md(scene.text) + '<span class="bl"></span>';
    const ws = words(el);
    el.style.top = cy - el.offsetHeight / 2 + "px";
    const bl = box(el.querySelector(".bl"), ctx.stage);
    const ps = fs * 0.2;
    const period = [bl.x + fs * 0.08 + ps / 2, bl.y - ps / 2];
    const w0 = g1 + 0.12;
    ctx.tl.stagger(ws, { opacity: 1, y: 0 }, ctx.t0 + w0, 0.55, 0.08, "out", { opacity: 0, y: fs * 0.4 });
    const pdot = w0 + ws.length * 0.08 + 0.25;
    const hold = 1.1 + Math.max(0, ws.length - 3) * 0.2;
    const dur = scene.dur || pdot + hold + 0.7;
    const o0 = dur - 0.7;
    ctx.tl.stagger(ws, { opacity: 0, y: -fs * 0.25 }, ctx.t0 + o0, 0.3, 0.03, "in");
    ctx.tl.show(el, ctx.t0 + w0 - 0.01, ctx.t0 + dur);
    const big = Math.hypot(G.w, G.h) * 1.05;
    const springy = Film.spring(0.32);
    return {
      dur,
      pal: next,
      at(l) {
        if (l < tr) return { dots: [go(l)] };
        if (l < g1) {
          const p = E.inOut(seg(l, g0, g1));
          return { dots: [Dot("m", cx, cy, lerp(s, big, p), pal.dot)] };
        }
        if (l < pdot) return { dots: [] };
        if (l < o0) {
          const p = springy(seg(l, pdot, pdot + 0.5));
          return { dots: [Dot("m", period[0], period[1], ps * clamp(p, 0, 2), next.dot, { o: clamp(seg(l, pdot, pdot + 0.08)) })] };
        }
        const p = E.inOut(seg(l, o0 + 0.05, dur));
        const [x, y] = arc(period, G.C, p, G.u * 8);
        return { dots: [Dot("m", x, y, lerp(ps, s, p), next.dot)] };
      },
      end: [Dot("m", cx, cy, s, next.dot)],
    };
  };

  MOVES.logo = (ctx) => {
    const { G, pal, scene } = ctx;
    const brand = scene.brand || "brand";
    const mode = scene.dot || (/[i]/.test(brand) ? "i" : "period");
    const fs = G.u * (G.L ? 18 : G.P ? 19 : 18);
    const wrap = ctx.el("div", "brand");
    Object.assign(wrap.style, { left: 0, width: G.w + "px", fontSize: fs + "px", color: pal.ink });
    const idx = mode === "i" ? brand.lastIndexOf("i") : -1;
    wrap.innerHTML = `<span class="mask">${[...brand].map((c, i) => `<span class="c${i === idx ? " ti" : ""}">${i === idx ? "ı" : esc(c)}</span>`).join("")}<span class="bl"></span></span>`;
    wrap.style.top = G.h * (G.P ? 0.47 : 0.46) - fs * 0.62 + "px";
    const letters = [...wrap.querySelectorAll(".c")];
    const bl = box(wrap.querySelector(".bl"), ctx.stage);
    const font = `${getComputedStyle(wrap).fontWeight} ${fs}px ${ctx.font}`;
    const tt = tittle(font, fs) || { cx: fs * 0.13, cy: -fs * 0.86, size: fs * 0.19 };
    let target, ds;
    if (idx >= 0) {
      const b = box(letters[idx], ctx.stage);
      target = [b.x + tt.cx, bl.y + tt.cy];
      ds = tt.size;
    } else {
      ds = tt.size;
      target = [bl.x + fs * 0.07 + ds / 2, bl.y - ds / 2];
    }
    const from = entry(ctx, [target[0], target[1] - G.u * 20]);
    const fly = from.o === 0 ? 0.3 : 0.75;
    const w0 = 0.2;
    ctx.tl.stagger(letters, { y: 0, opacity: 1 }, ctx.t0 + w0, 0.6, 0.045, "snap", { y: fs * 0.9, opacity: 0 });
    const land = Math.max(fly + 0.25, w0 + letters.length * 0.045 + 0.45);
    if (scene.tagline) {
      const tg = ctx.el("div", "tagline");
      tg.innerHTML = md(scene.tagline);
      const ts = G.u * (G.L ? 3.8 : 4.4);
      Object.assign(tg.style, { left: 0, width: G.w + "px", top: bl.y + fs * 0.42 + "px", fontSize: ts + "px", color: pal.ink });
      ctx.tl.fromTo(tg, { opacity: 0, y: ts * 0.5 }, { opacity: 0.75, y: 0 }, ctx.t0 + land + 0.25, 0.6, "out");
      ctx.tl.show(tg, ctx.t0 + land + 0.25);
    }
    ctx.tl.show(wrap, ctx.t0);
    const dur = scene.dur || land + 2.4;
    const above = [target[0], target[1] - G.u * 14];
    return {
      dur,
      at(l) {
        if (l < land - 0.28) {
          const p = E.inOut(seg(l, 0, land - 0.28));
          if (from.o === 0) return { dots: [Dot("m", above[0], above[1], ds, pal.dot, { o: clamp(p * 2) })] };
          const [x, y] = arc([from.x, from.y], above, p, G.u * 10);
          return { dots: [{ ...mixDot(from, Dot("m", above[0], above[1], ds * 1.6, pal.dot), p), x, y }] };
        }
        if (l < land) {
          const p = seg(l, land - 0.28, land);
          return { dots: [Dot("m", target[0], lerp(above[1], target[1], p * p), lerp(ds * 1.6, ds, p), pal.dot, { sy: 1 + 0.15 * p, sx: 1 - 0.08 * p })] };
        }
        const q = seg(l, land, land + 0.22);
        const k = 0.3 * Math.sin(Math.PI * q) * (1 - q * 0.5);
        return { dots: [Dot("m", target[0], target[1] + (ds * k) / 2, ds, pal.dot, { sx: 1 + k, sy: 1 - k })] };
      },
      end: [Dot("m", target[0], target[1], ds, pal.dot)],
    };
  };

  /* ---------- the film ---------- */

  function film(story) {
    const theme = typeof story.theme === "object" ? story.theme : THEMES[story.theme || "paper"] || THEMES.paper;
    const pal0 = { ...theme, ...(story.colors || {}) };
    const font = `"${story.font || "Inter Tight"}", "Inter", system-ui, sans-serif`;
    document.documentElement.style.setProperty("--font", font);
    return Film.create({
      fps: story.fps || 30,
      fonts: [`600 40px ${font}`, `700 40px ${font}`, `500 40px ${font}`],
      build(tl, F) {
        const stage = document.querySelector("#film");
        const G = geometry(F);
        const bg = stage.querySelector(".bg");
        const dotsLayer = stage.querySelector(".dots");
        const layer = stage.querySelector(".layer");
        const under = stage.querySelector(".under");
        stage.style.setProperty("--accent", pal0.accent);
        const svg = stage.querySelector("svg.fx");
        const svgTop = stage.querySelector("svg.fx-top");
        for (const s of [svg, svgTop]) { s.setAttribute("viewBox", `0 0 ${F.w} ${F.h}`); s.setAttribute("width", F.w); s.setAttribute("height", F.h); }
        stage.querySelector("#goo feGaussianBlur").setAttribute("stdDeviation", (G.u * 1.3).toFixed(2));
        const pool = Array.from({ length: 10 }, () => { const d = document.createElement("div"); d.className = "dot"; dotsLayer.appendChild(d); return d; });
        tl.set(bg, { backgroundColor: pal0.bg }, 0);

        let pal = pal0, prev = [], t = 0;
        const segs = [];
        for (const scene of story.scenes) {
          const make = MOVES[scene.move];
          if (!make) { console.warn("leading-dot: unknown move", scene.move); continue; }
          const t0 = t;
          const ctx = {
            G, pal, prev, scene, t0, tl, stage, svg, svgTop, bg, font,
            el(tag, cls, below) { const e = document.createElement(tag); e.className = cls; (below ? under : layer).appendChild(e); return e; },
            caption(text, at, dur) {
              if (!text) return;
              const c = G.cap;
              const e = ctx.el("div", "cap" + (c.mid ? " mid" : ""));
              Object.assign(e.style, { left: c.left + "px", top: c.top + "px", width: c.width + "px", textAlign: c.align, fontSize: c.size + "px", color: pal.ink });
              e.innerHTML = md(text);
              e.querySelectorAll("em").forEach((m) => (m.style.color = pal.accent));
              const ws = words(e);
              tl.stagger(ws, { opacity: 1, y: 0 }, t0 + at, 0.6, 0.07, "out", { opacity: 0, y: c.size * 0.45 });
              tl.stagger(ws, { opacity: 0, y: -c.size * 0.3 }, t0 + dur - 0.45, 0.3, 0.025, "in");
              tl.show(e, t0 + at - 0.01, t0 + dur);
            },
          };
          const m = make(ctx);
          segs.push({ t0, t1: t0 + m.dur, at: m.at });
          tl.label(scene.name || scene.move, t0);
          t += m.dur;
          prev = m.end;
          if (m.pal) pal = m.pal;
        }
        const total = t;
        tl.fn(0, total, () => {});
        let lastGoo = null;
        tl.every((time) => {
          const sg = segs.find((s) => time >= s.t0 && time < s.t1) || segs[segs.length - 1];
          const st = sg.at(Math.min(time, sg.t1) - sg.t0);
          const dots = st.dots || [];
          const goo = !!st.goo;
          if (goo !== lastGoo) { dotsLayer.style.filter = goo ? "url(#goo)" : "none"; lastGoo = goo; }
          for (let i = 0; i < pool.length; i++) {
            const el = pool[i], d = dots[i];
            if (!d || d.o <= 0.001) { el.style.display = "none"; continue; }
            el.style.display = "block";
            el.style.width = d.w + "px";
            el.style.height = d.h + "px";
            el.style.marginLeft = -d.w / 2 + "px";
            el.style.marginTop = -d.h / 2 + "px";
            el.style.borderRadius = Math.max(0, Math.min(d.r, d.w / 2, d.h / 2)) + "px";
            el.style.background = css(d.c);
            el.style.opacity = d.o;
            el.style.transform = `translate(${d.x}px, ${d.y}px) rotate(${d.rot}deg) scale(${d.sx}, ${d.sy})`;
          }
        });
      },
    });
  }

  window.LeadingDot = { film, THEMES, MOVES };
})();
