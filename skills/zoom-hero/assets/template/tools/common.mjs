// What the Zoom Hero tools share: where things are, a page's tree of levels, and the parts of every prompt.
//
// A page's tree lives in tools/trees/<id>.json; its pictures are made in tools/out/<id>/; publish.mjs writes the web
// pictures to site/<id>/img/.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const SITE = join(TOOLS, "..", "site");
export const OUT = join(TOOLS, "out");

// every level has one exact shape, whatever a model returns (rects assume it)
export const SIZES = { "2K": [2720, 1530], "4K": [3840, 2160] };

export const MEDIA = {
  photo: "Real photograph, shot on a full-frame camera, natural colour, fine film grain, true-to-life materials and honest exposure. No text, no logos, no watermark, no border, no frame.",
  riso: "Risograph print illustration in exactly three inks: fluorescent pink, sunflower yellow and deep navy for all line work, on warm off-white uncoated paper. Halftone dot shading, grainy flat ink fills, slight mis-registration between the inks, darker overprint where inks cross, crisp confident hand-drawn navy outlines with varied line weight. No other colours. No text, no letters, no logos, no watermark, no border.",
  micro: "Scientific image through a microscope: real, physical and finely detailed, natural colour, soft light, shallow depth of field at the edges. No text, no labels, no scale bar, no watermark, no border.",
  render: "Elegant, physically based 3D render: soft studio light, gentle shadows, glossy and translucent materials, crisp true detail. No text, no labels, no watermark, no border.",
  none: "",
};

export const ZOOM = "This picture is a tiny area of a larger picture, enlarged about {times} times, so it is blurry and has no fine detail. Re-create this exact area as a sharp, high-resolution close-up, as if the camera had moved in until this area fills the frame. Keep the same framing, viewpoint and composition, and keep every shape, colour, tone and the direction of the light where it is, so the close-up lines up exactly over the blurry picture. Do not zoom out, do not re-frame, do not move anything. Add only the fine detail and texture that becomes visible up close:";

export const words = (argv) => argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
export const flagOf = (argv) => (n, d = null) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);

export const treeFile = (id) => join(TOOLS, "trees", `${id}.json`);
export const dirOf = (id) => { const d = join(OUT, id); mkdirSync(d, { recursive: true }); return d; };

export function loadTree(id) {
  if (!id || !existsSync(treeFile(id))) {
    const have = existsSync(join(TOOLS, "trees")) ? readdirSync(join(TOOLS, "trees")).map((f) => f.replace(/\.json$/, "")) : [];
    console.error(`no tree for "${id ?? ""}" in tools/trees/ (have: ${have.join(", ") || "none"})`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(treeFile(id), "utf8"));
}

export const readJson = (f, d = {}) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d);
