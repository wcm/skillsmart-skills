/*
 * A reel: the script as beats, each with the one picture or change it brings.
 * Check:  node <skill>/scripts/check.mjs <this file>     Voice: node <skill>/scripts/voice.mjs <this file>
 * Make:   node <skill>/scripts/make.mjs <this file> --format 9x16
 */
export default {
  title: "3 things about TOPIC",
  look: "halftone", // halftone · led · crt · neon · riso · blueprint · dither · chalk
  palette: "ember", // or leave out for the look's own
  dots: 3, // progress dots for a numbered list; for anything else delete this and the "*One.*" beats
  sound: { bed: "warm" }, // warm · night · bright · tense · none
  // the narrator (references/voice.md): a Gemini voice and how it should read
  voice: { voice: "Callirrhoe", style: "Calm, warm and close to the microphone, unhurried, with natural pauses between sentences." },

  build({ beat, pause, add, clear, dots, S, cx }) {
    // one swarm of particles carries the subject from scene to scene; the cover is formed from the first frame
    const NUM = { x: cx, y: 820, scale: 3.6 };
    const swarm = add.swarm({ shape: S.number("3"), ...NUM, count: 4000, jitter: 6, size: 2.4, color: "accent", mix: { color: "ink", share: 0.2 }, in: "cut", at: -0.05 });
    const keep = (...more) => ({ keep: [swarm, ...more] });

    beat("*3* things nobody tells you about TOPIC");
    beat("and why they *matter.*", () => {
      add.text("[ TOPIC ]", { x: cx, y: 1180, size: 22, color: "dim", at: "matter" });
    });

    // busy: the swarm becomes the first subject, big and shaded, with a label at the edge
    beat("*One.*", () => { clear(keep()); dots.set(1); });
    beat("The first idea, with its *keyword.*", () => {
      swarm.form(S.circle(100), { x: cx, y: 820, scale: 2.8, at: "first", dur: 1.6, shade: "sphere", edge: 0.3 });
      add.line(S.circle(100), { x: cx, y: 820, scale: 2.8, width: 2.4, at: "first", delay: 0.8 });
      add.label("LABEL", { from: [cx + 160, 700], to: [800, 450], sub: "ONE FACT", color: "accent", at: "keyword" });
    });

    // empty and focused: the swarm scatters away; one number on black
    beat("*Two.*", () => { clear(keep()); dots.set(2); swarm.scatter({ at: "Two", dur: 1.4 }); swarm.out("fade", { at: "Two", delay: 0.8 }); });
    beat("A number that *counts.*", () => {
      add.counter({ x: cx, y: 820, from: 0, to: 30, dur: 1.4, size: 140, color: "accent", at: "counts" });
      add.text("SECONDS", { x: cx, y: 930, size: 24, color: "dim", at: "counts", delay: 0.3 });
    });

    // busy: a flow field streams across while a chart shows the change
    beat("*Three.*", () => { clear(keep()); dots.set(3); });
    beat("A change you can *see.*", () => {
      add.flowfield({ kind: "stream", x: cx, y: 820, w: 1080, h: 700, count: 300, speed: 160, color: "info", width: 1.2, alpha: 0.6, at: "change" });
      add.chart({ y: 820, data: "chaos", title: "BEFORE", color: "alert", at: "change" }).morph("sine", { at: "see", color: "life" });
    });

    beat("*Save this* for later.", () => {
      clear(keep());
      add.pill("Save this", { icon: "bookmark", at: "Save" }).swap("Saved", { at: "later" });
    });
    // end where it began, so the reel loops: the swarm gathers back into the cover
    pause(1.8, () => {
      clear({ ...keep(), at: 0.1 });
      dots.set(0, { at: 0.2 });
      swarm.to({ opacity: 1 }, { at: 0.1, dur: 0.5 });
      swarm.form(S.number("3"), { ...NUM, at: 0.1, dur: 1.5, jitter: 6 });
    });
  },
};
