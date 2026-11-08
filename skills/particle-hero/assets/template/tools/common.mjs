// What the Particle Hero tools share: the project's folders, a page's picture list, a cache folder and the prices.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const OUT = join(TOOLS, "out");
export const SITE = join(TOOLS, "..", "site");
export const SKILL = "particle-hero";
export const CREDITS = { picture: 20, cutout: 2 };

/** a page's picture list: tools/pictures/<id>.json */
export function loadPictures(id) {
  const file = join(TOOLS, "pictures", `${id}.json`);
  if (!id || !existsSync(file)) {
    const have = existsSync(join(TOOLS, "pictures")) ? readdirSync(join(TOOLS, "pictures")).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(/\.json$/, "")) : [];
    console.error(`pages: ${have.join(", ") || "none yet"} (tools/pictures/<id>.json)`);
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(join(OUT, id), { recursive: true });
  return spec;
}

/** keeps an earlier version as name.bak-N.ext */
export function keepOld(dest) {
  if (!existsSync(dest)) return;
  const m = dest.match(/^(.*?)(\.[^.]+)$/);
  let n = 1;
  while (existsSync(`${m[1]}.bak-${n}${m[2]}`)) n++;
  renameSync(dest, `${m[1]}.bak-${n}${m[2]}`);
}

/** a per-user cache folder shared by every Particle Hero project (the depth model and its runtime live there) */
export function cacheDir(name = "particle-hero") {
  const base = platform() === "darwin" ? join(homedir(), "Library/Caches") : platform() === "win32" ? (process.env.LOCALAPPDATA || homedir()) : join(homedir(), ".cache");
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** an npm package installed once into the cache folder (never into the project), or null if that fails */
export function cachedPackage(pkg, version) {
  const dir = cacheDir();
  if (!existsSync(join(dir, "node_modules", pkg))) {
    console.log(`installing ${pkg} into ${dir} (once)…`);
    try { execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", dir, `${pkg}@${version}`], { stdio: "inherit", shell: platform() === "win32" }); }
    catch { return null; }
  }
  return createRequire(join(dir, "index.js"))(pkg);
}
