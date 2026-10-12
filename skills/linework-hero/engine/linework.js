/*
 * Linework: looks, parts and a scene, on the Hairline kernel (HL, kernel.js).
 * The kernel is © 2026 Lucas Marques, MIT (LICENSE-hairline); it is used unchanged.
 *
 * A figure is one call:
 *
 *   linework({ name, means, look, camera, inputs, range, tour, draw(s, value) { …; return answer } })
 *
 * draw(s, value) builds the scene once out of groups of parts and returns
 * answer(input, value), which sets targets on groups and returns the read-out.
 * The engine does the rest: it fits the frame, keeps paint order, runs the
 * springs and tweens, tests the pointer against the rest pose, draws only what
 * changed, and dresses everything in a look.
 */
var LW = (() => {
  const { Cam, proj, unproj, rrect, hull, run, poly, open, spring, stepS, tween, tset, tval, tdone, mk, register, pointer, tour, clamp, lerp, rad, LAP } = HL;

  /* ------------------------------------------------------------------ looks */
  // Colour roles. A figure never names a colour; it names a role by class, and the look fills it in.
  //   ground  the page the figure sits on      plate   the sides of every solid (hides what is behind)
  //   shade   sides that face screen-right     top     the face looking at the viewer
  //   edge    silhouettes                      crease  the one inner line of a solid
  //   mid     guides, dots, lines              accent  the one highlight      accentTop  the lit face
  //   ink2    the second ink (offset fx)       glow    halo colour (glow fx)
  //   ink / muted / line                       the page around the figure
  const LOOKS = {
    paper: { label: "Paper", w: 0.9, fx: "", c: { ground: "#ffffff", plate: "#ffffff", shade: "#ffffff", top: "#ffffff", edge: "#a4a4ac", crease: "#e0e0e4", mid: "#c3c3c9", accent: "#232327", accentTop: "#ffffff", ink2: "#232327", glow: "transparent", ink: "#232327", muted: "#77777f", line: "#e7e7eb" } },
    graphite: { label: "Graphite", dark: true, w: 0.9, fx: "", c: { ground: "#08090a", plate: "#08090a", shade: "#08090a", top: "#08090a", edge: "#5b5d64", crease: "#29292d", mid: "#3e3e44", accent: "#d0d6e0", accentTop: "#08090a", ink2: "#d0d6e0", glow: "transparent", ink: "#d0d6e0", muted: "#7d7f88", line: "#1f2023" } },
    blueprint: { label: "Blueprint", dark: true, w: 0.9, fx: "grid", c: { ground: "#1d3f73", plate: "#1d3f73", shade: "#1d3f73", top: "#1d3f73", edge: "#dbe7ff", crease: "#5a7fbf", mid: "#93b3ea", accent: "#ffc857", accentTop: "#284f8a", ink2: "#ffc857", glow: "transparent", ink: "#eef4ff", muted: "#9fb8e4", line: "rgba(219,231,255,0.11)" } },
    riso: { label: "Riso", w: 1, fx: "offset grain", c: { ground: "#f3eee4", plate: "#f3eee4", shade: "#f3eee4", top: "#f3eee4", edge: "#2b4cab", crease: "#aebbe0", mid: "#5f78c6", accent: "#ff3d8b", accentTop: "#ffd3e3", ink2: "#ff6aa6", glow: "transparent", ink: "#22408f", muted: "#6c7db6", line: "#ddd5c5" } },
    neon: { label: "Neon", dark: true, w: 1, fx: "glow", c: { ground: "#0f0c1d", plate: "#0f0c1d", shade: "#0f0c1d", top: "#0f0c1d", edge: "#7a68e6", crease: "#2d2653", mid: "#5446ab", accent: "#c8ff3d", accentTop: "#1c2312", ink2: "#c8ff3d", glow: "#6a58d8", ink: "#ece8ff", muted: "#8f87c6", line: "#241f40" } },
    clay: { label: "Clay", w: 1, fx: "grain", c: { ground: "#efe5da", plate: "#dcc5ae", shade: "#c8aa8f", top: "#f8efe6", edge: "#987660", crease: "#e2cdb8", mid: "#b39079", accent: "#d4532c", accentTop: "#f7c6b0", ink2: "#d4532c", glow: "transparent", ink: "#5b4132", muted: "#977a66", line: "#ddcdbd" } },
    ink: { label: "Ink", w: 1.5, fx: "wobble grain", c: { ground: "#f5f0e6", plate: "#f5f0e6", shade: "#f5f0e6", top: "#f5f0e6", edge: "#1f1c18", crease: "#b1aa9d", mid: "#5d574e", accent: "#cc3123", accentTop: "#f5f0e6", ink2: "#cc3123", glow: "transparent", ink: "#1f1c18", muted: "#7b756b", line: "#e2dbcd" } },
    // four looks made for real pages: a one-hue diagram, a ledger, a product studio, a developer console
    cobalt: { label: "Cobalt", w: 1, fx: "grid", c: { ground: "#f7f9fe", plate: "#e9eefc", shade: "#d3ddf8", top: "#ffffff", edge: "#3352d6", crease: "#c3cff3", mid: "#7f93e0", accent: "#1d3fd8", accentTop: "#dfe6ff", ink2: "#1d3fd8", glow: "transparent", ink: "#13235e", muted: "#5f6d9e", line: "rgba(51,82,214,0.07)" } },
    ledger: { label: "Ledger", w: 1.1, fx: "grain", c: { ground: "#f4efe3", plate: "#f4efe3", shade: "#ebe3d0", top: "#faf6ec", edge: "#1f4a3a", crease: "#c9c0a8", mid: "#5f7d6f", accent: "#c8402b", accentTop: "#f6d7c9", ink2: "#c8402b", glow: "transparent", ink: "#1c2f27", muted: "#6b7a70", line: "#dcd3bd" } },
    studio: { label: "Studio", dark: true, w: 1, fx: "", c: { ground: "#141312", plate: "#24221f", shade: "#1a1917", top: "#302d29", edge: "#a39b8f", crease: "#45413b", mid: "#6e675d", accent: "#e6b35a", accentTop: "#4a3b22", ink2: "#e6b35a", glow: "transparent", ink: "#efe9df", muted: "#9b9387", line: "#2b2926" } },
    console: { label: "Console", dark: true, w: 1, fx: "glow", c: { ground: "#0a0e14", plate: "#111823", shade: "#0c121b", top: "#16202e", edge: "#5b7290", crease: "#1f2c3d", mid: "#3a4d66", accent: "#5eead4", accentTop: "#123a38", ink2: "#5eead4", glow: "rgba(94,234,212,0.18)", ink: "#dbe7f5", muted: "#7f93ad", line: "#18222f" } },
    signal: { label: "Signal", w: 1.1, fx: "", c: { ground: "#efeeea", plate: "#e3e2dc", shade: "#cfcdc5", top: "#fbfaf7", edge: "#26251f", crease: "#d4d2ca", mid: "#7a786e", accent: "#ff5b1f", accentTop: "#ffd9c7", ink2: "#ff5b1f", glow: "transparent", ink: "#1c1b17", muted: "#6f6d64", line: "rgba(38,37,31,0.07)" } },
    sage: { label: "Sage", w: 1, fx: "", c: { ground: "#eef0e8", plate: "#dfe3d5", shade: "#cbd1bf", top: "#f8f9f3", edge: "#55604c", crease: "#d4dacb", mid: "#8e9883", accent: "#cf6233", accentTop: "#f5d3c1", ink2: "#cf6233", glow: "transparent", ink: "#2c3327", muted: "#6c7563", line: "rgba(85,96,76,0.08)" } },
    terminal: { label: "Terminal", dark: true, w: 1, fx: "glow scan", c: { ground: "#06110a", plate: "#06110a", shade: "#06110a", top: "#06110a", edge: "#2f8d4d", crease: "#123620", mid: "#1f6236", accent: "#8dffaa", accentTop: "#0d2616", ink2: "#8dffaa", glow: "#1f7a3d", ink: "#a9f7bf", muted: "#4f9a66", line: "#123020" } },
  };

  /** A whole look from one hue, light or dark, in OKLCH so every hue keeps the same contrast. */
  function hueLook(h, dark) {
    const o = (l, c) => `oklch(${l}% ${c} ${h})`;
    const c = dark
      ? { ground: o(17, 0.025), plate: o(19, 0.03), shade: o(15, 0.03), top: o(22, 0.035), edge: o(66, 0.1), crease: o(31, 0.045), mid: o(46, 0.07), accent: o(86, 0.17), accentTop: o(31, 0.08), ink2: o(86, 0.17), glow: "transparent", ink: o(93, 0.03), muted: o(66, 0.05), line: o(27, 0.03) }
      : { ground: o(97.5, 0.012), plate: o(95.5, 0.02), shade: o(91, 0.035), top: o(98.5, 0.008), edge: o(56, 0.09), crease: o(87, 0.04), mid: o(74, 0.06), accent: o(52, 0.2), accentTop: o(90, 0.07), ink2: o(52, 0.2), glow: "transparent", ink: o(28, 0.06), muted: o(54, 0.05), line: o(91, 0.02) };
    return { label: "Hue", key: `hue:${Math.round(h)}${dark ? ":dark" : ""}`, dark: !!dark, w: 1, fx: "", c };
  }

  /** "clay", "hue:285", "hue:285:dark" or a look object, to a look object. */
  function resolve(look) {
    if (look && typeof look === "object") return look;
    const s = String(look || "paper");
    if (s.startsWith("hue")) {
      const [, h, d] = s.split(":");
      return hueLook(Number(h) || 0, d === "dark");
    }
    return Object.assign({ key: s }, LOOKS[s] || LOOKS.paper);
  }
  const kebab = (k) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
  function applyLook(el, look) {
    const L = resolve(look);
    for (const k in L.c) el.style.setProperty("--lw-" + kebab(k), L.c[k]);
    el.style.setProperty("--lw-w", String(L.w || 1));
    el.dataset.lwFx = L.fx || "";
    el.dataset.lwDark = L.dark ? "1" : "0";
    return L;
  }

  /* -------------------------------------------------------------- cameras */
  const CAMS = {
    iso: { label: "Iso", az: 45, k: 0.5 },
    trueiso: { label: "True iso", az: 45, k: 0.577 },
    low: { label: "Low", az: 45, k: 0.34 },
    high: { label: "High", az: 45, k: 0.74 },
    turned: { label: "Turned", az: 30, k: 0.5 },
  };

  /* ---------------------------------------------------------- stylesheet */
  const EASE = "cubic-bezier(.5,0,.1,1)";
  const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .32 0 0 0 0 .27 0 0 0 0 .22 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
  const CSS = `
[data-lw]{position:relative;display:block;aspect-ratio:5/4;container-type:inline-size;touch-action:pan-y;user-select:none;-webkit-user-select:none;overflow:hidden;background-color:var(--lw-ground);transition:background-color .4s ${EASE}}
[data-lw]>svg{position:absolute;inset:0;width:100%;height:100%;display:block}
[data-lw] svg :is(path,ellipse,circle){vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;transition:stroke .26s ${EASE},fill .26s ${EASE}}
.lw-f{fill:var(--lw-plate);stroke:none}
.lw-sh{fill:var(--lw-shade);stroke:none}
.lw-t{fill:var(--lw-top);stroke:none}
.lw-o{fill:none;stroke:var(--lw-edge);stroke-width:var(--lw-w)}
.lw-c{fill:none;stroke:var(--lw-crease);stroke-width:var(--lw-w)}
.lw-l{fill:none;stroke:var(--lw-mid);stroke-width:var(--lw-w)}
.lw-l.edge{stroke:var(--lw-edge)}.lw-l.lo{stroke:var(--lw-crease)}.lw-l.dash{stroke-dasharray:1 3.5}
.lw-tube{fill:none;stroke:var(--lw-edge);stroke-width:calc(var(--lw-w)*4.4)}
.lw-tube-in{fill:none;stroke:var(--lw-plate);stroke-width:calc(var(--lw-w)*2.4)}
.lw-p{fill:var(--lw-plate);stroke:var(--lw-mid);stroke-width:var(--lw-w)}.lw-p.lo{stroke:var(--lw-crease)}.lw-p.nf{fill:none}.lw-p.edge{stroke:var(--lw-edge)}.lw-p.hole{fill:var(--lw-crease);stroke:var(--lw-mid)}
.lw-d{fill:var(--lw-mid);stroke:none}.lw-d.off{fill:var(--lw-crease)}.lw-d.on{fill:var(--lw-edge)}
.dim .lw-o{stroke:var(--lw-crease)}
.lw-lead{fill:none;stroke:var(--lw-mid);stroke-width:var(--lw-w);stroke-dasharray:1.2 2.6}
.lw-labels{position:absolute;inset:0;pointer-events:none;z-index:1}
.lw-label{position:absolute;white-space:nowrap;font:600 clamp(9px,2.3cqw,13px)/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.005em;color:var(--lw-ink);padding:1px 4px;border-radius:4px;background:color-mix(in srgb,var(--lw-ground) 82%,transparent);transition:color .26s ${EASE},opacity .35s ${EASE}}
.lw-label small{display:block;font:500 clamp(8px,1.95cqw,11px)/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--lw-muted);letter-spacing:0}
.lw-label.lit{color:var(--lw-accent)}.lw-leads .lit .lw-lead{stroke:var(--lw-accent);stroke-dasharray:none}.lw-leads .lit .lw-d{fill:var(--lw-accent)}
.lw-label.up{transform:translate(-50%,-100%)}.lw-label.down{transform:translate(-50%,0)}.lw-label.left{transform:translate(-100%,-50%)}.lw-label.right{transform:translate(0,-50%)}
.lit>.lw-part:not(.nl) :is(.lw-o,.lw-tube,.lw-l:not(.lo):not(.dash),.lw-p:not(.lo)){stroke:var(--lw-accent)}
.lit>.lw-part:not(.nl) .lw-t{fill:var(--lw-accent-top)}
.lit>.lw-part:not(.nl) .lw-d:not(.off){fill:var(--lw-accent)}
.lw-offset{--lw-edge:var(--lw-ink2);--lw-accent:var(--lw-ink2);--lw-mid:var(--lw-ink2);--lw-crease:transparent;--lw-glow:transparent}
[data-lw]:not([data-lw-fx~="offset"]) .lw-offset{display:none}
[data-lw].lw-clear{background:none;overflow:visible}[data-lw].lw-clear::before,[data-lw].lw-clear::after{display:none}
[data-lw-fx~="wobble"] .lw-wrap{filter:var(--lw-wobble)}
[data-lw-fx~="glow"] :is(.lw-o,.lw-tube,.lw-l.edge){filter:drop-shadow(0 0 2px var(--lw-glow))}
[data-lw-fx~="glow"] .lit>.lw-part:not(.nl) :is(.lw-o,.lw-tube,.lw-l:not(.lo):not(.dash)){filter:drop-shadow(0 0 2.5px var(--lw-accent)) drop-shadow(0 0 7px var(--lw-accent))}
[data-lw-fx~="glow"] .lit>.lw-part:not(.nl) .lw-d:not(.off){filter:drop-shadow(0 0 3px var(--lw-accent))}
[data-lw-fx~="grid"]{background-image:linear-gradient(var(--lw-line) 1px,transparent 1px),linear-gradient(90deg,var(--lw-line) 1px,transparent 1px);background-size:20px 20px;background-position:center}
[data-lw]::after,[data-lw]::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s}
[data-lw-fx~="grain"]::after{background-image:${GRAIN};opacity:.2;mix-blend-mode:multiply}
[data-lw-fx~="grain"][data-lw-dark="1"]::after{mix-blend-mode:screen;opacity:.1}
[data-lw-fx~="scan"]::before{background:repeating-linear-gradient(transparent 0 2px,rgba(0,0,0,.28) 2px 3px);opacity:1}
`;
  let styled = false;
  function inject() {
    if (styled) return;
    styled = true;
    const st = document.createElement("style");
    st.setAttribute("data-linework", "");
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------- geometry */
  function view(C) {
    const P = proj(C), s = Math.sin(C.az), c = Math.cos(C.az), zf = Math.sqrt(1 - C.k * C.k);
    const D = [s * zf, c * zf, C.k]; // toward the viewer
    return {
      C, P, D, S: C.S, s, c,
      faces: (q) => q.nx * D[0] + q.ny * D[1] + q.nz * D[2] >= -1e-6,
      right: (q) => q.nx * c - q.ny * s > 0.02,
      depth: (x, y, z) => x * s + y * c + z * 10,
    };
  }
  const pr = (V) => (q) => V.P(q.x, q.y, q.z);
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const plane3 = (plane, at, u, v) => (plane === "z" ? [u, v, at] : plane === "y" ? [u, at, v] : [at, u, v]);

  // a rounded rectangle footprint at height z, as 3D samples with outward normals
  const rr3 = (x0, y0, x1, y1, r, z, n) => rrect(x0, y0, x1, y1, r, n).map((q) => ({ x: q.u, y: q.v, z, nx: q.nu, ny: q.nv, nz: 0 }));
  // a circle round an axis ("z" stands up, "y" and "x" lie down), at `at` along it
  function circ3(axis, c1, c2, at, R, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      if (axis === "z") out.push({ x: c1 + R * ca, y: c2 + R * sa, z: at, nx: ca, ny: sa, nz: 0 });
      else if (axis === "y") out.push({ x: c1 + R * ca, y: at, z: c2 + R * sa, nx: ca, ny: 0, nz: sa });
      else out.push({ x: at, y: c1 + R * ca, z: c2 + R * sa, nx: 0, ny: ca, nz: sa });
    }
    return out;
  }

  /** A solid between two parallel rings: silhouette, the face toward the viewer, its shaded side and one crease. */
  function extrude(V, r0, r1, axisN, inner0, inner1, rim) {
    const P = pr(V), p0 = r0.map(P), p1 = r1.map(P), h = hull(p0.concat(p1));
    const vis1 = dot3(axisN, V.D) >= 0, cap = vis1 ? p1 : p0, inner = vis1 ? inner1 : inner0;
    const idx = r0.map((_, i) => i);
    const rs = run(idx, (i) => V.faces(r0[i]) && V.right(r0[i]));
    return {
      sil: poly(h),
      top: poly(cap),
      shade: rs.length > 1 ? poly(rs.map((i) => p1[i]).concat(rs.slice().reverse().map((i) => p0[i]))) : "",
      crease: inner ? (rim ? poly(inner.map(P)) : open(run(inner, V.faces).map(P))) : "",
      pts: h,
      capAt: vis1 ? 1 : 0,
    };
  }

  function crescent(c, r, off) {
    const N = 44, A = [], B = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const p = [c[0] + r * ca, c[1] + r * sa], q = [off[0] + r * ca, off[1] + r * sa];
      A.push({ p, keep: Math.hypot(p[0] - off[0], p[1] - off[1]) > r });
      B.push({ p: q, keep: Math.hypot(q[0] - c[0], q[1] - c[1]) < r });
    }
    const a = run(A, (q) => q.keep).map((q) => q.p), b = run(B, (q) => q.keep).map((q) => q.p);
    return a.length > 2 && b.length > 1 ? poly(a.concat(b.reverse())) : "";
  }

  // Each kind turns a spec into paths (by element) and the screen points it covers.
  const KINDS = {
    box(V, sp) {
      const { x, y, z = 0, w, d, h } = sp;
      if (!(w > 0.4 && d > 0.4 && h > 0.05)) return null;
      const t = sp.taper || 0, r = sp.r ?? 3, n = r * V.S > 14 ? 8 : 4;
      const b = Math.max(0.2, Math.min(sp.b ?? 1.2, (Math.min(w, d) - 2 * t) / 2 - 0.25));
      const r0 = rr3(x, y, x + w, y + d, r, z, n);
      const r1 = rr3(x + t, y + t, x + w - t, y + d - t, Math.max(0.3, r - t * 0.5), z + h, n);
      const i1 = sp.b === 0 ? null : rr3(x + t + b, y + t + b, x + w - t - b, y + d - t - b, Math.max(0.3, r - t * 0.5 - b), z + h, n);
      return extrude(V, r0, r1, [0, 0, 1], null, i1, sp.tray);
    },
    cyl(V, sp) {
      const axis = sp.axis || "z";
      let c1, c2, a0, len;
      if (axis === "z") [c1, c2, a0, len] = [sp.cx, sp.cy, sp.z || 0, sp.h];
      else if (axis === "y") [c1, c2, a0, len] = [sp.cx, sp.cz, sp.y, sp.len];
      else [c1, c2, a0, len] = [sp.cy, sp.cz, sp.x, sp.len];
      const R = sp.R, R1 = sp.R1 ?? R, b = sp.b ?? 1, n = sp.n || 48;
      if (!(R > 0.2 && len > 0.05)) return null;
      const r0 = circ3(axis, c1, c2, a0, R, n), r1 = circ3(axis, c1, c2, a0 + len, R1, n);
      const N = axis === "z" ? [0, 0, 1] : axis === "y" ? [0, 1, 0] : [1, 0, 0];
      const g = extrude(V, r0, r1, N, b > 0 ? circ3(axis, c1, c2, a0, R - b, n) : null, b > 0 ? circ3(axis, c1, c2, a0 + len, R1 - b, n) : null, sp.rim);
      const P = pr(V), capAt = g.capAt ? a0 + len : a0;
      let extra = "";
      if (sp.hole) extra += poly(circ3(axis, c1, c2, capAt, sp.hole, n).map(P));
      if (sp.ridges) {
        const ring = circ3(axis, c1, c2, a0, R, sp.ridges), ins = Math.min(1.2, len * 0.2);
        for (const q of ring) {
          if (dot3([q.nx, q.ny, q.nz], V.D) < 0.12) continue;
          const A = [q.x, q.y, q.z], B = [q.x, q.y, q.z], i = axis === "z" ? 2 : axis === "y" ? 1 : 0;
          A[i] = a0 + ins;
          B[i] = a0 + len - ins;
          const pa = V.P(A[0], A[1], A[2]), pb = V.P(B[0], B[1], B[2]);
          extra += `M${pa[0].toFixed(2)} ${pa[1].toFixed(2)}L${pb[0].toFixed(2)} ${pb[1].toFixed(2)}`;
        }
      }
      g.extra = extra;
      return g;
    },
    ball(V, sp) {
      const c = V.P(sp.cx, sp.cy, sp.cz), r = sp.R * V.S;
      if (!(r > 0.4)) return null;
      const pts = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      }
      const P = pr(V);
      return {
        sil: poly(pts),
        shade: crescent(c, r, [c[0] - 0.34 * r, c[1] - 0.46 * r]),
        crease: sp.eq ? open(run(circ3("z", sp.cx, sp.cy, sp.cz, sp.R, 48), V.faces).map(P)) : "",
        pts,
      };
    },
    line(V, sp) {
      if (!sp.pts || sp.pts.length < 2) return null;
      const pts = sp.pts.map((p) => V.P(p[0], p[1], p[2]));
      return { line: sp.closed ? poly(pts) : open(pts), pts };
    },
    cable(V, sp) {
      const a = sp.a, b = sp.b, n = 28, lift = sp.lift || 0, sway = sp.sway || 0;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
      const W = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, bump = Math.pow(Math.sin(Math.PI * t), 0.7), sw = 4 * t * (1 - t);
        W.push([a[0] + dx * t + px * sway * sw, a[1] + dy * t + py * sway * sw, a[2] + (b[2] - a[2]) * t + lift * bump]);
      }
      const pts = W.map((p) => V.P(p[0], p[1], p[2]));
      return { line: open(pts), pts };
    },
    dot(V, sp) {
      const plane = sp.plane || "z", at = sp.at ?? sp.z ?? 0, cu = sp.cu ?? sp.x, cv = sp.cv ?? sp.y, r = sp.r ?? 1;
      if (!(r > 0.05)) return null;
      const pts = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2, p = plane3(plane, at, cu + r * Math.cos(a), cv + r * Math.sin(a));
        pts.push(V.P(p[0], p[1], p[2]));
      }
      return { line: poly(pts), pts };
    },
    patch(V, sp) {
      const plane = sp.plane || "z";
      if (!(sp.u1 - sp.u0 > 0.2 && sp.v1 - sp.v0 > 0.2)) return null;
      const pts = rrect(sp.u0, sp.v0, sp.u1, sp.v1, sp.r ?? 1, 4).map((q) => {
        const p = plane3(plane, sp.at, q.u, q.v);
        return V.P(p[0], p[1], p[2]);
      });
      return { line: poly(pts), pts };
    },
    arc(V, sp) {
      const plane = sp.plane || "z", a0 = sp.a0 ?? 0, a1 = sp.a1 ?? 360, full = a1 - a0 >= 359.9;
      const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 6)), pts = [];
      for (let k = 0; k <= (full ? n - 1 : n); k++) {
        const a = rad(a0 + ((a1 - a0) * k) / n), p = plane3(plane, sp.at, sp.cu + sp.R * Math.cos(a), sp.cv + sp.R * Math.sin(a));
        pts.push(V.P(p[0], p[1], p[2]));
      }
      return { line: full ? poly(pts) : open(pts), pts };
    },
    shape(V, sp) {
      const plane = sp.plane || "z";
      const pts = sp.pts.map(([u, v]) => {
        const p = plane3(plane, sp.at, u, v);
        return V.P(p[0], p[1], p[2]);
      });
      return { line: sp.closed === false ? open(pts) : poly(pts), pts };
    },
  };
  // a label: a dotted leader from a world point, and the text as HTML at its end (so it is always crisp and correct)
  KINDS.label = (V, sp) => {
    const a = V.P(sp.at[0], sp.at[1], sp.at[2]), dx = sp.dx ?? 0, dy = sp.dy ?? -16, e = [a[0] + dx, a[1] + dy];
    const r = 1.5, c = [];
    for (let k = 0; k < 12; k++) c.push([a[0] + r * Math.cos((k / 12) * 6.283), a[1] + r * 0.6 * Math.sin((k / 12) * 6.283)]);
    const align = sp.align || (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy > 0 ? "down" : "up");
    return { line: open([a, e]), dot: poly(c), pts: [a, e], label: { x: e[0], y: e[1], text: sp.text, sub: sp.sub || "", align } };
  };
  const SOLID = { box: 1, cyl: 1, ball: 1 };
  const ELS = {
    solid: [["f", "lw-f"], ["sh", "lw-sh"], ["t", "lw-t"], ["o", "lw-o"], ["c", "lw-c"], ["x", "lw-c"]],
    line: [["l", "lw-l"]],
    tube: [["l", "lw-tube"], ["i", "lw-tube-in"]],
    dot: [["l", "lw-d"]],
    patch: [["l", "lw-p"]],
    label: [["l", "lw-lead"], ["d", "lw-d"]],
  };
  // the world box a solid spec fills, [x0, y0, z0, x1, y1, z1], for occlusion tests
  function aabb(kind, sp) {
    if (kind === "box") return [sp.x, sp.y, sp.z || 0, sp.x + sp.w, sp.y + sp.d, (sp.z || 0) + sp.h];
    if (kind === "ball") return [sp.cx - sp.R, sp.cy - sp.R, sp.cz - sp.R, sp.cx + sp.R, sp.cy + sp.R, sp.cz + sp.R];
    if (kind === "cyl") {
      const a = sp.axis || "z", R = Math.max(sp.R, sp.R1 ?? sp.R);
      if (a === "z") return [sp.cx - R, sp.cy - R, sp.z || 0, sp.cx + R, sp.cy + R, (sp.z || 0) + sp.h];
      if (a === "y") return [sp.cx - R, sp.y, sp.cz - R, sp.cx + R, sp.y + sp.len, sp.cz + R];
      return [sp.x, sp.cy - R, sp.cz - R, sp.x + sp.len, sp.cy + R, sp.cz + R];
    }
    return null;
  }
  // where a spec stands, for paint order: its foot on the ground and its base height
  function anchor(kind, sp) {
    if (kind === "box") return [sp.x + sp.w / 2, sp.y + sp.d / 2, sp.z || 0];
    if (kind === "cyl") {
      const a = sp.axis || "z";
      if (a === "z") return [sp.cx, sp.cy, sp.z || 0];
      if (a === "y") return [sp.cx, sp.y + sp.len / 2, sp.cz - sp.R];
      return [sp.x + sp.len / 2, sp.cy, sp.cz - sp.R];
    }
    if (kind === "ball") return [sp.cx, sp.cy, sp.cz - sp.R];
    if (kind === "line") return sp.pts[0];
    if (kind === "cable") return sp.a;
    if (kind === "label") return sp.at;
    const p = plane3(sp.plane || "z", sp.at ?? sp.z ?? 0, sp.cu ?? sp.u0 ?? sp.x ?? 0, sp.cv ?? sp.v0 ?? sp.y ?? 0);
    return p;
  }

  /* ---------------------------------------------------------------- groups */
  // A group is one thing in the scene: some parts, drawn in the order they were added,
  // and the numbers that move them. Parts are specs, or functions of the group's numbers.
  class Group {
    constructor(scene, props, opt) {
      this.s = scene;
      this.v = Object.assign({}, props);
      this.an = {};
      this.parts = [];
      this.opt = opt || {};
      this.pick = this.opt.pick ?? null;
      this._order = this.opt.order ?? null;
      this.idx = scene.groups.length;
      this.el = mk("g", { class: "lw-g" }, scene.root);
      this.dirty = true;
      // a follower draws from its lead's numbers: one thing split in two for paint order (an arch's far pillar)
      this.lead = this.opt.lead || null;
      this.followers = [];
      if (this.lead) this.lead.followers.push(this);
    }
    get vals() { return this.lead ? this.lead.v : this.v; }
    get order() { return this._order; }
    set order(o) { if (o !== this._order) { this._order = o; this.s.sortDirty = true; this.s.wake(); } }
    add(kind, def, opt) {
      opt = opt || {};
      const style = kind === "label" ? "label" : kind === "cable" && opt.tube !== false ? "tube" : opt.tube ? "tube" : SOLID[kind] ? "solid" : kind === "dot" ? "dot" : kind === "patch" || kind === "shape" ? "patch" : "line";
      const g = mk("g", { class: "lw-part" + (opt.nolit ? " nl" : "") }, style === "label" ? this.s.leads : this.el);
      const els = {};
      for (const [k, cls] of ELS[style]) els[k] = mk("path", { class: cls }, g);
      const part = { kind, def, opt, g, els, style, last: {}, cls: "" };
      if (style === "label") {
        part.html = document.createElement("div");
        part.html.className = "lw-label";
        this.s.labels.appendChild(part.html);
        (this.labelEls = this.labelEls || []).push(part.html, g);
        if (this.el.classList.contains("lit")) { part.html.classList.add("lit"); g.classList.add("lit"); }
      }
      this.parts.push(part);
      this.dirty = true;
      return this;
    }
    box(d, o) { return this.add("box", d, o); }
    cyl(d, o) { return this.add("cyl", d, o); }
    ball(d, o) { return this.add("ball", d, o); }
    line(d, o) { return this.add("line", d, o); }
    cable(d, o) { return this.add("cable", d, o); }
    dot(d, o) { return this.add("dot", d, o); }
    patch(d, o) { return this.add("patch", d, o); }
    arc(d, o) { return this.add("arc", d, o); }
    shape(d, o) { return this.add("shape", d, o); }
    label(d, o) { return this.add("label", d, o); }

    /** Jump to values now. */
    set(p) {
      for (const k in p) {
        this.v[k] = p[k];
        const a = this.an[k];
        if (a) { a.sp.x = a.sp.t = p[k]; a.sp.v = 0; a.pend = null; a.mode = "spring"; }
      }
      this.dirty = true;
      this.s.wake();
      return this;
    }
    /**
     * Move to values. A spring by default, for numbers that follow the pointer; `ease: true`
     * for a choice (700ms on the lift curve). `delay` in ms staggers it. Asking for the
     * target it already has does nothing, so calling it on every pointer move is safe.
     */
    to(p, o) {
      o = o || {};
      const now = performance.now(), delay = o.delay || 0;
      for (const k in p) {
        const goal = p[k];
        if (!(k in this.v)) this.v[k] = goal;
        let a = this.an[k];
        if (!a) a = this.an[k] = { sp: spring(this.v[k], { k: o.k, c: o.c, eps: o.eps ?? 0.01 }), tw: null, mode: "spring", pend: null };
        if (o.ease) {
          if (a.mode !== "ease" || !a.tw) { a.tw = tween(this.v[k], o.dur || 700); a.mode = "ease"; }
          tset(a.tw, goal, now, delay);
        } else {
          if (a.mode === "ease") { a.sp.x = this.v[k]; a.sp.v = 0; a.sp.t = this.v[k]; a.mode = "spring"; }
          if (o.k) a.sp.k = o.k;
          if (o.c) a.sp.c = o.c;
          if (delay > 0) {
            if (a.pend ? a.pend.goal === goal : a.sp.t === goal) continue;
            a.pend = { goal, at: now + delay };
          } else { a.sp.t = goal; a.pend = null; }
        }
      }
      this.s.active.add(this);
      this.s.wake();
      return this;
    }
    /** Give a moving number a push (a spring's velocity), for a swing that settles. */
    kick(k, v) {
      if (!this.an[k]) this.to({ [k]: this.v[k] });
      this.an[k].sp.v += v;
      this.s.active.add(this);
      this.s.wake();
    }
    step(dt, now) {
      let moving = false;
      for (const k in this.an) {
        const a = this.an[k];
        if (a.mode === "ease") {
          const nv = tval(a.tw, now);
          if (nv !== this.v[k]) { this.v[k] = nv; this.dirty = true; }
          if (!tdone(a.tw, now)) moving = true;
          else { a.sp.x = a.sp.t = this.v[k]; a.sp.v = 0; }
        } else {
          if (a.pend) {
            if (now >= a.pend.at) { a.sp.t = a.pend.goal; a.pend = null; } else moving = true;
          }
          if (stepS(a.sp, dt)) moving = true;
          if (a.sp.x !== this.v[k]) { this.v[k] = a.sp.x; this.dirty = true; }
        }
      }
      return moving;
    }
    // after a fast-forward: tweens that have landed hold their value whatever the clock says
    land() {
      for (const k in this.an) {
        const a = this.an[k];
        if (a.mode === "ease") a.tw = tween(this.v[k]);
      }
    }
    geo(part) {
      let sp = typeof part.def === "function" ? part.def(this.vals, this.s) : part.def;
      if (!sp || sp.hide) return { sp, g: null };
      if (part.style === "label") {
        part.dir = (sp.dy ?? -16) > 0 ? 1 : -1;
        if (part.nudge) sp = Object.assign({}, sp, { dy: (sp.dy ?? -16) + part.nudge });
      }
      return { sp, g: KINDS[part.kind](this.view(), sp) };
    }
    // the group's numbers tx, ty, tz move everything in it: a van that drives, a box that slides
    view() {
      const v = this.vals, V = this.s.V;
      if (!(v.tx || v.ty || v.tz)) return V;
      if (this._view && this._view.base === V && this._view.t === v.tx + "," + v.ty + "," + v.tz) return this._view.V;
      const P = V.P, tx = v.tx || 0, ty = v.ty || 0, tz = v.tz || 0;
      this._view = { base: V, t: v.tx + "," + v.ty + "," + v.tz, V: Object.assign({}, V, { P: (x, y, z) => P(x + tx, y + ty, z + tz) }) };
      return this._view.V;
    }
    draw() {
      this.dirty = false;
      const pts = [], boxes = [];
      for (const part of this.parts) {
        const { sp, g } = this.geo(part);
        if (g && SOLID[part.kind]) {
          const b = aabb(part.kind, sp), v = this.vals;
          if (b) boxes.push([b[0] + (v.tx || 0), b[1] + (v.ty || 0), b[2] + (v.tz || 0), b[3] + (v.tx || 0), b[4] + (v.ty || 0), b[5] + (v.tz || 0)]);
        }
        const show = !!g;
        if (part.shown !== show) {
          part.g.style.display = show ? "" : "none";
          if (part.html) { part.html.style.display = show ? "" : "none"; this.s.labelsDirty = true; }
          part.shown = show;
        }
        if (!g) continue;
        if (part.style === "label") {
          const L = g.label, h = part.html, key = L.text + "|" + L.sub;
          if (part.last.l !== g.line) { part.els.l.setAttribute("d", g.line); part.els.d.setAttribute("d", g.dot); part.last.l = g.line; }
          if (part.last.key !== key) { h.innerHTML = ""; h.append(L.text); if (L.sub) { const sm = document.createElement("small"); sm.textContent = L.sub; h.append(sm); } part.last.key = key; }
          if (part.last.align !== L.align) { h.className = "lw-label " + L.align + (h.classList.contains("lit") ? " lit" : ""); part.last.align = L.align; }
          const a0 = g.pts[0];
          if (part.seen && Math.hypot(a0[0] - part.seen[0], a0[1] - part.seen[1]) > 4) this.s.labelsDirty = true;
          h.style.left = (L.x / 4).toFixed(2) + "%";
          h.style.top = (L.y / 3.2).toFixed(2) + "%";
          for (const p of g.pts) pts.push(p);
          continue;
        }
        const cls = typeof part.opt.cls === "function" ? part.opt.cls(this.vals) || "" : part.opt.cls || "";
        if (cls !== part.cls) {
          if (part.style === "solid") part.g.setAttribute("class", "lw-part" + (part.opt.nolit ? " nl" : "") + (cls ? " " + cls : ""));
          else for (const k in part.els) part.els[k].setAttribute("class", part.els[k].getAttribute("class").split(" ")[0] + (cls ? " " + cls : ""));
          part.cls = cls;
        }
        const d = part.style === "solid"
          ? { f: g.sil, sh: g.shade || "", t: g.top || "", o: g.sil, c: g.crease || "", x: g.extra || "" }
          : part.style === "tube" ? { l: g.line, i: g.line } : { l: g.line };
        for (const k in d) if (part.last[k] !== d[k]) { part.els[k].setAttribute("d", d[k]); part.last[k] = d[k]; }
        for (const p of g.pts) pts.push(p);
      }
      this.pts = pts;
      this.boxes = boxes;
      this.box = boxes.length ? boxes.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.min(u[2], b[2]), Math.max(u[3], b[3]), Math.max(u[4], b[4]), Math.max(u[5], b[5])]) : null;
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const p of pts) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; }
      this.sbox = pts.length ? [a, b, c, d] : null;
      return pts;
    }
    // where the group stands: its first part's foot, at the height of its lowest part
    anchorDepth() {
      let foot = null, z = Infinity;
      for (const part of this.parts) {
        if (part.style === "label") continue;
        const sp = typeof part.def === "function" ? part.def(this.vals, this.s) : part.def;
        if (!sp || sp.hide) continue;
        const a = anchor(part.kind, sp);
        if (!foot) foot = a;
        z = Math.min(z, a[2]);
      }
      return foot ? this.s.V.depth(foot[0], foot[1], z) : 0;
    }
  }

  /* ----------------------------------------------------------------- scene */
  class Scene {
    constructor(host, svg, root, C, fig) {
      this.host = host;
      this.svg = svg;
      this.root = root;
      this.C = C;
      this.V = view(C);
      this.fig = fig;
      this.groups = [];
      this.active = new Set();
      this.extents = [];
      this.lit = [];
      this.sortDirty = false;
      this.loops = [];
      this.occluders = [];
      this.wake = () => {};
    }
    /** Marks a group as something that hides what moves behind it or into it. pass: test its parts one by one (an arch you can go through). */
    occluder(g, o) { this.occluders.push({ g, pass: !!(o && o.pass) }); return g; }
    /**
     * Where a small moving box (world [x0, y0, z0, x1, y1, z1]) goes in paint order, and whether it is
     * inside a solid. Among the occluders it overlaps on screen, it goes after those it is in front of
     * and before those it is behind or under; inside one, it is hidden. self: a moving occluder asking about itself.
     */
    orderFor(P, self) {
      const c = this.V.P((P[0] + P[3]) / 2, (P[1] + P[4]) / 2, (P[2] + P[5]) / 2), m = 5 * this.V.S;
      let lo = Infinity, hi = -Infinity, hidden = false;
      for (const { g } of this.occluders) {
        if (!g.box || g === self || g.el.style.display === "none") continue;
        // hidden only inside a real part (a roof's overhang is not a wall); in front or behind is judged on the whole
        for (const B of g.boxes) if (P[0] < B[3] && P[3] > B[0] && P[1] < B[4] && P[4] > B[1] && P[2] < B[5] && P[5] > B[2]) hidden = true;
        const sb = g.sbox;
        if (!sb || c[0] + m < sb[0] || c[0] - m > sb[2] || c[1] + m < sb[1] || c[1] - m > sb[3]) continue;
        const B = g.box, front = P[0] >= B[3] - 0.01 || P[1] >= B[4] - 0.01 || P[2] >= B[5] - 0.01;
        if (front) hi = Math.max(hi, g._order); else lo = Math.min(lo, g._order);
      }
      const order = lo < Infinity ? lo - 0.01 : hi > -Infinity ? hi + 0.01 : this.V.depth((P[0] + P[3]) / 2, (P[1] + P[4]) / 2, P[2]);
      return { order, hidden };
    }
    /** Ambient motion: fn(dt, now) runs every frame while the figure is on screen (not under reduced motion). */
    loop(fn) { this.loops.push(fn); this.wake(); }
    /** A new thing in the scene, with the numbers that will move it: s.group({ lift: 0 }, { pick: "B3" }). */
    group(props, opt) {
      const g = new Group(this, props || {}, opt);
      this.groups.push(g);
      return g;
    }
    // One part in its own group. The options take the group's pick, order and area too.
    _one(kind, def, opt) {
      opt = opt || {};
      return this.group(opt.props || {}, { pick: opt.pick, order: opt.order, area: opt.area }).add(kind, def, opt);
    }
    box(d, o) { return this._one("box", d, o); }
    cyl(d, o) { return this._one("cyl", d, o); }
    ball(d, o) { return this._one("ball", d, o); }
    line(d, o) { return this._one("line", d, o); }
    cable(d, o) { return this._one("cable", d, o); }
    dot(d, o) { return this._one("dot", d, o); }
    patch(d, o) { return this._one("patch", d, o); }
    arc(d, o) { return this._one("arc", d, o); }
    shape(d, o) { return this._one("shape", d, o); }

    /** World points the figure can reach at its most extreme pose, so the frame fits them. */
    extent(pts) { for (const p of pts) this.extents.push(p); }
    /** The one highlight: a group, a list of groups (the parts of one thing), or null. */
    accent(x) {
      const next = x == null ? [] : Array.isArray(x) ? x : [x];
      if (next.length === this.lit.length && next.every((g, i) => g === this.lit[i])) return;
      for (const g of this.lit) { g.el.classList.remove("lit"); (g.labelEls || []).forEach((e) => e.classList.remove("lit")); }
      for (const g of next) { g.el.classList.add("lit"); (g.labelEls || []).forEach((e) => e.classList.add("lit")); }
      this.lit = next;
    }
    /** The screen point of a world point. */
    at(x, y, z) { const p = this.V.P(x, y, z || 0); return [Math.round(p[0]), Math.round(p[1])]; }
    /** The world point under a screen point, on the plane at height z. */
    ground(p, z) { return unproj(this.C, p[0], p[1], z || 0); }
    /** The pickable group whose rest pose is under the point, nearest first. */
    groupAt(p) {
      for (let i = this.sorted.length - 1; i >= 0; i--) {
        const g = this.sorted[i];
        if (g.area && inside(p, g.area)) return g;
      }
      return null;
    }
    finish(frame, zoom) {
      const C = this.C;
      C.S = 1; C.ox = 0; C.oy = 0;
      this.V = view(C);
      let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
      const add = (p) => { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); };
      for (const g of this.groups) for (const part of g.parts) { const { g: geo } = g.geo(part); if (geo) geo.pts.forEach(add); }
      for (const q of this.extents) add(this.V.P(q[0], q[1], q[2]));
      if (a > b) { a = 0; b = 1; c = 0; d = 1; }
      const S = Math.min(frame[0] / (b - a), frame[1] / (d - c)) * (zoom || 1);
      C.S = S;
      C.ox = 200 - (S * (a + b)) / 2;
      C.oy = 166 - (S * (c + d)) / 2;
      this.V = view(C);
      for (const g of this.groups) {
        const pts = g.draw();
        if (g._order == null) g._order = g.anchorDepth();
        if (g.pick != null) {
          const area = g.opt.area ? (typeof g.opt.area === "function" ? g.opt.area(g.v) : g.opt.area).map((q) => this.V.P(q[0], q[1], q[2])) : pts;
          g.area = area.length > 2 ? hull(area) : null;
        }
      }
      this.sort();
    }
    sort() {
      this.sortDirty = false;
      const next = this.groups.slice().sort((p, q) => p._order - q._order || p.idx - q.idx);
      if (this.sorted && next.every((g, i) => g === this.sorted[i])) return;
      this.sorted = next;
      for (const g of this.sorted) this.root.appendChild(g.el);
    }
    /** Pushes overlapping labels apart along their leaders, measured in the page as laid out. */
    declutter() {
      this.labelsDirty = false;
      const k = this.host.clientWidth / 400;
      if (!k) return;
      const all = [];
      for (const g of this.groups) for (const p of g.parts) if (p.style === "label") all.push({ p, g });
      if (!all.length) return;
      for (const { p, g } of all) if (p.nudge) { p.nudge = 0; g.dirty = true; }
      for (const { p, g } of all) { const { g: geo } = g.geo(p); p.seen = geo ? geo.pts[0] : null; }
      for (const g of this.groups) if (g.dirty) g.draw();
      for (let it = 0; it < 10; it++) {
        const live = all.filter(({ p }) => p.shown && p.html.style.display !== "none");
        const r = live.map(({ p }) => p.html.getBoundingClientRect());
        let moved = false;
        for (let i = 0; i < live.length && !moved; i++) for (let j = i + 1; j < live.length; j++) {
          const ox = Math.min(r[i].right, r[j].right) - Math.max(r[i].left, r[j].left);
          const oy = Math.min(r[i].bottom, r[j].bottom) - Math.max(r[i].top, r[j].top);
          if (ox > 1 && oy > 1) {
            // move the one that sits on the far side of its leader's direction
            const m = (live[j].p.dir < 0 ? r[j].top <= r[i].top : r[j].top >= r[i].top) ? live[j] : live[i];
            m.p.nudge = (m.p.nudge || 0) + (m.p.dir * (oy + 3)) / k;
            m.g.dirty = true;
            moved = true;
            break;
          }
        }
        if (!moved) break;
        for (const g of this.groups) if (g.dirty) g.draw();
      }
    }
    tick(dt, now) {
      let moving = false;
      if (this.loops.length && !HL.reducedMotion()) { for (const f of this.loops) f(dt, now); moving = true; }
      for (const g of this.active) {
        if (g.step(dt, now)) moving = true;
        else this.active.delete(g);
      }
      for (const g of this.groups) if (g.dirty && g.followers.length) for (const f of g.followers) f.dirty = true;
      for (const g of this.groups) if (g.dirty) g.draw();
      if (this.sortDirty) this.sort();
      if (this.labelsDirty) this.declutter();
      return moving || this.active.size > 0;
    }
  }
  function inside(p, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }

  /* ----------------------------------------------------------------- mount */
  let uid = 0;
  /**
   * Mounts a figure into a host element. Options: look, camera, value, scroll (an element whose
   * scroll progress is input.scroll), onread(text). Returns a handle.
   */
  function mount(host, fig, o) {
    o = o || {};
    inject();
    host.replaceChildren();
    host.setAttribute("data-lw", fig.name);
    host.setAttribute("role", "img");
    host.setAttribute("aria-label", fig.means || fig.name);
    // clear: no stage of its own; the figure sits on the page (its ground should match the page's)
    host.classList.toggle("lw-clear", !!o.clear);
    let look = applyLook(host, o.look || fig.look || "paper");
    const id = "lw" + ++uid;
    const svg = mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, host);
    const defs = mk("defs", {}, svg);
    const wf = mk("filter", { id: id + "w", x: "-5%", y: "-5%", width: "110%", height: "110%" }, defs);
    mk("feTurbulence", { type: "fractalNoise", baseFrequency: "0.04", numOctaves: "2", seed: "7" }, wf);
    mk("feDisplacementMap", { in: "SourceGraphic", scale: "2.6", xChannelSelector: "R", yChannelSelector: "G" }, wf);
    host.style.setProperty("--lw-wobble", `url(#${id}w)`);
    const wrap = mk("g", { class: "lw-wrap" }, svg);
    mk("use", { href: "#" + id + "s", class: "lw-offset", transform: "translate(2.2 1.7)" }, wrap);
    const root = mk("g", { id: id + "s", class: "lw-scene" }, wrap);
    const leads = mk("g", { class: "lw-leads" }, svg);
    const labels = document.createElement("div");
    labels.className = "lw-labels";
    host.appendChild(labels);

    const camKey = o.camera || fig.camera || "iso";
    const cam = CAMS[camKey] || CAMS.iso;
    const C = Cam(cam.az, cam.k, 1);
    const s = new Scene(host, svg, root, C, fig);
    s.leads = leads;
    s.labels = labels;
    let value = o.value ?? (fig.range ? fig.range[1] : 0.5);
    const answer = fig.draw(s, value) || (() => "rest");
    s.finish(fig.frame || [300, 228], fig.zoom);

    const input = { at: null, ground: null, hit: null, group: null, u: 0.5, v: 0.5, scroll: null, clicked: null, ghost: false, step: null, focus: null, action: null };
    let lastHit = null;
    let text = "";
    const handle = { host, scene: s, fig, camera: camKey, onread: o.onread || null };
    const update = () => {
      if (input.hit !== lastHit) { lastHit = input.hit; o.onpick && o.onpick(input.hit, input.group); }
      const r = answer(input, value);
      input.clicked = null;
      input.action = null;
      if (r != null && r !== text) { text = String(r); handle.onread && handle.onread(text); }
    };
    const move = (p, e) => {
      input.at = p;
      input.ghost = !!(e && e.pointerType === "ghost");
      input.ground = s.ground(p, 0);
      input.u = clamp(p[0] / 400, 0, 1);
      input.v = clamp(p[1] / 320, 0, 1);
      input.group = s.groupAt(p);
      input.hit = input.group ? input.group.pick : null;
      update();
    };
    const B = register(host, (dt, now) => s.tick(dt, now));
    s.wake = B.wake;
    const off = [B.unregister];
    off.push(pointer(host, {
      move,
      down: (p, e) => { move(p, e); input.clicked = input.hit ?? true; update(); },
      leave: () => { input.at = input.ground = input.hit = input.group = null; input.ghost = false; update(); },
    }));
    if (o.scroll) {
      const el = o.scroll;
      const onScroll = () => {
        const r = el.getBoundingClientRect(), span = r.height - innerHeight;
        const t = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
        if (t !== input.scroll) { input.scroll = t; update(); }
      };
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
      off.push(() => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); });
      onScroll();
    }
    update();
    s.tick(0, performance.now());
    // labels are measured as laid out: again once the fonts arrive and whenever the stage resizes
    s.declutter();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => s.declutter());
    if (window.ResizeObserver) {
      let w = host.clientWidth;
      const ro = new ResizeObserver(() => { if (host.clientWidth !== w) { w = host.clientWidth; s.declutter(); } });
      ro.observe(host);
      off.push(() => ro.disconnect());
    }

    let touring = null;
    const stops = typeof fig.tour === "function" ? fig.tour(s) : fig.tour || LAP;
    Object.defineProperties(handle, {
      value: { get: () => value },
      look: { get: () => look },
      readout: { get: () => text },
      playing: { get: () => !!touring },
    });
    Object.assign(handle, {
      stops,
      set(v) { value = v; update(); },
      setLook(l) { look = applyLook(host, l); return look; },
      hold(p) { move(p, { pointerType: "mouse" }); },
      /** Tell the figure something from the page that lasts: send("step", 2), send("focus", "gateway"). */
      send(key, v) { input[key] = v; update(); },
      /** Tell the figure something that happens once: act("verify"). The answer sees input.action. */
      act(name) { input.action = name; update(); },
      release() { input.at = input.ground = input.hit = input.group = null; update(); },
      play() { if (!touring && stops) touring = tour(host, stops); },
      stop() { if (touring) { touring.stop(); touring = null; } },
      /** Runs the animation forward (ms of figure time) at once, for screenshots and checks. */
      settle(ms) {
        let now = performance.now();
        for (let t = 0; t < (ms || 3000); t += 16) { now += 16; s.tick(0.016, now); }
        for (const g of s.groups) g.land();
        s.tick(0, now);
      },
      /** What the check script reads: the read-out, and the drawing's box in viewBox units. */
      report() {
        const bb = root.getBBox();
        return { name: fig.name, look: look.key || look.label, camera: camKey, readout: text, box: [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height].map((n) => Math.round(n * 10) / 10) };
      },
      destroy() { handle.stop(); off.reverse().forEach((f) => f()); host.replaceChildren(); },
    });
    return handle;
  }

  /* ------------------------------------------------------------ helpers */
  /** Hairline's falloff: 1 under the pointer, .31 at 42% of the radius, .09 at the edge and beyond. */
  const falloff = (u) => (u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0.094);

  const figures = {};
  const listeners = [];
  window.linework = (fig) => {
    figures[fig.name] = fig;
    listeners.forEach((f) => f(fig));
  };

  return {
    LOOKS, CAMS, hueLook, resolve, applyLook, mount, falloff, figures,
    onfigure: (f) => { listeners.push(f); Object.values(figures).forEach(f); },
    clamp, lerp, rad,
  };
})();
