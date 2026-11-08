// A headless Chrome for check.mjs, and a static server for the site. The first run installs playwright-core once into a
// cache folder (never into the project) and drives your installed Chrome or Edge. The dust draws with WebGL2, so the
// browser runs on the GPU where it can (Metal on a Mac) and on SwiftShader elsewhere (slow, but it works).
import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { platform } from "node:os";
import { extname, join, normalize } from "node:path";
import { SITE, cachedPackage } from "./common.mjs";

/** the browser, or null (the caller says what to do) */
export async function launch() {
  const pw = cachedPackage("playwright-core", "1.47.2");
  if (!pw) { console.error("could not install playwright-core (needs npm and the network once)"); return null; }
  const gl = platform() === "darwin" ? ["--use-angle=metal"] : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  const args = ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--enable-gpu", "--ignore-gpu-blocklist", ...gl];
  for (const o of [{ channel: "chrome" }, { channel: "msedge" }, {}]) {
    try { return await pw.chromium.launch({ headless: true, args, ...o }); } catch {}
  }
  console.error("no Chrome found: install Google Chrome, or run: npx playwright install chromium");
  return null;
}

/** site/ on a free port, caching off: serve().url(id) is the page's address */
export function serve(root = SITE) {
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    let f = join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(f));
  }).listen(0);
  return { url: (id, q = "") => `http://localhost:${server.address().port}/${id}/${q}`, close: () => server.close() };
}

/** a page opened, every picture turned to dust (`window.nuee` and the html's `loaded` class); errors go into `errors` */
export async function open(browser, url, opts, errors = []) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
  page.on("requestfailed", (r) => errors.push(`${r.failure()?.errorText || "failed"}: ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.nuee && document.documentElement.classList.contains("loaded"), null, { timeout: 60000 });
  return { ctx, page };
}
