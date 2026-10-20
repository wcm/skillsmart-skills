/*
 * Shared by render.mjs and check.mjs: a tiny static server (the engine at /engine/, the reel's
 * folder at /reel/) and a headless Chrome.
 *
 * Playwright comes from the project or a global install if there is one; otherwise playwright-core
 * is installed once into a cache folder (never into the project) and drives your installed Chrome
 * or Edge. Set CHROME_PATH to use a particular browser.
 */
import { execFileSync, execSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/engine");
const { FORMATS } = await import(new URL("../assets/engine/trame.js", import.meta.url).href);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".txt": "text/plain" };

/** Serve the engine and the reel's folder; resolves to { url, close }. */
export function serve(reelPath, port = 0) {
  const reelDir = dirname(resolve(reelPath));
  const mounts = [["/engine/", ENGINE], ["/reel/", reelDir]];
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    for (const [prefix, dir] of mounts) {
      if (!path.startsWith(prefix)) continue;
      const file = normalize(join(dir, path.slice(prefix.length)));
      if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) break;
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      return createReadStream(file).pipe(res);
    }
    if (path.endsWith(".timing.json")) { res.writeHead(200, { "content-type": "application/json" }); return res.end("null"); }
    if (path === "/favicon.ico") { res.writeHead(204); return res.end(); } // Chrome asks for one; a 404 would fail check's console line
    res.writeHead(404); res.end();
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => {
    const { port } = server.address();
    ok({ url: (q = "") => `http://127.0.0.1:${port}/engine/page.html?reel=/reel/${encodeURIComponent(basename(reelPath))}${q}`, close: () => server.close() });
  }));
}

function loadPlaywright() {
  const tries = [process.cwd() + "/", dirname(fileURLToPath(import.meta.url)) + "/"];
  try { tries.push(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() + "/"); } catch {}
  for (const base of tries) for (const name of ["playwright", "playwright-core"]) {
    try { return { pw: createRequire(base)(name), bundled: name === "playwright" }; } catch {}
  }
  const cache = process.env.TRAME_CACHE || (platform() === "darwin" ? join(homedir(), "Library/Caches/trame") : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), "trame") : join(homedir(), ".cache/trame"));
  if (!existsSync(join(cache, "node_modules/playwright-core"))) {
    mkdirSync(cache, { recursive: true });
    console.log(`installing playwright-core into ${cache} (once)…`);
    execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.56.1"], { stdio: "inherit" });
  }
  return { pw: createRequire(join(cache, "index.js"))("playwright-core"), bundled: false };
}

const ARGS = ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--autoplay-policy=no-user-gesture-required"];

/** A headless browser that can run WebGL2. */
export async function launch() {
  const { pw, bundled } = loadPlaywright();
  const attempts = [];
  if (process.env.CHROME_PATH) attempts.push({ executablePath: process.env.CHROME_PATH });
  if (bundled || process.env.PLAYWRIGHT_BROWSERS_PATH) attempts.push({});
  if (existsSync("/opt/pw-browsers/chromium")) attempts.push({ executablePath: "/opt/pw-browsers/chromium" });
  attempts.push({ channel: "chrome" }, { channel: "msedge" }, {});
  let last;
  for (const a of attempts) {
    try { return await pw.chromium.launch({ headless: true, args: ARGS, ...a }); } catch (e) { last = e; }
  }
  console.error("could not start a browser; install Chrome, or set CHROME_PATH\n" + (last?.message || "").split("\n")[0]);
  process.exit(2);
}

/** Open the reel page in render mode and wait until it is ready. */
export async function openReel(browser, url, { scale = 1, onLog, format = "9x16" } = {}) {
  const f = FORMATS[format] || FORMATS["9x16"], w = Math.round(f.W * scale), h = Math.round(f.H * scale);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("console", (m) => onLog && !/GL Driver Message|GPU stall/.test(m.text()) && onLog(m.type(), m.text()));
  page.on("pageerror", (e) => onLog && onLog("error", e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.trameReady === true || document.getElementById("err")?.style.display === "block", null, { timeout: 60000 });
  const err = await page.evaluate(() => document.getElementById("err")?.style.display === "block" ? document.getElementById("err").textContent : null);
  if (err) throw new Error(err);
  return page;
}

/** Run ffmpeg, or explain how to get it. */
export function ffmpegPath() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return "ffmpeg"; } catch {}
  console.error("ffmpeg is needed (brew install ffmpeg / apt install ffmpeg)");
  process.exit(2);
}
