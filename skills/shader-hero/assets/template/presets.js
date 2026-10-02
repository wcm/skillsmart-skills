// Shader Hero presets. Each preset is the body of a fragment shader; COMMON is prepended.
// Uniforms available to every preset:
//   u_res (px), u_time (s, already multiplied by speed), u_mouse (0..1, smoothed),
//   u_scroll (0..1 over the hero height), u_click (s since last click),
//   u_c1 u_c2 u_c3 (brand colours, c1 is the darkest/background), u_intensity (0..2)

export const COMMON = /* glsl */ `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_scroll;
uniform float u_click;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_intensity;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.0 + 0.17; a *= 0.5; }
  return v;
}
vec2 uv0() { return gl_FragCoord.xy / u_res; }
vec2 uvAspect() { vec2 uv = gl_FragCoord.xy / u_res; uv.x *= u_res.x / u_res.y; return uv; }
vec2 mouseAspect() { return vec2(u_mouse.x * u_res.x / u_res.y, u_mouse.y); }
vec3 grade(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(0.95)); }
float vignette(vec2 uv) { uv = uv * 2.0 - 1.0; return 1.0 - 0.35 * dot(uv * vec2(0.8, 1.0), uv * vec2(0.8, 1.0)); }
float ripple() { return exp(-u_click * 2.5) * step(0.0, u_click); }
`;

export const PRESETS = {
  // Soft northern-lights curtains that bend toward the cursor.
  aurora: /* glsl */ `
void main() {
  vec2 uv = uvAspect();
  vec2 m = mouseAspect();
  float t = u_time * 0.12;
  vec3 col = u_c1;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.55 + 0.12 * fi + 0.18 * (fbm(vec2(uv.x * 1.3 + t * (1.0 + fi * 0.4), fi * 3.1)) - 0.5);
    y += 0.12 * (m.y - 0.5) * exp(-abs(uv.x - m.x) * 1.5);
    float dy = (uv.y - y) * (7.0 - fi);
    float band = exp(-dy * dy);
    float streaks = 0.6 + 0.4 * fbm(vec2(uv.x * 9.0 + t * 3.0, fi));
    vec3 c = mix(u_c2, u_c3, fi / 2.0 + 0.25 * sin(t * 2.0 + uv.x * 2.0));
    col += c * band * streaks * (0.55 + 0.25 * u_intensity);
  }
  col += u_c3 * 0.25 * ripple() * exp(-length(uv - m) * 4.0);
  col *= vignette(uv0());
  gl_FragColor = vec4(grade(col), 1.0);
}`,

  // Molten, reflective metal that ripples around the cursor.
  "liquid-chrome": /* glsl */ `
void main() {
  vec2 uv = uvAspect();
  vec2 m = mouseAspect();
  float t = u_time * 0.15;
  float d = length(uv - m);
  vec2 p = uv * 2.2;
  p += 0.25 * u_intensity * vec2(sin(d * 18.0 - u_time * 2.0), cos(d * 18.0 - u_time * 2.0)) * exp(-d * 3.0);
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 3.5 * r);
  float bands = 0.5 + 0.5 * cos(6.2831 * (f * 2.2 + 0.1 * r.x));
  vec3 col = mix(u_c1, u_c2, bands);
  col = mix(col, u_c3, smoothstep(0.55, 0.95, f) * 0.8);
  float spec = pow(smoothstep(0.6, 1.0, bands), 8.0);
  col += vec3(1.0) * spec * 0.6 * u_intensity;
  col *= vignette(uv0());
  gl_FragColor = vec4(grade(col), 1.0);
}`,

  // Ink blooming in water; the cursor stirs it and clicks drop new ink.
  ink: /* glsl */ `
void main() {
  vec2 uv = uvAspect();
  vec2 m = mouseAspect();
  float t = u_time * 0.08;
  vec2 to = uv - m;
  float swirl = exp(-length(to) * 2.5) * 1.2 * u_intensity;
  float a = swirl * sin(u_time * 0.5);
  uv = m + mat2(cos(a), -sin(a), sin(a), cos(a)) * to;
  vec2 q = vec2(fbm(uv * 1.5 + t), fbm(uv * 1.5 - t + 4.0));
  float f = fbm(uv * 2.0 + 2.5 * q + vec2(t * 2.0, 0.0));
  float ink = smoothstep(0.35, 0.75, f);
  float drop = ripple() * smoothstep(0.35, 0.0, length(uv - m) - (1.0 - exp(-u_click * 2.0)) * 0.3);
  vec3 col = mix(u_c1, u_c2, ink);
  col = mix(col, u_c3, smoothstep(0.62, 0.9, f) * 0.85 + drop * 0.6);
  col *= vignette(uv0());
  gl_FragColor = vec4(grade(col), 1.0);
}`,

  // A field of glowing particles that drift and gather around the cursor.
  particles: /* glsl */ `
void main() {
  vec2 uv = uvAspect();
  vec2 m = mouseAspect();
  vec3 col = u_c1 * (0.85 + 0.3 * fbm(uv * 2.0 + u_time * 0.05));
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float scale = 14.0 + fl * 10.0;
    vec2 p = uv * scale + vec2(0.0, u_time * (0.2 + fl * 0.15));
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = hash(cell + fl * 17.0);
    vec2 jitter = vec2(hash(cell + 1.3), hash(cell + 7.1)) - 0.5;
    vec2 world = (cell + 0.5 + jitter * 0.8) / scale - vec2(0.0, u_time * (0.2 + fl * 0.15) / scale);
    vec2 pull = (m - world) * 0.35 * u_intensity * exp(-length(m - world) * 3.0);
    vec2 pos = jitter * 0.8 + pull * scale;
    float d = length(f - pos);
    float twinkle = 0.5 + 0.5 * sin(u_time * (1.0 + h * 3.0) + h * 6.28);
    float glow = (0.012 + 0.02 * h) / (d * d + 0.0015) * 0.06 * twinkle * (0.6 + 0.4 * u_intensity);
    col += mix(u_c2, u_c3, h) * glow * (1.0 - fl * 0.25);
  }
  col += u_c3 * 0.15 * exp(-length(uv - m) * 6.0);
  col *= vignette(uv0());
  gl_FragColor = vec4(grade(col), 1.0);
}`,

  // A frosted-glass lens that follows the cursor and refracts the gradient behind it.
  glass: /* glsl */ `
vec3 backdrop(vec2 uv) {
  float t = u_time * 0.1;
  float f = fbm(uv * 1.4 + vec2(t, -t * 0.7));
  vec3 c = mix(u_c1, u_c2, smoothstep(0.2, 0.8, uv.y + 0.3 * f));
  c = mix(c, u_c3, smoothstep(0.55, 0.85, f));
  float stripes = smoothstep(0.48, 0.5, fract(uv.x * 6.0 + f * 0.6)) * 0.08;
  return c + stripes;
}
void main() {
  vec2 uv = uvAspect();
  vec2 m = mouseAspect();
  vec2 d = uv - m;
  float r = 0.28 + 0.03 * sin(u_time) + 0.08 * ripple();
  float lens = smoothstep(r, r - 0.01, length(d));
  float bulge = sqrt(max(0.0, 1.0 - dot(d, d) / (r * r)));
  vec2 refr = d * (1.0 - bulge) * 0.6 * u_intensity;
  vec3 col = backdrop(uv);
  vec3 glassCol = vec3(
    backdrop(uv - refr * 1.04).r,
    backdrop(uv - refr).g,
    backdrop(uv - refr * 0.96).b);
  glassCol += 0.06 + 0.25 * pow(1.0 - bulge, 3.0);
  col = mix(col, glassCol, lens);
  col += vec3(1.0) * 0.35 * smoothstep(0.004, 0.0, abs(length(d) - r)) ;
  col *= vignette(uv0());
  gl_FragColor = vec4(grade(col), 1.0);
}`,

  // Sculpted sand dunes with moving light; the cursor moves the sun.
  dunes: /* glsl */ `
float height(vec2 p) {
  return fbm(p * vec2(1.0, 2.5) + vec2(u_time * 0.03, 0.0)) + 0.25 * sin(p.x * 3.0 + p.y * 1.5);
}
void main() {
  vec2 uv = uvAspect();
  vec2 p = uv * 3.0;
  float e = 0.01;
  float h = height(p);
  vec3 n = normalize(vec3(height(p - vec2(e, 0.0)) - height(p + vec2(e, 0.0)), height(p - vec2(0.0, e)) - height(p + vec2(0.0, e)), 0.04));
  vec3 light = normalize(vec3((u_mouse.x - 0.5) * 2.0, (u_mouse.y - 0.5) * 2.0, 0.6));
  float diff = clamp(dot(n, light), 0.0, 1.0);
  float ridges = smoothstep(0.02, 0.0, abs(fract(h * 6.0) - 0.5) - 0.48) * 0.15;
  vec3 col = mix(u_c1, u_c2, diff * u_intensity);
  col = mix(col, u_c3, pow(diff, 6.0) * 0.8);
  col += ridges * u_c3;
  col *= vignette(uv0());
  gl_FragColor = vec4(grade(col), 1.0);
}`,

  // Bold, retro plasma with smooth colour cycling.
  plasma: /* glsl */ `
void main() {
  vec2 uv = uvAspect() * 3.0;
  vec2 m = mouseAspect() * 3.0;
  float t = u_time * 0.6;
  float v = sin(uv.x + t) + sin((uv.y + t) * 0.7) + sin((uv.x + uv.y + t) * 0.6);
  v += sin(length(uv - m) * 3.0 - t * 2.0) * 1.2 * u_intensity;
  v += sin(sqrt(dot(uv, uv) + 1.0) + t);
  float s = 0.5 + 0.5 * sin(v * 1.6);
  float s2 = 0.5 + 0.5 * cos(v * 1.1 + 1.7);
  vec3 col = mix(u_c1, u_c2, s);
  col = mix(col, u_c3, s2 * 0.7);
  col *= vignette(uvAspect() / vec2(u_res.x / u_res.y, 1.0));
  gl_FragColor = vec4(grade(col), 1.0);
}`,
};

// Suggested palettes per preset: [background, main, highlight]. Swap for brand colours.
export const PALETTES = {
  aurora: ["#060913", "#3ee6b5", "#7c5cff"],
  "liquid-chrome": ["#0d0f14", "#9aa4b2", "#f2f5f9"],
  ink: ["#f3efe6", "#18233a", "#d9482b"],
  particles: ["#05060a", "#5eead4", "#f0abfc"],
  glass: ["#120c2c", "#ff6a3d", "#ffd23f"],
  dunes: ["#2a1608", "#e8a35c", "#fff1d6"],
  plasma: ["#14001f", "#ff2e88", "#2ef2ff"],
};
