/*
 * Starter: REWIND. Something whole breaks down scene by scene, the end card lands at the peak of
 * the chaos, then the whole reel rewinds to its first frame, and the rewind is the loop. For ideas
 * about loss, decay, time, undoing: entropy, burnout, memory, a deadline, "it was fine a minute ago".
 * (examples/entropy.js is this starter, finished.)
 *
 * Replace every placeholder, the words in double angle quotes (check.mjs fails while one is left). The arc, scene by scene:
 *   1 cells     the thing, whole and perfect, built on a grid    → shatters
 *   2 points    a 3D object that heats, melts and boils off      (pick forms and moves that act it out)
 *   3 crack     a shape cracks and comes apart                   (punch in, slice out)
 *   4 flow      a drop that spreads into a swirl (only the first part of the scene plays: warp)
 *   5 halftone  a printed picture whose dots fall away           (decay)
 *   6 words     four words, each more broken: grid, glitch, pixel, dust
 *   7 rhythm    four shots from order to noise: grid, jitter, scatter, static
 *   8 endcard   the name, at the peak (no iris: the rewind takes it from here)
 *   9 rewind    the whole reel backwards to frame 0: the loop
 */
Reel.make({
  name: "reel",
  brand: "«BRAND»", // top left of the HUD
  edition: "«EDITION»", // after the brand, dimmer: a formula, a version, a date
  bpm: 120,
  palette: "lab", // lab, void, earth, studio, tide, matcha, citrus, clay, neon, noir, or { ink, paper, accent, cool, sun, blush, deep, sky }
  energy: 1.2, // how hard the hits land: 0 off, 1 bold, 2 wild
  fonts: { display: { family: "Archivo", stretch: "extra-condensed", weight: 900 } },
  music: { key: "E", mood: "minor" },
  hud: {
    right: "«T» {T} «K»", // a number that tells the story, rising as things fall apart
    readout: "«S» {S}   F{f}",
    vars: {
      T: { curve: [[0, 0], [0.8, 950], [0.84, 999], [1, 999]], pad: 3 },
      S: { curve: [[0, 0], [0.84, 1], [1, 1]], digits: 3 },
    },
    meter: { v: "T", min: 0, max: 999, label: "«T»", color: "accent" },
  },
  scenes: [
    {
      type: "cells", beats: 6, label: "«WHOLE»", words: ["«WORD»"], cell: 22, tall: 2.6, bg: "paper",
      panel: ["GRID {cols}×{rows}", "CELLS {on}", "«ORDER» {order}%"],
      steps: [{ move: "build", by: "scan", beats: 2 }, { move: "hold", beats: 1.4 }, { move: "jitter", amp: [0, 0.65], heat: [0, 0.16], beats: 2.6 }],
      out: { type: "shatter", beats: 0.9, pieces: 72 },
    },
    {
      type: "points", beats: 10, label: "«STATE»", n: 2197, floor: true, yaw: -32, pitch: 24, spin: 16, size: 1.45, dot: 3.6,
      ground: { radial: ["#2A2C31", "cool", "deep"], at: [0.5, 0.45], r: 0.7 },
      names: ["«FORM 1»", "«FORM 1»", "«FORM 2»", "«FORM 3»", "«FORM 4»"],
      panel: ["«PHASE» / {form}", "N={n}  {move}", "«HEAT» {heat}%", "t={t}s"],
      steps: [
        { form: "crystal", move: "assemble", from: "dot", beats: 2, heat: 0.02 },
        { move: "tremble", amp: [0, 0.1], speed: 12, heat: [0.02, 0.35], beats: 3, turn: 40 },
        { form: "cube", beats: 1.5, swirl: 40 },
        { move: "melt", beats: 2.5, heat: [0.3, 0.5], cam: { pitch: 32 } },
        { move: "boil", beats: 3, heat: [0.5, 0.95], cam: { pitch: 12, dist: 4.6 } },
      ],
    },
    { type: "crack", beats: 6, label: "«BREAK»", shape: "square", title: "«SAMPLE» / {state}", hits: [0.96], in: { type: "punch", beats: 0.4 }, out: { type: "slice", beats: 0.7 } },
    { type: "flow", beats: 6, label: "«SPREAD»", readout: "«FIELD» / CURL NOISE", warp: { knots: [[0, 0], [0.45, 0.06], [0.6, 0.25], [1, 0.42]] }, out: { type: "flood", beats: 0.8 } },
    { type: "halftone", beats: 6, label: "«DECAY»", shape: "circle", decay: 1, decayFrom: 0.3, warp: [[0, 0.03], [0.14, 0.13], [1, 0.47]], screens: ["«PRINT A»", "«PRINT B»"], out: { type: "pixel", beats: 0.6 } },
    { type: "words", beats: 8, per: 2, words: ["«ORDER»", "«FALLS»", "«TO»", "«pieces»"], styles: ["grid", "glitch", "pixel", "dust"], hits: [2, 4, 6], out: { type: "slice", beats: 0.5 } },
    { type: "rhythm", beats: 8, label: "«NOISE»", per: 2, shots: ["grid", "jitter", "scatter", "static"], hits: [2, 4, 6], out: { type: "burn", beats: 0.6 } },
    { type: "endcard", beats: 6, wordmark: "«Name»", kind: "display", role: "«ROLE»", tagline: "«TAGLINE.»", out: null },
    { type: "rewind", beats: 8, label: "REWIND" },
  ],
});
