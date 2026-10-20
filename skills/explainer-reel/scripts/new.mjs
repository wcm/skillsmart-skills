#!/usr/bin/env node
/*
 * node new.mjs <name> [--dir reels] [--look halftone] [--palette ember] [--example moon|eyes|renew]
 *
 * Copies the starter reel (or one of the finished examples) to <dir>/<name>.js (default: ./reels/<name>.js), with
 * the look and palette filled in. It runs as is: check or preview it straight away, then rewrite the beats.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOOKS, PALETTES } from "../assets/engine/theme.js";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const name = args[0];
if (!name || name.startsWith("--")) { console.error("usage: node new.mjs <name> [--dir reels] [--look halftone] [--palette ember] [--example moon|eyes|renew]"); process.exit(2); }
const out = resolve(opt("dir", "reels"), `${name}.js`);
if (existsSync(out)) { console.error(`${out} already exists`); process.exit(1); }
let src;
const example = opt("example");
if (example) {
  const dir = join(here, "../assets/examples"), file = join(dir, `${example}.js`);
  if (!existsSync(file)) { console.error(`no example "${example}" (${readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).join(", ")})`); process.exit(2); }
  src = readFileSync(file, "utf8");
} else {
  const look = opt("look", "halftone"), palette = opt("palette", LOOKS[look]?.palette);
  if (!LOOKS[look]) { console.error(`no look "${look}" (${Object.keys(LOOKS).join(", ")})`); process.exit(2); }
  if (!PALETTES[palette]) { console.error(`no palette "${palette}" (${Object.keys(PALETTES).join(", ")})`); process.exit(2); }
  src = readFileSync(join(here, "../assets/templates/starter.js"), "utf8").replace(/look: "halftone",/, `look: "${look}",`).replace(/palette: "ember",/, `palette: "${palette}",`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, src);
console.log(`wrote ${out}`);
