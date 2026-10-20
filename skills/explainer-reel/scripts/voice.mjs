#!/usr/bin/env node
/*
 * The voice-over comes first: it sets the reel's rhythm, and the pictures follow it.
 *
 *   node voice.mjs <reel.js>                                   read the script in one take, time every word
 *   node voice.mjs <reel.js> --audition [--voices A,B,…] [--line "…"]   the opening lines in several voices
 *   node voice.mjs <reel.js> --audio take.wav [--words words.json]       your own recording
 *   node voice.mjs <reel.js> --provider say                             a free system voice (timing checks only)
 *
 * Options: --voice NAME  --style "how to read it"  --provider skillsmart|say|espeak  --fresh (ignore the cache)
 * Defaults come from the reel's `voice: { voice, style, language, provider, gap }`.
 *
 * The voice (provider skillsmart, the default): one of Gemini's voices (Callirrhoe unless the reel says otherwise)
 * reads the whole script in one take, with the reel's style direction, and Whisper times every word, in one
 * request through the user's Skillsmart account (gen.mjs, model gemini-tts: 10 credits per 1,000 characters, at
 * least 1). With FAL_KEY in the environment it uses that fal.ai key instead, and no credits. The take is cached
 * next to the reel by the exact text and settings, so a re-run with nothing changed costs nothing.
 *
 * The take is cut between lines by those word times and laid out again: the voice's own pauses kept (a sentence
 * gets at least a breath), plus each beat's `hold` and every `pause()`, so the pictures line up with the voice.
 * say (macOS) and espeak (Linux) speak line by line, words spread by syllables. Your own recording is split at its
 * pauses (leave a clear pause between lines), or follows --words (a list of { word, start, end }, e.g. Whisper's).
 *
 * Writes, next to the reel:
 *   <reel>.vo.wav        the voice-over, levelled
 *   <reel>.timing.json   { audio, duration, beats: [{ text, start, end, words: [[start, end], …], hold, pause }] }
 *   <reel>.voice/        the cache (takes and auditions)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compile, estimate, plainWords } from "../assets/engine/trame.js";
import { generate, readVoice } from "./gen.mjs";

const SKILL = "explainer-reel";
const VOICES = "Callirrhoe,Achernar,Vindemiatrix,Sulafat,Despina,Leda,Aoede,Erinome"; // gentle ones first; Charon, Puck, Kore… for brisk
const STYLE = "Calm, warm and close to the microphone, like quietly telling one person something worth knowing. Unhurried, with natural pauses between sentences. A clear spoken voice, never a whisper.";
const SR = 44100;
let GAP = 0.12; // the engine's gap after a beat (engine/trame.js compile: reel.voice.gap), where a pause() begins

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const fail = (msg) => { console.error(msg); process.exit(2); };
const reelPath = resolve(args[0] || "");
if (!args[0] || !existsSync(reelPath)) fail("usage: node voice.mjs <reel.js> [--voice NAME] [--style \"…\"] [--provider skillsmart|say|espeak] | --audition | --audio take.wav [--words words.json]");
const reel = (await import(pathToFileURL(reelPath).href)).default;
const cfg = { ...(reel.voice || {}) };
GAP = cfg.gap ?? GAP;
const base = reelPath.replace(/\.js$/, "");
const outWav = `${base}.vo.wav`, outJson = `${base}.timing.json`, cacheDir = `${base}.voice`;
let prior = null;
try { prior = JSON.parse(readFileSync(outJson, "utf8")); } catch {}
mkdirSync(cacheDir, { recursive: true });

/* ---------- which voice ---------- */
// your own recording: --audio, or the one this reel was last laid out from (a plain re-run re-lays it, free;
// it never quietly replaces the recording with a generated voice: pass --provider for that)
let audioSrc = opt("audio") ? resolve(opt("audio")) : null, wordsSrc = opt("words") ? resolve(opt("words")) : null;
if (!audioSrc && prior?.provider === "recording" && !opt("provider") && !args.includes("--audition")) {
  audioSrc = resolve(dirname(reelPath), prior.source || "");
  wordsSrc = prior.words ? resolve(dirname(reelPath), prior.words) : null;
  if (!prior.source || !existsSync(audioSrc)) fail(`this reel's voice-over is a recording that isn't there any more: pass --audio <file>, or --provider skillsmart for a generated voice`);
  console.log(`re-laying your recording ${prior.source}`);
}
const provider = audioSrc ? "recording" : opt("provider", cfg.provider && cfg.provider !== "recording" ? cfg.provider : "skillsmart");
if (!["skillsmart", "say", "espeak", "recording"].includes(provider)) fail(`no provider "${provider}" (skillsmart, say, espeak; or --audio for a recording)`);
const voice = opt("voice", provider === "skillsmart" ? cfg.voice || "Callirrhoe" : provider === "say" ? cfg.sayVoice || null : null);
const style = opt("style", cfg.style || cfg.instructions || STYLE);
const language = cfg.language || null;
let credits = 0;

/* ---------- audio (ffmpeg decodes) ---------- */
function pcm(file) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
function envelope(x, win = 0.01) {
  const n = Math.floor(SR * win), out = [];
  for (let i = 0; i + n <= x.length; i += n) { let s = 0; for (let j = i; j < i + n; j++) s += x[j] * x[j]; out.push(Math.sqrt(s / n)); }
  return out;
}
/** the level of loud speech: the 95th percentile of the 10 ms frames, so one click or pop can't set it */
function speechRef(e) {
  const v = e.filter((x) => x > 1e-4).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) * 0.95)] : 0;
}
function voiced(x) {
  const e = envelope(x);
  const th = Math.max(speechRef(e) * 0.06, 0.004);
  let a = e.findIndex((v) => v > th), b = e.length - 1;
  while (b > 0 && e[b] <= th) b--;
  if (a < 0) { a = 0; b = e.length - 1; }
  return [a * 0.01, (b + 1) * 0.01];
}
/** bring speech to a fixed level (RMS of the spoken frames ≈ −20 dBFS, peaks under −0.5 dBFS), so every
 * voice-over (generated or a quiet home recording) sits the same against the bed and drives the ducking alike */
function level(x) {
  const e = envelope(x), ref = speechRef(e);
  const loud = e.filter((v) => v > ref * 0.1 && v < ref * 3);
  if (!ref || !loud.length) return x;
  const g = Math.min(0.1 / Math.sqrt(loud.reduce((s, v) => s + v * v, 0) / loud.length), 31.6); // at most +30 dB
  // a look-ahead limiter in 10 ms blocks keeps peaks under 0.94 without turning the whole take down for one click
  const B = Math.floor(SR * 0.01), nb = Math.ceil(x.length / B), need = new Float32Array(nb);
  for (let k = 0; k < nb; k++) {
    let p = 0;
    for (let i = k * B, end = Math.min(x.length, (k + 1) * B); i < end; i++) p = Math.max(p, Math.abs(x[i]));
    need[k] = Math.min(1, 0.94 / Math.max(p * g, 1e-9));
  }
  let prev = Math.min(1, need[0]), cur = prev;
  for (let k = 0; k < nb; k++) {
    const t = Math.min(need[k], k + 1 < nb ? need[k + 1] : 1);
    cur = Math.min(t, cur + (1 - cur) * 0.12);
    for (let i = k * B, end = Math.min(x.length, (k + 1) * B); i < end; i++) x[i] *= g * (prev + ((cur - prev) * (i - k * B)) / B);
    prev = cur;
  }
  return x;
}
function writeWav(path, x) {
  const out = Buffer.alloc(44 + x.length * 2);
  out.write("RIFF", 0); out.writeUInt32LE(36 + x.length * 2, 4); out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  writeFileSync(path, out);
}

/* ---------- words ↔ timestamps ---------- */
const norm = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** spread words over [s, e] by the engine's syllable estimate */
function spread(text, s, e) {
  const est = estimate(text);
  const k = (e - s) / Math.max(est.words[est.words.length - 1]?.end || 1, 1e-3);
  return est.words.map((w) => [s + w.start * k, s + w.end * k]);
}
/** spoken words with times ({ word, start, end }, as Whisper gives them) → a character alignment */
function alignmentOfWords(list) {
  const al = { chars: [], starts: [], ends: [] };
  for (const w of list) {
    const s = +(w.start ?? w.start_time), e = +(w.end ?? w.end_time);
    for (const c of String(w.word ?? w.text).trim()) { al.chars.push(c); al.starts.push(s); al.ends.push(e); }
    al.chars.push(" "); al.starts.push(e); al.ends.push(e);
  }
  return al;
}
/** character alignment → spoken tokens with times */
function tokens(al) {
  const out = [];
  let cur = null;
  al.chars.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) { out.push(cur); cur = null; } return; }
    if (!cur) cur = { text: "", s: al.starts[i], e: al.ends[i] };
    cur.text += c; cur.e = al.ends[i];
  });
  if (cur) out.push(cur);
  return out.filter((t) => norm(t.text));
}
/**
 * Times for our words from an alignment: a sequence alignment (edit distance) between our words and the
 * spoken tokens, so a number read out as words, or a `say` that differs from the caption, can't shift everything
 * after it. Words without a partner share the time between their neighbours, by syllables, never overlapping
 * the next spoken word.
 */
function wordTimes(words, al) {
  const A = words.map(norm), B = tokens(al), n = A.length, m = B.length;
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (A[i - 1] && A[i - 1] === norm(B[j - 1].text) ? 0 : 1));
  const hit = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const same = A[i - 1] && A[i - 1] === norm(B[j - 1].text);
    if (D[i][j] === D[i - 1][j - 1] + (same ? 0 : 1)) { if (same) hit[i - 1] = [B[j - 1].s, B[j - 1].e]; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  const t0 = m ? B[0].s : 0, t1 = m ? B[m - 1].e : 0;
  for (let i = 0; i < n; ) {
    if (hit[i]) { i++; continue; }
    let k = i;
    while (k < n && !hit[k]) k++;
    let s = i ? hit[i - 1][1] : t0, e = k < n ? hit[k][0] : t1;
    const want = 0.05 * (k - i);
    if (e - s < want) {
      if (k === n) e = s + want; // nothing follows: run on past the last token
      else { // take the time from before the run, never from the next spoken word
        s = Math.max(i ? hit[i - 1][0] : 0, e - want);
        if (i) hit[i - 1][1] = Math.min(hit[i - 1][1], s);
      }
    }
    spread(words.slice(i, k).join(" "), s, e).forEach((w, q) => (hit[i + q] = w));
    i = k;
  }
  return hit;
}

/* ---------- the script ---------- */
const sc = compile(reel, null);
const items = sc.script;
const beats = items.filter((s) => s.kind === "beat");
if (!beats.length) fail("the reel has no beats to speak");
const take = (text) => text.replace(/\s+/g, " ").trim();

/* ---------- generated voices, cached by exactly what is sent ---------- */
const keyOf = (...parts) => createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
const estimateCredits = (chars) => Math.max(1, Math.ceil(chars / 100));
const viaKey = !!process.env.FAL_KEY;
/** one Gemini take: { wav (file), words } with timing, or { wav } without */
async function gemini(text, v, timing, label) {
  const key = keyOf("gemini-tts", v, style, language, timing, text), json = join(cacheDir, `${key}.json`), wav = join(cacheDir, `${key}.wav`);
  if (!args.includes("--fresh") && existsSync(wav) && (!timing || existsSync(json))) return { wav, words: timing ? JSON.parse(readFileSync(json, "utf8")) : null, cached: true };
  const input = { text, voice: v, style, ...(language ? { language } : {}), ...(timing ? {} : { timing: false }) };
  const out = join(cacheDir, `${key}.${timing ? "take.json" : "take.wav"}`);
  await generate("gemini-tts", input, { skill: SKILL, out, label });
  if (!viaKey) credits += estimateCredits(text.length);
  if (timing) {
    const v1 = readVoice(out);
    writeFileSync(wav, v1.audio);
    writeFileSync(json, JSON.stringify(v1.words));
    return { wav, words: v1.words, cached: false };
  }
  writeFileSync(wav, readFileSync(out));
  return { wav, words: null, cached: false };
}
function system(text, k) {
  // system voices read fast and some ignore their rate setting, so the take is slowed (same pitch) to about the
  // calm Gemini voices' pace: the timing it gives is then close to the real voice's
  const wpm = Math.round(150 * (cfg.rate ?? 1));
  const f = join(cacheDir, `${keyOf(provider, voice, String(wpm), text)}.wav`);
  if (!existsSync(f) || args.includes("--fresh")) {
    const raw = `${f}.${provider === "say" ? "aiff" : "raw.wav"}`;
    if (provider === "say") execFileSync("say", [...(voice ? ["-v", voice] : []), "-o", raw, text]);
    else execFileSync("espeak-ng", ["-v", voice || "en-us", "-w", raw, text]);
    const [a, b] = voiced(pcm(raw)), words = text.split(/\s+/).filter(Boolean).length;
    const tempo = Math.min(1, Math.max(0.5, wpm / ((words / Math.max(0.3, b - a)) * 60)));
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", raw, "-filter:a", `atempo=${tempo.toFixed(3)}`, f]);
    rmSync(raw, { force: true });
  }
  return f;
}

/* ---------- audition: several voices, one file ---------- */
if (args.includes("--audition")) {
  const list = (opt("voices") || (provider === "say" ? "Samantha,Ava,Zoe,Daniel" : VOICES)).split(",").map((s) => s.trim()).filter(Boolean);
  if (provider === "espeak") fail("espeak has one voice; audition with the default provider");
  const line = take(opt("line", beats.slice(0, 2).map((b) => b.say).join(" ")));
  if (provider === "skillsmart") console.log(`${list.length} voices × ${line.length} characters: ${viaKey ? "your fal key, no credits" : `about ${list.length * estimateCredits(line.length)} credits`}`);
  const parts = [];
  let t = 0;
  for (const v of list) {
    process.stdout.write(`  ${v}… `);
    try {
      const file = provider === "say" ? system(line) : (await gemini(line, v, false, `voice/${v}`)).wav;
      const x = pcm(file), [s, e] = voiced(x), a = Math.max(0, s - 0.05), z = Math.min(x.length / SR, e + 0.15);
      parts.push({ x: level(x.slice(Math.floor(a * SR), Math.floor(z * SR))), at: t });
      console.log(`${t.toFixed(1)} s`);
      t += z - a + 1.1;
    } catch (err) { console.log(`skipped (${String(err.message).slice(0, 160)})`); }
  }
  const mix = new Float32Array(Math.ceil((t + 0.5) * SR));
  for (const p of parts) mix.set(p.x, Math.floor(p.at * SR));
  writeWav(`${base}-voices.wav`, mix);
  console.log(`wrote ${basename(base)}-voices.wav: "${line}" in ${parts.length} voices, in the order above${credits ? ` (${credits} credits)` : ""}.`);
  console.log(`then keep the choice in the reel: voice: { voice: "<name>", style: "…" }`);
  process.exit(0);
}

/* ---------- lay the beats out ---------- */
/** a beat's span from its words (a beat that is only an [audio tag] gets an empty span where the last one ended) */
const spanOf = (ws, prev) => (ws.length ? { ws: ws[0][0], we: ws[ws.length - 1][1], words: ws } : { ws: prev ?? 0, we: prev ?? 0, words: [] });
const sentenceEnd = (text) => /[.!?…]["”’)]*$/.test(text), clauseEnd = (text) => /[,;:—–]["”’)]*$/.test(text);
const clips = [];
let trailing = 0;
/**
 * spoken[i] = { x (samples), ws, we (first word start, last word end, in x), words (in x), a, z (cut bounds in x) }.
 * Beats are placed so that pauses line up with the engine's: a pause() after a beat begins at its end + hold
 * + GAP, a leading pause at 0. Where a beat keeps its place relative to the one before it in the same take, the
 * two clips merge, so the source plays straight through with no cut.
 */
function layout(spoken, gapAfter) {
  const out = [];
  let prevEnd = null, prevShift = null, extra = 0, bi = 0;
  for (const it of items) {
    if (it.kind === "pause") { extra += it.dur; continue; }
    const g = spoken[bi], b = beats[bi];
    const start = prevEnd == null ? extra || 0.2 : prevEnd + (extra ? GAP + extra : gapAfter(bi - 1));
    const shift = start - g.ws;
    const prev = bi ? spoken[bi - 1] : null;
    if (prev && prev.x === g.x && Math.abs(shift - prevShift) < 1e-6) {
      const c = clips[clips.length - 1];
      c.x = g.x.subarray(Math.floor(c.a * SR), Math.floor(g.z * SR));
    } else clips.push({ x: g.x.subarray(Math.floor(g.a * SR), Math.floor(g.z * SR)), a: g.a, at: g.a + shift });
    const r = (v) => +v.toFixed(3);
    out.push({ text: b.text, start: r(start), end: r(g.we + shift), words: g.words.map(([s, e]) => [r(s + shift), r(e + shift)]), hold: it.hold || 0, pause: r(extra) });
    prevEnd = g.we + shift + (it.hold || 0);
    prevShift = shift; extra = 0; bi++;
  }
  trailing = extra;
  return out;
}
/** cut a continuous take (generated or a recording) between beats: halfway into each gap, never into a neighbour's words */
function cutTake(x, spans) {
  const len = x.length / SR;
  return spans.map((s, i) => {
    const prev = spans[i - 1], next = spans[i + 1];
    const a = Math.max(0, prev ? Math.max(s.ws - 0.08, (prev.we + s.ws) / 2) : s.ws - 0.08);
    const z = Math.min(len, next ? Math.min(s.we + 0.25, (s.we + next.ws) / 2) : s.we + 0.4);
    return { x, ...s, a, z };
  });
}
/** a take's beats from its word times */
function spansFromWords(list) {
  const all = wordTimes(beats.flatMap((b) => plainWords(b.text)), alignmentOfWords(list));
  let k = 0;
  const spans = [];
  for (const b of beats) spans.push(spanOf(all.slice(k, (k += plainWords(b.text).length)), spans[spans.length - 1]?.we));
  return spans;
}
/** a recording without word times: split at its pauses, placed in order against where the syllable estimate expects
 * each line break; a missing pause is estimated (and reported), a pause inside a line skipped */
function splitAtPauses(x) {
  const e = envelope(x);
  const th = speechRef(e) * 0.05, sil = [];
  for (let i = 0, s = -1; i <= e.length; i++) {
    const quiet = i < e.length && e[i] < th;
    if (quiet && s < 0) s = i;
    if (!quiet && s >= 0) { if (i - s >= 12) sil.push([s * 0.01, i * 0.01]); s = -1; }
  }
  const [v0, v1] = voiced(x);
  const cand = sil.filter(([a, z]) => a > v0 + 0.1 && z < v1 - 0.1), nB = beats.length - 1, nS = cand.length;
  const est = beats.map((b) => estimate(b.text).dur), tot = est.reduce((a, b) => a + b, 0);
  let acc = 0;
  const want = est.slice(0, nB).map((d) => v0 + ((v1 - v0) * (acc += d)) / tot);
  const MISS = 1.5, mid = ([a, z]) => (a + z) / 2;
  const D = Array.from({ length: nB + 1 }, () => new Array(nS + 1).fill(Infinity)), how = D.map((row) => row.map(() => 0));
  for (let j = 0; j <= nS; j++) D[0][j] = 0;
  for (let k = 1; k <= nB; k++) for (let j = 0; j <= nS; j++) {
    let best = D[k - 1][j] + MISS, h = 1;
    if (j > 0 && D[k][j - 1] < best) { best = D[k][j - 1]; h = 2; }
    const m = j > 0 ? D[k - 1][j - 1] + Math.abs(mid(cand[j - 1]) - want[k - 1]) : Infinity;
    if (m < best) { best = m; h = 3; }
    D[k][j] = best; how[k][j] = h;
  }
  const cut = new Array(nB).fill(null);
  for (let k = nB, j = nS; k > 0; ) { const h = how[k][j]; if (h === 3) { cut[k - 1] = cand[j - 1]; k--; j--; } else if (h === 2) j--; else k--; }
  let missing = 0;
  for (let k = 0; k < nB; k++) if (!cut[k]) {
    missing++;
    const lo = k ? cut[k - 1][1] : v0;
    let hi = v1;
    for (let q = k + 1; q < nB; q++) if (cut[q]) { hi = cut[q][0]; break; }
    const w = Math.min(Math.max(want[k], lo), hi);
    cut[k] = [w, w];
  }
  if (missing) console.warn(`${missing} line break${missing > 1 ? "s" : ""} had no pause in the recording and ${missing > 1 ? "were" : "was"} estimated; leave a clear pause between lines, or pass --words`);
  let prevEnd = v0;
  return beats.map((b, i) => {
    const [end, next] = i < nB ? cut[i] : [v1, v1], s = prevEnd;
    prevEnd = next;
    return { ws: s, we: end, words: spread(b.text, s, end) };
  });
}
// the voice's own pause between beats, but a sentence gets at least a breath and a clause a beat
const naturalGap = (spans) => (i) => Math.max(spans[i + 1].ws - spans[i].we, sentenceEnd(beats[i].text) ? 0.32 : clauseEnd(beats[i].text) ? 0.14 : 0);

const timing = { audio: basename(outWav), provider, voice, style: provider === "skillsmart" ? style : undefined, take: null, duration: 0, beats: [] };
if (provider === "recording") {
  Object.assign(timing, { source: relative(dirname(reelPath), audioSrc), words: wordsSrc ? relative(dirname(reelPath), wordsSrc) : null, voice: undefined, take: "recording" });
  const x = pcm(audioSrc);
  const spans = wordsSrc ? spansFromWords(JSON.parse(readFileSync(wordsSrc, "utf8"))) : splitAtPauses(x);
  timing.beats = layout(cutTake(x, spans), (i) => Math.max(0, spans[i + 1].ws - spans[i].we));
} else if (provider === "skillsmart") {
  const text = take(beats.map((b) => b.say).join(" "));
  const before = viaKey ? "your fal key, no credits" : `about ${estimateCredits(text.length)} credits from your Skillsmart account`;
  const got = await gemini(text, voice, true, "voice");
  console.log(`${voice}, ${text.length} characters: ${got.cached ? "from the cache, no cost" : before}`);
  const x = pcm(got.wav), spans = spansFromWords(got.words);
  timing.take = "whole";
  timing.beats = layout(cutTake(x, spans), naturalGap(spans));
} else {
  // say / espeak: line by line, words spread by syllables
  const spoken = beats.map((b, i) => {
    if (process.stdout.isTTY) process.stdout.write(`\r  ${provider}: ${i + 1}/${beats.length}  `);
    const x = pcm(system(take(b.say))), [s, e] = voiced(x), len = x.length / SR;
    return { x, ws: s, we: e, words: spread(b.text, s, e), a: Math.max(0, s - 0.04), z: Math.min(len, e + 0.12) };
  });
  if (process.stdout.isTTY) process.stdout.write("\n");
  timing.take = "beats";
  timing.beats = layout(spoken, (i) => 0.12 + (sentenceEnd(beats[i].text) ? 0.3 : clauseEnd(beats[i].text) ? 0.15 : 0.06));
}

/* ---------- mix down ---------- */
const lastBeat = timing.beats[timing.beats.length - 1];
const total = Math.ceil((lastBeat.end + lastBeat.hold + (trailing ? GAP + trailing : 0) + 0.8) * SR);
const out = new Float32Array(total);
const F = Math.floor(0.008 * SR); // 8 ms fades at every cut
for (const c of clips) {
  const at = Math.floor(c.at * SR), n = c.x.length;
  for (let i = Math.max(0, -at); i < n && at + i < total; i++) out[at + i] += c.x[i] * Math.min(1, i / F, (n - 1 - i) / F);
}
writeWav(outWav, level(out));
timing.duration = +(total / SR).toFixed(3);
timing.trailing = trailing;
timing.credits = credits;
writeFileSync(outJson, JSON.stringify(timing, null, 1));
const words = timing.beats.reduce((s, b) => s + b.words.length, 0), speaking = timing.beats.reduce((s, b) => s + (b.end - b.start), 0);
const who = provider === "recording" ? "your recording" : provider === "skillsmart" ? `${voice} (Gemini, timed by Whisper)` : `${provider}${voice ? ` ${voice}` : ""} (for timing checks)`;
console.log(`wrote ${basename(outWav)} and ${basename(outJson)}: ${who}; ${timing.beats.length} beats, ${words} words, ${timing.duration.toFixed(1)} s (${Math.round((words / speaking) * 60)} words a minute while speaking)${credits ? `, ${credits} credits` : ""}.`);
