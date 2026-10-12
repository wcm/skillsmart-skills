/**
 * Greenhouse: twelve pots on a potting bench, each plant as tall as its week's number.
 * The rest pose is the data, a slope rising to the back-right; the pointer is a warm
 * hand over the bench: plants near it grow, the farther the less, each on its own spring.
 *
 * The pattern: a field. A hit test on the bench top (a plane that never moves), a falloff
 * by distance, and a rest that is already a chart.
 */
{ // a block, so several figures can share one page
  const ROWS = ["A", "B", "C"];
  const DATA = [
    [12, 18, 24, 32],
    [9, 15, 21, 27],
    [6, 11, 16, 22],
  ];
  const CELL = 29, TOP = 16, POT = 10, RIM = 2.6, HMAX = 46;
  const BUSH = 0, CACTUS = 1, SAPLING = 2;
  const KIND = [
    [BUSH, CACTUS, SAPLING, BUSH],
    [CACTUS, SAPLING, BUSH, CACTUS],
    [SAPLING, BUSH, CACTUS, SAPLING],
  ];

  // a leaf: a pointed lens in a vertical plane, from (u, v) at an angle, `len` long
  function leaf(u, v, len, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), w = len * 0.36, pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, b = Math.sin(Math.PI * t) * w;
      pts.push([u + c * len * t - s * b, v + s * len * t + c * b]);
    }
    for (let k = 11; k > 0; k--) {
      const t = k / 12, b = Math.sin(Math.PI * t) * w * 0.3;
      pts.push([u + c * len * t + s * b, v + s * len * t - c * b]);
    }
    return pts;
  }

  linework({
    name: "greenhouse",
    title: "Linework · Greenhouse",
    means: "Twelve pots, each plant as tall as its week; the pointer is a warm hand, and plants near it grow.",
    hint: "move over the bench",
    look: "clay",
    inputs: ["pointer"],
    range: [0.8, 1.5, 2.4],
    rangeLabel: "reach",
    zoom: 1.04,
    tour: (s) => [s.at(16 + CELL, 16 + CELL, TOP), s.at(16 + 3 * CELL, 16, TOP), s.at(16 + 2 * CELL, 16 + 2 * CELL, TOP), null],

    draw(s, value) {
      let reach = value;
      const X1 = 4 * CELL + 4, Y1 = 3 * CELL + 4;

      // the bench: four legs, the top, and its slats
      for (const [x, y] of [[4, 4], [X1 - 9, 4], [4, Y1 - 9], [X1 - 9, Y1 - 9]]) s.box({ x, y, z: 0, w: 5, d: 5, h: TOP - 5, r: 1.4, b: 0.6 });
      const bench = s.box({ x: 0, y: 0, z: TOP - 5, w: X1, d: Y1, h: 5, r: 5, b: 1.6 });
      for (let k = 1; k < 6; k++) bench.line({ pts: [[4, (k * Y1) / 6, TOP], [X1 - 4, (k * Y1) / 6, TOP]] }, { cls: "lo" });

      const plants = [];
      DATA.forEach((row, j) => row.forEach((h0, i) => {
        const cx = 16 + i * CELL, cy = 16 + j * CELL, base = TOP + POT + RIM - 0.8, kind = KIND[j][i];
        const g = s.group({ H: h0 }, { pick: ROWS[j] + (i + 1) });
        g.cyl({ cx, cy, z: TOP, R: 6.2, R1: 8.2, h: POT, b: 0 });
        g.cyl({ cx, cy, z: TOP + POT, R: 9.2, h: RIM, b: 1.5, rim: true });

        if (kind === CACTUS) {
          g.cyl((v) => ({ cx, cy, z: base, R: 3.8, h: Math.max(0.5, v.H - 3.8), b: 0, ridges: 14 }));
          g.ball((v) => ({ cx, cy, cz: base + Math.max(0.5, v.H - 3.8), R: 3.8 }));
          // one arm, on the side toward us, once the plant is tall enough to carry it
          g.cyl((v) => ({ axis: "x", cy, cz: base + v.H * 0.42, x: cx + 2, len: 5, R: 2.3, b: 0, hide: v.H < 15 }));
          g.cyl((v) => ({ cx: cx + 7, cy, z: base + v.H * 0.42 - 1, R: 2.3, h: v.H * 0.3, b: 0, ridges: 9, hide: v.H < 15 }));
          g.ball((v) => ({ cx: cx + 7, cy, cz: base + v.H * 0.72 - 1, R: 2.3, hide: v.H < 15 }));
        } else if (kind === SAPLING) {
          g.shape((v) => ({ plane: "y", at: cy, pts: leaf(cx, base + v.H * 0.3, 4 + v.H * 0.15, Math.PI * 0.8) }), { cls: "edge" });
          g.shape((v) => ({ plane: "x", at: cx, pts: leaf(cy, base + v.H * 0.62, 3.5 + v.H * 0.12, Math.PI * 0.84) }), { cls: "edge" });
          g.line((v) => ({ pts: [[cx, cy, base - 1], [cx, cy, base + v.H]] }), { cls: "edge" });
          g.shape((v) => ({ plane: "x", at: cx, pts: leaf(cy, base + v.H * 0.18, 4 + v.H * 0.16, Math.PI * 0.16) }), { cls: "edge" });
          g.shape((v) => ({ plane: "y", at: cy, pts: leaf(cx, base + v.H * 0.5, 3.5 + v.H * 0.13, Math.PI * 0.2) }), { cls: "edge" });
          g.ball((v) => ({ cx, cy, cz: base + v.H + 1.6, R: 2.4 }));
        } else {
          g.line((v) => ({ pts: [[cx, cy, base - 1], [cx, cy, base + v.H]] }), { cls: "edge" });
          // three balls: two side by side across the screen, one on top
          const ex = 0.707, ey = -0.707;
          for (const side of [-1, 1]) g.ball((v) => {
            const r = 3.6 + v.H * 0.06;
            return { cx: cx + side * ex * r * 0.62, cy: cy + side * ey * r * 0.62, cz: base + v.H, R: r * 0.82 };
          });
          g.ball((v) => {
            const r = 3.6 + v.H * 0.06;
            return { cx, cy, cz: base + v.H + r * 0.85, R: r };
          });
        }
        plants.push({ g, cx, cy, h0 });
      }));
      s.extent([[16, 16, TOP + POT + HMAX + 18], [16 + 3 * CELL, 16, TOP + POT + HMAX + 18]]);

      const tallest = plants.reduce((a, b) => (b.h0 > a.h0 ? b : a));
      const height = (q, d) => q.h0 + (HMAX - q.h0) * LW.falloff(d / (reach * CELL));

      return (input, v) => {
        reach = v;
        const p = input.at ? s.ground(input.at, TOP) : null;
        const on = p && p[0] > -4 && p[0] < X1 + 4 && p[1] > -4 && p[1] < Y1 + 4;
        if (!on) {
          for (const q of plants) q.g.to({ H: q.h0 });
          s.accent(tallest.g);
          return "rest";
        }
        let near = null, best = Infinity;
        for (const q of plants) {
          const d = Math.hypot(q.cx - p[0], q.cy - p[1]);
          if (d < best) { best = d; near = q; }
          q.g.to({ H: height(q, d) });
        }
        s.accent(near.g);
        return `${near.g.pick} · ${Math.round(height(near, best))}cm`;
      };
    },
  });
}
