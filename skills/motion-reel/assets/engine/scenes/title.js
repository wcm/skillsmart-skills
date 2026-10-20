/*
 * Kinetic title. A fitted column of type, one line per beat, every line sized so it spans the
 * column on its own. Each glyph builds the same way: its contours trace themselves as outlines,
 * then a fill wipes up through it from the bottom, and the outline goes.
 *
 *   beat 0     on the accent ground: the first rule draws, the kicker fades up through two frames
 *              of scrambled letters, and the first heavy word traces and fills letter by letter
 *   beat 1     the next heavy word the same way, over its own rule (the rows share the beats
 *              before the flip: one a beat for two words, every 2/3 beat for three)
 *   flip (2)   hard cut (on a whole frame) to the second ground, ink by default: every line takes
 *              the ink that reads on it; the italic serif line traces and fills, its rule already
 *              running from just before the flip. Without a flip the line follows the rows.
 *   flip+0.87  the accent hit: corner brackets fly in around the last word of the serif line (the
 *              hero noun), the accent full stop pops in after it and the mono caption appears
 *   flip+0.93  a weight wave: each heavy glyph thins 900 → 120 (its middle on beat flip+1.15),
 *              staggered by letter and row, each centred on its bold slot; the caption's number is
 *              the first glyph's live weight
 *   always     a slow push-in of the whole group about the full stop
 *   last 1/2   an exponential zoom-through into the full stop (×12 on the last frame), streaked by
 *              the engine's shutter: the dot it hands on to the next scene
 *
 * The layout is the original's, measured in the 1080×1920 frame and scaled to g.box, so other
 * aspect ratios keep the rhythm. The engine's shutter blur makes the zoom streak; nothing here
 * re-implements it. Timings are in beats (the original's seconds at 111 BPM).
 */
(() => {
/* the original's frame box (design px) the layout is measured in */
const BOX_W = 987, BOX_H = 1412.6;
/* layout: column inset and width, the serif baseline and row pitch (fractions of the box height) */
const L = { x0: 22.5, colW: 947, serifY: 0.8067, pitch: 0.2563, serifGap: 1.0635, maxSans: 260, maxSerif: 300,
  kickGap: 58, ruleDy: 19.5, ruleL: -4.5, ruleR: 944, capDy: 85, capR: 7, dotR: 0.0843, dotGap: 0.035, dotLift: 1.06,
  brL: 0.122, brT: 0.063, brR: 0.063, brB: 0.2165, brArm: 49, brW: 5, brFly: 105 };
/* timing, in beats: from each line's start for the build, from the flip for the hit, the dot and the wave */
const T = { rule: -0.111, ruleD: 0.555, trace: 0.028, stSans: 0.074, stSerif: 0.059, dSans: 0.222, dSerif: 0.185,
  fill: 0.339, fillD: 0.0925, unstroke: 0.278, kick: [0.161, 0.364], hit: 0.871, hitD: 0.481, hitA: 0.0555,
  dot: 0.905, dotD: 0.296, capA: 0.062, wave: 0.9325, waveSt: 0.1018, waveRow: 0.1295, waveD: 0.444, waveSpan: 0.6385 };
const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#+/*";

Reel.scene("title", {
  label: "KINETIC TYPE",
  theme: "light", /* the HUD stays cream on the accent ground, as in the original */
  bg: "accent",
  beats: 4,
  params: {
    kicker: "SHOWREEL --- 2026", /* mono kicker above the words; a run of dashes becomes em dashes, the part before it is tracked wider */
    words: ["MOTION", "DESIGN"], /* one to three heavy words, a row a beat, each fitted to the column */
    line: "in Claude", /* the italic serif line on the flip; its last word is the hero (bracketed); "" for none */
    dot: true, /* the accent full stop after the line (the zoom target) */
    flip: 2, /* the beat the ground flips; null to stay on one ground */
    bg2: "ink", /* the ground after the flip */
    thin: true, /* the weight wave after the flip */
    thinTo: 120, /* the weight the wave thins the heavy words to (100-900) */
    caption: "wght {w}  ·  axis 100-900", /* accent mono caption at the hit; {w} is the live number; "" for none */
    count: null, /* [from, to, decimals]: what {w} counts in step with the wave; null = the weight itself */
    push: 0.0049, /* slow push-in about the full stop, scale per beat */
    exit: "zoom", /* "zoom" through the full stop over the last half beat, or "none" */
  },
  prepare(s, g) {
    const B = g.box, kx = B.w / BOX_W, ky = B.h / BOX_H, u = Math.min(kx, ky), ctx = g.ctx;
    const x0 = B.x + L.x0 * kx, W = L.colW * kx;
    const words = [].concat(s.words || []).filter(Boolean).map(String), n = words.length, hasLine = !!s.line;
    const met = (str, o) => { ctx.save(); ctx.font = g.font(o.kind, o.size, o.weight, o.style); ctx.letterSpacing = "0px"; const m = ctx.measureText(str); ctx.restore(); return m; };
    /* the size at which str (plus the full stop, if it ends the line) spans the column */
    const fit = (str, o, cap, withDot) => {
      const m = met(str, Object.assign({}, o, { size: 100 }));
      const per = (withDot ? m.actualBoundingBoxRight + (L.dotGap + 2 * L.dotR) * 100 : m.width) / 100;
      const size = Math.min(cap, (W * (withDot ? 0.996 : 1)) / per);
      if (size < 60 * u) Reel.warn(`title: "${str}" is long for the column (${Math.round(size)}px)`);
      return size;
    };
    /* glyphs with their kerned slots and ink boxes; per = a contour length that covers the outline */
    const glyphs = (str, o, y) => g.letters(str, o).map((l) => {
      const m = met(l.ch, o), x = x0 + l.x;
      const il = m.actualBoundingBoxLeft, ir = m.actualBoundingBoxRight, ia = m.actualBoundingBoxAscent, id = m.actualBoundingBoxDescent;
      return { ch: l.ch, x, cx: x + l.w / 2, y, top: y - ia, bot: y + id, l: x - il, r: x + ir, per: 2.6 * Math.max(4, il + ir + ia + id) };
    });
    /* rows: the serif baseline is fixed; heavy rows stack above it */
    const P = n <= 2 ? L.pitch : (L.serifY - 0.205) / (n - 1 + L.serifGap);
    const serifY = B.y + B.h * L.serifY;
    const rows = words.map((w, k) => {
      const y = B.y + B.h * (L.serifY - L.serifGap * P - (n - 1 - k) * P);
      const o = { kind: "display", weight: 900, size: Math.min(L.maxSans * u, P * B.h * 0.8) };
      o.size = fit(w, o, o.size, !hasLine && s.dot && k === n - 1);
      return { w, y, o, gl: glyphs(w, o, y) };
    });
    let line = null;
    if (hasLine) {
      const o = { kind: "serif", style: "italic", weight: 400, size: L.maxSerif * u };
      o.size = fit(s.line, o, o.size, s.dot);
      line = { y: serifY, o, gl: glyphs(s.line, o, serifY) };
    }
    /* the hero: the last word of the serif line (or the last heavy word), the full stop after it */
    const last = line || rows[n - 1];
    let hero = null, A = [B.cx, B.cy], dotR = 0;
    if (last) {
      const gl = last.gl, size = last.o.size;
      let h0 = gl.length - 1;
      while (h0 > 0 && gl[h0 - 1].ch !== " ") h0--;
      const inkR = Math.max(...gl.map((q) => q.r)), top = Math.min(...gl.map((q) => q.top));
      dotR = L.dotR * size;
      const dx = inkR + L.dotGap * size + dotR, dy = last.y - L.dotLift * dotR;
      A = s.dot ? [dx, dy] : [inkR + L.dotGap * size, last.y - 0.3 * size];
      hero = {
        l: Math.min(...gl.slice(h0).map((q) => q.l)) - L.brL * size, t: top - L.brT * size,
        r: (s.dot ? dx + dotR : inkR) + L.brR * size, b: last.y + L.brB * size,
      };
    }
    /* the kicker: the word (tracked 0.16em), then the dashes and the rest (0.08em) */
    const km = String(s.kicker || "").match(/^(.*?)\s*([-—]{2,})\s*(.*)$/);
    const kick = km ? { a: `${km[1]}  `, z: `${"—".repeat(km[2].length)}  ${km[3]}` } : { a: String(s.kicker || ""), z: "" };
    const first = rows[0] || line;
    kick.size = 25.5 * u; kick.x = x0 + 4 * kx;
    kick.y = first ? first.y - (rows[0] ? 0.7 : 0.75) * first.o.size - L.kickGap * ky : B.y + 0.13 * B.h;
    /* the weight wave's stagger, squeezed so the last glyph finishes inside the scene */
    const maxN = Math.max(1, ...rows.map((r) => r.gl.length));
    const sq = Math.min(1, T.waveSpan / Math.max(1e-6, T.waveSt * (maxN - 1) + T.waveRow * (n - 1)));
    return {
      u, kx, ky, x0, W, rows, line, hero, A, dotR, kick, waveSt: T.waveSt * sq, waveRow: T.waveRow * sq,
      rule: { l: x0 + L.ruleL * kx, r: x0 + L.ruleR * kx, dy: L.ruleDy * ky },
      cap: { x: x0 + W - L.capR * kx, y: hero ? hero.b + L.capDy * ky : B.b - 120 * ky },
      anchor: A, anchorR: dotR,
    };
  },
  draw(g, s, t) {
    const { ctx, ease } = g, _ = s._, b = t.b, u = _.u, seg = g.seg;
    const n = _.rows.length;
    /* the flip lands on a whole frame, so the shutter never blends the two grounds */
    const fps = t.spb * t.fps, bq = t.bq; /* frames per (scene) beat; the beat of the whole frame */
    const F = s.flip != null ? s.flip : n * 1;
    const rb = s.flip != null ? Math.min(1, s.flip / Math.max(1, n)) : 1; /* beats per heavy row */
    const flipped = s.flip != null && bq >= s.flip;
    const ground = g.col(flipped ? s.bg2 : s.bg), fg = g.on(ground);
    const acc = ground === g.c.accent ? fg : g.c.accent;
    if (flipped) { ctx.fillStyle = ground; ctx.fillRect(0, 0, g.W, g.H); }
    _.hudBg = ground;

    /* the group transform: push-in, then the zoom-through, both about the full stop */
    const p = s.exit === "zoom" ? seg(b, s.beats - 0.5, s.beats) : 0;
    /* ease-in expo, 32 doublings a beat (fitted to the original): ×1.1 at -0.23 beat, ×1.8 at -0.14, ×12 on the last frame */
    const S = (1 + (s.push || 0) * b) * (p > 0 ? 1 + (18 * (2 ** (16 * (p - 1)) - 2 ** -16)) / (1 - 2 ** -16) : 1);
    const [ax, ay] = _.A;
    ctx.save();
    ctx.translate(ax, ay); ctx.scale(S, S); ctx.translate(-ax, -ay);
    ctx.letterSpacing = "0px"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.lineJoin = "round";

    /* rules under each line, drawn just ahead of it */
    const ruleAt = (y, t0) => {
      const k = ease.outQuart(seg(b, Math.max(0, t0 + T.rule), Math.max(0, t0 + T.rule) + T.ruleD));
      if (k > 0) g.line(_.rule.l, y + _.rule.dy, g.lerp(_.rule.l, _.rule.r, k), y + _.rule.dy, fg, 1.5 * u, 0.2);
    };
    _.rows.forEach((r, k) => ruleAt(r.y, k * rb));
    if (_.line) ruleAt(_.line.y, F);

    /* the kicker: two scrambled frames, then it settles while it fades in */
    const kk = seg(b, ...T.kick), K = _.kick;
    if (kk > 0 && (K.a || K.z)) {
      /* for its first two frames some letters are wrong, re-rolled every quarter frame, fewer each time */
      const fi = (b - T.kick[0]) * fps, roll = Math.floor(fi * 4);
      const mess = (str, salt) => (fi >= 2 ? str : [...str].map((ch, i) => (ch === " " || g.hash(i, salt, 7) < fi / 2 ? ch : SCRAMBLE[Math.floor(g.hash(i, roll, salt) * SCRAMBLE.length)])).join(""));
      const o = { kind: "mono", size: K.size, weight: 500, color: fg, alpha: kk };
      const ta = 0.16 * K.size, w = K.a ? g.text(mess(K.a, 1), K.x, K.y, Object.assign({ track: ta }, o)) + ta : 0;
      if (K.z) g.text(mess(K.z, 2), K.x + w, K.y, Object.assign({ track: 0.08 * K.size }, o));
    }

    /* one glyph's build: outline trace, then a bottom-up fill wipe; true once it is plain fill */
    const build = (q, o, tS, D, sw) => {
      const ps = ease.inOutCubic(seg(b, tS, tS + D)), f0 = tS + T.fill, pf = seg(b, f0, f0 + T.fillD);
      if (b >= f0 + T.fillD + T.unstroke) return true;
      if (ps <= 0) return false;
      ctx.font = g.font(o.kind, o.size, o.weight, o.style);
      if (pf > 0) {
        if (pf >= 1) ctx.fillStyle = fg;
        else {
          const fe = 20 * u, edge = q.bot - pf * (q.bot - q.top + fe), gr = ctx.createLinearGradient(0, edge, 0, edge + fe);
          gr.addColorStop(0, g.rgba(fg, 0)); gr.addColorStop(1, g.rgba(fg, 1)); ctx.fillStyle = gr;
        }
        ctx.fillText(q.ch, q.x, q.y);
      }
      ctx.setLineDash(ps < 1 ? [ps * q.per, q.per * 3] : []);
      ctx.lineWidth = sw; ctx.strokeStyle = fg; ctx.strokeText(q.ch, q.x, q.y); ctx.setLineDash([]);
      return false;
    };

    /* the heavy rows: build, then the weight wave about each bold slot's centre */
    const W0 = 900, W1 = g.clamp(s.thinTo ?? 120, 100, 900);
    const weight = (k, i) => (s.thin ? W0 - (W0 - W1) * ease.inOutCubic(seg(b, F + T.wave + _.waveSt * i + _.waveRow * k, F + T.wave + _.waveSt * i + _.waveRow * k + T.waveD)) : W0);
    _.rows.forEach((r, k) => {
      const st = Math.min(T.stSans, 0.55 / Math.max(1, r.gl.length - 1));
      r.gl.forEach((q, i) => {
        if (q.ch === " ") return;
        if (!build(q, r.o, k * rb + T.trace + st * i, T.dSans, 3 * u)) return;
        ctx.font = g.font("display", r.o.size, Math.round(weight(k, i)));
        ctx.textAlign = "center"; ctx.fillStyle = fg; ctx.fillText(q.ch, q.cx, q.y); ctx.textAlign = "left";
      });
    });
    /* the serif line, after the flip (or after the rows when the ground never flips) */
    if (_.line && bq >= F) {
      const gl = _.line.gl, st = Math.min(T.stSerif, 0.47 / Math.max(1, gl.length - 1));
      gl.forEach((q, i) => {
        if (q.ch === " ") return;
        if (!build(q, _.line.o, F + T.trace + st * i, T.dSerif, 2 * u)) return;
        ctx.font = g.font("serif", _.line.o.size, 400, "italic"); ctx.fillStyle = fg; ctx.fillText(q.ch, q.x, q.y);
      });
    }

    /* the accent hit: brackets fly in around the hero, the full stop pops, the caption shows */
    const h = _.hero, hk = seg(b, F + T.hit, F + T.hit + T.hitD);
    if (h && hk > 0) {
      const d = L.brFly * u * (1 - ease.outCubic(hk)), arm = L.brArm * u, a = seg(b, F + T.hit, F + T.hit + T.hitA);
      ctx.save(); ctx.strokeStyle = g.rgba(acc, a); ctx.lineWidth = L.brW * u; ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.beginPath();
      for (const [px, py, sx, sy] of [[h.l - d, h.t - d, 1, 1], [h.r + d, h.t - d, -1, 1], [h.l - d, h.b + d, 1, -1], [h.r + d, h.b + d, -1, -1]]) {
        ctx.moveTo(px, py + sy * arm); ctx.lineTo(px, py); ctx.lineTo(px + sx * arm, py);
      }
      ctx.stroke(); ctx.restore();
    }
    const dk = ease.outCubic(seg(b, F + T.dot, F + T.dot + T.dotD));
    if (s.dot && h && dk > 0) g.circle(ax, ay, _.dotR * dk, acc);
    const ca = seg(b, F + T.hit, F + T.hit + T.capA);
    if (s.caption && ca > 0) {
      const w = n ? weight(0, 0) : W0, c = s.count;
      const v = c ? g.lerp(c[0], c[1], (W0 - w) / Math.max(1, W0 - W1)).toFixed(c[2] ?? 0) : String(Math.round(w));
      g.text(String(s.caption).replace("{w}", v), _.cap.x, _.cap.y, { kind: "mono", size: 23 * u, weight: 500, track: 1.4 * u, align: "right", color: acc, alpha: 0.85 * ca });
    }
    ctx.restore();
    /* the dot (s._.anchor) stays put on screen while the group zooms into it; it grows */
    _.anchorR = _.dotR * S;
  },
});
})();
