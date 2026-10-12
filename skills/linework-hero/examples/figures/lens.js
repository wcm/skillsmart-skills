/**
 * Lens: a camera and its lens, drawn as an exploded view. Scrolling takes the lens apart
 * along its axis, element by element; the pointer picks an element, which lifts and names
 * itself. Without a scroll track (in a gallery), the pointer's x does the exploding.
 *
 * The pattern: explode. One number spreads the parts along an axis, a dashed guide shows
 * the axis between them, and the pick is read from the parts' targets, never their motion.
 */
{ // a block, so several figures can share one page
  const AX = 46, AZ = 28, Y0 = 36;
  const ELEMENTS = [
    { name: "mount", R: 22, len: 5, hole: 17 },
    { name: "rear glass", R: 15.5, len: 4, glass: true },
    { name: "aperture f/2.8", R: 19, len: 3, aperture: true },
    { name: "middle glass", R: 14.5, len: 6, glass: true },
    { name: "focus ring", R: 23, len: 12, ridges: 72 },
    { name: "front glass", R: 19, len: 5, glass: true },
    { name: "hood", R: 24.5, len: 8, hole: 20.5 },
  ];
  const REST_GAP = 4;
  let at = Y0;
  for (const e of ELEMENTS) { e.base = at; at += e.len; }
  const LEN = at - Y0;

  linework({
    name: "lens",
    title: "Linework · Lens",
    means: "A camera's lens as an exploded view: scroll to take it apart along its axis, and point at an element to lift it out.",
    hint: "scroll · point at an element",
    look: "blueprint",
    inputs: ["scroll", "pointer"],
    range: [10, 16, 22],
    camera: "turned",
    rangeLabel: "spread",
    tour: (s) => [4, 1, 6].map((i) => s.at(AX, ELEMENTS[i].base + (i + 1) * REST_GAP + ELEMENTS[i].len / 2, AZ)).concat([null]),

    draw(s, value) {
      let spread = value;

      // the body, its grip, and what stands on top of it
      s.box({ x: 0, y: 0, z: 0, w: 92, d: Y0, h: 58, r: 7, b: 1.6 });
      s.box({ x: 72, y: Y0 - 1, z: 5, w: 17, d: 7, h: 46, r: 3.5, b: 1 });
      s.box({ x: 30, y: 6, z: 58, w: 32, d: 24, h: 10, r: 3, b: 1, taper: 3 });
      s.cyl({ cx: 15, cy: 17, z: 58, R: 7.5, h: 4, b: 0.8, ridges: 30 });
      s.cyl({ cx: 78, cy: 15, z: 58, R: 4.2, h: 2.4, b: 0.7 }).cyl({ cx: 78, cy: 15, z: 60.4, R: 2.6, h: 1.4, b: 0.5 });
      s.patch({ plane: "y", at: Y0, u0: AX - 17, u1: AX + 17, v0: AZ - 17, v1: AZ + 17, r: 17 }, { cls: "hole", order: 590 });

      // the optical axis, behind every element
      const axis = s.group({ gap: REST_GAP }, { order: 700 });
      axis.line((v) => ({ pts: [[AX, Y0, AZ], [AX, Y0 + LEN + 7 * v.gap + 18, AZ]] }), { cls: "dash" });

      const parts = ELEMENTS.map((e, i) => {
        const g = s.group({ y: e.base + (i + 1) * REST_GAP, lift: 0 }, { order: 800 + i });
        const cap = (v) => v.y + e.len, cz = (v) => AZ + v.lift;
        g.cyl((v) => ({ axis: "y", cx: AX, cz: cz(v), y: v.y, len: e.len, R: e.R, b: 1, hole: e.hole, ridges: e.ridges, n: 64 }));
        if (e.glass) {
          g.arc((v) => ({ plane: "y", at: cap(v), cu: AX, cv: cz(v), R: e.R * 0.74 }), { cls: "lo" });
          g.arc((v) => ({ plane: "y", at: cap(v), cu: AX, cv: cz(v), R: e.R * 0.5, a0: 105, a1: 150 }));
          g.arc((v) => ({ plane: "y", at: cap(v), cu: AX, cv: cz(v), R: e.R * 0.34, a0: 112, a1: 138 }));
        }
        if (e.aperture) {
          const hex = (r, a0) => [0, 1, 2, 3, 4, 5].map((k) => [AX + r * Math.cos(((a0 + k * 60) * Math.PI) / 180), r * Math.sin(((a0 + k * 60) * Math.PI) / 180)]);
          g.shape((v) => ({ plane: "y", at: cap(v), pts: hex(e.R * 0.34, 10).map(([u, w]) => [u, cz(v) + w]) }), { cls: "edge hole" });
          for (let k = 0; k < 6; k++) {
            const a = ((10 + k * 60) * Math.PI) / 180, b = a + 0.95;
            g.line((v) => ({ pts: [[AX + e.R * 0.34 * Math.cos(a), cap(v), cz(v) + e.R * 0.34 * Math.sin(a)], [AX + e.R * 0.8 * Math.cos(b), cap(v), cz(v) + e.R * 0.8 * Math.sin(b)]] }), { cls: "lo" });
          }
        }
        return { g, e, i };
      });
      s.extent([[AX - 25, Y0 + LEN + 7 * 22 + 20, AZ - 25], [AX + 25, Y0 + LEN + 7 * 22, AZ + 30]]);

      const ease = (t) => t * t * (3 - 2 * t);
      const gapNow = (input) => {
        if (input.scroll != null) return REST_GAP + (spread - REST_GAP) * ease(Math.min(1, input.scroll * 1.15));
        return input.at ? REST_GAP + (spread - REST_GAP) * ease(LW.clamp((0.86 - input.u) / 0.6, 0, 1)) : REST_GAP;
      };

      return (input, v) => {
        spread = v;
        const gap = gapNow(input);
        axis.to({ gap });
        // pick from the targets: where each element is going, not where it is on this frame
        let pick = null, best = Infinity;
        if (input.at) for (const p of parts) {
          const c = s.V.P(AX, p.e.base + (p.i + 1) * gap + p.e.len / 2, AZ);
          const d = Math.hypot(c[0] - input.at[0], c[1] - input.at[1]);
          if (d < p.e.R * s.V.S * 1.05 && d < best) { best = d; pick = p; }
        }
        for (const p of parts) p.g.to({ y: p.e.base + (p.i + 1) * gap }).to({ lift: p === pick ? 5 : 0 }, { ease: true });
        if (!pick) {
          s.accent(parts[2].g);
          return input.scroll > 0.02 ? `spread ${gap.toFixed(1)}` : "rest";
        }
        s.accent(pick.g);
        return pick.e.name;
      };
    },
  });
}
