/*
 * Starter: ZOOM. Every scene is found inside the one before, and every cut is a dive through it (a
 * dot, a seed, a hole, a corner); the cuts come faster as it goes, and the last dive, through the
 * end card's full stop, lands on the first frame. For ideas about depth, scale, recursion, "there
 * is always more": infinity, curiosity, a universe, a rabbit hole, compound growth.
 * (examples/infinity.js is this starter, finished.)
 *
 * Replace every placeholder, the words in double angle quotes (check.mjs fails while one is left). The arc, scene by scene:
 *   1 path      a symbol draws itself, with the title under it   (∞, a spiral, a wave, your mark)
 *   2 phyllotaxis  growth without end: the golden angle
 *   3 points    a 3D object the camera flies into                 (pick forms that say "inside")
 *   4 fractal   a snowflake that grows detail, then dives for ever into a corner
 *   5 path      words winding into a spiral that never reaches the centre
 *   6 words     numbers too big for the frame (overflow)
 *   7 rhythm    four fractals, each a dive
 *   8 flow      a tunnel of rings the camera flies through (only the end of the scene plays: warp)
 *   9 endcard   the name; its full stop is the last hole
 */
const VOID = { radial: ["cool", "deep"], at: [0.5, 0.42], r: 0.66 };
const DUSK = { radial: ["#2A0C66", "deep"], at: [0.5, 0.48], r: 0.7 };

Reel.make({
  name: "reel",
  brand: "«BRAND»",
  edition: "«EDITION»",
  bpm: 100,
  palette: "void",
  energy: 0.6,
  fonts: { display: { family: "Unbounded", weight: 800 } },
  music: { key: "D", mood: "major", shepard: 1.6 }, // shepard: a tone that seems to rise for ever
  hud: { right: "«DEPTH» ×10^{d}", readout: "F{f}", vars: { d: { curve: [[0, 0], [1, 96]], pad: 2 } } },
  scenes: [
    {
      type: "path", beats: 8, label: "«SYMBOL»", path: "infinity", bg: "deep", ground: VOID,
      stripes: [["accent", 78], ["sun", 50], ["paper", 20]], draw: [0.04, 0.45], push: 0.5,
      words: ["«TWO WORDS»"], line: "«serif line»",
      out: { type: "zoom", beats: 0.8, ratio: 22, spin: 30 },
    },
    {
      type: "phyllotaxis", beats: 6, label: "«GROWTH»", bg: "deep", ground: DUSK, n: 1200, every: 21, warp: [[0, 0.05], [1, 1]],
      title: "«TITLE»", sub: "θ = 360° / φ²   r = c√n", readout: "«STATE»", metric: "«METRIC»", ratio: "φ = 1.6180339…", series: "1 · 1 · 2 · 3 · 5 · 8 · 13 · 21 · 34 · 55 · …",
      out: { type: "zoom", beats: 0.7, ratio: 24, spin: -40 },
    },
    {
      type: "points", beats: 8, label: "«INSIDE»", n: 2600, bg: "deep", ground: VOID, glow: true, color: "blush", accent: "sun", heat: 0.18, dot: 3.2, size: 1.3, spin: 26, pitch: 28,
      names: ["«FORM 1»", "«FORM 2»", "«FORM 3»", "«FORM 3»", "«FORM 3»"],
      panel: ["«SURFACE» / {form}", "N={n}  {move}", "«NOTE»", "t={t}s"],
      steps: [
        { form: "mobius", move: "assemble", from: "dot", beats: 2 },
        { form: "knot", beats: 1.6, swirl: 120 },
        { form: "klein", beats: 1.6, swirl: -90, heat: [0.12, 0.3] },
        { move: "hold", beats: 1.2, cam: { dist: 1.6, pitch: 10 }, turn: 60 },
        { move: "implode", beats: 1.6, cam: { dist: 0.9 } },
      ],
      out: { type: "zoom", beats: 0.6, ratio: 20 },
    },
    { type: "fractal", beats: 8, label: "«SELF-SIMILAR»", bg: "deep", ground: DUSK, out: { type: "zoom", beats: 0.8, ratio: 22, spin: 60, hole: "hexagon" } },
    {
      type: "path", beats: 6, label: "«AGAIN»", path: "spiral", bg: "deep", ground: DUSK, stripes: [], title: "none", size: 1.5,
      text: "«WORDS · THAT · REPEAT» · ", textSize: 70, textFlow: 560, textColor: "paper", draw: [0, 0.01], push: 0.25, spin: -40,
      readout: ["PATH / SPIRAL", "r = e^(−bθ)", "TURNS ∞"],
      out: { type: "zoom", beats: 0.7, ratio: 24 },
    },
    { type: "words", beats: 6, per: 1.5, label: "«COUNT»", bg: "deep", ground: VOID, words: ["«1»", "«1,000»", "«10^100»", "∞"], styles: ["overflow", "overflow", "overflow", "overflow"], count: "N {i}/{n}", hits: [1.5, 3, 4.5], in: { type: "punch", beats: 0.4, power: 0.7 } },
    { type: "rhythm", beats: 8, label: "«SAME AGAIN»", per: 2, shots: ["sierpinski", "dragon", "fern", "mandelbrot"], hits: [2, 4, 6], in: { type: "punch", beats: 0.35, power: 0.6 }, out: { type: "zoom", beats: 0.7, ratio: 18, hole: "none" } },
    { type: "flow", beats: 4, label: "«TUNNEL»", bg: "deep", ground: VOID, colors: ["paper", "accent", "sun", "blush"], weights: [60, 18, 14, 8], warp: [[0, 0.6], [1, 1]], readout: "«FIELD» / TUNNEL", out: { type: "zoom", beats: 0.7, ratio: 16 } },
    { type: "endcard", beats: 6, wordmark: "«Name»", kind: "display", role: "«ROLE»", tagline: "«TAGLINE.»", out: { type: "zoom", beats: 1, ratio: 34, spin: 20 } },
  ],
});
