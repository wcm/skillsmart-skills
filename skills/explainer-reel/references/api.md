# The reel API

A reel is one ES module with a default export. `build` receives the API; nothing else is imported.

```js
export default {
  title: "5 tiny habits that calm your nervous system",
  look: "halftone",          // the filter: halftone led crt neon riso blueprint dither chalk
  palette: "ember",          // leave out for the look's own; riso needs a light palette, the rest a dark one
  colors: { accent: "#ffcc66" }, // override any role
  stroke: "mono",            // default line style: mono dotted dashed sketch (chalk defaults to sketch)
  dots: 5,                   // progress dots for a list; 0 or leave out for none
  sound: { bed: "warm", sfx: true, volume: 1, bedGain: 1, sfxGain: 1, chime: { pitch: 880, decay: 4.2, gain: 1 } }, // bed: warm night bright tense none; chime: the bell for dots and "Saved"
  voice: { voice: "Callirrhoe", style: "Slow, soft and warm, close to the microphone…", language: "en" }, // voice.md
  format: "9x16",            // the format the preview and check open in: 9x16 4x5 1x1 16x9 (make.mjs --format picks the MP4s)
  caption: { y: 1440, size: 50, maxWidth: 820, font: "sans", hide: false },
  grain: 1,                  // film grain amount (0 for none; it costs bitrate)
  crispText: true,           // labels, numbers and readouts drawn crisp above the screen, moving with the camera
                             // (halftone's default); false sends them through the screen like the drawings
  fps: 30, tail: 0.8,        // tail: seconds held after the last beat
  build({ beat, pause, add, clear, dots, camera, sfx, S, cx, cy, W, H, now }) { … },
};
```

Coordinates are pixels on the 1080 × 1920 design frame, y down. `cx, cy` = 540, 900 (the middle of the picture).
Write every reel in these coordinates, whatever the format: each format maps the picture band (y 110–1360) into its
own frame (below), and places the captions and the pill itself.

## Formats

| Format | Frame | The picture | The captions |
| --- | --- | --- | --- |
| `9x16` | 1080 × 1920 | as written | under it, y 1440; the pill at 1640 |
| `4x5` | 1080 × 1350 | scaled 0.86 | under it |
| `1x1` | 1080 × 1080 | scaled 0.7 | under it |
| `16x9` | 1920 × 1080 | scaled 0.86, on the left | in a column on the right |

Keep the subject inside x 120–960 and anything important inside the band; full-bleed things (stars, flow fields,
swarms scattered wide) may run past it. Small text grows a little in the smaller formats so it stays readable.
`check.mjs --format 16x9` shows a format's sheet and audits its layout (Instagram's buttons only in 9:16).

## Time

| Call | Does |
| --- | --- |
| `beat(text, { hold, say }?, fn?)` | A caption line. Moves the playhead to the moment it starts; everything after it (or inside `fn`) happens then. `*word*` is bold; `hold` adds seconds after it; `say` is what the voice reads instead of the caption ("a hundred and forty-nine thousand dollars" for "$149,000."). Returns the beat. |
| `pause(sec, fn?)` | Silence with pictures (no caption). Same playhead rule. |
| `at:` on any call | When, inside the current beat: a word of the caption (`"vagus"`, `"one#2"` for the second "one"), seconds from the beat start (`0.4`, `-0.2`), `"start"` or `"end"`. |
| `delay:` | Seconds added after `at`. |
| `now()` | The playhead in seconds. |

Timing comes from the voice-over when `<reel>.timing.json` exists (`scripts/voice.mjs`), matched to beats by
their words, so every beat and every `at` word lands on the voice; otherwise it is estimated (~170 wpm, pauses
at punctuation). A beat whose words aren't in the voice-over, or voice-over lines the reel no longer has, warn
(check fails) until the voice is made again. `hold` and `pause()` become silence in the voice-over too.

## Adding things

Every `add.*` takes the common options and returns an element.

Common options: `x, y` (default: the centre), `scale`, `rot` (degrees), `color` (a role or a hex), `width`,
`parent` (a group or any element: position, scale and opacity are inherited), `in` (an entrance, or `false` to
stay hidden until `.in()`), `at`, `delay`, `dur`, `ease`, `z`.

| Call | What it is | Own options |
| --- | --- | --- |
| `add.line(shape, o)` | any drawing from `S` (or path data) | `stroke` mono/dotted/dashed/sketch/points (sparkling particles along the path), `hatch` (engraved shading inside the closed parts: `{ gap, angle, shade: "light" \| "sphere" \| "flat", light, cross, width, alpha, color }`), `dash`, `gap`, `fill` + `fillAlpha`, `dots` (a halftone dot fill inside the closed parts: `{ shade: "light" \| "sphere" \| "edge" \| "flat", light: [x, y], color, gap, size, alpha, rule: "evenodd" for holes }`; on a look with a dot screen the grid snaps to it), `mode` all/seq (draw parts together or in order), `tip` (spark while drawing), `thin` |
| `add.wave(o)` | the breathing waveform ring | `r` 330, `amp` 9 (px), `n` 34 (waves round), `jag` (px of fast jitter: 10–20 reads as agitated), `speed`, `wobble` |
| `add.blob(o)` | a soft wobbling closed shape (a wave with few lobes) | as wave; defaults `n` 6, `amp` 22, accent |
| `add.ring(o)` | circle or arc (0° = up, clockwise) | `r`, `from`, `to`, `dash`, `ticks: { n, len, every, major, offset, width, color }`, `knots: [deg…]` |
| `add.text(s, o)` | words. HUD style by default (mono, uppercase, tracked) | `font` hud/sans/mono/pixel/serif/hand, `size` 22, `weight`, `align` center/left/right, `upper`, `track` (em), `layer` "ui" (crisp, no screen, fixed to the frame like the captions) |
| `add.counter(o)` | a number that counts | `from`, `to`, `dur`, `format` int/clock/mmss/pct/money/x/1 or `(v) => string`, plus text options |
| `add.label(s, o)` | dot + leader line + typed label | `from: [x, y]` (use `el.at("anchor")`), `to: [x, y]` (where the text starts), `sub` (a second line), `subColor`, `size` |
| `add.timer(o)` | tick ring, sweeping arc, number, word under | `r` 54, `value` (shown), `label`, `sweep` (seconds the arc takes to go round, default 3), `countdown` (`true`: the number falls by `sweep` seconds while the arc sweeps; a number: falls by that much), `format` (`mmss` shows `value: 300` as 5:00) |
| `add.node(o)` | a glowing dot with a word under | `r`, `label`, `pulse` (true or period) |
| `add.orb(o)` | light: a solid glowing core with a halftone halo (*you*, a sun, a blessing) | `r` 12, `halo` 4.5 (× r), `gap`, `color` |
| `add.swarm(o)` | thousands of glowing points that take a shape | `shape` (any `S` shape, placed by `x y scale rot`; or `{ kind: "cloud" \| "field" \| "disc" \| "ring" \| "line" \| "point", … }`; or `[[x, y]…]`), `count` 2400, `size`, `color`, `mix: { color, share }`, `edge` (share on the outline; the rest fill the closed parts), `shade` light/sphere/edge (denser where lit), `jitter`, `drift`, `twinkle`, `alpha` |
| `add.shape3d(o)` | a turning 3D form in perspective | `kind` sphere/globe/rings/torus/helix (or `points` / `lines` in unit coordinates), `r`, `count`, `craters` (sphere), `light: [x, y, z]` (a lit side and a terminator), `tilt`, `spin` (°/s), `size`, `width`, `alpha` |
| `add.flowfield(o)` | hundreds of trails streaming through a moving field | `kind` curl/stream/vortex/converge, `x y w h` (area), `dir` (stream), `target` (vortex, converge), `count`, `speed`, `life`, `trail`, `noise`, `width`, `alpha` |
| `add.chart(o)` | axes + a series that draws left to right | `w` 560, `h` 220, `data` (preset, array 0–1, or `(x) => y`), `kind` line/steps/bars, `range`, `cycles`, `beats`, `axes`, `title` (top left), `value` + `valueColor` (top right, e.g. `"4 IN · 8 OUT"`; `chart.value.swap(…)` changes it), `xlabels`, `ylabels`, `dur` |
| `add.clock(o)` | 24 h or 12 h face, a hand, spans | `r` 230, `hours`, `hand` (hour), `handColor` |
| `add.ruler(o)` | a scale with ticks and a marker | `w`, `ticks`, `major`, `labels: { 0: "0", 0.5: "15", 1: "30 Y" }`, `marker` (0–1) |
| `add.frame(o)` | viewfinder corners | `w`, `h`, `corner`, `tl` (top-left words), `rec` (blinking REC), `bl` |
| `add.link(from, to, o)` | a curved line between points | `bend` 0.3 (a fraction of the length; positive bends to the left of travel, so a left-to-right link arches up; negative the other way), `arrow`, `dashed`, `flow` (travelling dots), `label` |
| `add.flow(shape, o)` | dots travelling along a path | `count`, `speed`, `size`, `once` |
| `add.particles(o)` | stars, dust, rise, fall, orbit, converge, burst | `kind`, `count`, `w`, `h` (area) or `r`, `size`, `speed`, `seed`, `tilt` (orbit) |
| `add.galaxy(o)` | a particle spiral that spins and grows from its core | `r` 200, `arms` 2, `count` 900, `spin` (°/s), `turns`, `core` (colour) |
| `add.rays(o)` | rays out from a point: a burst or a fan | `r0`, `r1`, `count`, `from`, `to` (degrees), `dash`, `vary` |
| `add.pulse(o)` | rings rippling out | `r0`, `r1`, `dur`, `count` (or `Infinity`), `every` |
| `add.pill(s, o)` | the CTA pill under the caption | `icon` chat/check/heart/bookmark; `.swap("On its way", { at, icon })` |
| `add.group(o)` | an invisible parent to move things together | |

Composite parts are reachable: `timer.num`, `timer.sweep`; `label.dot/.lead/.text/.sub`; `chart.series/.title/.value/.axes`;
`clock.hand/.face`; `ruler.marker`; `link.line/.head/.flow`; `frame.corners/.rec`; `node.dot/.label`.

## Changing things

| Method | Does |
| --- | --- |
| `el.in(how, { at, delay, dur, ease })` | entrance: `draw` (lines, rings, waves), `type` (text), `pop`, `grow`, `rise`, `fade`, `flicker`, `cut` |
| `el.out(how, o)` | exit: `fade`, `undraw`, `shrink`, `drop`, `cut` |
| `el.to(props, { at, delay, dur, ease })` | tween `x y scale rot opacity color width` and kind-specific ones: `r amp jag` (wave), `r from to` (ring), `value` (counter), `draw drawStart` (trim, 0–1) |
| `el.set(props, o)` | jump without a tween |
| `el.dim({ opacity })` | fade back to 0.3 to make room |
| `line.morph(shape, { at, dur, ease })` | become another drawing (any subpath count; extras grow or collapse) |
| `swarm.form(shape, o)` | the points fly to a new shape: `x y scale rot`, `at`, `dur`, `swirl` (px of curl on the way), `stagger` (0–1), `from` left/right/top/bottom/center (a wave), `edge`, `shade`, `order` angle/x/y/random, `spin` (°/s once there) |
| `swarm.scatter(o)` / `swarm.burst(o)` | into a loose cloud / outwards in a ring |
| `chart.morph(data, { at, dur, color })` | the series becomes another data set (chaos → sine, noise → flat) |
| `text.swap(s, { at, how })` | new words, typed (`how: "cut"` to switch) |
| `clock.turn(hour, o)`, `clock.span(h0, h1, { color, label })` | turn the hand; add an arc for a span |
| `ruler.move(f, o)` | move the marker (0–1) |
| `el.loop(kind, { at, until, amp, period, speed })` | ambient: `breathe` (scale), `float`, `spin` (°/s), `sway`, `blink`, `flicker`, `pulse` (rings) |
| `el.stop(kind, { at })` | end a loop |
| `el.pulse({ anchor, color, r1, count })` | one ripple from the element (or an anchor) |
| `el.at("anchor", when?)` | where an anchor is on the frame: at the playhead (the beat's start), or at a word or time of the beat: `me.at("throat", "vagus")`. Read it after the element has its final shape and place (a hero still mid-morph, or about to move, gives the old spot); a name the shape doesn't have warns and gives the centre |

Eases: `linear in out inOut back spring step` or a function.

## Scene calls

| Call | Does |
| --- | --- |
| `clear({ keep: [hero], how: "fade", at, dur })` | every top-level element on screen leaves, except those kept (and the progress dots) |
| `dots.set(k, { at })` | fill the first k progress dots, ripple the k-th, chime |
| `camera.to({ x, y, zoom, rot }, { at, dur })` | move the view (x, y = the point at the centre); captions stay put |
| `sfx(kind, { at, gain, dur })` | a sound cue by hand: `tick pop type draw whoosh chime thump sparkle rise` |

Elements already cue their own sounds (labels tick, text types, morphs whoosh, dots chime).

## Chart data presets

`ecg` (heartbeat, `beats` per width), `chaos` (stressed, jagged), `sine` (`cycles`), `decay` (spike then fade),
`growth` (exponential), `rise`, `drop`, `flat`, `sleep` (stages, drawn as steps). Or an array of 0–1 values, or
a function of x in 0–1. `range: [lo, hi]` rescales.
