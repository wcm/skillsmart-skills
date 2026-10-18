# Cut-outs: the isolation ladder

The product is cut out of both photos (`cut1`, `cut2`) and the exploded view (`cutx`). A cut-out must hold the product
and nothing else: a stand it hangs on, the stove under it, a tray, a reflection or a speck of the scene would lift away
with it and float through the clips.

`build.mjs` tries these in order. Look at the bottom row of `out/<id>/stills.jpg` (the cut-outs on a checkerboard)
after every change, and redo a cut-out with `node build.mjs <id> --only cut1` (or `cut2`).

## 1 · SAM 3 by name, BiRefNet's edges (the default, 4 credits)

What the reference pages were cut out with. BiRefNet (`birefnet-image`) finds whatever stands out in the photo,
with soft, accurate edges, but it takes along what touches the product. SAM 3 (`sam-3`) finds only the object a short
prompt names: "headphones" leaves out the stand, "shoe" leaves out its reflection. The cut-out is BiRefNet's mask
inside SAM 3's (grown a little), then only the biggest blob, so specks go.

The word is `find` in the subject's entry, or `noun` when there is no `find`. SAM 3 knows common nouns, not product
names or jargon:

| Product | Works | Didn't |
|---|---|---|
| moka pot | `coffee pot` | `moka pot` (no mask at all) |
| headphones | `headphones` | |
| running shoe | `shoe` | |
| double burger | `burger` | |
| prefab cabin | `cabin` | |

When SAM 3 finds nothing it says so and isn't charged, and the cut-out is BiRefNet's alone, with a warning. When its
mask covers little of what BiRefNet found, it picked the wrong thing and is left out (warning too). Either way: try a
plainer word in `find`, then redo with `--only cut1`. For a product standing free on a plain surface,
`"cut": "birefnet"` skips SAM 3 (2 credits).

SAM 3 can still keep something that looks like part of the product: it kept a camping stove as part of a "coffee pot".
Then go on to 2.

## 2 · Detach (+22 credits)

`detach1` (or `detach2`) names what still clings, in a few words: `"the stove grate and the blue gas flame under it"`.
The cut-out so far goes onto the plain backdrop at its own place, an image edit removes the named thing (an easy edit
on a plain background), BiRefNet cuts the edited picture out, and only what the edit left is kept. It worked on both
moka pot photos where SAM 3 alone didn't.

If the edit takes away most of the product, it is left out and the step says so: look at `out/<id>/cut1-clean.png`
and reword `detach1` (name the thing more exactly, say where it is: "under it", "behind its handle"). The edit is kept
and reused while the cut-out and the words stay the same, so redoing a patch or an erase doesn't pay for it again.

### 2b · Patch (free, with a detach)

When the thing sits in front of the product or presses against it (a stand's cradle under a headband), the edit paints
the hidden bit of product in, but "only what the edit left" still keeps the thing: it touches the product, and the
edit's outline covers the same spot. `patch1` (or `patch2`) lists polygons around the thing, in the photo like
`erase1`: there the cut-out takes the edited picture, toned to match the photo around it, and the edit's outline. Draw
them a little larger than the thing; wherever the edit shows backdrop, those pixels go. The headphones needed one
around the cradle under the headband and one around the stand's post beside the right slider. The place keeps the
thing (the plate is made from the photo), so it stays behind when the product lifts away.

## 3 · Erase by hand (free)

`erase1` (or `erase2`) is a list of polygons in the photo, each a list of `[u, v]` points (u across, v down, both 0–1),
cleared from the cut-out: `"erase2": [[[0.31, 0.71], [0.62, 0.71], [0.62, 0.9], [0.31, 0.9]]]`. Read the points off
the photo with a grid: the same idea as `anchors.mjs --grid`, on `out/<id>/place2.png`. Use it for a thin bar or a
reflection's last sliver; it can't add back what the mask missed.

## The exploded view and the clips

`cutx` is BiRefNet alone: in an exploded view every part is its own blob. Two fixes, both in the subject's entry:

- **`dropx`**: points `[u, v]` on parts the exploded view shouldn't have, such as the extra band the headphones grew
  from the cradle left in their first cut-out (find the point with `node anchors.mjs <id> --grid`). Each part a point
  lands on is painted over with the backdrop in `exploded.png` itself (the old one is kept as `exploded.bak-N.png`) and
  cleared from the cut-out. The clips start or end on that picture, so redo them: `--only cutx,clips,mattes,frames,web`.
- **`specks`**: `0.03` clears every round blob under 3% of the biggest one, in the exploded view and in every clip frame:
  sauce drops or crumbs the video model adds, which the matte catches in some frames and not others, so they flash.
  Long thin parts (a carbon plate seen edge on, a lace) stay. Free: `--only cutx,frames,web`.

## 4 · Change the place

If none of that works, the place is the problem: rewrite `place1` or `place2` so the product rests directly on a matte
surface, with nothing under it and no reflection (references/subjects.md), and run `--stills` again.

## What didn't work (don't retry these)

- **Asking an image edit to replace a busy background** ("only the product, on a flat backdrop"): about half the
  time it only darkened the scene or kept the stand. Asked for a green screen, it painted a green band across the
  photo. Edits on a plain background are reliable; edits that must repaint a busy one aren't.
- **Comparing the photo with its plate** (the product removed): the plate re-renders everything a little, so what
  stayed (a stand) still differs, and dark parts of the product match dark parts of the scene and get punched out.
- **BiRefNet alone on a product on a stand, in a tray or over a reflection**: it keeps them all.
- **Comparing colours before and after a detach edit** to find what it took away: the edit shifts the tone a little
  all over, so a pale product near the backdrop's colour (the headphones' leather) got punched full of holes, and a
  light cradle that matched the leather wasn't found. Polygons (`patch1`) are exact.
- **Asking an image edit to remove a part from the exploded view**: it took the part out but recoloured the whole
  picture and nudged the other parts, which moves the labels. `dropx` changes only that part.
