# Looks

| Look | What happens | Feels | Background | Good for |
| --- | --- | --- | --- | --- |
| `line` | the outline draws itself from the mark's own edges (traced, so it works for any file), a pen point leading; then it fills | precise, crafted, calm | the brand's light paper | studios, architecture, tools, editorial |
| `particles` | a few thousand specks swirl in from the edges and settle into the shape, left to right; some in the accent | technical, cosmic, energetic | dark with a soft glow | AI, data, infra, launches |
| `liquid` | a glossy bead of the accent colour gathers in the middle, the mark swells out of it, the liquid drains to the real logo | premium, fluid, playful | dark with a soft glow | consumer apps, fashion, beauty, drinks |
| `ink` | ink blooms from the centre into grained paper, bleeding past the edges with darker rims, then dries crisp | human, artisanal, editorial | warm paper | publishing, food, craft, culture |
| `glass` | a glass lens sweeps across; the mark is a soft ghost ahead of it, sharp behind it, refracted with colour fringes inside it | clean, optical, modern | dark | hardware, optics, fintech, design tools |
| `chrome` | a diagonal light wipe raises the mark as polished chrome reflecting a studio, then a highlight sweeps it; ends in chrome | bold, retro-future, loud | near-black | music, events, automotive, games |

## Fields

- `look`: one of the six.
- `logo`: path to SVG or PNG (transparent). Or `wordmark: { text, font, weight, letterSpacing, color }`.
- `colors: { bg, ink, accent }`: `ink` colours a wordmark and the line look's strokes; `accent` colours the
  liquid, particles and glass fringes. Multi-colour logos keep their own colours at the end.
- `tagline`: small caps under the mark, appears after it settles. Optional.
- `duration`: 5–8 s. The reveal takes about 60 %, then the mark holds.
- `scale`: 1 by default; 0.8 for very wide marks, 1.2 for compact ones.
- `seed`: change it to get a different particle or ink pattern.

## Timing

`reveal` (0.25 s → about 3.7 s at 6 s), `settle` (the real file fades in over the shader), `hold` (still, with a
slow 3 % push-in so it never feels frozen). For an outro, use `duration: 8` and put it at the end of the film.
