// A page's pictures. Every level is one 16:9 picture: the first is made from a prompt (or is the user's own photo), each
// deeper one from a crop of its parent, enlarged and re-made up close, so it lines up with the place it came from.
// Generated through the user's Skillsmart account: 20 credits a take (--4k: 40).
//
//   node pictures.mjs <id> --cost                how many credits the missing levels will take
//   node pictures.mjs <id>                       every missing level, one take each, parents first
//   node pictures.mjs <id> <level> --takes 2     two takes: out/<id>/<level>-take1.png, -take2.png
//   node pictures.mjs <id> <level> --takes 2 --from 3   takes 3 and 4, beside the earlier ones
//   node pictures.mjs <id> <level> --keep 2      keep take 2 as out/<id>/<level>.png, and measure where it sits
//   node pictures.mjs <id> <level> --fix "…"     add a note to the prompt for this run
//   node pictures.mjs <id> <level> --force       remake a kept level
//   node pictures.mjs <id> <level> --4k          at 4K (for a first level that must stay sharp on a very large screen)
//
// In the tree a level with "image": "path" uses that picture instead (free). Then: takes.mjs, look.mjs, sheet.mjs,
// publish.mjs. A level's crop is saved as out/<id>/<level>-crop.jpg.
import sharp from "sharp";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { MEDIA, SIZES, TOOLS, ZOOM, dirOf, flagOf, loadTree, words } from "./common.mjs";
import { measure } from "./align.mjs";
import { file, generate } from "./gen.mjs";

const argv = process.argv.slice(2), flag = flagOf(argv);
const [id, ...only] = words(argv);
const tree = loadTree(id);
const nodes = tree.nodes, dir = dirOf(id);
const force = argv.includes("--force"), takes = Number(flag("--takes", 1)), first = Number(flag("--from", 1));
const fix = flag("--fix"), keep = flag("--keep"), res = argv.includes("--4k") ? "4K" : "2K";
const [W, H] = SIZES[res];
const kept = (l) => join(dir, `${l}.png`);

const report = (l, r) => console.log(`${l}: rho ${r.rho}, scale ${r.k} → ${r.ok ? "fits" : "WEAK MATCH: the planned rect will be used, which can show as a jump"}`);

if (keep) {
  for (const l of only) {
    const src = join(dir, `${l}-take${keep}.png`);
    if (!existsSync(src)) { console.error(`no ${src}`); process.exit(1); }
    copyFileSync(src, kept(l));
    console.log(`${l}: kept take ${keep}`);
    if (nodes[l].parent) report(l, await measure(id, l));
  }
  process.exit(0);
}

const wanted = only.length ? only : Object.keys(nodes).filter((l) => force || !existsSync(kept(l)));
for (const l of wanted) if (!nodes[l]) { console.error(`no level "${l}" (have: ${Object.keys(nodes).join(", ")})`); process.exit(1); }

if (argv.includes("--cost")) {
  const paid = wanted.filter((l) => !nodes[l].image);
  console.log(`${paid.length} level${paid.length === 1 ? "" : "s"} × ${takes} take${takes === 1 ? "" : "s"} × ${res === "4K" ? 40 : 20} credits = ${paid.length * takes * (res === "4K" ? 40 : 20)} credits`);
  process.exit(0);
}

// the parent's pixels under rect, enlarged: what the close-up has to agree with
async function cropOf(l) {
  const n = nodes[l], parent = kept(n.parent);
  const { width: pw, height: ph } = await sharp(parent).metadata();
  const [cx, cy, s] = n.rect;
  const w = Math.round(s * pw), h = Math.round(s * ph);
  const left = Math.max(0, Math.min(pw - w, Math.round(cx * pw - w / 2)));
  const top = Math.max(0, Math.min(ph - h, Math.round(cy * ph - h / 2)));
  const dest = join(dir, `${l}-crop.jpg`);
  await sharp(parent).extract({ left, top, width: w, height: h }).resize(1920, 1080, { kernel: "lanczos3", fit: "fill" }).jpeg({ quality: 93 }).toFile(dest);
  writeFileSync(join(dir, `${l}-crop.json`), JSON.stringify({ parent: n.parent, rect: n.rect, px: { left, top, width: w, height: h }, parentSize: [pw, ph] }));
  return dest;
}

function promptOf(l) {
  const n = nodes[l], medium = MEDIA[n.medium ?? tree.medium ?? "photo"] ?? "";
  const parts = n.parent ? [ZOOM.replaceAll("{times}", String(Math.round(1 / n.rect[2]))), n.prompt, tree.style, medium] : [n.prompt, tree.style, medium];
  if (fix) parts.push(fix);
  return parts.filter(Boolean).join(" ");
}

async function normalise(dest) {
  const meta = await sharp(dest).metadata();
  if (meta.width !== W || meta.height !== H) writeFileSync(dest, await sharp(dest).resize(W, H, { fit: "cover", kernel: "lanczos3" }).png().toBuffer());
}

async function shoot(l, take) {
  const n = nodes[l], dest = take ? join(dir, `${l}-take${take}.png`) : kept(l);
  if (n.image) {
    const from = isAbsolute(n.image) ? n.image : resolve(TOOLS, n.image);
    writeFileSync(dest, await sharp(from).rotate().resize(W, H, { fit: "cover", kernel: "lanczos3" }).png().toBuffer());
    console.log(`${l}: your picture ${n.image}`);
  } else {
    const input = { prompt: promptOf(l), aspect_ratio: "16:9", resolution: res, output_format: "png", ...(n.parent ? { images: [file(await cropOf(l))] } : {}) };
    await generate("nano-banana-pro", input, { skill: "zoom-hero", out: dest, label: `${id}/${l}${take ? ` take ${take}` : ""}` });
    await normalise(dest);
  }
  if (n.parent && take) { const r = await measure(id, l, { take, dry: true }); console.log(`${l} take ${take}: rho ${r.rho}${r.ok ? "" : " (weak)"}`); }
  if (n.parent && !take) report(l, await measure(id, l));
}

const done = {};
const make = (l) => (done[l] ??= (async () => {
  const n = nodes[l];
  if (n.parent) {
    if (!existsSync(kept(n.parent))) {
      if (only.length) throw new Error(`${l}: keep a picture of its parent "${n.parent}" first`);
      await make(n.parent);
    }
    if (!n.rect) throw new Error(`${l}: choose its rect in "${n.parent}" first (node look.mjs ${id} ${n.parent})`);
  }
  if (takes > 1 || first > 1) {
    await Promise.all(Array.from({ length: takes }, (_, i) => shoot(l, i + first)));
    return;
  }
  await shoot(l);
})());

const results = await Promise.allSettled(wanted.map(make));
for (const [i, r] of results.entries()) if (r.status === "rejected") console.error(`${wanted[i]}: ${r.reason?.message}`);
if (results.some((r) => r.status === "rejected")) process.exitCode ||= 1;
