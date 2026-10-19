// Flappy Roadster's demo videos: node demo.mjs roadster (all four) or node demo.mjs fly kickflip tunnel launch.
// Sounds that silence the music by themselves, so the soundtrack's replay knows: the crash, the false start.
export const duckers = ['crash', 'foul'];

// Flappy Roadster: one of its games on the Cinema autopilot, then the crash and the killcam.
async function roadsterSetup(r, game, mode, seed) {
  await r.act(
    ([game, mode, seed]) => {
      R.seeds.push(seed);
      __fr.press('game' + game);
      __fr.press('mode' + mode);
      const g = __fr.game;
      g.auto = 2;
      g.eta = 2028;
      g.delays = 0;
      __alog.length = 0; // the menu clicks
    },
    [game, mode, seed]
  );
}
// Hand back control, crash, the stamp and scoreboard, the killcam, the scoreboard again.
async function roadsterCrash(r, msg) {
  await r.rec(1.2);
  await r.act(() => {
    __fr.game.world.auto = false;
  });
  await r.rec(8, "g.state === 'over'");
  if (msg) await r.act((m) => (__fr.game.run.msg = m), msg);
  await r.rec(2.4);
  await r.act(() => __fr.press('replay'));
  await r.rec(12, "g.state === 'over'");
  await r.rec(3.2);
}

export const videos = {
  // FLY: the liftoff, the five-Tesla tower and its kickflip, close calls, Ludicrous, then a
  // look at each zone (Skyway, low Earth orbit, Mars) on the way to a crash.
  fly: {
    async run(r) {
      await roadsterSetup(r, 0, 1, 20261015);
      await r.rec(1.4);
      await r.act(() => __fr.tap());
      await r.rec(14, 'w.score >= 6');
      // Ludicrous whenever it comes (once): every skip stops for it.
      let ludi = await r.peek('w.ludi > 0');
      if (ludi) await r.rec(4.6);
      const skipTo = async (cond) => {
        await r.skip(ludi ? `(${cond}) || g.state === 'over'` : `(${cond}) || w.ludi > 0 || g.state === 'over'`, 120);
        if (!ludi && (await r.peek(`w.ludi > 0 && !(${cond})`))) {
          ludi = true;
          await r.rec(4.6);
          await skipTo(cond);
        }
      };
      for (const [zone, before, after] of [
        [1, 9, 3],
        [2, 19, 4.5],
        [3, 29, 3.5],
      ]) {
        await skipTo(`w.score >= ${before}`);
        await r.rec(8, `w.zone >= ${zone}`);
        await r.rec(after);
      }
      await roadsterCrash(r);
    },
  },
  // KICKFLIP: rush-hour traffic in Ludicrous mode, kickflips over it, the five-Tesla lineup,
  // then the bail.
  kickflip: {
    async run(r) {
      await roadsterSetup(r, 1, 2, 20261015);
      await r.rec(1.4);
      await r.act(() => __fr.tap());
      // The opening jumps and the lineup (the fifth wave, so it comes early), all of it.
      await r.rec(24, "g.state === 'over' || (w.traffic && w.traffic.some((v) => v.lineup) && w.traffic.every((v) => !v.lineup || v.scored))");
      await r.rec(5);
      await roadsterCrash(r);
    },
  },
  // TUNNEL: flipping between floor and ceiling, faster and faster, then the fall.
  tunnel: {
    async run(r) {
      await roadsterSetup(r, 2, 2, 20261015);
      await r.rec(1.4);
      await r.act(() => __fr.tap());
      await r.rec(12);
      await r.skip("w.score >= 180 || g.state === 'over'", 120);
      await r.rec(7);
      await roadsterCrash(r);
    },
  },
  // 0-60: a 0.12 s launch that beats Tesla's 0.81 s, a jumped light, and the robot.
  launch: {
    async run(r) {
      await roadsterSetup(r, 3, 1, 20261015);
      await r.act(() => (__fr.game.auto = 0));
      await r.rec(1.4);
      await r.act(() => __fr.tap());
      await r.rec(8, 'w.greenShownAt');
      await r.rec(0.12);
      await r.act(() => __fr.tap(__fr.game.world.greenShownAt + 120));
      await r.rec(8, "g.state === 'over'");
      await r.rec(4.2);
      // Jump the light.
      await r.act(() => {
        R.seeds.push(20261017);
        __fr.press('retry');
      });
      await r.rec(6, 'w.lights && w.lights.amber >= 2');
      await r.act(() => __fr.tap());
      await r.rec(6, "g.state === 'over'");
      await r.rec(3.2);
      // The robot (a seed where it launches clean: 0.021 s).
      await r.act(() => {
        R.seeds.push(20261016);
        __fr.game.auto = 1;
        __fr.press('retry');
      });
      await r.rec(10, "g.state === 'over'");
      await r.rec(3.6);
    },
  },
};
