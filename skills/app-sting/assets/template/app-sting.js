/*
 * app-sting.js · App Sting (Skillsmart, MIT)
 *
 * A 10–15 s loop: the logo, then the user's screens in a phone or a browser, each cut a whip pan in which
 * the outgoing and incoming shot move as one (same ease, same distance), so the speed always matches. Taps,
 * a counting number and a toast give each screen one action. The last frame is the first frame: it loops.
 *
 *   AppSting.film({ brand, logo?, url, colors: { ground, ink, accent, hairline }, shots: [...] })
 */
(function () {
  "use strict";
  const { EASE: E, clamp, lerp } = Film;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function film(story) {
    const C = { ground: "#5B5BF6", ink: "#FFFFFF", accent: "#FFD23F", hairline: "rgba(255,255,255,0.32)", ...(story.colors || {}) };
    const root = document.documentElement;
    for (const [k, v] of Object.entries(C)) root.style.setProperty("--" + k, v);
    const info = new Map();

    return Film.create({
      fps: story.fps || 30,
      fonts: ['700 40px "Inter Tight"', '500 40px "JetBrains Mono"'],
      async setup() {
        for (const s of story.shots || []) {
          if (!s.screen || info.has(s.screen)) continue;
          const img = new Image();
          img.src = s.screen;
          await img.decode().catch(() => {});
          info.set(s.screen, { w: img.naturalWidth || 1170, h: img.naturalHeight || 2532 });
        }
      },
      build(tl, F) {
        const stage = document.querySelector("#film");
        const u = F.u;
        const world = stage.querySelector(".world");
        const hud = stage.querySelector(".hud");
        const defs = stage.querySelector("svg.defs defs");
        const mk = (parent, cls, html) => { const e = document.createElement("div"); e.className = cls; if (html !== undefined) e.innerHTML = html; parent.appendChild(e); return e; };
        const pos = (e, o) => { for (const [k, v] of Object.entries(o)) e.style[k] = typeof v === "number" ? v + "px" : v; return e; };

        /* ---- the shots ---- */
        const HOLD = { lockup: 1.3, shot: 2.3, end: 2.1 };
        const PAN = 0.32; // half of each whip pan
        const list = [{ kind: "lockup" }, ...(story.shots || []).slice(0, 5).map((s) => ({ kind: "shot", ...s })), { kind: "end" }];
        let t = 0;
        list.forEach((s, i) => { s.t0 = t; t += HOLD[s.kind]; s.t1 = t; s.i = i; });
        const total = t;
        tl.fn(0, total, () => {});
        list.forEach((s) => tl.label(s.kind === "shot" ? s.label || "shot " + s.i : s.kind, s.t0));

        // every element gets its own motion-blur filter, driven by its speed
        let nf = 0;
        const blur = (el) => {
          const id = "mb" + nf++;
          defs.insertAdjacentHTML("beforeend", `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0 0"/></filter>`);
          el.style.filter = `url(#${id})`;
          return defs.lastChild.firstChild;
        };

        // lockup: the logo, or the name as a wordmark
        const lock = mk(world, "shot lockup");
        lock.innerHTML = story.logo ? `<img src="${esc(story.logo)}" alt="">` : `<b>${esc(story.brand)}</b>`;
        const lfs = u * (F.landscape ? 15 : 17);
        lock.style.fontSize = lfs + "px";
        if (story.logo) lock.firstChild.style.height = lfs * 1.1 + "px";
        const url = mk(lock, "url", esc(story.url || ""));
        url.style.fontSize = u * 3.4 + "px";

        list.forEach((s) => {
          if (s.kind !== "shot") { s.el = lock; return; }
          const ii = info.get(s.screen) || { w: 1170, h: 2532 };
          const phone = (s.device || (ii.h > ii.w ? "phone" : "browser")) === "phone";
          let W, H, bar = 0;
          if (phone) { H = F.h * (F.landscape ? 0.82 : F.portrait ? 0.7 : 0.82); W = H * (ii.w / ii.h) + H * 0.06; if (F.portrait) { W = Math.min(W, F.w * 0.66); H = (W - 0) / (ii.w / ii.h + 0.06); } }
          else { W = F.w * (F.landscape ? 0.7 : F.portrait ? 0.92 : 0.86); bar = u * 3; H = W * (ii.h / ii.w) + bar; }
          // .shot is full-frame (so its blur filter has a real box); .c0 is its centre
          const el = mk(world, "shot");
          const c0 = mk(el, "c0");
          const dev = mk(c0, phone ? "device phone" : "device browser");
          const inset = phone ? H * 0.03 : 0;
          pos(dev, { width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2 });
          dev.innerHTML = phone ? `<div class="glass" style="inset:${inset}px;border-radius:${W * 0.11}px"><img src="${esc(s.screen)}" alt=""><i class="island"></i></div>` : `<div class="bar" style="height:${bar}px"><i></i><i></i><i></i><em>${esc(story.url || "")}</em></div><div class="glass" style="top:${bar}px"><img src="${esc(s.screen)}" alt=""></div>`;
          if (phone) dev.style.borderRadius = W * 0.14 + "px";
          s.el = el; s.c0 = c0; s.dev = dev; s.W = W; s.H = H; s.bar = bar; s.phone = phone;
          // where a point on the screenshot sits inside the device
          s.pt = (p) => [-W / 2 + inset + p[0] * (W - inset * 2), -H / 2 + bar + inset + p[1] * (H - bar - inset * 2)];
        });

        /* ---- visibility, drift and the whip pans ---- */
        const Dx = F.w * 1.08, Dy = F.h * 1.08;
        const axes = [];
        for (let k = 0; k < list.length - 1; k++) axes.push(k % 2 === 0 ? "y" : "x");
        tl.set(lock, { visibility: "visible" }, 0);
        list.forEach((s, k) => {
          if (s.kind === "shot") {
            tl.set(s.el, { visibility: "hidden" }, 0);
            tl.set(s.el, { visibility: "visible" }, s.t0 - PAN);
            tl.set(s.el, { visibility: "hidden" }, s.t1 + PAN);
          }
        });
        tl.set(lock, { visibility: "hidden" }, list[0].t1 + PAN);
        tl.set(lock, { visibility: "visible" }, list[list.length - 1].t0 - PAN);
        // drift: everything on screen creeps forward, never still; the end creeps back to frame 0
        list.forEach((s) => {
          if (s.kind === "end") tl.fromTo(s.el, { scale: 1.04 }, { scale: 1 }, s.t0 - PAN, s.t1 - s.t0 + PAN, "inOut");
          else if (s.kind === "lockup") tl.fromTo(s.el, { scale: 1 }, { scale: 1.04 }, 0, s.t1 + PAN, "linear");
          else tl.fromTo(s.dev, { scale: 1, rotate: s.i % 2 ? -1.2 : 1.2 }, { scale: 1.045, rotate: s.i % 2 ? 0.6 : -0.6 }, s.t0 - PAN, s.t1 - s.t0 + 2 * PAN, "linear");
        });
        // the pans: outgoing and incoming share one tween, so the cut is one move
        const filters = new Map();
        const getBlur = (el) => { if (!filters.has(el)) filters.set(el, blur(el)); return filters.get(el); };
        const pans = [];
        for (let k = 0; k < list.length - 1; k++) {
          const a = list[k], b = list[k + 1], at = a.t1, ax = axes[k];
          const D = ax === "y" ? Dy : Dx;
          tl.fromTo(a.el, { [ax]: 0 }, { [ax]: -D }, at - PAN, PAN * 2, "inOut");
          tl.fromTo(b.el, { [ax]: D }, { [ax]: 0 }, at - PAN, PAN * 2, "inOut");
          pans.push({ at, ax, D, els: [a.el, b.el] });
        }
        // blur from speed: the derivative of the shared ease
        tl.every((time) => {
          const live = new Map();
          for (const p of pans) {
            const q = (time - (p.at - PAN)) / (PAN * 2);
            if (q <= 0 || q >= 1) continue;
            const v = ((E.inOut(Math.min(1, q + 0.01)) - E.inOut(Math.max(0, q - 0.01))) / 0.02) * (p.D / (PAN * 2)); // px per second
            const sd = Math.min(u * 8, (v / (story.fps || 30)) * 0.3);
            for (const el of p.els) live.set(el, p.ax === "x" ? `${sd} 0` : `0 ${sd}`);
          }
          for (const s of list) {
            const f = getBlur(s.el);
            const val = live.get(s.el) || "0 0";
            if (f.getAttribute("stdDeviation") !== val) f.setAttribute("stdDeviation", val);
          }
        });
        // the URL only on the end card, gone again for the loop's first frame
        const end = list[list.length - 1];
        tl.set(url, { opacity: 0 }, 0);
        tl.fromTo(url, { opacity: 0, y: u * 2 }, { opacity: 0.85, y: 0 }, end.t0 + 0.15, 0.5, "out");
        tl.to(url, { opacity: 0 }, total - 0.45, 0.35, "in");

        /* ---- one action per screen ---- */
        list.forEach((s) => {
          if (s.kind !== "shot") return;
          const start = s.t0 + 0.35;
          if (s.tap) {
            const [x, y] = s.pt(s.tap);
            const at = start + (s.phone ? 0.45 : 0.75);
            if (!s.phone) {
              const cur = mk(s.c0, "cursor", `<svg viewBox="0 0 28 28"><path d="M5 3l15.5 14.2h-8.9L7.7 25z"/></svg>`);
              const cs = u * 3;
              pos(cur, { width: cs, height: cs });
              tl.fromTo(cur, { x: x + s.W * 0.35, y: y + s.H * 0.4, opacity: 0 }, { x, y, opacity: 1 }, start, at - start, "out");
              tl.to(cur, { scale: 0.85 }, at, 0.08, "out");
              tl.to(cur, { scale: 1 }, at + 0.1, 0.25, "spring");
            }
            const rip = mk(s.c0, "ripple");
            const rs = u * (s.phone ? 7 : 5);
            pos(rip, { left: x - rs / 2, top: y - rs / 2, width: rs, height: rs });
            tl.fromTo(rip, { scale: 0.3, opacity: 0.9 }, { scale: 1.6, opacity: 0 }, at, 0.6, "out");
            tl.fromTo(s.dev, { scaleX: 1, scaleY: 1 }, { scaleX: 0.985, scaleY: 0.985 }, at, 0.08, "out");
            tl.to(s.dev, { scaleX: 1, scaleY: 1 }, at + 0.08, 0.4, "spring(0.3)");
            if (s.toast) {
              const ts = mk(s.c0, "toast", `<i>✓</i>${esc(s.toast)}`);
              const fs = u * (s.phone ? 2.6 : 2.2);
              pos(ts, { fontSize: fs, top: s.H / 2 - fs * (s.phone ? 6 : 4) });
              tl.fromTo(ts, { opacity: 0, y: fs * 1.5, scale: 0.94 }, { opacity: 1, y: 0, scale: 1 }, at + 0.25, 0.5, "spring(0.25)");
            }
          }
          if (s.number) {
            const n = s.number;
            const chip = mk(s.c0, "chip", `<b>${esc(n.prefix || "")}<span>0</span>${esc(n.suffix || "")}</b><small>${esc(n.label || "")}</small>`);
            const fs = u * (F.landscape ? 6 : 7);
            const left = F.landscape ? s.W / 2 - fs * 0.6 : -s.W * 0.42;
            pos(chip, { fontSize: fs, left, top: s.H * (F.landscape ? 0.12 : 0.2) });
            const span = chip.querySelector("span");
            tl.fromTo(chip, { opacity: 0, scale: 0.8, rotate: -4 }, { opacity: 1, scale: 1, rotate: -2 }, start, 0.5, "spring(0.3)");
            tl.fn(start + 0.15, 1.1, (p) => (span.textContent = Film.formatNumber(n.value * p, n.value)), "out");
          }
        });

        /* ---- the frame around it all: a hairline, four corner labels ---- */
        const fs = u * 2.1;
        hud.style.fontSize = fs + "px";
        hud.style.setProperty("--inset", u * 3.4 + "px");
        const tlbl = mk(hud, "c tl", esc(story.brand || ""));
        const trlbl = mk(hud, "c tr");
        const bl = mk(hud, "c bl");
        const br = mk(hud, "c br", esc(story.url || ""));
        void tlbl; void br;
        const shotsOnly = list.filter((s) => s.kind === "shot");
        tl.every((time) => {
          const cur = list.filter((s) => s.t0 - 0.0001 <= time).pop();
          const k = shotsOnly.indexOf(cur);
          const text = k >= 0 ? `${String(k + 1).padStart(2, "0")} / ${String(shotsOnly.length).padStart(2, "0")}` : "";
          if (trlbl.textContent !== text) trlbl.textContent = text;
          const lab = k >= 0 ? cur.label || "" : "";
          if (bl.textContent !== lab) bl.textContent = lab;
        });
      },
    });
  }

  window.AppSting = { film };
})();
