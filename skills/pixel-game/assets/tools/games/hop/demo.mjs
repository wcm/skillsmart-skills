// Pixel Hop's demo video: node demo.mjs hop. The title, the autopilot's first stretch, a cut to a
// faster road, then hands off: the crash, the result and the replay.
export const duckers = []; // main ducks the music itself on a crash (logged), so nothing here

export const videos = {
  hop: {
    async run(r) {
      await r.act(() => {
        R.seeds.push(20261019);
        __fr.game.auto = 1;
        __alog.length = 0; // the menu clicks
      });
      await r.rec(1.6);
      await r.act(() => __fr.tap());
      await r.rec(10);
      await r.skip("w.score >= 28 || g.state === 'over'", 120);
      await r.rec(6);
      await r.act(() => __fr.game.world.takeOver());
      await r.rec(8, "g.state === 'over'");
      await r.rec(3);
      await r.act(() => __fr.press('replay'));
      await r.rec(8, "g.state === 'over'");
      await r.rec(1.2);
    },
  },
};
