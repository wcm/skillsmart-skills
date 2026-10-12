// The page shell: one WebGL stage, one or more glass pages (themes/<id>.js + themes/<id>.css, listed in
// themes/index.js). The URL hash picks the page (#<id>); switching fades a veil in the next page's colour, swaps the
// copy and the scene, then lifts it. With one page there's nothing to switch and the dock stays hidden.
// You don't need to edit this file: a page is its own module.
import { Stage } from "./engine/stage.js";
import { PAGES } from "./themes/index.js";

const $ = (s) => document.querySelector(s);
const body = document.body, hero = $("#hero"), veil = $("#veil");
const stage = new Stage($("#gl"));
// for poking at it from the console; `page` is the id on screen once its veil has lifted
window.__glass = { stage, page: null, advance: (s) => stage.advance(s) };
let current = null, currentId = null, loading = null;

// every page's stylesheet (each scoped by body[data-theme="<id>"]), loaded once
const css = new Map(PAGES.map(({ id }) => {
  const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: `themes/${id}.css` });
  document.head.append(link);
  return [id, new Promise((done) => { link.onload = link.onerror = done; })];
}));

if (PAGES.length > 1) $(".dock").innerHTML = PAGES.map((p) => `<a href="#${p.id}" data-id="${p.id}"><b>${p.no}</b><span>${p.name}</span></a>`).join("");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idFromHash = () => (PAGES.some((p) => p.id === location.hash.slice(1)) ? location.hash.slice(1) : PAGES[0].id);

async function show(id) {
  if (id === currentId && current) return;
  const token = (loading = Symbol(id));
  const first = !current;
  const entry = PAGES.find((p) => p.id === id);
  veil.style.background = entry.bg;
  if (!first) { veil.classList.add("in"); veil.classList.remove("out"); }
  const [mod] = await Promise.all([entry.load(), css.get(id), first ? null : wait(420)]);
  if (loading !== token) return;

  stage.setTheme(null);
  current?.dispose();
  current = null;
  window.__glass.page = null;
  body.dataset.theme = id;
  hero.innerHTML = mod.html.hero;
  document.querySelectorAll(".dock a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.id === id));
  document.title = mod.meta.title ?? mod.meta.name;
  try {
    await document.fonts.ready;
    current = mod.create(stage);
    currentId = id;
    stage.setTheme(current);
  } catch (e) {
    console.error(e);
    hero.insertAdjacentHTML("beforeend", `<p class="fail">This page couldn't start: ${e.message}</p>`);
  }
  // let it draw a couple of frames behind the veil before lifting it
  await wait(first ? 200 : 90);
  if (loading !== token) return;
  veil.classList.remove("in", "solid");
  veil.classList.add("out");
  window.__glass.page = currentId;
}

addEventListener("hashchange", () => show(idFromHash()));
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || PAGES.length < 2) return;
  const i = PAGES.findIndex((p) => p.id === currentId);
  if (/^[1-9]$/.test(e.key) && PAGES[+e.key - 1]) location.hash = PAGES[+e.key - 1].id;
  if (e.key === "ArrowRight") location.hash = PAGES[(i + 1) % PAGES.length].id;
  if (e.key === "ArrowLeft") location.hash = PAGES[(i + PAGES.length - 1) % PAGES.length].id;
});
// placeholder links in the heroes don't navigate
document.addEventListener("click", (e) => { if (e.target.closest("[data-noop]")) e.preventDefault(); });

show(idFromHash());
