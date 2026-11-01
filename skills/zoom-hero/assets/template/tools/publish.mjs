// A page's kept pictures → site/<id>/img/: two sizes of every level, a small round thumbnail, and levels.json for the
// engine (the tree, each level's measured rect, its real-world width, and the tone match for the hand-over).
//
//   node publish.mjs <id>
import sharp from "sharp";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SITE, dirOf, loadTree, readJson } from "./common.mjs";

const id = process.argv[2];
const tree = loadTree(id), src = dirOf(id), dest = join(SITE, id, "img");
mkdirSync(dest, { recursive: true });
const aligned = readJson(join(src, "align.json"));
const out = { size: [1600, 900], root: null, nodes: {} };
for (const [l, n] of Object.entries(tree.nodes)) {
  const png = join(src, `${l}.png`);
  if (!existsSync(png) || (n.parent && !out.nodes[n.parent])) continue;
  if (!n.parent) out.root = l;
  const meta = await sharp(png).metadata();
  const files = [];
  for (const [w, q] of [[1600, 82], [Math.min(3200, meta.width), 84]]) {
    const f = `${l}-${w}.webp`;
    await sharp(png).resize(w, Math.round((w * 9) / 16), { fit: "cover", kernel: "lanczos3" }).webp({ quality: q, effort: 5, smartSubsample: true }).toFile(join(dest, f));
    files.push(f);
  }
  const [fx, fy] = n.focus ?? [0.5, 0.5], side = Math.round(meta.height * 0.6);
  const left = Math.max(0, Math.min(meta.width - side, Math.round(fx * meta.width - side / 2)));
  const top = Math.max(0, Math.min(meta.height - side, Math.round(fy * meta.height - side / 2)));
  await sharp(png).extract({ left, top, width: side, height: side }).resize(96, 96).webp({ quality: 80 }).toFile(join(dest, `${l}-thumb.webp`));
  const a = aligned[l], rect = n.parent ? (a?.ok ? a.rect : n.rect) : null;
  // the parent's average colour under the area against the close-up's own: while the close-up is small the engine
  // tints it by this, so it doesn't show as a lighter or darker patch, then eases to its true colour
  let tint = null;
  if (rect) {
    const parent = join(src, `${n.parent}.png`), pm = await sharp(parent).metadata(), [cx, cy, s] = rect;
    const w = Math.round(s * pm.width), h = Math.round(s * pm.height);
    const region = { left: Math.max(0, Math.min(pm.width - w, Math.round(cx * pm.width - w / 2))), top: Math.max(0, Math.min(pm.height - h, Math.round(cy * pm.height - h / 2))), width: w, height: h };
    const cut = await sharp(parent).extract(region).png().toBuffer();   // stats() ignores extract(): cut first
    const mean = async (img) => (await img.stats()).channels.slice(0, 3).map((c) => c.mean);
    const [pa, ch] = await Promise.all([mean(sharp(cut)), mean(sharp(png))]);
    tint = pa.map((v, i) => Number(Math.min(1.8, Math.max(0.55, (v + 2) / (ch[i] + 2))).toFixed(3)));
  }
  out.nodes[l] = { parent: n.parent ?? null, rect: rect && rect.map((x) => Number(x.toFixed(5))), span: n.span ?? null, ...(tint ? { tint } : {}), ...(n.focus ? { focus: n.focus } : {}), src: files, thumb: `${l}-thumb.webp` };
  console.log(`${l}${n.parent ? ` in ${n.parent} at [${out.nodes[l].rect.join(", ")}]${a ? (a.ok ? " (measured)" : " (planned: weak match)") : " (planned)"}` : ""}`);
}
if (!out.root) { console.error("no first level yet: node pictures.mjs " + id); process.exit(1); }
writeFileSync(join(dest, "levels.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`→ ${dest}`);
