/**
 * Catalog: a card catalogue of twelve drawers. The pointer picks a drawer, which slides
 * out with its index cards standing in it; its neighbours come out less, later the farther
 * they are. A click lifts the front card of the open drawer.
 *
 * The pattern: one of many. The hit test reads each drawer's front at rest, which never
 * moves; the slide is a choice, so it is a tween, staggered by distance from the pointer.
 */
{ // a block, so several figures can share one page
  const NC = 4, NR = 3, DW = 22, DH = 15, GAP = 3, BASE = 6, FRONT = 40, PANEL = 2.5, EMAX = 34;
  const CW = NC * DW + (NC + 1) * GAP, CH = NR * DH + (NR + 1) * GAP;
  const CARDS = 7, PITCH = 4.2, TABS = [0.15, 0.55, 0.85, 0.3, 0.7, 0.05, 0.45];
  const LETTER = ["C", "B", "A"]; // rows, from the bottom
  const REST = { B3: 13, A1: 5, C4: 4 };

  linework({
    name: "catalog",
    title: "Linework · Catalog",
    means: "A card catalogue: the drawer under the pointer slides out with its cards, its neighbours less and later; a click lifts a card.",
    hint: "move over the drawers · click",
    look: "riso",
    inputs: ["pointer", "click"],
    range: [0, 0.35, 0.7],
    rangeLabel: "spread",
    tour: (s) => [s.at(GAP + 1.5 * (DW + GAP), FRONT + PANEL, BASE + GAP + 1.5 * (DH + GAP)), s.at(GAP + 0.5 * (DW + GAP), FRONT + PANEL, BASE + GAP + 2.5 * (DH + GAP)), s.at(GAP + 3.5 * (DW + GAP), FRONT + PANEL, BASE + GAP + 0.5 * (DH + GAP)), null],

    draw(s, value) {
      let spread = value;
      s.box({ x: 3, y: 3, z: 0, w: CW - 6, d: FRONT - 6, h: BASE, r: 2, b: 0.8 });
      const cab = s.box({ x: 0, y: 0, z: BASE, w: CW, d: FRONT, h: CH, r: 2.5, b: 1 });
      s.box({ x: -2.5, y: -2.5, z: BASE + CH, w: CW + 5, d: FRONT + 5, h: 3, r: 3, b: 1 });

      const drawers = [];
      for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
        const x0 = GAP + c * (DW + GAP), z0 = BASE + GAP + r * (DH + GAP), id = LETTER[r] + (c + 1);
        // the opening, seen only when the drawer is out
        cab.patch({ plane: "y", at: FRONT, u0: x0 + 0.6, u1: x0 + DW - 0.6, v0: z0 + 0.6, v1: z0 + DH - 0.6, r: 1 }, { cls: "hole" });
        const face = [[x0, FRONT + PANEL, z0], [x0 + DW, FRONT + PANEL, z0], [x0 + DW, FRONT + PANEL, z0 + DH], [x0, FRONT + PANEL, z0 + DH]];
        const g = s.group({ e: REST[id] || 0, lift: 0 }, { pick: id, order: 200 + r * 10 + c, area: face });
        const trayTop = z0 + DH - 3;
        g.box((v) => ({ x: x0 + 1.2, y: FRONT, z: z0 + 0.6, w: DW - 2.4, d: v.e, h: DH - 3.6, r: 1, b: 1, tray: true, hide: v.e < 1.2 }));
        for (let k = CARDS - 1; k >= 0; k--) {
          const y = (v) => FRONT + v.e - 2.6 - k * PITCH;
          const up = (v) => (k === 0 ? v.lift : 0);
          const tx = x0 + 3.6 + TABS[k] * (DW - 7.2 - 5);
          g.box((v) => ({ x: x0 + 3.2, y: y(v), z: trayTop - 0.4 + up(v), w: DW - 6.4, d: 0.7, h: DH - trayTop + z0 + 1.6, r: 0.3, b: 0, hide: y(v) < FRONT + 0.4 }));
          g.box((v) => ({ x: tx, y: y(v), z: z0 + DH + 1.2 + up(v), w: 5, d: 0.7, h: 1.8, r: 0.3, b: 0, hide: y(v) < FRONT + 0.4 }));
        }
        g.box((v) => ({ x: x0, y: FRONT + v.e, z: z0, w: DW, d: PANEL, h: DH, r: 1.6, b: 0.8 }));
        g.patch((v) => ({ plane: "y", at: FRONT + v.e + PANEL, u0: x0 + DW / 2 - 5, u1: x0 + DW / 2 + 5, v0: z0 + DH * 0.56, v1: z0 + DH * 0.56 + 4.2, r: 0.8 }), { cls: "edge" });
        g.arc((v) => ({ plane: "y", at: FRONT + v.e + PANEL, cu: x0 + DW / 2, cv: z0 + DH * 0.36, R: 3.2, a0: 180, a1: 360 }), { cls: "edge" });
        drawers.push({ g, r, c, id, rest: REST[id] || 0 });
      }
      s.extent([[0, FRONT + EMAX + PANEL, BASE], [CW, FRONT + EMAX + PANEL, BASE], [0, FRONT + EMAX, BASE + CH + 12]]);

      const byId = Object.fromEntries(drawers.map((d) => [d.id, d]));
      let open = null, lifted = null;

      return (input, v) => {
        spread = v;
        const pick = input.hit ? byId[input.hit] : null;
        if (pick !== open) lifted = null;
        if (input.clicked && pick) lifted = lifted === pick ? null : pick;
        if (!pick) {
          for (const d of drawers) d.g.to({ e: d.rest, lift: 0 }, { ease: true, delay: open ? (Math.abs(d.r - open.r) + Math.abs(d.c - open.c)) * 40 : 0 });
          open = null;
          lifted = null;
          s.accent(byId.B3.g);
          return "rest";
        }
        open = pick;
        for (const d of drawers) {
          const dist = Math.abs(d.r - pick.r) + Math.abs(d.c - pick.c);
          const e = dist === 0 ? EMAX : (EMAX * spread) / Math.pow(dist, 1.3);
          d.g.to({ e, lift: d === lifted ? 9 : 0 }, { ease: true, delay: dist * 45 });
        }
        s.accent(pick.g);
        return lifted === pick ? `${pick.id} · card up` : `drawer ${pick.id}`;
      };
    },
  });
}
