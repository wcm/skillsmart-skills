// Lines the evening pictures up with the film's last frame, so the hand-over from film to dusk to lit doesn't jump. The
// image model can shift or rescale a picture a little. Lighting differs a lot between day and dusk, so the two are
// matched on their edges: a coarse search and a fine one find the scale and shift where they agree best (rho: 1 is
// perfect; 0.5 or more is usable).
//
//   node align.mjs <id> dusk lit      → out/<id>/dusk.png, lit.png fitted to film-last.png (the edits are kept as dusk-raw.png, lit-raw.png)
//   node align.mjs <id> dusk --report     measure only
import sharp from "sharp";
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT, loadScene } from "./common.mjs";

const argv = process.argv.slice(2);
const words = argv.filter((a) => !a.startsWith("--"));
const [id, ...names] = words;
loadScene(id);
const d = join(OUT, id);

// edge strength, zero mean, unit spread
async function edges(input, w, h) {
  const g = await sharp(input).removeAlpha().greyscale().resize(w, h, { fit: "fill", kernel: "lanczos3" }).blur(0.8).raw().toBuffer();
  const f = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    f[i] = Math.sqrt((g[i + 1] - g[i - 1]) ** 2 + (g[i + w] - g[i - w]) ** 2);
  }
  // the top of the range is often clipped highlights, so keep strong edges from dominating
  let m = 0;
  for (let i = 0; i < f.length; i++) { f[i] = Math.log1p(f[i]); m += f[i]; }
  m /= f.length;
  let s = 0;
  for (let i = 0; i < f.length; i++) { f[i] -= m; s += f[i] * f[i]; }
  s = Math.sqrt(s / f.length) + 1e-6;
  for (let i = 0; i < f.length; i++) f[i] /= s;
  return f;
}

function rhoAt(a, b, w, h, k, tx, ty, step) {
  let ab = 0, aa = 0, bb = 0, sa = 0, sb = 0, n = 0;
  for (let y = 0; y < h; y += step) {
    const by = ((k * (y + 0.5)) / h + ty) * h - 0.5;
    if (by < 0 || by >= h - 1) continue;
    const y0 = by | 0, fy = by - y0;
    for (let x = 0; x < w; x += step) {
      const bx = ((k * (x + 0.5)) / w + tx) * w - 0.5;
      if (bx < 0 || bx >= w - 1) continue;
      const x0 = bx | 0, fx = bx - x0, i = y0 * w + x0;
      const q = (b[i] * (1 - fx) + b[i + 1] * fx) * (1 - fy) + (b[i + w] * (1 - fx) + b[i + w + 1] * fx) * fy;
      const p = a[y * w + x];
      ab += p * q; aa += p * p; bb += q * q; sa += p; sb += q; n++;
    }
  }
  if (n < 16) return -1;
  return (ab - (sa * sb) / n) / Math.sqrt((aa - (sa * sa) / n) * (bb - (sb * sb) / n) + 1e-9);
}

function search(a, b, w, h, start, ranges, steps, step) {
  let best = { ...start, rho: rhoAt(a, b, w, h, start.k, start.tx, start.ty, step) };
  for (const [dk, dt] of ranges) {
    const c = { ...best };
    for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++) for (let l = -steps; l <= steps; l++) {
      const k = c.k + (dk * i) / steps, tx = c.tx + (dt * j) / steps, ty = c.ty + (dt * l) / steps;
      const r = rhoAt(a, b, w, h, k, tx, ty, step);
      if (r > best.rho) best = { k, tx, ty, rho: r };
    }
  }
  return best;
}

const film = join(d, "film-last.png");
if (!existsSync(film)) { console.error(`no ${film}: node frames.mjs ${id}`); process.exit(1); }
const { width: FW, height: FH } = await sharp(film).metadata();
// which pictures this tool wrote itself, so running it again measures the original edit, not its own output
const marks = join(d, "align.json");
const done = existsSync(marks) ? JSON.parse(readFileSync(marks, "utf8")) : {};
for (const name of names.length ? names : ["dusk", "lit"]) {
  const raw = join(d, `${name}-raw.png`), pic = join(d, `${name}.png`);
  if (!existsSync(pic) && !existsSync(raw)) { console.error(`no ${pic}`); continue; }
  // a newly made picture becomes the kept edit
  const fresh = existsSync(pic) && (!existsSync(raw) || statSync(pic).mtimeMs !== done[name]);
  if (fresh && !argv.includes("--report")) copyFileSync(pic, raw);
  const source = argv.includes("--report") ? pic : raw;
  let cur;
  { const [w, h] = [320, 180]; const a = await edges(film, w, h), b = await edges(source, w, h); cur = search(a, b, w, h, { k: 1, tx: 0, ty: 0 }, [[0.05, 0.04]], 7, 2); }
  { const [w, h] = [640, 360]; const a = await edges(film, w, h), b = await edges(source, w, h); cur = search(a, b, w, h, cur, [[0.008, 0.006], [0.002, 0.0015]], 4, 2); }
  { const [w, h] = [1280, 720]; const a = await edges(film, w, h), b = await edges(source, w, h); cur = search(a, b, w, h, cur, [[0.0006, 0.0005]], 2, 2); }
  const { k, tx, ty, rho } = cur;
  console.log(`${id}/${name}: rho ${rho.toFixed(3)}, scale ${k.toFixed(4)}, shift ${(tx * FW).toFixed(1)} ${(ty * FH).toFixed(1)} px at the film's size${rho < 0.5 ? "  WEAK: the picture may have moved; look at it, and redo it if it did" : ""}`);
  if (argv.includes("--report")) continue;
  // the picture's window that lines up with the film's frame, with its edges repeated where the window runs off it
  const { width: W, height: H } = await sharp(source).metadata();
  const pad = Math.ceil(0.08 * W);
  const big = await sharp(source).removeAlpha().extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: "copy" }).png().toBuffer();
  await sharp(big).extract({ left: Math.round(tx * W) + pad, top: Math.round(ty * H) + pad, width: Math.round(k * W), height: Math.round(k * H) })
    .resize(FW, FH, { fit: "fill", kernel: "lanczos3" }).png().toFile(pic);
  done[name] = statSync(pic).mtimeMs;
  writeFileSync(marks, JSON.stringify(done, null, 2) + "\n");
}
