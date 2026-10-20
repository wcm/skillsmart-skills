/*
 * The 20-20-20 rule: warm gold on charcoal.
 * Rhythm: a full cover ("20 20 20" made of thousands of gold particles in a drifting dust field) → the particles
 * pour into a glowing screen with a 20-minute arc → they scatter away and leave an almost empty horizon: an eye,
 * a line of sight, a tree 20 feet away → a big 20-second countdown in the empty sky → the key subject in full
 * detail: an eye in cross-section, engraved, light streaming in to focus as the lens flattens → a closed eye at
 * rest → the particles gather back into the cover.
 *
 * The claim, checked: the American Academy of Ophthalmology recommends the 20-20-20 rule for digital eye strain.
 * Looking far away relaxes the ciliary muscle and the lens flattens (accommodation released).
 */
export default {
  title: "The 20-20-20 rule",
  look: "halftone",
  palette: "ember",
  dots: 3,
  sound: { bed: "warm" },
  // the narrator: a voice and how it should read (references/voice.md)
  voice: {
    voice: "Callirrhoe",
    style: "A gentle young woman, speaking slowly and softly, close to the microphone: relaxed, warm and intimate, like quietly telling one person a calm story at night. A soft, low, rounded pitch, never high or sharp. Unhurried, with natural pauses between sentences. Clear spoken voice, not a whisper.",
  },

  build({ beat, pause, add, clear, dots, S, cx }) {
    const draw = (sh, o) => add.line(sh, { width: 1.6, tip: false, ...o });
    const NUM = { x: cx, y: 800, scale: 3.95 };
    const digits = S.number("20 20 20");

    // the gold that does the work: 5,000 particles that start as the rule itself
    const gold = add.swarm({ shape: digits, ...NUM, count: 5200, jitter: 7, size: 2.4, color: "accent", mix: { color: "ink", share: 0.18 }, drift: 2.5, in: "cut", at: -0.05 });
    const labels = (when, how = "cut") => [["MINUTES", 247], ["FEET", 540], ["SECONDS", 833]].map(([w, x], i) => add.text(w, { x, y: 975, size: 22, color: "dim", at: when, in: how, delay: how === "cut" ? 0 : 0.6 + i * 0.15 }));
    const dust = (when, how = "cut") => add.flowfield({ kind: "curl", x: cx, y: 820, w: 1080, h: 1300, count: 260, life: 3, trail: 14, speed: 60, color: "accent", width: 1.1, alpha: 0.45, at: when, in: how });

    // the cover is there from the very first frame (it's the thumbnail)
    labels(-0.05);
    dust(-0.05);
    beat("Try the *20-20-20* rule.", { hold: 0.5 }, () => {
      add.text("[ FOR TIRED EYES ]", { x: cx, y: 600, size: 22, color: "accent", at: "rule" });
      gold.form(digits, { ...NUM, at: "rule", dur: 1.4, swirl: 40, stagger: 0.5, from: "left", jitter: 7 });
    });

    /* the particles pour into a screen */
    beat("Every *20 minutes* at a screen,", () => {
      clear({ keep: [gold] });
      dots.set(1);
      gold.form(S.rect(560, 350, 20), { x: cx, y: 760, at: "Every", dur: 1.4, shade: "light", light: [0, -1], edge: 0.35, swirl: 120 });
      draw(S.rect(560, 350, 20), { x: cx, y: 760, color: "ink", width: 2.8, at: "Every", delay: 0.6, dur: 0.9, tip: true });
      draw(S.path("M-40 175 L-64 250 L64 250 L40 175"), { x: cx, y: 760, color: "ink", width: 2.2, at: "Every", delay: 0.9 });
      draw(S.circle(108), { x: cx, y: 760, color: "ink", width: 1.4, at: "20" });
      add.ring({ x: cx, y: 760, r: 108, from: 0, to: 120, color: "accent", width: 9, at: "20", dur: 1.2 });
      add.text("20 MIN", { x: cx, y: 768, size: 28, color: "ink", at: "minutes" });
    });

    /* empty: the gold scatters away; an eye, a line of sight, a tree far off */
    const E = [190, 820], T = [880, 820];
    beat("look *20 feet* away", () => {
      clear({ keep: [gold] });
      dots.set(2);
      gold.scatter({ at: "look", dur: 1.4 });
      gold.out("fade", { at: "look", delay: 0.7, dur: 0.7 });
      draw(S.line(-480, 0, 480, 0), { x: cx, y: 960, color: "dim", width: 1.2, at: "look", dur: 1 });
      draw(S.eye(), { x: E[0], y: E[1], scale: 0.9, color: "ink", width: 2.4, at: "look", dur: 0.8, tip: true });
      draw(S.circle(30), { x: E[0], y: E[1], scale: 0.9, color: "accent", width: 2, at: "look", delay: 0.3, dots: { shade: "sphere", color: "accent", alpha: 0.6 } });
      draw(S.tree(), { x: T[0], y: T[1] + 40, scale: 0.75, color: "life", width: 2.2, at: "20", dur: 0.9 });
      draw(S.line(0, 0, T[0] - E[0] - 170, 0), { x: E[0] + 90, y: E[1], color: "accent", width: 2.2, stroke: "dotted", gap: 10, at: "20", dur: 1 });
      draw(S.path(`M${E[0]} 1040 L${T[0]} 1040 M${E[0]} 1024 L${E[0]} 1056 M${T[0]} 1024 L${T[0]} 1056`), { x: 0, y: 0, color: "ink", width: 1.4, at: "feet", dur: 0.7 });
      add.text("20 FT · 6 M", { x: cx, y: 1084, size: 22, color: "ink", at: "feet", delay: 0.3 });
    });

    beat("for *20 seconds.*", { hold: 0.5 }, () => {
      dots.set(3);
      add.timer({ x: cx, y: 500, r: 120, value: 20, countdown: 20, sweep: 2.8, label: "SECONDS", color: "accent", at: "20" });
      add.particles({ kind: "fall", x: cx, y: 500, w: 900, h: 700, count: 26, size: 1.6, color: "accent", speed: 0.4, at: "20" });
    });

    /* the key subject, in full: the eye in cross-section, light streaming in to focus as the lens flattens */
    const C = [520, 790], K = 3.3;
    let lens;
    beat("Your focusing muscle *lets go,*", () => {
      clear({ dur: 0.5 });
      draw(S.circle(84), { x: C[0], y: C[1], scale: K, color: "ink", width: 3, at: "Your", dur: 0.9, tip: true, hatch: { shade: "sphere", gap: 6, angle: -30, alpha: 0.55 } });
      draw(S.path("M70 -46 C98 -28 98 28 70 46"), { x: C[0], y: C[1], scale: K, color: "ink", width: 2.4, at: "Your", delay: 0.4 }); // cornea
      draw(S.path("M-64 -54 C-92 -28 -92 28 -64 54 L-60 50 C-86 26 -86 -26 -60 -50 Z"), { x: C[0], y: C[1], scale: K, color: "alert", width: 1.6, at: "Your", delay: 0.5, dots: { shade: "flat", color: "alert", alpha: 0.7 } }); // retina
      draw(S.path("M-84 -9 L-132 -12 M-84 9 L-132 12"), { x: C[0], y: C[1], scale: K, color: "ink", width: 2.4, at: "Your", delay: 0.6 }); // optic nerve
      draw(S.path("M52 -44 L52 -14 M52 14 L52 44"), { x: C[0], y: C[1], scale: K, color: "info", width: 4, at: "Your", delay: 0.7 }); // iris
      lens = draw(S.ellipse(14, 30), { x: C[0] + 40 * K, y: C[1], scale: K, color: "accent", width: 2.6, at: "focusing", dur: 0.6, dots: { shade: "sphere", color: "accent", alpha: 0.6 } });
      for (const s of [-1, 1]) {
        draw(S.ellipse(9, 13), { x: C[0] + 40 * K, y: C[1] + s * 48 * K, scale: K, color: "accent", width: 2.2, at: "muscle", hatch: { gap: 4, angle: 70, color: "accent", alpha: 0.8 } });
        draw(S.path(`M-4 ${s * -13} L-2 ${s * -19} M4 ${s * -13} L2 ${s * -19} M0 ${s * -13} L0 ${s * -19}`), { x: C[0] + 40 * K, y: C[1] + s * 48 * K, scale: K, color: "dim", width: 1.2, at: "muscle", delay: 0.2 });
      }
      add.label("CILIARY MUSCLE", { from: [C[0] + 40 * K, C[1] - 48 * K], to: [720, 330], color: "accent", at: "muscle", size: 22 });
      lens.morph(S.ellipse(7, 32), { at: "lets", dur: 1.2 });
      // far light: parallel rays streaming in, bending at the lens, meeting on the retina
      const rays = [-26, -13, 0, 13, 26].map((y) => S.path(`M${C[0] + 300 * K} ${C[1] + y * K} L${C[0] + 40 * K} ${C[1] + y * K} L${C[0] - 64 * K} ${C[1]}`));
      rays.forEach((r, i) => { draw(r, { x: 0, y: 0, color: "accent", width: 1, at: "go", delay: i * 0.05, dur: 0.9 }); add.flow(r, { color: "accent", count: 6, speed: 0.5, size: 3.5, at: "go", delay: 0.3 + i * 0.05 }); });
      add.orb({ x: C[0] - 64 * K, y: C[1], r: 9, color: "accent", at: "go", delay: 0.9 });
      add.text("LENS · FLATTENS", { x: C[0] + 40 * K, y: C[1] + 220, size: 22, color: "accent", at: "go", delay: 0.4 });
    });

    /* empty and calm: the eye closes */
    beat("and your eyes finally *rest.*", { hold: 0.5 }, () => {
      clear({ dur: 0.6 });
      draw(S.eyeClosed(), { x: cx, y: 780, scale: 2.6, color: "ink", width: 3, at: "eyes", dur: 1.2, tip: true });
      add.orb({ x: cx, y: 1010, r: 10, color: "accent", at: "rest" }).loop("breathe", { amp: 0.15, period: 3, at: "rest" });
    });

    /* the gold gathers back into the rule */
    let pill;
    beat("Save this for your next *long day.*", () => {
      gold.set({ opacity: 0 }, { at: "start" });
      gold.form({ kind: "cloud", x: cx, y: 800, w: 1200, h: 1500 }, { at: "start", dur: 0.01, order: "random" });
      gold.to({ opacity: 1 }, { at: "Save", dur: 0.8 });
      gold.form(digits, { ...NUM, at: "Save", dur: 2.4, swirl: 160, jitter: 7 });
      pill = add.pill("Save this", { icon: "bookmark", at: "Save" });
      pill.swap("Saved", { at: "day", icon: "check" });
    });
    pause(1.6, () => {
      clear({ keep: [gold], at: 0.1 });
      dots.set(0, { at: 0.2 });
      labels(0.2, "fade");
      dust(0.2, "fade");
    });
  },
};
