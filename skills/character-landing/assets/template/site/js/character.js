// Loads everything a character needs from characters/<id>/: spec, full-res hero frame, pose sequence, eye rig.
import { FrameSeq } from "./frames.js";
import { EyeRig } from "./eyes.js";
import { hex } from "./util.js";

const cache = new Map();
const box = ([x0, y0, x1, y1]) => ({ cx: (x0 + x1) / 2, halfW: (x1 - x0) / 2, top: y0, feet: y1 });

export function loadCharacter(id) {
  if (!cache.has(id)) cache.set(id, load(id));
  return cache.get(id);
}

async function load(id) {
  const dir = `characters/${id}`;
  const res = await fetch(`${dir}/character.json`);
  if (!res.ok) return null; // listed in index.json but not written yet
  const spec = await res.json();
  const seq = await FrameSeq.load(`${dir}/seq`);
  if (!seq) return null; // not generated yet
  const hero = new Image();
  hero.decoding = "async";
  hero.src = `${dir}/hero.webp`;
  const heroReady = hero.decode().catch(() => null);
  const all = seq.meta.bbox ?? [0.2, 0.15, 0.8, 0.87], rest = seq.meta.restBbox ?? all;
  const [, y0, , y1] = rest;
  const ch = {
    id, spec, seq, hero,
    name: spec.name,
    scenes: spec.scenes,
    palette: spec.scenes.map(s => ({ colors: s.colors.map(hex), ink: hex(s.ink) })),
    // where the figure sits inside the square frame (fractions). Both are sized by the rest pose so every scene
    // shows the character at the same scale; side scenes leave room halfway toward the widest pose, so props may
    // reach a little toward the title without shrinking the character.
    heroFig: box(rest),
    fig: { ...box(rest), halfW: (box(rest).halfW + Math.max(box(rest).cx - all[0], all[2] - box(rest).cx)) / 2 },
    // hero peek: share of the figure above the bottom edge — at least half, and enough to show every eye
    peek: spec.peek ?? Math.min(0.85, Math.max(0.5,
      ((Math.max(0, ...(spec.eyes ?? []).map(e => e.y + (e.socket?.ry ?? e.ry))) - y0) / (y1 - y0)) + 0.14)),
    // waist-up characters are cut off by the frame's bottom edge: side scenes anchor that edge to the viewport bottom
    bleed: (rest[3] ?? 0) > 0.97,
    rig: null,
    poster: `${dir}/seq/0001.webp`,
  };
  // The eye rig works on the sharp hero frame; falls back to the first sequence frame if there isn't one.
  ch.ready = Promise.all([seq.first, heroReady]).then(() => {
    const im = hero.naturalWidth ? hero : seq.images[0];
    if (im.naturalWidth && spec.eyes?.length) ch.rig = new EyeRig(im, spec.eyes, { blink: spec.blink });
  });
  return ch;
}

// Warm the cache for the rest once the current one is loaded.
export function prefetch(ids) {
  ids.forEach(id => loadCharacter(id).then(c => c?.seq.first));
}
