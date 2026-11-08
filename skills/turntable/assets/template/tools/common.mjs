// Paths, arguments and the subjects file, shared by the tools.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const SITE = resolve(TOOLS, "..", "site");
export const OUT = join(TOOLS, "out");
export const SKILL = "turntable";

/** the value after --name in argv, or d */
export const flag = (argv, name, d) => { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };

/** the words of argv that are neither flags nor their values; `bare` lists the flags that take no value */
export function words(argv, bare = []) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { if (!bare.includes(argv[i])) i++; continue; }
    out.push(argv[i]);
  }
  return out;
}

export const pad = (i) => String(i + 1).padStart(3, "0");

// What a subjects file must hold. Each subject is a "prompt" (generated), a "photo" (the user's own picture), or a
// "prompt" with "from" (an edit of another subject's photo: the same model in a new look, the same set).
const STAGE_KEYS = ["w", "h", "axis", "fit", "size"];

/** tools/subjects/<id>.json, checked: { aspect, shot, turn | turns, cut, stage, count, quality, subjects: [...] } */
export function loadSubjects(id) {
  if (!id) { console.error("which page? e.g. node subjects.mjs shoes"); process.exit(1); }
  const file = join(TOOLS, "subjects", `${id}.json`);
  if (!existsSync(file)) { console.error(`no tools/subjects/${id}.json`); process.exit(1); }
  let S;
  try { S = JSON.parse(readFileSync(file, "utf8")); } catch (e) { console.error(`tools/subjects/${id}.json: ${e.message}`); process.exit(1); }
  const bad = [];
  if (!Array.isArray(S.subjects) || !S.subjects.length) bad.push("subjects: a list of at least one subject");
  if (!S.stage || STAGE_KEYS.some((k) => S.stage[k] == null)) bad.push(`stage: needs ${STAGE_KEYS.join(", ")}, and ground (or "float": true with centre)`);
  else if (S.stage.float ? S.stage.centre == null : S.stage.ground == null) bad.push(`stage: ${S.stage.float ? "centre" : "ground"} is missing`);
  if (!["height", "width", "frame"].includes(S.stage?.fit)) bad.push('stage.fit: "height", "width" or "frame"');
  const ids = new Set();
  for (const [i, s] of (S.subjects ?? []).entries()) {
    const at = `subjects[${i}]${s.id ? ` (${s.id})` : ""}`;
    if (!s.id || !/^[a-z0-9][a-z0-9-]*$/.test(s.id)) bad.push(`${at}: id must be lowercase letters, digits and hyphens`);
    if (ids.has(s.id)) bad.push(`${at}: the id is used twice`);
    ids.add(s.id);
    if (!s.prompt && !s.photo) bad.push(`${at}: needs a prompt or a photo`);
    if (s.photo && !existsSync(resolve(TOOLS, s.photo))) bad.push(`${at}: photo ${s.photo} not found (paths are relative to tools/)`);
    if (s.from && !S.subjects.some((o) => o.id === s.from)) bad.push(`${at}: from "${s.from}" is not a subject of this page`);
    if (s.from && S.subjects.findIndex((o) => o.id === s.from) > i) bad.push(`${at}: from "${s.from}" must come before it in the list`);
    if (s.turn && !(S.turns ?? {})[s.turn]) bad.push(`${at}: turn "${s.turn}" is not in turns`);
    if (/\bWRITE\b/.test(s.prompt ?? "")) bad.push(`${at}: the prompt still has words to WRITE`);
  }
  if (!S.turn && !S.turns) bad.push("turn: the turntable prompt (or turns: { name: prompt } and a turn on each subject)");
  if (S.subjects?.some((s) => !s.photo || s.restage) && !S.shot) bad.push("shot: the photo prompt, with {subject} where each subject's prompt goes");
  if (/\bWRITE\b/.test(`${S.shot ?? ""} ${S.turn ?? ""}`)) bad.push("shot / turn: still have words to WRITE");
  if (bad.length) { console.error(`tools/subjects/${id}.json:\n- ${bad.join("\n- ")}`); process.exit(1); }
  return { aspect: "3:4", cut: "heavy", count: 72, quality: 76, seconds: 10, ...S };
}

/** the turntable prompt for one subject */
export const turnPrompt = (S, sub) => (sub.turn ? S.turns[sub.turn] : S.turn ?? Object.values(S.turns)[0]);
