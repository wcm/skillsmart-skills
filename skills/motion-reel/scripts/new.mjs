#!/usr/bin/env node
/*
 * node new.mjs <name> [--from rewind | zoom | fall | montage | entropy | infinity | gravity] [--dir .]
 *
 * A new reel: <dir>/<name>/reel.js, from a starter (the shape of a reel, with «placeholders» where
 * its own words go) or from one of the finished examples, to learn from or take apart.
 *
 *   rewind    things break down scene by scene, then the reel rewinds to its start: the loop
 *   zoom      every cut dives into the scene before; the last dive lands on the first frame
 *   fall      every cut drops into the next scene; the end card falls away onto the first
 *   montage   a showreel: one technique per scene; the end card's dot opens into the first frame
 *   entropy, infinity, gravity   the three finished examples (their words are theirs: rewrite them)
 *
 * Then:  node <skill>/scripts/check.mjs <name>/reel.js    (the checks, and a contact sheet to look at)
 *        node <skill>/scripts/make.mjs <name>/reel.js     (the page, the soundtrack and the MP4)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { assets, parseArgs } from "./lib.mjs";

const STARTERS = ["rewind", "zoom", "fall", "montage"], EXAMPLES = ["entropy", "infinity", "gravity"];
const a = parseArgs(process.argv.slice(2));
const name = a._[0], from = String(a.from || "montage");
if (!name || !/^[a-z0-9][\w-]*$/i.test(name)) { console.error(`usage: node new.mjs <name> [--from ${[...STARTERS, ...EXAMPLES].join("|")}] [--dir .]`); process.exit(2); }
if (![...STARTERS, ...EXAMPLES].includes(from)) { console.error(`--from ${from}? one of ${[...STARTERS, ...EXAMPLES].join(", ")}`); process.exit(2); }
const dir = join(resolve(a.dir || "."), name), out = join(dir, "reel.js");
if (existsSync(out)) { console.error(`${relative(process.cwd(), out)} exists`); process.exit(1); }
const src = readFileSync(join(assets, STARTERS.includes(from) ? "templates" : "examples", `${from}.js`), "utf8");
mkdirSync(dir, { recursive: true });
writeFileSync(out, src.replace(/name: "[\w-]+"/, `name: "${name}"`));
console.log(relative(process.cwd(), out) || out);
