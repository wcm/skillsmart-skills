/* Model Kombat · view: the summit stage and everything on it. A big LED wall, spotlights, the back
   row of summit guests holding hands (everyone except these two), a glossy floor that mirrors the
   fight, the fighters with their shadows, afterimages and slow-motion tint, projectiles, sparks. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const K = R.KOMBAT;
  const FL = K.FLOOR;
  const fx = R.fx;

  // The back row: silhouettes of summit guests holding raised hands, in two groups with a gap in
  // the middle, where these two stand.
  const GUESTS = (function () {
    const rnd = R.rng(19);
    const xs = [14, 38, 62, 86, 130, 154, 178, 202];
    return xs.map((x, i) => ({ x: x + Math.round((rnd() - 0.5) * 4), h: 30 + Math.round(rnd() * 8), w: 9 + Math.round(rnd() * 3), p: rnd() * 6, join: i !== 3 && i < xs.length - 1 }));
  })();

  class View extends R.Screen {
    constructor(canvas) {
      super(canvas);
      this.floor = FL;
      this.trails = [[], []];
      this.dissolve = [0, 0];
      this.clock = 0; // runs with the view, so idle fighters breathe before a round starts
    }

    reset() {
      super.reset();
      this.trails = [[], []];
      this.dissolve = [0, 0];
    }

    // ---------------- effects ----------------
    spark(x, y, block) {
      if (block) {
        this.burst(x, y, 10, ['#9fd8ff', '#ffffff', '#2ef6ff'], 140, 0.3, 0);
        this.add({ k: 'ring', x, y, r: 2, vr: 70, t: 0, life: 0.2, col: '#9fd8ff' });
      } else {
        this.burst(x, y, 16, ['#ffffff', '#fff1a8', '#ffb347', '#ff3fd2'], 220, 0.4, 200);
        this.add({ k: 'ring', x, y, r: 2, vr: 110, t: 0, life: 0.18, col: '#ffffff' });
      }
    }
    dust(x) {
      for (let i = 0; i < 6; i++) this.puff(x + (fx() - 0.5) * 16, FL - 1, (fx() - 0.5) * 60, -6 - fx() * 14, 1.5, 7, 0.45, R.PAL.smoke, 0.02).drag = 2;
    }
    // The loser is deprecated: they sink into grey pixels that drift up and away.
    deprecate(f) {
      this.dissolve[f.side] = 0.001;
      for (let i = 0; i < 70; i++) {
        this.add({ k: 'confetti', x: f.x + (fx() - 0.5) * 30, y: FL - 10 - fx() * 50, vx: (fx() - 0.5) * 20, vy: -20 - fx() * 40, t: 0, life: 1.6 + fx(), col: fx() < 0.5 ? '#8b8f99' : '#c9ccd3', p: fx() * 6 }, true);
      }
    }

    update(dt, round) {
      this.step(dt, 0);
      this.clock += dt;
      // Afterimages while ACCELERATE runs.
      round.f.forEach((f, i) => {
        const tr = this.trails[i];
        if (f.fast > 0) {
          tr.push({ x: f.x, y: f.y, face: f.face, anim: this.anim(f), t: 0 });
          if (tr.length > 6) tr.shift();
          // Speed lines.
          if (fx() < dt * 40) this.add({ k: 'streak', x: f.x - f.face * 20 + (fx() - 0.5) * 20, y: FL + f.y - 20 - fx() * 40, vx: -f.face * (260 + fx() * 200), t: 0, life: 0.2, len: 6 + fx() * 10, col: '#c9f6ff', glowCol: '#2ef6ff' }, true);
        } else tr.length = 0;
        for (const p of tr) p.t += dt;
        if (this.dissolve[i] > 0) this.dissolve[i] = Math.min(1, this.dissolve[i] + dt / 1.2);
      });
    }

    // Which animation frame a fighter shows right now.
    anim(f) {
      const s = f.state;
      const t = f.stateT;
      switch (s) {
        case 'walk':
          return ['walk', Math.floor(t * 8)];
        case 'jump':
          if (f.move === 'air') return ['jumpkick', 0];
          return ['jump', f.vy < 0 ? 0 : 1];
        case 'attack': {
          const m = R.MOVES[f.move];
          const k = f.moveT < m.start ? 0 : f.moveT < m.start + Math.max(0.08, m.active) ? 1 : 2;
          return [m.anim, k];
        }
        case 'hit':
          return ['hit', t < 0.1 ? 0 : 1];
        case 'block':
        case 'blockstun':
          return ['block', 0];
        case 'super':
          return ['super', t < 0.3 ? 0 : 1];
        case 'win':
          return ['win', Math.floor(t * 3)];
        case 'ko':
        case 'deprecated':
          return ['ko', t < 0.15 ? 0 : t < 0.35 ? 1 : 2];
        case 'dazed':
          return ['dazed', Math.floor(t * 2.5)];
        case 'intro':
          return [f.pose || 'stand', 0];
        default:
          return ['idle', Math.floor(this.clock * 2.2)];
      }
    }

    // ---------------- drawing ----------------
    drawWorld(round, t, o) {
      o = o || {};
      const b = this.base.x;
      const gl = this.glow.x;
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
      gl.fillStyle = '#000';
      gl.fillRect(0, 0, W, H);
      this.drawStage(b, gl, t, o);
      b.fillStyle = '#0b0818';
      b.fillRect(0, FL, W, H - FL);
      // Shadows on the floor, then the fighters (the one attacking in front), projectiles, sparks.
      if (round) {
        for (const f of round.f) this.drawShadow(b, f);
        const order = round.f.slice().sort((a, c) => (a.state === 'attack' ? 1 : 0) - (c.state === 'attack' ? 1 : 0));
        this.drawParts(b, gl, this.parts);
        for (const f of order) this.drawFighter(b, gl, f, t);
        for (const p of round.proj) this.drawProj(b, gl, p, t);
      } else this.drawParts(b, gl, this.parts);
      this.drawParts(b, gl, this.front);
      this.drawFloor(b, gl, t);
    }

    drawStage(b, gl, t, o) {
      R.vgrad(b, 0, FL, [
        [0, '#06040f'],
        [0.45, '#110c2a'],
        [1, '#22163f'],
      ]);
      // Spotlights from the rig.
      for (let i = 0; i < 3; i++) {
        const bx = 40 + i * 68;
        const a = Math.sin(t * 0.6 + i * 2.2) * 0.35 + (i - 1) * 0.15;
        gl.globalAlpha = 0.13;
        gl.fillStyle = i === 1 ? '#ffd9f2' : '#b48cff';
        gl.beginPath();
        gl.moveTo(bx, 0);
        gl.lineTo(bx + Math.sin(a - 0.12) * 300, Math.cos(a - 0.12) * 300);
        gl.lineTo(bx + Math.sin(a + 0.12) * 300, Math.cos(a + 0.12) * 300);
        gl.fill();
        gl.globalAlpha = 1;
        b.fillStyle = '#2a2244';
        b.fillRect(bx - 4, 0, 8, 4);
      }
      // The LED wall.
      const x0 = 16;
      const y0 = 58;
      const ww = W - 32;
      const wh = 92;
      b.fillStyle = '#04030a';
      b.fillRect(x0 - 2, y0 - 2, ww + 4, wh + 4);
      R.vgrad(b, y0, y0 + wh, [
        [0, '#0d1446'],
        [1, '#1b0c3a'],
      ], x0, ww);
      // A slow ripple of light across the dot grid.
      for (let yy = y0 + 2; yy < y0 + wh - 1; yy += 3)
        for (let xx = x0 + 2; xx < x0 + ww - 1; xx += 3) {
          const v = Math.sin(xx * 0.06 + yy * 0.04 - t * 1.6) * 0.5 + 0.5;
          if (v < 0.55) continue;
          b.fillStyle = v > 0.92 ? '#3a4fd0' : '#22307a';
          b.fillRect(xx, yy, 1, 1);
        }
      if (!o.quiet) {
        const title = o.wall || 'AI SUMMIT';
        R.text(b, title, W / 2, y0 + 14, { scale: 2, color: '#9fd8ff', align: 'center' });
        R.text(gl, title, W / 2, y0 + 14, { scale: 2, color: '#3a7bff', align: 'center' });
        const sub = o.wallSub || 'NEW DELHI · FEB 19, 2026';
        R.text(b, sub, W / 2, y0 + 34, { font: 'small', color: '#ff9ae8', align: 'center' });
        R.text(gl, sub, W / 2, y0 + 34, { font: 'small', color: '#ff3fd2', align: 'center' });
        this.lineup(b, gl, y0 + 58);
      }
      // Side pillars of light.
      for (const px of [4, W - 8]) {
        for (let y = 40; y < FL; y += 4) {
          const c = R.GRAD.neon[Math.floor((y / 8 + t * 6) % 7)];
          b.fillStyle = c;
          b.fillRect(px, y, 4, 2);
          gl.fillStyle = c;
          gl.fillRect(px, y, 4, 2);
        }
      }
      // The back row, everyone else holding hands.
      const gy = FL - 18;
      const bobAt = (gst) => Math.round(Math.sin(t * 2 + gst.p) * 1);
      for (let i = 0; i < GUESTS.length; i++) {
        const gst = GUESTS[i];
        const top = gy - gst.h + bobAt(gst);
        b.fillStyle = '#0e0a20';
        b.fillRect(gst.x - gst.w / 2, top + 9, gst.w, gst.h - 9);
        R.disc(b, gst.x, top + 4, 4, '#0e0a20');
        b.fillStyle = '#463a80';
        b.fillRect(gst.x - gst.w / 2, top + 9, 1, gst.h - 9);
        if (!gst.join) continue;
        // Raised joined hands with the next guest; the hands catch the light.
        const n = GUESTS[i + 1];
        const ntop = gy - n.h + bobAt(n);
        const mx = Math.round((gst.x + n.x) / 2);
        const my = Math.min(top, ntop) - 7;
        b.strokeStyle = '#0e0a20';
        b.lineWidth = 2;
        b.beginPath();
        b.moveTo(gst.x + 3, top + 11);
        b.lineTo(mx, my);
        b.lineTo(n.x - 3, ntop + 11);
        b.stroke();
        b.lineWidth = 1;
        b.fillStyle = '#d9a27a';
        b.fillRect(mx - 1, my - 1, 3, 3);
        gl.fillStyle = '#6a4a2a';
        gl.fillRect(mx - 1, my - 1, 3, 3);
      }
    }

    // The summit photo as an LED pictogram: a lineup holding raised hands, except the two in the
    // middle, who each raise a fist.
    lineup(b, gl, y) {
      const s = 2;
      const n = 8;
      const x0 = Math.round(W / 2 - ((n * 10 + 1) * s) / 2);
      const put = (gx, gy, col, glow) => {
        b.fillStyle = col;
        b.fillRect(x0 + gx * s, y + gy * s, s, s);
        gl.fillStyle = glow;
        gl.fillRect(x0 + gx * s, y + gy * s, s, s);
      };
      const BODY = [[-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3], [-1, 4], [0, 4], [1, 4], [-1, 5], [0, 5], [1, 5], [-1, 6], [1, 6], [-1, 7], [1, 7]];
      for (let i = 0; i < n; i++) {
        const c = i * 10 + 5;
        for (const [dx, dy] of BODY) put(c + dx, dy, '#ffcf6b', '#5a4410');
        for (const side of [-1, 1]) {
          const fist = (i === n / 2 - 1 && side === 1) || (i === n / 2 && side === -1);
          put(c + side * 3, 2, '#ffcf6b', '#5a4410');
          if (fist) {
            put(c + side * 3, 1, '#ffcf6b', '#5a4410');
            put(c + side * 3, 0, '#ff6a8a', '#8a2040');
          } else {
            put(c + side * 4, 1, '#ffcf6b', '#5a4410');
            put(c + side * 5, 0, '#ffcf6b', '#5a4410');
          }
        }
      }
    }

    drawFloor(b, gl, t) {
      // A polished floor that mirrors the fight, the stage edge, footlights.
      if (!this.lite) this.reflect(b, gl, t, FL);
      b.fillStyle = '#2ef6ff';
      b.fillRect(0, FL, W, 1);
      gl.fillStyle = '#2ef6ff';
      gl.fillRect(0, FL, W, 1);
      b.fillStyle = '#3a2f5c';
      b.fillRect(0, FL + 1, W, 1);
      for (let x = 8; x < W; x += 20) {
        const on = Math.sin(t * 3 + x) > -0.3;
        b.fillStyle = on ? '#ffe9a8' : '#5a4a2a';
        b.fillRect(x, FL + 3, 3, 1);
        if (on) R.softGlow(gl, x + 1, FL + 3, 6, '#ffd36b', 0.35);
      }
    }

    drawShadow(b, f) {
      const s = R.clamp(1 + f.y / 120, 0.4, 1);
      b.globalAlpha = 0.45 * s;
      b.fillStyle = '#000000';
      b.beginPath();
      b.ellipse(Math.round(f.x), FL + 1, Math.round(13 * s), 2, 0, 0, Math.PI * 2);
      b.fill();
      b.globalAlpha = 1;
    }

    drawFighter(b, gl, f, t) {
      const [anim, i] = this.anim(f);
      const fr = R.fighterFrame(f.id, anim, i);
      const dis = this.dissolve[f.side];
      // Afterimages first (ACCELERATE).
      for (const p of this.trails[f.side]) {
        const pf = R.fighterFrame(f.id, p.anim[0], p.anim[1]);
        b.globalAlpha = 0.22;
        gl.globalAlpha = 0.3;
        this.blit(b, pf, p.x, FL + p.y, p.face);
        this.blit(gl, pf, p.x, FL + p.y, p.face, '#2ef6ff');
      }
      b.globalAlpha = dis > 0 ? Math.max(0, 1 - dis) : 1;
      gl.globalAlpha = 1;
      const blink = f.state === 'super' && Math.floor(t * 20) % 2 === 0;
      this.blit(b, fr, f.x, FL + f.y, f.face, dis > 0 ? '#9aa0ab' : null);
      if (blink) this.blit(gl, fr, f.x, FL + f.y, f.face, '#ffffff');
      // Slowed down: a blue cast and an hourglass overhead.
      if (f.slowed > 0) {
        b.globalAlpha = 0.35;
        this.blit(b, fr, f.x, FL + f.y, f.face, '#6bb8ff');
        b.globalAlpha = 1;
        this.hourglass(b, gl, f.x, FL + f.y - 82, t);
      }
      if (f.fast > 0) {
        gl.globalAlpha = 0.25 + Math.sin(t * 30) * 0.1;
        this.blit(gl, fr, f.x, FL + f.y, f.face, '#2ef6ff');
      }
      // Dazed: stars circling the head.
      if (f.state === 'dazed') {
        for (let k = 0; k < 3; k++) {
          const a = t * 4 + (k * Math.PI * 2) / 3;
          const sx = Math.round(f.x + Math.cos(a) * 12);
          const sy = Math.round(FL + f.y - 76 + Math.sin(a) * 3);
          b.fillStyle = '#ffe14d';
          b.fillRect(sx - 1, sy, 3, 1);
          b.fillRect(sx, sy - 1, 1, 3);
          gl.fillStyle = '#ffe14d';
          gl.fillRect(sx - 1, sy - 1, 3, 3);
        }
      }
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
    }

    hourglass(b, gl, x, y, t) {
      const flip = Math.floor(t * 1.5) % 2;
      x = Math.round(x);
      y = Math.round(y);
      b.fillStyle = '#c9d8ff';
      b.fillRect(x - 4, y, 9, 1);
      b.fillRect(x - 4, y + 10, 9, 1);
      for (let k = 0; k < 4; k++) {
        b.fillRect(x - 3 + k, y + 1 + k, 7 - k * 2, 1);
        b.fillRect(x - k, y + 6 + k, 1 + k * 2, 1);
      }
      b.fillStyle = '#ffe14d';
      b.fillRect(x - 1 + flip, y + (flip ? 7 : 2), 2, 2);
      R.softGlow(gl, x, y + 5, 7, '#6bb8ff', 0.3);
    }

    // Draw a fighter frame with its feet at (x, y), mirrored when facing left, optionally tinted.
    blit(ctx, fr, x, y, face, tint) {
      const img = tint ? tinted(fr, tint) : fr.c;
      x = Math.round(x);
      y = Math.round(y);
      if (face > 0) ctx.drawImage(img, x - fr.ox, y - fr.oy);
      else {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -fr.ox, -fr.oy);
        ctx.restore();
      }
    }

    drawProj(b, gl, p, t) {
      const s = p.kind === 'ad' ? R.AD : R.TV;
      const x = Math.round(p.x - s.w / 2);
      const y = Math.round(FL + p.y - s.h / 2 + Math.sin(p.t * 14) * 1.5);
      // A short trail of pixels.
      for (let k = 1; k < 5; k++) {
        b.globalAlpha = 0.5 - k * 0.1;
        b.fillStyle = p.kind === 'ad' ? '#ff9ae8' : '#ffb35a';
        b.fillRect(Math.round(p.x - Math.sign(p.vx) * (k * 5 + 6)), y + s.h / 2 - 1 + ((k * 3) % 4) - 2, 3, 2);
      }
      b.globalAlpha = 1;
      if (p.vx < 0) {
        b.save();
        b.translate(x + s.w, y);
        b.scale(-1, 1);
        b.drawImage(s.c, 0, 0);
        b.restore();
      } else b.drawImage(s.c, x, y);
      gl.drawImage(s.g, x, y);
      R.softGlow(gl, p.x, FL + p.y, 14, p.kind === 'ad' ? '#ff3fd2' : '#ff9a2f', 0.35);
    }
  }

  // A silhouette of a frame in one colour, cached.
  const tints = new Map();
  function tinted(fr, col) {
    const key = col;
    let m = tints.get(fr);
    if (!m) {
      m = new Map();
      tints.set(fr, m);
    }
    let c = m.get(key);
    if (!c) {
      const cv = R.canvas(fr.c.width, fr.c.height);
      cv.x.drawImage(fr.c, 0, 0);
      cv.x.globalCompositeOperation = 'source-in';
      cv.x.fillStyle = col;
      cv.x.fillRect(0, 0, cv.w, cv.h);
      c = cv.c;
      m.set(key, c);
    }
    return c;
  }

  R.KView = View;
})();
