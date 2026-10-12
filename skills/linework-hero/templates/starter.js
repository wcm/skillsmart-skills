/**
 * NAME: EDIT one paragraph. The object, what the pointer does to it, and what the read-out
 * says. This starter is a working figure (crates on a pallet; the one under the pointer
 * lifts, its neighbours less and later) so the page opens before you change anything.
 *
 * The pattern: EDIT (field · pick · scrub · explode). See references/parts.md.
 */
{ // a block, so several figures can share one page
  const N = 5, W = 18, GAP = 4, PALLET = 4;
  const REST = [0, 2, 5, 1, 0]; // EDIT: rest is a composition, never flat
  const LIT = 2; // the one thing lit at rest

  linework({
    name: "NAME",
    means: "EDIT: one sentence, at most 140 characters, saying what the figure shows.",
    hint: "move over the crates", // EDIT: what to do, in a few words
    look: "paper", // EDIT: paper graphite blueprint riso neon clay ink terminal, or "hue:285"
    camera: "iso", // iso trueiso low high turned
    inputs: ["pointer"], // EDIT: pointer, click, scroll
    range: [8, 14, 20], // EDIT: the slider's number at intensity 0, 0.5 and 1
    rangeLabel: "lift",
    tour: (s) => [1, 3, 4].map((i) => s.at(i * (W + GAP) + W / 2, W / 2, PALLET + 12)).concat([null]),

    draw(s, value) {
      let lift = value;
      s.box({ x: -4, y: -4, z: 0, w: N * (W + GAP) + 4, d: W + 8, h: PALLET, r: 3, b: 1.2 });

      const crates = [];
      for (let i = 0; i < N; i++) {
        const x = i * (W + GAP), h = 15 - (i % 2) * 4;
        // a group is one thing: its parts, and the numbers that move them
        const g = s.group({ up: REST[i] }, { pick: i });
        g.box((v) => ({ x, y: 0, z: PALLET + v.up, w: W, d: W, h, r: 2.5, b: 1.2 }));
        // EDIT: the features that make it a crate and not a block: a slat line on its side
        g.line((v) => ({ pts: [[x + 2, W, PALLET + v.up + h / 2], [x + W - 2, W, PALLET + v.up + h / 2]] }), { cls: "lo" });
        crates.push(g);
      }
      s.extent([[0, 0, PALLET + 15 + 20], [N * (W + GAP), W, PALLET + 15 + 20]]);

      // answer: called on every pointer move, leave, click, scroll and slider change
      return (input, v) => {
        lift = v;
        const pick = input.hit; // the group under the pointer, tested against its rest pose
        crates.forEach((g, i) => {
          const d = pick == null ? 0 : Math.abs(i - pick);
          const up = pick == null ? REST[i] : Math.max(0, lift * (1 - d * 0.45));
          g.to({ up }, { ease: true, delay: d * 45 }); // a choice: a tween, staggered by distance
        });
        s.accent(crates[pick ?? LIT]);
        return pick == null ? "rest" : `crate ${pick + 1}`;
      };
    },
  });
}
