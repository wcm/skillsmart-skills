/*
 * Palettes and looks.
 *
 * A palette names colours by role, never by hue, so a reel written for one palette reads in all:
 *   ink     the main line (the hero drawing)          dim    guides, ticks, axes, faint rings
 *   accent  the one warm highlight (reward, light,    life   the body, nerves, growth, "safe", yes
 *           energy, the future self, the CTA)          calm   sleep, mind, frequency, ambient rings
 *   alert   stress, the heart, danger, urgency         info   data, readouts, thought, questions
 *   caption spoken words                              captionDim  words not yet spoken
 *   bg      the ground                                ghost  the misregistered ghost / chroma fringe
 *
 * A look is the filter the whole frame goes through (engine/look.js) plus the type and stroke that
 * suit it. Each look has a default palette; any palette works with any look.
 */

export const PALETTES = {
  // the reference: warm charcoal, cream line, gold, teal nerves, violet frequency, coral heart
  ember: { bg: "#0d0c0e", ink: "#efe5d6", dim: "#6f6873", accent: "#f2b84b", life: "#3fe0ad", calm: "#a07cf0", alert: "#ff5f5a", info: "#76a0ff", caption: "#ffffff", captionDim: "#5f5963", ghost: "#c43a78" },
  // night, sleep, dreams, the moon
  aurora: { bg: "#070a13", ink: "#e2f4ff", dim: "#56637a", accent: "#86f7cf", life: "#59e3ff", calm: "#b592ff", alert: "#ff6fa8", info: "#8fb2ff", caption: "#ffffff", captionDim: "#4c566b", ghost: "#3a4dff" },
  // science, space, the ocean, physics
  ocean: { bg: "#04101a", ink: "#d8f2ff", dim: "#4c6a7c", accent: "#ffd27a", life: "#41e6cf", calm: "#7fa6ff", alert: "#ff7a6b", info: "#62c6ff", caption: "#ffffff", captionDim: "#47606f", ghost: "#1e6bff" },
  // nature, growth, food, health habits
  forest: { bg: "#0a0f0b", ink: "#ebf1e0", dim: "#62705b", accent: "#ecc35c", life: "#8be37b", calm: "#8fc9a9", alert: "#f07a4f", info: "#9fd5e0", caption: "#ffffff", captionDim: "#56614f", ghost: "#7a3b16" },
  // love, relationships, beauty, self-care
  rose: { bg: "#120a0f", ink: "#ffe7ef", dim: "#7b5d69", accent: "#ffb38a", life: "#ff8fbd", calm: "#c9a3ff", alert: "#ff4f6d", info: "#ffc9dc", caption: "#ffffff", captionDim: "#6c5560", ghost: "#7a2cff" },
  // serious, news, minimal: white line, one red
  mono: { bg: "#0a0a0a", ink: "#f2f2f2", dim: "#666666", accent: "#ffffff", life: "#d9d9d9", calm: "#b8b8b8", alert: "#ff4d3d", info: "#a6a6a6", caption: "#ffffff", captionDim: "#5a5a5a", ghost: "#ff3b30" },
  // terminals, code, hacking, AI
  phosphor: { bg: "#020c04", ink: "#9dffaa", dim: "#2c6a37", accent: "#e8ffb0", life: "#55ff86", calm: "#79ffd2", alert: "#ffd25a", info: "#8dffc4", caption: "#c8ffcf", captionDim: "#2f6639", ghost: "#00ff55" },
  // money, markets, scoreboards, retro tech
  amber: { bg: "#0e0702", ink: "#ffd69c", dim: "#7a5830", accent: "#ffae00", life: "#ffe08a", calm: "#ffc46b", alert: "#ff5f2e", info: "#ffcf87", caption: "#ffe4b8", captionDim: "#755632", ghost: "#ff4000" },
  // print on paper: riso inks (light)
  paper: { light: true, bg: "#efe8da", ink: "#1f1c1a", dim: "#a0978a", accent: "#ff5a36", life: "#00897b", calm: "#3d5afe", alert: "#e0245e", info: "#2f6fb3", caption: "#1f1c1a", captionDim: "#b4ab9e", ghost: "#ff48b0" },
  // engineering, how things work, plans
  blueprint: { bg: "#0f3b74", ink: "#eef6ff", dim: "#7ea6d6", accent: "#ffe38c", life: "#a2f2ff", calm: "#c8dcff", alert: "#ffa08c", info: "#c0e4ff", caption: "#ffffff", captionDim: "#7d9fca", ghost: "#79b9ff" },
  // teaching, school, history, explainers
  chalk: { bg: "#1c2521", ink: "#f2f0e7", dim: "#78837a", accent: "#ffd86b", life: "#9de7b2", calm: "#bac7ff", alert: "#ff9c8f", info: "#a9e1ff", caption: "#f6f4ec", captionDim: "#6d776f", ghost: "#ffffff" },
  // games, kids, nostalgia: four greens
  gameboy: { bg: "#0f380f", ink: "#9bbc0f", dim: "#306230", accent: "#c4e05a", life: "#9bbc0f", calm: "#8bac0f", alert: "#c4e05a", info: "#8bac0f", caption: "#c4e05a", captionDim: "#306230", ghost: "#306230" },
};

export const FONTS = {
  sans: "Poppins",
  mono: "JetBrains Mono",
  pixel: "VT323",
  hand: "Caveat",
  serif: "Fraunces",
};

/*
 * Looks. caption: the caption font and size (px on the 1080-wide frame); hud: the font for labels and
 * readouts; stroke: the default line style; width: the hero line weight; line: every line's weight
 * scaled and floored (so thin lines survive a coarse screen); smallText: text under this size (px)
 * is drawn crisp on the caption layer instead of through the screen; crispText: all text in the scene
 * (labels, numbers, readouts) is drawn crisp, still moving with the camera (a reel's `crispText` overrides it);
 * cell: the screen's dot pitch (px), which dot fills and orb halos snap to so the two grids never beat.
 */
export const LOOKS = {
  halftone: { palette: "ember", caption: { font: "sans", size: 50 }, hud: "mono", stroke: "mono", width: 5, crispText: true, cell: 6, about: "the reference: dot-screen glow around crisp lines, magenta ghost, grain on warm charcoal" },
  led: { palette: "amber", caption: { font: "pixel", size: 68 }, hud: "pixel", stroke: "mono", width: 6, line: { scale: 1.35, min: 3 }, smallText: 60, about: "the whole frame as a matrix of round LEDs, unlit ones faintly visible" },
  crt: { palette: "phosphor", caption: { font: "pixel", size: 68 }, hud: "pixel", stroke: "mono", width: 5, about: "a curved phosphor tube: scanlines, RGB mask, bloom, roll" },
  neon: { palette: "aurora", caption: { font: "sans", size: 50 }, hud: "mono", stroke: "mono", width: 4, about: "smooth wide bloom, no screen; tubes of light on deep night" },
  riso: { palette: "paper", caption: { font: "serif", size: 56 }, hud: "mono", stroke: "mono", width: 5, about: "two-ink risograph on paper: misregistered ghost plate, halftone shading, ink speckle" },
  blueprint: { palette: "blueprint", caption: { font: "mono", size: 44 }, hud: "mono", stroke: "mono", width: 4, about: "white line on blueprint blue with a drafting grid and paper tooth" },
  dither: { palette: "gameboy", caption: { font: "pixel", size: 70 }, hud: "pixel", stroke: "mono", width: 6, about: "ordered Bayer dither into four colours, chunky pixels" },
  chalk: { palette: "chalk", caption: { font: "hand", size: 66 }, hud: "hand", stroke: "sketch", width: 5, about: "chalk on a slate board: broken grainy strokes, dusty smudge" },
};

export function hexToRgb(h) {
  if (Array.isArray(h)) return h;
  h = String(h).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbCss = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Resolve a colour: a role name, a hex string, or an [r, g, b] array. */
export function colour(pal, c) {
  if (c == null) return hexToRgb(pal.ink);
  if (Array.isArray(c)) return c;
  if (pal[c]) return hexToRgb(pal[c]);
  return hexToRgb(c);
}
