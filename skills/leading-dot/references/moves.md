# Moves

Every scene is `{ move, text, ...fields }`. `text` is the caption (3–7 words; `*word*` in the accent colour).
Any scene takes `dur` (seconds) to override its natural length and `name` for the preview's scene marker.
Lengths below are typical at the default pace.

| Move | The dot… | Fields | Length |
| --- | --- | --- | --- |
| `drop` | falls in and bounces to rest | `text` | 2.3 s |
| `bounce` | hops across a sentence, each word appearing as it lands; the sentence is the caption | `text` (≤ 8 words) | 2.5–4 s |
| `grow` | becomes a phone, browser, card or square screen, then shrinks back | `text`, `shape` (`phone` · `browser` · `card` · `square`), `image` or `card: { title, lines: [] }` | 3.8 s |
| `split` | divides into 2–4 dots, one per label, then merges back (liquid) | `text`, `items: []` (1–2 words each) | 4–5 s |
| `line` | rides a line chart it draws, points popping as it passes; the scale starts at zero | `text`, `values: []`, `labels: []`, `value` (the callout, e.g. `"3×"`) | 4–5 s |
| `ring` | grows, hollows into a ring, and a progress arc fills while the number counts | `text`, `value`, `max` (100), `suffix` (`"%"`) | 3.8 s |
| `pulse` | sends out three rings, with an optional badge | `text`, `badge` | 3 s |
| `orbit` | grows; small dots spin out and orbit it with labels, then fall back in | `text`, `items: []` (≤ 6, short) | 4 s |
| `button` | stretches into a pill button, gets pressed, optionally changes label | `text`, `label`, `done` | 3.4 s |
| `type` | becomes a text caret that types a prompt, then jumps into the send button | `text`, `prompt` (≤ 40 characters) | 3.5–4.5 s |
| `fill` | floods the frame: dot and background swap colours; a headline lands with the dot as its full stop | `text` (the headline, no full stop) | 3.5 s |
| `logo` | lands as the dot of the brand's last `i`, or as its full stop | `brand`, `tagline`, `dot` (`"i"` · `"period"`) | 3.5 s |

## Choosing moves

- **Story shape**: hook (`drop`, `pulse`) → tension (`bounce`) → product (`grow`) → how (`split`, `type`,
  `orbit`) → proof (`line`, `ring`) → turn (`fill`) → `logo`.
- Moves that need data (`line`, `ring`) only with the user's real numbers.
- `fill` flips the palette for every scene after it. One `fill` per film is usual; two make a sandwich (light →
  dark → light), which suits a before/after.
- `logo` with `dot: "i"` needs a lowercase `i` in the brand (it uses the last one). Otherwise it ends on a full stop.

## Sizing

The engine lays out every move for 16:9, 9:16 and 1:1 from `F.u` (1 % of the short side). In 9:16 captions sit
above the action; in 16:9 to its left. If a caption wraps to three lines in 9:16, shorten it.

## Writing a new move

A move is a function in `MOVES` that gets `ctx { G, pal, prev, scene, t0, tl, el(), caption() }` and returns
`{ dur, at(local) → { dots, goo }, end }`:

- `at(0)` must return `prev` exactly; `end` is one dot (`id: "m"`) at rest. Use `entry(ctx, point)` and
  `travel(ctx, from, point)` to get there.
- Captions, labels and shapes are DOM elements made with `ctx.el()` and animated on `ctx.tl` at `ctx.t0 + …`.
- `goo: true` turns on the liquid filter while dots split or merge.
