#!/usr/bin/env node
/*
 * node new.mjs <name> [--dir folder]
 *
 * Writes <name>.js from the starter: a working figure to edit, never a blank page.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const name = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--dir");
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("usage: node new.mjs <name> [--dir folder]   (name: lowercase, one word or hyphenated)");
  process.exit(2);
}
const dir = args.includes("--dir") ? resolve(args[args.indexOf("--dir") + 1]) : process.cwd();
const out = join(dir, `${name}.js`);
if (existsSync(out)) {
  console.error(`${out} already exists; edit it instead`);
  process.exit(1);
}
const src = readFileSync(join(here, "../templates/starter.js"), "utf8").replaceAll("NAME", name);
writeFileSync(out, src);
console.log(`wrote ${out}\nnext: edit every EDIT, then node ${join(here, "check.mjs")} ${out}`);
