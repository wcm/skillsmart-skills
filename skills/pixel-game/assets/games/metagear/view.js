/* Meta Gear Solid · view: the rooms seen from above. Each room's floor with an aisle runner along
   the path, the doors between rooms with a neon sign, the furniture, the guests' cones of view
   (warm, turning red when they're seeing you) and the rings of glasses that woke up on their
   own, everyone sorted by depth, the box, the bubbles over heads and the dust of footsteps. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const MG = R.MG;
  const TAU = Math.PI * 2;
  const fx = R.fx;

  // A cheap hash for floor speckles and petals, so they stay put as the floor scrolls.
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const zoneAt = (d) => R.ZONES[(Math.floor(d / MG.ROOM) % R.ZONES.length + R.ZONES.length) % R.ZONES.length];
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // Which way a sprite faces for a cone angle: 0 down, 1 right, 2 up, 3 left.
  const facingOf = (a) => [1, 0, 3, 2][Math.round((((a % TAU) + TAU) % TAU) / (Math.PI / 2)) % 4];

  class View extends R.Screen {
    constructor(canvas) {
      super(canvas);
      this.dropT = 1; // the box landing
      this.liftT = -1; // the box flying off when you're caught
    }
    reset() {
      super.reset();
      this.dropT = 1;
      this.liftT = -1;
    }

    sy(w, d) {
      return MG.PY - (d - w.d);
    }

    // ---------------- events ----------------
    onBox() {
      this.dropT = 0;
    }
    onStep(w) {
      const x = R.pathX(w.d);
      for (let i = 0; i < 2; i++) this.puff(x + (fx() - 0.5) * 8, MG.PY, (fx() - 0.5) * 16, 4 + fx() * 8, 1, 3, 0.35, R.PAL.dust, 0);
    }
    onCaught(w) {
      if (w.boxed) this.liftT = 0;
    }

    update(dt, w) {
      this.step(dt, 0);
      this.dropT = Math.min(1, this.dropT + dt / 0.14);
      if (this.liftT >= 0) this.liftT += dt;
    }

    // ---------------- drawing ----------------
    drawWorld(w, t, o) {
      o = o || {};
      const b = this.base.x;
      const gl = this.glow.x;
      b.globalAlpha = 1;
      gl.globalAlpha = 1;
      gl.fillStyle = '#000';
      gl.fillRect(0, 0, W, H);
      this.drawFloor(b, gl, w, t);
      this.drawDoors(b, gl, w, t);
      // Cones and rings under everyone.
      const guests = w.guests.filter((g) => {
        const y = this.sy(w, g.d);
        return y > -110 && y < H + 110;
      });
      for (const g of guests) this.drawView(b, gl, w, g, t);
      // Furniture, guests and the sneaker, by depth.
      const items = [];
      for (const dc of w.decor) {
        const y = this.sy(w, dc.d);
        if (y > -40 && y < H + 40) items.push({ y, f: () => R.drawDecor(b, gl, dc, dc.x, y, t) });
      }
      for (const g of guests) items.push({ y: this.sy(w, g.d), f: () => this.drawGuest(b, gl, w, g, t) });
      if (!o.noPlayer) items.push({ y: MG.PY + 0.5, f: () => this.drawPlayer(b, gl, w, t) });
      items.sort((p, q) => p.y - q.y);
      for (const it of items) it.f();
      this.drawParts(b, gl, this.parts);
      for (const g of guests) this.drawBubble(b, gl, w, g, t);
      this.drawParts(b, gl, this.front);
    }

    drawFloor(b, gl, w, t) {
      // Rows of 2 px, each in the zone of the room it's in.
      for (let y = 0; y < H; y += 2) {
        const d = w.d + (MG.PY - y);
        if (d < 0) {
          // Outside the front door: a doormat, the sidewalk, the kerb, the street.
          const px = R.pathX(0);
          if (d > -8) {
            b.fillStyle = '#3a2a22';
            b.fillRect(0, y, W, 2);
            b.fillStyle = '#7a5a3a';
            b.fillRect(Math.round(px - 14), y, 28, 2);
          } else if (d > -44) {
            b.fillStyle = Math.floor(-d / 12) % 2 ? '#7c7c88' : '#84848f';
            b.fillRect(0, y, W, 2);
            b.fillStyle = '#6a6a76';
            for (let x = (Math.floor(-d / 12) % 2) * 6; x < W; x += 12) b.fillRect(x, y, 1, 2);
          } else if (d > -48) {
            b.fillStyle = '#b4b4bc';
            b.fillRect(0, y, W, 2);
          } else {
            b.fillStyle = '#26262c';
            b.fillRect(0, y, W, 2);
            if (Math.floor(-d) % 40 < 2 && -d > 70) {
              b.fillStyle = '#c8a83a';
              for (let x = 4; x < W; x += 24) b.fillRect(x, y, 12, 1);
            }
          }
          continue;
        }
        const z = zoneAt(d).id;
        const row = Math.floor(d / 2);
        const px = R.pathX(d);
        if (z === 'cafe') {
          // Wood planks, 8 px wide, seams staggered per plank row.
          const plank = Math.floor(d / 8);
          b.fillStyle = plank % 2 ? '#5c3b25' : '#664229';
          b.fillRect(0, y, W, 2);
          if (Math.floor(d) % 8 < 2) {
            b.fillStyle = '#4a2e1c';
            b.fillRect(0, y, W, 1);
          }
          b.fillStyle = '#4a2e1c';
          for (let x = (plank * 37) % 48; x < W; x += 48) b.fillRect(x, y, 1, 2);
        } else if (z === 'gym') {
          b.fillStyle = '#25252d';
          b.fillRect(0, y, W, 2);
          if (Math.floor(d) % 24 < 2) {
            b.fillStyle = '#1c1c22';
            b.fillRect(0, y, W, 1);
          }
          b.fillStyle = '#1c1c22';
          for (let x = 0; x < W; x += 24) b.fillRect(x, y, 1, 2);
          b.fillStyle = '#33333d';
          for (let k = 0; k < 4; k++) {
            const hx = Math.floor(hash(row, k) * W);
            b.fillRect(hx, y, 1, 1);
          }
        } else if (z === 'wedding') {
          b.fillStyle = (Math.floor(d / 6) + 0) % 2 ? '#e6ddd0' : '#e9e1d5';
          b.fillRect(0, y, W, 2);
          b.fillStyle = '#ddd2c2';
          for (let x = (Math.floor(d / 12) % 2) * 12; x < W; x += 24) b.fillRect(x, y, 2, 1);
        } else {
          b.fillStyle = '#273766';
          b.fillRect(0, y, W, 2);
          if (Math.floor(d) % 16 < 2) {
            b.fillStyle = '#22305a';
            b.fillRect(0, y, W, 1);
          }
          b.fillStyle = '#22305a';
          for (let x = 0; x < W; x += 16) b.fillRect(x, y, 1, 2);
        }
        // The aisle runner along the path.
        const rx = Math.round(px - 13);
        if (z === 'cafe') {
          b.fillStyle = '#8a4a32';
          b.fillRect(rx, y, 26, 2);
          b.fillStyle = '#a65e3e';
          b.fillRect(rx + 2, y, 2, 2);
          b.fillRect(rx + 22, y, 2, 2);
          if (Math.floor(d) % 10 < 2) {
            b.fillStyle = '#7a3e28';
            b.fillRect(rx + 6, y, 14, 1);
          }
        } else if (z === 'gym') {
          b.fillStyle = '#34343f';
          b.fillRect(rx, y, 26, 2);
          if (Math.floor(d) % 12 < 6) {
            b.fillStyle = '#c8a83a';
            b.fillRect(rx, y, 1, 2);
            b.fillRect(rx + 25, y, 1, 2);
          }
        } else if (z === 'wedding') {
          b.fillStyle = '#a8203a';
          b.fillRect(rx, y, 26, 2);
          b.fillStyle = '#d8b060';
          b.fillRect(rx, y, 1, 2);
          b.fillRect(rx + 25, y, 1, 2);
          // Petals.
          if (hash(row, 7) < 0.18) {
            b.fillStyle = hash(row, 8) < 0.5 ? '#ffffff' : '#ff9ab8';
            b.fillRect(rx + 3 + Math.floor(hash(row, 9) * 20), y, 2, 1);
          }
        } else {
          b.fillStyle = '#34488a';
          b.fillRect(rx, y, 26, 2);
          b.fillStyle = '#2ef6ff';
          b.fillRect(rx, y, 1, 2);
          b.fillRect(rx + 25, y, 1, 2);
          gl.fillStyle = '#0a5a66';
          gl.fillRect(rx, y, 1, 2);
          gl.fillRect(rx + 25, y, 1, 2);
        }
      }
      // A soft vignette of lamplight down the middle.
      gl.globalAlpha = 0.05;
      gl.fillStyle = '#ffe9c0';
      gl.fillRect(W / 2 - 50, 0, 100, H);
      gl.globalAlpha = 1;
    }

    // The wall and door at the start of every room, with the room's name in neon over the door.
    drawDoors(b, gl, w, t) {
      for (let k = Math.max(0, Math.floor((w.d - 120) / MG.ROOM)); k * MG.ROOM < w.d + MG.PY + 40; k++) {
        const d = k * MG.ROOM;
        const y = Math.round(this.sy(w, d));
        if (y < -40 || y > H + 20) continue;
        const z = R.ZONES[k % R.ZONES.length];
        const px = Math.round(R.pathX(d));
        b.fillStyle = '#17121f';
        b.fillRect(0, y - 12, px - 18, 12);
        b.fillRect(px + 18, y - 12, W - px - 18, 12);
        b.fillStyle = '#2a2236';
        b.fillRect(0, y - 12, px - 18, 2);
        b.fillRect(px + 18, y - 12, W - px - 18, 2);
        // The door frame.
        b.fillStyle = '#4a3c5c';
        b.fillRect(px - 20, y - 14, 3, 14);
        b.fillRect(px + 17, y - 14, 3, 14);
        b.fillStyle = 'rgba(0,0,0,0.3)';
        b.fillRect(px - 17, y - 2, 34, 2);
        // The sign.
        const name = k === 0 ? 'FRONT DOOR' : z.name;
        const col = { cafe: '#ffb35a', gym: '#3aff9a', wedding: '#ff8ab8', expo: '#2ef6ff' }[z.id];
        const flick = Math.floor(t * 7 + k) % 23 === 0;
        R.text(b, name, px, y - 24, { font: 'small', color: flick ? '#5a5a66' : col, align: 'center', outline: '#07050c' });
        if (!flick) R.text(gl, name, px, y - 24, { font: 'small', color: col, align: 'center' });
      }
    }

    // A guest's cone of view and, when their glasses woke up, the ring they hear in.
    drawView(b, gl, w, g, t) {
      const p = g.pose(w.t);
      const x = p.x;
      const y = this.sy(w, p.d) - 10;
      const seeing = g.spot > 0 || (w.catcher === g && w.why !== 'heard');
      const warn = p.warn && Math.floor(t * 12) % 2;
      const a = p.a;
      const wedge = (ctx, r) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, a - MG.CONE, a + MG.CONE);
        ctx.closePath();
      };
      // On the cream carpet of the wedding a light cone vanishes: use amber there.
      const light = zoneAt(p.d).id === 'wedding';
      const col = seeing ? '#ff3b5c' : light ? '#ff8a2a' : '#fff1c4';
      b.save();
      gl.save();
      // A patroller's walkway, painted across the floor: no place to leave a box.
      if (g.kind === 'patrol') {
        const x0 = Math.min(g.x, g.x1) - 6;
        const x1 = Math.max(g.x, g.x1) + 6;
        const ly = Math.round(this.sy(w, g.d));
        b.globalAlpha = light ? 0.1 : 0.07;
        b.fillStyle = light ? '#7a4a20' : '#ffffff';
        b.fillRect(x0, ly - 9, x1 - x0, 15);
        b.globalAlpha = light ? 0.4 : 0.25;
        for (let xx = x0; xx < x1; xx += 6) {
          b.fillRect(xx, ly - 9, 3, 1);
          b.fillRect(xx, ly + 5, 3, 1);
        }
      }
      // Where someone facing the wall will look when they turn round.
      if (g.kind === 'turn' && Math.abs(wrapA(a - g.base)) > 0.2) {
        b.globalAlpha = p.warn ? 0.6 : 0.22;
        b.strokeStyle = light ? '#b05a1a' : '#fff1c4';
        b.setLineDash([2, 3]);
        b.beginPath();
        b.moveTo(x, y);
        b.arc(x, y, g.range, g.base - MG.CONE, g.base + MG.CONE);
        b.closePath();
        b.stroke();
        b.setLineDash([]);
      }
      b.globalAlpha = seeing ? 0.26 : warn ? 0.05 : light ? 0.16 : 0.11;
      b.fillStyle = col;
      wedge(b, g.range);
      b.fill();
      b.globalAlpha = seeing ? 0.7 : light ? 0.55 : 0.28;
      b.strokeStyle = col;
      b.lineWidth = 1;
      b.stroke();
      gl.globalAlpha = seeing ? 0.3 : 0.09;
      gl.fillStyle = seeing ? '#ff2a4a' : '#ffd88a';
      wedge(gl, g.range);
      gl.fill();
      // Woken glasses listening: a ring, and sound waves running out to it.
      if (p.wakeWarn || p.wake) {
        const cy = this.sy(w, p.d) - 6;
        b.globalAlpha = p.wake ? 0.8 : 0.35 + 0.35 * (Math.floor(t * 10) % 2);
        b.strokeStyle = '#ff3fd2';
        b.setLineDash(p.wake ? [] : [3, 3]);
        b.beginPath();
        b.arc(x, cy, p.wake ? Math.max(1, p.ring) : MG.RING, 0, TAU);
        b.stroke();
        b.setLineDash([]);
        if (p.wake) {
          b.globalAlpha = 0.09;
          b.fillStyle = '#ff3fd2';
          b.fill();
          for (let k = 0; k < 3; k++) {
            const r = ((t * 40 + k * 15) % 45) + 1;
            if (r > p.ring) continue;
            b.globalAlpha = 0.4 * (1 - r / 45);
            b.beginPath();
            b.arc(x, cy, r, 0, TAU);
            b.stroke();
          }
          gl.globalAlpha = 0.25;
          gl.strokeStyle = '#ff3fd2';
          gl.beginPath();
          gl.arc(x, cy, Math.max(1, p.ring), 0, TAU);
          gl.stroke();
        }
      }
      b.restore();
      gl.restore();
    }

    drawGuest(b, gl, w, g, t) {
      const p = g.pose(w.t);
      const y = Math.round(this.sy(w, p.d));
      let x = Math.round(p.x);
      if (p.warn) x += Math.floor(t * 16) % 2 ? 1 : -1; // the shuffle before turning round
      const facing = facingOf(p.a);
      const step = g.kind === 'patrol' ? (p.moving ? Math.floor(t * 6) % 2 : 0) : g.kind === 'spin' ? Math.floor(t * 3) % 2 : 0;
      const bob = g.kind === 'spin' ? Math.round(Math.sin(t * 8 + g.id) * 1) : 0;
      const fr = R.guestFrame(g, facing, step);
      b.fillStyle = 'rgba(0,0,0,0.3)';
      b.beginPath();
      b.ellipse(x, y, 6, 2, 0, 0, TAU);
      b.fill();
      b.drawImage(fr.c, x - fr.ox, y - fr.oy + bob);
      // The capture LED lights while the glasses record.
      const rec = p.wake || w.catcher === g || g.spot > 0.5;
      if (fr.led && rec) {
        const lx = x + fr.led[0];
        const ly = y + fr.led[1] + bob;
        const on = w.catcher === g || Math.floor(t * 6) % 3 !== 0;
        if (on) {
          b.fillStyle = '#ffffff';
          b.fillRect(lx, ly, 1, 1);
          R.softGlow(gl, lx + 0.5, ly + 0.5, 6, '#ffffff', 0.9);
        }
      }
    }

    drawPlayer(b, gl, w, t) {
      const x = Math.round(R.pathX(w.d));
      const y = MG.PY;
      b.fillStyle = 'rgba(0,0,0,0.32)';
      b.beginPath();
      b.ellipse(x, y, 8, 2.5, 0, 0, TAU);
      b.fill();
      const caught = w.state === 'caught' || w.state === 'dead';
      if (w.boxed && !caught) {
        // The box lands with a squash.
        const u = this.dropT;
        const sq = u < 1 ? 1 + Math.sin(u * Math.PI) * 0.18 : 1;
        const bx = R.BOX;
        const wd = Math.round(bx.c.width * sq);
        const ht = Math.round(bx.c.height / sq);
        b.drawImage(bx.c, x - Math.round(wd / 2), y - ht + 1, wd, ht);
        return;
      }
      if (caught) {
        // Turned round, startled; the box (if any) flies off.
        const fr = R.sneakFrame(0, 'down');
        b.drawImage(fr.c, x - fr.ox, y - fr.oy);
        if (this.liftT >= 0) {
          const u = this.liftT;
          const by = y - 16 - u * 120 + u * u * 140;
          b.save();
          b.translate(x + u * 40, by);
          b.rotate(u * 5);
          b.drawImage(R.BOX.c, -R.BOX.ox, -R.BOX.oy / 2);
          b.restore();
        }
        return;
      }
      const frame = w.walking ? 1 + (w.foot ^ (w.stepT > 0.15 ? 1 : 0)) : 0;
      const fr = R.sneakFrame(frame, 'up');
      b.drawImage(fr.c, x - fr.ox, y - fr.oy);
    }

    // Over a guest's head: "!" when they catch you, "?" when they stare at your box, the
    // shuffle before turning round, and what woken glasses say.
    drawBubble(b, gl, w, g, t) {
      const p = g.pose(w.t);
      const x = Math.round(p.x);
      const y = Math.round(this.sy(w, p.d)) - 30;
      if (w.catcher === g) {
        const u = R.clamp(w.stateT / 0.12, 0, 1);
        const s = w.state === 'caught' ? 1 + (1 - u) * 1.5 : 1;
        const tc = R.textCanvas('!', { scale: 3, color: '#ff2a3d', outline: '#ffffff' });
        const tw = tc.c.width * s;
        const th = tc.c.height * s;
        b.drawImage(tc.c, x - tw / 2, y - th + 4, tw, th);
        R.softGlow(gl, x, y - 6, 14, '#ff2a3d', 0.6);
        return;
      }
      if (g.sus > 0.05 && g.kind === 'turn') {
        const s = 1 + Math.round(g.sus * 1.5);
        R.text(b, '?', x, y - 4 - s * 3, { scale: s, color: '#ffe14d', outline: '#07050c', align: 'center' });
        return;
      }
      if (p.warn) {
        R.text(b, '...', x, y, { font: 'small', color: '#ffffff', outline: '#07050c', align: 'center' });
        return;
      }
      if (p.wakeWarn) R.text(b, 'HEY META?', x, y, { font: 'small', color: '#ff9ae8', outline: '#07050c', align: 'center' });
      else if (p.wake && Math.floor(t * 3) % 2 === 0) R.text(b, 'LISTENING', x, y, { font: 'small', color: '#ff3fd2', outline: '#07050c', align: 'center' });
    }

    present(w, uiDraw) {
      this.focus = [R.pathX(w.d), MG.PY - 40];
      super.present(uiDraw);
    }
  }

  R.MView = View;
})();
