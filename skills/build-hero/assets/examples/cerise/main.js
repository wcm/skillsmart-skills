// Cerise: the film plays in a big rounded frame with a notch cut from its bottom-left corner (the notch holds the
// headline, then the clock and the stage captions, then the closing line). Under the frame one hand-drawn cherry line
// draws the long table as the film plays, section by section with the film's stages, with a pen note at each; when
// the candles light in the film, the drawn candles light too.
import { mountBuild, reveal, clocks, clamp } from "../engine/chantier.js";

const STILL = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PHONE = 760;
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const span = (p, a, b) => clamp((p - a) / (b - a));

// —— the timeline, in p (the hero's scroll progress) ——
// The film is a real-looking time-lapse in which the crew carry everything to the table, joined from three Kling
// segments between keyframes (open, flowers, chairs: "film" > "segments" in the scene file), 130 frames, about 10 a
// second ("pick" in the scene file: every film frame from 118 to 122 is kept where the camera's turn settles into the first
// join, so the turn eases out instead of stopping dead. Where the florists set the runner down, only six of the film's
// frames 194–208 are kept, skipping 198 and 200, in which the near arrangement smears and the tall bouquet fades in as
// a ghost, so the bouquet is in place one frame after the florists' hands (f86 → f87). Near the end 293 stands in for
// 292, where a passing crew member smears the front of the runner, and 302 and 304 are left out, where the crew flash
// back in with a sharp face). It starts on the first scroll: the first screen shows its first frame, the camera in a
// corner by the right-hand wall looking diagonally across the room at the long bare table, already standing, with
// everything waiting, and the build moves from there while the camera turns to look down the length of the room.
const FILM = [0, 0.74];
const FRAMES = 130;
const fT = (i) => (i - 1) / (FRAMES - 1);                       // frame i → film time
const pOfT = (t) => FILM[0] + t * (FILM[1] - FILM[0]);
const pF = (i) => pOfT(fT(i));                                  // frame i → p
// where each stage starts in the film (0..1), read off the frames: load in (f1: the bare oak table up, two linen rolls
// on its near end, the flower buckets at the far end, the chair stacks and crates by the right wall; the crew walk in
// from f7 and lift the first roll at f10); linen (f12: a roll goes across the table and is rolled out, the cloth over
// the near end by f26 and down the whole table by f43, while the camera turns to look down the room, settling at f54);
// flowers (f56: florists carry the arrangements from the buckets, the first bunch down at the far end at f67, the first
// on the near half at f76; at f86 two florists set the runner down on the near end, and by f87 it is full, with the
// tapers in and the tall bouquet on its plinth at the far end); chairs (f94: the crew lift the chairs off the stacks and
// carry them out, the stacks gone by f102; the chairs come back from f111); places (f116: the chairs land on both sides,
// f116–123, with a plate (from f111) and a glass at every place); finished (f124: the crew leave, the room still at
// f130)
const STAGE_T = [0, fT(12), fT(56), fT(94), fT(116), fT(124), 1];
const SECTIONS = STAGE_T.length - 1;                            // the pen draws one section per stage
// evening: dusk, then the candles light from the middle of the table outward, the warmth spreading to the brass
// pendants, the walls and the garden lights beyond the glass (origin: the heart of the tapers down the runner in
// lit.webp). Coarse noise and a wide edge, so the warmth spreads in soft pools over the plain limewash walls, never in
// speckles
const LIT = { dusk: "img/dusk", src: "img/lit", at: [0.745, 0.9], split: 0.4, reveal: "radial", origin: [0.48, 0.54], noise: 0.3, cells: 12, soft: 0.5, flicker: 0.08 };
const LIGHTS_ON = LIT.at[0] + (LIT.at[1] - LIT.at[0]) * LIT.split;          // 0.807: the lights' reveal starts
const CANDLES = [0.826, 0.847];  // the candles' count, with the flames: the first show at about 0.826, all lit by 0.847
const INTRO_OUT = 0.008;          // the headline leaves on the first scroll (gone by 0.033, see INTRO_FADE)
const INTRO_FADE = "0.035 0.025"; // in, out
const PEN_IN = 0.03;              // the pen and the first caption start as the headline goes
const DUSK_CAP = 0.765;           // the candles' caption, a third into the dusk fade (0.745–0.807), so the places read longer
const CLOCK_OUT = 0.87;           // the clock leaves (gone by 0.905) as the notch reshapes, once 48 / 48 has read
const END_IN = 0.905;             // the closing line, once the room is fully lit (0.9)
const CLOCK = [0, 0.9];           // the clock runs 13:00 → 19:30 across these
// the notch: headline → clock and captions (by 0.04) → the closing line; on a phone it just closes once the clock has gone
const OPEN = [0, 0.04], CLOSE = [CLOCK_OUT, CLOCK_OUT + 0.045], CLOSE_PHONE = [END_IN, END_IN + 0.04];
// captions, one per stage, each fully in by the time its stage shows: load in as the headline goes (the crew walk in,
// lift the first roll and push it along the table under it, so it says the table is up and the first roll goes on);
// linen as the roll comes down the table (fading in from f22, in by f25 as the cloth spreads over the near end);
// flowers as the florists pick up the first arrangements (f59, in by f62); chairs as the florists leave, in by the time
// the crew reach the stacks (f89.5, in by f93: it says they carry the chairs round to the table, true from the lift to
// the walk back, since none reach the table until f116); places as the first plates go down on the garden side
// (f112.5, in by f116, as the chairs land: the CHAIRS chip counts those). Each leaves as the next comes in. In the 3 s
// auto-play the load-in reads for about 220 ms, the chairs and the places 285, the candles 315, the flowers 415 and
// the linen 515 ms
const CAP_P = [PEN_IN, pF(22), pF(59), pF(89.5), pF(112.5), DUSK_CAP, END_IN];
// caption fades, in p: quick, so each reads even at the auto-play's pace (3 s for the whole build). The first comes in
// quicker still: the load-in is the film's shortest stage
const CAP_IN = 0.018, CAP_IN_FIRST = 0.01, CAP_OUT = 0.01;
// the pen notes: each with its stage's caption, so the note and the caption change together (the pen's sections still
// start with the stages, a little before); the last when the first candle lights
const NOTE_P = [PEN_IN, ...CAP_P.slice(1, 5), CANDLES[0]];
// framing on wider screens. The notch takes the frame's bottom left, and on the first screen the table runs in from
// the bottom left, its two linen rolls on its near end, so the film is zoomed a little and leans right and down: the
// table comes out from behind the headline with the rolls' ends showing, and runs past the flower buckets to the chair
// stacks. As the camera turns to look down the room the table moves to the middle, clear of the captions, and the
// crop rises so the runner, the tapers, the tall bouquet and the pendants show. A portrait tablet's frame shows only
// half the film's width, so there the crop starts on the table's middle and the flowers, then leans right of the
// captions once the camera looks down the room, over to the chair stacks while the crew empty them (f94–f104), and
// back left as the chairs come back, ending on the front of the runner (its big peonies) clear of the notch, with the
// right-hand row of chairs and the tall bouquet still in view. Focus keys are in film time (0..1), not p: fT(frame)
const FRAMING_WIDE = { zoom: 1.12, focus: [[0, 0, 1], [fT(17), 0, 0.97], [fT(52), 0.02, 0.76], [1, 0.04, 0.72]] };
const FRAMING_TALL = { zoom: 1, focus: [[0, 0.62, 0.5], [fT(28), 0.55, 0.5], [fT(55), 0.38, 0.5], [fT(87), 0.38, 0.5], [fT(95), 0.66, 0.5], [fT(104), 0.66, 0.5], [fT(116), 0.22, 0.5]] };
const framing = (W, H) => (W / H < 1 ? FRAMING_TALL : FRAMING_WIDE);
const clockAt = (p) => 780 + 390 * clamp((p - CLOCK[0]) / (CLOCK[1] - CLOCK[0]));
const hhmm = (m) => { const r = Math.round(m); return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`; };

const section = document.getElementById("build");
const stage = section.querySelector(".ch-stage");
const nav = document.querySelector(".nav");
const giant = stage.querySelector(".giant");
const letters = [...giant.querySelectorAll("span")];
const giantBase = giant.querySelector(".giant-base");
const notch = stage.querySelector(".notch");
const clock = notch.querySelector(".clock");
const say = stage.querySelector(".say");
const intro = say.querySelector(".intro");
const h1 = intro.querySelector("h1");
const caps = [...say.querySelectorAll(".cap")];
const endBlock = say.querySelector(".end");
const pen = stage.querySelector(".pen");
const svg = pen.querySelector(".pen-svg");
const notes = [...pen.querySelectorAll(".note")];
const css = (k, v) => section.style.setProperty(k, v);
const px = (v) => `${Math.round(v * 10) / 10}px`;
const easeOut = (t) => 1 - (1 - t) ** 3;

let api = null, geo = null, strokes = [];
const CAPS = caps.map((el, i) => ({ el, a: CAP_P[i], b: CAP_P[i + 1], fi: i ? CAP_IN : CAP_IN_FIRST, last: -1 }));
const NOTES = notes.map((el, i) => ({ el, a: NOTE_P[i], b: NOTE_P[i + 1] ?? Infinity, last: -1 }));

// every time on the page comes from the one timeline (the engine reads these when it mounts)
intro.dataset.chIn = `0 ${INTRO_OUT}`;
intro.dataset.chFade = INTRO_FADE;
clock.dataset.chIn = `0 ${CLOCK_OUT}`;
clock.querySelector(".clock-num [data-ch-count]").dataset.at = CLOCK.join(" ");
{
  const [day, lit] = clock.querySelectorAll(".clock-label > span");
  day.dataset.chIn = `0 ${(LIGHTS_ON - 0.037).toFixed(3)}`;       // gone just as the candles' label comes in
  // the candles' label comes in quickly and counts as the candles light, so 48 / 48 reads before the clock leaves
  lit.dataset.chIn = LIGHTS_ON.toFixed(3);
  lit.dataset.chFade = "0.012 0.035";
  lit.querySelector("[data-ch-count]").dataset.at = CANDLES.join(" ");
}
endBlock.dataset.chIn = String(END_IN);
// stems: from the first bunch on the table to the full runner; chairs: from the first chair set at the table to the
// last (the count is of chairs in place, like the stems, so it climbs under the places caption)
stage.querySelector("[data-count='stems']").dataset.at = `${pF(66.5).toFixed(3)} ${pF(87).toFixed(3)}`;
stage.querySelector("[data-count='chairs']").dataset.at = `${pF(115.5).toFixed(3)} ${pF(123).toFixed(3)}`;
notes.forEach((n, i) => {
  n.dataset.chStep = NOTE_P[i].toFixed(3);
  n.querySelector("b").textContent = hhmm(i === 0 ? clockAt(0) : clockAt(NOTE_P[i]));
});

// —— geometry: the frame, its notch, the giant word and the pen strip, fitted to the window ——
let capRatio = 0.714;
function measureCap() {
  const c = document.createElement("canvas").getContext("2d");
  c.font = '400 200px "Noto Serif Display"';
  const m = c.measureText("H");
  if (m.actualBoundingBoxAscent > 50) capRatio = m.actualBoundingBoxAscent / 200;
}

// the side bearings of the word's first and last letters (per 100 px), so its ink, not its advance, runs edge to edge;
// canvas only takes width keywords, so the widths between are interpolated
const WIDTHS = [[62.5, "extra-condensed"], [75, "condensed"], [87.5, "semi-condensed"], [100, "normal"]];
const bearingsAt = {};
function bearings(stretch) {
  const of = (kw) => {
    if (bearingsAt[kw]) return bearingsAt[kw];
    const c = document.createElement("canvas").getContext("2d");
    c.font = '400 100px "Noto Serif Display"';
    c.fontStretch = kw;
    const a = c.measureText(letters[0].textContent), b = c.measureText(letters[letters.length - 1].textContent);
    return (bearingsAt[kw] = { l: Math.max(0, -a.actualBoundingBoxLeft), r: Math.max(0, b.width - b.actualBoundingBoxRight) });
  };
  let k = 0;
  while (k < WIDTHS.length - 2 && stretch > WIDTHS[k + 1][0]) k++;
  const [s0, k0] = WIDTHS[k], [s1, k1] = WIDTHS[k + 1], t = clamp((stretch - s0) / (s1 - s0)), A = of(k0), B = of(k1);
  return { l: lerp(A.l, B.l, t), r: lerp(A.r, B.r, t) };
}

// the giant word: its ink edge to edge; when the height caps its size, it widens (up to the font's full width)
function fitGiant(W, H, g, phone) {
  giant.style.setProperty("--giant-size", "100px");
  const adv = (s) => { giant.style.fontStretch = `${s}%`; return letters.reduce((sum, l) => sum + l.getBoundingClientRect().width, 0) || 233; };
  const ink = (s) => { const b = bearings(s); return adv(s) - b.l - b.r; };     // per 100 px
  const target = (W - 2 * g) * (phone ? 0.985 : 0.975);
  let stretch = 62.5, size = target / (ink(62.5) / 100);
  const capMax = (H * (phone ? 0.13 : 0.3)) / capRatio;
  if (size > capMax) {
    size = capMax;
    const want = target / (size / 100);
    if (ink(100) <= want) {
      // even at full width it falls short: let it grow a little taller rather than open gaps between the letters
      stretch = 100;
      size = Math.min(target / (ink(100) / 100), (H * (phone ? 0.13 : 0.36)) / capRatio);
    } else { let lo = 62.5, hi = 100; for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (ink(mid) < want) lo = mid; else hi = mid; } stretch = lo; }
  }
  giant.style.fontStretch = `${stretch.toFixed(2)}%`;
  giant.style.setProperty("--giant-size", px(size));
  const b = bearings(stretch);
  letters[0].style.marginLeft = px((-b.l * size) / 100);
  letters[letters.length - 1].style.marginRight = px((-b.r * size) / 100);
  return { size, capH: size * capRatio };
}

function layout() {
  const W = innerWidth, H = stage.clientHeight || innerHeight, phone = W < PHONE;
  const g = clamp(W * 0.0155, 14, 28), navH = nav.offsetHeight || 56, fw = W - 2 * g;
  const G = { W, H, phone, g };

  // type sizes first: everything after is measured with them
  const npad = phone ? 12 : clamp(W * 0.016, 18, 28);
  let h1Size = phone ? clamp(W * 0.138, 46, 60) : clamp(Math.min(W * 0.056, H * 0.098), 60, 104);
  let clockSize = phone ? 38 : clamp(H * 0.072, 52, 80);
  css("--npad", px(npad));
  css("--clock-size", px(clockSize));
  css("--segs-w", px(phone ? 104 : clamp(W * 0.094, 120, 164)));
  css("--h1-size", px(h1Size));
  css("--cap-size", px(phone ? 30 : clamp(W * 0.026, 30, 44)));
  css("--end-size", px(phone ? 52 : clamp(Math.min(W * 0.052, H * 0.088), 56, 96)));

  const { size, capH } = fitGiant(W, H, g, phone);
  // the baseline, from the marker inside the last letter (the letters all sit at the word's top, however far they sank)
  const last = letters[letters.length - 1];
  const baseOff = giantBase.getBoundingClientRect().top - last.getBoundingClientRect().top;
  // the letters sink below their own baseline and are cut there, so they never slide over anything
  giant.style.setProperty("--giant-h", px(baseOff + size * 0.025 + 2));

  let frameTop, introBottom, buildBottom, boxBottom, giantBaseY, penTop, penH;
  let nw, nwEnd, nhIntro, nhBuild, nhEnd;
  const endLine = endBlock.querySelector(".end-line"), endAct = endBlock.querySelector(".end-actions");
  if (!phone) {
    frameTop = navH + 8;
    giantBaseY = H - g;
    const capTop = giantBaseY - capH;
    introBottom = capTop + capH * 0.15;                    // the frame overlaps the top of the word
    penH = clamp(H * 0.19, 148, 206);
    penTop = H - g - penH;
    buildBottom = penTop - 10;
    boxBottom = Math.max(introBottom, buildBottom);
    G.letters = introBottom - capTop;

    // the notch holds the words and the clock side by side; on narrower screens it may take more of the frame, and
    // the clock, then the headline, shrink until both fit with a clear gap
    const gap = clamp(W * 0.03, 32, 56), maxNotch = fw * (W < 1180 ? 0.64 : 0.5);
    let sayW = 0, clockW = 0;
    for (let i = 0; i < 12; i++) {
      clockW = clock.offsetWidth;
      sayW = Math.max(h1.offsetWidth, clamp(W * 0.21, 280, 380));
      const over = 2 * npad + sayW + gap + clockW - maxNotch;
      if (over <= 0) break;
      if (clockSize > 46) { clockSize = Math.max(46, clockSize - over / 2.2); css("--clock-size", px(clockSize)); }
      else if (h1Size > 44) { h1Size = Math.max(44, h1Size * (1 - over / Math.max(sayW, 1))); css("--h1-size", px(h1Size)); }
      else { sayW = maxNotch - 2 * npad - gap - clockW; break; }
    }
    css("--say-w", px(sayW));
    const clockH = clock.offsetHeight;
    nw = 2 * npad + sayW + gap + clockW;
    const capsH = Math.max(...caps.map((c) => c.offsetHeight));
    nhIntro = npad + Math.max(intro.offsetHeight, clockH) + Math.max(npad, h1Size * 0.58) + G.letters;
    nhBuild = npad + Math.max(capsH, clockH) + npad;
    nwEnd = Math.max(nw, npad + Math.max(endLine.offsetWidth, endAct.scrollWidth) + npad);
    css("--end-w", px(nwEnd - 2 * npad));
    nhEnd = npad + endBlock.offsetHeight + npad * 1.1;
  } else {
    // a phone, top to bottom: the frame (as tall as the screen allows), then the giant word and the headline; as the
    // build starts the word sinks and the headline leaves, and the pen strip and the captions take their place
    frameTop = navH + 6;
    const pad = 22, introH = intro.offsetHeight;
    buildBottom = H - pad - introH - 18 - capH - 14;
    buildBottom = introBottom = boxBottom = clamp(buildBottom, frameTop + H * 0.3, frameTop + H * 0.56);
    giantBaseY = buildBottom + 14 + capH;
    G.letters = 0;
    G.introTop = giantBaseY + 18;
    const sayH = Math.max(endBlock.offsetHeight, ...caps.map((c) => c.offsetHeight));
    const sayTop = H - pad - sayH;
    penH = clamp(sayTop - 16 - (buildBottom + 12), 110, 196);
    penTop = buildBottom + 12 + Math.max(0, (sayTop - 16 - (buildBottom + 12) - penH) / 2);
    css("--say-top", px(sayTop));
    css("--intro-dy", px(G.introTop - sayTop));
    css("--end-w", "100%");
    const clockW = clock.offsetWidth, clockH = clock.offsetHeight;
    nw = nwEnd = clockW + 2 * npad;
    nhIntro = nhBuild = clockH + 2 * npad;
    nhEnd = 0;                                               // the clock has left by then; the notch closes
  }
  Object.assign(G, { frameTop, introBottom, buildBottom, boxBottom, size, capH, giantBaseY, nw, nwEnd, nhIntro, nhBuild, nhEnd, penTop, penH });
  giant.style.setProperty("--giant-top", px(giantBaseY - baseOff));

  // the canvas box is the frame (cut to shape with clip-path); the film covers it
  css("--box-x", px(g)); css("--box-y", px(frameTop)); css("--box-w", px(fw)); css("--box-h", px(boxBottom - frameTop));
  css("--frame-x", px(g)); css("--frame-y", px(frameTop)); css("--frame-w", px(fw));
  css("--pen-top", px(penTop)); css("--pen-h", px(penH));

  geo = G;
  buildPen();
  if (api) {
    const f = framing(W, innerHeight);
    if (api.options.focus !== f.focus) { api.options.focus = f.focus; api.options.zoom = f.zoom; api.redraw(); }
  }
  frame(api ? api.p : 0);
}

// the frame and its notch as a clip path, in the canvas box's own pixels
function framePath(ox, oy, w, h, R, nw, nh) {
  const r = Math.min(R, w / 4, h / 4);
  const n = nw > 4 && nh > 4;
  const ri = n ? Math.min(r, nh / 2.2, nw / 2.2) : 0;           // the notch's corners
  const f = (v) => Math.round(v * 10) / 10;
  const x0 = f(ox), y0 = f(oy), x1 = f(ox + w), y1 = f(oy + h), nx = f(ox + nw), ny = f(oy + h - nh);
  let d = `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}`;
  if (n) {
    d += `H${nx + ri}A${ri} ${ri} 0 0 1 ${nx} ${y1 - ri}V${ny + ri}A${ri} ${ri} 0 0 0 ${nx - ri} ${ny}H${x0 + ri}A${ri} ${ri} 0 0 1 ${x0} ${ny - ri}`;
  } else d += `H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}`;
  return `path("${d}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z")`;
}

// —— every scroll: the frame opens, the word sinks, the notch reshapes, the pen moves ——
let lastClip = "";
// how far the pen has drawn, in film units: the load-in (the bare table with its rolls, the chairs and the roses
// waiting) is drawn once the headline has gone, then the pen keeps pace with the film's stages
function penAt(p) {
  const t1 = pOfT(STAGE_T[1]);
  return p < t1 ? STAGE_T[1] * smooth(span(p, PEN_IN, t1)) ** 0.85 : clamp((p - FILM[0]) / (FILM[1] - FILM[0]));
}

function frame(p) {
  const G = geo;
  if (!G) return;
  const close = G.phone ? CLOSE_PHONE : CLOSE;
  const kOpen = smooth(span(p, OPEN[0], OPEN[1])), kEnd = smooth(span(p, close[0], close[1]));
  const bottom = lerp(G.introBottom, G.buildBottom, kOpen);
  const nh = lerp(lerp(G.nhIntro, G.nhBuild, kOpen), G.nhEnd, kEnd);
  const nw = lerp(G.nw, G.nwEnd, kEnd);
  const fh = bottom - G.frameTop, notchTop = bottom - nh;
  css("--frame-h", px(fh)); css("--notch-w", px(nw));
  css("--notch-top", px(notchTop)); css("--notch-h", px(nh)); css("--notch-y", px(notchTop - G.frameTop));

  const canvas = stage.querySelector(".ch-canvas");
  if (canvas) {
    const R = G.phone ? 20 : clamp(G.W * 0.018, 18, 30);
    const clip = framePath(0, 0, G.W - 2 * G.g, fh, R, nw, nh);
    if (clip !== lastClip) { canvas.style.clipPath = clip; lastClip = clip; }
  }

  // stage captions: the old one leaves quickly, the new one fades in and rises (no double exposure in between)
  const rise = G.phone ? 32 : 40;
  for (const c of CAPS) {
    const tin = clamp((p - c.a) / c.fi), tout = clamp((p - (c.b - CAP_OUT)) / CAP_OUT);
    const v = STILL ? (p >= c.a && p < c.b ? 1 : 0) : Math.min(tin, 1 - tout);
    if (v === c.last) continue;
    c.last = v;
    c.el.style.opacity = v.toFixed(3);
    c.el.style.translate = STILL ? "" : `0 ${((1 - easeOut(tin)) * rise - tout * 8).toFixed(1)}px`;
    c.el.style.visibility = v < 0.01 ? "hidden" : "visible";
  }

  // pen notes: each comes in with its stage's caption; on a phone only the current one shows
  for (const n of NOTES) {
    const tin = clamp((p - n.a) / 0.03), tout = G.phone ? clamp((p - (n.b - 0.012)) / 0.012) : 0;   // gone as the next arrives
    const v = STILL ? (p >= n.a && !(G.phone && p >= n.b) ? 1 : 0) : Math.min(tin, 1 - tout);
    if (v === n.last) continue;
    n.last = v;
    n.el.style.opacity = v.toFixed(3);
    n.el.style.translate = STILL ? "" : `0 ${((1 - easeOut(tin)) * 10).toFixed(1)}px`;
    n.el.style.visibility = v < 0.01 ? "hidden" : "visible";
  }

  // the giant word sinks into its baseline letter by letter as the build starts
  letters.forEach((l, i) => l.style.setProperty("--sink", smooth(span(p, 0.004 + i * 0.005, 0.04 + i * 0.005)).toFixed(4)));

  penFrame(penAt(p));
}

// —— the cherry pen ——
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const f1 = (v) => Math.round(v * 10) / 10;
function curve(pts) {
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}
const lenOf = (pts) => pts.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);

function buildPen() {
  const G = geo, view = G.W - 2 * G.g, H = G.penH;
  // on a phone the drawing is wider than the screen and slides under the pen
  const u = H / 170;
  const W = G.phone ? Math.round(860 * u) : view;
  G.penW = W; G.penView = view;
  css("--pen-w", px(W));
  css("--note-size", px(G.phone ? 25 : G.W < 1180 ? 22 : clamp(26 * u, 24, 30)));
  const r = rng(1406);
  const J = (a) => (r() - 0.5) * a;
  const yF = H - 31 * u, yT = yF - 60 * u;
  // where each section starts: one per stage (load in, linen, flowers, chairs, places, finished)
  const X = (G.phone ? [0, 0.19, 0.36, 0.52, 0.67, 0.82, 1] : [0, 0.16, 0.33, 0.5, 0.65, 0.81, 1]).map((k) => k * W);
  const S = Math.min(u * 1.18, (X[1] - X[0]) / 196);       // the load-in's scale
  const list = [];
  const add = (s, layer, pts, cls = "") => { if (pts.length > 1) list.push({ s, layer, pts, cls, x: Math.min(...pts.map((q) => q[0])) }); };

  // a hand-drawn line: points every few px, a slight bow and a little shake
  const line = (x1, y1, x2, y2, shake = 0.9, step = 22) => {
    const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / step)), bow = J(2.4 * u), out = [];
    for (let i = 0; i <= n; i++) { const t = i / n; out.push([x1 + (x2 - x1) * t + J(shake * 0.5), y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * bow + J(shake)]); }
    return out;
  };
  // through corners, each edge drawn as a short hand-drawn line
  const poly = (vs, shake = 0.5) => {
    const out = [];
    for (let i = 0; i < vs.length - 1; i++) {
      const [x1, y1] = vs[i], [x2, y2] = vs[i + 1], n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / (7 * u)));
      for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n; out.push([x1 + (x2 - x1) * t + J(shake), y1 + (y2 - y1) * t + J(shake)]); }
    }
    return out;
  };
  // never a perfect circle: uneven radius, and it overshoots where it started
  const oval = (cx, cy, rx, ry, turns = 1.08, a0 = r() * 6.28) => {
    const n = Math.ceil(16 * turns), out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * turns * 6.283, k = 1 + J(0.16) + (i / n) * 0.07; out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    return out;
  };
  const spiral = (cx, cy, R, turns = 2.1) => {
    const n = Math.ceil(13 * turns), out = [], a0 = r() * 6.28;
    for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + t * turns * 6.283, rr = R * (0.18 + 0.82 * t) * (1 + J(0.16)); out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86]); }
    return out;
  };
  const wave = (x1, x2, y, amp, per) => {
    const out = [], n = Math.max(4, Math.round((x2 - x1) / (per / 4)));
    for (let i = 0; i <= n; i++) { const x = x1 + ((x2 - x1) * i) / n; out.push([x, y + Math.sin((i / 4) * 6.283 + 0.6) * amp + J(amp * 0.5)]); }
    return out;
  };
  // a garland: loops running along a line
  const garland = (x1, x2, y, R) => {
    const out = [];
    let a = 0, x = x1;
    while (x < x2) { const rr = R * (0.75 + r() * 0.5); out.push([x + Math.cos(a) * rr * 0.9, y + Math.sin(a) * rr]); a += 0.75 + J(0.3); x += 2.1 * u + J(0.8 * u); }
    return out;
  };

  // the long table, edge after edge, per section
  const chunks = (s, x1, x2, what) => {
    if (what.floor) add(s, 0, line(x1, yF + 1.5 * u, x2, yF + 1.5 * u, 0.6, 30), "floor");
    if (what.top) add(s, 1, line(x1, yT, x2, yT + J(1.2), 0.7, 26));
    if (what.hem) add(s, 1, wave(x1, x2, yF - 3 * u, 1.6 * u, 30 * u));
  };
  const candle = (s, x, hc) => {
    const base = yT - 4 * u, top = base - hc;
    add(s, 3, poly([[x - 2 * u, base], [x - 2.1 * u, top], [x + 2 * u, top + J(1.2)], [x + 2.1 * u, base]]), "thin");
    add(s, 3, poly([[x - 5 * u, base - 4 * u], [x - 3.4 * u, yT - 0.5], [x + 3.4 * u, yT - 0.5], [x + 5 * u, base - 4 * u]]), "thin");
    flames.push({ x, y: top - 1.6 * u });
  };
  const glass = (s, x) => {
    const b = yT - 1.2 * u;
    add(s, 3, poly([[x - 4.2 * u, b - 21 * u], [x - 3.6 * u, b - 15 * u], [x, b - 12 * u], [x + 3.6 * u, b - 15 * u], [x + 4.2 * u, b - 21 * u]]), "thin");
    add(s, 3, poly([[x, b - 12 * u], [x, b - 1 * u], [x - 3.6 * u, b], [x + 3.8 * u, b]]), "thin");
  };
  const roses = (s, x1, x2, every) => {
    for (let x = x1 + every * 0.5; x < x2 - 4 * u; x += every * (0.8 + r() * 0.4)) {
      add(s, 3, spiral(x, yT - 9.5 * u + J(3 * u), (5.4 + r() * 2.4) * u), r() < 0.5 ? "" : "thin");
      if (r() < 0.6) add(s, 3, oval(x + 8 * u, yT - 3.5 * u, 4.2 * u, 1.8 * u, 1.04), "thin");
    }
  };
  const fold = (s, x) => {
    const y0 = yT + (5 + r() * 6) * u, y1 = yF - (6 + r() * 16) * u, dx = (r() - 0.5) * 9 * u, out = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; out.push([x + Math.sin(t * Math.PI) * dx * 0.6 + dx * t * t + J(0.5), y0 + (y1 - y0) * t]); }
    add(s, 2, out, "thin");
  };
  const chairBack = (s, x) => {
    add(s, 3, oval(x, yT + 13 * u, 6.6 * u, 10 * u, 1.06, -1.6));
    add(s, 3, poly([[x - 6.4 * u, yT + 25 * u], [x - 7.6 * u, yF + 1 * u]]), "thin");
    add(s, 3, poly([[x + 6.4 * u, yT + 25 * u], [x + 7.8 * u, yF + 1 * u]]), "thin");
    add(s, 3, line(x - 9 * u, yT + 25 * u, x + 9 * u, yT + 25.5 * u, 0.5, 9), "thin");
  };
  const flames = [];

  // a plate on the table seen from the side: a shallow dish on a little foot
  const plate = (s, x) => {
    const w = (9.2 + r() * 0.8) * u, b = yT - 0.6 * u;
    add(s, 3, poly([[x - w, b - 3 * u], [x - w * 0.6, b - 0.2 * u], [x + w * 0.6, b - 0.3 * u], [x + w, b - 3.1 * u], [x - w - 0.5, b - 3.3 * u]], 0.35));
  };
  // two crossed trestle legs on little feet, under a bare table top
  const legs = (s, x) => {
    const sp = (12 + r() * 2) * u, top = yT + 4 * u;
    add(s, 2, poly([[x - sp, yF + 0.5], [x + 0.35 * sp + J(1.5 * u), top]]));
    add(s, 2, poly([[x + sp, yF + 0.5], [x - 0.35 * sp + J(1.5 * u), top]]));
    add(s, 2, line(x - sp - 3.5 * u, yF, x - sp + 3 * u, yF - 0.4, 0.3, 4), "thin");
    add(s, 2, line(x + sp - 3 * u, yF - 0.4, x + sp + 3.5 * u, yF, 0.3, 4), "thin");
  };

  // 0 · load in: a stack of chairs and a bucket of roses waiting on the limestone, then the bare oak table already up
  // on its trestle legs, the two linen rolls lying on its near end
  {
    const s = 0, x = X[0] + 4 * u;
    chunks(s, X[0], X[1], { floor: true });
    const cx = x + 12 * S;                                  // a stack of chairs
    add(s, 3, oval(cx, yF - 53 * S, 6.5 * S, 9 * S, 1.06, -1.6));
    for (let i = 0; i < 4; i++) add(s, 3, line(cx - 9 * S, yF - (27 - i * 4.4) * S, cx + 10 * S, yF - (27 - i * 4.4) * S + J(1), 0.4, 8), "thin");
    add(s, 3, poly([[cx - 7 * S, yF - 14 * S], [cx - 8 * S, yF]]), "thin"); add(s, 3, poly([[cx + 8 * S, yF - 14 * S], [cx + 9 * S, yF]]), "thin");
    add(s, 3, poly([[cx - 1 * S, yF - 44 * S], [cx - 2 * S, yF - 27 * S]]), "thin");
    const bk = x + 42 * S;                                  // a bucket of roses
    add(s, 3, poly([[bk - 9 * S, yF - 22 * S], [bk - 7 * S, yF], [bk + 7 * S, yF], [bk + 9 * S, yF - 22 * S], [bk - 9.5 * S, yF - 22.5 * S]]));
    add(s, 3, spiral(bk - 5 * S, yF - 29 * S, 4.6 * S), "thin"); add(s, 3, spiral(bk + 4 * S, yF - 33 * S, 5 * S), "thin"); add(s, 3, spiral(bk + 1 * S, yF - 25 * S, 3.8 * S), "thin");
    const xa = x + 64 * S;                                  // the bare table: its top and board, an end post, legs
    add(s, 1, line(xa, yT, X[1], yT + J(1), 0.7, 26));
    add(s, 1, line(xa, yT + 4 * u, X[1], yT + 4 * u, 0.7, 26));
    add(s, 1, poly([[xa, yT - 0.4], [xa - 0.6, yT + 4.2 * u]]));
    for (let lx = xa + 22 * u; lx < X[1] - 12 * u; lx += (54 + r() * 10) * u) legs(s, lx);
    // two rolls of linen on the near end, one resting on the other
    for (const [ly, lx, len] of [[yT - 6.8 * S, xa + 5 * S, 50 * S], [yT - 19.6 * S, xa + 12 * S, 44 * S]]) {
      add(s, 3, oval(lx, ly, 3.4 * S, 6.6 * S, 1.04));
      add(s, 3, poly([[lx, ly - 6.6 * S], [lx + len, ly - 6.8 * S], [lx + len + 1 * S, ly + 6.6 * S], [lx + 0.5 * S, ly + 6.8 * S]]), "thin");
    }
  }
  // 1 · linen: the cloth rolled down the table, falling to the floor at its sides
  {
    const s = 1, xc = X[1] + 4 * u;
    chunks(s, X[1], X[2], { floor: true, top: true });
    add(s, 1, line(xc, yT + 0.5, xc - 3.5 * u, yF - 3 * u, 0.5, 12));
    add(s, 1, wave(xc - 3.5 * u, X[2], yF - 3 * u, 1.6 * u, 30 * u));
    for (let x = xc + 26 * u; x < X[2] - 6 * u; x += (34 + r() * 22) * u) fold(s, x);
  }
  // 2 · flowers: a runner of roses set along the linen, and the tapers stood in it
  {
    const s = 2;
    chunks(s, X[2], X[3], { floor: true, top: true, hem: true });
    for (let x = X[2] + 20 * u; x < X[3] - 6 * u; x += (36 + r() * 22) * u) fold(s, x);
    add(s, 3, garland(X[2] + 2 * u, X[3], yT - 4 * u, 3.6 * u), "thin");
    roses(s, X[2], X[3], 24 * u);
    let k = 0;
    for (let x = X[2] + 18 * u; x < X[3] - 8 * u; x += 34 * u, k++) candle(s, x, (k % 2 ? 36 : 46) * u);
  }
  // 3 · chairs: the chairs come in on both sides
  {
    const s = 3;
    chunks(s, X[3], X[4], { floor: true, top: true, hem: true });
    add(s, 3, garland(X[3], X[4], yT - 4 * u, 3.6 * u), "thin");
    roses(s, X[3], X[4], 34 * u);
    let k = 1;
    for (let x = X[3] + 14 * u; x < X[4] - 8 * u; x += 34 * u, k++) candle(s, x, (k % 2 ? 36 : 46) * u);
    for (let x = X[3] + 30 * u; x < X[4] - 10 * u; x += 46 * u) { chairBack(s, x); fold(s, x + 23 * u); }
  }
  // 4 · places: a plate and a glass at every place
  {
    const s = 4;
    chunks(s, X[4], X[5], { floor: true, top: true, hem: true });
    add(s, 3, garland(X[4], X[5], yT - 4 * u, 3.6 * u), "thin");
    roses(s, X[4], X[5], 34 * u);
    let k = 0;
    for (let x = X[4] + 14 * u; x < X[5] - 8 * u; x += 34 * u, k++) { candle(s, x, (k % 2 ? 36 : 46) * u); if (x + 17 * u < X[5] - 6 * u) glass(s, x + 17 * u); }
    for (let x = X[4] + 30 * u; x < X[5] - 10 * u; x += 46 * u) { chairBack(s, x); plate(s, x); fold(s, x + 23 * u); }
  }
  // 5 · finished: the table's end, then the room's one tall bouquet on its plinth beyond it, and a cherry hanging from
  // a blossom branch to sign the drawing
  {
    const s = 5, xe = X[6] - 64 * u;
    chunks(s, X[5], xe, { floor: false, top: true, hem: true });
    add(s, 0, line(X[5], yF + 1.5 * u, X[6] - 4 * u, yF + 1.5 * u, 0.6, 30), "floor");
    add(s, 3, garland(X[5], xe - 4 * u, yT - 4 * u, 3.6 * u), "thin");
    roses(s, X[5], xe - 6 * u, 34 * u);
    let k = 0;
    for (let x = X[5] + 14 * u; x < xe - 10 * u; x += 34 * u, k++) { candle(s, x, (k % 2 ? 46 : 36) * u); if (x + 17 * u < xe - 8 * u) glass(s, x + 17 * u); }
    for (let x = X[5] + 30 * u; x < xe - 14 * u; x += 46 * u) { chairBack(s, x); plate(s, x); }
    add(s, 1, line(xe, yT + 0.5, xe + 3.5 * u, yF - 3 * u, 0.5, 12));
    // the plinth, a little taller than the table, and a vase on it
    const bx = X[6] - 38 * u, pt = yT - 8 * u, vt = pt - 13 * u;
    add(s, 3, poly([[bx - 6 * u, yF + 0.5], [bx - 6.5 * u, pt + 0.6 * u], [bx + 6.2 * u, pt - 0.3 * u], [bx + 5.7 * u, yF + 0.5]]));
    add(s, 3, poly([[bx - 3.2 * u, pt], [bx - 5 * u, pt - 6 * u], [bx - 2.6 * u, vt], [bx + 2.9 * u, vt + 0.4 * u], [bx + 5.2 * u, pt - 6.4 * u], [bx + 3.4 * u, pt + 0.3 * u]]), "thin");
    // stems fanning wide out of the vase, a bloom at each tip, small leaves between: tall and airy, like the film's
    const tips = [[-18, 21], [-12, 32], [-5, 41], [2.5, 44], [9, 36], [15, 26], [-7, 19], [5, 23]];
    for (const [dx, h] of tips) add(s, 3, line(bx + dx * 0.12 * u, vt, bx + dx * u, vt - h * u, 0.4, 7), "thin");
    for (const [dx, h] of tips) add(s, 3, spiral(bx + dx * u + J(1.5 * u), vt - h * u, (h > 30 ? 5.4 : 4.2) * u + r() * 1.8 * u), r() < 0.55 ? "" : "thin");
    for (const [x, y, a] of [[-14, 13, 0.5], [-9, 24, -0.4], [11, 17, 0.4], [-2, 30, 0.2], [7, 28, -0.3]]) {
      add(s, 3, oval(bx + x * u, vt - y * u, 3.1 * u, 1.7 * u, 1.04, a), "thin");
    }
    // a blossom branch arcs out to the right, and two cherries hang from its end
    const br = [[bx + 3 * u, vt - 8 * u], [bx + 12 * u, vt - 13 * u], [bx + 20 * u, vt - 12 * u], [bx + 26 * u, vt - 6 * u]];
    add(s, 3, br.map(([x, y]) => [x + J(0.5), y + J(0.5)]), "thin");
    const [cx, cy] = br[3];
    add(s, 3, line(cx, cy, cx - 6 * u, cy + 15 * u, 0.4, 6), "thin");
    add(s, 3, line(cx, cy, cx + 2.5 * u, cy + 17 * u, 0.4, 6), "thin");
    add(s, 3, oval(cx - 7 * u, cy + 20 * u, 5 * u, 4.8 * u, 2.2));
    add(s, 3, oval(cx + 3.5 * u, cy + 22 * u, 4.8 * u, 4.5 * u, 2.2));
  }

  // one pen: each section is drawn while its stage plays, its strokes one after another, in proportion to their length
  const order = (k) => (k.cls === "floor" ? 9 : k.layer);
  list.sort((a, b) => a.s - b.s || order(a) - order(b) || a.x - b.x);
  strokes = [];
  for (let s = 0; s < SECTIONS; s++) {
    const mine = list.filter((k) => k.s === s), t0 = STAGE_T[s], t1 = STAGE_T[s + 1];
    const lens = mine.map((k) => lenOf(k.pts) + 6 * u), total = lens.reduce((a, b) => a + b, 0);
    let t = t0;
    mine.forEach((k, i) => { const dt = ((t1 - t0) * lens[i]) / total; strokes.push({ ...k, a: t, b: t + dt, d: curve(k.pts) }); t += dt; });
  }

  const NS = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `<radialGradient id="glow"><stop offset="0" stop-color="#FFB561" stop-opacity=".62"/><stop offset=".45" stop-color="#FFB561" stop-opacity=".2"/><stop offset="1" stop-color="#FFB561" stop-opacity="0"/></radialGradient>`;
  svg.append(defs);
  // the pencil guide: the floor line dotted ahead of the pen, and a tick where each stage starts (the stage ruler)
  const guide = document.createElementNS(NS, "path"), ticks = document.createElementNS(NS, "path");
  guide.setAttribute("class", "guide");
  guide.setAttribute("d", `M${f1(2 * u)} ${f1(yF + 1.5 * u)}H${f1(W - 2 * u)}`);
  ticks.setAttribute("class", "ticks");
  ticks.setAttribute("d", X.slice(1, SECTIONS).map((x) => `M${f1(x)} ${f1(yF - 4 * u)}V${f1(yF + 7 * u)}`).join(""));
  svg.append(guide, ticks);
  for (const k of strokes) {
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", k.d);
    el.setAttribute("pathLength", "1");
    el.setAttribute("class", `s ${k.cls}`.trim());
    // CSS draws it from --film: --a is where it starts (film units), --r how fast it draws
    el.style.setProperty("--a", k.a.toFixed(5));
    el.style.setProperty("--r", (1 / Math.max(1e-4, k.b - k.a)).toFixed(3));
    svg.append(el);
    k.el = el; k.len = el.getTotalLength();
  }
  // the candles' flames, lit at random as the film's candles light, then flickering a little
  const fr = rng(77);
  flames.forEach((fl) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "flame");
    g.style.setProperty("--on", (0.16 + fr() * 0.26).toFixed(3));        // with the film's candles (p 0.822–0.846)
    g.style.setProperty("--fd", `${(1.4 + fr() * 1.3).toFixed(2)}s`);
    g.style.setProperty("--fdel", `${(-fr() * 2).toFixed(2)}s`);
    const w = 2.6 * u * (0.9 + fr() * 0.25), h = 10.5 * u * (0.9 + fr() * 0.25), x = fl.x + (fr() - 0.5) * 0.6, y = fl.y;
    g.innerHTML = `<circle class="glow" cx="${f1(x)}" cy="${f1(y - h * 0.45)}" r="${f1(16 * u)}"/><path class="tongue" d="M${f1(x)} ${f1(y)}C${f1(x - w * 1.1)} ${f1(y - h * 0.22)} ${f1(x - w * 0.7)} ${f1(y - h * 0.68)} ${f1(x + w * 0.12)} ${f1(y - h)}C${f1(x + w * 0.6)} ${f1(y - h * 0.62)} ${f1(x + w * 1.05)} ${f1(y - h * 0.25)} ${f1(x)} ${f1(y)}Z"/>`;
    svg.append(g);
  });
  // the nib: where the pen is now
  const nib = document.createElementNS(NS, "g");
  nib.setAttribute("class", "pen-nib");
  nib.innerHTML = `<circle r="${f1(2.6 * u)}"/><circle r="${f1(6.5 * u)}"/>`;
  svg.append(nib);
  G.nib = nib; G.X = X;

  // the notes sit under the start of their section (the last one kept inside the strip), measured with their times
  // showing, as the current one shows them
  const bs = notes.map((n) => n.querySelector("b"));
  bs.forEach((b) => { b.style.display = "inline"; });
  G.noteW = notes.map((n) => n.offsetWidth);
  bs.forEach((b) => { b.style.display = ""; });
  const last = SECTIONS - 1;
  G.noteX = X.slice(0, SECTIONS).map((x, i) => x + (i ? 6 * u : 2 * u));
  if (!G.phone) G.noteX[last] = Math.min(G.noteX[last], view - G.noteW[last] - 2);
  notes.forEach((n, i) => n.style.setProperty("--nx", px(G.noteX[i])));
}

function penFrame(film) {
  const G = geo;
  if (!G?.nib) return;
  css("--pen-t", film.toFixed(5));
  // the nib rides the stroke being drawn
  const on = film > 0.001 && film < 0.999;
  G.nib.classList.toggle("is-on", on);
  if (on) {
    const s = strokes.find((k) => film >= k.a && film < k.b) ?? strokes[strokes.length - 1];
    const q = s.el.getPointAtLength(clamp((film - s.a) / (s.b - s.a)) * s.len);
    G.nib.setAttribute("transform", `translate(${f1(q.x)} ${f1(q.y)})`);
  }
  // a phone: the paper slides under the pen, keeping the part being drawn in the middle; the current note stays in
  // view, holding the left edge once its section has slid past
  if (G.phone) {
    let i = STAGE_T.findIndex((t, j) => film >= t && film < STAGE_T[j + 1]);
    if (i < 0) i = film <= 0 ? 0 : SECTIONS - 1;
    const local = clamp((film - STAGE_T[i]) / (STAGE_T[i + 1] - STAGE_T[i]));
    const x = lerp(G.X[i], G.X[i + 1], local);
    const pan = clamp(G.penView * 0.5 - x, -(G.penW - G.penView), 0);
    css("--pan", px(pan));
    notes.forEach((n, k) => n.style.setProperty("--nx", px(clamp(G.noteX[k], -pan + 2, -pan + G.penView - G.noteW[k] - 2))));
  } else css("--pan", "0px");
}

// —— mount ——
async function start() {
  try { await Promise.all(['400 100px "Noto Serif Display"', 'italic 400 40px "Noto Serif Display"', '400 27px "Nanum Pen Script"', '500 13px "Geist Mono"', '500 15px "Instrument Sans"'].map((f) => document.fonts.load(f))); } catch {}
  measureCap();
  layout();
  addEventListener("resize", layout);
  api = await mountBuild(section, {
    frames: "frames", film: FILM, lit: LIT,
    ...framing(innerWidth, innerHeight),
    // a phone: the film covers a tall frame and the crop follows the subject: the bare table running to the flower
    // buckets; the crew rolling the linen out along its near half; the table in the middle once the camera looks down
    // the room, a little right so the runner's front clears the clock's notch at the bottom left; the crew emptying the
    // chair stacks by the right-hand wall, with the runner's edge still in view (f94–f104); then back to the middle as
    // the chairs come back and land on both sides. The keys are in film time (0..1), like every focus key
    phone: { mode: "cover", zoom: 1, focus: [[0, 0.52, 0.5], [fT(13), 0.5, 0.5], [fT(28), 0.42, 0.5], [fT(52), 0.48, 0.5], [fT(87), 0.47, 0.5], [fT(95), 0.75, 0.5], [fT(104), 0.75, 0.5], [fT(112), 0.47, 0.5]] },
    glide: 3000, glideTo: END_IN + 0.04,
    onUpdate: ({ p }) => frame(p),
  });
  frame(api.p);
}
start();

reveal();
clocks();

// the nav gets a hairline once the hero has scrolled away
{
  const line = () => nav.classList.toggle("is-past", section.getBoundingClientRect().bottom <= nav.offsetHeight + 1);
  addEventListener("scroll", line, { passive: true });
  line();
}

// —— evenings: the prints shuffle as you scroll past ——
{
  const stackEl = document.querySelector(".stack");
  const prints = [...stackEl.querySelectorAll(".print")];
  const rows = [...document.querySelectorAll(".ev-list li")];
  const n = prints.length;
  const POSE = [{ x: 0, y: 0, r: -3, s: 1 }, { x: 22, y: -10, r: 4.5, s: 0.975 }, { x: -24, y: -16, r: -7.5, s: 0.955 }, { x: 10, y: -24, r: 2, s: 0.935 }];
  let shown = -1;
  const draw = () => {
    const b = stackEl.getBoundingClientRect(), vh = innerHeight;
    const c = b.top + b.height / 2;
    const q = STILL ? 0 : 3 * clamp((vh * 0.78 - c) / (vh * 0.5));
    const m = Math.min(n - 1, Math.floor(q)), e = q - m;
    prints.forEach((el, i) => {
      const d = (i - m + n) % n;
      let pose, z;
      if (d === 0 && e > 0) {
        // the top print slides out to the right, away from the words, and back in at the bottom of the pile
        const out = innerWidth < PHONE ? { x: b.width * 0.62, y: -14, r: 9, s: 0.98 } : { x: b.width * 0.46, y: -40, r: 11, s: 0.98 };
        const back = POSE[n - 1];
        if (e < 0.5) { const k = smooth(e * 2); pose = { x: lerp(POSE[0].x, out.x, k), y: lerp(POSE[0].y, out.y, k), r: lerp(POSE[0].r, out.r, k), s: lerp(1, out.s, k) }; z = n + 1; }
        else { const k = smooth((e - 0.5) * 2); pose = { x: lerp(out.x, back.x, k), y: lerp(out.y, back.y, k), r: lerp(out.r, back.r, k), s: lerp(out.s, back.s, k) }; z = 0; }
      } else {
        const from = POSE[d], to = POSE[Math.max(0, d - 1)], k = smooth(e);
        pose = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), r: lerp(from.r, to.r, k), s: lerp(from.s, to.s, k) };
        z = n - d;
      }
      el.style.setProperty("--tx", `${pose.x.toFixed(1)}px`); el.style.setProperty("--ty", `${pose.y.toFixed(1)}px`);
      el.style.setProperty("--rot", `${pose.r.toFixed(2)}deg`); el.style.setProperty("--sc", pose.s.toFixed(4));
      el.style.zIndex = z;
    });
    const top = (e < 0.5 ? m : m + 1) % n;
    if (top !== shown) { shown = top; rows.forEach((r, i) => r.classList.toggle("is-on", i === top)); }
  };
  let ticking = false;
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; draw(); }); } }, { passive: true });
  addEventListener("resize", draw);
  draw();
}

// —— enquire: a demo form, nothing is sent ——
{
  const form = document.querySelector(".enq-form");
  const datesEl = form.querySelector(".dates");
  // six Saturdays, starting about five months out
  const d = new Date();
  d.setDate(d.getDate() + 150);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  for (let i = 0; i < 6; i++) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "date"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", i === 1 ? "true" : "false");
    b.innerHTML = `<small>Sat</small><span>${day.format(d)}</span>`;
    datesEl.append(b);
    d.setDate(d.getDate() + 7);
  }
  // a radio group of buttons: click to pick; arrow keys move the pick, and only the picked one is in the tab order
  const radio = (group, cls) => {
    const items = () => [...group.querySelectorAll("button")];
    const pick = (b, focus) => {
      items().forEach((x) => { const on = x === b; x.setAttribute("aria-checked", on ? "true" : "false"); x.tabIndex = on ? 0 : -1; if (cls) x.classList.toggle(cls, on); });
      if (focus) b.focus();
    };
    group.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) pick(b); });
    group.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const all = items(), i = Math.max(0, all.indexOf(document.activeElement));
      pick(all[(i + dir + all.length) % all.length], true);
    });
    pick(items().find((x) => x.getAttribute("aria-checked") === "true") ?? items()[0]);
  };
  radio(datesEl);
  radio(form.querySelector(".chips"), "is-on");
  const out = form.querySelector(".count");
  let guests = 64;
  form.querySelectorAll(".step").forEach((b) => b.addEventListener("click", () => { guests = clamp(guests + Number(b.dataset.step), 8, 400); out.textContent = guests; }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.querySelector(".sent-note").textContent = "Thank you! (A demo: nothing was sent.)";
  });
}
