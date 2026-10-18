// The lab behind and around the exploded subject in scene 2, one style per kind of subject.
// Each style builds into api.bg (behind the subject) and api.fg (in front of it) and may define:
//   layout()             after a resize; api.toScreen(u, v) maps the stage (0–1 each way) to the window
//   update(p, t)         on every scroll step; t.explode, t.chart and t.hold run 0 → 1
//   idle(ms, p)          every animation frame, for motion that runs on its own
// Words and numbers come from page.lab; all of it is made up for the demos.

const NS = "http://www.w3.org/2000/svg";
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const count = (to, t, digits = 0) => (to * clamp(t)).toFixed(digits);

// —— Ticket: the kitchen's order ticket, a flat-top glowing below, smoke, the calories huge behind ——
function ticket(api) {
  const L = api.page.lab, tk = L.ticket;
  api.bg.innerHTML = `
    <div class="tk-fill"></div>
    <div class="tk-numeral">${esc(L.numeral)}<small>${esc(L.numeralUnit ?? "")}</small></div>
    <svg class="tk-heat" viewBox="0 0 1000 160" preserveAspectRatio="none">
      <defs><linearGradient id="tkg" x1="0" x2="1"><stop offset="0" stop-color="#ff5a1f" stop-opacity="0"/><stop offset=".5" stop-color="#ff7a2a"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></linearGradient>
      <filter id="tkb"><feGaussianBlur stdDeviation="3"/></filter></defs>
      ${Array.from({ length: 7 }, (_, i) => `<line x1="0" x2="1000" y1="${40 + i * 18}" y2="${40 + i * 18}" stroke="url(#tkg)" stroke-width="${2 + i * 0.6}" opacity="${0.12 + i * 0.07}" filter="url(#tkb)"/>`).join("")}
    </svg>
    <div class="tk-smoke">${"<i></i>".repeat(7)}</div>`;
  api.fg.innerHTML = `
    <div class="tk-ticket">
      <header><b>${esc(tk.head)}</b><span>${esc(tk.order)}</span></header>
      <ul>${tk.lines.map(([a, b]) => `<li><span>${esc(a)}</span><span>${esc(b)}</span></li>`).join("")}</ul>
      <div class="tk-macros">${tk.macros.map(([n, v, u]) => `<div><span>${esc(n)}</span><i><em data-v="${v}"></em></i><b>${v} ${esc(u)}</b></div>`).join("")}</div>
      <div class="tk-timer"><span>${esc(tk.timerLabel)}</span><b>0:00</b></div>
      <footer>${esc(tk.foot)}</footer>
    </div>`;
  const rows = [...api.fg.querySelectorAll("li")], bars = [...api.fg.querySelectorAll(".tk-macros em")], timer = api.fg.querySelector(".tk-timer b");
  const max = Math.max(...tk.macros.map((m) => m[1]));
  return {
    update(p, t) {
      rows.forEach((r, i) => { r.style.opacity = clamp(t.chart * (rows.length + 2) - i); });
      bars.forEach((b) => { b.style.transform = `scaleX(${(b.dataset.v / max) * clamp(t.chart * 1.4 - 0.3)})`; });
      const s = Math.round(tk.timer * clamp(t.hold * 1.3));
      timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    },
  };
}

// —— Sound: an anechoic chamber's foam, the frequency response running through the cups, rings from each driver ——
function sound(api) {
  const L = api.page.lab;
  // a smooth, believable headphone response: a little bass lift, a presence bump, a gentle top roll-off
  const db = (f) => {
    const g = (c, w, a) => a * Math.exp(-Math.pow(Math.log10(f / c) / w, 2));
    return 3.5 / (1 + Math.pow(f / 120, 2)) + g(1000, 0.25, -1) + g(3200, 0.18, 3) + g(6500, 0.08, -2.2) + g(10500, 0.08, 1.6) - 7 / (1 + Math.pow(16000 / f, 4));
  };
  const lo = Math.log10(20), hi = Math.log10(40000), X = (f) => (Math.log10(f) - lo) / (hi - lo);
  const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 40000];
  const name = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
  api.bg.innerHTML = `
    <div class="sd-fill"></div>
    <svg class="sd-foam" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 800">
      <defs><pattern id="sdw" width="80" height="80" patternUnits="userSpaceOnUse">
        <polygon points="0,0 80,0 40,40" fill="#efebe4"/><polygon points="80,0 80,80 40,40" fill="#d6d0c6"/>
        <polygon points="0,80 80,80 40,40" fill="#cbc4b9"/><polygon points="0,0 0,80 40,40" fill="#e2ddd4"/>
      </pattern></defs>
      <rect width="1200" height="800" fill="url(#sdw)"/>
    </svg>
    <svg class="sd-graph"><g class="sd-lines"></g><path class="sd-curve"/></svg>
    <div class="sd-axis"></div>
    <div class="sd-rings">${L.drivers.map(() => `<div class="sd-ring">${"<i></i>".repeat(4)}</div>`).join("")}</div>`;
  const cells = 28;
  api.fg.innerHTML = `
    <div class="sd-readout">
      <span class="sd-cap">${esc(L.readout.caption)}</span>
      <div class="sd-big"><b>0</b><span>${esc(L.readout.unit)}</span></div>
      <div class="sd-meter">${"<i></i>".repeat(cells)}</div>
      <ul>${L.facts.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join("")}</ul>
    </div>`;
  const curve = api.bg.querySelector(".sd-curve"), graph = api.bg.querySelector(".sd-graph"), grid = graph.querySelector(".sd-lines"), axis = api.bg.querySelector(".sd-axis");
  const rings = [...api.bg.querySelectorAll(".sd-ring")], num = api.fg.querySelector(".sd-big b"), meter = [...api.fg.querySelectorAll(".sd-meter i")];
  let len = 1;
  return {
    // the response drawn in window pixels, in a band through the drivers, so its line stays crisp at any size
    layout() {
      const { vw, vh } = api, pts = L.drivers.map(([u, v]) => api.toScreen(u, v));
      rings.forEach((r, i) => Object.assign(r.style, { left: `${pts[i][0]}px`, top: `${pts[i][1]}px` }));
      const x0 = vw * 0.04, x1 = vw * 0.96, cy = pts[0][1], dbPx = (vh * 0.34) / 24;
      const gx = (f) => x0 + X(f) * (x1 - x0), gy = (v) => cy - v * dbPx;
      graph.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      grid.innerHTML = [-10, -5, 0, 5, 10].map((v) => `<line class="sd-grid${v ? "" : " sd-zero"}" x1="${x0}" x2="${x1}" y1="${gy(v)}" y2="${gy(v)}"/>`).join("")
        + ticks.map((f) => `<line class="sd-grid" x1="${gx(f)}" x2="${gx(f)}" y1="${gy(10)}" y2="${gy(-10)}"/>`).join("");
      let d = "";
      for (let k = 0; k <= 400; k++) { const f = Math.pow(10, lo + ((hi - lo) * k) / 400); d += `${k ? "L" : "M"}${gx(f).toFixed(1)},${gy(db(f)).toFixed(1)}`; }
      curve.setAttribute("d", d);
      len = curve.getTotalLength() || 1;
      curve.style.strokeDasharray = `${len}`;
      axis.innerHTML = [20, 100, 1000, 10000, 40000].map((f) => `<span style="left:${gx(f)}px;top:${gy(-10) + 8}px">${name(f)}${f === 40000 ? " Hz" : ""}</span>`).join("");
    },
    update(p, t) {
      curve.style.strokeDashoffset = `${len * (1 - clamp(t.chart * 1.15))}`;
      num.textContent = `${t.chart > 0 ? "−" : ""}${count(Math.abs(L.readout.value), t.chart * 1.2)}`;
      meter.forEach((c, i) => c.classList.toggle("on", i / cells < clamp(t.chart * 1.2) * L.readout.level));
      rings.forEach((r) => { r.style.opacity = clamp(t.explode * 2 - 0.6); });
    },
  };
}

// —— Motion: a running track, motion-capture markers, the foot's pressure map, the foam's energy return ——
function motion(api) {
  const L = api.page.lab;
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  api.bg.innerHTML = `
    <div class="mo-fill"></div>
    <svg class="mo-track" viewBox="0 0 1000 400" preserveAspectRatio="none">
      ${Array.from({ length: 9 }, (_, i) => { const x = -400 + i * 225; return `<line x1="${500 + (x - 500) * 0.08}" y1="0" x2="${x}" y2="400"/>`; }).join("")}
      ${Array.from({ length: 6 }, (_, i) => { const y = 400 * Math.pow(i / 6, 1.8); return `<line class="mo-cross" x1="0" x2="1000" y1="${y}" y2="${y}"/>`; }).join("")}
    </svg>
    <div class="mo-markers">${Array.from({ length: L.markers }, (_, i) => `<i style="left:${31 + rnd(i) * 32}%;top:${10 + rnd(i + 40) * 80}%;--d:${(rnd(i + 80) * 3).toFixed(2)}s"><span>M${String(i + 1).padStart(2, "0")}</span></i>`).join("")}</div>`;
  api.fg.innerHTML = `
    <div class="mo-heat">
      <p class="mo-cap">${esc(L.heat.caption)}</p>
      <svg viewBox="0 0 120 300">
        <defs>
          <clipPath id="mosole"><path d="M60 8 C88 8 104 40 104 86 C104 120 92 142 88 170 C84 200 92 230 88 258 C84 282 72 294 58 294 C42 294 30 282 28 260 C26 236 34 206 30 176 C26 146 14 124 16 88 C18 40 34 8 60 8 Z"/></clipPath>
          <radialGradient id="mohot"><stop offset="0" stop-color="#fff6b0"/><stop offset=".3" stop-color="#ffb21e"/><stop offset=".62" stop-color="#ff3d2e" stop-opacity=".85"/><stop offset="1" stop-color="#ff3d2e" stop-opacity="0"/></radialGradient>
          <radialGradient id="mocool"><stop offset="0" stop-color="#3be0ff" stop-opacity=".8"/><stop offset="1" stop-color="#2c5bff" stop-opacity="0"/></radialGradient>
        </defs>
        <g clip-path="url(#mosole)">
          <rect width="120" height="300" fill="#1c2a5c"/>
          <circle cx="60" cy="170" r="70" fill="url(#mocool)"/>
          <circle class="mo-blob" data-k="0" cx="58" cy="250" r="44" fill="url(#mohot)"/>
          <circle class="mo-blob" data-k="1" cx="74" cy="175" r="30" fill="url(#mohot)"/>
          <circle class="mo-blob" data-k="2" cx="58" cy="92" r="46" fill="url(#mohot)"/>
          <circle class="mo-blob" data-k="3" cx="44" cy="38" r="22" fill="url(#mohot)"/>
        </g>
        <path class="mo-outline" d="M60 8 C88 8 104 40 104 86 C104 120 92 142 88 170 C84 200 92 230 88 258 C84 282 72 294 58 294 C42 294 30 282 28 260 C26 236 34 206 30 176 C26 146 14 124 16 88 C18 40 34 8 60 8 Z"/>
      </svg>
      <div class="mo-scale"><span>${esc(L.heat.low)}</span><i></i><span>${esc(L.heat.high)}</span></div>
    </div>
    <div class="mo-stats">
      <div class="mo-big"><b>0</b><i>%</i></div>
      <p class="mo-cap">${esc(L.big.caption)}</p>
      <div class="mo-bars">${L.compare.map(([n, v]) => `<div><span>${esc(n)}</span><i><em data-v="${v}"></em></i><b>${v}%</b></div>`).join("")}</div>
      <ul>${L.facts.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul>
    </div>`;
  const big = api.fg.querySelector(".mo-big b"), bars = [...api.fg.querySelectorAll(".mo-bars em")], blobs = [...api.fg.querySelectorAll(".mo-blob")];
  let hold = 0;
  return {
    update(p, t) {
      big.textContent = count(L.big.value, t.chart * 1.2);
      bars.forEach((b) => { b.style.transform = `scaleX(${(b.dataset.v / 100) * clamp(t.chart * 1.3 - 0.2)})`; });
      hold = t.hold;
    },
    // a stride, over and over: heel strike, roll through the midfoot, push off the forefoot and big toe
    idle(ms) {
      const s = (ms / 1400) % 1;
      const w = [Math.exp(-Math.pow((s - 0.12) / 0.14, 2)), Math.exp(-Math.pow((s - 0.38) / 0.14, 2)), Math.exp(-Math.pow((s - 0.62) / 0.14, 2)), Math.exp(-Math.pow((s - 0.8) / 0.1, 2))];
      blobs.forEach((b, i) => { b.style.opacity = (0.25 + 0.75 * w[i]).toFixed(3); });
    },
  };
}

// —— Energy: contour lines of the site, the sun's path across the day, energy flowing sun → roof → battery → floor ——
function energy(api) {
  const L = api.page.lab;
  // contour lines of a gentle hill, from a few layered sines (the same every time)
  const rings = Array.from({ length: 14 }, (_, k) => {
    const r0 = 60 + k * 46;
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r = r0 * (1 + 0.08 * Math.sin(3 * a + k * 0.4) + 0.05 * Math.sin(5 * a - k * 0.7) + 0.03 * Math.sin(9 * a + k));
      d += `${i ? "L" : "M"}${(620 + r * Math.cos(a) * 1.3).toFixed(1)},${(470 + r * Math.sin(a)).toFixed(1)}`;
    }
    return `<path d="${d}Z" class="${k % 5 === 4 ? "en-major" : ""}"/>`;
  }).join("");
  api.bg.innerHTML = `
    <div class="en-fill"></div>
    <svg class="en-contours" viewBox="0 0 1240 900" preserveAspectRatio="xMidYMid slice">${rings}</svg>
    <svg class="en-sunpath"><path class="en-arc"/><g class="en-ticks"></g><circle class="en-sun" r="9"/></svg>
    <div class="en-north"><b>N</b><i></i></div>`;
  api.fg.innerHTML = `
    <svg class="en-flow"><path class="en-flow-base"/><path class="en-flow-run"/><g class="en-flow-tags"></g></svg>
    <div class="en-panel">
      <p class="en-cap">${esc(L.legend.caption)}</p>
      <div class="en-scale"><i></i><div><span>${esc(L.legend.low)}</span><span>${esc(L.legend.high)}</span></div></div>
      <ul>${L.facts.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul>
    </div>`;
  const sunpath = api.bg.querySelector(".en-sunpath"), arc = sunpath.querySelector(".en-arc"), ticks = sunpath.querySelector(".en-ticks"), sun = sunpath.querySelector(".en-sun");
  const flow = api.fg.querySelector(".en-flow"), base = flow.querySelector(".en-flow-base"), run = flow.querySelector(".en-flow-run"), tags = flow.querySelector(".en-flow-tags");
  let A = null, len = 1;
  const sunAt = (k) => { const a = Math.PI * (1 - k); return [A.cx + A.r * Math.cos(a), A.cy - A.r * Math.sin(a) * 0.55]; };
  return {
    layout() {
      const { vw, vh, mobile } = api;
      sunpath.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      flow.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      A = mobile ? { cx: vw * 0.78, cy: vh * 0.3, r: vw * 0.16 } : { cx: vw * 0.15, cy: vh * 0.44, r: vw * 0.09 };
      const [x0, y0] = sunAt(0), [x1, y1] = sunAt(1);
      arc.setAttribute("d", `M${x0},${y0} Q${A.cx},${A.cy - A.r * 1.1} ${x1},${y1}`);
      ticks.innerHTML = Array.from({ length: 13 }, (_, i) => {
        const [x, y] = sunAt(i / 12);
        return `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.6 : 2.6}"/>${i % 3 ? "" : `<text x="${x}" y="${y + 20}">${String(6 + i).padStart(2, "0")}</text>`}`;
      }).join("");
      // the energy's path: from the sun at midday down through the roof, the battery and into the floor
      const pts = [sunAt(0.5), ...L.flow.map(([u, v]) => api.toScreen(u, v))];
      base.setAttribute("d", pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" "));
      run.setAttribute("d", base.getAttribute("d"));
      len = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
      base.style.strokeDasharray = `${len}`;
      tags.innerHTML = L.flowTags.map((tag, i) => {
        const [x, y] = pts[i + 1];
        return `<g transform="translate(${x},${y})"><circle r="6"/><text x="-14" y="-3">${esc(tag[0])}</text><text class="en-flow-sub" x="-14" y="12">${esc(tag[1])}</text></g>`;
      }).join("");
    },
    update(p, t) {
      if (!A) return;
      const [x, y] = sunAt(clamp(t.hold * 1.1));
      sun.setAttribute("cx", x); sun.setAttribute("cy", y);
      base.style.strokeDashoffset = `${len * (1 - clamp(t.chart * 1.1))}`;
      run.style.opacity = clamp(t.chart * 2 - 1);
      tags.style.opacity = clamp(t.chart * 2 - 1);
    },
  };
}

export const labs = { ticket, sound, motion, energy };
