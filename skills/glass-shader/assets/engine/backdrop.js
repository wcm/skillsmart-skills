// What sits behind the glass. Glass only shows itself by bending what's behind it, so every look here draws a
// backdrop into a target first and reads it back, bent. Three kinds: a moving colour field (soft gradient pools and
// a colour that follows the cursor), a photo (cover-fit round a focus point, with a slow drift, optionally fading
// into the page on one side), and a soft ball of colour on a plain ground. Plus a blur chain, for frosted looks.
import { HEAD, NOISE, COLOR } from "./glsl.js";
import { rgb, rgbs, damp } from "./core.js";

export const BLUR = HEAD + /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uDir;
void main() {
  vec4 c = texture(uSource, vUv) * 0.2270270270;
  c += (texture(uSource, vUv + uDir * 1.3846153846) + texture(uSource, vUv - uDir * 1.3846153846)) * 0.3162162162;
  c += (texture(uSource, vUv + uDir * 3.2307692308) + texture(uSource, vUv - uDir * 3.2307692308)) * 0.0702702703;
  outColor = c;
}`;

// Progressively smaller, blurrier copies of a texture: level i is 1/2^(i+1) the size.
export function blurChain(engine, levels = 3) {
  const prog = engine.program(BLUR, undefined, "blur");
  let tA = [], tB = [];
  const chain = {
    levels: [],
    size(w, h) {
      [...tA, ...tB].forEach((t) => t.dispose());
      tA = []; tB = [];
      for (let i = 0; i < levels; i++) {
        const s = 2 ** (i + 1);
        tA.push(engine.target(w / s, h / s));
        tB.push(engine.target(w / s, h / s));
      }
      chain.levels = tA;
    },
    build(source, spread = 1) {
      let src = source;
      for (let i = 0; i < levels; i++) {
        const a = tA[i], b = tB[i];
        engine.draw(prog, { uSource: src, uDir: [spread / a.w, 0] }, b);
        engine.draw(prog, { uSource: b, uDir: [0, spread / a.h] }, a);
        engine.draw(prog, { uSource: a, uDir: [spread * 2 / a.w, 0] }, b);
        engine.draw(prog, { uSource: b, uDir: [0, spread * 2 / a.h] }, a);
        src = a;
      }
    },
  };
  return chain;
}

// ——— a moving colour field ———

const FIELD = HEAD + NOISE + COLOR + /* glsl */ `
uniform float uAspect, uTime, uPresence, uPulse, uCalmSoft, uCalmAmount, uCursorMix, uPull;
uniform vec4 uCalm;  // x0, y0, x1, y1 (uv): a box where the field settles to its base colour, e.g. behind the copy
uniform vec4 uBloom; // x, y (uv), age (s), strength: a click's colour opening out
uniform vec2 uPointer, uVel;
uniform vec3 uBase, uBase2, uBlob[5], uCursorCol;
vec2 orbit(float i, float t) {
  return 0.5 + vec2(0.42 * sin(t * (0.07 + 0.021 * i) + i * 2.3), 0.38 * cos(t * (0.055 + 0.017 * i) + i * 1.7));
}
void main() {
  vec2 frame = vec2(uAspect, 1.0) / max(uAspect, 1.0);
  vec2 p = (vUv - 0.5) * frame;
  float t = uTime;
  vec2 w = vec2(fbm3(p * 1.6 + vec2(0.0, t * 0.03)), fbm3(p * 1.6 + vec2(4.3, -t * 0.025)));
  vec2 q = p + w * 0.35;
  // the cursor draws the colour a little toward itself
  vec2 m = (uPointer - 0.5) * frame, mq = m - q;
  q += mq * uPull * exp(-dot(mq, mq) / 0.05) * uPresence;
  vec3 col = mixOk(uBase, uBase2, smoothstep(-0.45, 0.45, q.x * 0.7 + q.y * 0.9 + w.x));
  for (int i = 0; i < 5; i++) {
    vec2 c = (orbit(float(i), t) - 0.5) * frame;
    vec2 d = q - c;
    float r = 0.16 + 0.05 * sin(t * 0.2 + float(i));
    col = mixOk(col, uBlob[i], exp(-dot(d, d) / (r * r)) * 0.9);
  }
  // a few long sweeping bands of colour, the strokes that glass shows off best
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 dir = normalize(vec2(1.0, -0.55 + 0.35 * fi));
    float x = dot(q, dir) - (0.3 * sin(t * (0.05 + 0.02 * fi) + fi * 2.1)) + (fi - 1.0) * 0.28;
    float wv = 0.05 + 0.03 * sin(t * 0.13 + fi * 3.0);
    float band = exp(-pow(x / wv, 2.0)) * smoothstep(-0.2, 0.4, w.y + 0.2 * sin(dot(q, dir.yx) * 3.0 + t * 0.1 + fi));
    col = mixOk(col, uBlob[(i * 2) % 5], band * 0.85);
  }
  // the cursor carries a colour that smears out behind it as it moves
  vec2 v = uVel * frame;
  vec2 dm = q - m;
  float along = dot(dm, normalize(v + 1e-5));
  dm -= normalize(v + 1e-5) * clamp(along, -length(v) * 0.12, 0.0);
  float k = exp(-dot(dm, dm) / 0.018) * uPresence;
  col = mixOk(col, uCursorCol, k * uCursorMix);
  col *= 1.0 + uPulse * 0.25 * exp(-dot(dm, dm) / 0.05);
  // a click: a soft disc of colour that opens out and fades
  vec2 bq = q - (uBloom.xy - 0.5) * frame;
  float br = 0.04 + 0.26 * smoothstep(0.0, 1.6, uBloom.z);
  col = mixOk(col, uCursorCol, (1.0 - smoothstep(br * 0.35, br, length(bq))) * (1.0 - smoothstep(0.3, 2.2, uBloom.z)) * uBloom.w);
  vec2 cq = max(abs(vUv - (uCalm.xy + uCalm.zw) * 0.5) - (uCalm.zw - uCalm.xy) * 0.5, 0.0) * vec2(uAspect, 1.0);
  col = mixOk(col, uBase, (1.0 - smoothstep(0.0, uCalmSoft, length(cq))) * uCalmAmount);
  outColor = vec4(col, 1.0);
}`;

export function field(engine, o = {}) {
  const prog = engine.program(FIELD, undefined, "field backdrop");
  const u = {
    uBase: rgb(o.base ?? "#efe9ff"), uBase2: rgb(o.base2 ?? "#cdbfff"),
    uBlob: rgbs(o.blobs ?? ["#8f2bff", "#5a3dff", "#b04dff", "#4a2bff", "#d68bff"]),
    uCursorCol: rgb(o.cursor ?? "#ae00ff"),
  };
  const vel = [0, 0], bloom = [0.5, 0.5, 99, 0];
  let pulse = 0;
  return {
    down(p) { pulse = 1; if (p && o.bloom !== false) bloom.splice(0, 4, p.x, p.y, 0, o.bloom ?? 0.75); },
    render(target, dt, t) {
      const p = engine.pointer;
      vel[0] = damp(vel[0], p.vx, 5, dt);
      vel[1] = damp(vel[1], p.vy, 5, dt);
      pulse = Math.max(0, pulse - dt * 1.5);
      bloom[2] += dt;
      const calm = o.calm?.();
      engine.draw(prog, {
        ...u, uAspect: engine.aspect, uTime: t * (o.speed ?? 1), uPresence: p.presence, uPointer: [p.sx, p.sy], uVel: vel, uPulse: pulse,
        uCalm: calm ?? [0, 0, 0, 0], uCalmAmount: calm ? o.calmAmount ?? 0.86 : 0, uCalmSoft: o.calmSoft ?? 0.16,
        uCursorMix: o.cursorMix ?? 0.85, uPull: o.pull ?? 0, uBloom: bloom,
      }, target);
    },
  };
}

// ——— a photo ———

const PHOTO = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uImg;
uniform float uCanvasAspect, uImgAspect, uZoom, uFade;
uniform vec2 uFocus, uShift;
uniform vec4 uFadeLine; // x0, x1 (or y0, y1), axis (0 = x, 1 = y), side (0 = image on the high side)
uniform vec3 uPage;
void main() {
  vec2 s = uCanvasAspect > uImgAspect ? vec2(1.0, uImgAspect / uCanvasAspect) : vec2(uCanvasAspect / uImgAspect, 1.0);
  s /= uZoom;
  vec2 uv = (vec2(1.0) - s) * uFocus + vUv * s + uShift;
  vec3 col = toLinear(texture(uImg, uv).rgb);
  if (uFade > 0.5) {
    float x = uFadeLine.z > 0.5 ? vUv.y : vUv.x;
    float k = smoothstep(uFadeLine.x, uFadeLine.y, x);
    if (uFadeLine.w > 0.5) k = 1.0 - k;
    col = mix(uPage, col, k);
  }
  outColor = vec4(col, 1.0);
}`;

export function photo(engine, src, o = {}) {
  const prog = engine.program(PHOTO, undefined, "photo backdrop");
  let tex = null;
  const img = new Image();
  img.decoding = "async";
  const ready = new Promise((res) => {
    img.onload = () => { tex = engine.texture(img, { mipmap: true }); res(); };
    img.onerror = res;
  });
  img.src = src;
  const shift = [0, 0];
  const page = rgb(o.page ?? "#000000");
  return {
    ready,
    get loaded() { return !!tex; },
    render(target, dt, t) {
      if (!tex) return false;
      const p = engine.pointer;
      const px = o.parallax ?? 0.008;
      shift[0] = damp(shift[0], (p.sx - 0.5) * px * p.presence, 2, dt);
      shift[1] = damp(shift[1], (p.sy - 0.5) * px * p.presence, 2, dt);
      const zoom = (o.zoom ?? 1.04) + (o.drift ?? 0.015) * Math.sin(t * 0.05);
      const fade = typeof o.fade === "function" ? o.fade() : o.fade;
      engine.draw(prog, {
        uImg: tex, uCanvasAspect: engine.aspect, uImgAspect: tex.w / tex.h, uZoom: zoom, uFocus: o.focus ?? [0.5, 0.5], uShift: shift,
        uFade: fade ? 1 : 0, uFadeLine: fade ?? [0, 0, 0, 0], uPage: page,
      }, target);
      return true;
    },
  };
}

// ——— a glowing ball ———

// A soft ball of colour on a plain ground: a deep core (by default dark red, set a little above its middle) running
// out through orange to yellow at its rim, and fading into the ground, so even where it shows bare it's a glow, not
// a disc. The look says where it is and how big (in canvas heights); `pulse` (0…1) swells it for a moment.
const ORB = HEAD + NOISE + COLOR + /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius, uAspect, uTime, uSoft;
uniform vec3 uBg, uBg2, uCols[3];
vec3 tone(float k) { return k < 0.5 ? mixOk(uCols[0], uCols[1], k * 2.0) : mixOk(uCols[1], uCols[2], k * 2.0 - 1.0); }
void main() {
  vec2 q = (vUv - uCenter) * vec2(uAspect, 1.0) / uRadius;   // in ball radii
  float r = length(q), a = uTime * 0.07;
  vec2 core = 0.28 * vec2(sin(a), cos(a * 0.8)) + vec2(0.06, 0.3);
  vec3 c = tone(clamp(0.82 * length(q - core) + 0.16 * (-q.x - q.y) + 0.04, 0.0, 1.0));
  vec3 col = mix(uBg2, uBg, vUv.y);
  col = mixOk(col, c, 1.0 - smoothstep(1.0 - uSoft, 1.05, r));
  outColor = vec4(col, 1.0);
}`;

export function orb(engine, o = {}) {
  const prog = engine.program(ORB, undefined, "orb backdrop");
  const u = {
    uBg: rgb(o.bg ?? "#d6d6d6"), uBg2: rgb(o.bg2 ?? "#d0d0d0"),
    uCols: rgbs(o.colors ?? ["#5c0b00", "#ff6200", "#ffc21a"]),
  };
  return {
    render(target, t, center, radius, pulse = 0) {
      const r = radius * (1 + 0.1 * Math.sin(Math.PI * pulse));
      engine.draw(prog, { ...u, uCenter: center, uRadius: r, uAspect: engine.aspect, uTime: t * (o.speed ?? 1), uSoft: o.soft ?? 0.5 }, target);
    },
  };
}
