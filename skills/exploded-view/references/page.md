# The page

A page is `site/<id>/index.html` (fonts, colours) and `site/<id>/page.json` (words, parts, lab), on the shared engine in
`site/engine/` (`explode.js`, `labs.js`, `frames.js`, `explode.css`). `build.mjs` writes the rest next to them:
`layout.json`, `img/` and `frames/`. Don't edit those by hand.

## page.json

| Field | What |
|---|---|
| `brand`, `nav`, `navCta` | the top bar: the brand, three or so links, one button |
| `steps` | optional: three short names for the scenes, shown in a pill at the bottom left that marks where the visitor is ("The diner", "Inside", "The park"). The reference pages leave it out |
| `one` | scene 1's words: `kicker`, `title` (`\n` breaks a line, `*word*` sets it in italics), `body`, `cta`, `ghost` (a second, outlined button), `meta` (two or three short facts), `hint` ("Scroll to take it apart"), `alt` (the photo described) |
| `two` | scene 2's header: `kicker`, `title`, `note` ("Keep scrolling to put it back together") |
| `three` | scene 3's words, like `one` |
| `stage` | where the exploded product sits, as fractions of the window `[x, y, width, height]`: `area` on a desktop, `mobile` on a phone. The reference pages use `[0.33, 0.12, 0.34, 0.78]` (a column in the middle) or `[0.05, 0.27, 0.9, 0.5]` (a wide band, for `"labels": "rows"`) |
| `labels` | `"columns"` (labels beside the product: every part's `side` is `"right"`, or `"left"` for some) or `"rows"` (above and below: `"top"` / `"bottom"`) |
| `parts` | one per label, in the order they draw in: `name`, `spec` (one line of facts), `at` (`[u, v]` on the exploded view, 0–1), `side` |
| `lab` | the lab: `style` and its data (references/labs.md) |
| `footer` | optional: a line under the page |

Words: short and concrete, a title of two to five words, a body of one or two sentences, specs as plain facts with
numbers ("90 g chuck, smashed at 230 °C, cheese melted on"). When the product is made up, so are the numbers: keep them
plausible and don't present them as real.

Panels go in the left column (top: the scene's header; below it the lab's panel) and labels on the right, so they
never collide. With `"labels": "rows"`, keep the lab's panel in the top-left corner, clear of the top row of labels.

## index.html: the look

Fonts come from Google Fonts (one `<link>`); everything else is custom properties in a `<style>` block:

| Property | What |
|---|---|
| `--display`, `--display-weight`, `--display-stretch`, `--title-case`, `--title-size`, `--title-lead`, `--title-track`, `--title2-size` | the headline type |
| `--text`, `--mono` | body text and labels, data and small caps |
| `--accent`, `--on-accent` | the main button and highlights |
| `--one-ink`, `--one-muted`, `--scrim1` | scene 1's words and the gradient behind them (over the photo's calm half) |
| `--three-ink`, `--three-muted`, `--scrim3` | the same for scene 3 |
| `--lab-bg`, `--lab-ink`, `--lab-muted`, `--lab-line`, `--lab-accent` | the lab: keep `--lab-bg` the same as the backdrop |
| `--label-font`, `--label-size`, `--label-weight`, `--label-style`, `--label-case` | the parts' names |
| `--foot-bg`, `--foot-ink`, `--brand-size`, `--brand-track` | the footer and the brand |

The five reference looks:

| Page | Display + mono | Colours | Lab |
|---|---|---|---|
| `burger` | Big Shoulders Display 900, uppercase (tall sign letters) + Space Mono | ketchup red, mustard, chrome; dark lab | ticket |
| `headphones` | Instrument Serif, italic for emphasis + Geist and Geist Mono, Doto for the readout | walnut, ivory, one signal orange; pale lab | sound |
| `sneaker` | Archivo at 125% width, 900, uppercase (wide letters read as speed) + Martian Mono | cobalt sky, chalk, asphalt, volt green; dark lab | motion |
| `cabin` | Schibsted Grotesk 800, tight + IBM Plex Mono | blue hour, moss, amber window light, desert gold; pale lab | energy |
| `moka` | Bodoni Moda 600, italic for emphasis (an Italian didone) + DM Sans and DM Mono | espresso, cream, majolica blue, crema amber; dark lab | ticket |

A new look: one display face with character that fits the product's world, a mono for data, an accent that pops on
both photos, and words that read on each photo's calm half (dark text and a light scrim on bright photos, light text and
a dark scrim on dark ones).

## The scroll

The page is 740% of the window tall (`--length` on `.e-scroll`), with a sticky stage. `T` at the top of
`site/engine/explode.js` sets when each thing happens, as fractions of the scroll, and nothing waits between scenes:
the product starts to move on the first scroll (the photo hands over to the cut-out at 0–0.014 and the product flies to
the middle until 0.176), clip a plays 0.152–0.413, the labels draw in 0.375–0.532 and leave as soon as the last one is
in (0.532–0.589), clip b plays 0.556–0.817 while the product flies to the second photo (0.603–0.841), the second photo
takes over at 0.841–0.888, and its words scroll up into place from below the window (0.850–0.936). Only the end rests:
once those words are in, the last 6% of the scroll changes nothing, a short stop on the finished last scene (`REST` at
the top of the file makes room for it; every span is scaled to fit ahead of it). To give one moment more room, widen
its span and narrow the others, or raise `--length` to slow the whole page; `check.mjs` reads the timeline from the
page (`window.explode.timeline`), so its checks follow. The shown point eases after the scroll (smooth steps between
frames); with reduced motion it follows at once and nothing moves on its own.

On a phone (under 760 px wide) the words sit at the top, each photo shrinks until the product fits across the screen
(a blurred copy fills the rest), and the labels become numbered dots with a legend.

`window.explode` once the page is up: `seek(p)` jumps to a point (0–1) and draws it at once, `progress` is the point
shown, `ready` resolves when every frame of both clips has loaded.
