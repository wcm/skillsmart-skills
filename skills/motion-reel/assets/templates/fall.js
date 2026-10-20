/*
 * Starter: FALL. Everything in it falls, bounces, orbits or pulls together, and every cut drops
 * into the next scene (a whip pan downwards); the end card falls away onto the first frame. For
 * ideas with weight and pull: gravity, momentum, attraction, a launch, "what goes up".
 * (examples/gravity.js is this starter, finished.)
 *
 * Replace every placeholder, the words in double angle quotes (check.mjs fails while one is left). The arc, scene by scene:
 *   1 title     two heavy words that thin to a hairline (the weight wave), a serif line
 *   2 voxels    a chrome ball bouncing on a field: every landing is a hit
 *   3 points    a cloud pulled into a disc, a ball, then a point  (pick forms and moves)
 *   4 ribbons   thrown things: ribbons along arcs that fall away   (paths: your own arcs)
 *   5 blob      drops pulled together into one
 *   6 words     four words in the four classic styles: stack, repeat, viewfinder, bands
 *   7 rhythm    four physical instruments: an orbit, a pendulum, ripples, a spinning record
 *   8 orbit     the idea's keywords in rings that spin up and spiral into the dot
 *   9 endcard   the name; it falls away onto the first frame
 */
const DROP = { type: "whip", beats: 0.6, dir: [0, 1], tilt: 3 };

Reel.make({
  name: "reel",
  brand: "«BRAND»",
  edition: "«EDITION»",
  bpm: 108,
  palette: "earth",
  energy: 1,
  music: { key: "G", mood: "minor" },
  hud: { right: "«g = 9.81 M/S²»", readout: "«FALL» {v} M   F{f}", vars: { v: { curve: [[0, 0], [1, 1517]], digits: 0, pad: 4 } } },
  scenes: [
    { type: "title", beats: 6, kicker: "«KICKER --- 01»", words: ["«WORD»", "«WORD»"], line: "«with noun»", exit: "none", caption: "wght {w}  ·  «caption»", out: DROP },
    { type: "voxels", beats: 6, label: "«BOUNCE»", bg: "deep", ramp: ["cool", "blush", "accent"], ring: "sun", note: "«OBJECT / NOTE»", sub: "h {y} CM", top: "FIELD {cols}×{rows}  N={n}", formula: "«h = ½ g t²»", hits: [1, 2, 3, 4, 5] },
    {
      type: "points", beats: 8, label: "«PULL»", n: 2600, bg: "ink", ground: { radial: ["#1D3336", "ink", "deep"], at: [0.5, 0.45], r: 0.72 },
      color: "paper", accent: "sun", glow: true, dot: 3, size: 1.3, pitch: 34, spin: 30,
      names: ["«FORM 1»", "«FORM 2»", "«FORM 3»", "«FORM 4»"],
      panel: ["«MASS» / {form}", "N={n}  {move}", "«PULL» {heat}%", "t={t}s"],
      steps: [
        { form: "galaxy", move: "assemble", from: "gas", beats: 3, swirl: 260, heat: [0.04, 0.12] },
        { form: "sphere", beats: 2.4, swirl: 180, heat: [0.12, 0.55], cam: { pitch: 18 } },
        { move: "implode", beats: 2.6, heat: [0.55, 1], cam: { dist: 3.2 } },
      ],
      in: { type: "punch", beats: 0.4, power: 0.8 },
    },
    {
      type: "ribbons", beats: 6, label: "«THROWN»", bg: "sun",
      paths: [
        [[-1.4, 1.25], [-0.75, -0.25], [-0.1, -0.78], [0.5, -0.3], [1.05, 0.85], [1.3, 1.45]],
        [[1.45, 0.95], [0.65, -0.12], [0, -0.38], [-0.62, -0.06], [-1.15, 0.92], [-1.4, 1.5]],
        [[-1.35, 0.42], [-0.5, -0.52], [0.18, -0.92], [0.82, -0.6], [1.22, 0.2], [1.42, 1.05]],
        [[1.3, 1.32], [0.7, 0.32], [0.18, -0.12], [-0.32, 0.18], [-0.82, 1.02], [-1.02, 1.55]],
      ],
      tags: ["«ARC 01»", "«ARC 02»", "«ARC 03»", "«ARC 04»"], stats: "«THROWN» ×{n}   LIVE {live}   CROSS {x}",
      out: DROP,
    },
    { type: "blob", beats: 4, label: "«TOGETHER»", bg: "accent", shape: "circle", title: "«DROPS · PULLED INTO ONE»" },
    { type: "words", beats: 8, per: 2, words: ["«WORD»", "«WORD»", "«WORD»", "«two words»"], hits: [2, 4, 6], out: DROP },
    { type: "rhythm", beats: 8, per: 2, label: "«RHYTHM»", shots: ["orbit", "harmonograph", "target", "vinyl"], hits: [2, 4, 6], record: "SIDE A · {bpm} BPM · «BRAND» ·" },
    { type: "orbit", beats: 4, label: "«KEYWORDS»", words: ["«TEN»", "«TO»", "«FOURTEEN»", "«KEYWORDS»", "«OF»", "«THE»", "«IDEA»", "«IN»", "«CAPITALS»", "«EACH»"] },
    { type: "endcard", beats: 6, wordmark: "«Name»", role: "«ROLE»", tagline: "«TAGLINE.»", out: { type: "whip", beats: 0.7, dir: [0, 1], tilt: 3 } },
  ],
});
