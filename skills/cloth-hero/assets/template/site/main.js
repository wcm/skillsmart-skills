// The page shell: one stage, one or more cloth pages (themes/<id>.js + themes/<id>.css, listed in themes/index.js).
// The URL hash picks the page (#<id>); switching draws a veil in the next page's colour, swaps the DOM and the 3D
// scene behind it, then lifts it. With one page there's nothing to switch: the dock shows only the sound button.
// You don't need to edit this file: a page is its own module.
import { Stage } from "./engine/stage.js";
import { audio } from "./engine/audio.js";
import { PAGES } from "./themes/index.js";

const $ = (s) => document.querySelector(s);
const body = document.body, bg = $("#bg"), back = $("#back"), hero = $("#hero"), veil = $("#veil");
const stage = new Stage($("#gl"));
// for poking at it from the console; `page` is the id on screen once its veil has lifted
window.__cloth = { stage, page: null, advance: (seconds = 1) => stage.advance(seconds) };
let current = null, currentId = null, currentSound = null, loading = null, userImage = null;

// every page's stylesheet (each scoped by body[data-theme="<id>"]), loaded once
const css = new Map(PAGES.map(({ id }) => {
  const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: `themes/${id}.css` });
  document.head.append(link);
  return [id, new Promise((done) => { link.onload = link.onerror = done; })];
}));

$(".themes").innerHTML = PAGES.length < 2 ? "" : PAGES.map(({ id, no, name, dot }) =>
  `<a href="#${id}" data-id="${id}" style="--c:${dot}" title="${no} ${name}"><i></i><b>${no}</b><span>${name}</span></a>`).join("");
if (PAGES.length < 2) $(".dock .rule").remove();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idFromHash = () => (PAGES.some((p) => p.id === location.hash.slice(1)) ? location.hash.slice(1) : PAGES[0].id);

async function show(id) {
  if (id === currentId && current) return;
  const token = (loading = Symbol(id));
  const first = !current;
  const [mod] = await Promise.all([PAGES.find((p) => p.id === id).load(), css.get(id)]);
  if (loading !== token) return;
  // veil in, in the colour of where we're going
  veil.style.setProperty("--veil", mod.meta.veil);
  veil.style.setProperty("--veil-ink", mod.meta.ink);
  veil.style.setProperty("--veil-font", mod.meta.display);
  veil.style.setProperty("--veil-weight", mod.meta.weight ?? 400);
  veil.querySelector("b").textContent = PAGES.length > 1 ? mod.meta.no : "";
  veil.querySelector("span").textContent = mod.meta.name;
  veil.querySelector("i").textContent = mod.meta.native ?? "";
  veil.classList.add(first ? "solid" : "in");
  veil.classList.remove("out");
  if (!first) await wait(650);
  if (loading !== token) return;

  stage.setTheme(null);
  current?.dispose();
  current = null;
  window.__cloth.page = null;
  body.dataset.theme = id;
  bg.innerHTML = mod.html.bg;
  back.innerHTML = mod.html.back;
  hero.innerHTML = mod.html.hero;
  document.querySelectorAll(".themes a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.id === id));
  document.title = mod.meta.title ?? mod.meta.name;
  try {
    const theme = await mod.create(stage, { hero, back, bg, audio, image: userImage?.src });
    if (loading !== token) { theme.dispose(); return; }
    current = theme;
    currentId = id;
    stage.setTheme(theme);
    currentSound = mod.meta.sound ?? null;
    audio.theme(currentSound);
  } catch (e) {
    console.error(e);
    hero.insertAdjacentHTML("beforeend", `<p class="fail">This page couldn't start: ${e.message}</p>`);
  }
  await wait(first ? 250 : 120);
  veil.classList.remove("in", "solid");
  veil.classList.add("out");
  window.__cloth.page = currentId;
}

addEventListener("hashchange", () => show(idFromHash()));
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "s" || e.key === "S") toggleSound();
  if (PAGES.length < 2) return;
  const i = PAGES.findIndex((p) => p.id === currentId);
  if (/^[1-9]$/.test(e.key) && PAGES[+e.key - 1]) location.hash = PAGES[+e.key - 1].id;
  if (e.key === "ArrowRight") location.hash = PAGES[(i + 1) % PAGES.length].id;
  if (e.key === "ArrowLeft") location.hash = PAGES[(i + PAGES.length - 1) % PAGES.length].id;
});
// placeholder links in the heroes don't navigate
document.addEventListener("click", (e) => { if (e.target.closest("[data-noop]")) e.preventDefault(); });

// ——— try another picture: drop an image file anywhere and it's woven into the cloth on screen ———
const toast = $("#toast");
let toastTimer = 0;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("on"), 2600);
}
async function useFile(file) {
  if (!file?.type?.startsWith("image/")) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch { say("That file isn't an image this page can read"); return; }
  userImage = img;
  current?.setImage?.(img);
  say("Woven in. It stays for this visit only.");
}
let dragDepth = 0;
addEventListener("dragenter", (e) => { if ([...(e.dataTransfer?.types ?? [])].includes("Files")) { dragDepth++; body.classList.add("dropping"); } });
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; body.classList.remove("dropping"); } });
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => { e.preventDefault(); dragDepth = 0; body.classList.remove("dropping"); useFile(e.dataTransfer.files[0]); });

// ——— sound (off until asked for) ———
const soundBtn = $(".sound");
function toggleSound() {
  const on = audio.toggle();
  soundBtn.setAttribute("aria-pressed", on);
  if (on) audio.theme(currentSound);
}
soundBtn.addEventListener("click", toggleSound);

show(idFromHash());
