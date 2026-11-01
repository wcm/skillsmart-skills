// A review sheet: pictures side by side, each labelled with its file name.
//
//   node sheet.mjs out/<id>/end-take1.png out/<id>/end-take2.png --out out/<id>/end-takes.jpg [--w 960] [--cols 2]
import sharp from "sharp";
import { basename } from "node:path";

const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const files = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const out = flag("--out") ?? "sheet.jpg";
const W = Number(flag("--w") ?? 960), COLS = Number(flag("--cols") ?? Math.min(2, files.length));
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const H = Math.round(W / Math.max(...metas.map((m) => m.width / m.height)));
const rows = Math.ceil(files.length / COLS), PAD = 8, TOP = 34;
const tiles = [];
for (const [i, f] of files.entries()) {
  const left = (i % COLS) * (W + PAD) + PAD, top = Math.floor(i / COLS) * (H + TOP + PAD) + PAD;
  tiles.push({ input: await sharp(f).resize(W, H, { fit: "contain", background: "#111" }).toBuffer(), left, top: top + TOP });
  tiles.push({ input: Buffer.from(`<svg width="${W}" height="${TOP}"><text x="2" y="23" font-family="Helvetica" font-size="19" fill="#ddd">${basename(f)}</text></svg>`), left, top });
}
await sharp({ create: { width: COLS * (W + PAD) + PAD, height: rows * (H + TOP + PAD) + PAD, channels: 3, background: "#0d0d0d" } })
  .composite(tiles).jpeg({ quality: 86 }).toFile(out);
console.log(`→ ${out}`);
