// A depth map for a picture, made on this computer with Depth Anything V2 Small (Apache-2.0): no credits, about a second a
// picture. The first run downloads the model (27 MB, from Hugging Face) and its runtime (onnxruntime-web, from npm)
// into a cache folder shared by every Particle Hero project.
//
//   node depth.mjs <picture> <out.png>          near is white, far is black, the size of the picture
//   import { depthMap } from "./depth.mjs"
import sharp from "sharp";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDir, cachedPackage } from "./common.mjs";

const MODEL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx";
const MEAN = [0.485, 0.456, 0.406], SD = [0.229, 0.224, 0.225];

let session, ort;
async function load() {
  if (session) return session;
  ort = cachedPackage("onnxruntime-web", "1.20.1");
  if (!ort) throw new Error("could not install onnxruntime-web (needs npm and the network once)");
  const file = join(cacheDir(), "depth-anything-v2-small-q8.onnx");
  if (!existsSync(file)) {
    console.log("downloading the depth model (27 MB, once)…");
    const res = await fetch(MODEL);
    if (!res.ok) throw new Error(`depth model: HTTP ${res.status}`);
    writeFileSync(file + ".part", Buffer.from(await res.arrayBuffer()));
    renameSync(file + ".part", file);
  }
  ort.env.wasm.numThreads = 4;
  session = await ort.InferenceSession.create(readFileSync(file), { executionProviders: ["wasm"] });
  return session;
}

// one picture at a time: they share the model
let queue = Promise.resolve();
/** writes a grey depth map (near = white) the size of `src` to `out`; transparent parts are read as black */
export function depthMap(src, out) {
  const job = queue.then(() => run(src, out));
  queue = job.catch(() => {});
  return job;
}

async function run(src, out) {
  const s = await load();
  const meta = await sharp(src).metadata();
  // the model reads about 518 px on the long side, in multiples of 14
  const k = 518 / Math.max(meta.width, meta.height);
  const w = Math.max(14, Math.round((meta.width * k) / 14) * 14), h = Math.max(14, Math.round((meta.height * k) / 14) * 14);
  const { data } = await sharp(src).flatten({ background: "#000" }).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = w * h, f = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) f[c * n + i] = (data[3 * i + c] / 255 - MEAN[c]) / SD[c];
  const res = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", f, [1, 3, h, w]) });
  const o = res[s.outputNames[0]];
  const [oh, ow] = o.dims.slice(-2);
  let lo = Infinity, hi = -Infinity;
  for (const v of o.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const g = Buffer.alloc(ow * oh);
  for (let i = 0; i < ow * oh; i++) g[i] = Math.round(((o.data[i] - lo) / (hi - lo || 1)) * 255);
  await sharp(g, { raw: { width: ow, height: oh, channels: 1 } }).resize(meta.width, meta.height, { fit: "fill" }).png().toFile(out);
  return out;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error("node depth.mjs <picture> <out.png>"); process.exit(1); }
  const t0 = performance.now();
  await depthMap(src, out);
  console.log(`✓ ${out} (${Math.round(performance.now() - t0)} ms)`);
}
