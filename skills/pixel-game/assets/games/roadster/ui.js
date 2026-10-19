/* Flappy Roadster · ui: the four game logos and every Roadster screen (title, ready, HUDs, the
   scoreboard and 0-60's timeslip), built from the engine's UI kit in R.ui. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const G = R.GROUND;
  const C = R.UIC;
  const { chrome: CHROME, neon: NEONGRAD, rainbow: RAINBOW, gold: GOLD } = R.GRAD;
  const ui = R.ui;
  const T = ui.T;
  const { panel, button } = ui;

  // ---------- game names ----------
  // Every game has its own name, "<WORD> ROADSTER", and its own animated logo: two 3x lines,
  // about 50 px tall. FLAPPY's letters flap, KICKFLIP's letters kickflip off a skate sticker,
  // UPSIDE-DOWN's ROADSTER hangs from a ceiling and rolls, and GREEN LIGHT is a dot-matrix sign
  // that runs a drag tree. `still` draws a clean frame for the share card.
  const BIG3 = { scale: 3, italic: true, outline: '#140022' };
  const word = (gm) => gm.name.replace(/ ROADSTER$/, '');

  // A left wing beating: up, level, down. The right one is its mirror image.
  const WING = [
    ['##.......', '.###.....', '..#####..', '...######', '....#####'],
    ['.........', '#########', '.########', '...######', '.........'],
    ['....#####', '...######', '..#####..', '.###.....', '##.......'],
  ];
  function wing(ctx, x, y, f, flip) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ui.pixels(ctx, WING[f], x + dx, y + dy, 2, '#140022', flip);
    ui.pixels(ctx, WING[f], x, y, 2, '#ffffff', flip);
    ui.pixels(ctx, WING[f].slice(3), x, y + 6, 2, '#9eeaff', flip);
  }

  const LOGOS = {
    // Flappy Bird, but chrome: the letters bob in a wave and a pair of wings beats either side.
    flappy(ctx, gm, t, y, o) {
      const top = word(gm);
      const s = o.still;
      ui.letterLine(ctx, top, y, Object.assign({ gradient: CHROME }, BIG3), (i) => ({ dy: s ? 0 : Math.round(Math.sin(t * 6 - i * 0.9) * 1.6) }));
      const w = R.measure(top, { scale: 3 });
      const f = s ? 0 : [0, 1, 2, 1][Math.floor(t * 9) % 4];
      wing(ctx, Math.round(W / 2 - w / 2) - 22, y + 2, f, false);
      wing(ctx, Math.round(W / 2 + w / 2) + 9, y + 2, f, true);
      T(ctx, 'ROADSTER', W / 2, y + 26, Object.assign({ gradient: NEONGRAD, align: 'center' }, BIG3));
      if (!s) ui.shine(ctx, t, y);
    },
    // A skate sticker, and every few seconds the letters pop and kickflip one after another.
    kickflip(ctx, gm, t, y, o) {
      const top = word(gm);
      const lo = Object.assign({ gradient: GOLD }, BIG3, { outline: '#2a0008' });
      const w = R.measure(top, lo) + 6;
      ui.sticker(ctx, Math.round(W / 2 - w / 2) - 8, y - 4, w + 14, 29);
      const c = t % 3;
      ui.letterLine(ctx, top, y, lo, (i) => {
        const u = (c - 0.8 - i * 0.08) / 0.42;
        if (o.still || u <= 0 || u >= 1) return null;
        const k = Math.cos(R.easeInOut(u) * Math.PI * 2);
        return { sy: k, dy: -Math.round(Math.sin(u * Math.PI) * 6), o: k < 0 ? { gradient: null, color: '#ffffff' } : null };
      });
      // ROADSTER with a hard offset shadow, streetwear style.
      T(ctx, 'ROADSTER', W / 2 + 3, y + 31, Object.assign({ color: C.pink, align: 'center' }, BIG3));
      T(ctx, 'ROADSTER', W / 2, y + 28, Object.assign({ color: C.white, align: 'center' }, BIG3));
    },
    // The tunnel's chasing rainbow, a neon ceiling under it, and ROADSTER hanging from that
    // ceiling upside down like the car on its suction fans. Now and then it rolls all the way
    // round, the way a flip does.
    upside(ctx, gm, t, y, o) {
      const k = o.still ? 0 : Math.floor(t * 8);
      T(ctx, word(gm), W / 2, y, Object.assign({ gradient: RAINBOW.map((_, i) => RAINBOW[(i + k) % RAINBOW.length]), align: 'center' }, BIG3, { outline: '#0c0917' }));
      const tc = R.textCanvas('ROADSTER', { scale: 3, gradient: CHROME, outline: '#140022' });
      const x = Math.round(W / 2 - tc.w / 2);
      const cy = y + 25;
      ctx.fillStyle = '#17121f';
      ctx.fillRect(x - 12, cy - 1, tc.w + 24, 2);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(x - 12, cy + 1, tc.w + 24, 1);
      const u = o.still ? 0 : R.clamp(((t % 3.4) - 2.7) / 0.6, 0, 1);
      const sy = -Math.cos(R.easeInOut(u) * Math.PI * 2);
      const h = tc.c.height;
      ctx.save();
      ctx.translate(x - tc.pad, cy + 2 + h / 2);
      ctx.scale(1, Math.abs(sy) < 0.1 ? (sy < 0 ? -0.1 : 0.1) : sy);
      ctx.drawImage(tc.c, 0, -h / 2);
      ctx.restore();
    },
    // A dot-matrix sign that runs a drag tree: three ambers fill it left to right, then it all
    // goes green. Given the real tree's lights it shows those, so it can never jump the start.
    green(ctx, gm, t, y, o) {
      const str = word(gm);
      const f = R.FONTS.big;
      const dots = [];
      let cols = 0;
      for (const ch of str) {
        const g = f.get(ch);
        g.rows.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') dots.push([cols + rx, ry]);
        });
        cols += g.w + 1;
      }
      cols -= 1;
      const x0 = Math.round(W / 2 - (cols * 3) / 2);
      let amber = 0;
      let green = false;
      let red = false;
      if (o.lights) ({ amber, green, red } = o.lights);
      else if (o.still) green = true;
      else {
        const c = t % 3.2;
        amber = c < 0.5 ? 0 : c < 0.9 ? 1 : c < 1.3 ? 2 : c < 1.8 ? 3 : 0;
        green = c >= 1.8;
      }
      panel(ctx, x0 - 5, y - 4, cols * 3 + 9, 29, '#2a2346', 'rgba(7,4,13,0.92)');
      ctx.fillStyle = '#1b1530';
      for (let cx = 0; cx < cols; cx++) for (let ry = 0; ry < 7; ry++) ctx.fillRect(x0 + cx * 3, y + ry * 3, 2, 2);
      for (const [cx, ry] of dots) {
        const lit = red || green || cx < (amber / 3) * cols;
        ctx.fillStyle = red ? C.red : green ? '#39ff7a' : lit ? '#ffb21e' : '#625486';
        ctx.fillRect(x0 + cx * 3, y + ry * 3, 2, 2);
      }
      T(ctx, 'ROADSTER', W / 2, y + 30, Object.assign({ gradient: CHROME, align: 'center' }, BIG3));
    },
  };
  // o: { still, lights } (lights: the 0-60 tree's, for the GREEN LIGHT sign).
  ui.logo = (ctx, gm, t, y, o) => LOGOS[gm.logo](ctx, gm, t, y, o || {});

  // ---------- screens ----------
  // The title: the game's name and its numbers up top, the call to tap in the middle of the
  // screen, the car parked on the road, and everything you set before a run (car, drive mode,
  // sound, autopilot) under the road.
  ui.drawTitle = function (ctx, g, t) {
    const gm = R.GAMES[g.game];
    ui.backdrop(ctx, 0, 160, 0.62);
    // Game tabs: four ways to play, one per moment of the unveil.
    R.GAMES.forEach((q, i) => {
      const on = g.game === i;
      button(ctx, 'game' + i, 4 + i * 53, 3, 51, 13, q.tab, { rim: on ? C.pink : C.rim, col: on ? C.pink : C.dim, on, fill: on ? 'rgba(255,63,210,0.18)' : null });
    });
    ui.logo(ctx, gm, t, 38);
    const typed = gm.line1;
    const n = Math.min(typed.length, Math.floor(t * 22));
    T(ctx, typed.slice(0, n), W / 2, 102, { font: 'small', color: C.white, align: 'center', outline: C.ink });
    if (t > 1.5 && Math.sin(t * 3) > -0.6) T(ctx, gm.line2, W / 2, 113, { font: 'small', color: C.yellow, align: 'center', outline: C.ink });

    // Best and the production ETA, centred together as one line.
    const best = g.bestFor();
    const bs = `BEST ${best ? gm.fmt(best) : gm.lowerBetter ? '-' : 0}`;
    const es = `PRODUCTION ETA ${g.eta}`;
    const sw = R.measure(bs, { font: 'small' });
    const sx = Math.round(W / 2 - (sw + 8 + R.measure(es, { font: 'small' })) / 2);
    T(ctx, bs, sx, 133, { font: 'small', color: C.cyan, outline: C.ink });
    T(ctx, es, sx + sw + 8, 133, { font: 'small', color: C.pink, outline: C.ink });
    if (g.delays > 0) T(ctx, `DELAYED ${g.delays}×`, W / 2, 143, { font: 'small', color: C.dim, align: 'center', outline: C.ink });

    if (Math.floor(t * 2.2) % 2 === 0) T(ctx, gm.tapTo, W / 2, H / 2 - 7, { scale: 2, color: C.white, outline: C.ink, align: 'center' });

    // Under the road. The car: one line, its name, or for a locked one what unlocks it.
    const y0 = G + 15;
    const sk = R.SKINS[g.skin];
    const locked = !g.skinUnlocked(g.skin);
    button(ctx, 'skin-', 8, y0, 20, 17, '◀', { rim: C.pink });
    button(ctx, 'skin+', W - 28, y0, 20, 17, '▶', { rim: C.pink });
    if (locked) {
      const msg = Math.floor(t * 0.8) % 2 ? gm.unlockText(sk.unlock) : sk.name;
      const big = R.measure(msg, { font: 'big' }) <= 148;
      const mw = R.measure(msg, { font: big ? 'big' : 'small' });
      R.icon(ctx, 'lock', Math.round(W / 2 - mw / 2 - 12), y0 + 4, C.yellow);
      T(ctx, msg, W / 2 + 6, y0 + (big ? 5 : 6), { font: big ? 'big' : 'small', color: C.yellow, align: 'center', outline: C.ink });
    } else T(ctx, sk.name, W / 2, y0 + 5, { font: 'big', color: C.white, align: 'center', outline: C.ink });

    // Drive modes.
    const mw = 51;
    R.MODES.forEach((m, i) => {
      const on = g.mode === i;
      button(ctx, 'mode' + i, 4 + i * (mw + 2), y0 + 26, mw, 15, m.name, { rim: on ? C.yellow : C.rim, col: on ? C.yellow : C.dim, on });
    });

    // Sound and the autopilot.
    const lv = R.audio.level;
    const ap = g.auto;
    button(ctx, 'sound', 4, y0 + 48, 102, 18, ['SOUND', 'SFX ONLY', 'MUTED'][lv], { icon: lv === 2 ? 'mute' : lv === 1 ? 'sound' : 'music', rim: C.rim });
    button(ctx, 'auto', 110, y0 + 48, 102, 18, ap === 0 ? 'FSF OFF' : ap === 1 ? 'FSF ON' : 'CINEMA', { icon: 'wheel', iconCol: ap ? C.blue : C.dim, rim: ap ? C.blue : C.rim, col: ap ? C.blue : C.white, on: !!ap });
  };

  // Where each game's name sits before the run, and its hint under it. FLY's stays above the
  // liftoff caption; the tunnel's hangs its ROADSTER from the real ceiling, right where the car
  // will drive upside down.
  const READY_AT = { fly: [44, 56], kickflip: [100, 60], tunnel: [R.TUNNEL_CEIL - 26, 56] };

  ui.drawReady = function (ctx, g, t) {
    const gm = R.GAMES[g.game];
    if (gm.id === 'launch') return;
    const [ly, hy] = READY_AT[gm.id];
    ui.logo(ctx, gm, t, ly);
    const a = Math.floor(t * 3) % 2 === 0;
    T(ctx, g.auto ? 'FSF ENGAGED · HANDS OFF' : gm.hint, W / 2, ly + hy, { font: 'small', color: g.auto ? C.blue : C.white, align: 'center', outline: C.ink });
    if (!g.auto) {
      // Tap hint: under the hovering car, or over the parked one.
      const y = gm.road ? G - 46 + (a ? 0 : 2) : R.READY_Y + 22 + (a ? 0 : 2);
      T(ctx, '↑', R.CAR_X, y, { font: 'big', color: C.cyan, align: 'center', outline: C.ink });
      T(ctx, 'TAP', R.CAR_X, y + 10, { font: 'small', color: C.cyan, align: 'center', outline: C.ink });
    }
  };

  // 0-60: the name's sign follows the tree until green; then the HUD reads out the numbers.
  function drawLaunchHUD(ctx, g, w, t) {
    const L = w.lights;
    const r = w.result;
    if (w.phase === 'stage' || w.phase === 'tree' || w.phase === 'green') {
      ui.logo(ctx, R.GAMES[g.game], t, 38, { lights: L }); // where the title had it
      if (w.phase === 'green') {
        const sh = Math.round(Math.sin(t * 70) * 2);
        T(ctx, 'GO!', W / 2 + sh, 98, { scale: 5, italic: true, color: '#39ff7a', outline: C.ink, align: 'center' });
      } else {
        if (Math.floor(t * 2.5) % 2 === 0 || w.phase === 'tree') T(ctx, 'TAP ON GREEN', W / 2, 104, { scale: 2, color: C.white, outline: C.ink, align: 'center' });
        if (w.isAuto()) T(ctx, 'FSF HAS THE PEDAL', W / 2, 124, { font: 'small', color: C.blue, align: 'center', outline: C.ink });
      }
    } else if (r && !r.foul) {
      T(ctx, 'REACTION', W / 2, 32, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
      T(ctx, r.rt.toFixed(3), W / 2, 40, { scale: 3, color: r.rating.col, outline: C.ink, align: 'center' });
      const v = Math.min(60, Math.floor(w.mph));
      const hit = w.mph >= 60;
      T(ctx, String(hit ? 60 : v), W / 2 - 4, 72, { scale: 4, color: hit ? C.yellow : C.white, outline: C.ink, align: 'right' });
      T(ctx, 'MPH', W / 2 + 2, 86, { font: 'big', color: hit ? C.yellow : C.dim, outline: C.ink });
      if (hit) T(ctx, `0-60 IN ${R.LAUNCH_T.car} S`, W / 2, 110, { font: 'small', color: C.yellow, align: 'center', outline: C.ink });
      // Launch-control dash: a bar filling to 60.
      ctx.fillStyle = 'rgba(9,5,20,0.7)';
      ctx.fillRect(W / 2 - 50, 102 - 6, 100, 3);
      ctx.fillStyle = hit ? C.yellow : C.cyan;
      ctx.fillRect(W / 2 - 50, 102 - 6, Math.round(Math.min(1, w.mph / 60) * 100), 3);
    } else if (r && r.foul) {
      T(ctx, 'RED LIGHT', W / 2, 42, { scale: 3, italic: true, color: C.red, outline: '#3a0008', align: 'center' });
      T(ctx, `${r.rt.toFixed(3)} S`, W / 2, 70, { scale: 2, color: C.white, outline: C.ink, align: 'center' });
    }
    if (w.isAuto()) {
      R.icon(ctx, 'wheel', 5, 5, C.blue);
      T(ctx, 'FSF (SUPERVISED)', 17, 7, { font: 'small', color: C.blue, outline: C.ink });
    }
  }

  ui.drawHUD = function (ctx, g, w, t) {
    const gm = R.GAMES[g.game];
    if (gm.id === 'launch') return drawLaunchHUD(ctx, g, w, t);
    // Score.
    const bump = ui.scoreBump > 0 ? -2 : 0;
    T(ctx, String(w.score), W / 2, 16 + bump, { scale: 3, color: C.white, outline: C.ink, align: 'center' });
    if (gm.unit) T(ctx, gm.unit, W / 2 + R.measure(String(w.score), { scale: 3 }) / 2 + 3, 30 + bump, { font: 'big', color: C.dim, outline: C.ink });
    // Charge pips: three bolts trigger Ludicrous.
    for (let i = 0; i < 3; i++) {
      const lit = w.ludi > 0 || i < w.bolts;
      const s = R.BOLT[0];
      ctx.globalAlpha = lit ? 1 : 0.28;
      ctx.drawImage(s.c, 5 + i * 10, 5);
      ctx.globalAlpha = 1;
    }
    if (w.ludi > 0) {
      const f = w.ludi / 4.2;
      for (let x = 0; x < Math.round(60 * f); x++) {
        ctx.fillStyle = RAINBOW[(x + Math.floor(t * 30)) % RAINBOW.length];
        ctx.fillRect(W / 2 - 30 + x, 41, 1, 2);
      }
    }
    // Upside down on the tunnel ceiling: the fans are doing the work.
    if (gm.id === 'tunnel' && w.car.alive && w.car.side < 0) T(ctx, 'SUCTION ON', W / 2, 46, { font: 'small', color: Math.floor(t * 4) % 2 ? C.cyan : C.white, align: 'center', outline: C.ink });
    // Autopilot badge.
    if (w.isAuto()) {
      R.icon(ctx, 'wheel', 5, 16, C.blue);
      T(ctx, w.phantom > 0 ? 'PHANTOM BRAKING' : 'FSF (SUPERVISED)', 17, 18, { font: 'small', color: w.phantom > 0 && Math.floor(t * 10) % 2 ? C.yellow : C.blue, outline: C.ink });
    }
    // Pause.
    button(ctx, 'pause', W - 18, 4, 14, 14, '', { icon: 'pause', rim: '#3a3360', fill: 'rgba(9,5,20,0.5)' });
    // Dashboard on the street: speed and where you are.
    const mph = Math.round(w.speed * 1.9);
    const fast = w.ludi > 0;
    T(ctx, String(mph), 6, G + 9, { scale: 2, color: fast ? null : C.white, gradient: fast ? RAINBOW : null, outline: C.ink });
    T(ctx, 'MPH', 8 + R.measure(String(mph), { scale: 2 }), G + 16, { font: 'small', color: C.dim });
    T(ctx, gm.place(w), W - 6, G + 16, { font: 'small', color: C.dim, align: 'right' });
  };

  // The death stamp, the punchline, then the card.
  ui.drawOver = function (ctx, g, t) {
    const run = g.run;
    const gm = R.GAMES[run.game];
    const st = t;
    ui.drawStamp(ctx, run.stamp, run.stampCol, st, W / 2, 74);
    ui.drawTyped(ctx, run.msg, st - 0.35, 104);
    if (st < 0.9) return;
    // Card.
    const ct = R.easeBack(R.clamp((st - 0.9) / 0.35, 0, 1));
    const y0 = Math.round(H - ct * (H - 136));
    panel(ctx, 12, y0, W - 24, 160, C.cyan, 'rgba(9,5,20,0.9)');
    ui.drawMedal(ctx, gm.medal(run), 40, y0 + 34);
    if (gm.id === 'launch') drawTimeslip(ctx, g, run, y0, t);
    else {
      T(ctx, gm.scoreLabel, 120, y0 + 12, { font: 'small', color: C.dim, align: 'center' });
      T(ctx, String(run.score), 120, y0 + 20, { scale: 3, color: C.white, outline: C.ink, align: 'center' });
      T(ctx, 'BEST', 178, y0 + 12, { font: 'small', color: C.dim, align: 'center' });
      T(ctx, String(run.best), 178, y0 + 24, { scale: 2, color: C.cyan, outline: C.ink, align: 'center' });
      if (run.newBest && Math.floor(t * 4) % 2 === 0) T(ctx, 'NEW BEST!', 148, y0 + 46, { font: 'small', color: C.yellow, align: 'center', outline: C.ink });
      T(ctx, ui.statLine(gm.stats(run)), W / 2, y0 + 62, { font: 'small', color: C.white, align: 'center' });
    }
    // Production ETA, rolling over like an odometer.
    ctx.fillStyle = 'rgba(255,63,210,0.12)';
    ctx.fillRect(18, y0 + 74, W - 36, 30);
    T(ctx, 'ROADSTER PRODUCTION ETA', W / 2, y0 + 77, { font: 'small', color: C.pink, align: 'center' });
    const roll = R.clamp((st - 1.5) / 0.4, 0, 1);
    const yr = roll < 1 ? run.etaFrom : run.etaTo;
    const dy = roll > 0 && roll < 1 ? Math.round((roll - 0.5) * 8) : 0;
    T(ctx, String(yr), W / 2, y0 + 86 + dy, { scale: 2, color: C.yellow, outline: C.ink, align: 'center' });
    if (roll >= 1) {
      const d = run.etaTo - run.etaFrom;
      T(ctx, d > 0 ? '+1 YR' : d < 0 ? '-1 YR!' : 'HOLDS', W / 2 + 34, y0 + 91, { font: 'small', color: d > 0 ? C.red : '#7dff6b', outline: C.ink });
    }
    // Buttons. 0-60 has no killcam, so RETRY takes the whole row.
    const by = y0 + 110;
    if (gm.replay) {
      button(ctx, 'retry', 20, by, 86, 22, 'RETRY', { icon: 'retry', big: true, rim: C.cyan });
      button(ctx, 'replay', 110, by, 86, 22, 'REPLAY', { icon: 'play', big: true, rim: C.pink, iconCol: C.pink });
    } else button(ctx, 'retry', 20, by, 176, 22, 'TRY AGAIN', { icon: 'retry', big: true, rim: C.cyan });
    button(ctx, 'garage', 20, by + 26, 86, 18, 'GARAGE', { rim: C.rim });
    button(ctx, 'share', 110, by + 26, 86, 18, 'SHARE CARD', { icon: 'share', rim: C.yellow, iconCol: C.yellow });
    ui.drawToast(ctx, y0 - 18);
    if (st > 1.6) T(ctx, 'TAP ANYWHERE TO RETRY', W / 2, H - 9, { font: 'small', color: C.dim, align: 'center' });
  };

  // 0-60's scoreboard reads like a drag-strip timeslip: your 0-60, a bar race against the
  // Roadster's own number, and the drive mode with your best reaction.
  function drawTimeslip(ctx, g, run, y0, t) {
    const r = run.result;
    const L = R.LAUNCH_T;
    const x = 64;
    const nb = run.newBest && Math.floor(t * 4) % 2 === 0;
    const best = run.best ? (run.best / 1000).toFixed(3) + ' S' : '-';
    T(ctx, `${R.MODES[run.mode].name} · ${nb ? 'NEW BEST R/T!' : 'BEST R/T ' + best}`, W / 2, y0 + 62, { font: 'small', color: nb ? C.yellow : C.white, align: 'center' });
    if (r.foul) {
      T(ctx, 'R/T', x, y0 + 12, { font: 'small', color: C.dim });
      T(ctx, r.rt.toFixed(3), x, y0 + 20, { scale: 3, color: C.red, outline: C.ink });
      T(ctx, 'RED LIGHT · NO TIME', x, y0 + 46, { font: 'small', color: C.red });
      return;
    }
    T(ctx, 'YOUR 0-60', x, y0 + 10, { font: 'small', color: C.dim });
    T(ctx, r.total.toFixed(3), x, y0 + 18, { scale: 3, color: C.white, outline: C.ink });
    T(ctx, 'S', x + R.measure(r.total.toFixed(3), { scale: 3 }) + 3, y0 + 32, { font: 'big', color: C.dim });
    // Bar race: your total against the Roadster's 0.81.
    const scale = 100 / Math.max(1.2, r.total, L.car);
    const bars = [
      ['YOU', r.total, r.total < L.car ? '#7dff6b' : C.yellow],
      ['TESLA', L.car, C.pink],
    ];
    bars.forEach(([name, v, col], i) => {
      const by = y0 + 44 + i * 8;
      T(ctx, name, x, by, { font: 'small', color: C.dim });
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 22, by, 100, 5);
      const grow = R.clamp((t - 1.0 - i * 0.12) / 0.4, 0, 1);
      ctx.fillStyle = col;
      ctx.fillRect(x + 22, by, Math.round(v * scale * R.easeOut(grow)), 5);
    });
  }

  ui.draw = function (ctx, g, t) {
    ui.begin();
    const w = g.world;
    const st = g.state;
    if (st === 'title') ui.drawTitle(ctx, g, g.stateT);
    if (st === 'ready') ui.drawReady(ctx, g, g.stateT);
    if (st === 'play' || st === 'dying' || st === 'paused' || (st === 'ready' && w.kind === 'launch')) ui.drawHUD(ctx, g, w, t);
    if (st === 'replay') ui.drawCamcorder(ctx, t, { title: 'REPLAY', sub: '◀◀ SLOW-MO 0.5×', score: w.score });
    ui.drawBanner(ctx);
    ui.drawPops(ctx, t);
    if (st === 'over') ui.drawOver(ctx, g, g.stateT);
    if (st === 'paused') ui.drawPause(ctx, 'PULLED OVER ON A CLOUD', 'BACK TO GARAGE');
  };
})();
