/**
 * Synth: a desktop synthesizer. The pointer's x is the filter's cutoff: the big knob turns,
 * seven faders draw the filter's curve with its resonant peak at the cutoff, the tick ring
 * fills, and the patch cables swing with the turn and settle.
 *
 * The pattern: scrub. One continuous number from the pointer, springs for everything that
 * follows it, and a kick for the cables, which swing on their own spring and come to rest.
 */
{ // a block, so several figures can share one page
  const W = 150, D = 118, PANEL = 12;
  const FADERS = 7, SLOT0 = 34, SLOT1 = 74, CAP = 4.5;
  const KNOB = { cx: 118, cy: 50, R: 13 };
  const JACKS = [14, 28, 42, 56, 70, 84].map((x) => [x, 14]);
  const A0 = -135, A1 = 135;

  // the knob's angle (degrees, 0 = away from the player, clockwise from above) as a ground direction
  const dir = (a) => [Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)];
  const hz = (c) => 40 * Math.pow(2, c * 9);
  const label = (c) => {
    const f = hz(c);
    return f < 1000 ? `${Math.round(f)}Hz` : `${(f / 1000).toFixed(1)}k`;
  };
  // the filter: a low-pass with a resonant bump at the cutoff, read at band b (0..1)
  const curve = (b, c, res) => {
    const lp = 1 / (1 + Math.exp((b - c) / 0.07));
    return Math.max(0, Math.min(1, 0.1 + 0.52 * lp + res * 0.4 * Math.exp(-(((b - c) / 0.1) ** 2))));
  };

  linework({
    name: "synth",
    title: "Linework · Synth",
    means: "A desktop synth: the pointer turns the cutoff, the faders draw the filter's curve, and the patch cables swing and settle.",
    hint: "move left and right",
    look: "neon",
    inputs: ["pointer"],
    range: [0, 0.5, 1],
    rangeLabel: "resonance",
    tour: (s) => [s.at(20, 60, PANEL), s.at(150, 40, PANEL), s.at(70, 60, PANEL), null],

    draw(s, value) {
      let res = value, cut = 0.62;

      s.box({ x: 0, y: 0, z: 0, w: W, d: D, h: PANEL, r: 7, b: 1.8 });

      // the panel's flat marks: fader slots and the knob's tick ring, under everything that stands on it
      const panel = s.group({ c: cut }, { order: 100 });
      const xs = [];
      for (let i = 0; i < FADERS; i++) {
        const x = 14 + i * 12.5;
        xs.push(x);
        panel.patch({ plane: "z", at: PANEL, u0: x - 1.4, u1: x + 1.4, v0: SLOT0, v1: SLOT1, r: 1.4 }, { cls: "lo" });
      }
      const TICKS = 13;
      for (let k = 0; k < TICKS; k++) {
        const t = k / (TICKS - 1), [dx, dy] = dir(A0 + (A1 - A0) * t);
        panel.dot({ plane: "z", at: PANEL, cu: KNOB.cx + dx * 17.5, cv: KNOB.cy + dy * 17.5, r: 1 }, { cls: (v) => (v.c >= t - 1e-6 ? "on" : "off") });
      }

      // two octaves of keys in a bed along the front: the white keys left to right, then the black on top
      const keys = s.group({}, { order: 101 });
      const K0 = 9, KW = 8.8, KY0 = 84, KY1 = 110;
      keys.patch({ plane: "z", at: PANEL, u0: K0 - 2.5, u1: K0 + 15 * KW + 2.5, v0: KY0 - 2.5, v1: KY1 + 2.5, r: 2.5 }, { cls: "lo" });
      for (let k = 0; k < 15; k++) keys.box({ x: K0 + k * KW + 0.35, y: KY0, z: PANEL, w: KW - 0.7, d: KY1 - KY0, h: 1.6, r: 0.9, b: 0.5 });
      for (let k = 0; k < 14; k++) if ([0, 1, 3, 4, 5].includes(k % 7)) keys.box({ x: K0 + (k + 1) * KW - 2.7, y: KY0, z: PANEL + 1.6, w: 5.4, d: 15, h: 2.6, r: 0.8, b: 0.5 });

      // jacks, each a nut with a hole
      for (const [x, y] of JACKS) s.cyl({ cx: x, cy: y, z: PANEL, R: 3.3, h: 1.8, b: 0.6, hole: 1.4 });
      // two small knobs
      for (const [x, y] of [[108, 15], [130, 15]]) {
        s.cyl({ cx: x, cy: y, z: PANEL, R: 5, h: 5, b: 0.8, ridges: 22 }).line({ pts: [[x, y, PANEL + 5], [x + 2.6, y - 2.6, PANEL + 5]] }, { cls: "edge" });
      }

      // patch cables: a plug at each end, and a tube between them that swings on its own spring
      const cables = [[0, 3, 26, 1], [1, 5, 18, -0.8], [2, 4, 11, 0.6]].map(([a, b, lift, m]) => {
        const [ax, ay] = JACKS[a], [bx, by] = JACKS[b];
        const g = s.group({ sw: 0 });
        g.cyl({ cx: ax, cy: ay, z: PANEL + 1.8, R: 2.1, h: 5.5, b: 0.5 });
        g.cyl({ cx: bx, cy: by, z: PANEL + 1.8, R: 2.1, h: 5.5, b: 0.5 });
        g.cable((v) => ({ a: [ax, ay, PANEL + 7.3], b: [bx, by, PANEL + 7.3], lift, sway: v.sw * m }));
        return { g, m };
      });

      // the faders' caps, each with a line across its top
      const faders = xs.map((x, i) => {
        const y = (p) => SLOT1 - CAP / 2 - p * (SLOT1 - SLOT0 - CAP);
        const g = s.group({ p: curve(i / (FADERS - 1), cut, res) });
        g.box((v) => ({ x: x - 3.6, y: y(v.p) - CAP / 2, z: PANEL, w: 7.2, d: CAP, h: 4.5, r: 1.2, b: 0.7 }));
        g.line((v) => ({ pts: [[x - 2.6, y(v.p), PANEL + 4.5], [x + 2.6, y(v.p), PANEL + 4.5]] }), { cls: "edge" });
        return g;
      });

      // the cutoff knob: ridged, with a pointer line and a dot at its end
      const knob = s.group({ a: A0 + (A1 - A0) * cut });
      const top = PANEL + 6;
      knob.cyl({ cx: KNOB.cx, cy: KNOB.cy, z: PANEL, R: KNOB.R, R1: KNOB.R - 1, h: 6, b: 1.2, ridges: 40 });
      knob.line((v) => {
        const [dx, dy] = dir(v.a);
        return { pts: [[KNOB.cx + dx * 2, KNOB.cy + dy * 2, top], [KNOB.cx + dx * 9.5, KNOB.cy + dy * 9.5, top]] };
      }, { cls: "edge" });
      knob.dot((v) => {
        const [dx, dy] = dir(v.a);
        return { plane: "z", at: top, cu: KNOB.cx + dx * 9.8, cv: KNOB.cy + dy * 9.8, r: 1.1 };
      });

      s.extent([[0, 14, PANEL + 7.3 + 26 * 1.05]]);

      return (input, v) => {
        res = v;
        const prev = cut;
        cut = input.at ? LW.clamp((input.u - 0.14) / 0.72, 0, 1) : 0.62;
        knob.to({ a: A0 + (A1 - A0) * cut });
        panel.set({ c: cut });
        let peak = 0, best = Infinity;
        faders.forEach((g, i) => {
          const b = i / (FADERS - 1);
          g.to({ p: curve(b, cut, res) });
          if (Math.abs(b - cut) < best) { best = Math.abs(b - cut); peak = i; }
        });
        const du = cut - prev;
        for (const c of cables) {
          c.g.to({ sw: 0 }, { k: 55, c: 3.2 });
          if (Math.abs(du) > 1e-4) c.g.kick("sw", du * 90);
        }
        if (!input.at) { s.accent(knob); return "rest"; }
        s.accent(faders[peak]);
        return `cutoff ${label(cut)}`;
      };
    },
  });
}
