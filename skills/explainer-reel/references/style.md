# The style

Distilled from five vertical reels by @innertune.affirmations (October 2026), three of them studied frame by
frame: *3 blessings before October 15th* (96 s, all gold), *10/10/10* (88 s, a night sky in white, gold, violet,
red and blue) and *Words are spells* (64 s, silver-white with gold and red). They share one machine: a calm
voice, a caption that lights up word by word, and on a near-black ground **one clean picture per line** that
shows what the voice says. The pictures change freely from line to line; what holds the film together is a
small motif or two, a fixed caption, and one palette.

The look is **clean and simple, but crafted**: few elements and a lot of black, yet every element is made with
care. A snowflake is exactly symmetrical and branches three times; the microscope circle round it has a faint
crosshair, a tick and `x400`; three small stars wear thin orbit ellipses; the wings are forty fine feather
strokes, not one outline. When in doubt, take an element away and give the one that stays one more detail.

## The key subject

Every scene has one key subject, and it must be **unmistakable at thumbnail size**: the biggest thing on screen
(often 60–90 % of the width), the brightest, and the most detailed, built from thousands of points or engraved
with hatching, never a thin icon. Everything else (labels, guides, small companions) is smaller, dimmer and
simpler, and stays at the edges. If you squint at a still and can't name the subject in a second, make it bigger,
denser and brighter, or take something else away.

## Rhythm: empty and busy

Swing between two kinds of scene, and don't stay in either for long:

- **Busy**: thousands of particles, a flow field streaming edge to edge, a turning 3D form, light running along
  paths. Use it for energy, scale, abundance and change: a crowd of cells, blood in a vessel, a laser crossing
  space, dust gathering into a number.
- **Empty and focused**: one thin line, one small figure on a horizon, a single number, almost all black. Use it
  for the quiet, precise lines ("look up", "for 20 seconds", "every ten years").

**Particles carry the story between scenes.** The same swarm of points becomes each scene's subject in turn:
the Moon dissolves into a line that becomes a ruler, a body pours into the villi of a gut and later flies back
out of a bone into the body. A swarm can also scatter into a cloud, burst outwards, or wait unseen inside one
shape to fly out of it later.

## The cover

The first frame is the thumbnail. Make it the most striking frame of the reel: the key subject already formed
(not drawing on), big, dense and bright, with something busy round it. The last frame returns to it, so the
reel loops and the cover is also the ending.

## The frame

- **1080 × 1920, 30 fps.** A near-black ground (warm or cool), a little grain, a soft vignette. Never pure black,
  never a gradient you'd notice.
- **Bands.** Pictures live between y ≈ 200 and 1300 and may bleed off the sides (wings, a network, a horizon).
  The caption sits at y ≈ 1440; a call to action pill under it at y ≈ 1640. A quiet row at the top (y ≈ 150):
  progress dots, or a tiny readout. Nothing important above y 120, below y 1700, or in the right 14 % between
  y 1000 and 1650 (Instagram's buttons); the preview's *Safe zones* shows them.
- **No standing frame.** There is no ring, dial or badge that every picture sits in. A circle appears only when
  it means something: a seal (`48 H`), a lens or microscope field, an orbit, a halo, the moon.

## Layouts

Pick the layout that makes each line clearest, and change it every few lines. The references use all of these:

| Layout | What it is | From the references |
| --- | --- | --- |
| **Object** | one form, big (50–90 % of the width), centred or a little high; may spill off the edges | praying hands, a glowing door, angel wings, an eye |
| **Pair** | two things side by side, often in two lens circles, to compare | the kind-words crystal and the cruel-words chaos |
| **Field** | a pattern edge to edge, with one thing lit inside it | a neuron network with one glowing path; a starfield |
| **Landscape** | thin horizon lines, a small figure, a sun or moon, a lot of sky | a person on the horizon, the sun about to set |
| **Timeline** | a ruled line across the width with dates, ticks and a marker | Oct 8 → Oct 15 |
| **Type** | the number or date itself as the picture, big, made of dots | `10 / 10 / 10` → `2 + 0 + 2 + 6` |
| **Rows** | the same mark repeated in symmetric rows left and right | rows of thought-waves on both sides of a light |
| **Perspective** | a 3D form drawn in ellipses or rings | a petri dish; a sphere of words turning |

**Keep a motif** so the changes read as one film: a small recurring mark (three tiny stars at the top, a white
orb that stands for *you*, a timeline that returns), plus the caption and the palette. The last frame returns to
the first so the reel loops.

## Materials

How a thing is drawn matters more than how many things there are. Mix these; one form rarely needs more than two.

| Material | Use it for | In the engine |
| --- | --- | --- |
| **Outline** | the main form: a thin cream or white line, 2–4 px, round caps, a few interior lines (fingers, folds) | `add.line(shape, { width: 3 })` |
| **Dot fill** | tone and volume inside a closed form: a halftone grid whose dots grow toward the light, the centre of a sphere, or the rim | `dots: { shade: "light" \| "sphere" \| "edge" \| "flat" }` |
| **Dotted line** | figures, paths, trajectories, horizons, orbits: a string of round dots | `stroke: "dotted"` |
| **Swarm** | the key subject made of thousands of glowing points; it flies, swirls and re-forms into the next subject | `add.swarm` → `.form`, `.scatter`, `.burst` |
| **3D form** | a sphere of points with craters and a lit side, a wire globe, rings, a torus, a double helix, turning in perspective | `add.shape3d` |
| **Flow field** | hundreds of streaming trails: wind, blood, currents, dust, light pouring in | `add.flowfield` |
| **Particles** | sparkling points along a path, stars, dust, a burst | `stroke: "points"`, `add.particles` |
| **Hatching** | engraved shading inside a form, crossed in the shadows; or many fine strokes (feathers, rays) | `hatch: { … }`, or a generated `S.path` |
| **Orb** | light itself: a solid glowing core with a halftone halo (*you*, a blessing, the sun) | `add.orb` |
| **Small type** | labels and readouts, crisp above the screen, never filtered | `add.text`, `add.counter`, `add.label` |

The screen does the glow: lines are crisp, their glow is quantised into a dot screen (6 px cells) with a slight
RGB split; dot fills and orb halos sit on the same grid. Text never goes through it (see `crispText`).

## Colour

- **One main tint per reel** (gold, or silver-white, or cream) does most of the work.
- **One or two meaning colours**, used sparingly and only where they mean something: red for the negative
  (cruel, chaos, "not enough"), blue for structure (identity, data), violet for the night and the moon, teal for
  life. Never more than two colours besides the main tint on screen at once.

| Role | Ember (reference) | Means |
| --- | --- | --- |
| `ink` | cream | the main tint: outlines, the person, neutral things |
| `accent` | gold | light, a blessing, the good path, the CTA; the one thing to look at |
| `life` | teal | the body working, growth, the yes |
| `calm` | violet | the night, the moon, sleep |
| `alert` | coral red | stress, chaos, the negative, the heart's red |
| `info` | blue | structure, data, a question, water |
| `dim` | grey | guides, ticks, horizons, labels that don't matter |

Colour changes are tweens, not cuts.

## Labels and numbers

Tiny, precise and crisp, at the edges of the picture, never over it:

- **Brackets** name what you're looking at: `[ CLAIM ]`, `[ ALVEOLUS ]`.
- **Readouts** pair a dim label with a bright value: `REPS / 230`, `48 H`, `x400`, `2.5 MILLION YEARS AGO`.
- **Leaders** only when pointing at a part: a dot on the part, a thin line, the label.
- Mono or pixel type, uppercase, tracked; 20–24 px (smaller is unreadable on a phone). Numbers count up while
  the voice says them.

## Motion

1. **Things arrive by drawing, gathering or glowing up.** Lines draw on with a bright tip; particles gather into a
   form; dot fills fade in behind their outline; orbs swell; text types. Exits fade. 0.5–1.4 s for forms,
   0.3–0.6 s for labels.
2. **One idea per line, landing on its keyword.** A new picture, or one change to the current one, on the word it
   answers to (`at: "word"`). Never a line with nothing new; never more than two new things in one.
3. **Scenes cross-fade or morph; nothing cuts hard.** Old marks fade while the new form draws; a shape may morph
   into the next when the two rhyme (a number into a face, a cell into a flame).
4. **Light travels.** A glow runs along a path, a dot crosses from one thing to the next, a beam reaches a figure.
5. **Nothing is ever quite still.** Points twinkle, a sphere turns, an orb breathes, a readout ticks. Ambient
   motion is slow and small.
6. **The camera mostly holds.** A slow push or a dive into a detail at most once or twice a reel.
7. **End where you began**, so the reel loops.

## Captions

- Poppins, 50 px, centred, one or two balanced lines, at y ≈ 1440.
- The whole line appears dim and each word turns white, with a soft glow, as it is spoken. Key words are bold
  (`*word*`): one to three per line, the word the picture answers to.
- Lines are short spoken phrases (2–9 words), not sentences cut to length.

## Pace and shape

- A calm voice, 110–170 words a minute, with room between sentences. Beats of 1–3 s; a picture lasts 2–8 s.
  Reels of 30–100 s.
- **Hook in the first 1.5 s**: a number or a date, a question with a stake.
- **Body**: a list, a ritual in steps, a journey through places, or a claim and its proof.
- **Turn** near the end: "But here's the part nobody tells you…".
- **Ask**: "Save this", or "Comment WORD and I'll send you…" with the pill; it confirms (`✓ ON ITS WAY`).
- **Loop**: back to the first frame.

## Sound

A voice that is calm and intimate, close to the mic. Under it a soft ambient pad, never a beat. Tiny UI sounds
for things that appear (ticks, typing, a chime, a whoosh), quiet enough to feel rather than hear.
