# The pictures

The pictures are the page. Everything else (the scenes, the material, the scenery) is there to show them off, so they
must be clean: one clear subject, a calm background, no clutter, no text unless it is the point.

## The user's own pictures

```bash
node tools/build.mjs <id> --from <folder>
```

JPG, PNG, WebP, AVIF or TIFF (convert HEIC first), in name order (`01-coat.jpg`, `02-dress.jpg`… sets the order).
Each becomes the next item's master in `tools/out/<id>/`, its `aspect` read from the picture, its title from the file
name when the item has none yet. Then look at `tools/out/<id>/sheet.jpg` and write each item's title, meta and text.

- Fewer pictures than the example had: the extra items are dropped, with their places in the scenes. Check every
  scene still has enough (`layouts.md` → Pictures), and give the big shapes a `count`.
- Mixed shapes are fine on the table, the board, the arc and the trail; a ring, a deck or the tiles look best with one
  shape (crop the odd ones before importing them).
- Anything with a border or a frame: `"trim": true`, or `"crop": [l, t, r, b]`, then `node build.mjs <id>` again.

## Generated pictures

Every prompt is the item's own `prompt` followed by the page's `style` line (and a `--fix` line when you redo one).

**The style line** says what every picture shares, so the gallery reads as one series:

- the medium and the genre ("Editorial fashion lookbook photograph", "Square vinyl record album cover, flat full-bleed
  artwork", "Cinematic fine-art landscape photograph", "A design asset from a high-end design asset library")
- the light and the camera (hard direct flash with a crisp shadow; dramatic natural light, long lens, fine film grain)
- the background and the framing ("Seamless paper backdrop in one flat saturated colour… The coloured backdrop fills
  the whole frame from edge to edge: no studio, light stands or paper edges in view")
- how many subjects ("One model only")
- the endings that prevent the usual failures: "No text, no logos, no watermark, no border, no margin, no frame."

**The prompt** says only what differs: the subject, its colour, pose or moment, the place, and how much of the frame
it fills. One or two sentences. Vary colour and pose from one picture to the next, so a ring of them doesn't look like
one picture repeated, and keep one colour story (Ardent: cobalt, chili red, butter yellow and bone white, the
backdrop often the clothes' own colour).

**Text in a picture** only when it is the point (an album cover), and then say the exact words and nothing else: "The
only words on it are the artist name and the album title given here, spelled exactly. No other text, no barcode."
Keep them short; a broken letter means a redo.

### What went wrong before

| Failure | Fix |
|---|---|
| The brand printed into the pictures: "FAR FIELD COLLECTIVE" on a sign, "KIT OF PARTS" on labels | never put the brand's name in the style line; add "no signs, no text or lettering anywhere". (Ardent's line names the house and got away with it: nothing in a fashion photo carries words) |
| A poster or a cover came back as a mockup: on a wall, in a frame, a device round it | "flat artwork that fills the whole frame from edge to edge, seen perfectly straight on, with nothing around it. No mockup, no device, no hands" |
| A white border or margin round the picture | "runs right to all four edges, with no white border, frame or margin"; then `trim` or `crop` the ones that still have it |
| The studio showed: light stands, the backdrop's edge | "the backdrop fills the whole frame from edge to edge: no studio, light stands or paper edges in view" |
| Two or three models in one look | "One model only" |
| A broken letter in a title | redo it (`--only 11`), and shorten the words |

### The four examples' style lines

They are in each example's `page.json` (`<skill>/assets/examples/<name>/page.json` → `style`, and every item's
`prompt`): read the one closest to your subject before writing your own.

- **Ardent** — editorial fashion: one model, hard flash, a saturated seamless backdrop, full length, 2:3.
- **Side B** — album covers: flat full-bleed artwork, bold minimal graphic design, only the artist and title, 1:1.
- **Far Field** — landscapes: one vast quiet place, dramatic natural light, long lens or slow shutter, 4:5.
- **Kit of Parts** — design assets: a 3D object centred on one solid colour, or flat artwork edge to edge, 4:5.

## Making them

```bash
node tools/pictures.mjs <id> --cost         # how many and the credits: tell the user
node tools/pictures.mjs <id>                # every picture the page doesn't have yet, four at a time
node tools/build.mjs <id>                   # the web images and tools/out/<id>/sheet.jpg
node tools/pictures.mjs <id> --only 04,11 --fix "the coat is camel, not brown"
```

`pictures.mjs` won't start while a prompt or the style line still starts with `WRITE`. A picture the page already
shows counts as made: replace it with `--only` (the old master is kept as `<item>.bak-N.png`). Masters are 2K PNGs in
`tools/out/<id>/`; `build.mjs` makes a 900 px WebP for the gallery and an 1800 px one for the open view, and writes
`images.json` (each picture's size and main colour, shown while it loads).

Look at the sheet before showing the user: every picture one clean subject, the series consistent, nothing printed
that shouldn't be, no border. Then show them the sheet and ask before redoing more than a few.

## Which picture where

- The strongest, simplest pictures go first in every scene's `cards`: they are the ones in front.
- The tiles cut a picture into a grid and the cube into nine: give their `looks` and faces bold, simple pictures that
  still read in pieces (a figure on a plain backdrop, a big shape).
- The book shows two pages at a time: pairs that face each other well.
- The sphere's `end` is the picture the page closes on: the best one.
