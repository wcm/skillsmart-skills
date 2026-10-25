// A scroll-through video of a gallery page: the opening, then the whole page at an even pace, a still moment at each
// end. Drawn frame by frame (window.accrochage.record and tick), so it is smooth however slow the computer is.
//
//   node video.mjs <id>                              1440 × 900, 30 fps, 2.5 s per screen of scroll
//   node video.mjs <id> --size 540x960 --scale 2     a 1080 × 1920 vertical video, laid out as on a phone
//   node video.mjs <id> --secs 18 --fps 60 --out ~/Desktop/gallery.mp4
//
// Writes tools/out/<id>/video-<w>x<h>.mp4 (H.264). Needs ffmpeg.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, open, serve } from "./browser.mjs";
import { pageFile } from "./page.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!id || !existsSync(pageFile(id))) { console.error("usage: node video.mjs <id> [--size 1440x900] [--scale 1] [--secs n] [--fps 30] [--out file.mp4]"); process.exit(1); }
const [W, H] = flag("--size", "1440x900").split("x").map(Number), SCALE = +flag("--scale", 1), FPS = +flag("--fps", 30);
const OUT = resolve(flag("--out", join(ROOT, "out", id, `video-${W * SCALE}x${H * SCALE}.mp4`)).replace(/^~(?=\/)/, process.env.HOME || "~"));
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
catch { console.error("needs ffmpeg: brew install ffmpeg (macOS), winget install ffmpeg (Windows) or your package manager"); process.exit(2); }

const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [];
const FRAMES = join(ROOT, "out", id, `frames-${W}x${H}`);
rmSync(FRAMES, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true });
const phone = W < 760;
const { page, loaded } = await open(browser, site.url(id), { viewport: { width: W, height: H }, deviceScaleFactor: SCALE, ...(phone ? { isMobile: true, hasTouch: true } : {}) }, errors);
if (loaded !== true) console.warn("some pictures had not loaded after 60 s; recording anyway");

// the scroll: a gentle start and end, an even pace between
const total = await page.evaluate(() => { accrochage.record(true); accrochage.restart(); return accrochage.segs.at(-1).b; });
const SECS = +flag("--secs", Math.round(total * 2.5));
const pace = (u) => { const a = 0.08; return u < a ? (u * u) / (2 * a) / (1 - a) : u > 1 - a ? 1 - ((1 - u) * (1 - u)) / (2 * a) / (1 - a) : (u - a / 2) / (1 - a); };
const OPEN = 3.2, END = 1.4, n = Math.round((OPEN + SECS + END) * FPS);
for (let f = 0; f < n; f++) {
  const s = f / FPS, u = Math.min(1, Math.max(0, (s - OPEN) / SECS));
  await page.evaluate(([v, dt]) => accrochage.tick(v, dt), [pace(u) * total, 1 / FPS]);
  await page.screenshot({ path: join(FRAMES, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % (FPS * 2) === 0) process.stdout.write(`\r${f}/${n} frames`);
}
await browser.close(); site.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(FRAMES, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
  "-crf", "20", "-preset", "slow", "-movflags", "+faststart", OUT]);
rmSync(FRAMES, { recursive: true, force: true });
const uniq = [...new Set(errors)];
console.log(`\r${OUT}  (${n} frames, ${((OPEN + SECS + END)).toFixed(1)} s)${uniq.length ? `\nerrors: ${uniq.slice(0, 3).join(" | ")}` : ""}`);
