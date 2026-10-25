# Material and light

Every picture is a card: a thin slab with a front, a back and an edge round its rounded outline, bent by its layout
(round a ring, over a ball, like a turning page) and lit by one soft studio: a soft box overhead to the left and a tall
strip to the right, reflected by every card as much as its gloss allows. Only light brighter than white blooms (the
glints on gloss, silk and acrylic), and a last pass adds a fine film grain and a vignette. Flat planes look cheap;
thickness, an edge and a little gloss make a picture an object.

## page.json → card

The page's material, which every look uses unless it sets its own:

| Key | What | Default |
|---|---|---|
| `radius` | the corners, as a fraction of the card's short side | `0.03` |
| `back` | the colour of a card's back (seen when it turns over) | `"#f4f2ee"` |
| `mat` | 0 photo paper (a fine grain, a hairline of white edge), 1 silk (a weave and a long satin highlight along the folds), 2 acrylic (a clear glossy coat and a glowing rim), 3 glazed tile (a rounded bevel and a wet glaze) | `0` |
| `thick` | the slab's thickness | `0.03` |
| `gloss` | how much it reflects the studio (0.1 satin paper, 0.3 glaze, 0.55 acrylic) | `0.1` |
| `grain` | the paper's grain | `0.5` |
| `edge`, `edgeTint` | the edge's colour, and how much the picture tints it instead (0–1: a record sleeve's edge is its own colour) | `"#f1eee7"`, `0` |
| `disc` | `true`: records slide out of their sleeves when they open | |
| `frame` | a printed border on the picture: `{ width, color, alpha }` | none |

## What the looks set themselves

| Look | Material |
|---|---|
| table, board | thick photo paper, a little gloss, a strong grain |
| surround with `cloth: true` | silk panels that hang from a rail and sway (a simulated sheet each; stiff cards on a phone) |
| slabs, stack, wheel | thick card with an edge tinted by the cover: record sleeves |
| sweep | a slab with a gloss and a soft sheen |
| ribbon | thick acrylic, two-sided, a glowing rim |
| tiles | glazed tiles, a bevel and a wet glaze |
| arc, band, sphere, trail | thin photo paper, a little gloss |

## Choosing

- **Photographs** (fashion, landscapes, portraits): photo paper (`mat: 0`), `gloss` 0.1–0.16, a little radius
  (0.03–0.04). The runway's silk for clothes.
- **Covers and packaging**: no radius, `edgeTint` 0.6–0.85 so the edge is the cover's colour, `disc: true` for records.
- **Design work, 3D, UI**: big rounded corners (`radius` 0.2), acrylic for the ribbon, glaze for tiles; on light
  backgrounds a pale `back`.
- Match the reference when the user gives one: its thickness, its edges, its gloss, its texture. Be bold: silk,
  acrylic and glaze are what make a page memorable.
- Keep pale pictures readable: highlights lie over the picture like a clear coat instead of washing it out; don't
  push `gloss` past 0.6.
