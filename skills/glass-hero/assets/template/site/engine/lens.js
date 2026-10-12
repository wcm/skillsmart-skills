// A soft old lens. The scene is drawn sharp; a blurred copy is built by halving it a few times and growing it back
// (a dual Kawase blur); the composite mixes the two by distance from a focus point, and as the picture goes out of
// focus each wavelength is magnified a little differently about that point, so soft edges split into colour. Then
// halation, a filmic roll-off, a vignette and grain, straight to the screen.
import * as THREE from "three";
import { SPECTRUM, NOISE, QUAD_VERT } from "./glsl.js";

const DOWN = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = texture2D(uTex, vUv).rgb * 4.0 + texture2D(uTex, vUv - o).rgb + texture2D(uTex, vUv + o).rgb
         + texture2D(uTex, vUv + vec2(o.x, -o.y)).rgb + texture2D(uTex, vUv + vec2(-o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;
const UP = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = texture2D(uTex, vUv + vec2(-o.x * 2.0, 0.0)).rgb + texture2D(uTex, vUv + vec2(o.x * 2.0, 0.0)).rgb
         + texture2D(uTex, vUv + vec2(0.0, -o.y * 2.0)).rgb + texture2D(uTex, vUv + vec2(0.0, o.y * 2.0)).rgb
         + (texture2D(uTex, vUv + vec2(-o.x, o.y)).rgb + texture2D(uTex, vUv + vec2(o.x, o.y)).rgb
          + texture2D(uTex, vUv + vec2(o.x, -o.y)).rgb + texture2D(uTex, vUv + vec2(-o.x, -o.y)).rgb) * 2.0;
  gl_FragColor = vec4(c / 12.0, 1.0);
}`;
const OUT = /* glsl */ `
uniform sampler2D uSharp, uBlur;
uniform vec2 uFocus;
uniform float uAspect, uBase, uSoft, uDisperse, uGlow, uGrain, uExposure, uSat, uTime;
varying vec2 vUv;
${SPECTRUM}
${NOISE}
void main() {
  vec2 uv = vUv;
  float defocus = clamp(uBase + uSoft * smoothstep(0.05, 0.42, length((uv - uFocus) * vec2(uAspect, 1.0))), 0.0, 1.0);
  vec3 c = vec3(0.0), w = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float s = float(i) / 6.0;
    vec3 k = spectrum(s);
    vec2 q = uFocus + (uv - uFocus) * (1.0 + (s - 0.5) * uDisperse * (0.25 + defocus));
    c += k * mix(texture2D(uSharp, q).rgb, texture2D(uBlur, q).rgb, defocus);
    w += k;
  }
  c /= w;
  c += texture2D(uBlur, uv).rgb * uGlow; // halation
  c = 1.0 - exp(-c * uExposure);
  c = max(mix(vec3(dot(c, vec3(0.3, 0.55, 0.15))), c, uSat), 0.0);
  c = pow(c, vec3(1.0 / 2.2));
  c *= mix(1.0, smoothstep(1.15, 0.35, length((uv - 0.5) * vec2(uAspect, 1.0)) / max(uAspect, 1.0) * 1.5), 0.6);
  c += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 311.0) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}`;

const rt = (samples = 0) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: samples > 0, samples });

export class Lens {
  constructor(renderer, { levels = 5 } = {}) {
    this.renderer = renderer;
    this.levels = levels;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.sharp = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
    this.down = Array.from({ length: levels }, () => rt());
    this.up = Array.from({ length: levels - 1 }, () => rt());
    const mat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VERT, fragmentShader, depthTest: false, depthWrite: false });
    this.matDown = mat(DOWN, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.matUp = mat(UP, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.u = {
      uSharp: { value: this.sharp.texture }, uBlur: { value: null }, uFocus: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 }, uBase: { value: 0.3 }, uSoft: { value: 0.8 }, uDisperse: { value: 0.03 },
      uGlow: { value: 0.3 }, uGrain: { value: 0.06 }, uExposure: { value: 1.4 }, uSat: { value: 1 }, uTime: { value: 0 },
    };
    this.matOut = mat(OUT, this.u);
  }

  resize(w, h, dpr) {
    let W = Math.round(w * dpr), H = Math.round(h * dpr);
    this.sharp.setSize(W, H);
    this.u.uAspect.value = w / h;
    for (let i = 0; i < this.levels; i++) {
      W = Math.max(1, Math.round(W / 2)); H = Math.max(1, Math.round(H / 2));
      this.down[i].setSize(W, H);
      if (i < this.levels - 1) this.up[i].setSize(W, H);
    }
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.sharp);
    r.render(scene, camera);
    let src = this.sharp;
    for (let i = 0; i < this.levels; i++) {
      this.matDown.uniforms.uTex.value = src.texture;
      this.matDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.matDown, this.down[i]);
      src = this.down[i];
    }
    for (let i = this.levels - 2; i >= 0; i--) {
      this.matUp.uniforms.uTex.value = src.texture;
      this.matUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.matUp, this.up[i]);
      src = this.up[i];
    }
    this.u.uBlur.value = src.texture;
    this.pass(this.matOut, null);
  }

  dispose() {
    [this.sharp, ...this.down, ...this.up].forEach((t) => t.dispose());
    [this.matDown, this.matUp, this.matOut].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
