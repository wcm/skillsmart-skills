/* Pixel Game engine · screen: the 216×384 pixel buffer every game draws into, its emissive twin (blurred
   down a small pyramid and added back as neon bloom), the post-processing (chromatic split,
   glitch slices, flash, scanlines, vignette), camera shake and zoom, and a small particle system.
   A game's own view extends Screen with its world drawing. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const fx = R.fx;

  // Cached pixel discs and rings: puffs and shockwaves are drawn thousands of times.
  // Two tones: a solid core inside a half-transparent rim, so gas reads as fog, not marbles.
  const discs = new Map();
  function discSprite(r, col) {
    r = Math.max(1, Math.min(24, Math.round(r)));
    const key = r + col;
    let c = discs.get(key);
    if (!c) {
      const cv = R.canvas(r * 2 + 1, r * 2 + 1);
      cv.x.globalAlpha = 0.45;
      R.disc(cv.x, r, r, r, col);
      cv.x.globalAlpha = 1;
      if (r > 1) R.disc(cv.x, r, r, Math.max(1, Math.round(r * 0.62)), col);
      c = cv.c;
      discs.set(key, c);
    }
    return c;
  }
  const rings = new Map();
  function ringSprite(r, col) {
    r = Math.max(1, Math.min(30, Math.round(r)));
    const key = r + col;
    let c = rings.get(key);
    if (!c) {
      const cv = R.canvas(r * 2 + 1, r * 2 + 1);
      cv.x.fillStyle = col;
      // Midpoint circle.
      let x = r;
      let y = 0;
      let e = 1 - r;
      while (x >= y) {
        for (const [a, b] of [
          [x, y],
          [y, x],
          [-y, x],
          [-x, y],
          [-x, -y],
          [-y, -x],
          [y, -x],
          [x, -y],
        ])
          cv.x.fillRect(r + a, r + b, 1, 1);
        y++;
        if (e < 0) e += 2 * y + 1;
        else {
          x--;
          e += 2 * (y - x) + 1;
        }
      }
      c = cv.c;
      rings.set(key, c);
    }
    return c;
  }
  R.discSprite = discSprite;

  // Particle palettes, light to dark: a puff fades through its palette as it ages.
  R.PAL = {
    gas: ['#ffffff', '#e6f3ff', '#c9defa', '#a9bfe0', '#8a9cc0'],
    dust: ['#f2b48a', '#d98b5f', '#b86a42', '#8f4b2c', '#6e3520'],
    fire: ['#ffffff', '#fff1a8', '#ffb347', '#ff6a2a', '#a82a1a'],
    smoke: ['#7a7486', '#5f5a6c', '#4a4656', '#3a3644', '#2a2733'],
    rainbow: ['#ff3b5c', '#ff9a2f', '#ffe14d', '#7dff6b', '#2ef6ff', '#6b8cff', '#c46bff'],
  };

  class Screen {
    constructor(canvas) {
      this.out = canvas;
      this.ox = canvas.getContext('2d', { alpha: false });
      this.base = R.canvas(W, H);
      this.glow = R.canvas(W, H);
      this.ui = R.canvas(W, H);
      this.half = R.canvas(W / 2, H / 2);
      this.quarter = R.canvas(W / 4, H / 4);
      this.eighth = R.canvas(W / 8, H / 8);
      this.uiq = R.canvas(W / 4, H / 4);
      this.bloom = R.canvas(W, H);
      for (const b of [this.half, this.quarter, this.eighth, this.uiq, this.bloom]) b.x.imageSmoothingEnabled = true;
      this.scratch = R.canvas(W, H);
      this.scratchG = R.canvas(W, H);
      this.chR = R.canvas(W, H);
      this.chC = R.canvas(W, H);
      this.parts = [];
      this.front = [];
      this.shake = 0;
      this.kickY = 0;
      this.flash = 0;
      this.flashCol = '255,255,255';
      this.aber = 0;
      this.glitch = 0;
      this.zoom = 1;
      this.zoomTo = 1;
      this.k = 0;
      this.lite = false;
      this.floor = Infinity; // sparks, drops and debris bounce here (a road, a stage floor)
      this.focus = [W / 2, H / 2]; // the point the camera zooms in on
      this.reduced = false;
      try {
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        /* no matchMedia */
      }
    }

    resize(k) {
      if (k === this.k) return;
      this.k = k;
      this.out.width = W * k;
      this.out.height = H * k;
      const DW = W * k;
      const DH = H * k;
      // Scanlines one display row in every k, and a vignette.
      const scan = R.canvas(DW, DH);
      scan.x.fillStyle = `rgba(0,0,0,${k >= 3 ? 0.2 : 0.1})`;
      for (let y = k - 1; y < DH; y += k) scan.x.fillRect(0, y, DW, 1);
      const g = scan.x.createRadialGradient(DW / 2, DH * 0.46, DH * 0.28, DW / 2, DH / 2, DH * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.5)');
      scan.x.fillStyle = g;
      scan.x.fillRect(0, 0, DW, DH);
      this.overlay = scan.c;
    }

    reset() {
      this.parts.length = 0;
      this.front.length = 0;
      this.shake = this.flash = this.aber = this.glitch = 0;
      this.zoom = this.zoomTo = 1;
    }

    // ---------------- particles ----------------
    add(p, front) {
      const list = front ? this.front : this.parts;
      if (list.length > 700) list.shift();
      list.push(p);
      return p;
    }
    puff(x, y, vx, vy, r0, grow, life, pal, glow) {
      return this.add({ k: 'puff', x, y, vx, vy, r: r0, grow, t: 0, life, pal: pal || R.PAL.gas, glow: glow == null ? 0.12 : glow, drag: 2.2 });
    }
    burst(x, y, n, cols, speed, life, gravity) {
      for (let i = 0; i < n; i++) {
        const a = fx() * Math.PI * 2;
        const v = speed * (0.3 + fx() * 0.7);
        this.add({ k: 'spark', x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * (0.5 + fx() * 0.5), col: cols[Math.floor(fx() * cols.length)], g: gravity == null ? 300 : gravity }, true);
      }
    }
    confetti(n) {
      const pal = R.PAL.rainbow;
      for (let i = 0; i < n; i++) {
        this.add({ k: 'confetti', x: fx() * W, y: -10 - fx() * 60, vx: (fx() - 0.5) * 30, vy: 40 + fx() * 60, t: 0, life: 2.6 + fx(), col: pal[Math.floor(fx() * pal.length)], p: fx() * 6 }, true);
      }
    }
    // A small coloured chip that tumbles and bounces on the floor: debris, shards, a flying shoe.
    chunk(img, x, y, vx, vy, vr, life, bounce) {
      return this.add({ k: 'chunk', img, x, y, vx, vy, rot: 0, vr, t: 0, life, bounce }, true);
    }

    // Move every particle on by dt. drift: how fast the world scrolls left (px/s), so smoke and
    // sparks trail behind a moving scene.
    step(dt, drift) {
      const sp = drift || 0;
      const fl = this.floor;
      const step = (list) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.t += dt;
          if (p.t >= p.life) {
            list.splice(i, 1);
            continue;
          }
          switch (p.k) {
            case 'puff': {
              const d = Math.exp(-p.drag * dt);
              p.vx = p.vx * d - sp * 0.5 * (1 - d);
              p.vy = p.vy * d - 8 * dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              p.r += p.grow * dt * (1 - p.t / p.life);
              break;
            }
            case 'ring':
              p.r += p.vr * dt;
              break;
            case 'streak':
              p.x += p.vx * dt;
              break;
            case 'spark':
              p.px = p.x;
              p.py = p.y;
              p.vy += p.g * dt;
              p.x += p.vx * dt - sp * dt * 0.5;
              p.y += p.vy * dt;
              if (p.y > fl - 1) {
                p.y = fl - 1;
                p.vy *= -0.4;
                p.vx *= 0.6;
              }
              break;
            case 'drop':
              p.vy += 520 * dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              if (p.y > fl + 2) p.t = p.life;
              break;
            case 'chunk':
              p.vy += 620 * dt;
              p.x += (p.vx - sp * 0.4) * dt;
              p.y += p.vy * dt;
              p.rot += p.vr * dt;
              if (p.y > fl - 2) {
                p.y = fl - 2;
                p.vy = -Math.abs(p.vy) * p.bounce;
                p.vx *= 0.7;
                p.vr *= 0.6;
              }
              break;
            case 'confetti':
              p.x += (p.vx + Math.sin(p.t * 6 + p.p) * 20) * dt;
              p.y += p.vy * dt;
              break;
            case 'jet':
              break;
          }
        }
      };
      step(this.parts);
      step(this.front);
    }

    // Shake, flashes and zoom run in real time, so a hit-stop freeze still shakes.
    screen(dt) {
      const decay = (v, r) => v * Math.exp(-r * dt);
      this.shake = decay(this.shake, 7);
      this.kickY = decay(this.kickY, 18);
      this.flash = decay(this.flash, 6);
      this.aber = decay(this.aber, 4);
      this.glitch = Math.max(0, this.glitch - dt);
      this.zoom = R.approach(this.zoom, this.zoomTo, 7, dt);
      this.zoomTo = R.approach(this.zoomTo, 1, 2.5, dt);
    }

    // Screen-wide reactions: shake, flash, aber (chromatic split), zoom (punch-in), glitch.
    hit(kind, amount) {
      if (kind === 'shake') this.shake = Math.max(this.shake, amount);
      if (kind === 'flash') this.flash = Math.max(this.flash, amount);
      if (kind === 'aber') this.aber = Math.max(this.aber, amount);
      if (kind === 'zoom') this.zoomTo = Math.max(this.zoomTo, amount);
      if (kind === 'glitch') this.glitch = Math.max(this.glitch, amount);
    }

    // ---------------- drawing ----------------
    // Draw fn clipped to x..W (a wipe between two scenes), on both buffers.
    clip(b, gl, x, fn) {
      b.save();
      gl.save();
      b.beginPath();
      b.rect(x, 0, W - x, H);
      b.clip();
      gl.beginPath();
      gl.rect(x, 0, W - x, H);
      gl.clip();
      fn();
      b.restore();
      gl.restore();
    }

    // Mirror the scene above y into everything below it, rippled and dimmed: a wet street, a
    // polished floor.
    reflect(b, gl, t, y) {
      const top = y + 6;
      const rows = H - top;
      this.scratch.x.clearRect(0, 0, W, H);
      this.scratch.x.drawImage(this.base.c, 0, 0, W, y, 0, 0, W, y);
      this.scratchG.x.clearRect(0, 0, W, H);
      this.scratchG.x.drawImage(this.glow.c, 0, 0, W, y, 0, 0, W, y);
      for (let r = 0; r < rows; r++) {
        const sy = y - 2 - Math.floor(r * 1.25);
        if (sy < 0) break;
        const wob = Math.round(Math.sin(t * 2.3 + r * 0.8) * (0.4 + r * 0.05));
        const a = 0.42 * (1 - r / rows);
        b.globalAlpha = a;
        b.drawImage(this.scratch.c, 0, sy, W, 1, wob, top + r, W, 1);
        gl.globalAlpha = a * 0.7;
        gl.drawImage(this.scratchG.c, 0, sy, W, 1, wob, top + r, W, 1);
      }
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
    }

    drawParts(b, gl, list) {
      for (const p of list) {
        const u = p.t / p.life;
        switch (p.k) {
          case 'puff': {
            const ci = Math.min(p.pal.length - 1, Math.floor(u * p.pal.length));
            const a = (1 - u) * (1 - u) * 0.62;
            const img = discSprite(p.r, p.pal[ci]);
            const s = img.width;
            b.globalAlpha = a;
            b.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 2));
            if (p.glow) {
              gl.globalAlpha = a * p.glow * 3;
              gl.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 2));
            }
            break;
          }
          case 'ring': {
            const img = ringSprite(p.r, p.col);
            const s = img.width;
            const a = 1 - u;
            if (p.flat) {
              b.globalAlpha = a * 0.45;
              b.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 6), s, Math.max(1, Math.round(s / 3)));
              gl.globalAlpha = a * 0.6;
              gl.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 6), s, Math.max(1, Math.round(s / 3)));
            } else {
              b.globalAlpha = a * 0.8;
              b.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 2));
              gl.globalAlpha = a;
              gl.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 2));
            }
            break;
          }
          case 'jet': {
            const a = 1 - u;
            const len = p.len * (1 - u * 0.4) * (0.85 + fx() * 0.3);
            for (let i = 0; i < len; i++) {
              const x = Math.round(p.x + p.dx * i);
              const y = Math.round(p.y + p.dy * i);
              const f = i / len;
              const w = f < 0.3 ? 1 : f < 0.7 ? 2 : 3;
              b.globalAlpha = a * (1 - f * 0.6);
              b.fillStyle = f < 0.5 ? '#ffffff' : '#d6f4ff';
              b.fillRect(x - (w >> 1), y, w, 1);
              gl.globalAlpha = a * (1 - f * 0.5);
              gl.fillStyle = '#9fe6ff';
              gl.fillRect(x - (w >> 1) - 1, y, w + 2, 1);
            }
            break;
          }
          case 'streak':
            b.globalAlpha = (1 - u) * 0.55;
            b.fillStyle = p.col || '#e8f4ff';
            b.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.len), 1);
            gl.globalAlpha = (1 - u) * 0.35;
            gl.fillStyle = p.glowCol || '#9fe3ff';
            gl.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.len), 1);
            break;
          case 'spark':
            b.globalAlpha = 1 - u * 0.5;
            gl.globalAlpha = 1 - u;
            b.strokeStyle = p.col;
            gl.strokeStyle = p.col;
            b.beginPath();
            b.moveTo(Math.round(p.px) + 0.5, Math.round(p.py) + 0.5);
            b.lineTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5);
            b.stroke();
            gl.beginPath();
            gl.moveTo(Math.round(p.px) + 0.5, Math.round(p.py) + 0.5);
            gl.lineTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5);
            gl.stroke();
            b.fillStyle = p.col;
            b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            break;
          case 'drop':
            b.globalAlpha = 1 - u;
            b.fillStyle = p.col;
            b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            gl.globalAlpha = (1 - u) * 0.5;
            gl.fillStyle = p.col;
            gl.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            break;
          case 'chunk': {
            b.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
            b.save();
            b.translate(Math.round(p.x), Math.round(p.y));
            b.rotate(Math.round(p.rot * 4) / 4);
            b.drawImage(p.img, -Math.round(p.img.width / 2), -Math.round(p.img.height / 2));
            b.restore();
            break;
          }
          case 'confetti':
            b.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
            b.fillStyle = p.col;
            b.fillRect(Math.round(p.x), Math.round(p.y), 1, Math.sin(p.t * 9 + p.p) > 0 ? 2 : 1);
            gl.globalAlpha = 0.5;
            gl.fillStyle = p.col;
            gl.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            break;
        }
      }
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
    }

    // ---------------- presentation ----------------
    // Scale the buffers up to the canvas: camera zoom about this.focus plus shake, the chromatic
    // split, glitch slices, the bloom, then the UI (crisp, with its own soft glow), the flash
    // and the scanline overlay. uiDraw(ctx) draws the UI into the pixel buffer.
    present(uiDraw) {
      const k = this.k;
      const DW = W * k;
      const DH = H * k;
      const o = this.ox;
      const reduced = this.reduced;
      let z = this.zoom + (reduced ? 0 : this.shake * 0.01);
      if (reduced) z = Math.min(z, 1.04);
      const sw = W / z;
      const sh = H / z;
      let sx = R.clamp(this.focus[0] - sw / 2, 0, W - sw);
      let sy = R.clamp(this.focus[1] - sh / 2, 0, H - sh);
      if (!reduced) {
        sx += (fx() - 0.5) * 2 * this.shake;
        sy += (fx() - 0.5) * 2 * this.shake + this.kickY * 0.6;
      }
      sx = R.clamp(sx, -2, W - sw + 2);
      sy = R.clamp(sy, -2, H - sh + 2);
      o.globalCompositeOperation = 'source-over';
      o.globalAlpha = 1;
      o.imageSmoothingEnabled = false;
      o.fillStyle = '#05030a';
      o.fillRect(0, 0, DW, DH);

      const ab = reduced ? 0 : this.aber;
      if (ab > 0.35) {
        const d = Math.min(4, ab);
        for (const [cv, col] of [
          [this.chR, '#ff0000'],
          [this.chC, '#00ffff'],
        ]) {
          cv.x.globalCompositeOperation = 'copy';
          cv.x.drawImage(this.base.c, 0, 0);
          cv.x.globalCompositeOperation = 'multiply';
          cv.x.fillStyle = col;
          cv.x.fillRect(0, 0, W, H);
          cv.x.globalCompositeOperation = 'source-over';
        }
        o.drawImage(this.chC.c, sx + d, sy, sw, sh, 0, 0, DW, DH);
        o.globalCompositeOperation = 'lighter';
        o.drawImage(this.chR.c, sx - d, sy, sw, sh, 0, 0, DW, DH);
        o.globalCompositeOperation = 'source-over';
      } else o.drawImage(this.base.c, sx, sy, sw, sh, 0, 0, DW, DH);

      if (this.glitch > 0 && !reduced) {
        for (let i = 0; i < 6; i++) {
          const by = Math.floor(fx() * H);
          const bh = 2 + Math.floor(fx() * 10);
          const off = (fx() - 0.5) * 24;
          o.drawImage(this.base.c, sx, by, sw, bh, off * k, ((by - sy) * DH) / sh, DW, (bh * DH) / sh);
        }
      }

      // Bloom: sum the pyramid at low resolution, then add it to the screen in one pass.
      this.half.x.clearRect(0, 0, W / 2, H / 2);
      this.half.x.drawImage(this.glow.c, 0, 0, W / 2, H / 2);
      this.quarter.x.clearRect(0, 0, W / 4, H / 4);
      this.quarter.x.drawImage(this.half.c, 0, 0, W / 4, H / 4);
      this.eighth.x.clearRect(0, 0, W / 8, H / 8);
      this.eighth.x.drawImage(this.quarter.c, 0, 0, W / 8, H / 8);
      const bl = this.bloom.x;
      bl.globalCompositeOperation = 'copy';
      bl.globalAlpha = 0.45;
      bl.drawImage(this.glow.c, 0, 0);
      bl.globalCompositeOperation = 'lighter';
      bl.globalAlpha = 0.7;
      bl.drawImage(this.half.c, 0, 0, W, H);
      if (!this.lite) {
        bl.globalAlpha = 0.6;
        bl.drawImage(this.quarter.c, 0, 0, W, H);
        bl.globalAlpha = 0.55;
        bl.drawImage(this.eighth.c, 0, 0, W, H);
      }
      bl.globalAlpha = 1;
      bl.globalCompositeOperation = 'source-over';
      o.globalCompositeOperation = 'lighter';
      o.imageSmoothingEnabled = true;
      o.drawImage(this.bloom.c, sx, sy, sw, sh, 0, 0, DW, DH);
      o.globalCompositeOperation = 'source-over';

      // A clean frame (no UI) for share cards.
      if (this.wantSnap) {
        this.wantSnap = false;
        const s = R.canvas(540, 960);
        s.x.imageSmoothingEnabled = true;
        s.x.drawImage(this.out, 0, 0, 540, 960);
        this.snap = s.c;
      }

      // UI on top, crisp, with its own soft glow.
      const ux = this.ui.x;
      ux.clearRect(0, 0, W, H);
      if (uiDraw) uiDraw(ux);
      o.imageSmoothingEnabled = false;
      o.drawImage(this.ui.c, 0, 0, DW, DH);
      this.uiq.x.clearRect(0, 0, W / 4, H / 4);
      this.uiq.x.drawImage(this.ui.c, 0, 0, W / 4, H / 4);
      o.globalCompositeOperation = 'lighter';
      o.imageSmoothingEnabled = true;
      o.globalAlpha = 0.45;
      o.drawImage(this.uiq.c, 0, 0, DW, DH);
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
      o.imageSmoothingEnabled = false;

      const fl = reduced ? Math.min(this.flash, 0.15) : this.flash;
      if (fl > 0.01) {
        o.fillStyle = `rgba(${this.flashCol},${fl})`;
        o.fillRect(0, 0, DW, DH);
      }
      if (this.overlay) o.drawImage(this.overlay, 0, 0);
    }
  }
  R.Screen = Screen;
})();
