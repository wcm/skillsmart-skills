/* Flappy Roadster · art: hand-made pixel sprites, skins, RotSprite-style rotations, icons. */
(function () {
  'use strict';
  const R = window.R;

  // ---------------------------------------------------------------------------
  // Car bodies. Side view, nose to the RIGHT. '.' is transparent; letters index the skin palette.
  //   h highlight  W body  w shade  s deep shade  G glass  g glass sheen  y gold glint
  //   K black trim k dark trim  E tail light  L headlight  A amber marker  N bronze nozzle
  //   P pilot suit  V visor  B wing  b wing shadow
  // Wheels are stamped separately; wings are overlays (0 stowed, 1 half, 2 high-downforce).
  // ---------------------------------------------------------------------------

  // 2026 Roadster: knife-edge wedge nose, long raked screen, flat canopy, straight fastback,
  // chopped tail, black rocker that widens into a black rear corner. Traced from Tesla's
  // Road Mode side profile (Oct 2026).
  const R26 = {
    w: 44,
    h: 12,
    rows: [
      '.................hhhhhhhhhhh................',
      '...........hhhhhhGgGGGGGGGGGgg..............',
      '.....hhhhhhWWWWWWGGyGGGGGGGGGGggg...........',
      'EEhhhWWWWWWWWWWWWWWWWWWWWWWWWWGGWhhhhh......',
      'EWWWWWWWWWWWWWWWWWWWWWWWWWWWWAsWWWWWWWhhhh..',
      'wwwwwwwwwWWWWWWWWWWWWWWWWWWWWWsWWWWWWWWWWWhh',
      'KKKwwwwwwwwwwwwwwwwwwwWWWWWWWWsWWWWWWWWWWWWL',
      'NKKKwwwwwwwwwwwwwwwwwwwwwwwwwwswwwwwwwwwwwww',
      'KKKKKKKKKKKKwwwwwwwwwwwwwwwwwwwwwwwwwwKKKKKK',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      '............................................',
      '............................................',
    ],
    wheels: [
      [6, 8],
      [35, 8],
    ], // wheel centres
    // Active rear wing, drawn relative to the body's top-left. Raised = "High-Downforce Mode".
    wings: [
      { dx: 0, dy: 2, rows: ['hhh'] },
      { dx: -2, dy: 0, rows: ['hhhhb', '.bk..', '..k..'] },
      { dx: -3, dy: -2, rows: ['.hhhh.', 'hWWWWb', '..bk..', '...k..', '...k..'] },
    ],
    nozzles: { rear: [0, 7], down: [[2, 9], [40, 9]] },
  };

  // 2017 prototype: curvy, low nose, glass targa roof, short ducktail.
  const R17 = {
    w: 44,
    h: 12,
    rows: [
      '...............hhhhhhh......................',
      '............hhhGGGGGGGhh....................',
      '..........hhGGGgGGGGGGGGhh..................',
      '..hhhh..hhWWGGGGGGGGGGGGGGhhhh..............',
      '.hWWWWhhWWWWWWWWWWWWWWWWWWWWWWhhhhhh........',
      'EWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWhhhhh...',
      'EWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWhh.',
      'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWL',
      'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwL',
      'Kwwwwwwwwwwwssssssssssssswwwwwwwwwwwwwwwwwwk',
      '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.',
      '............................................',
    ],
    wheels: [
      [7, 9],
      [34, 9],
    ],
    wings: null,
    nozzles: { rear: [0, 8], down: [[5, 11], [37, 11]] },
  };

  // Starman: the 2017 body with the roof off and a spacesuit at the wheel.
  const STARMAN_ROWS = R17.rows.map((r) => r);
  STARMAN_ROWS[0] = '................PPP.........................';
  STARMAN_ROWS[1] = '...............PVVVP........................';
  STARMAN_ROWS[2] = '..........hh...PVVPPP.hh....................';
  STARMAN_ROWS[3] = '..hhhh..hhWWKKKKPPPPKKKKKKhhhh..............';
  const STARMAN = Object.assign({}, R17, { rows: STARMAN_ROWS });

  // Cybertruck, the "brick": triangle profile, light bar nose, big aero wheels.
  const CYBER = {
    w: 46,
    h: 14,
    rows: [
      '............................hh................',
      '.....................hhhhhhhWWhh..............',
      '..............hhhhhhhWWWWWWWWWWWhh............',
      '.......hhhhhhhWWWWGGGGGGGGGGGGGGGGhh..........',
      'EhhhhhhWWWWWWWWWWWGGGGGGGGGGGGGGGGGGhhh.......',
      'EWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWhhhhhhL',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWL',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      '..............................................',
      '..............................................',
      '..............................................',
    ],
    wheels: [
      [8, 10],
      [37, 10],
    ],
    wings: null,
    nozzles: { rear: [0, 9], down: [[4, 12], [42, 12]] },
  };

  const WHEEL = ['..TTT..', '.TDDDT.', 'TDDdDDT', 'TDdKdDT', 'TDDdDDT', '.TDDDT.', '..TTT..'];
  const WHEEL_B = ['..TTT..', '.TDDDT.', 'TDdDdDT', 'TDDKDDT', 'TDdDdDT', '.TDDDT.', '..TTT..'];
  const AERO_WHEEL = ['..TTTT..', '.TTDDTT.', 'TTDDDDTT', 'TDDDDDDT', 'TDDKKDDT', 'TDDDDDDT', '.TTDDTT.', '..TTTT..'];

  const BASE_PAL = {
    T: '#0e0d12',
    D: '#c9ccd3',
    d: '#3a3942',
    K: '#16151b',
    k: '#2c2a33',
    E: '#ff1f35',
    L: '#f4f7ff',
    A: '#ffad2b',
    N: '#7a5636',
    G: '#15131c',
    g: '#3b3448',
    y: '#9a7741',
    B: '#a07c52',
    b: '#5d462e',
    P: '#f2f2f2',
    V: '#1d1a2a',
  };

  R.SKINS = [
    {
      id: 'white',
      name: "ROADSTER '26",
      shape: R26,
      wheel: WHEEL,
      pal: { h: '#ffffff', W: '#e4e3df', w: '#a9adb4', s: '#7f838b' },
      gravity: 1,
      flap: 1,
      unlock: 0,
    },
    {
      id: 'cherry',
      name: "CHERRY RED '26",
      shape: R26,
      wheel: WHEEL,
      pal: { h: '#ff6b74', W: '#d7182f', w: '#981225', s: '#6b0d1b', D: '#d8d2cf' },
      gravity: 1,
      flap: 1,
      unlock: 0,
    },
    {
      id: 'promise',
      name: "ROADSTER '17",
      shape: R17,
      wheel: WHEEL_B,
      pal: { h: '#ff7a80', W: '#cf1730', w: '#951126', s: '#6a0c1b', G: '#1a1f33', g: '#4a5a88', D: '#b9bcc4' },
      gravity: 1,
      flap: 1,
      unlock: 5,
    },
    {
      id: 'cyber',
      name: 'CYBERTRUCK',
      shape: CYBER,
      wheel: AERO_WHEEL,
      pal: { h: '#eef1f5', W: '#b8bec7', w: '#8a9099', s: '#5e636b', G: '#121418', D: '#8e939b' },
      gravity: 1.12,
      flap: 1.04,
      unlock: 10,
    },
    {
      id: 'starman',
      name: 'STARMAN',
      shape: STARMAN,
      wheel: WHEEL_B,
      pal: { h: '#ff7a80', W: '#cf1730', w: '#951126', s: '#6a0c1b', G: '#1a1f33', g: '#4a5a88', D: '#b9bcc4' },
      gravity: 1,
      flap: 1,
      unlock: 20,
    },
  ];

  const EMISSIVE = { L: 1, E: 1, A: 1 };
  const OUTLINE = '#0b0910';
  const PAD = 4; // room for the wing above and behind

  // Compose a sprite for skin + wing state + wheel frame. Returns {base, glow, cx, cy, w, h}.
  function compose(skin, wing, wheelFrame) {
    const sh = skin.shape;
    const pal = Object.assign({}, BASE_PAL, skin.pal);
    const W = sh.w + PAD * 2;
    const H = sh.h + PAD * 2;
    const grid = new Array(W * H).fill(null);
    const put = (x, y, ch) => {
      if (ch === '.' || x < 0 || y < 0 || x >= W || y >= H) return;
      grid[y * W + x] = ch;
    };
    sh.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) put(x + PAD, y + PAD, row[x]);
    });
    if (sh.wings && sh.wings[wing]) {
      const wg = sh.wings[wing];
      wg.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) put(x + PAD + wg.dx, y + PAD + wg.dy, row[x]);
      });
    }
    // Wheel wells, then wheels.
    const wheelRows = wheelFrame && skin.wheel === WHEEL ? WHEEL_B : skin.wheel;
    const half = Math.floor(wheelRows[0].length / 2);
    const rr = half + 1;
    for (const [cx, cy] of sh.wheels) {
      for (let y = -rr; y <= 1; y++)
        for (let x = -rr; x <= rr; x++) {
          if (x * x + y * y <= rr * rr + 1) {
            const gx = cx + x + PAD;
            const gy = cy + y + PAD;
            if (grid[gy * W + gx] && grid[gy * W + gx] !== 'K') grid[gy * W + gx] = 'K';
          }
        }
      wheelRows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) put(cx - half + x + PAD, cy - half + y + PAD, row[x]);
      });
    }
    // Outline: any empty cell touching the sprite (4-neighbours) turns dark.
    const out = grid.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (grid[y * W + x]) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && grid[yy * W + xx];
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out[y * W + x] = '#';
      }
    const base = R.canvas(W, H);
    const glow = R.canvas(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ch = out[y * W + x];
        if (!ch) continue;
        base.x.fillStyle = ch === '#' ? OUTLINE : pal[ch] || '#f0f';
        base.x.fillRect(x, y, 1, 1);
        if (EMISSIVE[ch]) {
          glow.x.fillStyle = pal[ch];
          glow.x.fillRect(x, y, 1, 1);
        }
      }
    // Pivot: the body's centre.
    return { base: base.c, glow: glow.c, w: W, h: H, cx: PAD + sh.w / 2, cy: PAD + sh.h / 2 - 1 };
  }

  // ---- RotSprite-lite: Scale2x three times (8×), rotate by nearest sampling, read back at 1×. ----
  function scale2x(src, w, h) {
    const dst = new Uint32Array(w * 2 * h * 2);
    const at = (x, y) => src[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const P = at(x, y);
        const A = at(x, y - 1);
        const B = at(x + 1, y);
        const C = at(x - 1, y);
        const D = at(x, y + 1);
        const o = y * 2 * w * 2 + x * 2;
        dst[o] = C === A && C !== D && A !== B ? A : P;
        dst[o + 1] = A === B && A !== C && B !== D ? B : P;
        dst[o + w * 2] = D === C && D !== B && C !== A ? C : P;
        dst[o + w * 2 + 1] = B === D && B !== A && D !== C ? D : P;
      }
    return dst;
  }
  function pixels(canvas) {
    const cv = R.canvas(canvas.width, canvas.height, true);
    cv.x.drawImage(canvas, 0, 0);
    const d = cv.x.getImageData(0, 0, canvas.width, canvas.height);
    return new Uint32Array(d.data.buffer);
  }
  function rotateCanvas(canvas, ang, cx, cy) {
    const w = canvas.width;
    const h = canvas.height;
    let src = pixels(canvas);
    let sw = w;
    let shh = h;
    for (let i = 0; i < 3; i++) {
      src = scale2x(src, sw, shh);
      sw *= 2;
      shh *= 2;
    }
    const size = Math.ceil(Math.hypot(w, h)) + 2;
    const out = R.canvas(size, size);
    const img = out.x.createImageData(size, size);
    const o32 = new Uint32Array(img.data.buffer);
    const ca = Math.cos(-ang);
    const sa = Math.sin(-ang);
    const oc = size / 2;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - oc;
        const dy = y + 0.5 - oc;
        const sx = (dx * ca - dy * sa + cx) * 8;
        const sy = (dx * sa + dy * ca + cy) * 8;
        if (sx < 0 || sy < 0 || sx >= sw || sy >= shh) continue;
        o32[y * size + x] = src[(sy | 0) * sw + (sx | 0)];
      }
    out.x.putImageData(img, 0, 0);
    return out.c;
  }

  // Lazy cache: only the angles a run actually reaches get rotated.
  const STEP = 5;
  const sprites = new Map();
  R.carSprite = function (skinIdx, wing, wheelFrame) {
    const key = skinIdx + ':' + wing + ':' + (wheelFrame | 0);
    let s = sprites.get(key);
    if (!s) {
      s = compose(R.SKINS[skinIdx], wing, wheelFrame | 0);
      s.rot = new Map();
      sprites.set(key, s);
    }
    return s;
  };
  R.carRotated = function (skinIdx, wing, ang) {
    const s = R.carSprite(skinIdx, wing, 0);
    let deg = Math.round(((ang / R.DEG) % 360) / STEP) * STEP;
    if (deg < 0) deg += 360;
    if (deg >= 360) deg -= 360;
    if (deg === 0) return { base: s.base, glow: s.glow, ox: s.cx, oy: s.cy };
    let r = s.rot.get(deg);
    if (!r) {
      const a = deg * R.DEG;
      const base = rotateCanvas(s.base, a, s.cx, s.cy);
      const glow = rotateCanvas(s.glow, a, s.cx, s.cy);
      r = { base, glow, ox: base.width / 2, oy: base.height / 2 };
      s.rot.set(deg, r);
    }
    return r;
  };
  // Where a car-space point (relative to the body's top-left) lands on screen.
  R.carPoint = function (skinIdx, px, py, car) {
    const sh = R.SKINS[skinIdx].shape;
    const lx = px - sh.w / 2;
    // A barrel roll (the tunnel's ceiling flips) mirrors the car top to bottom.
    const ly = (py - (sh.h / 2 - 1)) * (car.roll ? Math.cos(car.roll) : 1);
    const ca = Math.cos(car.ang);
    const sa = Math.sin(car.ang);
    return [car.x + lx * ca - ly * sa, car.y + lx * sa + ly * ca];
  };

  // ---------------------------------------------------------------------------
  // Small sprites: traffic, the five-Tesla stack, bolts, icons, debris.
  // ---------------------------------------------------------------------------
  const sprite = R.sprite;

  // The five Teslas the Roadster kickflipped over at the unveil, stacked into the first obstacle.
  const STACK_PAL = {
    o: '#0b0910',
    W: '#d9dbe0',
    w: '#9aa0aa',
    R: '#c41a2f',
    r: '#841224',
    S: '#b3b9c2',
    s: '#7c838d',
    B: '#26354f',
    b: '#3f5679',
    G: '#121019',
    T: '#0e0d12',
    D: '#a9adb6',
    L: '#f2f6ff',
    E: '#ff2a3d',
    Y: '#f1c64a',
    glow: 'LEY',
  };
  R.STACK = [
    // Cybercab: the two-seat pod.
    sprite(
      [
        '..........oooooooooo..........',
        '.......oooGGGGGGGGGGooo.......',
        '.....ooGGGGGGGGGGGGGGGGoo.....',
        '...ooYYYYYYYYYYYYYYYYYYYYoo...',
        '..oLYYYYYYYYYYYYYYYYYYYYYYEo..',
        '..oYYYYYYYYYYYYYYYYYYYYYYYYo..',
        '..ooTTTTooooooooooooooTTTToo..',
        '....oTTo..............oTTo....',
      ],
      STACK_PAL,
    ),
    // Semi: the truck cab.
    sprite(
      [
        '..................oooooooooo..',
        '.................oWWWWWWWWWWo.',
        '................oGGGGGGWWWWWo.',
        '...............oGGGGGGGWWWWWo.',
        '.oooooooooooooooWWWWWWWWWWWWo.',
        '.owwwwwwwwwwwwwwWWWWWWWWWWWLo.',
        '.owwwwwwwwwwwwwwWWWWWWWWWWWWo.',
        '.oooTTTToTTTTooooooooooTTTToo.',
        '....oTTo.oTTo.........oTTo....',
      ],
      STACK_PAL,
    ),
    // Cybertruck.
    sprite(
      [
        '...........ooo................',
        '........oooSSSooo.............',
        '.....oooSSSGGGGSSSooo.........',
        '..oooSSSSSSSSSSSSSSSSSoooooo..',
        '.oESSSSSSSSSSSSSSSSSSSSSSSSLo.',
        '.oSSSssssssssssssssssssSSSSSo.',
        '.oooTTTToooooooooooooTTTTooo..',
        '....oTTo.............oTTo.....',
      ],
      STACK_PAL,
    ),
    // Model Y.
    sprite(
      [
        '.........ooooooooo............',
        '......oooGGGGGGGGGooo.........',
        '....ooBBBGGGGGGGGGGGBooo......',
        '..ooBBBBBBBBBBBBBBBBBBBBBoo...',
        '.oEBBBBBBBBBBBBBBBBBBBBBBBLo..',
        '.obbbbbbbbbbbbbbbbbbbbbbbbbo..',
        '.oooTTTToooooooooooooTTTTooo..',
        '....oTTo.............oTTo.....',
      ],
      STACK_PAL,
    ),
    // Model 3.
    sprite(
      [
        '..........oooooooo............',
        '.......oooGGGGGGGGooo.........',
        '....oooRRRGGGGGGGGGRRRoo......',
        '..ooRRRRRRRRRRRRRRRRRRRRRoo...',
        '.oERRRRRRRRRRRRRRRRRRRRRRRLo..',
        '.orrrrrrrrrrrrrrrrrrrrrrrrro..',
        '.oooTTTToooooooooooooTTTTooo..',
        '....oTTo.............oTTo.....',
      ],
      STACK_PAL,
    ),
  ];

  // Background traffic (tiny hovercars).
  R.TRAFFIC = [
    sprite(['..oooo...', '.oGGGGoo.', 'oEwwwwwLo', '.ooooooo.'], { o: '#07050c', G: '#20193a', w: '#3a2f63', E: '#ff2a6d', L: '#e9f6ff', glow: 'EL' }),
    sprite(['...ooo...', '.ooGGGoo.', 'oEwwwwwLo', '.ooooooo.'], { o: '#07050c', G: '#162036', w: '#2b3e66', E: '#ff3b3b', L: '#fff3c4', glow: 'EL' }),
    sprite(['....oooo....', '.oooSSSSooo.', 'oESSSSSSSSLo', '.oooooooooo.'], { o: '#07050c', S: '#59606e', E: '#ff2a3d', L: '#ffffff', glow: 'EL' }),
  ];

  // Bolt pickup (two frames for a shimmer).
  R.BOLT = [
    sprite(['....oooo', '...oYYo.', '..oYYo..', '.oYYYYoo', 'ooooYYo.', '...oYo..', '..oYo...', '..oo....'], { o: '#2a1600', Y: '#ffe14d', glow: 'Y' }),
    sprite(['....oooo', '...oWYo.', '..oYWo..', '.oYWYYoo', 'ooooYWo.', '...oYo..', '..oWo...', '..oo....'], { o: '#2a1600', Y: '#ffe14d', W: '#ffffff', glow: 'YW' }),
  ];

  // Medals by score. Named after the drive modes; Starman sits on top.
  R.MEDALS = [
    { at: 40, name: 'STARMAN', col: '#e8f3ff', rim: '#8fb7ff' },
    { at: 30, name: 'PLAID', col: '#ffd84d', rim: '#c48a12' },
    { at: 20, name: 'LUDICROUS', col: '#e6e9ef', rim: '#8a93a3' },
    { at: 10, name: 'SPORT', col: '#e0954f', rim: '#8b4b1c' },
  ];
  R.medalFor = (s) => R.MEDALS.find((m) => s >= m.at) || null;
})();
