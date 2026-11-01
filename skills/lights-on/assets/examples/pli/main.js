// Pli: one window, four fabrics, two lamps.
//   - a hang-tag draws its fabric across the window along the rod while the room's light follows it, and the
//     light-through meter counts with the cloth;
//   - Morning · Night takes the sun away (the light drains toward the window, the curtain glows last), then lights the
//     paper floor lamp and the table lamp; the night lines and the clock come last, once the paper lamp has caught;
//   - a lens over the curtain shows the weave; a click opens the lens into the fabric's details.
// The interface reads the room: each piece of type turns cream when what sits behind it goes dim (night, or a heavy
// cloth), the window side last.
import { bindTheme, daySwitch, shots, start, startState } from "../engine/ui.js";

const FABRICS = [
  { id: "voile", name: "Voile", kind: "Sheer", through: 72, comp: "100% linen voile", colour: "Ivory", weight: 95,
    note: "Soft daylight, silhouettes after dark. Hang it with a dim-out on a second track where you want privacy at night." },
  { id: "linen", name: "Linen", kind: "Light filtering", through: 38, comp: "100% washed linen", colour: "Oat", weight: 220,
    note: "Private by day. With the lamps on, soft shapes show through after dark; a lining makes it fully private." },
  { id: "dimout", name: "Dim-out", kind: "Dim-out", through: 6, comp: "Cotton-linen, triple weave", colour: "Sage", weight: 380,
    note: "Private day and night. A fine line of morning shows at the edges, as with any curtain on a track." },
  { id: "blackout", name: "Blackout", kind: "Blackout", through: 0, comp: "Cotton velvet, blackout lining", colour: "Midnight", weight: 520,
    note: "Fully private and fully dark: the room keeps the night until you draw it open." },
];
const FAB = Object.fromEntries(FABRICS.map((f, i) => [f.id, { ...f, n: i + 1 }]));
const CLOTH = [0.352, 0.03, 1, 0.782];          // the curtain's area (image coords), measured on the sage dim-out
// what sits behind the type, measured on the pictures: mean linear luminance in the day, dark and night photo of each
// fabric. The wall behind the title, the curtain's heading behind the wordmark and Swatches, the floor under the
// readouts (the rug, on a phone). `at` is where the patch sits (its own moment as the sun leaves), `lamp` the paper
// lamp's share of its night light. Each patch turns its type cream at its own moment: the window side goes dark last.
const BACK = {
  wall: { at: [0.22, 0.25], lamp: 0.34, edge: [0.172, 0.152],
    voile: [0.212, 0.009, 0.068], linen: [0.183, 0.007, 0.104], dimout: [0.092, 0.008, 0.089], blackout: [0.056, 0.005, 0.05] },
  head: { at: [0.65, 0.05], lamp: 0, edge: [0.165, 0.145],
    voile: [0.407, 0.009, 0.037], linen: [0.177, 0.008, 0.037], dimout: [0.117, 0.009, 0.031], blackout: [0.009, 0.003, 0.005] },
  floor: { at: [0.72, 0.88], lamp: 0, edge: [0.2, 0.17],
    voile: [0.606, 0.012, 0.051], linen: [0.378, 0.018, 0.073], dimout: [0.215, 0.01, 0.044], blackout: [0.107, 0.014, 0.066] },
  rug: { at: [0.32, 0.9], lamp: 0, edge: [0.2, 0.17],
    voile: [0.285, 0.014, 0.072], linen: [0.21, 0.014, 0.089], dimout: [0.13, 0.011, 0.085], blackout: [0.079, 0.009, 0.047] },
};
const CLOCK = { day: "08:40", night: "21:15" };
const SPAN = 0.6;                                // how long each pixel takes to lose the sun: the light drains slowly
const ZOOM = 2.2, LENS = 180;                    // the lens: 2.2× the picture on screen
const SHEET = { zoom: 1.5, day: [0.62, 0.36], night: [0.44, 0.4] };   // the swatch in the open sheet: wider, on the best light
const SWATCH = [0.47, 0.3];                      // where the hang-tags are cut from (image coords)

const root = document.documentElement, $ = (s) => document.querySelector(s);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const file = (id, st, w) => `img/${id === "linen" ? st : `${st}-${id}`}${w ? `-${w}` : ""}.webp`;
const set = (id) => (id === "linen" ? shots() : shots({ day: `day-${id}`, dark: `dark-${id}`, night: `night-${id}` }));

// --- hang-tags (built for the fallback too) ---
let chosen = "linen";
const tags = FABRICS.map((f) => {
  const b = document.createElement("button");
  b.className = "tag";
  b.dataset.id = b.dataset.fabric = f.id;          // data-fabric: the hook tools/clip.mjs clicks
  b.setAttribute("role", "radio");
  b.setAttribute("aria-label", `${f.name}, ${f.kind.toLowerCase()}, ${f.through}% light through`);
  b.style.cssText = `--day: url(${file(f.id, "day", 1600)}); --dark: url(${file(f.id, "dark", 1600)}); --night: url(${file(f.id, "night", 1600)}); --pos: calc(var(--tag) * .5 - ${SWATCH[0] * 1600}px) calc(var(--tag) * .53 - ${SWATCH[1] * 900}px)`;
  b.innerHTML = `<span class="swatch"><span class="card"></span><span class="cloth"></span></span><span class="name" aria-hidden="true">${f.name}</span>`;
  $(".tags").append(b);
  return b;
});
const pick = (id) => tags.forEach((t) => { const on = t.dataset.id === id; t.setAttribute("aria-checked", on); t.tabIndex = on ? 0 : -1; });
pick(chosen);
$(".tags").addEventListener("keydown", (e) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const i = (FABRICS.findIndex((f) => f.id === chosen) + step + 4) % 4;
  tags[i].focus();
  tags[i].click();
});

const jn = await start(document.getElementById("jn"), {
  sets: { linen: set("linen"), voile: set("voile"), dimout: set("dimout"), blackout: set("blackout") },
  widths: [1600],
  wipe: { dir: "across", rect: CLOTH },
  // the lamps' own glow and what sits close to them; the rest of the night (the folds the floor lamp rakes) comes up
  // with the ambient, so the paper lamp reads first and the table lamp clearly second
  lights: [
    { id: "floor", kind: "warm", x: 0.02, y: 0.52, rx: 0.3, ry: 0.85, falloff: 0.8 },     // paper floor lamp, front left
    { id: "table", kind: "warm", x: 0.272, y: 0.5, rx: 0.15, ry: 0.22, falloff: 0.6 },    // ceramic table lamp and its pool
  ],
  focus: [0, 0.55],
  sunFrom: [0.7, 0.4],
  sunSpan: SPAN,
  gold: 0.3,
  dayExpo: 0.3,
  vignette: 0.14,
  bloom: 0.45,
}, { fallback: () => root.classList.add("no-gl") });

if (jn) {
  bindTheme(jn);
  const L = jn.byId;

  // --- framing: wide screens keep the paper lamp at the left edge; phones look at the wall and the curtain's edge ---
  const still = $(".still");
  const frame = () => {
    const f = jn.cssW / Math.max(1, jn.cssH) < 0.9 ? [0.32, 0.55] : [0, 0.55];
    if (f[0] !== jn.o.focus[0]) return jn.setFocus(f);
    const { vw, vh, ox, oy } = jn.view, imgw = jn.cssW / vw;
    // the title's column: the wall between the paper lamp and the curtain; its size fits the wall
    const pad = innerWidth <= 760 ? 20 : Math.min(52, Math.max(18, innerWidth * 0.032));
    const x0 = Math.max(pad, jn.toScreen(0.094, 0).x), x1 = jn.toScreen(0.338, 0).x;   // a breath clear of the lamp's glow
    root.style.setProperty("--imgw", `${imgw.toFixed(1)}px`);
    root.style.setProperty("--wall-x", `${x0.toFixed(1)}px`);
    root.style.setProperty("--wall-w", `${(x1 - x0).toFixed(1)}px`);
    root.style.setProperty("--title", `${Math.max(32, Math.min(100, imgw * 0.0435, (x1 - x0 - 6) / 5.4)).toFixed(1)}px`);
    still.style.objectPosition = `${vw < 1 ? (ox / (1 - vw)) * 100 : 0}% ${vh < 1 ? (oy / (1 - vh)) * 100 : 50}%`;
  };
  jn.on("resize", frame);
  frame();

  // --- the room's tone: estimate each patch's light from the measured photos, mixed as the engine mixes them (the
  //     patch's own moment as the sun leaves: how sunlit it is, how near the window, the engine's span) ---
  const [sx, sy] = jn.o.sunFrom;
  const patchY = (P, id) => {
    const [d, k, n] = P[id], s = jn.state.sun;
    const near = 1 - Math.min(1, Math.hypot(P.at[0] - sx, P.at[1] - sy) / 1.25);
    const tau = (0.52 * Math.log2(d * 24 + 1) / Math.log2(25) + 0.3 * near + 0.18 * 0.5) * (1 - SPAN);
    const m = sstep(tau, tau + SPAN, s), grade = 1 - 0.22 * sstep(0.15, 0.75, s), expo = 0.3 + 0.7 * sstep(0, 1, s);
    const w = Math.min(1, P.lamp * L.floor.level + (1 - P.lamp) * jn.state.ambient);
    return (1 - m) * d * grade + m * k + expo * w * (n - k);
  };
  const phone = matchMedia("(max-width: 760px)");
  const tone = (name) => {
    const P = BACK[name], st = jn.state, k = st.next && st.wipe >= 0 ? st.wipe : 0;
    let y = patchY(P, st.set);
    if (k) y += (patchY(P, st.next) - y) * sstep(0.1, 0.9, k);   // the room crossfades with the cloth
    return sstep(P.edge[0], P.edge[1], y).toFixed(3);
  };

  // --- the meter counts with the cloth ---
  const pct = $("#pct"), fill = $("#fill"), kind = $("#kind");
  let shownKind = jn.state.set, copy = null;
  // out (0.18 s), then the new word rises in (0.42 s); on the engine's clock, so frame-by-frame capture (?record) keeps
  // the same rhythm; the newest word wins
  const swapText = (el, text) => {
    el.getAnimations().forEach((a) => a.cancel());
    const token = (el.token = (el.token ?? 0) + 1);
    if (reduce || !el.textContent) { el.textContent = text; return; }
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-5px)" }], { duration: 180, easing: "ease-in", fill: "forwards" });
    jn.after(0.18, () => {
      if (el.token !== token) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.textContent = text;
      el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
  };

  // --- the clock rolls with the light: each digit slides up to the next, left to right ---
  const clock = $("#clock");
  clock.textContent = "";
  const cells = [...CLOCK.day].map((c) => {
    const el = document.createElement("span");
    if (c === ":") { el.textContent = ":"; clock.append(el); return null; }
    el.className = "d";
    el.innerHTML = `<span><span>${c}</span></span>`;
    clock.append(el);
    return el;
  }).filter(Boolean);
  const roll = (time, animate = true) => {
    clock.setAttribute("aria-label", time);
    [...time.replace(":", "")].forEach((c, i) => {
      const cell = cells[i], strip = cell.firstChild, now = strip.lastChild.textContent;
      if (now === c) return;
      const token = (cell.token = (cell.token ?? 0) + 1);
      strip.getAnimations().forEach((a) => a.cancel());
      if (!animate || reduce) { strip.innerHTML = `<span>${c}</span>`; return; }
      strip.innerHTML = `<span>${now}</span><span>${c}</span>`;
      // it holds the new digit when done, whenever the clean-up runs
      const a = strip.animate([{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }], { duration: 760, delay: 110 * i, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" });
      a.finished.then(() => { if (cell.token === token) { strip.innerHTML = `<span>${c}</span>`; a.cancel(); } }, () => {});
    });
  };

  // everything that follows the light, every frame it moves
  const update = () => {
    const st = jn.state, k = st.next && st.wipe >= 0 ? st.wipe : 0;
    root.style.setProperty("--tone", tone("wall"));
    root.style.setProperty("--tone-head", tone("head"));
    root.style.setProperty("--tone-low", tone(phone.matches ? "rug" : "floor"));
    // the hang-tags follow the room: their cloth goes dark with the sun, then takes the lamplight with the lamps
    root.style.setProperty("--dark-k", sstep(0.25, 0.85, st.sun).toFixed(3));
    root.style.setProperty("--night-k", sstep(0.05, 0.8, Math.max(L.floor.level, st.ambient)).toFixed(3));
    const from = FAB[st.set].through, v = k ? from + (FAB[st.next].through - from) * k : from;
    pct.textContent = Math.round(v);
    fill.style.transform = `scaleX(${(v / 100).toFixed(4)})`;
    const shown = k >= 0.5 ? st.next : st.set;
    if (shown !== shownKind) { shownKind = shown; swapText(kind, FAB[shown].kind); }
    // the interface comes last: the night lines and the clock wait for the paper lamp to catch; they go back as the
    // morning reaches the wall (when the title turns to ink)
    const lit = Math.max(L.floor.level, L.table.level, st.ambient);
    const now = (copy === "night" ? st.sun > 0.35 : st.sun > 0.5 && lit > 0.25) ? "night" : "day";
    if (now !== copy) {
      roll(CLOCK[now], copy !== null);
      copy = root.dataset.copy = now;
      // only the line that shows is read out
      document.querySelectorAll(".swap > .day, .swap > .night").forEach((el) => el.setAttribute("aria-hidden", !el.classList.contains(now)));
      // driven straight through jn.set() (recording, stills), no sequence sets the mode: the switch follows the light
      if (!jn.mode) { toggle.setAttribute("aria-checked", now === "night"); underline(); }
    }
    lensPlates();
  };

  // --- fabrics: the newest choice wins; a wipe already running finishes first, so nothing jumps ---
  const counter = $("#counter"), hit = $("#cloth");
  let drawing = false;
  const draw = async () => {
    if (drawing) return;
    drawing = true;
    try {
      while (jn.state.set !== chosen) {
        const to = chosen;
        if (lens.a.dataset.id) plate(lens.b, to);     // the lens's pictures load only once it has been used
        await jn.use(to, { duration: reduce ? 0.45 : 1.5 });
        if (lens.a.dataset.id) plate(lens.a, to);
        requestAnimationFrame(() => requestAnimationFrame(update));
      }
    } finally { drawing = false; }                    // a picture that fails to load never locks the tags
  };
  const choose = (id) => {
    if (!FAB[id] || id === chosen) return;
    chosen = id;
    const f = FAB[id];
    pick(id);
    counter.textContent = `[ 0${f.n} / 04 ]`;
    hit.setAttribute("aria-label", `${f.name}, details`);
    if (sheet.classList.contains("open")) fillSheet(f, true);
    preload(id);
    draw();
  };
  tags.forEach((t) => t.addEventListener("click", () => choose(t.dataset.id)));

  // --- Morning · Night: the light drains toward the window (the curtain glows last), a beat of blue, the paper lamp,
  //     the table lamp, then the room warms; the morning puts the lamps out and the sun comes back ---
  const toggle = $("#switch");
  const slow = reduce ? 0.4 : 1;
  const evening = () => jn.night({ sun: 2.1 * slow, beat: 0.2, stagger: 0.55 * slow, order: ["floor", "table"], ambient: 1 });
  const morning = () => jn.day({ sun: 1.6 * slow, lightsOff: 0.3 });
  const flip = () => (jn.mode === "night" ? morning() : evening());
  daySwitch(toggle, jn, { onToggle: flip });
  const underline = () => {
    const on = toggle.querySelector((jn.mode ?? copy) === "night" ? ".t-night" : ".t-day");
    toggle.style.setProperty("--x", `${on.offsetLeft}px`);
    toggle.style.setProperty("--w", `${on.offsetWidth}px`);
  };
  jn.on("mode", underline);
  document.fonts.ready.then(underline);
  jn.on("resize", underline);

  // --- the lens: two plates (this fabric and the one being drawn), each a day and a night picture ---
  const lensEl = $("#lens");
  const lens = { el: lensEl, a: lensEl.querySelector(".a"), b: lensEl.querySelector(".b"), u: 0.55, v: 0.42, x: 0, y: 0, on: false, docked: false };
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  function plate(el, id) {
    if (el.dataset.id === id) return;
    el.dataset.id = id;
    const [d, n] = el.children;
    d.style.backgroundImage = `url(${file(id, "day", 1600)}), url(${file(id, "day", 1600)})`;
    n.style.backgroundImage = `url(${file(id, "night", 1600)}), url(${file(id, "night", 1600)})`;
  }
  const warm = () => { plate(lens.a, jn.state.set); if (jn.state.next) plate(lens.b, jn.state.next); };
  // the lens's large pictures load ahead (for a mouse only), so the first look is already sharp
  const kept = new Map();
  function preload(id) {
    if (!fine.matches || kept.has(id)) return;
    kept.set(id, ["day", "night"].map((st) => { const im = new Image(); im.decoding = "async"; im.src = file(id, st, 1600); return im; }));
  }
  // the second plate shows once the cloth's leading edge has passed the lens (same edge as the engine's wipe)
  function lensPlates() {
    const st = jn.state;
    let ob = 0;
    if (st.next && st.wipe >= 0) {
      const [x0, y0, x1, y1] = CLOTH;
      const cu = (lens.u - x0) / (x1 - x0), cv = Math.min(1, Math.max(0, (lens.v - y0) / (y1 - y0)));
      const edge = st.wipe * 1.3 - 0.15 - cv * 0.08;
      ob = sstep(edge + 0.035, edge - 0.035, cu);
    }
    lensEl.style.setProperty("--ob", ob.toFixed(3));
  }
  // the picture under the lens: z × the picture on screen, the point (u, v) kept at the lens's centre
  const view = (u, v, z) => {
    const bw = (jn.cssW / jn.view.vw) * z, bh = (jn.cssH / jn.view.vh) * z;
    return { "--bw": `${bw.toFixed(1)}px`, "--bh": `${bh.toFixed(1)}px`, "--bx": `${((0.5 - u) * bw).toFixed(1)}px`, "--by": `${((0.5 - v) * bh).toFixed(1)}px` };
  };
  const aim = (u, v, z = ZOOM) => {
    Object.assign(lens, { u, v, z });
    for (const [k, val] of Object.entries(view(u, v, z))) lensEl.style.setProperty(k, val);
    lensPlates();
  };
  const stageXY = (e) => { const r = hit.parentElement.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let raf = 0;
  const follow = (e) => {
    if (!fine.matches || lens.docked) return;
    const p = stageXY(e);
    lens.x = p.x; lens.y = p.y;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (lens.docked) return;
      const { u, v } = jn.fromScreen(lens.x, lens.y);
      aim(u, v);
      lensEl.style.transform = `translate3d(${(lens.x - LENS / 2).toFixed(1)}px, ${(lens.y - LENS / 2).toFixed(1)}px, 0)`;
      if (!lens.on) { warm(); lens.on = true; lensEl.classList.add("on"); root.classList.add("lensed"); }
    });
  };
  const unfollow = () => {
    cancelAnimationFrame(raf);
    if (lens.docked) return;
    lens.on = false; lensEl.classList.remove("on"); root.classList.remove("lensed");
  };
  const placeHit = () => {   // the curtain's box, cut to what is on screen
    const a = jn.toScreen(CLOTH[0], CLOTH[1]), b = jn.toScreen(CLOTH[2], CLOTH[3]);
    const x0 = Math.max(0, a.x), x1 = Math.min(jn.cssW, b.x), y0 = Math.max(0, a.y), y1 = Math.min(jn.cssH, b.y);
    Object.assign(hit.style, { left: `${x0}px`, top: `${y0}px`, width: `${Math.max(0, x1 - x0)}px`, height: `${Math.max(0, y1 - y0)}px` });
  };
  jn.on("resize", () => { placeHit(); unfollow(); });   // a resize leaves the pointer elsewhere: the lens waits for it
  placeHit();
  Promise.resolve(jn.rest).then(() => setTimeout(() => preload(chosen), 300));   // after the other fabrics' pictures
  hit.addEventListener("pointerenter", follow);
  hit.addEventListener("pointermove", follow);
  hit.addEventListener("pointerleave", unfollow);

  // --- details: the lens opens into the sheet's swatch ---
  const sheet = $("#sheet"), slot = sheet.querySelector(".slot"), body = sheet.querySelector(".sheet-body"), more = $("#more");
  sheet.hidden = false;
  sheet.inert = true;
  function fillSheet(f, fade) {
    const put = () => {
      $("#d-num").textContent = `0${f.n} / 04`;
      $("#d-kind").textContent = f.kind;
      $("#d-name").textContent = f.name;
      $("#d-comp").textContent = f.comp;
      $("#d-colour").textContent = f.colour;
      $("#d-weight").textContent = `${f.weight} g/m²`;
      $("#d-through").textContent = `${f.through}%`;
      $("#d-note").textContent = f.note;
      body.classList.remove("dim");
    };
    if (!fade || reduce) return put();
    body.classList.add("dim");
    setTimeout(put, 300);
  }
  // where the swatch sits in the open sheet (layout boxes, so the sheet's own entrance doesn't move it)
  const slotRect = () => ({ x: sheet.offsetLeft + slot.offsetLeft, y: sheet.offsetTop + slot.offsetTop, w: slot.offsetWidth, h: slot.offsetHeight });
  const dock = () => {
    const r = slotRect();
    Object.assign(lensEl.style, { transform: `translate3d(${r.x}px, ${r.y}px, 0)`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: "1px" });
    lensEl.style.setProperty("--feather", "400%");
  };
  let opener = null;
  function openSheet({ fromLens = false } = {}) {
    if (sheet.classList.contains("open")) return;
    opener = document.activeElement;
    fillSheet(FAB[chosen]);
    sheet.classList.add("open");
    sheet.inert = false;
    [hit, more].forEach((b) => b.setAttribute("aria-expanded", "true"));
    warm();
    const [tu, tv] = SHEET[jn.mode === "night" ? "night" : "day"];
    const from = fromLens && lens.on ? { x: lens.x - LENS / 2, y: lens.y - LENS / 2, view: view(lens.u, lens.v, lens.z) } : null;
    lens.docked = true;
    cancelAnimationFrame(raf);
    root.classList.remove("lensed");
    const r = slotRect();
    aim(tu, tv, SHEET.zoom);
    dock();
    if (from && !reduce) {
      // the lens flies into the sheet and opens out, its view easing back to show the folds
      lensEl.animate([
        { transform: `translate3d(${from.x}px, ${from.y}px, 0)`, width: `${LENS}px`, height: `${LENS}px`, borderRadius: "50%", "--feather": "90%", ...from.view },
        { transform: `translate3d(${r.x}px, ${r.y}px, 0)`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: "1px", "--feather": "400%", ...view(tu, tv, SHEET.zoom) },
      ], { duration: 950, easing: "cubic-bezier(.65,0,.35,1)" });
    } else if (!reduce) {
      lensEl.animate([{ opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1 }], { duration: 600, delay: 120, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    }
    lensEl.classList.add("on");
    lens.on = true;
    setTimeout(() => $("#close").focus({ preventScroll: true }), reduce ? 0 : 500);
  }
  function closeSheet() {
    if (!sheet.classList.contains("open")) return;
    sheet.classList.remove("open");
    sheet.inert = true;
    [hit, more].forEach((b) => b.setAttribute("aria-expanded", "false"));
    lensEl.classList.remove("on");
    lens.on = false;
    setTimeout(() => {
      if (sheet.classList.contains("open")) return;
      lens.docked = false;
      Object.assign(lensEl.style, { width: "", height: "", borderRadius: "" });
      lensEl.style.removeProperty("--feather");
    }, 420);
    // back to the control that opened it; opened from the curtain (by mouse), the focus just leaves the sheet, so no
    // ring is drawn round the whole curtain
    if (opener && opener !== document.body && opener !== hit) opener.focus({ preventScroll: true });
    else if (sheet.contains(document.activeElement)) document.activeElement.blur();
  }
  jn.on("resize", () => { if (lens.docked && sheet.classList.contains("open")) { dock(); aim(lens.u, lens.v, lens.z); } });
  hit.addEventListener("click", () => (sheet.classList.contains("open") ? closeSheet() : openSheet({ fromLens: true })));
  more.addEventListener("click", () => (sheet.classList.contains("open") ? closeSheet() : openSheet()));
  $("#close").addEventListener("click", closeSheet);
  let swatches = 0;
  $("#order").addEventListener("click", (e) => {
    $("#count").textContent = ++swatches;
    e.currentTarget.textContent = "( Added )";
    setTimeout(() => { $("#order").textContent = "( Order a swatch )"; }, 1600);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea")) return;
    if (e.key === "n" || e.key === "N") flip();
    if ("1234".includes(e.key) && e.key.length === 1) choose(FABRICS[Number(e.key) - 1].id);
  });

  jn.on("change", update);
  jn.on("resize", () => update());
  startState(jn);
  update();
  underline();
  window.pli = { choose, morning, evening, open: openSheet, close: closeSheet };
} else {
  // no WebGL2: the pictures crossfade, the readouts follow
  const still = $(".still"), night = still.cloneNode();
  night.className = "jn-night";
  night.alt = "";
  night.removeAttribute("fetchpriority");
  $("#jn")?.remove();
  still.after(night);
  const toggle = $("#switch");
  const show = () => {
    const f = FAB[chosen];
    still.srcset = night.srcset = "";
    still.src = file(chosen, "day", 1600);
    night.src = file(chosen, "night", 1600);
    pick(chosen);
    $("#pct").textContent = f.through;
    $("#fill").style.transform = `scaleX(${f.through / 100})`;
    $("#kind").textContent = f.kind;
    $("#counter").textContent = `[ 0${f.n} / 04 ]`;
    const on = toggle.querySelector(root.dataset.mode === "night" ? ".t-night" : ".t-day");
    toggle.style.setProperty("--x", `${on.offsetLeft}px`);
    toggle.style.setProperty("--w", `${on.offsetWidth}px`);
    $("#clock").textContent = CLOCK[root.dataset.mode];
  };
  tags.forEach((t) => t.addEventListener("click", () => { chosen = t.dataset.id; show(); }));
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", "false");
  toggle.addEventListener("click", () => {
    const on = toggle.getAttribute("aria-checked") !== "true";
    toggle.setAttribute("aria-checked", on);
    root.dataset.mode = root.dataset.copy = on ? "night" : "day";
    for (const k of ["--tone", "--tone-head", "--tone-low", "--night", "--dark-k", "--night-k", "--flip"]) root.style.setProperty(k, on ? 1 : 0);
    show();
  });
  document.fonts.ready.then(show);
}
