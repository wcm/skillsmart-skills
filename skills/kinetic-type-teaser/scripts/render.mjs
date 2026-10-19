#!/usr/bin/env node
/*
 * render.mjs · Skillsmart render helper, v2 (MIT)
 *
 * Turns an HTML film into an MP4 frame by frame (nothing drops, however heavy the page), a contact sheet,
 * stills, or records any web page played by a scripted cursor. Also keeps v1's png and pdf modes.
 *
 *   node render.mjs video   film.html [--format 16x9|9x16|1x1|4x5|all] [--out out/film.mp4] [--fps 30]
 *                                     [--alpha] [--audio track.mp3] [--draft] [--from s] [--to s]
 *   node render.mjs sheet   film.html [--format …] [--frames 12 | --times 0.5,2,4.2 | --scenes] [--out sheet.png]
 *   node render.mjs still   film.html --t 3.2 [--format …] [--out still.png]
 *   node render.mjs capture page.html|URL [--path tour|sweep|orbit|scroll | --script cursor.json]
 *                                     [--duration 12] [--cursor auto|arrow|dot|none] [--format …] [--sheet 12]
 *                                     [--title "A lower third"] [--end "Name|url"] [--warmup 1.2]
 *   node render.mjs png     page.html --selector .slide --out out/ [--scale 2]
 *   node render.mjs pdf     page.html --out out/deck.pdf --width 1920 --height 1080
 *
 * A film is a page that uses film.js: it exposes window.__film { ready, duration, fps, labels, seek(t) }.
 * v1 pages (no film.js) still work with `video … --width --height --duration`: they get "render:start" and
 * are recorded on a frozen virtual clock that advances one frame at a time.
 * Needs: Node 18+, Chrome or Edge (or Playwright's Chromium), ffmpeg for video (brew install ffmpeg).
 * The first run installs playwright-core once into a cache folder, never into your project.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import path from "node:path";
import { once } from "node:events";

const [mode, input, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i++) {
  const k = rest[i];
  if (!k.startsWith("--")) continue;
  const v = rest[i + 1];
  if (v === undefined || v.startsWith("--")) opts[k.slice(2)] = true;
  else { opts[k.slice(2)] = v; i++; }
}
const DEBUG = !!process.env.RENDER_DEBUG;
const T0 = Date.now();
const dbg = (...a) => DEBUG && console.log(`[${((Date.now() - T0) / 1000).toFixed(2)}s]`, ...a);
const MODES = ["video", "sheet", "still", "capture", "png", "pdf"];
if (!MODES.includes(mode) || !input) {
  console.error(fs.readFileSync(new URL(import.meta.url)).toString().split("*/")[0].replace(/^#!.*\n\/\*/, "").replace(/^ \* ?/gm, ""));
  process.exit(2);
}

const FORMATS = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] };
// capture: CSS viewport and device pixel ratio per format, so pages lay out like a laptop / a phone
const CAPTURE = { "16x9": [1440, 810, 4 / 3], "9x16": [432, 768, 2.5], "1x1": [720, 720, 1.5], "4x5": [600, 750, 1.8] };

/* ---------- browser ---------- */

async function loadPlaywright() {
  for (const pkg of ["playwright-core", "playwright"]) {
    try { return (await import(pkg)).chromium; } catch {}
  }
  const cache = process.env.SKILLSMART_RENDER_CACHE || (platform() === "darwin" ? path.join(homedir(), "Library/Caches/skillsmart-render") : platform() === "win32" ? path.join(process.env.LOCALAPPDATA || homedir(), "skillsmart-render") : path.join(homedir(), ".cache/skillsmart-render"));
  if (!fs.existsSync(path.join(cache, "node_modules/playwright-core"))) {
    fs.mkdirSync(cache, { recursive: true });
    console.log(`installing playwright-core into ${cache} (once)…`);
    try {
      execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.47.2"], { stdio: "inherit", shell: platform() === "win32" });
    } catch {
      console.error("Could not install playwright-core. Run once in this folder:  npm i --no-save playwright-core");
      process.exit(2);
    }
  }
  return createRequire(path.join(cache, "index.js"))("playwright-core").chromium;
}

async function launch() {
  const chromium = await loadPlaywright();
  dbg("playwright loaded");
  // WebGL in headless Chrome: the GPU through ANGLE (Metal on macOS), else the SwiftShader software fallback
  const args = ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--enable-gpu-rasterization", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--force-color-profile=srgb"];
  if (platform() === "darwin") args.push("--use-angle=metal");
  if (process.env.CHROME_PATH) return chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args });
  for (const extra of [{ channel: "chrome" }, { channel: "msedge" }, {}]) {
    try { return await chromium.launch({ headless: true, args, ...extra }); } catch {}
  }
  console.error("Could not start a browser. Install Google Chrome, or run:  npx playwright install chromium");
  process.exit(2);
}

function hasFfmpeg() {
  try { return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0; } catch { return false; }
}

/* ---------- serving ---------- */

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".hdr": "application/octet-stream",
};

// Serve from --root, else the current folder when the file is inside it (so ../engine/ paths work), else the file's folder.
function serve(file) {
  const cwd = process.cwd();
  const root = path.resolve(opts.root || (file.startsWith(cwd + path.sep) ? cwd : path.dirname(file)));
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (rel === "/favicon.ico") return res.writeHead(204).end();
      const p = path.join(root, rel);
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
      const size = fs.statSync(p).size;
      const type = TYPES[path.extname(p).toLowerCase()] || "application/octet-stream";
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
      if (range) {
        const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : size - 1;
        res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
        return fs.createReadStream(p, { start, end }).pipe(res);
      }
      res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}/${path.relative(root, file).split(path.sep).map(encodeURIComponent).join("/")}`;
      resolve({ server, url });
    });
  });
}

/* ---------- frames ---------- */

async function grabber(page, { alpha, jpeg }) {
  const cdp = await page.context().newCDPSession(page);
  if (alpha) await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  const format = alpha || !jpeg ? "png" : "jpeg";
  return async () => {
    const { data } = await cdp.send("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality: 94 } : {}), optimizeForSpeed: true, captureBeyondViewport: false, fromSurface: true });
    return Buffer.from(data, "base64");
  };
}

function encoder(out, { fps, alpha, audio, duration, crf, codec, shrink = 1 }) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", codec, "-i", "-"];
  if (audio) args.push("-i", path.resolve(audio));
  const ext = path.extname(out).toLowerCase();
  // --draft: half size (screenshots always come at full size, so the encoder shrinks them)
  if (shrink < 1 && ext !== ".gif") args.push("-vf", `scale=trunc(iw*${shrink}/2)*2:-2:flags=area`);
  if (alpha && ext === ".mov") args.push("-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-vendor", "apl0");
  else if (ext === ".webm") args.push("-c:v", "libvpx-vp9", "-pix_fmt", alpha ? "yuva420p" : "yuv420p", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-deadline", "good");
  else if (ext === ".gif") args.push("-vf", `fps=${Math.min(fps, 20)},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`);
  else args.push("-c:v", "libx264", "-preset", String(opts.preset || "fast"), "-crf", String(crf ?? 18), "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  if (audio && ext !== ".gif") {
    const fade = Number(opts["audio-fade"] ?? 1.2);
    args.push("-map", "0:v", "-map", "1:a", "-c:a", ext === ".webm" ? "libopus" : "aac", "-b:a", "192k", "-af", `afade=t=out:st=${Math.max(0, duration - fade)}:d=${fade}`, "-shortest");
  }
  args.push(out);
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  return {
    async write(buf) { if (!ff.stdin.write(buf)) await once(ff.stdin, "drain"); },
    async close() { ff.stdin.end(); await done; },
  };
}

function progress(label, i, n, t0) {
  if (i % Math.max(1, Math.floor(n / 10)) && i !== n) return;
  const s = (Date.now() - t0) / 1000;
  process.stdout.write(`\r${label} ${String(Math.round((i / n) * 100)).padStart(3)}%  ${i}/${n} frames  ${s.toFixed(0)}s`);
  if (i === n) process.stdout.write("\n");
}

/* ---------- films ---------- */

async function openFilm(browser, url, format, { alpha, scale = 1, size } = {}) {
  const [w, h] = size || FORMATS[format];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const q = new URLSearchParams({ render: "1", ...(size ? { w, h } : { format }), ...(alpha ? { alpha: "1" } : {}) });
  for (const [k, v] of Object.entries(opts)) if (k.startsWith("q:")) q.set(k.slice(2), v); // --q:style paper
  dbg("context ready");
  await page.goto(`${url}${url.includes("?") ? "&" : "?"}${q}`, { waitUntil: "networkidle" });
  dbg("page loaded");
  const ok = await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 15000 }).then(() => true, () => false);
  if (!ok) throw new Error(`no film on this page (window.__film missing). ${errors.join(" | ")}`);
  const info = await page.evaluate(async () => {
    const f = await window.__film.ready;
    return { duration: f.duration, fps: f.fps, labels: f.labels };
  });
  if (errors.length) console.warn("page errors:", errors.slice(0, 5).join(" | "));
  return { ctx, page, info, errors };
}

const seek = (page, t) => page.evaluate((t) => window.__film.seek(t), t);

async function renderVideo(browser, url, format, out) {
  const ff = hasFfmpeg();
  const alpha = !!opts.alpha;
  const draft = !!opts.draft;
  const scale = draft ? 0.5 : Number(opts.scale || 1);
  if (!ff) return realtime(browser, url, format, out);
  let film;
  try { film = await openFilm(browser, url, format, { alpha, scale }); }
  catch (e) {
    if (!/no film/.test(e.message)) throw e;
    return legacy(browser, url, out); // a v1 page (no film.js): record it in real time, as v1 did
  }
  const { ctx, page, info } = film;
  const fps = Number(opts.fps || (draft ? 15 : info.fps || 30));
  const from = Number(opts.from || 0), to = Math.min(Number(opts.to || info.duration), info.duration);
  const n = Math.max(1, Math.round((to - from) * fps));
  const grab = await grabber(page, { alpha, jpeg: !alpha });
  const outs = alpha ? [out.replace(/\.\w+$/, ".mov"), out.replace(/\.\w+$/, ".webm")] : [out];
  // alpha: one capture, two encodes (ProRes 4444 for editors, VP9 WebM for the web)
  const encs = outs.map((o) => encoder(o, { fps, alpha, audio: opts.audio, duration: to - from, crf: opts.crf ?? (draft ? 26 : 18), codec: alpha ? "png" : "mjpeg", shrink: scale }));
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await seek(page, from + i / fps);
    const buf = await grab();
    for (const e of encs) await e.write(buf);
    progress(`${format}`, i + 1, n, t0);
  }
  dbg("frames done");
  for (const e of encs) await e.close();
  dbg("encoded");
  await ctx.close();
  for (const o of outs) console.log(o);
}

// No ffmpeg: fall back to recording in real time (v1 behaviour). Busy scenes may stutter.
async function realtime(browser, url, format, out) {
  console.warn("ffmpeg not found: trying Playwright's real-time recorder instead. For frame-perfect MP4 install ffmpeg: brew install ffmpeg / winget install Gyan.FFmpeg");
  const [w, h] = FORMATS[format];
  out = out.replace(/\.\w+$/, ".webm");
  const dir = path.join(path.dirname(out), ".video-tmp");
  fs.mkdirSync(dir, { recursive: true });
  const probe = await openFilm(browser, url, format);
  const duration = probe.info.duration;
  await probe.ctx.close();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
  const page = await ctx.newPage().catch(() => {
    console.error("Playwright's recorder isn't installed either. Install ffmpeg (brew install ffmpeg / winget install Gyan.FFmpeg), or run: npx playwright install ffmpeg");
    process.exit(2);
  });
  await page.goto(`${url}${url.includes("?") ? "&" : "?"}bare=1&once=1&format=${format}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(duration * 1000 + 300);
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), out);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(out);
}

// v1 compatibility: a page without film.js restarts on "render:start"; record it on a virtual clock
// (its timers, rAF and CSS animations all follow it), so it comes out as smooth as a film
async function legacy(browser, url, out) {
  const width = Number(opts.width || 1920), height = Number(opts.height || 1080);
  opts.cursor = "none";
  await capture(browser, url, "16x9", out, { viewport: [width, height, 1], steps: [{ wait: Number(opts.duration || 10) }], start: true });
}

async function sheet(browser, url, format, out, shots) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:22px;background:#e9e7e2;font:12px ui-monospace,Menlo,monospace;color:#333;width:${opts.width || 1600}px}
    h1{font:600 15px system-ui;margin:0 0 14px}main{display:grid;grid-template-columns:repeat(${shots.cols},1fr);gap:12px}
    figure{margin:0;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px #d6d3cc}img{display:block;width:100%}
    figcaption{padding:5px 8px;display:flex;justify-content:space-between;gap:8px}b{font-weight:600}
  </style><h1>${shots.title}</h1><main>${shots.items.map((s) => `<figure><img src="data:image/${s.type};base64,${s.png}"><figcaption><b>${s.label || ""}</b><span>${s.t.toFixed(2)}s</span></figcaption></figure>`).join("")}</main>`;
  const ctx = await browser.newContext({ viewport: { width: Number(opts.width || 1600) + 44, height: 900 } });
  const tab = await ctx.newPage();
  await tab.setContent(html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await tab.screenshot({ fullPage: true }));
  await ctx.close();
  console.log(out);
}

function sheetTimes(info) {
  if (opts.times) return opts.times.split(",").map(Number).map((t) => ({ t }));
  const labels = info.labels || [];
  if (opts.scenes && labels.length) {
    // two frames per scene: settling in, and the frame just before the next cut
    const out = [];
    labels.forEach((l, i) => {
      const end = i + 1 < labels.length ? labels[i + 1].at : info.duration;
      out.push({ t: l.at + (end - l.at) * 0.4, label: l.name }, { t: Math.max(l.at, end - 1 / 30), label: l.name + " · end" });
    });
    return out;
  }
  const n = Number(opts.frames || 12);
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * info.duration;
    const l = labels.filter((x) => x.at <= t).pop();
    return { t, label: l ? l.name : "" };
  });
}

/* ---------- capture: any page, played by a scripted cursor ---------- */

const PATHS = {
  tour: [{ to: [0.5, 0.5], dur: 0 }, { wait: 0.5 }, { to: [0.32, 0.4], dur: 1.4 }, { wait: 0.8 }, { to: [0.68, 0.38], dur: 1.6, arc: 0.18 }, { wait: 0.6 }, { click: true }, { wait: 1 }, { to: [0.6, 0.66], dur: 1.3 }, { wait: 0.7 }, { to: [0.36, 0.6], dur: 1.4, arc: -0.15 }, { wait: 0.6 }, { to: [0.5, 0.48], dur: 1.2 }, { wait: 1 }],
  sweep: [{ to: [0.08, 0.52], dur: 0 }, { wait: 0.4 }, { to: [0.92, 0.46], dur: 3.2, arc: 0.08, ease: "inOut" }, { wait: 0.4 }, { to: [0.5, 0.5], dur: 1.6, arc: -0.2 }, { click: true }, { wait: 1.2 }, { to: [0.1, 0.48], dur: 2.6, arc: 0.1 }, { wait: 0.4 }, { to: [0.5, 0.5], dur: 1.6 }, { wait: 0.8 }],
  orbit: [{ to: [0.5, 0.5], dur: 0 }, { wait: 0.4 }, { orbit: { r: 0.2, turns: 1.25 }, dur: 5 }, { click: true }, { wait: 1 }, { orbit: { r: 0.12, turns: -0.75 }, dur: 3 }, { wait: 0.8 }],
  scroll: [{ to: [0.5, 0.45], dur: 0 }, { wait: 0.6 }, { to: [0.35, 0.42], dur: 1.2 }, { to: [0.65, 0.5], dur: 1.4, arc: 0.15 }, { click: true }, { wait: 0.8 }, { scroll: "100vh", dur: 1.6 }, { wait: 1.2 }, { to: [0.4, 0.55], dur: 1 }, { scroll: "100vh", dur: 1.6 }, { wait: 1.2 }, { scroll: "100vh", dur: 1.6 }, { wait: 1 }],
};

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const EASES = { inOut: easeInOut, out: easeOut, linear: (p) => p };

// Compile the steps into a function of time: { x, y, down, scroll } (x, y in 0..1 of the viewport).
function choreography(steps, vh, aspect = 16 / 9) {
  let x = 0.5, y = 0.5, sc = 0, t = 0;
  const segs = [];
  const scrollPx = (v) => (typeof v === "string" && v.endsWith("vh") ? (parseFloat(v) / 100) * vh : Number(v));
  for (const s of steps) {
    const dur = Number(s.dur ?? (s.wait ?? (s.click ? 0.2 : 0)));
    const seg = { t0: t, t1: t + dur, x0: x, y0: y, sc0: sc };
    if (s.to) {
      seg.kind = dur ? "move" : "jump";
      seg.x1 = s.to[0]; seg.y1 = s.to[1]; seg.arc = s.arc ?? 0.12; seg.ease = EASES[s.ease || "inOut"];
      x = s.to[0]; y = s.to[1];
    } else if (s.orbit) {
      const cx = s.orbit.center ? s.orbit.center[0] : x, cy = s.orbit.center ? s.orbit.center[1] : y;
      Object.assign(seg, { kind: "orbit", cx, cy, r: s.orbit.r ?? 0.15, turns: s.orbit.turns ?? 1 });
      // starts and ends on the circle's left point, so the cursor glides on and off it
      x = cx; y = cy;
    } else if (s.drag) {
      seg.kind = "drag"; seg.x1 = s.drag[0]; seg.y1 = s.drag[1]; seg.arc = s.arc ?? 0.05; seg.ease = EASES[s.ease || "inOut"];
      x = s.drag[0]; y = s.drag[1];
    } else if (s.scroll !== undefined) {
      seg.kind = "scroll"; seg.sc1 = sc + scrollPx(s.scroll); seg.ease = EASES[s.ease || "inOut"];
      sc = seg.sc1;
    } else if (s.click) {
      seg.kind = "click"; seg.hold = Number(s.hold ?? 0.12);
    } else {
      seg.kind = "wait";
    }
    seg.x1 ??= x; seg.y1 ??= y; seg.sc1 ??= sc;
    segs.push(seg);
    t += dur;
  }
  const total = t;
  const at = (time) => {
    const vw = vh * aspect;
    const seg = segs.filter((s) => s.t0 <= time).pop() || segs[0];
    const p = seg.t1 > seg.t0 ? Math.min(1, Math.max(0, (time - seg.t0) / (seg.t1 - seg.t0))) : 1;
    let px = seg.x1, py = seg.y1, down = false, scroll = seg.sc1;
    if (seg.kind === "move" || seg.kind === "drag") {
      const e = seg.ease(p);
      const dx = seg.x1 - seg.x0, dy = seg.y1 - seg.y0;
      const bend = Math.sin(Math.PI * e) * seg.arc; // a hand moves in arcs, not lines
      px = seg.x0 + dx * e - dy * bend;
      py = seg.y0 + dy * e + dx * bend;
      down = seg.kind === "drag" && p < 1;
    } else if (seg.kind === "orbit") {
      const e = easeInOut(p);
      const env = Math.sin(Math.PI * p); // radius grows in and out, so it starts and ends at the centre
      const a = Math.PI + e * seg.turns * Math.PI * 2;
      px = seg.cx + Math.cos(a) * seg.r * env * (vh / vw);
      py = seg.cy + Math.sin(a) * seg.r * env;
    } else if (seg.kind === "scroll") {
      scroll = seg.sc0 + (seg.sc1 - seg.sc0) * seg.ease(p);
    } else if (seg.kind === "click") {
      down = time - seg.t0 < seg.hold;
    } else if (seg.kind === "wait" && seg.t1 > seg.t0) {
      // a resting hand drifts a little
      const k = time - seg.t0;
      px += Math.sin(k * 2.1) * 0.003;
      py += Math.cos(k * 1.7) * 0.003;
    }
    return { x: px, y: py, down, scroll };
  };
  return { at, total };
}

const CURSORS = {
  arrow: `<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l15.5 14.2h-8.9L7.7 25z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  dot: `<div style="width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 1.5px rgba(0,0,0,.35),0 4px 14px rgba(0,0,0,.25)"></div>`,
};

async function capture(browser, url, format, out, extra = {}) {
  const [vw, vh, dpr0] = extra.viewport || CAPTURE[format];
  const dpr = Number(opts.dpr || dpr0);
  const fps = Number(opts.fps || 30);
  const steps = extra.steps || (opts.script ? JSON.parse(fs.readFileSync(path.resolve(opts.script), "utf8")) : PATHS[opts.path || "tour"]);
  if (!steps) throw new Error(`unknown --path ${opts.path} (tour, sweep, orbit, scroll)`);
  const list = Array.isArray(steps) ? steps : steps.steps;
  const plan = choreography(list, vh, vw / vh);
  const duration = Number(opts.duration || (steps.duration ?? plan.total));
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // virtual time: frozen, and advanced only by runFor, one frame at a time (it would otherwise also flow in real time)
  await page.clock.install({ time: new Date("2026-01-01T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T09:00:01Z"));
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.body && (document.body.style.scrollBehavior = "auto"); });
  // let the page start up on virtual time
  const first = plan.at(0);
  await page.mouse.move(first.x * vw, first.y * vh);
  const warm = Number(opts.warmup ?? (extra.start ? 0.3 : 1.2)) * 1000;
  for (let ms = 0; ms < warm; ms += 100) await page.clock.runFor(100);
  if (extra.start) await page.evaluate(() => window.dispatchEvent(new Event("render:start")));

  // the cursor: drawn into the page, unless the page draws its own
  let cursor = opts.cursor || "auto";
  if (cursor === "auto") {
    const own = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return [document.documentElement, document.body, el].some((e) => e && getComputedStyle(e).cursor === "none");
    }, { x: first.x * vw, y: first.y * vh });
    cursor = own ? "none" : "arrow";
  }
  if (cursor !== "none") {
    await page.evaluate(({ svg }) => {
      const c = document.createElement("div");
      c.id = "__capture-cursor";
      c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))";
      c.innerHTML = svg + '<i style="position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px;border-radius:50%;border:2px solid rgba(255,255,255,.9);opacity:0"></i>';
      document.body.appendChild(c);
    }, { svg: CURSORS[cursor] || CURSORS.arrow });
  }

  // optional cards: --title "Line" (a lower third for the first 2.4 s) and --end "Name|url" (the last 2 s)
  if (opts.title || opts.end) {
    await page.evaluate(({ title, end, u }) => {
      const css = document.createElement("style");
      css.textContent = `#__cap-title,#__cap-end{position:fixed;z-index:2147483646;pointer-events:none;font-family:"Inter Tight","Inter",system-ui,sans-serif;opacity:0}
        #__cap-title{left:${u * 4}px;bottom:${u * 5}px;padding:${u * 1.2}px ${u * 2}px;border-radius:${u * 1.2}px;background:rgba(12,12,14,.72);backdrop-filter:blur(12px);color:#fff;font-weight:600;font-size:${u * 3}px;letter-spacing:-.01em}
        #__cap-end{inset:0;display:grid;place-content:center;gap:${u * 1.2}px;text-align:center;background:rgba(10,10,12,.55);backdrop-filter:blur(18px);color:#fff}
        #__cap-end b{font-size:${u * 9}px;font-weight:800;letter-spacing:-.045em;line-height:1}#__cap-end span{font-size:${u * 3}px;font-weight:600;opacity:.85}`;
      document.head.appendChild(css);
      if (title) { const t = document.createElement("div"); t.id = "__cap-title"; t.textContent = title; document.body.appendChild(t); }
      if (end) { const [a, b] = end.split("|"); const e = document.createElement("div"); e.id = "__cap-end"; e.innerHTML = `<b></b><span></span>`; e.firstChild.textContent = a; e.lastChild.textContent = b || ""; document.body.appendChild(e); }
    }, { title: opts.title === true ? "" : opts.title, end: opts.end === true ? "" : opts.end, u: Math.min(vw, vh) / 100 });
  }
  const cards = (t) => page.evaluate(({ t, d }) => {
    const ease = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
    const ti = document.getElementById("__cap-title"), en = document.getElementById("__cap-end");
    if (ti) { const o = ease((t - 0.3) / 0.5) * (1 - ease((t - 2.4) / 0.4)); ti.style.opacity = o; ti.style.transform = `translateY(${(1 - ease((t - 0.3) / 0.5)) * 12}px)`; }
    if (en) { const o = ease((t - (d - 2)) / 0.6); en.style.opacity = o; en.firstChild.style.transform = `translateY(${(1 - o) * 18}px)`; }
  }, { t, d: duration });
  const sync = (vt) => page.evaluate(async (vt) => {
    // CSS animations and transitions run on real time: pin them to the virtual clock
    window.__anims ||= new Map();
    for (const a of document.getAnimations()) {
      if (!window.__anims.has(a)) { window.__anims.set(a, { at: vt, from: a.currentTime || 0 }); a.pause(); }
      const s = window.__anims.get(a);
      a.currentTime = s.from + (vt - s.at);
    }
    // videos: seek to the virtual time
    const vids = [...document.querySelectorAll("video")].filter((v) => v.readyState >= 1 && v.duration);
    await Promise.all(vids.map((v) => new Promise((res) => {
      v.pause();
      const target = (vt / 1000) % v.duration;
      if (Math.abs(v.currentTime - target) < 0.004) return res();
      const done = () => { v.removeEventListener("seeked", done); res(); };
      v.addEventListener("seeked", done);
      v.currentTime = target;
      setTimeout(done, 1200);
    })));
  }, vt);

  const drawCursor = (s, clickAge) => page.evaluate(({ x, y, down, age }) => {
    const c = document.getElementById("__capture-cursor");
    if (!c) return;
    c.style.transform = `translate(${x}px, ${y}px) scale(${down ? 0.86 : 1})`;
    const ring = c.querySelector("i");
    if (age >= 0 && age < 0.5) { const k = age / 0.5; ring.style.opacity = String(1 - k); ring.style.transform = `scale(${0.4 + k * 1.2})`; }
    else ring.style.opacity = "0";
  }, { x: s.x * vw, y: s.y * vh, down: s.down, age: clickAge });

  const sheetN = opts.sheet ? Number(opts.sheet === true ? 12 : opts.sheet) : 0;
  const n = Math.round(duration * fps);
  const grab = await grabber(page, { jpeg: true });
  const enc = sheetN ? null : hasFfmpeg() ? encoder(out, { fps, duration, audio: opts.audio, crf: opts.crf, codec: "mjpeg" }) : null;
  if (!sheetN && !enc) throw new Error("capture needs ffmpeg (brew install ffmpeg / winget install Gyan.FFmpeg)");
  const keep = new Set(sheetN ? Array.from({ length: sheetN }, (_, i) => Math.round(((i + 0.5) / sheetN) * n)) : []);
  const shots = [];
  let wasDown = false, lastClick = -1, lastScroll = -1;
  const t0 = Date.now();
  const startVt = warm;
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const s = plan.at(Math.min(t, plan.total));
    await page.mouse.move(s.x * vw, s.y * vh);
    if (s.down && !wasDown) { await page.mouse.down(); lastClick = t; }
    if (!s.down && wasDown) await page.mouse.up();
    wasDown = s.down;
    if (Math.abs(s.scroll - lastScroll) > 0.1) { await page.evaluate((y) => window.scrollTo(0, y), s.scroll); lastScroll = s.scroll; }
    await page.clock.runFor(1000 / fps);
    await sync(startVt + (i + 1) * (1000 / fps));
    await drawCursor(s, lastClick >= 0 ? t - lastClick : -1);
    if (opts.title || opts.end) await cards(t);
    if (sheetN) {
      if (keep.has(i)) shots.push({ t, png: (await grab()).toString("base64"), type: "jpeg" });
    } else {
      await enc.write(await grab());
    }
    progress(`capture ${format}`, i + 1, n, t0);
  }
  if (wasDown) await page.mouse.up();
  if (enc) { await enc.close(); console.log(out); }
  await ctx.close();
  if (errors.length) console.warn("page errors:", errors.slice(0, 5).join(" | "));
  if (sheetN) await sheet(browser, url, format, out.replace(/\.\w+$/, ".png"), { title: `${path.basename(input)} · capture ${format} · ${duration.toFixed(1)}s`, cols: format === "9x16" ? 6 : 4, items: shots });
}

/* ---------- main ---------- */

const isUrl = /^https?:\/\//.test(input);
const file = isUrl ? null : path.resolve(input);
if (file && !fs.existsSync(file)) { console.error(`Not found: ${file}`); process.exit(2); }
const { server, url } = isUrl ? { server: null, url: input } : await serve(file);
const browser = await launch();
const base = file ? path.basename(file, ".html").replace(/^index$/, path.basename(path.dirname(file))) : "page";
const fromSize = opts.width && opts.height ? Object.keys(FORMATS).find((f) => FORMATS[f][0] === +opts.width && FORMATS[f][1] === +opts.height) : null;
const formats = opts.format === "all" ? ["16x9", "9x16", "1x1"] : String(opts.format || fromSize || "16x9").split(",");
const named = (ext, f) => {
  if (opts.out) return formats.length > 1 ? path.resolve(opts.out).replace(/(\.\w+)?$/, (m) => `-${f}${m || ext}`) : path.resolve(opts.out);
  return path.resolve("out", `${base}-${f}${ext}`);
};

try {
  for (const format of formats) {
    if (!FORMATS[format]) throw new Error(`unknown format ${format} (16x9, 9x16, 1x1, 4x5, all)`);
    if (mode === "video") {
      await renderVideo(browser, url, format, named(opts.gif ? ".gif" : ".mp4", format));
    } else if (mode === "sheet") {
      const { ctx, page, info } = await openFilm(browser, url, format, { scale: format === "16x9" ? 0.5 : 0.4 });
      const items = [];
      for (const s of sheetTimes(info)) {
        await seek(page, s.t);
        items.push({ ...s, png: (await page.screenshot({ type: "jpeg", quality: 88 })).toString("base64"), type: "jpeg" });
      }
      await ctx.close();
      await sheet(browser, url, format, named(".png", format).replace(/(\.png)$/, "-sheet$1"), { title: `${base} · ${format} · ${info.duration.toFixed(1)}s`, cols: format === "9x16" ? 6 : format === "16x9" ? 4 : 5, items });
    } else if (mode === "still") {
      const { ctx, page } = await openFilm(browser, url, format, { alpha: !!opts.alpha, scale: Number(opts.scale || 1) });
      await seek(page, Number(opts.t || 0));
      const out = named(".png", format);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, await page.screenshot({ omitBackground: !!opts.alpha }));
      await ctx.close();
      console.log(out);
    } else if (mode === "capture") {
      await capture(browser, url, format, named(".mp4", format));
    } else if (mode === "png") {
      const width = Number(opts.width || 1600), height = Number(opts.height || 1000);
      const out = path.resolve(opts.out || "out");
      fs.mkdirSync(out, { recursive: true });
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(opts.scale || 2) });
      await page.goto(url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(Number(opts.wait || 400));
      const nodes = await page.$$(opts.selector || "[data-export]");
      if (!nodes.length) throw new Error(`No elements match ${opts.selector || "[data-export]"}`);
      let k = 0;
      for (const node of nodes) {
        k += 1;
        const target = path.join(out, `${(await node.getAttribute("data-name")) || String(k).padStart(2, "0")}.png`);
        await node.screenshot({ path: target, omitBackground: !!opts.alpha });
        console.log(target);
      }
      break;
    } else if (mode === "pdf") {
      const width = Number(opts.width || 1600), height = Number(opts.height || 1000);
      const out = path.resolve(opts.out || "out/output.pdf");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.emulateMedia({ media: "print" });
      await page.pdf({ path: out, width: `${width}px`, height: `${height}px`, printBackground: true, preferCSSPageSize: true });
      console.log(out);
      break;
    }
  }
} catch (e) {
  console.error("\n" + (e.message || e));
  process.exitCode = 1;
} finally {
  await browser.close();
  dbg("browser closed");
  if (server) { server.closeAllConnections?.(); server.close(); }
}
