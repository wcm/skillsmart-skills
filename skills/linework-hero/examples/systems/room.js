/**
 * Room: a living room in cutaway, for shopping it piece by piece. Every piece carries its
 * price; hovering lifts it and names it, a click tells the page (lw:toggle), and the page can switch
 * the layout from reading to hosting, when the furniture moves and a pouf comes in.
 *
 * A custom figure, not a system: each piece is a group whose parts read the group's offsets
 * (ox, oy), its lift and its tag (0 shows the price, 1 the name).
 */
{
  const PIECES = {
    sofa: { name: "Ames sofa", price: "€1,890", sub: "3-seat · boucle", c: [64, 17] },
    chair: { name: "Ames lounge chair", price: "€780", sub: "oak · linen", c: [20, 53] },
    table: { name: "Brook coffee table", price: "€420", sub: "solid oak", c: [64, 52] },
    lamp: { name: "Arc floor lamp", price: "€260", sub: "brass · 2700 K", c: [14, 22] },
    shelf: { name: "Stack shelf", price: "€540", sub: "4 bays · ash", c: [6, 85] },
    rug: { name: "Dune rug", price: "€390", sub: "wool · 200 × 140", c: [63, 58] },
    plant: { name: "Terra planter", price: "€60", sub: "with olive tree", c: [113, 52] },
    side: { name: "Orb side table", price: "€190", sub: "travertine", c: [104, 18] },
    pouf: { name: "Knot pouf", price: "€150", sub: "wool · Ø 46", c: [92, 72] },
  };
  // where pieces move for each layout (offsets from where they are drawn)
  const LAYOUTS = {
    reading: { chair: [0, 0], table: [0, 0], rug: [0, 0], pouf: null },
    hosting: { chair: [8, 16], table: [-4, 6], rug: [-4, 6], pouf: [0, 0] },
  };
  const W = 124, D = 100, H = 58;

  linework({
    name: "room",
    means: "A living room in cutaway: nine pieces, each with its price; hover to name a piece, click to add it, switch the layout to move them.",
    look: "sage",
    inputs: ["pointer", "click"],
    frame: [318, 238],
    tour: (s) => [["sofa", 20], ["table", 16], ["chair", 20], null].map((t) => (t ? s.at(PIECES[t[0]].c[0], PIECES[t[0]].c[1], t[1]) : null)),

    draw(s) {
      // the shell: two walls, the floor, a window, a picture
      const left = s.box({ x: -4, y: -4, z: -4, w: 4, d: D + 4, h: H + 4, r: 0.6, b: 0.5 }, { order: -300 });
      left.patch({ plane: "x", at: 0, u0: 18, u1: 42, v0: 26, v1: 44, r: 0.5 }, { cls: "edge" });
      left.patch({ plane: "x", at: 0, u0: 21, u1: 39, v0: 29, v1: 41, r: 0.3 }, { cls: "lo" });
      left.line({ pts: [[0, 23, 31], [0, 28, 36], [0, 31, 33], [0, 36, 38.5], [0, 37, 31]] }, { cls: "edge" });
      left.line({ pts: [[0, 0, 4], [0, D, 4]] }, { cls: "lo" });
      const back = s.box({ x: 0, y: -4, z: -4, w: W, d: 4, h: H + 4, r: 0.6, b: 0.5 }, { order: -290 });
      back.patch({ plane: "y", at: 0, u0: 68, u1: 100, v0: 20, v1: 47, r: 0.8 }, { cls: "edge" });
      back.patch({ plane: "y", at: 0, u0: 70.5, u1: 97.5, v0: 22.5, v1: 44.5, r: 0.4 }, { cls: "hole" });
      back.line({ pts: [[84, 0, 22.5], [84, 0, 44.5]] }, { cls: "edge" });
      back.line({ pts: [[70.5, 0, 33.5], [97.5, 0, 33.5]] }, { cls: "edge" });
      back.box({ x: 66, y: 0, z: 18.6, w: 36, d: 3, h: 1.4, r: 0.5, b: 0 });
      back.line({ pts: [[0, 0, 4], [W, 0, 4]] }, { cls: "lo" });
      const floor = s.box({ x: 0, y: 0, z: -4, w: W, d: D, h: 4, r: 0.6, b: 0 }, { order: -200 });
      for (let y = 12; y < D; y += 12) floor.line({ pts: [[0, y, 0], [W, y, 0]] }, { cls: "lo" });

      const g = {};
      const piece = (id, extra) => {
        const p = PIECES[id], grp = s.group(Object.assign({ ox: 0, oy: 0, lift: 0, tag: 0, on: 1 }, extra), { pick: id });
        g[id] = grp;
        return grp;
      };
      const B = (v, b) => Object.assign({}, b, { x: b.x + v.ox, y: b.y + v.oy, z: (b.z || 0) + v.lift, hide: v.on < 0.05 });
      const C = (v, c) => Object.assign({}, c, { cx: c.cx + v.ox, cy: c.cy + v.oy, z: (c.z || 0) + v.lift, hide: v.on < 0.05 });
      const label = (grp, id, top) => grp.label((v) => {
        const p = PIECES[id];
        return v.on < 0.5 ? { hide: true } : { at: [p.c[0] + v.ox, p.c[1] + v.oy, top + v.lift], dy: -12, text: v.tag > 0.5 ? p.name : p.price, sub: v.tag > 0.5 ? `${p.price} · ${p.sub}` : "" };
      });

      // the rug lies under everything
      const rug = piece("rug");
      rug.order = -150;
      rug.patch((v) => ({ plane: "z", at: 0.3, u0: 30 + v.ox, u1: 96 + v.ox, v0: 36 + v.oy, v1: 80 + v.oy, r: 4 }), { cls: "edge" });
      rug.patch((v) => ({ plane: "z", at: 0.35, u0: 34 + v.ox, u1: 92 + v.ox, v0: 40 + v.oy, v1: 76 + v.oy, r: 2.5 }), { cls: "lo nf" });
      label(rug, "rug", 0.4);

      const lamp = piece("lamp");
      lamp.cyl((v) => C(v, { cx: 14, cy: 22, R: 5, h: 1.2, b: 0.5 }));
      lamp.cyl((v) => C(v, { cx: 14, cy: 22, z: 1.2, R: 0.7, h: 40, b: 0 }));
      lamp.cyl((v) => C(v, { cx: 14, cy: 22, z: 40, R: 7, R1: 4.6, h: 9, b: 0.8 }));
      label(lamp, "lamp", 49);

      const chair = piece("chair");
      chair.box((v) => B(v, { x: 8, y: 40, w: 6, d: 26, h: 26, r: 3, b: 1 }));
      chair.box((v) => B(v, { x: 10, y: 40, w: 20, d: 5, h: 17, r: 2.5, b: 0.8 }));
      chair.box((v) => B(v, { x: 14, y: 45, w: 16, d: 16, h: 9, r: 2, b: 0.8 }));
      chair.box((v) => B(v, { x: 14, y: 45, z: 9, w: 15, d: 16, h: 4.5, r: 2.2, b: 0.8 }));
      chair.box((v) => B(v, { x: 10, y: 61, w: 20, d: 5, h: 17, r: 2.5, b: 0.8 }));
      label(chair, "chair", 26);

      const sofa = piece("sofa");
      sofa.box((v) => B(v, { x: 39, y: 3, z: 9, w: 50, d: 8, h: 18, r: 3.5, b: 1 }));
      sofa.box((v) => B(v, { x: 32, y: 4, w: 7, d: 26, h: 19, r: 3, b: 1 }));
      sofa.box((v) => B(v, { x: 39, y: 5, w: 50, d: 25, h: 9, r: 2.5, b: 0.8 }));
      sofa.box((v) => B(v, { x: 39, y: 11, z: 9, w: 25, d: 19, h: 5, r: 2.5, b: 0.8 }));
      sofa.box((v) => B(v, { x: 64, y: 11, z: 9, w: 25, d: 19, h: 5, r: 2.5, b: 0.8 }));
      sofa.box((v) => B(v, { x: 89, y: 4, w: 7, d: 26, h: 19, r: 3, b: 1 }));
      label(sofa, "sofa", 27);

      const side = piece("side");
      side.cyl((v) => C(v, { cx: 104, cy: 18, R: 6.5, R1: 5.5, h: 15, b: 0.8 }));
      side.ball((v) => ({ cx: 102 + v.ox, cy: 17 + v.oy, cz: 18.2 + v.lift, R: 3.2, hide: v.on < 0.05 }));
      label(side, "side", 21);

      const shelf = piece("shelf");
      shelf.box((v) => B(v, { x: 0, y: 72, w: 11, d: 26, h: 50, r: 0.8, b: 0.6 }));
      const BOOKS = [[[2, 3, 9], [5.5, 2.5, 8], [8.5, 3.5, 10], [13, 2, 7], [19, 4, 9]], [[3, 3, 8], [7, 3, 10], [11, 2.5, 7], [16, 6, 4]], [[2, 2.5, 9], [5, 3, 9], [15, 3, 10], [18.5, 3, 8], [22, 2.5, 9]], [[4, 7, 6], [16, 3, 10], [20, 3, 9]]];
      BOOKS.forEach((row, k) => {
        shelf.line((v) => ({ pts: [[11 + v.ox, 72 + v.oy, 12 * k + 1 + v.lift], [11 + v.ox, 98 + v.oy, 12 * k + 1 + v.lift]] }), { cls: "lo" });
        for (const [u, w, h] of row) shelf.patch((v) => ({ plane: "x", at: 11 + v.ox, u0: 72 + u + v.oy, u1: 72 + u + w + v.oy, v0: 12 * k + 1.4 + v.lift, v1: 12 * k + 1.4 + h + v.lift, r: 0.4 }), { cls: "edge" });
      });
      label(shelf, "shelf", 50);

      const table = piece("table");
      for (const [x, y] of [[52, 45], [76, 45], [52, 59], [76, 59]]) table.cyl((v) => C(v, { cx: x, cy: y, R: 1, h: 11, b: 0 }));
      table.box((v) => B(v, { x: 49, y: 42, z: 11, w: 30, d: 20, h: 2.5, r: 2.5, b: 0.8 }));
      table.box((v) => B(v, { x: 54, y: 46, z: 13.5, w: 10, d: 7, h: 1.4, r: 0.5, b: 0 }));
      table.box((v) => B(v, { x: 55, y: 46.5, z: 14.9, w: 8, d: 6, h: 1.2, r: 0.5, b: 0 }));
      table.cyl((v) => C(v, { cx: 71, cy: 55, z: 13.5, R: 2, h: 3.6, b: 0.4, rim: true }));
      label(table, "table", 16);

      const pouf = piece("pouf", { on: 0 });
      pouf.cyl((v) => C(v, { cx: 92, cy: 72, z: (1 - v.on) * 26, R: 7.5, R1: 6.8, h: 9, b: 1.2 }));
      label(pouf, "pouf", 9);

      const plant = piece("plant");
      plant.cyl((v) => C(v, { cx: 113, cy: 52, R: 5.5, R1: 7.5, h: 11, b: 1.2, rim: true }));
      plant.line((v) => ({ pts: [[113 + v.ox, 52 + v.oy, 10 + v.lift], [113 + v.ox, 52 + v.oy, 26 + v.lift]] }), { cls: "edge" });
      for (const [dx, dy, dz, r] of [[-3, 2, 24, 5], [3, -2, 27, 5.5], [0, 0, 31, 6]]) plant.ball((v) => ({ cx: 113 + dx + v.ox, cy: 52 + dy + v.oy, cz: dz + v.lift, R: r }));
      label(plant, "plant", 37);

      s.extent([[0, 0, H], [W, D, 0], [0, D, 0], [W, 0, H]]);

      let layout = "reading";
      const ids = Object.keys(PIECES);
      const reorder = (id) => {
        const p = PIECES[id], v = g[id].an.ox ? { ox: g[id].an.ox.tw ? g[id].an.ox.tw.to : g[id].v.ox, oy: g[id].an.oy.tw ? g[id].an.oy.tw.to : g[id].v.oy } : g[id].v;
        if (id !== "rug") g[id].order = s.V.depth(p.c[0] + v.ox, p.c[1] + v.oy, 0);
      };

      ids.forEach(reorder);

      return (input) => {
        if (input.layout && input.layout !== layout && LAYOUTS[input.layout]) {
          layout = input.layout;
          let k = 0;
          for (const id in LAYOUTS[layout]) {
            const o = LAYOUTS[layout][id];
            g[id].to(o ? { ox: o[0], oy: o[1], on: 1 } : { on: 0 }, { ease: true, delay: k++ * 90, dur: 800 });
            reorder(id);
          }
        }
        const hit = input.hit && g[input.hit].v.on > 0.5 ? input.hit : null;
        // the page owns the bag; the figure says what was clicked
        if (input.clicked && hit) s.host.dispatchEvent(new CustomEvent("lw:toggle", { detail: { id: hit } }));
        const focus = hit || input.focus || null;
        for (const id of ids) g[id].set({ tag: id === focus ? 1 : 0 }).to({ lift: id === hit ? 3 : 0 });
        s.accent(focus ? g[focus] : null);
        return focus ? PIECES[focus].name : "rest";
      };
    },
  });
}
