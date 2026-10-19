/* Model Kombat · main: the match (best of three rounds), the summit intro, round calls, what every
   hit looks and sounds like, the finisher, the K.O. replay, share cards and input (the on-screen
   pad with several fingers at once, or the keyboard). The engine's app runs the page. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const A = R.audio;
  const ui = R.ui;
  const app = R.app;
  const fx = R.fx;
  const C = R.UIC;
  const K = R.KOMBAT;
  const IN = R.IN;
  const DT = R.DT;
  R.store.ns = 'pixel-arcade:kombat:';
  const store = R.store;
  const view = new R.KView(app.canvas);

  const g = {
    state: 'title',
    stateT: 0,
    t: 0,
    sel: R.clamp(store.get('sel', 0) | 0, 0, 1),
    level: R.clamp(store.get('level', 1) | 0, 0, R.LEVELS.length - 1),
    auto: store.get('auto', 0) ? 1 : 0,
    tally: Object.assign({ sam: 0, dario: 0 }, store.get('tally', {}) || {}),
    ids: ['sam', 'dario'],
    round: null,
    roundN: 0,
    wins: [0, 0],
    rounds: [],
    ghost: [K.HP, K.HP],
    pad: {},
    hitStop: 0,
    slowT: 0,
    slowF: 1,
    acc: 0,
    doneT: 0,
    musicSlowT: 0,
    musicFastT: 0,
    match: null,
  };
  A.level = R.clamp(store.get('sound', 0) | 0, 0, 2);
  const pick = (a) => a[Math.floor(fx() * a.length)];

  function setState(s) {
    g.state = s;
    g.stateT = 0;
  }

  function toTitle() {
    setState('title');
    pending.length = 0;
    g.round = null;
    view.reset();
    ui.pops.length = 0;
    A.seq.duck(false);
    A.seq.slow(false);
    A.seq.setSong(0);
    A.seq.setIntensity(0);
  }

  // ---------------- the match ----------------
  function startMatch() {
    A.init();
    g.ids = g.sel === 0 ? ['sam', 'dario'] : ['dario', 'sam'];
    g.wins = [0, 0];
    g.roundN = 0;
    g.rounds = [];
    g.match = null;
    g.took = false; // took over from the CPU: the player keeps the controls for the match
    nextRound(true);
  }

  function nextRound(first) {
    g.roundN++;
    g.deprecated = false;
    g.lastPerfect = false;
    g.round = new R.Round({ seed: R.nextSeed(), ids: g.ids, cpu: [!!g.auto && !g.took, true], level: g.level, wins: g.wins.slice(), need: 2 });
    g.ghost = [K.HP, K.HP];
    g.doneT = 0;
    g.acc = 0;
    g.hitStop = g.slowT = 0;
    held.clear();
    edges = 0;
    view.reset();
    ui.pops.length = 0;
    A.seq.duck(false);
    A.seq.slow(false);
    A.seq.setSong(1);
    A.seq.setIntensity(1);
    if (first) {
      // The hook: side by side at the summit, the back row holding hands, then fists up.
      setState('intro');
      const [a, b] = g.round.f;
      a.x = W / 2 - 16;
      b.x = W / 2 + 16;
      for (const f of g.round.f) {
        f.state = 'intro';
        f.pose = 'stand';
      }
    } else call();
  }

  function call() {
    const [a, b] = g.round.f;
    a.x = 70;
    b.x = W - 70;
    for (const f of g.round.f) {
      f.state = 'idle';
      f.stateT = 0;
      f.face = f.side === 0 ? 1 : -1;
    }
    setState('call');
    ui.pop(`ROUND ${g.roundN}`, { y: 128, scale: 3, italic: true, gradient: R.GRAD.chrome, life: 0.9, vy: 0 });
    A.sting('round');
  }

  function endRound() {
    const r = g.round;
    g.rounds.push({ seed: r.seed, inputs: r.inputs.slice(), cpuUntil: r.f.map((f) => f.cpuUntil), cpu: r.f.map((f) => f.cpu || f.cpuUntil > 0), koStep: r.koStep, doneStep: r.doneStep, winner: r.winner, wins: r.wins.slice(), level: g.level, stats: r.f.map((f) => Object.assign({}, f.stats)) });
    if (r.winner >= 0) g.wins[r.winner]++;
    const done = g.wins[0] >= 2 || g.wins[1] >= 2 || g.roundN >= 5;
    if (done) endMatch();
    else nextRound(false);
  }

  const LINES = {
    sam: ['ADS: 1. NO ADS: 0.', 'THE AD BREAK LANDED.', 'SPONSORED BY A WIN.', 'ACCELERATION: CONFIRMED.', 'SHIPPED IT. THEN SHIPPED IT AGAIN.'],
    dario: ['SAFETY FIRST. FISTS SECOND.', 'SLOWED DOWN. STILL WON.', 'THE SUPER BOWL AD AGED WELL.', 'RESPONSIBLY KNOCKED OUT.'],
    both: ["THEY STILL WON'T HOLD HANDS.", 'SOMEONE PLEASE ORGANIZE LUNCH.', 'THE AI CINEMATIC UNIVERSE EXPANDS.', 'BOTH BOARDS HAVE BEEN NOTIFIED.', 'HAND-HOLDING: STILL PENDING.'],
    deprecated: ['SUNSET ANNOUNCED. NO MIGRATION PATH.', 'MOVED TO LEGACY MODELS.'],
    perfect: ['FLAWLESS BENCHMARK.'],
  };

  function endMatch() {
    const side = g.wins[0] === g.wins[1] ? -1 : g.wins[0] > g.wins[1] ? 0 : 1;
    const winnerId = side >= 0 ? g.ids[side] : null;
    if (winnerId) {
      g.tally[winnerId]++;
      store.set('tally', g.tally);
    }
    // The replay shows the last K.O. of the match (a round on time has none).
    const last = g.rounds.slice().reverse().find((rd) => rd.koStep >= 0) || null;
    const sum = (k) => g.rounds.reduce((a, rd) => a + rd.stats[side < 0 ? 0 : side][k], 0);
    const best = g.rounds.reduce((a, rd) => Math.max(a, rd.stats[side < 0 ? 0 : side].best), 0);
    const perfect = g.lastPerfect;
    let pool = LINES.both;
    if (g.deprecated) pool = pool.concat(LINES.deprecated, LINES.deprecated);
    if (winnerId) pool = pool.concat(LINES[winnerId], LINES[winnerId]);
    if (perfect) pool = LINES.perfect.concat(pool);
    g.match = {
      ids: g.ids.slice(),
      wins: g.wins.slice(),
      winnerId,
      level: g.level,
      hits: sum('hits'),
      best,
      supers: sum('supers'),
      stamp: g.deprecated ? 'DEPRECATED' : winnerId ? `${R.FIGHTERS[winnerId].name} WINS` : 'DOUBLE K.O.',
      stampCol: g.deprecated ? '#9aa0ab' : winnerId ? C.yellow : C.red,
      msg: perfect && fx() < 0.5 ? 'FLAWLESS BENCHMARK.' : pick(pool),
      last,
    };
    setState('over');
    A.stamp(false);
    A.sting('win');
    A.seq.duck(true);
  }

  // ---------------- what happens on screen ----------------
  function onEvent(e, replaying) {
    const r = replaying ? g.replayRound : g.round;
    const fy = (y) => K.FLOOR + y;
    switch (e.type) {
      case 'swing':
        A.swing(e.kind);
        break;
      case 'hit': {
        const heavy = e.kind !== 'jab';
        view.spark(e.x, e.y, false);
        view.hit('shake', heavy ? 3 : 1.6);
        if (!replaying) g.hitStop = heavy ? 0.07 : 0.045;
        A.smack(e.kind, e.combo);
        if (e.first && !replaying) ui.pop('FIRST TOKEN', { y: 154, font: 'big', scale: 1, color: C.yellow, life: 1.1, vy: -6 });
        if (e.combo >= 2) {
          const x = e.side === 0 ? 46 : W - 46;
          ui.pop(`${e.combo} HITS`, { x, y: 92, scale: 2, italic: true, gradient: R.GRAD.heat, life: 0.8, tag: 'combo' + e.side, vy: -4 });
          if (e.combo >= 4) ui.pop('CHAIN OF THOUGHT', { x, y: 110, font: 'small', scale: 1, color: C.white, life: 0.9, tag: 'chain' + e.side, vy: -4 });
        }
        break;
      }
      case 'block':
        view.spark(e.x, e.y, true);
        A.guard();
        ui.pop('GUARDRAIL', { x: e.x, y: e.y - 26, font: 'small', scale: 1, color: C.blue, life: 0.5, vy: -20, tag: 'guard' });
        break;
      case 'proj':
        if (e.kind === 'ad') A.adPop();
        else A.tvOn();
        ui.pop(e.kind === 'ad' ? 'AD BREAK' : 'SUPER BOWL AD', { x: e.x, y: e.y - 22, font: 'small', scale: 1, color: e.kind === 'ad' ? C.pink : '#ffb35a', life: 0.7, vy: -16, tag: 'proj' + e.side });
        break;
      case 'clash':
        view.spark(e.x, e.y, false);
        view.burst(e.x, e.y, 24, ['#ffffff', '#ff3fd2', '#ffb35a'], 260, 0.6, 120);
        view.hit('shake', 3);
        A.clash();
        ui.pop('CONTEXT COLLISION!', { y: 120, font: 'big', scale: 1, color: C.yellow, life: 1.0, shakeX: 2 });
        break;
      case 'jump':
        A.hop();
        break;
      case 'land':
        A.thud();
        view.dust(r.f[e.side].x);
        break;
      case 'super': {
        const acc = e.kind === 'accelerate';
        view.hit('flash', 0.4);
        view.flashCol = acc ? '200,250,255' : '150,190,255';
        view.hit('zoom', 1.1);
        A.superUp(e.kind);
        ui.pop(acc ? 'ACCELERATE!' : 'SLOW DOWN!', { y: 112, scale: 3, italic: true, gradient: acc ? R.GRAD.ice : R.GRAD.neon, life: 1.3, shakeX: 2 });
        if (!replaying) {
          if (acc) {
            g.musicFastT = 4.2;
            A.seq.setIntensity(3);
          } else {
            g.musicSlowT = 4.2 * 1.4;
            A.seq.slow(true);
          }
        }
        break;
      }
      case 'ko':
        view.hit('flash', 0.6);
        view.flashCol = '255,255,255';
        view.hit('shake', 6);
        view.hit('aber', 3.5);
        view.hit('zoom', 1.16);
        A.knock();
        if (!replaying) {
          g.slowT = 1.1;
          g.slowF = 0.3;
          g.lastPerfect = e.perfect;
          g.deprecated = false;
        }
        ui.pop('K.O.', { y: 112, scale: 5, italic: true, color: C.red, outline: '#3a0008', life: e.finish ? 1.0 : 1.4, shakeX: 3, vy: 0, tag: 'ko' });
        if (e.perfect) ui.pop('FLAWLESS BENCHMARK', { y: 150, font: 'big', scale: 1, color: C.yellow, life: 1.6, delay: 0.5, vy: 0, tag: 'perfect' });
        if (e.perfect) A.sting('perfect');
        // The finisher is the player's to do; a winning CPU just does it.
        if (e.finish && !replaying && !r.f[e.winner].cpu) {
          ui.pop('FINE-TUNE HIM!', { y: 128, scale: 2, italic: true, color: C.red, outline: '#3a0008', life: 2.4, delay: 0.8, shakeX: 2, vy: 0, tag: 'finish' });
          later(0.8, () => A.sting('finish'), 'finish');
        }
        break;
      case 'deprecate':
      case 'fall':
        // The finisher's prompts give way to what happened.
        ui.pops = ui.pops.filter((p) => p.tag !== 'ko' && p.tag !== 'perfect' && p.tag !== 'finish');
        cancel('finish');
        if (e.type === 'fall') {
          A.thud();
          A.crowd(false);
          break;
        }
        view.deprecate(r.f[e.loser]);
        view.hit('flash', 0.5);
        view.flashCol = '180,180,190';
        view.hit('glitch', 0.4);
        A.sting('deprecate');
        A.crowd(true);
        if (!replaying) g.deprecated = true;
        ui.pop('DEPRECATED', { y: 120, scale: 3, italic: true, color: '#c9ccd3', outline: '#1a1a22', life: 2.2, shakeX: 2, vy: 0 });
        ui.pop('SUNSET ANNOUNCED', { y: 146, font: 'small', scale: 1, color: C.white, life: 2, delay: 0.3, vy: 0 });
        break;
      case 'timeup':
        A.sting('finish');
        ui.pop('OUT OF COMPUTE', { y: 116, scale: 2, italic: true, color: C.yellow, life: 1.8, vy: 0 });
        if (!replaying) g.lastPerfect = false;
        break;
      case 'takeover':
        if (!replaying) g.took = true;
        A.disengage();
        ui.pop('YOU HAVE CONTROL', { y: 140, font: 'big', scale: 1, color: C.blue, life: 1.2 });
        break;
    }
  }

  // Delayed sounds, timed on the game clock (not setTimeout, so manual clocks stay exact).
  const pending = [];
  function later(s, fn, tag) {
    pending.push({ at: g.t + s, fn, tag });
  }
  function cancel(tag) {
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].tag === tag) pending.splice(i, 1);
  }

  // ---------------- the K.O. replay ----------------
  function startReplay() {
    const last = g.match && g.match.last;
    if (!last || last.koStep < 0) return;
    const rr = new R.Round({ seed: last.seed, ids: g.ids, cpu: last.cpu, level: last.level, wins: last.wins, need: 2, replay: last.inputs, cpuUntil: last.cpuUntil });
    const from = Math.max(0, last.koStep - 300);
    while (rr.step < from && rr.state !== 'done') {
      rr.update();
      rr.events.length = 0;
    }
    g.replayRound = rr;
    // Through the K.O., and the finisher when there was one.
    g.koStep = last.koStep;
    g.doneStep = last.doneStep > last.koStep ? last.doneStep : -1;
    g.replayEnd = Math.max(last.koStep, last.doneStep) + 170;
    view.reset();
    ui.pops.length = 0;
    setState('replay');
  }
  function endReplay() {
    g.replayRound = null;
    setState('over');
    g.stateT = 1.25;
  }

  // ---------------- share card ----------------
  function shareCard() {
    const m = g.match;
    if (!m) return;
    const win = m.winnerId ? R.FIGHTERS[m.winnerId] : null;
    const lose = win ? R.FIGHTERS[m.ids.find((id) => id !== m.winnerId)] : null;
    app.copy(win ? `${win.full} beat ${lose.full} ${Math.max(...m.wins)}-${Math.min(...m.wins)} in Model Kombat. They still won't hold hands. #ModelKombat #AI` : `Sam and Dario went the distance in Model Kombat. Nobody won. Nobody held hands. #ModelKombat #AI`);
    const c = app.card();
    const x = c.x;
    const top = x.createLinearGradient(0, 0, 0, 1100);
    top.addColorStop(0, 'rgba(5,2,14,0.75)');
    top.addColorStop(1, 'rgba(5,2,14,0)');
    x.fillStyle = top;
    x.fillRect(0, 0, 1080, 1100);
    const logo = R.canvas(W, 72);
    ui.klogo(logo.x, 0, 4, true);
    x.drawImage(logo.c, 0, 80, W * 5, 72 * 5);
    if (win) {
      const port = R.fighterPortrait(m.winnerId, 'win');
      x.drawImage(port.c, 540 - 33 * 7, 480, 66 * 7, 74 * 7);
    }
    const fit = (str, max, o) => Math.max(1, Math.min(max, Math.floor(1000 / Math.max(1, R.measure(str, o)))));
    const head = win ? `${win.name} WINS` : 'DOUBLE K.O.';
    R.text(x, head, 540, 1030, { scale: fit(head, 14), italic: true, color: win ? '#ffe14d' : '#ff2a3d', outline: '#07040d', align: 'center' });
    R.text(x, `${m.wins[0]} - ${m.wins[1]}`, 540, 1170, { scale: 14, color: '#ffffff', outline: '#07040d', align: 'center' });
    R.text(x, `${R.FIGHTERS[m.ids[0]].name} VS ${R.FIGHTERS[m.ids[1]].name} · ${R.LEVELS[m.level].name}`, 540, 1290, { font: 'small', scale: 6, color: '#2ef6ff', align: 'center' });
    if (m.stamp === 'DEPRECATED') R.text(x, 'DEPRECATED', 540, 1380, { scale: 9, italic: true, color: '#c9ccd3', outline: '#1a1a22', align: 'center' });
    const lines = R.wrap(m.msg, 170, { font: 'small' });
    lines.forEach((l, i) => R.text(x, l, 540, 1500 + i * 52, { font: 'small', scale: 6, color: '#ffffff', align: 'center' }));
    R.text(x, `THE FEUD · SAM ${g.tally.sam} · DARIO ${g.tally.dario}`, 540, 1680, { scale: 6, color: '#ff3fd2', align: 'center' });
    R.text(x, 'FAN-MADE PARODY GAME · NOT AFFILIATED WITH OPENAI OR ANTHROPIC', 540, 1840, { font: 'small', scale: 3, color: '#8a7fb0', align: 'center' });
    app.saveCanvas(c, `model-kombat-${win ? win.id + '-wins' : 'draw'}.png`, 'CARD SAVED · CAPTION COPIED');
  }

  // ---------------- input ----------------
  const held = new Map(); // pointer id → pad button id, for the buttons held down
  let keys = 0; // held directions from the keyboard
  let edges = 0; // presses since the last fight step
  const padAt = (x, y) => R.KPAD.find((p) => x >= p.x - 2 && x <= p.x + p.w + 2 && y >= p.y - 2 && y <= p.y + p.h + 2);
  const humanFighting = () => g.round && !g.round.f[0].cpu && (g.state === 'fight' || g.state === 'call');

  function press(id) {
    if (id.startsWith('sel')) {
      g.sel = +id.slice(3);
      store.set('sel', g.sel);
      if (g.auto) {
        g.auto = 0;
        store.set('auto', 0);
      }
    } else if (id.startsWith('level')) {
      g.level = +id.slice(5);
      store.set('level', g.level);
    } else if (id === 'sound') {
      A.setLevel((A.level + 1) % 3);
      store.set('sound', A.level);
    } else if (id === 'auto') {
      g.auto = g.auto ? 0 : 1;
      store.set('auto', g.auto);
      if (g.auto) A.engage();
      else A.disengage();
    } else if (id === 'fight' || id === 'rematch') startMatch();
    else if (id === 'menu' || id === 'quit') toTitle();
    else if (id === 'replay') startReplay();
    else if (id === 'share') shareCard();
    else if (id === 'pause' && (g.state === 'fight' || g.state === 'call')) {
      g.pausedFrom = g.state;
      setState('paused');
    } else if (id === 'resume' && g.state === 'paused') setState(g.pausedFrom || 'fight');
  }

  function tap() {
    if (g.state === 'title') press('fight');
    else if (g.state === 'intro') endIntro();
    else if (g.state === 'replay') endReplay();
    else if (g.state === 'over' && g.stateT > 1) press('rematch');
    else if ((g.state === 'fight' || g.state === 'call') && g.round.f[0].cpu) g.round.takeOver(0);
  }

  function down(x, y, ts, id) {
    if (humanFighting()) {
      const p = padAt(x, y);
      if (!p) return;
      held.set(id, p.id);
      g.pad[p.id] = true;
      if (!p.hold) edges |= p.bit;
      return;
    }
    tap();
  }
  function move(x, y, id) {
    if (!held.has(id)) return;
    const p = padAt(x, y);
    const was = held.get(id);
    if (!p || p.id === was || !p.hold) return;
    // Sliding a thumb from one arrow to the other.
    g.pad[was] = false;
    held.set(id, p.id);
    g.pad[p.id] = true;
  }
  function up(id) {
    const was = held.get(id);
    if (was == null) return;
    held.delete(id);
    if (![...held.values()].includes(was)) g.pad[was] = false;
  }
  function heldBits() {
    let b = keys;
    for (const id of held.values()) {
      const p = R.KPAD.find((q) => q.id === id);
      if (p && p.hold) b |= p.bit;
    }
    return b;
  }

  const KEYS = { ArrowLeft: IN.L, a: IN.L, A: IN.L, ArrowRight: IN.R, d: IN.R, D: IN.R };
  const PRESS = { ArrowUp: IN.U, w: IN.U, W: IN.U, ' ': IN.U, z: IN.P, Z: IN.P, j: IN.P, J: IN.P, x: IN.Kk, X: IN.Kk, k: IN.Kk, K: IN.Kk, c: IN.S, C: IN.S, l: IN.S, L: IN.S };
  function keydown(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if (KEYS[k] || PRESS[k]) ev.preventDefault();
    if (ev.repeat) return;
    if (k === 'p' || k === 'P' || k === 'Escape') {
      if (g.state === 'paused') press('resume');
      else press('pause');
      return;
    }
    if (k === 'm' || k === 'M') return app.press('sound');
    if (humanFighting()) {
      if (KEYS[k]) keys |= KEYS[k];
      if (PRESS[k]) edges |= PRESS[k];
      return;
    }
    if (g.state === 'title') {
      if (k === 'ArrowLeft' || k === 'ArrowRight') app.press('sel' + (k === 'ArrowLeft' ? 0 : 1));
      else if (k >= '1' && k <= '4') app.press('level' + (+k - 1));
      else if (k === 'Enter' || k === ' ') app.press('fight');
      return;
    }
    if (k === 'Enter' || k === ' ') tap();
    else if (g.state === 'over' && (k === 'r' || k === 'R')) app.press('replay');
  }
  function keyup(ev) {
    if (KEYS[ev.key]) keys &= ~KEYS[ev.key];
  }

  function endIntro() {
    if (g.state !== 'intro') return;
    call();
  }

  // ---------------- one frame ----------------
  function tick(dt) {
    g.t += dt;
    g.stateT += dt;
    for (let i = pending.length - 1; i >= 0; i--)
      if (g.t >= pending[i].at) {
        pending[i].fn();
        pending.splice(i, 1);
      }
    const r = g.state === 'replay' ? g.replayRound : g.round;

    // The intro: fists up at 2.4 s, then they step apart into their corners.
    if (g.state === 'intro') {
      const t = g.stateT;
      if (t > 2.4) for (const f of r.f) f.pose = 'fist';
      const u = R.easeInOut(R.clamp((t - 3.0) / 0.6, 0, 1));
      r.f[0].x = R.lerp(W / 2 - 16, 70, u);
      r.f[1].x = R.lerp(W / 2 + 16, W - 70, u);
      if (t > 3.7) call();
    }
    if (g.state === 'call' && g.stateT > 0.9 && !g.called) {
      g.called = true;
      ui.pop('FIGHT!', { y: 124, scale: 4, italic: true, color: C.red, outline: '#3a0008', life: 0.7, shakeX: 3, vy: 0 });
      A.sting('fight');
      A.crowd(false);
    }
    if (g.state === 'call' && g.stateT > 1.5) {
      g.called = false;
      setState('fight');
      A.seq.setIntensity(2);
    }

    // Time: paused, frozen on a hit, slow motion on the K.O., the replay at half speed.
    let scale = g.state === 'fight' ? 1 : 0;
    if (g.state === 'replay') {
      // Half speed, a quarter around the K.O. and the finisher, quick through the dazed wait.
      const near = (s, a, b) => s >= 0 && (s - r.step) * DT < a && (s - r.step) * DT > -b;
      scale = 0.5;
      if (r.state === 'finish') scale = 1.6;
      if (near(g.koStep, 0.5, 0.6) || near(g.doneStep, 0.3, 0.7)) scale = 0.25;
      if (near(g.koStep, 0.3, 0.2) || near(g.doneStep, 0.2, 0.2)) view.hit('zoom', 1.2);
    }
    if (g.hitStop > 0) {
      g.hitStop -= dt;
      scale = 0;
    } else if (g.slowT > 0 && scale > 0) {
      g.slowT -= dt;
      scale *= g.slowF;
    }
    if (g.musicSlowT > 0 && (g.musicSlowT -= dt) <= 0) A.seq.slow(false);
    if (g.musicFastT > 0 && (g.musicFastT -= dt) <= 0) A.seq.setIntensity(2);

    if (r && scale > 0) {
      if (g.state === 'fight' && !r.f[0].cpu) r.live[0] = heldBits() | (r.live[0] & ~(IN.L | IN.R)) | edges;
      edges = 0;
      const before = Math.ceil(r.time);
      g.acc += dt * scale;
      let n = 0;
      while (g.acc >= DT && n < 16) {
        r.update();
        const evs = r.events;
        r.events = [];
        for (const e of evs) onEvent(e, g.state === 'replay');
        g.acc -= DT;
        n++;
      }
      if (n >= 16) g.acc = 0;
      if (g.state === 'fight' && Math.ceil(r.time) < before && before <= 10) A.tick();
    }
    if (g.state === 'fight' && r.state === 'done') {
      // A clean frame of the winner's pose for the share card.
      if (g.doneT < 1 && g.doneT + dt >= 1) view.wantSnap = true;
      g.doneT += dt;
      if (g.doneT > (g.deprecated ? 3.2 : 2.4)) endRound();
    }
    if (g.state === 'replay' && r.step >= g.replayEnd) endReplay();
    // The red part of a health bar drains after the hit.
    if (r) r.f.forEach((f, i) => (g.ghost[i] = f.hp < g.ghost[i] ? R.approach(g.ghost[i], f.hp, 2.5, dt) : f.hp));
    for (const id of Object.keys(g.pad)) if (g.pad[id] && ![...held.values()].includes(id)) g.pad[id] = false;

    // Sparks and dust slow down with the fight but never quite stop; the pause stops everything.
    const vdt = g.state === 'paused' ? 0 : g.state === 'fight' || g.state === 'replay' ? dt * Math.max(scale, 0.15) : dt;
    view.update(vdt, r || { f: [] });
    view.screen(dt);
    ui.update(dt);
    view.drawWorld(r, g.t, { quiet: g.state === 'title' || g.state === 'over' });
    view.present((ctx) => ui.draw(ctx, g, g.t));
  }

  app.run({
    view,
    g,
    boot(data) {
      if (data.sel != null) g.sel = R.clamp(data.sel | 0, 0, 1);
      if (data.level != null) g.level = R.clamp(data.level | 0, 0, R.LEVELS.length - 1);
      if (data.auto != null) g.auto = data.auto ? 1 : 0;
      toTitle();
      app.canvas.setAttribute('aria-label', 'Model Kombat. Sam Altman versus Dario Amodei, a fan-made fighting game. Tap to start.');
    },
    tick,
    press,
    down,
    move,
    up,
    keydown,
    keyup,
    hidden: () => press('pause'),
    snapshot: () => ({ sel: g.sel, level: g.level, auto: g.auto }),
    tap,
  });
})();
