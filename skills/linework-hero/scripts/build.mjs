#!/usr/bin/env node
/*
 * node build.mjs <figure.js> [--out page.html] [--link]
 *
 * Puts a figure on the bench. By default everything is inlined into one HTML file
 * that opens from disk: linework-<name>.html next to the figure. With --link the page
 * points at engine/ and the figure by relative path instead (for a site that shares them).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, basename, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const engine = resolve(here, "../engine");
const args = process.argv.slice(2);
const fig = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out");
if (!fig) {
  console.error("usage: node build.mjs <figure.js> [--out page.html] [--link]");
  process.exit(2);
}
const src = readFileSync(fig, "utf8");
const name = (src.slice(Math.max(0, src.indexOf("linework({"))).match(/name:\s*["']([\w-]+)["']/) || [, basename(fig, ".js")])[1];
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : join(dirname(fig), `linework-${name}.html`);
const link = args.includes("--link");

const files = ["kernel.js", "linework.js", "system.js", "bench.js"];
let scripts;
if (link) {
  const rel = (p) => relative(dirname(resolve(out)), p).split("\\").join("/");
  scripts = files.map((f) => `<script src="${rel(join(engine, f))}"></script>`).join("\n") + `\n<script src="${rel(resolve(fig))}"></script>`;
} else {
  const inline = (code, id) => `<script id="${id}">\n${code.replace(/<\/script/gi, "<\\/script")}\n</script>`;
  scripts = files.map((f) => inline(readFileSync(join(engine, f), "utf8"), "lw-" + f.replace(".js", ""))).join("\n") + "\n" + inline(src, "lw-figure");
}
const page = readFileSync(join(engine, "page.html"), "utf8").replace("<!--LW:SCRIPTS-->", () => scripts).replace("<title>Linework</title>", `<title>Linework · ${name}</title>`);
writeFileSync(out, page);
console.log(`wrote ${out}`);
