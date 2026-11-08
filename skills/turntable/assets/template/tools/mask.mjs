// Shared by prop.mjs and plate.mjs: the alpha of what sam-3 kept, whatever form it came back in, and a solid convex fill.
import sharp from "sharp";

/** sam-3's result → a one-channel mask (0–255) at W × H. It comes back either as the picture with only the object
 *  kept (transparent elsewhere) or as a black-and-white mask; both work. */
export async function samAlpha(file, W, H) {
  const img = sharp(file).resize(W, H, { fit: "fill" });
  const meta = await sharp(file).metadata();
  if (meta.hasAlpha) {
    const a = await img.clone().extractChannel(3).raw().toBuffer();
    let clear = 0;
    for (let i = 0; i < a.length; i += 97) if (a[i] < 8) clear++;
    if (clear > a.length / 97 / 50) return a; // real transparency round the object
  }
  return img.greyscale().raw().toBuffer();
}

/** the filled convex outline of a mask (rows with a run of 6+ px, so specks don't count), pulled in by `shrink` px so
 *  no backdrop shows at the rim. Plates and bowls are convex: gaps and bites close without anything spilling past. */
export function hull(buf, W, H, shrink = 2.5) {
  const pts = [];
  for (let y = 0; y < H; y += 2) {
    let l = -1, r = -1, run = 0;
    for (let x = 0; x < W; x++) { if (buf[y * W + x] > 127) { if (++run >= 6) { l = x - 5; break; } } else run = 0; }
    run = 0;
    for (let x = W - 1; x >= 0; x--) { if (buf[y * W + x] > 127) { if (++run >= 6) { r = x + 5; break; } } else run = 0; }
    if (l >= 0 && r >= 0) pts.push([l, y], [r, y]);
  }
  const out = Buffer.alloc(W * H);
  if (pts.length < 6) return out;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const h = []; for (const p of list) { while (h.length >= 2 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop(); h.push(p); } return h; };
  const lower = half(pts), upper = half([...pts].reverse());
  const poly = lower.slice(0, -1).concat(upper.slice(0, -1));
  const ys = poly.map((p) => p[1]);
  for (let y = Math.ceil(Math.min(...ys) + shrink); y <= Math.floor(Math.max(...ys) - shrink); y++) {
    let a = Infinity, b = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if ((p[1] - y) * (q[1] - y) > 0) continue;
      if (p[1] === q[1]) { a = Math.min(a, p[0], q[0]); b = Math.max(b, p[0], q[0]); }
      else { const x = p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]); a = Math.min(a, x); b = Math.max(b, x); }
    }
    for (let x = Math.max(0, Math.ceil(a + shrink)); x <= Math.min(W - 1, Math.floor(b - shrink)); x++) out[y * W + x] = 255;
  }
  return out;
}

/** Puts a plate or bowl back into a cut-out turn (tools/out/<id>/<name>/): sam-3-video finds it in every frame of the
 *  4-second turn (2 credits a second, 8 in all; once, kept as sam-plate.mp4), each frame's plate becomes a solid
 *  convex shape pulled `shrink` px in from the rim, and joins the food in mask/ and rgba/. The cut-out's own mask stays
 *  in mask-cut/. Returns how many frames had no plate. */
export async function putPlate({ dir, keep = "plate", shrink = 2.5, skill, label }) {
  const { execFileSync } = await import("node:child_process");
  const { cpSync, existsSync, mkdirSync, readdirSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { file, generate } = await import("./gen.mjs");
  const film = join(dir, "sam-plate.mp4");
  if (!existsSync(film)) await generate("sam-3-video", { video: file(join(dir, "turn.mp4")), prompt: keep }, { skill, out: film, label });
  const sam = join(dir, "sam");
  rmSync(sam, { recursive: true, force: true });
  mkdirSync(sam, { recursive: true });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", film, "-vf", "format=gray", "-fps_mode", "passthrough", join(sam, "%03d.png")]);
  const plates = readdirSync(sam).filter((f) => f.endsWith(".png")).sort();
  const files = readdirSync(join(dir, "src")).filter((f) => f.endsWith(".png")).sort();
  if (plates.length < files.length) throw new Error(`the plate film has ${plates.length} frames, the turn ${files.length}`);
  if (!existsSync(join(dir, "mask-cut"))) cpSync(join(dir, "mask"), join(dir, "mask-cut"), { recursive: true });
  const { width: W, height: H } = await sharp(join(dir, "src", files[0])).metadata();
  let empty = 0;
  for (const [k, f] of files.entries()) {
    // whatever is brighter than the black round it (specks removed), filled as one convex shape
    const found = await sharp(join(sam, plates[k])).resize(W, H, { fit: "fill" }).extractChannel(0).median(5).linear(4, -200).raw().toBuffer();
    const plate = hull(found, W, H, shrink);
    if (!plate.some((v) => v)) empty++;
    const p = await sharp(plate, { raw: { width: W, height: H, channels: 1 } }).blur(0.9).extractChannel(0).raw().toBuffer();
    const food = await sharp(join(dir, "mask-cut", f)).resize(W, H, { fit: "fill" }).extractChannel(0).raw().toBuffer();
    const m = Buffer.alloc(W * H);
    for (let i = 0; i < m.length; i++) m[i] = Math.max(food[i], p[i]);
    await sharp(m, { raw: { width: W, height: H, channels: 1 } }).png().toFile(join(dir, "mask", f));
    const a = await sharp(m, { raw: { width: W, height: H, channels: 1 } }).linear(1.06, -6).raw().toBuffer({ resolveWithObject: true });
    await sharp(join(dir, "src", f)).joinChannel(a.data, { raw: a.info }).png().toFile(join(dir, "rgba", f));
  }
  return { empty, frames: files.length };
}
