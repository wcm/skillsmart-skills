# From an idea to a reel

The engine draws every frame. What makes a reel *about* something is its arc, the scenes that act
the arc out, and its words. Work them out in this order, as a short script, before touching the reel
file.

## 1. Gather

| What | Why | If you don't have it |
| --- | --- | --- |
| **The idea** (a concept, a principle, a feeling, a brand's belief) | everything follows from it | ask; it is the one thing you can't invent |
| **The name** | the end card's wordmark | the idea itself ("Entropy.") or the brand behind the reel |
| **Facts and numbers** | readouts, a counter, the data scene | numbers that are true of the idea (9.81 m/s², φ = 1.618…) or of the reel itself (frames, fps, beats); never invented statistics |
| **Music** | the tempo | the generated track; or theirs, at its own tempo (`audio.md`) |

## 2. Find the arc

One sentence: what turns into what. That sentence picks the structure.

| The idea moves… | Structure | Starter |
| --- | --- | --- |
| from whole to broken, from order to noise, from fine to too late | it falls apart, the end card lands at the peak, then the whole reel **rewinds** to its first frame: the rewind is the loop | `rewind` |
| inwards for ever: depth, scale, recursion, "there's always more" | every scene is found **inside** the last; every cut dives through a dot, a seed, a hole, a corner; the last dive lands on the first frame | `zoom` |
| with weight: falling, pulling, orbiting, launching | every cut **drops** into the next scene; things bounce, arc, merge, orbit | `fall` |
| in many directions at once: a studio, a product, a field | a **montage**: one technique per scene, a new ground at every cut, quicker cuts late | `montage` |
| between two opposites (signal / noise, calm / panic) | alternate two looks, scene by scene: two grounds, two fonts, two kinds of cut | any starter; set the grounds and transitions in pairs |
| by accumulation (compounding, a crowd forming) | the same few things, more of them each scene: 1 dot, a ring, a field, a cloud | any starter; let each scene start from the last one's dot |

## 3. Cast the scenes

Give every step of the arc one scene that acts it out (`scenes.md` has them all). A few that suit
common steps:

| A step of the arc | Scenes that show it |
| --- | --- |
| it is whole, ordered, at rest | `cells` (a word on a strict grid), `points` with `crystal`, `lattice`, `words` in `grid` |
| it heats, strains, trembles | `points` with `tremble` and `heat`, `cells` with `jitter` |
| it breaks | `crack`, the `shatter` transition, `words` in `glitch` |
| it melts, falls, settles | `points` with `melt`, `halftone` with `decay`, `cells` with `fall`, `voxels` (a ball landing) |
| it spreads, mixes, disperses | `flow`, `points` with `boil`, `words` in `dust`, `rhythm` with `scatter` and `static` |
| it gathers, merges, collapses | `points` with `assemble` or `implode`, `blob`, `cells` with `morph` to another word |
| it grows | `phyllotaxis`, `fractal` (levels), `path` (a mark drawing itself) |
| it repeats, recurses, goes on | `fractal` (the endless dive), `path` with `spiral` text, `rhythm` with `sierpinski`, `fern`, `mandelbrot` |
| it moves, is thrown, flows | `ribbons` (your own `paths`), `path` with a flowing ribbon |
| it turns, orbits, keeps time | `rhythm` with `orbit`, `harmonograph`, `vinyl`; `orbit` (words in rings) |
| it counts, measures | `words` in `overflow` (numbers too big for the frame), `dashboard` (real numbers only) |
| it is many things | `points` morphing through forms, `morph` through shapes, `words` in four styles |
| it says its name | `endcard` (it writes the wordmark; its dot can be the loop) |

3D forms for `points`: sphere, cube, crystal, torus, knot (`knot-p-q`), mobius, klein, helix (dna),
shell, galaxy, cone, cylinder, ring, plane, lattice, gas, puddle, dot, `text:WORD`, any 2D shape
spec (extruded), `{ lathe: [[r, y], …] }` (a profile turned: a vase, a bulb, a bottle). Shapes for
`morph`, `crack`, `blob`, `halftone`: circle, square, triangle, hexagon, `poly-N`, `star-N`, `text:A`,
an SVG path `{ d, view }`.

## 4. Write the words

Short, in the idea's own language. Nothing from the examples, no stock phrases.

| Where | What | Notes |
| --- | --- | --- |
| HUD `brand` and `edition` | the name, and a formula, a version or a date | `ENTROPY – ΔS ≥ 0`, `GRAVITY – 9.81 M/S²` |
| HUD `right`, `readout`, `vars` | one or two numbers that tell the story as the reel plays | a temperature rising, a depth counting up, distance fallen; curves over the reel |
| each scene's `label` | its chapter: one word or two | `ORDER`, `CRYSTAL`, `FRACTURE`; `COLLAPSE`, `TRAJECTORY` |
| readouts and panels | the instrument that would measure it | `HEAT 35%`, `STRESS 412 MPa`, `ZOOM ×729`, `SIDES 1` |
| big words | four words, one or two a beat, that say the arc | ORDER / FALLS / TO / *pieces*; WHAT / GOES / UP / *comes down* |
| keywords (`orbit`) | 10–14 words of the idea's world, in capitals | MASS · WEIGHT · TIDE · APPLE · NEWTON … |
| end card | the wordmark, a role line, a tagline | `Gravity.` · WHAT GOES UP · COMES DOWN. |

Type fits itself to the frame, but long words get small: keep heavy title words under 9 letters.

## 5. Pick the look

| Palette | Colours | Reads as |
| --- | --- | --- |
| `lab` | black and white, one acid lime | science, systems, breakdown, the cold and exact |
| `void` | violet-black, hot pink, gold | space, depth, dreams, the infinite |
| `earth` | sand, deep teal, vermilion, amber | weight, nature, the physical |
| `studio` | orange, cobalt, sun, blush on ink and cream | confident, graphic, warm |
| `tide` | coral, ocean blue | sea, travel, health |
| `matcha` | leaf green, deep teal | calm, money, wellness |
| `citrus` | tangerine, teal | food, summer, play |
| `clay` | terracotta, slate, ochre | craft, books, architecture |
| `neon` | hot pink, violet, acid lime | music, nightlife, games |
| `noir` | red on black and stone | fashion, film, luxury |

A palette of your own is the same eight roles: `palette: { ink, paper, accent, cool, sun, blush,
deep, sky }` (accent hot, cool saturated and dark, sun and blush light, deep near-black, sky pale,
paper off-white, ink near-black). Make each reel's palette clearly its own.

Fonts (`fonts: { display, serif, mono }`, all embedded): Montserrat (heavy, variable, the default),
Instrument Serif (italic), JetBrains Mono (labels), **Archivo** (variable width: `{ family: "Archivo",
stretch: "extra-condensed", weight: 900 }` for tall, urgent capitals, up to `"expanded"`) and
**Unbounded** (wide, round, spacey).

`energy` sets how hard it hits: 0.6 smooth and hypnotic, 1 bold, 1.2–1.5 violent, 2 wild.

## 6. Three finished examples

`<skill>/assets/examples/` holds three reels made with this skill. Read one before your first reel;
copy its craft, never its words.

**Entropy** (`entropy.js`, rewind, `lab`, Archivo condensed, 120 BPM, 32 s). ORDER builds on a grid
of cells and shatters; a crystal heats, trembles, melts into a puddle and boils off; a tile cracks
and drifts apart; a drop of ink swirls; a printed sphere crumbles like sand; ORDER / FALLS / TO /
*pieces* in grid, glitch, pixel and dust; a burst from lattice to TV static; the end card; then the
whole reel rewinds (the soundtrack too, like tape) to its first frame. The HUD's temperature climbs
to 999 K and runs back down with the rewind.

**Infinity** (`infinity.js`, zoom, `void`, Unbounded, 100 BPM, 36 s). A ribbon draws ∞ over ZOOM IN
*forever*; the camera dives through its crossing into a golden sunflower, through its seed into a
Möbius strip that becomes a knot and a Klein bottle the camera flies into, into a Koch snowflake
that dives for ever into its corner, into a spiral of AND AGAIN, numbers too big for the frame
(1, 1,000, 10^100, ∞), four fractals, a tunnel, and the end card, whose full stop is the last dive.
The soundtrack carries a tone that rises for ever.

**Gravity** (`gravity.js`, fall, `earth`, Montserrat and Instrument Serif, 108 BPM, 31 s). FREE FALL
thins to a hairline (weightless); a chrome ball bounces on a field; a cloud of dust collapses into
a star and a black hole; ribbons are thrown in arcs; drops pull into one; WHAT / GOES / UP / *comes
down* in the four classic styles; an orbit, a pendulum, ripples and a record; keywords in rings;
every cut a drop, and the end card falls away onto the first frame.
