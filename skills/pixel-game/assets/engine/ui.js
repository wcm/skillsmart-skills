/* Pixel Game engine · ui: the pieces every game's screens are made of, drawn into the pixel buffer so
   screen recordings and rendered demos capture them exactly: a neon palette and gradients,
   clipped-corner panels, buttons that register themselves each frame, popups, banners, the stamp
   that slams down on a result, medals, toasts, a pause screen, a camcorder replay overlay, logo
   helpers and 9×9 icons. Each game adds its own screens to R.ui. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const C = {
    cyan: '#2ef6ff',
    pink: '#ff3fd2',
    yellow: '#ffe14d',
    red: '#ff2a3d',
    green: '#39ff7a',
    white: '#ffffff',
    dim: '#9a8fc4',
    ink: '#07040d',
    panel: 'rgba(9,5,20,0.86)',
    blue: '#6bb8ff',
    rim: '#4a3f7a',
  };
  R.UIC = C;
  R.GRAD = {
    chrome: ['#ffffff', '#ffffff', '#d8f6ff', '#9eeaff', '#ff9ae8', '#ff4fd8', '#b02cff'],
    neon: ['#bffcff', '#7ff6ff', '#2ef6ff', '#2ad0ff', '#ff6be0', '#ff3fd2', '#d21fb0'],
    rainbow: ['#ff3b5c', '#ff9a2f', '#ffe14d', '#7dff6b', '#2ef6ff', '#6b8cff', '#c46bff'],
    gold: ['#fffbd0', '#fff3a0', '#ffe14d', '#ffd02e', '#ffb21e', '#ff8a1e', '#ff6a2a'],
    ice: ['#fff', '#fff', '#bfefff', '#7fe3ff', '#2ef6ff', '#2ad0ff', '#2a9cff'],
    heat: ['#fff', '#fff', '#ffe9a8', '#ffe14d', '#ffb13b', '#ff7a2f', '#ff3fd2'],
  };
  const RAINBOW = R.GRAD.rainbow;

  const ui = (R.ui = { buttons: [], pops: [], banner: null, pressed: null, pressedT: 0, scoreBump: 0 });
  const T = (ctx, s, x, y, o) => R.text(ctx, s, x, y, o);
  ui.T = T;

  ui.begin = function () {
    ui.buttons.length = 0;
  };
  ui.hit = function (x, y) {
    for (let i = ui.buttons.length - 1; i >= 0; i--) {
      const b = ui.buttons[i];
      if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return b;
    }
    return null;
  };

  // Cyberpunk panel: clipped corners and a neon rim.
  function panel(ctx, x, y, w, h, rim, fill) {
    ctx.fillStyle = fill || C.panel;
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillRect(x, y + 2, w, h - 4);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = rim || C.cyan;
    ctx.fillRect(x + 3, y, w - 6, 1);
    ctx.fillRect(x + 3, y + h - 1, w - 6, 1);
    ctx.fillRect(x, y + 3, 1, h - 6);
    ctx.fillRect(x + w - 1, y + 3, 1, h - 6);
    ctx.fillRect(x + 1, y + 2, 1, 1);
    ctx.fillRect(x + 2, y + 1, 1, 1);
    ctx.fillRect(x + w - 2, y + 2, 1, 1);
    ctx.fillRect(x + w - 3, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + h - 3, 1, 1);
    ctx.fillRect(x + 2, y + h - 2, 1, 1);
    ctx.fillRect(x + w - 2, y + h - 3, 1, 1);
    ctx.fillRect(x + w - 3, y + h - 2, 1, 1);
  }
  ui.panel = panel;

  // A button: registers itself for this frame's hit tests. o: { rim, fill, on, col, big, icon, iconCol }.
  function button(ctx, id, x, y, w, h, label, o) {
    o = o || {};
    const down = ui.pressed === id && ui.pressedT > 0;
    const rim = o.rim || C.cyan;
    panel(ctx, x, y + (down ? 1 : 0), w, h, rim, o.fill || (o.on ? 'rgba(46,246,255,0.18)' : C.panel));
    let tx = x + w / 2;
    const ty = y + Math.floor((h - (o.big ? 7 : 5)) / 2) + (down ? 1 : 0);
    if (o.icon) {
      const lw = label ? R.measure(label, { font: o.big ? 'big' : 'small' }) : 0;
      const total = 9 + (label ? 3 + lw : 0);
      const ix = Math.round(x + (w - total) / 2);
      R.icon(ctx, o.icon, ix, y + Math.floor((h - 9) / 2) + (down ? 1 : 0), o.iconCol || C.white);
      tx = ix + 12 + lw / 2;
    }
    if (label) T(ctx, label, Math.round(tx), ty, { font: o.big ? 'big' : 'small', color: o.col || C.white, align: 'center' });
    ui.buttons.push({ id, x, y, w, h });
  }
  ui.button = button;

  // ---------- popups and banners ----------
  // A word that pops up and drifts away. o: { x, y, life, scale, font, color, gradient, rainbow,
  // outline, italic, vy, delay, shakeX, tag (a new popup replaces an older one with the same tag) }.
  ui.pop = function (text, o) {
    o = Object.assign({ x: W / 2, y: 120, life: 1.1, scale: 2, font: 'big', color: C.white, outline: C.ink, vy: -14, delay: 0 }, o || {});
    o.text = text;
    o.t = -o.delay;
    if (o.tag) ui.pops = ui.pops.filter((p) => p.tag !== o.tag);
    ui.pops.push(o);
    if (ui.pops.length > 14) ui.pops.shift();
  };
  // A band that sweeps across the screen: a small kicker line, a big title, a sub line.
  ui.showBanner = function (b) {
    ui.banner = Object.assign({ t: 0, y: 44 }, b);
  };

  ui.update = function (dt) {
    for (let i = ui.pops.length - 1; i >= 0; i--) {
      const p = ui.pops[i];
      p.t += dt;
      if (p.t > p.life) ui.pops.splice(i, 1);
    }
    if (ui.banner) {
      ui.banner.t += dt;
      if (ui.banner.t > 2.1) ui.banner = null;
    }
    ui.pressedT = Math.max(0, ui.pressedT - dt);
    ui.scoreBump = Math.max(0, ui.scoreBump - dt);
  };

  ui.drawPops = function (ctx, t) {
    for (const p of ui.pops) {
      if (p.t < 0) continue;
      const u = p.t / p.life;
      const pop = p.t < 0.07 ? p.scale + 1 : p.scale;
      const a = u > 0.75 ? (1 - u) * 4 : 1;
      const y = Math.round(p.y + p.vy * p.t);
      let gradient = p.gradient;
      if (p.rainbow) gradient = RAINBOW.map((_, i) => RAINBOW[(i + Math.floor(t * 12)) % RAINBOW.length]);
      const x = p.shakeX ? p.x + Math.round(Math.sin(p.t * 60) * p.shakeX * (1 - u)) : p.x;
      T(ctx, p.text, Math.round(x), y, { scale: pop, font: p.font, color: p.color, gradient, outline: p.outline, italic: p.italic, align: 'center', alpha: a });
    }
  };

  ui.drawBanner = function (ctx) {
    const b = ui.banner;
    if (!b) return;
    const inT = R.easeOut(R.clamp(b.t / 0.3, 0, 1));
    const outT = R.clamp((b.t - 1.7) / 0.35, 0, 1);
    const x = Math.round((1 - inT) * W - R.easeInOut(outT) * W);
    const y = b.y;
    ctx.fillStyle = 'rgba(5,3,12,0.5)';
    ctx.fillRect(x, y, W, 46);
    ctx.fillStyle = C.pink;
    ctx.fillRect(x, y, W, 1);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x, y + 45, W, 1);
    if (b.kicker) T(ctx, b.kicker, x + W / 2, y + 6, { font: 'small', color: C.yellow, align: 'center' });
    T(ctx, b.title, x + W / 2, y + 15, { scale: 2, italic: true, gradient: R.GRAD.neon, outline: C.ink, align: 'center' });
    if (b.sub) T(ctx, b.sub, x + W / 2, y + 36, { font: 'small', color: C.dim, align: 'center' });
  };

  // ---------- logo helpers ----------
  // One centred line drawn letter by letter, so each letter can move on its own: per(i) may lift
  // it (dy), squash it for a flip (sy; below zero shows its back) or restyle it (o).
  ui.letterLine = function (ctx, str, y, o, per) {
    let x = Math.round(W / 2 - R.textCanvas(str, o).w / 2); // centred like T(), italic lean included
    for (let i = 0; i < str.length; i++) {
      const f = (per && per(i)) || {};
      const tc = R.textCanvas(str[i], f.o ? Object.assign({}, o, f.o) : o);
      const top = y + (f.dy || 0) - tc.pad;
      if (f.sy == null) ctx.drawImage(tc.c, x - tc.pad, top);
      else {
        const h = tc.c.height;
        ctx.save();
        ctx.translate(x - tc.pad, top + h / 2);
        ctx.scale(1, Math.abs(f.sy) < 0.1 ? (f.sy < 0 ? -0.1 : 0.1) : f.sy);
        ctx.drawImage(tc.c, 0, -h / 2);
        ctx.restore();
      }
      x += (R.FONTS[o.font || 'big'].get(str[i]).w + 1) * (o.scale || 1);
    }
  };
  // Tiny pixel art: rows of '#', each pixel s × s, mirrored left to right when flip is set.
  ui.pixels = function (ctx, rows, x, y, s, col, flip) {
    ctx.fillStyle = col;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + (flip ? row.length - 1 - rx : rx) * s, y + ry * s, s, s);
    });
  };
  // A light sweeping across whatever is already drawn (the chrome of a logo).
  ui.shine = function (ctx, t, y) {
    const sx = ((t * 90) % 420) - 100;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(sx, y - 4);
    ctx.lineTo(sx + 5, y - 4);
    ctx.lineTo(sx - 33, y + 52);
    ctx.lineTo(sx - 38, y + 52);
    ctx.fill();
    ctx.restore();
  };
  // A slab leaning like the italics: a fill colour with a rim and a hard shadow.
  ui.sticker = function (ctx, x, y, w, h, fill, rim, shadow) {
    const lean = (r) => Math.round((h - 1 - r) * 0.24);
    for (const [d, col, inset] of [[2, shadow || '#140022', 0], [0, rim || '#ffffff', 0], [0, fill || C.red, 1]]) {
      ctx.fillStyle = col;
      for (let r = inset; r < h - inset; r++) ctx.fillRect(x + d + lean(r) + inset, y + d + r, w - inset * 2, 1);
    }
  };

  // Darken a band of the screen behind text, fading out at its top and bottom.
  ui.backdrop = function (ctx, y0, y1, a) {
    for (let y = y0; y < y1; y++) {
      const u = (y - y0) / (y1 - y0);
      const e = Math.min(1, Math.min(u, 1 - u) * 6);
      ctx.fillStyle = `rgba(5,2,14,${(a * e).toFixed(3)})`;
      ctx.fillRect(0, y, W, 1);
    }
  };

  // ---------- results ----------
  // A stamp's lines at the biggest scale that fits: one line at 3x, a single long word at 2x, else
  // up to two lines at 2x or 1x.
  function stampLines(label) {
    const fits = (str, sc) => R.measure(str, { scale: sc }) * 1.12 <= W - 40;
    if (fits(label, 3)) return { lines: [label], scale: 3 };
    const words = label.split(' ');
    if (words.length === 1 && fits(label, 2)) return { lines: [label], scale: 2 };
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const wd = Math.max(R.measure(a, { scale: 2 }), R.measure(b, { scale: 2 }));
      if (!best || wd < best.wd) best = { lines: [a, b], wd };
    }
    if (best && fits(best.lines[0], 2) && fits(best.lines[1], 2)) return { lines: best.lines, scale: 2 };
    return { lines: best ? best.lines : [label], scale: 1 };
  }

  // The stamp slamming down, st seconds after it started, centred at (cx, cy) and tilted.
  ui.drawStamp = function (ctx, label, col, st, cx, cy) {
    if (st <= 0) return;
    col = col || C.red;
    const u = R.clamp(st / 0.16, 0, 1);
    const s = 1 + (1 - R.easeOut(u)) * 1.6;
    const sl = stampLines(label);
    const tcs = sl.lines.map((l) => R.textCanvas(l, { scale: sl.scale, italic: true, color: col, outline: col === C.red ? '#3a0008' : C.ink }));
    const lh = sl.scale * 7 + 6;
    const bh = sl.lines.length > 1 ? lh * 2 + 8 : 32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.12);
    ctx.imageSmoothingEnabled = false;
    // Ink box.
    const bw = Math.round(Math.max(...tcs.map((tc) => tc.w)) + 16);
    ctx.globalAlpha = u * 0.12;
    ctx.fillStyle = col;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.globalAlpha = u;
    ctx.fillRect(-bw / 2, -bh / 2, bw, 2);
    ctx.fillRect(-bw / 2, bh / 2 - 2, bw, 2);
    ctx.fillRect(-bw / 2, -bh / 2, 2, bh);
    ctx.fillRect(bw / 2 - 2, -bh / 2, 2, bh);
    tcs.forEach((tc, i) => {
      const w = tc.c.width * s;
      const h = tc.c.height * s;
      const ly = tcs.length > 1 ? (i - 0.5) * lh : 0;
      ctx.drawImage(tc.c, -w / 2, ly - h / 2, w, h);
    });
    ctx.restore();
  };

  // A punchline typed out letter by letter, st seconds in, wrapped and centred from y.
  ui.drawTyped = function (ctx, msg, st, y, o) {
    o = o || {};
    if (st <= 0) return;
    const n = Math.floor(st * (o.rate || 40));
    const lines = R.wrap(msg, o.width || 196, { font: 'small' });
    let used = 0;
    lines.forEach((line, i) => {
      const show = line.slice(0, Math.max(0, n - used));
      used += line.length;
      T(ctx, show, W / 2, y + i * 8, { font: 'small', color: o.color || C.white, align: 'center', outline: C.ink });
    });
  };

  // A medal on a ribbon, or an empty socket. medal: { name, col, rim } or null.
  ui.drawMedal = function (ctx, medal, mx, my) {
    if (medal) {
      ctx.fillStyle = C.pink;
      ctx.fillRect(mx - 9, my + 6, 6, 12);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(mx + 3, my + 6, 6, 12);
      R.disc(ctx, mx, my, 14, '#07040d');
      R.disc(ctx, mx, my, 13, medal.rim);
      R.disc(ctx, mx, my, 11, medal.col);
      R.disc(ctx, mx - 4, my - 4, 2, '#ffffff');
      T(ctx, '★', mx, my - 3, { font: 'big', color: '#1a1433', align: 'center' });
      T(ctx, medal.name, mx, my + 20, { font: 'small', color: medal.col, align: 'center', outline: C.ink });
    } else {
      R.disc(ctx, mx, my, 13, '#2a2346');
      T(ctx, '?', mx, my - 3, { font: 'big', color: '#5d5385', align: 'center' });
      T(ctx, 'NO MEDAL', mx, my + 18, { font: 'small', color: '#5d5385', align: 'center' });
    }
  };

  // One line of stats joined with dots; trailing parts drop off until it fits the width.
  ui.statLine = function (parts, width) {
    const p = parts.slice();
    while (p.length > 2 && R.measure(p.join(' · '), { font: 'small' }) > (width || W - 36)) p.pop();
    return p.join(' · ');
  };

  // The app's toast (a saved file, a copied caption), on a small panel at y.
  ui.drawToast = function (ctx, y) {
    const app = R.app;
    if (!app || !app.toast || app.toastT <= 0) return;
    panel(ctx, 30, y, W - 60, 14, C.yellow, 'rgba(9,5,20,0.95)');
    T(ctx, app.toast, W / 2, y + 4, { font: 'small', color: C.yellow, align: 'center' });
  };

  // ---------- shared screens ----------
  // Paused: a title, a joke line, RESUME and a way out (button ids 'resume' and 'quit').
  ui.drawPause = function (ctx, sub, quitLabel) {
    ctx.fillStyle = 'rgba(5,3,12,0.7)';
    ctx.fillRect(0, 0, W, H);
    T(ctx, 'PAUSED', W / 2, 130, { scale: 3, italic: true, gradient: R.GRAD.neon, outline: C.ink, align: 'center' });
    if (sub) T(ctx, sub, W / 2, 160, { font: 'small', color: C.dim, align: 'center' });
    button(ctx, 'resume', 38, 180, 140, 22, 'RESUME', { icon: 'play', big: true, rim: C.cyan });
    button(ctx, 'quit', 38, 208, 140, 18, quitLabel || 'BACK TO MENU', { rim: C.rim });
  };

  // A camcorder over a replay: a blinking dot, a title and sub line, the score, today's date and
  // time, and a tracking band rolling down.
  ui.drawCamcorder = function (ctx, t, o) {
    o = o || {};
    if (Math.floor(t * 2) % 2 === 0) R.disc(ctx, 10, 11, 3, o.dot || C.red);
    T(ctx, o.title || 'REPLAY', 17, 8, { font: 'big', color: C.white, outline: C.ink });
    if (o.sub) T(ctx, o.sub, 17, 18, { font: 'small', color: C.dim, outline: C.ink });
    if (o.score != null) T(ctx, String(o.score), W - 8, 8, { scale: 2, color: C.white, outline: C.ink, align: 'right' });
    const d = new Date();
    const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
    const p2 = (n) => String(n).padStart(2, '0');
    const ts = `${mon} ${p2(d.getDate())} ${d.getFullYear()}  ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    T(ctx, ts, 8, H - 9, { font: 'small', color: '#e8e8e8', outline: C.ink });
    T(ctx, o.skip || 'TAP TO SKIP', W - 8, H - 9, { font: 'small', color: C.dim, align: 'right', outline: C.ink });
    const band = ((t * 70) % (H + 40)) - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, Math.round(band), W, 6);
  };

  // ---------- icons (9×9) ----------
  const ICON_PAL = { '#': '#ffffff', x: '#ff3b5c', glow: '' };
  const ICONS = {
    sound: ['....#....', '...##..#.', '####.#..#', '####..#.#', '####..#.#', '####.#..#', '...##..#.', '....#....', '.........'],
    music: ['...######', '...#....#', '...#....#', '...#....#', '...#....#', '.###..###', '####.####', '.##...##.', '.........'],
    mute: ['....#....', '...##....', '####.x..x', '####..xx.', '####..xx.', '####.x..x', '...##....', '....#....', '.........'],
    wheel: ['..#####..', '.#.....#.', '#.......#', '#########', '#..#.#..#', '#...#...#', '.#..#..#.', '..#####..', '.........'],
    retry: ['..####...', '.#....#..', '#......#.', '#.....###', '#......#.', '#........', '.#....#..', '..####...', '.........'],
    play: ['.#.......', '.##......', '.###.....', '.####....', '.#####...', '.####....', '.###.....', '.##......', '.#.......'],
    pause: ['.........', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.........'],
    share: ['......##.', '....##.#.', '..##...#.', '##.....#.', '#.##..#..', '#...##...', '#.......#', '#########', '.........'],
    lock: ['...###...', '..#...#..', '..#...#..', '.#######.', '.###.###.', '.###.###.', '.#######.', '.........', '.........'],
    left: ['.........', '....#....', '...##....', '..#######', '.########', '..#######', '...##....', '....#....', '.........'],
    right: ['.........', '....#....', '....##...', '#######..', '########.', '#######..', '....##...', '....#....', '.........'],
    up: ['....#....', '...###...', '..#####..', '.#######.', '...###...', '...###...', '...###...', '...###...', '.........'],
    cpu: ['.#.#.#.#.', '#########', '.#.....#.', '##.#.#.##', '.#.....#.', '##.###.##', '.#.....#.', '#########', '.#.#.#.#.'],
  };
  R.ICONS = {};
  for (const k in ICONS) R.ICONS[k] = R.sprite(ICONS[k], ICON_PAL);
  const tints = new Map();
  R.icon = function (ctx, name, x, y, color) {
    const ic = R.ICONS[name];
    if (!ic) return;
    if (!color || color === '#ffffff') return ctx.drawImage(ic.c, x, y);
    const key = name + color;
    let t = tints.get(key);
    if (!t) {
      const cv = R.canvas(ic.w, ic.h);
      cv.x.drawImage(ic.c, 0, 0);
      cv.x.globalCompositeOperation = 'source-in';
      cv.x.fillStyle = color;
      cv.x.fillRect(0, 0, ic.w, ic.h);
      t = cv.c;
      tints.set(key, t);
    }
    ctx.drawImage(t, x, y);
  };
})();
