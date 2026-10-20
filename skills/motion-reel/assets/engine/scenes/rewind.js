/*
 * Rewind. The reel itself, played backwards at speed: every frame since `to` comes back in
 * reverse, faster and faster, then slowing into the moment it rewinds to, under a VCR's rewind
 * picture (tracking bands that tear the frame sideways, scan lines, the ◀◀ and a speed readout).
 * The HUD reads the moment being shown, so its timecode and its numbers run backwards too.
 *
 * Rewound to beat 0 (the default) and placed last, it is the loop: its last frame is the reel's
 * first, so the reel plays, rewinds and plays again with no seam. Put the end card before it.
 *
 *   to       the beat of the reel it rewinds to (0: the start)
 *   ease     how it gathers speed and brakes (an ease name)
 *   readout  the speed readout under the ◀◀ ({x} the speed, live)
 *   word     the OSD word beside the ◀◀
 *   bands    how many tracking bands tear the frame (0 for none)
 *   lines    scan lines over the picture (0..1, their strength)
 *   tint     a wash over the rewound picture (a palette role), or null
 */
(() => {
const TAU = Math.PI * 2;
Reel.scene("rewind", {
  label: "REWIND",
  bg: "ink",
  beats: 4,
  seamless: true, /* it lands on the very frame that follows it: no hit at that cut */
  shutter: 1, /* a full-frame shutter: each frame smears across the many it rewinds through */
  params: {
    to: 0, /* the beat it rewinds to */
    ease: "inOutCubic", /* gathering speed, then braking into the moment it lands on */
    readout: "×{x}", /* the speed, under the ◀◀ */
    word: "REWIND", /* beside the ◀◀ */
    bands: 3, /* tracking bands */
    lines: 0.5, /* scan lines */
    tint: null, /* a wash over the picture */
  },
  prepare(s, g) {
    const R = g.R, from = Math.ceil((s.start / R.beats) * R.frames - 1e-9) - 1, to = Math.max(0, Math.round((s.to / R.beats) * R.frames));
    if (s.to >= s.start) Reel.warn(`rewind (scene ${s.i + 1}): to: ${s.to} is not before the rewind; it rewinds to the start`);
    const span = Math.max(1, from - (s.to >= s.start ? 0 : to));
    /* scan lines: one tile, repeated */
    const tile = document.createElement("canvas"); tile.width = 4; tile.height = 4;
    const tx = tile.getContext("2d"); tx.fillStyle = "rgba(0,0,0,1)"; tx.fillRect(0, 0, 4, 2);
    return { from, to: from - span, span, tile, anchor: [g.box.cx, g.box.cy] };
  },
  draw(g, s, t) {
    const _ = s._, ctx = g.ctx, R = g.R, W = R.w, H = R.h;
    const E = g.ease[s.ease] || g.ease.inOutCubic, u = g.clamp(t.b / s.beats), e = E(u);
    const F = _.from - _.span * e;
    /* the reel, at the moment being rewound to */
    Reel.paintAt(F, ctx);
    ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    /* its speed, in frames of the reel per frame shown */
    const du = 1 / Math.max(1, (s.len / R.beats) * R.frames), x = (_.span * (E(Math.min(1, u + du)) - e)) / 1;
    const speed = Math.max(1, Math.round(x));
    /* the VCR's picture clears as it lands, so the last frame is the moment it rewound to, clean */
    const clean = 1 - g.smoothstep(0.84, 0.975, u);
    if (clean <= 0) { _.hudFrame = F; _.hudLabel = s.label; return; }
    const hard = g.clamp(speed / 12) * clean; /* how torn the picture is: with the speed */
    if (s.tint) { ctx.save(); ctx.globalCompositeOperation = "color"; ctx.globalAlpha = (0.35 + 0.3 * hard) * clean; ctx.fillStyle = g.col(s.tint); ctx.fillRect(0, 0, W, H); ctx.restore(); }
    /* tracking bands: a slice of the frame torn sideways, noisy at its edges, rolling down */
    const cv = ctx.canvas, k = R.scale;
    for (let i = 0; i < s.bands; i++) {
      const ph = g.fract(t.b * (0.9 + 0.37 * i) + g.hash(i, 3)), y = ph * (H + 300) - 150, h = (40 + 110 * g.hash(i, 5)) * (0.5 + hard) * clean;
      const dx = (30 + 140 * g.hash(i, 7)) * hard * (g.hash(Math.floor(t.fi / 2), i) < 0.5 ? -1 : 1);
      if (h < 2 || y + h < 0 || y > H) continue;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cv, 0, Math.max(0, y * k), cv.width, h * k, dx * k, Math.max(0, y * k), cv.width, h * k);
      /* the band's static: thin bright lines */
      for (let j = 0; j < 7; j++) {
        const yy = (y + h * g.hash(i, j, Math.floor(t.fi / 2))) * k;
        ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.5 * g.hash(j, i, t.fi)})`; ctx.fillRect(0, yy, cv.width, (1 + 2 * g.hash(j, 9)) * k);
      }
      ctx.restore();
    }
    /* scan lines */
    if (s.lines > 0) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.18 * s.lines * clean; ctx.fillStyle = ctx.createPattern(_.tile, "repeat");
      ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
    }
    /* the OSD: ◀◀, the word and the speed, in the frame's paper, flashing at the start */
    const on = t.bq > 0.08 || Math.floor(t.fi / 4) % 2 === 0, bx = g.box.x + 34, by = g.box.y + 92, ink = g.c.paper;
    if (on) {
      /* white with a black outline, as a VCR draws it: it reads on any picture */
      ctx.save(); ctx.globalAlpha = clean; ctx.lineJoin = "round";
      const tri = (ox) => { ctx.beginPath(); ctx.moveTo(bx + ox + 40, by); ctx.lineTo(bx + ox, by + 26); ctx.lineTo(bx + ox + 40, by + 52); ctx.closePath(); };
      for (const ox of [0, 44]) { tri(ox); ctx.strokeStyle = "#000"; ctx.lineWidth = 8; ctx.stroke(); }
      for (const ox of [0, 44]) { tri(ox); ctx.fillStyle = ink; ctx.fill(); }
      const label = (str, x, y, size) => { g.text(str, x, y, { kind: "mono", size, weight: 700, track: size / 11, color: "#000", stroke: 8 }); g.text(str, x, y, { kind: "mono", size, weight: 700, track: size / 11, color: ink }); };
      label(s.word, bx + 104, by + 44, 46);
      label(s.readout.replace("{x}", String(speed)), bx, by + 108, 30);
      ctx.restore();
    }
    /* the HUD reads the moment shown: its timecode and numbers run back */
    _.hudFrame = F; _.hudLabel = s.label;
  },
});
})();
