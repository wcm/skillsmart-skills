/*
 * kinetic.js · Kinetic Type Teaser 2 (Skillsmart, MIT)
 *
 * A 10–30 s typographic teaser: big words on hard cuts, one accent. Each beat is a short shot; five styles
 * change the type, the colours, the shapes around the words and how they move.
 *
 *   loud     Anton capitals on black, one acid accent (the v1 look)
 *   swiss    Inter Tight on white, flush left on a 12-column grid, red, index labels
 *   memphis  Rubik on pink, squiggles, dots and confetti shapes that spring in
 *   xerox    Archivo Black on photocopy paper: grain and halftone behind crisp words, stop motion
 *   bauhaus  Jost on cream with a red circle, a blue square and a yellow half-disc
 *
 *   KineticTeaser.film({ style, accent, beats: [{ beat, text | lines | value | … }] })
 *
 * Beats: tease · word · flash · stack · marquee · count · split · grid · type · end
 */
(function () {
  "use strict";
  const { EASE: E, clamp, lerp } = Film;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const plain = (s) => String(s ?? "").replace(/\*/g, "");

  const STYLES = {
    loud: { bg: "#0B0B0D", ink: "#F5F5F0", accent: "#D7FF3A", font: '"Anton", "Impact", sans-serif', weight: 400, upper: true, align: "center", step: 0, track: "-0.01em", lead: 0.86 },
    swiss: { bg: "#F7F6F2", ink: "#111111", accent: "#E5261B", font: '"Inter Tight", sans-serif', weight: 800, upper: false, align: "left", step: 0, track: "-0.055em", lead: 0.9 },
    memphis: { bg: "#FF8CC6", ink: "#151515", accent: "#FFD23F", accents: ["#FFD23F", "#2EC4B6", "#3A6BFF", "#FFFFFF"], font: '"Rubik", sans-serif', weight: 800, upper: true, align: "center", step: 0, track: "-0.02em", lead: 0.92 },
    xerox: { bg: "#ECEBE6", ink: "#0C0C0C", accent: "#E3262B", font: '"Archivo Black", sans-serif', weight: 400, upper: true, align: "center", step: 1 / 12, track: "-0.03em", lead: 0.9 },
    bauhaus: { bg: "#F1E8D8", ink: "#161514", accent: "#D7332A", blue: "#1F4FA3", yellow: "#F2B705", font: '"Jost", sans-serif', weight: 700, upper: false, align: "center", step: 0, track: "-0.03em", lead: 0.95 },
  };
  const DUR = { tease: 1.4, word: 1.6, flash: 1.2, stack: 2.6, marquee: 2.6, count: 1.9, split: 1.9, grid: 2.1, type: 2.2, end: 2.8 };

  const measurer = document.createElement("canvas").getContext("2d");

  function film(story) {
    const name = story.style || "loud";
    const S = { ...(STYLES[name] || STYLES.loud), ...(story.accent ? { accent: story.accent } : {}), ...(story.colors || {}) };
    const root = document.documentElement;
    root.dataset.style = name;
    for (const k of ["bg", "ink", "accent"]) root.style.setProperty("--" + k, S[k]);
    root.style.setProperty("--font", S.font);
    root.style.setProperty("--weight", S.weight);
    root.style.setProperty("--track", S.track);
    root.style.setProperty("--lead", S.lead);
    const caps = (t) => (S.upper ? String(t).toUpperCase() : String(t));

    return Film.create({
      fps: story.fps || 30,
      step: S.step,
      fonts: [`${S.weight} 80px ${S.font}`, '600 40px "JetBrains Mono"'],
      build(tl, F) {
        const stage = document.querySelector("#film");
        const u = F.u, L = F.landscape, P = F.portrait;
        const bg = stage.querySelector(".bg"), deco = stage.querySelector(".deco"), layer = stage.querySelector(".layer");
        const mk = (parent, cls, html) => { const e = document.createElement("div"); e.className = cls; if (html !== undefined) e.innerHTML = html; parent.appendChild(e); return e; };
        const pos = (e, o) => { for (const [k, v] of Object.entries(o)) e.style[k] = typeof v === "number" ? v + "px" : v; return e; };
        const rnd = Film.rand(name + (story.seed || 1));
        const W = F.w * (S.align === "left" ? 0.84 : 0.86);
        const X0 = S.align === "left" ? F.w * 0.08 : (F.w - W) / 2;
        const fit = (text, max) => { measurer.font = `${S.weight} 100px ${S.font}`; if (S.track) measurer.letterSpacing = S.track; const w = measurer.measureText(caps(plain(text))).width || 1; return Math.min(max, (W / w) * 100); };
        const html = (t) => esc(caps(t)).replace(/\*([^*]+)\*/g, "<em>$1</em>");

        const beats = story.beats || [];
        let t = 0;
        beats.forEach((b, i) => { b.t0 = t; t += b.dur || DUR[b.beat] || 1.6; b.t1 = t; b.i = i; tl.label(b.beat, b.t0); });
        const total = t;
        tl.fn(0, total, () => {});
        tl.set(bg, { backgroundColor: S.bg }, 0);

        /* ---- style furniture that lives through the whole film ---- */
        if (name === "swiss") {
          const grid = mk(deco, "grid");
          for (let k = 0; k <= 12; k++) { const l = mk(grid, "gl"); l.style.left = 8 + (84 * k) / 12 + "%"; }
          const lab = mk(deco, "index");
          pos(lab, { left: F.w * 0.08, top: F.h * (P ? 0.12 : 0.07), fontSize: u * 2.2 });
          tl.every((tt) => { const b = beats.filter((x) => x.t0 <= tt).pop(); const s = b ? `${String(b.i + 1).padStart(2, "0")} — ${b.beat}` : ""; if (lab.textContent !== s) lab.textContent = s; });
        }
        if (name === "xerox") {
          // photocopy grain: a fresh copy on every cut (changing it every frame would make the MP4 huge)
          const grain = stage.querySelector(".grain feTurbulence");
          tl.every((tt) => { const sd = String(beats.filter((x) => x.t0 <= tt).length * 7 + 1); if (grain.getAttribute("seed") !== sd) grain.setAttribute("seed", sd); });
        }

        /* ---- per-beat shapes (memphis, bauhaus) ---- */
        function confetti(b) {
          if (name === "memphis") {
            const kinds = ["squig", "dot", "tri", "ring", "bar"];
            const n = P ? 7 : 9;
            for (let k = 0; k < n; k++) {
              const kind = kinds[k % kinds.length];
              const e = mk(deco, "shape " + kind);
              const side = k % 2 ? rnd.range(0.62, 0.95) : rnd.range(0.05, 0.38);
              const sz = u * rnd.range(5, 11);
              pos(e, { left: F.w * side - sz / 2, top: F.h * rnd.range(0.08, 0.92) - sz / 2, width: sz, height: kind === "bar" ? sz * 0.28 : sz });
              e.style.setProperty("--c", S.accents[k % S.accents.length]);
              if (kind === "squig") e.innerHTML = `<svg viewBox="0 0 100 40"><path d="M2 20 Q 14 2 26 20 T 50 20 T 74 20 T 98 20"/></svg>`;
              const r = rnd.range(-40, 40);
              tl.fromTo(e, { scale: 0, rotate: r - 60 }, { scale: 1, rotate: r }, b.t0 + 0.05 + k * 0.03, 0.5, "spring(0.4)");
              tl.show(e, b.t0, b.t1);
            }
          } else if (name === "bauhaus") {
            // three primaries move into a new composition every beat
            const comp = [
              [[0.78, 0.26, 0.3], [0.16, 0.78, 0.22], [0.86, 0.82, 0.2]],
              [[0.18, 0.2, 0.26], [0.82, 0.7, 0.3], [0.5, 0.9, 0.16]],
              [[0.84, 0.74, 0.34], [0.14, 0.24, 0.2], [0.2, 0.84, 0.24]],
            ][b.i % 3];
            const kinds = [["circle", S.accent], ["square", S.blue], ["half", S.yellow]];
            kinds.forEach(([kind, col], k) => {
              const e = mk(deco, "shape " + kind);
              const [x, y, s] = comp[k];
              const sz = Math.min(F.w, F.h) * s;
              pos(e, { left: F.w * x - sz / 2, top: F.h * y - sz / 2, width: sz, height: kind === "half" ? sz / 2 : sz, background: col });
              const from = k === 0 ? { x: -F.w * 0.6, rotate: -180 } : k === 1 ? { y: -F.h * 0.7, rotate: 45 } : { x: F.w * 0.6, rotate: 180 };
              tl.fromTo(e, from, { x: 0, y: 0, rotate: 0 }, b.t0, 0.55, "inOut");
              tl.show(e, b.t0, b.t1);
            });
            const bar = mk(deco, "shape bar");
            pos(bar, { left: 0, top: F.h * (b.i % 2 ? 0.14 : 0.86), width: F.w, height: u * 1.2 });
            tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1 }, b.t0 + 0.1, 0.5, "inOut");
            tl.show(bar, b.t0, b.t1);
          }
        }

        /* ---- entrances, per style ---- */
        function arrive(el, at, big = true) {
          if (name === "loud") tl.fromTo(el, { scale: big ? 2.4 : 1.4 }, { scale: 1 }, at, 0.55, "snap");
          else if (name === "swiss") { tl.fromTo(el, { x: -u * 30, clipPath: "inset(0% 100% 0% 0%)" }, { x: 0, clipPath: "inset(0% 0% 0% 0%)" }, at, 0.5, "snap"); }
          else if (name === "memphis") tl.fromTo(el, { scale: 0.5, rotate: -8 }, { scale: 1, rotate: -3 }, at, 0.6, "spring(0.4)");
          else if (name === "xerox") { tl.fromTo(el, { scale: 1.18, opacity: 0 }, { scale: 1, opacity: 1 }, at, 0.25, "linear"); }
          else tl.fromTo(el, { y: u * 12, opacity: 0 }, { y: 0, opacity: 1 }, at, 0.55, "inOut");
        }
        const block = (cls, inner, size) => {
          const e = mk(layer, "t " + cls, inner);
          pos(e, { left: X0, width: W, fontSize: size, textAlign: S.align });
          return e;
        };
        const middle = (e, y = 0.5) => (e.style.top = F.h * y - e.offsetHeight / 2 + "px");

        /* ---- the beats ---- */
        for (const b of beats) {
          const g = mk(layer, "beat");
          tl.show(g, b.t0, b.t1);
          const own = (e) => { g.appendChild(e); return e; };
          confetti(b);
          const hmax = F.h * (P ? 0.2 : 0.42);

          if (b.beat === "tease") {
            const e = own(block("small", html(b.text), u * (P ? 5 : 4.2)));
            middle(e);
            tl.fromTo(e, { opacity: 0, letterSpacing: "0.7em" }, { opacity: 1, letterSpacing: "0.22em" }, b.t0, 1.1, "out");
          } else if (b.beat === "word" || b.beat === "flash") {
            const fs = fit(b.text, hmax);
            const e = own(block("big", html(b.text), fs));
            middle(e);
            if (b.beat === "flash") {
              g.classList.add("flash");
              tl.fromTo(e, { y: F.h * 0.6 }, { y: 0 }, b.t0, 0.42, "snap");
            } else arrive(e, b.t0);
          } else if (b.beat === "stack") {
            const lines = (b.lines || []).slice(0, 4);
            const fs = Math.min(...lines.map((l) => fit(l, F.h * (P ? 0.14 : 0.26))));
            const e = own(block("big stack", lines.map((l, k) => `<div class="ln${k === 1 ? " hi" : ""}">${html(l)}</div>`).join(""), fs));
            middle(e);
            [...e.children].forEach((ln, k) => {
              const at = b.t0 + k * 0.32;
              if (name === "memphis") tl.fromTo(ln, { scale: 0.4, rotate: (k % 2 ? 6 : -6) }, { scale: 1, rotate: k % 2 ? 2 : -2 }, at, 0.5, "spring(0.4)");
              else if (name === "bauhaus") tl.fromTo(ln, { x: (k % 2 ? 1 : -1) * F.w, opacity: 1 }, { x: 0, opacity: 1 }, at, 0.6, "inOut");
              else tl.fromTo(ln, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.5, name === "xerox" ? "steps(4)" : "inOut");
            });
          } else if (b.beat === "marquee") {
            const fs = F.h * (P ? 0.1 : 0.2);
            const txt = caps(plain(b.text)) + "  ·  ";
            const e = own(mk(layer, "marquee", esc(txt.repeat(6))));
            pos(e, { fontSize: fs, top: F.h * 0.5 - fs * 0.6 });
            const e2 = own(mk(layer, "marquee alt", esc(txt.repeat(6))));
            pos(e2, { fontSize: fs * 0.55, top: F.h * 0.5 + fs * 0.6 });
            tl.fromTo(e, { x: 0 }, { x: -F.w * 1.2 }, b.t0, b.t1 - b.t0, "linear");
            tl.fromTo(e2, { x: -F.w * 1.4 }, { x: -F.w * 0.4 }, b.t0, b.t1 - b.t0, "linear");
            const ln = own(mk(layer, "rule"));
            pos(ln, { left: 0, top: F.h * 0.5 + fs * 0.5, width: F.w, height: u * 1.2 });
            tl.fromTo(ln, { scaleX: 0 }, { scaleX: 1 }, b.t0 + 0.1, 1.6, "out");
          } else if (b.beat === "count") {
            // an odometer: each digit is a column of 0–9 that rolls to its place
            const str = Film.formatNumber(Number(b.value), b.value, { prefix: b.prefix, suffix: b.suffix });
            const fs = fit(str, hmax);
            const e = own(block("big count", "", fs));
            const digits = [...str];
            e.innerHTML = digits.map((c) => (/\d/.test(c) ? `<span class="col"><span class="roll">${"0123456789".split("").map((d) => `<i>${d}</i>`).join("")}</span></span>` : `<span class="sym">${esc(c)}</span>`)).join("");
            middle(e);
            let k = 0;
            [...e.querySelectorAll(".col .roll")].forEach((r) => {
              const d = +digits.filter((c) => /\d/.test(c))[k];
              tl.fromTo(r, { y: 0 }, { y: `${-d}em` }, b.t0 + 0.05 + k * 0.08, 0.9 + k * 0.05, name === "xerox" ? "out@steps(8)" : "out");
              k++;
            });
            if (b.label) { const lb = own(block("small", html(b.label), u * (P ? 4.4 : 3.8))); lb.style.top = e.offsetTop + e.offsetHeight + u * 2 + "px"; tl.fromTo(lb, { opacity: 0 }, { opacity: 1 }, b.t0 + 0.7, 0.4, "soft"); }
          } else if (b.beat === "split") {
            const fs = fit(b.text, hmax);
            const a = own(block("big", html(b.text), fs));
            middle(a);
            const top = a.cloneNode(true), bot = a.cloneNode(true);
            a.remove();
            top.classList.add("half", "top"); bot.classList.add("half", "bot");
            g.appendChild(top); g.appendChild(bot);
            const fs2 = Math.min(fit(b.reveal || "", hmax), fs * 0.42);
            const r = own(block("big reveal", html(b.reveal || ""), fs2));
            middle(r);
            const at = b.t0 + 0.55;
            tl.fromTo(top, { y: 0 }, { y: -fs * 0.5 }, at, 0.5, "snap");
            tl.fromTo(bot, { y: 0 }, { y: fs * 0.5 }, at, 0.5, "snap");
            tl.fromTo(r, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1 }, at + 0.05, 0.45, "snap");
          } else if (b.beat === "grid") {
            const rows = P ? 7 : 4, cols = P ? 2 : 4;
            const word = caps(plain(b.text));
            const cw = F.w / cols, chh = F.h / rows;
            measurer.font = `${S.weight} 100px ${S.font}`;
            const fs = Math.min(chh * 0.7, (cw * 0.86 / (measurer.measureText(word).width || 1)) * 100);
            const hi = Math.floor(rows / 2) * cols + Math.floor((cols - 1) / 2);
            for (let k = 0; k < rows * cols; k++) {
              const c = own(mk(layer, "cell" + (k === hi ? " hi" : ""), esc(word)));
              pos(c, { left: (k % cols) * cw, top: Math.floor(k / cols) * chh, width: cw, height: chh, fontSize: fs, lineHeight: chh + "px" });
              tl.fromTo(c, { opacity: 0 }, { opacity: 1 }, b.t0 + ((k * 7) % (rows * cols)) * 0.02, 0, "linear");
              if (k === hi) tl.fromTo(c, { scale: 1 }, { scale: Math.min(cols, 3.2) }, b.t0 + 0.9, 0.7, "snap");
              else tl.to(c, { opacity: 0.12 }, b.t0 + 0.9, 0.3, "soft");
            }
          } else if (b.beat === "type") {
            const txt = caps(plain(b.text));
            const fs = Math.min(fit(b.text, F.h * 0.12), u * 9);
            const e = own(block("big typed", [...txt].map((c) => `<span>${c === " " ? "&nbsp;" : esc(c)}</span>`).join("") + '<i class="caret"></i>', fs));
            middle(e);
            const cs = [...e.querySelectorAll("span")];
            const cps = Math.min(0.06, 1.2 / cs.length);
            cs.forEach((c, k) => tl.fromTo(c, { opacity: 0 }, { opacity: 1 }, b.t0 + 0.2 + k * cps, 0, "linear"));
            const caret = e.querySelector(".caret");
            tl.fn(b.t0, b.t1 - b.t0, (p, tt) => (caret.style.opacity = tt < b.t0 + 0.2 + cs.length * cps || Math.floor(tt * 3) % 2 ? 1 : 0));
          } else if (b.beat === "end") {
            const fs = fit(b.brand, F.h * (P ? 0.16 : 0.3));
            const e = own(block("big", html(b.brand), fs));
            middle(e, 0.46);
            arrive(e, b.t0, false);
            const s = own(block("small accent", html(b.line || ""), u * (P ? 4.6 : 3.8)));
            s.style.top = e.offsetTop + e.offsetHeight + u * 2.5 + "px";
            tl.fromTo(s, { opacity: 0, y: u * 3 }, { opacity: 1, y: 0 }, b.t0 + 0.45, 0.5, "out");
          }
        }

        // flashes: the accent fills the frame (never more than three a second)
        for (const b of beats) if (b.beat === "flash") { tl.set(bg, { backgroundColor: S.accent }, b.t0); tl.set(bg, { backgroundColor: S.bg }, b.t1); }
      },
    });
  }

  window.KineticTeaser = { film, STYLES, DUR };
})();
