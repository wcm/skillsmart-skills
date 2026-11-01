// What the Build Hero tools share: the project's folders, a page's scene file and the prompt parts.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const OUT = join(TOOLS, "out");
export const SITE = join(TOOLS, "..", "site");
export const SKILL = "build-hero";
export const PROMPTS = JSON.parse(readFileSync(join(TOOLS, "prompts.json"), "utf8"));
export const SIZE = { width: 2560, height: 1440 };     // every picture, whatever the model returns
export const CREDITS = { picture: 20, filmSecond: 15 };

// a page's scene file: tools/scenes/<id>.json
export function loadScene(id) {
  const file = join(TOOLS, "scenes", `${id}.json`);
  if (!id || !existsSync(file)) {
    const have = existsSync(join(TOOLS, "scenes")) ? readdirSync(join(TOOLS, "scenes")).filter((f) => !f.startsWith("_")).map((f) => f.replace(/\.json$/, "")) : [];
    console.error(`pages: ${have.join(", ") || "none yet"}`);
    process.exit(1);
  }
  const scene = JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(join(OUT, id), { recursive: true });
  return scene;
}

// keeps earlier versions as name.bak-N.ext
export function keepOld(dest) {
  if (!existsSync(dest)) return;
  const dot = dest.lastIndexOf(".");
  let n = 1;
  while (existsSync(`${dest.slice(0, dot)}.bak-${n}${dest.slice(dot)}`)) n++;
  renameSync(dest, `${dest.slice(0, dot)}.bak-${n}${dest.slice(dot)}`);
}

export function needFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
  catch { console.error("needs ffmpeg: brew install ffmpeg (macOS), winget install ffmpeg (Windows) or your package manager"); process.exit(2); }
}
