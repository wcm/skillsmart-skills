# The prompts

`tools/subjects.json` has shared lines at the top and one entry per page in `subjects`. The five reference entries
are in `<skill>/assets/examples/subjects.json`: read the one closest to your product before you write. `{noun}`,
`{backdrop}`, `{backdropName}` and `{detach}` in the shared lines are filled in from the entry.

## The entry

| Slot | What to write |
|---|---|
| `noun` | what the product is called in the prompts: "burger", "headphones", "shoe", "cabin and its deck", "moka pot" |
| `backdrop`, `backdropName` | the plain colour the product is cut out on, as hex and in words ("#E9E5DE", "pale warm grey"). Dark for a light product, light for a dark one; it is also the lab's background (`--lab-bg`) |
| `fit` | how tall the whole product is in the studio frame, as a share of its height (0.3–0.55). Lower when the explosion spreads up and down (a stack 0.3–0.4), higher when it spreads sideways (0.45–0.55) |
| `find` | optional: the common word SAM 3 finds the product by, when `noun` is unusual (references/cut-outs.md) |
| `detach1`, `detach2`, `erase1`, `erase2` | optional: cut-out fixes (references/cut-outs.md) |
| `cut` | optional: `"birefnet"` skips SAM 3 for a product standing free |
| `place1` | the first photo |
| `place2` | the second photo |
| `exploded` | the exploded view |
| `remove1`, `remove2` | the two empty places |
| `explode`, `rebuild` | the two clips |

## place1: the first photo (from text)

Write it like a photographer's brief, in this order:

1. **The kind of photograph and the moment**: "Cinematic late-night photograph inside an American diner at 1 a.m."
2. **The product, exactly**: its materials, colours and every part you'll label later ("a chalk-white engineered knit
   upper, flat white laces, a thick volt-green foam midsole with a thin black carbon-fibre plate showing as a stripe
   along its side…"). This description is what keeps it the same in every later picture.
3. **What it rests on**: directly on a matte surface; nothing under it (references/subjects.md).
4. **The place behind it**, softly out of focus, in 4–6 concrete things, nothing readable.
5. **The light**, with a reference if one fits ("like Edward Hopper's Nighthawks").
6. **The camera**: height, angle, lens, depth of field ("low at counter height, front three-quarter view, 85 mm lens,
   shallow depth of field, the burger razor sharp").
7. **The composition**: "The burger sits in the right third of the frame and fills about half the frame height; the
   left half of the frame is darker and calm, leaving room for a headline."

The shared `photo` line adds the realism and the "no text, no logos" rules.

## place2: the second photo (an edit of the studio frame)

Start with "Show the very same {product} whole again, now …", then the new place, **the new camera position and pose**,
the light, and the composition mirrored ("in the left third… the right half calm, leaving room for text"). Spell the
angle out by what it shows: "The camera looks down from above at a steep angle, about 60 degrees, so we see the whole
round sesame top of the bun." Asked only for "a different angle", the model keeps the old one. A change of pose works
best: lying on its side on a train seat (headphones), toe first at a low angle (shoe), from the opposite corner (cabin).

## exploded: the exploded view (an edit of the studio frame)

"Turn this into a clean exploded view of the very same {product}, seen from the same {angle}." Then how it comes apart
(references/subjects.md), every part in order ("From top to bottom: the sesame brioche crown, the pickles, the top
patty with its melted cheese, …"), a light that separates the parts ("a thin amber rim light around every layer"), and
how much of the frame the assembly fills ("about 80% of the frame height, with wide empty space on both sides"). The
shared `exploded` line keeps the backdrop plain and bans labels, arrows and text (we draw those in code).

## remove1, remove2: the empty places (edits of the photos)

"Remove the burger and its shadow completely, leaving the empty crinkled wax paper on the counter." Name the product,
its shadow and reflection, and say what stays; the shared `plate` line keeps everything else exactly where it was, so
the empty place lines up with the photo.

## explode, rebuild: the clips (Kling, start and end frames)

Kling gets the start and end pictures; the prompt only says how to get from one to the other. Describe **one** motion,
plainly, in the present tense:

- explode: "The burger comes apart: each layer lifts straight up off the one below and floats upward until all the
  layers hang in an evenly spaced vertical stack, a few sesame seeds drifting between them."
- rebuild: "The floating layers glide back down onto each other and close into one whole burger, which tilts toward the
  camera so its round sesame top shows, as the light turns to warm sunshine."

No negations ("never", "doesn't") in these: they make the thing happen. Unwanted things go in the shared `negative`
line. The shared `clip` line keeps the camera still and the backdrop flat.

## The shared lines

| Line | Prevents |
|---|---|
| `photo` | illustration and CGI looks; readable signs, logos and watermarks; frames that aren't 16:9 |
| `same` | the product being redesigned between pictures (different handle, extra stripes, a grille appearing) |
| `exploded` | the backdrop coming back, floors and shadows, labels and arrows drawn into the picture |
| `detach` | the product being changed while something is removed from around it |
| `plate` | the empty place shifting, so it no longer lines up with the photo |
| `clip` | camera moves and the backdrop changing colour, which spoil the cut-out |
| `negative` | zooms, pans, extra or duplicated parts, melting, flicker |

Change one only for a reason you can name, and keep the old wording in a note.
