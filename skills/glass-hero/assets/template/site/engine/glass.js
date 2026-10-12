// Glass that refracts what's behind it and splits it by wavelength, for any closed shape.
//
// Before the main render, GlassStage.render() draws the two things the glass looks through:
//   bg   — everything that isn't glass (the backdrop), from the camera;
//   back — the glass's back faces: their view-space normal (rgb) and their distance from the camera (a).
// The glass material then follows each of N wavelengths in through the front face at its own index of refraction,
// across the thickness the two depths give, out through the back face's normal, and on to the backdrop; if the ray
// turns back or leaves the frame it reads the studio cube map instead. Reflections come from the same studio.
// Glass meshes live on GLASS_LAYER, everything else on layer 0; the camera needs both.
import * as THREE from "three";
import { SPECTRUM } from "./glsl.js";

export const GLASS_LAYER = 1;

const BACK_VERT = /* glsl */ `
varying vec3 vVN;
varying float vDepth;
void main() {
#ifdef USE_INSTANCING
  mat4 m = modelMatrix * instanceMatrix;
#else
  mat4 m = modelMatrix;
#endif
  vec4 mv = viewMatrix * m * vec4(position, 1.0);
  vVN = normalize(mat3(viewMatrix) * mat3(m) * normal);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const BACK_FRAG = /* glsl */ `
varying vec3 vVN;
varying float vDepth;
void main() { gl_FragColor = vec4(normalize(vVN), vDepth); }`;

export class GlassStage {
  constructor(renderer, { bgScale = 0.75, backScale = 0.75 } = {}) {
    this.renderer = renderer;
    this.bgScale = bgScale;
    this.backScale = backScale;
    this.size = new THREE.Vector2(1, 1); // the main render target's size in pixels; the glass reads gl_FragCoord against it
    this.bg = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.back = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.backMat = new THREE.ShaderMaterial({ vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, side: THREE.BackSide });
    this.clear = new THREE.Color();
  }

  resize(w, h, dpr) {
    const W = w * dpr, H = h * dpr;
    this.size.set(W, H);
    this.bg.setSize(Math.max(1, Math.round(W * this.bgScale)), Math.max(1, Math.round(H * this.bgScale)));
    this.back.setSize(Math.max(1, Math.round(W * this.backScale)), Math.max(1, Math.round(H * this.backScale)));
  }

  render(scene, camera) {
    const r = this.renderer, mask = camera.layers.mask, background = scene.background;
    const target = r.getRenderTarget(), alpha = r.getClearAlpha();
    r.getClearColor(this.clear);
    camera.layers.disable(GLASS_LAYER);
    r.setRenderTarget(this.bg);
    r.clear();
    r.render(scene, camera);
    camera.layers.set(GLASS_LAYER);
    scene.overrideMaterial = this.backMat;
    scene.background = null;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.back);
    r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = background;
    camera.layers.mask = mask;
    r.setClearColor(this.clear, alpha);
    r.setRenderTarget(target);
  }

  dispose() {
    this.bg.dispose();
    this.back.dispose();
    this.backMat.dispose();
  }
}

const GLASS_VERT = /* glsl */ `
#ifdef GLASS_TANGENT
attribute vec4 tangent;
varying vec3 vVT;
#endif
varying vec3 vVN, vVP;
varying vec2 vUv;
void main() {
#ifdef USE_INSTANCING
  mat4 m = modelMatrix * instanceMatrix;
#else
  mat4 m = modelMatrix;
#endif
  vec4 mv = viewMatrix * m * vec4(position, 1.0);
  mat3 nm = mat3(viewMatrix) * mat3(m);
  vVP = mv.xyz;
  vVN = normalize(nm * normal);
#ifdef GLASS_TANGENT
  vVT = normalize(nm * tangent.xyz);
#endif
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;

// hooks: GLSL spliced in — head (declarations), normal (may bend N, view space), shade (may change `color`; R, N, V,
// ndv, thick are in scope).
export function glassMaterial(gs, env, { ior = 1.5, spread = 0.3, samples = 8, depth = 3, absorb = [0, 0, 0], reflect = 1, through = 0.2, saturation = 1, tangents = false, hooks = {}, uniforms = {} } = {}) {
  const fragmentShader = /* glsl */ `
uniform sampler2D uBg, uBack;
uniform samplerCube uEnv;
uniform vec2 uRes;
uniform mat4 projectionMatrix;
uniform float uIor, uSpread, uDepth, uReflect, uThrough, uSat, uTime;
uniform vec3 uAbsorb;
${tangents ? "varying vec3 vVT;" : ""}
varying vec3 vVN, vVP;
varying vec2 vUv;
${SPECTRUM}
${hooks.head ?? ""}
vec2 toScreen(vec3 p) { vec4 c = projectionMatrix * vec4(p, 1.0); return c.xy / c.w * 0.5 + 0.5; }
vec3 toWorld(vec3 d) { return normalize((vec4(d, 0.0) * viewMatrix).xyz); }
void main() {
  vec3 N = normalize(vVN);
  vec3 V = normalize(-vVP);
  ${hooks.normal ?? ""}
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec4 b0 = texture2D(uBack, gl_FragCoord.xy / uRes);
  float thick = b0.a > 0.0 ? max(b0.a + vVP.z, 0.02) : 0.25;
  vec3 col = vec3(0.0), wsum = vec3(0.0);
  for (int i = 0; i < ${samples}; i++) {
    float s = (float(i) + 0.5) / ${samples}.0;
    vec3 k = spectrum(s);
    float ior = uIor + uSpread * (0.5 - s); // violet bends most
    vec3 T = refract(-V, N, 1.0 / ior);
    vec3 Pe = vVP + T * thick; // where this wavelength meets the back of the glass
    vec4 b = texture2D(uBack, toScreen(Pe));
    vec3 Nb = b.a > 0.0 ? normalize(b.xyz) : -N;
    vec3 T2 = refract(T, -Nb, ior);
    if (dot(T2, T2) < 1e-4) T2 = reflect(T, -Nb); // total internal reflection
    vec3 c = textureCube(uEnv, toWorld(T2)).rgb;
    vec2 uv2 = toScreen(Pe + T2 * uDepth);
    float seen = step(T2.z, 0.0) * step(0.0, uv2.x) * step(uv2.x, 1.0) * step(0.0, uv2.y) * step(uv2.y, 1.0);
    c = mix(c, texture2D(uBg, uv2).rgb + c * uThrough, seen);
    col += k * c;
    wsum += k;
  }
  col = col / wsum * exp(-uAbsorb * thick);
  vec3 R = toWorld(reflect(-V, N));
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 color = col * (1.0 - F) + textureCube(uEnv, R).rgb * uReflect * F;
  ${hooks.shade ?? ""}
  color = max(mix(vec3(dot(color, vec3(0.3, 0.55, 0.15))), color, uSat), 0.0);
  if (any(isnan(color))) color = vec3(0.0);
  gl_FragColor = vec4(color, 1.0);
}`;
  return new THREE.ShaderMaterial({
    uniforms: {
      uBg: { value: gs.bg.texture }, uBack: { value: gs.back.texture }, uRes: { value: gs.size }, uEnv: { value: env.texture },
      uIor: { value: ior }, uSpread: { value: spread }, uDepth: { value: depth }, uReflect: { value: reflect }, uThrough: { value: through }, uSat: { value: saturation },
      uTime: { value: 0 }, uAbsorb: { value: new THREE.Vector3(...absorb) }, ...uniforms,
    },
    vertexShader: GLASS_VERT,
    fragmentShader,
    defines: tangents ? { GLASS_TANGENT: "" } : {},
  });
}

// A studio baked once into a cube map: `glsl` defines vec3 env(vec3 d) for a world direction d.
const BAKE_VERT = /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export function bakeEnv(renderer, glsl, { size = 256, uniforms = {} } = {}) {
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const scene = new THREE.Scene(), geo = new THREE.SphereGeometry(5, 64, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: BAKE_VERT,
    fragmentShader: `${glsl}\nvarying vec3 vDir;\nvoid main() { gl_FragColor = vec4(env(normalize(vDir)), 1.0); }`,
    side: THREE.BackSide, depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(geo, mat));
  new THREE.CubeCamera(0.1, 20, target).update(renderer, scene);
  geo.dispose();
  mat.dispose();
  return target;
}

// A full-screen backdrop drawn at the far plane (layer 0), so the glass has something to refract. `fragmentShader`
// gets vUv (0…1 across the screen).
export function backdrop(fragmentShader, uniforms = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, fragmentShader, depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

// The same strip-light helper every studio uses: a thin line of light along `axis` through direction `center`.
export const STRIP = /* glsl */ `
float strip(vec3 d, vec3 center, vec3 axis, float width, float halfLen) {
  center = normalize(center); axis = normalize(axis);
  vec3 side = normalize(cross(axis, center));
  return smoothstep(width, width * 0.25, abs(dot(d, side))) * smoothstep(halfLen, halfLen * 0.6, abs(dot(d, axis))) * step(0.2, dot(d, center));
}
`;
