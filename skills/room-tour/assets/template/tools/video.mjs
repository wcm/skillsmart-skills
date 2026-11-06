// A video of the walk, drawn frame by frame on the engine's own recording clock (?record), so it is smooth however slow
// the computer is: the first screen held, the moves at the clip's pace, the stops brief, the scripted clicks (record.beats
// in tour.json) and the ending.
//
//   node video.mjs <id>                            1440 × 900 at 30 fps
//   node video.mjs <id> --size 540x960 --scale 2   a 1080 × 1920 vertical video, laid out as on a phone
//   node video.mjs <id> --out ~/Desktop/tour.mp4
//
// Writes tools/out/<id>/video-<w>x<h>.mp4 (H.264). Needs ffmpeg and the -rec frames (node frames.mjs <id> --rec).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT as OUT_DIR, SITE, needFfmpeg } from "./common.mjs";

const argv = process.argv.slice(2), flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!id || !existsSync(join(SITE, id, "tour.json"))) { console.error("usage: node video.mjs <id> [--size 1440x900] [--scale 1] [--out file.mp4]"); process.exit(1); }
needFfmpeg();
const [W, H] = flag("--size", "1440x900").split("x").map(Number), SCALE = +flag("--scale", 1);
const OUT = resolve(flag("--out", join(OUT_DIR, id, `video-${W * SCALE}x${H * SCALE}.mp4`)).replace(/^~(?=\/)/, process.env.HOME || "~"));
const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [];
const FRAMES = join(OUT_DIR, id, `frames-${W}x${H}`);
rmSync(FRAMES, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true });
const { page } = await open(browser, site.url(id, "?record"), { viewport: { width: W, height: H }, deviceScaleFactor: SCALE, ...(W < 760 ? { isMobile: true, hasTouch: true } : {}) }, errors);
const { frames, fps } = await page.evaluate(() => ({ frames: window.tour.frames, fps: window.tour.fps }));
for (let n = 0; n < frames; n++) {
  await page.evaluate((n) => window.tour.frame(n), n);
  await page.screenshot({ path: join(FRAMES, `${String(n).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (n % (fps * 2) === 0) process.stdout.write(`\r${n}/${frames} frames`);
}
await browser.close(); site.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(FRAMES, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", OUT]);
rmSync(FRAMES, { recursive: true, force: true });
const uniq = [...new Set(errors)];
console.log(`\r${OUT}  (${(frames / fps).toFixed(1)} s)${uniq.length ? `\nerrors: ${uniq.slice(0, 3).join(" | ")}` : ""}`);
