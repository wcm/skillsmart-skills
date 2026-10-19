/*
 * logo-sting.js · Logo Sting (Skillsmart, MIT)
 *
 * A 5–8 s logo reveal or outro in one of six looks, from an SVG, a PNG or a wordmark:
 *
 *   line       the outline draws itself, then fills
 *   particles  a few thousand specks fly in and settle into the mark
 *   liquid     a bead of liquid gathers, the mark grows out of it, the liquid drains away
 *   ink        ink blooms into paper and bleeds into the shape, then dries crisp
 *   glass      a glass lens sweeps across, the mark appears behind it, refracted inside it
 *   chrome     the mark rises as polished chrome while a light band sweeps it
 *
 *   LogoSting.film({ look, logo | wordmark, colors, tagline, duration })
 *
 * Every look ends on the real logo, crisp (except chrome, which ends in chrome). ?alpha=1 renders a
 * transparent background (render.mjs --alpha writes ProRes 4444 .mov and VP9 .webm).
 */
(function () {
  "use strict";
  const { EASE: E, clamp, lerp } = Film;

  const LOOKS = {
    line: { bg: "#F3F0E8", ink: "#141414", accent: "#FF5A36" },
    particles: { bg: "#0B0C10", ink: "#F2F0EA", accent: "#7C8CFF" },
    liquid: { bg: "#0D0E12", ink: "#F4F2EC", accent: "#7C5CFF" },
    ink: { bg: "#F1ECE1", ink: "#16161A", accent: "#C8342B" },
    glass: { bg: "#0F1115", ink: "#F3F3F1", accent: "#6FD3FF" },
    chrome: { bg: "#0A0A0C", ink: "#E9EAEE", accent: "#9DB4FF" },
  };

  /* ---------- the mark: raster, mask, signed distance, outline ---------- */

  async function rasterize(spec, W, H, ink) {
    const c = document.createElement("canvas");
    c.width = Math.round(W); c.height = Math.round(H);
    const g = c.getContext("2d");
    if (spec.logo) {
      const img = new Image();
      img.src = spec.logo;
      await img.decode();
      g.drawImage(img, 0, 0, c.width, c.height);
      return { canvas: c, aspect: img.naturalWidth / img.naturalHeight || 1, url: spec.logo };
    }
    const w = spec.wordmark;
    const m = measureWord(w);
    const fs = (c.height / m.h) * 100;
    g.font = `${w.weight || 700} ${fs}px "${w.font || "Inter Tight"}", sans-serif`;
    if (w.letterSpacing) g.letterSpacing = w.letterSpacing;
    g.fillStyle = w.color || ink;
    g.textBaseline = "alphabetic";
    g.fillText(w.text, (m.left / 100) * fs + (c.width - (m.w / 100) * fs) / 2, (m.ascent / 100) * fs);
    return { canvas: c, url: null };
  }

  // the mark's natural aspect, so it can be fitted before rasterising
  async function aspectOf(spec) {
    if (spec.logo) {
      const img = new Image();
      img.src = spec.logo;
      await img.decode();
      return img.naturalWidth / img.naturalHeight || 1;
    }
    const m = measureWord(spec.wordmark);
    return m.w / m.h;
  }
  // the ink box of a wordmark at 100 px, with a little air
  function measureWord(w) {
    const g = document.createElement("canvas").getContext("2d");
    g.font = `${w.weight || 700} 100px "${w.font || "Inter Tight"}", sans-serif`;
    if (w.letterSpacing) g.letterSpacing = w.letterSpacing;
    const m = g.measureText(w.text);
    const pad = 3;
    const left = m.actualBoundingBoxLeft + pad, ascent = m.actualBoundingBoxAscent + pad;
    return { left, ascent, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight + pad * 2, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2 };
  }

  // Felzenszwalb: exact squared Euclidean distance transform
  function edt1(f, n, d, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s;
      do { const r = v[k]; s = (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r); } while (s <= z[k] && --k >= 0);
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
  }
  function edt(grid, w, h) {
    const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
      edt1(f, h, d, v, z);
      for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
      edt1(f, w, d, v, z);
      for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
    return grid;
  }
  // signed distance in pixels (negative inside), from the alpha channel
  function sdf(alpha, w, h) {
    const INF = 1e20, a = new Float64Array(w * h), b = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) { const inside = alpha[i] > 127; a[i] = inside ? 0 : INF; b[i] = inside ? INF : 0; }
    edt(a, w, h); edt(b, w, h);
    const out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let d = Math.sqrt(a[i]) - Math.sqrt(b[i]);
      const al = alpha[i] / 255;
      if (al > 0.02 && al < 0.98) d = 0.5 - al; // sub-pixel edge from antialiasing
      out[i] = d;
    }
    return out;
  }

  // marching squares on the alpha channel: closed outlines as polylines
  function outlines(alpha, w, h, step) {
    const gw = Math.floor(w / step), gh = Math.floor(h / step);
    const val = (gx, gy) => (gx < 0 || gy < 0 || gx >= gw || gy >= gh ? 0 : alpha[Math.min(h - 1, gy * step) * w + Math.min(w - 1, gx * step)] / 255);
    const T = 0.5;
    const segs = new Map(); // start key -> [end key, ...]
    const pts = new Map();
    const key = (ax, ay, bx, by) => (ax < bx || (ax === bx && ay < by) ? `${ax},${ay},${bx},${by}` : `${bx},${by},${ax},${ay}`);
    const edgePoint = (ax, ay, bx, by) => {
      const k = key(ax, ay, bx, by);
      if (!pts.has(k)) {
        const va = val(ax, ay), vb = val(bx, by);
        const t = clamp((T - va) / (vb - va || 1e-6));
        pts.set(k, [(ax + (bx - ax) * t) * step, (ay + (by - ay) * t) * step]);
      }
      return k;
    };
    const link = (a, b) => { if (!segs.has(a)) segs.set(a, []); segs.get(a).push(b); };
    for (let y = -1; y < gh; y++) for (let x = -1; x < gw; x++) {
      const c0 = val(x, y) > T, c1 = val(x + 1, y) > T, c2 = val(x + 1, y + 1) > T, c3 = val(x, y + 1) > T;
      const idx = (c0 ? 8 : 0) | (c1 ? 4 : 0) | (c2 ? 2 : 0) | (c3 ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top = () => edgePoint(x, y, x + 1, y), right = () => edgePoint(x + 1, y, x + 1, y + 1), bottom = () => edgePoint(x, y + 1, x + 1, y + 1), left = () => edgePoint(x, y, x, y + 1);
      const S = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]],
        8: [[top, left]], 9: [[top, bottom]], 10: [[top, right], [left, bottom]], 11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      }[idx];
      for (const [p, q] of S) { const a = p(), b = q(); link(a, b); link(b, a); }
    }
    // walk the links into loops
    const used = new Set(), loops = [];
    for (const start of segs.keys()) {
      if (used.has(start)) continue;
      const loop = [];
      let cur = start, prev = null;
      while (cur && !used.has(cur)) {
        used.add(cur);
        loop.push(pts.get(cur));
        const next = (segs.get(cur) || []).find((n) => n !== prev && !used.has(n));
        prev = cur; cur = next;
      }
      if (loop.length > 6) loops.push(simplify(loop, step * 0.35));
    }
    return loops.filter((l) => l.length > 3).sort((a, b) => perimeter(b) - perimeter(a));
  }
  function perimeter(l) { let s = 0; for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
  function simplify(pts, eps) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let best = -1, bd = eps;
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      const L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
        if (d > bd) { bd = d; best = i; }
      }
      if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  // a closed, smooth SVG path through the points (Catmull-Rom)
  function smoothPath(l, ox, oy) {
    const n = l.length, P = (i) => l[(i + n) % n];
    let d = `M${(P(0)[0] + ox).toFixed(1)},${(P(0)[1] + oy).toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6 + ox).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6 + oy).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6 + ox).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6 + oy).toFixed(1)} ${(p2[0] + ox).toFixed(1)},${(p2[1] + oy).toFixed(1)}`;
    }
    return d + "Z";
  }

  /* ---------- WebGL: liquid, ink, glass, chrome ---------- */

  const VERT = `#version 300 es
  in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `#version 300 es
  precision highp float;
  out vec4 o;
  uniform vec2 uRes; uniform vec4 uRect; uniform float uT, uTime, uU, uAlpha, uSeed;
  uniform int uLook;
  uniform vec3 uBg, uInk, uAcc;
  uniform sampler2D uLogo, uSdf;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
  vec2 logoUV(vec2 px) { return vec2((px.x - uRect.x) / uRect.z, (px.y - uRect.y) / uRect.w); }
  float inRect(vec2 uv) { return step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.); }
  // signed distance to the mark in pixels (far outside: distance to the rectangle, so it never wraps)
  float sd(vec2 px) {
    vec2 uv = logoUV(px);
    vec2 c = clamp(uv, 0., 1.);
    float d = texture(uSdf, c).r;
    vec2 out_ = (uv - c) * uRect.zw;
    return d + length(out_);
  }
  vec2 grad(vec2 px) { float e = 1.5; return vec2(sd(px + vec2(e, 0)) - sd(px - vec2(e, 0)), sd(px + vec2(0, e)) - sd(px - vec2(0, e))) / (2. * e); }
  vec4 logo(vec2 px, float lod) { vec2 uv = logoUV(px); return textureLod(uLogo, clamp(uv, 0., 1.), lod) * inRect(uv); }
  float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
  vec3 env(vec3 r, float t) {
    float y = r.y + .15 * sin(r.x * 2. + t);
    vec3 sky = mix(vec3(.62, .66, .74), vec3(.96, .97, 1.), smoothstep(.05, .9, y));
    vec3 ground = mix(vec3(.05, .05, .07), vec3(.22, .22, .26), smoothstep(-.9, -.05, y));
    vec3 c = y > 0. ? sky : ground;
    c += vec3(1.6) * exp(-pow((y - .02) * 18., 2.));               // the horizon line
    c += uAcc * .55 * exp(-pow((r.x - sin(t * .7) * .8) * 3., 2.)) * smoothstep(-.2, .6, y); // a coloured softbox
    return c;
  }
  // liquid: a bead that grows, then the mark swells out of it, all wobbling until it drains
  float liquidD(vec2 px, vec2 c, float grow, float form, float drain) {
    float r = uRect.w * mix(.02, .36, grow) * (1. - drain);
    float wob = (1. - drain) * (1. - form * .6);
    vec2 w = px + uU * 4. * wob * vec2(fbm(px / (uU * 9.) + uTime * .6) - .5, fbm(px / (uU * 9.) - uTime * .5 + 9.) - .5) * 2.;
    float bead = length(w - c) - r;
    float off = mix(uRect.w * .45, 0., form);
    return smin(bead, sd(w) + off, uU * mix(9., 1.5, drain));
  }
  void main() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 c = uRect.xy + uRect.zw * .5;
    float U = uU;
    vec3 col = uBg; float a = 1. - uAlpha;
    vec2 q = (px - c) / uRect.w;
    if (uLook == 0) {            // liquid
      float grow = smoothstep(.0, .35, uT), form = smoothstep(.2, .72, uT), drain = smoothstep(.72, .98, uT);
      float d = liquidD(px, c, grow, form, drain);
      float e = 1.5;
      vec2 gd = vec2(liquidD(px + vec2(e, 0), c, grow, form, drain) - liquidD(px - vec2(e, 0), c, grow, form, drain),
                     liquidD(px + vec2(0, e), c, grow, form, drain) - liquidD(px - vec2(0, e), c, grow, form, drain)) / (2. * e);
      float cov = smoothstep(1.2, -1.2, d);
      float depth = clamp(-d / (U * 3.5), 0., 1.);
      float slope = 1. - depth;                                  // steep at the rim, flat on top: a meniscus
      vec3 n = normalize(vec3(gd.x * slope * 2.4, -gd.y * slope * 2.4, 1.));
      vec3 rr = reflect(vec3(0, 0, -1), n);
      float spec = pow(max(0., dot(n, normalize(vec3(-.45, .55, 1.)))), 70.);
      vec3 liq = uAcc * (.18 + .55 * pow(n.z, 3.)) + env(vec3(rr.x, -rr.y, rr.z), uTime * .4) * (.25 + .5 * slope) + spec * 1.3;
      liq += uAcc * .35 * smoothstep(.0, .6, slope) * (1. - n.z);   // coloured rim light
      vec4 lg = logo(px, 0.);
      vec3 flat_ = lg.a > 0. ? lg.rgb / lg.a : uInk;
      float fa = mix(cov, lg.a, drain);
      vec3 m = mix(liq, flat_, drain);
      col = mix(col, m, fa); a = max(a, fa);
      col += uAcc * .07 * exp(-length(q) * 2.5) * (1. - drain) * (1. - uAlpha);
    } else if (uLook == 1) {     // ink
      float t = uT;
      float n = fbm(px / (U * 7.) + uSeed);
      float front = mix(-.05, 1.35, smoothstep(0., .8, t)) * max(uRect.z, uRect.w) * .62;
      float dc = length(px - c) + (n - .5) * U * 18.;
      float wet = smoothstep(front + U * 2., front - U * 4., dc);
      float dry = smoothstep(.62, 1., t);
      float bleed = (1. - dry) * U * (.8 + 2. * n) * wet;
      float d = sd(px) - bleed;
      float cov = smoothstep(.9, -.9, d) * wet;
      float edge = smoothstep(U * 1.6, 0., -d) * (1. - dry * .7);
      vec4 lg = logo(px, 0.);
      vec3 flat_ = lg.a > 0. ? lg.rgb / lg.a : uInk;
      vec3 inkc = mix(flat_, flat_ * .55, edge * .8);
      float halo = smoothstep(U * 6., 0., d) * wet * (1. - dry) * .12 * n;   // water ring
      col = mix(col, inkc, cov) - halo * (1. - uAlpha);
      float grain = (h21(px * .73) - .5) * .045;
      col += grain * (1. - uAlpha);
      a = max(a, max(cov, halo * 2.));
      vec4 fin = logo(px, 0.);
      col = mix(col, flat_, fin.a * smoothstep(.9, 1., t)); a = max(a, fin.a * smoothstep(.9, 1., t));
    } else if (uLook == 2) {     // glass
      float t = uT;
      float R = uRect.w * .62;
      float tt = clamp(t / .82, 0., 1.);
      float lx = mix(uRect.x - R * 1.2, uRect.x + uRect.z + R * 1.6, E(tt));
      vec2 L = vec2(lx, c.y + sin(tt * 3.14159) * -uRect.w * .08);
      float shrink = 1. - smoothstep(.8, .98, t);     // the lens closes once it has passed
      R *= max(shrink, .001);
      float dl = length(px - L);
      float behind = smoothstep(L.x + R * .1, L.x - R * .6, px.x);
      vec4 sharp = logo(px, 0.);
      vec4 ghost = logo(px, 5.) * .25;
      vec4 base = mix(ghost, sharp, behind);
      vec3 bc = base.a > 0. ? base.rgb / base.a : uInk;
      col = mix(col, bc, base.a); a = max(a, base.a);
      if (dl < R * shrink) {
        float k = dl / R;
        vec2 dir = (px - L);
        float mag = .62 + .38 * k * k;
        vec2 s = L + dir * mag;
        float ca = U * .6 * k;
        vec4 lr = logo(s + dir / R * ca, 0.), lgc = logo(s, 0.), lb = logo(s - dir / R * ca, 0.);
        vec3 inside = mix(uBg * .85 + uAcc * .06, vec3(1.), 0.);
        vec3 refr = vec3(lr.r * lr.a + inside.r * (1. - lr.a), lgc.g * lgc.a + inside.g * (1. - lgc.a), lb.b * lb.a + inside.b * (1. - lb.a));
        if (uAlpha > .5) refr = vec3(lr.r, lgc.g, lb.b);
        float rim = smoothstep(.86, 1., k);
        float fres = pow(k, 4.) * .35;
        vec3 g = refr + fres + rim * .55 + uAcc * rim * .3;
        g += vec3(1.) * pow(max(0., 1. - length((px - L) / R - vec2(-.35, -.4)) * 2.6), 3.) * .5;
        float edgeA = smoothstep(1., .985, k);
        col = mix(col, g, edgeA); a = max(a, edgeA * mix(.35, 1., max(max(lr.a, lgc.a), lb.a)));
      }
    } else {                     // chrome
      float t = uT;
      float rise = smoothstep(0., .5, t);
      float wipe = (q.x + q.y * .35) - mix(-1.6, 1.8, smoothstep(.05, .7, t));
      float shown = smoothstep(.02, -.02, wipe);
      float d = sd(px);
      float cov = smoothstep(1., -1., d) * shown;
      float hgt = smoothstep(0., -U * 2.6, d) * rise;
      vec2 g = vec2(dFdx(hgt), dFdy(hgt)) * -U * 3.;
      vec3 n = normalize(vec3(g.x, -g.y, 1.));
      vec3 r = reflect(vec3(0, 0, -1), n);
      r.y += (q.y * -.9) + .2;
      vec3 ch = env(normalize(r), uTime * .5 + t * 2.);
      ch *= mix(vec3(1.), uInk, .25);
      float glint = exp(-pow(wipe * 9., 2.)) * smoothstep(1., -1., d);
      ch += glint * 1.4;
      float sweep = exp(-pow((q.x - mix(-1.2, 1.4, smoothstep(.55, 1., t))) * 5., 2.)) * hgt;
      ch += sweep * .8;
      col = mix(col, ch, cov); a = max(a, cov);
      col += uAcc * .08 * exp(-length(q) * 2.) * (1. - uAlpha);
    }
    o = vec4(col * a, a);
  }`.replace("E(tt)", "(tt < .5 ? 4. * tt * tt * tt : 1. - pow(-2. * tt + 2., 3.) / 2.)");

  function glsetup(canvas) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    return { gl, U };
  }

  /* ---------- the film ---------- */

  function film(story) {
    const look = story.look || "liquid";
    const pal = { ...(LOOKS[look] || LOOKS.liquid), ...(story.colors || {}) };
    const root = document.documentElement;
    for (const [k, v] of Object.entries(pal)) root.style.setProperty("--" + k, v);
    root.dataset.look = look;
    const duration = story.duration || 6;
    let mark = null;

    return Film.create({
      fps: story.fps || 30,
      duration,
      fonts: story.wordmark ? [`${story.wordmark.weight || 700} 80px "${story.wordmark.font || "Inter Tight"}"`] : [],
      async setup(F) {
        const asp = await aspectOf(story);
        const maxW = F.w * (F.landscape ? 0.54 : 0.8) * (story.scale || 1), maxH = F.h * (F.landscape ? 0.32 : F.portrait ? 0.17 : 0.28) * (story.scale || 1);
        let w = maxW, h = w / asp;
        if (h > maxH) { h = maxH; w = h * asp; }
        const x = F.w / 2 - w / 2, y = F.h * (story.tagline ? 0.46 : 0.5) - h / 2;
        const r = await rasterize(story, w, h, pal.ink);
        mark = { x, y, w, h, ...r };
      },
      build(tl, F) {
        const stage = document.querySelector("#film");
        const u = F.u;
        const bg = stage.querySelector(".bg");
        const canvas = stage.querySelector("canvas.gl");
        const svg = stage.querySelector("svg.lines");
        const dots = stage.querySelector("canvas.dots");
        const fin = stage.querySelector(".final");
        const tag = stage.querySelector(".tagline");
        if (F.alpha) bg.style.display = "none";
        // the crisp final mark: the user's own file (or the wordmark as text)
        Object.assign(fin.style, { left: mark.x + "px", top: mark.y + "px", width: mark.w + "px", height: mark.h + "px" });
        if (mark.url) fin.innerHTML = `<img src="${mark.url}" alt="">`;
        else { const cv = mark.canvas; fin.appendChild(cv); cv.style.width = "100%"; cv.style.height = "100%"; }
        // timing: in, reveal, settle, hold
        const r0 = 0.25, r1 = Math.min(duration - 2, r0 + Math.max(2.6, duration * 0.58));
        const settle = r1 + 0.1;
        tl.label("reveal", r0); tl.label("settle", r1); tl.label("hold", settle + 0.5);

        const g2 = mark.canvas.getContext("2d");
        const img = g2.getImageData(0, 0, mark.canvas.width, mark.canvas.height);
        const W = img.width, H = img.height;
        const alpha = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) alpha[i] = img.data[i * 4 + 3];

        if (look === "line") {
          svg.setAttribute("viewBox", `0 0 ${F.w} ${F.h}`);
          const loops = outlines(alpha, W, H, Math.max(1, Math.round(Math.min(W, H) / 220)));
          const paths = loops.map((l) => {
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", smoothPath(l, mark.x, mark.y));
            svg.appendChild(p);
            return p;
          });
          paths.forEach((p, i) => {
            const L = p.getTotalLength();
            p.style.strokeDasharray = `${L} ${L}`;
            p.style.strokeWidth = Math.max(1.5, u * 0.22) + "px";
            const at = r0 + (i / Math.max(1, paths.length)) * (r1 - r0) * 0.35;
            tl.fn(at, (r1 - r0) * 0.65, (q) => (p.style.strokeDashoffset = L * (1 - q)), "inOut");
            tl.to(p, { opacity: 0 }, settle + 0.2, 0.5, "soft");
          });
          // a pen point leads the longest outline
          const pen = stage.querySelector(".pen");
          if (paths[0]) {
            const L0 = paths[0].getTotalLength();
            tl.fn(r0, (r1 - r0) * 0.65, (q) => { const pt = paths[0].getPointAtLength(L0 * q); pen.style.transform = `translate(${pt.x}px, ${pt.y}px)`; pen.style.opacity = q > 0 && q < 1 ? 1 : 0; }, "inOut");
          }
          tl.fromTo(fin, { opacity: 0 }, { opacity: 1 }, r1 - 0.3, 0.7, "soft");
        } else if (look === "particles") {
          dots.width = F.w; dots.height = F.h;
          const ctx = dots.getContext("2d");
          const rnd = Film.rand("particles" + (story.seed || 1));
          const N = Math.round(clamp((mark.w * mark.h) / (u * u) * 9, 1500, 5200));
          const P = [];
          let tries = 0;
          while (P.length < N && tries < N * 60) {
            tries++;
            const x = rnd() * W, y = rnd() * H;
            if (alpha[(y | 0) * W + (x | 0)] < 128) continue;
            const ang = rnd() * Math.PI * 2, rad = Math.hypot(F.w, F.h) * (0.35 + rnd() * 0.5);
            P.push({
              tx: mark.x + x, ty: mark.y + y,
              sx: F.w / 2 + Math.cos(ang) * rad, sy: F.h / 2 + Math.sin(ang) * rad * 0.7,
              d: (x / W) * 0.45 + rnd() * 0.3, s: u * (0.12 + rnd() * 0.22), acc: rnd() < 0.14, sw: (rnd() - 0.5) * 2,
            });
          }
          const span = r1 - r0;
          tl.every((t) => {
            ctx.clearRect(0, 0, F.w, F.h);
            const fade = clamp((t - settle) / 0.6);
            for (const p of P) {
              const k = clamp((t - r0 - p.d * span * 0.6) / (span * 0.55));
              const e = E.out(k);
              const swirl = (1 - e) * u * 26 * p.sw;
              const x = lerp(p.sx, p.tx, e) + Math.cos(k * 5 + p.sw * 3) * swirl;
              const y = lerp(p.sy, p.ty, e) + Math.sin(k * 5 + p.sw * 3) * swirl;
              const al = clamp(k * 4) * (1 - fade * 0.85);
              if (al <= 0) continue;
              ctx.globalAlpha = al;
              ctx.fillStyle = p.acc && fade < 1 ? pal.accent : pal.ink;
              const s = p.s * (1 + (1 - e) * 1.5);
              ctx.fillRect(x - s / 2, y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
          });
          tl.fromTo(fin, { opacity: 0 }, { opacity: 1 }, settle - 0.1, 0.6, "soft");
        } else {
          canvas.width = F.w; canvas.height = F.h;
          const G = glsetup(canvas);
          if (!G) { fin.style.opacity = 1; console.warn("logo-sting: no WebGL2, showing the mark"); return; }
          const { gl, U } = G;
          const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
          tex(0);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mark.canvas);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          tex(1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, W, H, 0, gl.RED, gl.FLOAT, sdf(alpha, W, H));
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          const rgb = (h) => { const n = parseInt(h.replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
          gl.uniform1i(U("uLogo"), 0);
          gl.uniform1i(U("uSdf"), 1);
          gl.uniform2f(U("uRes"), F.w, F.h);
          // the SDF is in mask pixels; the mask is the mark's display size, so 1 unit = 1 px
          gl.uniform4f(U("uRect"), mark.x, mark.y, mark.w, mark.h);
          gl.uniform1f(U("uU"), u);
          gl.uniform1f(U("uAlpha"), F.alpha ? 1 : 0);
          gl.uniform1f(U("uSeed"), (story.seed || 1) * 13.1);
          gl.uniform1i(U("uLook"), { liquid: 0, ink: 1, glass: 2, chrome: 3 }[look] ?? 0);
          gl.uniform3fv(U("uBg"), rgb(pal.bg));
          gl.uniform3fv(U("uInk"), rgb(pal.ink));
          gl.uniform3fv(U("uAcc"), rgb(pal.accent));
          gl.viewport(0, 0, F.w, F.h);
          const uT = U("uT"), uTime = U("uTime");
          tl.every((t) => {
            gl.uniform1f(uT, clamp((t - r0) / (r1 - r0 + (look === "chrome" ? 0.9 : 0.3))));
            gl.uniform1f(uTime, t);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          });
          // the real file takes over once the shader has settled (chrome stays chrome)
          if (look !== "chrome") tl.fromTo(fin, { opacity: 0 }, { opacity: 1 }, r1 + 0.15, 0.35, "soft");
          else tl.set(fin, { opacity: 0 }, 0);
        }

        if (story.tagline) {
          tag.innerHTML = String(story.tagline).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
          Object.assign(tag.style, { top: mark.y + mark.h + u * 4 + "px", fontSize: u * (F.landscape ? 3.2 : 3.8) + "px" });
          tl.fromTo(tag, { opacity: 0, y: u * 2, letterSpacing: "0.5em" }, { opacity: 0.8, y: 0, letterSpacing: "0.18em" }, settle + 0.2, 0.9, "out");
        }
        // a slow push-in over the whole sting, so the hold is never dead still
        tl.fromTo(stage.querySelector(".cam"), { scale: 1.035 }, { scale: 1 }, 0, duration, "out");
      },
    });
  }

  window.LogoSting = { film, LOOKS };
})();
