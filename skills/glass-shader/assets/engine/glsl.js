// GLSL shared by the looks: the fragment header, hashes, gradient noise, colour (linear/sRGB, OKLab) and grain.

export const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`;

// Hashes without sine (Dave Hoskins, MIT): stable across GPUs, unlike fract(sin(x) * big).
export const HASH = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
`;

// Gradient noise with a quintic fade, 2D and 3D, roughly in −0.7…0.7, plus fbm built on it.
export const NOISE = HASH + /* glsl */ `
vec2 grad2(vec2 i) { float a = hash12(i) * 6.2831853; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad2(i), f), b = dot(grad2(i + vec2(1, 0)), f - vec2(1, 0));
  float c = dot(grad2(i + vec2(0, 1)), f - vec2(0, 1)), d = dot(grad2(i + vec2(1, 1)), f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 grad3(vec3 i) { return normalize(hash33(i) * 2.0 - 1.0 + 1e-4); }
float gnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad3(i), f), n100 = dot(grad3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(grad3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), n110 = dot(grad3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(grad3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), n101 = dot(grad3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(grad3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), n111 = dot(grad3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = ROT * p + 17.1; a *= 0.5; } return s; }
float fbm3(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = ROT * p + 17.1; a *= 0.5; } return s; }
float fbmv(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * gnoise3(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

export const COLOR = /* glsl */ `
vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
// OKLab (Björn Ottosson): mixing here keeps the midpoints of a gradient bright instead of muddy.
vec3 oklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 fromOklab(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 mixOk(vec3 a, vec3 b, float t) { return fromOklab(mix(oklab(a), oklab(b), t)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// a soft shoulder: linear up to about 0.8, then rolls off toward 1 instead of clipping
vec3 shoulder(vec3 c) { vec3 h = max(c - 0.8, 0.0); return min(c, 0.8) + 0.2 * (1.0 - exp(-h / 0.2)); }
// film grain in sRGB, triangular distribution, a new pattern every frame
vec3 grain(vec2 fc, float t, float amount) {
  float f = fract(t * 7.13) * 97.0;
  float n = hash12(fc + f) + hash12(fc * 1.31 + f * 1.7) - 1.0;
  vec3 c = vec3(hash12(fc + f + 3.1), hash12(fc + f + 5.7), hash12(fc + f + 9.3)) - 0.5;
  return (vec3(n) + c * 0.6) * amount;
}
`;
