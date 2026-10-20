#!/usr/bin/env node
/*
 * node page.mjs <reel.js> [--out <name>.html]
 *
 * The reel as one self-contained page, next to the reel by default: the engine's modules (loaded as blob URLs),
 * its fonts, the reel and its voice timing are all inside, so Skillsmart's render.mjs, or a browser opening the
 * file, needs nothing else. The voice-over itself stays a file next to it (<reel>.vo.wav), for the preview's sound.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/engine");
const MODULES = ["geom.js", "theme.js", "shapes.js", "audio.js", "look.js", "trame.js"]; // each after the ones it imports

// a value as JavaScript that is safe inside an inline <script>
const js = (v) => JSON.stringify(v).replace(/<\//g, "<\\/").replace(/[\u2028\u2029]/g, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"));

export function buildPage(reelPath, out = reelPath.replace(/\.js$/, ".html")) {
  const page = readFileSync(join(ENGINE, "page.html"), "utf8");
  const fonts = readFileSync(join(ENGINE, "fonts/fonts.css"), "utf8")
    .replace(/url\(([\w.-]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(join(ENGINE, "fonts", f)).toString("base64")})`);
  const sources = Object.fromEntries(MODULES.map((m) => [m, readFileSync(join(ENGINE, m), "utf8")]));
  const tFile = reelPath.replace(/\.js$/, ".timing.json");
  const timing = existsSync(tFile) ? JSON.parse(readFileSync(tFile, "utf8")) : null;
  const loader = [
    "<script>",
    "(() => {",
    `  const src = ${js(sources)}, order = ${js(MODULES)}, urls = {};`,
    '  const blob = (code) => URL.createObjectURL(new Blob([code], { type: "text/javascript" }));',
    '  for (const m of order) urls[m] = blob(src[m].replace(/from\\s+"\\.\\/([\\w.-]+\\.js)"/g, (all, dep) => "from \\"" + urls[dep] + "\\""));',
    "  window.__mods = urls;",
    `  window.__reelUrl = blob(${js(readFileSync(reelPath, "utf8"))});`,
    `  window.__timing = ${js(timing)};`,
    "})();",
    "</script>",
  ].join("\n");
  const link = '<link rel="stylesheet" href="fonts/fonts.css">';
  if (!page.includes(link)) throw new Error("engine/page.html no longer links fonts/fonts.css");
  writeFileSync(out, page.replace(link, `<style>\n${fonts}\n</style>\n${loader}`));
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), i = args.indexOf("--out");
  const reel = args.find((a, k) => !a.startsWith("--") && args[k - 1] !== "--out");
  if (!reel || !existsSync(reel)) { console.error("usage: node page.mjs <reel.js> [--out <name>.html]"); process.exit(2); }
  console.log(`wrote ${buildPage(resolve(reel), i >= 0 ? resolve(args[i + 1]) : undefined)}`);
}
