// Shared GLSL. Everything in Prisme is white light split into its spectrum, so the spectrum lives here once.

// Zucconi's six-bump fit of the visible spectrum. s = 0 is violet (400 nm), s = 1 is red (700 nm).
export const SPECTRUM = /* glsl */ `
vec3 bump3(vec3 x, vec3 y0) { vec3 y = 1.0 - x * x; return clamp(y - y0, 0.0, 1.0); }
vec3 spectrum(float s) {
  float x = clamp(s, 0.0, 1.0);
  return bump3(vec3(3.54585104, 2.93225262, 2.41593945) * (x - vec3(0.69549072, 0.49228336, 0.27699880)), vec3(0.02312639, 0.15225084, 0.52607955))
       + bump3(vec3(3.90307140, 3.21182957, 3.96587128) * (x - vec3(0.11748627, 0.86755042, 0.66077860)), vec3(0.84897130, 0.88445281, 0.73949448));
}
`;

// The same spectrum on the CPU, for baking lookup tables and weights. Returns [r, g, b].
export function spectrumRGB(s) {
  const x = Math.min(1, Math.max(0, s));
  const bump = (c, x0, y0) => { const t = c * (x - x0); return Math.min(1, Math.max(0, 1 - t * t - y0)); };
  const C1 = [3.54585104, 2.93225262, 2.41593945], X1 = [0.69549072, 0.49228336, 0.2769988], Y1 = [0.02312639, 0.15225084, 0.52607955];
  const C2 = [3.9030714, 3.21182957, 3.96587128], X2 = [0.11748627, 0.86755042, 0.6607786], Y2 = [0.8489713, 0.88445281, 0.73949448];
  return [0, 1, 2].map((i) => bump(C1[i], X1[i], Y1[i]) + bump(C2[i], X2[i], Y2[i]));
}

export const NOISE = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

// A full-screen triangle pair: PlaneGeometry(2, 2) drawn straight to clip space.
export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
