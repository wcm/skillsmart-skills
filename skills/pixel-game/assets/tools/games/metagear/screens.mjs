// Meta Gear Solid: the title, the codec, ghost mode sneaking through the rooms, then a player
// walking into someone's view: the "!", the result, the share card, the POV footage, the pause.
// Run it with node screens.mjs metagear; shots go to out/screens/metagear-<moment>.png.
export default async function ({ g, shot, shareCard, args }) {
  const until = g.until;
  const st = () => g.ev(() => {
    const k = __fr.game;
    return { s: k.state, ws: k.world && k.world.state, score: k.world ? k.world.score : 0 };
  });
  const until2 = (fn, max) => until(async () => fn(await st()), max);
  await g.tick(90);
  await shot('title');
  await g.ev(() => __fr.press('codec'));
  await g.tick(80);
  await shot('codec');
  for (let i = 0; i < 2; i++) {
    await g.ev(() => __fr.tap());
    await g.tick(2);
  }
  await g.tick(110);
  await shot('codec-2');
  await g.ev(() => __fr.press('skip'));
  await g.tick(4);
  await g.ev(() => __fr.press('auto'));
  await g.tick(4);
  await g.ev(() => __fr.tap());
  await g.tick(20);
  await shot('ready');
  for (const [from, to] of [[0, 240], [240, 900], [900, 2100], [2100, 3600]]) {
    await g.tick(to - from);
    await shot(`ghost-${Math.round(to / 60)}s`);
  }
  // Take over and walk straight on until someone sees.
  await g.page.keyboard.down(' ');
  const ok = await until2((s) => s.s === 'caught', 1800);
  await g.tick(8);
  await shot('caught');
  await g.page.keyboard.up(' ');
  await until2((s) => s.s === 'over', 400);
  await g.tick(24);
  await shot('over-stamp');
  await g.tick(120);
  await shot('over');
  const r = await g.ev(() => __fr.game.run);
  console.log(`run      ${ok ? '' : '(never caught) '}${r && r.score} m · ${r && r.why} by ${r && r.handle} · ${r && r.rank} · ${r && r.msg}`);
  await shareCard('over');
  await g.ev(() => __fr.press('replay'));
  await g.tick(60);
  await shot('pov');
  await g.tick(160);
  await shot('pov-catch');
  await until2((s) => s.s === 'over', 900);
  await g.ev(() => __fr.press('retry'));
  await g.page.keyboard.down(' ');
  await g.tick(70);
  await g.ev(() => __fr.press('pause'));
  await g.page.keyboard.up(' ');
  await g.tick(4);
  await shot('paused');
}

// The front page's thumbnail: ghost mode, sneaking through the coffee shop.
export async function thumb(g) {
  await g.ev(() => {
    localStorage.setItem('pixel-arcade:metagear:briefed', '1');
    __fr.game.briefed = true;
    __fr.press('auto');
  });
  await g.tick(4);
  await g.ev(() => __fr.tap());
  await g.tick(60 * 12);
}
