#!/usr/bin/env node
/*
 * node inline.mjs <page.html> [--out page.single.html]
 *
 * Inlines every local <script src> of a page (the engine, the figures) so the page is one
 * file that opens from disk or publishes as an artifact. Remote scripts and fonts are kept.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const page = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
if (!page) {
  console.error("usage: node inline.mjs <page.html> [--out page.single.html]");
  process.exit(2);
}
const dir = dirname(resolve(page));
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : join(dir, basename(page, ".html") + ".single.html");
let n = 0;
const html = readFileSync(page, "utf8").replace(/<script src="([^"]+)"><\/script>/g, (all, src) => {
  if (/^(https?:)?\/\//.test(src)) return all;
  const file = resolve(dir, src);
  if (!existsSync(file)) { console.error(`missing ${src}`); process.exit(1); }
  n++;
  return `<script data-src="${src}">\n${readFileSync(file, "utf8").replace(/<\/script/gi, "<\\/script")}\n</script>`;
});
writeFileSync(out, html);
console.log(`wrote ${out} (${n} scripts inlined)`);
