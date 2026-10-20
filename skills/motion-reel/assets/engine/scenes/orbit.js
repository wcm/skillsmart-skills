/*
 * Type on a path. Four tiers of the topic's words, tracked out to fill four circumferences, are
 * scanned in as straight rows, scroll in alternating directions, then curl (curvature 0 → 1/R)
 * into concentric rings round the accent dot: heavy caps, filled and outlined in turn, accent dots
 * between the words, each glyph turned to its own θ. A radar playhead sweeps clockwise and lights
 * the glyphs it passes; then the rings spin up under rotational blur and spiral into the dot, and
 * the next scene's ground irises open from the dot. Beat by beat (2 beats; the times are the
 * original's, in beats, and stretch with the scene):
 *   0.01–0.26  a scan line sweeps down (out-quart, 'SCAN y=…' riding it, gone by 0.33) and reveals
 *              the rows one per frame, each glitching in for two frames (sliced, accent and cool
 *              ghosts); the rows already scroll fast (ω 5.9 rad/s; ring 1 right, ring 2 left …).
 *              The readouts fade in (0.03–0.11).
 *   0.11–0.45  the scroll brakes (ω = 0.42 + 5.5·e^(−t/0.055 s)); from 0.14 the rows curl into
 *              circles (λ in-out cubic over 0.31 beat, each inner row ~0.02 beat later, each row's
 *              apex gliding to its ring top). The readout reads κ, λ and ω live, then 'PATH /
 *              CIRCLE ×4'.
 *   0.31–0.50  the accent dot (r 25) pops in at the centre on a spring, with a broken crosshair.
 *   0.45–1.03  the rings turn slowly (0.42 rad/s, alternating); a playhead (hairline + soft wedge)
 *              sweeps clockwise at 582°/s from 12 o'clock and lights the glyphs at it in the
 *              accent (from 0.47; 'PLAYHEAD θ …' readout from 0.52).
 *   1.06–1.80  spin-up (ω = 0.42 + 313·t² rad/s) under rotational blur; from 1.40 the rings and
 *              their type shrink together (s = 1 − u²) and spiral into the dot (the R readout
 *              counts down, glitching). The readouts clear (1.74–1.78).
 *   1.79–2.00  the next scene's first frame irises open from the dot's edge (out-expo, the frame is
 *              full in ~2 frames): with the end card, paper and its dot at the same place.
 */
(() => {
const K = 0.5405; /* the original's seconds per beat: the exponentials below are in its seconds */
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const TIERS = [["MOTION DESIGN", "ANIMATION", "ART DIRECTION"], ["TYPOGRAPHY", "3D", "GENERATIVE", "DATA"], ["TIMING", "EASING", "RHYTHM"], ["COLOR", "SHAPE", "LINE"]];
const RADII = [500, 395, 295, 205, 135, 80], SIZES = [57, 45, 37, 33, 27, 22], REPS = [1, 2, 2, 2];
const T1 = 0.058, T2 = 0.575, T_CURL = 0.075, D_CURL = 0.1667, T_PH = 0.241, T_FALL = 0.758, D_FALL = 0.2167; /* original seconds from the scene start */
const fmt = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
/* the turn of the rows, rad (Ω) and its rate (ω), at τ original seconds */
const Omega = (t) => (t < T1 ? 5.92 * (t - T1) : 0.42 * (t - T1) + 0.3025 * (1 - Math.exp(-(t - T1) / 0.055))) + (t > T2 ? 104.3 * (t - T2) ** 3 : 0);
const omega = (t) => (t < T1 ? 5.92 : 0.42 + 5.5 * Math.exp(-(t - T1) / 0.055)) + (t > T2 ? 313 * (t - T2) ** 2 : 0);

Reel.scene("orbit", {
  label: "TYPE ON PATH",
  bg: "ink",
  beats: 2,
  continues: "blob", /* after the liquid's zoom-through it opens on the same ink: a hand-off, not a cut */
  out: { type: "iris", beats: 0.215, ease: "outExpo" }, /* the next ground opens from the dot's edge and fills the frame in ~2 frames */
  shutter: 1, /* the original's 360° shutter: the scroll and the spin-up streak a whole frame */
  params: {
    words: TIERS, /* one list of words per ring, outer first; or one flat list, shared out over `rings` (the outer ring gets about three) */
    rings: 4, /* rings, when words is a flat list (1–6) */
    phase: [46.5, -40, -83.5, 24], /* where each ring's text is centred, degrees clockwise from 12 o'clock, before it turns */
    title: "PATH / LINE → CIRCLE", /* readout title while the rows are straight */
    titleRing: "PATH / CIRCLE ×{n}", /* readout title once they are rings; {n} rings */
    curve: "κ = {k}   λ = {l}", /* readout line 2: curvature and curl */
    count: "GLYPHS {n}   ω {w} rad/s", /* readout line 3: glyph count and turn rate */
    radius: "R {r}", /* bottom-right title; {r} the live radii joined with " / " */
    sub: "text-on-path · per-glyph θ", /* bottom-right line 2 */
    playhead: "PLAYHEAD θ {a}°", /* bottom-right line 2 while the playhead sweeps */
    scan: "SCAN  y={y}", /* the label on the scan line */
  },
  prepare(s, g) {
    const st = g.stage, U = st.w / 928, cx = st.cx, cy = st.cy, ctx = g.ctx;
    /* the tiers */
    let tiers;
    const W = [].concat(s.words || []).filter((w) => w != null);
    if (W.length && W.every(Array.isArray)) tiers = W.map((t) => t.map(String)).filter((t) => t.length);
    else {
      const flat = W.map(String), n = Math.max(1, Math.min(6, Math.round(s.rings || 4), flat.length)), wt = [3, 4, 3, 3, 3, 3].slice(0, n), sum = wt.reduce((a, b) => a + b, 0);
      const raw = wt.map((w) => (flat.length * w) / sum), cnt = raw.map(Math.floor);
      raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).slice(0, flat.length - cnt.reduce((a, b) => a + b, 0)).forEach(([, i]) => cnt[i]++);
      let at = 0; tiers = cnt.map((c) => flat.slice(at, (at += Math.max(1, c)))).filter((t) => t.length);
    }
    tiers = tiers.slice(0, 6);
    if (!tiers.length) tiers = TIERS;
    const n = tiers.length;
    /* one ring: chars laid along its circumference, tracking fitted; reps chosen to look like the original's */
    const layout = (words, i, reps) => {
      const size = SIZES[i] * U, R = RADII[i] * U, font = g.font("display", size, 900);
      ctx.save(); ctx.font = font; ctx.letterSpacing = "0px";
      const seq = [];
      for (let r = 0; r < reps; r++) for (const w of words) { for (const ch of [...w.toUpperCase()]) seq.push(ch); seq.push(" ", "·", " "); }
      const adv = seq.map((ch) => (ch === "·" ? 0.45 * size : ctx.measureText(ch).width));
      ctx.restore();
      const nat = adv.reduce((a, b) => a + b, 0), C = TAU * R;
      return { size, R, font, seq, adv, nat, C, track: (C - nat) / seq.length };
    };
    const target = TIERS.map((t, i) => { const L = layout(t, i, REPS[i]); return L.track / L.size; });
    const rings = tiers.map((words, i) => {
      let best = null;
      for (let reps = 1; reps <= 8; reps++) { const L = layout(words, i, reps), d = Math.abs(L.track / L.size - target[Math.min(i, 3)]); if (L.track > 0.08 * L.size && (!best || d < best.d)) best = Object.assign(L, { d }); }
      if (!best) { /* too long even once: smaller type */ const L = layout(words, i, 1), k = (L.C * 0.92) / L.nat; best = layout(words, i, 1); best.size *= k; best.font = g.font("display", best.size, 900); best.adv = best.adv.map((a) => a * k); best.nat *= k; best.track = (best.C - best.nat) / best.seq.length; }
      const L = best, glyphs = [];
      let x = 0;
      L.seq.forEach((ch, j) => { const w = L.adv[j] + L.track; if (ch !== " ") glyphs.push({ ch, s: x + w / 2 - L.C / 2 }); x += w; });
      const ph = ((s.phase || [])[i] ?? 0) * DEG;
      return { R: L.R, size: L.size, font: L.font, glyphs, C: L.C, dir: i % 2 ? -1 : 1, outline: i % 2 === 1, ph, rowY: cy + (i - (n - 1) / 2) * 220 * U };
    });
    const count = rings.reduce((a, r) => a + r.glyphs.length, 0);
    /* the scan: from above the first row to below the last, revealing each row as it passes */
    const scan0 = rings[0].rowY - 23 * U, scan1 = rings[n - 1].rowY + 119 * U;
    for (const r of rings) { const p = g.clamp((r.rowY + 0.3 * r.size - scan0) / (scan1 - scan0)); r.reveal = 0.01 + 0.25 * (1 - Math.pow(1 - p, 0.25)); }
    return { U, cx, cy, rings, count, scan0, scan1, anchor: [cx, cy], anchorR: 25.3 * U, dotR: 25.3 * U };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, B = s.beats, u = (t.b * 2) / B, tau = u * K, U = _.U, cx = _.cx, cy = _.cy;
    const paper = g.c.paper, acc = g.c.accent, on = g.on(s.bg), k = g.scale;
    const curl = (q) => g.ease.inOutCubic(g.clamp((tau - T_CURL - q * 0.012) / D_CURL)), lam = curl(0); /* inner rows curl a little later */
    const scale = (q) => { const f = g.clamp((q - T_FALL) / D_FALL); return 1 - f * f; }, fall = g.clamp((tau - T_FALL) / D_FALL), sc = scale(tau);
    const Om = Omega(tau), om = omega(tau), th = (tau - T_PH) * 582;
    const phK = g.span(u, 0.47, 0.5) * (1 - g.span(u, 0.98, 1.03)), lit = phK > 0;
    const ys = g.lerp(_.scan0, _.scan1, g.ease.outQuart(g.span(u, 0.01, 0.26))), scanK = 1 - g.span(u, 0.26, 0.33);
    /* a local rotational blur fills the gap between the engine's motion-blur samples (the shutter
       shared out over the configured samples, R.samples), so the spin-up streaks without stepping */
    const ns = Math.max(1, Math.min(s.samples ?? s.def.samples ?? 99, (g.R && g.R.samples) || 1)), shut = s.shutter ?? s.def.shutter ?? 1;
    const dtau = (shut / ns / t.fps) * (K / t.spb), dOm = Math.abs(Omega(tau + dtau / 2) - Omega(tau - dtau / 2));
    const fq = Math.floor(t.bq * t.fps * t.spb + 1e-6); /* the frame index in the scene, for glitches */

    /* the crosshair and the dot */
    const dk = g.span(u, 0.31, 0.37) * (1 - g.span(u, 1.75, 1.8));
    if (dk > 0) {
      ctx.save(); ctx.strokeStyle = g.rgba(g.mix(g.col(s.bg), on, 0.1), dk); ctx.lineWidth = 1.5; ctx.beginPath();
      for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(cx + ux * 45 * U, cy + uy * 45 * U); ctx.lineTo(cx + ux * 149 * U, cy + uy * 149 * U); }
      ctx.stroke(); ctx.restore();
    }
    /* the playhead: a hairline and a soft wedge trailing it */
    if (phK > 0 && th > 0) {
      const a = (th - 90) * DEG, r0 = 30 * U, r1 = 560 * U;
      const grad = ctx.createConicGradient(a - 25 * DEG, cx, cy);
      grad.addColorStop(0, g.rgba(paper, 0)); grad.addColorStop(25 / 360, g.rgba(paper, 0.07 * phK)); grad.addColorStop(25.01 / 360, g.rgba(paper, 0)); grad.addColorStop(1, g.rgba(paper, 0));
      ctx.save(); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r1, a - 25 * DEG, a); ctx.arc(cx, cy, r0, a, a - 25 * DEG, true); ctx.closePath(); ctx.fill(); ctx.restore();
      g.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, paper, 1.5, 0.22 * phK);
    }

    /* the rows / rings */
    _.rings.forEach((r, ri) => {
      const age = u - r.reveal;
      if (age < 0 || sc <= 0.002) return;
      const lr = curl(ri), R = r.R, kap = lr / R, apexY = g.lerp(r.rowY, cy - R, lr);
      const n = Math.max(1, Math.min(4, Math.ceil((dOm * R * sc) / (10 * U))));
      const glitch = age < 0.062 && u < 0.3;
      /* one pass over the ring's glyphs at turn A. Sharp: filled or outlined caps, each turned to
         its θ. As a streak copy (cheap): filled, the outlined rings fainter. Separators: one path. */
      const pass = (A, alpha, dx, col, gs = sc, cheap = false) => {
        const by = 0.27 * r.size, stroke = r.outline && !cheap, dots = [];
        ctx.globalAlpha = alpha * g.smoothstep(0.08, 0.4, gs) * (r.outline && cheap ? 0.45 : 1);
        ctx.font = r.font; ctx.letterSpacing = "0px"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        if (stroke) { ctx.lineWidth = Math.max(1, r.size * 0.036); ctx.lineJoin = "round"; ctx.strokeStyle = col; } else ctx.fillStyle = col;
        for (const gl of r.glyphs) {
          let uu = gl.s + (r.ph + A) * R;
          uu -= r.C * Math.floor((uu + r.C / 2) / r.C);
          let x, y, a;
          if (lr < 1e-4) { x = cx + uu; y = r.rowY; a = 0; if (x < -80 || x > g.W + 80) continue; }
          else if (lr < 1) { a = uu * kap; x = cx + Math.sin(a) / kap; y = apexY + (1 - Math.cos(a)) / kap; }
          else { a = uu / R; x = cx + R * gs * Math.sin(a); y = cy - R * gs * Math.cos(a); }
          x += dx;
          if (gl.ch === "·") { dots.push(x + Math.sin(a) * 0.08 * r.size * gs, y - Math.cos(a) * 0.08 * r.size * gs); continue; }
          const c = Math.cos(a) * gs * k, sn = Math.sin(a) * gs * k;
          ctx.setTransform(c, sn, -sn, c, x * k, y * k);
          if (stroke) ctx.strokeText(gl.ch, 0, by); else ctx.fillText(gl.ch, 0, by);
          /* the playhead lights the glyphs at it */
          if (lit && lr >= 1) {
            const d = ((((th - a / DEG) % 360) + 540) % 360) - 180;
            const h = phK * (d < -10 ? 0 : d < -8 ? (d + 10) / 2 : 1 - g.smoothstep(6, 22, d));
            if (h > 0.01) {
              const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * h;
              if (stroke) { ctx.strokeStyle = acc; ctx.strokeText(gl.ch, 0, by); ctx.strokeStyle = col; } else { ctx.fillStyle = acc; ctx.fillText(gl.ch, 0, by); ctx.fillStyle = col; }
              ctx.globalAlpha = a0;
            }
          }
        }
        if (dots.length) {
          ctx.setTransform(k, 0, 0, k, 0, 0); ctx.fillStyle = acc; ctx.beginPath();
          const dotR = 0.12 * r.size * gs;
          for (let q = 0; q < dots.length; q += 2) { ctx.moveTo(dots[q] + dotR, dots[q + 1]); ctx.arc(dots[q], dots[q + 1], dotR, 0, TAU); }
          ctx.fill();
        }
      };
      ctx.save();
      if (u < 0.32) { ctx.beginPath(); ctx.rect(0, 0, g.W, ys); ctx.clip(); }
      if (glitch) {
        /* sliced and ghosted for two frames as the scan reveals the row */
        const h0 = r.rowY - r.size, hh = r.size * 1.6, cuts = [0, 0.3 + 0.2 * g.hash(fq, ri, 1), 0.65 + 0.2 * g.hash(fq, ri, 2), 1];
        for (let q = 0; q < 3; q++) {
          ctx.save(); ctx.beginPath(); ctx.rect(0, h0 + cuts[q] * hh, g.W, (cuts[q + 1] - cuts[q]) * hh); ctx.clip();
          const off = (g.hash(fq, ri, q + 3) - 0.5) * 60 * U;
          pass(r.dir * Om, 0.85, off, paper);
          ctx.setTransform(k, 0, 0, k, 0, 0); ctx.restore();
        }
        ctx.globalCompositeOperation = "lighter";
        pass(r.dir * Om, 0.35, -5 * U, acc);
        pass(r.dir * Om, 0.3, 5 * U, g.c.cool);
        ctx.globalCompositeOperation = "source-over";
      } else {
        const alpha = n > 1 ? Math.min(1, 1.6 / n) : 1;
        for (let j = 0; j < n; j++) {
          const tj = n > 1 ? tau + dtau * (j / (n - 1) - 0.5) : tau;
          pass(r.dir * Omega(tj), alpha, 0, paper, scale(tj), n > 2); /* turning and shrinking: spiral streaks */
        }
      }
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.restore();
    });

    /* the dot: pops in on a spring */
    const dr = _.dotR * Math.max(0, g.ease.spring(tau - 0.165, 5, 0.35));
    if (dr > 0) g.circle(cx, cy, dr, acc);

    /* the scan line and its label */
    if (scanK > 0 && u < 0.32) {
      ctx.save(); ctx.globalAlpha = scanK;
      const gr = ctx.createLinearGradient(0, ys - 60 * U, 0, ys);
      gr.addColorStop(0, g.rgba(paper, 0)); gr.addColorStop(1, g.rgba(paper, 0.08));
      ctx.fillStyle = gr; ctx.fillRect(0, ys - 60 * U, g.W, 60 * U);
      ctx.fillStyle = g.rgba(paper, 0.35); ctx.fillRect(0, ys - 0.5, g.W, 1);
      g.text(fmt(s.scan, { y: Math.round(ys / U) }), g.box.r - 29.5, ys - 7, { kind: "mono", size: 14 * U, weight: 500, track: 2.6, color: paper, alpha: 0.5, align: "right" });
      ctx.restore();
    }

    /* readouts */
    const inK = g.span(u, 0.03, 0.11) * (1 - g.span(u, 1.74, 1.78));
    if (inK > 0) {
      const x = g.box.x + 27.5, rx = g.box.r - 29.5, nR = _.rings.length;
      ctx.save(); ctx.globalAlpha = inK;
      g.text(lam >= 0.99 ? fmt(s.titleRing, { n: nR }) : s.title, x, g.box.y + 84.5, { kind: "mono", size: 20 * U, weight: 500, track: 2.5, color: on, alpha: 0.82 });
      g.text(fmt(s.curve, { k: ((lam * U) / _.rings[0].R).toFixed(5), l: lam.toFixed(2) }), x, g.box.y + 115.5, { kind: "mono", size: 14 * U, weight: 500, track: 2.4, color: on, alpha: 0.45 });
      g.text(fmt(s.count, { n: _.count, w: om.toFixed(2) }), x, g.box.y + 140.5, { kind: "mono", size: 14 * U, weight: 500, track: 2.6, color: on, alpha: 0.45 });
      const radii = (q) => _.rings.map((r) => Math.round((r.R / U) * q)).join(" / ");
      const rStr = fmt(s.radius, { r: radii(sc) }), ro = { kind: "mono", size: 20 * U, weight: 500, track: 2.0, color: on, align: "right" };
      if (fall > 0 && fall < 1) { const fp = g.clamp((tau - 1 / 60 - T_FALL) / D_FALL); g.text(fmt(s.radius, { r: radii(1 - fp * fp) }), rx + 3, g.box.b - 69, Object.assign({}, ro, { alpha: 0.3 })); }
      g.text(rStr, rx, g.box.b - 69, Object.assign({}, ro, { alpha: 0.8 }));
      const ph = phK > 0.5 && u > 0.52 ? fmt(s.playhead, { a: (((th % 360) + 360) % 360).toFixed(1).padStart(5, "0") }) : s.sub;
      g.text(ph, rx, g.box.b - 43, { kind: "mono", size: 14 * U, weight: 500, track: 2.5, color: on, alpha: 0.42, align: "right" });
      ctx.restore();
    }
  },
});
})();
