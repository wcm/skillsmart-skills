// Cut-out turns → the page's frames, every subject on the same stage: one turning axis, one ground line, one size.
//
//   node frames.mjs <id>                 every subject of tools/subjects/<id>.json
//   node frames.mjs <id> --only bronze   just that one
//
// Reads tools/out/<id>/<name>/rgba/001.png … (subjects.mjs), writes site/<id>/frames/<name>/001.webp … + manifest.json.
// The subjects file's "stage" (in the stage's own pixels; the page scales it to --stage-h):
//   w, h         the stage canvas                       axis    where the turning axis stands (x)
//   ground       where the subject rests (y)            or "float": true and "centre": y for things that hover (shoes)
//   fit          "height": the tallest a subject gets over its turn becomes size px (standing things)
//                "width":  the widest it gets becomes size px (shoes, dishes)
//                "frame":  every subject at one scale, size px per film height (people: a raised arm or a jump doesn't
//                          shrink anyone)
//   groundFrom   "front": rest by the lowest point of the front view, not of the whole turn (a square base dips lower
//                at 45° and would make the subject float when it faces you)
//   sink         push the subject this fraction of the stage into what it stands on (a plinth's top face)
// Per subject: "scale" nudges its size, "air" lifts a jump off the ground (a fraction of the stage's height),
// "reverse": true / false plays its film the other way. Without "reverse", a subject that clearly turns the other way
// from the rest is reversed for you (subjects.mjs measured each turn).
// "count": frames per turn on the page (72), "quality": WebP quality (76). The manifest's "cum" says how far through the
// turn each frame is, by how much the picture changes, so the engine keeps the turn even where the film slows down.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { OUT, SITE, flag, loadSubjects, pad, words } from "./common.mjs";

const argv = process.argv.slice(2);
const [id] = words(argv);
const S = loadSubjects(id);
const only = flag(argv, "--only");
const ST = S.stage, Q = S.quality, count = S.count;

// which way each film turns (subjects.mjs wrote it); a subject turning against the clear majority is reversed
const drift = Object.fromEntries(S.subjects.map((s) => {
  const f = join(OUT, id, s.id, "turn.json");
  return [s.id, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).drift : 0];
}));
const vote = Object.values(drift).reduce((a, d) => a + Math.sign(d), 0);
const flipped = (s) => (s.reverse !== undefined ? s.reverse : vote !== 0 && Math.abs(drift[s.id]) >= 2 && Math.sign(drift[s.id]) !== Math.sign(vote));

let missing = 0;
for (const sub of S.subjects) {
  if (only && sub.id !== only) continue;
  const src = join(OUT, id, sub.id, "rgba");
  if (!existsSync(src)) { console.error(`${id}/${sub.id}: no cut-out yet (node subjects.mjs ${id} ${sub.id})`); missing++; continue; }
  const files = readdirSync(src).filter((f) => f.endsWith(".png")).sort();
  let pick = Array.from({ length: count }, (_, k) => files[Math.round((k * files.length) / count) % files.length]);
  const rev = flipped(sub);
  if (rev) pick = [pick[0], ...pick.slice(1).reverse()];

  // where the subject reaches in every frame (alpha over 40), and the union over the whole turn
  const boxes = [];
  for (const f of pick) {
    const { data, info } = await sharp(join(src, f)).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] > 40) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) throw new Error(`${id}/${sub.id}: ${f} is empty (nothing was cut out): look at tools/out/${id}/${sub.id}-cut.jpg`);
    boxes.push({ x0, y0, x1, y1, w: info.width, h: info.height });
  }
  const U = boxes.reduce((u, b) => ({ x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) }), { x0: 1e9, y0: 1e9, x1: -1, y1: -1 });
  // the turning axis: the middle of the subject, averaged over the turn
  const axis = boxes.reduce((s, b) => s + (b.x0 + b.x1) / 2, 0) / boxes.length;
  const extent = ST.fit === "frame" ? boxes[0].h : ST.fit === "width" ? U.x1 - U.x0 : U.y1 - U.y0;
  const lift = (sub.air ?? 0) * ST.h;
  // floating things are centred on their middle; standing things rest on the ground by their lowest point (over the
  // turn, or at the front view with groundFrom "front"), pushed "sink" into the surface they stand on
  const foot = ST.float ? (U.y0 + U.y1) / 2 : ST.groundFrom === "front" ? boxes[0].y1 : U.y1;
  const at = ST.float ? ST.centre : ST.ground;
  // the size asked for, but never bigger than the stage: a subject that would be cut off by its edge is shrunk to fit
  const want = (ST.size / extent) * (sub.scale ?? 1);
  const room = Math.min(ST.axis / Math.max(1, axis - U.x0), (ST.w - ST.axis) / Math.max(1, U.x1 - axis),
    (at - lift) / Math.max(1, foot - U.y0), U.y1 > foot ? (ST.h - at) / (U.y1 - foot) : Infinity);
  const k = want <= room ? want : room * 0.985;
  const ground = foot - (ST.float ? 0 : ((ST.sink ?? 0) * ST.h) / k);

  const out = join(SITE, id, "frames", sub.id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  let bytes = 0;
  const marks = [];
  for (const [i, f] of pick.entries()) {
    const { w, h } = boxes[i];
    const rw = Math.round(w * k), rh = Math.round(h * k);
    const left = Math.round(ST.axis - axis * k), top = Math.round((ST.float ? ST.centre : ST.ground) - ground * k - lift);
    const img = await sharp(join(src, f)).resize(rw, rh, { kernel: "lanczos3" }).toBuffer();
    // placed on the stage canvas, whatever falls outside it cropped
    const cx0 = Math.max(0, -left), cy0 = Math.max(0, -top);
    const cw = Math.min(rw - cx0, ST.w - Math.max(0, left)), ch = Math.min(rh - cy0, ST.h - Math.max(0, top));
    const piece = await sharp(img).extract({ left: cx0, top: cy0, width: cw, height: ch }).toBuffer();
    const buf = await sharp({ create: { width: ST.w, height: ST.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
    const file = join(out, `${pad(i)}.webp`);
    await sharp(buf).webp({ quality: Q, alphaQuality: 90, effort: 5, smartSubsample: true }).toFile(file);
    bytes += readFileSync(file).length;
    // a small grey print of the frame, to measure how much it changes from the last
    marks.push(await sharp(buf).flatten({ background: "#808080" }).resize(64, Math.round((64 * ST.h) / ST.w)).greyscale().raw().toBuffer());
  }
  // how far through the turn each frame is: the change between neighbours, summed and scaled to 0 … 1 (the last frame
  // runs back into the first), a little noise taken off so still stretches count as still
  const diff = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += Math.abs(a[j] - b[j]); return s / a.length; };
  const steps = marks.map((m, i) => diff(m, marks[(i + 1) % marks.length]));
  const floor = [...steps].sort((a, b) => a - b)[Math.floor(steps.length * 0.1)] * 0.5;
  const cum = [0];
  for (const d of steps) cum.push(cum.at(-1) + Math.max(0.02, d - floor));
  const total = cum.at(-1);
  writeFileSync(join(out, "manifest.json"), JSON.stringify({
    count, w: ST.w, h: ST.h, pattern: "{n}.webp", pad: 3, axis: ST.axis, ...(ST.float ? { centre: ST.centre } : { ground: ST.ground }),
    cum: cum.map((c) => Math.round((c / total) * 1e4) / 1e4),
  }));
  console.log(`${id}/${sub.id}: ${count} frames, ${(bytes / 1e6).toFixed(1)} MB, scale ${k.toFixed(3)}${rev ? ", reversed" + (sub.reverse === undefined ? ` (it turns against the others: drift ${drift[sub.id]})` : "") : ""}${k < want ? `  ⚠ shrunk to ${Math.round((k / want) * 100)}% to fit the stage: it is wider or taller than the stage allows (widen the stage, or lower size)` : ""}`);
}
if (missing) process.exitCode = 1;
