/*
 * launch-video.js · Launch Video (Skillsmart, MIT)
 *
 * A 20–40 s launch film from one story: hook → problem → product → features → proof → end.
 * Five styles share the story and differ in everything you see and how it moves:
 *
 *   clean     soft light, glass device, smooth speed-matched slides
 *   drafting  technical drawing: grid, hairlines, dimension lines, callouts, mono labels
 *   paper     cut paper on ivory, printed screenshots piling up, stop motion on twos
 *   pixel     8-bit night: pixel type, dithered screens, typewriter text, stepped motion
 *   bold      huge condensed type on hard cuts, one loud accent, thick frames
 *
 *   LaunchVideo.film({ style, accent, brand, hook, problem, product, features, proof, end })
 */
(function () {
  "use strict";
  const { EASE: E, clamp, lerp } = Film;

  const STYLES = {
    clean: { bg: "#F3F4F7", ink: "#14161C", sub: "#5E6371", accent: "#5B5BF6", display: '"Inter Tight", "Inter", sans-serif', body: '"Inter Tight", "Inter", sans-serif', step: 0 },
    drafting: { bg: "#0C0E0D", ink: "#E8EBE4", sub: "#8B928A", accent: "#FF6A1A", display: '"Space Grotesk", sans-serif', body: '"JetBrains Mono", monospace', step: 0 },
    paper: { bg: "#EEE5D4", ink: "#1F1A15", sub: "#6F6457", accent: "#E5533D", papers: ["#F4C04E", "#86B7D8", "#E5533D", "#9DC69B", "#F1A3B8"], display: '"Fraunces", serif', body: '"Inter", sans-serif', step: 1 / 12 },
    pixel: { bg: "#0E0B28", ink: "#F3F0FF", sub: "#A39CDB", accent: "#FFD23F", display: '"Press Start 2P", monospace', body: '"VT323", monospace', step: 1 / 12 },
    bold: { bg: "#0A0A0A", ink: "#F4F2EC", sub: "#9C998F", accent: "#D7FF3A", display: '"Anton", "Bebas Neue", sans-serif', body: '"Inter Tight", sans-serif', step: 0 },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const md = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const plain = (s) => String(s ?? "").replace(/\*/g, "");

  function words(el) {
    const out = [];
    const walk = (node) => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of ch.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = part;
            frag.appendChild(s);
            out.push(s);
          }
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) walk(ch);
      }
    };
    walk(el);
    return out;
  }
  function chars(el) {
    const out = [];
    const walk = (node) => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const c of ch.textContent) {
            const s = document.createElement("span");
            s.className = "ch";
            s.textContent = c;
            frag.appendChild(s);
            out.push(s);
          }
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) walk(ch);
      }
    };
    walk(el);
    return out;
  }
  const measurer = document.createElement("canvas").getContext("2d");
  // font: "<weight> <family>"; measured at 100 px (the weight has to come before the size, or the canvas ignores it)
  function fitSize(text, font, width, max) {
    const m = /^(\d{3})\s+(.*)$/.exec(font);
    measurer.font = m ? `${m[1]} 100px ${m[2]}` : `100px ${font}`;
    const w = measurer.measureText(text).width || 1;
    return Math.min(max, (width / w) * 100);
  }

  // pixel style: a screenshot shrunk, posterised and Bayer-dithered, shown with hard pixels
  async function pixelate(src, scale = 0.22) {
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => {});
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const levels = 5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, t = (B[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * (255 / levels);
      for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(clamp((d.data[i + k] + t) / 255) * (levels - 1)) * (255 / (levels - 1));
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL();
  }

  /* ---------- layout per format ---------- */

  function layout(F) {
    const { w, h, u, shape } = F;
    const L = shape === "landscape", P = shape === "portrait";
    const dev = L ? { cx: w * 0.685, cy: h * 0.52, W: w * 0.55 } : P ? { cx: w * 0.5, cy: h * 0.62, W: w * 0.88 } : { cx: w * 0.5, cy: h * 0.63, W: w * 0.78 };
    return {
      F, w, h, u, L, P, S: !L && !P,
      side: L ? { left: w * 0.07, top: h * 0.5, width: w * 0.33, size: u * 5.8, mid: true, align: "left" }
        : P ? { left: w * 0.08, top: h * 0.24, width: w * 0.84, size: u * 7.6, mid: false, align: "left" }
        : { left: w * 0.08, top: h * 0.1, width: w * 0.84, size: u * 6, mid: false, align: "left" },
      center: { left: w * 0.08, width: w * 0.84, size: u * (L ? 7.4 : P ? 9 : 8) },
      dev,
    };
  }

  /* ---------- the film ---------- */

  function film(story) {
    const name = story.style || "clean";
    const S0 = STYLES[name] || STYLES.clean;
    const st = { ...S0, ...(story.accent ? { accent: story.accent } : {}), ...(story.colors || {}) };
    if (story.font) st.display = `"${story.font}", ${st.display}`;
    const root = document.documentElement;
    root.dataset.style = name;
    for (const [k, v] of Object.entries({ bg: st.bg, ink: st.ink, sub: st.sub, accent: st.accent, display: st.display, body: st.body })) root.style.setProperty("--" + k, v);

    const screens = new Map();
    return Film.create({
      fps: story.fps || 30,
      step: st.step,
      fonts: [`700 40px ${st.display}`, `400 40px ${st.display}`, `500 40px ${st.body}`, `400 40px ${st.body}`],
      async setup() {
        // every screenshot, ready to place (pixel style gets the dithered version)
        const all = [story.product && story.product.screen, ...(story.features || []).map((f) => f.screen)].filter(Boolean);
        for (const src of all) {
          if (screens.has(src)) continue;
          const img = new Image();
          img.src = src;
          await img.decode().catch(() => {});
          screens.set(src, { src: name === "pixel" ? await pixelate(src) : src, w: img.naturalWidth, h: img.naturalHeight });
        }
      },
      build(tl, F) {
        const stage = document.querySelector("#film");
        const G = layout(F);
        const u = G.u;
        const rnd = Film.rand(story.brand || "launch");
        const L = (sel) => stage.querySelector(sel);
        const bg = L(".bg"), deco = L(".deco"), dev = L(".device"), txt = L(".txt"), top = L(".top");
        const mk = (parent, tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html !== undefined) e.innerHTML = html; parent.appendChild(e); return e; };
        const pos = (e, o) => { for (const [k, v] of Object.entries(o)) e.style[k] = typeof v === "number" ? v + "px" : v; return e; };

        /* ---- timing ---- */
        const feats = (story.features || []).slice(0, 4);
        const T = {};
        let t = 0;
        const span = (key, d) => { T[key] = [t, t + d]; tl.label(key, t); t += d; };
        span("hook", name === "bold" ? 3.2 : 3.0);
        if (story.problem && story.problem.length) span("problem", 1.4 + story.problem.length * 0.75);
        span("product", 4.0);
        feats.forEach((_, i) => span("feature " + (i + 1), 3.6));
        if (story.proof) span("proof", 3.6);
        span("end", 4.2);
        const total = t;
        tl.fn(0, total, () => {});

        /* ---- text: in and out, per style ---- */
        function textIn(el, at, o = {}) {
          if (name === "pixel") {
            const cs = chars(el);
            const cps = o.cps || 0.03;
            cs.forEach((c, i) => tl.fromTo(c, { opacity: 0 }, { opacity: 1 }, at + i * cps, 0, "linear"));
            return at + cs.length * cps;
          }
          const ws = words(el);
          if (name === "clean") { tl.stagger(ws, { opacity: 1, y: 0 }, at, 0.7, 0.06, "out", { opacity: 0, y: "0.5em" }); return at + ws.length * 0.06 + 0.4; }
          if (name === "drafting") {
            // each line wipes on left to right, like a plotter
            tl.fromTo(el, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.25 + ws.length * 0.06, "inOut");
            return at + 0.3 + ws.length * 0.06;
          }
          if (name === "paper") {
            ws.forEach((w, i) => {
              const r = rnd.range(-6, 6);
              tl.fromTo(w, { opacity: 0, y: "-0.6em", rotate: r * 2 }, { opacity: 1, y: 0, rotate: r * 0.3 }, at + i * 0.09, 0.42, "out");
            });
            return at + ws.length * 0.09 + 0.3;
          }
          // bold: lines snap in
          tl.stagger(ws, { opacity: 1, scale: 1 }, at, 0.32, 0.05, "snap", { opacity: 0, scale: 1.25 });
          return at + ws.length * 0.05 + 0.2;
        }
        function textOut(el, at) {
          if (name === "bold" || name === "pixel") { tl.set(el, { opacity: 0 }, at + 0.3); return; }
          if (name === "drafting") { tl.to(el, { clipPath: "inset(0% 0% 0% 100%)" }, at, 0.35, "inOut"); return; }
          tl.to(el, { opacity: 0, y: name === "paper" ? "0.4em" : "-0.35em" }, at, 0.35, "in");
        }
        function block(cfg, html, cls = "") {
          const e = mk(txt, "div", "t " + cls, html);
          pos(e, { left: cfg.left, top: cfg.top ?? 0, width: cfg.width, fontSize: cfg.size });
          if (cfg.align) e.style.textAlign = cfg.align;
          if (cfg.mid) e.style.top = cfg.top - e.offsetHeight / 2 + "px";
          return e;
        }

        /* ---- backgrounds ---- */
        if (name === "clean") {
          const b1 = mk(bg, "div", "blob"), b2 = mk(bg, "div", "blob b2");
          pos(b1, { width: G.w * 0.7, height: G.w * 0.7, left: -G.w * 0.15, top: -G.w * 0.3 });
          pos(b2, { width: G.w * 0.6, height: G.w * 0.6, left: G.w * 0.55, top: G.h * 0.35 });
          tl.fromTo(b1, { x: 0, y: 0 }, { x: G.w * 0.12, y: G.h * 0.1 }, 0, total, "inOut");
          tl.fromTo(b2, { x: 0, y: 0 }, { x: -G.w * 0.14, y: -G.h * 0.12 }, 0, total, "inOut");
        } else if (name === "drafting") {
          bg.style.setProperty("--g1", u * 2 + "px");
          bg.style.setProperty("--g2", u * 10 + "px");
          const inset = u * 3, len = u * 4;
          const corners = [[inset, inset, 1, 1], [G.w - inset, inset, -1, 1], [inset, G.h - inset, 1, -1], [G.w - inset, G.h - inset, -1, -1]];
          const holder = mk(deco, "div", "marks-wrap");
          holder.innerHTML = `<svg class="marks" viewBox="0 0 ${G.w} ${G.h}">` + corners.map(([x, y, sx, sy]) => `<path d="M${x + sx * len},${y} H${x} V${y + sy * len}" />`).join("") + `<path class="cross" d="M${G.w / 2 - len / 2},${inset} h${len} M${G.w / 2},${inset - len / 3} v${(len / 3) * 2}" /></svg>`;
          const svg = holder.firstChild;
          tl.fromTo(svg, { opacity: 0 }, { opacity: 1 }, 0, 0.6, "soft");
          const tb = mk(deco, "div", "titleblock");
          pos(tb, { right: u * 3.5, bottom: u * 3.2, fontSize: u * 2 });
          const sheet = (k, n) => `<b>${esc(plain(story.brand || ""))}</b><span>LAUNCH FILM</span><span>SHEET ${String(k).padStart(2, "0")}/${String(n).padStart(2, "0")}</span><span>REV A</span>`;
          const keys = Object.keys(T);
          tl.fn(0, total, (p, tt) => {
            const k = keys.filter((key) => T[key][0] <= tt).length || 1;
            if (tb.dataset.k !== String(k)) { tb.dataset.k = k; tb.innerHTML = sheet(k, keys.length); }
          });
        } else if (name === "pixel") {
          for (let i = 0; i < 70; i++) {
            const s = mk(bg, "i", "star");
            const z = u * (rnd() < 0.2 ? 0.7 : 0.4);
            pos(s, { left: rnd() * G.w, top: rnd() * G.h * 0.9, width: z, height: z });
            const ph = rnd() * 3, sp = 0.6 + rnd() * 1.4;
            tl.fn(0, total, (p, tt) => (s.style.opacity = Math.sin(tt * sp * 3 + ph) > -0.2 ? 1 : 0.25));
          }
        } else if (name === "bold") {
          tl.set(bg, { backgroundColor: st.bg }, 0);
        }

        /* ---- 1 · hook ---- */
        {
          const [a, b] = T.hook;
          if (name === "bold") {
            // the hook in two- or three-word bursts, each filling the frame, on hard cuts
            const ws = plain(story.hook).split(/\s+/);
            const chunks = [];
            for (let i = 0; i < ws.length; i += ws.length > 6 ? 3 : 2) chunks.push(ws.slice(i, i + (ws.length > 6 ? 3 : 2)).join(" "));
            const each = (b - a) / chunks.length;
            chunks.forEach((c, i) => {
              const e = mk(txt, "div", "burst", esc(c.toUpperCase()));
              const fs = fitSize(c.toUpperCase(), `400 ${st.display}`, G.w * 0.8, G.h * (G.P ? 0.16 : 0.36));
              pos(e, { left: 0, width: G.w, top: G.h / 2 - fs * 0.56, fontSize: fs });
              const flip = i % 2 === 1;
              if (flip) { e.style.color = st.bg; tl.set(bg, { backgroundColor: st.accent }, a + i * each); tl.set(bg, { backgroundColor: st.bg }, a + (i + 1) * each); }
              tl.show(e, a + i * each, a + (i + 1) * each);
              tl.fromTo(e, { scale: 1.12 }, { scale: 1 }, a + i * each, each, "snap");
            });
          } else {
            const c = G.center;
            const e = block({ left: c.left, width: c.width, size: c.size * (name === "pixel" ? 0.5 : 1), align: "center" }, md(story.hook), "hook");
            e.style.top = G.h / 2 - e.offsetHeight / 2 + "px";
            if (name === "paper") {
              const strip = mk(deco, "div", "strip");
              const r = e.getBoundingClientRect();
              const lw = widestLine(e);
              pos(strip, { left: G.w / 2 - lw / 2 - u * 3, top: e.offsetTop - u * 2.5, width: lw + u * 6, height: e.offsetHeight + u * 5, background: st.papers[0] });
              strip.style.clipPath = jag(rnd, 18);
              tl.fromTo(strip, { scaleX: 0, rotate: -2 }, { scaleX: 1, rotate: -1.2 }, a + 0.1, 0.5, "out");
              tl.to(strip, { y: G.h * 0.7, rotate: 6 }, b - 0.4, 0.4, "in");
              void r;
            }
            tl.show(e, a, b);
            const done = textIn(e, a + (name === "pixel" ? 0.3 : 0.2), { cps: 0.045 });
            if (name === "pixel") cursor(e, a + 0.3, b - 0.3, done);
            if (name === "drafting") selection(e, a + 0.05, b - 0.35);
            textOut(e, b - 0.4);
          }
        }

        /* ---- 2 · problem ---- */
        if (T.problem) {
          const [a, b] = T.problem;
          const lines = story.problem.slice(0, 3);
          if (name === "bold") {
            const each = (b - a) / lines.length;
            lines.forEach((ln, i) => {
              const e = mk(txt, "div", "burst small", esc(plain(ln).toUpperCase()));
              const fs = fitSize(plain(ln).toUpperCase(), `400 ${st.display}`, G.w * 0.84, G.h * (G.P ? 0.1 : 0.28));
              pos(e, { left: 0, width: G.w, top: G.h / 2 - fs * 0.56, fontSize: fs });
              const bar = mk(txt, "div", "strike");
              const bw = Math.min(G.w * 0.86, fitW(plain(ln).toUpperCase(), `400 ${fs}px ${st.display}`));
              pos(bar, { left: G.w / 2 - bw / 2 - u, width: bw + 2 * u, top: G.h / 2 - u * 0.9, height: u * 1.8, background: st.accent });
              tl.show([e, bar], a + i * each, a + (i + 1) * each);
              tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1 }, a + i * each + each * 0.45, 0.25, "snap");
            });
          } else if (name === "clean" || name === "paper") {
            // the mess: notes scattered around the frame
            const spots = G.L ? [[0.12, 0.2], [0.52, 0.5], [0.2, 0.68]] : G.P ? [[0.08, 0.26], [0.24, 0.46], [0.1, 0.64]] : [[0.08, 0.18], [0.26, 0.44], [0.1, 0.68]];
            lines.forEach((ln, i) => {
              const n = mk(txt, "div", "note");
              const fs = u * (G.L ? 4.2 : G.P ? 5.2 : 4.6);
              n.innerHTML = `<i></i><span>${md(ln)}</span>`;
              pos(n, { left: G.w * spots[i][0], top: G.h * spots[i][1], fontSize: fs, maxWidth: G.w * (G.L ? 0.46 : 0.8) });
              if (name === "paper") { n.style.background = st.papers[(i + 1) % st.papers.length]; n.style.clipPath = jag(rnd, 10); }
              const r = (i % 2 ? 1 : -1) * rnd.range(2, 5);
              const at = a + 0.15 + i * 0.6;
              tl.fromTo(n, { opacity: 0, y: u * 4, rotate: r * 2, scale: 0.94 }, { opacity: 1, y: 0, rotate: r, scale: 1 }, at, 0.6, name === "paper" ? "out" : "spring(0.25)");
              tl.to(n, { y: G.h * 0.08, opacity: 0, rotate: r * 1.6 }, b - 0.45 + i * 0.04, 0.4, "in");
            });
          } else if (name === "drafting") {
            const c = G.side;
            lines.forEach((ln, i) => {
              const row = mk(txt, "div", "fault");
              const fs = u * (G.L ? 4.4 : 5.2);
              row.innerHTML = `<b>${String(i + 1).padStart(2, "0")}</b><span>${md(ln)}</span>`;
              pos(row, { left: G.L ? G.w * 0.12 : c.left, top: G.h * (G.L ? 0.28 : 0.3) + i * fs * 2.2, fontSize: fs });
              const at = a + 0.15 + i * 0.6;
              tl.fromTo(row, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.45, "inOut");
              const x = mk(row, "i", "hatch");
              tl.fromTo(x, { scaleX: 0 }, { scaleX: 1 }, at + 0.55, 0.35, "inOut");
              tl.to(row, { clipPath: "inset(0% 0% 0% 100%)" }, b - 0.45 + i * 0.05, 0.35, "inOut");
            });
          } else if (name === "pixel") {
            lines.forEach((ln, i) => {
              const box = mk(txt, "div", "dialog");
              const fs = u * (G.L ? 2.2 : 2.6);
              pos(box, { left: G.w * (G.L ? 0.18 : 0.08) + i * u * 4, top: G.h * (G.L ? 0.22 : 0.3) + i * fs * 4.4, width: G.w * (G.L ? 0.56 : 0.76), fontSize: fs });
              box.innerHTML = `<span>▶ ${esc(plain(ln).toUpperCase())}</span>`;
              const at = a + 0.1 + i * 0.6;
              tl.show(box, at, b - 0.1);
              textIn(box.firstChild, at + 0.08, { cps: 0.022 });
            });
          }
        }

        /* ---- device ---- */
        const D = G.dev;
        const kind = (story.product && story.product.device) || "browser";
        let W = D.W, H, bar = 0;
        if (kind === "phone") { H = G.h * (G.L ? 0.74 : G.P ? 0.5 : 0.56); W = H * (9 / 19.5); }
        else { bar = name === "pixel" ? u * 3.6 : u * 3.2; H = W * 0.625 + bar; }
        // paper: a printed screenshot with a white border instead of browser chrome
        const pad = name === "paper" ? u * 1.4 : 0;
        if (name === "paper" && kind !== "phone") { bar = 0; H = W * 0.625 + pad * 2; }
        const dx = D.cx - W / 2, dy = D.cy - H / 2;
        pos(dev, { left: dx, top: dy, width: W, height: H });
        dev.className = `device ${kind}`;
        dev.innerHTML = (kind === "browser" && bar ? `<div class="bar">${name === "pixel" ? `<span>${esc(plain(story.brand || "APP").toUpperCase())}.EXE</span><b>×</b>` : "<i></i><i></i><i></i>"}${name === "drafting" ? "" : `<em>${esc(story.end && story.end.url ? story.end.url : "")}</em>`}</div>` : "") + `<div class="view"></div>`;
        dev.style.setProperty("--bar", bar + "px");
        stage.style.setProperty("--pad", pad + "px");
        const view = dev.querySelector(".view");
        const VW = kind === "phone" ? W - u * 1.6 : W - pad * 2, VH = kind === "phone" ? H - u * 1.6 : H - bar - pad * 2;
        const win = new Map();
        const shot = (src) => {
          const info = screens.get(src) || { src, w: 1600, h: 1000 };
          const s = mk(view, "div", "shot");
          s.innerHTML = `<img src="${esc(info.src)}" alt="">`;
          const cover = Math.max(VW / info.w, VH / info.h);
          pos(s.firstChild, { width: info.w * cover, height: info.h * cover });
          return { el: s, img: s.firstChild, info };
        };
        const open = (s, from, to = Infinity) => win.set(s.el, [from, to]);
        // where a focus region [x, y, w, h] (fractions of the screenshot) puts the image
        const focusTo = (info, f) => {
          const cover = Math.max(VW / info.w, VH / info.h);
          const iw = info.w * cover, ih = info.h * cover;
          if (!f) return { scale: 1, x: 0, y: 0 };
          const z = clamp(Math.min(VW / (f[2] * iw), VH / (f[3] * ih)), 1, 2.2);
          const cx = (f[0] + f[2] / 2) * iw, cy = (f[1] + f[3] / 2) * ih;
          return { scale: z, x: clamp(VW / 2 - cx * z, VW - iw * z, 0), y: clamp(VH / 2 - cy * z, VH - ih * z, 0) };
        };

        /* ---- 3 · product ---- */
        const [pa, pb] = T.product;
        const prodShot = shot(story.product.screen);
        open(prodShot, pa);
        {
          const c = name === "bold" ? null : G.side;
          if (name === "bold") {
            const big = mk(deco, "div", "outline", esc(plain(story.product.text || story.brand).toUpperCase()));
            const fs = fitSize(plain(story.product.text || story.brand).toUpperCase(), `400 ${st.display}`, G.w * 0.94, G.h * 0.3);
            pos(big, { left: 0, width: G.w, top: G.L ? G.h * 0.06 : G.h * 0.16, fontSize: fs });
            tl.show(big, pa, pb + feats.length * 3.6);
            tl.fromTo(big, { x: -G.w * 0.03 }, { x: G.w * 0.03 }, pa, pb - pa + feats.length * 3.6, "linear");
          } else {
            const e = block(c, md(story.product.text), "lead");
            tl.show(e, pa, pb);
            textIn(e, pa + 0.15, { cps: 0.04 });
            textOut(e, pb - 0.4);
            if (name === "drafting") selection(e, pa + 0.05, pb - 0.35);
          }
          deviceIn(pa + (name === "bold" ? 0 : 0.35));
        }

        /* ---- 4 · features ---- */
        let prev = prodShot;
        feats.forEach((f, i) => {
          const [a, b] = T["feature " + (i + 1)];
          const s = shot(f.screen || story.product.screen);
          const fz = focusTo(s.info, f.focus);
          if (name === "bold") {
            // a full-frame flash of the title, then the device with the title beside it
            const flash = mk(top, "div", "flash");
            const word = plain(f.word || f.title).toUpperCase();
            const fs = fitSize(word, `400 ${st.display}`, G.w * 0.86, G.h * (G.P ? 0.14 : 0.3));
            flash.innerHTML = `<span style="font-size:${fs}px">${esc(word)}</span>`;
            tl.show(flash, a, a + 0.75);
            tl.fromTo(flash.firstChild, { scale: 1.15 }, { scale: 1 }, a, 0.75, "snap");
          }
          // the screen: style-specific swap at a + lead
          const sw = name === "bold" ? a + 0.75 : a + 0.15;
          swap(prev, s, sw, i);
          if (f.focus && name !== "drafting") tl.fromTo(s.img, { scale: 1, x: 0, y: 0 }, fz, sw + 0.8, b - sw - 1.0, "inOut");
          prev = s;
          // the title
          const c = G.side;
          const num = name === "pixel" ? `► ${String(i + 1).padStart(2, "0")}` : String(i + 1).padStart(2, "0");
          const e = block(c, `<small>${esc(num)}</small>${md(f.title)}${f.text ? `<p>${md(f.text)}</p>` : ""}`, "feat");
          tl.show(e, name === "bold" ? sw : a, b);
          const done = textIn(e, name === "bold" ? sw + 0.05 : a + 0.3, { cps: 0.032 });
          if (name === "pixel") cursor(e, a + 0.3, b - 0.3, done);
          textOut(e, b - 0.4);
          if (name === "drafting") callout(e, s, f.focus, i, sw + 0.5, b - 0.3);
        });
        if (feats.length) deviceOut(T["feature " + feats.length][1] - 0.45);
        else deviceOut(pb - 0.45);
        for (const [el, [from, to]] of win) tl.show(el, from, to);

        /* ---- 5 · proof ---- */
        if (T.proof) {
          const [a, b] = T.proof;
          const p = story.proof;
          const val = Number(p.value);
          const nfs = u * (name === "pixel" ? (G.L ? 9 : 10) : name === "bold" ? (G.L ? 34 : 30) : G.L ? 22 : 24);
          const n = mk(txt, "div", "number");
          n.innerHTML = `${p.prefix ? `<small>${esc(p.prefix)}</small>` : ""}<b>0</b><small>${esc(p.suffix ?? "")}</small>`;
          pos(n, { left: 0, width: G.w, top: G.h * (G.P ? 0.4 : 0.44) - nfs * 0.6, fontSize: nfs });
          const b0 = n.querySelector("b");
          const cnt = name === "bold" ? 1.0 : 1.4;
          tl.fn(a + 0.3, cnt, (q) => (b0.textContent = Film.formatNumber(val * q, p.value)), name === "pixel" ? "out@steps(14)" : "out");
          tl.show(n, a, b);
          if (name === "paper") { tl.fromTo(n, { scale: 1.6, rotate: -8, opacity: 0 }, { scale: 1, rotate: -2, opacity: 1 }, a + 0.25, 0.35, "snap"); }
          else if (name === "bold") tl.fromTo(n, { scale: 1.2 }, { scale: 1 }, a, 0.4, "snap");
          else if (name !== "pixel") tl.fromTo(n, { opacity: 0, y: u * 3 }, { opacity: 1, y: 0 }, a + 0.15, 0.6, "out");
          const lb = mk(txt, "div", "plabel", md(p.label));
          const lfs = u * (name === "pixel" ? 2.2 : G.L ? 4 : 4.8);
          pos(lb, { left: G.w * 0.1, width: G.w * 0.8, top: G.h * (G.P ? 0.4 : 0.44) + nfs * 0.62, fontSize: lfs });
          tl.show(lb, a, b);
          textIn(lb, a + 0.9, { cps: 0.025 });
          if (p.source) {
            const sc = mk(txt, "div", "source", (name === "drafting" ? "† " : "") + esc(p.source));
            pos(sc, { left: G.w * 0.1, width: G.w * 0.8, bottom: G.P ? G.h * 0.22 : u * 6, fontSize: u * (name === "pixel" ? 1.5 : 2.1) });
            tl.fromTo(sc, { opacity: 0 }, { opacity: name === "pixel" ? 1 : 0.65 }, a + 1.3, 0.5, "soft");
            tl.show(sc, a, b);
          }
          if (name === "drafting") dimension(n, a + 0.4, b);
          if (name === "paper") {
            const disc = mk(deco, "div", "disc");
            const ds = nfs * 2.4;
            pos(disc, { left: G.w / 2 - ds / 2, top: G.h * (G.P ? 0.4 : 0.44) - ds * 0.42, width: ds, height: ds, background: st.papers[0] });
            disc.style.clipPath = star(rnd, 22);
            tl.fromTo(disc, { scale: 0, rotate: -40 }, { scale: 1, rotate: 0 }, a + 0.1, 0.45, "out");
            tl.to(disc, { scale: 0, rotate: 30 }, b - 0.35, 0.3, "in");
          }
          if (name === "bold") { tl.set(bg, { backgroundColor: st.accent }, a); tl.set(bg, { backgroundColor: st.bg }, b); n.style.color = st.bg; lb.style.color = st.bg; }
          if (name !== "bold" && name !== "pixel") { tl.to([n, lb], { opacity: 0 }, b - 0.4, 0.35, "in"); }
        }

        /* ---- 6 · end ---- */
        {
          const [a, b] = T.end;
          const en = story.end || {};
          const brand = mk(txt, "div", "brand");
          const bfs = u * (name === "pixel" ? (G.L ? 6 : 6.5) : name === "bold" ? (G.L ? 26 : 22) : G.L ? 15 : 16);
          if (story.logo) brand.innerHTML = `<img src="${esc(story.logo)}" alt="" style="height:${bfs}px">`;
          else brand.innerHTML = md(en.line || story.brand);
          const fitB = story.logo ? bfs : Math.min(bfs, fitSize(plain(en.line || story.brand), `700 ${st.display}`, G.w * 0.84, bfs));
          pos(brand, { left: 0, width: G.w, top: G.h * 0.42 - fitB * 0.6, fontSize: fitB });
          tl.show(brand, a);
          const sub = mk(txt, "div", "endsub");
          sub.innerHTML = [en.date, en.url].filter(Boolean).map((x, k) => `<span class="${k ? "url" : "date"}">${esc(x)}</span>`).join("");
          pos(sub, { left: 0, width: G.w, top: G.h * 0.42 + fitB * 0.55 + u * 2, fontSize: u * (name === "pixel" ? 2.2 : G.L ? 3.6 : 4.2) });
          tl.show(sub, a);
          if (name === "pixel") {
            textIn(brand, a + 0.2, { cps: 0.06 });
            const ps = mk(txt, "div", "press", "PRESS START");
            pos(ps, { left: 0, width: G.w, top: G.h * (G.P ? 0.7 : 0.74), fontSize: u * 2 });
            tl.fn(a, b - a, (q, tt) => (ps.style.opacity = tt > a + 1 && Math.floor(tt * 2.5) % 2 ? 1 : 0));
            tl.fromTo(sub, { opacity: 0 }, { opacity: 1 }, a + 1.1, 0, "linear");
          } else if (name === "bold") {
            tl.fromTo(brand, { scale: 1.2, opacity: 0 }, { scale: 1, opacity: 1 }, a, 0.4, "snap");
            tl.fromTo(sub, { opacity: 0, y: u * 2 }, { opacity: 1, y: 0 }, a + 0.45, 0.4, "snap");
          } else {
            textIn(brand, a + 0.2);
            tl.fromTo(sub, { opacity: 0, y: u * 2 }, { opacity: 1, y: 0 }, a + 0.9, 0.6, "out");
            if (name === "drafting") selection(brand, a + 0.1, b + 1);
            if (name === "paper") {
              const ban = mk(deco, "div", "strip");
              pos(ban, { left: G.w * 0.5 - G.w * 0.3, width: G.w * 0.6, top: G.h * 0.42 - fitB * 0.75, height: fitB * 1.3, background: st.papers[1] });
              ban.style.clipPath = jag(rnd, 22);
              tl.fromTo(ban, { scaleX: 0, rotate: 2 }, { scaleX: 1, rotate: 1 }, a + 0.05, 0.45, "out");
            }
          }
        }

        /* ---- style helpers that need the timeline ---- */

        function deviceIn(at) {
          if (name === "clean") tl.fromTo(dev, { opacity: 0, y: u * 10, rotateX: 16, scale: 0.96 }, { opacity: 1, y: 0, rotateX: 0, scale: 1 }, at, 1.0, "out");
          else if (name === "drafting") {
            tl.fromTo(dev, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.7, "inOut");
            tl.fromTo(view, { opacity: 0 }, { opacity: 1 }, at + 0.6, 0.5, "soft");
            dimension(dev, at + 0.4, null, `${prodShot.info.w} × ${prodShot.info.h}`);
          } else if (name === "paper") tl.fromTo(dev, { y: -G.h * 0.9, rotate: -9 }, { y: 0, rotate: -1.6 }, at, 0.6, "out");
          else if (name === "pixel") {
            tl.fromTo(dev, { opacity: 0 }, { opacity: 1 }, at, 0, "linear");
            tl.fromTo(view, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at + 0.15, 0.8, "steps(8)");
          } else tl.fromTo(dev, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1 }, at, 0.35, "snap");
          tl.show(dev, at);
        }
        function deviceOut(at) {
          if (name === "clean") tl.to(dev, { opacity: 0, y: -u * 6, scale: 0.97 }, at, 0.45, "in");
          else if (name === "drafting") tl.to(dev, { clipPath: "inset(0% 0% 0% 100%)" }, at, 0.45, "inOut");
          else if (name === "paper") tl.to(dev, { y: G.h, rotate: 8 }, at, 0.45, "in");
          else tl.set(dev, { opacity: 0 }, at + 0.45);
        }
        function swap(a, b, at, i) {
          const hide = (until) => win.set(a.el, [win.get(a.el)[0], until]);
          open(b, at);
          if (name === "clean") {
            // speed-matched: the old screen leaves with `in`, the new one arrives with `out`, same distance
            tl.fromTo(a.el, { x: 0 }, { x: -VW * 0.55 }, at, 0.32, "in");
            tl.fromTo(b.el, { x: VW * 0.55 }, { x: 0 }, at + 0.32, 0.55, "out");
            hide(at + 0.32);
            open(b, at + 0.32);
          } else if (name === "drafting") {
            tl.fromTo(b.el, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.6, "inOut");
            const scan = mk(view, "i", "scan");
            tl.fromTo(scan, { x: 0 }, { x: VW }, at, 0.6, "inOut");
            tl.show(scan, at, at + 0.6);
            hide(at + 0.6);
          } else if (name === "paper") {
            // a new print lands on the pile
            const pr = mk(dev.parentNode, "div", "print");
            pos(pr, { left: dev.offsetLeft, top: dev.offsetTop, width: W, height: H });
            pr.appendChild(b.el);
            b.el.style.inset = "var(--pad)";
            const r = (i % 2 ? 1 : -1) * rnd.range(1.5, 3.5);
            tl.fromTo(pr, { y: -G.h * 0.9, rotate: r * 3 }, { y: 0, rotate: r }, at, 0.5, "out");
            tl.show(pr, at, T["feature " + feats.length][1] - 0.45);
            tl.to(pr, { y: G.h, rotate: r * 3 }, T["feature " + feats.length][1] - 0.45, 0.45, "in");
          } else if (name === "pixel") {
            tl.fromTo(b.el, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.6, "steps(8)");
            hide(at + 0.6);
          } else {
            hide(at);
          }
        }
        function selection(el, at, until) {
          const s = mk(txt, "div", "sel");
          const pad = u * 1.2;
          const r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
          const w = Math.min(r.w, widestLine(el)) + pad * 2;
          const left = getComputedStyle(el).textAlign === "center" ? r.x + r.w / 2 - w / 2 : r.x - pad;
          pos(s, { left, top: r.y - pad, width: w, height: r.h + pad * 2 });
          s.innerHTML = "<i></i><i></i><i></i><i></i>";
          tl.fromTo(s, { clipPath: "inset(0% 100% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.45, "inOut");
          if (until) tl.to(s, { opacity: 0 }, until, 0.3, "in");
        }
        function dimension(el, at, until, label) {
          const d = mk(deco, "div", "dim");
          const isDev = el === dev;
          const w = isDev ? W : widestLine(el);
          const x = isDev ? dx : G.w / 2 - w / 2;
          const y = isDev ? dy - u * 3.2 : el.offsetTop + el.offsetHeight + u * 1.2;
          pos(d, { left: x, top: y, width: w, fontSize: u * 2 });
          d.innerHTML = `<i></i><span>${esc(label || "")}</span><i></i>`;
          if (!label) d.classList.add("bare");
          tl.fromTo(d, { clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.6, "inOut");
          tl.show(d, at, until ?? T["feature " + Math.max(1, feats.length)]?.[1] ?? total);
        }
        function callout(e, s, focus, i, at, until) {
          // a highlight on the screen, a leader line to the title, a figure number
          const f = focus || [[0.05, 0.1, 0.5, 0.4], [0.3, 0.2, 0.6, 0.5], [0.1, 0.3, 0.5, 0.5], [0.4, 0.1, 0.5, 0.4]][i % 4];
          const fz = { scale: 1, x: 0, y: 0 };
          const cover = Math.max(VW / s.info.w, VH / s.info.h);
          const z = 1;
          const box = mk(txt, "div", "fig");
          const bx = dx + fz.x + f[0] * s.info.w * cover * z, by = dy + bar + fz.y + f[1] * s.info.h * cover * z;
          const bw = f[2] * s.info.w * cover * z, bh = f[3] * s.info.h * cover * z;
          const cx = clamp(bx, dx + u, dx + W - u * 2), cy = clamp(by, dy + bar + u, dy + H - u * 2);
          pos(box, { left: cx, top: cy, width: Math.min(bw, dx + W - cx - u), height: Math.min(bh, dy + H - cy - u), fontSize: u * 2 });
          box.innerHTML = `<span>FIG. ${String(i + 2).padStart(2, "0")}</span>`;
          tl.fromTo(box, { clipPath: "inset(0% 100% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }, at, 0.45, "inOut");
          tl.show(box, at, until + 0.3);
          tl.to(box, { opacity: 0 }, until, 0.3, "in");
        }
        function cursor(el, from, to, start) {
          const c = mk(el, "i", "caret");
          tl.fn(from, to - from, (q, tt) => (c.style.opacity = tt >= from && tt < to && (tt < start || Math.floor(tt * 3) % 2 === 0) ? 1 : 0));
        }
        function widestLine(el) {
          const r = document.createRange();
          r.selectNodeContents(el);
          const rects = [...r.getClientRects()];
          const sc = stage.getBoundingClientRect().width / G.w || 1;
          return rects.length ? Math.max(...rects.map((x) => x.width)) / sc : el.offsetWidth;
        }
        function fitW(text, font) { measurer.font = font; return measurer.measureText(text).width; }

        // paper: hand-cut edges and stop-motion "boil" (each element sways a little on every step)
        if (name === "paper") {
          const boil = [...stage.querySelectorAll(".note, .strip, .print, .device, .disc, .t, .brand")];
          const seeds = boil.map(() => rnd() * 10);
          tl.every((tt) => {
            const k = Math.floor(tt * 12);
            boil.forEach((el, i) => { const r = Film.rand(Math.floor(seeds[i] * 1000) + k); el.style.rotate = `${(r() - 0.5) * 0.5}deg`; el.style.translate = `${(r() - 0.5) * u * 0.12}px ${(r() - 0.5) * u * 0.12}px`; });
          });
        }
      },
    });
  }

  // a jagged clip-path polygon: a hand-cut paper edge
  function jag(rnd, n) {
    const pts = [];
    const j = () => rnd.range(0, 1.6);
    for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${j()}%`);
    for (let i = 0; i <= n / 3; i++) pts.push(`${100 - j()}% ${(i / (n / 3)) * 100}%`);
    for (let i = n; i >= 0; i--) pts.push(`${(i / n) * 100}% ${100 - j()}%`);
    for (let i = Math.floor(n / 3); i >= 0; i--) pts.push(`${j()}% ${(i / (n / 3)) * 100}%`);
    return `polygon(${pts.join(",")})`;
  }
  // a starburst badge
  function star(rnd, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 44 : 50 - rnd() * 1.5;
      pts.push(`${50 + Math.cos(a) * r}% ${50 + Math.sin(a) * r}%`);
    }
    return `polygon(${pts.join(",")})`;
  }

  window.LaunchVideo = { film, STYLES };
})();
