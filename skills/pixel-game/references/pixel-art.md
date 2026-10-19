# Drawing the cast

Everything on screen is pixel art drawn in code, at load time or on first use, and cached. Anything real (a person, a
product, a place) is drawn from photos, so people recognise it at a glance.

## From photos to features

1. **Collect two or three photos** of each real subject, from different angles, ideally from the moment the game is
   about (what they wore on that stage, the car at that demo). Wikimedia Commons first. Link them in the README; don't
   ship them.
2. **List what makes it recognisable**, biggest first: the silhouette, then hair or the outline of the head, glasses,
   the face's shape, the clothes' colours. For products: the silhouette and the signature details. The Roadster: a
   knife-edge wedge, a dark canopy, a black rocker widening into an all-black rear corner, thin-spoke wheels, a red tail
   bar. Ray-Ban Meta glasses: thick black Wayfarer frames, the camera lens in one top corner, the capture LED in the
   other.
3. **Caricature, don't trace.** At 20–70 pixels, a faithful trace reads as nobody. Push what's distinctive (the head's
   shape, the hair's mass, glasses, nose, chin) and drop what's generic. Model Kombat's first faces were turned down
   as "too abstract", "too simplified" and "not distinctive enough"; these caricatures are the ones that worked:
   - Sam Altman: a rounded mass of brown hair swept up and back, a face widest through the cheekbones, the chin
     forward, small blue-grey eyes (big eyes made him someone else), ears out; a charcoal suit and light blue tie.
   - Dario Amodei: a pear-shaped head, a ring of short dark curls round a big lined forehead, thick black rectangular
     glasses, a big round nose, rosy cheeks; a navy suit and purple tie.
4. **Show the user the faces first**: a sheet of big headshots and expressions, before they go into the game. Expect two
   or three rounds; caricatures people know are judged hard.
5. **No logos, no brand marks, no real text** on clothes, cars or devices.

## Sizes that read on a phone

| What | Size | In |
|---|---|---|
| A runner's hero | 16×19 | Pixel Hop |
| A vehicle | 44×12 | Flappy Roadster |
| A figure seen from above or behind | 14×20 | Meta Gear Solid |
| A fighter | frames of 92×112 (about 60 px tall), with a 24×28 head | Model Kombat |
| A portrait (select screen, result, share card) | 66×74, painted at 1:1 | Model Kombat |
| Props, coins, icons | 7–30 px | all |

Smaller than these and the subject stops reading in a vertical video seen on a phone.

## Ways to draw

**Character maps** (`R.sprite(rows, pal)`): one character per pixel, a palette object, and the characters listed in
`pal.glow` also go into the sprite's glow twin. Best for anything with a few fixed frames. From Pixel Hop:

```js
const HERO = { k: '#170d2b', w: '#eef6ff', s: '#9db0d8', v: '#25103f', e: '#2ef6ff', p: '#ff3fd2', f: '#6a5a9a', glow: 'ep' };
const run = R.sprite([
  '..........pp....',
  '..........k.....',
  '...kkkkkkkkkkk..',
  '..kwwwwwwwwwwwk.',
  '.kwwwwwwwwwwwwsk',
  '.kwvvvvveevveesk', // eyes glow
  // …
], HERO); // → { c, g, w, h }: the sprite and its glow twin
```

Keep the outline its own character (usually a dark purple, not black), light from one side with a second tone, and
build frames from shared parts (Pixel Hop's head plus three pairs of legs).

**Procedural pixels**: `fillRect` calls in a function of the frame, for figures whose parts move (Meta Gear's sneaker
and guests in four facings, legs and arms swinging with the step).

**A painter's grid** for portraits (Model Kombat's `Grid` in `art.js`: `set`, `rect`, `rows`, `stamp`, `tint`, `line`):
paint feature by feature at 1:1. The face from a list of half-widths per row (its shape), hair from clumps, the eyes,
glasses and mouth as small stamps, shading by tinting a side.

**Polygons** (`R.poly`) for vehicles and machines, filled scanline by scanline with no anti-aliasing, then `R.outlined`
for a 1 px outline.

**A rig** for anything that fights or dances: limbs as strokes at joint angles, a hand-drawn head map on top, a jacket
sprite rotated with the spine; every animation frame rendered once and cached (`R.fighterFrame(id, anim, i)` in Model
Kombat; each animation is a list of poses).

**Expressions** as patches on a head map: `[row, col, 'str']` replacements for hurt, knocked out, winning, shouting.

**Rotation without mush**: RotSprite-lite (Scale2x three times, rotate by nearest sampling, read back at 1×) with a
per-angle cache (`R.carRotated` in the Roadster's `art.js`). Plain canvas rotation blurs pixel art.

**A glow rim** to lift a hero off a busy scene: `R.outlined(sprite.c, '#2ef6ff')` drawn into the glow buffer at 40%.

## Check

- A sprite sheet per game (`tools/games/<game>/sheet.html`; `node tools/sheet.mjs <game>` writes
  `tools/out/<game>-sheet.png`): every frame at 4× with its glow twin underneath.
- In the game, at phone size, from arm's length: who is it? If you have to think, push the caricature further.
