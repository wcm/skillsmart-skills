/* Flappy Roadster · zones: four procedural pixel worlds — Giga City, Skyway, Low Orbit, Mars.
   Every layer is baked once into a seamless 2-screen strip plus an emissive twin for the bloom. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const G = R.GROUND;
  const STRIP = W * 2;

  const vgrad = R.vgrad;
  const disc = R.disc;
  const softGlow = R.softGlow;

  // Draw a seamless strip with parallax. Both canvases share the offset.
  function strip(b, gl, L, dist) {
    const off = -Math.floor((dist * L.f) % STRIP);
    for (let k = 0; k < 2; k++) {
      const x = off + k * STRIP;
      if (x > W || x + STRIP < 0) continue;
      b.drawImage(L.c, x, L.y);
      if (gl && L.g) gl.drawImage(L.g, x, L.y);
    }
  }
  const wrapX = (x, dist, f) => {
    let v = (x - dist * f) % STRIP;
    if (v < -40) v += STRIP;
    return v;
  };

  const NEON = ['#2ef6ff', '#ff3fd2', '#ffd93b', '#7dff6b', '#9b6bff', '#ff7a2f'];
  const SIGN_WORDS = ['EV', 'BAR', '24H', 'ZAP', 'VOLT', 'HOTEL', 'RAMEN', 'KWH', 'OPEN', 'AMP', 'ION', 'NEON', 'TAXI', 'DOJO', 'WATT', 'SUSHI', 'BOT', 'GIGA'];

  // ---------- a neon building ----------
  function building(cv, gv, rnd, x, y, w, h, o) {
    const X = cv.x;
    const Gx = gv.x;
    X.fillStyle = o.body;
    X.fillRect(x, y, w, h);
    // Rim light: magenta on one side, cyan on the other.
    X.fillStyle = o.rimL;
    X.fillRect(x, y, 1, h);
    X.fillStyle = o.rimR;
    X.fillRect(x + w - 1, y, 1, h);
    X.fillStyle = o.top;
    X.fillRect(x, y, w, 1);
    // Roof furniture.
    if (rnd() < 0.55) {
      const ax = x + rnd.int(1, Math.max(1, w - 2));
      const ah = rnd.int(3, o.antenna);
      X.fillStyle = o.top;
      X.fillRect(ax, y - ah, 1, ah);
      o.blink.push({ x: ax, y: y - ah - 1, p: rnd() * 6, col: rnd() < 0.8 ? '#ff2a3d' : '#ffffff' });
    }
    if (rnd() < 0.4 && w > 8) {
      const bw = rnd.int(3, Math.min(8, w - 3));
      const bh = rnd.int(2, 4);
      X.fillStyle = o.body;
      X.fillRect(x + rnd.int(1, w - bw - 1), y - bh, bw, bh);
    }
    // Windows.
    const wx = o.winW + o.winGapX;
    const wy = o.winH + o.winGapY;
    const palette = o.win;
    for (let yy = y + 2; yy < y + h - 2; yy += wy) {
      const rowLit = rnd() < 0.85;
      for (let xx = x + 2; xx + o.winW <= x + w - 2; xx += wx) {
        if (!rowLit || rnd() > o.lit) continue;
        const col = palette[Math.floor(rnd() * palette.length)];
        X.fillStyle = col;
        X.fillRect(xx, yy, o.winW, o.winH);
        Gx.globalAlpha = o.winGlow;
        Gx.fillStyle = col;
        Gx.fillRect(xx, yy, o.winW, o.winH);
        Gx.globalAlpha = 1;
      }
    }
    // Neon signs.
    if (o.signs && rnd() < o.signs && h > 34) {
      const word = SIGN_WORDS[Math.floor(rnd() * SIGN_WORDS.length)];
      const col = NEON[Math.floor(rnd() * NEON.length)];
      const vertical = rnd() < 0.6;
      if (vertical) {
        const sx = rnd() < 0.5 ? x - 2 : x + w - 3;
        const sy = y + rnd.int(4, Math.max(5, Math.min(30, h - word.length * 6 - 4)));
        X.fillStyle = '#0b0614';
        X.fillRect(sx, sy, 5, word.length * 6 + 1);
        for (let i = 0; i < word.length; i++) {
          R.text(X, word[i], sx + 1, sy + 1 + i * 6, { font: 'small', color: col });
          R.text(Gx, word[i], sx + 1, sy + 1 + i * 6, { font: 'small', color: col });
        }
        o.signsOut.push({ x: sx, y: sy, w: 5, h: word.length * 6 + 1 });
      } else if (w > R.measure(word, { font: 'small' }) + 4) {
        const tw = R.measure(word, { font: 'small' });
        const sx = x + Math.floor((w - tw) / 2) - 2;
        const sy = y + rnd.int(3, Math.min(20, h - 12));
        X.fillStyle = '#0b0614';
        X.fillRect(sx, sy, tw + 4, 9);
        X.fillStyle = col;
        X.fillRect(sx, sy, tw + 4, 1);
        X.fillRect(sx, sy + 8, tw + 4, 1);
        Gx.fillStyle = col;
        Gx.fillRect(sx, sy, tw + 4, 1);
        Gx.fillRect(sx, sy + 8, tw + 4, 1);
        R.text(X, word, sx + 2, sy + 2, { font: 'small', color: col });
        R.text(Gx, word, sx + 2, sy + 2, { font: 'small', color: col });
        o.signsOut.push({ x: sx, y: sy, w: tw + 4, h: 9 });
      }
    }
  }

  function skyline(seed, h, o) {
    const rnd = R.rng(seed);
    const cv = R.canvas(STRIP, h);
    const gv = R.canvas(STRIP, h);
    o.blink = [];
    o.signsOut = [];
    let x = -4;
    const items = [];
    while (x < STRIP) {
      const w = rnd.int(o.minW, o.maxW);
      const bh = rnd.int(o.minH, o.maxH);
      items.push([x, h - bh, w, bh, rnd() * 1e9]);
      x += w + rnd.int(o.gapMin, o.gapMax);
    }
    for (const [bx, by, bw, bh, s] of items) {
      // Draw twice across the seam so the strip tiles.
      for (const dx of [0, -STRIP, STRIP]) {
        if (bx + dx + bw < -12 || bx + dx > STRIP + 12) continue;
        building(cv, gv, R.rng(s), bx + dx, by, bw, bh, o);
      }
    }
    // Atmospheric haze, thicker low down.
    if (o.fog) {
      cv.x.globalCompositeOperation = 'source-atop';
      for (let y = 0; y < h; y++) {
        cv.x.fillStyle = R.rgb(R.hex(o.fog), o.fogA * (0.45 + 0.55 * (y / h)));
        cv.x.fillRect(0, y, STRIP, 1);
      }
      cv.x.globalCompositeOperation = 'source-over';
    }
    return { c: cv.c, g: gv.c, blink: o.blink.filter((b) => b.x >= 0 && b.x < STRIP), signs: o.signsOut.filter((b) => b.x >= 0 && b.x < STRIP) };
  }

  // ---------- pipe textures ----------
  // Each zone gives 4 kinds × 4 hues; each a vertical tile + a cap, with emissive twins.
  const PW = R.PIPE_W;
  const CW = R.CAP_W;
  const CH = R.CAP_H;
  const TILE = 32;

  function pipeSet(make) {
    const cache = new Map();
    return function (kind, hue) {
      const k = kind + ':' + hue;
      let t = cache.get(k);
      if (!t) {
        const body = R.canvas(PW, TILE);
        const bodyG = R.canvas(PW, TILE);
        const cap = R.canvas(CW, CH);
        const capG = R.canvas(CW, CH);
        make(kind, hue, body, bodyG, cap, capG, R.rng(kind * 97 + hue * 13 + 7));
        t = { body: body.c, bodyG: bodyG.c, cap: cap.c, capG: capG.c };
        cache.set(k, t);
      }
      return t;
    };
  }

  // Draw a pipe pair (or the bottom only) from textures. Tiles are anchored at the cap so
  // moving pipes don't slide their windows.
  function drawPipeTex(b, gl, tex, p, top, bot) {
    const x = Math.round(p.x);
    if (!p.smashTop && !p.noTop) {
      const capY = Math.round(top - CH);
      for (let y = capY - TILE; y > -TILE; y -= TILE) {
        b.drawImage(tex.body, x, y);
        gl.drawImage(tex.bodyG, x, y);
      }
      b.save();
      b.translate(x - 2, capY + CH);
      b.scale(1, -1);
      b.drawImage(tex.cap, 0, 0);
      b.restore();
      gl.save();
      gl.translate(x - 2, capY + CH);
      gl.scale(1, -1);
      gl.drawImage(tex.capG, 0, 0);
      gl.restore();
    }
    if (!p.smashBot) {
      const capY = Math.round(bot);
      for (let y = capY + CH; y < G; y += TILE) {
        const hgt = Math.min(TILE, G - y);
        b.drawImage(tex.body, 0, 0, PW, hgt, x, y, PW, hgt);
        gl.drawImage(tex.bodyG, 0, 0, PW, hgt, x, y, PW, hgt);
      }
      b.drawImage(tex.cap, x - 2, capY);
      gl.drawImage(tex.capG, x - 2, capY);
    }
  }

  // The first obstacle of every lap: the five Teslas from the unveil, stacked.
  function drawStack(b, gl, p, bot) {
    let y = G;
    const x = Math.round(p.x) - 1;
    for (let i = 0; i < R.STACK.length && y > bot; i++) {
      const s = R.STACK[i];
      y -= s.h;
      b.drawImage(s.c, x, y);
      gl.drawImage(s.g, x, y);
    }
    // A ramp of light on top, like the event's red runway lines.
    b.fillStyle = '#ff2a3d';
    b.fillRect(x + 2, Math.round(bot) - 1, 26, 1);
    gl.fillStyle = '#ff2a3d';
    gl.fillRect(x + 2, Math.round(bot) - 1, 26, 1);
  }
  R.stackHeight = () => R.STACK.reduce((a, s) => a + s.h, 0);

  // ======================================================================
  // ZONE 1 · GIGA CITY
  // ======================================================================
  const city = {
    id: 'city',
    name: 'GIGA CITY',
    sub: 'NEON DISTRICT · NIGHT',
    ambient: 'rain',
    reflect: true,
    build() {
      this.sky = R.canvas(W, H);
      vgrad(this.sky.x, 0, G, [
        [0, '#05020f'],
        [0.35, '#0e0627'],
        [0.7, '#2a0b45'],
        [0.88, '#4a0f55'],
        [1, '#701660'],
      ]);
      const rnd = R.rng(11);
      this.stars = [];
      for (let i = 0; i < 46; i++) this.stars.push({ x: rnd() * W, y: rnd() * 150, p: rnd() * 6, b: rnd() < 0.2 });
      // Building heights leave the moon a clear sky above the mid-rise.
      this.far = skyline(101, 154, {
        minW: 10, maxW: 24, minH: 49, maxH: 143, gapMin: -2, gapMax: 2, antenna: 12,
        body: '#170b2e', rimL: '#2a1450', rimR: '#1d1040', top: '#2c1652',
        win: ['#ff4fd8', '#46e6ff', '#ffcf6b', '#8f7dff'], winW: 1, winH: 1, winGapX: 2, winGapY: 2, lit: 0.16, winGlow: 0.25,
        signs: 0.15, fog: '#3a0f4f', fogA: 0.58,
      });
      this.far.f = 0.06;
      this.far.y = G - 154;
      this.mid = skyline(202, 191, {
        minW: 16, maxW: 34, minH: 57, maxH: 183, gapMin: 1, gapMax: 10, antenna: 16,
        body: '#100720', rimL: '#3b1460', rimR: '#123a5a', top: '#2b1650',
        win: ['#ffd27a', '#7ff2ff', '#ff6be0', '#ffffff', '#b9a5ff'], winW: 2, winH: 1, winGapX: 2, winGapY: 3, lit: 0.2, winGlow: 0.32,
        signs: 0.45, fog: '#2a0a3d', fogA: 0.4,
      });
      this.mid.f = 0.16;
      this.mid.y = G - 191;
      this.near = skyline(303, 78, {
        minW: 22, maxW: 46, minH: 15, maxH: 68, gapMin: 2, gapMax: 16, antenna: 10,
        body: '#0a0513', rimL: '#4a1a6e', rimR: '#0f3a52', top: '#24123e',
        win: ['#ffcf6b', '#5ff0ff', '#ff4fd8'], winW: 2, winH: 2, winGapX: 3, winGapY: 4, lit: 0.12, winGlow: 0.6,
        signs: 0.35, fog: null,
      });
      this.near.f = 0.38;
      this.near.y = G - 78;
      this.blimpX = 40;
      this.ticker = 0;
      this.traffic = [];
      for (let i = 0; i < 7; i++) this.traffic.push(this.newCar(R.fx() * W * 1.4));
    },
    newCar(x) {
      const lanes = [G - 177, G - 154, G - 133, G - 110, G - 89];
      const lane = lanes[Math.floor(R.fx() * lanes.length)];
      const dir = R.fx() < 0.62 ? 1 : -1;
      return { x: x != null ? x : dir > 0 ? -20 : W + 20, y: lane + R.fx() * 3, v: dir * (14 + R.fx() * 36), s: Math.floor(R.fx() * R.TRAFFIC.length), d: 0.25 + R.fx() * 0.2 };
    },
    update(dt, speed) {
      this.blimpX += dt * (6 - speed * 0.05);
      if (this.blimpX < -80) this.blimpX = W + 40;
      if (this.blimpX > W + 80) this.blimpX = -70;
      this.ticker += dt * 22;
      for (const c of this.traffic) {
        c.x += (c.v - speed * c.d) * dt;
        if (c.x < -40 || c.x > W + 40) Object.assign(c, this.newCar());
      }
    },
    drawBack(b, gl, dist, t) {
      b.drawImage(this.sky.c, 0, 0);
      for (const s of this.stars) {
        const tw = Math.sin(t * 2 + s.p) > 0.6;
        b.fillStyle = tw ? '#ffffff' : '#7b6aa8';
        b.fillRect(s.x | 0, s.y | 0, 1, 1);
        if (s.b && tw) {
          gl.fillStyle = '#ffffff';
          gl.fillRect(s.x | 0, s.y | 0, 1, 1);
        }
      }
      // Moon with a magenta halo.
      softGlow(gl, 168, 70, 30, '#ff4fd8', 0.45);
      disc(b, 168, 70, 15, '#f3e6ff');
      disc(b, 163, 66, 3, '#d9c3f0');
      disc(b, 172, 76, 2, '#d9c3f0');
      disc(b, 173, 64, 1, '#e3d1f7');
      disc(gl, 168, 70, 15, '#3a2a4a');
      // Searchlights sweeping.
      for (let i = 0; i < 2; i++) {
        const bx = wrapX(90 + i * 230, dist, 0.16);
        const a = -Math.PI / 2 + Math.sin(t * 0.5 + i * 2.1) * 0.5;
        const len = 300;
        const sp = 0.06;
        gl.globalAlpha = 0.18;
        gl.fillStyle = '#b48cff';
        gl.beginPath();
        gl.moveTo(bx, G - 120);
        gl.lineTo(bx + Math.cos(a - sp) * len, G - 120 + Math.sin(a - sp) * len);
        gl.lineTo(bx + Math.cos(a + sp) * len, G - 120 + Math.sin(a + sp) * len);
        gl.fill();
        gl.globalAlpha = 1;
      }
      strip(b, gl, this.far, dist);
      this.drawBlinks(b, gl, this.far, dist, t);
      if (!R.hideBlimp) this.drawBlimp(b, gl, t);
      strip(b, gl, this.mid, dist);
      this.drawBlinks(b, gl, this.mid, dist, t);
      this.drawFlicker(b, gl, this.mid, dist, t);
      for (const c of this.traffic) {
        const s = R.TRAFFIC[c.s];
        const x = Math.round(c.x);
        const y = Math.round(c.y);
        if (c.v > 0) {
          b.drawImage(s.c, x, y);
          gl.drawImage(s.g, x, y);
        } else {
          b.save();
          b.translate(x + s.w, y);
          b.scale(-1, 1);
          b.drawImage(s.c, 0, 0);
          b.restore();
          gl.save();
          gl.translate(x + s.w, y);
          gl.scale(-1, 1);
          gl.drawImage(s.g, 0, 0);
          gl.restore();
        }
        // Tail-light streak.
        gl.globalAlpha = 0.35;
        gl.fillStyle = '#ff2a6d';
        gl.fillRect(c.v > 0 ? x - 8 : x + s.w, y + 2, 8, 1);
        gl.globalAlpha = 1;
      }
      strip(b, gl, this.near, dist);
      this.drawBlinks(b, gl, this.near, dist, t);
    },
    drawBlinks(b, gl, L, dist, t) {
      for (const k of L.blink) {
        if (Math.sin(t * 2.4 + k.p) < 0.55) continue;
        const x = Math.round(wrapX(k.x, dist, L.f));
        const y = L.y + k.y;
        b.fillStyle = k.col;
        b.fillRect(x, y, 1, 1);
        gl.fillStyle = k.col;
        gl.fillRect(x - 1, y, 3, 1);
        gl.fillRect(x, y - 1, 1, 3);
      }
    },
    drawFlicker(b, gl, L, dist, t) {
      for (let i = 0; i < L.signs.length; i++) {
        const s = L.signs[i];
        const n = Math.sin(t * 13 + i * 7.3) + Math.sin(t * 3.1 + i);
        if (n < 1.55) continue;
        const x = Math.round(wrapX(s.x, dist, L.f));
        b.fillStyle = '#0b0614';
        b.fillRect(x, L.y + s.y, s.w, s.h);
        gl.fillStyle = '#000';
        gl.fillRect(x, L.y + s.y, s.w, s.h);
      }
    },
    drawBlimp(b, gl, t) {
      const x = Math.round(this.blimpX);
      const y = G - 113 + Math.round(Math.sin(t * 0.6) * 2);
      // Hull.
      b.fillStyle = '#06030c';
      b.beginPath();
      b.ellipse(x + 30, y + 9, 31, 10, 0, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = '#2e2350';
      b.beginPath();
      b.ellipse(x + 30, y + 9, 30, 9, 0, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = '#4b3a7e';
      b.fillRect(x + 10, y + 1, 40, 1);
      b.fillStyle = '#ff3fd2';
      b.fillRect(x + 12, y + 17, 36, 1);
      gl.fillStyle = '#ff3fd2';
      gl.fillRect(x + 12, y + 17, 36, 1);
      b.fillStyle = '#120c20';
      b.fillRect(x + 22, y + 18, 16, 3);
      b.fillStyle = '#1d1430';
      b.fillRect(x - 2, y + 4, 5, 10);
      // Ticker screen.
      const sx = x + 9;
      const sy = y + 5;
      const sw = 42;
      b.fillStyle = '#050208';
      b.fillRect(sx, sy, sw, 9);
      const msgs = R.TICKER;
      const full = msgs.join('   ·   ') + '   ·   ';
      const tw = R.measure(full, { font: 'small' });
      const off = this.ticker % tw;
      b.save();
      b.beginPath();
      b.rect(sx, sy, sw, 9);
      b.clip();
      gl.save();
      gl.beginPath();
      gl.rect(sx, sy, sw, 9);
      gl.clip();
      for (const k of [0, tw]) {
        R.text(b, full, sx + sw - off + k - tw, sy + 2, { font: 'small', color: '#ffe14d' });
        R.text(gl, full, sx + sw - off + k - tw, sy + 2, { font: 'small', color: '#a8901f' });
      }
      b.restore();
      gl.restore();
      b.fillStyle = '#ff2a3d';
      if (Math.sin(t * 4) > 0) {
        b.fillRect(x + 2, y + 9, 1, 1);
        gl.fillStyle = '#ff2a3d';
        gl.fillRect(x + 1, y + 9, 3, 1);
      }
    },
    ground(b, gl, dist, t) {
      // Curb, sidewalk, then a wet road (the reflection is added by the renderer).
      b.fillStyle = '#1a0f2e';
      b.fillRect(0, G, W, 5);
      b.fillStyle = '#120a22';
      const o = Math.floor(dist % 12);
      for (let x = -o; x < W; x += 12) b.fillRect(x, G + 1, 1, 4);
      b.fillStyle = '#3ff3ff';
      b.fillRect(0, G, W, 1);
      gl.fillStyle = '#2ad8e6';
      gl.fillRect(0, G, W, 1);
      b.fillStyle = '#07040d';
      b.fillRect(0, G + 5, W, 1);
      b.fillStyle = '#0c0717';
      b.fillRect(0, G + 6, W, H - G - 6);
    },
    groundTop(b, gl, dist, t) {
      // Lane dashes and puddle glints over the reflection.
      const o = Math.floor(dist % 26);
      for (let x = -o; x < W; x += 26) {
        b.fillStyle = '#d9b23a';
        b.fillRect(x, G + 36, 9, 1);
        gl.globalAlpha = 0.4;
        gl.fillStyle = '#d9b23a';
        gl.fillRect(x, G + 36, 9, 1);
        gl.globalAlpha = 1;
      }
    },
    pipe: pipeSet((kind, hue, body, bodyG, cap, capG, rnd) => {
      const neon = ['#2ef6ff', '#ff3fd2', '#ffd93b', '#7dff6b'][hue];
      const dim = R.rgb(R.mix(neon, '#0d0718', 0.55));
      const X = body.x;
      const Gx = bodyG.x;
      // Tower body: dark steel, neon rims, a window grid; kinds vary the facade.
      X.fillStyle = '#05030a';
      X.fillRect(0, 0, PW, TILE);
      X.fillStyle = '#140c26';
      X.fillRect(1, 0, PW - 2, TILE);
      X.fillStyle = '#1f1638';
      X.fillRect(4, 0, PW - 8, TILE);
      X.fillStyle = neon;
      X.fillRect(1, 0, 2, TILE);
      X.fillStyle = dim;
      X.fillRect(PW - 3, 0, 2, TILE);
      Gx.fillStyle = neon;
      Gx.fillRect(1, 0, 2, TILE);
      Gx.globalAlpha = 0.45;
      Gx.fillRect(PW - 3, 0, 2, TILE);
      Gx.globalAlpha = 1;
      if (kind === 0 || kind === 3) {
        for (let y = 2; y < TILE; y += 4)
          for (let x = 6; x < PW - 6; x += 4) {
            const lit = rnd() < 0.3;
            X.fillStyle = lit ? (rnd() < 0.7 ? '#ffd88a' : neon) : '#120a22';
            X.fillRect(x, y, 2, 2);
            if (lit) {
              Gx.globalAlpha = 0.6;
              Gx.fillStyle = X.fillStyle;
              Gx.fillRect(x, y, 2, 2);
              Gx.globalAlpha = 1;
            }
          }
      }
      if (kind === 1) {
        // Light strips running the height of the tower.
        for (const sx of [6, 13, 20]) {
          X.fillStyle = '#120a20';
          X.fillRect(sx, 0, 3, TILE);
          X.fillStyle = sx === 13 ? neon : '#e9e3ff';
          X.fillRect(sx + 1, 0, 1, TILE);
          Gx.fillStyle = X.fillStyle;
          Gx.fillRect(sx + 1, 0, 1, TILE);
        }
      }
      if (kind === 2) {
        // A vertical holo-ad.
        X.fillStyle = '#0d0716';
        X.fillRect(5, 2, PW - 10, TILE - 4);
        X.fillStyle = neon;
        X.fillRect(5, 2, PW - 10, 1);
        X.fillRect(5, TILE - 3, PW - 10, 1);
        Gx.fillStyle = neon;
        Gx.fillRect(5, 2, PW - 10, 1);
        Gx.fillRect(5, TILE - 3, PW - 10, 1);
        const word = ['EV', 'KWH', 'ZAP', 'AMP'][Math.floor(rnd() * 4)];
        R.text(X, word, PW / 2, 13, { font: 'small', color: neon, align: 'center' });
        R.text(Gx, word, PW / 2, 13, { font: 'small', color: neon, align: 'center' });
      }
      if (kind === 3) {
        // Industrial hazard stripes.
        for (let y = 0; y < TILE; y += 16) {
          for (let x = 2; x < PW - 2; x++) {
            X.fillStyle = Math.floor((x + y / 2) / 3) % 2 ? '#ffd93b' : '#120a1e';
            X.fillRect(x, y + 13, 1, 2);
          }
        }
      }
      // Cap: a heavy band with a neon lip facing the gap and corner warning lights.
      const C = cap.x;
      const Cg = capG.x;
      C.fillStyle = '#2b2346';
      C.fillRect(0, 0, CW, CH);
      C.fillStyle = '#3a3060';
      C.fillRect(0, 1, CW, 2);
      for (let x = 1; x < CW - 1; x++) {
        C.fillStyle = Math.floor(x / 3) % 2 ? '#ffd93b' : '#16101f';
        C.fillRect(x, 4, 1, 3);
      }
      C.fillStyle = neon;
      C.fillRect(0, 0, CW, 1);
      Cg.fillStyle = neon;
      Cg.fillRect(0, 0, CW, 1);
      C.fillStyle = '#0e0918';
      C.fillRect(0, CH - 1, CW, 1);
      C.fillStyle = '#ff2a3d';
      C.fillRect(1, 8, 1, 1);
      C.fillRect(CW - 2, 8, 1, 1);
      Cg.fillStyle = '#ff2a3d';
      Cg.fillRect(1, 8, 1, 1);
      Cg.fillRect(CW - 2, 8, 1, 1);
    }),
  };

  // ======================================================================
  // ZONE 2 · SKYWAY (sunset above the clouds)
  // ======================================================================
  function cloudStrip(seed, h, o) {
    const rnd = R.rng(seed);
    const cv = R.canvas(STRIP, h);
    const gv = R.canvas(STRIP, h);
    const X = cv.x;
    for (let i = 0; i < o.count; i++) {
      const cx = rnd() * STRIP;
      const cy = h - rnd() * o.spread - o.base;
      const puffs = rnd.int(3, 7);
      for (let k = 0; k < puffs; k++) {
        const r = rnd.int(o.rMin, o.rMax);
        const px = cx + (k - puffs / 2) * r * 0.9 + rnd() * 4;
        const py = cy - rnd() * r * 0.5;
        for (const dx of [0, -STRIP, STRIP]) {
          disc(X, px + dx, py, r, o.body);
          disc(X, px + dx, py + 1, r - 1, o.body);
          disc(X, px + dx - 1, py - 1, Math.max(1, r - 2), o.lit);
        }
      }
    }
    if (o.underlight) {
      // Sunset light on the underside of each cloud.
      const d = X.getImageData(0, 0, STRIP, h);
      const out = X.createImageData(STRIP, h);
      out.data.set(d.data);
      for (let y = 0; y < h - 1; y++)
        for (let x = 0; x < STRIP; x++) {
          const i = (y * STRIP + x) * 4;
          const j = ((y + 1) * STRIP + x) * 4;
          if (d.data[i + 3] && !d.data[j + 3]) {
            const c = R.hex(o.underlight);
            out.data[i] = c[0];
            out.data[i + 1] = c[1];
            out.data[i + 2] = c[2];
            gv.x.fillStyle = o.underlight;
            gv.x.globalAlpha = 0.5;
            gv.x.fillRect(x, y, 1, 1);
            gv.x.globalAlpha = 1;
          }
        }
      X.putImageData(out, 0, 0);
    }
    return { c: cv.c, g: gv.c };
  }

  const skyway = {
    id: 'skyway',
    name: 'SKYWAY',
    sub: 'ABOVE THE CLOUDS · SUNSET',
    ambient: 'wind',
    reflect: false,
    build() {
      this.sky = R.canvas(W, H);
      vgrad(this.sky.x, 0, G, [
        [0, '#170a36'],
        [0.25, '#3d0f5e'],
        [0.5, '#8e1f6e'],
        [0.68, '#e2456a'],
        [0.82, '#ff8a4c'],
        [1, '#ffc46b'],
      ]);
      // Synthwave sun, striped in its lower half.
      const sun = R.canvas(110, 110);
      for (let y = -48; y <= 48; y++) {
        const hw = Math.floor(Math.sqrt(48 * 48 - y * y));
        const t = (y + 48) / 96;
        if (y > 4) {
          const band = Math.floor((y - 4) / 6);
          const gapH = 1 + Math.floor(band / 2);
          if ((y - 4) % 6 < gapH) continue;
        }
        sun.x.fillStyle = R.rgb(R.mix('#fff3a8', '#ff3d7f', t));
        sun.x.fillRect(55 - hw, 55 + y, hw * 2 + 1, 1);
      }
      this.sun = sun;
      this.spires = skyline(404, 150, {
        minW: 6, maxW: 14, minH: 30, maxH: 140, gapMin: 8, gapMax: 40, antenna: 18,
        body: '#2a0d3c', rimL: '#7a2a6a', rimR: '#3a1450', top: '#9a3a7e',
        win: ['#ffe1a8', '#ff8ad8'], winW: 1, winH: 1, winGapX: 2, winGapY: 3, lit: 0.18, winGlow: 0.4,
        signs: 0, fog: '#b8406e', fogA: 0.6,
      });
      this.spires.f = 0.05;
      this.spires.y = G - 150 - 30;
      this.clouds1 = cloudStrip(505, 90, { count: 16, spread: 30, base: 6, rMin: 4, rMax: 9, body: '#a03a7e', lit: '#c8588e', underlight: '#ffb36b' });
      this.clouds1.f = 0.1;
      this.clouds1.y = G - 136;
      this.clouds2 = cloudStrip(606, 120, { count: 22, spread: 34, base: 2, rMin: 6, rMax: 13, body: '#6d2a7a', lit: '#9a3f8e', underlight: '#ff8f7a' });
      this.clouds2.f = 0.3;
      this.clouds2.y = G - 112;
      this.birds = [];
      for (let i = 0; i < 6; i++) this.birds.push({ x: 140 + i * 9 + R.fx() * 6, y: 60 + (i % 3) * 5 + R.fx() * 4, p: R.fx() * 6 });
      this.traffic = city.traffic.map((c) => Object.assign({}, c));
    },
    update(dt, speed) {
      for (const b of this.birds) {
        b.x -= (speed * 0.18 + 6) * dt;
        if (b.x < -10) b.x += W + 80;
      }
      for (const c of this.traffic) {
        c.x += (c.v - speed * c.d) * dt;
        if (c.x < -40 || c.x > W + 40) Object.assign(c, city.newCar());
      }
    },
    drawBack(b, gl, dist, t) {
      b.drawImage(this.sky.c, 0, 0);
      softGlow(gl, 108, G - 98, 90, '#ff7a3d', 0.55);
      b.drawImage(this.sun.c, 108 - 55, G - 98 - 55);
      gl.globalAlpha = 0.35;
      gl.drawImage(this.sun.c, 108 - 55, G - 98 - 55);
      gl.globalAlpha = 1;
      strip(b, gl, this.spires, dist);
      strip(b, gl, this.clouds1, dist);
      for (const bd of this.birds) {
        const up = Math.sin(t * 9 + bd.p) > 0;
        b.fillStyle = '#2a0d33';
        const x = Math.round(bd.x);
        const y = Math.round(bd.y);
        b.fillRect(x, y, 1, 1);
        b.fillRect(x - 1, y + (up ? -1 : 1), 1, 1);
        b.fillRect(x + 1, y + (up ? -1 : 1), 1, 1);
      }
      for (const c of this.traffic) {
        const s = R.TRAFFIC[c.s];
        b.drawImage(s.c, Math.round(c.x), Math.round(c.y));
        gl.drawImage(s.g, Math.round(c.x), Math.round(c.y));
      }
      strip(b, gl, this.clouds2, dist);
    },
    ground(b, gl, dist) {
      // Synthwave grid floor in perspective; lines slide sideways faster up close.
      b.fillStyle = '#1b0730';
      b.fillRect(0, G, W, H - G);
      const hz = G;
      for (let y = hz; y < H; y++) {
        const depth = (y - hz + 1) / (H - hz);
        b.fillStyle = R.rgb(R.mix('#3a0d55', '#14041f', depth));
        b.fillRect(0, y, W, 1);
      }
      gl.fillStyle = '#ff3fd2';
      b.fillStyle = '#ff5fe0';
      for (let k = 0; k < 7; k++) {
        const y = Math.round(hz + Math.pow(k / 6, 1.8) * (H - hz - 1));
        b.fillRect(0, y, W, 1);
        gl.globalAlpha = 0.6;
        gl.fillRect(0, y, W, 1);
        gl.globalAlpha = 1;
      }
      for (let y = hz + 1; y < H; y++) {
        const depth = (y - hz) / (H - hz);
        const sp = 10 + depth * 46;
        const off = (dist * (0.4 + depth * 1.4)) % sp;
        for (let x = -off; x < W; x += sp) {
          const xx = Math.round(x + (x - W / 2) * depth * 0.2);
          b.fillRect(xx, y, 1, 1);
          gl.fillRect(xx, y, 1, 1);
        }
      }
      b.fillStyle = '#fff0fb';
      b.fillRect(0, hz, W, 1);
      gl.fillStyle = '#ff7ae4';
      gl.fillRect(0, hz, W, 1);
    },
    groundTop() {},
    pipe: pipeSet((kind, hue, body, bodyG, cap, capG, rnd) => {
      const neon = ['#ff4fd8', '#2ef6ff', '#ffb13b', '#b06bff'][hue];
      const X = body.x;
      const Gx = bodyG.x;
      // Hologram pillar: translucent with scanlines and a diamond lattice.
      X.globalAlpha = 0.28;
      X.fillStyle = neon;
      X.fillRect(1, 0, PW - 2, TILE);
      X.globalAlpha = 1;
      for (let y = 0; y < TILE; y += 2) {
        X.globalAlpha = 0.35;
        X.fillStyle = '#ffffff';
        X.fillRect(1, y, PW - 2, 1);
        X.globalAlpha = 1;
      }
      if (kind % 2 === 0) {
        for (let y = 0; y < TILE; y++) {
          const d = Math.abs((y % 16) - 8);
          X.fillStyle = neon;
          X.fillRect(PW / 2 - d - 1, y, 1, 1);
          X.fillRect(PW / 2 + d, y, 1, 1);
          Gx.fillStyle = neon;
          Gx.fillRect(PW / 2 - d - 1, y, 1, 1);
          Gx.fillRect(PW / 2 + d, y, 1, 1);
        }
      } else {
        for (let y = 3; y < TILE; y += 8) {
          X.fillStyle = neon;
          X.fillRect(4, y, PW - 8, 1);
          Gx.globalAlpha = 0.6;
          Gx.fillStyle = neon;
          Gx.fillRect(4, y, PW - 8, 1);
          Gx.globalAlpha = 1;
        }
      }
      X.fillStyle = neon;
      X.fillRect(0, 0, 1, TILE);
      X.fillRect(PW - 1, 0, 1, TILE);
      X.fillStyle = '#ffffff';
      X.fillRect(1, 0, 1, TILE);
      Gx.fillStyle = neon;
      Gx.fillRect(0, 0, 2, TILE);
      Gx.fillRect(PW - 1, 0, 1, TILE);
      Gx.globalAlpha = 0.25;
      Gx.fillRect(2, 0, PW - 3, TILE);
      Gx.globalAlpha = 1;
      // Emitter cap: solid, so the gap edge is always readable.
      const C = cap.x;
      const Cg = capG.x;
      C.fillStyle = '#24163a';
      C.fillRect(0, 0, CW, CH);
      C.fillStyle = '#3d2a5e';
      C.fillRect(0, 2, CW, 3);
      C.fillStyle = '#fff6ff';
      C.fillRect(0, 0, CW, 1);
      C.fillStyle = neon;
      C.fillRect(0, 1, CW, 1);
      C.fillRect(3, 6, CW - 6, 1);
      Cg.fillStyle = neon;
      Cg.fillRect(0, 0, CW, 2);
      Cg.fillRect(3, 6, CW - 6, 1);
      C.fillStyle = '#140b22';
      C.fillRect(0, CH - 1, CW, 1);
      C.fillStyle = '#9dfcff';
      for (const lx of [4, CW / 2, CW - 5]) {
        C.fillRect(lx, 8, 1, 1);
        Cg.fillStyle = '#9dfcff';
        Cg.fillRect(lx, 8, 1, 1);
      }
    }),
  };

  // ======================================================================
  // ZONE 3 · LOW EARTH ORBIT
  // ======================================================================
  function starStrip(seed, h, n, cols, big) {
    const rnd = R.rng(seed);
    const cv = R.canvas(STRIP, h);
    const gv = R.canvas(STRIP, h);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rnd() * STRIP);
      const y = Math.floor(rnd() * h);
      const c = cols[Math.floor(rnd() * cols.length)];
      cv.x.fillStyle = c;
      cv.x.fillRect(x, y, 1, 1);
      if (big && rnd() < 0.35) {
        cv.x.globalAlpha = 0.5;
        cv.x.fillRect(x - 1, y, 3, 1);
        cv.x.fillRect(x, y - 1, 1, 3);
        cv.x.globalAlpha = 1;
        gv.x.fillStyle = c;
        gv.x.fillRect(x, y, 1, 1);
      }
    }
    return { c: cv.c, g: gv.c };
  }

  const orbit = {
    id: 'orbit',
    name: 'LOW EARTH ORBIT',
    sub: "DON'T PANIC",
    ambient: 'space',
    reflect: false,
    build() {
      this.sky = R.canvas(W, H);
      vgrad(this.sky.x, 0, H, [
        [0, '#02030a'],
        [0.7, '#050818'],
        [1, '#081030'],
      ]);
      // Milky way: a faint dithered band.
      const rnd = R.rng(77);
      for (let i = 0; i < 1600; i++) {
        const t = rnd();
        const x = t * W;
        const y = 40 + t * 150 + (rnd() - 0.5) * 50 * (1 - Math.abs(t - 0.5));
        this.sky.x.fillStyle = rnd() < 0.5 ? '#141a3a' : '#1e1640';
        this.sky.x.fillRect(x | 0, y | 0, 1, 1);
      }
      this.s1 = starStrip(901, H, 220, ['#5a6288', '#7f88b0', '#4d4f78'], false);
      this.s1.f = 0.015;
      this.s1.y = 0;
      this.s2 = starStrip(902, H, 90, ['#c9d4ff', '#ffffff', '#ffd9a8'], true);
      this.s2.f = 0.04;
      this.s2.y = 0;
      // Earth surface strip, scrolled under a circular limb: tall enough for everything under it.
      const ew = STRIP;
      const eh = H - G + 24;
      const e = R.canvas(ew, eh);
      e.x.fillStyle = '#1b4a9e';
      e.x.fillRect(0, 0, ew, eh);
      const r2 = R.rng(31);
      for (let i = 0; i < Math.round(eh * 0.37); i++) {
        const cx = r2() * ew;
        const cy = r2() * eh;
        const n = r2.int(4, 12);
        for (let k = 0; k < n; k++) {
          const col = r2() < 0.6 ? '#3e7d3e' : '#a3854f';
          for (const dx of [0, -ew, ew]) disc(e.x, cx + dx + (r2() - 0.5) * 20, cy + (r2() - 0.5) * 8, r2.int(2, 6), col);
        }
      }
      for (let i = 0; i < Math.round(eh * 0.57); i++) {
        const cx = r2() * ew;
        const cy = r2() * eh;
        for (const dx of [0, -ew, ew]) {
          e.x.fillStyle = 'rgba(255,255,255,0.75)';
          e.x.fillRect(cx + dx, cy, r2.int(6, 24), r2.int(1, 3));
        }
      }
      this.earth = e;
      this.sats = [];
      for (let i = 0; i < 3; i++) this.sats.push({ x: R.fx() * W, y: 40 + R.fx() * (G - 156), v: 4 + R.fx() * 8, p: R.fx() * 6 });
      this.starman = { x: W + 200, y: 120 };
      this.meteorT = 3;
      this.meteor = null;
    },
    update(dt, speed) {
      for (const s of this.sats) {
        s.x -= (speed * 0.06 + s.v) * dt;
        if (s.x < -20) {
          s.x = W + 20 + R.fx() * 60;
          s.y = 30 + R.fx() * (G - 136);
        }
      }
      this.starman.x -= (speed * 0.1 + 3) * dt;
      if (this.starman.x < -60) this.starman.x = W + 400 + R.fx() * 300;
      this.meteorT -= dt;
      if (this.meteorT < 0) {
        this.meteorT = 2 + R.fx() * 4;
        this.meteor = { x: R.fx() * W, y: R.fx() * 120, t: 0 };
      }
      if (this.meteor) {
        this.meteor.t += dt;
        if (this.meteor.t > 0.6) this.meteor = null;
      }
    },
    drawBack(b, gl, dist, t) {
      b.drawImage(this.sky.c, 0, 0);
      strip(b, gl, this.s1, dist);
      strip(b, gl, this.s2, dist);
      // The Sun, with a flare streak.
      softGlow(gl, 186, 64, 24, '#fff4d6', 0.55);
      disc(b, 186, 64, 4, '#fffdf2');
      disc(gl, 186, 64, 4, '#ffffff');
      gl.globalAlpha = 0.35;
      gl.fillStyle = '#fff4d6';
      gl.fillRect(130, 64, 86, 1);
      gl.globalAlpha = 1;
      // The Moon.
      disc(b, 34, 118, 9, '#b9bdc9');
      disc(b, 31, 115, 2, '#9ca1ae');
      disc(b, 37, 122, 1, '#9ca1ae');
      if (this.meteor) {
        const m = this.meteor;
        const x = m.x - m.t * 160;
        const y = m.y + m.t * 70;
        gl.fillStyle = '#d8f3ff';
        b.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) {
          b.globalAlpha = 1 - i / 8;
          b.fillRect(Math.round(x + i * 2), Math.round(y - i), 1, 1);
          gl.fillRect(Math.round(x + i * 2), Math.round(y - i), 1, 1);
        }
        b.globalAlpha = 1;
      }
      // Satellites.
      for (const s of this.sats) {
        const x = Math.round(s.x);
        const y = Math.round(s.y);
        b.fillStyle = '#3557a8';
        b.fillRect(x - 6, y, 5, 2);
        b.fillRect(x + 3, y, 5, 2);
        b.fillStyle = '#d9a640';
        b.fillRect(x - 1, y - 1, 4, 4);
        b.fillStyle = '#e6e9f0';
        b.fillRect(x, y, 2, 2);
        if (Math.sin(t * 5 + s.p) > 0.7) {
          gl.fillStyle = '#7dff6b';
          gl.fillRect(x + 1, y - 2, 1, 1);
          b.fillStyle = '#7dff6b';
          b.fillRect(x + 1, y - 2, 1, 1);
        }
      }
      // Easter egg: the 2018 Starman Roadster still drifting by.
      const sm = this.starman;
      if (sm.x < W + 30) {
        const spr = R.carSprite(4, 0, 0);
        b.save();
        b.translate(Math.round(sm.x), Math.round(sm.y));
        b.rotate(Math.sin(t * 0.4) * 0.3 + 0.2);
        b.globalAlpha = 0.9;
        b.drawImage(spr.base, -spr.cx, -spr.cy, spr.w, spr.h);
        b.restore();
        R.text(b, "DON'T PANIC", Math.round(sm.x), Math.round(sm.y) - 16, { font: 'small', color: '#9fd6ff', align: 'center', alpha: 0.8 });
      }
      // Earth limb, its top just under the death line.
      const cx = W / 2;
      const r = 440;
      const top = G - 16;
      const cy = top + r;
      const off = Math.floor((dist * 0.05) % STRIP);
      for (let y = top - 20; y < H; y++) {
        const dy = cy - y;
        if (dy > r) continue;
        const hw = Math.sqrt(r * r - dy * dy);
        const x0 = Math.max(0, Math.round(cx - hw));
        const x1 = Math.min(W, Math.round(cx + hw));
        if (x1 <= x0) continue;
        const sy = Math.min(this.earth.h - 1, y - top + 4);
        b.drawImage(this.earth.c, (x0 + off) % STRIP, Math.max(0, sy), x1 - x0, 1, x0, y, x1 - x0, 1);
        const edge = r - Math.hypot(0, dy);
        void edge;
      }
      // Darken toward the limb's horizon, then the atmosphere line.
      for (let x = 0; x < W; x++) {
        const dx = x - cx;
        const y = Math.round(cy - Math.sqrt(r * r - dx * dx));
        b.fillStyle = '#9fe6ff';
        b.fillRect(x, y, 1, 1);
        b.fillStyle = 'rgba(80,170,255,0.35)';
        b.fillRect(x, y - 2, 1, 2);
        gl.fillStyle = '#4fb8ff';
        gl.fillRect(x, y - 1, 1, 2);
        b.fillStyle = 'rgba(2,8,30,0.35)';
        b.fillRect(x, y + 1, 1, 4);
      }
    },
    ground(b, gl, dist, t) {
      // Below the death line: the upper atmosphere, glowing faintly.
      b.fillStyle = 'rgba(255,120,60,0.10)';
      b.fillRect(0, G, W, H - G);
      gl.globalAlpha = 0.25 + Math.sin(t * 2) * 0.05;
      gl.fillStyle = '#ff6a2a';
      gl.fillRect(0, G, W, 1);
      gl.globalAlpha = 1;
      b.fillStyle = '#ffb07a';
      for (let x = (-dist * 1.0) % 8; x < W; x += 8) b.fillRect(Math.round(x), G, 4, 1);
    },
    groundTop() {},
    pipe: pipeSet((kind, hue, body, bodyG, cap, capG, rnd) => {
      const X = body.x;
      const Gx = bodyG.x;
      const lamp = ['#ff2a3d', '#7dff6b', '#2ef6ff', '#ffd93b'][hue];
      if (kind === 0 || kind === 2) {
        // Truss: frame with X-bracing; space shows through.
        X.fillStyle = '#8d93a3';
        X.fillRect(0, 0, 2, TILE);
        X.fillRect(PW - 2, 0, 2, TILE);
        X.fillStyle = '#5f6474';
        X.fillRect(2, 0, PW - 4, 1);
        X.fillRect(2, TILE / 2, PW - 4, 1);
        X.fillStyle = '#b9bfcc';
        for (let i = 0; i < 16; i++) {
          X.fillRect(2 + Math.round((i / 15) * (PW - 5)), i, 1, 1);
          X.fillRect(PW - 3 - Math.round((i / 15) * (PW - 5)), i, 1, 1);
          X.fillRect(2 + Math.round((i / 15) * (PW - 5)), i + 16, 1, 1);
          X.fillRect(PW - 3 - Math.round((i / 15) * (PW - 5)), i + 16, 1, 1);
        }
        X.fillStyle = '#c9ced9';
        X.fillRect(0, 0, 1, TILE);
        if (kind === 2) {
          // Solar wings.
          for (let y = 3; y < TILE; y += 15) {
            X.fillStyle = '#1d3f8f';
            X.fillRect(3, y, PW - 6, 9);
            X.fillStyle = '#4f7fe0';
            for (let gx = 3; gx < PW - 3; gx += 3) X.fillRect(gx, y, 1, 9);
            X.fillRect(3, y + 4, PW - 6, 1);
            Gx.globalAlpha = 0.25;
            Gx.fillStyle = '#4f7fe0';
            Gx.fillRect(3, y, PW - 6, 9);
            Gx.globalAlpha = 1;
          }
        }
      } else if (kind === 1) {
        // Habitat module stack.
        X.fillStyle = '#d8dbe3';
        X.fillRect(1, 0, PW - 2, TILE);
        X.fillStyle = '#f4f5f8';
        X.fillRect(3, 0, 4, TILE);
        X.fillStyle = '#9ea4b2';
        X.fillRect(PW - 6, 0, 4, TILE);
        X.fillStyle = '#7e8494';
        X.fillRect(1, 0, PW - 2, 2);
        for (let y = 8; y < TILE; y += 12) {
          X.fillStyle = '#1b2440';
          X.fillRect(9, y, 3, 3);
          X.fillRect(16, y, 3, 3);
          X.fillStyle = '#ffe9a8';
          X.fillRect(10, y + 1, 1, 1);
          Gx.fillStyle = '#ffe9a8';
          Gx.fillRect(10, y + 1, 1, 1);
        }
      } else {
        // Gold-foil satellite bus.
        for (let y = 0; y < TILE; y++)
          for (let x = 1; x < PW - 1; x++) {
            const n = rnd();
            X.fillStyle = n < 0.33 ? '#c9952e' : n < 0.66 ? '#e6b54a' : '#a6741f';
            X.fillRect(x, y, 1, 1);
          }
        X.fillStyle = '#5a3e10';
        X.fillRect(1, 15, PW - 2, 1);
        X.fillStyle = '#fff1b8';
        X.fillRect(4, 0, 1, TILE);
        Gx.globalAlpha = 0.2;
        Gx.fillStyle = '#e6b54a';
        Gx.fillRect(1, 0, PW - 2, TILE);
        Gx.globalAlpha = 1;
      }
      const C = cap.x;
      const Cg = capG.x;
      C.fillStyle = '#e6e8ee';
      C.fillRect(0, 0, CW, CH);
      C.fillStyle = '#ffffff';
      C.fillRect(0, 0, CW, 2);
      C.fillStyle = '#8e94a3';
      C.fillRect(0, 5, CW, 2);
      C.fillStyle = '#5c6170';
      C.fillRect(0, CH - 1, CW, 1);
      C.fillStyle = '#2b2f3a';
      for (let x = 4; x < CW - 4; x += 6) C.fillRect(x, 3, 2, 1);
      C.fillStyle = lamp;
      C.fillRect(1, 8, 2, 1);
      C.fillRect(CW - 3, 8, 2, 1);
      Cg.fillStyle = lamp;
      Cg.fillRect(1, 8, 2, 1);
      Cg.fillRect(CW - 3, 8, 2, 1);
      Cg.globalAlpha = 0.25;
      Cg.fillStyle = '#ffffff';
      Cg.fillRect(0, 0, CW, 2);
      Cg.globalAlpha = 1;
    }),
  };

  // ======================================================================
  // ZONE 4 · MARS
  // ======================================================================
  function ridge(seed, h, o) {
    const rnd = R.rng(seed);
    const cv = R.canvas(STRIP, h);
    const gv = R.canvas(STRIP, h);
    const X = cv.x;
    // Height profile from summed sines, periodic over the strip.
    const k1 = rnd.int(1, 3);
    const k2 = rnd.int(3, 6);
    const k3 = rnd.int(7, 12);
    const p1 = rnd() * 6;
    const p2 = rnd() * 6;
    const p3 = rnd() * 6;
    for (let x = 0; x < STRIP; x++) {
      const u = (x / STRIP) * Math.PI * 2;
      let y = o.base + Math.sin(u * k1 + p1) * o.a1 + Math.sin(u * k2 + p2) * o.a2 + Math.sin(u * k3 + p3) * o.a3;
      if (o.mesa) y = Math.round(y / o.mesa) * o.mesa;
      y = Math.round(R.clamp(y, 2, h - 1));
      for (let yy = y; yy < h; yy++) {
        const depth = (yy - y) / h;
        X.fillStyle = R.rgb(R.mix(o.top, o.body, Math.min(1, depth * 3)));
        if (o.strata && (yy - y) % o.strata === 0 && yy > y) X.fillStyle = o.line;
        X.fillRect(x, yy, 1, 1);
      }
      X.fillStyle = o.edge;
      X.fillRect(x, y, 1, 1);
    }
    return { c: cv.c, g: gv.c };
  }

  const mars = {
    id: 'mars',
    name: 'MARS',
    sub: 'GRAVITY 38% · POP. 0',
    ambient: 'dust',
    reflect: false,
    build() {
      this.sky = R.canvas(W, H);
      vgrad(this.sky.x, 0, G, [
        [0, '#1e0c10'],
        [0.35, '#4a1c18'],
        [0.65, '#93412a'],
        [0.85, '#d27a49'],
        [1, '#e9a26c'],
      ]);
      this.far = ridge(1201, 120, { base: 64, a1: 26, a2: 10, a3: 3, top: '#7a3322', body: '#5a2418', edge: '#9a4a2e', strata: 0 });
      this.far.f = 0.04;
      this.far.y = G - 150;
      this.mid = ridge(1202, 110, { base: 50, a1: 16, a2: 10, a3: 4, mesa: 7, top: '#8a3a20', body: '#62261a', edge: '#c0643a', strata: 4, line: '#a24c2a' });
      this.mid.f = 0.12;
      this.mid.y = G - 110;
      this.near = ridge(1203, 60, { base: 40, a1: 6, a2: 6, a3: 3, top: '#6a2716', body: '#3e170e', edge: '#a0482a', strata: 0 });
      this.near.f = 0.3;
      this.near.y = G - 60;
      this.dust = [];
      this.launchT = 4;
      this.launch = null;
    },
    update(dt, speed) {
      this.launchT -= dt;
      if (!this.launch && this.launchT < 0) this.launch = { x: 150 + R.fx() * 40, t: 0 };
      if (this.launch) {
        this.launch.t += dt;
        if (this.launch.t > 6) {
          this.launch = null;
          this.launchT = 7 + R.fx() * 6;
        }
      }
    },
    drawBack(b, gl, dist, t) {
      b.drawImage(this.sky.c, 0, 0);
      // Small sun with the blue halo a Martian sunset really has.
      softGlow(gl, 176, 92, 22, '#8fd3ff', 0.45);
      softGlow(b, 176, 92, 16, '#9fd8ff', 0.3);
      disc(b, 176, 92, 3, '#f4fbff');
      disc(gl, 176, 92, 3, '#ffffff');
      // Phobos and Deimos.
      disc(b, 40, 62, 3, '#6b5a52');
      b.fillStyle = '#8d786c';
      b.fillRect(130, 90, 2, 1);
      strip(b, gl, this.far, dist);
      // Colony: domes and a launch tower with a rocket.
      const bx = wrapX(200, dist, 0.12);
      for (const [dx, r] of [
        [0, 9],
        [16, 6],
        [-14, 5],
      ]) {
        const cx = Math.round(bx + dx);
        const cy = G - 70;
        b.fillStyle = '#3d2a2a';
        b.fillRect(cx - r, cy, r * 2 + 1, 2);
        for (let y = -r; y <= 0; y++) {
          const hw = Math.floor(Math.sqrt(r * r - y * y));
          b.fillStyle = y === -r ? '#ffffff' : 'rgba(170,230,255,0.5)';
          b.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
        }
        gl.fillStyle = '#7dffb0';
        gl.globalAlpha = 0.5;
        gl.fillRect(cx - 2, cy - 2, 5, 2);
        gl.globalAlpha = 1;
        b.fillStyle = '#7dffb0';
        b.fillRect(cx - 2, cy - 2, 5, 2);
      }
      const tx = Math.round(wrapX(120, dist, 0.12));
      const launched = this.launch ? this.launch.t : 0;
      const rise = launched > 1 ? Math.pow(launched - 1, 2) * 14 : 0;
      b.fillStyle = '#2a1a1a';
      b.fillRect(tx + 7, G - 120, 3, 50);
      for (let y = G - 118; y < G - 70; y += 4) b.fillRect(tx + 4, y, 6, 1);
      const ry = Math.round(G - 120 - rise);
      b.fillStyle = '#d6dbe3';
      b.fillRect(tx, ry, 5, 44);
      b.fillStyle = '#ffffff';
      b.fillRect(tx + 1, ry, 1, 44);
      b.fillStyle = '#9aa1ad';
      b.fillRect(tx + 4, ry, 1, 44);
      b.fillRect(tx + 1, ry - 2, 3, 2);
      b.fillRect(tx + 2, ry - 3, 1, 1);
      b.fillStyle = '#1c1c22';
      b.fillRect(tx - 1, ry + 6, 1, 3);
      b.fillRect(tx + 5, ry + 6, 1, 3);
      if (launched > 0.3) {
        const fl = Math.min(1, (launched - 0.3) * 2);
        for (let i = 0; i < 12; i++) {
          const y = ry + 44 + i * 2;
          const w = 3 + Math.floor(i / 2);
          gl.globalAlpha = fl * (1 - i / 12);
          gl.fillStyle = i < 3 ? '#ffffff' : '#ff9a3c';
          gl.fillRect(tx + 2 - Math.floor(w / 2), y, w, 2);
          b.globalAlpha = fl * (1 - i / 12);
          b.fillStyle = i < 3 ? '#fff7d6' : '#ffb35a';
          b.fillRect(tx + 2 - Math.floor(w / 2), y, w, 2);
        }
        gl.globalAlpha = 1;
        b.globalAlpha = 1;
      }
      strip(b, gl, this.mid, dist);
      strip(b, gl, this.near, dist);
    },
    ground(b, gl, dist) {
      b.fillStyle = '#9a4422';
      b.fillRect(0, G, W, H - G);
      b.fillStyle = '#c0643a';
      b.fillRect(0, G, W, 1);
      b.fillStyle = '#7a3018';
      b.fillRect(0, G + 1, W, 1);
      const rnd = R.rng(5);
      const off = dist % STRIP;
      for (let i = 0; i < 70; i++) {
        let x = rnd() * STRIP - off;
        if (x < -4) x += STRIP;
        const y = G + 3 + Math.floor(rnd() * (H - G - 4));
        const s = rnd() < 0.2 ? 2 : 1;
        if (x > W) continue;
        b.fillStyle = rnd() < 0.5 ? '#6a2814' : '#b85a30';
        b.fillRect(Math.round(x), y, s + 1, s);
      }
      // Rover tracks.
      b.fillStyle = '#82341a';
      for (let x = (-dist) % 6; x < W; x += 6) {
        b.fillRect(Math.round(x), G + 14, 3, 1);
        b.fillRect(Math.round(x) + 2, G + 18, 3, 1);
      }
    },
    groundTop() {},
    pipe: pipeSet((kind, hue, body, bodyG, cap, capG, rnd) => {
      const X = body.x;
      const Gx = bodyG.x;
      if (kind !== 1) {
        // Layered rock spire.
        const bands = ['#9b4423', '#7a3218', '#b85a2e', '#8a3b1d', '#a34a26'];
        for (let y = 0; y < TILE; y++) {
          X.fillStyle = bands[Math.floor((y + kind * 3) / 4) % bands.length];
          X.fillRect(1, y, PW - 2, 1);
        }
        for (let i = 0; i < 40; i++) {
          X.fillStyle = rnd() < 0.5 ? '#5e2410' : '#c46a3c';
          X.fillRect(1 + Math.floor(rnd() * (PW - 2)), Math.floor(rnd() * TILE), 1 + Math.floor(rnd() * 2), 1);
        }
        X.fillStyle = '#d27a49';
        X.fillRect(1, 0, 1, TILE);
        X.fillStyle = '#4a1a0c';
        X.fillRect(PW - 2, 0, 1, TILE);
        X.fillStyle = '#5e2410';
        X.fillRect(0, 0, 1, TILE);
        X.fillRect(PW - 1, 0, 1, TILE);
      } else {
        // Habitat tower: white modules, warm windows.
        X.fillStyle = '#e4e1dc';
        X.fillRect(1, 0, PW - 2, TILE);
        X.fillStyle = '#b7b1aa';
        X.fillRect(PW - 6, 0, 5, TILE);
        X.fillStyle = '#f9f8f5';
        X.fillRect(2, 0, 3, TILE);
        X.fillStyle = '#8f8a84';
        X.fillRect(1, 0, PW - 2, 1);
        for (let y = 5; y < TILE; y += 9) {
          for (const wx of [7, 13, 19]) {
            X.fillStyle = '#ffcf7a';
            X.fillRect(wx, y, 3, 2);
            Gx.fillStyle = '#ffb04a';
            Gx.fillRect(wx, y, 3, 2);
          }
        }
      }
      const C = cap.x;
      const Cg = capG.x;
      // Landing-pad ledge with beacons.
      C.fillStyle = '#4a4f5a';
      C.fillRect(0, 0, CW, CH);
      C.fillStyle = '#8e95a3';
      C.fillRect(0, 0, CW, 2);
      C.fillStyle = '#2b2f37';
      C.fillRect(0, CH - 1, CW, 1);
      for (let x = 1; x < CW - 1; x++) {
        C.fillStyle = Math.floor(x / 3) % 2 ? '#ff8a2f' : '#2b2f37';
        C.fillRect(x, 4, 1, 2);
      }
      const lamp = ['#ff8a2f', '#7dff6b', '#2ef6ff', '#ffffff'][hue];
      C.fillStyle = lamp;
      C.fillRect(2, 7, 2, 2);
      C.fillRect(CW - 4, 7, 2, 2);
      Cg.fillStyle = lamp;
      Cg.fillRect(2, 7, 2, 2);
      Cg.fillRect(CW - 4, 7, 2, 2);
      Cg.fillRect(0, 0, CW, 1);
    }),
  };

  R.ZONES = [city, skyway, orbit, mars];
  R.ZONES.forEach((z) => {
    z.built = false;
  });
  R.zone = function (i) {
    const z = R.ZONES[i];
    if (!z.built) {
      z.build();
      z.built = true;
    }
    return z;
  };
  R.drawPipe = function (b, gl, p) {
    const z = R.zone(p.zone);
    const top = p.gapY - p.gap / 2;
    const bot = p.gapY + p.gap / 2;
    if (p.stack) return drawStack(b, gl, p, bot);
    drawPipeTex(b, gl, z.pipe(p.kind, p.hue), p, top, bot);
  };

  // Scrolling sign on the blimp. Short, topical, and nobody's quote.
  R.TICKER = [
    'FLYING CARS ARRIVED BEFORE GTA 6',
    'ROADSTER PRODUCTION: 2028 (PINKY PROMISE)',
    'DUE TO HIGH WINDS THIS AD IS DELAYED 2 WEEKS',
    '0-60 IN 0.81 S · NOW WITH ALTITUDE',
    'FULL SELF-FLYING (SUPERVISED)',
    'PLEASE KEEP YOUR RETINAS ATTACHED',
    'NOT APPROVED FOR PUBLIC ROADS. GOOD THING.',
    'RANGE 300+ MI · SKY ANXIETY: UNLIMITED',
    'WE WERE PROMISED FLYING CARS',
  ];
})();
