// A video of the page's main dives: down the first way step by step, back up in one go, down the second, back up. Drawn
// frame by frame in record mode, so it is smooth however slow the computer is.
//
//   node video.mjs <id>                            1440 × 900, 30 fps
//   node video.mjs <id> --size 540x960 --scale 2   a 1080 × 1920 vertical video, laid out as on a phone
//   node video.mjs <id> --plan vine,grape,bloom,estate --pace 1.5 --hold 1 --out ~/Desktop/dive.mp4
//
// Writes tools/out/<id>/video-<w>x<h>.mp4 (H.264). Needs ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { dirOf, flagOf, loadTree } from "./common.mjs";
import { finish, launch, open, serve } from "./browser.mjs";

const argv = process.argv.slice(2), flag = flagOf(argv), id = argv[0];
loadTree(id);
const [W, H] = flag("--size", "1440x900").split("x").map(Number), SCALE = Number(flag("--scale", 1)), FPS = Number(flag("--fps", 30));
const dir = dirOf(id);
const OUT = resolve(flag("--out", join(dir, `video-${W * SCALE}x${H * SCALE}.mp4`)).replace(/^~(?=\/)/, process.env.HOME || "~"));
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
catch { console.error("needs ffmpeg: brew install ffmpeg (macOS), winget install ffmpeg (Windows) or your package manager"); process.exit(2); }
const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [], FRAMES = join(dir, `frames-${W}x${H}`);
rmSync(FRAMES, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true });
const { page, ok } = await open(browser, site.url(id), { viewport: { width: W, height: H }, deviceScaleFactor: SCALE, ...(W < 760 ? { isMobile: true, hasTouch: true } : {}) }, errors);
if (!ok) { console.error(errors.join("\n")); process.exit(1); }
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(async ([plan, pace, hold]) => {
  lp.o.pace = pace;
  await lp.preload();
  window.__done = false;
  ui.tour({ hold, ...(plan ? { plan } : {}) }).then(() => { window.__done = true; });
}, [flag("--plan")?.split(",") ?? null, Number(flag("--pace", 1.3)), Number(flag("--hold", 1.2))]);
let f = 0;
for (; f < FPS * 120; f++) {
  const done = await page.evaluate((dt) => { lp.tick(dt); return window.__done; }, 1 / FPS);
  await page.screenshot({ path: join(FRAMES, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % (FPS * 2) === 0) process.stdout.write(`\r${(f / FPS).toFixed(0)} s`);
  if (done) break;
}
await finish(browser, site);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(FRAMES, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", OUT]);
rmSync(FRAMES, { recursive: true, force: true });
console.log(`\r${OUT}  (${f} frames, ${(f / FPS).toFixed(1)} s)${errors.length ? `\nerrors: ${[...new Set(errors)].slice(0, 3).join(" | ")}` : ""}`);
process.exit(0);
