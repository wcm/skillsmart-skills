// The gallery's pictures, generated with Skillsmart credits: one picture per item in site/<id>/page.json, from the
// item's prompt and the page's shared style line, at the item's aspect, 2K.
//
//   node pictures.mjs <id>                    every picture the page doesn't have yet
//   node pictures.mjs <id> --only 04,17       make these again (the old master is kept as <item>.bak-N.png)
//   node pictures.mjs <id> --fix "…"          one more line added to every prompt in this run
//   node pictures.mjs <id> --cost             what it would cost, and stop
//
// 20 credits a picture; failed generations aren't charged. Masters go to tools/out/<id>/<item>.png; then run
// build.mjs to make the web images. With FAL_KEY set (an env var only), your own fal.ai key is used instead of credits.
// A picture the page already shows (a master here, or site/<id>/img/<item>.webp) counts as made: replace it with --only.
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./gen.mjs";
import { SITE, pageFile, readPage, writePage } from "./page.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const only = flag("--only")?.split(","), fix = flag("--fix");
if (!id || !existsSync(pageFile(id))) { console.error("usage: node pictures.mjs <id> [--only 04,17] [--fix \"…\"] [--cost]   (needs site/<id>/page.json)"); process.exit(1); }
const page = readPage(id), OUT = join(ROOT, "out", id);
mkdirSync(OUT, { recursive: true });

const PRICE = 20, AT_ONCE = 4;
const made = (it) => existsSync(join(OUT, `${it.id}.png`)) || existsSync(join(SITE, id, "img", `${it.id}.webp`));
const unknown = only?.filter((k) => !page.items.some((it) => it.id === k)) || [];
if (unknown.length) { console.error(`no item ${unknown.join(", ")} in site/${id}/page.json`); process.exit(1); }
const todo = page.items.filter((it) => (only ? only.includes(it.id) : !made(it)));
const unwritten = todo.filter((it) => !it.prompt || /^WRITE/.test(it.prompt));
if (unwritten.length) { console.error(`write the prompts first (items ${unwritten.map((it) => it.id).join(", ")} in site/${id}/page.json)`); process.exit(1); }
if (todo.length && /^WRITE/.test(page.style || "")) { console.error(`write the shared style line first ("style" in site/${id}/page.json)`); process.exit(1); }
console.log(`${todo.length} picture${todo.length === 1 ? "" : "s"} to make: ${todo.length * PRICE} credits`);
if (argv.includes("--cost") || !todo.length) process.exit(0);

// an older master is kept beside the new one
const keep = (dest) => {
  if (!existsSync(dest)) return;
  let n = 1;
  while (existsSync(dest.replace(".png", `.bak-${n}.png`))) n++;
  renameSync(dest, dest.replace(".png", `.bak-${n}.png`));
};
let next = 0, failed = 0, done = 0;
async function worker() {
  while (next < todo.length) {
    const it = todo[next++], dest = join(OUT, `${it.id}.png`);
    const prompt = `${it.prompt} ${page.style || ""}${fix ? ` ${fix}` : ""}`.trim();
    try {
      const fresh = dest.replace(".png", ".new.png");
      await generate("nano-banana-pro", { prompt, aspect_ratio: it.aspect || "4:5", resolution: "2K", output_format: "png" }, { skill: "scroll-gallery", out: fresh, label: `${id}/${it.id}` });
      keep(dest); renameSync(fresh, dest);
      delete it.trim; delete it.crop;   // a trim or crop was for the old picture
      done++;
    } catch (e) {
      failed++;
      if (e.exitCode === 3 || e.exitCode === 5) { next = todo.length; throw e; }   // out of credits or a limit: stop here
      console.error(`[${id}/${it.id}] failed: ${e.message}`);
    }
  }
}
try { await Promise.all(Array.from({ length: AT_ONCE }, worker)); }
finally { if (done) writePage(id, page); }
console.log(failed ? `${failed} failed: run the same command again to retry them (made ones are kept)` : `done: now node build.mjs ${id}`);
