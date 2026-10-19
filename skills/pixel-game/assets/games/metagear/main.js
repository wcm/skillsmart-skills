/* Meta Gear Solid · main: the flow (title, codec briefing, ready, sneaking, the "!" when you're
   caught, the result, the POV footage), what each moment looks and sounds like, share cards and
   input: hold anywhere to sneak, let go to hide (several fingers count as one), or hold Space.
   The engine's app runs the page. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const A = R.audio;
  const ui = R.ui;
  const app = R.app;
  const fx = R.fx;
  const C = R.UIC;
  const MG = R.MG;
  const DT = R.DT;
  R.store.ns = 'pixel-arcade:metagear:';
  const store = R.store;
  const view = new R.MView(app.canvas);

  const g = {
    state: 'title',
    stateT: 0,
    t: 0,
    auto: store.get('auto', 0) ? 1 : 0,
    best: store.get('best', 0) | 0,
    briefed: !!store.get('briefed', 0),
    world: null, // the run, or the room behind the title
    pov: null, // the replayed run while its footage plays
    run: null, // the last result
    codecI: 0,
    codecF: 0,
    codecN: 0,
    codecThen: 'ready',
    hintT: 0,
    acc: 0,
    pausedFrom: null,
  };
  A.level = R.clamp(store.get('sound', 0) | 0, 0, 2);
  const pick = (a) => a[Math.floor(fx() * a.length)];
  const seed = R.nextSeed;

  function setState(s) {
    g.state = s;
    g.stateT = 0;
  }

  // ---------------- the flow ----------------
  function toTitle() {
    setState('title');
    g.world = new R.World({ seed: seed() });
    g.pov = null;
    fingers.clear();
    view.reset();
    ui.pops.length = 0;
    ui.banner = null;
    A.seq.duck(false);
    A.seq.setSong(0);
    A.seq.setIntensity(0);
  }

  function start() {
    A.init();
    if (!g.briefed) openCodec('ready');
    else toReady();
  }

  function openCodec(then) {
    setState('codec');
    g.codecI = 0;
    g.codecF = 0;
    g.codecN = 0;
    g.codecThen = then;
    A.codecRing();
    A.seq.setIntensity(0);
  }
  function codecNext() {
    const line = ui.CODEC[g.codecI];
    if (g.codecN < line[2].length) {
      g.codecF = g.codecN = line[2].length;
      return;
    }
    if (g.codecI < ui.CODEC.length - 1) {
      g.codecI++;
      g.codecF = g.codecN = 0;
      A.codecBlip();
    } else codecDone();
  }
  function codecDone() {
    g.briefed = true;
    store.set('briefed', 1);
    if (g.codecThen === 'ready') toReady();
    else toTitle();
  }

  function toReady() {
    setState('ready');
    g.world = new R.World({ seed: seed(), auto: !!g.auto });
    g.run = null;
    fingers.clear();
    keyHold = false;
    view.reset();
    ui.pops.length = 0;
    ui.banner = null;
    g.hintT = g.best < 40 ? 6 : 0;
    A.seq.duck(false);
    A.seq.setSong(0);
    A.seq.setIntensity(1);
  }

  const LINES = {
    seen: ['YOU ARE NOW CONTENT.', 'POSTED BEFORE YOU COULD SAY NO.', 'THE LED WAS ON. TECHNICALLY.', 'YOUR CAMEO IS LIVE.', 'NOW IN FOUR GROUP CHATS.'],
    heard: ['NOBODY SAID "HEY META".', 'IT WAS LISTENING THE WHOLE TIME.', 'FILED UNDER FALSE WAKE.', 'VOICE CLIP KEPT FOR UP TO A YEAR.'],
    box: ['NICE BOX. POSTED IT.', 'EVEN THE BOX GOT TAGGED.', 'STARED AT THE BOX. THE BOX STARED BACK.'],
    bump: ['TRIPPED OVER YOU. FILMED IT.', 'WHO LEAVES A BOX IN A WALKWAY?'],
    cafe: ['NOW IN A LATTE ART REEL.'],
    gym: ['YOU MADE THEIR LEG DAY VLOG.'],
    wedding: ['YOU ARE IN THE WEDDING VIDEO NOW.'],
    expo: ['YOU ARE THE DEMO NOW.'],
  };

  function endRun() {
    const w = g.world;
    const score = w.score;
    const newBest = score > g.best;
    if (newBest) {
      g.best = score;
      store.set('best', score);
    }
    const zone = w.catcher.zone;
    g.run = {
      score,
      newBest,
      rank: ui.rank(score),
      handle: w.catcher.handle,
      why: w.why,
      stamp: 'RECORDED',
      msg: pick(LINES[w.why].concat(LINES[w.why], LINES[zone])),
      rooms: w.room,
      boxes: w.stats.boxes,
      close: w.stats.close,
      fooled: w.stats.fooled,
      seed: w.seed,
      inputs: w.inputs.slice(),
      autoUntil: w.autoUntil,
      deathStep: w.deathStep,
    };
    setState('over');
    A.shutter();
    A.stamp(false);
    A.seq.duck(true);
  }

  // ---------------- what happens on screen ----------------
  const ROOM_SUB = {
    cafe: 'EVERYONE IS FILMING THEIR LATTE',
    gym: 'EVERYONE IS FILMING THEIR SET',
    wedding: 'EVERYONE IS FILMING THE VOWS',
    expo: 'EVERYONE IS WEARING THE DEMO',
  };
  function onEvent(e, w, replaying) {
    const px = R.pathX(w.d);
    switch (e.type) {
      case 'box':
        A.boxDown();
        view.onBox();
        break;
      case 'unbox':
        A.boxUp();
        break;
      case 'step':
        A.step(e.foot, R.ZONES[w.room % R.ZONES.length].id);
        view.onStep(w);
        break;
      case 'close':
        A.close();
        ui.pop('CLOSE CALL', { x: px, y: MG.PY - 44, font: 'small', scale: 1, color: C.yellow, life: 0.8, vy: -18, tag: 'close' });
        break;
      case 'fooled':
        A.fooled();
        ui.pop('JUST A BOX', { x: px, y: MG.PY - 34, font: 'small', scale: 1, color: '#e2c08a', life: 0.9, vy: -14, tag: 'fooled' });
        break;
      case 'sus':
        A.huh();
        break;
      case 'wake':
        A.wake();
        break;
      case 'ring':
        A.listen();
        break;
      case 'turn':
        A.turnWarn();
        break;
      case 'room':
        A.room();
        if (!replaying) ui.showBanner({ kicker: `ROOM ${e.k + 1}`, title: e.zone.name, sub: ROOM_SUB[e.zone.id] });
        break;
      case 'disengage':
        A.disengage();
        ui.pop('YOU HAVE CONTROL', { y: 150, font: 'big', scale: 1, color: C.blue, life: 1.2 });
        break;
      case 'caught':
        A.alert();
        view.flashCol = '255,40,70';
        view.hit('flash', 0.45);
        view.hit('shake', 3);
        view.hit('aber', 2.5);
        view.hit('zoom', 1.25);
        view.onCaught(w);
        if (!replaying) {
          A.seq.setSong(1);
          A.seq.setIntensity(3);
          snapAt = g.t + 0.3;
        }
        break;
    }
  }
  let snapAt = -1;

  // ---------------- POV footage ----------------
  // The last few seconds again, rebuilt from the seed and the inputs, as the guest's glasses saw it.
  function startPOV() {
    const r = g.run;
    if (!r) return;
    const pw = new R.World({ seed: r.seed, replay: { inputs: r.inputs, autoUntil: r.autoUntil } });
    const from = Math.max(0, r.deathStep - 300);
    while (pw.step < from) pw.update();
    g.pov = pw;
    g.povEnd = r.deathStep + 130;
    view.reset();
    ui.pops.length = 0;
    ui.banner = null;
    setState('pov');
  }
  function endPOV() {
    g.pov = null;
    setState('over');
    g.stateT = 1.25;
  }

  // ---------------- share card ----------------
  function shareCard() {
    const r = g.run;
    if (!r) return;
    app.copy(`I snuck ${r.score} m through a party of smart glasses in Meta Gear Solid before someone recorded me. Rank: ${r.rank}. #MetaGearSolid`);
    const c = app.card();
    const x = c.x;
    const top = x.createLinearGradient(0, 0, 0, 900);
    top.addColorStop(0, 'rgba(5,2,14,0.7)');
    top.addColorStop(1, 'rgba(5,2,14,0)');
    x.fillStyle = top;
    x.fillRect(0, 0, 1080, 900);
    const logo = R.canvas(W, 72);
    ui.mlogo(logo.x, 0, 4, true);
    x.drawImage(logo.c, 0, 70, W * 5, 72 * 5);
    const gl = R.canvas(96, 30);
    ui.bigGlasses(gl.x, 0.1, 0, 0, 1, true);
    x.drawImage(gl.c, 540 - 96 * 4, 470, 96 * 8, 30 * 8);
    R.text(x, 'RECORDED', 540, 800, { scale: 13, italic: true, color: '#ff2a3d', outline: '#3a0008', align: 'center' });
    R.text(x, `${r.score} M`, 540, 960, { scale: 22, color: '#ffffff', outline: '#07040d', align: 'center' });
    R.text(x, `RANK: ${r.rank}`, 540, 1160, { scale: 8, color: '#ffe14d', outline: '#07040d', align: 'center' });
    R.text(x, `RECORDED BY ${r.handle}`, 540, 1270, { font: 'small', scale: 7, color: '#2ef6ff', align: 'center' });
    R.wrap(r.msg, 170, { font: 'small' }).forEach((l, i) => R.text(x, l, 540, 1400 + i * 52, { font: 'small', scale: 6, color: '#ffffff', align: 'center' }));
    R.text(x, `BEST ${g.best} M`, 540, 1600, { scale: 6, color: '#ff3fd2', align: 'center' });
    R.text(x, 'FAN-MADE PARODY GAME · NOT AFFILIATED WITH META, RAY-BAN OR KONAMI', 540, 1840, { font: 'small', scale: 3, color: '#8a7fb0', align: 'center' });
    app.saveCanvas(c, `meta-gear-solid-${r.score}m.png`, 'CARD SAVED · CAPTION COPIED');
  }

  // ---------------- input ----------------
  const fingers = new Set(); // pointers down since the run became holdable
  let keyHold = false;
  const holding = () => fingers.size > 0 || keyHold;
  const runState = () => g.state === 'ready' || g.state === 'play';

  function press(id) {
    if (id === 'sound') {
      A.setLevel((A.level + 1) % 3);
      store.set('sound', A.level);
    } else if (id === 'auto') {
      g.auto = g.auto ? 0 : 1;
      store.set('auto', g.auto);
      if (g.auto) A.engage();
      else A.disengage();
    } else if (id === 'codec') openCodec('title');
    else if (id === 'skip') codecDone();
    else if (id === 'retry') toReady();
    else if (id === 'menu' || id === 'quit') toTitle();
    else if (id === 'replay') startPOV();
    else if (id === 'share') shareCard();
    else if (id === 'pause' && runState()) {
      g.pausedFrom = g.state;
      setState('paused');
      fingers.clear();
      keyHold = false;
    } else if (id === 'resume' && g.state === 'paused') setState(g.pausedFrom || 'play');
  }

  // A press anywhere that isn't a button.
  function tap() {
    if (g.state === 'title') start();
    else if (g.state === 'codec') codecNext();
    else if (g.state === 'pov') endPOV();
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
    if (g.state === 'title') {
      if (k === 'g' || k === 'G') app.press('auto');
      else if (k === 'c' || k === 'C') app.press('codec');
      else if (k === 'Enter' || HOLD[k]) start();
      return;
    }
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
    if (g.state === 'codec') {
      const line = ui.CODEC[g.codecI];
      if (g.codecN < line[2].length) {
        g.codecF = Math.min(line[2].length, g.codecF + dt * 38);
        const n = Math.floor(g.codecF);
        if (Math.floor(n / 3) > Math.floor(g.codecN / 3)) A.codecBlip();
        g.codecN = n;
      }
    }
    const w = g.state === 'pov' ? g.pov : g.world;
    let scale = 0;
    if (g.state === 'title' || g.state === 'ready' || g.state === 'play' || g.state === 'caught' || g.state === 'over') scale = 1;
    if (g.state === 'pov') {
      const toCatch = (g.run.deathStep - w.step) * DT;
      scale = toCatch < 0.6 && toCatch > -0.4 ? 0.25 : 0.5;
      view.hit('zoom', 1.3);
    }
    if (w && scale > 0) {
      if (!w.replay) w.input = runState() && holding();
      g.acc += dt * scale;
      let n = 0;
      while (g.acc >= DT && n < 16) {
        w.update();
        for (const e of w.events) onEvent(e, w, g.state === 'pov');
        g.acc -= DT;
        n++;
      }
      if (n >= 16) g.acc = 0;
    }
    if (g.state === 'ready' && w.state === 'play') setState('play');
    if (g.state === 'play') g.hintT = Math.max(0, g.hintT - dt);
    if (g.state === 'play' && w.state === 'caught') setState('caught');
    if (g.state === 'caught' && w.state === 'dead') endRun();
    if (g.state === 'pov' && w.step >= g.povEnd) endPOV();
    if (snapAt > 0 && g.t >= snapAt) {
      snapAt = -1;
      view.wantSnap = true;
    }

    view.update(g.state === 'paused' ? 0 : dt * Math.max(scale, 0.25), w);
    view.screen(dt);
    ui.update(dt);
    view.drawWorld(w, g.t, {});
    view.present(w, (ctx) => ui.draw(ctx, g, g.t));
  }

  app.run({
    view,
    g,
    boot(data) {
      if (data.auto != null) g.auto = data.auto ? 1 : 0;
      toTitle();
      app.canvas.setAttribute('aria-label', 'Meta Gear Solid. A fan-made stealth game: hold to sneak past smart-glasses wearers, let go to hide in a box. Tap to start.');
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
