// Find exactly where a close-up sits in its parent, so the zoom hands over without a jump.
//
//   node align.mjs <id> <level>        measure the kept picture, save it in out/<id>/align.json
//   node align.mjs <id>                every level that has a crop
//
// A close-up is made from an enlarged crop of its parent, but the model can shift or rescale it a little. The close-up
// is softened to what the crop really holds, then its best scale and shift are searched, coarse to fine, on brightness
// with slow light changes removed. rho is how well they then agree (1 is perfect). A weak match (rho under 0.5, or a
// scale or shift that looks wrong) keeps the planned rect and says so.
import sharp from "sharp";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirOf, loadTree, readJson } from "./common.mjs";

export const WEAK = 0.5;

async function plane(input, w, h) {
  const base = sharp(input).greyscale().resize(w, h, { fit: "fill", kernel: "lanczos3" }).removeAlpha();
  const raw = async (s) => new Float32Array(await s.raw().toBuffer());
  const png = await base.png().toBuffer();
  const [a, low] = await Promise.all([raw(sharp(png).greyscale().blur(0.6)), raw(sharp(png).greyscale().blur(Math.max(1, w / 24)))]);
  const g = new Float32Array(w * h);
  let m = 0;
  for (let i = 0; i < g.length; i++) { g[i] = a[i] - low[i]; m += g[i]; }
  m /= g.length;
  let s = 0;
  for (let i = 0; i < g.length; i++) { g[i] -= m; s += g[i] * g[i]; }
  s = Math.sqrt(s / g.length) || 1;
  for (let i = 0; i < g.length; i++) g[i] /= s;
  return { g, w, h };
}

// how well close(k·x + t) agrees with crop(x), inside the middle of the frame
function score(A, B, k, tx, ty) {
  const { w, h } = A;
  let sa = 0, sb = 0, aa = 0, bb = 0, ab = 0, n = 0;
  const mx = Math.floor(w * 0.04), my = Math.floor(h * 0.04);
  for (let y = my; y < h - my; y++) {
    const ny = y / (h - 1), v = (k * ny + ty) * (B.h - 1);
    if (v < 0 || v >= B.h - 1) continue;
    const y0 = v | 0, fy = v - y0;
    for (let x = mx; x < w - mx; x++) {
      const nx = x / (w - 1), u = (k * nx + tx) * (B.w - 1);
      if (u < 0 || u >= B.w - 1) continue;
      const x0 = u | 0, fx = u - x0, i = y0 * B.w + x0;
      const b = (B.g[i] * (1 - fx) + B.g[i + 1] * fx) * (1 - fy) + (B.g[i + B.w] * (1 - fx) + B.g[i + B.w + 1] * fx) * fy;
      const a = A.g[y * w + x];
      sa += a; sb += b; aa += a * a; bb += b * b; ab += a * b; n++;
    }
  }
  if (n < w * h * 0.5) return -1;
  const d = Math.sqrt((aa - (sa * sa) / n) * (bb - (sb * sb) / n));
  return d > 1e-6 ? (ab - (sa * sb) / n) / d : -1;
}

/** Best { k, tx, ty, rho } with close(k·x + t) ≈ crop(x), both in shares of the frame. */
export async function fit(cropPath, closePath, cropPx) {
  const soft = await sharp(closePath).resize(Math.max(8, cropPx.width), Math.max(8, cropPx.height), { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
  const at = async (w) => { const h = Math.round((w * 9) / 16); return [await plane(cropPath, w, h), await plane(soft, w, h)]; };
  let [A, B] = await at(112);
  let best = { k: 1, tx: 0, ty: 0, rho: -1 };
  for (let k = 0.86; k <= 1.161; k += 0.02) {
    const c = (1 - k) / 2;
    for (let dx = -0.1; dx <= 0.1001; dx += 0.0125) {
      for (let dy = -0.1; dy <= 0.1001; dy += 0.0125) {
        const rho = score(A, B, k, c + dx, c + dy);
        if (rho > best.rho) best = { k, tx: c + dx, ty: c + dy, rho };
      }
    }
  }
  for (const [w, steps] of [[224, [0.008, 0.004]], [448, [0.002, 0.001]]]) {
    [A, B] = await at(w);
    best.rho = score(A, B, best.k, best.tx, best.ty);
    for (const s of steps) {
      for (let round = 0; round < 10; round++) {
        let moved = false;
        for (const key of ["k", "tx", "ty"]) {
          for (const d of [-s, s]) {
            // a change of scale keeps the middle of the frame where it is
            const t = key === "k" ? { ...best, k: best.k + d, tx: best.tx - d / 2, ty: best.ty - d / 2 } : { ...best, [key]: best[key] + d };
            t.rho = score(A, B, t.k, t.tx, t.ty);
            if (t.rho > best.rho + 1e-5) { best = t; moved = true; }
          }
        }
        if (!moved) break;
      }
    }
  }
  return best;
}

/** Measures a kept picture (or a take) against the crop it was made from. Saved unless `dry`. */
export async function measure(id, level, { take, dry = false } = {}) {
  const d = dirOf(id);
  const info = readJson(join(d, `${level}-crop.json`), null);
  if (!info) throw new Error(`${level}: no crop yet (pictures.mjs makes it)`);
  const pic = join(d, take ? `${level}-take${take}.png` : `${level}.png`);
  const { k, tx, ty, rho } = await fit(join(d, `${level}-crop.jpg`), pic, info.px);
  const [pw, ph] = info.parentSize, { left, top, width, height } = info.px;
  const sw = width / pw, sh = height / ph, ox = left / pw, oy = top / ph;
  const planned = [ox + sw / 2, oy + sh / 2, (sw + sh) / 2];
  const o2 = [ox + sw * (-tx / k), oy + sh * (-ty / k)], s2 = [sw / k, sh / k];
  const fitted = [o2[0] + s2[0] / 2, o2[1] + s2[1] / 2, (s2[0] + s2[1]) / 2];
  const off = Math.max(Math.abs(tx - (1 - k) / 2), Math.abs(ty - (1 - k) / 2));
  const ok = rho >= WEAK && k >= 0.84 && k <= 1.18 && off < 0.11;
  const rec = { rect: ok ? fitted : planned, planned, k: +k.toFixed(4), shift: [+tx.toFixed(4), +ty.toFixed(4)], rho: +rho.toFixed(3), ok };
  if (!dry) {
    const path = join(d, "align.json"), all = readJson(path);
    all[level] = rec;
    writeFileSync(path, JSON.stringify(all, null, 2) + "\n");
  }
  return rec;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, level] = process.argv.slice(2);
  loadTree(id);
  const d = dirOf(id);
  const levels = level ? [level] : readdirSync(d).filter((f) => f.endsWith("-crop.json")).map((f) => f.slice(0, -10)).filter((l) => existsSync(join(d, `${l}.png`)));
  for (const l of levels) {
    const r = await measure(id, l);
    console.log(`${l}: rho ${r.rho}, scale ${r.k} → ${r.ok ? "fits" : "WEAK MATCH: keeping the planned rect"}`);
  }
}
