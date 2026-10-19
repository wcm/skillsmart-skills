/* Meta Gear Solid · ui: the logo, the title (a big pair of smart glasses with a blinking LED),
   the codec briefing between two made-up characters, the HUD (distance, the room, a radar), the
   POV footage frame and the results, built from the engine's UI kit in R.ui. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const C = R.UIC;
  const ui = R.ui;
  const T = ui.T;
  const { panel, button } = ui;
  const MG = R.MG;
  const STEEL = ['#ffffff', '#e6ecf4', '#c4cedc', '#9aa8bc', '#c8d2e0', '#7c8aa0', '#5a667a'];

  // ---------- the logo ----------
  // META GEAR in chrome over a heavy SOLID in heat, and the tagline under them.
  ui.mlogo = function (ctx, t, y, still) {
    T(ctx, 'META GEAR', W / 2, y, { scale: 3, italic: true, gradient: STEEL, outline: '#07040d', align: 'center' });
    const flick = still ? 0 : Math.floor(t * 9) % 13 === 0 ? 1 : 0;
    T(ctx, 'SOLID', W / 2, y + 24 + flick, { scale: 4, italic: true, gradient: R.GRAD.heat, outline: '#1a0606', align: 'center' });
    T(ctx, 'TACTICAL PRIVACY ACTION', W / 2, y + 56, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
  };

  // The big glasses: the LED blinks while they record, and a box hides in each lens.
  ui.bigGlasses = function (ctx, t, x, y, s, rec) {
    const G = R.BIG_GLASSES;
    ctx.drawImage(G.c, x, y, G.w * s, G.h * s);
    // A tiny cardboard box reflected in each lens.
    for (const lx of [16, 66]) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(R.BOX.c, x + lx * s, y + 12 * s, 10 * s, 8 * s);
      ctx.globalAlpha = 1;
    }
    const on = rec && Math.floor(t * 2.4) % 2 === 0;
    if (on) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + (G.led[0] - 1) * s, y + (G.led[1] - 1) * s, 2 * s, 2 * s);
      ctx.globalAlpha = 0.35;
      R.disc(ctx, x + G.led[0] * s, y + G.led[1] * s, 4 * s, '#ffffff');
      ctx.globalAlpha = 1;
    }
  };

  // ---------- title ----------
  ui.drawTitle = function (ctx, g, t) {
    ui.backdrop(ctx, 0, H, 0.6);
    ui.mlogo(ctx, t, 30);
    ui.bigGlasses(ctx, t, 12, 104, 2, true);
    const pulse = Math.floor(t * 2.2) % 2 === 0;
    T(ctx, g.auto ? 'TAP TO WATCH' : 'HOLD TO SNEAK', W / 2, H / 2 - 4, { font: 'big', color: pulse ? C.white : C.yellow, align: 'center', outline: C.ink });
    T(ctx, 'LET GO TO BE A BOX', W / 2, H / 2 + 8, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
    const lv = R.audio.level;
    button(ctx, 'sound', 8, 252, 98, 18, ['SOUND', 'SFX ONLY', 'MUTED'][lv], { icon: lv === 2 ? 'mute' : lv === 1 ? 'sound' : 'music', rim: C.rim });
    button(ctx, 'auto', 110, 252, 98, 18, g.auto ? 'GHOST MODE ON' : 'GHOST MODE', { icon: 'cpu', iconCol: g.auto ? C.blue : C.dim, rim: g.auto ? C.blue : C.rim, col: g.auto ? C.blue : C.white, on: !!g.auto });
    button(ctx, 'codec', 8, 274, 200, 18, 'CODEC BRIEFING', { icon: 'play', iconCol: '#3aff7a', rim: '#2a7a44', col: '#9dffb0' });
    if (g.best > 0) {
      T(ctx, `BEST ${g.best} M  ·  ${ui.rank(g.best)}`, W / 2, 304, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
    }
  };

  // The stealth rank for a distance, after the old games' end-of-mission codenames.
  const RANKS = [
    [20, 'MAIN CHARACTER'],
    [60, 'NPC'],
    [120, 'LURKER'],
    [200, 'PRIVATE ACCOUNT'],
    [320, 'AIRPLANE MODE'],
    [480, 'INCOGNITO'],
    [Infinity, 'BIG BOX'],
  ];
  ui.rank = (m) => RANKS.find((r) => m < r[0])[1];

  // ---------- the codec ----------
  ui.CODEC = [
    ['cc', 'COLONEL COOKIE', 'PRIVATE MODE, DO YOU READ ME?'],
    ['pm', 'PRIVATE MODE', 'LOUD AND CLEAR. EVERYONE IN HERE IS WEARING SMART GLASSES.'],
    ['cc', 'COLONEL COOKIE', "IF THEY SEE YOU MOVE, YOU'RE CONTENT."],
    ['pm', 'PRIVATE MODE', 'AND IF I STOP?'],
    ['cc', 'COLONEL COOKIE', "YOU'RE A BOX. NOBODY FILMS A BOX."],
    ['cc', 'COLONEL COOKIE', "WATCH FOR PINK RINGS. SOME PAIRS STARTED LISTENING WITHOUT A 'HEY META'."],
    ['pm', 'PRIVATE MODE', 'I HEARD THAT GOT FIXED.'],
    ['cc', 'COLONEL COOKIE', 'SO DID I. STAY IN THE BOX.'],
  ];
  ui.drawCodec = function (ctx, g, t) {
    ctx.fillStyle = '#020a05';
    ctx.fillRect(0, 0, W, H);
    // Faint green grid.
    ctx.fillStyle = '#06180c';
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 1);
    T(ctx, 'CODEC', W / 2, 30, { scale: 2, color: '#3aff7a', outline: '#021006', align: 'center' });
    const line = ui.CODEC[g.codecI] || ui.CODEC[ui.CODEC.length - 1];
    const speaking = line[0];
    // The two portraits, the one speaking lit, with a frame each.
    for (const [id, x] of [
      ['pm', 10],
      ['cc', W - 74],
    ]) {
      const lit = id === speaking;
      ctx.fillStyle = lit ? '#3aff7a' : '#14502a';
      ctx.fillRect(x - 2, 62, 68, 76);
      ctx.fillStyle = '#020a05';
      ctx.fillRect(x, 64, 64, 72);
      ctx.globalAlpha = lit ? 1 : 0.45;
      // A little mouth flap while they talk.
      const talk = lit && g.codecN < line[2].length && Math.floor(t * 10) % 2 === 0 ? 1 : 0;
      ctx.drawImage(R.codecPortrait(id), x, 64 + talk, 64, 72);
      ctx.globalAlpha = 1;
      T(ctx, id === 'pm' ? 'PRIVATE MODE' : 'COL. COOKIE', x + 32, 142, { font: 'small', color: lit ? '#9dffb0' : '#2a7a44', align: 'center' });
    }
    // The frequency, a signal meter between the portraits.
    T(ctx, '140.85', W / 2, 88, { scale: 1, font: 'big', color: '#9dffb0', align: 'center' });
    T(ctx, 'PTT', W / 2, 100, { font: 'small', color: '#2a7a44', align: 'center' });
    for (let i = 0; i < 6; i++) {
      const on = i < 3 + Math.floor((Math.sin(t * 7) + 1) * 1.5);
      ctx.fillStyle = on ? '#3aff7a' : '#0c3a1c';
      ctx.fillRect(W / 2 - 13 + i * 5, 118 - i * 2, 3, 4 + i * 2);
    }
    // The line, typed out.
    panel(ctx, 8, 178, W - 16, 92, '#2a7a44', 'rgba(2,14,6,0.95)');
    T(ctx, line[1], 16, 186, { font: 'small', color: '#3aff7a' });
    const shown = line[2].slice(0, g.codecN);
    R.wrap(shown, W - 34, { font: 'big' }).forEach((l, i) => T(ctx, l, 16, 200 + i * 12, { font: 'big', color: '#c8ffd4' }));
    if (g.codecN >= line[2].length && Math.floor(t * 2) % 2 === 0) T(ctx, '▶', W - 18, 258, { font: 'small', color: '#3aff7a' });
    T(ctx, `${g.codecI + 1}/${ui.CODEC.length}`, 16, 258, { font: 'small', color: '#2a7a44' });
    T(ctx, 'TAP: NEXT', W / 2, 290, { font: 'small', color: '#2a7a44', align: 'center' });
    button(ctx, 'skip', W / 2 - 40, 304, 80, 16, 'SKIP', { rim: '#2a7a44', col: '#9dffb0', fill: 'rgba(2,14,6,0.9)' });
  };

  // ---------- the HUD ----------
  ui.drawHUD = function (ctx, g, t) {
    const w = g.world;
    T(ctx, `${w.score} M`, 8, 8, { scale: 2, color: C.white, outline: C.ink });
    const z = R.ZONES[w.room % R.ZONES.length];
    T(ctx, `${z.name} · ROOM ${w.room + 1}`, 8, 26, { font: 'small', color: C.dim, outline: C.ink });
    ui.drawRadar(ctx, w, W - 60, 6, t);
    button(ctx, 'pause', W - 78, 6, 14, 12, '', { icon: 'pause', rim: '#3a3360', fill: 'rgba(9,5,20,0.5)' });
    if (w.isAuto()) {
      if (Math.floor(t * 2) % 2 === 0) T(ctx, 'GHOST MODE · TAP TO TAKE OVER', W / 2, H - 14, { font: 'small', color: C.blue, align: 'center', outline: C.ink });
    } else if (g.hintT > 0 && w.state === 'play') {
      T(ctx, 'HOLD TO SNEAK · LET GO TO HIDE', W / 2, H - 14, { font: 'small', color: C.white, align: 'center', outline: C.ink });
    }
  };

  // The radar: the next stretch of path from above at a quarter scale, with guests' cones.
  ui.drawRadar = function (ctx, w, x0, y0, t) {
    const rw = 52;
    const rh = 44;
    ctx.fillStyle = 'rgba(2,20,10,0.85)';
    ctx.fillRect(x0, y0, rw, rh);
    ctx.fillStyle = '#0c3a1c';
    for (let gx = x0 + 6; gx < x0 + rw; gx += 8) ctx.fillRect(gx, y0, 1, rh);
    for (let gy = y0 + 4; gy < y0 + rh; gy += 8) ctx.fillRect(x0, gy, rw, 1);
    const sx = (x) => x0 + x / 4.15;
    const sy = (d) => y0 + rh - 5 - (d - w.d) / 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, rw, rh);
    ctx.clip();
    for (const gs of w.guests) {
      const yy = sy(gs.d);
      if (yy < y0 - 20 || yy > y0 + rh + 20) continue;
      const p = gs.pose(w.t);
      const hot = gs.spot > 0 || w.catcher === gs;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = hot ? '#ff3b5c' : '#3aff7a';
      ctx.beginPath();
      ctx.moveTo(sx(p.x), yy);
      ctx.arc(sx(p.x), yy, gs.range / 4, p.a - MG.CONE, p.a + MG.CONE);
      ctx.closePath();
      ctx.fill();
      if (p.wake) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ff3fd2';
        ctx.beginPath();
        ctx.arc(sx(p.x), yy, p.ring / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff3b5c';
      ctx.fillRect(Math.round(sx(p.x)) - 1, Math.round(yy) - 1, 2, 2);
    }
    ctx.restore();
    const px = Math.round(sx(R.pathX(w.d)));
    const py = Math.round(sy(w.d));
    ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffffff' : '#9dffb0';
    ctx.fillRect(px - 1, py - 1, 3, 3);
    ctx.strokeStyle = '#2a7a44';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, rw - 1, rh - 1);
  };

  // Ready: inside the front door, in the box.
  ui.drawReady = function (ctx, g, t) {
    T(ctx, 'MISSION', W / 2, 92, { font: 'small', color: C.yellow, align: 'center', outline: C.ink });
    T(ctx, 'STAY OFF CAMERA', W / 2, 102, { scale: 2, italic: true, gradient: STEEL, outline: C.ink, align: 'center' });
    if (Math.floor(t * 2.2) % 2 === 0) T(ctx, g.world.auto ? 'GHOST MODE' : 'HOLD TO SNEAK', W / 2, 232, { font: 'big', color: C.white, align: 'center', outline: C.ink });
    T(ctx, 'LET GO TO HIDE IN THE BOX', W / 2, 246, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
  };

  // ---------- POV footage ----------
  // What the guest's glasses recorded: a phone-shaped frame, REC, their handle.
  ui.drawPOV = function (ctx, g, t) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillRect(0, H - 30, W, 30);
    for (const [cx, cy, dx, dy] of [
      [0, 34, 1, 1],
      [W, 34, -1, 1],
      [0, H - 30, 1, -1],
      [W, H - 30, -1, -1],
    ]) {
      for (let k = 0; k < 5; k++) ctx.fillRect(dx > 0 ? cx : cx - (5 - k), dy > 0 ? cy + k : cy - k - 1, 5 - k, 1);
    }
    const c = g.world.catcher;
    ui.drawCamcorder(ctx, t, { title: 'POV FOOTAGE', sub: `${c ? c.handle : '@SOMEONE'} · ◀◀ 0.5×` });
  };

  // ---------- the result ----------
  ui.drawOver = function (ctx, g, t) {
    const r = g.run;
    ui.drawStamp(ctx, r.stamp, C.red, t, W / 2, 58);
    ui.drawTyped(ctx, r.msg, t - 0.35, 86);
    if (t < 0.9) return;
    const ct = R.easeBack(R.clamp((t - 0.9) / 0.35, 0, 1));
    const y0 = Math.round(H - ct * (H - 114));
    panel(ctx, 12, y0, W - 24, 196, C.cyan, 'rgba(9,5,20,0.92)');
    T(ctx, 'DISTANCE', W / 2, y0 + 8, { font: 'small', color: C.dim, align: 'center' });
    T(ctx, `${r.score} M`, W / 2, y0 + 17, { scale: 4, color: C.white, outline: C.ink, align: 'center' });
    T(ctx, r.newBest ? 'NEW BEST!' : `BEST ${g.best} M`, W / 2, y0 + 49, { font: 'small', color: r.newBest ? C.yellow : C.dim, align: 'center' });
    // The rank, after the old games' codenames.
    ctx.fillStyle = 'rgba(255,63,210,0.12)';
    ctx.fillRect(18, y0 + 60, W - 36, 26);
    T(ctx, 'RANK', W / 2, y0 + 63, { font: 'small', color: C.pink, align: 'center' });
    T(ctx, r.rank, W / 2, y0 + 72, { font: 'big', color: C.yellow, outline: C.ink, align: 'center' });
    T(ctx, `RECORDED BY ${r.handle}`, W / 2, y0 + 94, { font: 'small', color: C.cyan, align: 'center' });
    T(ctx, ui.statLine([`ROOM ${r.rooms + 1}`, `BOXED ${r.boxes}`, `CLOSE CALLS ${r.close}`, `FOOLED ${r.fooled}`]), W / 2, y0 + 106, { font: 'small', color: C.white, align: 'center' });
    const by = y0 + 122;
    button(ctx, 'retry', 20, by, 86, 22, 'RETRY', { icon: 'retry', rim: C.cyan });
    button(ctx, 'replay', 110, by, 86, 22, 'POV FOOTAGE', { icon: 'play', rim: C.pink, iconCol: C.pink });
    button(ctx, 'menu', 20, by + 26, 86, 18, 'TITLE', { rim: C.rim });
    button(ctx, 'share', 110, by + 26, 86, 18, 'SHARE CARD', { icon: 'share', rim: C.yellow, iconCol: C.yellow });
    ui.drawToast(ctx, y0 - 18);
  };

  ui.draw = function (ctx, g, t) {
    ui.begin();
    const st = g.state;
    if (st === 'title') ui.drawTitle(ctx, g, g.stateT);
    if (st === 'codec') ui.drawCodec(ctx, g, t);
    if (st === 'ready') ui.drawReady(ctx, g, g.stateT);
    if (st === 'play' || st === 'caught' || st === 'paused') ui.drawHUD(ctx, g, t);
    if (st === 'pov') ui.drawPOV(ctx, g, t);
    ui.drawBanner(ctx);
    ui.drawPops(ctx, t);
    if (st === 'over') ui.drawOver(ctx, g, g.stateT);
    if (st === 'paused') ui.drawPause(ctx, 'THE BOX IS ON A BREAK', 'BACK TO TITLE');
  };
})();
