/*
 * Shared by the scripts: where the engine is, a reel page assembled (fonts embedded), a headless Chrome,
 * a reel page opened in it, and the reel's timing without a browser.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* the skill keeps the engine, fonts and templates in assets/; the project they are made in, at its root */
export const assets = existsSync(join(root, "assets", "engine")) ? join(root, "assets") : root;
const engine = join(assets, "engine");
export const sceneFiles = () => readdirSync(join(engine, "scenes")).filter((f) => f.endsWith(".js")).sort().map((f) => join(engine, "scenes", f));

/*
 * The fonts, embedded: every face in fonts/fonts.json, its woff2 inlined, registered as a FontFace
 * (so a reel renders the same from a file, a server or the headless renderer, with no font server).
 * All SIL Open Font License (fonts/OFL-*.txt).
 */
export function fontScript() {
  const dir = join(assets, "fonts"), faces = JSON.parse(readFileSync(join(dir, "fonts.json"), "utf8"));
  /* stand-ins first: for overlapping ranges the browser checks the last face declared first */
  faces.sort((a, b) => (a.source === a.family) - (b.source === b.family));
  const rows = faces.map((f) => `  [${JSON.stringify(f.family)}, ${JSON.stringify(f.weight)}, ${JSON.stringify(f.style)}, ${JSON.stringify(f.range || "U+0-10FFFF")}, ${JSON.stringify(f.stretch || "normal")}, "${readFileSync(join(dir, f.file)).toString("base64")}"],`);
  return `(function () {
  const faces = [
${rows.join("\n")}
  ];
  const buf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  window.REEL_FONTS = Promise.all(faces.map(([family, weight, style, unicodeRange, stretch, b64]) => {
    const face = new FontFace(family, buf(b64), { weight, style, unicodeRange, stretch });
    document.fonts.add(face);
    return face.load();
  }));
})();`;
}

/* The reel's name: the name: field of the reel file, or its file name. */
export const reelName = (reelPath) => {
  const src = readFileSync(reelPath, "utf8");
  return (src.match(/\bname:\s*["'`]([\w.-]+)["'`]/) || [, basename(reelPath, ".js")])[1];
};

/*
 * One HTML page: the fonts, the engine, every scene, the reel and the player.
 * Inlined by default, so the page is one file you can open or send. link: true points at the
 * files instead (for working on the engine).
 */
export function buildPage(reelPath, out, { link = false } = {}) {
  const files = [join(engine, "reel.js"), join(engine, "transitions.js"), ...sceneFiles(), resolve(reelPath), join(engine, "player.js")];
  const name = reelName(reelPath);
  const tags = [`<script>\n${fontScript()}\n</script>`, ...files.map((f) => (link ? `<script src="${relative(dirname(out), f).split("\\").join("/")}"></script>` : `<script>\n${readFileSync(f, "utf8").replace(/<\/script/gi, "<\\/script")}\n</script>`))];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — reel</title>
</head>
<body>
${tags.join("\n")}
</body>
</html>
`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return out;
}

/* playwright, from the project, the global install, or once into a cache folder */
async function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const attempt = (fn) => { try { return fn(); } catch { return null; } };
  for (const base of [process.cwd(), root]) for (const mod of ["playwright", "playwright-core"]) {
    const pw = attempt(() => createRequire(join(base, "index.js"))(mod));
    if (pw) return { pw, full: mod === "playwright" };
  }
  const global = attempt(() => execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim());
  if (global) for (const mod of ["playwright", "playwright-core"]) {
    const pw = attempt(() => req(join(global, mod)));
    if (pw) return { pw, full: mod === "playwright" };
  }
  /* the same cache folder and version as render.mjs, so the two share one install */
  const cache = process.env.SKILLSMART_RENDER_CACHE || (platform() === "darwin" ? join(homedir(), "Library/Caches/skillsmart-render") : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), "skillsmart-render") : join(homedir(), ".cache/skillsmart-render"));
  if (!existsSync(join(cache, "node_modules/playwright-core"))) {
    mkdirSync(cache, { recursive: true });
    console.log(`installing playwright-core into ${cache} (once)…`);
    execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.47.2"], { stdio: "inherit", shell: platform() === "win32" });
  }
  return { pw: createRequire(join(cache, "index.js"))("playwright-core"), full: false };
}

export async function launch() {
  const { pw, full } = await loadPlaywright();
  const args = ["--disable-gpu", "--disable-dev-shm-usage", "--force-color-profile=srgb", "--font-render-hinting=none"];
  const order = full ? [{}, { channel: "chrome" }, { channel: "msedge" }] : [{ channel: "chrome" }, { channel: "msedge" }, {}];
  for (const opts of order) {
    try { return await pw.chromium.launch({ headless: true, args, ...opts }); } catch {}
  }
  const exe = process.env.CHROME_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : null);
  if (exe) try { return await pw.chromium.launch({ headless: true, args, executablePath: exe }); } catch {}
  throw new Error("no Chrome found: install Google Chrome, or run npx playwright install chromium");
}

/* a page in record mode, ready to draw; errors from the page are collected in page.errors */
export async function openReel(browser, pageFile, { scale = 1, fps, samples, slow, format } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e.stack || e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") page.errors.push(`${m.type()}: ${m.text()}`); });
  const q = new URLSearchParams({ record: "1", scale: String(scale) });
  if (fps) q.set("fps", String(fps));
  if (format) q.set("format", String(format));
  if (samples) q.set("samples", String(samples));
  if (slow && +slow !== 1) q.set("slow", String(slow));
  await page.goto(pathToFileURL(pageFile).href + "?" + q);
  await page.waitForFunction(() => window.REEL_READY || document.body.textContent.includes("Error"), null, { timeout: 120000 });
  const info = await page.evaluate(() => window.REEL_INFO);
  if (!info) throw new Error("the reel did not start:\n" + (await page.evaluate(() => document.body.textContent)).slice(0, 2000) + "\n" + page.errors.join("\n"));
  return { page, info };
}

/* one frame as PNG bytes */
export async function grab(page, f, type = "png") {
  const b64 = await page.evaluate(([f, type]) => { Reel.draw(f); return Reel.g.canvas.toDataURL("image/" + type, 0.95).split(",")[1]; }, [f, type]);
  return Buffer.from(b64, "base64");
}

/* argv → { _: [positionals], name: value }; names in bools take no value */
export function parseArgs(argv, bools = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) out[k] = v;
    else if (bools.includes(k) || i + 1 >= argv.length || argv[i + 1].startsWith("--")) out[k] = true;
    else out[k] = argv[++i];
  }
  return out;
}

/* The reel's timing without a browser: the engine, the scenes and the reel file in a sandbox. */
export async function loadReel(reelPath, { slow } = {}) {
  const vm = await import("node:vm");
  const sandbox = { console: { log() {}, warn() {}, error() {} }, location: { search: slow && +slow !== 1 ? `?slow=${slow}` : "" }, URLSearchParams, document: {}, Math, Date, JSON };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of [join(engine, "reel.js"), join(engine, "transitions.js"), ...sceneFiles(), resolve(reelPath)]) vm.runInContext(readFileSync(f, "utf8"), sandbox, { filename: f });
  return sandbox.Reel.info();
}

/* ffmpeg on the PATH, or a clear message */
export function needFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
  catch { console.error("ffmpeg is not on the PATH: install it (macOS: brew install ffmpeg · Debian/Ubuntu: apt install ffmpeg · Windows: winget install ffmpeg)"); process.exit(2); }
}
