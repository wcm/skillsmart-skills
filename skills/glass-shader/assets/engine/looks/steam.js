// Steam: a fogged-up window onto a rainy street. The fog is a field the page keeps: it comes back on its own within
// a few seconds, unevenly, the way condensation does. Press and drag to wipe it away along the stroke (a click wipes
// a spot); just moving the cursor leaves it alone. Through fog the street goes soft and pale, its lights blooming
// wide; through a wiped patch it's sharp, with a thin wet rim where the clear glass meets the fog. Drops cling to
// the glass, now and then let go and slide, clearing a trail; each is a tiny lens with the street upside down in it.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { photo, blurChain } from "../backdrop.js";
import { rgb } from "../core.js";

export const meta = { id: "steam", name: "Steam", kind: "fogged window" };

const N = 16;

const FOG = HEAD + NOISE + /* glsl */ `
uniform sampler2D uFog;
uniform float uDt, uRegrow, uAspect, uWipeR, uWipes;
uniform vec4 uWipe[4];       // strokes to wipe this frame: from x, y to x, y (uv)
uniform vec4 uDrops[${N}];   // x, y, r, sliding
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  float F = texture(uFog, vUv).r;
  vec2 asp = vec2(uAspect, 1.0);
  float patchy = 0.35 + 1.0 * smoothstep(-0.35, 0.45, fbm3(vUv * asp * 4.0));
  F += (1.0 - F) * uRegrow * patchy * uDt;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uWipes) break;
    F *= smoothstep(uWipeR * 0.55, uWipeR, segDist(vUv * asp, uWipe[i].xy * asp, uWipe[i].zw * asp));
  }
  for (int i = 0; i < ${N}; i++) {
    vec4 dr = uDrops[i];
    if (dr.w < 0.5) continue;
    vec2 q = (vUv - dr.xy) * asp;
    q.y *= 0.5;
    F *= mix(1.0, smoothstep(dr.z * 0.2, dr.z * 0.7, length(q)), 0.85);
  }
  outColor = vec4(clamp(F, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const SHOW = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uBack, uB1, uB2, uB3, uFog;
uniform vec2 uFogTexel, uCss;
uniform float uAspect, uTime, uGrain;
uniform vec3 uTint;
uniform vec4 uDrops[${N}];
void main() {
  float F = texture(uFog, vUv).r;
  vec3 sharp = texture(uBack, vUv).rgb;
  vec3 b1 = texture(uB1, vUv).rgb, b2 = texture(uB2, vUv).rgb, b3 = texture(uB3, vUv).rgb;
  // fog scatters: the street goes soft, lifted toward a cool grey, its lights blooming wide
  vec3 fog = b2 * 0.55 + b3 * 0.6 + uTint * 0.07;
  float speck = hash12(floor(vUv * uCss / 1.5));
  fog *= 0.965 + 0.07 * speck;
  vec3 col = mix(sharp, b1, smoothstep(0.03, 0.4, F));
  col = mix(col, fog, smoothstep(0.25, 0.92, F));

  // where clear glass meets fog, water gathers in a thin rim that bends the street
  vec2 g = vec2(texture(uFog, vUv + vec2(uFogTexel.x, 0.0)).r - texture(uFog, vUv - vec2(uFogTexel.x, 0.0)).r,
                texture(uFog, vUv + vec2(0.0, uFogTexel.y)).r - texture(uFog, vUv - vec2(0.0, uFogTexel.y)).r);
  float edge = smoothstep(0.06, 0.45, length(g));
  vec3 wet = texture(uBack, vUv + g * 0.012).rgb * 1.12 + 0.025;
  col = mix(col, wet, edge * 0.55);

  // drops: each a tiny lens with the street upside down in it, a glint at the top, darker at the rim
  for (int i = 0; i < ${N}; i++) {
    vec4 dr = uDrops[i];
    if (dr.z <= 0.0) continue;
    vec2 q = (vUv - dr.xy) * vec2(uAspect, 1.0);
    if (q.y > 0.0) q.y *= 0.82;
    float dd = length(q) / dr.z;
    if (dd > 1.15) continue;
    vec2 n = q / dr.z;
    float h = sqrt(max(1.0 - dd * dd, 0.0));
    vec3 inside = texture(uB1, dr.xy - n / vec2(uAspect, 1.0) * dr.z * 3.2).rgb * 1.15 + 0.015;
    float glint = pow(max(dot(normalize(vec3(n, h + 0.2)), normalize(vec3(-0.35, 0.65, 0.68))), 0.0), 36.0);
    inside += vec3(1.0) * glint * 1.3;
    inside *= mix(1.0, 0.45, smoothstep(0.62, 1.0, dd));
    col = mix(col, inside, 1.0 - smoothstep(0.9, 1.0, dd));
  }
  col = shoulder(col);
  outColor = vec4(toSRGB(col) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  const back = photo(engine, o.src, { focus: o.focus ?? [0.45, 0.5], parallax: 0.006, drift: 0.01, zoom: 1.05 });
  const blur = blurChain(engine, 3);
  back.ready.then(() => engine.redraw());
  const fogP = engine.program(FOG, undefined, "steam fog");
  const show = engine.program(SHOW, undefined, "steam show");
  const tint = rgb(o.tint ?? "#b9c6d4");
  const rand = (a, b) => a + Math.random() * (b - a);
  let backT, fog;
  function size() {
    backT?.dispose();
    backT = engine.target(engine.width, engine.height);
    blur.size(engine.width, engine.height);
    const old = fog;
    fog = engine.pair(engine.cssW / 2, engine.cssH / 2);
    // start fully fogged (keeping what was wiped would need a resample; fresh fog is fine on resize)
    engine.gl.bindFramebuffer(engine.gl.FRAMEBUFFER, fog.read.fbo);
    engine.gl.viewport(0, 0, fog.w, fog.h);
    engine.gl.clearColor(1, 0, 0, 1);
    engine.gl.clear(engine.gl.COLOR_BUFFER_BIT);
    old?.dispose();
  }
  size();

  // drops: cling, let go, slide, cling again; when one leaves the bottom a new one forms higher up
  const drop = (anywhere) => ({ x: rand(0.02, 0.98), y: anywhere ? rand(0.08, 0.98) : rand(0.55, 1), r: rand(0.006, 0.014), v: 0, sliding: false, timer: rand(2, 14), wob: rand(0, 6) });
  const drops = Array.from({ length: N }, () => drop(true));
  const uDrops = new Float32Array(N * 4);
  // a press wipes where it lands and a drag along its stroke. Presses, moves and releases can all come between two
  // frames (a quick click is over before the next one), so the strokes queue up and the next frame wipes them all.
  let from = null, wipeDist = 0;
  const strokes = [], uWipe = new Float32Array(16);
  const stroke = (ax, ay, bx, by) => {
    if (strokes.length === 4) { const s = strokes.pop(); ax = s[0]; ay = s[1]; } // more than four: join the last two
    strokes.push([ax, ay, bx, by]);
  };
  const select = (on) => { document.documentElement.style.userSelect = document.documentElement.style.webkitUserSelect = on ? "" : "none"; };

  function updateDrops(dt) {
    for (const d of drops) {
      if (!d.sliding) {
        d.timer -= dt;
        if (d.timer <= 0) { d.sliding = true; d.v = rand(0.03, 0.07); d.timer = rand(0.4, 1.4); }
      } else {
        d.v = Math.min(0.5, d.v + dt * 0.25 * (d.r / 0.008));
        d.y -= d.v * dt;
        d.x += Math.sin(d.y * 40 + d.wob) * 0.04 * d.v * dt;
        d.timer -= dt;
        if (d.timer <= 0) { d.sliding = false; d.v = 0; d.timer = rand(2, 10); }
        if (d.y < -0.04) Object.assign(d, drop(false));
      }
    }
    drops.forEach((d, i) => uDrops.set([d.x, d.y, d.r, d.sliding ? 1 : 0], i * 4));
  }

  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: 4,
    resize: size,
    // a press on the glass starts a wipe (anywhere else on the page it's an ordinary click); while wiping, a drag over
    // the copy shouldn't select it
    down(p) { if (!p.inside) return; from = [p.x, p.y]; stroke(p.x, p.y, p.x, p.y); select(false); },
    up(p) { if (from) stroke(from[0], from[1], p.x, p.y); from = null; select(true); },
    frame(dt, t) {
      const p = engine.pointer;
      updateDrops(dt);
      const dragging = p.down && !!from;
      if (dragging) { stroke(from[0], from[1], p.x, p.y); from = [p.x, p.y]; }
      uWipe.fill(0);
      strokes.forEach((s, i) => uWipe.set(s, i * 4));
      const wipes = strokes.length;
      strokes.length = 0;
      // wiping gathers water: every so often a drop runs from the stroke
      if (dragging && p.inside) {
        wipeDist += Math.hypot((p.x - p.px) * engine.aspect, p.y - p.py);
        if (wipeDist > 0.35) {
          wipeDist = 0;
          const d = drops.reduce((a, b) => (a.sliding || a.timer < b.timer ? b : a));
          Object.assign(d, { x: p.x, y: p.y - 0.04, r: rand(0.007, 0.012), sliding: true, v: 0.05, timer: rand(1, 2.5) });
        }
      }
      engine.draw(fogP, {
        uFog: fog.read, uDt: dt, uRegrow: o.regrow ?? 0.2, uAspect: engine.aspect, uWipeR: o.wipe ?? 0.055, uWipes: wipes,
        uWipe, uDrops,
      }, fog.write);
      fog.swap();
      if (!back.render(backT, dt, t)) {
        engine.draw(show, { uBack: backT, uB1: backT, uB2: backT, uB3: backT, uFog: fog.read, uFogTexel: fog.texel, uCss: [engine.cssW, engine.cssH], uAspect: engine.aspect, uTime: t, uGrain: 0, uTint: tint, uDrops: uDrops });
        return;
      }
      blur.build(backT, 1.6);
      engine.draw(show, {
        uBack: backT, uB1: blur.levels[0], uB2: blur.levels[1], uB3: blur.levels[2], uFog: fog.read, uFogTexel: fog.texel,
        uCss: [engine.cssW, engine.cssH], uAspect: engine.aspect, uTime: t, uGrain: o.grain ?? 0.03, uTint: tint, uDrops: uDrops,
      });
    },
  };
}
