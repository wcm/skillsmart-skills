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
and reword `detach1` (name the thing more exactly, say where it is: "under it", "behind its handle").

## 3 · Erase by hand (free)

`erase1` (or `erase2`) is a list of polygons in the photo, each a list of `[u, v]` points (u across, v down, both 0–1),
cleared from the cut-out: `"erase2": [[[0.31, 0.71], [0.62, 0.71], [0.62, 0.9], [0.31, 0.9]]]`. Read the points off
the photo with a grid: the same idea as `anchors.mjs --grid`, on `out/<id>/place2.png`. Use it for a thin bar or a
reflection's last sliver; it can't add back what the mask missed.

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
