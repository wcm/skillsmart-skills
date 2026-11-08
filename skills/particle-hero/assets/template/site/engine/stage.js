// What every Particle Hero page does: make the engine, show the first picture as soon as it's ready, load the rest behind it,
// play through them on a timer, and let the page pick one.
//
//   ?still   no timer: stays on the first picture until picked
//   ?rec     a fixed 1/60 s step per frame, for screen recording
//   ?pic=2   start on that picture
import { Nuee } from "./nuee.js";
import { Hud } from "./hud.js";

export async function stage({ canvas, hudCanvas, hud: hudOpts, pictures, options = {}, hold = 4.5, onShow, onFrame }) {
  const q = new URLSearchParams(location.search);
  const engine = new Nuee(canvas, { ...options, fixedDt: q.has("rec") ? 1 / 60 : 0 });
  const hud = hudCanvas ? new Hud(hudCanvas, engine, hudOpts) : null;
  const first = Math.min(pictures.length - 1, +(q.get("pic") || 0));
  const order = [first, ...pictures.map((_, i) => i).filter((i) => i !== first)];
  const slot = new Array(pictures.length);         // picture index -> engine form index
  const load = async (i) => {
    const p = pictures[i];
    slot[i] = await engine.addPicture(p.src, p.depth, { ...p, pic: i });
  };
  await load(order[0]);

  let next = hold, paused = q.has("still"), current = first;
  const api = {
    engine, hud,
    get current() { return current; },
    go(i, opts) {
      if (slot[i] === undefined || i === current) return;
      current = i;
      engine.show(slot[i], { ...pictures[i].move, ...opts });
      next = engine.time + hold + engine.o.spread + engine.o.gather;
      onShow && onShow(i);
    },
    next() { api.go((current + 1) % pictures.length); },
    pause(v = true) { paused = v; },
    // a pick by hand holds a little longer before the timer carries on
    pick(i) { api.go(i); next = engine.time + hold * 1.8 + engine.o.spread + engine.o.gather; },
  };
  window.nuee = api;
  onShow && onShow(first);
  const tick = (e, dt) => {
    if (!paused && pictures.every((_, i) => slot[i] !== undefined) && e.time >= next) api.next();
    onFrame && onFrame(e, dt, api);
    hud && hud.draw();
  };
  engine.start(tick);
  // steps the page by hand at 60 fps (for recording, or checking a page in a background tab)
  api.advance = (sec) => {
    const k = Math.max(1, Math.round(sec * 60));
    for (let i = 0; i < k; i++) { engine.step(1 / 60); tick(engine, 1 / 60); }
    engine.resize();
    engine.render();
    return engine.time;
  };
  // for checking: steps through a change and lays the frames out as a sheet over the page (api.filmstrip(null) clears it)
  api.filmstrip = (times, cols = 3, before) => {
    document.getElementById("filmstrip")?.remove();
    if (!times) return;
    const layers = [canvas, hudCanvas].filter(Boolean);
    const W = 480, H = Math.round((480 * innerHeight) / innerWidth), rows = Math.ceil(times.length / cols);
    const c = document.createElement("canvas");
    c.id = "filmstrip"; c.width = W * cols; c.height = H * rows;
    const bg = getComputedStyle(document.body).backgroundColor;
    Object.assign(c.style, { position: "fixed", left: 0, top: 0, width: "100%", height: "auto", zIndex: 99, background: bg, inset: "0 auto auto 0" });
    document.body.appendChild(c);
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    before && before();
    let last = 0;
    times.forEach((t, k) => {
      api.advance(Math.max(1 / 60, t - last)); last = t;
      const x = (k % cols) * W, y = Math.floor(k / cols) * H;
      layers.forEach((l) => g.drawImage(l, x, y, W, H));
      g.fillStyle = "#f0f"; g.font = "14px monospace"; g.fillText(t.toFixed(2) + "s", x + 6, y + 16);
    });
  };
  // for checking the hand: a scripted pointer along a path (screen units, -1..1) over dur seconds, filmed at times
  api.sweep = (path, dur, times, cols = 3) => {
    const at = (t) => {
      const u = Math.min(1, t / dur) * (path.length - 1), k = Math.min(path.length - 2, Math.floor(u)), f = u - k;
      return [path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f];
    };
    let t = 0;
    const steps = [];
    api.filmstrip(times, cols, () => {
      engine.setPointer(...at(0));
      const adv = api.advance;
      api.advance = (sec) => {
        const k = Math.max(1, Math.round(sec * 60));
        for (let i = 0; i < k; i++) { t += 1 / 60; engine.setPointer(...(t <= dur ? at(t) : at(dur))); adv.call(null, 1 / 60); }
        return engine.time;
      };
      steps.push(adv);
    });
    api.advance = steps[0];
    engine.setPointer(null);
  };
  for (const i of order.slice(1)) await load(i);
  document.documentElement.classList.add("loaded");
  // a melt pairs grains between pictures: work the pairings out behind the page, next-in-line first
  if ((options.travel ?? "swarm") === "melt") {
    const n = pictures.length, pairs = [];
    for (let d = 1; d < n; d++) for (let i = 0; i < n; i++) pairs.push([i, (i + d) % n]);
    (async () => { for (const [a, b] of pairs) await engine.prepare(slot[a], slot[b]); })();
  }
  return api;
}
