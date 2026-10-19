/* Pixel Hop · main: the flow (title, get ready, the run, the crash, the result, the replay), what
   each event looks and sounds like, the share card, and input: press anywhere (or Space) to
   jump, hold to jump higher. The engine's app runs the page.

   The flow every game here follows:
     title   the game's name, TAP TO PLAY in the middle, settings under the action
     ready   the name again; the first tap starts (on autopilot the run starts by itself)
     run     the sim steps at 120 Hz; its events become sound, particles, popups and banners
     dying   the crash plays out (hit-stop, flash, debris), then
     over    a stamp, a punchline picked for how the run ended, one line of stats, buttons
     replay  the last seconds rebuilt from the seed and the inputs, at half speed, a quarter at
             the crash, under a camcorder overlay
   A tap on the autopilot hands control to the player; a share card saves a 1080×1920 poster. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const A = R.audio;
  const ui = R.ui;
  const app = R.app;
  const fx = R.fx;
  const C = R.UIC;
  const HOP = R.HOP;
  const DT = R.DT;
  R.store.ns = 'pixel-arcade:hop:';
  const store = R.store;
  const view = new R.HopView(app.canvas);

  const g = {
    state: 'title',
    stateT: 0,
    t: 0,
    auto: store.get('auto', 0) ? 1 : 0,
    best: store.get('best', 0) | 0,
    world: null, // the run, or the scene behind the title
    replay: null, // the rebuilt run while the replay plays
    run: null, // the last result
    acc: 0, // simulation time owed, s
    stop: 0, // hit-stop left, s
    slowT: 0, // bullet time left, s
    slow: false, // the replay is at quarter speed
    hintT: 0,
    pausedFrom: null,
  };
  A.level = R.clamp(store.get('sound', 0) | 0, 0, 2);
  const pick = (a) => a[Math.floor(fx() * a.length)];

  function setState(s) {
    g.state = s;
    g.stateT = 0;
  }

  // ---------------- the flow ----------------
  function toTitle() {
    setState('title');
    g.world = new R.World({ seed: R.nextSeed() });
    g.replay = null;
    fingers.clear();
    view.reset();
    ui.pops.length = 0;
    ui.banner = null;
    A.seq.duck(false);
    A.seq.setSong(0);
    A.seq.setIntensity(0);
  }

  function toReady() {
    A.init();
    setState('ready');
    g.world = new R.World({ seed: R.nextSeed(), auto: !!g.auto });
    g.replay = null;
    g.run = null;
    g.stop = g.slowT = 0;
    fingers.clear(); // the tap that got here doesn't start the run
    keyHold = false;
    view.reset();
    ui.pops.length = 0;
    ui.banner = null;
    g.hintT = g.best < 5 ? 5 : 0;
    A.seq.duck(false);
    A.seq.slow(false);
    A.seq.setSong(1);
    A.seq.setIntensity(1);
  }

  // A stamp and a punchline for how the run ended. The jokes are the game's voice: in a parody,
  // write them about the story, never as quotes from real people.
  const STAMPS = { cone: 'CONED', barrier: 'ROAD CLOSED', tower: 'STACKED' };
  const LINES = {
    any: ['THE ROAD WON THIS ROUND.', 'GRAVITY: STILL UNDEFEATED.', 'THE AUTOPILOT WOULD LIKE A WORD.', 'SO CLOSE. NOT REALLY.'],
    cone: ['OUTSMARTED BY A CONE.', 'IT WAS A CONE. IT DID NOT MOVE.'],
    barrier: ['THE SIGN DID SAY ROAD CLOSED.', 'BARRIER: 1. YOU: 0.'],
    tower: ['HOLD LONGER. JUMP HIGHER.', 'TALLER THAN IT LOOKED.'],
  };

  function endRun() {
    const w = g.world;
    const newBest = w.score > g.best;
    if (newBest) {
      g.best = w.score;
      store.set('best', w.score);
    }
    const kind = w.hit ? w.hit.kind : 'cone';
    g.run = {
      score: w.score,
      newBest,
      coins: w.coinCount,
      jumps: w.stats.jumps,
      close: w.stats.close,
      stamp: STAMPS[kind],
      msg: pick(LINES[kind].concat(LINES.any)),
      seed: w.seed,
      inputs: w.inputs.slice(),
      deathStep: w.deathStep,
    };
    setState('over');
    A.stamp(w.score < 3); // a sad trombone for an early fail
    if (newBest && w.score >= 5) A.best();
  }

  // ---------------- what happens on screen ----------------
  const FASTER = ['THE ROAD SPEEDS UP', 'NO BRAKES ON THIS ROAD', 'THE CONES ARE FASTER TOO'];
  let snapAt = -1;
  function onEvent(e, w, replaying) {
    switch (e.type) {
      case 'start':
        A.go();
        A.seq.setIntensity(2);
        break;
      case 'jump':
        A.jump();
        view.onJump();
        break;
      case 'land':
        A.land(e.v);
        view.onLand(e.v);
        break;
      case 'coin':
        A.coin(e.n);
        view.onCoin(e.x, e.y);
        ui.pop('+1', { x: e.x, y: HOP.G - e.y - 14, font: 'small', scale: 1, color: C.yellow, life: 0.5, vy: -24 });
        break;
      case 'clear':
        A.clear();
        ui.scoreBump = 0.12;
        break;
      case 'close':
        A.close();
        view.onClose();
        g.slowT = 0.45;
        A.seq.slow(true);
        ui.pop(`CLOSE CALL! ${e.px} PX`, { y: 118, font: 'big', scale: 1, rainbow: true, outline: C.ink, life: 0.9, tag: 'close' });
        break;
      case 'faster':
        A.faster();
        if (!replaying) ui.showBanner({ kicker: `${e.score} CLEARED`, title: 'FASTER!', sub: pick(FASTER) });
        A.seq.setIntensity(e.score >= 20 ? 3 : 2);
        break;
      case 'crash':
        A.crash();
        A.seq.duck(true);
        view.onCrash(w);
        g.stop = 0.09; // hit-stop: the frame of impact holds
        if (!replaying) snapAt = g.t + 0.15; // a clean frame for the share card
        break;
      case 'disengage':
        A.disengage();
        ui.pop('YOU HAVE CONTROL', { y: 150, font: 'big', scale: 1, color: C.blue, life: 1.2 });
        break;
    }
  }

  // ---------------- the replay ----------------
  // The last two seconds again, rebuilt from the seed and the inputs: no video is kept.
  function startReplay() {
    const r = g.run;
    if (!r) return;
    const rw = new R.World({ seed: r.seed, replay: { inputs: r.inputs } });
    const from = Math.max(0, r.deathStep - 240);
    while (rw.step < from) rw.update();
    rw.score0 = rw.score;
    g.replay = rw;
    g.replayEnd = r.deathStep + 150;
    g.acc = 0;
    view.reset();
    ui.pops.length = 0;
    ui.banner = null;
    setState('replay');
  }
  function endReplay() {
    g.replay = null;
    setState('over');
    g.stateT = 1.25; // skip the stamp, straight to the panel
  }

  // ---------------- share card ----------------
  function shareCard() {
    const r = g.run;
    if (!r) return;
    app.copy(`I scored ${r.score} in Pixel Hop. Beat it.`);
    const c = app.card();
    const x = c.x;
    const logo = R.canvas(W, 72);
    ui.hlogo(logo.x, 0, 4, true);
    x.drawImage(logo.c, 0, 90, W * 5, 72 * 5);
    R.text(x, r.stamp, 540, 720, { scale: 12, italic: true, color: '#ff2a3d', outline: '#3a0008', align: 'center' });
    R.text(x, String(r.score), 540, 860, { scale: 26, color: '#ffffff', outline: '#07040d', align: 'center' });
    R.text(x, r.newBest ? 'NEW BEST!' : `BEST ${g.best}`, 540, 1080, { scale: 7, color: '#ffe14d', outline: '#07040d', align: 'center' });
    R.wrap(r.msg, 170, { font: 'small' }).forEach((l, i) => R.text(x, l, 540, 1240 + i * 52, { font: 'small', scale: 6, color: '#ffffff', align: 'center' }));
    R.text(x, ui.statLine([`COINS ${r.coins}`, `JUMPS ${r.jumps}`, `CLOSE CALLS ${r.close}`]), 540, 1480, { font: 'small', scale: 5, color: '#2ef6ff', align: 'center' });
    // A parody's card ends with its disclaimer here: FAN-MADE PARODY · NOT AFFILIATED WITH …
    R.text(x, 'PIXEL HOP', 540, 1840, { font: 'small', scale: 3, color: '#8a7fb0', align: 'center' });
    app.saveCanvas(c, `pixel-hop-${r.score}.png`, 'CARD SAVED · CAPTION COPIED');
  }

  // ---------------- input ----------------
  const fingers = new Set(); // pointers down on the play area
  let keyHold = false;
  const holding = () => fingers.size > 0 || keyHold;
  const runState = () => g.state === 'ready' || g.state === 'run';

  function press(id) {
    if (id === 'sound') {
      A.setLevel((A.level + 1) % 3);
      store.set('sound', A.level);
    } else if (id === 'auto') {
      g.auto = g.auto ? 0 : 1;
      store.set('auto', g.auto);
      if (g.auto) A.engage();
      else A.disengage();
    } else if (id === 'retry') toReady();
    else if (id === 'menu' || id === 'quit') toTitle();
    else if (id === 'replay') startReplay();
    else if (id === 'share') shareCard();
    else if (id === 'pause' && runState()) {
      g.pausedFrom = g.state;
      setState('paused');
      fingers.clear();
      keyHold = false;
    } else if (id === 'resume' && g.state === 'paused') setState(g.pausedFrom || 'run');
  }

  // A press anywhere that isn't a button, outside a run.
  function tap() {
    if (g.state === 'title') toReady();
    else if (g.state === 'replay') endReplay();
    else if (g.state === 'over' && g.stateT > 1.2) toReady();
  }
  function down(x, y, ts, id) {
    if (runState()) {
      if (g.world.auto) g.world.takeOver();
      fingers.add(id);
      return;
    }
    tap();
  }
  function up(id) {
    fingers.delete(id);
  }

  const HOLD = { ' ': 1, ArrowUp: 1, w: 1, W: 1 };
  function keydown(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if (HOLD[k] || k === 'Enter') ev.preventDefault();
    if (ev.repeat) return;
    if (k === 'p' || k === 'P' || k === 'Escape') return app.press(g.state === 'paused' ? 'resume' : 'pause');
    if (k === 'm' || k === 'M') return app.press('sound');
    if (runState() && HOLD[k]) {
      if (g.world.auto) g.world.takeOver();
      keyHold = true;
      return;
    }
    if (g.state === 'title' && (k === 'a' || k === 'A')) return app.press('auto');
    if (g.state === 'over' && (k === 'r' || k === 'R')) return app.press('replay');
    if (k === 'Enter' || HOLD[k]) tap();
  }
  function keyup(ev) {
    if (HOLD[ev.key]) keyHold = false;
  }

  // ---------------- one frame ----------------
  function tick(dt) {
    g.t += dt;
    g.stateT += dt;
    const replaying = g.state === 'replay';
    const w = replaying ? g.replay : g.world;
    let scale = g.state === 'paused' ? 0 : 1;
    if (replaying) {
      const toCrash = (g.run.deathStep - w.step) * DT;
      g.slow = toCrash < 0.5 && toCrash > -0.4;
      scale = g.slow ? 0.25 : 0.5;
      if (g.slow) view.hit('zoom', 1.25);
    }
    // Hit-stop freezes the sim for a beat; bullet time slows it.
    if (g.stop > 0) {
      g.stop -= dt;
      scale = 0;
    } else if (g.slowT > 0) {
      g.slowT -= dt;
      scale *= 0.35;
      if (g.slowT <= 0) A.seq.slow(false);
    }
    if (w && scale > 0) {
      if (!w.replay) w.input = runState() && holding();
      g.acc += dt * scale;
      let n = 0;
      while (g.acc >= DT && n < 16) {
        w.update();
        for (const e of w.events) onEvent(e, w, replaying);
        g.acc -= DT;
        n++;
      }
      if (n >= 16) g.acc = 0;
    }
    if (g.state === 'ready' && w.state === 'run') setState('run');
    if (g.state === 'run') g.hintT = Math.max(0, g.hintT - dt);
    if (g.state === 'run' && w.state === 'dying') setState('dying');
    if (g.state === 'dying' && w.state === 'dead') endRun();
    if (replaying && w.step >= g.replayEnd) endReplay();
    if (snapAt > 0 && g.t >= snapAt) {
      snapAt = -1;
      view.wantSnap = true;
    }

    view.update(g.state === 'paused' ? 0 : dt * Math.max(scale, 0.25), w);
    view.screen(dt);
    ui.update(dt);
    view.drawWorld(w, g.t);
    view.present(w, (ctx) => ui.draw(ctx, g, g.t));
  }

  app.run({
    view,
    g,
    boot(data) {
      if (data.auto != null) g.auto = data.auto ? 1 : 0;
      toTitle();
      app.canvas.setAttribute('aria-label', 'Pixel Hop. A one-button runner: tap to jump over what is on the road, hold to jump higher. Tap to start.');
    },
    tick,
    press,
    down,
    up,
    keydown,
    keyup,
    hidden: () => press('pause'),
    snapshot: () => ({ auto: g.auto }),
    tap,
  });
})();
