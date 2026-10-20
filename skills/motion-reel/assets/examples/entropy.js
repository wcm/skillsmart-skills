/*
 * Entropy: everything falls apart, then rewinds. An abstract idea, made of order breaking down
 * scene by scene (a grid, a crystal, ice, a drop of ink, a printed sphere, four words, noise),
 * the end card at the peak of the chaos, then the whole reel rewinding to its first frame:
 * the rewind is the loop. 14 bars at 120 BPM.
 */
Reel.make({
  name: "entropy",
  brand: "ENTROPY",
  edition: "ΔS ≥ 0",
  bpm: 120,
  palette: "lab",
  energy: 1.2,
  fonts: { display: { family: "Archivo", stretch: "extra-condensed", weight: 900 } },
  music: { key: "E", mood: "minor" },
  hud: {
    right: "T {T} K",
    readout: "S {S}   F{f}",
    vars: {
      T: { curve: [[0, 0], [0.12, 4], [0.8, 950], [0.84, 999], [1, 999]], pad: 3 },
      S: { curve: [[0, 0], [0.84, 1], [1, 1]], digits: 3 },
    },
    meter: { v: "T", min: 0, max: 999, label: "T", color: "accent" },
  },
  scenes: [
    {
      type: "cells", beats: 6, label: "ORDER", words: ["ORDER"], cell: 22, tall: 2.6, bg: "paper",
      panel: ["GRID {cols}×{rows}", "CELLS {on}", "ORDER {order}%"],
      steps: [
        { move: "build", by: "scan", beats: 2 },
        { move: "hold", beats: 1.4 },
        { move: "jitter", amp: [0, 0.65], heat: [0, 0.16], beats: 2.6 },
      ],
      out: { type: "shatter", beats: 0.9, pieces: 72 },
    },
    {
      type: "points", beats: 10, label: "CRYSTAL", n: 2197, floor: true, yaw: -32, pitch: 24, spin: 16, size: 1.45, dot: 3.6,
      ground: { radial: ["#2A2C31", "cool", "deep"], at: [0.5, 0.45], r: 0.7 },
      names: ["CRYSTAL", "CRYSTAL", "ICE", "WATER", "VAPOUR"],
      panel: ["PHASE / {form}", "N={n}  {move}", "HEAT {heat}%", "t={t}s"],
      steps: [
        { form: "crystal", move: "assemble", from: "dot", beats: 2, heat: 0.02 },
        { move: "tremble", amp: [0, 0.1], speed: 12, heat: [0.02, 0.35], beats: 3, turn: 40 },
        { form: "cube", beats: 1.5, swirl: 40 },
        { move: "melt", beats: 2.5, heat: [0.3, 0.5], cam: { pitch: 32 } },
        { move: "boil", beats: 3, heat: [0.5, 0.95], cam: { pitch: 12, dist: 4.6 } },
      ],
    },
    { type: "crack", beats: 6, label: "FRACTURE", shape: "square", hits: [0.96], in: { type: "punch", beats: 0.4 }, out: { type: "slice", beats: 0.7 } },
    { type: "flow", beats: 6, label: "DIFFUSE", warp: { knots: [[0, 0], [0.45, 0.06], [0.6, 0.25], [1, 0.42]] }, out: { type: "flood", beats: 0.8 } },
    { type: "halftone", beats: 6, label: "DECAY", shape: "circle", decay: 1, decayFrom: 0.3, warp: [[0, 0.03], [0.14, 0.13], [1, 0.47]], screens: ["PRINT A", "PRINT B"], out: { type: "pixel", beats: 0.6 } },
    { type: "words", beats: 8, per: 2, words: ["ORDER", "FALLS", "TO", "pieces"], styles: ["grid", "glitch", "pixel", "dust"], hits: [2, 4, 6], out: { type: "slice", beats: 0.5 } },
    { type: "rhythm", beats: 8, label: "NOISE", per: 2, shots: ["grid", "jitter", "scatter", "static"], hits: [2, 4, 6], out: { type: "burn", beats: 0.6 } },
    { type: "endcard", beats: 6, wordmark: "Entropy", kind: "display", role: "THE ARROW OF TIME", tagline: "EVERYTHING FALLS APART.", out: null },
    { type: "rewind", beats: 8, label: "REWIND" },
  ],
});
