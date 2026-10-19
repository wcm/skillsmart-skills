// Meta Gear Solid's demo video: node demo.mjs metagear.
export const duckers = [];

// Picked with tools/sim: a seed whose ghost run has a lively stretch in each room, and a
// moment in the wedding where walking on gets you seen within a second.
const METAGEAR = { seed: 3178843872, segs: [[1260, 7], [3504, 6], [6515, 6]], take: 7236 };

// Meta Gear Solid in ghost mode: the title, the codec's best exchange, a stretch of each of the
// first three rooms, then a player takes over in the wedding and walks into someone's view:
// the "!", RECORDED, and the POV footage.
export const videos = {
  metagear: {
    async run(r) {
      const { seed, segs, take } = METAGEAR;
      await r.act((seed) => {
        R.seeds.push(seed);
        const g = __fr.game;
        g.auto = 1;
        g.briefed = false;
        __alog.length = 0;
      }, seed);
      await r.rec(1.8);
      await r.act(() => __fr.tap());
      // The codec: "IF THEY SEE YOU MOVE..." "AND IF I STOP?" "YOU'RE A BOX..."
      await r.act(() => {
        const g = __fr.game;
        g.codecI = 2;
        g.codecF = g.codecN = 0;
      });
      for (const hold of [0.7, 0.5, 1.1]) {
        await r.rec(4, 'g.codecN >= R.ui.CODEC[g.codecI][2].length');
        await r.rec(hold);
        if (hold !== 1.1) await r.act(() => __fr.tap());
      }
      await r.act(() => __fr.press('skip'));
      await r.rec(1.4);
      for (const [from, secs] of segs) {
        await r.skip(`w.step >= ${from}`, 240);
        await r.rec(secs);
      }
      await r.skip(`w.step >= ${take}`, 240);
      await r.act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })));
      await r.rec(6, "g.state === 'caught'");
      await r.act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })));
      await r.rec(3, "g.state === 'over'");
      await r.act(() => (__fr.game.run.msg = 'YOU ARE IN THE WEDDING VIDEO NOW.'));
      await r.rec(3.6);
      await r.act(() => __fr.press('replay'));
      await r.rec(9, "g.state === 'over'");
      await r.rec(1.2);
    },
  },
};
