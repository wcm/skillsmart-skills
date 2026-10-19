/* Pixel Hop · view: draws a world into the engine's pixel buffer (base) and its glow buffer: a
   synthwave night (a sky, a striped sun, two skylines that scroll at their own speeds), the neon
   road with the scene mirrored in its wet surface, the coins, the obstacles and the hero, plus
   the effects main asks for on each event. Everything that glows is drawn twice: its colour into
   base, and into glow, which the engine blurs into bloom. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const HOP = R.HOP;
  const G = HOP.G;
  const ART = R.HOP_ART;
  const fx = R.fx;

  // A skyline two screens wide, baked once with its glow twin. Lit windows glow; so do the
  // lights on the masts.
  function skyline(seed, h0, h1, body, lit, density) {
    const rnd = R.rng(seed);
    const w = W * 2;
    const c = R.canvas(w, G);
    const g = R.canvas(w, G);
    let x = -6;
    while (x < w) {
      const bw = rnd.int(14, 30);
      const bh = rnd.int(h0, h1);
      c.x.fillStyle = body;
      c.x.fillRect(x, G - bh, bw, bh);
      if (rnd.chance(0.35)) {
        const mx = x + (bw >> 1);
        const mh = rnd.int(5, 12);
        c.x.fillRect(mx, G - bh - mh, 1, mh);
        g.x.fillStyle = c.x.fillStyle = '#ff3fd2';
        g.x.fillRect(mx, G - bh - mh, 1, 1);
        c.x.fillRect(mx, G - bh - mh, 1, 1);
        c.x.fillStyle = body;
      }
      for (let wy = G - bh + 4; wy < G - 3; wy += 5)
        for (let wx = x + 3; wx < x + bw - 2; wx += 4)
          if (rnd() < density) {
            const col = rnd.chance(0.85) ? lit : '#2ef6ff';
            c.x.fillStyle = g.x.fillStyle = col;
            c.x.fillRect(wx, wy, 2, 2);
            g.x.fillRect(wx, wy, 2, 2);
          }
      x += bw + rnd.int(0, 3);
    }
    return { c: c.c, g: g.c, w };
  }

  // The sun: a disc of horizontal bands from yellow to pink, cut by gaps that widen toward the
  // horizon, baked with its glow.
  function sun(r) {
    const c = R.canvas(r * 2 + 1, r * 2 + 1);
    const g = R.canvas(r * 2 + 1, r * 2 + 1);
    for (let y = -r; y <= r; y++) {
      const u = (y + r) / (2 * r);
      if (u > 0.5 && ((y + r) % 6) < Math.round((u - 0.5) * 8)) continue;
      const hw = Math.floor(Math.sqrt(r * r - y * y));
      const col = R.rgb(R.mix('#ffe14d', '#ff3fd2', u));
      c.x.fillStyle = g.x.fillStyle = col;
      c.x.fillRect(r - hw, r + y, hw * 2 + 1, 1);
      g.x.fillRect(r - hw, r + y, hw * 2 + 1, 1);
    }
    return { c: c.c, g: g.c };
  }

  class HopView extends R.Screen {
    constructor(canvas) {
      super(canvas);
      this.floor = G;
      this.far = skyline(11, 26, 70, '#1c0d38', '#5e3f92', 0.07);
      this.near = skyline(23, 40, 100, '#0f0824', '#d8954a', 0.11);
      this.sun = sun(34);
      this.stars = [];
      const rnd = R.rng(5);
      for (let i = 0; i < 48; i++) this.stars.push([rnd.int(0, W - 1), rnd.int(4, G - 120), rnd() * 6]);
      const sky = R.canvas(W, G);
      R.vgrad(sky.x, 0, G, [[0, '#090318'], [0.45, '#1d0a3d'], [0.8, '#5a1660'], [1, '#c43a6e']]);
      this.sky = sky.c;
      this.squash = 0;
      this.stretch = 0;
      this.debris = ['#ff7a2f', '#fff4e0', '#ff2a3d', '#2ef6ff', '#eef6ff'].map((col) => {
        const d = R.canvas(2, 2);
        d.x.fillStyle = col;
        d.x.fillRect(0, 0, 2, 2);
        return d.c;
      });
    }

    reset() {
      super.reset();
      this.squash = this.stretch = 0;
    }

    // ---------------- effects main calls on events ----------------
    onJump() {
      this.stretch = 1;
      for (let i = 0; i < 3; i++) this.puff(HOP.X + 4 + i * 2, G - 1, -30 - fx() * 30, -6, 1.5, 4, 0.35, R.PAL.gas, 0.05);
    }
    onLand(v) {
      this.squash = R.clamp(v / 300, 0.3, 1);
      for (let i = 0; i < 4; i++) this.puff(HOP.X + 2 + i * 3, G - 1, (i - 1.5) * 18, -4, 1.5, 5, 0.3, R.PAL.gas, 0.05);
    }
    onCoin(x, y) {
      this.burst(x, G - y, 10, ['#ffe14d', '#fffbd0', '#ffb21e'], 60, 0.4, 0);
      this.add({ k: 'ring', x, y: G - y, r: 2, vr: 40, t: 0, life: 0.25, col: '#ffe14d' }, true);
    }
    onClose() {
      this.hit('zoom', 1.12);
      this.hit('aber', 1.5);
    }
    onCrash(w) {
      const x = HOP.X + HOP.HW / 2;
      const y = G - w.y - 8;
      this.flashCol = '255,255,255';
      this.hit('flash', 0.7);
      this.hit('shake', 5);
      this.hit('aber', 3);
      this.hit('glitch', 0.25);
      this.hit('zoom', 1.2);
      this.burst(x, y, 24, ['#ffffff', '#2ef6ff', '#ff3fd2', '#ffe14d'], 140, 0.6);
      for (let i = 0; i < 10; i++) this.chunk(this.debris[i % this.debris.length], x + 6, y + 4, 40 + fx() * 120, -80 - fx() * 140, (fx() - 0.5) * 20, 1.6, 0.4);
      for (let i = 0; i < 5; i++) this.puff(x + 8, G - 4, 20 + fx() * 40, -10 - fx() * 20, 3, 8, 0.8, R.PAL.smoke, 0);
    }

    // Particles and squash move with real time (dt scaled by main's slow-motion).
    update(dt, w) {
      this.step(dt, w && w.state === 'run' ? w.speed : 0);
      this.squash = Math.max(0, this.squash - dt * 9);
      this.stretch = Math.max(0, this.stretch - dt * 7);
      // Speed lines once the road gets fast.
      if (w && w.state === 'run' && w.speed > 165 && fx() < dt * 30) {
        this.add({ k: 'streak', x: W + 4, y: 40 + fx() * (G - 60), vx: -w.speed * 3, len: 10 + fx() * 20, t: 0, life: 0.5, col: '#e8f4ff', glowCol: '#9fe3ff' });
      }
    }

    // ---------------- the world ----------------
    drawWorld(w, t) {
      const b = this.base.x;
      const gl = this.glow.x;
      gl.clearRect(0, 0, W, H);
      b.fillStyle = '#05030a';
      b.fillRect(0, 0, W, H);
      const dist = w ? w.dist : t * 30;
      // Sky, stars, sun.
      b.drawImage(this.sky, 0, 0);
      for (const [sx, sy, ph] of this.stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + ph));
        b.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        b.fillRect(sx, sy, 1, 1);
      }
      const sx = Math.round(W * 0.66 - 34);
      const sy = G - 104;
      b.drawImage(this.sun.c, sx, sy);
      gl.globalAlpha = 0.8;
      gl.drawImage(this.sun.g, sx, sy);
      gl.globalAlpha = 1;
      // Two skylines, the far one slower.
      for (const [layer, k] of [[this.far, 0.12], [this.near, 0.35]]) {
        const off = -Math.floor((dist * k) % layer.w);
        for (const ox of [off, off + layer.w]) {
          b.drawImage(layer.c, ox, 0);
          gl.drawImage(layer.g, ox, 0);
        }
      }
      if (w) {
        // Coins bob and spin; obstacles stand on the road.
        for (const c of w.coins) {
          if (c.got) continue;
          const x = Math.round(c.x - dist);
          if (x < -8 || x > W + 8) continue;
          const fr = ART.coin[Math.floor(t * 10 + c.x * 0.1) % 4];
          const y = Math.round(G - c.y - 3 + Math.sin(t * 5 + c.x) * 1.5);
          b.drawImage(fr.c, x - 3, y);
          gl.drawImage(fr.g, x - 3, y);
        }
        for (const ob of w.obs) {
          const x = Math.round(ob.x - dist);
          if (x < -20 || x > W + 4) continue;
          const sp = ART.ob[ob.kind];
          b.drawImage(sp.c, x, G - sp.h);
          // Warning lights blink.
          if (ob.kind === 'tower' || Math.floor(t * 4 + ob.x) % 2) gl.drawImage(sp.g, x, G - sp.h);
        }
        this.drawHero(b, gl, w, t);
      }
      this.drawParts(b, gl, this.parts);
      // The wet road: everything above it, mirrored and rippling, then the neon edge and lanes.
      this.reflect(b, gl, t, G);
      b.fillStyle = 'rgba(10,6,24,0.35)';
      b.fillRect(0, G, W, H - G);
      b.fillStyle = gl.fillStyle = '#2ef6ff';
      b.fillRect(0, G, W, 1);
      gl.fillRect(0, G, W, 1);
      b.fillStyle = '#ff3fd2';
      b.fillRect(0, G + 1, W, 1);
      const lane = Math.floor(dist % 28);
      b.fillStyle = '#4a3a86';
      gl.fillStyle = '#3a2a76';
      for (let x = -lane; x < W; x += 28) {
        b.fillRect(x, G + 18, 12, 1);
        gl.fillRect(x, G + 18, 12, 1);
      }
      this.drawParts(b, gl, this.front);
    }

    drawHero(b, gl, w, t) {
      const A = ART.hero;
      let sp = A.run[Math.floor(w.dist / 10) % 2];
      if (w.state === 'ready') sp = A.run[Math.floor(t * 2) % 2 ? 0 : 1];
      if (!w.ground) sp = A.jump;
      if (w.state === 'dying' || w.state === 'dead') sp = A.hurt;
      // Squash on landing, stretch on take-off, anchored at the feet.
      const sx = 1 + this.squash * 0.22 - this.stretch * 0.1;
      const sy = 1 - this.squash * 0.25 + this.stretch * 0.15;
      const dw = Math.round(sp.w * sx);
      const dh = Math.round(sp.h * sy);
      let x = HOP.X + Math.round((sp.w - dw) / 2);
      const y = Math.round(G - w.y - dh);
      if (w.state === 'dying' || w.state === 'dead') {
        // Knocked back, tumbling.
        const k = w.state === 'dead' ? 1 : w.stateT / HOP.DYING;
        x -= Math.round(R.easeOut(k) * 26);
        b.save();
        gl.save();
        for (const c of [b, gl]) {
          c.translate(x + dw / 2, y + dh / 2);
          c.rotate(-Math.min(1, k * 1.4) * 2.6);
          c.translate(-(x + dw / 2), -(y + dh / 2));
        }
        b.drawImage(sp.c, x, y, dw, dh);
        gl.drawImage(sp.g, x, y, dw, dh);
        b.restore();
        gl.restore();
        return;
      }
      // A soft shadow on the road under a jump.
      const shw = Math.max(2, Math.round(14 - w.y / 7));
      b.fillStyle = 'rgba(0,0,0,0.45)';
      b.fillRect(HOP.X + 8 - (shw >> 1), G - 1, shw, 1);
      gl.globalAlpha = 0.4;
      gl.drawImage(sp.rim, x - 1, y - 1, dw + 2, dh + 2);
      gl.globalAlpha = 1;
      b.drawImage(sp.c, x, y, dw, dh);
      gl.drawImage(sp.g, x, y, dw, dh);
    }

    // Zoom punches centre on the hero.
    present(w, uiDraw) {
      this.focus = [HOP.X + 6, G - (w ? w.y : 0) - 10];
      super.present(uiDraw);
    }
  }

  R.HopView = HopView;
})();
