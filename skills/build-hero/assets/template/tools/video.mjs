// A video of the build, drawn frame by frame on the engine's own clock, so it is smooth however slow the computer is. It
// holds the first frame, plays the build and the evening at an even pace (a short ease at each end), then holds the
// lit frame.
//
//   node video.mjs <id>                            1440 × 900, 30 fps, the build in 8 s
//   node video.mjs <id> --size 540x960 --scale 2   a 1080 × 1920 vertical video, laid out as on a phone
//   node video.mjs <id> --seconds 12 --fps 60 --out ~/Desktop/build.mp4
//
// Writes tools/out/<id>/video-<w>x<h>.mp4 (H.264). Needs ffmpeg.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT as OUT_DIR, SITE, needFfmpeg } from "./common.mjs";

const argv = process.argv.slice(2), flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!id || !existsSync(join(SITE, id, "frames/manifest.json"))) { console.error("usage: node video.mjs <id> [--size 1440x900] [--scale 1] [--seconds 8] [--fps 30] [--out file.mp4] (run frames.mjs first)"); process.exit(1); }
needFfmpeg();
const [W, H] = flag("--size", "1440x900").split("x").map(Number), SCALE = +flag("--scale", 1), FPS = +flag("--fps", 30), PLAY = +flag("--seconds", 8), HOLD = 0.9, RAMP = 0.5;
const OUT = resolve(flag("--out", join(OUT_DIR, id, `video-${W * SCALE}x${H * SCALE}.mp4`)).replace(/^~(?=\/)/, process.env.HOME || "~"));
const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [];
const FRAMES = join(OUT_DIR, id, `frames-${W}x${H}`);
rmSync(FRAMES, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true });
const { page } = await open(browser, site.url(id), { viewport: { width: W, height: H }, deviceScaleFactor: SCALE, ...(W < 760 ? { isMobile: true, hasTouch: true } : {}) }, errors);
const to = +flag("--to", await page.evaluate(() => { const o = window.chantier.options; return o.glideTo ?? (o.lit ? o.lit.at[1] : o.film[1]); }));
const pace = (t) => {
  const v = 1 / (PLAY - RAMP);
  if (t <= 0) return 0;
  if (t >= PLAY) return 1;
  if (t < RAMP) return (v * t * t) / (2 * RAMP);
  if (t > PLAY - RAMP) return 1 - (v * (PLAY - t) ** 2) / (2 * RAMP);
  return v * (t - RAMP / 2);
};
const n = Math.round((HOLD + PLAY + HOLD) * FPS);
for (let f = 0; f < n; f++) {
  await page.evaluate(async ([p, dt]) => { await window.chantier.at(p); window.chantier.tick(dt); }, [to * pace(f / FPS - HOLD), 1 / FPS]);
  await page.screenshot({ path: join(FRAMES, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % (FPS * 2) === 0) process.stdout.write(`\r${f}/${n} frames`);
}
await browser.close(); site.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(FRAMES, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", OUT]);
rmSync(FRAMES, { recursive: true, force: true });
const uniq = [...new Set(errors)];
console.log(`\r${OUT}  (${(n / FPS).toFixed(1)} s)${uniq.length ? `\nerrors: ${uniq.slice(0, 3).join(" | ")}` : ""}`);
