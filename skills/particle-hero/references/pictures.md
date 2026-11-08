# Pictures

Each subject is one picture of one thing on a plain ground, cut out, with a depth map. `tools/pictures.mjs` makes all
three from `tools/pictures/<id>.json` and copies them into the page.

## The list

```json
{
  "background": "black",
  "aspect": "1:1",
  "style": "Soft rim light from behind outlines every hair, a gentle key light from the left.",
  "pictures": [
    { "id": "stag", "prompt": "A majestic reindeer stag with enormous branching antlers, three-quarter view facing left, head, neck and chest, a shaggy pale winter mane." },
    { "id": "owl", "prompt": "A snowy owl in flight with its wings spread wide, body facing the camera." },
    { "id": "mark", "photo": "../brand/logo.png", "cutout": false }
  ]
}
```

| Field | What |
|---|---|
| `background` | `black` for the dust and neon looks (dark parts of a subject on black make no grains; light parts make many). `white` for ink and print (light parts on white make no ink). The tool adds a sentence asking for that plain ground, a margin, and nothing cut off |
| `aspect` | the picture's shape (`1:1`, `3:2` for wide products, `4:5`, `2:3`); a picture can carry its own |
| `style` | one sentence of light and mood added to every prompt, so the subjects agree |
| `id` | the file name in `site/<id>/img/` and in `main.js` |
| `prompt` | the subject alone: what it is, its pose or angle, what it's made of |
| `photo` | your own picture instead of a prompt (a product shot, a portrait, a logo): only the cut-out is paid |
| `cutout` | `false` for a picture that's already on transparency |

## Writing subjects

- **One subject, whole, centred, with room round it.** The engine crops to the cut-out's outline, so every subject fills its place the same way.
- **The same family of shot for a set.** Same light and the same kind of angle. For a melt, also the same pose and the same direction (every shoe in exact side profile facing left).
- **Contrast inside the subject** makes the dust read.
  - On black, a white owl and a pale stag work beautifully, and a black dog is mostly gone: give dark subjects a strong rim light.
  - On white, dark products print best. Light ones print as a faint stipple, which can be lovely (a white midsole). `levels` keeps dark products from flattening.
- **Silhouettes matter.** Antlers, wings, a rearing horse, a saxophone, a high-top's collar: shapes you can read at thumbnail size, with a clear outline.
- **Portraits cut off at the waist** need `fade: 0.3` on the page, so the dust thins out instead of ending on a line.
- **No text or logos** in generated pictures. A brand mark can be a subject of its own, from a `photo`.
- **No real places or famous people.**

## Making them

```bash
node pictures.mjs <id> --dry            # what it makes and costs
node pictures.mjs <id>                  # every subject still missing
node pictures.mjs <id> owl --force      # make one again (old files kept as .bak-N)
node pictures.mjs <id> owl --fix "the whole wingspan inside the frame"
node pictures.mjs <id> --pack           # only the page copies and the sheet
```

1. **The picture**: `nano-banana-pro` at 2K, 20 credits. Skipped for a `photo`.
2. **The cut-out**: `birefnet-image` (heavy, 2K), 2 credits. Fur, feathers and hair come out well.
3. **The depth map**: Depth Anything V2 Small, run on this computer, free. It needs about a second, plus a one-time 27 MB download.
4. **The page copies**: `site/<id>/img/<name>.webp` (the cut-out, 1024 px on the long side, alpha kept) and `<name>-depth.png`.
5. **A contact sheet**: `tools/out/<id>/sheet.jpg`, each row the picture, its cut-out over grey and its depth. Look at it before going on:
   - the whole subject is inside the frame;
   - the cut-out is clean;
   - near parts are white in the depth.

A four-subject page costs about 88 credits (4 × 22). With your own photos it's 2 credits each. Tell the user the cost before running.

## Tuning a picture on the page

These are the per-picture options in `main.js`:
- `relief`: more or less depth.
- `fade`: for portraits.
- `levels`: for subjects that are all dark or all light.
- `outline`: more grains along the edge.
- `fill`: smaller in its place.
