// Lights On pictures: a page is one day photo and its edits (night, dark = night with the lights off, one photo per
// light on its own, fabric or product variants), so every picture shares the day photo's frame. Generated with the
// user's Skillsmart credits (gen.mjs).
//
//   node shots.mjs <id> --cost             what the missing shots would cost, and stop
//   node shots.mjs <id> day --n 3          three takes of a shot: out/<id>/day-take1.png …; keep one with --keep
//   node shots.mjs <id> day --keep 2       copy take 2 to out/<id>/day.png (the edits read <shot>.png)
//   node shots.mjs <id>                    every missing shot, in dependency order
//   node shots.mjs <id> night --force      redo that shot (the old one is kept as night.bak-N.png)
//   node shots.mjs <id> night --fix "…"    add a note to the prompt for this run
//   node shots.mjs <id> --res 2K           softer and cheaper: 20 credits a picture instead of 40
//
// Prompts live in scenes/<id>.json ({keep} expands to the shared keep-everything sentence in photo.json). Then:
// python prep.py <id>.
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { file as ref, generate } from "./gen.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(TOOLS, "photo.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, ...only] = words;
const sceneFile = join(TOOLS, "scenes", `${id}.json`);
if (!id || !existsSync(sceneFile)) { console.error("usage: node shots.mjs <id> [shot …] [--cost] [--n 3] [--keep 2] [--force] [--fix \"…\"] [--res 2K]"); process.exit(1); }
const scene = JSON.parse(readFileSync(sceneFile, "utf8"));
const force = argv.includes("--force");
const takes = Number(flag("--n") ?? 1);
const keep = flag("--keep");
const fix = flag("--fix");
const res = flag("--res") ?? spec.resolution;
const PRICE = res === "4K" ? 40 : 20;

const dir = join(TOOLS, "out", id);
mkdirSync(dir, { recursive: true });
const file = (shot) => join(dir, `${shot}.png`);
function keepOld(dest) {
  if (!existsSync(dest)) return;
  let n = 1;
  while (existsSync(dest.replace(/\.png$/, `.bak-${n}.png`))) n++;
  renameSync(dest, dest.replace(/\.png$/, `.bak-${n}.png`));
}

if (keep) {
  for (const shot of only) {
    const src = join(dir, `${shot}-take${keep}.png`);
    if (!existsSync(src)) { console.error(`no ${src}`); process.exit(1); }
    keepOld(file(shot));
    copyFileSync(src, file(shot));
    console.log(`${shot}: kept take ${keep}`);
  }
  process.exit(0);
}

const prompt = (shot) => {
  const s = scene.shots[shot];
  const p = s.prompt.replaceAll("{keep}", spec.keep);
  return `${p}${s.from ? "" : ` ${spec.photo}`}${fix ? ` ${fix}` : ""}`;
};

async function shoot(shot, take) {
  const s = scene.shots[shot];
  const dest = take ? join(dir, `${shot}-take${take}.png`) : file(shot);
  if (!take) keepOld(dest);
  const input = { prompt: prompt(shot), aspect_ratio: "16:9", resolution: res, output_format: "png" };
  if (s.from) {
    // what goes to the model: a JPEG small enough to upload
    const sent = join(dir, `.ref-${shot}${take ? `-${take}` : ""}.jpg`);
    await sharp(file(s.from)).jpeg({ quality: 95 }).toFile(sent);
    input.images = [ref(sent)];
  }
  // kept at the size the model returns (a little wider than 16:9, 5504 × 3072 at 4K): cropped to 16:9, each edit in a
  // chain would start from a tighter frame, and the frame would creep about 0.8% an edit
  await generate("nano-banana-pro", input, { skill: "lights-on", out: dest, label: `${shot}${take ? ` #${take}` : ""}` });
}

const wanted = only.length ? only : Object.keys(scene.shots).filter((k) => force || !existsSync(file(k)));
if (wanted.some((k) => !scene.shots[k])) { console.error(`shots: ${Object.keys(scene.shots).join(", ")}`); process.exit(1); }
if (argv.includes("--cost")) {
  const n = wanted.length * takes;
  console.log(`${n} picture${n === 1 ? "" : "s"} at ${res}: ${n * PRICE} credits${n ? ` (${wanted.join(", ")})` : ""}`);
  process.exit(0);
}
const done = {};
const make = (shot) => (done[shot] ??= (async () => {
  const s = scene.shots[shot];
  if (s.from && !existsSync(file(s.from))) {
    if (!scene.shots[s.from]) throw new Error(`${shot}: unknown source ${s.from}`);
    await make(s.from);
  }
  if (takes > 1 && only.includes(shot)) {
    await Promise.all(Array.from({ length: takes }, (_, i) => shoot(shot, i + 1).catch((e) => console.error(`[${shot} #${i + 1}]`, e.message))));
    return;
  }
  await shoot(shot);
})());

const results = await Promise.allSettled(wanted.map(make));
results.forEach((r, i) => r.status === "rejected" && console.error(`[${wanted[i]}] failed:`, r.reason?.message));
console.log(`${id}: done`);
