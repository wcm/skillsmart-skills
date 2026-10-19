// Flappy Roadster: all four games. 0-60 gets the robot's launch, a 0.180 s human launch and a
// false start; the others play on the autopilot, then crash by hand.
// Run it with node screens.mjs roadster [games…]; shots go to out/screens/roadster-<moment>.png.
export default async function ({ g, shot, shareCard, args }) {
  const until = g.until;
  const pick = args;
  const GAMES = ['fly', 'kickflip', 'tunnel', 'launch'];
  for (const name of pick.length ? pick : GAMES) {
    const gi = GAMES.indexOf(name);
    const state = () => g.ev(() => [__fr.game.state, __fr.game.world.state, __fr.game.world.score]);
    await g.ev((gi) => {
      __fr.press('game' + gi);
      __fr.game.auto = 1;
    }, gi);
    await g.tick(100);
    await shot(`${name}-title`);
    await g.ev(() => __fr.tap());
    await g.tick(name === 'fly' ? 140 : 30);
    await shot(`${name}-ready`);
    if (name === 'launch') {
      await g.tick(70);
      await shot('launch-tree');
      await until(async () => (await state())[0] === 'over', 400);
      await g.tick(150);
      await shot('launch-over-robot');
      await g.ev(() => {
        __fr.game.auto = 0;
        __fr.press('retry');
      });
      await until(() => g.ev(() => !!__fr.game.world.greenShownAt), 400);
      await shot('launch-green');
      await g.ev(() => __fr.tap(__fr.game.world.greenShownAt + 180));
      await g.tick(14);
      await shot('launch-launch');
      await until(async () => (await state())[0] === 'over', 400);
      await g.tick(40);
      await shot('launch-stamp');
      await g.tick(150);
      await shot('launch-over');
      await shareCard('launch');
      await g.ev(() => __fr.press('retry'));
      await until(() => g.ev(() => __fr.game.world.lights.amber >= 2), 400);
      await g.ev(() => __fr.tap());
      await g.tick(30);
      await shot('launch-foul');
      await until(async () => (await state())[0] === 'over', 400);
      await g.tick(150);
      await shot('launch-over-foul');
    } else {
      for (const [from, to] of [[0, 200], [200, 500], [500, 900]]) {
        await g.tick(to - from);
        await shot(`${name}-play${to}`);
      }
      await g.ev(() => {
        __fr.game.world.auto = false;
        __fr.game.auto = 0;
      });
      if (await until(async () => (await state())[0] === 'dying')) {
        await g.tick(8);
        await shot(`${name}-crash`);
      }
      await until(async () => (await state())[0] === 'over');
      await g.tick(40);
      await shot(`${name}-stamp`);
      await g.tick(150);
      await shot(`${name}-over`);
      await shareCard(name);
      await g.ev(() => __fr.press('replay'));
      await g.tick(80);
      await shot(`${name}-replay`);
      await until(async () => (await state())[0] === 'over', 900);
    }
    const run = await g.ev(() => {
      const r = __fr.game.run;
      return { score: r.score, stamp: r.stamp, msg: r.msg };
    });
    console.log(`${name.padEnd(8)} ${run.stamp} · ${run.score} · ${run.msg}`);
    await g.ev(() => __fr.press('quit'));
  }
}

// The front page's thumbnail: the title, its car on the road.
export async function thumb(g) {
  await g.tick(140);
}
