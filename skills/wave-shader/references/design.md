# Design

## One feeling

The skill is about one thing: a slow, wavy surface of colour. Every page is a preset of the same engine, so a set of
pages reads as one family. Don't bolt on a different effect (a disc, a grid of stripes, a particle field) to make a
page "different": change the shape, the camera, the palette and the light instead.

## Colour

- Five stops, low to high, in one hue family per page. A warm page (terracotta, apricot, peach, cream) and a cool one
  (green to violet on night) never share a family; check a series side by side.
- Calm, premium pages: close values, a pale top stop that meets the page colour.
- Eye-catching pages: saturated stops on white or black (orange, hot pink, violet, periwinkle on white, after
  stripe.com's hero). "Tasteful" muted gold on brown reads as dull.
- Nothing uniform: no evenly spaced bands or rows, no clean-cut edges. An aurora's reach, its start, each ray's length
  and each patch's brightness must all wander, or it looks mechanical.

## Layouts (`data-layout` on `.hero`)

| Layout | The shader | The copy | On tall screens |
|---|---|---|---|
| `center` | fills the hero | centred on top | the same |
| `wings` | both sides, faded out toward the middle (`--wing-solid`, `--wing-clear`) | in the clear middle | above and below the copy |
| `split` (`data-side="right"` or `left`) | one side, fading into the page (`--split-w`, `--split-fade`) | on the other side, left-aligned | above the copy |
| `horizon` | a scene with its horizon low | in the sky | the same |
| `portal` | a ring round the middle | inside it | the same |
| `disc` | a circle beside the copy (`--disc`) | beside it | in the flow above the copy |
| `window` | a framed pane inset in the page (`.hero__frame`) | on the glass | the same |

`.hero.has-scrim` adds a soft fade under the nav for busy looks. The copy sits where the shader is calmest: over the
silk's mist, in the aurora's starry middle, in the sea's sky, beside the ribbon.

## Copy

A headline with a turn, short; one phrase in `<em>` gets the accent. A sub of one or two lines, two calls to action,
a three-point section under the hero that tells the story. Write it for the brand; the examples' words never survive.

## Motion

Slow and soft. Drift that you notice after a few seconds (`speed` ≤ 0.6), a gentle twist, a cursor that nudges, a
click that ripples once. Strong twisting, fast movement and big pushes have always been sent back. The view leaning
toward the cursor (`lean`) is a small touch, 0.03–0.08.
