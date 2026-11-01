// A page's whole tree on one sheet: one row per depth, each level with the areas of its children drawn on it (dashed
// where the area is still the planned one, not measured).
//
//   node sheet.mjs <id>                 → out/<id>/tree.jpg
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dirOf, loadTree, readJson } from "./common.mjs";

const id = process.argv[2];
const tree = loadTree(id), nodes = tree.nodes, dir = dirOf(id);
const aligned = readJson(join(dir, "align.json"));
const ids = Object.keys(nodes).filter((l) => existsSync(join(dir, `${l}.png`)));
if (!ids.length) { console.error("no kept pictures yet"); process.exit(1); }
const depth = (l) => (nodes[l].parent ? depth(nodes[l].parent) + 1 : 0);
const rows = [];
for (const l of ids) (rows[depth(l)] ??= []).push(l);
const W = 720, H = 405, GAP = 10, cols = Math.max(...rows.map((r) => r.length));
const tiles = [];
for (const [r, row] of rows.entries()) {
  for (const [c, l] of row.entries()) {
    const marks = [];
    for (const [k, n] of Object.entries(nodes)) {
      if (n.parent !== l) continue;
      const a = aligned[k], rect = a?.ok ? a.rect : n.rect;
      if (!rect) continue;
      const [cx, cy, s] = rect, w = s * W, h = s * H, x = cx * W - w / 2, y = cy * H - h / 2;
      marks.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#00e5ff" stroke-width="2.5" ${a?.ok ? "" : 'stroke-dasharray="8 5"'}/><text x="${x + 3}" y="${y + h + 16}" font-family="Helvetica" font-size="14" font-weight="700" fill="#00e5ff" stroke="#000" stroke-width="3" paint-order="stroke">${k}</text>`);
    }
    const a = aligned[l], title = `${l}${nodes[l].span ? ` · ${nodes[l].span} m` : ""}${a ? ` · rho ${a.rho}${a.ok ? "" : " WEAK"}` : ""}`;
    marks.push(`<rect x="6" y="6" width="${title.length * 9 + 16}" height="26" rx="5" fill="#000" opacity=".7"/><text x="14" y="24" font-family="Helvetica" font-size="15" font-weight="700" fill="#fff">${title}</text>`);
    const base = await sharp(join(dir, `${l}.png`)).resize(W, H).toBuffer();
    tiles.push({ input: await sharp(base).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${marks.join("")}</svg>`) }]).toBuffer(), left: c * (W + GAP), top: r * (H + GAP) });
  }
}
const out = join(dir, "tree.jpg");
await sharp({ create: { width: cols * (W + GAP) - GAP, height: rows.length * (H + GAP) - GAP, channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 85 }).toFile(out);
console.log(out);
