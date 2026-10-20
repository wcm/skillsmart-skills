/*
 * Gravity: what goes up comes down. Everything in it falls, bounces, orbits or pulls together:
 * free-fall type that thins to weightless, a chrome ball bouncing on a field, a cloud of dust
 * collapsing into a star and then into a black hole, thrown ribbons arcing down, drops pulled
 * into one, four words, a pendulum and an orbit; every cut drops into the next scene, and the
 * end card falls away onto the first frame. 14 bars at 108 BPM, in sand, teal and vermilion.
 */
const DROP = { whip: { type: "whip", beats: 0.6, dir: [0, 1], tilt: 3 } };

Reel.make({
  name: "gravity",
  brand: "GRAVITY",
  edition: "9.81 M/S²",
  bpm: 108,
  palette: "earth",
  energy: 1,
  music: { key: "G", mood: "minor" },
  hud: {
    right: "g = {g} M/S²",
    readout: "FALL {v} M   F{f}",
    vars: { g: { curve: [[0, 9.81], [1, 9.81]], digits: 2 }, v: { curve: [[0, 0], [1, 1517]], digits: 0, pad: 4 } },
  },
  scenes: [
    {
      type: "title", beats: 6, kicker: "9.81 M/S² --- 01", words: ["FREE", "FALL"], line: "with gravity", exit: "none",
      caption: "wght {w}  ·  weightless", out: DROP.whip,
    },
    {
      type: "voxels", beats: 6, label: "BOUNCE", bg: "deep", ramp: ["cool", "blush", "accent"], ring: "sun",
      note: "MASS / 1 KG", sub: "h {y} CM", top: "FIELD {cols}×{rows}  N={n}", formula: "h = ½ g t²", hits: [1, 2, 3, 4, 5],
    },
    {
      type: "points", beats: 8, label: "COLLAPSE", n: 2600, bg: "ink", ground: { radial: ["#1D3336", "ink", "deep"], at: [0.5, 0.45], r: 0.72 },
      color: "paper", accent: "sun", glow: true, dot: 3, size: 1.3, pitch: 34, spin: 30,
      names: ["DUST", "GALAXY", "STAR", "BLACK HOLE"],
      panel: ["MASS / {form}", "N={n}  {move}", "PULL {heat}%", "t={t}s"],
      steps: [
        { form: "galaxy", move: "assemble", from: "gas", beats: 3, swirl: 260, heat: [0.04, 0.12] },
        { form: "sphere", beats: 2.4, swirl: 180, heat: [0.12, 0.55], cam: { pitch: 18 } },
        { move: "implode", beats: 2.6, heat: [0.55, 1], cam: { dist: 3.2 } },
      ],
      in: { type: "punch", beats: 0.4, power: 0.8 },
    },
    {
      type: "ribbons", beats: 6, label: "TRAJECTORY", bg: "sun",
      paths: [
        [[-1.4, 1.25], [-0.75, -0.25], [-0.1, -0.78], [0.5, -0.3], [1.05, 0.85], [1.3, 1.45]],
        [[1.45, 0.95], [0.65, -0.12], [0, -0.38], [-0.62, -0.06], [-1.15, 0.92], [-1.4, 1.5]],
        [[-1.35, 0.42], [-0.5, -0.52], [0.18, -0.92], [0.82, -0.6], [1.22, 0.2], [1.42, 1.05]],
        [[1.3, 1.32], [0.7, 0.32], [0.18, -0.12], [-0.32, 0.18], [-0.82, 1.02], [-1.02, 1.55]],
      ],
      tags: ["ARC 01", "ARC 02", "ARC 03", "ARC 04"], readout: ["{tag}  s={s}", "v {v} px/s  θ {th}°"], stats: "THROWN ×{n}   LIVE {live}   CROSS {x}",
      out: DROP.whip,
    },
    { type: "blob", beats: 4, label: "COHESION", bg: "accent", shape: "circle", title: "DROPS · PULLED INTO ONE" },
    { type: "words", beats: 8, per: 2, words: ["WHAT", "GOES", "UP", "comes down"], hits: [2, 4, 6], out: DROP.whip },
    { type: "rhythm", beats: 8, per: 2, label: "PENDULUM", shots: ["orbit", "harmonograph", "target", "vinyl"], hits: [2, 4, 6], record: "SIDE A · {bpm} BPM · GRAVITY · 9.81 M/S² ·" },
    { type: "orbit", beats: 4, label: "ORBIT", words: ["MASS", "WEIGHT", "ORBIT", "TIDE", "APPLE", "NEWTON", "ESCAPE", "VELOCITY", "PULL", "FALL", "MOON", "WELL"] },
    { type: "endcard", beats: 6, wordmark: "Gravity", role: "WHAT GOES UP", tagline: "COMES DOWN.", out: { type: "whip", beats: 0.7, dir: [0, 1], tilt: 3 } },
  ],
});
