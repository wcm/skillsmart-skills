// Loads a game's scripts into Node with a canvas stub: the sprite code draws at load time, but
// nothing in the sims reads the pixels back. Returns the game's R. Used by tools/games/<game>/sim.mjs.

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

export function load(files) {
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {}, data: new Uint8ClampedArray(4 * 64 * 64) })), set: (t, k, v) => ((t[k] = v), true) });
  ctx.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h });
  ctx.createImageData = (w, h) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h });
  globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) };
  globalThis.window = {};
  const require = createRequire(import.meta.url);
  for (const f of files) require(join(ROOT, f + '.js'));
  return globalThis.window.R;
}
