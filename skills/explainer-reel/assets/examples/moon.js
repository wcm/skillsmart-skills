/*
 * The Moon is drifting away: a night sky in silver, violet and laser green.
 * Rhythm: a full cover (a huge cratered Moon turning over Earth's glowing rim) → the Moon dissolves into a line
 * of particles that becomes a ruler (empty, focused) → the particles split into the Moon and a fingertip → the
 * lunar surface with Apollo 11's mirror panel, Earth turning in the sky (detailed) → a laser of particles there
 * and back (busy) → a tiny figure looking up (empty) → back to the cover.
 *
 * The numbers, checked:
 * - The Moon recedes about 3.8 cm a year (lunar laser ranging since 1969).
 * - Fingernails grow about 3–3.5 mm a month, roughly 3.5–4 cm a year: "as fast as".
 * - Apollo 11, 14 and 15 left retroreflectors; Apollo 11's panel holds 100 corner-cube mirrors. Observatories
 *   still fire (green, 532 nm) laser pulses at them; light takes about 2.5 s there and back.
 */
export default {
  title: "The Moon is drifting away",
  look: "halftone",
  palette: "aurora",
  colors: { bg: "#06070c" },
  sound: { bed: "night" },
  // the narrator: a voice and how it should read (references/voice.md)
  voice: {
    voice: "Callirrhoe",
    style: "A gentle young woman, speaking slowly and softly, close to the microphone: relaxed, warm and intimate, like quietly telling one person a calm story at night. A soft, low, rounded pitch, never high or sharp. Unhurried, with natural pauses between sentences. Clear spoken voice, not a whisper.",
  },

  build({ beat, pause, add, clear, S, cx }) {
    const draw = (sh, o) => add.line(sh, { width: 1.6, tip: false, ...o });
    const ring = (x, y, r) => `M${x + r} ${y} A${r} ${r} 0 1 1 ${x - r} ${y} A${r} ${r} 0 1 1 ${x + r} ${y} Z`;
    const MOON = [540, 740], MR = 390;

    // the cover: a huge cratered Moon, lit from the left, turning slowly over Earth's glowing rim
    const cover = (when, how = "cut") => {
      const moon = add.shape3d({ kind: "sphere", x: MOON[0], y: MOON[1], r: MR, count: 20000, craters: 34, size: 1.9, color: "ink", spin: 5, tilt: 12, light: [-0.55, -0.25, 0.8], at: when, in: how, seed: 9 });
      add.particles({ kind: "stars", x: cx, y: 760, w: 1080, h: 1500, count: 170, size: 1.7, color: "ink", at: when, in: how });
      draw(S.arc(2400, -16, 16), { x: cx, y: 1290 + 2400, color: "info", width: 2, at: when, in: how });
      add.swarm({ shape: S.arc(2400, -16, 16), x: cx, y: 1290 + 2400, count: 1800, jitter: 26, size: 2, color: "info", drift: 3, at: when, in: how });
      return moon;
    };

    // the cover is there from the very first frame (it's the thumbnail)
    let dust;
    const moon = cover(-0.05);
    beat("The *Moon* is drifting away.", { hold: 0.4 }, () => {
      add.text("[ 384,400 KM ]", { x: cx, y: 210, size: 21, color: "dim", at: "Moon" });
      moon.to({ y: MOON[1] - 70, scale: 0.8 }, { at: "drifting", dur: 3 });
      // the dust the Moon will turn into, waiting where it will be
      dust = add.swarm({ shape: { kind: "disc", x: MOON[0], y: MOON[1] - 70, r: MR * 0.8 }, count: 3600, size: 2.2, color: "ink", mix: { color: "calm", share: 0.25 }, in: false });
    });

    /* empty and focused: the Moon dissolves into a line, the line becomes a ruler */
    let ruler;
    beat("*3.8 centimeters* a year,", () => {
      clear({ keep: [dust], dur: 0.6 });
      dust.in("fade", { at: "start", dur: 0.4 });
      dust.form({ kind: "line", x1: 190, y1: 1040, x2: 890, y2: 1040, spread: 5 }, { at: "start", delay: 0.3, dur: 1.6, from: "center", swirl: 160 });
      ruler = add.ruler({ x: cx, y: 1040, w: 700, ticks: 50, major: 10, labels: { 0: "0", 0.2: "1", 0.4: "2", 0.6: "3", 0.8: "4", 1: "5 CM" }, marker: 0, color: "ink", at: "3.8", delay: 0.9 });
      ruler.move(0.76, { at: "3.8", delay: 1.2, dur: 1.2 });
      add.counter({ x: cx, y: 820, from: 0, to: 3.8, dur: 1.6, format: (v) => `${v.toFixed(1)} CM`, size: 96, color: "accent", at: "3.8" });
      add.text("EVERY YEAR", { x: cx, y: 900, size: 22, color: "dim", at: "year" });
    });

    /* the pair: the particles split into the Moon and a fingertip */
    const finger = "M-40 100 L-40 -20 C-40 -72 40 -72 40 -20 L40 100 Z";
    beat("as fast as your *fingernails* grow.", { hold: 0.5 }, () => {
      dust.form(S.merge(S.place(S.circle(100), { x: 270, y: 470, scale: 1.25 }), S.place(S.path(finger), { x: 800, y: 470, scale: 2.1 })), { x: 0, y: 0, at: "as", dur: 1.6, shade: "light", edge: 0.3, swirl: 120 });
      draw(S.circle(125), { x: 270, y: 470, color: "ink", width: 2, at: "fast", delay: 0.4, tip: true });
      draw(S.path("M-40 100 L-40 -20 C-40 -72 40 -72 40 -20 L40 100"), { x: 800, y: 470, scale: 2.1, color: "ink", width: 2.4, at: "fingernails", tip: true });
      draw(S.path("M-27 -18 C-27 -52 27 -52 27 -18 L27 8 C10 14 -10 14 -27 8 Z"), { x: 800, y: 470, scale: 2.1, color: "calm", width: 2.4, at: "fingernails", delay: 0.4, hatch: { gap: 6, angle: 60, color: "calm" } });
      add.text("≈", { x: cx, y: 480, size: 80, color: "dim", at: "fast" });
      add.text("3.8 CM A YEAR", { x: 270, y: 670, size: 22, color: "ink", at: "grow" });
      add.text("~3.5 MM A MONTH", { x: 800, y: 700, size: 22, color: "calm", at: "grow" });
    });

    /* detailed: the lunar surface, Apollo 11's mirror panel, Earth turning in a black sky */
    const P = [540, 860];
    beat("*Apollo* left *mirrors* up there,", () => {
      clear({ keep: [dust] });
      dust.form(S.arc(3000, -11, 11), { x: cx, y: 1070 + 3000, at: "start", dur: 1.4, jitter: 70, swirl: 100, from: "left" });
      draw(S.arc(3000, -12, 12), { x: cx, y: 1060 + 3000, color: "ink", width: 2, at: "start", dur: 1 });
      [[-330, 1120, 70, 14], [250, 1150, 90, 18], [-60, 1190, 46, 10], [390, 1098, 40, 8]].forEach(([x, y, rx, ry], i) => draw(S.ellipse(rx, ry), { x: cx + x, y, color: "ink", width: 1.6, at: "start", delay: 0.3 + i * 0.1, hatch: { gap: 5, angle: 0, shade: "light", light: [0, 1], cross: false } }));
      add.shape3d({ kind: "globe", x: 830, y: 330, r: 80, color: "info", spin: 18, tilt: 22, width: 1.3, at: "start", delay: 0.3 });
      add.shape3d({ kind: "sphere", x: 830, y: 330, r: 80, count: 1600, color: "info", spin: 18, tilt: 22, size: 1.6, light: [-0.6, -0.2, 0.75], at: "start", delay: 0.3 });
      add.text("EARTH", { x: 830, y: 440, size: 21, color: "info", at: "start", delay: 0.6 });
      add.particles({ kind: "stars", x: cx, y: 520, w: 1080, h: 800, count: 90, size: 1.6, color: "ink", at: "start" });
      const cubes = [];
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) cubes.push(ring(-90 + 20 * i, -45 + 10 * j, 3.8));
      draw(S.path("M-104 -54 L104 -54 L104 54 L-104 54 Z"), { x: P[0], y: P[1], scale: 1.9, rot: -8, color: "ink", width: 2.8, at: "Apollo", dur: 0.8, tip: true, hatch: { gap: 5, angle: -8, shade: "flat", alpha: 0.35, cross: false } });
      draw(S.path(cubes.join(" ")), { x: P[0], y: P[1], scale: 1.9, rot: -8, color: "accent", width: 1.5, at: "mirrors", dur: 1, dots: { shade: "sphere", color: "accent", alpha: 0.4 } });
      draw(S.path("M-74 54 L-88 124 M74 54 L88 124 M-88 124 L-104 124 M88 124 L104 124 M0 54 L0 100"), { x: P[0], y: P[1], scale: 1.9, rot: -8, color: "ink", width: 2.2, at: "Apollo", delay: 0.4 });
      add.text("[ APOLLO 11 · 1969 ]", { x: 270, y: 640, size: 22, color: "ink", at: "Apollo", delay: 0.2 });
      add.text("100 MIRRORS", { x: cx, y: 1250, size: 22, color: "accent", at: "mirrors", delay: 0.3 });
    });

    /* busy: a beam of green particles from Earth to the panel and back */
    beat("and we still bounce *lasers* off them.", { hold: 0.5 }, () => {
      const E = [830, 330], H = [P[0] + 30, P[1] - 40];
      const beam = add.swarm({ shape: { kind: "point", x: E[0], y: E[1], r: 6 }, count: 2200, size: 2.2, color: "accent", drift: 1.5, at: "lasers" });
      beam.form({ kind: "line", x1: E[0], y1: E[1], x2: H[0], y2: H[1], spread: 10 }, { at: "lasers", dur: 1.1, from: "top", stagger: 0.7, swirl: 10, order: "random" });
      const path = S.path(`M${E[0]} ${E[1]} L${H[0]} ${H[1]} L${E[0] - 26} ${E[1] + 18}`);
      add.flow(path, { color: "accent", count: 5, speed: 0.55, size: 6, at: "lasers", delay: 0.5 });
      add.particles({ kind: "burst", x: H[0], y: H[1], r: 220, count: 90, size: 2.4, color: "accent", at: "off" });
      add.pulse({ x: H[0], y: H[1], r0: 20, r1: 260, count: 2, color: "accent", at: "off" });
      add.counter({ x: 250, y: 330, from: 0, to: 2.5, dur: 2.5, format: (v) => `${v.toFixed(1)} S`, size: 52, color: "accent", at: "lasers" });
      add.text("THERE AND BACK", { x: 250, y: 388, size: 21, color: "dim", at: "lasers", delay: 0.2 });
    });

    /* empty: a tiny figure on Earth's horizon, a small Moon high above */
    let small, sight;
    beat("So tonight, *look up.*", { hold: 0.3 }, () => {
      clear({ dur: 0.7 });
      draw(S.arc(2400, -16, 16), { x: cx, y: 1200 + 2400, color: "ink", width: 1.6, at: "start", dur: 1.2 });
      add.particles({ kind: "stars", x: cx, y: 640, w: 1040, h: 860, count: 50, size: 1.6, color: "ink", at: "start" });
      small = add.shape3d({ kind: "sphere", x: cx, y: 470, r: 80, count: 3200, craters: 12, size: 1.5, color: "ink", spin: 5, tilt: 12, light: [-0.85, -0.25, 0.55], at: "start", seed: 9 });
      draw(S.path("M0 -100 C-12 -100 -18 -91 -18 -81 C-18 -71 -12 -64 -6 -62 L-6 -56 C-18 -54 -30 -51 -33 -42 L-40 18 C-41 24 -34 25 -33 19 L-26 -24 L-25 8 L-22 96 C-22 100 -10 100 -10 96 L-3 22 L3 22 L10 96 C10 100 22 100 22 96 L25 8 L26 -24 L33 19 C34 25 41 24 40 18 L33 -42 C30 -51 18 -54 6 -56 L6 -62 C12 -64 18 -71 18 -81 C18 -91 12 -100 0 -100 Z"), { x: cx, y: 1112, scale: 0.85, color: "ink", width: 2.6, stroke: "dotted", gap: 6, at: "tonight", dur: 0.9 });
      sight = draw(S.line(0, 0, 0, -420), { x: cx, y: 1000, color: "calm", width: 1.8, stroke: "dotted", gap: 10, at: "look", dur: 1.2 });
    });

    beat("It's a little *further* away.", () => {
      small.to({ y: 440, scale: 0.9 }, { at: "further", dur: 2 });
      sight.to({ scale: 1.07 }, { at: "further", dur: 2 });
      add.text("+ 3.8 CM", { x: cx + 150, y: 380, size: 22, color: "accent", at: "further", delay: 0.4 });
    });
    // home: the cover again
    pause(1.6, () => {
      clear({ at: 0.1, dur: 0.6 });
      cover(0.4, "fade");
    });
  },
};
