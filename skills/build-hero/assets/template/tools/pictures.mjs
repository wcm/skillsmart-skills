// The pictures of a build film, generated with Skillsmart credits (20 credits a picture; failed ones are free). Every
// film runs between pictures of one place: the finished place from a prompt, the others edits of it, so they agree.
//
//   node pictures.mjs <id> --cost            what the missing pictures will cost, in credits; nothing is made
//   node pictures.mjs <id>                   every missing picture except the evening ones, in dependency order
//   node pictures.mjs <id> end --n 2         two takes: out/<id>/end-take1.png, end-take2.png; keep one with --keep
//   node pictures.mjs <id> end --keep 2      copy take 2 to out/<id>/end.png (the old one is kept as .bak-N)
//   node pictures.mjs <id> staged --force    redo that picture
//   node pictures.mjs <id> staged --fix "…"  add a note to the prompt for this run
//   node pictures.mjs <id> dusk lit          the evening, once the film is made (edits of its last frame)
//
// Prompts live in scenes/<id>.json under "shots". `from` names the picture an edit starts from (a shot, or a file in
// out/<id>/ such as film-last); `refs` adds more pictures to look at. Two kinds are made here for free:
//   "crop":  { "zoom": 1.2, "center": [0.5, 0.55] }   a tighter framing of `from`, for a keyframe the camera pulls back from
//   "paste": { "donor": "half-end", "rect": [x0, y0, x1, y1] }   `from` with one rectangle of another picture (shares
//            of the frame) pasted in with a soft edge, for a keyframe that must match another exactly everywhere else
// With FAL_KEY set, your own fal.ai key is used instead of credits.
import sharp from "sharp";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { file as ref, generate } from "./gen.mjs";
import { CREDITS, OUT, PROMPTS, SIZE, SKILL, keepOld, loadScene } from "./common.mjs";

const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, ...only] = words;
const force = argv.includes("--force");
const takes = Number(flag("--n") ?? 1);
const fix = flag("--fix");
const scene = loadScene(id);
const dir = join(OUT, id);
const file = (shot) => join(dir, `${shot}.png`);
const fromFilm = (shot) => { for (let s = scene.shots[shot]; s; s = scene.shots[s.from]) if (s.from === "film-last") return true; return false; };
const free = (s) => s.crop || s.paste;

if (flag("--keep")) {
  const shot = only[0], src = join(dir, `${shot}-take${flag("--keep")}.png`);
  if (!existsSync(src)) { console.error(`no ${src}`); process.exit(1); }
  keepOld(file(shot));
  copyFileSync(src, file(shot));
  console.log(`${shot}: kept take ${flag("--keep")}`);
  process.exit(0);
}

const wanted = only.length ? only : Object.keys(scene.shots).filter((k) => !fromFilm(k) && (force || !existsSync(file(k))));
for (const k of wanted) if (!scene.shots[k]) { console.error(`${id} has no picture ${k}: ${Object.keys(scene.shots).join(", ")}`); process.exit(1); }
const unwritten = wanted.filter((k) => !free(scene.shots[k]) && /\bWRITE\b/.test(scene.shots[k].prompt ?? "WRITE"));

if (argv.includes("--cost")) {
  const paid = wanted.filter((k) => !free(scene.shots[k])), n = paid.length * (only.length ? takes : 1);
  console.log(`${n} picture${n === 1 ? "" : "s"} at ${CREDITS.picture} credits: ${n * CREDITS.picture} credits (${paid.join(", ") || "nothing missing"})`);
  const evening = Object.keys(scene.shots).filter(fromFilm).length;
  if (!only.length && evening) console.log(`After the film, the evening: ${evening} more, ${evening * CREDITS.picture} credits.`);
  if (unwritten.length) console.log(`Not written yet: ${unwritten.join(", ")}.`);
  process.exit(0);
}
if (unwritten.length) { console.error(`Write these first in scenes/${id}.json: ${unwritten.join(", ")}`); process.exit(1); }

const fill = (text) => text.replaceAll("{same}", PROMPTS.same).replaceAll("{photo}", PROMPTS.photo).replaceAll("{style}", scene.style ?? "");
const promptOf = (shot) => {
  const s = scene.shots[shot];
  return [fill(s.prompt), s.from ? "" : PROMPTS.photo, fix ?? ""].filter(Boolean).join(" ");
};
// every picture the same exact shape, whatever the model returned, so edits and keyframes line up
async function fit(dest) {
  const m = await sharp(dest).metadata();
  const [W, H] = scene.shots[dest.match(/([^/\\]+?)(-take\d+)?\.png$/)?.[1]]?.size ?? [SIZE.width, SIZE.height];
  if (m.width !== W || m.height !== H) writeFileSync(dest, await sharp(dest).resize(W, H, { fit: "cover", kernel: "lanczos3" }).png().toBuffer());
}

async function shoot(shot, take) {
  const s = scene.shots[shot];
  const dest = take ? join(dir, `${shot}-take${take}.png`) : file(shot);
  if (s.crop) {
    const im = sharp(file(s.from)), { width: W, height: H } = await im.metadata();
    const w = Math.round(W / s.crop.zoom), h = Math.round(H / s.crop.zoom);
    const left = Math.max(0, Math.min(W - w, Math.round(s.crop.center[0] * W - w / 2))), top = Math.max(0, Math.min(H - h, Math.round(s.crop.center[1] * H - h / 2)));
    keepOld(dest);
    await im.extract({ left, top, width: w, height: h }).resize(W, H, { kernel: "lanczos3" }).png().toFile(dest);
    console.log(`${id}/${shot}: ×${s.crop.zoom} crop of ${s.from}`);
    return;
  }
  if (s.paste) {
    const base = sharp(file(s.from)), { width: W, height: H } = await base.metadata();
    const [x0, y0, x1, y1] = s.paste.rect;
    const edge = (s.paste.feather ?? 0.008) * W;
    const mask = await sharp(Buffer.from(`<svg width="${W}" height="${H}"><rect x="${x0 * W}" y="${y0 * H}" width="${(x1 - x0) * W}" height="${(y1 - y0) * H}" fill="#fff"/></svg>`)).blur(Math.max(0.3, edge)).extractChannel("alpha").toBuffer();
    const donor = await sharp(file(s.paste.donor)).resize(W, H).removeAlpha().joinChannel(await sharp(mask).toColourspace("b-w").toBuffer()).png().toBuffer();
    keepOld(dest);
    writeFileSync(dest, await base.composite([{ input: donor }]).png().toBuffer());
    console.log(`${id}/${shot}: ${s.from} with part of ${s.paste.donor} pasted in`);
    return;
  }
  const froms = [s.from, ...(s.refs ?? [])].filter(Boolean);
  const input = { prompt: promptOf(shot), aspect_ratio: "16:9", resolution: "2K", output_format: "png" };
  if (froms.length) input.images = froms.map((f) => ref(file(f)));
  await generate("nano-banana-pro", input, { skill: SKILL, out: dest, label: `${id}/${shot}${take ? ` #${take}` : ""}` });
  await fit(dest);
}

const done = {};
const make = (shot) => (done[shot] ??= (async () => {
  const s = scene.shots[shot];
  for (const f of [s.from, s.paste?.donor, ...(s.refs ?? [])].filter(Boolean)) {
    if (existsSync(file(f))) continue;
    if (!scene.shots[f]) throw new Error(`${shot} needs out/${id}/${f}.png${f === "film-last" ? ` (make the film, then node frames.mjs ${id})` : ""}`);
    await make(f);
  }
  if (takes > 1 && only.includes(shot) && !free(s)) {
    await Promise.all(Array.from({ length: takes }, (_, i) => shoot(shot, i + 1)));
    return;
  }
  if (!force && !only.includes(shot) && existsSync(file(shot))) return;
  await shoot(shot);
})());
const results = await Promise.allSettled(wanted.map(make));
results.forEach((r, i) => { if (r.status === "rejected") { console.error(`[${wanted[i]}] ${r.reason?.message ?? r.reason}`); process.exitCode ||= r.reason?.exitCode ?? 1; } });
