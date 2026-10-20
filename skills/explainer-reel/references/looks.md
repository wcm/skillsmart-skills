# Looks, palettes and sound

`looks.jpg` (next to this file) is the same frame (from `assets/examples/renew.js`) through all eight looks, each in its own palette; `node <skill>/scripts/check.mjs <reel> --looks <seconds>` makes one for any reel.

## Looks

The look is the filter the whole frame goes through, plus the type and line that suit it. Pick it from the
topic (table below); every reel works in every look, so you can switch in the preview and compare.

| Look | What it does | Captions | Own palette |
| --- | --- | --- | --- |
| `halftone` | **the reference.** Crisp lines, glow quantised into a 6 px dot screen, RGB split, magenta ghost, grain, mottled ground; text stays crisp above the screen | Poppins | `ember` |
| `led` | the frame as a grid of round LEDs; small text stays crisp on top; lines thickened | VT323 | `amber` |
| `crt` | curved tube, scanlines, RGB aperture mask, bloom, a slow rolling band | VT323 | `phosphor` |
| `neon` | smooth wide bloom, no screen: tubes of light on deep night | Poppins | `aurora` |
| `riso` | ink on paper: multiply, a misregistered second plate in fluorescent pink, halftone shading, speckle | Fraunces | `paper` (light) |
| `blueprint` | white line on blueprint blue with a drafting grid | JetBrains Mono | `blueprint` |
| `dither` | ordered Bayer dither into the palette's four main colours, chunky pixels | VT323 | `gameboy` |
| `chalk` | grainy broken strokes and smudges on slate; lines boil like hand drawing | Caveat | `chalk` |

`riso` takes a light palette and every other look a dark one; the engine falls back (with a warning) if not.

## Choosing by topic

| Topic | Look | Palette | Bed | Why |
| --- | --- | --- | --- | --- |
| mindset, wellness, habits, affirmations, the body | `halftone` | `ember` | warm | the reference: intimate, warm, a bit mystical |
| sleep, dreams, night routines, meditation | `halftone` or `neon` | `aurora` | night | cool and dark, soft light |
| space, physics, the ocean, nature's numbers | `halftone` or `neon` | `ocean` | night | deep blue, a gold accent for stars |
| money, investing, markets, prices, sport stats | `led` | `amber` | bright | a scoreboard: numbers are the hero |
| code, AI, the internet, hacking, retro tech | `crt` | `phosphor` | tense or bright | a terminal |
| how things work, engineering, product anatomy | `blueprint` | `blueprint` | bright | a drawing with parts |
| productivity, books, ideas, history, food | `riso` | `paper` | bright | an editorial print, calm and smart |
| learning, school, explainers for kids, history | `chalk` | `chalk` | warm | a teacher's board |
| games, nostalgia, kids, playful lists | `dither` | `gameboy` | bright | an old handheld |
| growth, gardening, outdoors, food habits | `halftone` | `forest` | warm | green life, amber light |
| love, relationships, self-care, beauty | `halftone` or `neon` | `rose` | warm | plum, pink and peach |
| news, serious, grief, warnings | `halftone` | `mono` | night or none | white line, one red |

When a topic fits two rows (procrastination is both "habits" and "productivity"), pick by the feeling the
viewer should leave with: intimate and felt in the body → `halftone`; clever and calm → `riso`; precise →
`blueprint`; numeric → `led`. When the person names a mood, a brand colour or a reference, that wins; use
`colors: { accent: "#…" }` for a brand colour and keep the roles.

## Palettes

Roles, not hues: a reel written for one palette reads in all of them.

| Palette | bg | ink | accent | life | calm | alert | info |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ember` | #0d0c0e | #efe5d6 | #f2b84b | #3fe0ad | #a07cf0 | #ff5f5a | #76a0ff |
| `aurora` | #070a13 | #e2f4ff | #86f7cf | #59e3ff | #b592ff | #ff6fa8 | #8fb2ff |
| `ocean` | #04101a | #d8f2ff | #ffd27a | #41e6cf | #7fa6ff | #ff7a6b | #62c6ff |
| `forest` | #0a0f0b | #ebf1e0 | #ecc35c | #8be37b | #8fc9a9 | #f07a4f | #9fd5e0 |
| `rose` | #120a0f | #ffe7ef | #ffb38a | #ff8fbd | #c9a3ff | #ff4f6d | #ffc9dc |
| `mono` | #0a0a0a | #f2f2f2 | #ffffff | #d9d9d9 | #b8b8b8 | #ff4d3d | #a6a6a6 |
| `phosphor` | #020c04 | #9dffaa | #e8ffb0 | #55ff86 | #79ffd2 | #ffd25a | #8dffc4 |
| `amber` | #0e0702 | #ffd69c | #ffae00 | #ffe08a | #ffc46b | #ff5f2e | #ffcf87 |
| `paper` (light) | #efe8da | #1f1c1a | #ff5a36 | #00897b | #3d5afe | #e0245e | #2f6fb3 |
| `blueprint` | #0f3b74 | #eef6ff | #ffe38c | #a2f2ff | #c8dcff | #ffa08c | #c0e4ff |
| `chalk` | #1c2521 | #f2f0e7 | #ffd86b | #9de7b2 | #bac7ff | #ff9c8f | #a9e1ff |
| `gameboy` | #0f380f | #9bbc0f | #c4e05a | #9bbc0f | #8bac0f | #c4e05a | #8bac0f |

Each also has `dim`, `caption`, `captionDim` and `ghost` (the misregistered ghost or chroma fringe).

## Sound beds

`warm` (major sevenths, slow), `night` (minor, darker, longer chords), `bright` (open major), `tense` (minor with
a soft pulse), `none`. The bed ducks under a voice-over. Cues are on by default (`sound: { sfx: false }` to mute).

## Adding a look or a palette

- **Palette:** add an entry to `PALETTES` in `assets/engine/theme.js` with every role (`light: true` for paper grounds).
- **Look:** add a GLSL `look()` to `LOOKS` in `assets/engine/look.js` (it gets the art and caption layers, a tight glow,
  a wide haze, the palette's bg, ghost and four main colours) and an entry in `LOOKS` in `assets/engine/theme.js`
  (palette, caption font and size, HUD font, stroke, line weight). Keep it to one full-size pass: export renders
  on a software GPU.
