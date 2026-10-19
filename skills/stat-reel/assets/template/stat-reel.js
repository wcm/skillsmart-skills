/*
 * stat-reel.js · Stat Reel (Skillsmart, MIT)
 *
 * 3–6 real numbers become a 15–30 s reel (vertical first): each stat gets the chart its kind of number needs
 * (a counter, a ring, two bars, columns over time, a ranking, parts of a whole), counts up, holds, and hands
 * over to the next with a colour wipe. Every chart's scale starts at zero; every stat can carry its source.
 *
 *   StatReel.film({ theme, title, brand, url, stats: [...], end })
 */
(function () {
  "use strict";
  const { EASE: E, clamp, lerp } = Film;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const md = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const THEMES = {
    wrapped: { blocks: ["#FF5A36", "#2B44FF", "#13C28D", "#FFC21A", "#A74BFF", "#111114"], font: '"Inter Tight", sans-serif', num: '"Inter Tight", sans-serif', wipe: "block" },
    ledger: { blocks: ["#F4F1EA"], ink: "#141414", accent: "#0E8A5F", font: '"Inter Tight", sans-serif', num: '"JetBrains Mono", monospace', wipe: "rule" },
    night: { blocks: ["#0B0D18"], ink: "#EEF0FF", accent: "#7CF0C8", accent2: "#8C7CFF", font: '"Inter Tight", sans-serif', num: '"Inter Tight", sans-serif', wipe: "fade" },
  };

  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const inkOn = (bg) => (lum(bg) > 0.35 ? "#111114" : "#FFFFFF");

  // what chart a stat needs, from the shape of its data
  function kindOf(s) {
    if (s.kind) return s.kind;
    if (s.items) return s.parts ? "parts" : "rank";
    if (s.values && s.values.length === 2) return "compare";
    if (s.values && s.values.length > 2) return "series";
    if (String(s.suffix || "").trim() === "%" && s.value <= 100) return "percent";
    return "count";
  }

  function film(story) {
    const th = { ...(THEMES[story.theme] || THEMES.wrapped), ...(story.colors || {}) };
    const root = document.documentElement;
    root.dataset.theme = story.theme || "wrapped";
    root.style.setProperty("--font", th.font);
    root.style.setProperty("--num", th.num);

    return Film.create({
      fps: story.fps || 30,
      fonts: [`800 40px ${th.font}`, `600 40px ${th.font}`, `500 40px ${th.num}`, `700 40px ${th.num}`],
      build(tl, F) {
        const stage = document.querySelector("#film");
        const u = F.u, P = F.portrait, L = F.landscape;
        const bgs = stage.querySelector(".bgs"), layer = stage.querySelector(".layer");
        const mk = (parent, cls, html) => { const e = document.createElement("div"); e.className = cls; if (html !== undefined) e.innerHTML = html; parent.appendChild(e); return e; };
        const pos = (e, o) => { for (const [k, v] of Object.entries(o)) e.style[k] = typeof v === "number" ? v + "px" : v; return e; };
        const fmt = (v, s, target) => Film.formatNumber(v, target ?? s.value, { prefix: s.prefix || "", suffix: s.suffix || "" });

        const stats = (story.stats || []).slice(0, 6);
        const scenes = [{ kind: "title" }, ...stats.map((s, i) => ({ ...s, i, kind: kindOf(s), stat: true })), { kind: "end" }];
        let t = 0;
        for (const s of scenes) {
          s.t0 = t;
          const d = s.kind === "title" ? 2.4 : s.kind === "end" ? 2.6 : s.kind === "rank" || s.kind === "series" ? 4.2 : 3.6;
          t += s.dur || d;
          s.t1 = t;
          tl.label(s.kind === "title" ? "title" : s.kind === "end" ? "end" : `${String(s.i + 1).padStart(2, "0")} ${s.kind}`, s.t0);
        }
        const total = t;
        tl.fn(0, total, () => {});

        // colours per scene: wrapped cycles saturated blocks; the others keep one ground
        scenes.forEach((s, k) => {
          s.bg = th.blocks[k % th.blocks.length];
          s.ink = th.ink || inkOn(s.bg);
          s.acc = th.accent || s.ink;
        });

        /* ---- the wipe between scenes: the background leads by a beat ---- */
        scenes.forEach((s, k) => {
          const b = mk(bgs, "block");
          b.style.background = s.bg;
          if (k === 0) return;
          const at = s.t0 - 0.22;
          if (th.wipe === "block") {
            b.style.zIndex = k;
            tl.fromTo(b, { y: F.h }, { y: 0 }, at, 0.5, "inOut");
          } else {
            tl.set(b, { opacity: 0 }, 0);
            if (th.wipe === "rule") {
              const r = mk(bgs, "rule");
              pos(r, { top: F.h * 0.5, height: Math.max(2, u * 0.25) });
              r.style.background = s.ink;
              tl.fromTo(r, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1 }, at, 0.4, "inOut");
              tl.to(r, { opacity: 0 }, at + 0.45, 0.25, "soft");
            }
          }
        });

        /* ---- layout ---- */
        const box = L ? { tx: F.w * 0.07, tw: F.w * 0.4, cx: F.w * 0.52, cw: F.w * 0.41, top: F.h * 0.2, mid: F.h * 0.5 }
          : P ? { tx: F.w * 0.08, tw: F.w * 0.84, cx: F.w * 0.08, cw: F.w * 0.84, top: F.h * 0.14, mid: F.h * 0.5 }
          : { tx: F.w * 0.08, tw: F.w * 0.84, cx: F.w * 0.08, cw: F.w * 0.84, top: F.h * 0.08, mid: F.h * 0.5 };
        const chartTop = L ? F.h * 0.2 : P ? F.h * 0.46 : F.h * 0.5;
        const chartH = L ? F.h * 0.6 : P ? F.h * 0.3 : F.h * 0.38;
        const enter = (els, at, step = 0.07) => tl.stagger(els, { opacity: 1, y: 0 }, at, 0.6, step, "out", { opacity: 0, y: u * 4 });
        const leave = (els, at) => tl.stagger(els, { opacity: 0, y: -u * 3 }, at, 0.3, 0.03, "in");

        for (const s of scenes) {
          const g = mk(layer, "scene");
          g.style.color = s.ink;
          g.style.setProperty("--acc", s.acc);
          tl.show(g, s.t0 - 0.05, s.t1);
          const out = s.t1 - 0.6;

          if (s.kind === "title" || s.kind === "end") {
            const text = s.kind === "title" ? story.title : story.end || story.brand;
            const h = mk(g, "headline", md(text));
            pos(h, { left: box.tx, width: F.w - box.tx * 2, fontSize: u * (L ? 9 : P ? 11.5 : 10) });
            h.style.top = F.h * (P ? 0.42 : 0.44) - h.offsetHeight / 2 + "px";
            const sub = mk(g, "sub", esc(s.kind === "title" ? story.brand || "" : story.url || ""));
            pos(sub, { left: box.tx, top: h.offsetTop + h.offsetHeight + u * 3, fontSize: u * (P ? 4.4 : 3.6) });
            enter([h, sub], s.t0 + 0.15, 0.15);
            if (s.kind === "title") leave([h, sub], out);
            continue;
          }

          // every stat: index, the number, the label, the chart, the source
          const idx = mk(g, "idx", `${String(s.i + 1).padStart(2, "0")} / ${String(stats.length).padStart(2, "0")}`);
          pos(idx, { left: box.tx, top: box.top, fontSize: u * (P ? 3.4 : 2.8) });
          const nfs = u * (L ? 15 : P ? 20 : 16);
          const big = mk(g, "big");
          const label = mk(g, "label", md(s.label));
          pos(label, { left: box.tx, width: box.tw, fontSize: u * (L ? 4.6 : P ? 6 : 5.2) });
          const parts = [idx, big, label];
          if (s.source) { const so = mk(g, "source", esc(s.source)); pos(so, { left: box.tx, width: box.tw, bottom: P ? F.h * 0.21 : u * 6, fontSize: u * (P ? 2.8 : 2.2) }); parts.push(so); }
          const ch = mk(g, "chart");
          pos(ch, { left: box.cx, top: chartTop, width: box.cw, height: chartH });
          const c0 = s.t0 + 0.35, cnt = 1.4;

          // the headline number: what the scene counts up to
          const target = s.kind === "compare" ? s.values[1] : s.kind === "series" ? s.values[s.values.length - 1] : s.kind === "rank" || s.kind === "parts" ? s.items[0][1] : s.value;
          // compare: the headline is the change itself, worked out from the two values
          const ratio = s.kind === "compare" && s.values[0] && s.values[1] ? (s.values[1] >= s.values[0] ? `${+(s.values[1] / s.values[0]).toFixed(1)}× more` : `${+(s.values[0] / s.values[1]).toFixed(1)}× less`) : null;
          const headline = s.headline ?? ratio;
          big.innerHTML = headline ? md(headline) : `<span>${fmt(0, s, target)}</span>`;
          const nb = big.querySelector("span");
          const fs = Math.min(nfs, (box.tw / Math.max(3, (headline || fmt(target, s, target)).length * 0.6)));
          pos(big, { left: box.tx, width: box.tw, fontSize: fs });
          const yN = L ? F.h * 0.3 : P ? F.h * 0.2 : F.h * 0.14;
          big.style.top = yN + "px";
          label.style.top = yN + fs * 1.08 + "px";
          if (nb) tl.fn(c0, cnt, (p) => (nb.textContent = fmt(target * p, s, target)), "out");

          if (s.kind === "count") {
            // a bar that fills as the number counts, plus tick marks: a gauge with no invented maximum
            const bar = mk(ch, "gauge");
            pos(bar, { left: 0, right: 0, top: chartH * 0.45, height: u * 2.2 });
            const fill = mk(bar, "fill");
            tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1 }, c0, cnt, "out");
            for (let k = 0; k <= 10; k++) { const tk = mk(ch, "tick"); pos(tk, { left: `${k * 10}%`, top: chartH * 0.45 + u * 3.2, height: k % 5 ? u * 1.2 : u * 2.4 }); }
          } else if (s.kind === "percent") {
            const D = Math.min(box.cw, chartH) * 0.92;
            const r = D / 2 - u * 2, C = 2 * Math.PI * r;
            ch.innerHTML = `<svg viewBox="0 0 ${D} ${D}" style="width:${D}px;height:${D}px;margin:auto;display:block"><circle cx="${D / 2}" cy="${D / 2}" r="${r}" class="track" stroke-width="${u * 3.2}"/><circle cx="${D / 2}" cy="${D / 2}" r="${r}" class="arc" stroke-width="${u * 3.2}" stroke-dasharray="${C} ${C}" stroke-dashoffset="${C}" transform="rotate(-90 ${D / 2} ${D / 2})"/></svg>`;
            const arc = ch.querySelector(".arc");
            tl.fn(c0, cnt, (p) => arc.setAttribute("stroke-dashoffset", C * (1 - clamp(s.value / 100) * p)), "out");
          } else if (s.kind === "compare") {
            const vmax = Math.max(...s.values) || 1;
            const bw = box.cw * 0.3;
            s.values.forEach((v, k) => {
              const col = mk(ch, "col" + (k === 1 ? " hi" : ""));
              const h = (v / vmax) * chartH * 0.78;
              pos(col, { left: k * (box.cw * 0.5) + box.cw * 0.1, width: bw, bottom: chartH * 0.1, height: h });
              const cap = mk(ch, "cap", `<span>${esc((s.labels || [])[k] || "")}</span>`);
              pos(cap, { left: k * (box.cw * 0.5) + box.cw * 0.1 - u * 2, width: bw + u * 4, bottom: 0, fontSize: u * (P ? 3.2 : 2.6) });
              const vb = mk(ch, "vtop", fmt(v, s, v));
              pos(vb, { left: k * (box.cw * 0.5) + box.cw * 0.1 - u * 4, width: bw + u * 8, bottom: chartH * 0.1 + h + u * 1.2, fontSize: u * (P ? 4 : 3.2) });
              tl.fromTo(col, { scaleY: 0 }, { scaleY: 1 }, c0 + k * 0.35, 0.9, "out");
              tl.fromTo(vb, { opacity: 0, y: u * 2 }, { opacity: 1, y: 0 }, c0 + k * 0.35 + 0.6, 0.4, "out");
              enter([cap], c0 + k * 0.35, 0);
            });
            cap0(ch);
          } else if (s.kind === "series") {
            const n = s.values.length, vmax = Math.max(...s.values) || 1;
            const gap = box.cw / n, bw = gap * 0.62;
            s.values.forEach((v, k) => {
              const col = mk(ch, "col" + (k === n - 1 ? " hi" : ""));
              const h = (v / vmax) * chartH * 0.8;
              pos(col, { left: k * gap + (gap - bw) / 2, width: bw, bottom: chartH * 0.1, height: h });
              tl.fromTo(col, { scaleY: 0 }, { scaleY: 1 }, c0 + k * 0.08, 0.7, "out");
              if (s.labels && s.labels[k]) { const lb = mk(ch, "xl", esc(s.labels[k])); pos(lb, { left: k * gap, width: gap, bottom: 0, fontSize: u * (P ? 2.6 : 2.1) }); enter([lb], c0 + k * 0.08, 0); }
            });
            cap0(ch);
          } else if (s.kind === "rank" || s.kind === "parts") {
            const items = s.items.slice(0, 6);
            if (s.kind === "rank") {
              const vmax = Math.max(...items.map((x) => x[1])) || 1;
              const rh = chartH / items.length;
              items.forEach(([name, v], k) => {
                const row = mk(ch, "row");
                pos(row, { left: 0, right: 0, top: k * rh, height: rh * 0.82, fontSize: u * (P ? 3.4 : 2.7) });
                row.innerHTML = `<span class="nm">${esc(name)}</span><span class="bar${k === 0 ? " hi" : ""}"><i></i></span><b>${fmt(v, s, v)}</b>`;
                const i = row.querySelector(".bar i");
                i.style.width = (v / vmax) * 100 + "%";
                tl.fromTo(i, { scaleX: 0 }, { scaleX: 1 }, c0 + k * 0.12, 0.9, "out");
                enter([row.querySelector(".nm"), row.querySelector("b")], c0 + k * 0.12, 0);
              });
            } else {
              const sum = items.reduce((a, x) => a + x[1], 0) || 1;
              const st = mk(ch, "stack");
              pos(st, { left: 0, right: 0, top: chartH * 0.25, height: chartH * 0.22 });
              let acc = 0;
              items.forEach(([name, v], k) => {
                const seg = mk(st, "seg");
                seg.style.left = (acc / sum) * 100 + "%";
                seg.style.width = (v / sum) * 100 + "%";
                seg.style.opacity = String(1 - k * (0.7 / items.length));
                acc += v;
                tl.fromTo(seg, { scaleX: 0 }, { scaleX: 1 }, c0 + k * 0.18, 0.6, "out");
                const lg = mk(ch, "legend", `<i style="opacity:${1 - k * (0.7 / items.length)}"></i>${esc(name)} <b>${fmt(v, s, v)}</b>`);
                pos(lg, { left: 0, top: chartH * 0.56 + k * u * (P ? 5.4 : 4.4), fontSize: u * (P ? 3.4 : 2.7) });
                enter([lg], c0 + k * 0.18 + 0.2, 0);
              });
            }
          }
          enter(parts, s.t0 + 0.1, 0.08);
          leave([...parts, ch], out);
        }

        // a baseline under columns: the zero every bar grows from
        function cap0(ch) { const b = mk(ch, "base"); pos(b, { left: 0, right: 0, bottom: chartH * 0.1 - 1, height: Math.max(2, u * 0.25) }); }
      },
    });
  }

  window.StatReel = { film, THEMES, kindOf };
})();
