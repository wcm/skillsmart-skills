#!/usr/bin/env node
/*
 * node shapes.mjs [--out shapes.png] [--look halftone]
 *
 * Draws every drawing in the shape library (engine/shapes.js CATALOG) on one sheet with its name,
 * so you can pick shapes by eye. Uses the same page and looks as a reel.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const out = resolve(opt("out", "shapes.png"));
const dir = join(tmpdir(), `trame-shapes-${process.pid}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "shapes.js"), `export default {
  title: "shapes", look: ${JSON.stringify(opt("look", "halftone"))}, caption: { hide: true }, sound: { bed: "none", sfx: false },
  build({ add, S }) {
    const names = Object.keys(S.CATALOG), cols = 7, cw = 1080 / cols, ch = 1920 / Math.ceil(names.length / cols);
    names.forEach((n, i) => {
      const x = cw * (i % cols) + cw / 2, y = ch * Math.floor(i / cols) + ch * 0.42;
      add.line(S.fit(S.CATALOG[n](), 92), { x, y, width: 2.4, color: n.startsWith("number") ? "accent" : "ink", in: "cut" });
      add.text(n.replace(/^number\\("(.*)"\\)$/, "number $1"), { x, y: y + ch * 0.4, size: 15, track: 0.04, color: "ink", in: "cut" });
    });
  },
};
`);
try {
  execFileSync(process.execPath, [join(here, "check.mjs"), join(dir, "shapes.js"), "--at", "0.5", "--scale", "1", "--cols", "1", "--width", "1080", "--out", out], { stdio: ["ignore", "ignore", "inherit"] });
} catch {} // a one-frame "reel" fails check's length rule; the sheet is what we want
console.log(`wrote ${out}`);
rmSync(dir, { recursive: true, force: true });
