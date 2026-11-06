// Shedlight's site layer (design-system.md 4.15). Small things the engine leaves to the site:
//   - the visit block's live line, from the hours and the visitor's clock in Antwerp (in ?record: Sat 14 Nov, 14:32)
//   - the works list at the end: a row glides back to its work and lifts it (ctx.go("lift:<id>"))
//   - the demo notes: RSVP, and Enquire in the lift ("This is a demo — … switched off."), instead of leaving the page
//   - the plaster (07): its click area covers the whole form, its wall label carries the size, and it counts as seen
//     once its label has shown for 600 ms (the engine counts wall labels of paintings only)
//   - wall-label leaders never cross their own painting: the engine starts each line at the work's nearer top corner,
//     which cuts across the canvas when the label sits below a painting near the screen edge; here the line starts at
//     the nearest corner whose line stays off the canvas (pure geometry on what the art layer drew this frame)

import { art } from "../engine/ui/art.js";

const HOURS = { 0: [12, 17], 3: [11, 18], 4: [11, 18], 5: [11, 18], 6: [11, 18] };   // Sun, Wed–Sat; Mon, Tue closed
const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const pad = (n) => String(n).padStart(2, "0");

function antwerpNow() {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const parts = Object.fromEntries(f.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    return { wd, h: +parts.hour, m: +parts.minute };
  } catch {
    const d = new Date();
    return { wd: d.getDay(), h: d.getHours(), m: d.getMinutes() };
  }
}

/** "● SAT 14:32 · OPEN NOW, UNTIL 18:00" or "○ MON 09:10 · CLOSED · OPENS WED 11:00" */
export function liveLine({ wd, h, m }) {
  const now = h + m / 60, today = HOURS[wd];
  const at = `${DAY[wd]} ${pad(h)}:${pad(m)}`;
  if (today && now >= today[0] && now < today[1]) return { open: true, text: `${at} · OPEN NOW, UNTIL ${pad(today[1])}:00` };
  for (let i = 0; i < 8; i++) {
    const d = (wd + i) % 7, hrs = HOURS[d];
    if (!hrs || (i === 0 && now >= hrs[0])) continue;
    return { open: false, text: `${at} · CLOSED · OPENS ${DAY[d]} ${pad(hrs[0])}:00` };
  }
  return { open: false, text: `${at} · CLOSED` };
}

/** does the segment a→b pass through the inside of the convex quad (beyond a 3 px margin)? */
function crosses(a, b, quad) {
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  const shrunk = quad.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x - (dx / l) * 3, y - (dy / l) * 3]; });
  for (let i = 1; i < 24; i++) {
    const t = i / 24, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    if (inside([x, y], shrunk)) return true;
  }
  return false;
}
function inside([x, y], poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
  }
  return true;
}

export const shedlight = {
  name: "shedlight",

  mount(ctx) {
    // the live line
    const live = document.getElementById("v-live");
    if (live) {
      const paint = () => {
        const L = liveLine(ctx.record ? { wd: 6, h: 14, m: 32 } : antwerpNow());
        live.classList.toggle("is-open", L.open);
        live.querySelector(".v-live-text").textContent = L.text;
        live.querySelector(".v-dot").textContent = "";
        live.setAttribute("aria-label", `${L.open ? "Open" : "Closed"}: ${L.text}`);
      };
      paint();
      if (!ctx.record) setInterval(paint, 30000);   // wall clock for a wall clock, never for motion
    }
    // the works list: back to the wall, then lifted
    for (const b of document.querySelectorAll("[data-go]")) b.addEventListener("click", () => ctx.go(b.dataset.go));
    // the RSVP note
    for (const b of document.querySelectorAll("[data-note]")) b.addEventListener("click", () => {
      const n = document.getElementById(b.dataset.note);
      if (n) n.hidden = false;
    });
    // Enquire in the lift: show the note in place (capture, so the engine's own handler doesn't close the lift)
    document.addEventListener("click", (e) => {
      const a = e.target.closest?.(".tl-enquire");
      if (!a) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const row = a.closest(".tl-row");
      if (row && !row.parentElement.querySelector(".tl-note")) {
        const p = document.createElement("p");
        p.className = "tl-note";
        p.setAttribute("role", "status");
        p.textContent = "This is a demo — enquiries are switched off.";
        row.after(p);
      }
    }, true);
    this.plasterSeen = new ctx.Switch(ctx.clock);
  },

  step(s, ctx) {
    // 07 is seen once its wall label (the hall's hotspot) has shown for 600 ms
    const atHall = s.stop === "hall" || (s.kind === "move" && s.move?.id === "move-2" && s.move.t >= 0.96)
      || (s.kind === "end" && (s.k ?? 0) < 0.05);
    this.plasterSeen.set(atHall);
    if (this.plasterSeen.on && this.plasterSeen.age >= 600 && !ctx.seen.has("w07")) { ctx.seen.add("w07"); ctx.invalidate(); }
  },

  update(s, ctx) {
    // the plaster's click area: the whole form (its box on the hall frame), from the dot at its top
    const h = document.querySelector('.th[data-hotspot="o-07"]');
    if (h) {
      const w = ctx.data.artworks.w07, [x, y, bw, bh] = w.box;
      const a = ctx.toScreen([x, y]), b = ctx.toScreen([x + bw, y + bh]), dot = ctx.toScreen(ctx.data.stops.hall.hotspots[0].at);
      h.style.setProperty("--hit-l", `${(a[0] - dot[0]).toFixed(1)}px`);
      h.style.setProperty("--hit-t", `${(a[1] - dot[1] - 8).toFixed(1)}px`);
      h.style.setProperty("--hit-w", `${(b[0] - a[0]).toFixed(1)}px`);
      h.style.setProperty("--hit-h", `${(b[1] - a[1] + 8).toFixed(1)}px`);
      const meta = h.querySelector(".th-plate");
      if (meta && !meta.querySelector(".th-ws")) {
        const sz = document.createElement("span");
        sz.className = "th-ws";
        sz.innerHTML = `<i class="ta-bar" style="width:${Math.round((65 / 100) * 24)}px"></i><em class="t-num">${w.size.join(" × ")} cm</em>`;
        meta.append(sz);
        ctx.invalidate();
      }
    }
    this.leaders();
    // Enquire reads as a button with its arrow
    const enq = document.querySelector(".tl-enquire:not([data-shed])");
    if (enq) { enq.dataset.shed = "1"; enq.textContent = "Enquire →"; }
  },

  /** after the engine's paint: re-anchor each wall label's line on its work */
  leaders() {
    const drawn = art.drawn ?? [];
    for (const [wid, lb] of Object.entries(art.labels ?? {})) {
      const ln = lb.line;
      if (!ln || ln.style.display === "none") continue;
      const q = drawn.find((w) => w.wid === wid);
      if (!q) continue;
      const ax = +ln.getAttribute("x2"), ay = +ln.getAttribute("y2");
      let best = null;
      for (const c of q.px) {
        if (crosses(c, [ax, ay], q.px)) continue;
        const d = Math.hypot(c[0] - ax, c[1] - ay);
        if (!best || d < best.d) best = { c, d };
      }
      if (!best) continue;
      ln.setAttribute("x1", best.c[0].toFixed(1));
      ln.setAttribute("y1", best.c[1].toFixed(1));
    }
  },

  reset(ctx) {
    this.plasterSeen?.set(false);
    for (const n of document.querySelectorAll(".v-note")) n.hidden = true;
  },
};
