/* Flappy Roadster · main: the game's states, events, input, killcam replays and share cards. The
   engine's app runs the page (canvas, loop, input routing, saving, test clock). */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const DT = R.DT;
  const A = R.audio;
  const ui = R.ui;
  const fx = R.fx;
  const app = R.app;
  R.store.ns = 'pixel-arcade:roadster:';

  const canvas = app.canvas;
  const view = new R.View(canvas);

  // ---------------- persistent state ----------------
  const store = R.store;
  const g = (R.game = {
    state: 'title',
    stateT: 0,
    t: 0,
    world: null,
    game: R.clamp(store.get('game', 0) | 0, 0, R.GAMES.length - 1),
    mode: R.clamp(store.get('mode', 1) | 0, 0, R.MODES.length - 1),
    skin: R.clamp(store.get('skin', 0) | 0, 0, R.SKINS.length - 1),
    auto: R.clamp(store.get('auto', 0) | 0, 0, 2),
    best: store.get('best', {}) || {},
    eta: store.get('eta', 2028) | 0 || 2028,
    delays: store.get('delays', 0) | 0,
    unlockAll: !!store.get('unlockAll', false),
    run: null,
    hitStop: 0,
    slowT: 0,
    slowF: 1,
    acc: 0,
    puffT: 0,
  });
  A.level = R.clamp(store.get('level', 0) | 0, 0, 2);

  const game = () => R.GAMES[g.game];
  g.bestFor = (m) => g.best[game().key(m == null ? g.mode : m)] | 0;
  // Cars unlock from progress in any game, on the flying game's scale.
  g.maxBest = () => Math.max(0, ...R.GAMES.flatMap((gm) => R.MODES.map((m, i) => gm.level(g.best[gm.key(i)] | 0))));
  g.skinUnlocked = (i) => g.unlockAll || g.maxBest() >= R.SKINS[i].unlock;

  function skinPhys(i) {
    const s = R.SKINS[i];
    const sh = s.shape;
    const half = Math.floor(s.wheel[0].length / 2);
    const wheelBottom = sh.wheels[0][1] + (s.wheel.length - 1 - half);
    return { gravity: s.gravity, flap: s.flap, roadDy: wheelBottom + 1 - (sh.h / 2 - 1) };
  }

  function newWorld(state, keep) {
    const w = new (game().World)({
      seed: R.nextSeed(),
      mode: R.MODES[g.mode],
      skin: skinPhys(g.skin),
      state,
      cinematic: g.auto === 2,
    });
    if (keep && keep.kind === w.kind) {
      w.dist = keep.dist;
      w.t = keep.t;
    }
    g.world = w;
    view.skin = g.skin;
    const name = game().name.toLowerCase().replace(/(^|[ -])[a-z]/g, (m) => m.toUpperCase());
    canvas.setAttribute('aria-label', `${name}. Tap, click or press space to play.`);
    return w;
  }

  function setState(s) {
    g.state = s;
    g.stateT = 0;
  }

  function toTitle() {
    const keep = g.world;
    newWorld('title', keep && keep.state === 'title' ? keep : null);
    view.reset(0);
    ui.pops.length = 0;
    ui.banner = null;
    setState('title');
    A.seq.duck(false);
    A.seq.setSong(0);
    A.seq.setIntensity(0);
  }

  function retry() {
    newWorld('ready');
    view.reset(0);
    setState('ready');
    A.seq.duck(false);
    A.seq.setSong(0);
    A.seq.setIntensity(1);
  }

  function startIntro() {
    if (!g.skinUnlocked(g.skin)) {
      A.deny();
      ui.pop(game().unlockText(R.SKINS[g.skin].unlock), { y: R.GROUND - 34, font: 'small', scale: 1, color: R.UIC.yellow, life: 1.4 });
      return;
    }
    if (g.world.setMode) g.world.setMode(R.MODES[g.mode]);
    else g.world.mode = R.MODES[g.mode];
    g.world.cinematic = g.auto === 2;
    g.world.startIntro();
    setState('intro');
    A.seq.setIntensity(1);
    A.fold();
  }

  // ---------------- events from the sim ----------------
  function onEvent(e, replaying) {
    const w = g.world;
    const rate = replaying ? 0.7 : 1;
    switch (e.type) {
      case 'liftoff':
        view.thrust(w, 2.2);
        view.hit('shake', 3);
        A.liftoff();
        ui.pop('LIFTOFF', { y: 110, scale: 2, italic: true, gradient: ['#fff', '#fff', '#bfefff', '#7fe3ff', '#2ef6ff', '#2ad0ff', '#2a9cff'], life: 1.3 });
        ui.pop('TURNS OUT THE FUTURE HAS FLYING CARS', { y: 132, font: 'small', scale: 1, color: R.UIC.white, life: 1.6, delay: 0.25, vy: -6 });
        break;
      case 'start':
        if (!replaying) {
          beginRun();
          const hi = { fly: '0-60 IN 0.81 S', kickflip: 'DO A KICKFLIP!', tunnel: 'SUCTION FANS: ON' }[game().id];
          const y = game().road ? R.GROUND - 56 : R.READY_Y - 30;
          if (hi) ui.pop(hi, { x: R.CAR_X + 24, y, font: 'small', scale: 1, color: R.UIC.yellow, life: 0.9, vy: -20 });
        }
        break;
      case 'flap':
        view.thrust(w, e.flip ? 1.2 : 1);
        A.thrust(rate);
        break;
      // Kickflip mode.
      case 'trickStart':
        A.pop();
        break;
      case 'trick': {
        const words = ['KICKFLIP!', 'DOUBLE KICKFLIP!', 'TRIPLE KICKFLIP!'];
        ui.scoreBump = 0.08;
        A.trick(e.n);
        ui.pop(words[e.n - 1] || `KICKFLIP ×${e.n}!`, { y: 84, scale: 2, italic: true, rainbow: true, life: 1.0, shakeX: 2, tag: 'trick' });
        if (e.n === 1 && fx() < 0.4) ui.pop(pick(['TONY WOULD BE PROUD', 'STICK THE LANDING', 'THE UNVEIL HAD ONE. YOU HAVE TWO']), { y: 104, font: 'small', scale: 1, color: R.UIC.white, life: 1.0, delay: 0.1, vy: -8 });
        break;
      }
      case 'touch': {
        // Wheels (or suction fans) meeting a surface.
        const up = e.ceil ? 1 : -1;
        if (e.v > 90) {
          view.hit('shake', Math.min(3, e.v / 140));
          for (let i = 0; i < 7; i++) view.puff(R.CAR_X + (fx() - 0.5) * 34, e.y + up * 2, (fx() - 0.5) * 110 - w.speed * 0.4, up * (6 + fx() * 18), 1.5, 8, 0.6, null, 0.03);
        }
        if (w.kind === 'tunnel') A.suck(e.v);
        else A.land(e.v);
        if (e.roof) {
          ui.scoreBump = 0.08;
          ui.pop(`${NAMES[e.kind] || 'ROOF'} ROOF!`, { x: R.CAR_X + 20, y: e.y - 22, font: 'small', scale: 1, color: R.UIC.yellow, life: 0.8, vy: -18 });
        } else if (e.tricks > 0 && !replaying) ui.pop('LANDED IT!', { x: R.CAR_X + 18, y: e.y - 24, font: 'big', scale: 1, color: R.UIC.cyan, life: 0.8, vy: -18 });
        if (w.kind === 'tunnel' && e.ceil && !g.run.ceilShown && !replaying) {
          g.run.ceilShown = true;
          ui.pop('UPSIDE DOWN!', { y: 96, scale: 2, italic: true, gradient: ['#fff', '#fff', '#bfefff', '#7fe3ff', '#2ef6ff', '#2ad0ff', '#2a9cff'], life: 1.1 });
          ui.pop('THE FANS HOLD IT ON. AS DEMOED.', { y: 116, font: 'small', scale: 1, color: R.UIC.white, life: 1.2, delay: 0.15, vy: -6 });
        }
        break;
      }
      case 'lineup':
        A.zone();
        ui.pop('THE UNVEIL LINEUP', { y: 52, scale: 1, font: 'big', color: R.UIC.yellow, life: 1.6, vy: 0 });
        ui.pop('FIVE TESLAS. JUMP THEM ALL.', { y: 62, font: 'small', scale: 1, color: R.UIC.white, life: 1.6, delay: 0.1, vy: 0 });
        break;
      case 'lineupDone':
        view.confetti(60);
        A.best();
        ui.pop('ALL FIVE!', { y: 92, scale: 3, italic: true, rainbow: true, life: 1.3, shakeX: 2 });
        ui.pop('JUST LIKE THE UNVEIL. ALMOST.', { y: 120, font: 'small', scale: 1, color: R.UIC.white, life: 1.4, delay: 0.15, vy: -8 });
        break;
      case 'police':
        A.siren();
        ui.pop('BYE, OFFICER!', { y: 96, scale: 1, font: 'big', color: R.UIC.blue, life: 1.0, shakeX: 1 });
        break;
      // 0-60.
      case 'stage':
        A.stage(e.n);
        break;
      case 'amber':
        A.amber();
        break;
      case 'green':
        A.green();
        break;
      case 'launch':
        view.plume(w, 3);
        view.hit('shake', 5);
        view.hit('zoom', 1.14);
        view.hit('aber', 2.6);
        A.launch();
        if (e.robot) ui.pop('BEEP BOOP', { x: R.CAR_X + 10, y: R.GROUND - 40, font: 'small', scale: 1, color: R.UIC.blue, life: 0.8, vy: -20 });
        break;
      case 'sixty':
        view.hit('flash', 0.3);
        view.flashCol = '255,240,200';
        A.sixty();
        break;
      case 'foul':
        view.hit('flash', 0.4);
        view.flashCol = '255,42,61';
        view.hit('shake', 3);
        view.hit('glitch', 0.2);
        A.foul();
        break;
      case 'finish':
        endRun(e);
        break;
      case 'score': {
        A.score(e.score);
        ui.scoreBump = 0.08;
        if (e.pipe.stack) {
          view.trick = { type: 'kickflip', t: 0, dur: 0.6 };
          A.pop();
          ui.pop('KICKFLIP!', { y: 96, scale: 3, italic: true, rainbow: true, life: 1.3, shakeX: 2 });
          ui.pop('TONY WOULD BE PROUD', { y: 124, font: 'small', scale: 1, color: R.UIC.white, life: 1.4, delay: 0.15, vy: -8 });
        }
        if (!replaying) milestone(e.score);
        break;
      }
      case 'near': {
        if (!replaying) {
          g.slowT = 0.42;
          g.slowF = 0.38;
          A.seq.slow(true);
        }
        view.hit('zoom', 1.12);
        view.hit('aber', 2.2);
        A.near(replaying ? 0.7 : 0.85);
        const words = ['CLOSE CALL!', 'DOUBLE CLOSE!', 'TRIPLE CLOSE!', 'UNREAL!'];
        ui.pop(words[Math.min(words.length - 1, e.combo - 1)], { y: 82, scale: 2, italic: true, gradient: ['#fff', '#fff', '#ffe9a8', '#ffe14d', '#ffb13b', '#ff7a2f', '#ff3fd2'], life: 0.9, shakeX: 2 });
        ui.pop(`${e.clear < 1 ? '<1' : e.clear.toFixed(0)} PX`, { y: 102, font: 'small', scale: 1, color: R.UIC.white, life: 0.8, delay: 0.05 });
        break;
      }
      case 'bolt':
        view.burst(e.x, e.y, 16, ['#ffe14d', '#ffffff', '#fff1a8'], 120, 0.5, 0);
        A.bolt(e.count);
        ui.pop(e.count >= 3 ? '⚡⚡⚡' : '⚡'.repeat(e.count), { x: e.x, y: e.y - 14, font: 'big', scale: 1, color: R.UIC.yellow, life: 0.6, vy: -24 });
        break;
      case 'ludi':
        view.warp = 4.2;
        view.hit('flash', 0.45);
        view.flashCol = '255,240,200';
        view.hit('aber', 3);
        view.hit('shake', 3);
        view.trick = { type: 'loop', t: 0, dur: 0.6, dir: -1 };
        A.ludi();
        A.seq.setIntensity(3);
        {
          // Stay clear of a zone banner that's still on screen.
          const y = ui.banner ? 104 : 92;
          ui.pop('LUDICROUS', { y, scale: 3, italic: true, rainbow: true, life: 1.6, shakeX: 3 });
          ui.pop('PLEASE KEEP RETINAS ATTACHED', { y: y + 26, font: 'small', scale: 1, color: R.UIC.white, life: 1.6, delay: 0.2, vy: -6 });
        }
        break;
      case 'ludiEnd':
        A.seq.setIntensity(2);
        break;
      case 'smash': {
        view.smash(w, e);
        view.hit('shake', 3.5);
        A.smash();
        const words = ['BONK!', 'SMASH!', 'YEET!', 'NOPE!', 'CRUNCH!'];
        ui.pop(words[Math.floor(fx() * words.length)], { x: R.CAR_X + 30, y: Math.max(56, e.y - 10), scale: 2, italic: true, color: R.UIC.yellow, outline: '#2a0010', life: 0.6, vy: -30 });
        break;
      }
      case 'bounce':
        view.burst(e.x, e.y - 1, 12, ['#ffffff', '#ffe14d'], 160, 0.4, 300);
        A.bounce();
        break;
      case 'crash':
        if (e.kind === 'pit' || e.kind === 'suction') {
          // Out of the tunnel in one piece: no wreck, just a long way down (or up).
          view.hit('shake', 4);
          view.hit('aber', 3);
          A.fall();
          A.seq.duck(true);
          if (!replaying) endRun(e);
          break;
        }
        view.wreck(w, e);
        view.hit('flash', replaying ? 0.35 : 0.55);
        view.flashCol = '255,255,255';
        view.hit('shake', 7);
        view.hit('aber', 4);
        view.hit('glitch', 0.3);
        A.crash(e.kind === 'ground' && e.zone === 2 ? 'reentry' : e.kind, rate);
        ui.pop(['KRNCH!', 'BZZT!', 'KA-BLAM!', 'CLANG!'][Math.floor(fx() * 4)], { x: R.CAR_X + 20, y: e.y - 24, scale: 2, italic: true, color: R.UIC.white, outline: '#3a0008', life: 0.7, vy: -10, shakeX: 3 });
        if (!replaying) endRun(e);
        else {
          g.slowT = 0;
        }
        break;
      case 'land':
        view.hit('shake', Math.min(4, e.v / 80));
        A.land(e.v);
        for (let i = 0; i < 8; i++) view.puff(e.x + (fx() - 0.5) * 30, (e.y || R.GROUND) + (e.y < R.GROUND / 2 ? 2 : -2), (fx() - 0.5) * 120, -10 - fx() * 20, 2, 10, 0.8, null, 0.03);
        break;
      case 'rest':
        if (!replaying && e.upsideDown && g.run) g.run.msg = 'HUNG UPSIDE DOWN. AS DESIGNED.';
        break;
      case 'zone':
        view.zoneB = e.zone;
        view.zoneT = 0;
        A.zone();
        A.seq.setSong(e.zone);
        {
          const z = R.ZONES[e.zone];
          const n = e.zone + 1 + (e.lap || 0) * 4;
          ui.showBanner({ kicker: `ZONE ${n}` + (e.lap ? `  ·  LAP ${e.lap + 1}` : ''), title: z.name, sub: z.sub });
        }
        if (!view.trick) view.trick = { type: 'loop', t: 0, dur: 0.55, dir: -1 };
        if (!replaying && g.run) g.run.zoneMax = Math.max(g.run.zoneMax, e.zone + e.lap * 4);
        break;
      case 'phantom':
        A.scratch();
        view.hit('shake', 1.5);
        ui.pop('PHANTOM BRAKING', { y: 70, scale: 1, font: 'big', color: R.UIC.yellow, life: 1.0, shakeX: 2 });
        break;
      case 'disengage':
        A.disengage();
        ui.pop('FSF DISENGAGED', { y: 70, scale: 1, font: 'big', color: R.UIC.blue, life: 1.4 });
        ui.pop('YOU HAVE CONTROL', { y: 80, scale: 1, font: 'small', color: R.UIC.white, life: 1.4, delay: 0.1 });
        break;
    }
  }

  function milestone(n) {
    const prev = g.run.bestBefore;
    if (prev > 0 && n > prev && !g.run.bestShown) {
      g.run.bestShown = true;
      view.confetti(70);
      A.best();
      ui.pop('NEW BEST!', { y: 60, scale: 2, italic: true, rainbow: true, life: 1.3 });
    }
    const words = {
      fly: { 42: 'THE ANSWER TO EVERYTHING', 50: 'HALF A CENTURY', 69: 'NICE.', 100: 'LEGEND STATUS', 150: 'ARE YOU FSF?' },
      kickflip: { 42: 'THE ANSWER TO EVERYTHING', 69: 'NICE.', 100: 'LEGEND STATUS' },
      tunnel: { 100: 'A FOOTBALL FIELD. UPSIDE DOWN.', 500: 'HALF A KILOMETER', 1000: '1 KM. BORING.' },
    }[game().id];
    if (words && words[n]) ui.pop(words[n], { y: 62, scale: n === 69 ? 2 : 1, font: 'big', color: R.UIC.yellow, life: 1.4 });
  }
  const NAMES = { model3: 'MODEL 3', modely: 'MODEL Y', cybercab: 'CYBERCAB', cybertruck: 'CYBERTRUCK', semi: 'SEMI', police: 'COP CAR' };
  const pick = (a) => a[Math.floor(fx() * a.length)];

  // ---------------- runs ----------------
  function beginRun() {
    setState('play');
    A.seq.setIntensity(2);
    g.run = {
      game: g.game,
      seed: g.world.seed,
      mode: g.mode,
      skin: g.skin,
      bestBefore: g.bestFor(),
      zoneMax: 0,
      score: 0,
    };
  }

  function endRun(e) {
    const w = g.world;
    const run = g.run;
    if (!run) return;
    const gm = R.GAMES[run.game];
    if (gm.id === 'launch') {
      // A clean slow-mo on the car leaving, no freeze-frame.
      g.slowT = e.result.foul ? 0.4 : 0.9;
      g.slowF = 0.45;
    } else {
      g.hitStop = 0.09;
      g.slowT = 1.0;
      g.slowF = 0.3;
    }
    A.seq.slow(false);
    setState('dying');
    run.score = w.score;
    run.near = w.near;
    run.topSpeed = w.topSpeed;
    run.inputs = w.inputs.slice();
    run.autoUntil = w.autoUntil;
    run.deathStep = w.deathStep;
    run.kind = e.kind;
    run.zone = w.zone;
    run.tricks = w.tricks | 0;
    run.roofs = w.roofs | 0;
    run.cars = w.cars | 0;
    run.flips = w.flips | 0;
    run.ceilT = w.ceilT || 0;
    run.result = w.result || null;
    const key = gm.key(run.mode);
    const before = g.best[key] | 0;
    if (gm.lowerBetter) {
      // 0-60 keeps your best reaction in ms; the robot's don't count.
      const r = run.result;
      const v = r && !r.foul && !r.robot ? Math.max(1, Math.round(r.rt * 1000)) : 0;
      run.newBest = v > 0 && (!before || v < before);
    } else run.newBest = run.score > before;
    if (run.newBest) g.best[key] = gm.lowerBetter ? Math.max(1, Math.round(run.result.rt * 1000)) : run.score;
    run.best = g.best[key] | 0;
    // The meta joke: every crash delays production a year; a great run pulls it in.
    run.etaFrom = g.eta;
    const d = gm.eta(run);
    if (d < 0) g.eta = Math.max(2027, g.eta - 1);
    else if (d > 0) {
      g.eta += 1;
      g.delays += 1;
    }
    run.etaTo = g.eta;
    const stamp = gm.stamp(run, w, e);
    run.stamp = stamp.text;
    run.stampCol = stamp.col || null;
    run.msg = gm.msg(run, w, e);
    run.trombone = gm.id === 'launch' ? run.result.foul || run.result.rt > 0.5 : run.score <= 1 || fx() < 0.3;
    run.fanfare = gm.id === 'launch' && !run.result.foul && run.result.total < R.LAUNCH_T.car;
    store.set('best', g.best);
    store.set('eta', g.eta);
    store.set('delays', g.delays);
    g.wantSnap = true;
  }

  // ---------------- killcam ----------------
  function startReplay() {
    const run = g.run;
    if (!run || run.deathStep < 0 || !R.GAMES[run.game].replay) return;
    const rw = new (R.GAMES[run.game].World)({
      seed: run.seed,
      mode: R.MODES[run.mode],
      skin: skinPhys(run.skin),
      replay: { inputs: run.inputs, autoUntil: run.autoUntil },
    });
    const from = Math.max(0, run.deathStep - 2 * 120);
    while (rw.state === 'play' && rw.step < from) {
      rw.update();
      rw.events.length = 0;
    }
    g.over = { world: g.world };
    g.world = rw;
    view.reset(rw.zone);
    view.skin = run.skin;
    A.seq.setSong(rw.zone);
    setState('replay');
    g.replayEnd = run.deathStep + 120;
  }
  function endReplay() {
    if (!g.over) return;
    g.world = g.over.world;
    view.skin = g.run.skin;
    g.over = null;
    setState('over');
    g.stateT = 1.25;
  }

  // ---------------- share card ----------------
  function shareCard() {
    const run = g.run;
    if (!run) return;
    const gm = R.GAMES[run.game];
    app.copy(gm.caption(run, g.eta));
    const card = gm.card(run);
    const c = app.card();
    const x = c.x;
    const fit = (str, max, o) => Math.max(1, Math.min(max, Math.floor(1000 / Math.max(1, R.measure(str, o)))));
    // The game's name, its logo drawn at game size and blown up five times.
    const logo = R.canvas(W, 66);
    ui.logo(logo.x, gm, 0, 6, { still: true });
    x.imageSmoothingEnabled = false;
    x.drawImage(logo.c, 0, 120, W * 5, 66 * 5);
    R.text(x, card.lead, 540, 500, { font: 'small', scale: fit(card.lead, 7, { font: 'small' }), color: '#ffffff', align: 'center' });
    const bs = fit(card.big, 40);
    R.text(x, card.big, 540, 580 + (40 - bs) * 3.5, { scale: bs, color: '#ffffff', outline: '#07040d', align: 'center' });
    R.text(x, card.label, 540, 890, { scale: fit(card.label, 10), color: '#ffe14d', align: 'center' });
    // The car, big, mid-flap with its wing up and jets firing.
    const spr = R.carSprite(run.skin, R.SKINS[run.skin].shape.wings ? 2 : 0, 0);
    const cs = 12;
    const cx = 540 - (spr.w * cs) / 2;
    const cy = 1010;
    x.imageSmoothingEnabled = false;
    if (gm.id === 'launch') {
      // Rear thrusters for the launch: the plume goes sideways.
      const n = R.SKINS[run.skin].shape.nozzles.rear;
      const jy = cy + (n[1] + 4) * cs;
      const jet = x.createLinearGradient(cx, 0, cx - 360, 0);
      jet.addColorStop(0, 'rgba(255,255,255,0.95)');
      jet.addColorStop(1, 'rgba(160,220,255,0)');
      x.fillStyle = jet;
      x.fillRect(cx - 360, jy - 18, 360, 36);
    } else
      for (const n of R.SKINS[run.skin].shape.nozzles.down) {
        const jx = cx + (n[0] + 4) * cs;
        const jy = cy + (n[1] + 4) * cs;
        const jet = x.createLinearGradient(0, jy, 0, jy + 220);
        jet.addColorStop(0, 'rgba(255,255,255,0.95)');
        jet.addColorStop(1, 'rgba(160,220,255,0)');
        x.fillStyle = jet;
        x.fillRect(jx - 14, jy, 28, 220);
      }
    x.drawImage(spr.base, cx, cy, spr.w * cs, spr.h * cs);
    R.text(x, card.line, 540, 1290, { font: 'small', scale: fit(card.line, 6, { font: 'small' }), color: '#2ef6ff', align: 'center' });
    R.text(x, run.stamp, 540, 1380, { scale: fit(run.stamp, 10), italic: true, color: run.stampCol || '#ff2a3d', outline: run.stampCol ? '#07040d' : '#3a0008', align: 'center' });
    const lines = R.wrap(run.msg, 170, { font: 'small' });
    lines.forEach((l, i) => R.text(x, l, 540, 1500 + i * 52, { font: 'small', scale: 6, color: '#ffffff', align: 'center' }));
    R.text(x, `PRODUCTION ETA ${g.eta}`, 540, 1680, { scale: 7, color: '#ff3fd2', align: 'center' });
    R.text(x, 'FAN-MADE PARODY GAME · NOT AFFILIATED WITH TESLA', 540, 1840, { font: 'small', scale: 4, color: '#8a7fb0', align: 'center' });
    app.saveCanvas(c, `${gm.name.toLowerCase().replace(/ /g, '-')}-${run.score}.png`, 'CARD SAVED · CAPTION COPIED');
  }

  // ---------------- input ----------------
  // ts: the input event's timestamp, so 0-60 can time a reaction to the millisecond.
  function tap(ts) {
    A.init();
    switch (g.state) {
      case 'title':
        startIntro();
        break;
      case 'ready':
      case 'play':
        g.world.tap(ts);
        holding = true;
        break;
      case 'over':
        if (g.stateT > 0.8) retry();
        break;
      case 'replay':
        endReplay();
        break;
      case 'paused':
        resume();
        break;
    }
  }

  // The address names the game (flappy-roadster.html#kickflip), so a link can open any of the four.
  function showGame() {
    try {
      history.replaceState(null, '', '#' + R.GAMES[g.game].id);
    } catch (e) {
      /* a viewer that doesn't allow it */
    }
  }
  const hashGame = () => R.GAMES.findIndex((gm) => gm.id === location.hash.slice(1));

  function press(id) {
    if (id.startsWith('game')) {
      const i = +id.slice(4);
      if (i === g.game) return;
      g.game = i;
      store.set('game', g.game);
      showGame();
      newWorld('title');
      view.reset(0);
    } else if (id === 'skin-' || id === 'skin+') {
      g.skin = (g.skin + (id === 'skin+' ? 1 : R.SKINS.length - 1)) % R.SKINS.length;
      store.set('skin', g.skin);
      newWorld('title', g.world);
    } else if (id.startsWith('mode')) {
      g.mode = +id.slice(4);
      store.set('mode', g.mode);
      if (g.world.setMode) g.world.setMode(R.MODES[g.mode]);
      else g.world.mode = R.MODES[g.mode];
    } else if (id === 'sound') {
      A.setLevel((A.level + 1) % 3);
      store.set('level', A.level);
    } else if (id === 'auto') {
      g.auto = (g.auto + 1) % 3;
      store.set('auto', g.auto);
      if (g.auto) A.engage();
      else A.disengage();
    } else if (id === 'pause') pause();
    else if (id === 'resume') resume();
    else if (id === 'quit' || id === 'garage') toTitle();
    else if (id === 'retry') retry();
    else if (id === 'replay') startReplay();
    else if (id === 'share') shareCard();
  }

  function pause() {
    if (g.state !== 'play') return;
    g.pausedFrom = g.state;
    setState('paused');
  }
  function resume() {
    if (g.state !== 'paused') return;
    setState('play');
  }

  let logoTaps = [];
  // Kickflip's jumps burn longer while the tap is held.
  let holding = false;
  function release() {
    if (!holding) return;
    holding = false;
    if ((g.state === 'play' || g.state === 'ready') && g.world.release) g.world.release();
  }
  // A pointer down that missed every button.
  function down(x, y, ts) {
    // Secret for creators: tap the logo five times to unlock every car.
    if (g.state === 'title' && y < 96) {
      const now = performance.now();
      logoTaps = logoTaps.filter((t) => now - t < 1500).concat(now);
      if (logoTaps.length >= 5) unlockAll();
      return;
    }
    tap(ts);
  }

  function unlockAll() {
    logoTaps = [];
    if (g.unlockAll) return;
    g.unlockAll = true;
    store.set('unlockAll', true);
    A.best();
    ui.pop('ALL CARS UNLOCKED', { y: 168, scale: 1, font: 'big', color: R.UIC.yellow, life: 1.6 });
  }

  let typed = '';
  function keydown(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') {
      ev.preventDefault();
      if (ev.repeat) return;
      if (g.state === 'over' && g.stateT > 0.5) retry();
      else tap(ev.timeStamp);
      return;
    }
    typed = (typed + k.toLowerCase()).slice(-8);
    if (typed === 'kickflip') unlockAll();
    if (k === 'p' || k === 'P' || k === 'Escape') {
      if (g.state === 'play') pause();
      else if (g.state === 'paused') resume();
    } else if (k === 'm' || k === 'M') app.press('sound');
    else if ((k === 'f' || k === 'F') && (g.state === 'title' || g.state === 'over')) app.press('auto');
    else if (g.state === 'title' && k >= '1' && k <= '4') app.press('mode' + (+k - 1));
    else if (g.state === 'title' && (k === 'g' || k === 'G')) app.press('game' + ((g.game + 1) % R.GAMES.length));
    else if (g.state === 'title' && (k === 'ArrowLeft' || k === 'ArrowRight')) app.press(k === 'ArrowRight' ? 'skin+' : 'skin-');
    else if (g.state === 'over' && (k === 'x' || k === 'X')) app.press('replay');
  }
  function keyup(ev) {
    if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W' || ev.key === 'Enter') release();
  }

  // ---------------- one frame ----------------
  function tick(dt) {
    g.t += dt;
    g.stateT += dt;

    let scale = 1;
    if (g.state === 'paused') scale = 0;
    if (g.hitStop > 0) {
      g.hitStop -= dt;
      scale = 0;
    } else if (g.slowT > 0) {
      g.slowT -= dt;
      scale = g.slowF;
      if (g.slowT <= 0) A.seq.slow(false);
    }
    if (g.state === 'replay') {
      // Half speed, then quarter speed and a push-in around the impact.
      const toDeath = (g.run.deathStep - g.world.step) * DT;
      const impact = toDeath < 0.4 && toDeath > -0.35;
      scale = impact ? 0.25 : 0.5;
      if (impact) view.hit('zoom', 1.22);
    }
    const simDt = dt * scale;
    g.acc += simDt;
    let n = 0;
    const replaying = g.state === 'replay';
    while (g.acc >= DT && n < 16) {
      g.world.update();
      const evs = g.world.events;
      g.world.events = [];
      for (const e of evs) onEvent(e, replaying);
      g.acc -= DT;
      n++;
    }
    if (n >= 16) g.acc = 0;

    logic(dt);

    view.update(simDt, g.world, g.world.t);
    view.screen(dt);
    ui.update(dt);
    view.drawWorld(g.world, g.world.t);
    view.present(g.world, (ctx) => ui.draw(ctx, g, g.t));
    // 0-60 times your reaction from the first frame that actually showed green.
    const lw = g.world;
    if (lw.kind === 'launch' && lw.lights.green && !lw.greenShownAt) lw.greenShownAt = performance.now();
    if (g.wantSnap && g.state === 'dying' && g.stateT > 0.05) {
      g.wantSnap = false;
      view.wantSnap = true;
    }
    // Keep the blimp out from behind the menus, the game names and the drag tree.
    R.hideBlimp = g.state === 'title' || g.state === 'intro' || g.state === 'ready' || g.world.kind === 'launch';
  }

  function logic(dt) {
    const w = g.world;
    // Hover needs thrust: idle puffs while waiting, a steady burn during liftoff.
    g.puffT -= dt;
    if (g.state === 'intro' && w.lifted && g.puffT <= 0) {
      g.puffT = 0.07;
      view.thrust(w, 0.55);
    }
    if (g.state === 'ready' && g.puffT <= 0 && !game().road) {
      g.puffT = 0.24;
      view.thrust(w, 0.3);
    }
    // Holding a kickflip jump keeps the thrusters burning.
    if (w.kind === 'kickflip' && w.car.burning && g.puffT <= 0) {
      g.puffT = 0.045;
      view.thrust(w, 0.35);
    }
    // 0-60: rear thrusters at full blast until the car is gone.
    if (w.kind === 'launch' && w.phase === 'launch' && w.car.x < R.W + 30 && g.puffT <= 0) {
      g.puffT = 0.03;
      view.plume(w, 1.4);
    }
    if (g.state === 'intro' && w.state === 'ready') setState('ready');
    if (g.state === 'ready' && g.auto && g.stateT > 0.8 && !w.auto) {
      w.auto = true;
      w.cinematic = g.auto === 2;
    }
    if (g.state === 'dying') {
      const settled = w.car.resting || g.stateT > 1.6;
      if (settled && g.stateT > 0.7) {
        A.stamp(g.run.trombone);
        if (g.run.fanfare) A.best();
        view.hit('shake', 4);
        setState('over');
      }
    }
    if (g.state === 'replay' && g.world.step >= g.replayEnd) endReplay();
  }

  // ---------------- boot ----------------
  app.run({
    view,
    g,
    boot(data) {
      if (data.game != null) g.game = R.clamp(data.game | 0, 0, R.GAMES.length - 1);
      else if (hashGame() >= 0) g.game = hashGame();
      addEventListener('hashchange', () => {
        const i = hashGame();
        if (i >= 0 && i !== g.game) app.press('game' + i);
      });
      if (data.mode != null) g.mode = R.clamp(data.mode | 0, 0, R.MODES.length - 1);
      if (data.skin != null) g.skin = R.clamp(data.skin | 0, 0, R.SKINS.length - 1);
      if (data.auto != null) g.auto = R.clamp(data.auto | 0, 0, 2);
      newWorld('title');
      view.reset(0);
    },
    tick,
    press,
    down,
    up: release,
    keydown,
    keyup,
    hidden: pause,
    snapshot: () => ({ game: g.game, mode: g.mode, skin: g.skin, auto: g.auto }),
    tap,
  });
})();
