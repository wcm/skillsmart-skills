/*
 * Bobine transitions: the joins between scenes, as a library.
 *
 * A scene takes one as its out (it plays over the scene's last beats, onto the next scene frozen
 * at its first frame) or its in (over its first beats, from the scene before frozen at its last
 * frame). Either way a transition gets k (0 → 1 through it), its options o and X: the outgoing
 * picture A and the incoming B (X.picA(), X.picB() paint them into layers), the scenes X.a and
 * X.b, their anchors (X.anchorA(), X.anchorB(): the dot each one hands on, [x, y, r]), and the
 * clock X.t. Every one is a pure function of k, so it seeks, blurs and loops like the scenes.
 *
 *   { type, beats, ease, … }    beats: how long it runs (0.5 by default), in the scene's beats
 *
 *   zoom     dive into A's anchor until it fills the frame, B waiting inside it (hole: "dot" the
 *            anchor's dot, "none" a cross-fade near the end, or a shape spec); ratio, spin (deg),
 *            blur. B's own anchor lands where A's was, so zooms chain scene into scene.
 *   punch    a smash cut that hits: B (in) slams in oversized and springs back, with shake and a
 *            flash; as an out, A rushes at the camera for the last moment, then the cut.
 *   whip     a whip pan: both pictures fly along dir, streaked; tilt rolls the camera (deg).
 *   shatter  A breaks into shards round its anchor (or at) that crack, then fly and fall, B
 *            behind; pieces, power, gravity, spin.
 *   slice    B arrives in bands from alternate sides over A, streaked; bands, stagger.
 *   spin     A spins away (turns, scale), B spins in the other way, a flash at the swap.
 *   flood    B floods out of A's anchor inside a wobbling blob with an accent edge (color).
 *   shape    an iris through a shape spec (shape, default star-5) that turns as it grows.
 *   pixel    A breaks into blocks up to size px, B resolves out of them.
 *   burn     A burns out to white (color), B develops out of it.
 */
(function () {
  "use strict";
  const Reel = (window.Reel = window.Reel || {});
  const T = (Reel.transitions = Reel.transitions || {});
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ez = (X, o, fallback) => X.g.ease[o.ease || fallback] || X.g.ease[fallback];

  /* a full-frame picture (a layer canvas) drawn in design px, optionally transformed */
  const full = (ctx, X, cv, alpha = 1) => { ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(cv, 0, 0, X.R.w, X.R.h); ctx.restore(); };
  const placed = (ctx, X, cv, { about = [X.R.w / 2, X.R.h / 2], to = about, scale = 1, rot = 0, alpha = 1 } = {}) => {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.translate(to[0], to[1]); if (rot) ctx.rotate(rot); if (scale !== 1) ctx.scale(scale, scale); ctx.translate(-about[0], -about[1]);
    ctx.drawImage(cv, 0, 0, X.R.w, X.R.h); ctx.restore();
  };
  /* n copies averaged into a layer (a true average, transparent parts included): blur of any kind */
  const average = (X, name, n, each) => {
    const L = X.g.layer(X.LN(name)), c = L.ctx;
    c.globalCompositeOperation = "lighter"; c.globalAlpha = 1 / n;
    for (let j = 0; j < n; j++) { c.save(); each(c, n > 1 ? j / (n - 1) : 0.5); c.restore(); }
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    return L.canvas;
  };
  /* the farthest corner from a point */
  const far = (X, x, y) => Math.max(...[[0, 0], [X.R.w, 0], [0, X.R.h], [X.R.w, X.R.h]].map(([a, b]) => Math.hypot(a - x, b - y)));
  /* a scene's ground under pictures that move (so nothing shows through their edges) */
  const ground = (ctx, X, scene) => X.fillGround(ctx, scene);
  /* the scale a frame turned by a needs to still cover the frame */
  const cover = (X, a) => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), W = X.R.w, H = X.R.h; return Math.max((c * W + s * H) / W, (s * W + c * H) / H); };
  /* seconds into the transition, and its length in seconds */
  const secs = (X, k, o) => { const len = (o.beats ?? 0.5) * X.t.spb; return [k * len, len]; };
  /* frames the transition lasts (for streak lengths) */
  const frames = (X, o) => Math.max(1, (o.beats ?? 0.5) * X.t.spb * X.R.fps);

  /* ---------------------------------------------------------------- zoom */

  T.zoom = (ctx, k, o, X) => {
    const A = X.picA(), [ax, ay, ar0] = o.at ? [o.at[0], o.at[1], o.r ?? 0] : X.anchorA();
    const B = X.picB(), [bx, by] = o.into === false ? [ax, ay] : X.anchorB();
    const ar = Math.max(ar0 || 0, o.r ?? 34);
    /* deep enough that the dot, zoomed, covers the frame by the end (a small dot dives further) */
    const e = ez(X, o, "inQuart")(k), ratio = Math.max(o.ratio ?? 16, (far(X, ax, ay) * 1.04) / ar), Z = ratio ** e, spin = (o.spin || 0) * DEG;
    /* A dives: copies spread a little further in as it speeds up (zoom blur) */
    const vel = Math.log(ratio) * (ez(X, o, "inQuart")(Math.min(1, k + 0.03)) - e) / 0.03 / frames(X, o);
    const spread = Math.min(0.6, (o.blur ?? 1) * vel * 1.6);
    ground(ctx, X, X.a);
    const n = spread > 0.01 ? 10 : 1;
    const zA = average(X, "zA", n, (c, j) => placed(c, X, A, { about: [ax, ay], scale: Z * (1 + spread * j), rot: spin * e }));
    full(ctx, X, zA);
    /* B: inside the hole, its own anchor riding from A's toward its place, growing to full size.
       Its ground is painted in its own (zoomed) space under it, so it runs on past B's frame and
       no edge of the frame shows inside the hole */
    const sB = Z / ratio, P = [lerp(ax, bx, e), lerp(ay, by, e)], rotB = spin * (e - 1);
    const hole = o.hole ?? "dot", rh = ar * Z, F = far(X, ax, ay);
    const drawB = (c, alpha = 1) => {
      c.save(); c.globalAlpha *= alpha; c.translate(P[0], P[1]); if (rotB) c.rotate(rotB); if (sB !== 1) c.scale(sB, sB); c.translate(-bx, -by);
      X.fillGround(c, X.b); c.drawImage(B, 0, 0, X.R.w, X.R.h);
      c.restore();
    };
    if (hole === "none" || hole === "fade") { drawB(ctx, X.g.smoothstep(0.55, 0.95, k)); return; }
    if (rh < 0.5) return;
    if (hole === "dot" || rh > F * 2.5) {
      ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, Math.min(rh, F * 1.02), 0, TAU); ctx.clip();
      drawB(ctx);
      ctx.restore();
    } else {
      /* a shaped hole: B masked by the shape (any spec), turning with the dive */
      const L = X.g.layer(X.LN("zH")), c = L.ctx;
      drawB(c);
      c.globalCompositeOperation = "destination-in";
      c.save(); c.translate(ax, ay); c.rotate(spin * e); c.fillStyle = "#fff"; c.beginPath(); if (X.g.shapePath(hole, c, 0, 0, rh) !== "filled") c.fill(); c.restore();
      c.globalCompositeOperation = "source-over";
      full(ctx, X, L.canvas);
    }
    if (o.edge && rh < F) X.g.ring(ax, ay, rh, o.edge, 2 + 4 * e, 0.9 * (1 - e));
  };

  /* ---------------------------------------------------------------- punch */

  T.punch = (ctx, k, o, X) => {
    const g = X.g, p = o.power ?? 1, [sec, len] = secs(X, k, o);
    if (X.side === "out") {
      /* A rushes at the camera over the window, streaked; the cut does the rest */
      const A = X.picA(), [ax, ay] = o.at || X.anchorA(), e = g.ease.inQuint(k), sc = 1 + 0.45 * p * e;
      ground(ctx, X, X.a);
      const n = e > 0.05 ? 8 : 1;
      full(ctx, X, average(X, "pA", n, (c, j) => placed(c, X, A, { about: [ax, ay], scale: sc * (1 + 0.08 * p * e * j) })));
      return;
    }
    /* B slams in: oversized, springing back through a small undershoot, shaken, after a flash */
    const B = X.picB(), [bx, by] = o.at || [X.R.w / 2, X.R.h / 2];
    const sp = 1 - g.ease.spring(sec, o.hz ?? 4.2, o.zeta ?? 0.38), sc = 1 + (o.scale ?? 0.26) * p * sp;
    const sh = (o.shake ?? 34) * p * Math.exp(-sec / 0.12), n3 = g.noise3, u = sec * 40;
    const rot = (o.tilt ?? 2.2) * DEG * p * sp;
    ground(ctx, X, X.b);
    placed(ctx, X, B, { about: [bx, by], to: [bx + sh * n3(u, 1.7, 3), by + sh * n3(u, 9.1, 3)], scale: sc, rot });
    const fl = o.flash === false ? 0 : Math.max(0, 1 - sec / 0.06);
    if (fl > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.85 * fl; ctx.fillStyle = g.col(o.color || "#ffffff"); ctx.fillRect(0, 0, X.R.w, X.R.h); ctx.restore(); }
  };

  /* ---------------------------------------------------------------- whip */

  T.whip = (ctx, k, o, X) => {
    const g = X.g, [ux0, uy0] = o.dir || [-1, 0], L = Math.hypot(ux0, uy0) || 1, ux = ux0 / L, uy = uy0 / L;
    const span = Math.abs(ux) * X.R.w + Math.abs(uy) * X.R.h, E = ez(X, o, "inOutQuart");
    const e = E(k), v = ((E(Math.min(1, k + 0.02)) - E(Math.max(0, k - 0.02))) / 0.04) * span / frames(X, o);
    const A = X.picA(), B = X.picB();
    /* both pictures on one strip, then streaked along it */
    const strip = X.g.layer(X.LN("wS")), sc = strip.ctx;
    sc.save(); sc.translate(ux * span * e, uy * span * e); sc.drawImage(A, 0, 0, X.R.w, X.R.h); sc.translate(-ux * span, -uy * span); sc.drawImage(B, 0, 0, X.R.w, X.R.h); sc.restore();
    const len = Math.min(span * 0.5, v * 2.2 * (o.blur ?? 1)), n = len > 2 ? Math.round(clamp(len / 12, 6, 32)) : 1;
    const tilt = (o.tilt ?? 5) * DEG * Math.sin(Math.PI * k);
    ground(ctx, X, k < 0.5 ? X.a : X.b);
    ctx.save(); ctx.translate(X.R.w / 2, X.R.h / 2); ctx.rotate(tilt); ctx.scale(1 + Math.abs(tilt) * 1.2, 1 + Math.abs(tilt) * 1.2); ctx.translate(-X.R.w / 2, -X.R.h / 2);
    full(ctx, X, average(X, "wB", n, (c, j) => { c.translate(ux * len * (j - 0.5), uy * len * (j - 0.5)); c.drawImage(strip.canvas, 0, 0, X.R.w, X.R.h); }));
    ctx.restore();
  };

  /* ---------------------------------------------------------------- shatter */

  const cellsCache = new Map();
  /* convex Voronoi cells of the frame round seeded sites, denser near the impact */
  function cells(X, at, pieces, seed) {
    const key = [Math.round(at[0]), Math.round(at[1]), pieces, seed].join(",");
    if (cellsCache.has(key)) return cellsCache.get(key);
    const r = X.g.rng(seed), W = X.R.w, H = X.R.h, F = far(X, at[0], at[1]), sites = [];
    for (let i = 0; i < pieces; i++) {
      if (i < pieces * 0.62) { const a = r() * TAU, d = F * 0.55 * r() ** 1.7; sites.push([at[0] + d * Math.cos(a), at[1] + d * Math.sin(a)]); }
      else sites.push([r() * W, r() * H]);
    }
    const list = X.g.voronoi(sites, [-4, -4, W + 4, H + 4]).map(({ poly, c: [cx, cy], i }) => {
      const d = Math.hypot(cx - at[0], cy - at[1]), ux = d > 1 ? (cx - at[0]) / d : Math.cos(i), uy = d > 1 ? (cy - at[1]) / d : Math.sin(i);
      return { poly, c: [cx, cy], d, u: [ux, uy], r1: r(), r2: r(), r3: r() };
    });
    list.sort((a, b) => b.d - a.d); /* the far ones first: the near, fast shards fly over them */
    const out = { list, F };
    cellsCache.set(key, out);
    return out;
  }
  T.shatter = (ctx, k, o, X) => {
    const g = X.g, at = o.at || X.anchorA().slice(0, 2), p = o.power ?? 1, grav = o.gravity ?? 1;
    const A = X.picA(), B = X.picB(), { list, F } = cells(X, at, o.pieces ?? 64, o.seed ?? 11);
    const crack = o.crack ?? 0.14;
    /* B behind, pushing in a little as it is revealed */
    ground(ctx, X, X.b);
    placed(ctx, X, B, { scale: 1 + 0.06 * (1 - g.ease.outCubic(k)) });
    for (const s of list) {
      let dx, dy, rot = 0, sc = 1;
      if (k < crack) { const q = k / crack, w = (2 + 9 * q) * (1.4 - s.d / F); dx = s.u[0] * w; dy = s.u[1] * w; }
      else {
        const q = (k - crack) / (1 - crack), near = 1.25 - Math.min(1, s.d / F), sp = F * 1.55 * p * (0.45 + 0.9 * s.r1) * near;
        const w = 11 * (1.4 - s.d / F);
        dx = s.u[0] * (w + sp * q ** 1.6); dy = s.u[1] * (w + sp * q ** 1.6) + 1500 * grav * q * q;
        rot = (s.r2 - 0.5) * 5.5 * (o.spin ?? 1) * q ** 1.3; sc = 1 + 0.35 * s.r3 * q * near;
      }
      ctx.save();
      ctx.translate(s.c[0] + dx, s.c[1] + dy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-s.c[0], -s.c[1]);
      ctx.beginPath(); s.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.save(); ctx.clip(); ctx.drawImage(A, 0, 0, X.R.w, X.R.h); ctx.restore();
      if (o.edges !== false) { ctx.strokeStyle = g.rgba(o.edge ? g.col(o.edge) : "#ffffff", 0.35 * (1 - k)); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
    }
    /* the impact: a flash and a ring, for a moment */
    const fl = 1 - k / 0.1;
    if (fl > 0) {
      const gr = ctx.createRadialGradient(at[0], at[1], 0, at[0], at[1], 260);
      gr.addColorStop(0, g.rgba("#ffffff", 0.9 * fl)); gr.addColorStop(1, g.rgba("#ffffff", 0));
      ctx.save(); ctx.fillStyle = gr; ctx.fillRect(0, 0, X.R.w, X.R.h); ctx.restore();
      g.ring(at[0], at[1], 40 + 900 * k, o.edge || "#ffffff", 3, 0.8 * fl);
    }
  };

  /* ---------------------------------------------------------------- slice */

  T.slice = (ctx, k, o, X) => {
    const g = X.g, A = X.picA(), B = X.picB(), n = o.bands ?? 14, st = o.stagger ?? 0.35, r = g.rng(o.seed ?? 5);
    const H = X.R.h, W = X.R.w, hs = []; let sum = 0;
    for (let i = 0; i < n; i++) { const h = 0.4 + r() * 1.6; hs.push(h); sum += h; }
    const E = ez(X, o, "inOutExpo");
    full(ctx, X, A);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const h = (hs[i] / sum) * H, d = st * r(), side = i % 2 ? 1 : -1;
      const q = clamp((k - d) / (1 - st)), e = E(q), x = side * W * (1 - e);
      const v = ((E(clamp(q + 0.03)) - E(clamp(q - 0.03))) / 0.06) * W / frames(X, o) / (1 - st), len = Math.min(W * 0.4, v * 2 * (o.blur ?? 1));
      if (e > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, y - 0.5, W, h + 1); ctx.clip();
        if (len > 2) {
          const m = Math.round(clamp(len / 10, 6, 28));
          ctx.globalAlpha = 1;
          full(ctx, X, average(X, "sl", m, (c, j) => { c.beginPath(); c.rect(0, y - 0.5, W, h + 1); c.clip(); c.translate(x + side * len * (j - 0.5), 0); c.drawImage(B, 0, 0, W, H); }));
        } else { ctx.translate(x, 0); ctx.drawImage(B, 0, 0, W, H); }
        ctx.restore();
        /* a hot edge on the band's leading side while it travels */
        if (e < 1 && o.edge !== false) { ctx.save(); ctx.fillStyle = g.col(o.edge || "accent"); ctx.globalAlpha = 0.9 * (1 - e); ctx.fillRect(side < 0 ? x + W - 3 : x - 3, y, 6, h); ctx.restore(); }
      }
      y += h;
    }
  };

  /* ---------------------------------------------------------------- spin */

  T.spin = (ctx, k, o, X) => {
    const g = X.g, [ax, ay] = o.at || [X.R.w / 2, X.R.h / 2], turns = o.turns ?? 0.5, big = o.scale ?? 1.6;
    const swap = k >= 0.5, q = swap ? (k - 0.5) * 2 : k * 2, th = turns * TAU;
    const pic = swap ? X.picB() : X.picA();
    const e = swap ? g.ease.outQuart(q) : g.ease.inQuart(q), ang = swap ? -th * (1 - e) : th * e;
    /* it grows as it turns, and never less than it takes to cover the frame at its angle */
    const sc = Math.max(swap ? lerp(big, 1, e) : lerp(1, big, e), cover(X, ang) * (1 + Math.hypot(ax - X.R.w / 2, ay - X.R.h / 2) / Math.min(X.R.w, X.R.h)));
    const w = th * (swap ? 4 * (1 - q) ** 3 : 4 * q ** 3) / frames(X, o) * 2 * (o.blur ?? 1);
    ground(ctx, X, swap ? X.b : X.a);
    const n = Math.abs(w) > 0.004 ? 14 : 1;
    full(ctx, X, average(X, "spn", n, (c, j) => placed(c, X, pic, { about: [ax, ay], scale: sc, rot: ang + w * (j - 0.5) })));
    const fl = 1 - Math.abs(k - 0.5) / 0.08;
    if (fl > 0 && o.flash !== false) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.7 * fl; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, X.R.w, X.R.h); ctx.restore(); }
  };

  /* ---------------------------------------------------------------- flood */

  T.flood = (ctx, k, o, X) => {
    const g = X.g, A = X.picA(), [ax, ay] = o.at || X.anchorA(), B = X.picB(), F = far(X, ax, ay);
    const e = ez(X, o, "inOutCubic")(k), R0 = F * 1.18 * e, wob = (o.wobble ?? 1) * 0.16 * (1 - 0.6 * e);
    const path = (c, grow = 0) => {
      c.beginPath();
      for (let i = 0; i <= 96; i++) {
        const th = (i / 96) * TAU, w = Math.sin(3 * th + 1.3 + k * 5) * 0.5 + Math.sin(5 * th + 0.4 - k * 7) * 0.3 + Math.sin(8 * th + 2.1 + k * 11) * 0.2;
        const r = (R0 + grow) * (1 + wob * w);
        c[i ? "lineTo" : "moveTo"](ax + r * Math.cos(th), ay + r * Math.sin(th));
      }
      c.closePath();
    };
    full(ctx, X, A);
    if (R0 < 0.5) return;
    /* the leading edge and its droplets, in the accent, then B inside */
    const edge = g.col(o.color || "accent");
    ctx.save(); path(ctx, 26 * (1 - e) + 8); ctx.fillStyle = edge; ctx.fill(); ctx.restore();
    for (let i = 0; i < 9; i++) {
      const th = g.hash(i, 3) * TAU, d = R0 * (1.12 + 0.4 * g.hash(i, 5)) + 30, rr = (6 + 16 * g.hash(i, 7)) * (1 - e);
      if (rr > 0.5) g.circle(ax + d * Math.cos(th), ay + d * Math.sin(th), rr, edge, ctx);
    }
    ctx.save(); path(ctx); ctx.clip(); ground(ctx, X, X.b); full(ctx, X, B); ctx.restore();
  };

  /* ---------------------------------------------------------------- shape */

  T.shape = (ctx, k, o, X) => {
    const g = X.g, A = X.picA(), B = X.picB(), [ax, ay] = o.at || X.anchorA(), F = far(X, ax, ay);
    const e = ez(X, o, "inQuart")(k), r = F * (o.cover ?? 2.6) * e, rot = (o.spin ?? 90) * DEG * e;
    full(ctx, X, A);
    if (r < 0.5) return;
    /* the shape as a mask (any spec, filled or a path): B kept inside it */
    const L = g.layer(X.LN("shp")), c = L.ctx;
    ground(c, X, X.b); c.drawImage(B, 0, 0, X.R.w, X.R.h);
    c.globalCompositeOperation = "destination-in";
    c.save(); c.translate(ax, ay); c.rotate(rot); c.fillStyle = "#fff"; c.beginPath(); if (g.shapePath(o.shape || "star-5", c, 0, 0, r) !== "filled") c.fill(); c.restore();
    c.globalCompositeOperation = "source-over";
    full(ctx, X, L.canvas);
  };

  /* ---------------------------------------------------------------- pixel */

  T.pixel = (ctx, k, o, X) => {
    const g = X.g, swap = k >= 0.5, q = swap ? 1 - (k - 0.5) * 2 : k * 2, pic = swap ? X.picB() : X.picA();
    const size = Math.max(1, 1 + ((o.size ?? 120) - 1) * g.ease.inCubic(q));
    if (size < 1.5) { full(ctx, X, pic); return; }
    const w = Math.max(1, Math.round(X.R.w / size)), h = Math.max(1, Math.round(X.R.h / size));
    const L = g.layer(X.LN("pxs")), c = L.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(pic, 0, 0, w, h);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(L.canvas, 0, 0, w, h, 0, 0, X.R.w, X.R.h); ctx.restore();
  };

  /* ---------------------------------------------------------------- burn */

  T.burn = (ctx, k, o, X) => {
    const g = X.g, swap = k >= 0.5, q = swap ? 1 - (k - 0.5) * 2 : k * 2;
    full(ctx, X, swap ? X.picB() : X.picA());
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = g.ease.inCubic(q); ctx.fillStyle = g.col(o.color || "#ffffff"); ctx.fillRect(0, 0, X.R.w, X.R.h);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = g.ease.inQuad(q) ** 2; ctx.fillRect(0, 0, X.R.w, X.R.h); ctx.restore();
  };
})();
