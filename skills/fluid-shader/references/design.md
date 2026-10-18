# Design

## Gentle, always

The liquid is the hero, and it has to feel delicate:

- **Thick, calm water**: high velocity dissipation, low curl. The hero drifts on its own, slowly.
- **The cursor draws, it doesn't churn.** A light touch along its path, or a deformation with no wake: Marble's stylus
  drags the ink along a tine line and nothing more, the way a marbler combs a bath. Momentum pushes make vortices, and
  swirls behind the cursor have always been sent back.
- **A click opens slowly**: a bloom of colour, a slow ring, a new drop, a pop and a fresh film. Never a splash.
- **For reflective looks, light is the interaction.** Liquid chrome read through a moving fluid shows the solver's
  flaws (bands along the canvas edges, blocky shading where the pressure solve checkers), so Chrome's folds are a
  formula and the cursor is a lamp held over them.
- **Delicate visuals**: softer colour and finer detail over saturated, busy and noisy.

## Colour

One palette per page, in one hue family, and in a series no two pages share a family: violet and blue dye on deep
water, silver chrome with one warm strip, indigo, rust and ochre ink on cream paper, a pastel soap film on a pale page.

## Layouts (`data-layout` on `.hero`)

| Layout | The liquid | The copy | On tall screens |
|---|---|---|---|
| `center` | fills the hero | centred on top | the same |
| `wings` | both sides, faded toward the middle (`--wing-solid`, `--wing-clear`) | in the clear middle | above and below the copy |
| `split` (`data-side`) | one side, fading into the page | on the other side | above the copy |
| `disc` | a circle beside the copy (`--disc`); suits Film's wand | beside it | in the flow above the copy |
| `horizon`, `portal`, `window` | a low scene, a ring round the middle, a framed pane | in the sky, in the ring, on the glass | the same |

`.hero.has-scrim` adds a soft fade under the nav when the liquid is busy there.

## Copy

A headline with a turn, short, one phrase in `<em>`; a sub of one or two lines; two calls to action; a three-point
section under the hero that tells the story. The examples' words never survive.
