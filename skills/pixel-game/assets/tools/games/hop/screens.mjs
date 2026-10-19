// Pixel Hop: the title, get ready, the autopilot running, a player taking over and crashing at the
// next obstacle, the result, the share card, the replay, then the pause.
// Run it with node screens.mjs hop; shots go to out/screens/hop-<moment>.png.
export default async function ({ g, shot, shareCard }) {
  const st = () => g.ev(() => {
    const k = __fr.game;
    return { s: k.state, ws: k.world && k.world.state, score: k.world ? k.world.score : 0 };
  });
  const until = (fn, max) => g.until(async () => fn(await st()), max);
  await g.tick(90);
  await shot('title');
  await g.ev(() => __fr.press('auto'));
  await g.tick(4);
  await g.ev(() => __fr.tap());
  await g.tick(30);
  await shot('ready');
  for (const [from, to] of [[0, 240], [240, 900], [900, 1800]]) {
    await g.tick(to - from);
    await shot(`auto-${Math.round(to / 60)}s`);
  }
  // Hands off the autopilot: nobody jumps, so the next obstacle ends the run.
  await g.ev(() => __fr.game.world.takeOver());
  await until((s) => s.s === 'dying', 1200);
  await g.tick(6);
  await shot('crash');
  await until((s) => s.s === 'over', 300);
  await g.tick(24);
  await shot('over-stamp');
  await g.tick(120);
  await shot('over');
  const r = await g.ev(() => __fr.game.run);
  console.log(`run      ${r.stamp} · ${r.score} · ${r.coins} coins · ${r.close} close calls · ${r.msg}`);
  await shareCard('over');
  await g.ev(() => __fr.press('replay'));
  await g.tick(60);
  await shot('replay');
  await g.tick(150);
  await shot('replay-crash');
  await until((s) => s.s === 'over', 900);
  // The pause, mid-run.
  await g.ev(() => __fr.press('retry'));
  await until((s) => s.s === 'run', 300);
  await g.tick(60);
  await g.ev(() => __fr.press('pause'));
  await g.tick(4);
  await shot('paused');
}

// The front page's thumbnail: the autopilot a few seconds into a run.
export async function thumb(g) {
  await g.ev(() => __fr.press('auto'));
  await g.tick(4);
  await g.ev(() => __fr.tap());
  await g.tick(60 * 7);
}
