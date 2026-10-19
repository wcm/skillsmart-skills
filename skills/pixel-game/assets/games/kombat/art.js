/* Model Kombat · art: the two fighters as caricatures, in what they wore on the summit stage in
   New Delhi on Feb 19, 2026 (the photo the game is about), drawn from public photos and
   caricatures of them. Sam Altman: a rounded mass of dark brown hair swept up and back, a face
   widest through the cheekbones with the chin forward, blue-grey eyes, the top teeth showing,
   ears out; a charcoal suit, white shirt, light blue tie. Dario Amodei: a pear-shaped head, a
   ring of short dark curls round a big lined forehead, thick black rectangular glasses, a big
   round nose, rosy cheeks, small full lips, ears out; a navy suit, white shirt, purple tie. Both
   in brown shoes.

   The portraits (select screen, result card, share card) are painted pixel by pixel at 1:1 on a
   66×74 grid, feature by feature; the fighters are a hand-drawn head on a rig of suit sleeves,
   trousers and a jacket that leans with the spine. Every frame is rendered once and cached.
   Fighters face right; the view mirrors them to face left. */
(function () {
  'use strict';
  const R = window.R;

  // ---------------------------------------------------------------------------
  // A tiny pixel painter: a grid of colours, painted in layers, then turned into a canvas.
  // ---------------------------------------------------------------------------
  class Grid {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.p = new Array(w * h).fill(null);
    }
    set(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c;
    }
    get(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.p[y * this.w + x] : null;
    }
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }
    // Rows of a shape: span(y) → [x0, x1] or null.
    rows(y0, y1, span, c) {
      for (let y = y0; y <= y1; y++) {
        const s = span(y);
        if (s) for (let x = s[0]; x <= s[1]; x++) this.set(x, y, c);
      }
    }
    // A small hand-drawn stamp: '.' is transparent, other letters look up pal.
    stamp(x, y, rows, pal) {
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] !== '.') this.set(x + i, y + j, pal[row[i]]);
      });
    }
    // Paint over only where something is already painted with one of `on`.
    tint(x, y, c, on) {
      const cur = this.get(x, y);
      if (cur && (!on || on.includes(cur))) this.set(x, y, c);
    }
    line(x0, y0, x1, y1, c) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    }
    canvas() {
      const cv = R.canvas(this.w, this.h);
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          const c = this.p[y * this.w + x];
          if (c) {
            cv.x.fillStyle = c;
            cv.x.fillRect(x, y, 1, 1);
          }
        }
      return cv.c;
    }
  }
  // A cheap deterministic hash for texture (strands, curls, stubble).
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------------------
  // The fighters' looks.
  // ---------------------------------------------------------------------------
  R.FIGHTERS = {
    sam: {
      id: 'sam',
      name: 'SAM',
      full: 'SAM ALTMAN',
      team: 'OPENAI',
      pal: {
        // hair: base, light strands, dark, tips
        H: '#4d3729', h: '#6f523d', d: '#2e2018', g: '#8e6f55',
        // skin: base, light, shade, deep, blush
        S: '#efc2a1', l: '#f9d8bf', s: '#d59a7c', k: '#b47860', r: '#e8a891', e: '#c4876b',
        B: '#4a3426', L: '#3a2a24', w: '#ffffff', I: '#6a8fb5', E: '#141218', M: '#984c45', p: '#cf8a7d', m: '#ffffff', o: '#5a2222',
        // suit
        top: '#3b3f49', topL: '#555a66', topD: '#24272e', shirt: '#f3f5f9', shirtD: '#cdd2dc', tie: '#9dbbe0', tieD: '#6f92bf', tieL: '#c4d8f0',
        legs: '#33363f', legsD: '#22242a', legsL: '#4a4e59',
        shoe: '#6f4426', shoeL: '#94603a', sole: '#2e1c10',
      },
    },
    dario: {
      id: 'dario',
      name: 'DARIO',
      full: 'DARIO AMODEI',
      team: 'ANTHROPIC',
      pal: {
        H: '#3e2a1d', h: '#5e412c', d: '#22160e', c: '#7a5539',
        S: '#efbf9e', l: '#f8d4ba', s: '#d29775', k: '#b5765d', r: '#eba48e', t: '#c79a80', T: '#b38870', e: '#c2856a',
        B: '#2e1f16', L: '#3a2a22', w: '#ffffff', I: '#6b5235', E: '#141218', M: '#934842', p: '#cd877a', m: '#ffffff', o: '#5a2222',
        G: '#1c2337', Q: '#3d4c78', q: '#d6ecff',
        top: '#1f2a45', topL: '#34446d', topD: '#131a2d', shirt: '#f3f5f9', shirtD: '#cdd2dc', tie: '#6e3061', tieD: '#4a1d40', tieL: '#a65a91',
        legs: '#1d263e', legsD: '#131a2b', legsL: '#2f3c5e',
        shoe: '#7a4a28', shoeL: '#a06a3e', sole: '#2e1c10',
      },
    },
  };

  // ---------------------------------------------------------------------------
  // Portraits: 66×74, painted at 1:1.
  // ---------------------------------------------------------------------------
  const PW = 66;
  const PH = 74;
  const CX = 33;

  // Shoulders in a suit: jacket, lapels, shirt, tie.
  function paintSuit(g, P) {
    const span = (y) => {
      const t = [
        [47, 24], [48, 20], [49, 17], [50, 15], [51, 13], [52, 12],
      ];
      for (const [yy, x0] of t) if (y === yy) return [x0, PW - 1 - x0];
      if (y >= 53 && y <= 55) return [11, PW - 12];
      return [10, PW - 11];
    };
    g.rows(47, PH - 1, span, P.top);
    // Light from the left: a lit left side, a shaded right side, the sleeve seams.
    for (let y = 50; y < PH; y++) {
      const [x0, x1] = span(y);
      g.set(x0 + 1, y, P.topL);
      g.set(x0 + 2, y, P.topL);
      g.set(x1, y, P.topD);
      g.set(x1 - 1, y, P.topD);
      g.set(x1 - 2, y, P.topD);
    }
    for (let y = 57; y < PH; y++) {
      g.set(18, y, P.topD);
      g.set(PW - 19, y, P.topD);
    }
    // The shirt's V between the lapels, the tie down the middle.
    const vSpan = (y) => {
      const k = (y - 47) / 19;
      return y <= 66 ? [Math.round(27 + k * 5), Math.round(39 - k * 5)] : null;
    };
    g.rows(47, 66, vSpan, P.shirt);
    for (let y = 47; y <= 66; y++) {
      const s = vSpan(y);
      if (s) g.set(s[1], y, P.shirtD);
    }
    // Lapels: a band outside each side of the V, with a notch, and a dark edge.
    for (let y = 47; y <= 66; y++) {
      const s = vSpan(y);
      if (!s) continue;
      const wide = y < 56 ? 4 : 3;
      for (let i = 1; i <= wide; i++) {
        g.set(s[0] - i, y, i === wide ? P.topD : P.topL);
        g.set(s[1] + i, y, i === wide ? P.topD : P.top);
      }
    }
    g.set(23, 56, P.topD);
    g.set(43, 56, P.topD);
    // Shirt collar points at the neck.
    g.stamp(25, 45, ['ww...', 'wwww.', '.www.', '..ww.'], { w: P.shirt });
    g.stamp(37, 45, ['...ww', '.wwww', '.wwws', '.ww..'], { w: P.shirt, s: P.shirtD });
    // The tie: knot, then a blade that widens, a darker right edge, a light left edge.
    g.stamp(31, 47, ['.KKK.', 'KKKKD', '.KKD.'], { K: P.tie, D: P.tieD });
    for (let y = 50; y < PH; y++) {
      const w = y < 54 ? 1 : 2;
      for (let x = CX - w; x <= CX + w; x++) g.set(x, y, P.tie);
      g.set(CX + w, y, P.tieD);
      g.set(CX - w, y, P.tieL);
    }
  }

  // The face, as a row table of half widths (left, right) from y0.
  function paintFace(g, P, y0, half) {
    half.forEach(([hl, hr], i) => {
      const y = y0 + i;
      for (let x = CX - hl; x <= CX + hr; x++) g.set(x, y, P.S);
      // Shade the right side (light from the left), deeper along the jaw.
      g.set(CX + hr, y, P.s);
      g.set(CX + hr - 1, y, P.s);
      if (i > half.length * 0.45) g.set(CX + hr - 2, y, P.s);
      if (i > half.length * 0.7) {
        g.set(CX + hr, y, P.k);
        g.set(CX - hl, y, P.s);
      }
    });
    // Under the chin.
    const last = half[half.length - 1];
    for (let x = CX - last[0]; x <= CX + last[1]; x++) g.set(x, y0 + half.length, P.k);
  }

  function paintEar(g, P, x, y, right) {
    g.stamp(x, y, right ? ['SS.', 'SsS', 'kss', 'kss', 'ksS', 'kS.', 'k..'] : ['.SS', 'SsS', 'ssS', 'ssS', 'SsS', '.SS', '..S'], { S: right ? P.s : P.S, s: right ? P.k : P.s, k: P.k });
  }

  function paintNeck(g, P) {
    g.rect(27, 40, 13, 8, P.S);
    g.rect(35, 40, 5, 8, P.s);
    g.rect(27, 43, 13, 1, P.k);
    g.rect(28, 44, 11, 1, P.s);
  }

  // Hair shaded in strands: diagonal bands (slope k) with a lit edge and a dark gap, a lit top,
  // a shadow along the hairline. The mass is given as column tops and bottoms from x0.
  function paintHair(g, P, x0, top, bot, opt) {
    const o = Object.assign({ k: 0.7, band: 3, keep: () => true }, opt || {});
    for (let i = 0; i < top.length; i++) {
      const x = x0 + i;
      for (let y = top[i]; y <= bot[i]; y++) {
        if (!o.keep(x, y)) continue;
        const ph = x - y * o.k + 100;
        const t = ph % o.band;
        let c = P.H;
        if (t < 1) c = P.h;
        else if (t >= o.band - 1 && hash(x, y) > 0.35) c = P.d;
        if (y === top[i]) c = P.h;
        if (y >= bot[i] - 1) c = P.d;
        g.set(x, y, c);
      }
    }
  }

  // A clump of hair from its base to its tip, wide at the base: lit on the left, dark on the right.
  function clump(g, P, bx, by, tx, ty, w) {
    const n = Math.max(1, Math.round(Math.hypot(tx - bx, ty - by)));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const cx = Math.round(bx + (tx - bx) * u);
      const cy = Math.round(by + (ty - by) * u);
      const ww = Math.max(1, Math.round(w * (1 - u * 0.5)));
      const a = -Math.floor(ww / 2);
      for (let k = a; k < a + ww; k++) g.set(cx + k, cy, k === a ? P.h : k === a + ww - 1 && ww > 2 ? P.d : P.H);
    }
  }

  const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));
  // Big ears that stick out: the left one lit, the right one in shadow.
  const EAR = ['.SS.', 'SSSs', 'SsSs', 'SesS', 'SesS', 'SsSs', '.SSs', '..Ss', '...s'];
  function paintEars(g, P, xl, xr, y) {
    g.stamp(xl, y, EAR, P);
    g.stamp(xr, y, mirror(EAR), { S: P.s, s: P.k, e: P.k });
  }

  // Sam: dark brown hair in a rounded mass swept up and back, the top lifted, a messy fringe,
  // short full sides; a face widest through the cheekbones, narrowing to a chin that juts a
  // little, so the mouth and chin sit forward; blue-grey eyes; ears out.
  function portraitSam(face) {
    const P = R.FIGHTERS.sam.pal;
    const g = new Grid(PW, PH);
    paintSuit(g, P);
    g.rect(28, 44, 11, 4, P.S);
    g.rect(34, 44, 5, 4, P.s);
    paintEars(g, P, 18, 45, 23);
    const hw = [8, 9, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 11, 11, 10, 10, 9, 9, 8, 8, 8, 7, 7, 6, 5, 4, 2];
    paintFace(g, P, 12, hw.map((w) => [w, w]));
    // Light on the forehead and the cheekbones, a little colour in the cheeks.
    g.rect(26, 16, 4, 1, P.l);
    g.rect(23, 27, 2, 1, P.l);
    g.rect(24, 30, 3, 1, P.r);
    g.rect(40, 30, 3, 1, P.r);
    // Smile lines; the lower lip and chin pushed forward: a shadow under the lip, a lit chin.
    for (const [x, y] of [[28, 33], [27, 34], [27, 35], [38, 33], [39, 34], [39, 35]]) g.set(x, y, P.s);
    g.rect(31, 40, 5, 1, P.s);
    g.rect(31, 42, 3, 1, P.l);
    g.set(32, 43, P.l);
    // Hair: a rounded mass, lifted on top and swept back over to his left, short full sides.
    const tops = [];
    const bots = [];
    for (let x = 19; x <= 47; x++) {
      const side = x <= 21 || x >= 45;
      const b = side ? 21 : x <= 24 || x >= 42 ? 15 : 13;
      const t = Math.round(2 + Math.pow((x - 31) / 15, 2) * 10) - (hash(x, 4) > 0.75 ? 1 : 0);
      tops.push(t);
      bots.push(b);
      for (let y = t; y <= b; y++) g.set(x, y, P.H);
    }
    const topAt = (x) => tops[R.clamp(Math.round(x) - 19, 0, tops.length - 1)];
    // Strands sweeping up and back from the hairline: long light ones, with dark ones between
    // them only low down, where the hair is in shadow.
    for (let sx = 20; sx <= 46; sx += 3) {
      const sy = bots[sx - 19] - 1;
      const ex = sx + 5;
      const ey = topAt(ex) + 1;
      const n = Math.max(1, sy - ey);
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = Math.round(sx + (ex - sx) * u * u);
        const y = Math.round(sy - (sy - ey) * u);
        if (g.get(x, y) === P.H) g.set(x, y, P.h);
        if (u < 0.45 && g.get(x + 1, y) === P.H) g.set(x + 1, y, P.d);
      }
    }
    // A sheen across the lifted top, the hairline in shadow, a messy fringe edge.
    for (let x = 22; x <= 38; x++) {
      const t = topAt(x);
      if (hash(x, 11) > 0.35) g.set(x, t + 1, P.g);
      g.set(x, t, P.h);
    }
    bots.forEach((b, i) => {
      const x = 19 + i;
      if (!(x <= 21 || x >= 45)) g.set(x, b, P.d);
    });
    for (const [x, y] of [[26, 14], [29, 14], [33, 14], [37, 14], [40, 15]]) g.set(x, y, P.H);
    // Brows: fairly straight, the inner ends a touch higher.
    const brow = face === 'hurt' ? [[20, 23, 30], [21, 23, 26]] : [[20, 24, 30], [21, 23, 27]];
    for (const [y, x0, x1] of brow) {
      for (let x = x0; x <= x1; x++) g.set(x, y, P.B);
      for (let x = 66 - 1 - x1; x <= 66 - 1 - x0; x++) g.set(x, y, P.B);
    }
    // Eyes: blue-grey, almond-shaped.
    const eye = {
      '': ['.LLLLL.', 'LwIEIwL', '.sssss.'],
      win: ['.......', '.LLLLL.', 'L.....L'],
      hurt: ['.......', 'LLLLLLL', '.......'],
      ko: ['L...L', '.L.L.', '..L..', '.L.L.', 'L...L'],
    }[face || ''];
    const ko = face === 'ko';
    g.stamp(ko ? 25 : 24, ko ? 21 : 22, eye, P);
    g.stamp(ko ? 37 : 36, ko ? 21 : 22, eye, P);
    // A straight nose with a rounded tip.
    for (let y = 24; y <= 30; y++) g.set(35, y, P.s);
    g.set(33, 31, P.l);
    g.set(30, 32, P.s);
    g.set(36, 32, P.s);
    g.set(31, 33, P.k);
    g.set(35, 33, P.k);
    g.rect(32, 34, 3, 1, P.s);
    // The mouth a little open on the top teeth, a full lower lip.
    const mouth = {
      '': { x: 30, y: 36, rows: ['.MMMMM.', 'MmmmmmM', '.ppppp.'] },
      win: { x: 28, y: 36, rows: ['M.......M', '.MMMMMMM.', '..ppppp..'] },
      hurt: { x: 30, y: 36, rows: ['.MMMMM.', 'MmMmMmM', '.MMMMM.'] },
      ko: { x: 31, y: 36, rows: ['.MMM.', 'MoooM', '.MMM.'] },
    }[face || ''];
    g.stamp(mouth.x, mouth.y, mouth.rows, P);
    return g;
  }

  // Dario, after his caricatures: a big pear-shaped head, wide in the cheeks and jaw; short
  // dark curls round a huge forehead with lines in it; thick black rectangular glasses with
  // small eyes; a big round nose; small full lips; rosy cheeks; ears out.
  function portraitDario(face) {
    const P = R.FIGHTERS.dario.pal;
    const g = new Grid(PW, PH);
    paintSuit(g, P);
    g.rect(26, 45, 15, 4, P.S);
    g.rect(35, 45, 6, 4, P.s);
    paintEars(g, P, 14, 49, 24);
    const hw = [9, 10, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 13, 12, 10, 8, 5];
    paintFace(g, P, 10, hw.map((w) => [w, w]));
    // Jowls and a double chin, rosy cheeks, light on the big forehead.
    for (let y = 37; y <= 45; y++) g.set(18 + Math.max(0, y - 42), y, P.s);
    for (let x = 30; x <= 36; x++) g.set(x, 46, P.s);
    for (let y = 34; y <= 38; y++)
      for (const x0 of [19, 43])
        for (let x = x0; x < x0 + 5; x++) if ((x + y) % 2 === 0 || (y > 34 && y < 38 && x > x0 && x < x0 + 4)) g.set(x, y, P.r);
    g.rect(26, 12, 6, 1, P.l);
    g.rect(25, 13, 3, 1, P.l);
    // Lines across the forehead.
    for (let x = 27; x <= 39; x++) g.set(x, x === 27 || x === 39 ? 15 : 14, P.s);
    for (let x = 28; x <= 38; x++) g.set(x, x === 28 || x === 38 ? 18 : 17, P.s);
    // Hair: short dark curls hugging the head, receding at the temples, down over the ears.
    for (let x = 16; x <= 50; x++) {
      const side = x <= 20 || x >= 46;
      const b = side ? 25 : x <= 23 || x >= 43 ? 10 : 9 + (x > 26 && x < 40 ? 1 : 0);
      const t = Math.round(2 + Math.pow((x - 33) / 17, 2) * 11);
      for (let y = t; y <= b; y++) {
        if (side && y > 22 && ((x >= 14 && x <= 17) || (x >= 49 && x <= 52))) continue;
        g.set(x, y, P.H);
      }
      g.set(x, b, P.d);
    }
    // Bumps along the top: half-curls standing proud of the outline.
    for (let x = 15; x <= 51; x += 3) {
      const t = Math.round(2 + Math.pow((x - 33) / 17, 2) * 11);
      g.set(x, t - 1, P.H);
      g.set(x + 1, t - 1, P.H);
      g.set(x, t - 2, P.d);
    }
    const ring = ['.lL.', 'l..D', 'L..D', '.DD.'];
    for (let cy = -1; cy <= 24; cy += 3)
      for (let cx = 14 + ((cy + 1) % 2 ? 1 : 0); cx <= 51; cx += 3) {
        const ox = cx + Math.floor(hash(cx, cy) * 2);
        const oy = cy + Math.floor(hash(cy, cx) * 2);
        ring.forEach((row, j) => {
          for (let i = 0; i < 4; i++) {
            const ch = row[i];
            if (ch !== '.') g.tint(ox + i, oy + j, ch === 'l' ? P.c : ch === 'L' ? P.h : P.d, [P.H, P.h, P.c, P.d]);
          }
        });
      }
    // Thin brows over thick black rectangular glasses with small eyes behind them.
    g.rect(22, 18, 7, 1, P.B);
    g.set(21, 19, P.B);
    g.set(29, 19, P.B);
    g.rect(38, 18, 7, 1, P.B);
    g.set(37, 19, P.B);
    g.set(45, 19, P.B);
    const eye = {
      '': ['.LLL.', 'wIEIw'],
      win: ['.....', 'L...L', '.LLL.'],
      hurt: ['.....', 'LLLLL'],
      ko: ['L...L', '.L.L.', '..L..', '.L.L.', 'L...L'],
    }[face || ''];
    g.stamp(23, face === 'ko' ? 23 : 25, eye, P);
    g.stamp(39, face === 'ko' ? 23 : 25, eye, P);
    const lens = ['.GGGGGGGGGGG.', 'GGQQQQQQQQQGG', 'GG.........GG', 'G...........G', 'G...........G', 'G...........G', 'G...........G', 'G...........G', 'GG.........GG', '.GGGGGGGGGGG.'];
    const tilt = face === 'ko' ? 1 : 0;
    g.stamp(19, 21, lens, P);
    g.stamp(35, 21 + tilt, lens, P);
    g.rect(32, 23, 3, 2, P.G);
    g.rect(15, 23, 4, 1, P.G);
    g.rect(48, 23 + tilt, 4, 1, P.G);
    for (const [x, y] of [[21, 24], [22, 23], [37, 24 + tilt], [38, 23 + tilt]]) g.set(x, y, P.q);
    // A big round nose.
    g.stamp(29, 31, ['...sss...', '..sSSSs..', '.sSlSSSs.', 'sSlSSSSSs', 'sSSSSSSks', 'sSSSSSkks', '.kSSSSkk.', '..kk.kk..'], P);
    // Small full lips, dimples at the corners.
    const mouth = {
      '': { x: 30, y: 41, rows: ['.MMMMM.', 'MpppppM', 'MpplppM', '.MMMMM.'] },
      win: { x: 28, y: 40, rows: ['M.........M', '.MMMMMMMMM.', '.Mmmmmmmmo.', '..ooooooo..', '...ppppp...'] },
      hurt: { x: 29, y: 41, rows: ['.MMMMMMM.', 'MmMmMmMmM', '.MMMMMMM.'] },
      ko: { x: 31, y: 41, rows: ['.MMM.', 'MoooM', 'MoooM', '.MMM.'] },
    }[face || ''];
    g.stamp(mouth.x, mouth.y, mouth.rows, P);
    if (!face) {
      g.set(28, 42, P.s);
      g.set(38, 42, P.s);
    }
    return g;
  }

  // ---------------------------------------------------------------------------
  // The fighters' heads: hand-drawn, 3/4 view facing right. Letters as in the palettes.
  // ---------------------------------------------------------------------------
  // Sam: a rounded mass of dark brown hair swept back, the face widest through the cheekbones,
  // the chin forward, blue-grey eyes, the top teeth showing, ears out.
  const SAM_HEAD = [
    '........hhHHhh..........',
    '......hgHHHHHHhh........',
    '.....hgHHhHHHhHHh.......',
    '....HgHHhHHHhHHHHd......',
    '...HHHHhHHHhHHHHHdd.....',
    '...HHHhHHHhHHHHhHHdd....',
    '...HHhHHHhHHHHhHHHHdd...',
    '...HHHHHhHHHHhHHHHHdd...',
    '...HHHHHHHHHHHHHHHHdd...',
    '...HHddHdddHddHdddHdd...',
    '...HHSSSSSSSSSSSSSSsd...',
    '...HSSSSSSSSSSSSSSSsd...',
    '...dSSSSSSSSSSSSSSSs....',
    '...SSSBBBBSSSSBBBBSSs...',
    '.SeSSSLLLLSSSSLLLLSSsk..',
    '.SeSSSwIEISSsSIEIwSssk..',
    '.SeSSSSSSSSSsSSSSSSssk..',
    '..SSSrrSSSSlsSSSSrrss...',
    '...SSSSSSSkSSkSSSSss....',
    '...SSSSSSSssssSSSSss....',
    '....SSSSSSMMMMSSSss.....',
    '....sSSSSSMmmMSSSss.....',
    '.....sSSSSSppSSSss......',
    '......sSSSssssSsk.......',
    '.......sSSSlSSsk........',
    '........sSSSSsk.........',
    '.........sSSsk..........',
    '.........kkkk...........',
  ];
  // Dario: a pear-shaped head, a ring of short curls, lines on a big forehead, thick black
  // glasses, a big round nose, rosy cheeks, small full lips, ears out.
  const DARIO_HEAD = [
    '........chc.chH.ccH.........',
    '......chHdchHdchHdchHd......',
    '.....hHdchHdchHdchHdchH.....',
    '....HdchHdchHdchHdchHdch....',
    '...dchHdchHdchHdchHdchHdc...',
    '..chHdchSSSSSSSSSSSsHdchHd..',
    '..HdchHSSSssssssssSSshHdch..',
    '..chHdSSSSSSSSSSSSSSSschHd..',
    '..HdchSSSSSssssssSSSSsHdch..',
    '..chHSSSSSSSSSSSSSSSSSshHd..',
    '..HdcSBBBBBBSSSSBBBBBBsdch..',
    '...hSGGGGGGGGSSGGGGGGGGsH...',
    '...GGGqSSSSSGGGGqSSSSSGGG...',
    '..SeSGSLLLSSGSSGSSLLLSGssk..',
    '..SeSGSIEISSGSSGSSIEISGssk..',
    '..SSSGGGGGGGGSSGGGGGGGGssk..',
    '..SSSSSSSSSSssSSSSSSSSSssk..',
    '...SSSSSSSSsSlSsSSSSSSSss...',
    '...sSrrSSSSsSSSssSSSSrrss...',
    '...sSrSSSSSkSSSkSSSSSSrss...',
    '...sSSSSSSSSkSkSSSSSSSSss...',
    '....sSSSSSSsMMMMsSSSSSss....',
    '.....sSSSSSSMppMSSSSSsk.....',
    '......sSSSSSSppSSSSSsk......',
    '........sSSssssssSsk........',
    '..........sSSSSSsk..........',
    '...........kkkkkk...........',
  ];
  // Expressions patch the maps: [row, column, letters].
  const FACES = {
    sam: {
      hurt: [[14, 6, 'SSSS'], [14, 14, 'SSSS'], [15, 6, 'LLLL'], [15, 14, 'LLLL'], [21, 10, 'MmMm']],
      ko: [[14, 6, 'LSLS'], [14, 14, 'SLSL'], [15, 6, 'SLSS'], [15, 14, 'SSLS'], [20, 10, 'SMMS'], [21, 10, 'MooM'], [22, 11, 'MM']],
      win: [[14, 6, 'SLLS'], [14, 14, 'SLLS'], [15, 6, 'LSSL'], [15, 14, 'LSSL'], [20, 9, 'MMMMMM'], [21, 10, 'mmmm'], [22, 11, 'oo']],
      shout: [[21, 10, 'MooM'], [22, 11, 'MM']],
    },
    dario: {
      hurt: [[13, 7, 'SSS'], [13, 18, 'SSS'], [14, 7, 'LLL'], [14, 18, 'LLL'], [22, 12, 'MmmM']],
      ko: [[13, 7, 'LSL'], [13, 18, 'LSL'], [14, 7, 'SLS'], [14, 18, 'SLS'], [22, 12, 'MooM'], [23, 13, 'MM']],
      win: [[13, 7, 'SSS'], [13, 18, 'SSS'], [14, 7, 'LSL'], [14, 18, 'LSL'], [21, 11, 'MMMMMM'], [22, 12, 'mmmm'], [23, 13, 'oo']],
      shout: [[22, 12, 'MooM'], [23, 13, 'oo']],
    },
  };
  // Where each head sits on the neck (a point in its map).
  const HEAD_AT = { sam: [12, 26], dario: [14, 25] };
  R.FIGHTERS.sam.head = SAM_HEAD;
  R.FIGHTERS.dario.head = DARIO_HEAD;

  // ---------------------------------------------------------------------------
  // The rig. Angles are radians from straight down; positive swings toward the way the fighter
  // faces, so pi/2 is straight ahead and pi is straight up. A pose:
  //   hx, hy   hip offset (px; hy > 0 crouches)      lean   torso tilt forward
  //   fa, ba   front and back arm: [upper, elbow]     fl, bl front and back leg: [thigh, knee]
  //   rot      the whole body turned about the feet (a fall)   face   expression
  // ---------------------------------------------------------------------------
  const LEN = { thigh: 14, shin: 14, upper: 10, fore: 10, torso: 21 };
  const FW = 92; // frame canvas
  const FH = 112;
  const OX = 44; // feet centre inside the frame
  const OY = 106;

  const dir = (a) => [Math.sin(a), Math.cos(a)];

  function joints(p) {
    const lean = p.lean || 0;
    const hip = [p.hx || 0, -(LEN.thigh + LEN.shin) + (p.hy || 0)];
    const neck = [hip[0] + Math.sin(lean) * LEN.torso, hip[1] - Math.cos(lean) * LEN.torso];
    const limb = (base, ang, l1, l2) => {
      const [a1, a2] = ang;
      const d1 = dir(a1);
      const mid = [base[0] + d1[0] * l1, base[1] + d1[1] * l1];
      const d2 = dir(a1 + a2);
      const end = [mid[0] + d2[0] * l2, mid[1] + d2[1] * l2];
      return [base, mid, end];
    };
    // Shoulders sit a little below the neck, front one forward of the spine.
    const sh = (side) => [neck[0] + side * 3 * Math.cos(lean) + Math.sin(lean) * 3, neck[1] + 3 - side * 3 * Math.sin(lean) * 0.3];
    const hp = (side) => [hip[0] + side * 3, hip[1]];
    return {
      hip,
      neck,
      lean,
      fa: limb(sh(1), p.fa || [0.3, 0.2], LEN.upper, LEN.fore),
      ba: limb(sh(-1), p.ba || [0.1, 0.2], LEN.upper, LEN.fore),
      fl: limb(hp(1), p.fl || [0.1, 0], LEN.thigh, LEN.shin),
      bl: limb(hp(-1), p.bl || [-0.1, 0], LEN.thigh, LEN.shin),
    };
  }

  // A thick crisp stroke: a w × w square stamped along the segment.
  function seg(x, a, b, w, col) {
    x.fillStyle = col;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      x.fillRect(Math.round(a[0] + (b[0] - a[0]) * u - w / 2), Math.round(a[1] + (b[1] - a[1]) * u - w / 2), w, w);
    }
  }
  // A limb with a lit edge: the stroke, then a 1 px line along its upper side.
  function limb(x, a, b, w, col, lit) {
    seg(x, a, b, w, col);
    if (!lit) return;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    // The side facing up and forward catches the light.
    let nx = -dy / l;
    let ny = dx / l;
    if (ny > 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const o = (w - 1) / 2;
    seg(x, [a[0] + nx * o, a[1] + ny * o], [b[0] + nx * o, b[1] + ny * o], 1, lit);
  }

  // The jacket, drawn upright once per fighter: 18 wide, 23 tall, the neck at the top centre.
  const torsoCache = {};
  function torsoSprite(f) {
    if (torsoCache[f.id]) return torsoCache[f.id];
    const P = f.pal;
    const g = new Grid(18, 23);
    const half = [6, 7, 8, 8, 8, 8, 8, 8, 7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 7, 7];
    half.forEach((h, y) => {
      for (let x = 9 - h; x <= 8 + h; x++) g.set(x, y, P.top);
      g.set(9 - h, y, P.topD);
      g.set(8 + h, y, P.topL);
    });
    // Shirt V and tie; lapel edges; the jacket's front opening and a button; the hem.
    for (let y = 0; y <= 9; y++) {
      const w = Math.max(0, 3 - Math.floor(y / 3));
      for (let x = 9 - w; x <= 9 + w; x++) g.set(x, y, P.shirt);
      g.set(9 - w - 1, y, P.topL);
      g.set(9 + w + 1, y, P.topL);
    }
    for (let y = 1; y <= 16; y++) {
      g.set(9, y, P.tie);
      if (y > 3) g.set(10, y, P.tieD);
    }
    g.set(8, 1, P.tie);
    g.set(10, 1, P.tieD);
    for (let y = 10; y <= 20; y++) g.set(11, y, P.topD);
    g.set(12, 14, P.topD);
    g.set(12, 18, P.topD);
    g.rect(2, 21, 14, 1, P.topD);
    // Shirt collar points either side of the knot.
    g.set(7, 0, P.shirt);
    g.set(11, 0, P.shirt);
    torsoCache[f.id] = g.canvas();
    return torsoCache[f.id];
  }

  function headCanvas(f, face) {
    const rows = f.head.slice();
    for (const [r, col, str] of (face && FACES[f.id][face]) || []) rows[r] = rows[r].slice(0, col) + str + rows[r].slice(col + str.length);
    return R.sprite(rows, f.pal).c;
  }

  // Render one pose of one fighter into a fresh outlined canvas. Returns { c, ox, oy }. A pose
  // turned over (a fall) gets a wider canvas, with room behind the feet for the body.
  function render(f, p) {
    const wide = Math.abs(p.rot || 0) > 0.5;
    const fw = wide ? FW + 44 : FW;
    const ox = wide ? OX + 44 : OX;
    const cv = R.canvas(fw, FH);
    const x = cv.x;
    x.imageSmoothingEnabled = false;
    const P = f.pal;
    const J = joints(p);
    x.save();
    x.translate(ox, OY);
    if (p.rot) x.rotate(p.rot);
    if (p.dy) x.translate(0, p.dy);
    const shoe = (L, front) => {
      const fx = Math.round(L[2][0]);
      const fy = Math.round(L[2][1]);
      x.fillStyle = front ? P.shoe : P.sole;
      x.fillRect(fx - 3, fy - 1, 9, 3);
      x.fillStyle = front ? P.shoeL : P.shoe;
      x.fillRect(fx - 2, fy - 1, 6, 1);
      x.fillStyle = P.sole;
      x.fillRect(fx - 3, fy + 2, 9, 1);
    };
    const leg = (L, front) => {
      limb(x, L[0], L[1], 6, front ? P.legs : P.legsD, front ? P.legsL : null);
      limb(x, L[1], L[2], 5, front ? P.legs : P.legsD, front ? P.legsL : null);
      shoe(L, front);
    };
    const arm = (A, front) => {
      limb(x, A[0], A[1], 5, front ? P.top : P.topD, front ? P.topL : null);
      limb(x, A[1], A[2], 4, front ? P.top : P.topD, front ? P.topL : null);
      // A white cuff, then the fist.
      const hx = Math.round(A[2][0]);
      const hy = Math.round(A[2][1]);
      const dx = A[2][0] - A[1][0];
      const dy = A[2][1] - A[1][1];
      const l = Math.hypot(dx, dy) || 1;
      x.fillStyle = front ? P.shirt : P.shirtD;
      x.fillRect(Math.round(A[2][0] - (dx / l) * 3) - 1, Math.round(A[2][1] - (dy / l) * 3) - 1, 2, 2);
      x.fillStyle = front ? P.S : P.s;
      x.fillRect(hx - 2, hy - 2, 5, 5);
      x.fillStyle = front ? P.s : P.k;
      x.fillRect(hx - 2, hy + 2, 5, 1);
      x.fillRect(hx + 2, hy - 2, 1, 5);
    };
    // Back limbs first, in the darker shades.
    arm(J.ba, false);
    leg(J.bl, false);
    // The jacket, leaning with the spine (rotated about the neck).
    x.save();
    x.translate(J.neck[0], J.neck[1]);
    x.rotate(J.lean);
    x.drawImage(torsoSprite(f), -9, -1);
    x.restore();
    leg(J.fl, true);
    // Head on the neck, tilted with the torso.
    const hc = headCanvas(f, p.face);
    const n = J.neck;
    const ls = Math.sin(J.lean);
    x.save();
    x.translate(Math.round(n[0] + ls * 2), Math.round(n[1] - 1));
    if (p.tilt) x.rotate(p.tilt);
    const [ax, ay] = HEAD_AT[f.id];
    x.drawImage(hc, -ax, -ay);
    x.restore();
    arm(J.fa, true);
    x.restore();
    return { c: R.outlined(cv.c, '#0b0910'), ox: ox + 1, oy: OY + 5 };
  }

  // ---------------------------------------------------------------------------
  // Animations: key poses, shown one after another (no tweening).
  // ---------------------------------------------------------------------------
  const STANCE = { hy: 3, lean: 0.12, fa: [0.95, 1.65], ba: [0.55, 2.0], fl: [0.38, -0.5], bl: [-0.38, 0.28] };
  const P = (o) => Object.assign({}, STANCE, o);
  R.ANIMS = {
    idle: [P({}), P({ hy: 4, fa: [0.9, 1.7], ba: [0.5, 2.05] })],
    walk: [
      P({ fl: [0.55, -0.4], bl: [-0.2, 0.15] }),
      P({ hy: 2, fl: [0.2, -0.2], bl: [-0.05, -0.3] }),
      P({ fl: [-0.05, -0.1], bl: [0.4, -0.5] }),
      P({ hy: 2, fl: [0.3, -0.6], bl: [-0.35, 0.1] }),
    ],
    jab: [P({ lean: 0.18, fa: [0.6, 1.9] }), P({ lean: 0.28, hx: 2, fa: [1.55, 0.05], ba: [0.4, 2.1], face: 'shout' }), P({ lean: 0.2, fa: [1.2, 0.8] })],
    kick: [
      P({ lean: -0.05, fl: [0.9, -1.5], bl: [-0.1, 0.1], fa: [0.7, 1.5] }),
      P({ lean: -0.3, hy: 1, fl: [1.5, 0.05], bl: [-0.15, 0.1], fa: [-0.4, 1.0], ba: [-0.8, 1.2], face: 'shout' }),
      P({ lean: -0.1, fl: [0.8, -1.0], bl: [-0.15, 0.1] }),
    ],
    jump: [P({ hy: -2, fl: [0.9, -1.7], bl: [0.4, -1.5], fa: [2.2, 0.6], ba: [2.0, 0.6] }), P({ hy: 0, fl: [0.5, -1.0], bl: [0.1, -0.8] })],
    jumpkick: [P({ lean: -0.25, fl: [1.35, 0.15], bl: [0.4, -1.6], fa: [-0.3, 1.2], ba: [-0.6, 1.0], face: 'shout' })],
    hit: [P({ lean: -0.45, tilt: -0.25, fa: [-0.6, 0.4], ba: [-0.9, 0.5], face: 'hurt' }), P({ lean: -0.3, tilt: -0.15, fa: [-0.3, 0.6], face: 'hurt' })],
    block: [P({ hy: 5, lean: -0.08, fa: [1.25, 1.45], ba: [1.05, 1.55], fl: [0.45, -0.7], bl: [-0.45, 0.3] })],
    throw: [P({ lean: 0.0, fa: [-0.7, 1.0], ba: [0.8, 1.5] }), P({ lean: 0.32, hx: 2, fa: [1.55, -0.05], ba: [0.2, 1.0], face: 'shout' }), P({ lean: 0.25, fa: [1.4, 0.2] })],
    super: [P({ hy: 4, lean: -0.15, fa: [-1.1, 0.4], ba: [-1.3, 0.3], face: 'shout' }), P({ hy: 2, lean: -0.2, fa: [2.8, 0.1], ba: [2.6, 0.2], face: 'shout' })],
    win: [P({ hy: 0, lean: -0.05, fa: [1.95, 1.05], ba: [0.2, 0.5], fl: [0.2, -0.2], bl: [-0.2, 0.1], face: 'win' }), P({ hy: 1, lean: -0.05, fa: [2.05, 1.0], ba: [0.25, 0.5], fl: [0.2, -0.2], bl: [-0.2, 0.1], face: 'win' })],
    fist: [P({ hy: 0, lean: 0, fa: [1.9, 1.1], ba: [0.15, 0.3], fl: [0.12, 0], bl: [-0.12, 0] })],
    stand: [P({ hy: 0, lean: 0, fa: [0.15, 0.1], ba: [-0.1, 0.1], fl: [0.12, 0], bl: [-0.12, 0] })],
    dazed: [P({ hy: 2, lean: -0.15, tilt: -0.2, fa: [0.2, 0.2], ba: [-0.1, 0.3], face: 'ko' }), P({ hy: 3, lean: 0.1, tilt: 0.15, fa: [0.3, 0.2], ba: [0.05, 0.3], face: 'ko' })],
    ko: [
      P({ lean: -0.5, tilt: -0.3, fa: [-0.8, 0.5], ba: [-1.0, 0.6], face: 'ko' }),
      P({ rot: -0.9, lean: -0.3, fa: [-1.2, 0.3], ba: [-1.5, 0.3], fl: [0.6, -0.3], bl: [0.2, 0.0], face: 'ko' }),
      P({ rot: -1.5, dy: -4, hy: 0, lean: 0, fa: [-2.6, 0.1], ba: [-2.9, 0.2], fl: [0.2, 0], bl: [-0.1, 0], face: 'ko' }),
    ],
  };

  const cache = new Map();
  // One cached frame: { c, ox, oy } (the feet centre inside c).
  R.fighterFrame = function (id, anim, i) {
    const frames = R.ANIMS[anim] || R.ANIMS.idle;
    const k = ((i % frames.length) + frames.length) % frames.length;
    const key = id + ':' + anim + ':' + k;
    let s = cache.get(key);
    if (!s) {
      s = render(R.FIGHTERS[id], frames[k]);
      cache.set(key, s);
    }
    return s;
  };
  // The select-screen portrait: 66×74, painted at 1:1.
  R.fighterPortrait = function (id, face) {
    const key = id + ':portrait:' + (face || '');
    let s = cache.get(key);
    if (!s) {
      const g = id === 'sam' ? portraitSam(face) : portraitDario(face);
      s = { c: R.outlined(g.canvas(), '#0b0910') };
      cache.set(key, s);
    }
    return s;
  };

  // ---------------------------------------------------------------------------
  // Projectiles. Sam's: a pop-up ad. Dario's: a TV playing a big-game ad that opens on one word.
  // ---------------------------------------------------------------------------
  R.AD = R.sprite(
    [
      'kkkkkkkkkkkkkkkk',
      'kbbbbbbbbbbbrrxk',
      'kbbbbbbbbbbbrrxk',
      'kwwwwwwwwwwwwwwk',
      'kwyyyyyyyyyyyywk',
      'kwyRRRwwRRRRwywk',
      'kwyRwRwwRwwRwywk',
      'kwyRRRwwRwwRwywk',
      'kwyRwRwwRRRRwywk',
      'kwyyyyyyyyyyyywk',
      'kwwwgggggggwwwwk',
      'kwwwgwwwwwgwwwwk',
      'kwwwgggggggwwwwk',
      'kkkkkkkkkkkkkkkk',
    ],
    { k: '#141826', b: '#3a7bff', r: '#ff4d6d', x: '#ffffff', w: '#f4f6fb', y: '#ffd84d', R: '#e0233e', g: '#2ecc71', glow: 'ryRg' },
  );
  R.TV = (function () {
    const cv = R.canvas(20, 17);
    const x = cv.x;
    const g = R.canvas(22, 19);
    x.fillStyle = '#141826';
    for (const [ax, dx] of [[6, -1], [13, 1]]) for (let i = 0; i < 3; i++) x.fillRect(ax + dx * i, i, 1, 1);
    x.fillStyle = '#6b513b';
    x.fillRect(0, 3, 20, 13);
    x.fillStyle = '#8a6a4c';
    x.fillRect(0, 3, 20, 1);
    x.fillStyle = '#2a2f3f';
    x.fillRect(2, 5, 13, 9);
    x.fillStyle = '#e6eeff';
    x.fillRect(3, 6, 11, 7);
    R.text(x, 'AD', 5, 7, { font: 'small', color: '#2a2f3f' });
    x.fillStyle = '#ff2a3d';
    for (let i = 0; i < 7; i++) x.fillRect(4 + Math.round(i * 1.4), 6 + i, 2, 1);
    x.fillStyle = '#ff9a2f';
    x.fillRect(16, 6, 2, 2);
    x.fillStyle = '#2a2f3f';
    x.fillRect(16, 10, 2, 1);
    x.fillRect(16, 12, 2, 1);
    x.fillStyle = '#141826';
    x.fillRect(2, 16, 3, 1);
    x.fillRect(15, 16, 3, 1);
    const c = R.outlined(cv.c, '#0b0910');
    g.x.fillStyle = '#9fc4ff';
    g.x.fillRect(4, 7, 11, 7);
    return { c, g: g.c, w: c.width, h: c.height };
  })();
})();
