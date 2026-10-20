/*
 * Data and UI. Four product cards stacked full width in the HUD frame: a dark control card a
 * cursor operates, an accent card with a huge odometer number, a cool bar chart with a trend
 * line, a blush curve editor with a value table and a ring gauge. Every widget animates at once.
 * Timings are the original's, kept in its frames (60 fps at 111 BPM: 32.4 a beat) and so in beats;
 * the exit is anchored to the scene's end (a scene longer than 3 beats holds before it, a shorter
 * one is compressed). Beat by beat, for 3 beats:
 *
 *   0          hard cut: the cards are already mid-spring (an underdamped spring: they rise
 *              scaled down and tilted, overshoot, undershoot, settle by ~1), 2.5 frames apart,
 *              fading in; the cursor streaks in from below and stops on the toggle (0.33)
 *   0.06–0.9   the hero odometer rolls up from zeros, digits locking left to right with a bump;
 *              the frames counter and its hairline fill in step
 *   0.2–1.4    the chart's total counts up; 0.26–1.15 the bars spring up left to right
 *   0.42–1.3   the curve's handles spring from linear to the curve (overshoot, live string and
 *              table); the table rows fade in one by one; 0.8–2.2 a playhead ball rides the curve
 *   0.48       click: the toggle flips (ripple, squash-stretch knob, its sub-label changes)
 *   0.5–1.7    the ring gauge fills; 0.71 the segmented control slides to its pick
 *   0.93–1.6   the trend line draws over the bars, its end dot pops; 1.73 the tooltip pops
 *   1.0        punch: the hero number kicks to 1.045 and settles; its chip pops
 *   0.95–1.28  the cursor glides to the button; 1.51 click: a striped progress bar fills
 *   2.0        done: solid accent, check icon, a glow ring pulses
 *   2.35–2.65  the cursor drifts onto the hero number
 *   2.65–3     exit: top cards fly up, bottom ones down (outer first), uncovering the accent dot
 *              at the frame centre; an iris of the next scene's ground blows out of it (×2.6 a
 *              frame) and covers the frame by the scene's end, the dot on top
 *
 * The numbers are yours: use real ones, or ones that are true of the reel itself (its frames,
 * fps, scenes). Never invent statistics about the topic.
 */
(() => {
  const FPB = (60 / 111) * 60; /* frames per beat in the original (60 fps, 111 BPM) */
  const HS = [304, 340, 330, 290], GAP = 24.33, CW = 944.25, P = 47.5, RX = 896.5; /* card heights, gap, width; content left and right edges */
  const LINEAR = [0.33, 0.33, 0.67, 0.67];
  const TRI = /^([▲▼])\s*/; /* a chip's leading arrow, drawn in its own colour */
  const ARROW = [[0, 0], [0, 22.5], [5.2, 17.6], [8.8, 25.9], [12.3, 24.4], [8.8, 16.4], [15.8, 16.4]]; /* the cursor, tip at 0,0 */
  /* the cursor's way in, as measured (the control card's coordinates): it streaks up and curls onto the toggle */
  const WAYIN = [[863.5, 1115.5], [824.5, 935.5], [786.5, 758.5], [737.5, 612.5], [676.5, 505.5], [623.5, 420.5], [573.5, 349.5], [529.5, 295.5], [494.5, 263.5], [464.5, 225.5], [442.5, 200.5], [427.5, 185.5], [422.5, 183.5]];
  const WAYLEN = WAYIN.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - WAYIN[i][0], p[1] - WAYIN[i][1]), 0);
  const along = (path, d) => { for (let i = 1; i < path.length; i++) { const [ax, ay] = path[i - 1], [bx, by] = path[i], l = Math.hypot(bx - ax, by - ay); if (d <= l || i === path.length - 1) { const f = Math.min(1, d / Math.max(1e-6, l)); return [ax + (bx - ax) * f, ay + (by - ay) * f]; } d -= l; } return path[path.length - 1]; };

  const bump = (x, a, z) => (x <= a || x >= z ? 0 : Math.sin((Math.PI * (x - a)) / (z - a)));
  const cubic = (p0, p1, p2, p3, u) => { const v = 1 - u; return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3; };
  /* the y of a cubic-bezier easing at time x */
  const bezierY = (x1, y1, x2, y2, x) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (cubic(0, x1, x2, 1, m) < x) lo = m; else hi = m; }
    const u = (lo + hi) / 2; return [u, cubic(0, y1, y2, 1, u)];
  };
  /* .17 · 1 · .3 — CSS style */
  const css = (v) => { const r = Math.round(v * 100) / 100; return String(r).replace(/^(-?)0\./, "$1."); };

  Reel.scene("dashboard", {
    label: "DATA + UI",
    bg: "paper",
    beats: 3,
    params: {
      pitch: 32, /* the dot grid on the ground, px (0: none) */
      queue: {
        title: "Render queue", /* the control card's title */
        sub: "auto", /* its meta line ("auto": the reel's file, frames and size) */
        chip: "LIVE", /* the status pill */
        toggle: "Motion blur", /* the switch the cursor flips */
        toggleOff: "OFF", /* its sub-label before the click */
        toggleSub: "6 SMP · 180°", /* its sub-label after */
        seg: "Frame rate", /* the segmented setting */
        segSub: "auto", /* its sub-label ("auto": the reel's fps) */
        options: ["24", "30", "60"], /* its options */
        pick: 2, /* the option it slides to (from the one before) */
        button: "Render ▸", /* the button the cursor presses */
        busy: "Rendering", /* the progress label: "<busy>… N%" */
        done: "Done · 100%", /* the label when it is done */
      },
      stat: {
        label: "RENDER OUTPUT · Q3", /* top left */
        right: "VS. LAST REEL", /* top right */
        value: 312, /* the hero number (rolls up from zeros) */
        prefix: "+", /* before it */
        suffix: "%", /* after it, smaller, in ink */
        decimals: 0, /* its decimals */
        foot: "auto", /* the line under the hairline ("auto": N / <reel frames> FRAMES) */
        chip: "▲ 4.1× FASTER", /* the pill that pops on the punch (a leading ▲ is drawn in accent) */
      },
      chart: {
        label: "FRAMES RENDERED / WEEK", /* top left */
        right: "W01 — W12", /* top right */
        value: 18.4, /* the total that counts up */
        prefix: "", /* before it */
        suffix: "k", /* after it */
        decimals: 1, /* its decimals */
        bars: [26, 34, 30, 45, 41, 54, 50, 64, 59, 73, 70, 100], /* the series, relative (the last is lit) */
        names: null, /* a label under each bar (default W01, W02, …) */
        chip: "▲ 312%", /* the tooltip on the last point */
      },
      curve: {
        label: "EASE / CUSTOM", /* top left */
        right: "SPRING", /* top right */
        bezier: [0.17, 0.97, 0.32, 1], /* the curve the handles spring to */
        rows: null, /* the table, up to 4 [key, value] rows (default P1, P2, DUR, FPS, live) */
        ring: 78, /* the gauge's value, % (an array: its last value) */
        ringLabel: "SMOOTH", /* under the gauge's number */
        pill: "DUR 0.42S", /* the pill under the gauge */
      },
    },
    prepare(s, g) {
      const D = Reel.defs.dashboard.params;
      for (const k of ["queue", "stat", "chart", "curve"]) s[k] = Object.assign({}, D[k], s[k]);
      const b = g.box, total = HS.reduce((a, v) => a + v, 0) + GAP * 3;
      const u = Math.min(1, (b.w - 42.75) / CW, (b.h - 75.5) / total);
      let y = b.y + 43 + (b.h - 75.5 - total * u) / 2;
      const cards = HS.map((h) => { const c = { x: b.cx - (CW * u) / 2, y, h, cx: b.cx, cy: y + (h * u) / 2 }; y += (h + GAP) * u; return c; });
      /* the soft warm shadow under each card, drawn once */
      const shadows = HS.map((h) => {
        const k = g.scale, pad = 70, cv = document.createElement("canvas");
        cv.width = Math.ceil((CW + 2 * pad) * k); cv.height = Math.ceil((h + 2 * pad) * k);
        const x = cv.getContext("2d");
        x.shadowColor = g.rgba(g.mix(g.c.ink, g.c.accent, 0.3), 0.2); x.shadowBlur = 30 * k; x.shadowOffsetX = 10000; x.shadowOffsetY = 10 * k;
        x.fillStyle = g.c.ink; x.beginPath(); x.roundRect(pad * k - 10000, pad * k, CW * k, h * k, 26 * k); x.fill();
        return { cv, pad };
      });
      return { cards, u, shadows, memo: new Map(), anchor: [b.cx, b.cy], hudBg: null };
    },
    draw(g, s, t) {
      const { ctx, ease } = g, _ = s._, c = g.c, u = _.u;
      const ink = c.ink, paper = c.paper, acc = c.accent;
      /* time in the original's frames (a scene under 3 beats is compressed); X shifts the exit so
         the iris lands on the scene's end (a longer scene holds on the finished dashboard first) */
      const sc = Math.min(1, s.beats / 3), F = (t.b / sc) * FPB, Fq = (t.bq / sc) * FPB, X = (s.beats / sc) * FPB - 94;
      const sp = (a, z, e = "linear") => g.span(F, a, z, e);
      const [ax, ay] = _.anchor;

      if (!s.grid && s.pitch > 0) g.dotGrid(g.on(s.bg), { step: s.pitch, r: 1.4, alpha: 0.07, ox: 23.5, oy: 16 });

      /* text helpers (local to a card: the context is already transformed) */
      const sans = (str, x, y, size, color, o = {}) => g.text(str, x, y, Object.assign({ kind: "display", size, weight: 600, track: -0.04 * size, color }, o));
      const mono = (str, x, y, size, color, o = {}) => g.text(String(str).toUpperCase(), x, y, Object.assign({ kind: "mono", size, weight: 500, track: 0.22 * size, color }, o));
      const monoW = (str, size, o = {}) => g.measure(String(str).toUpperCase(), Object.assign({ kind: "mono", size, weight: 500, track: 0.22 * size }, o));
      /* a pill or chip label: a leading ▲ in its own colour, then the text */
      const chipText = (str, cx, y, size, color, triCol, o = {}) => {
        const m = String(str).match(TRI), head = m ? m[1] : "", rest = m ? String(str).slice(m[0].length) : String(str);
        const wh = head ? monoW(head, size, o) + size * 0.6 : 0, w = wh + monoW(rest, size, o), x = cx - w / 2;
        if (head) mono(head, x, y, size, triCol, o);
        mono(rest, x + wh, y, size, color, o);
        return w;
      };
      const chipW = (str, size, o = {}) => { const m = String(str).match(TRI); return m ? monoW(m[1], size, o) + size * 0.6 + monoW(String(str).slice(m[0].length), size, o) : monoW(str, size, o); };
      const tri = (x, y, w, h, color) => { ctx.fillStyle = g.col(color); ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fill(); };

      /* the exit dot, under the cards until the iris */
      const dotK = ease.outBack(sp(84.5 + X, 87.5 + X));
      if (dotK > 0) g.circle(ax, ay, 25 * dotK, acc);

      /* the cards */
      const fills = [g.mix(ink, paper, 0.03), acc, c.cool, c.blush];
      const exitK = [[82.5, -2.1], [84.5, -1.56], [84.5, 1.1], [82.5, 1.0]];
      const body = [queue, stat, chart, curve];
      _.cards.forEach((card, k) => {
        const alpha = g.clamp((F - [-1, 1.2, 4.4, 7.2][k]) / 1.6);
        if (alpha <= 0) return;
        const tau = Math.max(0, (F + 0.4 - 2.5 * k) / 60), m = 175 * Math.exp(-7 * tau) * Math.cos(14.05 * tau);
        const [e0, K] = exitK[k], d = Math.max(0, F - e0 - X);
        const dy = (0.89 * m + K * d * d * d) * u, rot = ((-0.0125 * m - Math.sign(K) * 0.04 * d * d) * Math.PI) / 180, k1 = (1 - 0.0008 * m - 0.0015 * d * d) * u;
        if (card.cy + dy - (card.h * k1) / 2 > g.H + 40 || card.cy + dy + (card.h * k1) / 2 < -40) return;
        const S = _.shadows[k];
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.translate(card.cx, card.cy + dy); ctx.rotate(rot); ctx.scale(k1, k1); ctx.translate(-CW / 2, -card.h / 2);
        ctx.drawImage(S.cv, -S.pad, -S.pad, CW + 2 * S.pad, card.h + 2 * S.pad);
        ctx.fillStyle = fills[k]; g.rrect(0, 0, CW, card.h, 26); ctx.fill();
        body[k](card.h);
        ctx.restore();
      });

      cursor();

      /* the iris, of the next scene's ground, and the dot on top */
      const Fi = 90 + X, far = Math.max(...[[0, 0], [g.W, 0], [0, g.H], [g.W, g.H]].map(([x, y]) => Math.hypot(x - ax, y - ay)));
      const nb = g.col(t.next.bg), irisCol = nb === g.col(s.bg) ? ink : nb, R = F >= Fi ? 25 * 2.64 ** (F - Fi) : 0;
      if (R > 25) { g.circle(ax, ay, Math.min(R, far + 2), irisCol); g.circle(ax, ay, 25, acc); }
      _.hudBg = R >= far ? t.next.bg : null;

      /* ---------------------------------------------------------------- the control card */
      function queue() {
        const q = s.queue, cream = paper;
        /* title, meta, divider, status chip */
        const cwChip = monoW(q.chip, 13, { weight: 600, track: 2 }) + 61;
        sans(q.title, P, 75, 38, cream, { track: -2.5, fit: RX - cwChip - 20 - P });
        mono(q.sub === "auto" ? `REEL_V4.MP4 · ${t.F} FR · ${g.W}×${g.H}` : q.sub, P, 105.5, 12.5, cream, { alpha: 0.48, track: 2.3, fit: RX - P });
        g.line(P, 126, RX, 126, cream, 1, 0.06);
        ctx.fillStyle = g.rgba(acc, 0.16); g.rrect(RX - cwChip, 43.5, cwChip, 35, 17.5); ctx.fill();
        g.circle(RX - cwChip + 23, 61, 6, acc);
        mono(q.chip, RX - cwChip + 41, 65.6, 13, acc, { weight: 600, track: 2 });

        /* the toggle: click at frame 16 */
        const kn = ease.outQuad(sp(16, 19)), on = Fq >= 17, tk = sp(16, 19);
        sans(q.toggle, P, 176.5, 27, cream, { weight: 500, track: -1.2, alpha: 0.95, fit: 338.5 - 24 - P });
        mono(on ? q.toggleSub : q.toggleOff, P, 203.3, 11.5, cream, { alpha: 0.45, track: 2.2, fit: 338.5 - 24 - P });
        ctx.fillStyle = g.mix(g.mix(fills[0], cream, 0.1), acc, tk); g.rrect(338.5, 141.5, 110, 58, 29); ctx.fill();
        const st = bump(F, 16, 19.5), kx = g.lerp(367.5, 419.5, kn), kw = 41 + 18 * st, kh = 41 - 4 * st;
        ctx.fillStyle = cream; g.rrect(kx - kw / 2, 170.5 - kh / 2, kw, kh, kh / 2); ctx.fill();
        const rk = sp(16, 28);
        if (rk > 0 && rk < 1) g.ring(393.5, 170.5, 35 + 75 * ease.outQuad(rk), acc, 1.5, 0.85 * (1 - rk));

        /* the segmented setting: slides to its pick at frame 23 */
        const n = q.options.length, segW = 220, slot = (segW - 10) / n, sx = 674.5;
        const from = q.pick > 0 ? q.pick - 1 : Math.min(1, n - 1), pk = ease.outCubic(sp(23, 26)), at = g.lerp(from, q.pick, pk);
        sans(q.seg, 525.5, 176.5, 27, cream, { weight: 500, track: -1.2, alpha: 0.95, fit: sx - 14 - 525.5 });
        mono(q.segSub === "auto" ? `${t.fps} FPS` : q.segSub, 525.5, 203.3, 11.5, cream, { alpha: 0.45, track: 2.2, fit: sx - 14 - 525.5 });
        ctx.fillStyle = g.rgba(cream, 0.06); g.rrect(sx, 143.5, segW, 55, 12); ctx.fill();
        ctx.fillStyle = g.rgba(cream, 0.17); g.rrect(sx + 5 + at * slot + 1, 147, slot - 2, 48, 9); ctx.fill();
        q.options.forEach((o, i) => {
          const sel = Math.max(0, 1 - Math.abs(at - i));
          g.text(o, sx + 5 + (i + 0.5) * slot, 178.3, { kind: "mono", size: 16, weight: 500, color: cream, alpha: 0.38 + 0.54 * sel, align: "center", fit: slot - 8 });
        });

        /* the button: pressed at 47–50, rendering 50–63, done at 65 (beat 2) */
        const bx = P, by = 227, bw = RX - P, bh = 55, bcx = bx + bw / 2, bcy = by + bh / 2;
        const press = 1 - 0.022 * bump(F, 46.5, 50.5), state = Fq < 49 ? 0 : Fq < 65 ? 1 : 2;
        ctx.save(); ctx.translate(bcx, bcy); ctx.scale(press, press); ctx.translate(-bcx, -bcy);
        if (state === 0) {
          ctx.fillStyle = cream; g.rrect(bx, by, bw, bh, 14); ctx.fill();
          const lab = String(q.button), m = lab.match(/\s*[▸▶►]\s*$/), txt = m ? lab.slice(0, m.index) : lab;
          const w = g.measure(txt, { kind: "display", size: 20, weight: 600, track: -0.6 }) + (m ? 17 : 0);
          sans(txt, bcx - w / 2, by + 34.5, 20, ink, { track: -0.6 });
          if (m) tri(bcx + w / 2 - 8, by + 27.5, 8, 9, ink);
        } else {
          const prog = state === 2 ? 1 : ease.inOutQuad(sp(50.3, 63.3)), fx = bw * prog, off = (2 * F) % 20, fade = 1 - sp(66, 69.5);
          ctx.save(); g.rrect(bx, by, bw, bh, 14); ctx.clip();
          ctx.fillStyle = g.rgba(cream, 0.12); ctx.fillRect(bx, by, bw, bh);
          const stripes = (x0, x1, color) => {
            ctx.fillStyle = color; ctx.beginPath();
            for (let xx = x0 - bh - 20 + off; xx < x1; xx += 20) { ctx.moveTo(xx, by + bh); ctx.lineTo(xx + bh, by); ctx.lineTo(xx + bh + 10, by); ctx.lineTo(xx + 10, by + bh); ctx.closePath(); }
            ctx.fill();
          };
          if (fade > 0) stripes(bx, bx + bw, g.rgba(cream, 0.09 * fade));
          if (fx > 0) {
            const edge = state === 2 ? 0 : 30;
            ctx.save(); ctx.beginPath(); ctx.rect(bx, by, fx, bh); ctx.clip();
            ctx.fillStyle = acc; ctx.fillRect(bx, by, Math.max(0, fx - edge), bh);
            if (edge) { const gr = ctx.createLinearGradient(bx + fx - edge, 0, bx + fx, 0); gr.addColorStop(0, acc); gr.addColorStop(1, g.rgba(acc, 0)); ctx.fillStyle = gr; ctx.fillRect(bx + fx - edge, by, edge, bh); }
            if (fade > 0) stripes(bx, bx + fx, g.rgba(g.mix(acc, cream, 0.3), 0.75 * fade));
            ctx.restore();
          }
          ctx.restore();
          if (state === 1) sans(`${q.busy}…  ${Math.round(prog * 100)}%`, bcx, by + 35, 21, cream, { align: "center", track: -0.5 });
          else {
            const w = g.measure(q.done, { kind: "display", size: 22, weight: 600, track: -0.7 }), ic = ease.outBack(sp(65.5, 68.5)), ix = bcx - (w + 32) / 2 + 11;
            sans(q.done, ix + 21, by + 35.5, 22, cream, { track: -0.7 });
            if (ic > 0) {
              g.circle(ix, bcy, 11 * ic, cream);
              ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 2.4 * ic; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
              ctx.moveTo(ix - 5 * ic, bcy + 0.2 * ic); ctx.lineTo(ix - 1.5 * ic, bcy + 3.6 * ic); ctx.lineTo(ix + 5 * ic, bcy - 3.6 * ic); ctx.stroke(); ctx.restore();
            }
            const gk = sp(65, 77);
            if (gk < 1) { const o = 3 + 5 * ease.outCubic(gk); ctx.save(); ctx.strokeStyle = g.rgba(acc, 0.7 * (1 - gk)); ctx.lineWidth = 1.5; g.rrect(bx - o, by - o, bw + 2 * o, bh + 2 * o, 14 + o); ctx.stroke(); ctx.restore(); }
          }
        }
        ctx.restore();
      }

      /* ---------------------------------------------------------------- the hero number */
      function stat(h) {
        const q = s.stat, cream = paper;
        mono(q.label, P, 57.2, 13, cream, { alpha: 0.62, track: 2.9, weight: 600 });
        mono(q.right, RX, 57.2, 13, cream, { alpha: 0.62, track: 2.9, weight: 600, align: "right" });
        /* the odometer: tabular digits roll up from 0 and lock left to right (frames 21–28.5) */
        const final = q.prefix + Number(q.value).toFixed(q.decimals), suf = String(q.suffix || "");
        const key = final + "|" + suf;
        let L = _.memo.get(key);
        if (!L) {
          const lay = (size) => {
            const o = { kind: "display", size, weight: 600, track: 0 }, os = { kind: "display", size: size * 0.56, weight: 600, track: 0 }, pitch = 0.6 * size;
            let x = 0; const letters = [...final].map((ch) => { const w = /[0-9]/.test(ch) ? pitch : g.measure(ch, o); const l = { ch, x, w }; x += w; return l; });
            const gap = suf && !/^[%‰°]/.test(suf) ? 0.05 * size : 0;
            return { size, o, os, letters, wN: x + gap, wT: x + gap + (suf ? g.measure(suf, os) : 0) };
          };
          L = lay(268);
          if (L.wT > RX - P - 20) L = lay((268 * (RX - P - 20)) / L.wT);
          L.x0 = CW / 2 - L.wT / 2 + 6;
          _.memo.set(key, L);
        }
        const base = 261.7, capH = 0.7 * L.size, lh = 0.92 * L.size;
        const kick = F < 32.4 ? 0 : Math.min(1, (F - 32.4) / 0.8) * Math.exp(-(F - 32.4) / 4.8), ps = 1 + 0.045 * kick;
        const gx = L.x0 + L.wT / 2, gy = base - capH / 2;
        ctx.save(); ctx.translate(gx, gy); ctx.scale(ps, ps); ctx.translate(-gx, -gy);
        const digits = L.letters.filter((l) => /[0-9]/.test(l.ch)), n = digits.length;
        for (const l of L.letters) {
          const cx = L.x0 + l.x + l.w / 2, oc = Object.assign({ color: cream, align: "center" }, L.o);
          if (!/[0-9]/.test(l.ch)) { g.text(l.ch, cx, base, oc); continue; }
          const i = digits.indexOf(l), lock = n > 1 ? 21 + (7.5 * i) / (n - 1) : 28.5, v = +l.ch;
          const go = 3.5 + (n > 1 ? (2.5 * i) / (n - 1) : 0);
          let pos = (10 * (2 + i) + v) * ease.outQuad(g.clamp((F - go) / (lock - go)));
          pos += 0.06 * bump(F, lock, lock + 4);
          const d0 = Math.floor(pos), fr = pos - d0;
          ctx.save(); ctx.beginPath(); ctx.rect(L.x0 + l.x - 0.04 * L.size, base - capH - 0.1 * L.size, l.w + 0.08 * L.size, capH + 0.2 * L.size); ctx.clip();
          g.text(String(((d0 % 10) + 10) % 10), cx, base - fr * lh, oc);
          if (fr > 0.001) g.text(String((d0 + 1) % 10), cx, base + (1 - fr) * lh, oc);
          ctx.restore();
        }
        if (suf) g.text(suf, L.x0 + L.wN, base, Object.assign({ color: ink }, L.os));
        ctx.restore();
        /* the frames counter and its hairline */
        const k = 1 - (1 - sp(2, 29)) ** 2.3, hx = P + (RX - P) * k;
        g.line(P, 289.2, RX, 289.2, ink, 1.5, 0.13);
        if (k > 0) { g.line(P, 289.2, hx, 289.2, cream, 3); g.circle(hx, 289.2, 6, cream); }
        const foot = q.foot === "auto" ? `${String(Math.round(t.F * k)).padStart(4, "0")} / ${t.F} FRAMES` : q.foot;
        /* the chip pops on the punch (frames 33–37) */
        const cw = chipW(q.chip, 13, { weight: 600, track: 1.5 }) + 46, pop = ease.outBack(sp(33, 37));
        mono(foot, P, 325, 12.5, cream, { alpha: 0.9, track: 2.9, weight: 600, fit: RX - P - cw - 24 });
        if (pop > 0) {
          const pcx = RX - cw / 2, pcy = 315.8;
          ctx.save(); ctx.translate(pcx, pcy); ctx.scale(pop, pop); ctx.translate(-pcx, -pcy);
          ctx.fillStyle = ink; g.rrect(RX - cw, 296.8, cw, 38, 19); ctx.fill();
          chipText(q.chip, pcx, 320.5, 13, cream, acc, { weight: 600, track: 1.5 });
          ctx.restore();
        }
      }

      /* ---------------------------------------------------------------- the bar chart */
      function chart(h) {
        const q = s.chart, cream = paper, lav = g.mix(c.cool, cream, 0.55);
        mono(q.label, P, 56.8, 13, lav, { track: 2.8, weight: 600 });
        mono(q.right, RX, 56.8, 13, lav, { track: 2.8, weight: 600, align: "right" });
        sans(q.prefix + (q.value * ease.outCubic(sp(6, 46))).toFixed(q.decimals) + q.suffix, P, 115.8, 52, cream, { track: -2.5 });
        const n = q.bars.length, mx = Math.max(...q.bars.map(Math.abs), 1e-9), base = 277.8, maxH = 124, slot = (RX - P) / n, bw = Math.min(44, slot * 0.615);
        /* guides at a third, two thirds and the top */
        ctx.save(); ctx.strokeStyle = g.rgba(cream, 0.12); ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.beginPath();
        for (const f of [1 / 3, 2 / 3, 1]) { const yy = Math.round(base - maxH * f) + 0.5; ctx.moveTo(P, yy); ctx.lineTo(RX, yy); }
        ctx.stroke(); ctx.restore();
        const pts = [];
        q.bars.forEach((v, i) => {
          const gk = ease.outBack(sp(8.5 + (18.2 * i) / Math.max(1, n - 1), 18.5 + (18.2 * i) / Math.max(1, n - 1)), 1.3), H = (maxH * Math.max(0, v)) / mx, bh = H * gk, x = P + slot * (i + 0.5);
          if (bh > 0.5) { ctx.fillStyle = i === n - 1 ? c.sun : cream; ctx.beginPath(); ctx.roundRect(x - bw / 2, base - bh, bw, bh, [Math.min(8, bh / 2, bw / 2), Math.min(8, bh / 2, bw / 2), 0, 0]); ctx.fill(); }
          const name = (q.names && q.names[i] != null) ? String(q.names[i]) : `W${String(i + 1).padStart(2, "0")}`;
          g.text(name.toUpperCase(), x, 311.8, { kind: "mono", size: 12, weight: 600, track: 1, color: i === n - 1 ? c.sun : lav, align: "center", fit: slot - 4 });
          pts.push([x, base - H - 23]);
        });
        /* the trend line (Catmull-Rom through the bar tops), drawn left to right at frames 30–52 */
        const lk = ease.inOutSine(sp(30, 52));
        if (lk > 0 && n > 1) {
          const x0 = pts[0][0], x1 = pts[n - 1][0], head = x0 + (x1 - x0) * lk, path = [];
          for (let i = 0; i < n - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
            for (let j = 0; j < 10; j++) {
              const v = j / 10, v2 = v * v, v3 = v2 * v, cr = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * v + (2 * a - 5 * b + 4 * cc - d) * v2 + (-a + 3 * b - 3 * cc + d) * v3);
              path.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
            }
          }
          path.push(pts[n - 1]);
          ctx.save(); ctx.strokeStyle = g.rgba(c.blush, 0.92); ctx.lineWidth = 3.8; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
          let hx = path[0][0], hy = path[0][1];
          ctx.moveTo(hx, hy);
          for (let i = 1; i < path.length; i++) {
            const [px, py] = path[i];
            if (px <= head) { ctx.lineTo(px, py); hx = px; hy = py; continue; }
            const [qx, qy] = path[i - 1], f = (head - qx) / Math.max(1e-6, px - qx);
            hx = qx + (px - qx) * f; hy = qy + (py - qy) * f; ctx.lineTo(hx, hy); break;
          }
          ctx.stroke(); ctx.restore();
          if (lk < 1) { g.circle(hx, hy, 13, g.rgba(c.sun, 0.3)); g.circle(hx, hy, 5.5, c.sun); }
          /* the end dot pops (52–56), then the tooltip (57–62) */
          const [ex, ey] = pts[n - 1], dk = ease.outBack(sp(52, 56));
          if (dk > 0) { g.circle(ex, ey, 16 * dk, g.rgba(c.blush, 0.42)); g.circle(ex, ey, 8 * dk, c.sun); }
          const tk = ease.outBack(sp(57, 62));
          if (tk > 0) {
            const tw = chipW(q.chip, 13, { weight: 600, track: 1.4 }) + 58, tcx = ex - 18.5 - tw / 2, tcy = Math.max(70, ey - 36.3);
            ctx.save(); ctx.translate(tcx, tcy); ctx.scale(tk, tk);
            ctx.fillStyle = ink; g.rrect(-tw / 2, -18.5, tw, 37, 8); ctx.fill();
            chipText(q.chip, 0, 4.8, 13, c.sun, c.sun, { weight: 600, track: 1.4 });
            ctx.restore();
          }
        }
      }

      /* ---------------------------------------------------------------- the curve editor */
      function curve(h) {
        const q = s.curve, dim = { alpha: 0.42, weight: 600 };
        mono(q.label, P, 56.5, 13, ink, Object.assign({ track: 2.9 }, dim));
        mono(q.right, RX, 56.5, 13, ink, Object.assign({ track: 2.9, align: "right" }, dim));
        /* the editor: handles spring from linear (frame 13.5, overshooting) to the curve */
        const bx = P, by = 76.5, bs = 160, Pt = (x, y) => [bx + bs * x, by + bs - bs * y];
        const spr = ease.spring(Math.max(0, F - 13.5) / 60, 2.67, 0.357), [x1, y1, x2, y2] = q.bezier.map((v, i) => g.lerp(LINEAR[i], v, spr));
        ctx.save(); ctx.strokeStyle = g.rgba(ink, 0.08); ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const o = (i * bs) / 4; ctx.moveTo(bx + o, by); ctx.lineTo(bx + o, by + bs); ctx.moveTo(bx, by + o); ctx.lineTo(bx + bs, by + o); }
        ctx.stroke(); ctx.restore();
        const a0 = Pt(0, 0), a1 = Pt(x1, y1), a2 = Pt(x2, y2), a3 = Pt(1, 1);
        /* the playhead: a ball rides the curve, x linear in time (frames 27–71) */
        const bk = ease.outBack(sp(25.5, 28.5)), bt = sp(27, 71), [, by2] = bezierY(x1, y1, x2, y2, bt), ball = Pt(bt, by2);
        if (bk > 0) { ctx.save(); ctx.strokeStyle = g.rgba(ink, 0.45); ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(ball[0], ball[1]); ctx.lineTo(ball[0], by + bs); ctx.stroke(); ctx.restore(); }
        g.line(...a0, ...a1, ink, 1.5); g.line(...a3, ...a2, ink, 1.5);
        ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(...a0); ctx.bezierCurveTo(...a1, ...a2, ...a3); ctx.stroke(); ctx.restore();
        ctx.fillStyle = ink; ctx.fillRect(a0[0] - 4, a0[1] - 4, 8, 8); ctx.fillRect(a3[0] - 4, a3[1] - 4, 8, 8);
        for (const pt of [a1, a2]) { g.circle(...pt, 9, paper); g.ring(...pt, 9, ink, 2); }
        if (bk > 0) { g.circle(...ball, 11 * bk, acc); g.ring(...ball, 11 * bk, paper, 2.5); }
        const str = `cubic-bezier(${[x1, Math.min(1, y1), x2, Math.min(1, y2)].map((v) => css(g.clamp(v, -9, 9))).join(",")})`;
        g.text(str, bx, 264.5, { kind: "mono", size: 16, weight: 500, track: 0.2, color: ink, fit: 690 - bx });
        /* the table: rows slide and fade in at frames 18.5, 21, 23.5, 25.5 */
        const rows = q.rows || [["P1", `${x1.toFixed(2)}, ${y1.toFixed(2)}`], ["P2", `${x2.toFixed(2)}, ${y2.toFixed(2)}`], ["DUR", (t.spb * 0.78).toFixed(2) + "S"], ["FPS", String(t.fps)]];
        const tx = 278.5, tr = 530.5;
        rows.slice(0, 4).forEach(([a, v], i) => {
          const r0 = [18.5, 21, 23.5, 25.5][i], rk = ease.outCubic(sp(r0, r0 + 3.5));
          if (rk <= 0) return;
          const yy = 117.5 + 38.3 * i + 8 * (1 - rk);
          ctx.save(); ctx.globalAlpha *= rk;
          mono(a, tx, yy, 12, ink, { alpha: 0.42, weight: 600, track: 1.6, fit: 70 });
          g.text(String(v), tr, yy + 1.5, { kind: "mono", size: 16, weight: 500, color: ink, align: "right", fit: tr - tx - 70 });
          g.line(tx, yy + 14.5, tr, yy + 14.5, ink, 1, 0.15);
          ctx.restore();
        });
        /* the ring: 0 → value, frames 17–54.5 */
        const target = Array.isArray(q.ring) ? q.ring[q.ring.length - 1] : +q.ring, pct = target * ease.outQuad(sp(17, 54.5));
        const rx = RX - 90, ry = 145.5, rr = 74, a = -Math.PI / 2 + (pct / 100) * g.TAU;
        g.ring(rx, ry, rr, ink, 13, 0.1);
        if (pct > 0.05) { ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 13; ctx.lineCap = "butt"; ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, a); ctx.stroke(); ctx.restore(); }
        if (pct > 0.5) g.circle(rx + rr * Math.cos(a), ry + rr * Math.sin(a), 7, acc);
        sans(Math.round(pct) + "%", rx, 157, 39, ink, { align: "center", track: -2 });
        mono(q.ringLabel, rx, 181.5, 10, ink, { alpha: 0.4, weight: 600, track: 2, align: "center", fit: 2 * rr - 30 });
        const pw = monoW(q.pill, 12, { track: 1.4, weight: 600 }) + 46;
        ctx.fillStyle = g.rgba(ink, 0.06); g.rrect(rx - pw / 2, 240.5, pw, 32, 16); ctx.fill();
        mono(q.pill, rx, 260.7, 12, ink, { alpha: 0.85, track: 1.4, weight: 600, align: "center" });
      }

      /* ---------------------------------------------------------------- the cursor */
      function cursor() {
        const c0 = _.cards[0], c1 = _.cards[1], at = (cc, x, y) => [cc.x + x * u, cc.y + y * u];
        const tg = at(c0, 422.5, 183.5), bt = at(c0, 659.5, 270.5), dg = at(c1, 629.5, 200.2);
        let x, y;
        if (F < 11) { [x, y] = at(c0, ...along(WAYIN, WAYLEN * ease.outQuad(g.clamp((F + 1.2) / 12.2)))); }
        else if (F < 73 + X) { const k = ease.inOutQuad(sp(30.5, 41.5)); x = g.lerp(tg[0], bt[0], k); y = g.lerp(tg[1], bt[1], k); }
        else { const k = ease.inOutSine(sp(73 + X, 83 + X)); x = g.lerp(bt[0], dg[0], k); y = g.lerp(bt[1], dg[1], k); }
        const k = (1 - sp(86 + X, 88 + X)) * (1 - 0.12 * (bump(F, 14.5, 18.5) + bump(F, 47.5, 51.5))) * 1.8 * u;
        if (k <= 0.01) return;
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.beginPath(); ARROW.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
        ctx.lineJoin = "round"; ctx.strokeStyle = paper; ctx.lineWidth = 2.3; ctx.stroke();
        ctx.fillStyle = ink; ctx.fill();
        ctx.restore();
      }
    },
  });
})();
