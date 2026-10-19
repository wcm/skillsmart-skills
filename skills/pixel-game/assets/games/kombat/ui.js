/* Model Kombat · ui: the logo, the select screen, the fight HUD (health, timer, rounds, meters),
   the on-screen pad, the summit intro's captions and the result card, built from the engine's UI
   kit in R.ui. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const C = R.UIC;
  const ui = R.ui;
  const T = ui.T;
  const { panel, button } = ui;
  const K = R.KOMBAT;
  const IN = R.IN;

  const MOLTEN = ['#fff6c8', '#ffe68a', '#ffc94d', '#ff9a2f', '#ff6a2a', '#e8332a', '#a01a2a'];
  // What each fighter's special is called, and their super.
  R.KMOVES = {
    sam: { special: 'AD BREAK', super: 'ACCELERATE' },
    dario: { special: 'SUPER BOWL AD', super: 'SLOW DOWN' },
  };

  // ---------- the logo ----------
  // MODEL in chrome over KOMBAT in molten gold, on a medallion of a little neural network (the
  // dragon of this franchise). The medallion's nodes light up in turn.
  ui.klogo = function (ctx, t, y, still) {
    const cx = W / 2;
    const cy = y + 30;
    R.disc(ctx, cx, cy, 30, '#140c1e');
    R.disc(ctx, cx, cy, 28, '#2a1a12');
    R.disc(ctx, cx, cy, 26, '#140c1e');
    const nodes = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      nodes.push([Math.round(cx + Math.cos(a) * 18), Math.round(cy + Math.sin(a) * 18)]);
    }
    nodes.push([cx, cy]);
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      for (const j of [(i + 1) % 6, 6]) {
        ctx.beginPath();
        ctx.moveTo(nodes[i][0] + 0.5, nodes[i][1] + 0.5);
        ctx.lineTo(nodes[j][0] + 0.5, nodes[j][1] + 0.5);
        ctx.stroke();
      }
    }
    const lit = still ? -1 : Math.floor(t * 5) % 7;
    nodes.forEach(([nx, ny], i) => R.disc(ctx, nx, ny, 2, i === lit ? '#ffe68a' : '#c9862f'));
    T(ctx, 'MODEL', cx, y + 6, { scale: 2, italic: true, gradient: R.GRAD.chrome, outline: '#140022', align: 'center' });
    const flick = still ? 0 : Math.floor(t * 12) % 7 === 0 ? 1 : 0;
    T(ctx, 'KOMBAT', cx, y + 24 + flick, { scale: 3, italic: true, gradient: MOLTEN, outline: '#1a0606', align: 'center' });
  };

  // ---------- select screen ----------
  const PORT = [
    { id: 'sam', x: 10, y: 120 },
    { id: 'dario', x: 114, y: 120 },
  ];
  ui.KPORT = PORT;
  ui.drawSelect = function (ctx, g, t) {
    ui.backdrop(ctx, 0, H, 0.66);
    ui.klogo(ctx, t, 8);
    const n = Math.min(26, Math.floor(t * 22));
    T(ctx, "THEY WOULDN'T HOLD HANDS.".slice(0, n), W / 2, 76, { font: 'small', color: C.white, align: 'center', outline: C.ink });
    if (t > 1.3) T(ctx, 'SO THEY PUT UP THEIR FISTS.', W / 2, 86, { font: 'small', color: C.yellow, align: 'center', outline: C.ink });
    T(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 104, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
    PORT.forEach((p, i) => {
      const f = R.FIGHTERS[p.id];
      const mine = g.sel === i && !g.auto;
      const rim = mine ? C.pink : C.rim;
      panel(ctx, p.x, p.y, 92, 116, rim, mine ? 'rgba(255,63,210,0.14)' : 'rgba(9,5,20,0.8)');
      const port = R.fighterPortrait(p.id, mine && Math.floor(t * 1.5) % 4 === 0 ? 'win' : '');
      ctx.drawImage(port.c, p.x + 12, p.y + 8);
      T(ctx, f.name, p.x + 46, p.y + 86, { font: 'big', color: mine ? C.white : C.dim, align: 'center', outline: C.ink });
      T(ctx, f.team, p.x + 46, p.y + 96, { font: 'small', color: mine ? C.cyan : '#5d5385', align: 'center' });
      T(ctx, R.KMOVES[p.id].super, p.x + 46, p.y + 105, { font: 'small', color: mine ? C.yellow : '#5d5385', align: 'center' });
      const tag = g.auto ? 'CPU' : mine ? '1P' : 'CPU';
      panel(ctx, p.x + 4, p.y + 4, 22, 11, mine ? C.pink : '#3a3360', mine ? C.pink : 'rgba(9,5,20,0.9)');
      T(ctx, tag, p.x + 15, p.y + 7, { font: 'small', color: mine ? C.ink : C.dim, align: 'center' });
      ui.buttons.push({ id: 'sel' + i, x: p.x, y: p.y, w: 92, h: 116 });
    });
    const sh = Math.round(Math.sin(t * 9) * 1);
    T(ctx, 'VS', W / 2 + sh, 168, { scale: 2, italic: true, color: C.red, outline: '#3a0008', align: 'center' });

    // Difficulty: how sharp the CPU is.
    R.LEVELS.forEach((L, i) => {
      const on = g.level === i;
      button(ctx, 'level' + i, 4 + i * 53, 246, 51, 15, L.name, { rim: on ? C.yellow : C.rim, col: on ? C.yellow : C.dim, on });
    });
    const lv = R.audio.level;
    button(ctx, 'sound', 4, 266, 102, 18, ['SOUND', 'SFX ONLY', 'MUTED'][lv], { icon: lv === 2 ? 'mute' : lv === 1 ? 'sound' : 'music', rim: C.rim });
    button(ctx, 'auto', 110, 266, 102, 18, g.auto ? 'CPU VS CPU' : '1P VS CPU', { icon: 'cpu', iconCol: g.auto ? C.blue : C.dim, rim: g.auto ? C.blue : C.rim, col: g.auto ? C.blue : C.white, on: !!g.auto });
    const pulse = Math.floor(t * 2.2) % 2 === 0;
    button(ctx, 'fight', 20, 292, 176, 30, 'FIGHT!', { big: true, rim: pulse ? C.red : C.pink, fill: 'rgba(255,42,61,0.22)', col: C.white });
    const tl = g.tally;
    T(ctx, `ALL-TIME   SAM ${tl.sam}  ·  DARIO ${tl.dario}`, W / 2, 334, { font: 'small', color: C.dim, align: 'center', outline: C.ink });
  };

  // ---------- the fight ----------
  // The pad under the stage: move and jump on the left, punch, kick and the special on the right.
  R.KPAD = [
    { id: 'up', x: 30, y: 270, w: 36, h: 28, bit: IN.U, icon: 'up' },
    { id: 'left', x: 6, y: 302, w: 40, h: 40, bit: IN.L, hold: true, icon: 'left' },
    { id: 'right', x: 50, y: 302, w: 40, h: 40, bit: IN.R, hold: true, icon: 'right' },
    { id: 'special', x: 112, y: 270, w: 98, h: 28, bit: IN.S },
    { id: 'punch', x: 112, y: 302, w: 47, h: 40, bit: IN.P, label: 'PUNCH' },
    { id: 'kick', x: 163, y: 302, w: 47, h: 40, bit: IN.Kk, label: 'KICK' },
  ];

  function bar(ctx, x, y, w, h, frac, ghost, col, right) {
    ctx.fillStyle = '#07040d';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#3a0d18';
    ctx.fillRect(x, y, w, h);
    const gw = Math.round(w * R.clamp(ghost, 0, 1));
    const fw = Math.round(w * R.clamp(frac, 0, 1));
    ctx.fillStyle = '#ff2a3d';
    ctx.fillRect(right ? x + w - gw : x, y, gw, h);
    ctx.fillStyle = col;
    ctx.fillRect(right ? x + w - fw : x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(right ? x + w - fw : x, y, fw, 1);
  }

  ui.drawFight = function (ctx, g, t) {
    const r = g.round;
    if (!r) return;
    // Health bars, the timer, round wins, the meters.
    const BW = 84;
    r.f.forEach((f, i) => {
      const x = i === 0 ? 8 : W - 8 - BW;
      const gh = g.ghost[i];
      bar(ctx, x, 16, BW, 7, f.hp / K.HP, gh / K.HP, f.hp < 30 && Math.floor(t * 6) % 2 ? '#ffffff' : C.yellow, i === 1);
      const F = R.FIGHTERS[f.id];
      T(ctx, F.name, i === 0 ? x : x + BW, 26, { font: 'big', color: C.white, align: i === 0 ? 'left' : 'right', outline: C.ink });
      T(ctx, (r.f[i].cpu ? 'CPU · ' : '1P · ') + F.team, i === 0 ? x : x + BW, 6, { font: 'small', color: r.f[i].cpu ? C.dim : C.cyan, align: i === 0 ? 'left' : 'right', outline: C.ink });
      // Round wins.
      for (let k = 0; k < 2; k++) {
        const on = g.wins[i] > k;
        const dx = i === 0 ? x + BW - 8 - k * 9 : x + 2 + k * 9;
        R.disc(ctx, dx + 3, 30, 3, on ? C.yellow : '#2a2346');
      }
      // The meter: full, it turns into the super.
      const full = f.meter >= 100;
      const mx = i === 0 ? 8 : W - 70;
      ctx.fillStyle = '#07040d';
      ctx.fillRect(mx - 1, 37, 64, 5);
      ctx.fillStyle = full ? (Math.floor(t * 8) % 2 ? C.pink : C.cyan) : C.blue;
      const mw = Math.round(62 * f.meter / 100);
      ctx.fillRect(i === 0 ? mx : mx + 62 - mw, 38, mw, 3);
      if (full) T(ctx, R.KMOVES[f.id].super, i === 0 ? mx : mx + 62, 44, { font: 'small', color: C.yellow, align: i === 0 ? 'left' : 'right', outline: C.ink });
    });
    const secs = Math.ceil(r.time);
    T(ctx, String(secs).padStart(2, '0'), W / 2, 12, { scale: 2, color: secs <= 10 && Math.floor(t * 4) % 2 ? C.red : C.white, outline: C.ink, align: 'center' });
    button(ctx, 'pause', W / 2 - 7, 30, 14, 12, '', { icon: 'pause', rim: '#3a3360', fill: 'rgba(9,5,20,0.5)' });

    // The pad, or the autopilot's offer to take over.
    const human = !r.f[0].cpu;
    if (!human) {
      T(ctx, 'CPU VS CPU', W / 2, 296, { scale: 2, color: C.blue, outline: C.ink, align: 'center' });
      if (Math.floor(t * 2) % 2 === 0) T(ctx, 'TAP TO TAKE OVER ' + R.FIGHTERS[r.f[0].id].name, W / 2, 318, { font: 'small', color: C.white, align: 'center', outline: C.ink });
      return;
    }
    const f = r.f[0];
    for (const p of R.KPAD) {
      const down = g.pad[p.id];
      let label = p.label;
      let rim = C.rim;
      let col = C.white;
      if (p.id === 'special') {
        const full = f.meter >= 100;
        const finishing = r.state === 'finish' && r.winner === 0;
        label = finishing ? 'DEPRECATE!' : full ? R.KMOVES[f.id].super : R.KMOVES[f.id].special;
        rim = finishing || full ? (Math.floor(t * 8) % 2 ? C.yellow : C.pink) : f.cool > 0 ? '#3a3360' : C.pink;
        col = finishing || full ? C.yellow : f.cool > 0 ? C.dim : C.white;
      }
      if (p.id === 'punch' || p.id === 'kick') rim = C.cyan;
      panel(ctx, p.x, p.y + (down ? 1 : 0), p.w, p.h, down ? C.white : rim, down ? 'rgba(255,255,255,0.18)' : 'rgba(9,5,20,0.72)');
      if (p.icon) R.icon(ctx, p.icon, Math.round(p.x + p.w / 2 - 4), Math.round(p.y + p.h / 2 - 4) + (down ? 1 : 0), C.white);
      if (label) T(ctx, label, p.x + p.w / 2, p.y + Math.floor(p.h / 2) - 3 + (down ? 1 : 0), { font: 'small', color: col, align: 'center' });
    }
    T(ctx, 'HOLD AWAY TO BLOCK', W / 2, 352, { font: 'small', color: '#5d5385', align: 'center' });
  };

  // The summit intro and the round call.
  ui.drawCall = function (ctx, g, t) {
    if (g.state === 'intro') {
      const lines = [
        [0.2, 'EVERYONE HELD HANDS.', C.white],
        [1.3, 'EXCEPT THESE TWO.', C.yellow],
        [2.4, 'SO THEY PUT UP THEIR FISTS.', C.pink],
      ];
      // Subtitles on the floor, under the two of them.
      let y = 280;
      for (const [at, s, col] of lines) {
        if (t < at) continue;
        const n = Math.floor((t - at) * 30);
        T(ctx, s.slice(0, n), W / 2, y, { font: 'big', color: col, align: 'center', outline: C.ink });
        y += 14;
      }
      if (t > 0.6) T(ctx, 'TAP TO SKIP', W / 2, 352, { font: 'small', color: '#5d5385', align: 'center' });
    }
  };

  // ---------- the result ----------
  ui.drawKOver = function (ctx, g, t) {
    const m = g.match;
    ui.drawStamp(ctx, m.stamp, m.stampCol, t, W / 2, 70);
    ui.drawTyped(ctx, m.msg, t - 0.35, 100);
    if (t < 0.9) return;
    const ct = R.easeBack(R.clamp((t - 0.9) / 0.35, 0, 1));
    const y0 = Math.round(H - ct * (H - 128));
    panel(ctx, 12, y0, W - 24, 160, C.cyan, 'rgba(9,5,20,0.92)');
    // Winner's portrait and the score.
    const port = R.fighterPortrait(m.winnerId || m.ids[0], m.winnerId ? 'win' : 'hurt');
    ctx.drawImage(port.c, 18, y0 + 6, 44, 49);
    T(ctx, m.winnerId ? R.FIGHTERS[m.winnerId].name + ' WINS' : 'NO WINNER', 140, y0 + 10, { font: 'big', color: m.winnerId ? C.white : C.dim, align: 'center', outline: C.ink });
    T(ctx, `${m.wins[0]} - ${m.wins[1]}`, 140, y0 + 22, { scale: 3, color: C.yellow, outline: C.ink, align: 'center' });
    T(ctx, `${R.FIGHTERS[m.ids[0]].name} VS ${R.FIGHTERS[m.ids[1]].name}`, 140, y0 + 47, { font: 'small', color: C.dim, align: 'center' });
    T(ctx, ui.statLine([R.LEVELS[m.level].name, `${m.hits} HIT${m.hits === 1 ? '' : 'S'}`, m.best >= 2 ? `BEST COMBO ${m.best}` : null, m.supers ? `${m.supers} SUPER${m.supers === 1 ? '' : 'S'}` : null].filter(Boolean)), W / 2, y0 + 62, { font: 'small', color: C.white, align: 'center' });
    // The all-time tally of the feud.
    ctx.fillStyle = 'rgba(255,63,210,0.12)';
    ctx.fillRect(18, y0 + 74, W - 36, 30);
    T(ctx, 'THE FEUD · ALL-TIME', W / 2, y0 + 77, { font: 'small', color: C.pink, align: 'center' });
    T(ctx, `SAM ${g.tally.sam}`, W / 2 - 8, y0 + 86, { scale: 2, color: C.white, outline: C.ink, align: 'right' });
    T(ctx, `${g.tally.dario} DARIO`, W / 2 + 8, y0 + 86, { scale: 2, color: C.white, outline: C.ink, align: 'left' });
    T(ctx, '·', W / 2, y0 + 88, { font: 'big', color: C.dim, align: 'center' });
    const by = y0 + 110;
    button(ctx, 'rematch', 20, by, 86, 22, 'REMATCH', { icon: 'retry', big: false, rim: C.cyan });
    // A match decided on time has no K.O. to replay.
    const can = !!m.last;
    button(ctx, can ? 'replay' : 'noop', 110, by, 86, 22, 'K.O. REPLAY', can ? { icon: 'play', rim: C.pink, iconCol: C.pink } : { icon: 'play', rim: '#3a3360', iconCol: C.dim, col: C.dim });
    button(ctx, 'menu', 20, by + 26, 86, 18, 'SELECT', { rim: C.rim });
    button(ctx, 'share', 110, by + 26, 86, 18, 'SHARE CARD', { icon: 'share', rim: C.yellow, iconCol: C.yellow });
    ui.drawToast(ctx, y0 - 18);
  };

  ui.draw = function (ctx, g, t) {
    ui.begin();
    const st = g.state;
    if (st === 'title') ui.drawSelect(ctx, g, g.stateT);
    if (st === 'intro') ui.drawCall(ctx, g, g.stateT);
    if (st === 'call' || st === 'fight' || st === 'paused') ui.drawFight(ctx, g, t);
    if (st === 'replay') ui.drawCamcorder(ctx, t, { title: 'K.O. REPLAY', sub: '◀◀ SLOW-MO 0.5×' });
    ui.drawBanner(ctx);
    ui.drawPops(ctx, t);
    if (st === 'over') ui.drawKOver(ctx, g, g.stateT);
    if (st === 'paused') ui.drawPause(ctx, 'THE BOARD CALLED A RECESS', 'BACK TO SELECT');
  };
})();
