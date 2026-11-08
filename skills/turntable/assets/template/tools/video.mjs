// Records a page's script (?record) as a video, frame by frame in headless Chrome, so it plays smoothly however slow the
// machine is: the gallery, a click open, a rest and one snapped turn per page, and the flight home, so it loops.
//
//   node video.mjs <id>                        → tools/out/<id>/<id>.mp4 (1440 × 900, 30 fps)
//   node video.mjs <id> --size 1080x1350       other sizes (a phone-shaped 1080x1920 uses the phone layout); --fps 60
// The script's timing is the page's start({ record: { subject, pages, hold, open, rest, close, end } }).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT, flag, words } from "./common.mjs";

const argv = process.argv.slice(2);
const [id] = words(argv);
if (!id) { console.error("usage: node video.mjs <id> [--size 1440x900] [--fps 30]"); process.exit(1); }
const [W, H] = flag(argv, "--size", "1440x900").split("x").map(Number);
const fps = Number(flag(argv, "--fps", 30));
const dir = join(OUT, id);
mkdirSync(dir, { recursive: true });
const dest = join(dir, `${id}${W === 1440 && H === 900 ? "" : `-${W}x${H}`}.mp4`);

const browser = await launch();
if (!browser) process.exit(2);
const site = serve();
// a phone-shaped frame records the phone layout at 2× (390 px wide, scaled up)
const phone = W < H && W <= 1080;
const scale = phone ? W / 390 : 1;
const { page } = await open(browser, site.url(id, "?record"), { viewport: { width: Math.round(W / scale), height: Math.round(H / scale) }, deviceScaleFactor: scale, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
await page.waitForFunction(() => window.turntable.timeline, null, { timeout: 120000 });
const duration = await page.evaluate(() => window.turntable.timeline.duration);
const frames = Math.round(duration * fps);
const ff = spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-vf", `scale=${W}:${H}`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dest], { stdio: ["pipe", "inherit", "inherit"] });
for (let i = 0; i < frames; i++) {
  await page.evaluate(async (t) => {
    window.turntable.timeline.seek(t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, i / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 60 === 0) process.stdout.write(`\r${id}: ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
console.log(`\r${id}: ${frames} frames, ${duration.toFixed(1)} s → ${dest}`);
await browser.close();
site.close();
process.exit(0);
