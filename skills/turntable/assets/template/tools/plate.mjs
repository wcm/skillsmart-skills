// Puts a plate or bowl back into a dish's cut-out. The cut-out keeps the food but often loses a white plate, or leaves
// it half see-through: to the cut-out model the plate is part of the background. sam-3-video finds the plate in every
// frame of the turn; each frame's plate becomes a solid convex shape (plates and bowls are convex), pulled in from the
// rim so no backdrop shows, and joins the food. subjects.mjs does this by itself for subjects with "plate" set (the
// page's "plate", or a subject's own); run this to try again with another word.
//
//   node plate.mjs <id> <name> --dry           what it costs: 8 credits (2 a second of the 4-second turn)
//   node plate.mjs <id> <name> [--keep "white bowl"] [--shrink 2.5]
//   then: node frames.mjs <id> --only <name>
//
// Light plates and bowls work best: the plate comes back on black, so a dark plate is hard to find. The cut-out's own
// mask stays in tools/out/<id>/<name>/mask-cut/.
import { existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { OUT, SKILL, flag, loadSubjects, words } from "./common.mjs";
import { putPlate } from "./mask.mjs";

const argv = process.argv.slice(2);
const [id, name] = words(argv, ["--dry"]);
const S = loadSubjects(id);
const sub = S.subjects.find((s) => s.id === name);
if (!sub) { console.error(`usage: node plate.mjs <id> <name> (a subject of tools/subjects/${id}.json)`); process.exit(1); }
const keep = flag(argv, "--keep", sub.plate ?? S.plate ?? "plate"), shrink = Number(flag(argv, "--shrink", 2.5));
const dir = join(OUT, id, name);
if (!existsSync(join(dir, "turn.mp4")) || !existsSync(join(dir, "mask"))) { console.error(`no cut-out yet: node subjects.mjs ${id} ${name}`); process.exit(1); }
// a new word means a new search
const film = join(dir, "sam-plate.mp4");
if (argv.includes("--keep") && existsSync(film)) rmSync(film);
const seconds = Math.max(1, Math.round(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(dir, "turn.mp4")]).toString())));
console.log(`${id}/${name}: find the ${keep} in the ${seconds} s turn: ${existsSync(film) ? "found already, putting it back" : `about ${seconds * 2} credits`}`);
if (argv.includes("--dry")) process.exit(0);
const r = await putPlate({ dir, keep, shrink, skill: SKILL, label: `${id}/${name} ${keep}` });
if (r.empty) console.log(`⚠ no ${keep} found in ${r.empty} of ${r.frames} frames: try --keep with another word ("bowl", "white plate", "platter")`);
console.log(`→ ${r.frames} frames with the ${keep} put back. Then: node frames.mjs ${id} --only ${name}`);
