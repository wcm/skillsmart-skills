# The prompt formula (the still)

Every still comes from one sentence. Three slots are the page's; three lines are shared and were tuned over several
rounds against reference posters of inflated lettering (`tools/pages.json` holds them verbatim):

> **⟨Words⟩**, as **⟨material⟩**. *⟨deform⟩* *⟨camera⟩* *⟨frame, on a plain **⟨backdrop⟩** backdrop⟩*

The model is `nano-banana-pro` (Nano Banana Pro, through `tools/gen.mjs`) at 2K, text only: 20 credits a still. No reference images, no sketches: the formula is the method
(see "What didn't work").

## The shared lines, and what each one fixes

**deform.** Without it, any prompt for "puffy letters", however wild the adjectives, comes back as a neat bubble font
set in tidy rows. What moved the model off that: saying it is *custom display lettering sculpted by hand, not a
typeface*; giving every letter its own size and its own warp (bulging on one side, pinched on the other, ends sagging
like dough, counters squeezed to slits); letters *tumbling at angles of up to thirty degrees, overlapping and
flattening where they touch*; and *piled into one tight, lumpy, organic cluster instead of neat rows*. It ends with
*still readable*, because deformation and legibility trade off. Even with this line the model leans tidy, which is
why you take three.

**camera.** *Eye level, three-quarter, the cluster turned about thirty degrees*, so the letters recede in depth and
their thick sides show. Straight on reads flat. A low three-quarter view looked best in isolation but puts the
letters on a floor. A view from above flattens the depth and stacks lines into a pile that is hard to read.

**frame.** *Floating in mid-air in front of a seamless, plain backdrop: no floor, no ground, no surface, and no shadow
falling on the backdrop; round on every side, the bottom as round as the top; nothing else in the frame; clear empty
space all round.* Each clause is there for the cut-out. A floor gives the letters flat bases and a contact shadow,
and the matte either keeps the shadow (a grey smear under the letters on the page) or slices the letters flat. A
letter touching the frame's edge gets cut off. Anything else in the frame (props, text, a logo) ends up in the matte.
The page adds the shadow back in CSS, tinted from the page colour, where it can follow the cursor.

## The page's slots

**words.** Quote the letters exactly, and say how they break. The scaffolder writes this for you:
- one line: `the word "BLOOM"`;
- two lines: `the words "POP" over "STAR" on two stacked lines` (a split word: `the word "HUGGER" split over two lines, "HUG" over "GER"`);
- three lines: `the words "HELLO", "COZY" and "SEASON" on three stacked lines`.

Capitals were what we tested. Keep lines short (2–6 letters): three lines of five or six letters was the most we
tried, and that one ("SEASON") got hard to read once deformed.

**backdrop.** The page colour in plain words (`lime green`, `warm off-white`, `cornflower blue`). The matte's soft
edge keeps a trace of the backdrop, so if the backdrop is the page colour, the trace is invisible on the page. Plain
and mid-to-light colours matte best. On a very dark page, shoot on a mid-tone of the page colour and check the edges.

**ratio.** The frame the still is shot in, matched to the words' shape (the scaffolder picks it): `1:1` for a block
like HUG/GER, `3:2` or `4:3` for two wider lines, `3:4` for three lines, `16:9` for one long line.

## Materials

One sentence about the surface: what it is like (an everyday object people know), its finish, how it takes light,
its colours, and what it must **not** have, because the model adds its favourite texture for that material
unless told otherwise. Tested:

| Material | The sentence | Notes |
|---|---|---|
| satin vinyl | hot magenta-pink letters with a smooth, seamless satin finish like soft-touch inflated vinyl: one continuous skin with no seams or crimps, soft broad highlights, deep saturated pink in the shadows | without "one continuous skin with no seams or crimps", "inflated" turns into foil balloons with crimped seams |
| gloss bubblegum | smooth, high-gloss bubblegum-pink inflated vinyl like a pool toy: one perfectly even pink with no marbling, no swirls, no stripes, no streaks and no pattern of any kind, a seamless skin with no seams, knots or crimps, mirror-like reflections of soft studio lights as bright white highlights along the curves, a warm hot-pink glow where the surface turns away and a slightly deeper pink in the creases | "bubblegum" alone brings candy marbling and stripes; "glossy balloon" brings a tied knot; "pool toy" brings the clean mirror gloss |
| matte rubber foam | thick, chunky letters of squishy matte soft-touch rubber foam with wobbly, wavy, melted outlines, each letter a different flat colour from coral orange, cobalt blue, sunflower yellow and mint green, with a velvety micro-texture and no gloss at all | several colours: name them and say "each letter a different…" |
| faux fur | overstuffed plush letters covered in soft faux fur in white, pale grey and dove grey, changing letter by letter, fine fibres catching the light at the edges | set `"matte": "matting"` (fur edges); fur on a blue backdrop matted cleanly |

Writing a new one: start from the closest tested sentence and swap the object, finish and colours, keeping the
"what it must not have" clause. Ideas we have *not* tested: chrome or mirror foil (expect seams: exclude them),
gummy jelly (translucent; expect the backdrop to show through, which the matte handles badly), flocked velvet,
chunky knit, marshmallow, frosted glass. Treat these as experiments and take more takes.

## Takes

Make three takes at once (`generate.mjs <id> --takes 3`) and pick from the sheet; one prompt can give a great take
and a tidy one. Check each take for:
1. spelling, and every letter readable;
2. deformed and tumbling into one cluster, not a tidy font in rows;
3. floating, round underneath, no floor, no shadow on the backdrop;
4. clear space all round, nothing touching the edge;
5. the material as written (no stripes, seams, knots or crimps you didn't ask for).

If every take fails on the same point, change the slot that controls it: (2) take three more, since that is just
variance; (5) rewrite the material's "must not" clause; (1) shorten the lines; (3) and (4) mean the frame line was
edited, so restore it. `--fix "…"` appends one sentence for a run, for small corrections ("make the R rounder").

## What didn't work (so you don't spend on it again)

- **Stronger adjectives alone** ("wild", "chaotic", "extremely deformed"): the same neat font in rows. Structure
  (sizes, warps, angles, overlap, one cluster) moved the model; adjectives didn't.
- **A reference image as a style guide** (nano-banana-pro/edit with a poster we liked): it matched the material well
  but kept a regular font layout, and it ties the result to someone else's work.
- **A code sketch rendered by the model** (letters warped in SVG, then "turn this sketch into a photo"): the most
  deformed results, but it is not a prompt-only method and was rejected for that.
- **Slabs.** Describing the letters as "thick slabs with wobbly melted edges" (to get flat, cut-foam letters) still
  gave round bubble letters. Matte rubber bubble letters are what this formula makes.
- **A floor**, even a nice one: flat bottoms and contact shadows (see frame).
- **Three long lines**: deformation makes them hard to read. Shorten, or move words into the code-built copy.
