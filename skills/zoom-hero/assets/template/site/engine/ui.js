// Loupe UI: everything on top of the picture that every demo shares. The page lays it out; this fills it in.
//
//   const ui = bindUI(lp, stage, { content, thumbs })
//
// Elements a page can place anywhere (all optional):
//   [data-lp="copy"]     the level's words (content[id]: kicker, title, text, facts), swapped on every arrival
//   [data-lp="span"]     how wide the view is across the screen, live while diving ("18.4 cm")
//   [data-lp="mag"]      magnification since the first level, live ("×1,240")
//   [data-lp="depth"]    "02 / 04"
//   [data-lp="name"]     the level's name
//   [data-lp="ruler"]    a log scale with the levels on the way down; click a level to go there
//                        (data-orient="h" lays it along the bottom: biggest on the left)
//   [data-lp="crumbs"]   the path from the first level, with small round pictures; click to climb back
//   [data-lp="back"]     zooms out one level (also Esc, ↑, scroll up)
//   [data-lp="hint"]     shown until the first dive
// Made here, inside the stage: one spot per child of the level (click to dive; also ↓, Enter, 1–9, scroll down),
// the frame that marks where a dive is going, and the viewfinder corners.
// On <html>: data-level, data-depth, data-moving, --lp-depth (continuous), --lp-go (0..1 through a move).
//
// With a mouse, the system cursor stays as it is (a zoom-in magnifier over spots) and a loupe ring opens on the spot
// it is over, centred on the spot rather than chasing the pointer, so nothing lags (saying "Look", or
// content[id].cursor). cursor: false turns the ring off.
//
//   content[id] = { name, spot, kicker, title, text, facts: [[label, value]…], at: [u, v] (spot inside its area),
//                   notes: [{ at: [u, v], text, side: "left" | "right" }] (labels pinned to the picture at rest) }
//   ui.lock(id, true)    hide a spot (a game can unlock it later); ui.tour() plays the main dives (?tour)

const SPAN_UNITS = [[1000, "km"], [1, "m"], [0.01, "cm"], [0.001, "mm"], [1e-6, "µm"], [1e-9, "nm"]];

export function fmtSpan(m) {
  if (!m) return "";
  for (const [u, name] of SPAN_UNITS) {
    if (m >= u * 0.9995) {
      const x = m / u;
      return `${x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2)} ${name}`;
    }
  }
  return `${(m / 1e-9).toFixed(2)} nm`;
}

export function fmtMag(x) {
  if (x < 10) return `×${x.toFixed(1)}`;
  return `×${Math.round(x).toLocaleString("en-US")}`;
}

const pad = (n) => String(n).padStart(2, "0");
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function bindUI(lp, stage, { content = {}, thumbs = {}, render, cursor = true } = {}) {
  const root = document.documentElement;
  const q = (name) => [...document.querySelectorAll(`[data-lp="${name}"]`)];
  const locked = new Set();
  const name = (id) => content[id]?.name ?? id;
  const maxDepth = Math.max(...Object.keys(lp.nodes).map((id) => lp.node(id).depth));
  let dived = false;
  let hover = null;

  // ---- layers made here ------------------------------------------------------------------------------------
  const spotLayer = el("div", "lp-spots");
  const noteLayer = el("div", "lp-notes");
  const frame = el("div", "lp-frame", "<i></i><i></i><i></i><i></i><span class=\"lp-frame-tag\"></span>");
  const corners = el("div", "lp-corners", "<i></i><i></i><i></i><i></i><b class=\"lp-reticle\"></b>");
  stage.append(corners, noteLayer, frame, spotLayer);
  const frameTag = frame.querySelector(".lp-frame-tag");

  // ---- notes: labels pinned to the level's picture ---------------------------------------------------------
  let notes = [];
  function makeNotes() {
    noteLayer.classList.remove("on");
    noteLayer.replaceChildren();
    notes = (content[lp.level]?.notes ?? []).map((n, i) => {
      const e = el("div", `lp-note ${n.side ?? "right"}`, `<i></i><span>${n.text}</span>`);
      e.style.setProperty("--i", i);
      noteLayer.append(e);
      return { n, e };
    });
    placeNotes();
    // a label that would run off the screen goes on the other side of its dot
    const box = stage.getBoundingClientRect();
    for (const { e } of notes) {
      const r = e.querySelector("span").getBoundingClientRect();
      if (r.left < box.left + 6 && e.classList.contains("left")) e.classList.replace("left", "right");
      else if (r.right > box.right - 6 && e.classList.contains("right")) e.classList.replace("right", "left");
    }
    requestAnimationFrame(() => requestAnimationFrame(() => noteLayer.classList.add("on")));
  }
  function placeNotes() {
    if (!notes.length) return;
    const r = lp.screenRect(lp.level), W = stage.clientWidth, H = stage.clientHeight;
    for (const { n, e } of notes) {
      const x = r.x + r.w * n.at[0], y = r.y + r.h * n.at[1];
      e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      e.style.visibility = x < 12 || y < 12 || x > W - 12 || y > H - 12 ? "hidden" : "";   // its point is off screen (phones)
    }
  }

  // ---- spots: one per child of the level -------------------------------------------------------------------
  let spots = [];
  function makeSpots() {
    spotLayer.replaceChildren();
    const kids = lp.children(lp.level).filter((id) => !locked.has(id));
    spots = kids.map((id, i) => {
      const c = content[id] ?? {};
      const b = el("button", "lp-spot");
      b.type = "button";
      b.dataset.id = id;
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", `Look closer: ${c.spot ?? name(id)}`);
      b.innerHTML = `<span class="lp-spot-dot"></span><span class="lp-spot-label"><b>${pad(i + 1)}</b><span>${c.spot ?? name(id)}</span><em>${fmtSpan(lp.node(id).span)}</em></span>`;
      b.addEventListener("click", () => dive(id));
      b.addEventListener("pointerenter", () => { hover = id; });
      b.addEventListener("pointerleave", () => { if (hover === id) hover = null; });
      b.addEventListener("focus", () => { hover = id; });
      b.addEventListener("blur", () => { if (hover === id) hover = null; });
      spotLayer.append(b);
      return { id, b };
    });
    requestAnimationFrame(() => spotLayer.classList.add("on"));
  }

  const spotAt = {};   // each spot's place on screen, for the loupe ring
  function placeSpots() {
    const W = stage.clientWidth, H = stage.clientHeight, m = 26;
    for (const { id, b } of spots) {
      const r = lp.screenRect(id);
      const [u, v] = content[id]?.at ?? [0.5, 0.5];
      let x = r.x + r.w * u, y = r.y + r.h * v;
      const out = x < m || y < m || x > W - m || y > H - m;
      if (out) {
        const ang = Math.atan2(y - H / 2, x - W / 2);
        x = Math.min(W - m, Math.max(m, x));
        y = Math.min(H - m, Math.max(m, y));
        b.style.setProperty("--edge", `${ang}rad`);
      }
      b.classList.toggle("edge", out);
      b.classList.toggle("flip", x > W * 0.72);
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      spotAt[id] = [x, y];
    }
  }

  // ---- the frame: where a dive is going (or the level a climb is leaving) ------------------------------------
  let frameFor = null, frameMode = null;
  function placeFrame(state) {
    let id = null, alpha = 0;
    if (state.moving && frameFor) {
      id = frameFor;
      const r = lp.screenRect(id), W = stage.clientWidth;
      // shows while the area is smaller than the screen; gone as it fills it
      const share = r.w / W;
      alpha = frameMode === "down" ? Math.min(1, Math.max(0, (1.05 - share) / 0.35)) : Math.min(1, Math.max(0, (1.1 - share) / 0.4));
    } else if (hover && !state.moving) {
      id = hover;
      alpha = 1;
    }
    frame.classList.toggle("on", alpha > 0.01);
    if (!id) return;
    const r = lp.screenRect(id);
    frame.style.opacity = alpha.toFixed(3);
    frame.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`;
    frame.style.width = `${r.w.toFixed(1)}px`;
    frame.style.height = `${r.h.toFixed(1)}px`;
    const n = lp.node(id);
    const tag = `${fmtMag(lp.node(lp.rootId).span / (n.span || 1))} · ${fmtSpan(n.span)}`;
    if (frameTag.textContent !== tag) frameTag.textContent = tag;
  }

  // ---- readouts --------------------------------------------------------------------------------------------
  const set = (els, text) => { for (const e of els) if (e.textContent !== text) e.textContent = text; };
  const spanEls = q("span"), magEls = q("mag"), depthEls = q("depth"), nameEls = q("name");
  function readouts(state) {
    set(spanEls, fmtSpan(state.span));
    set(magEls, fmtMag(state.mag));
    set(depthEls, `${pad(Math.round(state.depth) + 1)} / ${pad(maxDepth + 1)}`);
    root.style.setProperty("--lp-depth", state.depth.toFixed(4));
  }

  // ---- ruler: a log scale from the widest view to the closest ---------------------------------------------
  const rulers = q("ruler");
  const spans = Object.keys(lp.nodes).map((id) => lp.node(id).span).filter(Boolean);
  const top = Math.max(...spans) * 1.6, bottom = Math.min(...spans) / 1.6;
  const pos = (s) => (Math.log(top) - Math.log(s)) / (Math.log(top) - Math.log(bottom));
  function buildRuler() {
    for (const r of rulers) {
      r.replaceChildren();
      r.classList.add("lp-ruler");
      const scale = el("div", "lp-ruler-scale");
      for (let e = Math.floor(Math.log10(bottom)); e <= Math.ceil(Math.log10(top)); e++) {
        for (let m = 1; m < 10; m++) {
          const s = m * 10 ** e;
          if (s < bottom || s > top) continue;
          const t = el("i", m === 1 ? "major" : "");
          t.style.setProperty("--at", `${(pos(s) * 100).toFixed(3)}%`);
          if (m === 1) t.dataset.label = fmtSpan(s).replace(/^(\d+)\.0+ /, "$1 ");
          scale.append(t);
        }
      }
      const marks = el("div", "lp-ruler-marks");
      const path = lp.path;
      const next = lp.children(lp.level).filter((id) => !locked.has(id));
      for (const id of [...path, ...next]) {
        const n = lp.node(id);
        if (!n.span) continue;
        const b = el("button", `lp-mark${path.includes(id) ? "" : " next"}${id === lp.level ? " here" : ""}`, `<span>${name(id)}</span>`);
        b.type = "button";
        b.title = name(id);
        b.style.setProperty("--at", `${(pos(n.span) * 100).toFixed(3)}%`);
        b.addEventListener("click", () => dive(id));
        marks.append(b);
      }
      const needle = el("div", "lp-ruler-needle", "<span></span>");
      r.append(scale, marks, needle);
    }
  }
  function moveNeedle(state) {
    for (const r of rulers) {
      const n = r.querySelector(".lp-ruler-needle");
      if (!n) continue;
      n.style.setProperty("--at", `${(pos(state.span) * 100).toFixed(3)}%`);
      const s = n.firstChild, t = fmtSpan(state.span);
      if (s.textContent !== t) s.textContent = t;
    }
  }

  // ---- crumbs ----------------------------------------------------------------------------------------------
  const crumbs = q("crumbs");
  function buildCrumbs(pending) {
    for (const c of crumbs) {
      c.replaceChildren();
      c.classList.add("lp-crumbs");
      const ids = [...lp.path];
      if (pending && !ids.includes(pending)) ids.push(pending);
      ids.forEach((id, i) => {
        const b = el("button", `lp-crumb${id === lp.level ? " here" : ""}${id === pending ? " pending" : ""}`);
        b.type = "button";
        b.innerHTML = `${thumbs[id] ? `<img src="${thumbs[id]}" alt="">` : ""}<span>${name(id)}</span>`;
        b.addEventListener("click", () => dive(id));
        if (i) c.append(el("i", "lp-crumb-sep"));
        c.append(b);
      });
    }
  }

  // ---- copy ------------------------------------------------------------------------------------------------
  const copies = q("copy");
  const defaultRender = (id) => {
    const c = content[id] ?? {};
    const n = lp.node(id);
    const facts = (c.facts ?? []).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    return `<p class="lp-kicker"><span>${pad(n.depth + 1)}</span>${c.kicker ?? name(id)}</p>` +
      (c.title ? `<h2 class="lp-title">${c.title}</h2>` : "") +
      (c.text ? `<p class="lp-text">${c.text}</p>` : "") +
      (facts ? `<dl class="lp-facts">${facts}</dl>` : "");
  };
  const retire = (box) => { if (box.classList.contains("out")) return; box.classList.add("out"); setTimeout(() => box.remove(), 650); };
  function showCopy(id) {
    for (const c of copies) {
      for (const old of c.querySelectorAll(".lp-copy-in")) retire(old);
      const box = el("div", "lp-copy-in", (render ?? defaultRender)(id, content[id] ?? {}, lp));
      box.dataset.level = id;
      c.append(box);
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("on")));
    }
  }
  function hideCopy() {
    for (const c of copies) for (const b of c.querySelectorAll(".lp-copy-in")) retire(b);
  }

  // ---- moving ----------------------------------------------------------------------------------------------
  function dive(id) {
    if (lp.state.moving || id === lp.level) return;
    return lp.go(id);
  }
  const back = () => { if (!lp.state.moving) return lp.back(); };
  for (const b of q("back")) b.addEventListener("click", back);

  lp.on("depart", ({ from, to, ids }) => {
    dived = true;
    root.dataset.moving = "1";
    root.dataset.dir = lp.node(to).depth > lp.node(from).depth ? "down" : "up";
    for (const h of q("hint")) h.classList.add("gone");
    spotLayer.classList.remove("on");
    noteLayer.classList.remove("on");
    hover = null;
    const down = lp.node(to).depth > lp.node(from).depth && lp.lineage(to).includes(from);
    frameMode = down ? "down" : "up";
    frameFor = down ? ids[1] : from;
    hideCopy();
    buildCrumbs(down ? to : null);
    root.style.setProperty("--lp-go", "0");
  });
  lp.on("arrive", ({ level }) => {
    delete root.dataset.moving;
    root.dataset.level = level;
    root.dataset.depth = lp.node(level).depth;
    frameFor = null;
    makeSpots();
    makeNotes();
    buildRuler();
    buildCrumbs();
    showCopy(level);
    for (const b of q("back")) b.disabled = !lp.parentOf(level);
    for (const n of nameEls) n.textContent = name(level);
    root.style.setProperty("--lp-go", "1");
  });
  lp.on("frame", (state) => {
    placeSpots();
    placeNotes();
    placeFrame(state);
    readouts(state);
    moveNeedle(state);
    if (state.moving && lp.seg) {
      // the frame follows the area being entered or left, from leg to leg of a long move
      const { from, to, dir } = lp.seg;
      frameFor = dir > 0 ? to : from;
      frameMode = dir > 0 ? "down" : "up";
    }
  });
  lp.on("loading", (on) => stage.classList.toggle("lp-loading", on));

  // ---- keys, wheel, touch ----------------------------------------------------------------------------------
  const visibleKids = () => lp.children(lp.level).filter((id) => !locked.has(id));
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    if (["Escape", "Backspace", "ArrowUp", "-"].includes(e.key)) { e.preventDefault(); back(); }
    else if (["ArrowDown", "+", "="].includes(e.key) || (e.key === "Enter" && !e.target.closest?.("button, a"))) { const k = visibleKids()[0]; if (k) { e.preventDefault(); dive(k); } }
    else if (/^[1-9]$/.test(e.key)) { const k = visibleKids()[Number(e.key) - 1]; if (k) dive(k); }
  });
  let wheel = 0, quietUntil = 0;
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (lp.state.moving || performance.now() < quietUntil) { wheel = 0; return; }
    wheel += e.deltaY;
    if (Math.abs(wheel) < 90) return;
    const dir = Math.sign(wheel);
    wheel = 0;
    quietUntil = performance.now() + 700;
    if (dir > 0) { const k = (hover && visibleKids().includes(hover)) ? hover : visibleKids()[0]; if (k) dive(k); }
    else back();
  }, { passive: false });
  lp.on("arrive", () => { quietUntil = performance.now() + 450; });
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" && !e.target.closest(".lp-spot, button, a")) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener("pointermove", (e) => { if (!drag) return; lp.pan(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; });
  addEventListener("pointerup", () => { drag = null; });

  // ---- the loupe ring: the system cursor stays (no lag); a ring opens on the spot it is over --------------
  if (cursor && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const cur = el("div", "lp-cursor off", "<i></i><span></span>");
    const label = cur.querySelector("span");
    stage.append(cur);
    const sit = () => {
      const on = hover && !lp.state.moving && spotAt[hover];
      cur.classList.toggle("spot", !!on);
      cur.classList.toggle("off", !on);
      if (on) {
        const [x, y] = spotAt[hover];
        cur.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        const t = content[hover]?.cursor ?? "Look";
        if (label.textContent !== t) label.textContent = t;
      }
      requestAnimationFrame(sit);
    };
    requestAnimationFrame(sit);
  }

  // ---- first state -----------------------------------------------------------------------------------------
  root.dataset.level = lp.level;
  root.dataset.depth = lp.node(lp.level).depth;
  makeSpots();
  makeNotes();
  buildRuler();
  buildCrumbs();
  showCopy(lp.level);
  readouts(lp.state);
  moveNeedle(lp.state);
  for (const b of q("back")) b.disabled = !lp.parentOf(lp.level);
  for (const n of nameEls) n.textContent = name(lp.level);
  placeSpots();
  placeNotes();

  const ui = {
    lock(id, on = true) { if (on) locked.add(id); else locked.delete(id); if (!lp.state.moving) { makeSpots(); buildRuler(); } },
    locked: (id) => locked.has(id),
    dive, back,
    get dived() { return dived; },
    // the main dives for video: down the first branch, back up, down the second; then again
    async tour({ hold = 1.4, plan } = {}) {
      const wait = (s) => new Promise((r) => {
        if (!lp.record) return setTimeout(r, s * 1000);
        const t0 = lp.time;
        const off = lp.on("frame", () => { if (lp.time - t0 >= s) { off(); r(); } });
      });
      const main = (from) => {
        const out = [];
        for (let id = from; ;) {
          id = lp.children(id).find((k) => !locked.has(k));
          if (!id) return out;
          out.push(id);
        }
      };
      const steps = plan ?? [...main(lp.rootId), lp.rootId, ...(lp.children(lp.rootId)[1] ? [lp.children(lp.rootId)[1], ...main(lp.children(lp.rootId)[1])] : []), lp.rootId];
      await wait(hold);
      for (const id of steps) {
        await lp.go(id);
        await wait(lp.children(id).length ? hold : hold * 1.5);
      }
    },
  };
  return ui;
}
