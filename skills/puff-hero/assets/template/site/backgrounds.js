// backgrounds.js — backgrounds drawn in code, once, behind the letters. They never move: the puffy letters are the
// only moving thing on the page. Pick a recipe that belongs to the brand and the word, or invent one the same way
// (references/backgrounds.md). Redraw them after every resize (puff.onSized does that for you).
//
//   const x = prepare(canvas)                              a 2D context in CSS pixels, at the screen's density
//   outlineRows(el, { word, family, … })                   rows of the word in outline, filling the window (fashion)
//   twistedGrid(canvas, { a, b, … })                       a funhouse checkerboard, a WebGL shader (music, pop)
//   swirl(x, { center, color, … }) + sprinkles(x, { … })   a soft-serve swirl seen from above, and sprinkles (food)
//   crayonClouds(x, { ink, tint, … })                      crayon clouds on coloured paper (cozy, kids, home)
//   rects(".site", ".label")                               boxes for recipes to keep out of (the copy)
//   fitText(el, share)                                     size a headline to a share of the window's width
//   barcode("0123 4567")                                   an SVG barcode for poster small print

export function prepare(canvas){
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  const x = canvas.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return x;
}
export const rects = (...selectors) => selectors.map((s) => document.querySelector(s)?.getBoundingClientRect()).filter(Boolean);
export function rng(seed = 1){
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ——— rows of the word in outline (fashion, streetwear: the PANTER poster) ———
// The stroke is painted under a fill in the page colour, twice as wide so half shows, which also hides the font's
// overlapping contours (the bars inside E, G, R). Load the font first (await document.fonts.ready).
export function outlineRows(el, { word, family = "Unbounded", weight = 700, color = "currentColor", bg = "var(--bg)", stroke = .0017, fill = .94, lead = .9 } = {}){
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = `${weight} 100px ${family}`;
  const fs = innerWidth * fill / probe.measureText(word).width * 100, n = Math.ceil(innerHeight / (fs * lead)) + 1;
  Object.assign(el.style, { position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", pointerEvents: "none" });
  const span = `<span style="display:block;white-space:nowrap;font:${weight} ${fs.toFixed(1)}px/${lead} ${family};letter-spacing:-.01em;color:${bg};` +
    `-webkit-text-stroke:max(2px,${(stroke * 100).toFixed(3)}vw) ${color};paint-order:stroke fill">${esc(word)}</span>`;
  el.innerHTML = span.repeat(n);
}

// ——— a funhouse checkerboard (music, pop, Y2K: twisted in the middle, easing out to the edges) ———
export function twistedGrid(canvas, { a = "#c3f15a", b = "#8fd83b", twist = 1.35, cells = 6.2, wave = .055 } = {}){
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  const gl = canvas.getContext("webgl2"); if (!gl) return;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, "#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }"));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uA, uB; uniform float uTwist, uCells, uWave;
out vec4 o;
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float r = length(p), t = uTwist * exp(-r * r * 2.6);
  p = mat2(cos(t), -sin(t), sin(t), cos(t)) * p;
  p += uWave * vec2(sin(p.y * 5.2 + .6), sin(p.x * 4.3 + 1.7));
  p *= 1. + .35 * r * r;
  vec2 g = p * uCells;
  float s = sin(g.x * 3.14159) * sin(g.y * 3.14159), w = fwidth(s) * 1.2;
  o = vec4(mix(uA, uB, smoothstep(-w, w, s)), 1.);
}`));
  gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  gl.uniform2f(gl.getUniformLocation(pr, "uRes"), canvas.width, canvas.height);
  gl.uniform3f(gl.getUniformLocation(pr, "uA"), ...rgb(a));
  gl.uniform3f(gl.getUniformLocation(pr, "uB"), ...rgb(b));
  gl.uniform1f(gl.getUniformLocation(pr, "uTwist"), twist);
  gl.uniform1f(gl.getUniformLocation(pr, "uCells"), cells);
  gl.uniform1f(gl.getUniformLocation(pr, "uWave"), wave);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ——— a soft-serve swirl seen from above (food, sweets): one thick spiral, rippled like piped soft serve ———
// center: { x, y } in window px (the letters' centre); color: a tone just off the page colour
export function swirl(x, { center, color = "#d8d6d0", pitch } = {}){
  const W = innerWidth, H = innerHeight, cx = center?.x ?? W / 2, cy = center?.y ?? H / 2;
  pitch ??= Math.max(44, Math.min(W, H) / 10.5);
  const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + pitch;
  x.save(); x.strokeStyle = color; x.lineWidth = pitch * .44; x.lineCap = x.lineJoin = "round";
  x.beginPath(); x.moveTo(cx, cy);
  for (let a = 0, along = 0, rr = 0; rr < R; ){
    const da = Math.min(.06, 3 / Math.max(1, rr));
    a += da; along += Math.max(1, rr) * da;
    rr = pitch * a / (2 * Math.PI) + pitch * .07 * Math.sin(along / (pitch * 1.15) * 2 * Math.PI);   // a ridge every 1.15 pitches
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.stroke(); x.restore();
}
// sprinkles on a jittered grid: none on the letters' middle (clear: the letters' box), none under the copy (keepOut)
export function sprinkles(x, { colors, center, clear, keepOut = [], density = 1, seed = 7 } = {}){
  const W = innerWidth, H = innerHeight, cx = center?.x ?? W / 2, cy = center?.y ?? H / 2, cw = clear?.width ?? W * .4, ch = clear?.height ?? H * .4;
  const g = Math.max(52, Math.min(92, Math.min(W, H) / 9)) / Math.sqrt(density), rand = rng(seed);
  x.save(); x.lineCap = "round";
  for (let j = -1; j * g < H + g; j++) for (let i = -1; i * g < W + g; i++){
    const px = (i + rand()) * g, py = (j + rand()) * g, L = g * (.3 + rand() * .16), a = rand() * Math.PI, c = colors[Math.floor(rand() * colors.length)], keep = rand();
    const e = ((px - cx) / (cw * .55)) ** 2 + ((py - cy) / (ch * .55)) ** 2;
    if (keep > .92 * smooth(.85, 2.2, e)) continue;
    if (keepOut.some((b) => px > b.left - 18 && px < b.right + 18 && py > b.top - 18 && py < b.bottom + 18)) continue;
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2;
    x.lineWidth = L * .27;
    x.strokeStyle = "rgba(60, 50, 40, .1)";                       // a soft contact shadow
    x.beginPath(); x.moveTo(px - dx + 1.5, py - dy + 2.5); x.lineTo(px + dx + 1.5, py + dy + 2.5); x.stroke();
    x.strokeStyle = c;
    x.beginPath(); x.moveTo(px - dx, py - dy); x.lineTo(px + dx, py + dy); x.stroke();
  }
  x.restore();
}

// ——— crayon clouds on coloured paper (cozy, kids, home, sleep) ———
// Drawn the way a child draws them: a bumpy outline gone over twice and a loose scribble of colouring-in that stops
// short of the line, in wax that skips the paper's grain. Calm on purpose: a few big shapes round the margins.
// clouds: [x, y, size] (shares of the window; size of its shorter side). One that meets a keepOut box moves below it
// (if the box is in the top half) or above it, or is left out.
export const CLOUDS = [[.11, .2, .3], [.87, .16, .22], [.94, .58, .3], [.06, .64, .2], [.37, .08, .13], [.66, .87, .16], [.61, .11, .1], [.25, .45, .1]];
export function crayonClouds(x, { ink = "#ffffff", tint = "#c9d6f3", fill = .38, clouds = CLOUDS, keepOut = [], seed = 11 } = {}){
  const W = innerWidth, H = innerHeight, dpr = x.getTransform().a, rand = rng(seed), u = Math.min(W, H);
  const layer = document.createElement("canvas"); layer.width = x.canvas.width; layer.height = x.canvas.height;
  const k = layer.getContext("2d"); k.setTransform(dpr, 0, 0, dpr, 0, 0); k.lineCap = k.lineJoin = "round";
  // a cloud reaches about .75 h above its centre (the humps) and .25 h below
  const hits = (cx, cy, w, h) => keepOut.find((b) => cx + w * .52 > b.left - 12 && cx - w * .52 < b.right + 12 && cy + h * .25 > b.top - 12 && cy - h * .75 < b.bottom + 12);
  clouds.forEach(([nx, ny, ns], n) => {
    let cx = nx * W, cy = ny * H;
    const w = ns * u * 1.5, h = w * .5, b = hits(cx, cy, w, h);
    if (b) cy = b.top < H / 2 ? b.bottom + 12 + h * .75 : b.top - 12 - h * .25;
    if (hits(cx, cy, w, h)) return;
    cloud(k, cx, cy, w, h, rand, n % 3 === 1 ? tint : ink, fill);
  });
  const grainy = k.createPattern(grain(), "repeat");
  grainy.setTransform(new DOMMatrix().scale(dpr * 1.3));   // a grain about a CSS pixel and a bit across
  k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = "destination-in"; k.fillStyle = grainy; k.fillRect(0, 0, layer.width, layer.height);
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(layer, 0, 0); x.restore();
}
// one cloud: n humps across the top (cusps between them), a flatter, slightly wavy underside, a hand's wobble
function cloud(k, cx, cy, w, h, rand, color, fill){
  const n = 3 + Math.floor(rand() * 3), ph = [rand() * 6.3, rand() * 6.3, rand() * 6.3], lw = Math.max(4, w * .02);
  const outline = (dx, dy, s) => {
    const pts = [];
    for (let i = 0; i <= 200; i++){
      const t = i / 200 * 2 * Math.PI, sn = Math.sin(t), cs = Math.cos(t);
      let px, py;
      if (sn < 0){ const v = (t - Math.PI) / Math.PI, hump = Math.pow(Math.abs(Math.sin(v * n * Math.PI)), .55), r = 1 + .26 * hump * (.55 + .45 * Math.sin(v * Math.PI));
        px = cs * w / 2 * r; py = sn * h / 2 * r * 1.15; }
      else { px = cs * w / 2; py = sn * h * .2 + Math.sin(cs * 5 + ph[0]) * h * .025; }
      px += Math.sin(t * 3 + ph[1]) * w * .012 + dx; py += Math.cos(t * 4 + ph[2]) * h * .02 + dy;
      pts.push([cx + px * s, cy + py * s]);
    }
    return pts;
  };
  const path = (pts) => { k.beginPath(); pts.forEach(([a, b], i) => (i ? k.lineTo(a, b) : k.moveTo(a, b))); };
  // colouring-in: a back-and-forth scribble at a slant inside a smaller copy of the outline; each stroke bows and
  // wanders, the spacing and pressure vary, the turns overshoot
  k.save(); path(outline(0, 0, .9)); k.clip();
  k.translate(cx, cy); k.rotate(-.45 + (rand() - .5) * .3); k.strokeStyle = color;
  const R = w * .6;
  let px = -R, py = -R;
  for (let yy = -R, side = 1; yy < R; side = -side){
    const step = lw * (1 + rand() * .9), nx = side * (R + rand() * lw * 3), ny = yy + step * .5 + (rand() - .5) * lw * .6;
    k.globalAlpha = fill * (.6 + rand() * .55); k.lineWidth = lw * (.8 + rand() * .6);
    k.beginPath(); k.moveTo(px, py);
    k.quadraticCurveTo((px + nx) / 2 + (rand() - .5) * lw * 2, (py + ny) / 2 + (rand() - .5) * lw * 2.5, nx, ny);
    k.stroke(); px = nx; py = ny; yy += step;
  }
  k.restore();
  // the outline, twice, a little apart
  k.strokeStyle = color;
  k.globalAlpha = .95; k.lineWidth = lw; path(outline(0, 0, 1)); k.closePath(); k.stroke();
  k.globalAlpha = .6; k.lineWidth = lw * .7; path(outline((rand() - .5) * lw * 1.4, (rand() - .5) * lw, 1.012)); k.closePath(); k.stroke();
  k.globalAlpha = 1;
}
// the paper's tooth, as alpha: fine speckle (where the wax skips) over coarse patches (where the hand pressed lighter)
let grainTile = null;
function grain(){
  if (grainTile) return grainTile;
  const S = 256, G = 16, n = S / G, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), im = g.createImageData(S, S), rnd = rng(3), coarse = Array.from({ length: n * n }, rnd);
  const at = (i, j) => coarse[((j % n) + n) % n * n + ((i % n) + n) % n];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
    const gx = x / G, gy = y / G, i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const cv = (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
    const v = rnd() * .7 + cv * .5;
    im.data[(y * S + x) * 4 + 3] = v > .42 ? 255 : Math.max(0, (v - .3) / .12) * 255;
  }
  g.putImageData(im, 0, 0);
  return (grainTile = c);
}

// ——— small pieces ———
// a headline sized to a share of the window's width (over 1 bleeds off both edges); letter-spacing in em scales with it
export function fitText(el, share = 1.1){
  el.style.fontSize = "100px";
  const w = el.getBoundingClientRect().width || 1;
  el.style.fontSize = `${(100 * innerWidth * share / w).toFixed(2)}px`;
}
// a stable pattern of thin and thick bars from the digits
export function barcode(code){
  let x = 0, seed = [...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7), bars = "";
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  while (x < 196){ const w = 1 + Math.floor(rnd() * 3.2); if (rnd() > .42) bars += `<rect x="${x}" width="${w}" height="54"/>`; x += w + 1 + Math.floor(rnd() * 2); }
  return `<svg viewBox="0 0 200 54" preserveAspectRatio="none" aria-hidden="true"><g fill="currentColor">${bars}</g></svg>`;
}
