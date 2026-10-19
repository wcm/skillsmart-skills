/* Flappy Roadster · vehicles: road traffic at the Roadster's scale, rasterised from simple polygons.
   Each vehicle faces right and comes with collision rects ([x0, x1, top] in sprite space; every
   rect runs down to the road) and an emissive twin for head and tail lights. */
(function () {
  'use strict';
  const R = window.R;

  const poly = R.poly;

  function wheel(x, cx, cy, r, hub) {
    R.disc(x, cx, cy, r, '#0e0d12');
    R.disc(x, cx, cy, Math.max(1, r - 1), hub || '#9aa0aa');
    x.fillStyle = '#2a2a33';
    x.fillRect(cx, cy, 1, 1);
  }

  const outlined = R.outlined;
  function padded(src) {
    const c = R.canvas(src.width + 2, src.height + 2);
    c.x.drawImage(src, 1, 1);
    return c.c;
  }

  const PAINT = {
    red: ['#c8102e', '#8e0c21', '#ff5a6a'],
    white: ['#e6e7ec', '#a9adb7', '#ffffff'],
    blue: ['#2d55b3', '#1c357a', '#6f95ef'],
    black: ['#25252d', '#121218', '#4a4a58'],
    grey: ['#7b808b', '#565a63', '#a8adb8'],
    gold: ['#cdb070', '#9c8450', '#f0dca0'],
    steel: ['#b8bec7', '#8a9099', '#e9edf2'],
  };

  // Build one vehicle: body polygon, glass, details, wheels, lights.
  function build(spec, paint) {
    const [body, shade, hi] = PAINT[paint];
    const c = R.canvas(spec.w, spec.h);
    const g = R.canvas(spec.w, spec.h);
    const x = c.x;
    poly(x, spec.body, body);
    // Lower body in shade, a highlight along the shoulder.
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = shade;
    x.fillRect(0, spec.belt + 3, spec.w, spec.h);
    x.fillStyle = hi;
    x.fillRect(0, spec.belt, spec.w, 1);
    x.globalCompositeOperation = 'source-over';
    if (spec.glass) {
      poly(x, spec.glass, spec.tint || '#15131c');
      const gx = Math.round(spec.glass[0][0] + 3);
      x.fillStyle = '#4a5a80';
      x.fillRect(gx, Math.round(spec.glass[1][1]) + 1, 2, 1);
    }
    if (spec.detail) spec.detail(x, g.x, body, shade, hi);
    for (const [wx, wy, r] of spec.wheels) wheel(x, wx, wy, r, spec.hub);
    for (const [lx, ly, lw, lh, col] of spec.lights) {
      x.fillStyle = col;
      x.fillRect(lx, ly, lw, lh);
      g.x.fillStyle = col;
      g.x.fillRect(lx, ly, lw, lh);
    }
    return { c: outlined(c.c, '#07050c'), g: padded(g.c), w: spec.w, h: spec.h, rects: spec.rects, kind: spec.kind, name: spec.name, panel: spec.panel || null, bar: spec.bar || null };
  }

  const HEAD = '#f4f7ff';
  const TAIL = '#ff2238';
  const AMBER = '#ffad2b';

  const SPECS = {
    model3: {
      kind: 'model3',
      name: 'MODEL 3',
      w: 46,
      h: 13,
      belt: 5,
      body: [[0, 11], [0, 7], [2, 6], [8, 5], [13, 4], [18, 1], [29, 1], [34, 4], [41, 6], [45, 7], [46, 9], [46, 11]],
      glass: [[14, 4], [18, 2], [29, 2], [33, 4]],
      wheels: [[9, 9, 3], [37, 9, 3]],
      lights: [[45, 7, 1, 1, HEAD], [0, 7, 1, 1, TAIL]],
      rects: [[0, 46, 5], [13, 33, 1]],
      detail(x) {
        x.fillStyle = 'rgba(0,0,0,0.35)';
        x.fillRect(24, 5, 1, 5);
      },
    },
    modely: {
      kind: 'modely',
      name: 'MODEL Y',
      w: 47,
      h: 15,
      belt: 7,
      body: [[0, 12], [0, 6], [3, 3], [9, 1], [30, 1], [36, 4], [43, 7], [47, 8], [47, 12]],
      glass: [[8, 5], [10, 2], [30, 2], [35, 5]],
      wheels: [[10, 11, 3], [38, 11, 3]],
      lights: [[46, 8, 1, 1, HEAD], [0, 6, 1, 2, TAIL]],
      rects: [[0, 47, 6], [8, 36, 1]],
      detail(x) {
        x.fillStyle = 'rgba(0,0,0,0.35)';
        x.fillRect(22, 6, 1, 6);
      },
    },
    cybercab: {
      kind: 'cybercab',
      name: 'CYBERCAB',
      w: 36,
      h: 13,
      belt: 5,
      body: [[0, 10], [1, 6], [4, 3], [10, 1], [25, 1], [31, 3], [35, 6], [36, 10]],
      glass: [[5, 5], [10, 2], [25, 2], [31, 5]],
      tint: '#1b1810',
      wheels: [[8, 9, 3], [28, 9, 3]],
      hub: '#c9b27a',
      lights: [[35, 6, 1, 1, HEAD], [0, 6, 1, 2, TAIL]],
      rects: [[0, 36, 5], [5, 31, 1]],
    },
    cybertruck: {
      kind: 'cybertruck',
      name: 'CYBERTRUCK',
      w: 48,
      h: 15,
      belt: 6,
      body: [[0, 12], [0, 5], [28, 0], [31, 0], [47, 6], [48, 12]],
      glass: [[17, 3], [28, 1], [31, 1], [38, 3], [38, 4], [17, 4]],
      wheels: [[9, 11, 3], [38, 11, 3]],
      hub: '#5e636b',
      lights: [[46, 6, 2, 1, HEAD], [0, 5, 1, 1, TAIL]],
      rects: [[0, 48, 5], [12, 40, 2], [22, 34, 0]],
      detail(x) {
        x.fillStyle = '#16151b';
        x.fillRect(4, 10, 40, 2);
      },
    },
    semi: {
      kind: 'semi',
      name: 'SEMI',
      w: 140,
      h: 27,
      belt: 9,
      body: [[0, 22], [0, 2], [92, 2], [92, 18], [96, 18], [96, 4], [100, 1], [118, 1], [128, 4], [136, 9], [140, 14], [140, 22]],
      glass: [[118, 2], [127, 5], [132, 9], [118, 9]],
      wheels: [[10, 23, 3], [19, 23, 3], [108, 23, 3], [130, 23, 3]],
      lights: [[139, 14, 1, 2, HEAD], [0, 17, 1, 2, TAIL], [102, 1, 1, 1, AMBER], [112, 1, 1, 1, AMBER]],
      rects: [[0, 92, 2], [92, 96, 18], [96, 140, 4], [100, 128, 1]],
      panel: [6, 6, 80, 9], // trailer billboard, filled at draw time
      detail(x) {
        x.fillStyle = '#9aa0aa';
        x.fillRect(0, 19, 92, 2);
        x.fillStyle = '#5a5f69';
        x.fillRect(92, 18, 4, 3);
        x.fillRect(1, 2, 1, 17);
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.fillRect(110, 5, 1, 13);
      },
    },
    police: {
      kind: 'police',
      name: 'HIGHWAY PATROL',
      w: 46,
      h: 14,
      belt: 6,
      body: [[0, 12], [0, 8], [2, 7], [8, 6], [13, 5], [18, 2], [29, 2], [34, 5], [41, 7], [45, 8], [46, 10], [46, 12]],
      glass: [[14, 5], [18, 3], [29, 3], [33, 5]],
      wheels: [[9, 10, 3], [37, 10, 3]],
      lights: [[45, 8, 1, 1, HEAD], [0, 8, 1, 1, TAIL]],
      rects: [[0, 46, 6], [13, 33, 2], [20, 28, 1]],
      bar: [20, 1, 8],
      detail(x) {
        x.fillStyle = '#e9e9ee';
        x.fillRect(12, 7, 24, 3);
        x.fillStyle = '#2a2a33';
        x.fillRect(20, 1, 8, 1);
      },
    },
  };

  const cache = new Map();
  R.vehicle = function (kind, paint) {
    const key = kind + ':' + paint;
    let v = cache.get(key);
    if (!v) {
      v = build(SPECS[kind], paint);
      cache.set(key, v);
    }
    return v;
  };
  R.VEHICLE_KINDS = Object.keys(SPECS);
  R.PAINTS = Object.keys(PAINT);

  // Draw a vehicle with its bottom on the road at y = ground; police bars flash.
  R.drawVehicle = function (b, gl, v, x, ground, t, text) {
    const s = v.spr;
    const px = Math.round(x) - 1;
    const py = Math.round(ground - s.h) - 1 + (v.bounce ? Math.round(v.bounce) : 0);
    b.drawImage(s.c, px, py);
    gl.drawImage(s.g, px, py);
    if (s.panel && text) {
      const [tx, ty, tw, th] = s.panel;
      b.fillStyle = '#c9ced8';
      b.fillRect(px + 1 + tx, py + 1 + ty, tw, th);
      R.text(b, text, px + 1 + tx + tw / 2, py + 1 + ty + 2, { font: 'small', color: '#1d2a4a', align: 'center' });
    }
    if (s.bar) {
      const [bx, by, bw] = s.bar;
      const on = Math.floor(t * 8) % 2 === 0;
      for (let i = 0; i < bw; i++) {
        const left = i < bw / 2;
        const col = left === on ? '#ff2a3d' : '#3a7bff';
        b.fillStyle = col;
        b.fillRect(px + 1 + bx + i, py + 1 + by, 1, 1);
        gl.fillStyle = col;
        gl.fillRect(px + 1 + bx + i, py + by, 1, 3);
      }
      R.softGlow(gl, px + 1 + bx + (on ? 2 : 6), py + by, 10, on ? '#ff2a3d' : '#3a7bff', 0.5);
    }
  };
})();
