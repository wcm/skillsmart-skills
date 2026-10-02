#!/usr/bin/env node
// SkillsMart render helper: turns an HTML file into PNG images, a PDF or a video.
// Bundled with every SkillsMart visual skill. No dependencies except Playwright,
// which it uses with the Chrome or Edge already installed on the computer.
//
//   node render.mjs png   <file.html> --selector .slide --out out/ [--scale 2]
//   node render.mjs pdf   <file.html> --out out/deck.pdf --width 1920 --height 1080
//   node render.mjs video <file.html> --out out/teaser.webm --width 1920 --height 1080 --duration 12
//
// Setup (once, in the project folder):  npm i --no-save playwright-core
// No Chrome or Edge installed?           npm i --no-save playwright && npx playwright install chromium
// Any other Chromium-based browser:      CHROME_PATH=/path/to/chrome node render.mjs …

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [mode, input, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i += 2) opts[rest[i].replace(/^--/, "")] = rest[i + 1];

if (!["png", "pdf", "video"].includes(mode) || !input) {
  console.error("Usage: node render.mjs <png|pdf|video> <file.html> [--out path] [--selector css] [--scale n] [--width px] [--height px] [--duration s]");
  process.exit(2);
}

const file = path.resolve(input);
if (!fs.existsSync(file)) {
  console.error(`Not found: ${file}`);
  process.exit(2);
}

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4", ".webm": "video/webm",
};

// Serve the HTML's folder over http so module scripts, fonts and fetch() behave as in a browser.
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const p = path.join(root, rel);
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function launch() {
  if (process.env.CHROME_PATH) {
    const { chromium } = await import("playwright-core").catch(() => import("playwright"));
    return chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  }
  const attempts = [
    ["playwright-core", { channel: "chrome" }],
    ["playwright-core", { channel: "msedge" }],
    ["playwright", {}],
  ];
  for (const [pkg, extra] of attempts) {
    try {
      const { chromium } = await import(pkg);
      return await chromium.launch({ headless: true, ...extra });
    } catch {
      // try the next option
    }
  }
  console.error(
    "Could not start a browser.\n" +
      "Run once in this folder:  npm i --no-save playwright-core   (uses your installed Chrome)\n" +
      "No Chrome? Run instead:   npm i --no-save playwright && npx playwright install chromium",
  );
  process.exit(1);
}

const width = Number(opts.width || 1600);
const height = Number(opts.height || 1000);
const server = await serve(path.dirname(file));
const url = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(file))}`;
const browser = await launch();

try {
  if (mode === "png") {
    const out = path.resolve(opts.out || "out");
    fs.mkdirSync(out, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(opts.scale || 2) });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(Number(opts.wait || 400));
    const nodes = await page.$$(opts.selector || "[data-export]");
    if (!nodes.length) throw new Error(`No elements match ${opts.selector || "[data-export]"}`);
    let n = 0;
    for (const node of nodes) {
      n += 1;
      const name = (await node.getAttribute("data-name")) || String(n).padStart(2, "0");
      const target = path.join(out, `${name}.png`);
      await node.screenshot({ path: target });
      console.log(target);
    }
  } else if (mode === "pdf") {
    const out = path.resolve(opts.out || "out/output.pdf");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: out, width: `${width}px`, height: `${height}px`, printBackground: true, preferCSSPageSize: true });
    console.log(out);
  } else {
    const out = path.resolve(opts.out || "out/video.webm");
    const dir = path.join(path.dirname(out), ".video-tmp");
    fs.mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir, size: { width, height } } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.evaluate(() => window.dispatchEvent(new Event("render:start")));
    await page.waitForTimeout(Number(opts.duration || 10) * 1000);
    const video = page.video();
    await context.close();
    fs.renameSync(await video.path(), out);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(out);
    console.log("Tip: convert to MP4 with  ffmpeg -i " + path.basename(out) + " -c:v libx264 -pix_fmt yuv420p -movflags +faststart " + path.basename(out, ".webm") + ".mp4");
  }
} finally {
  await browser.close();
  server.close();
}
