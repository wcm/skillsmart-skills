# Making the zoom tree

Everything runs from the project's `tools/`. Pictures land in `out/<id>/` (git-ignored); a page's tree is `trees/<id>.json`.

## The tree file

```json
{
  "brand": "Pruine, a natural-wine estate",
  "titleBand": "top 30% (the sky): no spots above y = 0.32",
  "style": "Autumn in a small vineyard, golden hour: low sun from the left, warm amber highlights, soft violet shadows.",
  "nodes": {
    "estate": { "span": 900, "prompt": "…" },
    "vine":   { "parent": "estate", "rect": [0.885, 0.42, 0.18], "span": 2.4, "prompt": "…" },
    "bloom":  { "parent": "vine", "rect": [0.46, 0.42, 0.1], "span": 0.004, "medium": "micro", "prompt": "…" }
  }
}
```

- `style` ends every prompt: the one place, light and colour of the whole tree. `medium` (on the tree or a level) adds a sentence: `photo` (default), `riso`, `micro` (through a microscope), `render` (a 3D render), `none`. A dive can change medium on the way down.
- `rect` is the area of the parent a zoom dives into: `[centre x, centre y, size]`, shares of the parent. `size` is the same share of the width and of the height, so the area keeps the 16:9 shape. Keep it fully inside: `cx ± size/2` and `cy ± size/2` within 0..1.
- `span` is the real width in metres the level shows across the frame; the page shows it live while diving ("Field 2.40 m").
- `prompt` says what the level shows. For a close-up it follows the shared zoom prompt ("re-create this exact area as a sharp close-up, keep the framing… add only the fine detail…").
- `focus` (optional) `[x, y]`: where to centre the view on a phone when the subject is far off-centre.
- `image` (optional) a path, from `tools/`, to the user's own picture for this level, used instead of generating.
- The order of children matters: the first is the main way down (the tour, the scroll wheel, the ↓ key).

## Tools

```bash
node pictures.mjs <id> <level> --takes 2             # takes: out/<id>/<level>-take1.png, -take2.png
node pictures.mjs <id> <level> --takes 2 --from 3    # takes 3 and 4 beside them
node pictures.mjs <id> <level> --takes 2 --fix "…"   # add a note to the prompt for this run
node takes.mjs <id> <level>                          # sheet: the crop, then the takes with rho → takes-<level>.jpg
node pictures.mjs <id> <level> --keep 2              # keep take 2 as <level>.png and measure where it sits
node look.mjs <id> <level>                           # a 0.05 grid, children's areas, interface zones in red → look-<level>.jpg
node look.mjs <id> <level> --try "0.6,0.5,0.12"      # also draw a candidate area (dashed)
node align.mjs <id> <level>                          # measure again
node sheet.mjs <id>                                  # the whole tree → tree.jpg
node publish.mjs <id>                                # web pictures and levels.json → ../site/<id>/img/
```

Add `--4k` to `pictures.mjs` (40 credits a picture) only for a first level that must stay sharp on a very large screen.

**rho** is how well a close-up lines up with its crop: 1 is perfect. Faithful steps should reach about 0.8. Steps that reveal something new or change medium can be lower, but under 0.5 the measure gives up, the planned rect is used, and the hand-over can show a jump. Between two good-looking takes, keep the higher rho.

## Steps

1. **The first level.** Three takes. It decides everything below it, so be demanding: one clear, beautiful scene; the title band calm and empty (say so in the prompt, and give its share: "the upper 35% is calm pale mist"); every subject the tree dives into present, prominent and placed by name in the prompt, outside the interface zones. Redo it with a better prompt rather than settle.
2. **Choose areas.** `look.mjs`. Each child's area should have a clear subject near its centre, and its centre must sit outside the red zones.
3. **Make the close-up.** Two takes; look at the crop and the takes side by side; keep the best by quality *and* rho.
4. **Go down** the same way, parents before children.
5. **Check and publish.** `sheet.mjs`, fix what's weak, then `publish.mjs`.

## Where spots may go

The page's interface sits on top of every level, so the centre of each child's rect must stay out of:

- the navigation: y < 0.1;
- the first level's title band;
- the words, bottom left: x < 0.36 and y > 0.64;
- the readouts, bottom right: x > 0.72 and y > 0.84;
- the scale along the bottom: y > 0.9.

Prefer centres within x 0.08–0.92 and y 0.18–0.82, spots at least 0.15 apart. If a level ends the main way and the page shows a card there (x > 0.7, y 0.45–0.8), keep the subject left of it. A step of size 0.08–0.2 (×5 to ×12) reads best: the subject should fill a good part of its area. A level's children can't be far smaller than about 0.06: the crop holds too little to go on.

## When a take misses

- **It re-framed or moved things** (rho is low and the leaf is somewhere else): discard it and take again. This is the commonest miss, and a second take usually holds.
- **It only sharpened the blur, with nothing new:** say exactly what to add and where: "sitting on the leaf at the centre: a glass frog, translucent lime green, its small red heart showing through its clear belly". Reveal steps work: the subject need not be visible in the crop, as long as there is a surface for it to sit on.
- **The colour shifted** (a cold half, a turned sea): `--fix "keep the colours and the tones of the blurry picture exactly"`. A small shift is fine: the engine eases the tone through the hand-over.
- **Illustration lines came out thick** (blown up, not redrawn): widen the area (0.1 → 0.14), and `--fix "fine, thin line work, drawn at this scale, not enlarged"`.
- **It added an edge or a frame:** `--fix "edge to edge, no border"`.
- **A deep level changes medium** and rho falls to 0.4: fine if the area's rough shapes and colours still carry over; the soft hand-over hides it.

## What good looks like

- **Clean.** One clear subject per level, a quiet ground, the same light and colour across the tree.
- **Real material and light.** Texture, gloss, thickness, translucency, droplets, grain: what you'd only see up close.
- **Prominent subjects.** The thing a level is about is big, sharp and bright enough to read at thumbnail size.
- **No tells.** No melted or doubled shapes, extra toes or fingers (count them), smeared texture, repeated tiles, garbled letters, watermarks or borders. No text at all unless the story asks for it (leave labels blank and print on them in HTML, as Surface Theory does).
- **True to the story.** Each level shows exactly what the page's words say it shows.
