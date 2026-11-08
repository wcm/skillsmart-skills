// The four looks of the example pages, as option sets to start a page from: options: { ...looks.dust, frame, … }.
// Each is one feeling on the same engine; mix and change anything (references/looks.md says what each option does).
const small = typeof innerWidth === "number" && innerWidth < 760;

export const looks = {
  // bone-white dust on black, a wind taking grains off one side; swarm changes (Fauna: a museum)
  dust: {
    background: "#060606",
    mono: 0.88, tint: "#f4e7d2",
    exposure: 1.05, relief: 0.85,
    wind: { amount: 0.55, angle: 0.08, x: 0.3, y: 0 },
    travel: "swarm",
  },
  // coloured ink on cream paper; each subject evaporates into a mist of its colours, the next condenses (Herbier: perfume)
  ink: {
    ink: true, background: "#f1eadf",
    exposure: 1.0, relief: 0.55,
    travel: "swarm", kick: 0.7, air: 1.1, blur: 0.2, spread: 0.9, gather: 1.6,
    order: { dir: [0, 1, 0.2], jitter: 0.55 },
    vignette: 0.22, grain: 0.008, sway: 0.7, parallax: 0.7,
    hand: { reach: 0.135, drag: 8, spread: 2.2, still: 0.04, depth: 0.7 },
  },
  // neon dust on near-black with coloured lights in it, streaks, the pointer as a warm light; the page shows through,
  // so a title can stand behind the dust (Afterglow: a festival). Animate the lights with beatLamps() below.
  neon: {
    transparent: true, background: "#0b0611",
    saturation: 1.18, exposure: 1.2, relief: 0.75,
    travel: "swarm", kick: 2.6, spread: 0.45, gather: 1.2, blur: 0.14, flightDim: 0.62,
    lamps: [
      { color: "#ff2e93", x: 0, y: 0, z: 0, power: 0, core: 0.55 },
      { color: "#ffa83a", x: 0, y: 0, z: 0, power: 0, core: 0.55 },
      { color: "#8a5cff", x: 0, y: 0, z: 0, power: 0, core: 0.45 },
    ],
    hot: "#ffc871", hotPower: 0.75,
    streaks: true, grain: 0.02,
    hand: { reach: 0.16, drag: 10, spread: 2.3, still: 0.05, depth: 1.2 },
  },
  // a light one-colour print: fine orange dots on off-white that never pile darker than the ink; one subject melts into
  // the next along matched dots, a scan line sweeps the depth (Stride: sneakers)
  print: {
    ink: true, background: "#f3f2ee",
    mono: 1, inkColor: "#ff5a1f", inkCap: 3.22,
    levels: { lo: 0.02, hi: 0.98, gamma: 1.9 },
    disc: true, count: small ? 1 << 17 : 1 << 18, size: 0.8,
    exposure: 0.55, relief: 0.5, scan: true,
    travel: "melt", spread: 0.8, gather: 1.2, blur: 0.08,
    order: { dir: [1, 0, 0], jitter: 0.25 },
    vignette: 0.15, grain: 0.01, sway: 0.6, parallax: 0.8,
    hand: { reach: 0.135, drag: 9, spread: 2.0, still: 0.05, depth: 0.8 },
  },
};

// The neon look's lights: they circle the subject on their own paths, one flashes on each beat and all of them on the
// first beat of each bar group. Call it from stage()'s onFrame: beatLamps(e, { bpm: 118 }).
export function beatLamps(engine, { bpm = 118, every = 12 } = {}) {
  const t = engine.time, beatLen = 60 / bpm, beat = Math.floor(t / beatLen), ph = (t / beatLen) % 1;
  engine.lampState.forEach((l, k) => {
    const a = t * (0.3 + 0.07 * k) + k * 2.1;
    l.x = 1.05 * Math.cos(a);
    l.y = 0.75 * Math.sin(a * 1.3 + k);
    l.z = 0.45 * Math.sin(a * 0.8 + k * 1.7);
    const mine = beat % engine.lampState.length === k || beat % every === 0;
    l.power = 0.12 + (mine ? 0.75 : 0.1) * Math.exp(-ph * 5.5);
  });
  return beat;
}
