// Eyes that follow the pointer on a pre-rendered character frame.
//
// Each eye in character.json has "x", "y", "rx", "ry" (fractions of the frame) for the part that moves
// (pupil / bead / iris), "shift" = max travel as a fraction of its radius, and optionally:
//   "socket": ellipse around the eye-white, for irises: the moved iris is clipped to it (plus its original spot).
//   "fill":   override for the paint-over colour.
//   "paint", "maskPad": override the iris margins below (narrow, lidded eyes need tighter ones).
// We cut the moving part out as a patch, paint over it (eye-white colour in a socket, else the skin around it),
// then redraw the patch offset toward the pointer every frame, clipped to the eye mask, optionally squashed to blink.

// Detected radii cover the dark core; real eyes have a rim and soft shadow beyond it. These margins make sure the
// moving patch carries all of it and the paint-over covers all of it, so no ring is left behind.
const TRAVEL = 1.35;                                   // global multiplier on every eye's "shift"
const BEAD = { patch: 1.45, paint: 1.6 };              // bead / pupil eyes on skin
const IRIS = { patch: 1.22, paint: 1.32, mask: 1.25 }; // irises inside an eye-white

export class EyeRig {
  constructor(image, eyes, { blink = false } = {}) {
    this.eyes = eyes;
    this.blink = blink;
    const W = (this.W = image.naturalWidth), H = (this.H = image.naturalHeight);

    const base = canvas(W, H);
    const bctx = base.getContext("2d", { willReadFrequently: true });
    bctx.drawImage(image, 0, 0);
    const px = bctx.getImageData(0, 0, W, H).data;

    this.patches = eyes.map(e => {
      const cx = e.x * W, cy = e.y * H, rx = e.rx * W, ry = e.ry * H, pad = e.socket ? IRIS.patch : BEAD.patch;
      const pw = Math.ceil(rx * 2 * pad), ph = Math.ceil(ry * 2 * pad);
      const patch = canvas(pw, ph), p = patch.getContext("2d");
      p.drawImage(image, cx - pw / 2, cy - ph / 2, pw, ph, 0, 0, pw, ph);
      p.globalCompositeOperation = "destination-in";
      softEllipse(p, pw / 2, ph / 2, rx * pad, ry * pad, 0.84, "#000");
      const fill = e.fill ? hexRGB(e.fill) : e.socket ? scleraColour(px, W, H, e) : ringColour(px, W, H, cx, cy, rx * BEAD.paint * 1.1, ry * BEAD.paint * 1.1);
      const mask = e.socket ? eyeMask(W, H, e) : null;
      return { patch, cx, cy, rx, ry, pw, ph, fill, mask };
    });

    // The frame with every eye painted out.
    this.erased = canvas(W, H);
    const ectx = this.erased.getContext("2d");
    ectx.drawImage(base, 0, 0);
    for (const p of this.patches) {
      if (!p.mask) { softEllipse(ectx, p.cx, p.cy, p.rx * BEAD.paint, p.ry * BEAD.paint, 0.74, p.fill); continue; }
      // paint the iris's original spot with the eye-white colour, kept inside the eye
      const m = p.mask, t = m.tmp.getContext("2d");
      t.clearRect(0, 0, m.w, m.h);
      const paint = this.eyes[this.patches.indexOf(p)].paint ?? IRIS.paint;
      softEllipse(t, p.cx - m.x, p.cy - m.y, p.rx * paint, p.ry * paint, 0.86, p.fill);
      t.globalCompositeOperation = "destination-in";
      t.drawImage(m.canvas, 0, 0);
      t.globalCompositeOperation = "source-over";
      ectx.drawImage(m.tmp, m.x, m.y);
    }

    this.out = canvas(W, H);
    this.octx = this.out.getContext("2d");
  }

  // look: {x, y} in -1..1 (direction × strength); blink: 0 open … 1 shut
  render(look, blink = 0) {
    const c = this.octx;
    c.clearRect(0, 0, this.W, this.H);
    c.drawImage(this.erased, 0, 0);
    const squash = this.blink ? 1 - 0.88 * blink : 1;
    this.eyes.forEach((e, i) => {
      const p = this.patches[i], shift = (e.shift ?? 0.35) * TRAVEL;
      const x = p.cx + look.x * shift * p.rx, y = p.cy + look.y * shift * p.ry;
      if (!p.mask) {
        c.save();
        c.translate(x, y);
        c.scale(1, squash);
        c.drawImage(p.patch, -p.pw / 2, -p.ph / 2);
        c.restore();
        return;
      }
      // iris: draw into the mask's local canvas, keep only what falls inside the eye, then composite
      const m = p.mask, t = m.tmp.getContext("2d");
      t.clearRect(0, 0, m.w, m.h);
      t.drawImage(p.patch, x - m.x - p.pw / 2, y - m.y - p.ph / 2);
      t.globalCompositeOperation = "destination-in";
      t.drawImage(m.canvas, 0, 0);
      t.globalCompositeOperation = "source-over";
      c.drawImage(m.tmp, m.x, m.y);
    });
    return this.out;
  }
}

const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// Where an iris may show: the eye-white ellipse plus the iris's original spot (feathered), in a local canvas.
function eyeMask(W, H, e) {
  const S = e.socket, pad = e.maskPad ?? IRIS.mask;
  const x0 = Math.floor(Math.min(S.x - S.rx, e.x - e.rx * pad) * W) - 2, x1 = Math.ceil(Math.max(S.x + S.rx, e.x + e.rx * pad) * W) + 2;
  const y0 = Math.floor(Math.min(S.y - S.ry, e.y - e.ry * pad) * H) - 2, y1 = Math.ceil(Math.max(S.y + S.ry, e.y + e.ry * pad) * H) + 2;
  const w = x1 - x0, h = y1 - y0;
  const c = canvas(w, h), ctx = c.getContext("2d");
  softEllipse(ctx, S.x * W - x0, S.y * H - y0, S.rx * W, S.ry * H, 0.9, "#000");
  softEllipse(ctx, e.x * W - x0, e.y * H - y0, e.rx * W * pad, e.ry * H * pad, 0.88, "#000");
  return { canvas: c, tmp: canvas(w, h), x: x0, y: y0, w, h };
}

// Eye-white colour: the brightest third of the socket's pixels, ignoring the iris.
function scleraColour(px, W, H, e) {
  const S = e.socket, cols = [];
  const x0 = Math.floor((S.x - S.rx) * W), x1 = Math.ceil((S.x + S.rx) * W);
  const y0 = Math.floor((S.y - S.ry) * H), y1 = Math.ceil((S.y + S.ry) * H);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const sx = (x / W - S.x) / S.rx, sy = (y / H - S.y) / S.ry;
    const ix = (x / W - e.x) / (e.rx * 1.15), iy = (y / H - e.y) / (e.ry * 1.15);
    if (sx * sx + sy * sy > 0.8 || ix * ix + iy * iy < 1) continue;
    const o = (y * W + x) * 4;
    cols.push([px[o], px[o + 1], px[o + 2]]);
  }
  if (!cols.length) return [240, 238, 236];
  cols.sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2]));
  const top = cols.slice(0, Math.max(1, Math.round(cols.length / 3)));
  return [0, 1, 2].map(c => Math.round(top.reduce((s, v) => s + v[c], 0) / top.length));
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// Ellipse solid to `hard` of its radius, then feathered to transparent.
function softEllipse(ctx, cx, cy, rx, ry, hard, colour) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const [r, gg, b] = typeof colour === "string" ? [0, 0, 0] : colour;
  const solid = typeof colour === "string" ? colour : `rgb(${r} ${gg} ${b})`;
  const clear = typeof colour === "string" ? "rgba(0,0,0,0)" : `rgb(${r} ${gg} ${b} / 0)`;
  g.addColorStop(0, solid); g.addColorStop(hard, solid); g.addColorStop(1, clear);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Median colour of opaque pixels on an elliptical ring: the skin / sclera / fur around the eye.
function ringColour(px, W, H, cx, cy, rx, ry) {
  const ch = [[], [], []];
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const o = (y * W + x) * 4;
    if (px[o + 3] < 200) continue;
    for (let c = 0; c < 3; c++) ch[c].push(px[o + c]);
  }
  return ch.map(v => (v.sort((a, b) => a - b), v[v.length >> 1] ?? 128));
}
