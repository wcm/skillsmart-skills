#!/usr/bin/env node
/*
 * node build.mjs <reel.js> [--out <reel>.html] [--link]
 *
 * The reel as a page that plays it on a loop: one self-contained file (fonts, engine, scenes,
 * the reel and the player inlined), or with --link one that points at the engine's files.
 */
import { dirname, join, resolve } from "node:path";
import { buildPage, parseArgs, reelName } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2), ["link"]);
if (!a._[0]) { console.error("usage: node build.mjs <reel.js> [--out page.html] [--link]"); process.exit(2); }
const reel = resolve(a._[0]);
const out = resolve(a.out || join(dirname(reel), `${reelName(reel)}.html`));
buildPage(reel, out, { link: !!a.link });
console.log(out);
