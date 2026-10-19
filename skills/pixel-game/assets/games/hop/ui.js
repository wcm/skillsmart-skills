/* Pixel Hop · ui: the logo, the title, the get-ready screen, the HUD, the result and the replay's
   camcorder, built from the engine's UI kit in R.ui and drawn into the pixel buffer, so a screen
   recording or a demo video captures them exactly. Buttons register themselves as they're drawn;
   app.js routes a tap on one to main's press(id). */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const C = R.UIC;
  const ui = R.ui;
  const T = ui.T;
  const { button, panel } = ui;
  const HOP = R.HOP;
  const G = HOP.G;

  // ---------- the logo ----------
  // PIXEL in chrome over a big HOP in heat; HOP's letters hop one after another and a light
  // sweeps across the chrome. Drawn on its own canvas so the sweep only touches the letters.
  const logo = R.canvas(W, 72);
  ui.hlogo = function (ctx, t, y, still) {
    const x = logo.x;
    x.clearRect(0, 0, W, 72);
    T(x, 'PIXEL', W / 2, 4, { scale: 3, italic: true, gradient: R.GRAD.chrome, outline: C.ink, align: 'center' });
    ui.letterLine(x, 'HOP', 28, { scale: 5, italic: true, gradient: R.GRAD.heat, outline: '#1a0606' }, (i) => {
      if (still) return null;
      const p = (t * 1.6 - i * 0.18) % 1.6;
      return { dy: p < 0.4 ? -Math.round(Math.sin((p / 0.4) * Math.PI) * 6) : 0 };
    });
    if (!still) ui.shine(x, t, 4);
    ctx.drawImage(logo.c, 0, y - 4);
  };

  // ---------- the title ----------
  ui.drawTitle = function (ctx, g, t) {
    ui.backdrop(ctx, 18, 128, 0.55);
    ui.hlogo(ctx, t, 34, false);
    T(ctx, 'ONE BUTTON · ONE NEON ROAD', W / 2, 104, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
    if (g.best > 0) T(ctx, `BEST ${g.best}`, W / 2, 116, { font: 'small', color: C.yellow, align: 'center', outline: C.ink });
    const pulse = Math.floor(t * 2.2) % 2 === 0;
    ui.backdrop(ctx, H / 2 - 18, H / 2 + 16, 0.6);
    T(ctx, g.auto ? 'TAP TO WATCH' : 'TAP TO PLAY', W / 2, H / 2 - 4, { font: 'big', color: pulse ? C.white : C.yellow, align: 'center', outline: C.ink });
    // Settings sit under the road, out of the way of the action.
    const lv = R.audio.level;
    button(ctx, 'sound', 8, G + 30, 98, 18, ['SOUND', 'SFX ONLY', 'MUTED'][lv], { icon: lv === 2 ? 'mute' : lv === 1 ? 'sound' : 'music', rim: C.rim });
    button(ctx, 'auto', 110, G + 30, 98, 18, g.auto ? 'AUTOPILOT ON' : 'AUTOPILOT', { icon: 'cpu', iconCol: g.auto ? C.blue : C.dim, rim: g.auto ? C.blue : C.rim, col: g.auto ? C.blue : C.white, on: !!g.auto });
  };

  // ---------- get ready: the game's name, then the first tap starts the run ----------
  ui.drawReady = function (ctx, g, t) {
    ui.backdrop(ctx, 44, 134, 0.5);
    ui.hlogo(ctx, t, 60, false);
    ui.backdrop(ctx, H / 2 - 18, H / 2 + 24, 0.6);
    if (Math.floor(t * 2.2) % 2 === 0) T(ctx, g.world.auto ? 'AUTOPILOT' : 'TAP TO RUN', W / 2, H / 2 - 4, { font: 'big', color: C.white, align: 'center', outline: C.ink });
    T(ctx, 'TAP TO JUMP · HOLD TO JUMP HIGHER', W / 2, H / 2 + 10, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
  };

  // ---------- the HUD ----------
  ui.drawHUD = function (ctx, g, t) {
    const w = g.world;
    const bump = ui.scoreBump > 0 ? 1 : 0;
    T(ctx, String(w.score), W / 2, 14 - bump, { scale: 3 + bump, color: C.white, outline: C.ink, align: 'center' });
    const coin = R.HOP_ART.coin[0];
    ctx.drawImage(coin.c, 8, 9);
    T(ctx, `× ${w.coinCount}`, 18, 10, { font: 'small', color: C.yellow, outline: C.ink });
    button(ctx, 'pause', W - 22, 6, 14, 12, '', { icon: 'pause', rim: '#3a3360', fill: 'rgba(9,5,20,0.5)' });
    if (w.auto) {
      if (Math.floor(t * 2) % 2 === 0) T(ctx, 'AUTOPILOT · TAP TO TAKE OVER', W / 2, H - 14, { font: 'small', color: C.blue, align: 'center', outline: C.ink });
    } else if (g.hintT > 0 && w.state === 'run') {
      T(ctx, 'TAP TO JUMP · HOLD TO JUMP HIGHER', W / 2, H - 14, { font: 'small', color: C.white, align: 'center', outline: C.ink });
    }
  };

  // ---------- the result ----------
  // The stamp slams down, the punchline types out, then the panel rises with one line of stats.
  ui.drawOver = function (ctx, g, t) {
    const r = g.run;
    ui.drawStamp(ctx, r.stamp, C.red, t, W / 2, 58);
    ui.drawTyped(ctx, r.msg, t - 0.35, 86);
    if (t < 0.9) return;
    const ct = R.easeBack(R.clamp((t - 0.9) / 0.35, 0, 1));
    const y0 = Math.round(H - ct * (H - 122));
    panel(ctx, 12, y0, W - 24, 170, C.cyan, 'rgba(9,5,20,0.92)');
    T(ctx, 'SCORE', W / 2, y0 + 8, { font: 'small', color: C.dim, align: 'center' });
    T(ctx, String(r.score), W / 2, y0 + 17, { scale: 4, color: C.white, outline: C.ink, align: 'center' });
    T(ctx, r.newBest ? 'NEW BEST!' : `BEST ${g.best}`, W / 2, y0 + 49, { font: 'small', color: r.newBest ? C.yellow : C.dim, align: 'center' });
    T(ctx, ui.statLine([`COINS ${r.coins}`, `JUMPS ${r.jumps}`, `CLOSE CALLS ${r.close}`]), W / 2, y0 + 64, { font: 'small', color: C.white, align: 'center' });
    const by = y0 + 82;
    button(ctx, 'retry', 20, by, 86, 22, 'RETRY', { icon: 'retry', rim: C.cyan });
    button(ctx, 'replay', 110, by, 86, 22, 'REPLAY', { icon: 'play', rim: C.pink, iconCol: C.pink });
    button(ctx, 'menu', 20, by + 26, 86, 18, 'TITLE', { rim: C.rim });
    button(ctx, 'share', 110, by + 26, 86, 18, 'SHARE CARD', { icon: 'share', rim: C.yellow, iconCol: C.yellow });
    ui.drawToast(ctx, y0 - 18);
  };

  ui.draw = function (ctx, g, t) {
    ui.begin();
    const st = g.state;
    if (st === 'title') ui.drawTitle(ctx, g, g.stateT);
    if (st === 'ready') ui.drawReady(ctx, g, g.stateT);
    if (st === 'run' || st === 'dying' || st === 'paused') ui.drawHUD(ctx, g, t);
    if (st === 'replay') ui.drawCamcorder(ctx, t, { title: 'REPLAY', sub: g.slow ? '◀◀ 0.25×' : '◀◀ 0.5×', score: g.replay ? g.replay.score : null });
    ui.drawBanner(ctx);
    ui.drawPops(ctx, t);
    if (st === 'over') ui.drawOver(ctx, g, g.stateT);
    if (st === 'paused') ui.drawPause(ctx, 'THE ROAD WILL WAIT', 'BACK TO TITLE');
  };
})();
