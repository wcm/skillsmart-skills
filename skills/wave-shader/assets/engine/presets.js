// The four example looks, as settings for the one engine in wave.js. A page mounts the engine with one of these,
// overriding whatever it needs (colours first). Fields:
//   shape            "plane" | "sheet" | "ribbon"
//   shapeA, shapeB   the shape's dimensions (see surf() in wave.js)
//   eye, target, fov the camera; horizon (fraction of the height, for a level camera) shifts the picture so the
//                    horizon lands there
//   amp, freq, warp, speed   how tall, how close together, how irregular and how fast the waves are
//   colors           five stops, low to high; colorBy weights how the ramp is read: across, up the crests, along
//   light            "lit" (default) or "glow"; lit: [ambient, diffuse, sheen, highlight]; fog: [start, density,
//                    sky in grazing angles, sparkle]; glow: glowShape [lower-edge softness, fade upward, ray
//                    frequency, ray amount], glowBright, wings (keep the light to the sides)
//   sky              colours of the sky pass (top, mid, low, horizon, sun, land); sunDir, stars, clouds, land
//   press, pressRadius, ripple, lean, sunLean   how the cursor and a click move it
//   grain            film grain, in sRGB steps

export const haze = {
  // a plane seen from above: big soft folds of warm silk filling the frame, hazing out toward the top
  shape: "plane", shapeA: [0.5, 60, 1.15, 4], shapeB: [0.7, 14, 50, 0],
  eye: [0, 6.5, 3.5], target: [0, 0, -6.5], fov: 40,
  amp: 1.35, freq: 0.62, warp: 1.25, speed: 0.6,
  colors: ["#d4583e", "#f08a5d", "#ffb98a", "#ffe3c4", "#fff6ec"],
  colorBy: [0.3, 0.45, 0.25, 0.45],
  lit: [0.5, 0.62, 0.14, 0.25], fog: [8, 0.025, 0.25, 0],
  sky: { skyTop: "#ffe9d6", skyMid: "#fff0e2", skyLow: "#fff4ea", horizon: "#fff1e4", sun: "#ffffff" },
  sunDir: [-0.45, 0.85, 0.25],
  press: 0.9, pressRadius: 2.4, ripple: 1.2, lean: 0.05, grain: 0.085,
};

export const aurora = {
  // a hanging sheet that glows: curtains of light curving round you, brightest where they fold
  shape: "sheet", light: "glow",
  shapeA: [18, 10, 0.9, -11], shapeB: [9, 1.4, 0, 0],
  eye: [0, 0, 0], target: [0, 3.6, -10], fov: 56,
  amp: 2.2, freq: 0.9, warp: 1.3, speed: 0.5,
  colors: ["#d9fff1", "#43f5a6", "#1fe0a0", "#22a6c9", "#8f4dff"],
  colorBy: [0, 0, 0, 0],
  glowShape: [0.05, 1.0, 70, 0.75], glowBright: 0.55, glowNear: 0.9, wings: true,
  glowBlur: 2.0, glowSharp: 0.8, glowSoft: 0.95,
  sky: { skyTop: "#03050d", skyMid: "#06101f", skyLow: "#0c1c30", horizon: "#10263a", land: "#020409" },
  stars: 1, land: true,
  press: 1.2, pressRadius: 3.5, ripple: 1.6, lean: 0.03, grain: 0.035,
  // a phone sees only the middle of the arc, which is far and dim: straighten it and bring it closer
  tall: { shapeA: [14, 10, 0.9, -8], shapeB: [0, 1.4, 0, 0], fov: 62, glowBright: 0.62 },
};

export const swell = {
  // the same plane from a low camera: a sea of satin rolling to a sun on the horizon
  shape: "plane", shapeA: [1.6, 260, 1.0, 2.5], shapeB: [0.25, 10, 70, 0],
  eye: [0, 1.9, 0], target: [0, 1.9, -1], fov: 38, horizon: (aspect) => (aspect < 0.85 ? 0.34 : 0.36),
  amp: 0.62, freq: 1, warp: 0.88,
  colors: ["#1b1142", "#4b2aa6", "#c33fae", "#ff6f6a", "#ffc58e"],
  colorBy: [0.6, 0.62, 0, 0.5],
  lit: [0.22, 1.05, 0.16, 1], fog: [4, 0.03, 0.55, 0.16],
  sky: { skyTop: "#150d38", skyMid: "#5a2d8f", skyLow: "#e0679a", horizon: "#ffa27d", sun: "#fff0d8" },
  sunDir: [0, 0.004, -1], sunLean: 0.4, clouds: 1,
  press: 0.42, pressRadius: 1.6, ripple: 0.44, lean: 0.08, grain: 0.045,
};

export const ribbon = {
  // a wide band of saturated colour sweeping slowly across white, one gentle twist drifting along it, made of silky
  // strands, in shallow focus
  shape: "ribbon", shapeA: [16, 3.4, 0.16, 0.45], shapeB: [2.0, 2.2, -0.85, 0.07],
  eye: [0, 0, 17], target: [-2.6, 0.5, 0], fov: 34,
  amp: 0.7, freq: 0.5, warp: 0.45, speed: 0.45,
  colors: ["#f3f1ff", "#8faaff", "#a05bff", "#ff4fb5", "#ff8a1a"],
  colorBy: [0.18, 0.08, 1.0, 0.5],
  lit: [0.72, 0.46, 0.26, 0.22], fog: [40, 0, 0.45, 0],
  sky: { skyTop: "#ffffff", skyMid: "#ffffff", skyLow: "#ffffff", horizon: "#ffffff", sun: "#ffffff" },
  sunDir: [-0.4, 0.7, 0.6],
  fibre: [0.22, 300],
  // a shallow focus: what swings toward you or away goes soft, and the pale inner edge melts into the page
  focus: { distance: 17, range: 5.5, edge: 0.75, blur: 2.4 },
  press: 0.7, pressRadius: 2.2, ripple: 0.9, lean: 0.05, grain: 0.02,
  // on a phone the band sweeps across the top, clear of the copy below
  tall: { target: [0.8, -3.8, 0], shapeA: [16, 3.0, 0.16, 0.45], shapeB: [1.7, 1.8, -0.62, 0.07], eye: [0, 0, 25], focus: { distance: 25, range: 7, edge: 0.75, blur: 2.2 } },
};
