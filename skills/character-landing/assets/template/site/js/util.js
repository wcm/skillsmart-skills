export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const mixRGB = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const css = c => `rgb(${c.map(v => Math.round(v * 255)).join(" ")})`;
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
