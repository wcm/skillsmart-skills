// Every take of a level on one sheet, to choose which to keep. A close-up's takes come after the crop they were made
// from, each with how well it lines up with it (rho: 1 is perfect; under 0.5 it won't hand over cleanly).
//
//   node takes.mjs <id> <level>         → out/<id>/takes-<level>.jpg
import sharp from "sharp";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dirOf, loadTree } from "./common.mjs";
import { measure } from "./align.mjs";

const [id, level] = process.argv.slice(2);
const node = loadTree(id).nodes[level];
if (!node) { console.error("usage: node takes.mjs <id> <level>"); process.exit(1); }
const dir = dirOf(id);
const ns = readdirSync(dir).map((f) => f.match(new RegExp(`^${level}-take(\\d+)\\.png$`))?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
if (!ns.length) { console.error(`no takes of ${level} yet`); process.exit(1); }
const tiles = [];
if (node.parent && existsSync(join(dir, `${level}-crop.jpg`))) tiles.push({ file: join(dir, `${level}-crop.jpg`), label: "the crop it came from" });
for (const t of ns) {
  let label = `take ${t}`;
  if (node.parent) { const r = await measure(id, level, { take: t, dry: true }); label += ` · rho ${r.rho}${r.ok ? "" : " · WEAK"}`; }
  tiles.push({ file: join(dir, `${level}-take${t}.png`), label });
}
const W = 960, H = 540, cols = 2, rows = Math.ceil(tiles.length / cols);
const tag = (t) => Buffer.from(`<svg width="${W}" height="48"><rect width="${t.length * 13 + 24}" height="40" rx="6" fill="#000" opacity=".72"/><text x="12" y="28" font-family="Helvetica" font-size="22" font-weight="700" fill="#fff">${t}</text></svg>`);
const imgs = await Promise.all(tiles.map((t) => sharp(t.file).resize(W, H).toBuffer()));
const out = join(dir, `takes-${level}.jpg`);
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: "#111" } })
  .composite(imgs.flatMap((b, i) => [{ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H }, { input: tag(tiles[i].label), left: (i % cols) * W + 8, top: Math.floor(i / cols) * H + 8 }]))
  .jpeg({ quality: 86 }).toFile(out);
console.log(out);
