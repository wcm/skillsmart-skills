// Dye: colour poured into dark water. Three emitters drift slowly round the frame, each trailing its own colour,
// so the hero is never quite still; the cursor draws the water gently along behind it and leaves a little colour in
// its wake; a click lets a soft bloom of new colour open where it lands. The touch is light on purpose: low swirl,
// a thick, calm water, so the dye unfolds in long delicate plumes rather than churning. It's shown as light on a
// deep ground, softened and bloomed so it reads as glowing cloud rather than paint.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { Fluid } from "../fluid.js";
import { rgb } from "../core.js";

export const meta = { id: "dye", name: "Dye", kind: "colour stirred in water" };

const BLUR = HEAD + /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uDir;
void main() {
  vec4 c = texture(uSource, vUv) * 0.2270270270;
  c += (texture(uSource, vUv + uDir * 1.3846153846) + texture(uSource, vUv - uDir * 1.3846153846)) * 0.3162162162;
  c += (texture(uSource, vUv + uDir * 3.2307692308) + texture(uSource, vUv - uDir * 3.2307692308)) * 0.0702702703;
  outColor = c;
}`;

const DISPLAY = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uDye, uSoft;
uniform vec3 uBg, uBg2;
uniform float uTime, uGrain, uExposure, uBloom, uSoftness;
void main() {
  vec3 d = texture(uDye, vUv).rgb;
  vec3 s = texture(uSoft, vUv).rgb;
  vec3 dye = mix(d, s, uSoftness);
  vec3 bg = mix(uBg2, uBg, smoothstep(0.0, 1.0, vUv.y));
  // map brightness, not each channel, so dense dye stays its colour instead of washing out to white
  float m = max(max(dye.r, dye.g), dye.b);
  vec3 light = dye / max(m, 1e-4) * (1.0 - exp(-m * uExposure));
  float ms = max(max(s.r, s.g), s.b);
  vec3 glow = s / max(ms, 1e-4) * (1.0 - exp(-ms * uExposure));
  vec3 col = bg + light + glow * uBloom;
  col = shoulder(col);
  outColor = vec4(toSRGB(col) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  const fluid = new Fluid(engine, { sim: 128, curl: o.curl ?? 4, velocityDissipation: o.calm ?? 0.9, iters: 20 });
  const dye = fluid.field(o.dyeRes ?? 420);
  const blur = engine.program(BLUR, undefined, "dye blur");
  const show = engine.program(DISPLAY, undefined, "dye display");
  const palette = (o.colors ?? ["#7b3cff", "#2f6bff", "#5fc8ff", "#c04dff", "#3c2bff"]).map(rgb);
  const bg = rgb(o.bg ?? "#0b0820"), bg2 = rgb(o.bg2 ?? "#05040f");
  let soft1, soft2;
  const softSize = () => {
    soft1?.dispose(); soft2?.dispose();
    const [w, h] = fluid.dims(o.softRes ?? 110);
    soft1 = engine.target(w, h);
    soft2 = engine.target(w, h);
  };
  softSize();

  const colorAt = (t, k = 0) => {
    const n = palette.length, f = ((t * 0.07 + k) % 1 + 1) % 1 * n, i = Math.floor(f), u = f - i;
    const a = palette[i % n], b = palette[(i + 1) % n];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  };

  // three emitters on slow, different orbits
  const emitters = [0, 1, 2].map((i) => ({ i, x: 0.5, y: 0.5, px: 0.5, py: 0.5 }));
  const place = (e, t) => {
    const s = (0.05 + e.i * 0.014) * (o.drift ?? 1);
    e.x = 0.5 + 0.38 * Math.sin(t * s + e.i * 2.1) + 0.06 * Math.sin(t * s * 2.7 + e.i);
    e.y = 0.5 + 0.34 * Math.cos(t * s * 0.83 + e.i * 1.3) + 0.05 * Math.cos(t * s * 3.1 + e.i * 2);
  };
  let splash = null, warmed = false;

  function simulate(dt, t, p) {
    // emitters: push gently along their path and trail colour
    for (const e of emitters) {
      e.px = e.x; e.py = e.y;
      place(e, t);
      const vx = ((e.x - e.px) / Math.max(dt, 1e-3)) * fluid.w * 0.9, vy = ((e.y - e.py) / Math.max(dt, 1e-3)) * fluid.h * 0.9;
      fluid.splat(fluid.vel, e.x, e.y, [vx, vy, 0, 0], 0.006);
      const c = colorAt(t, e.i * 0.33);
      const k = (o.flow ?? 0.55) * dt;
      fluid.splat(dye, e.x, e.y, [c[0] * k, c[1] * k, c[2] * k, 0], 0.005);
    }
    // the cursor: draws the water gently along behind it, leaving a little colour
    if (p && p.presence > 0.02 && p.moved) {
      const c = colorAt(t * 1.7, 0.5);
      fluid.stir(p, dt, {
        force: o.touch ?? 0.2, radius: 0.0045, max: 520,
        each: (x, y, speed) => {
          const k = Math.min(1, speed * 0.8) * 0.1 * p.presence;
          fluid.splat(dye, x, y, [c[0] * k, c[1] * k, c[2] * k, 0], 0.0025);
        },
      });
    }
    // a click: a soft bloom of new colour, opening slowly rather than splashing
    if (splash) {
      const c = colorAt(t * 1.7 + 0.37, 0.15);
      fluid.burst(splash.x, splash.y, { n: 6, speed: 200, radius: 0.005, ring: 0.03, twist: 0.15 });
      fluid.splat(dye, splash.x, splash.y, [c[0] * 1.1, c[1] * 1.1, c[2] * 1.1, 0], 0.0055);
      splash = null;
    }
    fluid.step(dt);
    fluid.advect(dye, dt, o.fade ?? 0.42);
  }

  function render(t) {
    // a soft copy: downsample and blur, used for the softness and the glow
    engine.draw(blur, { uSource: dye.read, uDir: [1 / soft1.w, 0] }, soft1);
    engine.draw(blur, { uSource: soft1, uDir: [0, 1 / soft1.h] }, soft2);
    engine.draw(blur, { uSource: soft2, uDir: [2 / soft1.w, 0] }, soft1);
    engine.draw(blur, { uSource: soft1, uDir: [0, 2 / soft1.h] }, soft2);
    engine.draw(show, {
      uDye: dye.read, uSoft: soft2, uBg: bg, uBg2: bg2, uTime: t,
      uGrain: o.grain ?? 0.05, uExposure: o.exposure ?? 2.2, uBloom: o.bloom ?? 0.35, uSoftness: o.softness ?? 0.45,
    });
  }

  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: 8,
    resize() { fluid.resize(); softSize(); },
    down(p) { splash = { x: p.x, y: p.y }; },
    warm(t) { for (let i = 0; i < 240; i++) simulate(1 / 60, t - (240 - i) / 60, null); warmed = true; },
    frame(dt, t) {
      if (!warmed) this.warm(t);
      if (dt > 0) simulate(Math.min(dt, 1 / 30), t, engine.pointer);
      render(t);
    },
  };
}
