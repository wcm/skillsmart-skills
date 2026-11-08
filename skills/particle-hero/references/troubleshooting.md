# Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| A black or blank canvas | WebGL2 or float textures missing (very old browser), or the pictures didn't load | the console says which; check `site/<id>/img/` has every `<name>.webp` and `<name>-depth.png` |
| The page never shows its first picture in a background tab | browsers pause background tabs: no animation frames while hidden | expected; it starts when the tab is shown. For checks, step it by hand: `nuee.advance(3)` |
| The subject is a flat blob | all its tones are alike (black leather, a white product) | `levels: { gamma: 1.5–2 }`; a stronger rim light in the prompt; on dark, `exposure` down |
| A change burns to a white cloud | grains pile up in the cloud | `flightDim` 0.5–0.7, or `kick` up so the cloud spreads wider |
| A melt looks like a gentle swarm | its pairing wasn't ready yet (a click in the first seconds after load); the next time it melts | expected; the pairings are worked out in the background, next-in-line first |
| A melt looks patchy | the two shapes are too different (a shoe into a bottle) | use a swarm between different shapes (`move: { travel: "swarm" }` on that picture) |
| The middle of a swarm is a shapeless blob for too long | the pull home builds late | `ramp` up (0.8–1), `blur` down, or `spring[2]` up (40) |
| The hover feels weak | | `hand.drag` 12–16, `hand.reach` 0.17–0.2; or `hand.still` 0.1 for a visible parting under a still pointer |
| The hover feels busy or the grains too loose | | `hand.drag` 6–8, `hand.spread` 1–1.4, `spring[0]` 14 (they settle faster), `parallax` 0.5 |
| Paper looks muddy or too dark | ink piles past its own colour | `inkCap: 3.22`, `exposure` 0.5–0.8 |
| The title is covered | the subject's frame overlaps the title's band | move `frame`'s `cx`/`cy` or shrink `s`; on neon, put the title behind the dust (`transparent: true`) |
| Grains look too coarse or too fine | | `size` 0.7–1.4, or `count` (a power of two) |
| Slow on an older laptop | 524,288 grains | `count: 1 << 18` (or `1 << 17`) |
| A portrait ends on a hard line | the photo is cut off at the bottom | `fade: 0.3` on that picture |
| The cut-out kept a shadow or a stand | | redo with `--fix "no shadow, nothing under it"`, or use a `photo` you've cut out yourself with `cutout: false` |
| `NOT ENOUGH CREDITS` / exit code 3 | the account needs credits | tell the user what it costs (`--dry`) and where to top up (the message says); nothing failed is charged |
| The depth model won't download | no network to huggingface.co | run once with the network; it's cached after that |
