// Model Kombat: a whole CPU vs CPU match (the summit intro, round calls, K.O.s, the finisher, the
// result, the share card, the K.O. replay), then a round as 1P to show the pad and the pause.
// Run it with node screens.mjs kombat; shots go to out/screens/kombat-<moment>.png.
export default async function ({ g, shot, shareCard, args }) {
  const until = g.until;
  const st = () => g.ev(() => {
    const k = __fr.game;
    return { s: k.state, t: k.stateT, rs: k.round && k.round.state, n: k.roundN, rt: k.round && k.round.stateT };
  });
  const until2 = (fn, max) => until(async () => fn(await st()), max);
  await g.tick(90);
  await shot('select');
  await g.ev(() => __fr.press('auto'));
  await g.tick(4);
  await g.ev(() => __fr.press('fight'));
  for (const [at, name] of [[30, 'intro-hands'], [80, 'intro-except'], [150, 'intro-fists'], [200, 'intro-apart']]) {
    await g.tick(at - (await g.ev(() => Math.round(__fr.game.stateT * 60))));
    await shot(name);
  }
  await until2((s) => s.s === 'call');
  await g.tick(20);
  await shot('call-round');
  await g.tick(42);
  await shot('call-fight');
  await until2((s) => s.s === 'fight');
  for (const [from, to] of [[0, 240], [240, 600], [600, 960]]) {
    await g.tick(to - from);
    await shot(`fight-${to}`);
  }
  // Round by round to the end of the match: each K.O., the finisher, the deprecation.
  for (let guard = 0; guard < 6; guard++) {
    const ok = await until2((s) => s.s === 'over' || (s.s === 'fight' && s.rs !== 'fight'), 60 * 75);
    const s = await st();
    if (!ok || s.s === 'over') break;
    const round = s.n;
    await g.tick(10);
    await shot(`r${round}-ko`);
    if (s.rs === 'finish') {
      await g.tick(40);
      await shot(`r${round}-finish`);
      await until2((x) => x.rs === 'done', 600);
      await g.tick(18);
      await shot(`r${round}-deprecate`);
      await g.tick(60);
      await shot(`r${round}-deprecated`);
    } else {
      await g.tick(70);
      await shot(`r${round}-win`);
    }
    await until2((x) => x.s === 'over' || x.n !== round, 900);
  }
  await until2((x) => x.s === 'over', 1200);
  await g.tick(24);
  await shot('over-stamp');
  await g.tick(110);
  await shot('over');
  const m = await g.ev(() => {
    const k = __fr.game;
    return { stamp: k.match.stamp, wins: k.match.wins, msg: k.match.msg, hits: k.match.hits, best: k.match.best };
  });
  console.log(`match    ${m.stamp} · ${m.wins.join('-')} · ${m.hits} hits, best ${m.best} · ${m.msg}`);
  await shareCard('over');
  await g.ev(() => __fr.press('replay'));
  await g.tick(60);
  await shot('replay');
  await g.tick(150);
  await shot('replay-ko');
  await until2((x) => x.s === 'over', 2400);
  // 1P: the pad, a punch held down, the pause.
  await g.ev(() => {
    __fr.press('menu');
  });
  await g.tick(4);
  await g.ev(() => {
    __fr.press('auto');
  });
  await g.tick(4);
  await g.ev(() => __fr.press('fight'));
  await g.tick(10);
  await g.ev(() => __fr.tap());
  await until2((x) => x.s === 'fight', 300);
  const box = await g.page.locator('#game').boundingBox();
  const at = (x, y) => [box.x + (x / 216) * box.width, box.y + (y / 384) * box.height];
  await g.page.mouse.move(...at(70, 322));
  await g.page.mouse.down();
  await g.tick(70);
  await g.page.mouse.up();
  await g.page.mouse.move(...at(135, 322));
  await g.page.mouse.down();
  await g.tick(3);
  await shot('pad-punch');
  await g.page.mouse.up();
  await g.tick(60);
  await g.ev(() => __fr.press('pause'));
  await g.tick(4);
  await shot('paused');
  await g.ev(() => __fr.press('resume'));
}

// The front page's thumbnail: CPU vs CPU, a few seconds into the first round.
export async function thumb(g) {
  await g.ev(() => __fr.press('auto'));
  await g.tick(4);
  await g.ev(() => __fr.press('fight'));
  await g.tick(60 * 3.7 + 90 + 260);
}
