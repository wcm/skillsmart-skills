// A level with a coordinate grid and its children's areas drawn on it, for choosing where each zoom dives.
//
//   node look.mjs <id> <level>                     → out/<id>/look-<level>.jpg
//   node look.mjs <id> <level> --take 2            look at a take instead
//   node look.mjs <id> <level> --try "0.62,0.55,0.12"   also draw a candidate area (dashed)
//
// Grid lines every 0.05, labelled every 0.1. A rect is [centre x, centre y, size], shares of the picture; it keeps the
// picture's 16:9 shape. The zones the page's interface covers are tinted red (see references/pictures.md).
import sharp from "sharp";
import { join } from "node:path";
import { dirOf, flagOf, loadTree } from "./common.mjs";

const argv = process.argv.slice(2), flag = flagOf(argv);
const [id, level] = argv;
const tree = loadTree(id), dir = dirOf(id), take = flag("--take");
const src = join(dir, take ? `${level}-take${take}.png` : `${level}.png`);
const W = 1800, H = Math.round((W * 9) / 16);
const lines = [];
const zone = (x, y, w, h) => lines.push(`<rect x="${x * W}" y="${y * H}" width="${w * W}" height="${h * H}" fill="#ff2a2a" fill-opacity=".14"/>`);
zone(0, 0, 1, 0.1); zone(0, 0.64, 0.36, 0.36); zone(0.72, 0.84, 0.28, 0.16); zone(0.36, 0.9, 0.36, 0.1);
for (let i = 1; i < 20; i++) {
  const x = (i / 20) * W, y = (i / 20) * H, major = i % 2 === 0;
  const st = major ? 'stroke="#fff" stroke-opacity=".55" stroke-width="1.2"' : 'stroke="#fff" stroke-opacity=".22" stroke-width="1"';
  lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" ${st}/>`, `<line x1="0" y1="${y}" x2="${W}" y2="${y}" ${st}/>`);
  if (major) {
    const v = (i / 20).toFixed(1), t = 'font-family="Helvetica" font-size="15" font-weight="700" fill="#ff0" stroke="#000" stroke-width="3" paint-order="stroke"';
    lines.push(`<text x="${x + 4}" y="18" ${t}>${v}</text>`, `<text x="4" y="${y - 4}" ${t}>${v}</text>`);
  }
}
const box = ([cx, cy, s], label, color, dash = "") => {
  const w = s * W, h = s * H, x = cx * W - w / 2, y = cy * H - h / 2;
  lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3" ${dash}/><text x="${x + 4}" y="${y + h + 20}" font-family="Helvetica" font-size="17" font-weight="700" fill="${color}" stroke="#000" stroke-width="3" paint-order="stroke">${label}</text>`);
};
for (const [c, n] of Object.entries(tree.nodes)) if (n.parent === level && n.rect) box(n.rect, c, "#00e5ff");
if (flag("--try")) box(flag("--try").split(",").map(Number), "try", "#ff3df5", 'stroke-dasharray="10 6"');
const dest = join(dir, `look-${level}${take ? `-take${take}` : ""}.jpg`);
await sharp(src).resize(W, H, { fit: "fill" }).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${lines.join("")}</svg>`) }]).jpeg({ quality: 85 }).toFile(dest);
console.log(dest);
