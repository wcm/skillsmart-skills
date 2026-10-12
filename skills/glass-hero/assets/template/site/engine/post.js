// Post for the two 3D themes: bloom in linear light, tone mapping, then a finishing pass that disperses the whole
// frame a little (each wavelength scaled about the centre by a slightly different amount, more toward the edges),
// darkens the corners and adds grain.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SPECTRUM, NOISE } from "./glsl.js";

const Finish = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uDisperse: { value: 0.012 }, uVignette: { value: 0.6 }, uGrain: { value: 0.035 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uDisperse, uVignette, uGrain;
    varying vec2 vUv;
    ${SPECTRUM}
    ${NOISE}
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 c = vec3(0.0), w = vec3(0.0);
      for (int i = 0; i < 7; i++) {
        float s = float(i) / 6.0;
        vec3 k = spectrum(s);
        c += texture2D(tDiffuse, 0.5 + d * (1.0 + (s - 0.5) * uDisperse * (0.3 + 5.0 * r2))).rgb * k;
        w += k;
      }
      c /= w;
      if (any(isnan(c))) c = vec3(0.0); // never let one bad pixel through
      c *= mix(1.0, smoothstep(0.92, 0.18, sqrt(r2) * 1.15), uVignette);
      c += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 311.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function makePost(renderer, scene, camera, { bloom = [0.8, 0.5, 0.2], disperse = 0.012, vignette = 0.6, grain = 0.035, samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  const bloomPass = bloom ? new UnrealBloomPass(new THREE.Vector2(size.x, size.y), ...bloom) : null; // bloom: null on a light page
  const finish = new ShaderPass(Finish);
  Object.assign(finish.uniforms.uDisperse, { value: disperse });
  Object.assign(finish.uniforms.uVignette, { value: vignette });
  Object.assign(finish.uniforms.uGrain, { value: grain });
  composer.addPass(new RenderPass(scene, camera));
  if (bloomPass) composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.addPass(finish);
  return {
    bloom: bloomPass,
    finish,
    resize(w, h, dpr) { composer.setPixelRatio(dpr); composer.setSize(w, h); },
    render(t) { finish.uniforms.uTime.value = t; composer.render(); },
    dispose() { composer.dispose(); target.dispose(); bloomPass?.dispose(); },
  };
}
