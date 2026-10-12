/*
 * Linework systems: "draw my system". Describe the nodes of a stack on a grid and the links
 * between them, and get an isometric diagram with correct labels: packets travel the links,
 * hovering lifts a node, clicking a layered node takes it apart, the page can build it step by
 * step (scroll) and send a traced packet through it. Every look works.
 *
 *   linework(LW.system({
 *     name, means, look, camera,
 *     nodes: [{ id, kind, at: [gx, gy], label, sub, step, platform, ...kind options }],
 *     links: [{ from, to, via: "x" | "y" | [[gx, gy], …], packets, speed, step }],
 *     rest: "id",                        // what is lit when nothing else is
 *     draw(s, ctx) {},                   // optional: more parts
 *     answer(input, ctx) {},             // optional: page actions; return a read-out to override
 *   }))
 */
(() => {
  const G = 40; // one grid cell, in world units
  const DROP = 34; // how far a node falls in from when it appears
  const PLATE = 2.4; // a platform's height

  const css = document.createElement("style");
  css.textContent = `.lw-g.hot .lw-o{stroke:var(--lw-accent)}.lw-g.hot .lw-t,.lw-g.hot .lw-f{fill:var(--lw-accent)}.lw-g.hot .lw-sh{fill:var(--lw-accent)}`;
  document.head.appendChild(css);

  /* ------------------------------------------------------------------ the kit */
  // Each kind adds its parts to a node's group, as functions of the group's numbers, and returns
  // its height (a function of them too) and its footprint radius. b(v) is the base height.
  const KIT = {
    server(g, cx, cy, b, o) {
      const w = o.w || 22, d = o.d || 22, h = o.h || 34, n = o.units || 4, x0 = cx - w / 2, y0 = cy - d / 2;
      g.box((v) => ({ x: x0, y: y0, z: b(v), w, d, h, r: 2.5, b: 1.2 }));
      const u = (h - 6) / n;
      for (let k = 0; k < n; k++) {
        g.patch((v) => ({ plane: "y", at: y0 + d, u0: x0 + 3, u1: x0 + w - 3, v0: b(v) + 3 + k * u, v1: b(v) + 3 + k * u + u - 2.2, r: 0.8 }), { cls: "lo" });
        g.dot((v) => ({ plane: "y", at: y0 + d, cu: x0 + w - 5.5, cv: b(v) + 3 + k * u + (u - 2.2) / 2, r: 0.8 }), { cls: k % 2 ? "off" : "on" });
      }
      for (let k = 0; k < 3; k++) g.line((v) => ({ pts: [[x0 + w, y0 + 5, b(v) + h - 6 - k * 3], [x0 + w, y0 + d - 5, b(v) + h - 6 - k * 3]] }), { cls: "lo" });
      return { top: () => h, r: 15 };
    },
    database(g, cx, cy, b, o) {
      const R = o.R || 11, n = o.disks || 3, dh = o.dh || 7;
      for (let k = 0; k < n; k++) g.cyl((v) => ({ cx, cy, z: b(v) + k * (dh + (v.gap ?? 1.4)), R, h: dh, b: 1.1 }));
      return { top: (v) => n * dh + (n - 1) * (v.gap ?? 1.4), r: R + 2, gap: 1.4, open: 7 };
    },
    queue(g, cx, cy, b, o) {
      const L = o.len || 34, W = 13, h = 7, x0 = cx - L / 2, y0 = cy - W / 2;
      g.box((v) => ({ x: x0, y: y0, z: b(v), w: L, d: W, h, r: W / 2 - 0.5, b: 1 }));
      for (let k = 1; k < 6; k++) g.line((v) => ({ pts: [[x0 + (k * L) / 6, y0 + 2.5, b(v) + h], [x0 + (k * L) / 6, y0 + W - 2.5, b(v) + h]] }), { cls: "lo" });
      // messages ride the belt: flat cards on its top, moved by the figure's clock
      for (let k = 0; k < 4; k++) g.patch((v) => {
        const t = ((v.belt || 0) + k / 4) % 1, x = x0 + 4 + t * (L - 13);
        return { plane: "z", at: b(v) + h, u0: x, u1: x + 5, v0: y0 + 3.2, v1: y0 + W - 3.2, r: 0.8 };
      }, { cls: "edge" });
      return { top: () => h, r: L / 2, belt: true };
    },
    gateway(g, cx, cy, b, o, sc, back) {
      const h = o.h || 28, s = 13;
      back.box((v) => ({ x: cx - 7, y: cy - s - 3, z: b(v), w: 14, d: 6, h, r: 1.8, b: 0.9 }));
      g.box((v) => ({ x: cx - 7, y: cy + s - 3, z: b(v), w: 14, d: 6, h, r: 1.8, b: 0.9 }));
      g.box((v) => ({ x: cx - 8, y: cy - s - 4, z: b(v) + h, w: 16, d: 2 * s + 8, h: 6, r: 2, b: 1 }));
      g.patch((v) => ({ plane: "x", at: cx + 8, u0: cy - 6, u1: cy + 6, v0: b(v) + h + 1.6, v1: b(v) + h + 4.4, r: 0.6 }), { cls: "lo" });
      return { top: () => h + 6, r: 9, pass: true };
    },
    stack(g, cx, cy, b, o) {
      const n = (o.layers || []).length || 3, w = o.w || 26, th = o.th || 5;
      for (let k = 0; k < n; k++) {
        g.box((v) => ({ x: cx - w / 2, y: cy - w / 2, z: b(v) + k * (th + (v.gap ?? 1)), w, d: w, h: th, r: 3, b: 1.1 }));
        if (o.layers && o.layers[k]) g.label((v) => ({ at: [cx + w / 2, cy, b(v) + k * (th + (v.gap ?? 1)) + th / 2], dx: o.layerDx ?? 22, dy: 0, text: o.layers[k], hide: (v.gap ?? 1) < 5 || v.on < 0.9 }));
      }
      return { top: (v) => n * th + (n - 1) * (v.gap ?? 1), r: w / 2 + 2, gap: 1, open: 10 };
    },
    laptop(g, cx, cy, b) {
      g.box((v) => ({ x: cx - 12, y: cy - 7, z: b(v), w: 24, d: 16, h: 1.8, r: 1.6, b: 0.7 }));
      g.patch((v) => ({ plane: "z", at: b(v) + 1.8, u0: cx - 9.5, u1: cx + 9.5, v0: cy - 3.5, v1: cy + 4.5, r: 0.8 }), { cls: "lo" });
      g.box((v) => ({ x: cx - 12, y: cy - 8.4, z: b(v) + 1.2, w: 24, d: 1.4, h: 16, r: 1.2, b: 0.5 }));
      g.patch((v) => ({ plane: "y", at: cy - 7, u0: cx - 10, u1: cx + 10, v0: b(v) + 3.4, v1: b(v) + 15, r: 0.8 }), { cls: "lo" });
      g.line((v) => ({ pts: [[cx - 8, cy - 7, b(v) + 6], [cx - 4, cy - 7, b(v) + 9], [cx, cy - 7, b(v) + 7.5], [cx + 4, cy - 7, b(v) + 12], [cx + 8, cy - 7, b(v) + 11]] }), { cls: "edge" });
      return { top: () => 17, r: 13 };
    },
    phone(g, cx, cy, b) {
      g.box((v) => ({ x: cx - 7, y: cy - 4, z: b(v), w: 14, d: 8, h: 2.2, r: 2, b: 0.7 }));
      g.box((v) => ({ x: cx - 5.5, y: cy - 1.5, z: b(v) + 2.2, w: 11, d: 1.6, h: 20, r: 1.8, b: 0.5 }));
      g.patch((v) => ({ plane: "y", at: cy + 0.1, u0: cx - 4, u1: cx + 4, v0: b(v) + 4.6, v1: b(v) + 19.6, r: 1 }), { cls: "lo" });
      g.dot((v) => ({ plane: "y", at: cy + 0.1, cu: cx, cv: b(v) + 3.4, r: 0.6 }));
      return { top: () => 22.2, r: 9 };
    },
    screen(g, cx, cy, b, o) {
      const bars = o.bars || [0.4, 0.65, 0.5, 0.85, 0.7];
      g.cyl((v) => ({ cx, cy: cy + 2, z: b(v), R: 6, h: 1.2, b: 0 }));
      g.cyl((v) => ({ cx, cy: cy + 2, z: b(v) + 1.2, R: 1.4, h: 8, b: 0 }));
      g.box((v) => ({ x: cx - 15, y: cy, z: b(v) + 7, w: 30, d: 1.6, h: 19, r: 1.4, b: 0.5 }));
      bars.forEach((t, k) => g.patch((v) => ({ plane: "y", at: cy + 1.6, u0: cx - 12 + k * 5, u1: cx - 12 + k * 5 + 3.2, v0: b(v) + 9.5, v1: b(v) + 9.5 + t * (v.k ?? 1) * 13, r: 0.5 }), { cls: "edge" }));
      return { top: () => 26, r: 15 };
    },
    cache(g, cx, cy, b, o) {
      const R = o.R || 8;
      for (let k = 0; k < 2; k++) g.cyl((v) => ({ cx, cy, z: b(v) + k * 6.5, R, h: 5, b: 0.9 }));
      g.shape((v) => ({ plane: "y", at: cy + R, pts: [[cx - 1, b(v) + 1.2], [cx + 2.2, b(v) + 5.8], [cx + 0.2, b(v) + 5.8], [cx + 1.2, b(v) + 10.4], [cx - 2.2, b(v) + 5], [cx - 0.2, b(v) + 5]] }), { cls: "edge" });
      return { top: () => 11.5, r: R + 2 };
    },
    lake(g, cx, cy, b, o) {
      const w = o.w || 30, d = o.d || 24, h = 9;
      g.box((v) => ({ x: cx - w / 2, y: cy - d / 2, z: b(v), w, d, h, r: 4, b: 1.4, tray: true }));
      g.patch((v) => ({ plane: "z", at: b(v) + h - 1, u0: cx - w / 2 + 3, u1: cx + w / 2 - 3, v0: cy - d / 2 + 3, v1: cy + d / 2 - 3, r: 3 }), { cls: "lo" });
      for (const [r, a] of [[5, 0], [8.5, 0]]) g.arc((v) => ({ plane: "z", at: b(v) + h - 1, cu: cx + 3, cv: cy - 1, R: r, a0: 200 + a, a1: 300 }), { cls: "lo" });
      return { top: () => h, r: w / 2 };
    },
    vault(g, cx, cy, b, o) {
      const w = o.w || 24, h = o.h || 24, f = cy + w / 2;
      g.box((v) => ({ x: cx - w / 2, y: cy - w / 2, z: b(v), w, d: w, h, r: 3, b: 1.2 }));
      g.arc((v) => ({ plane: "y", at: f, cu: cx, cv: b(v) + h / 2, R: 7.5 }), { cls: "edge" });
      g.arc((v) => ({ plane: "y", at: f, cu: cx, cv: b(v) + h / 2, R: 5.2 }), { cls: "lo" });
      for (let k = 0; k < 3; k++) {
        const a = (k * 120 * Math.PI) / 180;
        g.line((v) => {
          const t = a + (v.spin || 0);
          return { pts: [[cx, f, b(v) + h / 2], [cx + Math.cos(t) * 4.6, f, b(v) + h / 2 + Math.sin(t) * 4.6]] };
        }, { cls: "edge" });
      }
      g.patch((v) => ({ plane: "y", at: f, u0: cx - w / 2 + 1.6, u1: cx - w / 2 + 3.4, v0: b(v) + 5, v1: b(v) + 9, r: 0.5 }), { cls: "lo" });
      g.patch((v) => ({ plane: "y", at: f, u0: cx - w / 2 + 1.6, u1: cx - w / 2 + 3.4, v0: b(v) + h - 9, v1: b(v) + h - 5, r: 0.5 }), { cls: "lo" });
      return { top: () => h, r: w / 2 + 2 };
    },
    person(g, cx, cy, b) {
      g.cyl((v) => ({ cx, cy, z: b(v), R: 4.8, R1: 3.6, h: 11, b: 0 }));
      g.ball((v) => ({ cx, cy, cz: b(v) + 14.6, R: 3.6 }));
      return { top: () => 18.4, r: 6 };
    },
    block(g, cx, cy, b, o) {
      const w = o.w || 24, h = o.h || 9;
      g.box((v) => ({ x: cx - w / 2, y: cy - w / 2, z: b(v), w, d: w, h, r: 3, b: 1.2 }));
      for (let k = 1; k < 4; k++) g.line((v) => ({ pts: [[cx + w / 2, cy - w / 2 + 4, b(v) + (k * h) / 4], [cx + w / 2, cy + w / 2 - 4, b(v) + (k * h) / 4]] }), { cls: "lo" });
      g.patch((v) => ({ plane: "z", at: b(v) + h, u0: cx - w / 2 + 4, u1: cx + 2, v0: cy - w / 2 + 4, v1: cy - w / 2 + 7, r: 0.6 }), { cls: "lo" });
      g.patch((v) => ({ plane: "z", at: b(v) + h, u0: cx - w / 2 + 4, u1: cx + w / 2 - 6, v0: cy - w / 2 + 9, v1: cy - w / 2 + 12, r: 0.6 }), { cls: "lo" });
      g.dot((v) => ({ plane: "y", at: cy + w / 2, cu: cx, cv: b(v) + h / 2, r: 2.6 }), { cls: (v) => (v.seal ? "on" : "off") });
      return { top: () => h, r: w / 2 + 1 };
    },
    globe(g, cx, cy, b, o, s) {
      const R = o.R || 11, D = s.V.D;
      const half = (nx, ny) => { // the arc of a great circle that faces the viewer
        const a = Math.atan2(-(nx * D[0] + ny * D[1]), D[2]) * 180 / Math.PI;
        return [a, a + 180];
      };
      g.ball((v) => ({ cx, cy, cz: b(v) + R, R, eq: true }));
      const [a0, a1] = half(1, 0), [c0, c1] = half(0, 1);
      g.arc((v) => ({ plane: "y", at: cy, cu: cx, cv: b(v) + R, R, a0, a1 }), { cls: "lo" });
      g.arc((v) => ({ plane: "x", at: cx, cu: cy, cv: b(v) + R, R, a0: c0, a1: c1 }), { cls: "lo" });
      return { top: () => 2 * R, r: R + 1 };
    },
    chip(g, cx, cy, b) {
      g.box((v) => ({ x: cx - 13, y: cy - 13, z: b(v), w: 26, d: 26, h: 2, r: 2, b: 0.8 }));
      for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
        const o = -6 + k * 4;
        g.line((v) => ({ pts: [[cx + o, cy + side * 7.5, b(v) + 2], [cx + o, cy + side * 11, b(v) + 2]] }), { cls: "lo" });
        g.line((v) => ({ pts: [[cx + side * 7.5, cy + o, b(v) + 2], [cx + side * 11, cy + o, b(v) + 2]] }), { cls: "lo" });
      }
      g.box((v) => ({ x: cx - 7, y: cy - 7, z: b(v) + 2, w: 14, d: 14, h: 4, r: 1.6, b: 0.8 }));
      g.dot((v) => ({ plane: "z", at: b(v) + 6, cu: cx - 4, cv: cy - 4, r: 0.9 }));
      return { top: () => 6, r: 14 };
    },
    function(g, cx, cy, b) {
      g.box((v) => ({ x: cx - 8, y: cy - 8, z: b(v), w: 16, d: 16, h: 16, r: 3, b: 1 }));
      g.line((v) => ({ pts: [[cx - 4, cy + 8, b(v) + 11], [cx - 0.5, cy + 8, b(v) + 8], [cx - 4, cy + 8, b(v) + 5]] }), { cls: "edge" });
      g.line((v) => ({ pts: [[cx + 1, cy + 8, b(v) + 5], [cx + 4.5, cy + 8, b(v) + 5]] }), { cls: "edge" });
      return { top: () => 16, r: 10 };
    },
  };

  // logistics: a shelving rack, a sorter arch over a belt, a box truck, a van, a house, a hub shed
  Object.assign(KIT, {
    rack(g, cx, cy, b, o) {
      const w = o.w || 28, d = o.d || 12, x0 = cx - w / 2, y0 = cy - d / 2, H = 33, levels = [0, 11, 22];
      const BOX = o.boxes || [[[2, 7, 6], [10, 8, 8], [20, 6, 5]], [[3, 9, 7], [14, 6, 6]], [[2, 6, 5], [9, 9, 8], [19, 7, 6]]];
      const post = (x, y) => g.box((v) => ({ x, y, z: b(v), w: 1.8, d: 1.8, h: H, r: 0.5, b: 0 }));
      post(x0, y0); post(x0 + w - 1.8, y0);
      levels.forEach((z, k) => {
        g.box((v) => ({ x: x0, y: y0, z: b(v) + z + 2, w, d, h: 1.2, r: 0.8, b: 0.4 }));
        for (const [u, bw, bh] of BOX[k] || []) {
          g.box((v) => ({ x: x0 + u, y: y0 + 2, z: b(v) + z + 3.2, w: bw, d: d - 4, h: bh, r: 0.6, b: 0 }));
          g.line((v) => ({ pts: [[x0 + u + bw / 2, y0 + 2, b(v) + z + 3.2 + bh], [x0 + u + bw / 2, y0 + d - 2, b(v) + z + 3.2 + bh], [x0 + u + bw / 2, y0 + d - 2, b(v) + z + 3.2 + bh * 0.45]] }), { cls: "lo" });
        }
      });
      post(x0, y0 + d - 1.8); post(x0 + w - 1.8, y0 + d - 1.8);
      return { top: () => H, r: 12 };
    },
    scanner(g, cx, cy, b, o, sc, back) {
      const s2 = o.span || 10, h = o.h || 24;
      back.box((v) => ({ x: cx - 4, y: cy - s2 - 4, z: b(v), w: 8, d: 4, h, r: 1.2, b: 0.6 }));
      back.patch((v) => ({ plane: "x", at: cx, u0: cy - s2 + 0.5, u1: cy + s2 - 0.5, v0: b(v) + 7, v1: b(v) + h - 0.5, r: 0.5 }), { cls: "lo nf" });
      g.box((v) => ({ x: cx - 4, y: cy + s2, z: b(v), w: 8, d: 4, h, r: 1.2, b: 0.6 }));
      g.box((v) => ({ x: cx - 5, y: cy - s2 - 5, z: b(v) + h, w: 10, d: 2 * s2 + 10, h: 5, r: 1.6, b: 0.8 }));
      g.dot((v) => ({ plane: "x", at: cx + 5, cu: cy + s2 + 1, cv: b(v) + h + 2.5, r: 0.9 }), { cls: "on" });
      return { top: () => h + 5, r: 5, pass: true };
    },
    truck(g, cx, cy, b) {
      const W = 15, x0 = cx - 17;
      const wheel = (x, y) => g.cyl((v) => ({ axis: "y", cx: x, cz: b(v) + 4, y, len: 2.6, R: 4, b: 0.8, hole: 1.5 }));
      wheel(x0 + 7, cy - W / 2 - 2.6); wheel(x0 + 28, cy - W / 2 - 2.6);
      g.box((v) => ({ x: x0, y: cy - W / 2, z: b(v) + 3, w: 34, d: W, h: 2.5, r: 1, b: 0.5 }));
      g.box((v) => ({ x: x0, y: cy - W / 2, z: b(v) + 5.5, w: 23, d: W, h: 19, r: 2, b: 1 }));
      g.line((v) => ({ pts: [[x0 + 2.5, cy + W / 2, b(v) + 12], [x0 + 20.5, cy + W / 2, b(v) + 12]] }), { cls: "lo" });
      g.box((v) => ({ x: x0 + 24, y: cy - W / 2 + 0.5, z: b(v) + 5.5, w: 10, d: W - 1, h: 13, r: 2.5, b: 0.8 }));
      g.patch((v) => ({ plane: "x", at: x0 + 34, u0: cy - W / 2 + 2, u1: cy + W / 2 - 2.5, v0: b(v) + 12, v1: b(v) + 17.5, r: 1 }), { cls: "hole" });
      g.patch((v) => ({ plane: "y", at: cy + W / 2 - 0.5, u0: x0 + 27, u1: x0 + 32, v0: b(v) + 12, v1: b(v) + 17, r: 0.8 }), { cls: "hole" });
      wheel(x0 + 7, cy + W / 2); wheel(x0 + 28, cy + W / 2);
      return { top: () => 24.5, r: 19 };
    },
    van(g, cx, cy, b) {
      const W = 12, x0 = cx - 12;
      const wheel = (x, y) => g.cyl((v) => ({ axis: "y", cx: x, cz: b(v) + 3.2, y, len: 2.2, R: 3.2, b: 0.7, hole: 1.2 }));
      wheel(x0 + 5, cy - W / 2 - 2.2); wheel(x0 + 19, cy - W / 2 - 2.2);
      g.box((v) => ({ x: x0, y: cy - W / 2, z: b(v) + 2.5, w: 17, d: W, h: 14, r: 3, b: 1 }));
      g.box((v) => ({ x: x0 + 16, y: cy - W / 2 + 0.5, z: b(v) + 2.5, w: 7, d: W - 1, h: 7, r: 2.2, b: 0.7 }));
      g.patch((v) => ({ plane: "x", at: x0 + 17, u0: cy - W / 2 + 1.5, u1: cy + W / 2 - 1.5, v0: b(v) + 10.5, v1: b(v) + 15, r: 1 }), { cls: "hole" });
      g.patch((v) => ({ plane: "y", at: cy + W / 2, u0: x0 + 11.5, u1: x0 + 15.5, v0: b(v) + 10, v1: b(v) + 14.5, r: 0.8 }), { cls: "hole" });
      g.line((v) => ({ pts: [[x0 + 9, cy + W / 2, b(v) + 3.5], [x0 + 9, cy + W / 2, b(v) + 15]] }), { cls: "lo" });
      wheel(x0 + 5, cy + W / 2); wheel(x0 + 19, cy + W / 2);
      return { top: () => 16.5, r: 13 };
    },
    house(g, cx, cy, b) {
      const w = 24, d = 20, h = 15, x0 = cx - w / 2, y0 = cy - d / 2;
      g.box((v) => ({ x: x0, y: y0, z: b(v), w, d, h, r: 1.5, b: 0.8 }));
      g.patch((v) => ({ plane: "y", at: y0 + d, u0: cx, u1: cx + 5.5, v0: b(v), v1: b(v) + 9.5, r: 0.6 }), { cls: "edge" });
      g.dot((v) => ({ plane: "y", at: y0 + d, cu: cx + 4.4, cv: b(v) + 4.8, r: 0.45 }), { cls: "on" });
      g.patch((v) => ({ plane: "y", at: y0 + d, u0: x0 + 3, u1: x0 + 9, v0: b(v) + 6, v1: b(v) + 11, r: 0.6 }), { cls: "hole" });
      g.patch((v) => ({ plane: "x", at: x0 + w, u0: y0 + 3.5, u1: y0 + 8.5, v0: b(v) + 6, v1: b(v) + 11, r: 0.6 }), { cls: "hole" });
      g.patch((v) => ({ plane: "x", at: x0 + w, u0: y0 + 11.5, u1: y0 + 16.5, v0: b(v) + 6, v1: b(v) + 11, r: 0.6 }), { cls: "hole" });
      g.box((v) => ({ x: x0 - 2, y: y0 - 2, z: b(v) + h, w: w + 4, d: d + 4, h: 10, r: 1.5, b: 0.8, taper: 9.5 }));
      return { top: () => h + 10, r: 13 };
    },
    shed(g, cx, cy, b) {
      const w = 36, d = 26, h = 16, x0 = cx - w / 2, y0 = cy - d / 2;
      g.box((v) => ({ x: x0, y: y0, z: b(v), w, d, h, r: 1.5, b: 0.8 }));
      for (const u of [x0 + 4, x0 + 20]) {
        g.patch((v) => ({ plane: "y", at: y0 + d, u0: u, u1: u + 12, v0: b(v), v1: b(v) + 11, r: 0.5 }), { cls: "edge" });
        for (let k = 1; k < 4; k++) g.line((v) => ({ pts: [[u + 1, y0 + d, b(v) + k * 2.6], [u + 11, y0 + d, b(v) + k * 2.6]] }), { cls: "lo" });
      }
      g.box((v) => ({ x: x0 - 1.5, y: y0 - 1.5, z: b(v) + h, w: w + 3, d: d + 3, h: 6, r: 1.5, b: 0.8, taper: 5 }));
      return { top: () => h + 6, r: 18 };
    },
  });

  /* ----------------------------------------------------------------- routes */
  const along = (pts, t) => {
    let L = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(d); L += d; }
    let at = Math.max(0, Math.min(1, t)) * L;
    for (let i = 0; i < seg.length; i++) {
      if (at <= seg[i] || i === seg.length - 1) {
        const k = seg[i] ? Math.min(1, at / seg[i]) : 0, a = pts[i], b = pts[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, i, k];
      }
      at -= seg[i];
    }
    return pts[pts.length - 1].concat([seg.length - 1, 1]);
  };
  const length = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);
  // the part of a route from 0 to t, for a link that draws itself in
  const upto = (pts, t) => {
    if (t >= 0.999) return pts;
    const e = along(pts, t);
    return pts.slice(0, e[3] + 1).concat([[e[0], e[1], e[2]]]);
  };

  /* ----------------------------------------------------------------- system */
  LW.kit = KIT;
  LW.system = (spec) => {
    const fig = Object.assign({ inputs: ["pointer", "click"], range: [0.5, 1, 1.6], rangeLabel: "flow", frame: [262, 196] }, spec);
    fig.draw = (s, value) => {
      let flow = value;
      const Z = 1.2; // links ride just above the ground
      const ctx = { s, nodes: {}, list: [], links: [], G, along, packets: [] };
      s.system = ctx; // for the console and the check script

      // links first: they lie on the ground under everything
      (spec.links || []).forEach((l, i) => {
        const A = spec.nodes.find((n) => n.id === l.from), B = spec.nodes.find((n) => n.id === l.to);
        const a = [A.at[0] * G, A.at[1] * G], b = [B.at[0] * G, B.at[1] * G];
        let pts;
        if (Array.isArray(l.via)) pts = [a].concat(l.via.map((p) => [p[0] * G, p[1] * G]), [b]);
        else if (a[0] === b[0] || a[1] === b[1]) pts = [a, b];
        else pts = l.via === "y" ? [a, [a[0], b[1]], b] : [a, [b[0], a[1]], b];
        pts = pts.map((p) => [p[0], p[1], Z]);
        // trim: [start, end] in world units, so a belt can begin at a rack's front instead of under it
        if (l.trim) {
          const L = length(pts), a = along(pts, (l.trim[0] || 0) / L), b = along(pts, 1 - (l.trim[1] || 0) / L);
          pts = [[a[0], a[1], Z]].concat(pts.slice(a[3] + 1, b[3] + 1), [[b[0], b[1], Z]]);
        }
        const g = s.group({ on: 1 }, { order: -1e5 + i });
        const style = l.style || "tube", BELT = 5, pz = style === "belt" ? BELT + 0.1 : style === "road" ? 0.4 : Z + 0.6;
        if (style === "tube") g.line((v) => (v.on < 0.01 ? { hide: true } : { pts: upto(pts, v.on) }), { tube: true });
        else for (let k = 1; k < pts.length; k++) {
          // a road is a flat band with a dashed centre line; a belt is a raised band with rollers
          const p = pts[k - 1], q = pts[k], W = l.width || (style === "belt" ? 11 : 13), alongX = p[1] === q[1];
          const x0 = Math.min(p[0], q[0]) - (alongX ? (k > 1 ? W / 2 : 0) : W / 2), x1 = Math.max(p[0], q[0]) + (alongX ? (k < pts.length - 1 ? W / 2 : 0) : W / 2);
          const y0 = Math.min(p[1], q[1]) - (alongX ? W / 2 : k > 1 ? W / 2 : 0), y1 = Math.max(p[1], q[1]) + (alongX ? W / 2 : k < pts.length - 1 ? W / 2 : 0);
          if (style === "road") {
            g.patch((v) => (v.on < 0.5 ? { hide: true } : { plane: "z", at: 0.2, u0: x0, u1: x1, v0: y0, v1: y1, r: 2 }), { cls: "lo" });
            g.line((v) => (v.on < 0.5 ? { hide: true } : { pts: [[p[0], p[1], 0.3], [q[0], q[1], 0.3]] }), { cls: "lo dash" });
          } else {
            g.box((v) => (v.on < 0.5 ? { hide: true } : { x: x0, y: y0, z: 0, w: x1 - x0, d: y1 - y0, h: BELT, r: 2.5, b: 1 }));
            const L = alongX ? x1 - x0 : y1 - y0;
            for (let r = 4; r < L - 2; r += 6) g.line((v) => (v.on < 0.5 ? { hide: true } : { pts: alongX ? [[x0 + r, y0 + 2, BELT], [x0 + r, y1 - 2, BELT]] : [[x0 + 2, y0 + r, BELT], [x1 - 2, y0 + r, BELT]] }), { cls: "lo" });
          }
        }
        const link = { ...l, i, g, pts, len: length(pts), A, B, packets: [], pz, half: l.parcel ? 3 : 1.8, ph: l.parcel ? 4.6 : 2.6, raised: style === "belt" };
        // a belt stands up: it hides what is behind it and carries what is on it, so it is an occluder
        if (link.raised) s.occluder(g);
        const n = l.packets ?? (style === "tube" ? 2 : 0);
        for (let k = 0; k < n; k++) {
          const pg = s.group({ t: k / n, show: 1 });
          pg.box((v) => {
            if (v.show < 0.5) return { hide: true };
            const p = along(pts, v.t);
            return l.parcel ? { x: p[0] - 3, y: p[1] - 3, z: pz, w: 6, d: 6, h: 4.6, r: 0.6, b: 0 } : { x: p[0] - 1.8, y: p[1] - 1.8, z: pz, w: 3.6, h: 2.6, d: 3.6, r: 0.9, b: 0.6 };
          });
          if (l.parcel) pg.line((v) => {
            if (v.show < 0.5) return { hide: true };
            const p = along(pts, v.t);
            return { pts: [[p[0], p[1] - 3, pz + 4.6], [p[0], p[1] + 3, pz + 4.6], [p[0], p[1] + 3, pz + 2]] };
          }, { cls: "lo" });
          link.packets.push(pg);
        }
        ctx.links.push(link);
      });

      // nodes
      spec.nodes.forEach((n, i) => {
        const cx = n.at[0] * G, cy = n.at[1] * G;
        // paint order: the platform, then what stands behind a way through (an arch's far pillar), then the node
        const depth = s.V.depth(cx, cy, 0);
        const g = s.group({ on: 1, lift: 0, gap: 0, belt: 0, spin: 0, seal: 0, k: 1, tx: 0, ty: 0 }, { pick: n.id, order: depth });
        const back = s.group({}, { lead: g, order: depth - 0.6 });
        const base = (v) => (n.platform ? PLATE : 0) + (v.lift || 0) + (1 - v.on) * DROP;
        if (n.platform) s.occluder(s.group({}, { lead: g, order: depth - 1.2 }).cyl((v) => (v.on < 0.02 ? { hide: true } : { cx, cy, z: (1 - v.on) * DROP, R: n.platform === true ? 17 : n.platform, h: PLATE, b: 0.8 })));
        // every part hides while the node is off
        const hides = (grp) => {
          const px = new Proxy(grp, {
            get(t, k) {
              const f = t[k];
              if (typeof f !== "function" || !["box", "cyl", "ball", "line", "dot", "patch", "arc", "shape", "label"].includes(k)) return typeof f === "function" ? f.bind(t) : f;
              return (def, opt) => { f.call(t, typeof def === "function" ? (v, sc) => (v.on < 0.02 ? { hide: true } : def(v, sc)) : def, opt); return px; };
            },
          });
          return px;
        };
        const proxy = hides(g);
        const kind = KIT[n.kind];
        if (!kind) throw new Error(`linework system: no kind "${n.kind}" (kinds: ${Object.keys(KIT).join(", ")})`);
        const k = kind(proxy, cx, cy, base, n, s, hides(back));
        s.occluder(back);
        s.occluder(g, { pass: !!k.pass });
        if (k.gap != null) g.set({ gap: k.gap });
        const node = { ...n, i, g, cx, cy, top: k.top, r: k.r, belt: k.belt, explode: k.open != null ? [k.gap, k.open] : null, open: false };
        if (n.label) g.label((v) => (v.on < 0.9 ? { hide: true } : { at: [cx, cy, base(v) + k.top(v)], dx: n.dx ?? 0, dy: n.dy ?? -16, text: n.label, sub: n.sub }));
        ctx.nodes[n.id] = node;
        ctx.list.push(node);
      });
      s.extent(ctx.list.map((n) => [n.cx, n.cy, (n.platform ? PLATE : 0) + 6 + n.top({ gap: n.explode ? n.explode[1] : 0, k: 1, on: 1 })]));

      // the clock: packets along live links, belts on queues, and a traced packet when one is sent
      let trace = null;
      const hot = s.group({ show: 0, x: 0, y: 0, z: 0 });
      hot.box((v) => (v.show < 0.5 ? { hide: true } : { x: v.x - 2.6, y: v.y - 2.6, z: v.z, w: 5.2, d: 5.2, h: 3.6, r: 1.2, b: 0.8 }));
      hot.el.classList.add("hot");
      s.loop((dt, now) => {
        for (const l of ctx.links) {
          const live = l.g.v.on > 0.999 && l.flowing !== false;
          for (const p of l.packets) {
            const t = (p.v.t + (dt * 34 * flow * (l.speed || 1)) / l.len) % 1, q = along(l.pts, t);
            const o = s.orderFor([q[0] - l.half, q[1] - l.half, l.pz, q[0] + l.half, q[1] + l.half, l.pz + l.ph]);
            p.set({ t, show: live && !o.hidden ? 1 : 0 });
            p.order = o.order;
          }
        }
        for (const n of ctx.list) if (n.belt && n.g.v.on > 0.5) n.g.set({ belt: (n.g.v.belt + dt * 0.18 * flow) % 1 });
        if (trace) {
          const T = trace;
          if (T.wait > 0) { T.wait -= dt * 1000; return; }
          T.t = Math.min(1, T.t + (dt * 60 * (T.speed || 1)) / T.len);
          const q = along(T.pts, T.t);
          const o = s.orderFor([q[0] - 2.6, q[1] - 2.6, Z + 0.6, q[0] + 2.6, q[1] + 2.6, Z + 4.2]);
          hot.set({ show: o.hidden ? 0 : 1, x: q[0], y: q[1], z: Z + 0.6 });
          hot.order = o.order;
          if (T.t >= 1) {
            const at = T.path[T.hop + 1];
            T.hop++;
            const go = T.onhop ? T.onhop(T.hop, ctx.nodes[at]) : true;
            if (go === false || T.hop >= T.path.length - 1) { trace = null; setTimeout(() => hot.set({ show: 0 }), 500); T.ondone && T.ondone(go !== false); return; }
            T.pts = ctx.route(T.path[T.hop], T.path[T.hop + 1]);
            T.len = length(T.pts);
            T.t = 0;
            T.wait = T.dwell ?? 260;
          }
        }
      });

      /** The ground route between two nodes: their link's, either way round. */
      ctx.route = (a, b) => {
        const l = ctx.links.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
        if (l) return l.from === a ? l.pts : l.pts.slice().reverse();
        const A = ctx.nodes[a], B = ctx.nodes[b];
        return [[A.cx, A.cy, Z], [B.cx, B.cy, Z]];
      };
      /** Sends one lit packet along a path of node ids; onhop(i, node) runs on each arrival, and returning false stops it there. */
      ctx.trace = (path, o) => {
        trace = Object.assign({ path, hop: 0, t: 0, wait: 0 }, o || {});
        trace.pts = ctx.route(path[0], path[1]);
        trace.len = length(trace.pts);
        s.wake();
      };
      ctx.tracing = () => !!trace;
      /** Tells the page something: the host element gets a "lw:<name>" event with the detail. */
      ctx.emit = (name, detail) => s.host.dispatchEvent(new CustomEvent("lw:" + name, { detail }));
      if (spec.draw) spec.draw(s, ctx);

      let lastStep = null, ordered = false;
      return (input, v) => {
        flow = v;
        // once the frame is fitted: a raised belt goes in front of what is behind it and behind what is in front
        if (!ordered) {
          ordered = true;
          for (const l of ctx.links) if (l.raised && l.g.box) l.g.order = s.orderFor(l.g.box, l.g).order;
        }
        // which nodes are built: all of them, or those whose step has come
        ctx.list.forEach((n, i) => {
          const on = input.step == null || (n.step ?? 0) <= input.step ? 1 : 0;
          n.g.to({ on }, { ease: true, dur: 800, delay: input.step != null && input.step !== lastStep ? i * 60 : 0 });
        });
        for (const l of ctx.links) {
          const on = input.step == null || ((l.step ?? Math.max(l.A.step ?? 0, l.B.step ?? 0)) <= input.step) ? 1 : 0;
          l.g.to({ on: l.hold ?? on }, { ease: true, dur: 900, delay: on && l.hold == null ? 450 : 0 });
        }
        lastStep = input.step;

        const hit = input.hit != null ? ctx.nodes[input.hit] : null;
        const hover = hit && (input.step == null || (hit.step ?? 0) <= input.step) ? hit : null;
        ctx.hover = hover;
        for (const n of ctx.list) n.g.to({ lift: n === hover || n.raised ? 6 : 0 });
        if (input.clicked && hover && hover.explode) {
          hover.open = !hover.open;
          hover.g.to({ gap: hover.open ? hover.explode[1] : hover.explode[0] }, { ease: true });
        }

        const r = spec.answer ? spec.answer(input, ctx) : undefined;
        if (!ctx.keepAccent) {
          const focus = input.focus != null ? [].concat(input.focus).map((id) => ctx.nodes[id]).filter(Boolean) : [];
          const stepped = input.step != null ? ctx.list.filter((n) => (n.step ?? 0) === input.step) : [];
          const rest = ctx.rest ?? spec.rest;
          const lit = hover ? [hover] : focus.length ? focus : stepped.length ? stepped : rest ? [ctx.nodes[rest]] : [];
          s.accent(lit.map((n) => n.g));
        }
        if (r !== undefined) return r;
        return hover ? hover.label || hover.id : "rest";
      };
    };
    if (!fig.tour) fig.tour = (s) => spec.nodes.filter((n) => n.label).slice(0, 4).map((n) => s.at(n.at[0] * G, n.at[1] * G, 10)).concat([null]);
    return fig;
  };
})();
