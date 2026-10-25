// One picture card: a thin slab with a front, a back and an edge, which the vertex shader sizes and bends.
//   Bends: flat; round a cylinder (k with the pivot in the middle); over a sphere (uSphere: curved both ways, like a tile
//   on a ball); along a wheel's rim (uRing: in its own plane; it combines with the others); like a page turning about its
//   spine (pivot on one edge, theta = how far it has turned, k = how much it curls, twist = how far the top corner leads);
//   and hanging cloth (uCloth: offsets from a small simulated sheet, uClothMap). The normal is measured off the bent
//   surface, so folds and curls light correctly.
//   Thickness (uThick) gives every card two faces and an edge round its rounded outline: paper shows a hairline of white,
//   a record sleeve a band of card, acrylic a lit glass rim.
//   The picture is cover-fitted to the card's shape; uSub picks a part of it (a cube sticker shows a ninth of its face, a
//   tile a twentieth of the grid), and the back can show another picture and another part (a tile turning over), or paper.
//   Materials (uMat): 0 photo paper (a fine grain), 1 silk (a weave and a long satin highlight along the folds),
//   2 acrylic (a clear glossy coat and a glowing rim), 3 glazed tile (a rounded bevel and a wet glaze).
//   Every material reflects the same studio (a soft box overhead to the left, a tall strip to the right), by uGloss.
// reflectMaterial() draws the same card mirrored in a floor (y = uFloor), fading with height, softer. uClip hides what is
// below a height; uBlur softens one card on its own (a shallow focus).
// discMaterial() is a record slid part way out of its sleeve.
import * as THREE from "three";

const SX = 28, SY = 14, ARC = 6;
// the faces: two grids (the back wound the other way); the edge: a strip round the rounded outline, front rim to back
// rim. An outline point is (kind: 0 a side, 1 a corner; which: 0–3 from the right side round anticlockwise; t along it)
function buildGeometry() {
  const pos = [], uv = [], part = [], edge = [], index = [];
  for (const p of [0, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) { pos.push(i / SX - 0.5, j / SY - 0.5, 0); uv.push(i / SX, j / SY); part.push(p); edge.push(0, 0, 0, 0); }
    for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) {
      const a = base + j * (SX + 1) + i, b = a + 1, c = a + SX + 1, d = c + 1;
      if (p === 0) index.push(a, b, d, a, d, c); else index.push(a, d, b, a, c, d);
    }
  }
  const ring = [];
  [SY, SX, SY, SX].forEach((n, k) => {
    for (let i = 0; i < n; i++) ring.push([0, k, i / n]);                  // a side
    for (let i = 0; i < ARC; i++) ring.push([1, k, i / ARC]);              // then the corner after it
  });
  const base = pos.length / 3;
  for (const [kind, k, t] of ring) for (const rim of [1, -1]) { pos.push(0, 0, 0); uv.push(0, 0); part.push(2); edge.push(kind, k, t, rim); }
  for (let i = 0; i < ring.length; i++) {
    const a = base + 2 * i, b = base + 2 * ((i + 1) % ring.length);       // a: the front rim, a + 1: the back rim
    index.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 4));
  g.setIndex(index);
  return g;
}
export const cardGeometry = buildGeometry();

const vertexShader = /* glsl */ `
attribute float aPart;
attribute vec4 aEdge;
uniform vec2 uSize;
uniform float uPivot, uSide, uTheta, uK, uTwist, uLift, uSphere, uRing, uThick, uRadius, uCloth;
uniform sampler2D uClothMap;
#ifdef REFLECT
uniform float uFloor;
varying float vAbove;
#endif
varying vec2 vUv;
varying float vPart;
varying vec3 vWN;
varying vec3 vWT;
varying vec3 vWP;
varying float vS;
varying float vDepth;
varying float vY;
vec3 nOut;
// the card's surface at q (0–1 across and up), bent; its own normal there in nOut
vec3 surf(vec2 q) {
  float x = (q.x - uPivot) * uSize.x, y = (q.y - 0.5) * uSize.y, dz = 0.0;
  if (uCloth > 0.0) { vec3 d = texture2D(uClothMap, clamp(q, 0.0, 1.0)).xyz * uCloth; x += d.x; y += d.y; dz = d.z; }
  if (uRing > 1e-4) {
    // along a wheel's rim: the card bends in its own plane round a centre 1/uRing below it
    float R = 1.0 / uRing, a = x * uRing, r = R + y;
    x = r * sin(a); y = r * cos(a) - R;
  }
  vec3 p, n;
  if (uSphere > 0.5 && abs(uK) > 1e-4) {
    // on a sphere of radius 1/k: curved both ways (k < 0: the inside of a sphere)
    float ax = x * uK, ay = y * uK;
    n = vec3(sin(ax) * cos(ay), sin(ay), cos(ax) * cos(ay));
    p = (n - vec3(0.0, 0.0, 1.0)) / uK;
  } else {
    float s = uSide * x;                                     // distance from the pivot edge, along the card
    float a0 = uTheta + uTwist * (q.y - 0.5);
    float a = a0 - uK * s;                                   // the card's direction at s: a circular arc of curvature k
    float X, Z;
    if (abs(uK) < 1e-4) { X = s * cos(a0); Z = s * sin(a0); }
    else { X = (sin(a0) - sin(a)) / uK; Z = (cos(a) - cos(a0)) / uK; }
    n = vec3(-uSide * sin(a), 0.0, cos(a));
    p = vec3(uSide * X, y, Z);
  }
  nOut = n;
  return p + n * (uLift + dz);
}
// a point on the rounded outline, and the way out from it, in the flat card
vec2 outline(vec4 e, out vec2 dir) {
  float hw = uSize.x * 0.5, hh = uSize.y * 0.5, r = min(max(uRadius, 0.0), min(hw, hh));
  int k = int(e.y + 0.5);
  if (e.x < 0.5) {
    if (k == 0) { dir = vec2(1.0, 0.0); return vec2(hw, mix(-hh + r, hh - r, e.z)); }
    if (k == 1) { dir = vec2(0.0, 1.0); return vec2(mix(hw - r, -hw + r, e.z), hh); }
    if (k == 2) { dir = vec2(-1.0, 0.0); return vec2(-hw, mix(hh - r, -hh + r, e.z)); }
    dir = vec2(0.0, -1.0); return vec2(mix(-hw + r, hw - r, e.z), -hh);
  }
  float a = (float(k) + e.z) * 1.5707963;
  vec2 c = vec2((k == 0 || k == 3) ? hw - r : -hw + r, k < 2 ? hh - r : -hh + r);
  dir = vec2(cos(a), sin(a));
  return c + r * dir;
}
void main() {
  vec2 q = uv, dir = vec2(0.0);
  float rim = 0.0;
  if (aPart > 1.5) { vec2 o = outline(aEdge, dir); q = o / max(uSize, vec2(1e-5)) + 0.5; rim = aEdge.w; }
  vec3 P = surf(q), N0 = nOut;
  float ex = 0.5 / ${SX}.0, ey = 0.5 / ${SY}.0;
  vec3 tx = surf(q + vec2(ex, 0.0)) - surf(q - vec2(ex, 0.0));
  vec3 ty = surf(q + vec2(0.0, ey)) - surf(q - vec2(0.0, ey));
  vec3 N = cross(tx, ty);
  N = dot(N, N) > 1e-14 ? normalize(N) : N0;
  if (dot(N, N0) < 0.0) N = -N;
  vec3 T = dot(tx, tx) > 1e-14 ? normalize(tx) : vec3(1.0, 0.0, 0.0);
  float hk = max(uThick, 0.002) * 0.5;
  vec3 p, nl;
  if (aPart < 0.5) { p = P + N * hk; nl = N; }
  else if (aPart < 1.5) { p = P - N * hk; nl = -N; }
  else { p = P + N * hk * rim; vec3 B = dot(ty, ty) > 1e-14 ? normalize(ty) : vec3(0.0, 1.0, 0.0); nl = normalize(dir.x * T + dir.y * B); }
  vUv = q; vPart = aPart;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * nl);
  vWT = normalize(mat3(modelMatrix) * T);
  vY = wp.y;
#ifdef REFLECT
  vAbove = wp.y - uFloor;
  wp.y = 2.0 * uFloor - wp.y;
  wn.y = -wn.y;
#endif
  vWP = wp.xyz; vWN = wn;
  vS = uSide * (q.x - uPivot) * uSize.x;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap, uMapB;
uniform vec2 uSize, uShadow;
uniform vec4 uSub, uSubB, uFrame;
uniform float uImgAspect, uImgAspectB, uFace, uFaceB, uBackImage, uRadius, uDim, uGlow, uShade, uSheen, uSheenPow;
uniform float uFog, uFogNear, uFogFar, uGutter, uDeckle, uFrameA, uFocus, uDof, uClip, uBlur;
uniform float uMat, uGloss, uGrain, uEdgeTint, uThick;
uniform vec3 uBack, uBg, uFogColor, uEdge;
#ifdef REFLECT
uniform float uRefl, uReflFade;
varying float vAbove;
#endif
varying vec2 vUv;
varying float vPart;
varying vec3 vWN;
varying vec3 vWT;
varying vec3 vWP;
varying float vS;
varying float vDepth;
varying float vY;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// a picture, softened by bias (focus): beyond a little blur, four more taps round the point hide the mip blocks
vec3 pic(sampler2D m, vec2 q, float bias) {
  vec3 c = texture2D(m, q, bias).rgb;
  if (bias < 1.2) return c;
  float r = 0.0016 * exp2(min(bias, 6.0));
  c += texture2D(m, q + vec2(r, 0.0), bias).rgb + texture2D(m, q - vec2(r, 0.0), bias).rgb
     + texture2D(m, q + vec2(0.0, r), bias).rgb + texture2D(m, q - vec2(0.0, r), bias).rgb;
  return c / 5.0;
}
vec2 fit(vec2 q, float ca, float ia) {
  if (ca > ia) q.y = (q.y - 0.5) * (ia / ca) + 0.5; else q.x = (q.x - 0.5) * (ca / ia) + 0.5;
  return q;
}
// the studio every card reflects: a soft box overhead to the left, a tall strip light to the right, a dim sky
vec3 studio(vec3 r) {
  float az = atan(r.x, r.z), el = asin(clamp(r.y, -1.0, 1.0));
  float box = exp(-(pow((az + 0.55) / 0.42, 2.0) + pow((el - 0.62) / 0.3, 2.0)));
  float strip = exp(-pow((az - 0.95) / 0.1, 2.0)) * smoothstep(-0.45, -0.15, el) * smoothstep(0.95, 0.55, el);
  float sky = smoothstep(-0.2, 1.0, r.y) * 0.22;
  return vec3(box * 1.5 + strip * 1.25 + sky + 0.035);
}
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  vec2 q = abs(p) - (uSize * 0.5 - uRadius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  if (uDeckle > 0.0) d += (noise(p * 22.0) * 0.7 + noise(p * 61.0) * 0.3 - 0.35) * 0.05 * uDeckle;   // rough paper edges
  float aa = max(fwidth(d), 1e-4);
  bool edge = vPart > 1.5, front = vPart < 0.5;
  float alpha = edge ? 1.0 : 1.0 - smoothstep(-aa, aa, d);
  float dof = clamp((abs(vDepth - uFocus) - 1.5) * uDof, 0.0, 4.0);   // soft away from the distance in focus
#ifdef REFLECT
  if (vAbove < 0.0) discard;
  float bias = 2.5 + dof + uBlur;
#else
  float bias = dof + uBlur;
#endif
  if (alpha <= 0.0 || vY < uClip) discard;

  vec2 sub = uSub.xy + vUv * uSub.zw;
  float own = uSize.x / max(uSize.y, 1e-4), ca = uFace > 0.0 ? uFace : own, caB = uFaceB > 0.0 ? uFaceB : own;
  // the back is seen mirrored, so it reads its part of the picture from the other side
  vec2 subB = uSubB.xy + vec2(1.0 - vUv.x, vUv.y) * uSubB.zw;
  vec3 col;
  if (edge) {
    // the edge: paper, card or a glowing glass rim, tinted by the picture where it meets it
    vec3 pc = pic(uMap, fit(sub, ca, uImgAspect), 3.0);
    col = mix(uEdge, pc, uEdgeTint);
    if (uMat > 1.5 && uMat < 2.5) col = mix(pc, vec3(1.0), 0.5) * 1.25;
  }
  else if (front) col = pic(uMap, fit(sub, ca, uImgAspect), bias);
  else if (uBackImage > 0.5) col = pic(uMapB, fit(subB, caB, uImgAspectB), bias);
  else col = uBack;
  bool picture = !edge && (front || uBackImage > 0.5);
  if (picture && uFrameA > 0.0) col = mix(col, uFrame.yzw, uFrameA * smoothstep(-uFrame.x - aa, -uFrame.x + aa, d));

  vec3 n = normalize(vWN), V = normalize(cameraPosition - vWP);
#ifdef REFLECT
  n = -n;
#endif
  vec3 L = normalize(vec3(-0.35, 0.55, 1.0));
  float nl = max(dot(n, L), 0.0), nv = clamp(dot(n, V), 0.0, 1.0);
  // the surface's own texture: paper grain, the weave of silk, a glazed tile's bevel
  vec2 cm = p * 60.0;
  if (!edge) {
    if (uMat < 0.5) col *= 1.0 + (noise(cm) * 0.65 + noise(cm * 2.7) * 0.35 - 0.5) * 0.07 * uGrain;
    else if (uMat < 1.5) {
      float f = 1.0 - smoothstep(0.15, 0.6, max(fwidth(cm.x), fwidth(cm.y)) * 3.0);
      col *= 1.0 + 0.05 * f * (sin(cm.x * 3.1) * sin(cm.y * 3.1));
    } else if (uMat > 2.5) {
      // the bevel: its slope faces out from the middle, lit from the upper left
      float bev = 1.0 - smoothstep(0.0, min(uSize.x, uSize.y) * 0.08, -d);
      vec2 g = (q.x > 0.0 && q.y > 0.0) ? normalize(q) * sign(p) : (q.x > q.y ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y)));
      float lit = dot(g, normalize(vec2(-0.6, 0.8)));
      col *= 1.0 - 0.2 * bev * (0.5 - 0.5 * lit);
      col += 0.22 * bev * max(lit, 0.0);
    }
  }
  float light = mix(1.0, 0.6 + 0.48 * nl, uShade);
  light *= mix(1.0, 0.8 + 0.2 * smoothstep(0.0, 0.7, vS), uGutter);
  light *= 1.0 - uShadow.y * (1.0 - smoothstep(uShadow.x - 0.8, uShadow.x + 0.15, vS));
  if (edge) light *= 0.82 + 0.3 * nl;
  col *= light;
  // highlights, laid over the surface like a clear coat: two soft lights (sheen), the studio in the surface (gloss),
  // and on silk a long highlight along the folds. Mixed toward white rather than added, so a pale picture never burns
  // out; only a strong glint goes past white, and only that blooms.
  vec3 H = normalize(L + V);
  float hl = uSheen * pow(max(dot(n, H), 0.0), uSheenPow);
  hl += uSheen * 0.7 * pow(max(dot(n, normalize(normalize(vec3(0.6, -0.2, 1.0)) + V)), 0.0), uSheenPow);
  if (uMat > 0.5 && uMat < 1.5 && !edge) {
    float th = dot(normalize(vWT), H);
    hl += 0.22 * pow(max(dot(n, H), 0.0), 48.0) + 0.1 * pow(sqrt(max(1.0 - th * th, 0.0)), 260.0);
  }
  vec3 R = reflect(-V, n);
  float fres = 0.05 + 0.95 * pow(1.0 - nv, 5.0);
  hl += uGloss * (edge ? 1.6 : 1.0) * studio(R).r * mix(0.18, 1.0, fres);
  if (uMat > 1.5 && uMat < 2.5 && !edge) {
    // acrylic: a thin bright line where the face meets the rim
    hl += (1.0 - smoothstep(0.0, max(uThick * 0.6, 0.03), -d)) * (0.45 + 0.5 * fres);
  }
  float hc = clamp(hl, 0.0, 1.0);
  col = mix(col, vec3(1.0 + 0.6 * clamp(hl - 0.35, 0.0, 1.0)), hc * 0.9);
  col = mix(col, col * 1.1 + 0.05, uGlow);
  col = mix(col, uFogColor, uFog * smoothstep(uFogNear, uFogFar, vDepth));
  col = mix(col, uBg, uDim);
#ifdef REFLECT
  col = mix(col, uBg, 0.35);
  alpha *= uRefl * (1.0 - smoothstep(0.0, uReflFade, vAbove));
#endif
  gl_FragColor = vec4(col, alpha);
}`;

export function cardMaterial(map, back, radius, frame) {
  const f = frame || { width: 0, color: "#ffffff", alpha: 0 }, fc = new THREE.Color(f.color);
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    side: THREE.FrontSide,
    alphaToCoverage: true,
    uniforms: {
      uMap: { value: map }, uMapB: { value: map }, uImgAspect: { value: 1 }, uImgAspectB: { value: 1 }, uBackImage: { value: 0 },
      uSub: { value: new THREE.Vector4(0, 0, 1, 1) }, uSubB: { value: new THREE.Vector4(0, 0, 1, 1) }, uFace: { value: 0 }, uFaceB: { value: 0 },
      uSize: { value: new THREE.Vector2(1, 1) }, uPivot: { value: 0.5 }, uSide: { value: 1 },
      uTheta: { value: 0 }, uK: { value: 0 }, uTwist: { value: 0 }, uLift: { value: 0 }, uSphere: { value: 0 }, uRing: { value: 0 },
      uThick: { value: 0.004 }, uCloth: { value: 0 }, uClothMap: { value: null },
      uFocus: { value: 14 }, uDof: { value: 0 }, uClip: { value: -1e4 }, uBlur: { value: 0 },
      uRadius: { value: radius }, uBack: { value: new THREE.Color(back) }, uBg: { value: new THREE.Color() },
      uFrame: { value: new THREE.Vector4(f.width, fc.r, fc.g, fc.b) }, uFrameA: { value: f.alpha },
      uDim: { value: 0 }, uGlow: { value: 0 }, uShade: { value: 0 }, uSheen: { value: 0 }, uSheenPow: { value: 30 },
      uFog: { value: 0 }, uFogNear: { value: 10 }, uFogFar: { value: 60 }, uFogColor: { value: new THREE.Color() },
      uGutter: { value: 0 }, uDeckle: { value: 0 }, uShadow: { value: new THREE.Vector2(0, 0) },
      uMat: { value: 0 }, uGloss: { value: 0.1 }, uGrain: { value: 0.5 }, uEdgeTint: { value: 0 }, uEdge: { value: new THREE.Color("#f1eee7") },
    },
  });
}

// the same card in a floor: shares every uniform of the card, plus where the floor is and how strong the reflection
export function reflectMaterial(card) {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    defines: { REFLECT: "" },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: { ...card.uniforms, uFloor: { value: -100 }, uRefl: { value: 0 }, uReflFade: { value: 2 } },
  });
}

// A placeholder until the picture arrives: its dominant colour (from images.json) or grey, with its number.
export function placeholder(color, label) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = color || "#8a8a8a"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,255,255,.55)"; g.font = "600 34px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, 64, 66);
  return new THREE.CanvasTexture(c);
}

// A record: black vinyl, fine grooves, a sheen that stays with the light while the label (the cover's own picture) turns.
export const discGeometry = new THREE.CircleGeometry(0.5, 96);
export function discMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: { uMap: { value: null }, uSpin: { value: 0 }, uDim: { value: 0 }, uBg: { value: new THREE.Color() }, uTilt: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uSpin, uDim, uTilt; uniform vec3 uBg; varying vec2 vP;
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x), aa = max(fwidth(r), 1e-4);
        if (r > 1.0) discard;
        float grooves = step(0.36, r) * (1.0 - smoothstep(0.93, 0.95, r));
        vec3 c = vec3(0.032) + 0.012 * sin(r * 560.0) * grooves;
        c += (0.16 * pow(abs(cos(a - 0.75 + uTilt)), 22.0) + 0.05 * pow(abs(cos(a + 0.9 + uTilt)), 6.0)) * grooves;
        c = mix(c, vec3(0.075), smoothstep(0.955, 0.97, r));
        if (r < 0.345) {
          float cs = cos(uSpin), sn = sin(uSpin);
          vec2 q = mat2(cs, -sn, sn, cs) * vP / 0.69 + 0.5;
          c = texture2D(uMap, q).rgb * (0.9 + 0.1 * smoothstep(0.3, 0.345, r));
        }
        if (r < 0.022) c = vec3(0.1);
        gl_FragColor = vec4(mix(c, uBg, uDim), 1.0 - smoothstep(1.0 - aa * 1.5, 1.0, r));
      }`,
  });
}
