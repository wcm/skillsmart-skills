// Makes a page's subjects, start to finish, through the user's Skillsmart credits (or FAL_KEY):
//   1. photo     nano-banana-pro: the subject alone, front view, on a plain backdrop (or the user's own photo, or an
//                edit of another subject's photo, so one model keeps her face across looks)
//   2. turn      h3-max-turbo: a 10 s film that starts and ends on that photo, so the subject makes one full turn
//   3. cut-out   96 frames over exactly one turn (the film's end hold trimmed), masked by birefnet-video
//   4. plate     for dishes ("plate": "plate" or "bowl", on the page or a subject): sam-3-video finds the plate in the
//                turn and puts it back into the cut-out, which tends to lose white plates
// Steps already done are skipped, so a re-run only makes what's missing.
//
//   node subjects.mjs <id> --dry                what it would make and what it costs, in credits
//   node subjects.mjs <id>                      every subject in tools/subjects/<id>.json, three at a time
//   node subjects.mjs <id> bronze glass         just these
//   node subjects.mjs <id> bronze --redo photo  make it again from the photo (or --redo turn: keep the photo; --redo cut)
//   node subjects.mjs <id> bronze --redo turn --fix "the back is covered by drapery"   a sentence added to that prompt
//
// Writes tools/out/<id>/<name>.png (photo), <name>.mp4 (turn), <name>-sheet.jpg (the turn at 8 moments),
// <name>/rgba/001.png … (the cut-out turn), <name>/turn.json (which way it turns) and <name>-cut.jpg (8 cut-out frames on
// two colours). Then: node frames.mjs <id>
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { OUT, SKILL, TOOLS, flag, loadSubjects, pad, turnPrompt, words } from "./common.mjs";
import { file, generate } from "./gen.mjs";
import { putPlate } from "./mask.mjs";

const argv = process.argv.slice(2);
const [id, ...names] = words(argv, ["--dry"]);
const S = loadSubjects(id);
const dry = argv.includes("--dry");
const redo = flag(argv, "--redo");
const fix = flag(argv, "--fix");
const max = Number(flag(argv, "--max", 3));
const N = 96; // frames cut out over one turn (frames.mjs picks the page's count from them)
if (redo && !["photo", "turn", "cut"].includes(redo)) { console.error("--redo photo, turn or cut"); process.exit(1); }
if ((redo || fix) && !names.length) { console.error("--redo and --fix need the subjects to redo by name"); process.exit(1); }
const unknown = names.filter((n) => !S.subjects.some((s) => s.id === n));
if (unknown.length) { console.error(`not in tools/subjects/${id}.json: ${unknown.join(", ")}`); process.exit(1); }
const list = S.subjects.filter((s) => !names.length || names.includes(s.id));
const dir = join(OUT, id);
mkdirSync(dir, { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 28 });
const PRICE = { photo: 20, turn: 11 * S.seconds, cut: 2 * Math.round(N / 24), plate: 2 * Math.round(N / 24) };
// the word for a subject's plate or bowl ("plate", "bowl"): it is found in the turn and put back into the cut-out
const plateOf = (sub) => sub.plate ?? S.plate;

// what each subject still needs; --redo moves the old results aside (tools/out/<id>/old/) and starts again from there
function needs(sub) {
  const base = join(dir, sub.id);
  const from = redo && names.includes(sub.id) ? ["photo", "turn", "cut"].indexOf(redo) : 3;
  const has = {
    photo: existsSync(`${base}.png`) && from > 0,
    turn: existsSync(`${base}.mp4`) && from > 1,
    cut: existsSync(join(base, "rgba", pad(N - 1) + ".png")) && from > 2,
    plate: !plateOf(sub) || (existsSync(join(base, "mask-cut")) && existsSync(join(base, "sam-plate.mp4")) && from > 2),
  };
  return ["photo", "turn", "cut", "plate"].filter((s) => !has[s]);
}
const paid = (sub, step, steps) => step === "photo" ? (sub.photo && !sub.restage ? 0 : PRICE.photo)
  : step === "plate" ? (existsSync(join(dir, sub.id, "sam-plate.mp4")) && !steps.includes("turn") ? 0 : PRICE.plate) : PRICE[step];
const todo = list.map((sub) => ({ sub, steps: needs(sub) }));
const credits = todo.reduce((a, t) => a + t.steps.reduce((b, s) => b + paid(t.sub, s, t.steps), 0), 0);
for (const t of todo) console.log(`${id}/${t.sub.id}: ${t.steps.length ? t.steps.map((s) => `${s}${paid(t.sub, s, t.steps) ? ` ${paid(t.sub, s, t.steps)}` : " (free)"}`).join(", ") : "done"}`);
console.log(`→ ${todo.filter((t) => t.steps.length).length} subject(s) to make, about ${credits} credits${process.env.FAL_KEY ? " (on your fal.ai key instead: no credits)" : ""}`);
if (dry || todo.every((t) => !t.steps.length)) process.exit(0);

function aside(f) {
  if (!existsSync(f)) return;
  mkdirSync(join(dir, "old"), { recursive: true });
  const name = f.split("/").pop(), stamp = new Date().toISOString().slice(5, 19).replace(/[-:T]/g, "");
  renameSync(f, join(dir, "old", name.replace(/(\.\w+)?$/, `-${stamp}$1`)));
}

// ——— 1. the photo ———
async function photo(sub, base) {
  const label = `${id}/${sub.id} photo`;
  const extra = fix && names.includes(sub.id) && redo === "photo" ? ` ${fix}` : "";
  if (sub.photo && !sub.restage) {
    await sharp(resolve(TOOLS, sub.photo)).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toFile(`${base}.png`);
    return console.log(`[${label}] ✓ from ${sub.photo}`);
  }
  if (sub.photo) {
    // the user's own picture, put on the page's backdrop and framing, the subject itself unchanged
    const what = `the exact ${sub.prompt ?? "subject"} in the reference picture, unchanged: the same shape, colours, materials and details`;
    return generate("nano-banana-pro", { prompt: S.shot.replace("{subject}", what) + extra, images: [file(resolve(TOOLS, sub.photo))], aspect_ratio: S.aspect, resolution: "2K" }, { skill: SKILL, out: `${base}.png`, label });
  }
  if (sub.from) {
    // an edit of another subject's photo: the prompt says what changes and what stays
    return generate("nano-banana-pro", { prompt: sub.prompt + extra, images: [file(join(dir, `${sub.from}.png`))], aspect_ratio: S.aspect, resolution: "2K" }, { skill: SKILL, out: `${base}.png`, label });
  }
  return generate("nano-banana-pro", { prompt: S.shot.replace("{subject}", sub.prompt) + extra, aspect_ratio: S.aspect, resolution: "2K" }, { skill: SKILL, out: `${base}.png`, label });
}

// ——— 2. the turn: a film that starts and ends on the photo ———
async function turn(sub, base) {
  // H3 takes 1080p at most: the photo as a JPEG whose long side is 1920 (portrait photos make portrait films)
  const start = `${base}-start.jpg`;
  await sharp(`${base}.png`).resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 93 }).toFile(start);
  const extra = fix && names.includes(sub.id) && redo === "turn" ? ` ${fix}` : "";
  await generate("h3-max-turbo", { prompt: turnPrompt(S, sub) + extra, start_image: file(start), end_image: file(start), duration: S.seconds }, { skill: SKILL, out: `${base}.mp4`, label: `${id}/${sub.id} turn` });
  await sheet(`${base}.mp4`);
}

/** eight moments of a film, four to a row, each with its time → <film>-sheet.jpg */
async function sheet(film, count = 8) {
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", film]).toString().trim());
  const pts = Array.from({ length: count }, (_, i) => (i / (count - 1)) * Math.max(0, dur - 0.08));
  const W = 480, cols = 4, gap = 6;
  const cells = pts.map((t) => execFileSync("ffmpeg", ["-loglevel", "error", "-ss", t.toFixed(3), "-i", film, "-frames:v", "1", "-vf", `scale=${W}:-2`, "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 1 << 26 }));
  const H = (await sharp(cells[0]).metadata()).height, rows = Math.ceil(count / cols);
  const label = (t) => Buffer.from(`<svg width="100" height="30"><rect width="100" height="30" rx="5" fill="#000" opacity=".65"/><text x="10" y="21" font-family="Helvetica" font-size="17" fill="#fff">${t.toFixed(2)} s</text></svg>`);
  await sharp({ create: { width: cols * W + (cols - 1) * gap, height: rows * H + (rows - 1) * gap, channels: 3, background: "#000" } })
    .composite(cells.flatMap((c, i) => [{ input: c, left: (i % cols) * (W + gap), top: Math.floor(i / cols) * (H + gap) }, { input: label(pts[i]), left: (i % cols) * (W + gap) + 6, top: Math.floor(i / cols) * (H + gap) + 6 }]))
    .jpeg({ quality: 82 }).toFile(film.replace(/\.mp4$/, "-sheet.jpg"));
}

// ——— 3. the cut-out turn ———
async function cutout(sub, base) {
  const film = `${base}.mp4`, out = base;
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames,width,height", "-of", "json", film]).toString()).streams[0];
  const W = probe.width, H = probe.height, total = Number(probe.nb_read_frames);
  // every frame small and grey (160 px wide, so small details like a handle or a chip count), to find where the turn
  // comes back to the start
  const tw = 160, th = Math.round((160 * H) / W);
  const raw = ff(["-i", film, "-vf", `scale=${tw}:${th},format=gray`, "-f", "rawvideo", "-"]);
  const small = (i) => raw.subarray(i * tw * th, (i + 1) * tw * th);
  const diff = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]); return s / a.length; };
  // The films ease out and hold still for a moment at the end. The turn is complete at the first late frame that is
  // nearly as close to frame 0 as the closest one (within 8% of the way from there to the far side of the turn)
  const d0 = Array.from({ length: total }, (_, i) => diff(small(0), small(i)));
  const from = Math.floor(total * 0.6), late = d0.slice(from);
  const best = Math.min(...late), far = Math.max(...d0);
  const end = from + late.findIndex((d) => d <= best + 0.08 * (far - best));
  // a real turn shows another side halfway through; a film that only rocks back and forth doesn't, and neither does a
  // plain round subject (its turn can't be seen)
  const halfway = diff(small(0), small(Math.round(end / 2)));
  // sampled evenly in time over the turn: any easing in the film stays in the turn
  const picks = Array.from({ length: N }, (_, k) => Math.round((k * end) / N));
  for (const d of ["src", "rgba", "mask", "_sel"]) { rmSync(join(out, d), { recursive: true, force: true }); mkdirSync(join(out, d), { recursive: true }); }
  ff(["-i", film, "-vf", `select='${picks.map((i) => `eq(n\\,${i})`).join("+")}'`, "-fps_mode", "passthrough", join(out, "_sel", "%03d.png")]);
  const sorted = [...new Set(picks)].sort((a, b) => a - b), got = readdirSync(join(out, "_sel")).sort();
  if (got.length !== sorted.length) throw new Error(`picked ${got.length} frames, wanted ${sorted.length}`);
  const byFilm = new Map(sorted.map((i, k) => [i, join(out, "_sel", got[k])]));
  picks.forEach((i, k) => copyFileSync(byFilm.get(i), join(out, "src", `${pad(k)}.png`)));
  rmSync(join(out, "_sel"), { recursive: true, force: true });

  // the sampled frames as one short film (4 s) for the cut-out model; its mask film comes back as frames
  const short = join(out, "turn.mp4"), maskFilm = join(out, "turn-mask.mp4");
  ff(["-framerate", "24", "-i", join(out, "src", "%03d.png"), "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", short]);
  await generate("birefnet-video", { video: file(short), variant: sub.cut ?? S.cut, resolution: "2K" }, { skill: SKILL, out: maskFilm, label: `${id}/${sub.id} cut-out` });
  ff(["-i", maskFilm, "-vf", `scale=${W}:${H}:flags=lanczos,format=gray`, "-fps_mode", "passthrough", join(out, "mask", "%03d.png")]);
  const masks = readdirSync(join(out, "mask")).filter((f) => f.endsWith(".png")).sort();
  if (masks.length < N) throw new Error(`the mask film has ${masks.length} frames, wanted ${N}`);
  for (let k = 0; k < N; k++) {
    // faint alpha snapped to 0, so no haze stays round the subject
    const a = await sharp(join(out, "mask", masks[k])).extractChannel(0).linear(1.06, -6).raw().toBuffer({ resolveWithObject: true });
    await sharp(join(out, "src", `${pad(k)}.png`)).joinChannel(a.data, { raw: a.info }).png().toFile(join(out, "rgba", `${pad(k)}.png`));
  }
  const drift = await direction(out);
  writeFileSync(join(out, "turn.json"), JSON.stringify({ end, total, halfway: +halfway.toFixed(2), drift }));
  await cutSheet(out, W, H);
  return { end, total, halfway, drift };
}

// which way a turn goes: the sideways slide of the subject's middle between nearby frames, added up early in the turn
// (positive: its front surface moves right)
async function direction(out) {
  const grey = async (k) => sharp(join(out, "src", `${pad(k)}.png`)).resize(240).greyscale().raw().toBuffer({ resolveWithObject: true });
  let total = 0;
  for (let k = 7; k <= 39; k += 4) {
    const a = await grey(k), b = await grey(k + 2), { width: w, height: h } = a.info;
    let best = 0, bestErr = Infinity;
    for (let dx = -20; dx <= 20; dx++) {
      let e = 0, n = 0;
      for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 2) for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) { e += Math.abs(a.data[y * w + x] - b.data[y * w + x + dx]); n++; }
      if (e / n < bestErr) { bestErr = e / n; best = dx; }
    }
    total += best;
  }
  return total;
}

// eight cut-out frames an eighth of a turn apart, on two colours so the edges show
async function cutSheet(out, W, H) {
  const cw = 300, ch = Math.round((cw * H) / W);
  const cells = await Promise.all(Array.from({ length: 8 }, async (_, j) => {
    const fg = await sharp(join(out, "rgba", `${pad(Math.round((j * N) / 8))}.png`)).resize(cw, ch).toBuffer();
    return sharp({ create: { width: cw, height: ch, channels: 3, background: j % 2 ? "#c9634a" : "#3f6f8f" } }).composite([{ input: fg }]).png().toBuffer();
  }));
  await sharp({ create: { width: cw * 8 + 7 * 6, height: ch, channels: 3, background: "#000" } })
    .composite(cells.map((c, j) => ({ input: c, left: j * (cw + 6), top: 0 }))).jpeg({ quality: 85 }).toFile(`${out}-cut.jpg`);
}

// a subject made "from" another waits for that one's photo
const photoDone = new Map(todo.map((t) => { let done; const p = new Promise((r) => (done = r)); return [t.sub.id, { p, done }]; }));

async function make({ sub, steps }) {
  const base = join(dir, sub.id), t0 = Date.now();
  try { await makeSteps(sub, steps, base, t0); } finally { photoDone.get(sub.id)?.done(); }
}

async function makeSteps(sub, steps, base, t0) {
  const say = (s) => console.log(`[${id}/${sub.id}] ${s} (${Math.round((Date.now() - t0) / 1000)} s)`);
  // a redo starts clean from its step
  if (steps.includes("photo")) { aside(`${base}.png`); aside(`${base}.mp4`); }
  else if (steps.includes("turn")) aside(`${base}.mp4`);
  // a new film needs its plate found again; a new cut-out keeps the film's plate but gives the food mask anew
  if (steps.includes("turn")) rmSync(join(base, "sam-plate.mp4"), { force: true });
  if (steps.includes("cut")) rmSync(join(base, "mask-cut"), { recursive: true, force: true });
  if (steps.includes("photo")) {
    if (sub.from) {
      await photoDone.get(sub.from)?.p;
      if (!existsSync(join(dir, `${sub.from}.png`))) throw new Error(`it is an edit of ${sub.from}, whose photo isn't made`);
    }
    await photo(sub, base);
    say("photo");
  }
  photoDone.get(sub.id)?.done();
  if (steps.includes("turn")) { await turn(sub, base); say(`turn → ${sub.id}-sheet.jpg`); }
  if (steps.includes("cut")) {
    const r = await cutout(sub, base);
    say(`cut out → ${sub.id}-cut.jpg · turn back at film frame ${r.end} of ${r.total} · ${r.drift > 0 ? "front moves right →" : "← front moves left"} (${r.drift})`);
    if (r.halfway < 4) console.log(`   ⚠ ${sub.id} looks almost the same halfway round (${r.halfway.toFixed(1)}). Either the film rocks instead of turning (redo with --redo turn), or the subject is plain and round, so its turn can't be seen: give it something that shows the turn (a handle, a pattern, a detail on one side). Look at ${sub.id}-sheet.jpg`);
  }
  if (steps.includes("plate")) {
    const r = await putPlate({ dir: base, keep: plateOf(sub), skill: SKILL, label: `${id}/${sub.id} ${plateOf(sub)}` });
    const { width, height } = await sharp(join(base, "src", pad(0) + ".png")).metadata();
    await cutSheet(base, width, height);
    say(`${plateOf(sub)} put back → ${sub.id}-cut.jpg${r.empty ? `  ⚠ none found in ${r.empty} of ${r.frames} frames: try another word ("bowl", "platter")` : ""}`);
  }
}

const queue = todo.filter((t) => t.steps.length);
const failed = [];
await Promise.all(Array.from({ length: Math.min(max, queue.length) }, async () => {
  while (queue.length) {
    const t = queue.shift();
    try { await make(t); } catch (e) { failed.push(t.sub.id); console.error(`[${id}/${t.sub.id}] failed: ${e.message}`); if (e.exitCode === 3 || e.exitCode === 5) { queue.length = 0; } }
  }
}));
if (failed.length) { console.error(`\nnot made: ${failed.join(", ")}. Run the same command again: what's made is kept.`); process.exitCode ||= 1; }
else console.log(`\nLook at tools/out/${id}/*-sheet.jpg (each film turns once, all the way round, and keeps its shape) and *-cut.jpg (clean edges, nothing missing). Then: node frames.mjs ${id}`);
