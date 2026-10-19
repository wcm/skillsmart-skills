# The story

Everything the film says lives in one `LaunchVideo.film({...})` block. Six scenes, always in this order; the
engine times them (about 3–4 s each, 26–32 s in all).

| Scene | Field | What to write | Length |
| --- | --- | --- | --- |
| Hook | `hook` | one line that names the pain or the promise, 4–8 words | 3 s |
| Problem | `problem: []` | 2–3 short fragments that show the mess (≤ 5 words each). Optional | 2.9–3.7 s |
| Product | `product: { text, screen, device }` | "Meet *Name*." or the one-line promise; the main screenshot; `browser` or `phone` | 4 s |
| Features | `features: [{ title, text?, screen, focus?, word? }]` | 1–4 features, a 3–6 word title each, its screenshot | 3.6 s each |
| Proof | `proof: { value, prefix?, suffix?, label, source }` | one real number with what it measures and where it comes from. Optional | 3.6 s |
| End | `end: { line, date, url }` | the name (or version), the date, the URL | 4.2 s |

Also: `style`, `accent` (the brand colour, any CSS colour), `brand` (the name), `logo` (an image for the end card,
SVG or PNG with transparency), `font` (overrides the style's display face), `colors: { bg, ink, sub, accent }`.

## Screens

- The user's own screenshots only. 16:10 (e.g. 1920 × 1200) for `browser`, 9:19.5 (e.g. 1179 × 2556) for `phone`.
  Larger is fine; the engine fits them to cover the device, anchored top left.
- `focus: [x, y, w, h]` (fractions of the screenshot) slowly zooms into that region during the feature (clean,
  paper, pixel, bold) or draws a hatched figure box over it (drafting). Leave it out to show the whole screen.
- No screenshots at all? Ask for them. A launch film without the product is a teaser: use Kinetic Type Teaser.

## The proof

- `value` is a number (it counts up), with `prefix` (`"$"`) and `suffix` (`"×"`, `"%"`, `"k"`).
- `source` is required when `value` is a claim: "Beta, 1,200 teams, Sept 2026". No source, no proof scene.

## Words

- Sentence case (pixel and bold set everything in capitals for you).
- A feature title says what the user gets, not what the feature is called: "Plans that move when you do" beats
  "Smart Scheduling".
- `word` (bold only): the one or two words flashed full-frame before the feature, e.g. `"ONE PAGE."`. Defaults
  to the title.
