#!/usr/bin/env node
/*
 * node preview.mjs <reel.js> [--port 5190] [--format 9x16|4x5|1x1|16x9]
 *
 * Serves the engine and the reel's folder and prints the preview URL: play, scrub, jump between
 * beats ([ and ]), switch look and palette live, toggle Instagram's safe zones. Edit the reel and
 * reload to see the change. Ctrl-C to stop.
 */
import { existsSync } from "node:fs";
import { serve } from "./browser.mjs";

const args = process.argv.slice(2);
const reel = args[0];
if (!reel || !existsSync(reel)) { console.error("usage: node preview.mjs <reel.js> [--port 5190]"); process.exit(2); }
const i = args.indexOf("--port");
const f = args.indexOf("--format");
const srv = await serve(reel, i >= 0 ? +args[i + 1] : 5190);
console.log(`preview: ${srv.url(f >= 0 ? `&format=${args[f + 1]}` : "")}`);
