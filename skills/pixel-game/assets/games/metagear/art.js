/* Meta Gear Solid · art: everyone on screen, drawn as pixels at load time or on first use and
   cached. The sneaker (from behind, walking up the screen) and their cardboard box; the guests,
   in four facings, each in smart glasses: thick black Wayfarer frames with the camera lens in one
   top corner and the capture LED in the other (from photos of Ray-Ban Meta glasses; no logos);
   the furniture of each room; the codec portraits (made-up characters); the big glasses on the
   title. */
(function () {
  'use strict';
  const R = window.R;

  const put = (x, c, px, py, w, h) => {
    x.fillStyle = c;
    x.fillRect(px, py, w || 1, h || 1);
  };

  // ---------------- the sneaker ----------------
  // 14×20, feet at (7, 19). Walking up the screen, so we see their back: a dark sneaking suit and
  // a bandana with tails. frame 0 stands, 1 and 2 are steps; face: 'down' turns round (caught).
  const SNEAK = { hair: '#241a14', band: '#5a6c8c', bandHi: '#8094b4', suit: '#1d2838', suitHi: '#31445e', strap: '#0f141c', skin: '#d6a07c', boot: '#0c0e12', belt: '#4a3c28' };
  const sneakCache = new Map();
  R.sneakFrame = function (frame, face) {
    const key = frame + face;
    let fr = sneakCache.get(key);
    if (fr) return fr;
    const c = R.canvas(16, 22);
    const x = c.x;
    const P = SNEAK;
    const back = face !== 'down';
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    // Legs and boots: the stepping leg reaches further up the screen.
    put(x, P.suit, 4, 13, 3, 5 - (step > 0 ? 1 : 0));
    put(x, P.suit, 9, 13, 3, 5 - (step < 0 ? 1 : 0));
    put(x, P.boot, 4, 18 - (step > 0 ? 1 : 0), 3, 2);
    put(x, P.boot, 9, 18 - (step < 0 ? 1 : 0), 3, 2);
    // Torso, belt, the straps of a little pack.
    put(x, P.suit, 3, 7, 10, 7);
    put(x, P.suitHi, 3, 7, 1, 6);
    put(x, P.belt, 3, 12, 10, 1);
    if (back) {
      put(x, P.strap, 5, 7, 1, 5);
      put(x, P.strap, 10, 7, 1, 5);
      put(x, '#2a3a4e', 6, 8, 4, 3);
    } else put(x, P.suitHi, 7, 7, 2, 5);
    // Arms swing with the steps.
    put(x, P.suit, 1, 8 + (step > 0 ? -1 : 0), 2, 5);
    put(x, P.suit, 13, 8 + (step < 0 ? -1 : 0), 2, 5);
    put(x, back ? P.boot : P.skin, 1, 13 + (step > 0 ? -1 : 0), 2, 1);
    put(x, back ? P.boot : P.skin, 13, 13 + (step < 0 ? -1 : 0), 2, 1);
    // Head: hair from behind, or a startled face.
    put(x, P.hair, 4, 0, 8, 7);
    put(x, P.hair, 3, 1, 10, 5);
    if (!back) {
      put(x, P.skin, 4, 2, 8, 5);
      put(x, '#ffffff', 5, 4, 2, 1);
      put(x, '#ffffff', 9, 4, 2, 1);
      put(x, '#101010', 6, 4, 1, 1);
      put(x, '#101010', 9, 4, 1, 1);
      put(x, '#7a3a2a', 7, 6, 2, 1);
    }
    // The bandana, its knot and two tails that flutter with the steps.
    put(x, P.band, 3, 2, 10, 2);
    put(x, P.bandHi, 4, 2, 7, 1);
    if (back) {
      put(x, P.band, 11, 3, 2, 2);
      const tl = frame === 1 ? 0 : frame === 2 ? 1 : 0;
      put(x, P.band, 13, 4 + tl, 1, 3);
      put(x, P.band, 14, 6 + tl, 1, 2);
      put(x, P.bandHi, 12, 4, 1, 1);
    }
    const out = R.outlined(c.c, '#07050c');
    fr = { c: out, ox: 9, oy: 21 };
    sneakCache.set(key, fr);
    return fr;
  };

  // The cardboard box: 20×16 with its bottom edge at (10, 15). Taped top, a hand hole, an arrow.
  R.BOX = (function () {
    const c = R.canvas(20, 16);
    const x = c.x;
    put(x, '#b98a4f', 1, 1, 18, 6); // top
    put(x, '#cf9f62', 1, 1, 18, 1);
    put(x, '#9a6e3c', 1, 6, 18, 1);
    put(x, '#e2cfa0', 9, 1, 2, 6); // tape
    put(x, '#8a5f32', 1, 7, 18, 8); // front
    put(x, '#7a5229', 1, 13, 18, 2);
    put(x, '#4a3018', 7, 9, 6, 2); // hand hole
    put(x, '#2a1a0c', 8, 9, 4, 1);
    put(x, '#3a2612', 3, 9, 1, 3); // this way up
    put(x, '#3a2612', 2, 10, 3, 1);
    put(x, '#3a2612', 16, 9, 1, 3);
    put(x, '#3a2612', 15, 10, 3, 1);
    const out = R.outlined(c.c, '#1a0f06');
    return { c: out, ox: 11, oy: 16 };
  })();

  // ---------------- the guests ----------------
  // 14×22, feet at (7, 21). look (0..63) picks skin, hair and style; the zone dresses them.
  const SKIN = ['#f1c7a5', '#e0ad86', '#b97c56', '#8a5636', '#5e3a24'];
  const HAIR = ['#1c1714', '#3d2818', '#7a4a26', '#c99b52', '#a9a9b2', '#6e2a2a', '#2a2a3a'];
  const STYLE = ['short', 'long', 'bun', 'cap', 'curly', 'short', 'bald', 'long'];
  const OUTFIT = {
    cafe: [['#7a4a3a', '#2f3e5c'], ['#4a6a8a', '#3a3a44'], ['#8a7a52', '#2f3e5c'], ['#3d5c4a', '#4a3a2c'], ['#b0646a', '#2f3e5c'], ['#5c5c6c', '#6a5a44']],
    gym: [['#e84a6a', '#1e1e26'], ['#2ec8b0', '#1e1e26'], ['#e8c83a', '#2a2a36'], ['#6a6ae8', '#1e1e26'], ['#ff7a3a', '#26262e'], ['#d8d8e0', '#2a2a36']],
    wedding: [['#262636', '#262636', 'suit'], ['#3a3a58', '#3a3a58', 'suit'], ['#c86a9a', '#c86a9a', 'dress'], ['#6a9ac8', '#6a9ac8', 'dress'], ['#e8c86a', '#e8c86a', 'dress'], ['#4a2a3a', '#4a2a3a', 'suit']],
    expo: [['#3a3a4a', '#2f3e5c', 'lanyard'], ['#5a4a8a', '#2f2f3a', 'lanyard'], ['#2a6a8a', '#3a3a44', 'lanyard'], ['#8a8a96', '#2f3e5c', 'lanyard'], ['#1e1e28', '#3a3a44', 'lanyard'], ['#7a3a5a', '#2f2f3a', 'lanyard']],
  };
  const FRAME = '#0b0b10';
  const LENS = '#2a3442';
  const guestCache = new Map();
  // facing: 0 down (toward us), 1 right, 2 up (away), 3 left. frame: 0 or 1 (a step).
  R.guestFrame = function (g, facing, frame) {
    const key = `${g.zone}|${g.look}|${facing}|${frame}`;
    let fr = guestCache.get(key);
    if (fr) return fr;
    const look = g.look;
    const skin = SKIN[look % SKIN.length];
    const hair = HAIR[(look >> 1) % HAIR.length];
    const style = STYLE[(look >> 2) % STYLE.length];
    const outs = OUTFIT[g.zone] || OUTFIT.cafe;
    const [top, bottom, kind] = outs[(look * 7) % outs.length];
    const c = R.canvas(14, 22);
    const x = c.x;
    const side = facing === 1 || facing === 3;
    const st = frame ? 1 : 0;
    const dark = R.mixHex(top, '#000000', 0.3);
    // Legs (a dress covers them), shoes.
    if (kind === 'dress') {
      put(x, top, 3, 13, 8, 6);
      put(x, dark, 3, 18, 8, 1);
      put(x, skin, 4, 19, 2, 1);
      put(x, skin, 8, 19, 2, 1);
    } else if (side) {
      put(x, bottom, 5 - st, 14, 3, 6);
      put(x, bottom, 7 + st, 14, 3, 6);
    } else {
      put(x, bottom, 3, 14, 3, frame ? 5 : 6);
      put(x, bottom, 8, 14, 3, 6);
    }
    put(x, '#14141a', side ? 4 - st : 3, !side && frame ? 19 : 20, 3, 1);
    put(x, '#14141a', side ? 8 + st : 8, 20, 3, 1);
    // Torso and arms (bare arms in the gym).
    const arm = g.zone === 'gym' ? skin : top;
    if (side) {
      put(x, top, 4, 7, 7, 8);
      put(x, dark, facing === 1 ? 4 : 10, 7, 1, 8);
      put(x, arm, facing === 1 ? 6 : 7, 8, 2, 6);
      put(x, skin, facing === 1 ? 6 : 7, 14, 2, 1);
    } else {
      put(x, top, 2, 7, 10, 8);
      put(x, dark, 11, 7, 1, 8);
      put(x, arm, 1, 8, 2, 6);
      put(x, arm, 11, 8, 2, 6);
      put(x, skin, 1, 14, 2, 1);
      put(x, skin, 11, 14, 2, 1);
      if (kind === 'suit' && facing === 0) {
        put(x, '#e8e8f0', 6, 7, 2, 5);
        put(x, '#a8203a', 6, 8, 2, 1);
      }
      if (kind === 'lanyard' && facing === 0) {
        put(x, '#ff3fd2', 5, 7, 1, 4);
        put(x, '#ff3fd2', 8, 7, 1, 4);
        put(x, '#f4f4f4', 5, 11, 4, 3);
      }
    }
    // Head, hair, the face and the glasses.
    const hx = side ? 4 : 3;
    const hw = side ? 7 : 8;
    put(x, skin, hx, 1, hw, 6);
    put(x, skin, hx + 1, 7, hw - 2, 1);
    const hairTop = (h) => put(x, hair, hx, 0, hw, h);
    if (style !== 'bald') hairTop(style === 'cap' ? 1 : 2);
    if (style === 'cap') {
      put(x, '#c83a3a', hx - 1, 0, hw + 2, 2);
      if (facing === 0) put(x, '#a02a2a', hx, 2, hw, 1);
      else if (facing === 1) put(x, '#a02a2a', hx + hw - 1, 2, 3, 1);
      else if (facing === 3) put(x, '#a02a2a', hx - 2, 2, 3, 1);
    }
    if (style === 'bun') put(x, R.mixHex(hair, '#000000', 0.25), hx + Math.floor(hw / 2) - 1, 0, 3, 1);
    if (style === 'curly') {
      put(x, hair, hx - 1, 0, hw + 2, 3);
      put(x, hair, hx - 1, 3, 1, 2);
      put(x, hair, hx + hw, 3, 1, 2);
    }
    if (facing === 2) {
      // From behind: all hair, and the arms of the glasses.
      if (style !== 'bald') put(x, hair, hx, 0, hw, style === 'long' ? 8 : 5);
      put(x, FRAME, hx - 1, 3, 1, 1);
      put(x, FRAME, hx + hw, 3, 1, 1);
    } else if (facing === 0) {
      if (style === 'long') {
        put(x, hair, hx - 1, 1, 1, 7);
        put(x, hair, hx + hw, 1, 1, 7);
      }
      // Wayfarers: a thick frame, two dark lenses, a lens in one top corner and the LED in the other.
      put(x, FRAME, hx - 1, 3, hw + 2, 2);
      put(x, LENS, hx, 4, 3, 1);
      put(x, LENS, hx + hw - 3, 4, 3, 1);
      put(x, '#6a7686', hx - 1, 3, 1, 1); // camera
      put(x, '#3a3a44', hx + hw, 3, 1, 1); // LED, off
      put(x, R.mixHex(skin, '#5a2a1a', 0.45), hx + 3, 6, 2, 1);
    } else {
      // In profile: the frame front at the face, the arm back to the ear.
      const right = facing === 1;
      const fx0 = right ? hx + hw - 3 : hx;
      if (style === 'long') put(x, hair, right ? hx - 1 : hx + hw, 1, 2, 7);
      else if (style !== 'bald') put(x, hair, right ? hx : hx + hw - 2, 1, 2, 4);
      put(x, FRAME, fx0, 3, 3, 2);
      put(x, LENS, right ? fx0 + 1 : fx0, 4, 2, 1);
      put(x, FRAME, right ? hx + 1 : hx + hw - 4, 3, 3, 1);
      put(x, right ? '#3a3a44' : '#3a3a44', right ? hx + hw : hx - 1, 3, 1, 1); // LED corner
    }
    const out = R.outlined(c.c, '#07050c');
    // Where the LED is, from the feet, for drawing it lit.
    const led = facing === 0 ? [hx + hw + 1, 4] : facing === 1 ? [hx + hw + 1, 4] : facing === 3 ? [hx, 4] : null;
    fr = { c: out, ox: 8, oy: 22, led: led && [led[0] - 8, led[1] - 22] };
    guestCache.set(key, fr);
    return fr;
  };

  // ---------------- furniture ----------------
  // Drawn straight into the buffers, with (x, y) the item's footprint centre on screen.
  const wood = '#6a4428';
  R.drawDecor = function (b, gl, dc, x, y, t) {
    const v = dc.v;
    x = Math.round(x);
    y = Math.round(y);
    const shadow = (w, h) => {
      b.fillStyle = 'rgba(0,0,0,0.28)';
      b.fillRect(x - w / 2, y - 1, w, h || 3);
    };
    if (dc.zone === 'cafe') {
      if (v < 5) {
        // A little round table, a cup (or a laptop) on it, a chair.
        shadow(18);
        R.disc(b, x, y - 9, 8, '#3a2618');
        R.disc(b, x, y - 10, 8, v % 2 ? '#8a5a34' : '#7a4e2c');
        put(b, '#2a1a10', x - 1, y - 3, 2, 3);
        if (v === 1) {
          put(b, '#c9ccd6', x - 4, y - 14, 8, 5);
          put(b, '#4a8ad8', x - 3, y - 13, 6, 3);
          put(gl, '#1a3a6a', x - 3, y - 13, 6, 3);
        } else {
          put(b, '#f4f0e8', x - 2, y - 13, 4, 3);
          put(b, '#6a3a1a', x - 1, y - 13, 2, 1);
        }
        put(b, '#4a301c', x + 9, y - 8, 5, 6);
        put(b, '#5c3c22', x + 9, y - 11, 5, 3);
      } else if (v < 7) {
        // A plant in a pot.
        shadow(12);
        put(b, '#b8603a', x - 5, y - 8, 10, 8);
        put(b, '#d0784a', x - 5, y - 8, 10, 2);
        for (let i = 0; i < 6; i++) R.disc(b, x - 5 + ((i * 4) % 11), y - 13 - ((i * 5) % 8), 3, i % 2 ? '#3a8a4a' : '#2a6a3a');
      } else {
        // A chalkboard sign on an easel: MENU and a cup.
        shadow(16);
        put(b, wood, x - 8, y - 8, 2, 8);
        put(b, wood, x + 6, y - 8, 2, 8);
        put(b, wood, x - 10, y - 24, 20, 17);
        put(b, '#1e2a24', x - 9, y - 23, 18, 15);
        R.text(b, 'MENU', x, y - 21, { font: 'small', color: '#f4f0e0', align: 'center' });
        put(b, '#f4f0e0', x - 3, y - 14, 5, 4);
        put(b, '#f4f0e0', x + 2, y - 13, 1, 2);
        put(b, '#ff9ab8', x - 7, y - 10, 14, 1);
      }
    } else if (dc.zone === 'gym') {
      if (v < 3) {
        // A treadmill: the belt runs, the console glows.
        shadow(16, 4);
        put(b, '#2a2a32', x - 7, y - 20, 14, 20);
        put(b, '#121216', x - 5, y - 18, 10, 16);
        const off = Math.floor(t * 30) % 4;
        for (let k = 0; k < 4; k++) put(b, '#2e2e38', x - 5, y - 18 + ((k * 4 + off) % 16), 10, 1);
        put(b, '#3a3a46', x - 7, y - 26, 14, 6);
        put(b, '#3aff9a', x - 4, y - 25, 8, 2);
        put(gl, '#1a8a4a', x - 4, y - 25, 8, 2);
      } else if (v < 5) {
        // A dumbbell rack.
        shadow(22);
        put(b, '#3a3a44', x - 11, y - 10, 22, 3);
        for (let k = 0; k < 4; k++) {
          put(b, '#1a1a20', x - 10 + k * 6, y - 13, 4, 3);
          put(b, '#6a6a76', x - 9 + k * 6, y - 12, 2, 1);
        }
        put(b, '#2a2a32', x - 10, y - 7, 2, 7);
        put(b, '#2a2a32', x + 8, y - 7, 2, 7);
      } else if (v < 7) {
        // A yoga mat and a kettlebell.
        put(b, v === 5 ? '#6a4ac8' : '#2aa88a', x - 6, y - 16, 12, 18);
        R.disc(b, x + 9, y - 3, 3, '#1a1a20');
        put(b, '#1a1a20', x + 7, y - 8, 1, 3);
        put(b, '#1a1a20', x + 11, y - 8, 1, 3);
        put(b, '#1a1a20', x + 7, y - 8, 5, 1);
      } else {
        // A mirror on a stand.
        put(b, '#9aa8c0', x - 7, y - 26, 14, 22);
        put(b, '#c8d4ea', x - 6, y - 25, 4, 20);
        put(gl, '#2a3a5a', x - 7, y - 26, 14, 22);
        put(b, '#2a2a32', x - 8, y - 4, 16, 3);
      }
    } else if (dc.zone === 'wedding') {
      if (v < 5) {
        // Folding chairs with a bow on the back.
        for (let k = -1; k <= 1; k += 2) {
          const cx = x + k * 7;
          put(b, 'rgba(0,0,0,0.25)', cx - 4, y - 1, 8, 2);
          put(b, '#f4f0ea', cx - 4, y - 8, 8, 5);
          put(b, '#e4dcd2', cx - 4, y - 14, 8, 6);
          put(b, '#c8bfb2', cx - 4, y - 3, 1, 3);
          put(b, '#c8bfb2', cx + 3, y - 3, 1, 3);
          put(b, v % 2 ? '#e88aa8' : '#c8a0e8', cx - 2, y - 13, 4, 2);
        }
      } else if (v < 7) {
        // Flowers on a stand.
        shadow(10);
        put(b, '#d8d0c4', x - 2, y - 14, 4, 14);
        const cols = ['#ff8ab0', '#ffffff', '#ffd27a', '#c8a0ff'];
        for (let i = 0; i < 9; i++) R.disc(b, x - 6 + ((i * 5) % 13), y - 22 + ((i * 3) % 7), 2, cols[i % cols.length]);
        for (let i = 0; i < 4; i++) put(b, '#3a8a4a', x - 6 + i * 4, y - 15, 2, 2);
      } else {
        // The cake.
        shadow(16);
        put(b, '#f4f0ea', x - 8, y - 6, 16, 6);
        put(b, '#ffffff', x - 6, y - 12, 12, 6);
        put(b, '#f4f0ea', x - 4, y - 17, 8, 5);
        put(b, '#ff8ab0', x - 8, y - 7, 16, 1);
        put(b, '#ff8ab0', x - 6, y - 13, 12, 1);
        put(b, '#ffd27a', x - 1, y - 20, 2, 3);
        put(gl, '#8a6a20', x - 1, y - 20, 2, 2);
      }
    } else {
      if (v < 4) {
        // A demo booth: a screen with glasses on it, a counter.
        shadow(24, 4);
        put(b, '#1a1a26', x - 12, y - 30, 24, 16);
        const blink = Math.floor(t * 2 + v) % 2;
        put(b, '#2a3a8a', x - 11, y - 29, 22, 14);
        put(gl, '#101a50', x - 11, y - 29, 22, 14);
        put(b, FRAME, x - 7, y - 24, 14, 3);
        put(b, LENS, x - 6, y - 23, 5, 2);
        put(b, LENS, x + 1, y - 23, 5, 2);
        put(b, blink ? '#ffffff' : '#555566', x + 7, y - 24, 1, 1);
        if (blink) put(gl, '#ffffff', x + 6, y - 25, 3, 3);
        R.text(b, 'NEW', x, y - 18, { font: 'small', color: '#ffe14d', align: 'center' });
        put(b, '#d8d8e4', x - 12, y - 12, 24, 10);
        put(b, '#b8b8c8', x - 12, y - 4, 24, 3);
        put(b, '#ff3fd2', x - 12, y - 12, 24, 1);
      } else if (v < 6) {
        // A banner stand.
        shadow(12);
        put(b, '#f4f4f8', x - 6, y - 34, 12, 32);
        put(b, '#5a4ae8', x - 6, y - 34, 12, 8);
        put(b, '#1a1a26', x - 4, y - 22, 8, 2);
        put(b, '#2a2a36', x - 4, y - 16, 8, 1);
        put(b, '#2a2a36', x - 4, y - 13, 6, 1);
        put(b, '#8a8a96', x - 7, y - 2, 14, 2);
      } else {
        // Glasses on little stands, for trying on.
        shadow(18);
        put(b, '#e4e4ee', x - 9, y - 10, 18, 9);
        put(b, '#c4c4d4', x - 9, y - 2, 18, 2);
        for (let k = -1; k <= 1; k++) {
          put(b, FRAME, x - 3 + k * 6, y - 13, 5, 2);
          put(b, '#6a6a7a', x - 1 + k * 6, y - 11, 1, 2);
        }
      }
    }
  };

  // ---------------- codec portraits ----------------
  // Made-up characters, 32×36, in the four greens of an old codec screen.
  const CODEC = { '.': null, a: '#0a2a14', b: '#1f6a34', c: '#3fb35a', d: '#9dffb0' };
  const PORTRAITS = {
    // PRIVATE MODE: the sneaker. Bandana, stubble, a squint.
    pm: [
      '................................',
      '...........aaaaaaaaaa...........',
      '.........aabbbbbbbbbbaa.........',
      '........abbbbbbbbbbbbbba........',
      '.......abbbaaabbbbbaaabba.......',
      '.......acccccccccccccccca.......',
      '......acddddddddddddddddca......',
      '......accccccccccccccccccaaaa...',
      '......abbbbbbbbbbbbbbbbbbabcca..',
      '......abbccccccccccccccbba.aca..',
      '......abccccccccccccccccba..aa..',
      '......acccaaaacccaaaacccca......',
      '......accbaddacccaddabccca......',
      '......acccaaaacccaaaacccca......',
      '......accccccccbccccccccca......',
      '......acccccccbbccccccccca......',
      '......abcccccccbcccccccbba......',
      '.......abccccccccccccccba.......',
      '.......abbcccaaaaaacccbba.......',
      '.......abbbcbbbbbbbcbbbba.......',
      '........abbbbbbbbbbbbbba........',
      '........abababababababba........',
      '.........abbababababbba.........',
      '..........aabbbbbbbbaa..........',
      '............abbbbbba............',
      '.........aaabbbbbbbbaaa.........',
      '......aaabbbbbbbbbbbbbbaaa......',
      '....aabbbbccbbbbbbbbccbbbbaa....',
      '...abbbbbbbccbbbbbbccbbbbbbba...',
      '..abbbbbbbbbcbbbbbbcbbbbbbbbba..',
      '..abbbbbbbbbbccccccbbbbbbbbbba..',
      '.abbbbbbbbbbbbbbbbbbbbbbbbbbbba.',
      '.abbbbbbbbbbbbbbbbbbbbbbbbbbbba.',
      '.abbbbbbbbbbbbbbbbbbbbbbbbbbbba.',
      'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbba',
      'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbba',
    ],
    // COLONEL COOKIE: the voice on the codec. Grey hair, a moustache, a cookie on his beret.
    cc: [
      '..........aaaaaaaaaaaa..........',
      '........aabbbbbbbbbbbbaa........',
      '.......abbbbbbbbbbbddbbba.......',
      '......abbbbbbbbbbbdccdbbba......',
      '......abbbbbbbbbbbbddbbbbba.....',
      '.....aaaaaaaaaaaaaaaaaaaaaa.....',
      '......addddddddddddddddda.......',
      '......adddccccccccccdddda.......',
      '......adcccccccccccccccda.......',
      '......acccccccccccccccccca......',
      '......acaaaaccccccaaaacca.......',
      '......acaddacccccaddacccca......',
      '......accaaccccccaaacccca.......',
      '......acccccccbccccccccca.......',
      '......accccccbbbcccccccca.......',
      '......acccccccccccccccca........',
      '......acdddddddddddddddca.......',
      '......acdddddddddddddddca.......',
      '......accccccaaaaccccccca.......',
      '.......acccccccccccccca.........',
      '.......abcccccccccccccba........',
      '........abbccccccccccbba........',
      '.........aabbbbbbbbbbaa.........',
      '...........abbbbbbbba...........',
      '.........aaabbbbbbbbaaa.........',
      '......aaaccbbbbbbbbbbccaaa......',
      '....aacccccbbbbddbbbbcccccaa....',
      '...acccccccbbbddddbbbccccccca...',
      '..accccccccbbbbddbbbbcccccccca..',
      '..acccdddccbbbbbbbbbbccdddccca..',
      '..acccdddccbbbbbbbbbbccdddccca..',
      '.acccccccccbbbbbbbbbbcccccccca..',
      '.accccccccccbbbbbbbbccccccccca..',
      '.accccccccccbbbbbbbbcccccccccca.',
      'acccccccccccbbbbbbbbccccccccccca',
      'acccccccccccbbbbbbbbccccccccccca',
    ],
  };
  const portraitCache = {};
  R.codecPortrait = function (id) {
    if (portraitCache[id]) return portraitCache[id];
    const rows = PORTRAITS[id];
    const c = R.canvas(32, 36);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length && x < 32; x++) {
        const col = CODEC[row[x]];
        if (col) put(c.x, col, x, y);
      }
    });
    portraitCache[id] = c.c;
    return c.c;
  };

  // ---------------- the title's glasses ----------------
  // A big pair of Wayfarers, 96×30: a heavy trapezoid frame, two dark lenses with a highlight,
  // the camera in the top-left corner and the capture LED in the top-right (drawn by the UI, lit).
  R.BIG_GLASSES = (function () {
    const c = R.canvas(96, 30);
    const x = c.x;
    const F = '#121218';
    const H = '#34343e';
    // Frame: two lens rims and the bridge, wider at the top.
    const rim = (x0, flip) => {
      for (let y = 0; y < 26; y++) {
        const inset = Math.floor((y / 26) * 4);
        const l = flip ? x0 + inset : x0 + inset;
        const r = flip ? x0 + 42 - inset : x0 + 42 - Math.floor(inset / 2);
        put(x, F, l, y + 2, r - l, 1);
      }
      // The lens inside.
      for (let y = 0; y < 18; y++) {
        const inset = Math.floor((y / 18) * 3);
        put(x, '#1c2634', x0 + 5 + inset, y + 6, 32 - inset * 2, 1);
      }
      put(x, '#3a4e66', x0 + 8, 8, 10, 2);
      put(x, '#2c3c50', x0 + 8, 10, 4, 6);
    };
    rim(2, false);
    rim(52, true);
    put(x, F, 40, 6, 16, 5); // bridge
    put(x, F, 0, 2, 96, 5); // brow bar
    put(x, H, 2, 2, 92, 1);
    put(x, H, 44, 6, 8, 1);
    // Camera lens (top-left corner) and the LED's housing (top-right).
    R.disc(x, 7, 5, 3, '#2a2a34');
    R.disc(x, 7, 5, 2, '#0a0a10');
    put(x, '#8a9ab0', 6, 4, 1, 1);
    R.disc(x, 89, 5, 3, '#2a2a34');
    R.disc(x, 89, 5, 2, '#1a1a22');
    return { c: c.c, w: 96, h: 30, led: [89, 5], cam: [7, 5] };
  })();
})();
