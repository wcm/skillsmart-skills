/**
 * Camera: a physical system. A camera and its 35mm lens as an exploded view with a callout
 * for every element. On the product page, the first third of the scroll takes the lens apart
 * and the rest walks through the elements one by one; the pointer can pick one too. In a
 * gallery (no scroll), the pointer's x does the exploding.
 */
{
  const AX = 46, AZ = 28, Y0 = 36;
  const ELEMENTS = [
    { name: "Bayonet mount", sub: "stainless · sealed", R: 22, len: 5, hole: 17 },
    { name: "Rear group", sub: "2 elements · ED glass", R: 15.5, len: 4, glass: true },
    { name: "Aperture", sub: "11 blades · f/1.4–16", R: 19, len: 3, aperture: true },
    { name: "Floating group", sub: "moves for close focus", R: 14.5, len: 6, glass: true },
    { name: "Focus ring", sub: "linear motor · 0.3 m", R: 23, len: 12, ridges: 72 },
    { name: "Front group", sub: "aspherical · nano coat", R: 19, len: 5, glass: true },
    { name: "Hood", sub: "bayonet · reversible", R: 24.5, len: 8, hole: 20.5 },
  ];
  // callout lanes: above or below the axis, near or far, so no two neighbours collide
  const LANES = [[1, 30], [-1, 26], [1, 58], [-1, 56], [1, 30], [-1, 26], [1, 58]];
  const REST_GAP = 4, GAP = 22;
  let at = Y0;
  for (const e of ELEMENTS) { e.base = at; at += e.len; }
  const LEN = at - Y0;

  linework({
    name: "camera",
    means: "A 35mm lens as an exploded view: twelve elements in seven parts, each with its callout.",
    look: "studio",
    inputs: ["scroll", "pointer"],
    range: [16, GAP, 26],
    frame: [300, 190],
    tour: (s) => [4, 2, 6].map((i) => s.at(AX, ELEMENTS[i].base + (i + 1) * REST_GAP + ELEMENTS[i].len / 2, AZ)).concat([null]),

    draw(s, value) {
      let spread = value;
      s.box({ x: 0, y: 0, z: 0, w: 92, d: Y0, h: 58, r: 7, b: 1.6 });
      s.box({ x: 72, y: Y0 - 1, z: 5, w: 17, d: 7, h: 46, r: 3.5, b: 1 });
      s.cyl({ axis: "x", cy: 12, cz: 50, x: 92, len: 3, R: 2.2, b: 0.5 });
      s.box({ x: 30, y: 6, z: 58, w: 32, d: 24, h: 10, r: 3, b: 1, taper: 3 });
      s.cyl({ cx: 15, cy: 17, z: 58, R: 7.5, h: 4, b: 0.8, ridges: 30 });
      s.cyl({ cx: 78, cy: 15, z: 58, R: 4.2, h: 2.4, b: 0.7 }).cyl({ cx: 78, cy: 15, z: 60.4, R: 2.6, h: 1.4, b: 0.5 });
      s.patch({ plane: "y", at: Y0, u0: AX - 17, u1: AX + 17, v0: AZ - 17, v1: AZ + 17, r: 17 }, { cls: "hole", order: 590 });

      const axis = s.group({ gap: REST_GAP }, { order: 700 });
      axis.line((v) => ({ pts: [[AX, Y0, AZ], [AX, Y0 + LEN + 7 * v.gap + 18, AZ]] }), { cls: "dash" });

      const parts = ELEMENTS.map((e, i) => {
        const g = s.group({ y: e.base + (i + 1) * REST_GAP, lift: 0, show: 0 }, { order: 800 + i });
        const cap = (v) => v.y + e.len, cz = (v) => AZ + v.lift;
        g.cyl((v) => ({ axis: "y", cx: AX, cz: cz(v), y: v.y, len: e.len, R: e.R, b: 1, hole: e.hole, ridges: e.ridges, n: 64 }));
        if (e.glass) {
          g.arc((v) => ({ plane: "y", at: cap(v), cu: AX, cv: cz(v), R: e.R * 0.74 }), { cls: "lo" });
          g.arc((v) => ({ plane: "y", at: cap(v), cu: AX, cv: cz(v), R: e.R * 0.5, a0: 105, a1: 150 }));
          g.arc((v) => ({ plane: "y", at: cap(v), cu: AX, cv: cz(v), R: e.R * 0.34, a0: 112, a1: 138 }));
        }
        if (e.aperture) {
          const blade = (k) => (((k * 360) / 11 + 8) * Math.PI) / 180;
          g.shape((v) => ({ plane: "y", at: cap(v), pts: Array.from({ length: 11 }, (_, k) => [AX + e.R * 0.3 * Math.cos(blade(k)), cz(v) + e.R * 0.3 * Math.sin(blade(k))]) }), { cls: "edge hole" });
          for (let k = 0; k < 11; k++) g.line((v) => ({ pts: [[AX + e.R * 0.3 * Math.cos(blade(k)), cap(v), cz(v) + e.R * 0.3 * Math.sin(blade(k))], [AX + e.R * 0.8 * Math.cos(blade(k) + 0.8), cap(v), cz(v) + e.R * 0.8 * Math.sin(blade(k) + 0.8)]] }), { cls: "lo" });
        }
        const [side, len] = LANES[i];
        g.label((v) => (v.show < 0.5 ? { hide: true } : { at: [AX, v.y + e.len / 2, cz(v) + side * e.R], dx: 0, dy: -side * len, text: e.name, sub: e.sub }));
        return { g, e, i };
      });
      s.extent([[AX - 25, Y0 + LEN + 7 * 26 + 20, AZ - 25], [AX + 25, Y0 + LEN + 7 * 26, AZ + 30]]);

      const ease = (t) => t * t * (3 - 2 * t);
      return (input, v) => {
        spread = v;
        let e = 0, focus = null;
        if (input.scroll != null) {
          e = ease(LW.clamp(input.scroll / 0.3, 0, 1));
          if (input.scroll > 0.33) focus = Math.min(ELEMENTS.length - 1, Math.floor(((input.scroll - 0.33) / 0.64) * ELEMENTS.length));
        } else if (input.at) e = ease(LW.clamp((0.86 - input.u) / 0.6, 0, 1));
        const gap = REST_GAP + (spread - REST_GAP) * e;
        axis.to({ gap });
        // pick from the targets: where each element is going, not where it is on this frame
        let pick = null, best = Infinity;
        if (input.at) for (const p of parts) {
          const c = s.V.P(AX, p.e.base + (p.i + 1) * gap + p.e.len / 2, AZ);
          const d = Math.hypot(c[0] - input.at[0], c[1] - input.at[1]);
          if (d < p.e.R * s.V.S * 1.05 && d < best) { best = d; pick = p; }
        }
        const lit = pick || (focus != null ? parts[focus] : null);
        for (const p of parts) p.g.to({ y: p.e.base + (p.i + 1) * gap, show: e > 0.6 ? 1 : 0 }).to({ lift: p === lit ? 5 : 0 }, { ease: true });
        s.accent((lit || parts[2]).g);
        return lit ? lit.e.name : e > 0.6 ? "exploded" : "rest";
      };
    },
  });
}
