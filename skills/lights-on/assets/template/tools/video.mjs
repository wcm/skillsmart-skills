// A video of the page: the morning, the evening falling, the lights coming on, and all of it off again in one go.
// Drawn frame by frame on the engine's clock, so it is smooth however slow the computer is.
//
//   node video.mjs <id>                              1440 × 900, 30 fps
//   node video.mjs <id> --size 540x960 --scale 2     a 1080 × 1920 vertical video, laid out as on a phone
//   node video.mjs <id> --speed 1.5 --fps 60 --out ~/Desktop/lights.mp4
//
// Writes tools/out/<id>/video-<w>x<h>.mp4 (H.264). Needs ffmpeg. A page scrolled by the clock (window.progress) plays
// its whole day; any other plays jn.night() and jn.day().
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { TOOLS, launch, open, serve } from "./browser.mjs";

const argv = process.argv.slice(2), flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!id || !existsSync(join(TOOLS, "..", "site", id, "img", "scene.json"))) { console.error("usage: node video.mjs <id> [--size 1440x900] [--scale 1] [--speed 1] [--fps 30] [--out file.mp4]   (run prep.py first)"); process.exit(1); }
const [W, H] = flag("--size", "1440x900").split("x").map(Number), SCALE = +flag("--scale", 1), FPS = +flag("--fps", 30), SPEED = +flag("--speed", 1);
const DIR = join(TOOLS, "out", id);
const OUT = resolve(flag("--out", join(DIR, `video-${W * SCALE}x${H * SCALE}.mp4`)).replace(/^~(?=\/)/, process.env.HOME || "~"));
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
catch { console.error("needs ffmpeg: brew install ffmpeg (macOS), winget install ffmpeg (Windows) or your package manager"); process.exit(2); }

const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [];
const FRAMES = join(DIR, `frames-${W}x${H}`);
rmSync(FRAMES, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true });
const { page } = await open(browser, site.url(id), { viewport: { width: W, height: H }, deviceScaleFactor: SCALE, ...(W < 760 ? { isMobile: true, hasTouch: true } : {}) }, errors);
await page.waitForTimeout(1200);

// what happens when, in page seconds
const scrolled = await page.evaluate(() => Boolean(window.progress));
const inOut = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const clamp = (u) => Math.min(1, Math.max(0, u));
const steps = scrolled ? [] : [[1.2, "jn.night()"], [7.5, "jn.day()"]];
const total = scrolled ? 13 : 11;
const n = Math.round((total / SPEED) * FPS);
for (let f = 0; f < n; f++) {
  const t = (f / FPS) * SPEED;
  while (steps.length && steps[0][0] <= t) await page.evaluate(steps.shift()[1]);
  if (scrolled) await page.evaluate((p) => window.progress(p), t < 8.5 ? inOut(clamp((t - 0.8) / 7.7)) : 1 - inOut(clamp((t - 10) / 2)));
  await page.evaluate((dt) => window.jn.tick(dt), SPEED / FPS);
  await page.screenshot({ path: join(FRAMES, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % (FPS * 2) === 0) process.stdout.write(`\r${f}/${n} frames`);
}
await browser.close(); site.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(FRAMES, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
  "-crf", "20", "-preset", "slow", "-movflags", "+faststart", OUT]);
rmSync(FRAMES, { recursive: true, force: true });
const uniq = [...new Set(errors)];
console.log(`\r${OUT}  (${n} frames, ${(n / FPS).toFixed(1)} s)${uniq.length ? `\nerrors: ${uniq.slice(0, 3).join(" | ")}` : ""}`);
