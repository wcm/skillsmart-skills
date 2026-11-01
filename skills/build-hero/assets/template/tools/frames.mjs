// Turns the film and the pictures in out/<id>/ into the page's files (free, nothing is generated).
//
//   node frames.mjs <id>          out/<id>/film.mp4 → site/<id>/frames/ (1600 wide), frames-phone/ (1080), and
//                                 out/<id>/film-last.png, the film's last kept frame, for the evening pictures
//   node frames.mjs <id> stills   the pictures in "web" → site/<id>/img/<name>.webp; dusk and lit at the frame's size,
//                                 with -phone versions
//
// "frames" in scenes/<id>.json says which of the film's frames to keep (a stopped scroll blends two neighbours, so
// neighbours far apart show as a double image; put the frames where the motion is fast):
//   "fps": 10                     frames per second of film (the default)
//   "cut": [[34, 42]]             leave out these kept frames, 1-based (a moment of the take you turned down)
//   "pick": [1, 2, 3, 5, …]       keep exactly these frames of the film, 1-based, at its own rate
//   "retime": { "count": 130, "x": [0, 0.27, 0.62, 1], "y": [0, 30, 150, 312] }
//                                 a time map: output share → film frame, so each stage gets a fair share of the scroll
//                                 (monotone between the knots; main.js uses the same one if it times words to stages)
//   "phoneCrop": { "left": 760, "top": 0, "width": 760, "height": 1080 }
//                                 frames-phone/ as a full-resolution window of the 1920 × 1080 film, instead of the whole
//                                 frame at 1080 wide, for a tall subject on a phone
// Options: --q 60 (WebP quality of the frames).
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OUT, SITE, loadScene, needFfmpeg } from "./common.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, what] = words;
const scene = loadScene(id);
const opt = scene.frames ?? {};
const src = join(OUT, id), site = join(SITE, id), film = join(src, "film.mp4");
const PHONE = opt.phoneCrop;

// monotone cubic through the knots (x → y)
function pchip(X, Y) {
  const n = X.length, d = [], m = new Array(n);
  for (let k = 0; k < n - 1; k++) d.push((Y[k + 1] - Y[k]) / (X[k + 1] - X[k]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (!d[k]) { m[k] = m[k + 1] = 0; continue; }
    const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
  }
  return (x) => {
    if (x <= X[0]) return Y[0];
    if (x >= X[n - 1]) return Y[n - 1];
    let k = 0; while (x > X[k + 1]) k++;
    const h = X[k + 1] - X[k], t = (x - X[k]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * Y[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * Y[k + 1] + (t3 - t2) * h * m[k + 1];
  };
}

if (what === "stills") {
  mkdirSync(join(site, "img"), { recursive: true });
  for (const [name, w] of Object.entries(scene.web ?? {})) {
    const from = join(src, `${name}.png`);
    if (!existsSync(from)) { console.log(`skip ${name}: no ${from}`); continue; }
    await sharp(from).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(join(site, "img", `${name}.webp`));
    console.log(`${name} → img/${name}.webp`);
  }
  for (const name of ["dusk", "lit"]) {
    const from = join(src, `${name}.png`);
    if (!existsSync(from)) { console.log(`skip ${name}: no ${from}`); continue; }
    const { width: W, height: H } = await sharp(from).metadata();
    await sharp(from).resize(1920, 1080, { fit: "fill" }).webp({ quality: 82, effort: 5 }).toFile(join(site, "img", `${name}.webp`));
    const phone = PHONE
      ? sharp(from).extract({ left: Math.round((PHONE.left * W) / 1920), top: Math.round((PHONE.top * H) / 1080), width: Math.round((PHONE.width * W) / 1920), height: Math.round((PHONE.height * H) / 1080) }).resize(PHONE.width, PHONE.height, { fit: "fill" })
      : sharp(from).resize(1080, 608, { fit: "fill" });
    await phone.webp({ quality: 78, effort: 5 }).toFile(join(site, "img", `${name}-phone.webp`));
    console.log(`${name} → img/${name}.webp, ${name}-phone.webp`);
  }
  process.exit(0);
}

needFfmpeg();
if (!existsSync(film)) { console.error(`no ${film}: join the film first (node film.mjs ${id} --join …)`); process.exit(1); }
const fps = Number(opt.fps ?? 10);
const tmp = join(tmpdir(), `build-hero-${id}-${process.pid}`);
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const custom = opt.pick || opt.retime;
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", film, ...(custom ? ["-fps_mode", "passthrough"] : ["-vf", `fps=${fps}`]), join(tmp, "f-%05d.png")]);
const all = readdirSync(tmp).filter((f) => f.startsWith("f-")).sort();
let kept = all;
if (opt.pick) kept = opt.pick.map((j) => all[j - 1]);
else if (opt.retime) {
  const { count, x, y } = opt.retime, map = pchip(x, y);
  kept = Array.from({ length: count }, (_, i) => all[Math.min(all.length - 1, Math.round(map(i / (count - 1))))]);
}
const cut = (j) => (opt.cut ?? []).some(([a, b]) => j >= a && j <= b);
kept = kept.filter((f, i) => f && !cut(i + 1));
const q = Number(flag("--q", 60));
const SIZES = [["frames", (im) => im.resize({ width: 1600 }), q], ["frames-phone", (im) => (PHONE ? im.extract(PHONE) : im.resize({ width: 1080 })), q + 4]];
for (const [name, fn, quality] of SIZES) {
  const to = join(site, name);
  rmSync(to, { recursive: true, force: true }); mkdirSync(to, { recursive: true });
  let size;
  for (const [i, f] of kept.entries()) {
    const info = await fn(sharp(join(tmp, f))).webp({ quality, effort: 5 }).toFile(join(to, `${String(i + 1).padStart(4, "0")}.webp`));
    size ??= [info.width, info.height];
  }
  writeFileSync(join(to, "manifest.json"), JSON.stringify({ count: kept.length, fps, pattern: "{n}.webp", pad: 4, size }) + "\n");
  const bytes = readdirSync(to).reduce((s, f) => s + readFileSync(join(to, f)).length, 0);
  console.log(`${id}/${name}: ${kept.length} frames, ${size.join("×")}, ${(bytes / 1e6).toFixed(1)} MB`);
}
copyFileSync(join(tmp, kept[kept.length - 1]), join(src, "film-last.png"));
copyFileSync(join(tmp, kept[0]), join(src, "film-first.png"));
console.log(`→ out/${id}/film-first.png, film-last.png (${all.length} film frames)`);
rmSync(tmp, { recursive: true, force: true });
