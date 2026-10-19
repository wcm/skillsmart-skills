# Motion script

## Beat sheet: 12 s

| Beat | Default length | Words | What moves |
| --- | --- | --- | --- |
| `tease` | 1.4 s | a small line ("Something new") | letter-spacing settles |
| `word` | 1.6 s | 1 word | the style's arrival (loud: scales down from 240 %, swiss: slides in on the baseline, memphis: springs in, xerox: stamps, bauhaus: rises) |
| `flash` | 1.2 s | 1 word on the accent | slides up, hard cut |
| `stack` | 2.6 s | `lines: [3]`, the middle one in the accent | each line wipes in |
| `marquee` | 2.6 s | a phrase | two rows scroll in opposite directions, an accent rule grows |
| `end` | 2.8 s | `brand` + `line` (date, URL) | arrives and holds |

## Extra beats for 20–30 s

| Beat | Length | Fields | What moves |
| --- | --- | --- | --- |
| `type` | 2.2 s | `text` (≤ 30 characters) | typed out with a block caret |
| `split` | 1.9 s | `text`, `reveal` | the word splits in half horizontally, `reveal` appears in the gap |
| `count` | 1.9 s | `value`, `prefix`, `suffix`, `label` | an odometer: each digit rolls into place |
| `grid` | 2.1 s | `text` | the word repeated as outlines; one fills with the accent and grows |

A 24 s script: tease → type → word → flash → split → stack → count → grid → marquee → end. Any beat takes
`dur` to change its length; keep cuts on a steady rhythm (multiples of about 0.2 s feel musical).

## Styles

| Style | Type | Colours | Around the words |
| --- | --- | --- | --- |
| `loud` | Anton, capitals | black, off-white, acid lime | nothing: just cuts |
| `swiss` | Inter Tight 800, sentence case, flush left | warm white, black, red | a 12-column hairline grid, a running index ("05 — split") |
| `memphis` | Rubik 800, capitals | pink on a dot grid, black, yellow, teal, blue | squiggles, dots, triangles, rings and striped bars spring in every beat |
| `xerox` | Archivo Black, capitals | photocopy grey, black, red | grain and halftone behind the words (never over them), a fresh copy at every cut, 12 fps |
| `bauhaus` | Jost 700 | cream, black, red, blue, yellow | a circle, a square and a half-disc roll into a new composition every beat |

`accent: "#…"` replaces the style's accent. `colors: { bg, ink, accent }` replaces all three.
