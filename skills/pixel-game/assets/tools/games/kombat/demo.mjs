// Model Kombat's demo videos: node demo.mjs kombat (both) or node demo.mjs kombat-sam kombat-dario.
// The K.O. silences the music by itself, so the soundtrack's replay has to know.
export const duckers = ['knock'];
export const videos = {};

// Model Kombat, CPU vs CPU on MAX, a best of three that goes the distance: the summit intro,
// each round's call, a cut to the last seconds before each K.O., the finisher, the result and
// the K.O. replay. Two endings, one for each of them; the rounds were picked by simulating ahead
// (tools/sim/kombat.mjs's Round, same seeds) for supers, clashes and combos near the K.O.
for (const [name, rounds] of Object.entries({
  'kombat-sam': [
    [782795523, 2092],
    [2841616278, 1473],
    [1711563118, 1434],
  ],
  'kombat-dario': [
    [2841616278, 1473],
    [3253618262, 2339],
    [2883590011, 2617],
  ],
})) {
  videos[name] = {
    async run(r) {
      await r.act((seeds) => {
        R.seeds.push(...seeds);
        const g = __fr.game;
        g.level = 3;
        g.auto = 1;
        g.sel = 0;
        __alog.length = 0;
      }, rounds.map((x) => x[0]));
      await r.rec(1.1);
      await r.act(() => __fr.press('fight'));
      for (let n = 0; n < rounds.length; n++) {
        const ko = rounds[n][1];
        const last = n === rounds.length - 1;
        // The round's call ("ROUND N", "FIGHT!") and its first second.
        await r.rec(7, "g.state === 'fight'");
        await r.rec(1.0);
        // Cut to the last six seconds before the K.O.
        if ((await r.peek('w.step')) < ko - 780) await r.skip(`w.step >= ${ko - 720}`, 60);
        await r.rec(12, "w.state !== 'fight'");
        if (last) break;
        // The K.O. in slow motion, then cut to the next round's call.
        await r.rec(1.7);
        await r.skip("g.state === 'call'", 10);
      }
      // The finisher: dazed, DEPRECATED, and the result.
      await r.rec(8, "g.state === 'over'");
      await r.act(() => (__fr.game.match.msg = "THEY STILL WON'T HOLD HANDS."));
      await r.rec(3.2);
      // The K.O. replay, from just before the hit.
      await r.act(() => __fr.press('replay'));
      await r.skip('g.replayRound && g.replayRound.step >= g.koStep - 110', 20);
      await r.rec(5.2, "g.state === 'over'");
    },
  };
}
