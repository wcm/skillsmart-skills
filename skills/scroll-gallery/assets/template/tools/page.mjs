// A page's page.json, read and written in the one layout every page keeps: one line per top-level key, and one line per
// scene and per picture, so a page reads (and diffs) scene by scene.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
export const pageFile = (id) => join(SITE, id, "page.json");
export const readPage = (id) => JSON.parse(readFileSync(pageFile(id), "utf8"));

const inline = (v) => Array.isArray(v) ? `[${v.map(inline).join(", ")}]`
  : v && typeof v === "object" ? `{${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")}}`
  : JSON.stringify(v);
export const format = (page) => `{\n${Object.entries(page).filter(([, v]) => v !== undefined).map(([k, v]) => `  ${JSON.stringify(k)}: ${
  Array.isArray(v) && (k === "sequence" || k === "items") ? `[\n${v.map((x) => `    ${inline(x)}`).join(",\n")}\n  ]` : inline(v)}`).join(",\n")}\n}\n`;
export const writePage = (id, page) => writeFileSync(pageFile(id), format(page));
