# The scenes

Generated from `assets/engine/scenes/` by the project's `scripts/docs.mjs`. Each scene draws one technique;
its options are its words, numbers, shapes, colours and moves. Every scene also takes the common options:

| Option | What it does |
| --- | --- |
| `beats` | how long it lasts, in beats (the reel's beats add up to whole bars of 4) |
| `label` | its name in the HUD |
| `bg` | its ground, a palette role or a colour (scenes read their ink from it) |
| `ground` | a painted ground over `bg`: `{ gradient: [roles…], angle }` or `{ radial: [roles…], at: [x, y], r }` |
| `in`, `out` | a transition into it, or out of it into the next scene (references/transitions.md) |
| `warp` | its time remapped: `"reverse"`, `"boomerang"`, `"snap"`, `"rush"`, `"hold"`, `"stutter"`, or knots `[[x, y], …]` (both 0..1: how far through the scene on screen, how far through its motion). Knots can also play just part of a scene: `[[0, 0], [1, 0.42]]` plays its first 42 % |
| `hits` | beats (in the scene) where it hits: with `energy`, a shake, a flash and a colour split |
| `energy` | this scene's own energy (the reel's by default; 0 for none) |
| `slow` | slow motion: it plays over `slow` × its beats |
| `grid` | a faint dot grid on the ground |
| `hud` | `false` to hide the HUD over it, `"top"` for its top row only |
| `grain`, `samples`, `shutter` | film grain (0..1), a cap on its motion-blur samples, its shutter (frames) |

| Kind | Scenes |
| --- | --- |
| Type | [`title`](#title), [`cells`](#cells), [`words`](#words), [`path`](#path), [`orbit`](#orbit), [`endcard`](#endcard) |
| 3D | [`points`](#points), [`lattice`](#lattice), [`cloud`](#cloud), [`voxels`](#voxels) |
| Pattern and shape | [`phyllotaxis`](#phyllotaxis), [`morph`](#morph), [`crack`](#crack), [`fractal`](#fractal), [`halftone`](#halftone) |
| Motion | [`ribbons`](#ribbons), [`flow`](#flow), [`blob`](#blob) |
| Data | [`dashboard`](#dashboard) |
| Burst | [`rhythm`](#rhythm) |
| Time | [`rewind`](#rewind) |

---

# Type

## title

Kinetic title. A fitted column of type, one line per beat, every line sized so it spans the
column on its own. Each glyph builds the same way: its contours trace themselves as outlines,
then a fill wipes up through it from the bottom, and the outline goes.

  beat 0     on the accent ground: the first rule draws, the kicker fades up through two frames
             of scrambled letters, and the first heavy word traces and fills letter by letter
  beat 1     the next heavy word the same way, over its own rule (the rows share the beats
             before the flip: one a beat for two words, every 2/3 beat for three)
  flip (2)   hard cut (on a whole frame) to the second ground, ink by default: every line takes
             the ink that reads on it; the italic serif line traces and fills, its rule already
             running from just before the flip. Without a flip the line follows the rows.
  flip+0.87  the accent hit: corner brackets fly in around the last word of the serif line (the
             hero noun), the accent full stop pops in after it and the mono caption appears
  flip+0.93  a weight wave: each heavy glyph thins 900 → 120 (its middle on beat flip+1.15),
             staggered by letter and row, each centred on its bold slot; the caption's number is
             the first glyph's live weight
  always     a slow push-in of the whole group about the full stop
  last 1/2   an exponential zoom-through into the full stop (×12 on the last frame), streaked by
             the engine's shutter: the dot it hands on to the next scene

The layout is the original's, measured in the 1080×1920 frame and scaled to g.box, so other
aspect ratios keep the rhythm. The engine's shutter blur makes the zoom streak; nothing here
re-implements it. Timings are in beats (the original's seconds at 111 BPM).

`{ type: "title", beats: 4 }` · KINETIC TYPE · ground `accent`

| Option | Default | |
| --- | --- | --- |
| `kicker` | `"SHOWREEL --- 2026"` | mono kicker above the words; a run of dashes becomes em dashes, the part before it is tracked wider |
| `words` | `["MOTION","DESIGN"]` | one to three heavy words, a row a beat, each fitted to the column |
| `line` | `"in Claude"` | the italic serif line on the flip; its last word is the hero (bracketed); "" for none |
| `dot` | `true` | the accent full stop after the line (the zoom target) |
| `flip` | `2` | the beat the ground flips; null to stay on one ground |
| `bg2` | `"ink"` | the ground after the flip |
| `thin` | `true` | the weight wave after the flip |
| `thinTo` | `120` | the weight the wave thins the heavy words to (100-900) |
| `caption` | `"wght {w}  ·  axis 100-900"` | accent mono caption at the hit; {w} is the live number; "" for none |
| `count` | `null` | [from, to, decimals]: what {w} counts in step with the wave; null = the weight itself |
| `push` | `0.0049` | slow push-in about the full stop, scale per beat |
| `exit` | `"zoom"` | "zoom" through the full stop over the last half beat, or "none" |

## cells

Cells: type set on a grid, one cell at a time, and every lit cell a particle. A word (or a few
lines) is rasterised onto a strict grid of squares, dots or crosses; then it plays your steps:
it builds in a scan, holds, shakes, scatters, falls into a heap, or rearranges into another
word cell by cell. Order to disorder in one picture.

  steps: [
    { move: "build", by: "scan", beats: 1.5 },      cells switch on row by row, a scan line ahead
    { move: "hold", beats: 1 },
    { move: "jitter", amp: [0, 0.8], beats: 1 },    they shake harder (in cells)
    { word: "CHAOS", beats: 1 },                     the cells run to another word
    { move: "fall", beats: 1.5 },                    they drop and pile up at the bottom
  ]

Step options: move (build, hold, jitter, scatter, fall, morph: to the step's word, wave), word
(a step with a word and no move morphs to it), beats, ease, stagger, by (build/morph/fall order:
"scan" row by row, "column", "random", "centre" out), amp (jitter: [from, to] in cells), heat
(the share of cells in the accent, a number or [from, to]), power (scatter).

`{ type: "cells", beats: 4 }` · TYPE / CELLS · ground `paper`

| Option | Default | |
| --- | --- | --- |
| `words` | `["ORDER"]` | the lines of type, set on the grid |
| `cell` | `26` | the grid's pitch, px |
| `shape` | `"square"` | each lit cell: "square", "dot", "plus" or "cross" |
| `fill` | `0.82` | how much of its cell a lit cell fills |
| `color` | `null` | the cells' colour (role); null = the ink that reads on the ground |
| `accent` | `"accent"` | the colour heat turns them |
| `heat` | `0` | the share of cells in the accent to begin with |
| `marks` | `true` | the faint dot at every unlit cell |
| `weight` | `900` | the type's weight before it is rasterised |
| `tall` | `1` | the type stretched up before it is rasterised (2 = twice as tall): poster-tall letters |
| `steps` | `[{"move":"build","by":"scan","beats":1.6},{"move":"hold","beats":1.2},{"move":"jitter","amp":[0,0.7],"heat":[0,0.25],"beats":1.2}]` |  |
| `panel` | `["GRID {cols}×{rows}","CELLS {on}","ORDER {order}%"]` | top-left readout (case kept): {cols} {rows} {on} {order} {move} |

## words

Words, one a beat. A four-word manifesto cut hard on every beat (EVERY / SINGLE / FRAME /
on purpose.), each word its own typographic treatment on its own ground, with the mono
read-outs of the tool that would have made it. Timings are in beats from each word's start
(the original's frames at 111 BPM, 32.43 a beat); the layout is the original's, measured in
the 1080×1920 frame and scaled to the HUD box. The scene's shutter is 0.85 frame, as the
original's blur is: the slides, the slam and the sweep streak through the engine's samples.

  stack       (sky) a type specimen. The letters stack one a row, stretched wide, and slide in
              from the right 0.7 frame apart on a fast exponential (settled by 0.3); guides,
              CAP, BASELINE and the row ids fade in (0.09), the accent caret after the last
              letter (0.22, then flashing every quarter beat), the font / size / TRACKING panel
              (0.25), the counter (0.31), the accent I-beams with their kerning deltas (0.37);
              then the tracking closes (0.40–0.83, in-out): the rows pull together about the
              stack's centre while TRACKING counts down to +00 and the deltas to their finals.
  repeat      (ink) the word as a wall of outlined rows, alternate rows drifting ±81 px a beat
              after a fast streaked start (settled by 0.3). The real one slams in at 1.6× on a
              damped spring (settled by 0.55), tilted −2.3°, streaked sideways until 0.12, with
              a warm accent glow; the selection box (8 handles, INSTANCE, live W/H, FILL) appears
              at 0.15; the fill turns accent → paper over 0.46–0.53 (FILL reads the real hex);
              a small pulse at 0.9.
  viewfinder  (a gradient turned from the cool: violet top right → cool → teal bottom left)
              white heavy caps with a fixed warm / cold fringe glitch in, cut into ~12 slices
              that jump sideways, some split, some in a fringe colour (0–0.22, a new pattern
              each frame); camera brackets slam in from outside to an undershoot (0.14–0.3) and
              settle by 0.74; the OSD (REC, AF-C, EV, ISO, the live frame) at 0.28; the thirds
              grid, crosshairs and tick scales fade up (0.31–0.77); the word pushes in 4.6%
              (0.2–1); the REC dot is lit for the third quarter of each beat.
  bands       (paper) an editorial italic serif, two lines (or one word, larger): an accent
              band sweeps in from the left on an exponential (0–0.2) and inverts the ink (paper
              on the band, ink off it); the letters rise in one by one along the slant, the
              second line a frame later (0–0.2); a redder and a blush stripe unfold out of the
              band's edge (0.15–0.43); a calligraphic swash draws under the last line
              (0.28–0.71); a ring goes out (0.37) and the accent full stop pops on a spring
              (0.43; it is s._.anchor); the specimen caption and the counter fade in (0.37–0.52).

  grid        (paper) order: heavy caps on a drawn baseline grid, guides first, then the letters
              switching on one by one with no easing at all, each with a one-frame accent box.
  glitch      (ink) the word torn into slices that jump sideways a new way every two frames,
              with accent and cool copies split off it; it calms a little but never heals.
  pixel       (cool) the word losing resolution: its blocks grow in steps (6 → 64 px) while
              more and more of them drop out and fall away.
  dust        (paper) the word crumbling from left to right: a ragged front eats it and what
              it leaves blows away as specks of ink and accent. Lowercase words set in the serif.
  overflow    (deep) a number too big for the frame: it slams in oversized, keeps pushing in
              and pans across itself, in an accent-to-sun gradient. "10^100" sets the power
              raised; "∞" is drawn, not set.

The word changes on the frame (t.bq), so the shutter never blends two words. Words of 3 to 9
letters fit every style; the serif lines are fitted and stacked by their real ink. Every
visible string is a param whose default is the original's; {i}/{n} in the counter are the
word's number and the word count, {k} the row, {hex} the real fill, {w} {h} {fps} {f} live
values. Colours are palette roles only: the gradient, fringes and the second stripe are
turned from cool and accent in HSL.

`{ type: "words", beats: 4 }` · TYPOGRAPHY · ground `sky`

| Option | Default | |
| --- | --- | --- |
| `words` | `["EVERY","SINGLE","FRAME","on purpose"]` | one per beat; caps words for the first three, the last reads best as one or two lowercase words |
| `styles` | `null` | a style per word; default stack, repeat, viewfinder, bands (then round again) |
| `per` | `1` | beats per word |
| `count` | `"WORD {i}/{n}"` | the word counter (stack and bands); "" for none |
| `font` | `"MONTSERRAT BLACK"` | stack: the specimen's font name |
| `sizes` | `"400  /  340 PT"` | stack: the weight / size line under it |
| `cap` | `"CAP 0.72"` | stack: the label on the cap line |
| `tracking` | `"TRACKING"` | stack: the tracking label |
| `track` | `40` | stack: the tracking the counter starts from; it counts down to +00 |
| `baseline` | `"BASELINE 0"` | stack: the label on the first baseline |
| `row` | `"R{k}"` | stack: the row ids on the guides; {k} is the row, two digits |
| `kerns` | `[-32,-18,-41,-26]` | stack: final kerning deltas at the I-beams, rows 2…; extra rows get seeded ones |
| `instance` | `"INSTANCE 041 / 072"` | repeat: above the selection box |
| `dims` | `"W {w}  H {h}"` | repeat: live size under the box |
| `fill` | `"FILL {hex}"` | repeat: the fill read-out, in the fill colour; {hex} is the real one |
| `rec` | `"REC  {w}×{h} · {fps}P"` | viewfinder: top left after the REC dot |
| `af` | `"AF-C"` | viewfinder: top right, before the focus glyph |
| `ev` | `"±0.0 EV"` | viewfinder: over the right tick scale |
| `iso` | `"ISO 400  ƒ/2.8"` | viewfinder: bottom left |
| `frame` | `"F{f} · 180°"` | viewfinder: bottom right; {f} is the live frame, four digits |
| `face` | `"INSTRUMENT SERIF ITALIC"` | bands: the caption's first line |
| `pts` | `"420 PT  /  301 PT"` | bands: the caption's second line |
| `dot` | `true` | bands: the accent full stop (and its ring) after the last word |

## path

Path: a mark drawn along a path, as a thick striped ribbon that draws itself and then never
stops flowing, and / or a line of type running along it. The ∞ that opens a reel, a spiral
of words winding into its centre, a wave, a rose, a logo's own outline. With a title set
under it, it is a title scene; with text and no stripes, it is type on a path.

  path     "infinity" (a lemniscate), "spiral" (a log spiral, outside in), "circle", "wave",
           "rose-5", an svg path ({ d, view }) or [[x, y], …] (in -1..1, a smooth curve through)
  stripes  the ribbon's bands, outside in: [role, width px]; [] for none
  draw     when the ribbon draws itself on: [from, to], fractions of the scene
  flow     how fast its dashes run along it (px per beat); dash: [on, off] px
  text     a line of type to run along the path (it repeats to fill it); textFlow: px per beat
  words    the title's heavy lines, line its serif line; title: "below" | "above" | "none"
  push     how much it pushes in about its anchor over the scene (0.3 = 30 %)
  anchor   the point it hands on: "crossing" (the ∞'s centre), "centre", "end", or [x, y]

`{ type: "path", beats: 4 }` · PATH · ground `deep`

| Option | Default | |
| --- | --- | --- |
| `path` | `"infinity"` |  |
| `size` | `0.86` | the path's width, a fraction of the stage width (over 1 runs off the frame) |
| `stripes` | `[["accent",64],["sun",40],["paper",18]]` |  |
| `draw` | `[0.05,0.42]` |  |
| `ease` | `"inOutCubic"` | the draw-on |
| `flow` | `260` |  |
| `dash` | `[70,46]` |  |
| `text` | `null` |  |
| `textSize` | `46` |  |
| `textFlow` | `220` |  |
| `textColor` | `"paper"` |  |
| `spin` | `0` | degrees it turns over the scene |
| `words` | `["ZOOM IN"]` |  |
| `line` | `"forever"` |  |
| `title` | `"below"` |  |
| `push` | `0.35` |  |
| `anchor` | `"crossing"` |  |
| `readout` | `["PATH / {name}","L = {len} px","s = {s}"]` | top-left (case kept): {name} {len} {s} |
| `name` | `null` | the readout's name; default from the path |

## orbit

Type on a path. Four tiers of the topic's words, tracked out to fill four circumferences, are
scanned in as straight rows, scroll in alternating directions, then curl (curvature 0 → 1/R)
into concentric rings round the accent dot: heavy caps, filled and outlined in turn, accent dots
between the words, each glyph turned to its own θ. A radar playhead sweeps clockwise and lights
the glyphs it passes; then the rings spin up under rotational blur and spiral into the dot, and
the next scene's ground irises open from the dot. Beat by beat (2 beats; the times are the
original's, in beats, and stretch with the scene):
  0.01–0.26  a scan line sweeps down (out-quart, 'SCAN y=…' riding it, gone by 0.33) and reveals
             the rows one per frame, each glitching in for two frames (sliced, accent and cool
             ghosts); the rows already scroll fast (ω 5.9 rad/s; ring 1 right, ring 2 left …).
             The readouts fade in (0.03–0.11).
  0.11–0.45  the scroll brakes (ω = 0.42 + 5.5·e^(−t/0.055 s)); from 0.14 the rows curl into
             circles (λ in-out cubic over 0.31 beat, each inner row ~0.02 beat later, each row's
             apex gliding to its ring top). The readout reads κ, λ and ω live, then 'PATH /
             CIRCLE ×4'.
  0.31–0.50  the accent dot (r 25) pops in at the centre on a spring, with a broken crosshair.
  0.45–1.03  the rings turn slowly (0.42 rad/s, alternating); a playhead (hairline + soft wedge)
             sweeps clockwise at 582°/s from 12 o'clock and lights the glyphs at it in the
             accent (from 0.47; 'PLAYHEAD θ …' readout from 0.52).
  1.06–1.80  spin-up (ω = 0.42 + 313·t² rad/s) under rotational blur; from 1.40 the rings and
             their type shrink together (s = 1 − u²) and spiral into the dot (the R readout
             counts down, glitching). The readouts clear (1.74–1.78).
  1.79–2.00  the next scene's first frame irises open from the dot's edge (out-expo, the frame is
             full in ~2 frames): with the end card, paper and its dot at the same place.

`{ type: "orbit", beats: 2, out: {"type":"iris","beats":0.215,"ease":"outExpo"} }` · TYPE ON PATH · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `words` | `[["MOTION DESIGN","ANIMATION","ART DIRECTION"],["TYPOGRAPHY","3D","GENERATIVE","DATA"],["TIMING","EASING","RHYTHM"],["COLOR","SHAPE","LINE"]]` | one list of words per ring, outer first; or one flat list, shared out over `rings` (the outer ring gets about three) |
| `rings` | `4` | rings, when words is a flat list (1–6) |
| `phase` | `[46.5,-40,-83.5,24]` | where each ring's text is centred, degrees clockwise from 12 o'clock, before it turns |
| `title` | `"PATH / LINE → CIRCLE"` | readout title while the rows are straight |
| `titleRing` | `"PATH / CIRCLE ×{n}"` | readout title once they are rings; {n} rings |
| `curve` | `"κ = {k}   λ = {l}"` | readout line 2: curvature and curl |
| `count` | `"GLYPHS {n}   ω {w} rad/s"` | readout line 3: glyph count and turn rate |
| `radius` | `"R {r}"` | bottom-right title; {r} the live radii joined with " / " |
| `sub` | `"text-on-path · per-glyph θ"` | bottom-right line 2 |
| `playhead` | `"PLAYHEAD θ {a}°"` | bottom-right line 2 while the playhead sweeps |
| `scan` | `"SCAN  y={y}"` | the label on the scan line |

## endcard

End card. The accent dot is carried in at the centre of the frame and becomes a pen: it
flies to the first letter of the wordmark and writes it. Each glyph traces its own outline
(the real contours, traced from the font once in prepare), then fills from the baseline up,
while the pen zig-zags through the word just ahead. The pen lands as the full stop with a
ring; the role, a rule, a typed tagline and the spec line cascade in under it. It holds,
and for its last beat the dot (the engine's iris from s._.anchor) opens into the next scene.
For the last scene of a reel that is the first scene, so the reel loops through the dot.

Beats from the scene start (the original's, at 111 BPM). With more or fewer beats before
the iris, the whole build stretches by k = visible beats / 3, so 5 beats build over 1.33×:
  0–0.185    the dot settles at the frame centre, r 37 → 31.5 (as the scene before handed it on)
  0.185      it launches: a 0.09-beat flight to the first glyph's left side (0.42 em up), shrinking
             to the pen nib (0.03 em), faint echoes of it one and two frames behind
  0.37–0.96  write-on: glyph i traces its outline in 0.124 beat (from its top-left shoulder,
             down its left side first), the starts quick then settling (C l a u d e at +0, .06,
             .15, .28, .37, .46). Its fill rises from the baseline 0.205 beat after its outline
             began, over 0.074 beat with a soft edge, and then it is plain type. The pen hops to
             each glyph's left edge as it starts and swings between 0.13 and 0.68 em above the
             baseline, n − 1 swings, the last one down
  0.96–1.07  the pen rises above the end of the word; 1.08–1.165 it drops into the full stop,
             sliding right ever faster and growing to r 0.073 em in its last frames
  1.165      landing: the ring pulses out (r 1.1 → 4.8 × the dot, 2 px, α .5, fading over the
             second half of 0.83 beat). The lockup pushes in 1.8 % over 0.925 beat about the
             word's centre on the baseline
  1.205      the role drops 18 px into place; at 1.29 the rule grows from the centre
  1.45       the tagline types on (65 chars a beat), re-centred as it grows, behind a block cursor
  1.665      the spec footer fades in with a 4 px settle; everything is still by 2.1
  hold       still; the dot stays put at s._.anchor through the iris beat
  A very long word (stagger floor 0.03 beat a glyph) pushes everything from the drop on later.

Layout (measured, 1080×1920): the wordmark is 330 px Instrument Serif italic, fitted so its
advance spans ≤ 832. The span from its origin to the dot's right edge is centred on the box.
The baseline is placed so the block from the wordmark's ink top to its last line centres
7.5 px below the box centre (904 for "Claude"). The dot sits on the baseline, 0.093 em right
of the ink. Below the baseline: role +144, rule +204.5 (815 wide, ink .5; only with a role
or tagline), tagline +281. The footer sits at the box bottom − 48.5 (1572.5).

`{ type: "endcard", beats: 4, out: {"type":"iris","beats":1,"ease":"inQuart"} }` · CLAUDE (the wordmark) · ground `paper`

| Option | Default | |
| --- | --- | --- |
| `wordmark` | `"Claude"` | the name, written on by the dot (non-ASCII is fine) |
| `dot` | `true` | the accent full stop the pen lands as (and the iris opens from); false: the pen fades out |
| `role` | `"MOTION DESIGNER"` | tracked mono under the wordmark; "" for none |
| `tagline` | `"EVERY FRAME, ON PURPOSE."` | accent mono, typed on behind a block cursor; "" for none |
| `spec` | `"auto"` | the footer; "auto" = made in code · size · fps · bpm; " · " gets the original's wide spacing; "" for none |
| `kind` | `"serif"` | "serif" (Instrument Serif italic) or "display" (heavy sans) wordmark |
| `grid` | `true` | the 60 px dot grid of the paper (the engine draws it); false for a plain ground |

---

# 3D

## points

Points: any 3D object as a cloud of points, and the moves you give it. The flexible point
cloud: where the original's cloud plays one routine (floor → sphere → torus → cube → burst),
this one plays your steps, in your order, on your objects.

  steps: [
    { form: "crystal", move: "assemble", from: "dot", beats: 2 },   points fly out of the dot into a crystal
    { move: "tremble", amp: [0, 0.05], heat: [0, 0.4], beats: 2 },   it shakes harder as it heats up
    { form: "cube", beats: 1 },                                       snaps into an ice cube
    { move: "melt", beats: 2 },                                       slumps into a puddle on the floor
    { move: "boil", beats: 2, heat: 1 },                              boils off, filling the frame
  ]

Step options: form (a form below; with no move it morphs into it), move, beats (scaled so the
steps fill the scene), ease, stagger (0..1 of the step: the points start one after another,
ordered by: "y" bottom first, "-y" top first, "radius" centre out, "random", "index"), swirl
(degrees the points turn round the vertical on the way), heat (the share of points in the
accent, a number or [from, to]), amp (tremble: [from, to] in form units), cam ({ yaw, pitch,
dist } reached by the step's end), turn (extra degrees of orbit over the step), from (assemble:
"dot", "gas" or a form).

Moves: morph (to the step's form), assemble (into it, from "dot" / "gas" / a form), hold,
tremble, melt (slump onto the floor and spread), boil (rise and fill the frame), explode
(blast outward), implode (into the centre: the dot it hands on), wave (a ripple out from the
centre), scatter (to gas).

Forms (about unit size, y up): sphere, cube (its faces), crystal (a cubic lattice), torus,
knot (a trefoil tube; "knot-p-q" for others), mobius, klein (the bottle), helix (a double
helix with rungs), shell (a seashell spiral), galaxy, cone, cylinder, ring, plane (a flat
grid), lattice (a floor of dots), gas (filling the frame), puddle (a pool on the floor), dot,
text:WORD (thick letters), any 2D shape spec (svg { d, view }, star-5 …: extruded), or
{ lathe: [[r, y], …] } (a profile turned round the vertical: a vase, a bulb, a bottle).
Every form is laid out bottom to top and round, so the points of one land near the same
points of the next: morphs flow instead of scrambling.

`{ type: "points", beats: 4 }` · 3D POINTS · ground `cool`

| Option | Default | |
| --- | --- | --- |
| `n` | `2400` | points |
| `steps` | `[{"form":"sphere","move":"assemble","from":"dot","beats":1.2},{"form":"torus","beats":0.9,"swirl":120},{"form":"knot","beats":0.9,"swirl":-90},{"move":"explode","beats":1}]` |  |
| `color` | `"paper"` | the points' colour (role) |
| `accent` | `"accent"` | the colour heat turns them |
| `heat` | `0.06` | the share of points in the accent to begin with |
| `dot` | `3.2` | a point's radius, px, at the centre's depth |
| `yaw` | `-28` | the camera: degrees round the vertical |
| `pitch` | `22` | … and above the horizon |
| `dist` | `4.2` | … and its distance, in form units |
| `fov` | `34` |  |
| `spin` | `22` | the steady orbit, degrees per second |
| `size` | `1` | the form's size, 1 ≈ the stage |
| `floor` | `false` | a faint floor grid under the form (melts land on it) |
| `glow` | `false` | add the points' light together (on a dark ground they glow where they crowd) |
| `panel` | `["POINTS / {form}","N={n}  {move}","YAW {yaw}°  PITCH {pitch}°","t={t}s"]` | the top-left readout (case kept): {form} {move} {n} {yaw} {pitch} {t} {heat} |
| `names` | `null` | the readout's name per step's form, e.g. ["CRYSTAL", "ICE", "WATER", "VAPOUR"]; default from the forms |

## lattice

Lattice ripple. A top-down 3D floor of dots (32 × 50 = 1600) on the ground, an accent emitter
dot at the centre of the box, a beat-locked ripple and an orbit camera that tips the flat map
into a receding perspective floor. Everything is a closed-form function of the beat: each
pulse is a decaying radial wave h(r, age), the camera a pair of eased angles. The choreography
is written in the original's seconds (1 beat = 0.5405 s) and scales with the tempo.
  b 0.00       cut in on the emitter, big (r 87) and soft: the dot the scene before hands on.
               It springs 87 → 52 → 71 and fires pulse 1: a fast, decelerating ring of raised
               dots coloured by height (accent crest, a weaker sun crest behind it, small dim
               dots in the troughs), a faint ring on the floor at the front, 3 '+' marks.
  b 0.06–0.28  the panel (title + GRID / PITCH·YAW / WAVE, all live) and the axis gizmo fade in.
  b 0.08–1.79  the camera pitches 0 → 50° (in-out cubic) and yaws +25° (drift + ease):
               the floor recedes, the emitter rises 140 px with the look-at point.
  b 0.45–0.76  the emitter shrinks away (ease-in); its crosshair stays.
  b 1, 2, …    a pulse on every further beat: the emitter pops (r 39) and a new ring rolls
               across the tilted floor toward the camera. Wave amplitude and speed decay, and
               the colours with them: a later front reads sun, its trailing crests white.
  end          no cut: a cloud scene after it starts from exactly this floor and camera, and
               morphs the same points (its readouts take over on the beat).
The shared maths (floor, waves, camera, dot renderer, panel, gizmo) is Reel.lattice, used by
the cloud scene too.

`{ type: "lattice", beats: 2 }` · PATTERN SYSTEMS · ground `cool`

| Option | Default | |
| --- | --- | --- |
| `top` | `"PATTERN / LATTICE"` | the panel title, two-part '<DOMAIN> / <STRUCTURE>' (case kept) |
| `lines` | `["GRID {cols}×{rows}   N={n}","PITCH {pitch}°  YAW {yaw}°","WAVE  A={a}  v={v}"]` | the live panel lines (case kept): {cols} {rows} {n} {pitch} {yaw} {a} amplitude {v} speed |
| `dots` | `[32,50]` | columns × rows of dots (N is their product); a cloud after it morphs these same points |
| `crest` | `"accent"` | the wave's first crest (palette role) |
| `mid` | `"sun"` | its second, weaker crest |
| `dot` | `"accent"` | the emitter dot |
| `tilt` | `50` | the camera pitch it tips to, degrees from straight down |
| `yaw` | `-5.3` | the starting yaw, degrees (the floor sits a few degrees off square) |
| `turn` | `15` | extra yaw over the tilt, degrees |
| `drift` | `10.1` | steady yaw drift, degrees per second |
| `marks` | `true` | the three faint '+' registration marks on the floor |
| `axes` | `["X","Y","Z"]` | the gizmo's axis letters |

## cloud

Point cloud. The lattice's own points (32 × 50 = 1600, still rippling, same camera) swirl into
a spinning mesh, snap from mesh to mesh on the beat and half-beat, then blast out of an accent
dot. A design-tool bounding box (8 handles, a rotation knob) tracks the projected cloud, with a
MESH / <NAME> label and a live ROT readout under it; the top-left panel reads the morph live.
Written in the original's seconds (1 beat = 0.5405 s), scaled with the tempo and the scene length.
  b 0.00       no cut from a lattice scene before it: same points, waves and camera; only the
               HUD text changes. Without one it starts from that same floor (a 4+ beat cloud
               with no lattice before it plays the lattice itself first, titled by `top`).
  b 0.00–1.0   floor → form 1 (sphere): a vortex (the floor swirls ~100° about the vertical
               while it gathers, then inflates; out-expo, the far rows up to 0.1 s late), the
               floor's outer rings sweeping up over the top. Points take their own colours
               (≈5% sun, 5% blush) and depth shading (near dots big, far ones small and dim).
               The camera eases 50° → 30° pitch (in-out sine) and the look-at point drops back
               to the centre; yaw keeps drifting. The sphere spins 86°/s (ROT).
  b 0.37–0.50  the bounding box, handles, knob, label and ROT fade in.
  b 1.00       form 2 (torus), out-expo 0.3 s, a spin kick (+76° decaying).
  b 1.48       form 3 (cube edges), out-expo 0.17 s, another kick (+65°). More forms share
               1.00–1.48; a single form spins on.
  b 1.81       explode: box and labels go, an accent dot (r 12 → 16 → 3) and six shock rings
               at the centre for a frame, the points fly out radially (accelerating, the near
               ones growing into soft discs), panel and gizmo fade. Hard cut on the downbeat.
Forms: sphere, torus, cube, helix, or any shape spec (an svg { d, view, rule } silhouette,
text:X): its outline as points on the front and back of an 80-unit slab, posed to face the
camera. Every form is sampled in grid order, so neighbours stay neighbours through a morph.
A full-frame shutter (the engine's blur) streaks the morphs and the burst as the original's.

`{ type: "cloud", beats: 2 }` · POINT CLOUD · ground `cool`

| Option | Default | |
| --- | --- | --- |
| `forms` | `["sphere","torus","cube"]` | the meshes it becomes, in order: sphere, torus, cube, helix, or any shape spec (an svg silhouette or text:X, extruded) |
| `names` | `null` | their labels, e.g. ["SPHERE", "TORUS", "BEAN"]; default from the forms (a shape spec is FORM) |
| `notes` | `null` | the line under each label after N=…, e.g. ["R=440", "R=335 r=105", "a=490"]; default from the mesh |
| `n` | `1600` | points when no lattice comes before it (a grid near 32×50); after a lattice, its grid |
| `title` | `"POINT CLOUD / MORPH"` | the panel title (case kept) |
| `count` | `"N={n}   {name}"` | panel line 2 (case kept): {n} points, {name} the current form |
| `cam` | `"PITCH {pitch}°  YAW {yaw}°"` | panel line 3, live |
| `clock` | `"t={t}  EASE outExpo"` | panel line 4: {t} seconds into the scene |
| `mesh` | `"MESH / {name}"` | the label under the box |
| `meta` | `"N={n}  {note}"` | the line under it |
| `rot` | `"ROT {rot}°"` | right of it: the live spin |
| `explode` | `"EXPLODE"` | the form name the panel shows for the burst |
| `tilt` | `30` | the camera pitch it eases to, degrees |
| `dot` | `"accent"` | the burst's dot |
| `accents` | `["sun","blush"]` | the colours of the ~10% accent points (palette roles) |
| `axes` | `["X","Y","Z"]` | the gizmo's axis letters |
| `top` | `"PATTERN / LATTICE"` | the lattice panel title, only for a 4+ beat cloud with no lattice before it (it plays the lattice first) |

## voxels

3D mograph: a voxel heightfield and a bouncing chrome orb. A floor of 16×27 square pillars seen
from an orbiting camera; their heights are a slow swell plus the ripples every impact of the orb
sends out (the centre sinks, springs up into a crest that rolls out as a rounded-square ring
behind a trough ring). Pillar tops are coloured by height through a ramp of roles (low cool →
blush → accent high) over dark sides; the far rows are drawn soft (depth of field). The orb is
chrome: a sky that darkens to a horizon line (hot line + white line), the floor's own ramp
reflected below it with a fisheye grid, a specular dot and a glassy rim; two sun-coloured orbit
rings precess round it (back halves behind, front halves over it) with a satellite dot. The
camera, the orb's path and the readouts are fitted to the original frame by frame. Beat by beat
(3 beats; a longer scene repeats the middle bounce and stretches the camera, a shorter one
compresses it):
  0.00        hard cut on the beat, on an impact: white flash (+0.094, ×0.65 a frame), a pink-
              white bloom on the floor and over the orb, squashed into it; the rings edge-on.
  0.00–1.00   the camera tilts up from ~65° to ~52° (ease-out) and yaws ~10° a beat, slowing
              towards the end (the CAM readout prints the original's 72.8° → 46.1°, 12.9° → 36.4°).
  0.03–1.00   the orb rebounds (out-sine, by ~0.28), hangs (the first hang sags as the camera
              settles) and falls (1 − x^2.3) from 0.7 onto the impact point on the next beat; each
              impact (1.00, 2.00) flashes, blooms and launches a ripple. The rings spin into ghost
              copies for ~0.2 beat round every impact.
  0.25–0.31   the callouts fade in: brackets round the orb, a leader-line label (note, then R and
              the live height Y), the bottom-left readout (grid, live CAM yaw/pitch, formula).
  2.00–2.85   the last bounce goes higher (1.25×), sinks to a hover and lifts into the push.
  2.70–2.80   the callouts fade out.
  2.85–3.00   the camera pushes into the orb (scale e^(48v²), to ~2.2×) with a radial zoom
              blur; hard cut on the beat. s._.anchor is the orb.

`{ type: "voxels", beats: 3 }` · 3D MOGRAPH · ground `deep`

| Option | Default | |
| --- | --- | --- |
| `cols` | `16` | pillars across and deep |
| `rows` | `27` |  |
| `object` | `"sphere"` | the bouncing thing: "sphere" (a chrome orb) or any shape spec (a chrome badge of it) |
| `ramp` | `["cool","blush","accent"]` | pillar top colours, low → high (roles); the orb reflects them |
| `ring` | `"sun"` | the orbit rings and the satellite dot |
| `note` | `"ORB / CHROME"` | the object callout, top right |
| `sub` | `"R 130  Y {y}"` | its second line; {y} is the live height, 3 digits |
| `top` | `"GRID {cols}×{rows}  N={n}"` | readout line 1, bottom left; {cols} {rows} {n} |
| `cam` | `"CAM  YAW {yaw}°  PITCH {pitch}°"` | readout line 2: the live camera |
| `formula` | `"h(x,z) = Σ A·cos(k(r−vt))·e^(−λt)"` | readout line 3, as written (not upper-cased) |

---

# Pattern and shape

## phyllotaxis

Phyllotaxis, as a lab instrument. Vogel's sunflower: seed n sits at radius c·√n and angle n·θ;
every k-th seed (one parastichy arm) is in the accent and seed size grows with radius. The flower
turns slowly anticlockwise (-15.5°/s) against a polar dial turning clockwise (+7°/s). Beat by
beat (2 beats; the choreography is written in the original's seconds, 1 beat = 0.5405 s, and
scales with the tempo):
  0.00        cut in on a white flash that decays to the ground in ~0.06 beat. The accent dot
              (r 26) sits at the centre, shrinks to the 4.5 px seed and fires a shockwave ring
              (an ease-out ring that creeps to the corners, plus a fainter, slower accent echo).
  0.00–0.62   the seeds spray out of the dot in order of n (the live count runs up to n) into a
              growing disc: they pile up at its edge (a dark rim of streaks), it overshoots the
              rim by 3.7% and settles; each seed's angle leaves 120° ahead and swings back, so
              the outer seeds streak along the spiral arms until ~0.65.
  0.12–0.41   the HUD fades in: title + model line, the dial (000–330), a crosshair, two dotted
              guide rings, the θ construction (two rays, arc, italic θ; it turns with the
              flower), bottom-left readouts (θ, n, Δθ, constant, state word, slider start … p/q)
              and the right column (accent bullet + metric, ratio, series).
  0.55–0.67   a callout (ring, elbow leader, underlined label) locks onto the hero seed.
  0.55–0.99   θ sweeps golden → the rational p/q target (in-out expo, landing on beat 1): the
              sunflower snaps into q straight spokes, the outer seeds streak (their angular
              speed is n·dθ/dt). A size ripple runs out from the centre as it locks.
  0.99–1.27   hold on the spokes (a longer scene holds longer; a shorter one is compressed).
  1.27–1.60   θ springs back past golden (out-back) and settles; a ripple as it crosses golden,
              another as it settles.
  1.64–1.79   the HUD fades out.
  1.74–1.94   the flower starts to turn (ease-in) while its radial law steepens from r ∝ √n to
              r ∝ n^4.5 (the inner seeds drain to the centre, the rim stays): it winds into a
              spinning spiral galaxy, then shrinks into the centre dot, which grows to r 21.
  1.94–2.00   a lone accent dot on the ground for the cut: the match cut into the next scene's
              circle (s._.anchor is the centre).

`{ type: "phyllotaxis", beats: 2 }` · GENERATIVE · ground `paper`

| Option | Default | |
| --- | --- | --- |
| `title` | `"PHYLLOTAXIS"` | heavy sans, top left |
| `sub` | `"VOGEL MODEL  ·  r = c√n   φ = n·θ"` | the mono model line under the title, as written (not upper-cased) |
| `n` | `900` | seeds |
| `mark` | `"circle"` | each seed's shape: any shape spec (circle, square, star-5, text:✳, { d, view }); non-circles turn along the spiral |
| `every` | `13` | every k-th seed in the accent: one parastichy arm |
| `angles` | `[137.5078,137.6471,137.5078]` | divergence angle in degrees: start (golden), the sweep target (p/q of a turn: q spokes), the angle it springs back to |
| `hero` | `377` | the seed the callout locks onto |
| `heroLabel` | `"n = {i}"` | the callout label; {i} is the hero's index |
| `symbols` | `["θ","n"]` | the serif italic accent symbols of the angle and the count (row 1; the angle's also labels the arc) |
| `delta` | `"Δθ"` | row 2: prefix of the live offset from the start angle |
| `constant` | `"c = 15.80"` | row 2: the model constant |
| `readout` | `"GOLDEN"` | row 2: state word at the start angle |
| `sweeping` | `"SWEEP"` | row 2: state word while θ moves |
| `locked` | `"RATIONAL {frac}"` | row 2: state word on the target; {frac} is its p/q |
| `ticks` | `["φ","{frac}"]` | slider tick labels: start (serif italic), target (mono) |
| `metric` | `"PARASTICHY"` | right column, row 1, after the accent bullet; followed by `every` |
| `ratio` | `"φ = 1.6180339"` | right column, row 2 |
| `series` | `"34 · 55 · 89 · 144 · 233 · 377 · 610"` | right column, row 3: a string, or an array joined with " · " |

## morph

Shape morph, dressed as a design tool (an After Effects / Figma shape editor on near-black).
Every quantity is a closed-form function of the beat: springs are evaluated, not integrated.

  b -0.08     the accent dot of the scene before springs (3.8 Hz, ζ .52) into the first shape at the
              centre; on the cut it is already half grown and blurred, so the dot hand-off is one move.
  b 0.02–0.17 the editor fades in: LAYERS row (one cell per shape), dial with fixed ticks and an
              accent ROT arc, crosshair, rotated bounding box (W×H + 28 px) with 8 handles and a
              rotation stem, 8 bezier anchors with handle pairs on the outline, TRANSFORM readout
              (ROT / SHAPE / W × H / SCALE / FILL, live), keyframe track with an accent playhead
              that runs linearly across the whole scene. The shape drifts clockwise (spin deg/s).
  each next shape i (keyframe at i/n of the scene): 0.10 b before the playhead reaches it the
              outline morphs as r(θ) (240 samples) on a kicked spring that overshoots (the triangle
              goes concave), the rotation springs (5 Hz), the scale pops ~7%, the fill lerps in RGB
              (the hex follows); 0.06 b before, the layer highlight jumps; at the crossing the
              keyframe diamond and the layer icon fill. Two lagged copies (0.083 s / 0.05 s,
              offset down-left / right) in other palette colours sit behind as chromatic echoes.
  last shape  the rotation swings past its angle and eases onto it; the drift stops there.
  b 1.75–1.84 the UI fades out (linear). b 1.78–1.99 the outro: the shape spins up (720°, nearly
              all in the last frames, so the engine's motion blur turns it into a halo), its fill
              lerps to the accent, the echoes fade, and from b 1.9 it rounds into a circle and
              shrinks: a crisp accent dot (r≈31) at the centre on the last frame, for the next scene.

Shapes are any shape specs. circle / triangle / square / hexagon / poly-N / star-N get the
original's exact profiles (rounded polygons, concave-flanked stars); anything else (an svg
path, text:K) is ray-cast into r(θ) by g.radial. Without turns, each shape settles at an
angle that suits its own symmetry (a letter ends upright, a 12-point star 3° off).

`{ type: "morph", beats: 2 }` · SHAPE · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `shapes` | `["circle","triangle","star-12"]` | 2–4 shape specs, simplest first: circle, triangle, square, hexagon, poly-N, star-N, text:A, { d, view } |
| `names` | `["CIRCLE","TRIANGLE","STAR·12"]` | the layer names, shown in the LAYERS row and the SHAPE readout |
| `fills` | `["accent","sun","cool"]` | a fill per shape (palette roles); the hex readout shows the live RGB lerp |
| `echoes` | `null` | echo colours per shape, [left, right] pairs or roles; null = the other fills, the last shape's left one is `echo` |
| `echo` | `"blush"` | the spare colour for the last shape's left echo |
| `turns` | `null` | angle (deg, clockwise) each shape springs to, on top of the drift; the last is exact. null = from each shape's symmetry (≈ 0, 101, 56.8 here) |
| `spin` | `38` | the slow clockwise drift, degrees per second, until the last shape lands |
| `labels` | `{"layers":"LAYERS","items":"ITEMS","transform":"TRANSFORM","rot":"ROT","shape":"SHAPE","size":"W × H","scale":"SCALE","fill":"FILL","ease":"EASE"}` | panel words: { layers, items, transform, rot, shape, size, scale, fill, ease }; give only the ones to change |
| `formula` | `"MORPH  r(θ)  N=240"` | footer, left (case kept) |
| `ease` | `"spring(5Hz, ζ15)"` | footer, right, after labels.ease (case kept) |

## crack

Crack: a shape that fractures. It holds, turning a little, as the stress readout climbs; a
crack runs out from the point of impact, each new line flashing in the accent before it opens;
then the shape comes apart along its cracks and the pieces drift away from each other, turning,
as if weightless, faster and faster. Any shape: a square tile, a logo, a planet, a letter.

  shape    any shape spec (square, circle, star-5, text:A, { d, view })
  at       the point of impact, in the shape's radius ([0.2, -0.3]: right of centre and up)
  pieces   how many pieces it breaks into (more near the impact)
  crack    when the crack runs: [from, to], fractions of the scene
  split    when the pieces come apart: [from, to]
  drift    how far they drift (1: off the frame by the end), spin how much they turn
  gap      the width of a crack, px

`{ type: "crack", beats: 4 }` · FRACTURE · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `shape` | `"square"` | the shape that breaks |
| `size` | `0.36` | its radius, a fraction of the stage's smaller side |
| `color` | `"paper"` | its colour |
| `turn` | `9` | degrees it turns while whole |
| `at` | `[0.22,-0.3]` | the impact, in its radius |
| `pieces` | `34` |  |
| `crack` | `[0.16,0.46]` |  |
| `split` | `[0.46,1]` |  |
| `drift` | `1` |  |
| `spin` | `1` |  |
| `gap` | `5` |  |
| `seed` | `3` |  |
| `title` | `"SAMPLE / {state}"` | the readout's first line (case kept): {state} INTACT, CRACKING, FRACTURED |
| `lines` | `["STRESS {mpa} MPa","PIECES {n}","GAP {gap} px"]` | the rest: {mpa} {n} {gap} live |
| `states` | `["INTACT","CRACKING","FRACTURED"]` |  |
| `peak` | `412` | the stress the readout climbs to |

## fractal

Fractal: a Koch snowflake that grows detail without end, then an endless dive into one of its
corners. A triangle sprouts a bump on every edge, level after level (each bump rising out of
the flat), the camera glides to the top corner and zooms, and because the curve there is the
same at three times the size, the dive goes on for ever: the picture is the same every 3×, only
the ZOOM readout keeps counting.

  grow     when the levels grow: [from, to], fractions of the scene; depth: the level reached
  glide    when the camera glides to the corner (then the dive takes the rest)
  per      beats for each 3× of the dive (a shorter one dives faster)
  fill     the snowflake's fill: a role, or [role, role] for a gradient down the frame
  stroke   its edge (a role, or null)

`{ type: "fractal", beats: 6 }` · FRACTAL · ground `cool`

| Option | Default | |
| --- | --- | --- |
| `grow` | `[0.04,0.42]` |  |
| `depth` | `6` |  |
| `glide` | `[0.42,0.58]` |  |
| `per` | `1.6` |  |
| `size` | `0.44` | the triangle's circumradius, a fraction of the stage's smaller side |
| `fill` | `["accent","sun"]` |  |
| `stroke` | `"paper"` |  |
| `readout` | `["KOCH / LEVEL {level}","D = log 4 / log 3 ≈ 1.262","ZOOM ×{zoom}"]` | top-left (case kept): {level} {zoom} |

## halftone

Halftone, two screens. A 20 px screen of paper dots (screen A, 0°) and a second screen of accent
dots (screen B, ~15° and creeping) print a lit picture on the dark ground: dot radius is
9.5·√intensity, so the screens never move, only the picture under them. A light orbits the
picture (a small sun dot on a 502 px circle, LIGHT readout) and the shading follows it: screen A
prints the lit side (Lambert, light 40° up), screen B a back-light 135° round from it (15° up).
Beat by beat (2 beats; times are in beats of the 2-beat original and stretch with the scene):
  0.00        the accent dot (r 25) alone on the ground, as the scene before left it.
  0.03–0.28   the picture blooms out of the dot (its scale out-cubic 0 → 1, its ink fading up)
              while the dot shrinks away (in-quad, gone by 0.27): a torus (R 330, tube 112), or
              the topic's silhouette (shape) inflated into a round-edged relief.
  0.15–0.30   the readouts fade in: SCREEN A/B with their angles (top left), the pitch (top
              right), the dot-size legend (bottom left), LIGHT, the formula and the stats
              (bottom right, DOTS live).
  0.33–0.44   the base screen fades in over the whole frame (r 1.2 paper speckle).
  0.42, 0.67  kick pulses (kicks): the picture swells 2.5% and its dots 15%, decaying.
  0.97–1.17   morph: a shockwave ring of big dots runs out from the centre past the frame edge
              (1250·(1 − e^(−Δ/0.1)) px) and behind it the picture is a 3-arm log spiral
              (k 5.2: arms wind ~200° clockwise from the core to the r 520 rim; screen A broad
              arms, screen B narrower ones hugging them), born spinning anticlockwise and
              slowing to ~32°/beat. The formula line flips to the spiral's. The light speeds up
              by 45° across 1.01–1.29.
  1.44        another kick.
  1.75–1.975  collapse: the spiral shrinks into the centre (in-cubic to 5%) spinning up
              clockwise (∝ Δ⁵, ~30°/frame at the end); the accent dot regrows to r 20
              (out-quad, 1.79–1.88) and the readouts fade (1.88–1.97).
  2.00        the dot alone: the cut into the next scene, which can burst out of it.
Colours: screen A, screen B (colors), the base speckle in screen A's colour, the light in sun.

`{ type: "halftone", beats: 2 }` · HALFTONE · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `step` | `20` | the screen pitch, px (both screens) |
| `arms` | `3` | spiral arms |
| `k` | `5.2` | spiral winding: phase turns per e-fold of radius (5.2 ≈ 200° from core to rim) |
| `phase` | `-6.4` | the spiral's starting turn, degrees |
| `shape` | `null` | optional shape spec ({ d, view, rule }, text:X, star-5…): replaces the torus as the first picture, inflated into a relief and lit by the same light |
| `readout` | `"PITCH 20PX · 2 SCREENS"` | top right |
| `screens` | `["SCREEN A","SCREEN B"]` | the two screens' names, top left, each followed by its live angle |
| `angle` | `15` | screen B's angle at the start, degrees; it creeps +2.9°/s |
| `forms` | `["f(r,θ) = TORUS · R 330 · r 112","f(r,θ) = SPIRAL · ARMS {arms} · k {k}","f(x,y) = SHAPE · RELIEF"]` | the formula line (as written): the torus, the spiral ({arms}, {k}), the first picture when there is a shape |
| `light` | `"LIGHT"` | the live light-angle readout's label |
| `stats` | `"{cols}×{rows} · LPI 52 · DOTS {dots}"` | the stats line: {cols}×{rows} the screen, {dots} the dots printed (live) |
| `legend` | `["0%","100%"]` | the captions under the dot-size legend |
| `kicks` | `[0.42,0.67,1.44]` | beat pulses, in beats of the 2-beat original: the picture swells 2.5%, its dots 15% |
| `colors` | `["paper","accent"]` | screen A, screen B |
| `decay` | `0` | 0..1: how much of the print comes loose and falls away like sand (lowest dots first) |
| `decayFrom` | `0.3` | when the decay starts, a fraction of the scene |

---

# Motion

## ribbons

Ribbons (LINE & FLOW). Fat striped "snakes" (an ink outline, a soft drop shadow and a stack of
nested stripes, so the round ends show concentric caps) slither at ~5000 px/s along long
Catmull-Rom paths across a flat field. Each head decelerates (v0 - a·t) and the tail replays
the same motion a fixed lag behind, so a snake is ~1400 px long at speed and shortens as it
slows. Ribbons stack in a set order and a ribbon's own crossings put the later stretch on top
(the knot); weave: true alternates over / under along each path instead. Ahead of every head
its path waits as a faint dashed guide with bezier keys (a diamond on a tangent handle, "K07",
every third key filled with the ribbon's outer colour). Impact bursts (a ring that blooms and
fades, a crown of ticks that drifts out and lingers) pop at a head at set moments. A black chip
bottom-left reads out the newest path (name, arc s, speed, heading) over a stats line, at the
frame's own time so the digits stay sharp under the motion blur. Times are seconds of the
original's 2 beats at 111 BPM, stretched to the scene (a longer scene is a slower one); the
shutter is a little longer than the engine's so heads smear ~50 px.

  beat 0      hard cut mid-action: the tricolor already curls up-right, its body trailing off
              bottom-left; the pink head enters bottom-right. Chip PATH 01, LIVE 2
  0 - 0.55    the tricolor hooks over the top and loops back over itself into a knot (top
              right); pink runs left along the bottom and up the left side
  0.13        the blue pinstripe enters top-left (chip PATH 02, LIVE 3), runs under the knot's
              top arc and down through its loop; burst at its head at 0.38
  0.49        the orange candy spawns off bottom-left (chip PATH 04, LIVE 4)
  0.56        burst where the tricolor's head crosses itself
  0.6 - 1.4   pink sweeps across the middle over blue and the tricolor, and out the top; the
              tricolor leaves right; orange carves an S up the left over blue (bursts at its head
              0.89, 1.12, 1.38); blue swings down and along the bottom
  1.4 - 2     all decelerate (~3000 px/s); orange climbs out the top (burst 1.64); hard cut

`{ type: "ribbons", beats: 2 }` · LINE & FLOW · ground `sun`

| Option | Default | |
| --- | --- | --- |
| `stripes` | `[[["accent",15],["paper",19],["cool",32]],[["blush",20],["paper",12],["blush",12],["ink",12]],["cool","paper","cool","paper","cool"],["paper","accent","paper","accent"]]` | per ribbon, outer band to centre band: a role, or [role, thickness] (default 1); drawn in this order |
| `paths` | `null` | optional: per ribbon a list of [x, y] in -1..1 of the stage (beyond ±1 is off-frame), a Catmull-Rom runs through them |
| `motion` | `[[-0.251,5726,5301,0.34],[-0.036,5471,3856],[0.071,5709,4368],[0.263,6417,4205]]` | per ribbon [spawn s, head speed px/s, deceleration px/s², tail lag s (optional)], in seconds of the original's 2 beats |
| `lag` | `0.38` | seconds the tail runs behind the head (the snake's length), unless motion gives one |
| `order` | `[2,0,3,1]` | stacking, bottom first (ribbon indices); a ribbon's own crossings put the later stretch on top |
| `weave` | `false` | true: crossings alternate over / under along each path instead of stacking by order |
| `width` | `118` | ribbon width, outline included, px |
| `outline` | `7.5` | ink outline each side, px |
| `keys` | `[[645,215],[244,299],[323,301],[372,311]]` | per ribbon [arc of K01, spacing], px: the bezier keys along each path |
| `key` | `"K"` | key label prefix (K01, K02 ...) |
| `tags` | `["PATH 03","PATH 01","PATH 02","PATH 04"]` | the chip's name for each ribbon (cycled); the chip shows the newest one |
| `readout` | `["{tag}  s={s}","v {v} px/s  θ {th}°"]` | the chip's two lines: {tag} name, {s} arc 0-1, {v} speed, {th} heading in degrees |
| `stats` | `"STROKE ×{n}   LIVE {live}   WEAVE {x} X"` | the line under the chip: {n} ribbons, {live} spawned so far, {x} crossings |
| `bursts` | `[[2,0.205,0],[0,0.3],[3,0.482],[3,0.607],[3,0.748],[3,0.885]]` | impact bursts at a ribbon's head: [ribbon, s, ring 0/1 (default 1)]: a ring and a crown of ticks that lingers |

## flow

Particles, in five phases, one continuous shot out of the halftone's dot (no cut: the dot it
collapsed into is the emitter). N = 2400 streaks (paper mostly, a sprinkle of cool, accent, sun
and blush), each drawn as its own path over the last few hundredths of a second. The physics
(burst → curl-noise advection → vortex) is integrated once in prepare at dt = 1/240 s and
stored; the rings and the dolly are analytic, so every frame is a lookup. Times are in the
original's seconds (3 beats at 111 BPM = 1.62 s) and stretch with the scene; b = beats of 3:
  b 0.00        the accent dot (r 18, glowing) flashes to r 42 and 2400 streaks burst out of it
                in a tall ellipse (1 : 1.8), |v| = 3500·(1 + t/0.7)^−3 px/s; the dot shrinks
                away by 0.33.  01 BURST
  b 0.31        02 ADVECT ∇×ψ: a 3-octave curl-noise field (scale 280 px) bends the streaks
                into wavy streamlines and eddies that fill the frame.
  b 1.26        03 VORTEX: a spinning sink (ω 10 → 16 rad/s, anticlockwise, pull 0 → 9 /s)
                sucks everything into a galaxy swirl round the dot (it springs back, r 16,
                1.39–1.55), then into a ball r ≈ 150–200 by 1.85.
  b 1.85        04 RINGS ×3: the ball springs out (out-back, 0.12 s) into three rings (R 205,
                345, 480) of three strands each, on one plane tilted 26° (near side up-left,
                perspective f 900), every particle a short dash 35° off the strand; they turn at
                their own ω (alternating). Leader-lined labels fade in (2.03–2.16).
  b 2.19        05 DOLLY: the camera pushes through the rings (z = 1739·u^2.5, scale
                2000/(2000 − z)): dashes stretch into radial spokes and rush out of frame while
                the dot swells to r ≈ 120 for the cut on the downbeat (labels gone by 2.59).
HUD extras: top left the field name, N and dt, the live sim clock; bottom row the phase and a
live readout (|v|, then ω, then z).

`{ type: "flow", beats: 3 }` · PARTICLES · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `n` | `2400` | particles |
| `colors` | `["paper","cool","accent","sun","blush"]` | palette roles, picked per particle (by weights) |
| `weights` | `[84,6,5,3,2]` | how often each colour is picked; omit (or a different length) for equal |
| `readout` | `"FIELD / CURL NOISE"` | the panel title, top left (as written) |
| `sub` | `"N={n}  dt=1/240"` | panel line 2 (as written): {n} the particles |
| `clock` | `"t={t}s"` | panel line 3: {t} seconds into the scene, live |
| `phases` | `["BURST","ADVECT  ∇×ψ","VORTEX","RINGS ×3","DOLLY"]` | the five phase names, bottom left, numbered 01–05 (as written) |
| `speed` | `"\|v\| {v} px/s"` | the bottom-right readout in BURST and ADVECT: {v} the burst speed |
| `spin` | `"ω {w} rad/s"` | … in VORTEX: {w} the spin |
| `push` | `"z {z}  f 1000"` | … in RINGS and DOLLY: {z} the camera's push |
| `rings` | `[205,345,480]` | the three rings' radii, px (they label themselves R1 205 …); topic numbers fit here |
| `spins` | `[0.9,-0.75,0.55]` | each ring's turn, rad/s |
| `ringLabel` | `"R{i} {r}  ω{w}"` | each ring's label: {i} its number, {r} radius, {w} signed spin |

## blob

Liquid: metaballs inside a morphing superformula. On the accent ground ink metaballs (the field
Σ r²/d² ≥ 1, with a soft offset shadow) drift inside a paper outline that snaps between forms on
16th notes, tracked by a selection box with handles and a live W / H / ROT label. They fuse into
one drop, spray droplets, shrink to the dot; the dot punches out into a ring and the camera zooms
through it into ink. Beat by beat (2 beats; the times are the original's beats and stretch with
the scene):
  0.00–0.08  match cut from the record's spindle: an ink disc (r 114) at the centre, a hairline and
             a soft paper ring expanding off it and fading; a faint crosshair through the centre.
  0.04–0.20  the disc swells and splits into the blobs while the outline fades in and morphs from
             the first form (a circle) to the second (0.075–0.145); the readout panel slides in.
  0.15–0.35  hold: the blobs drift, merge and split; from 0.24 the selection box tracks the outline
             (its label scrambles in). Each outline drifts clockwise (~8°/beat).
  0.35–0.41  snap morph to the third form (the 7-point star, or the topic's silhouette `shape`);
             the blobs jump to new seats. Box again from 0.51.
  0.60–0.66  snap morph to the soft liquid hull. Box again from 0.76.
  0.84–0.97  the blobs rush to the centre (in-out cubic) and fuse into one wide drop; outline and
             box swell into a double ring and fade (0.86–1.00); the readout says MERGED, BLOBS 01.
  0.98–1.24  burst: droplets fly out radially (~345 px, fast ease-out) while the drop settles from
             an ellipse into a wobbling rounded pentagon and slowly loses size.
  1.24–1.36  the drop shrinks to the dot (r 62), the droplets dry up.
  1.36–1.45  the dot holds; its label types on beside it (1.36–1.42).
  1.45–1.71  the dot punches out into a ring (spring): paper inner edge, a turning crown of ticks,
             faint hairlines; the ring grows a little.
  1.71–1.95  zoom-through: the ring flies at the camera (accelerating) while its ink centre swells
             and fills the hole; the readouts and the HUD sink under the ink; the HUD goes off.
  1.89–2.00  ink: hairline rings race outward; on the last frame one paper hairline (r 745).
             The next scene opens on this ink.
Other numbers of forms share the 0.075–0.66 window.

`{ type: "blob", beats: 2 }` · LIQUID · ground `accent`

| Option | Default | |
| --- | --- | --- |
| `forms` | `[{"m":0,"n1":1,"n2":1,"n3":1,"size":0.75},{"m":3,"n1":4.5,"n2":10,"n3":10,"rot":24.8,"size":1.177},{"m":7,"n1":0.5,"n2":1.2,"n3":1.2,"rot":-1.3},{"m":7,"n1":0.6,"n2":1.4,"n3":1.4,"rot":17.6,"size":0.93,"soft":true}]` | the outline's forms in order: superformula { m, n1, n2, n3 } (rot: degrees, size: × the base radius, soft: drawn as a liquid hull) or any shape spec, used as its r(θ) |
| `names` | `["CIRCLE","TRIANGLE","STAR / 7","BLOB"]` | each form's name in the readout |
| `shape` | `null` | a topic silhouette (shape spec): its r(θ) replaces the third form (the star) |
| `shapeName` | `"SILHOUETTE"` | the readout name of `shape` |
| `blobs` | `11` | metaballs; their total area stays that of the merged drop |
| `drops` | `9` | droplets sprayed by the burst |
| `seed` | `5` | where the blobs sit in each form |
| `dotR` | `62` | the dot the drop shrinks to, px |
| `title` | `"f(θ) = superformula"` | readout title, top left, as written |
| `formula` | `"m = {m}   n₁ {n1}   n₂ {n2}   n₃ {n3}"` | readout line 2 for a superformula form |
| `silhouette` | `"r(θ) = silhouette   {k} rays"` | readout line 2 while a shape-spec form shows |
| `state` | `"SHAPE / {name}   BLOBS {n}"` | readout line 3 |
| `merged` | `"MERGED"` | the state name once the blobs fuse |
| `box` | `"W {w}  H {h}  ROT {rot}°"` | the selection box label (live) |
| `iso` | `"Σ r²/d² ≥ 1   ISO 1.000"` | bottom-right title |
| `gridLine` | `"GRID {grid}   T {T}s"` | bottom-right line 2; {grid} the field resolution, {T} seconds since the scene start |
| `dot` | `"DOT  r = {r}px  →  RING"` | the dot's label |

---

# Data

## dashboard

Data and UI. Four product cards stacked full width in the HUD frame: a dark control card a
cursor operates, an accent card with a huge odometer number, a cool bar chart with a trend
line, a blush curve editor with a value table and a ring gauge. Every widget animates at once.
Timings are the original's, kept in its frames (60 fps at 111 BPM: 32.4 a beat) and so in beats;
the exit is anchored to the scene's end (a scene longer than 3 beats holds before it, a shorter
one is compressed). Beat by beat, for 3 beats:

  0          hard cut: the cards are already mid-spring (an underdamped spring: they rise
             scaled down and tilted, overshoot, undershoot, settle by ~1), 2.5 frames apart,
             fading in; the cursor streaks in from below and stops on the toggle (0.33)
  0.06–0.9   the hero odometer rolls up from zeros, digits locking left to right with a bump;
             the frames counter and its hairline fill in step
  0.2–1.4    the chart's total counts up; 0.26–1.15 the bars spring up left to right
  0.42–1.3   the curve's handles spring from linear to the curve (overshoot, live string and
             table); the table rows fade in one by one; 0.8–2.2 a playhead ball rides the curve
  0.48       click: the toggle flips (ripple, squash-stretch knob, its sub-label changes)
  0.5–1.7    the ring gauge fills; 0.71 the segmented control slides to its pick
  0.93–1.6   the trend line draws over the bars, its end dot pops; 1.73 the tooltip pops
  1.0        punch: the hero number kicks to 1.045 and settles; its chip pops
  0.95–1.28  the cursor glides to the button; 1.51 click: a striped progress bar fills
  2.0        done: solid accent, check icon, a glow ring pulses
  2.35–2.65  the cursor drifts onto the hero number
  2.65–3     exit: top cards fly up, bottom ones down (outer first), uncovering the accent dot
             at the frame centre; an iris of the next scene's ground blows out of it (×2.6 a
             frame) and covers the frame by the scene's end, the dot on top

The numbers are yours: use real ones, or ones that are true of the reel itself (its frames,
fps, scenes). Never invent statistics about the topic.

`{ type: "dashboard", beats: 3 }` · DATA + UI · ground `paper`

| Option | Default | |
| --- | --- | --- |
| `pitch` | `32` |  |
| `queue` | `{"title":"Render queue","sub":"auto","chip":"LIVE","toggle":"Motion blur","toggleOff":"OFF","toggleSub":"6 SMP · 180°","seg":"Frame rate","segSub":"auto","options":["24","30","60"],"pick":2,"button":"Render ▸","busy":"Rendering","done":"Done · 100%"}` |  |
| `stat` | `{"label":"RENDER OUTPUT · Q3","right":"VS. LAST REEL","value":312,"prefix":"+","suffix":"%","decimals":0,"foot":"auto","chip":"▲ 4.1× FASTER"}` |  |
| `chart` | `{"label":"FRAMES RENDERED / WEEK","right":"W01 — W12","value":18.4,"prefix":"","suffix":"k","decimals":1,"bars":[26,34,30,45,41,54,50,64,59,73,70,100],"names":null,"chip":"▲ 312%"}` |  |
| `curve` | `{"label":"EASE / CUSTOM","right":"SPRING","bezier":[0.17,0.97,0.32,1],"rows":null,"ring":78,"ringLabel":"SMOOTH","pill":"DUR 0.42S"}` |  |

---

# Burst

## rhythm

Rhythm. A burst of hard cuts on the half beat: six generative "instruments", each on its own
flat ground, all built around the centre of the HUD box so the eye never moves while everything
else changes. Every shot has the same grammar: a cut, a 4–6 frame kick (one period of its main
motion, exponential ease-out, streaked by the shutter) while its centre disc springs in from
about half size, overshoots 20–45 % and settles by frame 12; then a slow drift to the next cut.
Times below are the original's seconds after the cut (1 beat = 0.5405 s; they scale with tempo).
  target        RINGS on paper: full-frame ink annuli (λ 112, band 48) jump one wavelength outward
                (τ 0.023 s) then drift 120 px/s; the accent dot springs 61 → 128 → 110; a thin
                accent pulse ring runs 131 → 279 and fades by 0.21 s. Readout: its radius.
  sun           SUNBURST on sun: 24 tapered ink rays (long to r 1255, short to 785) off an ink
                annulus (r 150–172) kick 14° clockwise (τ 0.03 s) then turn 54°/s; the accent disc
                pops 82 → 149 → 133. Readout: ROT in degrees.
  dots          DOT FIELD on accent: a static 88 px grid of ink dots whose radii are a moiré wave
                15.2 + 10.8·sin(|(1.16 i, 2.645 j)| − 33.7 t), travelling outward; the paper disc
                springs 69 → 162 → 128.
  orbit         ORBIT on cool: the orbit system zooms 0.72 → 1 and unwinds 15° (τ 0.04 s); a paper
                planet springs 96 → 228 → 184; a blush moon rides the outer orbit (a 640, b 230,
                tilt 6.6°) clockwise at 15 rad/s, bottom to top; a white moon circles the inner
                orbit (a 350, b 150, tilt 40°) the other way and passes behind the planet; a sun
                moon streaks off along a huge dotted orbit.
  harmonograph  HARMONOGRAPH on blush: a damped 3.02 : 2 Lissajous (13 loops) is drawn outer → inner
                by an accent pen (30 % → 83 % in 0.06 s, then creeping; a longer shot draws
                slower, so the pen is seen at work), with a zoom settle, a crosshair through the
                pen and a dashed frame on the HUD box. Readout: pen x / y.
  vinyl         33⅓ RPM on ink: a record (r 480) springs 1.12 → 0.92 → 1 while its spin brakes from
                30°/frame to 33⅓ rpm; accent label with the record text on a circle and an
                off-centre spindle; the tonearm swings 70° → 143° (0.13 s) and eases back to 117°.
                It cuts on the label: the next scene can open on a disc at the centre.
HUD: the panel reads '<LABEL>  0k / 06' and the shot's title; six squares bottom left (the current
one filled) and a live readout bottom right, all in the HUD's ink for the shot's ground.
Shots are chosen and ordered per reel (shots: [...]); the cut uses the frame's own beat, so the
shutter never blends two shots.

`{ type: "rhythm", beats: 3 }` · RHYTHM · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `shots` | `["target","sun","dots","orbit","harmonograph","vinyl"]` | one per cut, in order: target sun dots orbit harmonograph vinyl (aliases rings sunburst field planet lissajous record) |
| `per` | `0.5` | beats per shot |
| `record` | `"SIDE A · {bpm} BPM · {brand} · MOTION {edition} ·"` | the text round the record label (vinyl); {bpm} {brand} {edition} from the reel; a short one repeats |
| `grounds` | `{}` | palette role per shot, to change any of: target paper, sun sun, dots accent, orbit cool, harmonograph blush, vinyl ink |
| `titles` | `{}` | the panel's second line per shot (case kept), to change any of TITLES; {lambda} {n} {cols} {rows} {a} {b} {ratio} are live |
| `readouts` | `{}` | the bottom-right readout per shot (case kept), to change any of READOUTS; {r} {rot} {e} {w} {x} {y} are live |

---

# Time

## rewind

Rewind. The reel itself, played backwards at speed: every frame since `to` comes back in
reverse, faster and faster, then slowing into the moment it rewinds to, under a VCR's rewind
picture (tracking bands that tear the frame sideways, scan lines, the ◀◀ and a speed readout).
The HUD reads the moment being shown, so its timecode and its numbers run backwards too.

Rewound to beat 0 (the default) and placed last, it is the loop: its last frame is the reel's
first, so the reel plays, rewinds and plays again with no seam. Put the end card before it.

  to       the beat of the reel it rewinds to (0: the start)
  ease     how it gathers speed and brakes (an ease name)
  readout  the speed readout under the ◀◀ ({x} the speed, live)
  word     the OSD word beside the ◀◀
  bands    how many tracking bands tear the frame (0 for none)
  lines    scan lines over the picture (0..1, their strength)
  tint     a wash over the rewound picture (a palette role), or null

`{ type: "rewind", beats: 4 }` · REWIND · ground `ink`

| Option | Default | |
| --- | --- | --- |
| `to` | `0` | the beat it rewinds to |
| `ease` | `"inOutCubic"` | gathering speed, then braking into the moment it lands on |
| `readout` | `"×{x}"` | the speed, under the ◀◀ |
| `word` | `"REWIND"` | beside the ◀◀ |
| `bands` | `3` | tracking bands |
| `lines` | `0.5` | scan lines |
| `tint` | `null` | a wash over the picture |
