#!/usr/bin/env node
/*
 * node check.mjs <figure.js | linework-<name>.html> [--out sheet.png]
 *
 * Builds the page (when given a figure), opens it in a headless Chrome in the states that
 * matter and in every look, runs each one's animation to the end, and writes one contact
 * sheet, linework-<name>-check.png. Then it prints one line per check:
 *
 *   console   no error or warning on any page
 *   frame     the drawing stays inside the 400 × 320 viewBox in every shot
 *   rest      the rest read-out says "rest"
 *   answer    the answering shot names something (a warning only)
 *   cover     how much of the frame the rest pose covers (a warning under a quarter)
 *
 * Exit 0 when all pass, 1 when one fails, 2 when no browser could be started.
 * The first run installs playwright-core once into a cache folder (never into the project)
 * and drives your installed Chrome.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
if (!target) {
  console.error("usage: node check.mjs <figure.js | page.html> [--out sheet.png]");
  process.exit(2);
}

/* the page */
let page = resolve(target);
if (page.endsWith(".js")) {
  const src = readFileSync(page, "utf8");
  const name = (src.slice(Math.max(0, src.indexOf("linework({"))).match(/name:\s*["']([\w-]+)["']/) || [, basename(page, ".js")])[1];
  const out = join(dirname(page), `linework-${name}.html`);
  execFileSync(process.execPath, [join(here, "build.mjs"), page, "--out", out], { stdio: "inherit" });
  page = out;
}
const name = basename(page, ".html").replace(/^linework-/, "");
const sheet = args.includes("--out") ? resolve(args[args.indexOf("--out") + 1]) : join(dirname(page), `linework-${name}-check.png`);

/* playwright-core, once, outside the project */
const cache = process.env.LINEWORK_CHECK_CACHE || (platform() === "darwin" ? join(homedir(), "Library/Caches/linework-check") : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), "linework-check") : join(homedir(), ".cache/linework-check"));
if (!existsSync(join(cache, "node_modules/playwright-core"))) {
  mkdirSync(cache, { recursive: true });
  console.log(`installing playwright-core into ${cache} (once)…`);
  try {
    execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.47.2"], { stdio: "inherit" });
  } catch {
    console.error("could not install playwright-core; check the figure by hand (see SKILL.md)");
    process.exit(2);
  }
}
const { chromium } = createRequire(join(cache, "index.js"))("playwright-core");
let browser;
for (const opts of [{ channel: "chrome" }, { channel: "msedge" }, {}]) {
  try { browser = await chromium.launch({ headless: true, ...opts }); break; } catch {}
}
if (!browser) {
  console.error("no Chrome found. Install Google Chrome, or run: npx playwright install chromium");
  process.exit(2);
}

/* the shots */
const base = pathToFileURL(page).href;
const LOOKS = ["paper", "graphite", "blueprint", "riso", "neon", "clay", "ink", "terminal", "hue:200", "hue:330:dark"];
const shots = [
  { id: "rest", q: "", big: true },
  { id: "answer", q: "at=auto", big: true },
  { id: "small", q: "", w: 240 },
  { id: "small-answer", q: "at=auto", w: 240 },
  { id: "intensity 0", q: "intensity=0&at=auto" },
  { id: "intensity 1", q: "intensity=1&at=auto" },
  { id: "camera low", q: "camera=low&at=auto" },
  { id: "camera high", q: "camera=high&at=auto" },
  ...LOOKS.map((l) => ({ id: l, q: `look=${l}&at=auto`, look: true })),
];

const errors = [], results = [];
for (const s of shots) {
  const w = s.w || (s.big ? 640 : 400);
  const ctx = await browser.newContext({ viewport: { width: w, height: Math.round((w * 4) / 5) }, deviceScaleFactor: 2 });
  const tab = await ctx.newPage();
  tab.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${s.id}: ${m.text()}`); });
  tab.on("pageerror", (e) => errors.push(`${s.id}: ${e.message}`));
  await tab.goto(`${base}?bare=1${s.q ? "&" + s.q : ""}`);
  await tab.waitForFunction(() => window.linework && window.linework.figure, null, { timeout: 8000 }).catch(() => errors.push(`${s.id}: the figure never mounted`));
  const rep = await tab.evaluate(() => {
    const h = window.linework.figure;
    if (!h) return null;
    h.settle(3500);
    return h.report();
  }).catch((e) => (errors.push(`${s.id}: ${e.message}`), null));
  await tab.waitForTimeout(350); // the stroke and fill transitions
  const png = await tab.locator(".plate").screenshot();
  results.push({ ...s, rep, png: png.toString("base64") });
  await ctx.close();
}

/* the sheet */
const tile = (r) => `<figure class="${r.big ? "big" : r.w ? "small" : ""}"><img src="data:image/png;base64,${r.png}"><figcaption><b>${r.id}</b> ${r.rep ? r.rep.readout : "—"}</figcaption></figure>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#eceae6;font:12px ui-monospace,Menlo,monospace;color:#333;width:1360px}
h1{font:600 16px system-ui;margin:0 0 16px}section{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin-bottom:18px}
figure{margin:0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px #d8d5cf}img{display:block;width:250px}
figure.big img{width:520px}figure.small img{width:160px}figcaption{padding:6px 8px}b{font-weight:600;margin-right:6px}
</style><h1>linework · ${name}</h1>
<section>${results.filter((r) => r.big).map(tile).join("")}${results.filter((r) => r.w).map(tile).join("")}</section>
<section>${results.filter((r) => !r.big && !r.w && !r.look).map(tile).join("")}</section>
<section>${results.filter((r) => r.look).map(tile).join("")}</section>`;
const ctx = await browser.newContext({ viewport: { width: 1408, height: 900 } });
const tab = await ctx.newPage();
await tab.setContent(html);
writeFileSync(sheet, await tab.screenshot({ fullPage: true }));
await browser.close();

/* the verdict */
let failed = false;
const line = (ok, label, text) => { console.log(`${ok === true ? "ok  " : ok === "warn" ? "warn" : "FAIL"}  ${label.padEnd(8)} ${text}`); if (ok === false) failed = true; };
line(errors.length ? false : true, "console", errors.length ? errors.slice(0, 6).join(" | ") : "clean on every page");
const out = results.filter((r) => r.rep && (r.rep.box[0] < 0 || r.rep.box[1] < 0 || r.rep.box[2] > 400 || r.rep.box[3] > 320));
line(out.length ? false : true, "frame", out.length ? out.map((r) => `${r.id} [${r.rep.box.join(", ")}]`).join(" | ") : "inside 400 × 320 in every shot");
const rest = results.find((r) => r.id === "rest");
line(rest && rest.rep && rest.rep.readout === "rest" ? true : false, "rest", `read-out "${rest && rest.rep ? rest.rep.readout : "?"}"`);
const ans = results.find((r) => r.id === "answer");
line(ans && ans.rep && ans.rep.readout !== "rest" ? true : "warn", "answer", `read-out "${ans && ans.rep ? ans.rep.readout : "?"}"${ans && ans.rep && ans.rep.readout === "rest" ? " (the tour's first stop misses every part)" : ""}`);
if (rest && rest.rep) {
  const [x0, y0, x1, y1] = rest.rep.box, c = ((x1 - x0) * (y1 - y0)) / (400 * 320);
  line(c >= 0.25 ? true : "warn", "cover", `the rest pose covers ${Math.round(c * 100)}% of the frame`);
}
console.log(`sheet  ${sheet}`);
process.exit(failed ? 1 : 0);
