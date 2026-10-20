/*
 * Your body is rebuilding itself: silver on black, with red for the blood.
 * Rhythm: a full cover (a figure made of 7,000 particles, currents of light rising through it) → the particles
 * pour into the gut's villi → a busy stream of blood round a big turning red cell → empty: one thigh bone,
 * engraved → the particles fly from the bone back into the figure, new lights in it → a heart glowing, gently.
 * A thin timeline from a day to ten years runs under the middle three.
 *
 * The numbers, checked: the gut's lining (intestinal epithelium) turns over in about 3–5 days; red blood cells
 * live about 120 days; the adult skeleton is remodelled roughly every 10 years (about 10 % a year).
 * The body has about 37 trillion cells (Bianconi et al. 2013). Not every cell renews (most neurons don't),
 * so the script says "rebuilding" and "some of you".
 */
export default {
  title: "Your body is rebuilding itself",
  look: "halftone",
  palette: "mono",
  dots: 3,
  sound: { bed: "warm" },
  // the narrator: a voice and how it should read (references/voice.md)
  voice: {
    voice: "Callirrhoe",
    style: "A gentle young woman, speaking slowly and softly, close to the microphone: relaxed, warm and intimate, like quietly telling one person a calm story at night. A soft, low, rounded pitch, never high or sharp. Unhurried, with natural pauses between sentences. Clear spoken voice, not a whisper.",
  },

  build({ beat, pause, add, clear, dots, S, cx }) {
    const draw = (sh, o) => add.line(sh, { width: 1.6, tip: false, ...o });
    const figure = S.path("M0 -100 C-12 -100 -18 -91 -18 -81 C-18 -71 -12 -64 -6 -62 L-6 -56 C-18 -54 -30 -51 -33 -42 L-40 18 C-41 24 -34 25 -33 19 L-26 -24 L-25 8 L-22 96 C-22 100 -10 100 -10 96 L-3 22 L3 22 L10 96 C10 100 22 100 22 96 L25 8 L26 -24 L33 19 C34 25 41 24 40 18 L33 -42 C30 -51 18 -54 6 -56 L6 -62 C12 -64 18 -71 18 -81 C18 -91 12 -100 0 -100 Z");
    const FIG = { x: cx, y: 800, scale: 4.1 };

    // the body: 7,000 particles; the same particles become every tissue
    const body = add.swarm({ shape: figure, ...FIG, count: 7000, edge: 0.3, shade: "light", light: [-0.4, -1], size: 2.1, color: "ink", mix: { color: "alert", share: 0.06 }, drift: 4, in: "cut", at: -0.05 });
    const figureDetail = (when, how = "cut") => {
      draw(figure, { ...FIG, color: "ink", width: 2.4, stroke: "dotted", gap: 8, at: when, in: how });
      add.flowfield({ kind: "stream", dir: [0, -1], x: FIG.x, y: FIG.y + 40, w: 150, h: 700, count: 90, life: 2.2, trail: 10, speed: 120, noise: 0.01, color: "ink", width: 1.2, at: when, in: how });
    };

    // the cover is there from the very first frame (it's the thumbnail)
    figureDetail(-0.05);
    beat("Your body is *rebuilding* itself.", { hold: 0.3 }, () => {
      add.text("[ 37 TRILLION CELLS ]", { x: cx, y: 1280, size: 22, color: "dim", at: "rebuilding", delay: 0.3 });
      body.form(figure, { ...FIG, at: "rebuilding", dur: 1.6, edge: 0.3, shade: "light", light: [-0.4, -1], swirl: 50, from: "bottom", order: "random" });
    });

    /* the timeline: a day to ten years (log scale), kept under the next three lines */
    const TL = { x0: 150, x1: 860, y: 1250 };
    const tx = (days) => TL.x0 + (Math.log10(days) / Math.log10(3650)) * (TL.x1 - TL.x0);
    const tl = [];
    const mark = (days, label, when, color = "ink", dx = 0) => {
      tl.push(add.orb({ x: tx(days), y: TL.y, r: 7, color, at: when }));
      add.text(label, { x: tx(days) + dx, y: TL.y - 46, size: 22, color, at: when, delay: 0.3 });
    };
    const P = { x: cx, y: 700 };

    /* the particles pour into the gut's villi */
    beat("Your gut lining, every *few days.*", { hold: 0.3 }, () => {
      clear({ keep: [body] });
      dots.set(1);
      tl.push(draw(S.line(TL.x0, TL.y, TL.x1, TL.y), { x: 0, y: 0, color: "dim", width: 1.4, at: "Your", dur: 1 }));
      [[1, "1 D"], [7, "1 W"], [30, "1 M"], [365, "1 Y"], [3650, "10 Y"]].forEach(([d, s], i) => {
        tl.push(draw(S.line(0, -8, 0, 8), { x: tx(d), y: TL.y, color: "dim", width: 1.4, at: "Your", delay: 0.2 + i * 0.08 }));
        tl.push(add.text(s, { x: tx(d), y: TL.y + 40, size: 20, color: "dim", at: "Your", delay: 0.3 + i * 0.08 }));
      });
      let d = "M-160 80 L-160 -10";
      [74, 104, 86, 112, 92, 106, 80].forEach((h, i) => {
        const x = -160 + i * 46;
        d += ` L${x} ${-h + 18} C${x} ${-h - 8} ${x + 32} ${-h - 8} ${x + 32} ${-h + 18} L${x + 32} -10${i < 6 ? ` L${x + 46} -10` : ""}`;
      });
      const villi = S.path(`${d} L166 80 Z`);
      body.form(villi, { ...P, scale: 2.4, at: "Your", dur: 1.6, edge: 0.35, shade: "light", light: [0, -1], swirl: 140 });
      draw(villi, { ...P, scale: 2.4, color: "ink", width: 2.6, at: "gut", dur: 1.1, tip: true });
      draw(S.path("M-160 50 C-80 40 80 60 166 48 M-160 66 C-60 60 60 74 166 64"), { ...P, scale: 2.4, color: "dim", width: 1.2, at: "gut", delay: 0.5 });
      add.text("[ GUT LINING ]", { x: cx, y: 380, size: 22, color: "ink", at: "gut", delay: 0.3 });
      mark(4, "3–5 DAYS", "few");
    });

    /* busy: blood streaming past one big red cell, turning */
    beat("Your red blood cells, every *four months.*", { hold: 0.3 }, () => {
      clear({ keep: [body, ...tl] });
      dots.set(2);
      body.scatter({ at: "start", dur: 1.2 });
      body.out("fade", { at: "start", delay: 0.6, dur: 0.6 });
      add.flowfield({ kind: "stream", dir: [1, 0.12], x: cx, y: 700, w: 1080, h: 900, count: 420, life: 2.2, trail: 12, speed: 220, noise: 0.003, color: "alert", width: 1.4, at: "Your" });
      add.shape3d({ kind: "torus", x: cx, y: 700, r: 250, count: 9000, major: 0.7, minor: 0.3, tilt: 62, spin: 24, size: 2, color: "alert", light: [-0.5, -0.6, 0.65], at: "red" });
      add.text("[ RED BLOOD CELLS ]", { x: cx, y: 380, size: 22, color: "alert", at: "red", delay: 0.3 });
      mark(120, "~120 DAYS", "four", "alert");
    });

    /* empty: one bone, engraved */
    const bone = S.path("M-14 -70 C-30 -86 -34 -100 -20 -104 C-10 -108 -4 -98 0 -92 C4 -98 10 -108 20 -104 C34 -100 30 -86 14 -70 L12 70 C30 86 34 100 20 104 C10 108 4 98 0 92 C-4 98 -10 108 -20 104 C-34 100 -30 86 -12 70 Z");
    const BONE = { x: cx, y: 720, scale: 3.4, rot: -32 };
    beat("Your skeleton, every *ten years.*", { hold: 0.3 }, () => {
      clear({ keep: [body, ...tl] });
      dots.set(3);
      draw(bone, { ...BONE, color: "ink", width: 3, at: "skeleton", dur: 1.2, tip: true, hatch: { gap: 5, angle: 58, light: [-0.6, -0.8], alpha: 0.85 } });
      draw(S.path("M-10 -86 L4 -76 L-6 -66 M8 -92 L-2 -80 M-8 82 L6 72 L-4 62 M6 90 L-4 78 M-6 -40 C-2 -10 -2 20 -6 50"), { ...BONE, color: "dim", width: 1.3, at: "skeleton", delay: 0.8 });
      add.text("[ SKELETON ]", { x: cx, y: 345, size: 22, color: "ink", at: "skeleton", delay: 0.3 });
      mark(3650, "~10 YEARS", "ten", "ink", -60);
      // the particles wait, unseen, inside the bone
      body.form(bone, { ...BONE, at: "skeleton", dur: 0.01, edge: 0.4 });
    });

    /* the particles fly from the bone back into the figure; new lights in it */
    beat("Some of you is *new* today.", { hold: 0.3 }, () => {
      clear({ keep: [body], dur: 0.6 });
      body.to({ opacity: 1 }, { at: "Some", dur: 0.5 });
      body.form(figure, { ...FIG, at: "Some", dur: 1.8, edge: 0.3, shade: "light", light: [-0.4, -1], swirl: 160, from: "top" });
      figureDetail("Some", "fade");
      for (const [x, y, d] of [[-30, -70, 0], [25, 10, 0.25], [-12, 60, 0.5], [20, -30, 0.7], [-24, 20, 0.9]]) add.orb({ x: FIG.x + x * FIG.scale, y: FIG.y + y * FIG.scale, r: 8, halo: 5, color: "accent", at: "new", delay: d });
      add.text("[ TODAY ]", { x: cx, y: 1280, size: 22, color: "accent", at: "today" });
    });
    beat("Be *gentle* with it.", () => {
      add.orb({ x: FIG.x - 4 * FIG.scale, y: FIG.y - 36 * FIG.scale, r: 14, halo: 6, color: "alert", at: "gentle" }).loop("breathe", { amp: 0.14, period: 2.4, at: "gentle" });
    });
    // home: the cover again
    pause(1.3, () => {
      clear({ keep: [body], at: 0.1 });
      dots.set(0, { at: 0.2 });
      figureDetail(0.3, "fade");
    });
  },
};
