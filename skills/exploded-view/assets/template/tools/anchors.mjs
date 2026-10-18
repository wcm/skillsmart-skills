// Where each label's dot lands: the page's parts (and the lab's own points) drawn on the exploded view, so a dot that
// misses its part shows before the page is opened.
//
//   node anchors.mjs <id>           → out/<id>/anchors.png
//   node anchors.mjs <id> --grid    the same with a labelled 10 × 10 grid, to read a part's position: "at": [u, v],
//                                   u across and v down, both 0–1 (0.5, 0.5 is the middle of the frame)
//
// Red dots are the parts in order (1 is the first in page.json); blue "d" the sound lab's drivers; orange "f" the
// energy lab's flow points. Put each part's dot on the part itself, at the edge that faces its label.

import sharp from "sharp";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const id = process.argv.slice(2).find((a) => !a.startsWith("--"));
const grid = process.argv.includes("--grid");
const pageFile = join(ROOT, "..", "site", id ?? "", "page.json"), src = join(ROOT, "out", id ?? "", "exploded.png");
if (!id || !existsSync(pageFile) || !existsSync(src)) {
  console.error(`usage: node anchors.mjs <id> [--grid]   (needs site/<id>/page.json and out/<id>/exploded.png)`);
  process.exit(1);
}
const page = JSON.parse(readFileSync(pageFile, "utf8"));
const { width: W, height: H } = await sharp(src).metadata();
const dot = (u, v, label, colour) => `<g transform="translate(${u * W},${v * H})"><circle r="17" fill="${colour}" stroke="#fff" stroke-width="5"/><text y="9" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="24" fill="#fff" text-anchor="middle">${label}</text></g>`;
const lines = grid ? Array.from({ length: 9 }, (_, i) => {
  const k = (i + 1) / 10;
  return `<line x1="${k * W}" x2="${k * W}" y1="0" y2="${H}" stroke="#ff2bd6" stroke-width="2" opacity=".55"/><line y1="${k * H}" y2="${k * H}" x1="0" x2="${W}" stroke="#ff2bd6" stroke-width="2" opacity=".55"/>`
    + `<text x="${k * W + 6}" y="30" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ff2bd6">${k.toFixed(1)}</text><text x="8" y="${k * H - 8}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ff2bd6">${k.toFixed(1)}</text>`;
}).join("") : "";
const extra = [...(page.lab.drivers ?? []).map(([u, v]) => dot(u, v, "d", "#2c5bff")), ...(page.lab.flow ?? []).map(([u, v], i) => dot(u, v, `f${i + 1}`, "#e0892e"))];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines}${page.parts.map((p, i) => dot(p.at[0], p.at[1], i + 1, "#e23b2e")).join("")}${extra.join("")}</svg>`;
const dest = join(ROOT, "out", id, "anchors.png");
await sharp(src).composite([{ input: Buffer.from(svg) }]).png().toFile(dest);
console.log(`→ out/${id}/anchors.png   ${page.parts.map((p, i) => `${i + 1} ${p.name}`).join(" · ")}`);
