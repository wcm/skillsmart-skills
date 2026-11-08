// Pairs the grains of one picture with the grains of the next so that each moves only a short way (an approximate
// optimal transport): the grains of the first picture are slid, a direction at a time, until they spread like the
// second picture's (sliced transport), and then both are paired in order along a Hilbert curve, which works once the
// two spreads match. Result: for each home of picture A, the home of picture B its grain takes.
//
// in:  { id, a: Float32Array (x, y, z, w per home), b: Float32Array, n, iters }
// out: { id, map: Uint32Array(n) }

const IDX = 2 ** 19;   // room for the home number under the sort key (n ≤ 2^19)

// sorts homes by a value, returning their order; the value is quantised into the high bits of a float64 key, the home
// number into the low ones, so a plain typed-array sort does it
function order(vals, n, keys, out) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = vals[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const s = hi > lo ? 4294967295 / (hi - lo) : 0;
  for (let i = 0; i < n; i++) keys[i] = Math.floor((vals[i] - lo) * s) * IDX + i;
  keys.sort();
  for (let j = 0; j < n; j++) out[j] = keys[j] % IDX;
  return out;
}

function hilbertKey(x, y, R) {
  let d = 0;
  for (let s = R >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      const t = x; x = y; y = t;
    }
  }
  return d;
}

function match(a, b, n, iters) {
  const zx = new Float32Array(n), zy = new Float32Array(n), bx = new Float32Array(n), by = new Float32Array(n);
  for (let i = 0; i < n; i++) { zx[i] = a[4 * i]; zy[i] = a[4 * i + 1]; bx[i] = b[4 * i]; by[i] = b[4 * i + 1]; }
  const keys = new Float64Array(n), oz = new Uint32Array(n), ob = new Uint32Array(n);
  const pz = new Float32Array(n), pb = new Float32Array(n);
  let th = 0.37;
  for (let it = 0; it < iters; it++) {
    th += 2.39996323;                       // the golden angle: directions spread evenly
    const dx = Math.cos(th), dy = Math.sin(th);
    for (let i = 0; i < n; i++) { pz[i] = zx[i] * dx + zy[i] * dy; pb[i] = bx[i] * dx + by[i] * dy; }
    order(pz, n, keys, oz);
    order(pb, n, keys, ob);
    for (let j = 0; j < n; j++) {
      const iz = oz[j], d = pb[ob[j]] - pz[iz];
      zx[iz] += d * dx; zy[iz] += d * dy;
    }
  }
  // now pair along a Hilbert curve
  const R = 1024, hz = new Float32Array(n), hb = new Float32Array(n);
  const q = (v) => Math.max(0, Math.min(R - 1, Math.floor((v * 0.5 + 0.5) * R)));
  for (let i = 0; i < n; i++) { hz[i] = hilbertKey(q(zx[i]), q(-zy[i]), R); hb[i] = hilbertKey(q(bx[i]), q(-by[i]), R); }
  order(hz, n, keys, oz);
  order(hb, n, keys, ob);
  const map = new Uint32Array(n);
  for (let j = 0; j < n; j++) map[oz[j]] = ob[j];
  return map;
}

onmessage = (e) => {
  const { id, a, b, n, iters = 14 } = e.data;
  const map = match(a, b, n, iters);
  postMessage({ id, map }, [map.buffer]);
};
