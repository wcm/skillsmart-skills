// tour.json (design-system.md 8.2): the schema, a validator that warns instead of crashing, and the defaults.
//
// validate(data) logs one console warning per problem ("[tour] tour.json: unknown field theme.foo (ignored)", "missing
// field …, using …", "… should be a number") and returns the list of messages. normalize(data) returns a copy with every
// default filled in, so the engine never has to guess. Fields that build steps 5–9 use (hotspots, tags, cards, artworks,
// map, cuts, beats) are in the schema already, so they never warn.
//
// Spec language: "string" | "number" | "boolean" | "any" (a trailing "?" allows null), { $enum }, { $arr }, { $map },
// { $or }, { $dev } (one value or { desktop, phone }), a plain object of fields ($req: required keys, $open: extra keys
// are fine, $null: null is fine).

import { warn } from "./util.js";

const box = { $arr: "number", $len: 4 };
const pos = { $arr: "number", $len: 2 };
const key = { $arr: "number", $len: 3 };        // [t, x, y]
const devBox = { $dev: box, $null: true };
const strnum = { $or: ["string", "number"] };
const action = "string?";                        // end | end#<anchor> | stop:<id> | hide

const hotspot = {
  $req: ["id", "at"],
  id: "string", at: pos, label: "string?", code: "string?", card: "string?", price: "string?", pill: "string?",
  state: { $enum: ["planned", "built"], $null: true }, side: { $enum: ["left", "right", "auto"], $null: true },
  keys: { $arr: key, $null: true }, enterAt: { $or: ["number", "string"], $null: true },
  plateOn: { $enum: ["always", "hover"], $null: true }, leader: "boolean?", icon: { $enum: ["dot", "plus"], $null: true },
  plate: { $enum: ["pill", "tag", "none", "wall"], $null: true }, text: "string?", work: "string?",
  turn: { $null: true, at: { $or: ["number", "string"] }, state: { $enum: ["planned", "built"] } },
};

const caption = {
  $null: true,
  heading: "string?", body: "string?", label: "string?",
  row: { $arr: { $or: [{ $arr: "string" }, { label: "string", value: "string" }, "string"] }, $null: true },
  price: { $or: ["string", { pre: "string?", amount: "string?", unit: "string?", note: "string?", link: { $null: true, label: "string", do: action } }], $null: true },
  place: { $enum: ["bottom-left", "top-left", "center", "split"], $null: true }, at: "number?", rule: "boolean?",
};

const stop = {
  n: "string?", name: "string", frame: "string?",
  still: { $dev: "string?", $null: true }, stillPhone: "string?", sharp: "boolean?", focus: { ...pos, $null: true },
  screens: "number?", bar: "string?", caption,
  hotspots: { $arr: hotspot, $null: true },
  lines: { $arr: { kind: { $enum: ["dim", "line"] }, from: pos, to: pos, text: "string?" }, $null: true },
  map: { $null: true, stop: "string?", room: "string?", heading: "number?" },
  photo: { $null: true, n: "number?", of: "number?", label: "string?", time: "string?", thumb: "string?", thumbLg: "string?" },
  thumb: "string?",
};

const move = {
  $req: ["from", "to", "clips"],
  from: "string", to: "string", clips: { $arr: "string" }, screens: "number?", rec: "number?",
  tags: { $null: true, $arr: { $req: ["id"], id: "string", text: "string", offset: { ...pos, $null: true },
    track: { $or: ["string", { $arr: "string" }], $null: true }, keys: { $arr: key, $null: true }, from: "number?", to: "number?" } },
  panels: { $null: true, src: { $or: ["string", { $arr: "string" }] }, map: { $map: "string" } },
  events: { $null: true, $arr: { $req: ["at", "name"], at: "number", name: "string", id: "string?" } },
  focusKeys: { $arr: key, $null: true },
};

const cut = {
  $req: ["from", "to"],
  from: "string", to: "string", screens: "number?", rec: "number?", sheet: "string?", line: "string?", note: "string?",
  title: { $arr: "string", $null: true },
};

const block = {
  $req: ["id", "lines"],
  id: "string", lines: { $arr: "string" }, class: "string?", align: { $dev: { $enum: ["left", "right", "center"] }, $null: true },
  valign: { $dev: { $enum: ["top", "center", "bottom"] }, $null: true },
  space: { $dev: { $enum: ["viewport", "frame"] }, $null: true }, kicker: "string?",
  kickerAt: { $dev: { $enum: ["above", "below"] }, $null: true },
  box: { $dev: box }, stack: devBox, hidden: { $dev: "boolean", $null: true },
  size: { $null: true, desktop: "string?", phone: "string?", max: "string?", min: "string?", stack: "string?" },
  exit: { $null: true, dx: { ...strnum, $null: true }, dy: { ...strnum, $null: true } },
  slot: "string?", part: "number?", tag: "string?", stackAlign: { $enum: ["left", "right", "center"], $null: true },
};

export const SCHEMA = {
  $req: ["walk", "stops", "moves"],
  version: "number?", site: "string?",
  meta: { $null: true, title: "string?", description: "string?", lang: "string?" },
  theme: {
    $null: true,
    material: { $enum: ["paper", "night", "solid", "wall"], $null: true },
    grain: "number?",
    frame: { $null: true, kind: { $enum: ["crop", "inset", "none"] }, inset: { $dev: "number", $null: true }, radius: { $dev: "number", $null: true } },
    label: { $null: true, brackets: "boolean?" },
    hotspot: { $null: true, icon: { $enum: ["dot", "plus"], $null: true }, leader: "boolean?", plate: { $enum: ["pill", "tag", "none", "wall"], $null: true },
      plateOn: { $enum: ["always", "hover"], $null: true }, opens: { $enum: ["card", "pill", "none"], $null: true }, halo: { $enum: ["off", "one"], $null: true } },
    rail: { $null: true, skin: { $enum: ["index", "strip", "works", "none"], $null: true }, case: { $enum: ["sentence", "lower", "upper"], $null: true }, hideOnTitle: "boolean?", pop: "string?" },
    ruler: { $null: true, style: { $enum: ["ticks", "profile", "segments", "none"], $null: true }, count: "number?", works: "boolean?",
      profile: { $arr: "number?", $null: true }, summits: { $arr: "number", $null: true } },
    walkbar: { $null: true, layout: { $enum: ["center-ruler", "left-ruler", "no-ruler"], $null: true }, right: { $enum: ["meta", "layer"], $null: true },
      meta: "string?", hideOnTitle: "boolean?", counter: { $enum: ["name", "number", "none"], $null: true } },
    caption: { $null: true, place: { $enum: ["bottom-left", "top-left", "center", "split"], $null: true }, rule: "boolean?", case: { $enum: ["sentence", "lower", "upper"], $null: true } },
    map: { $null: true, svg: "string", corner: { $enum: ["tr", "br", "bl", "tl"], $null: true }, frame: { $enum: ["title-block", "crop"], $null: true }, cone: "boolean?", from: "string?", label: "string?" },
    end: { $null: true, arrive: { $enum: ["sheet", "card"], $null: true }, frame: { $enum: ["dim", "keep", "mask"], $null: true }, screens: "number?", pin: "number?", at: "number?" },
    cursor: { $null: true, on: "boolean?", verbs: { $map: "string", $null: true } },
  },
  brand: { $null: true, name: "string", wordmark: "string?", cover: "boolean?" },
  nav: {
    $null: true, left: "string?", center: "string?",
    right: { $null: true, $arr: { chip: "string?", button: "string?", link: "string?", layer: "string?", do: action, primary: "boolean?", label: "string?" } },
  },
  title: {
    $null: true,
    blocks: { $arr: block },
    gradients: { $null: true, $arr: { $req: ["edge", "color"], edge: { $enum: ["top", "bottom", "left", "right"] }, color: "string",
      opacity: { $dev: { $arr: "number", $len: 2 } }, extent: { $dev: "number", $null: true }, rest: { $dev: "number", $null: true },
      start: { $dev: "number", $null: true }, device: { $enum: ["desktop", "phone"], $null: true } } },
    occluder: { $null: true, masks: "string", frames: { $arr: "number", $len: 2 }, feather: "number?" },
    window: { $null: true, desktop: box, phone: box, radius: "number?", grow: "number?" },
    exit: { $null: true, mode: { $enum: ["drift", "nav"] }, screens: "number?" },
  },
  walk: { $arr: "string" },
  stops: { $map: stop },
  moves: { $map: move },
  cuts: { $map: cut, $null: true },
  cards: { $map: { $open: true, type: { $enum: ["material", "facts", "product"] } }, $null: true },
  artworks: { $null: true, $map: {
    n: "string?", kind: { $enum: ["painting", "object"], $null: true }, title: "string", year: "string?", medium: "string?",
    size: { $arr: "string", $null: true }, price: "string?", src: "string?", thumb: "string?", tint: "string?", tintInk: "string?",
    wall: "string?", stop: "string?", at: { $null: true, move: "string", t: "number" }, cutout: "string?", box: { ...box, $null: true }, caption: "string?",
    enquire: "string?",
  } },
  end: { $null: true, id: "string?" },
  footer: "any",
  record: { $null: true, fps: "number?", hold: "number?", speed: "number?", end: "number?", frames: "string?", endTo: { $or: ["string", "number"], $null: true },
    beats: { $null: true, $arr: { $req: ["at", "do", "target"], at: "string", after: "number?", do: { $enum: ["open", "lift", "swatch", "add", "hover"] },
      target: "string", hold: "number?", then: "string?", close: "boolean?", duration: "number?" } } },
};

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** checks `data` against SCHEMA; every problem is one console warning; returns the messages */
export function validate(data, spec = SCHEMA, file = "tour.json") {
  const out = [];
  const say = (m) => { out.push(m); warn(`${file}: ${m}`); };
  check(data, spec, "", say);
  // the walk's grammar and references (8.3)
  const walk = data?.walk;
  if (Array.isArray(walk)) {
    if (!walk.length) say("walk is empty");
    walk.forEach((id, i) => {
      const isStop = Boolean(data.stops?.[id]), isMove = Boolean(data.moves?.[id]), isCut = Boolean(data.cuts?.[id]);
      if (i % 2 === 0 && !isStop) say(`walk[${i}] "${id}" should be a stop (the walk alternates stop, move or cut, stop …)`);
      if (i % 2 === 1 && !isMove && !isCut) say(`walk[${i}] "${id}" should be a move or a cut`);
      if (i % 2 === 1 && (isMove || isCut)) {
        const m = isMove ? data.moves[id] : data.cuts[id];
        if (m.from && m.from !== walk[i - 1]) say(`${isMove ? "moves" : "cuts"}.${id}.from is "${m.from}" but the walk comes from "${walk[i - 1]}"`);
        if (m.to && walk[i + 1] && m.to !== walk[i + 1]) say(`${isMove ? "moves" : "cuts"}.${id}.to is "${m.to}" but the walk goes on to "${walk[i + 1]}"`);
      }
    });
    if (walk.length && walk.length % 2 === 0) say("walk should end on a stop");
    for (const id of Object.keys(data.stops ?? {})) if (!walk.includes(id)) say(`stops.${id} is not in the walk (ignored)`);
  }
  for (const [id, s] of Object.entries(data?.stops ?? {})) {
    if (s?.frame && !/^[\w./-]+:(first|last)$/.test(s.frame)) say(`stops.${id}.frame "${s.frame}" should look like "move-1:first" or "move-1:last"`);
    else if (s?.frame) {
      const ref = s.frame.split(":")[0];
      const known = data.moves?.[ref] || Object.values(data.moves ?? {}).some((m) => m?.clips?.includes(ref));
      if (!known) say(`stops.${id}.frame "${s.frame}": no move or clip "${ref}"`);
    }
  }
  for (const b of data?.title?.blocks ?? []) {
    if (b.slot && b.slot !== "nav-center") say(`title.blocks.${b.id}.slot "${b.slot}": only "nav-center" is supported`);
  }
  return out;
}

function check(v, spec, path, say) {
  const at = path || "(root)";
  if (typeof spec === "string") {
    const nullable = spec.endsWith("?"), t = spec.replace("?", "");
    if (v == null) { if (!nullable && v === null) say(`${at} is null but should be a ${t}`); return; }
    if (t !== "any" && typeOf(v) !== t) say(`${at} should be a ${t}, not ${typeOf(v)} (${JSON.stringify(v).slice(0, 40)})`);
    return;
  }
  if (v === null || v === undefined) {
    if (v === null && !spec.$null && !("$dev" in spec && spec.$null)) say(`${at} is null`);
    return;
  }
  if ("$dev" in spec) {
    if (v && typeof v === "object" && !Array.isArray(v) && ("desktop" in v || "phone" in v)) {
      for (const k of Object.keys(v)) if (k !== "desktop" && k !== "phone") say(`unknown field ${path}.${k} (ignored)`);
      for (const k of ["desktop", "phone"]) if (k in v && !(v[k] === null && spec.$null)) check(v[k], spec.$dev, `${path}.${k}`, say);
    } else check(v, spec.$dev, path, say);
    return;
  }
  if ("$or" in spec) {
    const ok = spec.$or.some((s) => { const msgs = []; check(v, s, path, (m) => msgs.push(m)); return !msgs.length; });
    if (!ok) say(`${at} has an unexpected shape (${JSON.stringify(v).slice(0, 60)})`);
    return;
  }
  if ("$enum" in spec) {
    if (!spec.$enum.includes(v)) say(`${at} is "${v}"; expected one of ${spec.$enum.map((x) => `"${x}"`).join(", ")}`);
    return;
  }
  if ("$arr" in spec) {
    if (!Array.isArray(v)) { say(`${at} should be a list`); return; }
    if (spec.$len && v.length !== spec.$len) say(`${at} should have ${spec.$len} items, has ${v.length}`);
    v.forEach((x, i) => check(x, spec.$arr, `${path}[${i}]`, say));
    return;
  }
  if ("$map" in spec) {
    if (typeOf(v) !== "object") { say(`${at} should be an object`); return; }
    for (const [k, x] of Object.entries(v)) check(x, spec.$map, path ? `${path}.${k}` : k, say);
    return;
  }
  // a plain object of fields
  if (typeOf(v) !== "object") { say(`${at} should be an object, not ${typeOf(v)}`); return; }
  for (const k of spec.$req ?? []) if (v[k] === undefined) say(`missing field ${path ? `${path}.` : ""}${k}`);
  for (const [k, x] of Object.entries(v)) {
    const p = path ? `${path}.${k}` : k;
    if (k.startsWith("//") || k.startsWith("_")) continue;   // comments
    if (!(k in spec) || k.startsWith("$")) { if (!spec.$open) say(`unknown field ${p} (ignored)`); continue; }
    check(x, spec[k], p, say);
  }
}

// ——— defaults ———

export const THEME_DEFAULTS = {
  material: "paper",
  grain: 0,
  frame: { kind: "none", inset: 12, radius: 10 },
  label: { brackets: false },
  hotspot: { icon: "dot", leader: false, plate: "pill", plateOn: "always", opens: "card", halo: "off" },
  rail: { skin: "index", case: "sentence", hideOnTitle: true },
  ruler: { style: "none", count: 40, works: false, profile: null, summits: null },
  walkbar: { layout: "center-ruler", right: null, meta: null, hideOnTitle: true },
  caption: { place: "bottom-left", rule: false, case: "sentence" },
  map: null,
  end: { arrive: "sheet", frame: "dim", screens: 1.2, pin: 0 },
  cursor: { on: false, verbs: {} },
};

export const RECORD_DEFAULTS = { fps: 30, hold: 0.9, speed: 1.1, end: 4.0, frames: "-rec", beats: [], endTo: null };

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? structuredClone(base) : over;
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObj(base[k]) && isObj(v) ? merge(base[k], v) : v === null && isObj(base[k]) && k !== "map" ? out[k] : v;
  }
  return out;
}

/**
 * the walk the engine can play: stop, move or cut, stop, … ending on a stop. Unknown ids and items out of turn are
 * dropped (validate() has warned about them); with no usable walk, the first stop alone.
 */
function repairWalk(d) {
  const out = [];
  for (const id of Array.isArray(d.walk) ? d.walk : []) {
    const wantStop = out.length % 2 === 0;
    if (wantStop ? d.stops[id] : d.moves[id] || d.cuts[id]) out.push(id);
  }
  if (out.length % 2 === 0) out.pop();
  if (!out.length) {
    const first = Object.keys(d.stops)[0];
    if (first) out.push(first);
    else { d.stops.start = { name: "" }; out.push("start"); }
  }
  return out;
}

/** a theme value outside its enum goes back to the default, so a typo never breaks a component */
function fixEnums(theme, spec, defs) {
  for (const [k, sub] of Object.entries(spec)) {
    if (k.startsWith("$") || !isObj(theme?.[k]) || !isObj(sub)) continue;
    for (const [f, s] of Object.entries(sub)) {
      if (!isObj(s) || !s.$enum) continue;
      const v = theme[k][f];
      if (v != null && !s.$enum.includes(v)) theme[k][f] = defs?.[k]?.[f] ?? null;
    }
  }
}

/** a copy of tour.json with every default filled in (it never throws) */
export function normalize(raw) {
  const d = structuredClone(raw ?? {});
  d.version ??= 1;
  d.meta ??= {};
  d.theme = merge(THEME_DEFAULTS, d.theme ?? {});
  if (raw?.theme?.end && raw.theme.end.screens == null) d.theme.end.screens = d.theme.end.arrive === "card" ? 0.55 : 1.2;
  if (raw?.theme?.map === undefined) d.theme.map = null;
  d.brand ??= { name: d.meta.title ?? "" };
  d.nav = { left: "wordmark", center: "none", right: [], ...(d.nav ?? {}) };
  d.nav.right ??= [];
  d.title = { blocks: [], gradients: [], occluder: null, window: null, ...(d.title ?? {}) };
  d.title.blocks ??= [];
  d.title.gradients ??= [];
  d.title.exit = { mode: "drift", screens: 0.3, ...(d.title.exit ?? {}) };
  const obj = (v) => (isObj(v) ? v : {});
  d.stops = obj(d.stops);
  d.moves = obj(d.moves);
  d.cuts = obj(d.cuts);
  d.cards = obj(d.cards);
  d.artworks = obj(d.artworks);
  for (const k of ["stops", "moves", "cuts"]) for (const [id, v] of Object.entries(d[k])) if (!isObj(v)) delete d[k][id];
  d.walk = repairWalk(d);
  // title blocks need an id and lines (validate() has said what is wrong)
  d.title.blocks = d.title.blocks.filter((b) => isObj(b) && Array.isArray(b.lines) && b.lines.length).map((b, i) => ({ ...b, id: b.id ?? `block-${i}`, lines: b.lines.map(String) }));
  if (!["drift", "nav"].includes(d.title.exit.mode)) d.title.exit.mode = "drift";
  for (const [id, s] of Object.entries(d.stops)) {
    s.id = id;
    s.name = typeof s.name === "string" ? s.name : id;
    s.focus = Array.isArray(s.focus) && s.focus.length >= 2 && s.focus.every((x) => typeof x === "number") ? s.focus.slice(0, 2) : [0.5, 0.5];
    s.hotspots = Array.isArray(s.hotspots) ? s.hotspots : [];
    s.lines = Array.isArray(s.lines) ? s.lines : [];
    s.caption = isObj(s.caption) ? s.caption : null;
    if (s.caption) for (const k of ["heading", "body", "label"]) if (s.caption[k] != null && typeof s.caption[k] !== "string") s.caption[k] = String(s.caption[k]);
  }
  for (const [id, m] of Object.entries(d.moves)) {
    m.id = id;
    m.clips = Array.isArray(m.clips) ? m.clips.filter((c) => typeof c === "string") : [];
    m.tags = Array.isArray(m.tags) ? m.tags : [];
    m.events = Array.isArray(m.events) ? m.events.filter((e) => isObj(e) && typeof e.at === "number") : [];
  }
  fixEnums(d.theme, SCHEMA.theme, THEME_DEFAULTS);
  for (const k of ["inset", "radius"]) if (typeof d.theme.frame[k] !== "number" && !isObj(d.theme.frame[k])) d.theme.frame[k] = THEME_DEFAULTS.frame[k];
  for (const [id, c] of Object.entries(d.cuts)) { c.id = id; }
  d.end = { id: "end", ...(d.end ?? {}) };
  d.record = { ...RECORD_DEFAULTS, ...(d.record ?? {}) };
  d.record.beats ??= [];
  return d;
}
