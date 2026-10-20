/*
 * 3D mograph: a voxel heightfield and a bouncing chrome orb. A floor of 16×27 square pillars seen
 * from an orbiting camera; their heights are a slow swell plus the ripples every impact of the orb
 * sends out (the centre sinks, springs up into a crest that rolls out as a rounded-square ring
 * behind a trough ring). Pillar tops are coloured by height through a ramp of roles (low cool →
 * blush → accent high) over dark sides; the far rows are drawn soft (depth of field). The orb is
 * chrome: a sky that darkens to a horizon line (hot line + white line), the floor's own ramp
 * reflected below it with a fisheye grid, a specular dot and a glassy rim; two sun-coloured orbit
 * rings precess round it (back halves behind, front halves over it) with a satellite dot. The
 * camera, the orb's path and the readouts are fitted to the original frame by frame. Beat by beat
 * (3 beats; a longer scene repeats the middle bounce and stretches the camera, a shorter one
 * compresses it):
 *   0.00        hard cut on the beat, on an impact: white flash (+0.094, ×0.65 a frame), a pink-
 *               white bloom on the floor and over the orb, squashed into it; the rings edge-on.
 *   0.00–1.00   the camera tilts up from ~65° to ~52° (ease-out) and yaws ~10° a beat, slowing
 *               towards the end (the CAM readout prints the original's 72.8° → 46.1°, 12.9° → 36.4°).
 *   0.03–1.00   the orb rebounds (out-sine, by ~0.28), hangs (the first hang sags as the camera
 *               settles) and falls (1 − x^2.3) from 0.7 onto the impact point on the next beat; each
 *               impact (1.00, 2.00) flashes, blooms and launches a ripple. The rings spin into ghost
 *               copies for ~0.2 beat round every impact.
 *   0.25–0.31   the callouts fade in: brackets round the orb, a leader-line label (note, then R and
 *               the live height Y), the bottom-left readout (grid, live CAM yaw/pitch, formula).
 *   2.00–2.85   the last bounce goes higher (1.25×), sinks to a hover and lifts into the push.
 *   2.70–2.80   the callouts fade out.
 *   2.85–3.00   the camera pushes into the orb (scale e^(48v²), to ~2.2×) with a radial zoom
 *               blur; hard cut on the beat. s._.anchor is the orb.
 */
(() => {
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const FPB = 32.43; /* the original's frames per beat (60 fps at 111 BPM): the camera curves are written in its frames */
const LUT = 64; /* colour steps of the height ramp */

/* the readouts print the original's own camera numbers; the camera itself is fitted to its frames
   (grid silhouettes, the orb's path), in the original's frames n since the cut */
const hudPitch = (n) => 47.75 - 0.0167 * n + 25 * Math.max(0, 1 - n / 32) ** 2.5; /* the readout: 72.8° → 47.0° → 46.1° */
const hudYaw = (n) => 12.9 + 0.295 * n - 0.0037 * Math.max(0, n - 61) ** 2; /* the readout: 12.9° → 36.4° */
const camPitch = (n) => (n < 32 ? 51.97 + 12.89 * (1 - n / 32) ** 2.3 : 51.97 - (1.25 * (n - 32)) / 44);
const camYaw = (n) => 2.08 - 1.126 * (13.2 + 0.295 * n - 0.005 * Math.max(0, n - 60) ** 2);

Reel.scene("voxels", {
  label: "3D MOGRAPH",
  bg: "deep",
  beats: 3,
  shutter: 1, /* the original's blur is long: a full-frame shutter */
  params: {
    cols: 16, rows: 27, /* pillars across and deep */
    object: "sphere", /* the bouncing thing: "sphere" (a chrome orb) or any shape spec (a chrome badge of it) */
    ramp: ["cool", "blush", "accent"], /* pillar top colours, low → high (roles); the orb reflects them */
    ring: "sun", /* the orbit rings and the satellite dot */
    note: "ORB / CHROME", /* the object callout, top right */
    sub: "R 130  Y {y}", /* its second line; {y} is the live height, 3 digits */
    top: "GRID {cols}×{rows}  N={n}", /* readout line 1, bottom left; {cols} {rows} {n} */
    cam: "CAM  YAW {yaw}°  PITCH {pitch}°", /* readout line 2: the live camera */
    formula: "h(x,z) = Σ A·cos(k(r−vt))·e^(−λt)", /* readout line 3, as written (not upper-cased) */
  },
  prepare(s, g) {
    const C = Math.max(2, Math.round(s.cols)), Rw = Math.max(2, Math.round(s.rows));
    /* the impact point: column ~C/2, row ~0.52 of the way in from the far edge */
    const ix = Math.floor(C / 2), iz = Math.round(Rw * 0.52);
    const cells = [];
    for (let i = 0; i < C; i++) for (let j = 0; j < Rw; j++) {
      const x = i - ix, z = iz - j; /* world: x right, z away from the camera, the impact at 0,0 */
      const r = Math.sqrt(Math.sqrt(x ** 4 + z ** 4));
      cells.push({ x, z, r, calm: g.smoothstep(2, 7, r), h: 0, k: 0, d: 0 });
    }
    /* colours: the height ramp through the roles, and the dark sides */
    const stops = [].concat(s.ramp).map((c) => g.col(c));
    const lo = g.mix(stops[0], stops[1] || stops[0], 0.08);
    const ramp = (k) => {
      const q = [[0, lo], [0.3, g.mix(stops[0], stops[1] || stops[0], 0.45)], [0.5, g.mix(stops[0], stops[1] || stops[0], 0.75)], [0.7, stops[1] || stops[0]], [1, stops[2] || stops[1] || stops[0]]];
      for (let m = 1; m < q.length; m++) if (k <= q[m][0]) return g.mix(q[m - 1][1], q[m][1], (k - q[m - 1][0]) / (q[m][0] - q[m - 1][0]));
      return q[q.length - 1][1];
    };
    const dark = g.mix(g.c.ink, g.mix(g.c.accent, g.c.cool, 0.25), 0.25);
    const top = [], sideA = [], sideB = [];
    for (let m = 0; m <= LUT; m++) { const c = ramp(m / LUT); top.push(c); sideA.push(g.mix(c, dark, 0.68)); sideB.push(g.mix(c, dark, 0.8)); }
    const bg = g.col(s.bg), ink = g.on(bg);
    const fill = (str, o) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
    return {
      cells, order: cells.slice(), top, sideA, sideB,
      ground: groundCanvas(g, [g.mix(g.mix(bg, g.c.cool, 0.1), "#000000", 0.25), g.mix(g.mix(bg, g.c.cool, 0.12), "#000000", 0.5)]),
      bloom: g.mix(stops[1] || g.c.blush, "#ffffff", 0.6),
      dof: dofCanvas(g),
      orb: (() => {
        /* the chrome: a sky that darkens to night at the horizon, the floor's ramp reflected below */
        const haze = g.mix(g.mix(g.c.sky, g.c.cool, 0.2), bg, 0.06), navy = g.mix(bg, g.c.cool, 0.22), night = g.mix(navy, "#000000", 0.45);
        const hot = ramp(1), warm = g.mix(hot, ramp(0.6), 0.3);
        return {
          sky: [[0, g.mix(haze, navy, 0.3)], [0.17, haze], [0.38, g.mix(haze, navy, 0.4)], [0.52, g.mix(haze, navy, 0.75)], [0.68, navy], [0.86, night]],
          floor: [[0, g.mix(ramp(0.22), night, 0.45)], [0.1, g.mix(ramp(0.22), bg, 0.2)], [0.18, g.mix(ramp(0.32), bg, 0.12)], [0.27, ramp(0.45)], [0.38, ramp(0.66)],
            [0.5, g.mix(ramp(0.7), hot, 0.3)], [0.62, g.mix(warm, g.c.ink, 0.1)], [0.74, g.mix(warm, g.c.ink, 0.18)], [0.86, g.mix(warm, bg, 0.4)], [1, g.mix(ramp(0.5), bg, 0.45)]],
          line: g.mix(hot, g.c.ink, 0.25), grid: g.mix(g.c.ink, g.c.accent, 0.2),
        };
      })(),
      ringCol: g.col(s.ring), ui: g.mix(ink, g.c.sky, 0.3),
      top1: fill(s.top, { cols: C, rows: Rw, n: C * Rw }), fill,
      mask: s.object !== "sphere" && s.object !== "circle" ? g.mask(s.object, 256) : null,
      anchor: [g.box.cx, g.box.cy],
    };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, B = s.beats;
    const ph = phase(t.b, B), cam = camera(ph.uc, g);
    /* the push-in: the whole 3D layer scales into the orb on the last 0.154 beat (to ~2.2×) */
    const v = Math.min(0.128, Math.max(0, t.b - (B - 0.154))), S = Math.exp(48 * v * v);
    if (S > 1.002) {
      const L = g.layer("voxels-3d");
      world(g, s, L.ctx, ph, cam);
      const S0 = Math.exp(48 * Math.max(0, v - 0.6 / FPB) ** 2), N = Math.min(7, 3 + Math.round((16 * (S - S0)) / S)), zx = g.W * ZOOM[0], zy = g.H * ZOOM[1], k0 = g.scale;
      ctx.save();
      /* a radial zoom blur: copies across the last 0.6 frame of the push, averaged */
      for (let k = 0; k < N; k++) {
        const z = S0 + ((S - S0) * k) / (N - 1);
        ctx.globalAlpha = 1 / (k + 1);
        ctx.setTransform(z, 0, 0, z, zx * k0 * (1 - z), zy * k0 * (1 - z));
        ctx.drawImage(L.canvas, 0, 0);
      }
      ctx.restore();
      _.anchor = [zx + (_.anchor[0] - zx) * S, zy + (_.anchor[1] - zy) * S]; _.anchorR *= S;
    } else world(g, s, ctx, ph, cam);
    /* the flash on every impact, over everything but the HUD */
    const fl = 0.094 * Math.exp(-ph.p / 0.071);
    if (fl > 0.004) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,255,255,${fl.toFixed(4)})`; ctx.fillRect(0, 0, g.W, g.H); ctx.restore(); }
    /* the callouts, sharp: drawn at the frame's own beat so the live numbers never blend */
    const a = g.smoothstep(0.25, 0.31, t.bq) * (1 - g.smoothstep(B - 0.3, B - 0.2, t.bq));
    if (a > 0.01) callouts(g, s, phase(t.bq, B), a);
  },
});

const ZOOM = [0.5, 0.427]; /* screen centre of the push-in, as fractions of the frame */

/*
 * The scene's beat → its phase in the original's 3-beat choreography. Bounces and ripples run on
 * every beat (k, p); kk is the original's cycle (0 the first, 2 the last, 1 any in between) and uc
 * the camera's beat (the first and last beats keep their length, the middle ones stretch).
 */
function phase(b, B) {
  const k = Math.floor(b), p = b - k, kk = k <= 0 ? 0 : k >= B - 1 ? 2 : 1;
  const uc = B < 3 ? (b * 3) / Math.max(0.5, B) : b < 1 ? b : b > B - 1 ? 2 + (b - (B - 1)) : 1 + (b - 1) / (B - 2);
  return { b, k, p, kk, uc };
}

/* the effective camera at camera-beat uc, with its pivot, distance and lens (fitted to the original) */
function camera(uc, g) {
  const n = uc * FPB, yaw = camYaw(n) * DEG, pitch = camPitch(n) * DEG;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  /* fitted in the 1080×1920 design space; another frame size scales the lens and the centre */
  const W = g.W, H = g.H, k = Math.min(W / 1080, H / 1920);
  const T = [0.559, 4.564, -0.499], D = 23.32, f = 1345 * k, ox = W / 2 + 76.5 * k, oy = H / 2 - 37.4 * k;
  return {
    yaw, pitch, f, W, H,
    pos: [T[0] + D * cp * sy, T[1] + D * sp, T[2] - D * cp * cy],
    /* world [x, y up, z] → screen { x, y, d } */
    p(x, y, z) {
      x -= T[0]; y -= T[1]; z -= T[2];
      const X = x * cy + z * sy, Z = -x * sy + z * cy, Y = -y;
      const Y2 = Y * cp - Z * sp, d = Math.max(0.3, D + Y * sp + Z * cp);
      return { x: ox + (f * X) / d, y: oy + (f * Y2) / d, d };
    },
  };
}

/*
 * The heights at beat b: base 1, a slow swell rolling along z (calm near the centre), and the
 * ripples of the last three impacts (one on every beat; those before the scene are implied, at
 * half strength, so it opens busy). Each impact, τ beats on: the centre sinks at the hit; a trough
 * ring runs out 3.2 cells ahead of the crest; the crest grows up out of the centre as a bump,
 * widens to a plateau and from 0.4 beat rolls out as a ring at 9.5 cells a beat, fading slowly
 * (e^(-0.3τ)). Distances are rounded-square, like the grid.
 */
function heights(s, b) {
  const k0 = Math.floor(b);
  for (const c of s._.cells) {
    let h = 1 + 0.3 * c.calm * Math.sin(TAU * (c.z / 18 - b / 2));
    for (let k = k0 - 2; k <= k0; k++) {
      const tau = b - k, rc = 9.5 * (tau - 0.4), A = Math.exp(-0.3 * tau) * (k < 0 ? 0.45 : 1), r = c.r;
      h += 1.1 * A * ss(0.08, 0.35, tau) * Math.exp(-(((r - Math.max(0, rc)) / (2.6 - 0.6 * ss(0.35, 0.6, tau))) ** 2));
      h -= 0.95 * A * ss(0.0, 0.18, tau) * Math.exp(-(((r - rc - 3.2) / 1.5) ** 2));
      if (tau < 0.6) h -= 0.9 * Math.exp(-tau / 0.12) * Math.exp(-((r / 2) ** 2));
    }
    c.h = Math.max(0.12, h);
    c.k = Math.round(g01((h - 0.1) / 1.8) * LUT);
  }
}
const g01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/*
 * The orb's lift above its rest (×ORB_LIFT cells) and its squash, by phase, measured off the
 * original: an out-sine rebound, a hang, a fall (1 − x^2.3) onto the next beat. The first hang
 * sags as the camera settles; the last bounce goes higher, sinks to a hover and lifts into the push.
 */
const outSine = (x) => Math.sin((g01(x) * Math.PI) / 2);
function bounce(ph) {
  const p = ph.p, fall = (top) => (p > 0.7 ? top * (1 - ((p - 0.7) / 0.3) ** 2.3) : top);
  let L;
  if (ph.kk === 0) L = outSine((p - 0.06) / 0.22) * fall(1.0 - 0.16 * ss(0.28, 0.62, p));
  else if (ph.kk === 1) L = outSine((p - 0.04) / 0.23) * fall(1.03 + 0.03 * ss(0.3, 0.6, p));
  else L = outSine((p - 0.03) / 0.22) * (1.245 - 0.415 * ss(0.27, 0.64, p) + 0.07 * ss(0.7, 0.9, p));
  const q = Math.exp(-p / 0.035);
  return { L, sx: 1 + 0.16 * q, sy: 1 - 0.3 * q };
}
const ss = (a, b, x) => { const t = g01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/* the height readout (Y) as the original prints it */
function readY(ph) {
  const k = ph.kk, p = ph.p;
  if (k >= 2) return p < 0.22 ? 256 * outSine(p / 0.22) : 256 - 22 * ss(0.22, 0.68, p);
  const top = k === 0 ? 295 : 289;
  if (p < 0.24) return 235 * outSine(p / 0.24);
  if (p < 0.36) return 235 + (4 * (p - 0.24)) / 0.12;
  if (p < 0.64) return 239 + (top - 239) * (1 - (1 - (p - 0.36) / 0.28) ** 2);
  return top * (1 - ((p - 0.64) / 0.36) ** 2.2);
}

const ORB_R = 2.39, ORB_REST = 4.61, ORB_LIFT = 6.6; /* the orb in cells: radius, centre height at rest, lift */

const DOF = 0.4; /* the farthest share of the pillars, drawn soft */
/* the soft layer for the far rows: a third of the canvas's resolution */
function dofCanvas(g) {
  const cv = document.createElement("canvas"); cv.width = Math.ceil(g.canvas.width / 3); cv.height = Math.ceil(g.canvas.height / 3);
  return cv;
}

/* the ground: navy, lifted softly toward the middle */
function ground(g, s, ctx) { ctx.drawImage(s._.ground, 0, 0, g.W, g.H); }
/* painted once, at the canvas's own resolution (a full-frame gradient per frame costs more than a blit) */
function groundCanvas(g, [mid, edge]) {
  const cv = document.createElement("canvas"); cv.width = g.canvas.width; cv.height = g.canvas.height;
  const c = cv.getContext("2d"); c.scale(g.scale, g.scale);
  const gr = c.createRadialGradient(500, 820, 60, 540, 900, 1250);
  gr.addColorStop(0, mid); gr.addColorStop(1, edge);
  c.fillStyle = gr; c.fillRect(0, 0, g.W, g.H);
  return cv;
}

/* the ground, the floor, the orb and its rings, the bloom: everything the push-in scales */
function world(g, s, ctx, ph, cam) {
  const _ = s._;
  ground(g, s, ctx);
  heights(s, ph.b);
  const cp = cam.pos, hs = 0.41;
  for (const c of _.cells) c.d = (c.x - cp[0]) ** 2 + (c.z - cp[2]) ** 2;
  _.order.sort((a, b) => b.d - a.d);
  /* depth of field: the far rows are drawn small and scaled up, soft; the rest sharp over them */
  const far = Math.round(_.order.length * DOF), dc = _.dof.getContext("2d"), dk = (_.dof.width / g.canvas.width) * g.scale;
  dc.setTransform(1, 0, 0, 1, 0, 0); dc.clearRect(0, 0, _.dof.width, _.dof.height); dc.setTransform(dk, 0, 0, dk, 0, 0);
  for (let i = 0; i < far; i++) pillar(dc, cam, _.order[i], hs, cp, _);
  ctx.drawImage(_.dof, 0, 0, g.W, g.H);
  for (let i = far; i < _.order.length; i++) pillar(ctx, cam, _.order[i], hs, cp, _);
  /* the bloom where it lands: on the floor, and again (fainter) over the orb sunk in it */
  const bl = 0.95 * Math.exp(-ph.p / 0.12), ip = cam.p(0, 1, 0), rr = 380 * (1 + 0.5 * ph.p);
  const bloom = (k) => {
    if (bl * k < 0.01) return;
    const b = ctx.createRadialGradient(ip.x, ip.y, 0, ip.x, ip.y, rr);
    b.addColorStop(0, g.rgba(_.bloom, bl * k)); b.addColorStop(0.35, g.rgba(_.bloom, bl * k * 0.6)); b.addColorStop(0.7, g.rgba(_.bloom, bl * k * 0.18)); b.addColorStop(1, g.rgba(_.bloom, 0));
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = b; ctx.fillRect(ip.x - rr, ip.y - rr, rr * 2, rr * 2); ctx.restore();
  };
  bloom(1);
  /* the orb, which always floats over the floor, inside its rings */
  const bo = bounce(ph), oc = cam.p(0, ORB_REST + ORB_LIFT * bo.L, 0), R = (cam.f * ORB_R) / oc.d;
  _.anchor = [oc.x, oc.y]; _.anchorR = R * 0.2;
  const rings = ringSet(ph, s.beats, oc, R);
  drawRings(g, ctx, rings, _, false);
  drawOrb(g, s, ctx, oc.x, oc.y, R * bo.sx, R * bo.sy);
  drawRings(g, ctx, rings, _, true);
  bloom(0.7);
}

/* one pillar: its (up to two) visible sides, then its top */
function pillar(ctx, cam, c, hs, cp, _) {
  const x0 = c.x - hs, x1 = c.x + hs, z0 = c.z - hs, z1 = c.z + hs, h = c.h;
  const t00 = cam.p(x0, h, z0), t10 = cam.p(x1, h, z0), t11 = cam.p(x1, h, z1), t01 = cam.p(x0, h, z1);
  /* off the frame (below it, or wholly to one side): nothing to draw */
  const W = cam.W, H = cam.H;
  if (Math.min(t00.y, t10.y, t11.y, t01.y) > H || Math.max(t00.x, t10.x, t11.x, t01.x) < -20 || Math.min(t00.x, t10.x, t11.x, t01.x) > W + 20) return;
  const quad = (a, b, cc, d) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); };
  if (cp[2] < z0) { const b0 = cam.p(x0, 0, z0), b1 = cam.p(x1, 0, z0); ctx.fillStyle = _.sideA[c.k]; quad(t00, t10, b1, b0); }
  else if (cp[2] > z1) { const b0 = cam.p(x0, 0, z1), b1 = cam.p(x1, 0, z1); ctx.fillStyle = _.sideA[c.k]; quad(t01, t11, b1, b0); }
  if (cp[0] < x0) { const b0 = cam.p(x0, 0, z0), b1 = cam.p(x0, 0, z1); ctx.fillStyle = _.sideB[c.k]; quad(t00, t01, b1, b0); }
  else if (cp[0] > x1) { const b0 = cam.p(x1, 0, z0), b1 = cam.p(x1, 0, z1); ctx.fillStyle = _.sideB[c.k]; quad(t10, t11, b1, b0); }
  ctx.fillStyle = _.top[c.k]; quad(t00, t10, t11, t01);
}

/* the two orbit rings: precessing ellipses round the orb, gone into spin ghosts round an impact */
function ringSet(ph, B, oc, R) {
  /* the beats to the last impact and to the next one inside the scene (the cut is not one) */
  const u = ph.b, dn = Math.min(ph.p, ph.k + 1 < B ? 1 - ph.p : 1), tilt = -10 * (u - 0.4);
  /* at the cut in they are still edge-on (the camera looks straight down), then spin out */
  const flat = 0.12 + 0.88 * ss(0, 0.25, ph.uc), a = Math.max(ss(0.12, 0.24, dn), ph.k === 0 ? 1 - ss(0.03, 0.1, ph.p) : 0);
  return {
    a, u, dot: Math.PI * (u - 1.42),
    list: [
      { cx: oc.x - 0.02 * R, cy: oc.y - 0.19 * R * flat, A: 1.84 * R, Bm: 0.42 * 1.84 * R * flat, phi: (-17 + tilt) * DEG * flat },
      { cx: oc.x - 0.1 * R, cy: oc.y - 0.35 * R * flat, A: 2.18 * R, Bm: 0.63 * 2.18 * R * flat, phi: (-22 + tilt) * DEG * flat },
    ],
  };
}
function drawRings(g, ctx, rs, _, front) {
  ctx.save(); ctx.lineWidth = 2.8; ctx.lineCap = "round";
  const half = (r, phi, alpha) => {
    ctx.strokeStyle = g.rgba(_.ringCol, 0.85 * alpha); ctx.beginPath();
    ctx.ellipse(r.cx, r.cy, r.A, r.Bm, phi, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
  };
  for (const r of rs.list) {
    if (rs.a > 0.01) half(r, r.phi, rs.a * (front ? 1 : 0.72));
    if (rs.a < 0.99) for (let k = 1; k <= 4; k++) for (const sg of [-1, 1]) half(r, r.phi + sg * k * 6 * DEG, 0.15 * (1 - rs.a) * (front ? 1 : 0.6));
  }
  /* the satellite on the inner ring */
  const r = rs.list[0], th = rs.dot, inFront = Math.sin(th) > 0;
  if (inFront === front && rs.a > 0.01) {
    const cph = Math.cos(r.phi), sph = Math.sin(r.phi), ex = r.A * Math.cos(th), ey = r.Bm * Math.sin(th);
    ctx.fillStyle = g.rgba(_.ringCol, rs.a); ctx.beginPath(); ctx.arc(r.cx + ex * cph - ey * sph, r.cy + ex * sph + ey * cph, 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* the chrome orb (or a chrome badge of the object's shape) at (x, y), radii rx × ry */
function drawOrb(g, s, ctx, x, y, rx, ry) {
  const o = s._.orb, R = Math.max(rx, ry);
  if (R < 1) return;
  const paint = (c) => {
    c.save();
    c.translate(x, y); c.scale(rx / R, ry / R); c.translate(-x, -y);
    const hy = y + 0.1 * R;
    const up = c.createLinearGradient(0, y - R, 0, hy);
    for (const [k, col] of o.sky) up.addColorStop(k, col);
    c.fillStyle = up; c.fillRect(x - R, y - R, 2 * R, hy - (y - R));
    const dn = c.createLinearGradient(0, hy, 0, y + R);
    for (const [k, col] of o.floor) dn.addColorStop(k, col);
    c.fillStyle = dn; c.fillRect(x - R, hy, 2 * R, y + R - hy);
    /* the reflected floor's grid: meridians bending into a pole below the orb, a few latitudes */
    c.strokeStyle = g.rgba(o.grid, 0.55); c.lineWidth = Math.max(0.8, R / 115); c.beginPath();
    for (let m = 0; m < 13; m++) {
      const a = -1.3 + (2.6 * m) / 12, x0 = x + R * Math.sin(a);
      c.moveTo(x0, hy + 3); c.quadraticCurveTo(x + (x0 - x) * 0.82, y + 0.62 * R, x + (x0 - x) * 0.3, y + 1.05 * R);
    }
    for (let m = 1; m <= 4; m++) {
      const yy = hy + ((y + R - hy) * m) / 5.2, w = Math.sqrt(Math.max(0, R * R - (yy - y) ** 2));
      c.moveTo(x - w, yy); c.quadraticCurveTo(x, yy + 0.07 * R, x + w, yy);
    }
    c.stroke();
    /* the horizon: a hot line, a white line under it */
    c.fillStyle = o.line; c.fillRect(x - R, hy - 5, 2 * R, 5);
    c.fillStyle = "rgba(255,255,255,0.9)"; c.fillRect(x - R, hy, 2 * R, 2);
    /* specular and its glow */
    const sx = x - 0.31 * R, sy = y - 0.37 * R, gl = c.createRadialGradient(sx, sy, 0, sx, sy, 0.5 * R);
    gl.addColorStop(0, "rgba(255,255,255,0.6)"); gl.addColorStop(0.4, "rgba(255,255,255,0.2)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gl; c.fillRect(sx - 0.5 * R, sy - 0.5 * R, R, R);
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(sx, sy, 0.07 * R, 0, TAU); c.fill();
    /* the glassy rim */
    const rim = c.createRadialGradient(x, y, 0.8 * R, x, y, R);
    rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(0.7, "rgba(255,255,255,0.08)"); rim.addColorStop(1, "rgba(255,255,255,0.3)");
    c.fillStyle = rim; c.fillRect(x - R, y - R, 2 * R, 2 * R);
    c.restore();
  };
  if (!s._.mask) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip(); paint(ctx); ctx.restore();
  } else {
    /* a badge: the chrome painted into a layer, cut to the shape's silhouette */
    const L = g.layer("voxels-badge"), m = s._.mask, k = (2 * R) / (m.size * 0.92);
    paint(L.ctx);
    L.ctx.save(); L.ctx.globalCompositeOperation = "destination-in";
    L.ctx.translate(x, y); L.ctx.scale((k * rx) / R, (k * ry) / R); L.ctx.drawImage(m.canvas, -m.size / 2, -m.size / 2); L.ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas, 0, 0); ctx.restore();
  }
}

/* the mono callouts: brackets and a leader-line label on the orb, the readout bottom left */
function callouts(g, s, ph, a) {
  const { ctx } = g, _ = s._, box = g.box, ui = _.ui, n = ph.uc * FPB;
  /* where the orb is on this frame (the frame's own beat) */
  const cam = camera(ph.uc, g), bo = bounce(ph), oc = cam.p(0, ORB_REST + ORB_LIFT * bo.L, 0), R = (cam.f * ORB_R) / oc.d;
  ctx.save(); ctx.globalAlpha *= a;
  /* brackets round the orb */
  const hb = 1.36 * R;
  g.brackets(oc.x - hb, oc.y - hb, 2 * hb, 2 * hb, { len: 14, width: 1.5, color: ui, alpha: 0.55 });
  /* the label: fixed on screen, its leader follows the orb's rim */
  const ly = box.y + 81.5, o = { kind: "mono", size: 14, weight: 600, track: 1.5 };
  const yv = String(Math.max(0, Math.round(readY(ph)))).padStart(3, "0");
  const t1 = String(s.note).toUpperCase(), t2 = _.fill(s.sub, { y: yv }).toUpperCase();
  /* a longer label moves left (as far as the middle), then shrinks */
  const room = box.r - 26 - box.cx;
  o.size = Math.min(14, g.fit(t1, o, room), g.fit(t2, o, room));
  const w = Math.max(g.measure(t1, o), g.measure(t2, o)), lx = Math.min(box.r - 247.5, box.r - 26 - w);
  const kx = lx - 19, ky = ly + 13, ex = Math.max(box.r - 82.5, lx + w + 12);
  const rx = oc.x + 1.06 * R * Math.cos(-45 * DEG), ry = oc.y + 1.06 * R * Math.sin(-45 * DEG);
  ctx.strokeStyle = g.rgba(ui, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(kx, ky); ctx.lineTo(ex, ky); ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(rx - 2.5, ry - 2.5, 5, 5);
  g.text(t1, lx, ly, Object.assign({ color: ui, alpha: 0.88 }, o));
  g.text(t2, lx, ly + 30, Object.assign({ color: ui, alpha: 0.6 }, o, { weight: 500 }));
  /* the readout */
  const r = { kind: "mono", size: 15, weight: 500, track: 0.9 }, lh = 22 * g.grow(r.size), x0 = box.x + 29.5, y0 = box.b - 47 - 2 * lh;
  const yaw = hudYaw(n).toFixed(1).padStart(5, "0"), pitch = hudPitch(n).toFixed(1);
  g.text(_.top1.toUpperCase(), x0, y0, Object.assign({ color: ui, alpha: 0.88 }, r, { weight: 600 }));
  g.text(_.fill(s.cam, { yaw, pitch }).toUpperCase(), x0, y0 + lh, Object.assign({ color: ui, alpha: 0.6 }, r));
  g.text(s.formula, x0, y0 + 2 * lh, Object.assign({ color: ui, alpha: 0.4 }, r));
  ctx.restore();
}
})();
