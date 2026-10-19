/* Flappy Roadster · view: the Roadster's world drawing on top of the engine's Screen: rain and
   ambience, the cold-gas thrusters, wrecks, the light trail, Ludicrous warp, the zone wipe, and
   the car itself with its tricks. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const G = R.GROUND;
  const fx = R.fx;
  const discSprite = R.discSprite;
  const { gas: GAS, dust: DUST, fire: FIRE, smoke: SMOKE, rainbow: RAINBOW } = R.PAL;

  class View extends R.Screen {
    constructor(canvas) {
      super(canvas);
      this.floor = G;
      this.rain = [];
      this.amb = [];
      this.trail = [];
      this.warp = 0;
      this.zoneA = 0;
      this.zoneB = 0;
      this.zoneT = 1;
      this.trick = null;
      this.skin = 0;
      for (let i = 0; i < 110; i++) this.rain.push(this.newDrop(true));
    }

    reset(zone) {
      super.reset();
      this.trail.length = 0;
      this.warp = 0;
      this.trick = null;
      this.zoneA = this.zoneB = zone || 0;
      this.zoneT = 1;
      this.deadSmoke = 0;
    }

    newDrop(anywhere) {
      return {
        x: fx() * (W + 80),
        y: anywhere ? fx() * G : -10 - fx() * 40,
        vx: 0,
        vy: 0,
        fg: fx() < 0.35,
        len: 3 + Math.floor(fx() * 4),
      };
    }

    // The money shot: cold-gas thrusters. White jets straight down from the corner nozzles,
    // a rear plume, a shock ring, wind lines, rain blown aside, and a ground billow when low.
    thrust(world, power) {
      power = power || 1;
      const car = world.car;
      const skin = R.SKINS[this.skin];
      const noz = skin.shape.nozzles;
      const ca = Math.cos(car.ang);
      const sa = Math.sin(car.ang);
      // Upside down on the tunnel ceiling, "down" jets point up.
      const up = car.roll ? (Math.cos(car.roll) < 0 ? -1 : 1) : 1;
      const dx = -sa * up;
      const dy = ca * up;
      const zone = R.ZONES[this.zoneB];
      const wet = zone.ambient === 'rain' && !world.noRain;
      const space = zone.id === 'orbit';
      const sp = world.speed;
      for (const n of noz.down) {
        const [x, y] = R.carPoint(this.skin, n[0], n[1], car);
        const count = Math.round(12 * power);
        for (let i = 0; i < count; i++) {
          const v = (200 + fx() * 170) * power;
          const spread = (fx() - 0.5) * 56;
          const p = this.puff(x + (fx() - 0.5) * 2, y + fx() * 2, dx * v + spread * ca - sp * 0.35, dy * v + spread * sa, 1 + fx(), space ? 30 : 20 + fx() * 14, space ? 0.3 + fx() * 0.2 : 0.45 + fx() * 0.45, GAS, 0.14);
          if (space) p.drag = 0.6;
        }
        this.add({ k: 'ring', x, y: y + 4 * up, r: 1, vr: 40, t: 0, life: 0.22, col: '#e9f7ff', flat: true });
        this.add({ k: 'jet', x, y, dx, dy, t: 0, life: 0.14, len: 26 * power });
      }
      {
        const [x, y] = R.carPoint(this.skin, noz.rear[0], noz.rear[1], car);
        for (let i = 0; i < 9 * power; i++) {
          const v = 140 + fx() * 150;
          this.puff(x - 1, y + (fx() - 0.5) * 3, -ca * v - sp * 0.5, -sa * v + (fx() - 0.5) * 30, 1, 14 + fx() * 12, 0.35 + fx() * 0.35, GAS, 0.1);
        }
        this.add({ k: 'jet', x, y, dx: -ca, dy: -sa, t: 0, life: 0.1, len: 16 * power });
      }
      // Wind lines streaming past.
      for (let i = 0; i < 10 * power; i++) {
        this.add({ k: 'streak', x: car.x - 26 + fx() * 50, y: car.y - 12 + fx() * 30, vx: -(320 + fx() * 280), t: 0, life: 0.22 + fx() * 0.25, len: 6 + fx() * 16 }, true);
      }
      // Blow the rain away from the nozzles.
      if (wet) {
        for (const d of this.rain) {
          const ex = d.x - car.x;
          const ey = d.y - (car.y + 6);
          const dd = Math.hypot(ex, ey);
          if (dd < 56 && dd > 0.1) {
            const f = (1 - dd / 56) * 420 * power;
            d.vx += (ex / dd) * f;
            d.vy += (ey / dd) * f * 0.6;
          }
        }
      }
      // Ground effect: the jets hit the street (or the tunnel ceiling) and billow out sideways.
      const ceil = up < 0 && world.ceil != null;
      const surf = ceil ? world.ceil : G;
      const h = ceil ? car.y - 8 - surf : G - (car.y + 8);
      if (h < 90 && !space) {
        const s = 1 - Math.max(0, h) / 90;
        const pal = zone.id === 'mars' ? DUST : GAS;
        for (let i = 0; i < 16 * s * power; i++) {
          const dir = fx() < 0.5 ? -1 : 1;
          this.puff(car.x + (fx() - 0.5) * 40, ceil ? surf + 1 + fx() * 3 : G - 1 - fx() * 3, dir * (40 + fx() * 150) - sp * 0.4, (ceil ? 1 : -1) * (4 + fx() * 34), 1.5 + fx() * 2, 8 + fx() * 10, 0.7 + fx() * 0.6, pal, 0.08).drag = 1.6;
        }
        if (zone.id === 'city' && wet) {
          for (let i = 0; i < 14 * s; i++) {
            this.add({ k: 'drop', x: car.x + (fx() - 0.5) * 34, y: G - 1, vx: (fx() - 0.5) * 120 - sp * 0.3, vy: -(60 + fx() * 140), t: 0, life: 0.7, col: fx() < 0.5 ? '#bfe9ff' : '#7fd6ff' }, true);
          }
          this.add({ k: 'ring', x: car.x, y: G + 4, r: 2, vr: 60, t: 0, life: 0.35, col: '#5fe6ff', flat: true });
        }
      }
      this.kickY = Math.min(2.4, this.kickY + 1 * power);
    }

    // Rear thrusters only: the 0-60 launch's cold-gas shove, plus tyre smoke off the line.
    plume(world, power) {
      const car = world.car;
      const noz = R.SKINS[this.skin].shape.nozzles.rear;
      const [x, y] = R.carPoint(this.skin, noz[0], noz[1], car);
      for (let i = 0; i < 10 * power; i++) {
        const v = 160 + fx() * 220;
        this.puff(x - 1, y + (fx() - 0.5) * 4, -v, (fx() - 0.5) * 50, 1.2, 16 + fx() * 18, 0.4 + fx() * 0.5, GAS, 0.14);
      }
      this.add({ k: 'jet', x, y, dx: -1, dy: 0, t: 0, life: 0.08, len: 22 * power });
      for (let i = 0; i < 3 * power; i++) this.puff(car.x - 16 + fx() * 8, G - 2, -(30 + fx() * 70), -(4 + fx() * 12), 1.5, 10 + fx() * 8, 0.6 + fx() * 0.5, SMOKE, 0.02).drag = 1.4;
      for (let i = 0; i < 4 * power; i++) this.add({ k: 'streak', x: car.x - 30 + fx() * 60, y: car.y - 14 + fx() * 24, vx: -(380 + fx() * 300), t: 0, life: 0.2 + fx() * 0.2, len: 8 + fx() * 18 }, true);
      this.kickY = Math.min(2.4, this.kickY + 0.3 * power);
    }

    // A car in pieces: wheels bounce away, glass and body shards, sparks and smoke.
    wreck(world, e) {
      const car = world.car;
      const skin = R.SKINS[this.skin];
      const pal = skin.pal;
      const wheel = R.canvas(7, 7);
      const wr = ['..TTT..', '.TDDDT.', 'TDDdDDT', 'TDdKdDT', 'TDDdDDT', '.TDDDT.', '..TTT..'];
      const wp = { T: '#0e0d12', D: '#c9ccd3', d: '#3a3942', K: '#16151b' };
      wr.forEach((row, y) => {
        for (let x = 0; x < 7; x++)
          if (row[x] !== '.') {
            wheel.x.fillStyle = wp[row[x]];
            wheel.x.fillRect(x, y, 1, 1);
          }
      });
      for (const n of skin.shape.wheels) {
        const [x, y] = R.carPoint(this.skin, n[0], n[1], car);
        this.chunk(wheel.c, x, y, (n[0] > 20 ? 1 : -1) * (40 + fx() * 80), -(120 + fx() * 140), (fx() - 0.5) * 30, 4, 0.55);
      }
      const body = [pal.W, pal.h, pal.w, '#16151b', '#16151b'];
      for (let i = 0; i < 18; i++) {
        const c = R.canvas(2 + Math.floor(fx() * 3), 1 + Math.floor(fx() * 2));
        c.x.fillStyle = body[Math.floor(fx() * body.length)];
        c.x.fillRect(0, 0, c.w, c.h);
        this.chunk(c.c, car.x + (fx() - 0.5) * 30, car.y + (fx() - 0.5) * 8, (fx() - 0.5) * 220, -(60 + fx() * 200), (fx() - 0.5) * 20, 3, 0.35);
      }
      for (let i = 0; i < 26; i++) {
        this.add({ k: 'spark', x: car.x + 10, y: car.y, px: car.x, py: car.y, vx: (fx() - 0.3) * 300, vy: (fx() - 0.7) * 300, t: 0, life: 0.3 + fx() * 0.6, col: fx() < 0.5 ? '#bff6ff' : '#ffffff', g: 500 }, true);
      }
      this.burst(car.x + 12, car.y, 30, ['#ffffff', '#fff1a8', '#ffb347', '#2ef6ff'], 260, 0.7, 260);
      for (let i = 0; i < 10; i++) this.puff(car.x + (fx() - 0.5) * 20, car.y + (fx() - 0.5) * 10, (fx() - 0.5) * 60, -20 - fx() * 40, 2, 10 + fx() * 10, 1 + fx(), e.kind === 'ground' && R.ZONES[this.zoneB].id === 'orbit' ? FIRE : SMOKE, 0.05);
      this.deadSmoke = 3;
    }

    smash(world, e) {
      const cols = ['#2ef6ff', '#ff3fd2', '#ffd93b', '#7dff6b'];
      for (let i = 0; i < 26; i++) {
        const c = R.canvas(2 + Math.floor(fx() * 4), 2 + Math.floor(fx() * 3));
        c.x.fillStyle = fx() < 0.35 ? cols[e.pipe.hue] : fx() < 0.5 ? '#2b2346' : '#18102c';
        c.x.fillRect(0, 0, c.w, c.h);
        this.chunk(c.c, e.x + fx() * 20, e.y + (fx() - 0.5) * 30, 60 + fx() * 260, (fx() - 0.6) * 260, (fx() - 0.5) * 24, 2.2, 0.3);
      }
      this.burst(e.x, e.y, 24, ['#ffffff', cols[e.pipe.hue], '#ffe14d'], 240, 0.5, 200);
    }

    // ---------------- per-frame update ----------------
    update(dt, world, t) {
      const sp = world.speed;
      this.step(dt, sp);

      // Wreck keeps smoking.
      if (world.state === 'dead' && this.deadSmoke > 0) {
        this.deadSmoke -= dt;
        if (fx() < dt * 18) {
          const pal = R.ZONES[this.zoneB].id === 'orbit' && world.deathKind === 'ground' ? FIRE : SMOKE;
          this.puff(world.car.x + (fx() - 0.5) * 10, world.car.y - 2, (fx() - 0.5) * 10, -20 - fx() * 20, 1.5, 9, 1.2, pal, 0.04).drag = 1;
        }
      }

      // Rain (Giga City only), pushed around by thruster wind.
      const zone = R.ZONES[this.zoneB];
      const raining = zone.ambient === 'rain' || R.ZONES[this.zoneA].ambient === 'rain';
      for (const d of this.rain) {
        const bx = -(sp * (d.fg ? 0.9 : 0.5) + 40);
        const by = d.fg ? 330 : 250;
        d.vx = R.approach(d.vx, bx, 3, dt);
        d.vy = R.approach(d.vy, by, 3, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y > G || d.x < -10 || d.x > W + 90 || d.y < -60) {
          if (d.y > G && d.x > 0 && d.x < W && fx() < 0.5 && raining) this.add({ k: 'drop', x: d.x, y: G - 1, vx: (fx() - 0.5) * 40, vy: -40 - fx() * 50, t: 0, life: 0.3, col: '#9fc8ff' });
          Object.assign(d, this.newDrop(false));
          d.vx = bx;
          d.vy = by;
          d.off = !raining;
        }
      }

      // Other ambience: wind wisps above the clouds, dust on Mars, specks in orbit.
      const want = zone.ambient === 'wind' ? 6 : zone.ambient === 'dust' ? 40 : zone.ambient === 'space' ? 24 : 0;
      while (this.amb.length < want) this.amb.push({ x: W + fx() * W, y: fx() * G, v: 0.6 + fx() * 1.4, kind: zone.ambient, len: 8 + fx() * 24 });
      for (let i = this.amb.length - 1; i >= 0; i--) {
        const a = this.amb[i];
        const mul = a.kind === 'wind' ? 2.4 : a.kind === 'dust' ? 1.6 : 0.15;
        a.x -= (sp * mul * a.v + (a.kind === 'dust' ? 30 : 0)) * dt;
        if (a.kind === 'dust') a.y += Math.sin(t * 3 + a.x * 0.05) * 10 * dt;
        if (a.x < -30) {
          if (a.kind !== zone.ambient || this.amb.length > want) this.amb.splice(i, 1);
          else {
            a.x = W + fx() * 40;
            a.y = fx() * G;
          }
        }
      }

      // Light trail: the tail light's recent path, carried left by the scroll.
      for (const p of this.trail) p.x -= sp * dt;
      while (this.trail.length && this.trail[0].x < -10) this.trail.shift();
      if (world.car.alive && world.state !== 'title') {
        const noz = R.SKINS[this.skin].shape.nozzles.rear;
        const [x, y] = R.carPoint(this.skin, noz[0], noz[1] - 3, world.car);
        this.trail.push({ x, y, h: (t * 2) % 1 });
        if (this.trail.length > 46) this.trail.shift();
      }

      if (this.warp > 0) this.warp = Math.max(0, this.warp - dt);
      if (this.zoneT < 1) {
        this.zoneT = Math.min(1, this.zoneT + dt / 1.5);
        if (this.zoneT >= 1) this.zoneA = this.zoneB;
      }
      if (this.trick) {
        this.trick.t += dt;
        if (this.trick.t >= this.trick.dur) this.trick = null;
      }
      R.zone(this.zoneB).update(dt, sp);
      if (this.zoneA !== this.zoneB) R.zone(this.zoneA).update(dt, sp);
    }

    // ---------------- drawing ----------------
    drawWorld(world, t) {
      const b = this.base.x;
      const gl = this.glow.x;
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
      gl.fillStyle = '#000';
      gl.fillRect(0, 0, W, H);
      const dist = world.dist;
      const wipe = this.zoneT < 1 ? Math.round(W * (1 - R.easeInOut(this.zoneT))) : 0;
      const za = R.zone(this.zoneA);
      const zb = R.zone(this.zoneB);

      // Backgrounds: the old zone, then the new one wiping in from the right. A game mode can
      // bring its own set (the tunnel), and add layers in front of it, under or over the car.
      if (world.drawBack) world.drawBack(this, b, gl, t);
      else if (this.zoneT < 1) {
        za.drawBack(b, gl, dist, t);
        this.clip(b, gl, wipe, () => zb.drawBack(b, gl, dist, t));
      } else zb.drawBack(b, gl, dist, t);

      if (this.warp > 0) this.drawWarp(b, gl, t);

      // Background rain.
      if (!world.noRain) {
        this.drawRain(b, gl, false);
        this.drawAmbient(b, gl);
      }

      // Pipes.
      for (const p of world.pipes) {
        if (p.x > W + 4 || p.x + R.CAP_W < -4) continue;
        R.drawPipe(b, gl, p);
        if (p.bolt && !p.bolt.taken) {
          const s = R.BOLT[Math.floor(t * 6) % 2];
          const bx = Math.round(p.x + R.PIPE_W / 2 - 4);
          const by = Math.round(p.gapY + p.bolt.dy - 4 + Math.sin(t * 5 + p.id) * 2);
          R.softGlow(gl, bx + 4, by + 4, 9, '#ffe14d', 0.5);
          b.drawImage(s.c, bx, by);
          gl.drawImage(s.g, bx, by);
        }
      }

      if (world.drawMid) world.drawMid(this, b, gl, t);

      // Trail, puffs, car, sparks.
      this.drawTrail(b, gl, world);
      this.drawParts(b, gl, this.parts);
      this.drawCar(b, gl, world, t);
      this.drawParts(b, gl, this.front);

      // Ground, wiping like the background; Giga City's wet street reflects the scene.
      if (world.drawGround) world.drawGround(this, b, gl, t);
      else if (this.zoneT < 1) {
        this.drawGround(za, b, gl, dist, t, 0);
        this.clip(b, gl, wipe, () => this.drawGround(zb, b, gl, dist, t, wipe));
        // The seam: a bright neon line sweeping across.
        gl.fillStyle = '#ffffff';
        gl.fillRect(wipe - 1, 0, 2, H);
        b.fillStyle = '#ffffff';
        b.globalAlpha = 0.6;
        b.fillRect(wipe, 0, 1, H);
        b.globalAlpha = 1;
      } else this.drawGround(zb, b, gl, dist, t, 0);
      if (world.drawTop) world.drawTop(this, b, gl, t);

      if (!world.noRain) this.drawRain(b, gl, true);
    }

    drawGround(z, b, gl, dist, t) {
      z.ground(b, gl, dist, t);
      if (z.reflect && !this.lite) this.reflect(b, gl, t, G);
      z.groundTop(b, gl, dist, t);
    }

    drawRain(b, gl, fg) {
      for (const d of this.rain) {
        if (d.fg !== fg || d.off) continue;
        const k = 0.012 * d.len;
        const x0 = Math.round(d.x);
        const y0 = Math.round(d.y);
        const x1 = Math.round(d.x - d.vx * k);
        const y1 = Math.round(d.y - d.vy * k);
        b.strokeStyle = fg ? 'rgba(200,185,255,0.55)' : 'rgba(140,120,220,0.35)';
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(x0 + 0.5, y0 + 0.5);
        b.lineTo(x1 + 0.5, y1 + 0.5);
        b.stroke();
        if (fg) {
          gl.strokeStyle = 'rgba(150,130,255,0.25)';
          gl.beginPath();
          gl.moveTo(x0 + 0.5, y0 + 0.5);
          gl.lineTo(x1 + 0.5, y1 + 0.5);
          gl.stroke();
        }
      }
    }

    drawAmbient(b) {
      for (const a of this.amb) {
        const x = Math.round(a.x);
        const y = Math.round(a.y);
        if (a.kind === 'wind') {
          b.fillStyle = 'rgba(255,230,240,0.22)';
          b.fillRect(x, y, Math.round(a.len), 1);
        } else if (a.kind === 'dust') {
          b.fillStyle = a.v > 1.4 ? '#e8a070' : '#b9663e';
          b.fillRect(x, y, a.v > 1.6 ? 2 : 1, 1);
        } else {
          b.fillStyle = '#5d6488';
          b.fillRect(x, y, 1, 1);
        }
      }
    }

    // Ludicrous: star streaks rushing past.
    drawWarp(b, gl, t) {
      const n = 40;
      const a = Math.min(1, this.warp * 2);
      for (let i = 0; i < n; i++) {
        const y = ((i * 97) % G) + ((i * 13) % 7);
        const len = 20 + ((i * 37) % 50);
        const x = W - ((t * (500 + ((i * 53) % 400)) + i * 61) % (W + len * 2));
        const col = RAINBOW[i % RAINBOW.length];
        gl.globalAlpha = 0.7 * a;
        gl.fillStyle = col;
        gl.fillRect(Math.round(x), y, len, 1);
        b.globalAlpha = 0.5 * a;
        b.fillStyle = '#ffffff';
        b.fillRect(Math.round(x), y, len, 1);
      }
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
    }

    drawTrail(b, gl, world) {
      const tr = this.trail;
      if (tr.length < 2) return;
      const ludi = world.ludi > 0;
      for (let i = 1; i < tr.length; i++) {
        const p0 = tr[i - 1];
        const p1 = tr[i];
        const a = i / tr.length;
        const col = ludi ? RAINBOW[(i + Math.floor(world.t * 20)) % RAINBOW.length] : '#ff2238';
        gl.strokeStyle = col;
        gl.globalAlpha = a * (ludi ? 0.95 : 0.6);
        gl.lineWidth = ludi ? 3 : 1;
        gl.beginPath();
        gl.moveTo(p0.x, p0.y + 0.5);
        gl.lineTo(p1.x, p1.y + 0.5);
        gl.stroke();
        if (ludi) {
          b.strokeStyle = col;
          b.globalAlpha = a * 0.8;
          b.lineWidth = 2;
          b.beginPath();
          b.moveTo(p0.x, p0.y + 0.5);
          b.lineTo(p1.x, p1.y + 0.5);
          b.stroke();
        }
      }
      gl.globalAlpha = 1;
      gl.lineWidth = 1;
      b.globalAlpha = 1;
      b.lineWidth = 1;
    }

    drawCar(b, gl, world, t) {
      const car = world.car;
      const skin = R.SKINS[this.skin];
      const hasWing = !!skin.shape.wings;
      // The active wing pops up on every flap: a literal flap.
      let wing = 0;
      if (hasWing && car.alive && world.state === 'play') wing = car.flapT < 0.12 ? 2 : car.flapT < 0.24 ? 1 : 0;
      if (hasWing && world.state === 'intro') wing = world.stateT > 0.35 ? 2 : 1;
      if (world.ludi > 0 && hasWing) wing = 2;
      if (hasWing && world.phase === 'launch') wing = 2;
      const blink = world.invuln > 0 && Math.floor(t * 14) % 2 === 0;

      // Headlight beam into the rain.
      const zid = R.ZONES[this.zoneB].id;
      if (car.alive && (zid === 'city' || zid === 'skyway')) {
        const sh = skin.shape;
        const [hx, hy] = R.carPoint(this.skin, sh.w - 1, sh.nozzles.rear[1] - 2, car);
        gl.save();
        gl.globalAlpha = 0.14;
        gl.fillStyle = '#e8f4ff';
        gl.beginPath();
        gl.moveTo(hx, hy);
        gl.lineTo(hx + Math.cos(car.ang - 0.16) * 70, hy + Math.sin(car.ang - 0.16) * 70);
        gl.lineTo(hx + Math.cos(car.ang + 0.2) * 70, hy + Math.sin(car.ang + 0.2) * 70);
        gl.fill();
        gl.restore();
      }

      const x = Math.round(car.x);
      const y = Math.round(car.y);
      if (world.kind) this.drawRoadCar(b, gl, world, t, x, y, wing, blink);
      else if (this.trick || world.state === 'title') {
        // Tricks and the parked car use a direct transform: kickflip squashes the roll axis,
        // loop adds a full turn of pitch.
        const spr = R.carSprite(this.skin, wing, world.state === 'title' || world.state === 'intro' ? Math.floor(t * 12) % 2 : 0);
        let ang = car.ang;
        let sy = 1;
        if (this.trick) {
          const u = this.trick.t / this.trick.dur;
          if (this.trick.type === 'kickflip') sy = Math.cos(R.easeInOut(u) * Math.PI * 2);
          else ang += R.easeInOut(u) * Math.PI * 2 * (this.trick.dir || 1);
        }
        for (const [ctx, img, a] of [
          [b, spr.base, blink ? 0.35 : 1],
          [gl, spr.glow, 1],
        ]) {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(x, y);
          ctx.rotate(ang);
          ctx.scale(1, Math.abs(sy) < 0.12 ? 0.12 * Math.sign(sy || 1) : sy);
          ctx.drawImage(img, -spr.cx, -spr.cy);
          ctx.restore();
        }
        if (this.trick && this.trick.type === 'kickflip' && Math.abs(sy) < 0.5) {
          // Mid-flip we see the underside: nozzles glowing.
          gl.fillStyle = '#bff6ff';
          for (const n of skin.shape.nozzles.down) {
            const [nx, ny] = R.carPoint(this.skin, n[0], skin.shape.h / 2, car);
            gl.fillRect(Math.round(nx) - 1, Math.round(ny), 3, 1);
          }
        }
      } else {
        const r = R.carRotated(this.skin, wing, car.ang);
        b.globalAlpha = blink ? 0.35 : 1;
        b.drawImage(r.base, Math.round(x - r.ox), Math.round(y - r.oy));
        b.globalAlpha = 1;
        gl.drawImage(r.glow, Math.round(x - r.ox), Math.round(y - r.oy));
        if (world.ludi > 0) {
          gl.globalAlpha = 0.5 + Math.sin(t * 30) * 0.2;
          gl.drawImage(r.base, Math.round(x - r.ox), Math.round(y - r.oy));
          gl.globalAlpha = 1;
        }
      }

      // Nozzles glow right after a flap.
      if (car.alive && car.flapT < 0.18 && world.state === 'play') {
        const a = 1 - car.flapT / 0.18;
        const noz = skin.shape.nozzles;
        for (const n of noz.down.concat([noz.rear])) {
          const [nx, ny] = R.carPoint(this.skin, n[0], n[1], car);
          gl.globalAlpha = a;
          gl.drawImage(discSprite(2, '#bff6ff'), Math.round(nx) - 2, Math.round(ny) - 2);
          b.globalAlpha = a;
          b.fillStyle = '#ffffff';
          b.fillRect(Math.round(nx), Math.round(ny), 1, 1);
        }
        gl.globalAlpha = 1;
        b.globalAlpha = 1;
      }
      // Re-entry glow when skimming the atmosphere in orbit.
      if (zid === 'orbit' && car.y > G - 50) {
        const a = R.clamp((car.y - (G - 50)) / 40, 0, 1);
        R.softGlow(gl, x, y + 6, 22, '#ff6a2a', 0.6 * a);
      }
    }

    // The road games' car: wheels turn while it drives, pitch comes from the RotSprite cache, and
    // kickflips and tunnel barrel rolls squash it top to bottom (the cosine of the roll).
    drawRoadCar(b, gl, world, t, x, y, wing, blink) {
      const car = world.car;
      const skin = R.SKINS[this.skin];
      let sy = car.roll ? Math.cos(car.roll) : 1;
      if (car.trickP != null) sy = Math.cos(R.easeInOut(Math.min(1, car.trickP)) * Math.PI * 2);
      const driving = car.alive && (car.on !== undefined ? !!car.on : world.phase === 'launch' || world.state === 'title');
      const frame = driving ? Math.floor((world.dist + car.x) / 4) % 2 : 0;
      let img;
      if (Math.abs(car.ang) < 2.5 * R.DEG) {
        const spr = R.carSprite(this.skin, wing, frame);
        img = { base: spr.base, glow: spr.glow, ox: spr.cx, oy: spr.cy };
      } else img = R.carRotated(this.skin, wing, car.ang);
      const s = Math.abs(sy) < 0.12 ? 0.12 * Math.sign(sy || 1) : sy;
      for (const [ctx, im, a] of [
        [b, img.base, blink ? 0.35 : 1],
        [gl, img.glow, 1],
      ]) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(x, y);
        ctx.scale(1, s);
        ctx.drawImage(im, -Math.round(img.ox), -Math.round(img.oy));
        ctx.restore();
      }
      if (Math.abs(sy) < 0.5) {
        // Mid-roll we see the underside: nozzles glowing.
        gl.fillStyle = '#bff6ff';
        for (const n of skin.shape.nozzles.down) {
          const [nx, ny] = R.carPoint(this.skin, n[0], skin.shape.h / 2, car);
          gl.fillRect(Math.round(nx) - 1, Math.round(ny), 3, 1);
        }
      }
      if (world.ludi > 0) {
        gl.save();
        gl.globalAlpha = 0.5 + Math.sin(t * 30) * 0.2;
        gl.translate(x, y);
        gl.scale(1, s);
        gl.drawImage(img.base, -Math.round(img.ox), -Math.round(img.oy));
        gl.restore();
      }
    }

    // The camera follows the car.
    present(world, uiDraw) {
      this.focus[0] = R.CAR_X + 24;
      this.focus[1] = R.clamp(world.car.y, 0, H);
      super.present(uiDraw);
    }
  }
  R.View = View;
})();
