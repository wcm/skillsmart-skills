// Reeded: a sheet of fluted glass over the whole page, running off its edges, in front of a moving colour field.
// It's nearly flat behind the copy (`copy`), so the words read cleanly, and its flutes deepen gradually away from
// it: sideways on wide screens, up and down on tall ones. Each flute is a thick cylindrical lens: it shows a wider
// strip of what's behind it, squeezed to fit, upright, so a shape repeats from flute to flute and jumps where two
// meet, and it bends harder and harder toward its edges, where it looks far out to the side. The deeper the
// flutes, the softer the glass makes what it shows, and red and blue spread differently, so the joins fringe. Nothing is drawn on the glass: every line is the
// picture behind, bent. The glass never moves: the cursor only stirs the colour behind it a little, and a click
// opens a bloom of colour there, which the glass then bends like everything else.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { field, blurChain } from "../backdrop.js";

export const meta = { id: "reeded", name: "Reeded", kind: "fluted glass" };

const FS = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uBack, uB1, uB2, uB3;
uniform vec2 uCss;
uniform vec4 uFlat;    // the copy's box (uv, y up): the glass is flattest over it
uniform float uWide, uRampIn, uRampOut, uFlat0, uFlute, uThick, uDisperse, uBlur, uTime, uGrain;
// the backdrop, blurred by 0 (sharp) to 3 (an eighth of its size), in between by mixing the levels
vec3 read(vec2 uv, float b) {
  if (b < 1.0) return mix(texture(uBack, uv).rgb, texture(uB1, uv).rgb, b);
  if (b < 2.0) return mix(texture(uB1, uv).rgb, texture(uB2, uv).rgb, b - 1.0);
  return mix(texture(uB2, uv).rgb, texture(uB3, uv).rgb, min(b - 2.0, 1.0));
}
void main() {
  vec2 px = vUv * uCss;
  // how deep the flutes are here: faint over the copy, deepening away from it
  vec2 fc = (uFlat.xy + uFlat.zw) * 0.5 * uCss, fh = (uFlat.zw - uFlat.xy) * 0.5 * uCss;
  float away = uWide > 0.5 ? abs(px.x - fc.x) - fh.x : abs(px.y - fc.y) - fh.y;   // < 0 inside the copy's box
  float A = mix(uFlat0, 1.0, smoothstep(uRampIn, uRampOut, away / uCss.y));

  // this flute: its middle, and u from -1 at one edge to 1 at the other
  float h = uFlute * 0.5, cx = (floor(px.x / uFlute) + 0.5) * uFlute, u = (px.x - cx) / h;
  // where it looks: about (1 + uThick) times as wide in the middle, and far out to the side at the edges
  float bend = u / sqrt(max(1.0 - 0.86 * u * u, 0.1));
  float reach = (px.x - cx) + h * uThick * A * bend;
  float b = uBlur * A * (0.8 + 0.5 * u * u);
  vec3 g = vec3(read(vec2((cx + reach * (1.0 + uDisperse)) / uCss.x, vUv.y), b).r,
                read(vec2((cx + reach) / uCss.x, vUv.y), b).g,
                read(vec2((cx + reach * (1.0 - uDisperse)) / uCss.x, vUv.y), b).b);
  outColor = vec4(toSRGB(shoulder(g)) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  let calm = null;
  const back = field(engine, { cursorMix: 0.32, pull: 0.1, calmSoft: 0.24, ...o.backdrop, calm: () => calm });
  const blur = blurChain(engine, 3);
  const prog = engine.program(FS, undefined, "reeded");
  let backT;
  function size() {
    backT?.dispose();
    backT = engine.target(engine.width, engine.height);
    blur.size(engine.width, engine.height);
  }
  function measure() {
    if (o.copy) { const b = engine.box(o.copy); calm = [b.x0, b.y0, b.x1, b.y1]; }
  }
  size();
  measure();
  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: 6,
    resize() { size(); measure(); },
    down(p) { back.down(p); },
    frame(dt, t) {
      if (engine.frameNo % 30 === 1) measure();
      back.render(backT, dt, t);
      blur.build(backT, 1.5);
      const wide = engine.aspect >= 0.85;
      engine.draw(prog, {
        uBack: backT, uB1: blur.levels[0], uB2: blur.levels[1], uB3: blur.levels[2], uCss: [engine.cssW, engine.cssH],
        uFlat: calm ?? [0.5, 0.5, 0.5, 0.5], uWide: wide ? 1 : 0, uRampIn: o.rampIn ?? -0.1, uRampOut: o.rampOut ?? (wide ? 0.24 : 0.16), uFlat0: o.flat ?? 0.14,
        uFlute: o.flute ?? Math.min(112, Math.max(48, engine.cssW * 0.07)), uThick: o.thickness ?? 1.5,
        uDisperse: o.dispersion ?? 0.08, uBlur: o.blur ?? 1.4, uTime: t, uGrain: o.grain ?? 0.02,
      });
    },
  };
}
