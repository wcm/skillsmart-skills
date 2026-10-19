/*
 * film.js · Skillsmart Film runtime (MIT)
 *
 * A film is a pure function of time. You describe it once as moves on a timeline; the runtime can then
 * jump to any moment, so the same page plays in the browser, scrubs, and renders frame by frame
 * (scripts/render.mjs calls window.__film.seek(t) for every frame and screenshots the stage).
 *
 *   Film.create({
 *     duration: 12, fps: 30,
 *     build(tl, F) {                         // F: { w, h, u, format, portrait, square, landscape, alpha }
 *       tl.set(".title", { opacity: 0, y: 40 });
 *       tl.to(".title", { opacity: 1, y: 0 }, 0.4, 0.8, "out");
 *       tl.fn(2, 1.5, (p) => (num.textContent = Math.round(p * 420)), "inOut");
 *       tl.label("Proof", 2);
 *     },
 *   });
 *
 * Props: x, y, z (px or "50%"), scale, scaleX, scaleY, rotate, rotateX, rotateY (deg), skewX: one transform.
 * spec.step (e.g. 1 / 12) holds every pose for that long: stop motion on twos, pixel art.
 * Anything else is a style (camelCase or --custom-property) or "attr:name" for an attribute. Numbers,
 * colours and strings with numbers in them ("inset(0 40% 0 0)", "blur(4px)") all interpolate.
 *
 * URL: ?format=16x9|9x16|1x1|4x5   ?w=&h=   ?t=3.2 (open paused there)   ?bare=1 (no player)   ?alpha=1
 */
(function () {
  "use strict";

  /* ---------- easing: one family (see references/motion-rules.md) ---------- */

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x, d = dx(t);
        if (Math.abs(e) < 1e-6) return sy(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 30; i++) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-6) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }

  // A damped spring that settles by p = 1. bounce 0 = no overshoot, 0.2 ≈ 3 %, 0.3 ≈ 9 %, 0.5 ≈ 30 %.
  function spring(bounce = 0.2) {
    const zeta = Math.max(0.1, 1 - Math.max(0, bounce) * 1.3);
    const w = 10;
    return (p) => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      const t = p;
      if (zeta >= 1) return 1 - (1 + w * t) * Math.exp(-w * t);
      const wd = w * Math.sqrt(1 - zeta * zeta);
      const v = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
      return v + (1 - v) * Math.pow(p, 8); // land exactly on 1
    };
  }

  const EASE = {
    linear: (p) => p,
    out: bezier(0.23, 1, 0.32, 1), //       arrivals
    in: bezier(0.68, 0, 0.77, 0), //        exits: the mirror of "out", so a cut can match speeds
    inOut: bezier(0.77, 0, 0.175, 1), //    moves on screen, camera
    snap: bezier(0.16, 1, 0.3, 1), //       kinetic type, hard arrivals
    soft: bezier(0.25, 0.1, 0.25, 1), //    colour, light, hover-like changes
    drawer: bezier(0.32, 0.72, 0, 1), //    panels, sheets, devices sliding in
    spring: spring(0.2),
    bounce: spring(0.35),
  };
  function ease(e) {
    if (typeof e === "function") return e;
    if (!e) return EASE.out;
    if (EASE[e]) return EASE[e];
    let m = /^steps\((\d+)\)$/.exec(e);
    if (m) { const n = +m[1]; return (p) => (p >= 1 ? 1 : Math.floor(p * n) / n); }
    m = /^spring\(([\d.]+)\)$/.exec(e);
    if (m) return spring(+m[1]);
    m = /^cubic-bezier\(([^)]+)\)$/.exec(e);
    if (m) { const [a, b, c, d] = m[1].split(",").map(Number); return bezier(a, b, c, d); }
    // "out@steps(8)": an ease played on twos (stop motion, pixel)
    m = /^(.+)@steps\((\d+)\)$/.exec(e);
    if (m) { const f = ease(m[1]), n = +m[2]; return (p) => f(p >= 1 ? 1 : Math.floor(p * n) / n); }
    console.warn("film: unknown ease", e);
    return EASE.out;
  }

  /* ---------- values ---------- */

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const TRANSFORM = new Set(["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "skewX"]);
  const PX = new Set(["width", "height", "left", "top", "right", "bottom", "borderRadius", "fontSize", "borderWidth", "strokeWidth", "outlineOffset", "outlineWidth", "gap", "padding", "margin",
    "marginLeft", "marginTop", "marginRight", "marginBottom", "paddingLeft", "paddingTop", "paddingRight", "paddingBottom", "minWidth", "maxWidth", "minHeight", "maxHeight", "letterSpacing", "wordSpacing", "textIndent", "blockSize", "inlineSize"]);
  const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

  function parseColor(s) {
    if (typeof s !== "string") return null;
    s = s.trim();
    let m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = [...h].map((c) => c + c).join("");
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    }
    m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    if (s === "transparent") return [0, 0, 0, 0];
    return null;
  }
  const fmtColor = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+c[3].toFixed(3)})`;

  // Returns (p) => value for any pair of values.
  function interpolator(prop, a, b) {
    if (typeof a === "number" && typeof b === "number") {
      const unit = PX.has(prop) ? "px" : "";
      return (p) => (unit ? lerp(a, b, p) + unit : lerp(a, b, p));
    }
    const ca = parseColor(a), cb = parseColor(b);
    if (ca && cb) return (p) => fmtColor(ca.map((v, i) => lerp(v, cb[i], p)));
    const sa = String(a), sb = String(b);
    const na = sa.match(NUM) || [], nb = sb.match(NUM) || [];
    if (na.length && na.length === nb.length && sa.replace(NUM, "#") === sb.replace(NUM, "#")) {
      const parts = sb.split(NUM);
      return (p) => {
        let out = parts[0];
        for (let i = 0; i < nb.length; i++) out += +lerp(+na[i], +nb[i], p).toFixed(4) + parts[i + 1];
        return out;
      };
    }
    if (typeof a === "number" || typeof b === "number") {
      // number ↔ "40%" or "12px": keep the string's unit
      const unit = String(typeof a === "number" ? b : a).replace(NUM, "");
      const va = parseFloat(a), vb = parseFloat(b);
      if (!isNaN(va) && !isNaN(vb)) return (p) => lerp(va, vb, p) + unit;
    }
    return (p) => (p < 1 ? a : b); // discrete (text, display, url())
  }

  function cssName(prop) {
    return prop.startsWith("--") ? prop : prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  }

  function readInitial(el, prop) {
    if (TRANSFORM.has(prop)) return prop.startsWith("scale") ? 1 : 0;
    if (prop === "opacity") {
      const v = parseFloat(getComputedStyle(el).opacity);
      return isNaN(v) ? 1 : v;
    }
    if (prop.startsWith("attr:")) {
      const v = el.getAttribute(prop.slice(5));
      return v !== null && !isNaN(+v) ? +v : v;
    }
    const v = prop.startsWith("--") ? getComputedStyle(el).getPropertyValue(prop).trim() : getComputedStyle(el)[prop];
    if (v !== "" && !isNaN(+v)) return +v;
    if (PX.has(prop) && /px$/.test(v)) return parseFloat(v);
    return v;
  }

  /* ---------- seeded randomness: never Math.random() in a film ---------- */

  function rand(seed = 1) {
    let a = (typeof seed === "string" ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 7) : seed) >>> 0;
    const r = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  }

  /* ---------- the timeline ---------- */

  class Timeline {
    constructor(stage, F) {
      this.stage = stage;
      this.F = F;
      this.tracks = new Map(); // el -> Map(prop -> [tween])
      this.fns = [];
      this.labels = [];
      this.media = [];
      this.end = 0;
    }
    resolve(target) {
      if (!target) return [];
      if (typeof target === "string") return [...this.stage.querySelectorAll(target)];
      if (target instanceof Element) return [target];
      return [...target];
    }
    add(el, prop, tw) {
      if (!this.tracks.has(el)) this.tracks.set(el, new Map());
      const props = this.tracks.get(el);
      if (!props.has(prop)) props.set(prop, []);
      props.get(prop).push(tw);
      this.end = Math.max(this.end, tw.at + tw.dur);
    }
    tween(target, from, to, at, dur, e) {
      const els = this.resolve(target);
      if (!els.length && typeof target === "string") console.warn("film: nothing matches", target);
      const fe = ease(e);
      els.forEach((el) => {
        for (const prop of Object.keys(to)) {
          const v = to[prop];
          const resolveVal = (x, i) => (typeof x === "function" ? x(i, el, this.F) : x);
          this.add(el, prop, { at, dur: Math.max(0, dur), from: from && prop in from ? resolveVal(from[prop], els.indexOf(el)) : undefined, to: resolveVal(v, els.indexOf(el)), ease: fe, seq: this.seq++ });
        }
      });
      return this;
    }
    set(target, props, at = 0) { return this.tween(target, null, props, at, 0, "linear"); }
    to(target, props, at, dur = 0.6, e = "out") { return this.tween(target, null, props, at, dur, e); }
    fromTo(target, from, to, at, dur = 0.6, e = "out") { return this.tween(target, from, to, at, dur, e); }
    // the same move on each element, `each` seconds apart
    stagger(target, props, at, dur, each = 0.06, e = "out", from = null) {
      this.resolve(target).forEach((el, i) => this.tween(el, from, props, at + i * each, dur, e));
      return this;
    }
    // visible only in [from, to)
    show(target, from, to = Infinity) {
      this.resolve(target).forEach((el) => {
        this.add(el, "visibility", { at: -1e9, dur: 0, from: "hidden", to: "hidden", ease: EASE.linear, seq: this.seq++ });
        this.add(el, "visibility", { at: from, dur: 0, from: "hidden", to: "visible", ease: EASE.linear, seq: this.seq++ });
        if (to !== Infinity) this.add(el, "visibility", { at: to, dur: 0, from: "visible", to: "hidden", ease: EASE.linear, seq: this.seq++ });
      });
      return this;
    }
    // fn(p, t): called on every seek with eased, clamped progress, so it must only depend on its arguments
    fn(at, dur, f, e = "linear") {
      this.fns.push({ at, dur: Math.max(0, dur), f, ease: ease(e) });
      this.end = Math.max(this.end, at + dur);
      return this;
    }
    // f(t): called on every seek with the film's time
    every(f) { this.fns.push({ at: 0, dur: 0, f, every: true }); return this; }
    // a <video> that plays from `at` (seeked frame by frame when rendering)
    video(target, at = 0, rate = 1) {
      this.resolve(target).forEach((el) => { el.muted = true; el.pause(); this.media.push({ el, at, rate }); });
      return this;
    }
    label(name, at) { this.labels.push({ name, at }); return this; }
    seq = 0;

    finalize() {
      for (const [el, props] of this.tracks) {
        for (const [prop, list] of props) {
          list.sort((a, b) => a.at - b.at || a.seq - b.seq);
          let prev = undefined;
          for (const tw of list) {
            if (tw.from === undefined) tw.from = prev !== undefined ? prev : readInitial(el, prop);
            tw.lerp = interpolator(prop, tw.from, tw.to);
            prev = tw.to;
          }
        }
      }
      this.labels.sort((a, b) => a.at - b.at);
    }

    apply(t) {
      for (const [el, props] of this.tracks) {
        let tf = null;
        for (const [prop, list] of props) {
          let tw = null;
          for (let i = list.length - 1; i >= 0; i--) if (list[i].at <= t) { tw = list[i]; break; }
          const value = tw ? tw.lerp(tw.ease(tw.dur > 0 ? clamp((t - tw.at) / tw.dur) : 1)) : list[0].lerp(0);
          if (TRANSFORM.has(prop)) {
            tf = tf || {};
            tf[prop] = value;
          } else if (prop.startsWith("attr:")) {
            el.setAttribute(prop.slice(5), value);
          } else if (prop.startsWith("--")) {
            el.style.setProperty(prop, value);
          } else {
            el.style[prop] = value;
          }
        }
        if (tf) el.style.transform = composeTransform(tf);
      }
      for (const f of this.fns) {
        if (f.every) f.f(t);
        else f.f(f.ease(f.dur > 0 ? clamp((t - f.at) / f.dur) : t >= f.at ? 1 : 0), t);
      }
      if (!this.media.length) return null;
      return Promise.all(this.media.map(({ el, at, rate }) => seekVideo(el, Math.max(0, (t - at) * rate))));
    }
  }

  function composeTransform(tf) {
    const unit = (v) => (typeof v === "number" ? v + "px" : v);
    let s = "";
    if (tf.x !== undefined || tf.y !== undefined) s += `translate(${unit(tf.x ?? 0)}, ${unit(tf.y ?? 0)}) `;
    if (tf.z) s += `translateZ(${unit(tf.z)}) `;
    if (tf.rotateX) s += `rotateX(${tf.rotateX}deg) `;
    if (tf.rotateY) s += `rotateY(${tf.rotateY}deg) `;
    if (tf.rotate) s += `rotate(${tf.rotate}deg) `;
    if (tf.skewX) s += `skewX(${tf.skewX}deg) `;
    const sc = tf.scale ?? 1;
    if (sc !== 1 || (tf.scaleX ?? 1) !== 1 || (tf.scaleY ?? 1) !== 1) s += `scale(${sc * (tf.scaleX ?? 1)}, ${sc * (tf.scaleY ?? 1)})`;
    return s.trim() || "none";
  }

  function seekVideo(el, time) {
    const d = el.duration || 0;
    const target = d ? (el.loop ? time % d : Math.min(time, d - 0.001)) : time;
    if (Math.abs(el.currentTime - target) < 0.001) return Promise.resolve();
    return new Promise((res) => {
      const done = () => { el.removeEventListener("seeked", done); res(); };
      el.addEventListener("seeked", done);
      el.currentTime = target;
      setTimeout(done, 1500);
    });
  }

  /* ---------- formats ---------- */

  const FORMATS = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] };
  function readFormat(q, fallback) {
    if (q.get("w") && q.get("h")) return { format: `${q.get("w")}x${q.get("h")}`, w: +q.get("w"), h: +q.get("h") };
    const f = q.get("format") || fallback || "16x9";
    const [w, h] = FORMATS[f] || FORMATS["16x9"];
    return { format: FORMATS[f] ? f : "16x9", w, h };
  }

  /* ---------- helpers for film authors ---------- */

  // Wrap each word (or letter) of an element in <span class="w"> / <span class="c"> for staggering.
  function split(el, by = "word") {
    const els = typeof el === "string" ? document.querySelectorAll(el) : el instanceof Element ? [el] : el;
    const out = [];
    for (const node of els) {
      const text = node.textContent;
      node.textContent = "";
      const words = text.split(/(\s+)/);
      for (const w of words) {
        if (/^\s+$/.test(w)) { node.appendChild(document.createTextNode(w)); continue; }
        if (!w) continue;
        const ws = document.createElement("span");
        ws.className = "w";
        ws.style.display = "inline-block";
        if (by === "char") {
          for (const c of w) {
            const cs = document.createElement("span");
            cs.className = "c";
            cs.style.display = "inline-block";
            cs.textContent = c;
            ws.appendChild(cs);
            out.push(cs);
          }
        } else {
          ws.textContent = w;
          out.push(ws);
        }
        node.appendChild(ws);
      }
    }
    return out;
  }

  // "1234.5" -> "1,234.5"; keeps the decimals of the target
  function formatNumber(v, target, opts = {}) {
    const decimals = opts.decimals ?? ((String(target).split(".")[1] || "").length);
    const s = Math.abs(v).toFixed(decimals);
    const [i, d] = s.split(".");
    const grouped = opts.group === false ? i : i.replace(/\B(?=(\d{3})+(?!\d))/g, opts.sep ?? ",");
    return (v < 0 ? "−" : "") + (opts.prefix || "") + grouped + (d ? "." + d : "") + (opts.suffix || "");
  }

  /* ---------- the player ---------- */

  const q = new URLSearchParams(location.search);
  const RENDER = q.has("render");
  const BARE = RENDER || q.has("bare");

  function create(spec) {
    const stage = document.querySelector(spec.stage || "#film");
    if (!stage) throw new Error("film: no #film element");
    const fmt = readFormat(q, spec.format);
    const alpha = q.has("alpha");
    const F = { ...fmt, u: Math.min(fmt.w, fmt.h) / 100, portrait: fmt.h > fmt.w * 1.15, square: Math.abs(fmt.w - fmt.h) / fmt.w < 0.3, landscape: fmt.w > fmt.h * 1.15, alpha, q };
    if (F.square) { F.portrait = false; F.landscape = false; }
    F.shape = F.portrait ? "portrait" : F.landscape ? "landscape" : "square";
    const root = document.documentElement;
    root.dataset.format = F.format;
    root.dataset.shape = F.shape;
    if (alpha) root.classList.add("alpha");
    if (BARE) root.classList.add("bare");
    if (RENDER) root.classList.add("render");
    stage.style.width = F.w + "px";
    stage.style.height = F.h + "px";
    root.style.setProperty("--w", F.w + "px");
    root.style.setProperty("--h", F.h + "px");
    root.style.setProperty("--u", F.u + "px");

    const fps = spec.fps || 30;
    let tl = null;
    const film = {
      fps, F, stage,
      duration: spec.duration || 0,
      labels: [],
      seek(t) {
        if (!tl) return;
        film.t = t;
        const st = spec.step || 0;
        return tl.apply(st ? Math.floor(t / st + 1e-6) * st : t);
      },
      t: 0,
    };
    window.__film = film;

    film.ready = (async () => {
      if (document.fonts) {
        await document.fonts.ready;
        // fonts declared in CSS but not yet used on the first frame
        for (const f of spec.fonts || []) await document.fonts.load(f).catch(() => {});
      }
      await Promise.all([...document.images].map((img) => (img.complete ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = img.onerror = () => img.decode().then(r, r); }))));
      if (spec.setup) await spec.setup(F);
      tl = new Timeline(stage, F);
      spec.build(tl, F);
      tl.finalize();
      film.duration = spec.duration || tl.end;
      film.labels = tl.labels;
      film.timeline = tl;
      await film.seek(q.has("t") ? +q.get("t") : 0);
      if (!BARE) player(film);
      else if (!RENDER && !q.has("t")) autoplay(film);
      return film;
    })();
    return film;
  }

  function autoplay(film) {
    let t0 = null;
    const loop = (now) => {
      if (t0 === null) t0 = now;
      film.seek(((now - t0) / 1000) % film.duration);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Preview: the stage scaled to the window, a bar to play, scrub, step and switch format.
  function player(film) {
    const { stage, F } = film;
    const wrap = document.createElement("div");
    wrap.className = "film-wrap";
    stage.parentNode.insertBefore(wrap, stage);
    wrap.appendChild(stage);
    const bar = document.createElement("div");
    bar.className = "film-bar";
    bar.innerHTML = `<button class="fb-play" title="Play / pause (space)">❚❚</button>
      <span class="fb-time">0.00</span>
      <div class="fb-track"><div class="fb-fill"></div>${film.labels.map((l) => `<i style="left:${(l.at / film.duration) * 100}%" title="${l.name}"></i>`).join("")}</div>
      <span class="fb-label"></span>
      <span class="fb-formats">${Object.keys(FORMATS).map((f) => `<a href="?${new URLSearchParams({ ...Object.fromEntries(q), format: f })}" class="${f === F.format ? "on" : ""}">${f.replace("x", ":")}</a>`).join("")}</span>`;
    document.body.appendChild(bar);
    const fill = bar.querySelector(".fb-fill"), time = bar.querySelector(".fb-time"), label = bar.querySelector(".fb-label"), play = bar.querySelector(".fb-play"), track = bar.querySelector(".fb-track");

    const fit = () => {
      const s = Math.min((innerWidth - 48) / F.w, (innerHeight - 96) / F.h, 1);
      wrap.style.width = F.w * s + "px";
      wrap.style.height = F.h * s + "px";
      stage.style.transform = `scale(${s})`;
    };
    addEventListener("resize", fit);
    fit();

    let playing = !q.has("t"), t = film.t, last = null;
    const draw = () => {
      film.seek(t);
      fill.style.width = (t / film.duration) * 100 + "%";
      time.textContent = t.toFixed(2) + " / " + film.duration.toFixed(1) + "s";
      const cur = film.labels.filter((l) => l.at <= t + 1e-6).pop();
      label.textContent = cur ? cur.name : "";
      play.textContent = playing ? "❚❚" : "▶";
    };
    const tick = (now) => {
      if (playing) {
        if (last !== null) t += (now - last) / 1000;
        if (t >= film.duration) t = q.has("once") ? film.duration : 0;
        draw();
      }
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    draw();

    const toggle = () => { playing = !playing; last = null; draw(); };
    play.onclick = toggle;
    stage.onclick = toggle;
    const scrub = (e) => {
      const r = track.getBoundingClientRect();
      t = clamp((e.clientX - r.left) / r.width) * film.duration;
      draw();
    };
    track.onpointerdown = (e) => {
      playing = false;
      scrub(e);
      track.setPointerCapture(e.pointerId);
      track.onpointermove = scrub;
      track.onpointerup = () => (track.onpointermove = null);
    };
    addEventListener("keydown", (e) => {
      const frame = 1 / film.fps;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") { playing = false; t = Math.min(film.duration, t + (e.shiftKey ? 1 : frame)); draw(); }
      else if (e.key === "ArrowLeft") { playing = false; t = Math.max(0, t - (e.shiftKey ? 1 : frame)); draw(); }
      else if (e.key === "r") { t = 0; playing = true; draw(); }
      else if (e.key === "Home") { t = 0; draw(); }
      else if (e.key === "]" || e.key === "[") {
        const ls = film.labels.map((l) => l.at);
        const next = e.key === "]" ? ls.find((a) => a > t + 0.01) : ls.filter((a) => a < t - 0.01).pop();
        if (next !== undefined) { playing = false; t = next; draw(); }
      }
    });
  }

  window.Film = { create, EASE, ease, bezier, spring, rand, split, formatNumber, clamp, lerp, FORMATS };
})();
