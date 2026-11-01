// Jour / Nuit interface helpers shared by the demos: theme variables that follow the light, a day/night switch,
// and hotspots pinned to points of the photograph.
import { JourNuit } from "./jour-nuit.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// CSS variables on <html>, every frame the light moves:
//   --sun    0 day … 1 the sun has gone
//   --lit    how much of the night light is on (0 … 1)
//   --night  how much the page should feel like night: mostly the sun, a little the lights
//   --flip   0 or 1 around the middle of the dusk, for text that must stay readable (eased over a short span)
export function bindTheme(jn, { root = document.documentElement, flipAt = 0.5, span = 0.16 } = {}) {
  const set = () => {
    const s = jn.state.sun;
    const lit = jn.lights.length ? jn.lights.reduce((a, l) => a + Math.min(1, Math.max(0, l.level)), 0) / jn.lights.length : jn.state.ambient;
    const night = clamp01(s * 0.8 + Math.max(lit, jn.state.ambient) * 0.2);
    root.style.setProperty("--sun", s.toFixed(4));
    root.style.setProperty("--lit", lit.toFixed(4));
    root.style.setProperty("--night", night.toFixed(4));
    root.style.setProperty("--flip", smooth(flipAt - span / 2, flipAt + span / 2, s).toFixed(4));
    root.dataset.mode = s > flipAt ? "night" : "day";
  };
  jn.on("change", set);
  set();
  return set;
}

// <button class="jn-switch" role="switch"> with labels outside the pill: DAY (o-) NIGHT
export function daySwitch(el, jn, { onToggle } = {}) {
  el.setAttribute("role", "switch");
  const sync = (mode) => el.setAttribute("aria-checked", mode === "night" ? "true" : "false");
  sync(jn.mode ?? "day");
  jn.on("mode", sync);
  el.addEventListener("click", () => (onToggle ? onToggle() : jn.toggle()));
  return el;
}

// hotspots: items [{ id, x, y, el }] in image coords (0..1, top-left); kept on their point as the frame resizes
export function pin(jn, items, { hideOffscreen = true } = {}) {
  const place = () => {
    for (const it of items) {
      const p = jn.toScreen(it.x, it.y);
      it.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (hideOffscreen) it.el.toggleAttribute("hidden", !p.visible);
    }
  };
  jn.on("resize", place);
  place();
  return place;
}

// without WebGL: the night picture over the day one, crossfaded by html[data-mode]; the switch still works
export function plainSwitch(stage, button, nightSrc, { onChange } = {}) {
  const img = document.createElement("img");
  img.className = "jn-night";
  img.alt = "";
  img.src = nightSrc;
  stage.querySelector("img")?.after(img);
  const root = document.documentElement;
  button?.setAttribute("role", "switch");
  button?.setAttribute("aria-checked", "false");
  const toggle = () => {
    const night = root.dataset.mode !== "night";
    root.dataset.mode = night ? "night" : "day";
    root.style.setProperty("--flip", night ? 1 : 0);
    root.style.setProperty("--night", night ? 1 : 0);
    root.style.setProperty("--sun", night ? 1 : 0);
    root.style.setProperty("--lit", night ? 1 : 0);
    button?.setAttribute("aria-checked", String(night));
    onChange?.(night);
  };
  button?.addEventListener("click", toggle);
  return toggle;
}

// the engine, or a plain crossfade of <img> when WebGL2 is missing; resolves to the engine (or null)
export async function start(canvas, opts, { fallback } = {}) {
  try {
    return await JourNuit.create(canvas, opts);
  } catch (e) {
    console.warn("Jour / Nuit: falling back to pictures", e);
    canvas.remove();
    fallback?.();
    return null;
  }
}

// read a demo's img/scene.json (picture size, measured light centres)
export async function sceneInfo(dir = "img") {
  try { return await (await fetch(`${dir}/scene.json`)).json(); } catch { return null; }
}

// a box over part of the photo (image coords), e.g. a click area on a sign; kept in place as the frame resizes
export function pinBox(jn, el, [x0, y0, x1, y1]) {
  const place = () => {
    const a = jn.toScreen(x0, y0), b = jn.toScreen(x1, y1);
    Object.assign(el.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${b.x - a.x}px`, height: `${b.y - a.y}px` });
  };
  jn.on("resize", place);
  place();
  return place;
}

// the picture set of a demo: { day, dark, night } urls in img/ (the engine adds -<width> for the screen)
export const shots = (names = {}, dir = "img") => Object.fromEntries(Object.entries({ day: "day", dark: "dark", night: "night", ...names }).map(([k, v]) => [k, `${dir}/${v}.webp`]));

// ?night opens on the night state (for stills); ?t=0.4 holds the sun at a point
export function startState(jn, { lights } = {}) {
  const q = new URLSearchParams(location.search);
  if (q.has("night")) {
    jn.mode = "night";
    jn.set({ sun: 1, ambient: 1, lights: Object.fromEntries(jn.lights.map((l) => [l.id, 1])) });
    jn.emit("mode", "night");
    jn.emit("change", jn.state);
  } else if (q.has("t")) {
    jn.set({ sun: Number(q.get("t")), lights });
    jn.emit("change", jn.state);
  }
}
