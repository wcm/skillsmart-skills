// Image and video generation for Skillsmart skills, paid with the user's Skillsmart credits through the `skillsmart`
// CLI (it signs the computer in once, in the browser). With FAL_KEY set, it uses that fal.ai key instead, without credits.
// Copied into each generating skill's tools/ folder; the source is skillsmart/packages/skill-kit/gen.mjs.
//
//   import { generate, file } from "./gen.mjs";
//   await generate("nano-banana-pro", { prompt, images: [file("out/top.png")], aspect_ratio: "4:5", resolution: "2K" },
//                  { skill: "hover-reveal", out: "out/look/under.png", label: "look/under" });
//
// Models   nano-banana-pro  { prompt, images?: [file(…)], aspect_ratio?, resolution?: "1K" | "2K" | "4K", output_format?: "png" | "jpeg" | "webp" }
//          kling-v3-pro     { prompt, start_image: file(…), end_image?: file(…), duration?: 3–15 (s), negative_prompt?, cfg_scale?: 0–1 }
//          birefnet-video   { video: file(….mp4, up to 30 s and 50 MB), variant?: "light" | "light-2k" | "heavy" | "matting" | "portrait"
//                           | "dynamic" (default "heavy"), resolution?: "1K" | "2K" } → the subject's mask, frame by frame, as an MP4
//          birefnet-image   { image: file(…), variant?: as for birefnet-video (default "heavy"), resolution?: "1K" | "2K" }
//                           → the image's subject cut out on transparency, as a PNG
//          sam-3            { image: file(…), prompt: what to keep, in a few words ("headphones") } → the image with only that
//                           object kept and everything else transparent (a stand it hangs on, its reflection), as a PNG
//          gemini-tts       { text (up to 5,000 characters), voice?: a Gemini voice (default "Callirrhoe"), style?: how to read it,
//                           timing?: true (default) | false, language?: "en" } → with timing, a JSON file
//                           { format: "skillsmart-voice/1", audio: { content_type, base64 }, words: [{ word, start, end }] }
//                           (readVoice() turns it into the audio bytes and the words); without timing, the audio (WAV)
// Prices   image 20 credits (4K: 40) · video 15 credits per second · video cut-out 2 credits per second · image cut-out or
//          an object by name 2 credits · voice-over 10 credits per 1,000 characters (at least 1) · failed generations
//          are never charged
// Errors   a failed generation throws and sets process.exitCode to the CLI's code: 3 = not enough credits (or the
//          skill isn't on the account), 5 = a limit was reached, 1 = it failed. The CLI has already printed what to do.
// Options  SKILLSMART_CLI replaces the command (default "npx --yes skillsmart@latest"); SKILLSMART_URL the service.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

/** A local file to send as a reference image. */
export const file = (path) => ({ file: resolve(path) });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── Skillsmart credits, through the CLI ─────────

function cli(args, stdin) {
  const custom = (process.env.SKILLSMART_CLI || "").trim();
  const [cmd, ...pre] = custom ? custom.split(/\s+/) : ["npx", "--yes", "skillsmart@latest"];
  const win = process.platform === "win32"; // npx is a .cmd file there, which needs a shell
  const all = [...pre, ...args].map((a) => (win && /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  return new Promise((done, fail) => {
    const child = spawn(cmd, all, { stdio: [stdin === undefined ? "ignore" : "pipe", "inherit", "inherit"], shell: win });
    child.on("error", fail);
    child.on("close", (code) => done(code ?? 1));
    if (stdin !== undefined) child.stdin.end(stdin);
  });
}

function failed(code, message) {
  process.exitCode = code;
  return Object.assign(new Error(message), { exitCode: code });
}

// A failed generation that the script doesn't catch ends it with the CLI's exit code and a one-line message (the CLI
// has already said what to do), instead of a stack trace.
process.on("uncaughtException", (e) => {
  console.error(e?.exitCode ? `Stopped: ${e.message}` : e);
  process.exit(e?.exitCode ?? 1);
});

// Run once before any generation: shows the balance and signs this computer in if needed, so parallel
// generations don't each open a sign-in.
let ready;
const connect = () =>
  (ready ??= cli(["credits"]).then((code) => {
    if (code !== 0) throw failed(code, "couldn't reach the Skillsmart account (see the message above)");
  }));

// ───────── the user's own fal.ai key ─────────

const falKey = () => process.env.FAL_KEY; // read late, so a script can set it after importing this file
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4" };
const BIREFNET = { light: "General Use (Light)", "light-2k": "General Use (Light 2K)", heavy: "General Use (Heavy)", matting: "Matting", portrait: "Portrait", dynamic: "General Use (Dynamic)" };
let told = false;

const falFetch = (url, init = {}) =>
  fetch(url, { ...init, headers: { Authorization: `Key ${falKey()}`, ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init.headers } });

async function falUpload(ref) {
  const type = TYPES[extname(ref.file).toLowerCase()] ?? "application/octet-stream";
  const init = await falFetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    body: JSON.stringify({ content_type: type, file_name: basename(ref.file) }),
  });
  if (!init.ok) throw new Error(`fal upload: HTTP ${init.status}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: "PUT", body: readFileSync(ref.file), headers: { "Content-Type": type } });
  if (!put.ok) throw new Error(`fal upload: HTTP ${put.status}`);
  return file_url;
}

async function falRequest(model, i) {
  if (model === "nano-banana-pro") {
    const refs = i.images ?? [];
    return [refs.length ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro", {
      prompt: i.prompt,
      ...(refs.length ? { image_urls: await Promise.all(refs.map(falUpload)) } : {}),
      aspect_ratio: i.aspect_ratio ?? (refs.length ? "auto" : "1:1"),
      resolution: i.resolution ?? "1K",
      output_format: i.output_format ?? "png",
      num_images: 1,
    }];
  }
  if (model === "birefnet-image") {
    return ["fal-ai/birefnet/v2", {
      image_url: await falUpload(i.image),
      model: BIREFNET[i.variant ?? "heavy"],
      operating_resolution: i.resolution === "2K" ? "2048x2048" : "1024x1024",
      output_format: "png",
      refine_foreground: true,
    }];
  }
  if (model === "sam-3") {
    return ["fal-ai/sam-3/image", { image_url: await falUpload(i.image), prompt: i.prompt, output_format: "png", apply_mask: true }];
  }
  if (model === "birefnet-video") {
    return ["fal-ai/birefnet/v2/video", {
      video_url: await falUpload(i.video),
      model: BIREFNET[i.variant ?? "heavy"],
      operating_resolution: i.resolution === "2K" ? "2048x2048" : "1024x1024",
      output_mask: true,
      refine_foreground: false,
      video_output_type: "X264 (.mp4)",
      video_quality: "maximum",
    }];
  }
  if (model === "kling-v3-pro") {
    return ["fal-ai/kling-video/v3/pro/image-to-video", {
      prompt: i.prompt,
      start_image_url: await falUpload(i.start_image),
      ...(i.end_image ? { end_image_url: await falUpload(i.end_image) } : {}),
      duration: String(i.duration ?? 5),
      ...(i.negative_prompt ? { negative_prompt: i.negative_prompt } : {}),
      ...(i.cfg_scale != null ? { cfg_scale: i.cfg_scale } : {}),
      generate_audio: false,
    }];
  }
  if (model === "gemini-tts") {
    return ["google/gemini-3.8-flash-tts", { prompt: i.text, voice: i.voice ?? "Callirrhoe", ...(i.style ? { style_instructions: i.style } : {}) }];
  }
  throw new Error(`unknown model ${model}`);
}

/** A voice-over file from gemini-tts (with timing) → { audio: Buffer, contentType, words: [{ word, start, end }] }. */
export function readVoice(path) {
  const v = JSON.parse(readFileSync(path, "utf8"));
  if (v.format !== "skillsmart-voice/1") throw new Error(`${path} isn't a Skillsmart voice-over file`);
  return { audio: Buffer.from(v.audio.base64, "base64"), contentType: v.audio.content_type, words: v.words };
}

async function falQueue(endpoint, body, tag, poll) {
  const sub = await falFetch(`https://queue.fal.run/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
  const job = await sub.json().catch(() => ({}));
  if (!sub.ok || !job.request_id) throw new Error(`${tag} fal: ${JSON.stringify(job.detail ?? job)}`);
  for (;;) {
    await sleep(poll);
    const st = await falFetch(job.status_url);
    if (st.ok && (await st.json()).status === "COMPLETED") break;
  }
  const res = await falFetch(job.response_url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${tag} fal: ${JSON.stringify(data.detail ?? data)}`);
  return data;
}

async function viaFal(model, input, out, tag) {
  if (!told) console.log("Using your own fal.ai key (FAL_KEY): no Skillsmart credits are used.");
  told = true;
  const [endpoint, body] = await falRequest(model, input);
  if (model === "gemini-tts") {
    // the same two steps as on Skillsmart: the speech, then Whisper's word times, saved as one file
    console.log(`${tag} speaking with fal…`);
    const speech = await falQueue(endpoint, body, tag, 2000);
    const url = speech.audio?.url;
    if (!url) throw new Error(`${tag} fal returned no audio`);
    const dl = await fetch(url);
    if (!dl.ok) throw new Error(`${tag} download: HTTP ${dl.status}`);
    const audio = Buffer.from(await dl.arrayBuffer());
    if (input.timing === false) { writeFileSync(out, audio); console.log(`${tag} ✓ ${out}`); return; }
    console.log(`${tag} timing the words…`);
    const asr = await falQueue("fal-ai/whisper", { audio_url: url, task: "transcribe", chunk_level: "word", ...(input.language ? { language: input.language } : {}) }, tag, 2000);
    const words = (asr.chunks ?? []).map((c) => ({ word: String(c.text ?? "").trim(), start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0 })).filter((w) => w.word);
    writeFileSync(out, JSON.stringify({ format: "skillsmart-voice/1", audio: { content_type: speech.audio.content_type ?? "audio/wav", base64: audio.toString("base64") }, words }));
    console.log(`${tag} ✓ ${out}`);
    return;
  }
  const sub = await falFetch(`https://queue.fal.run/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
  const job = await sub.json().catch(() => ({}));
  if (!sub.ok || !job.request_id) throw new Error(`${tag} fal: ${JSON.stringify(job.detail ?? job)}`);
  console.log(`${tag} generating with fal…`);
  for (;;) {
    await sleep(model === "nano-banana-pro" || model === "birefnet-image" || model === "sam-3" ? 2000 : 5000);
    const st = await falFetch(job.status_url);
    if (st.ok && (await st.json()).status === "COMPLETED") break;
  }
  const res = await falFetch(job.response_url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${tag} fal: ${JSON.stringify(data.detail ?? data)}`);
  const url = model === "nano-banana-pro" ? data.images?.[0]?.url : model === "birefnet-video" ? data.mask_video?.url
    : model === "birefnet-image" ? data.image?.url : model === "sam-3" ? (data.masks?.[0]?.url ?? data.image?.url) : data.video?.url;
  if (!url) throw new Error(`${tag} fal returned no result`);
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`${tag} download: HTTP ${dl.status}`);
  writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
  console.log(`${tag} ✓ ${out}`);
}

// ───────── the one entry point ─────────

/** Generates one image, video or voice-over and saves it to `out`. Returns the absolute path. */
export async function generate(model, input, { skill, out, label }) {
  if (!skill || !out) throw new Error("generate() needs { skill, out }");
  const dest = resolve(out);
  mkdirSync(dirname(dest), { recursive: true });
  const tag = `[${label || model}]`;
  if (falKey()) {
    await viaFal(model, input, dest, tag);
    return dest;
  }
  await connect();
  const code = await cli(["generate", "--skill", skill, "--model", model, "--out", dest, ...(label ? ["--label", label] : [])], JSON.stringify(input));
  if (code !== 0) throw failed(code, `${tag} ${code === 3 ? "needs more credits or the skill on this account" : code === 5 ? "hit a limit" : "failed"} (see the message above)`);
  return dest;
}
