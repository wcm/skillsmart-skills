# Design

## Glass shows itself only by bending what's behind it

- **Thick, real glass.** Every piece refracts, distorts and frosts what's behind it, and splits red from blue at its
  edges. Reeds show a squeezed, repeating slice of the colour; tiles are lenses with a wide rounded rim; drops turn the
  photo over at their rims. Thin glass reads as flat stripes or a light veil.
- **Nothing drawn on the glass.** No white outlines, highlight lines, bevel glows or drop shadows: they look added.
  Every edge is the picture behind, bent.
- **The glass stays still; the backdrop moves.** The cursor stirs Reeded's colour, Tiles' ball follows it, Liquid's
  big drop is carried by it. A pattern on the glass that changes under the cursor reads as cheap.
- **Glass runs off the page.** Full-page reeds, a wall of tiles that bleeds off the edges, not neat inset panes. Behind
  the copy it can be nearly flat, but it's still there.
- **Strong edges under the deepest glass.** A soft backdrop hides refraction: put the colour's edges, the photo's
  points of light, the ball's rim where the glass bends most.
- **Wiping needs a press.** Steam's fog is wiped by a click or a drag, never by just moving over it, and comes back
  within seconds.

## The backdrop

- **Colour field (Reeded)**: a pale base close to the page colour and five blobs in one hue family (violet on lavender);
  the calm box keeps the copy on clean ground.
- **Photo (Steam, Liquid)**: strong colour, points of light and contrast, no text. A rainy street at night through a
  window for fog; a heap of fresh flowers for drops. Generate one with `tools/photo.mjs` (20 credits) or use the
  user's own.
- **Ball (Tiles)**: a deep core (dark red) running out through orange to yellow, on a light grey ground, as in the
  frosted-tile heroes this follows. Another brand can change the hues, keeping the deep core and the bright rim.

## Layouts (`data-layout` on `.hero`)

| Layout | The glass | The copy | On tall screens |
|---|---|---|---|
| `center` | fills the hero | centred on top | the same |
| `window` | a framed pane inset in the page (`.hero__frame`), Steam's | on the glass, low left | the same |
| `split` (`data-side`) | one side (the photo fades into the page; the tiles stop at the title) | on the other side | above the copy |
| `wings`, `disc`, `horizon`, `portal` | both sides, a circle, a low scene, a ring | between, beside, above, inside | as in the page shell |

## Copy

A headline with a turn, short, one phrase in `<em>`; a sub of one or two lines; two calls to action; a three-point
section under the hero that tells the story. The examples' words never survive.
