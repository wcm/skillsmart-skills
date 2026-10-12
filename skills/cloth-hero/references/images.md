# Pictures

A page needs **the picture on the cloth** (`<id>-art`, `<id>-human`, `<id>-moon`, `<id>-banner`, …) and usually
**one scene picture** around it (`<id>-plate`, `<id>-city`, `<id>-garden`). The names come from the example you
started from; `tools/images.json` lists them with what each is for (`role`).

```bash
cd <project>/tools
node images.mjs <id>                         # every image of the page (20 credits each)
node images.mjs <id>-plate --fix "warmer"    # one image again, with a note for this run
node images.mjs <id>-art --use ~/photo.jpg   # the user's own picture (no credits)
```

Prompts: `{ ratio, prompt, style }` per image. `style` adds the shared `photo` line (default) or `flat` line, or
nothing (`"none"`, for artwork). `from: "<name>"` makes an image an edit of another (the same scene with something
removed). Masters and earlier versions go to `tools/out/`; the page loads `site/img/<name>.webp`.

## What works on each kind

| Kind | The picture on the cloth | The scene |
|---|---|---|
| Hanging sheet | a strong subject that reads at a glance, centred, on a plain or dark ground; it's printed edge to edge and seen through folds | a dark, atmospheric backdrop that the material reflects (neon city, studio) |
| Split panels | bold shapes with clear darks on a light ground (ink paintings, a mark, a silhouette): the darks become dye, so photos are auto-levelled to their darks | a straight-on, symmetrical doorway, bright and calm, empty; then measure its doorway into `PLATE` |
| Bead curtain | **bold, simple, high contrast**, square, centred, few colours: one bead per pixel at 64 × 70 loses detail | a dim scene beyond the opening (a night garden), quiet enough that the beads read in front of it |
| Streaming banner | long flat artwork (21:9 or wider), motifs spread along its length with space between them; it's mirrored end to end | open water or sky with light, nothing floating in it |

General: ask for **no text, no logos, no borders**; flat artwork needs "flat, front-on, filling the frame edge to
edge, no fabric texture, no folds" or the model draws a photo of cloth. Look at every picture before building on it.

## Prompts that worked (from the examples)

- **Vinyl print** (4:5): "High-fashion CGI portrait of a digital human, head and shoulders, facing the camera … hard
  magenta rim light from the left, electric cyan rim light from the right, pure black background … Fully synthetic,
  clearly not a real person."
- **Backdrop for vinyl** (16:9): "Cyberpunk megacity at night in heavy rain, from street level looking up … wet
  mirror-like plaza reflecting everything … no lettering, no signs, no text anywhere."
- **Dye picture** (1:1, flat): "A single bold Japanese sumi-e ink painting of a great crashing wave … black ink on
  white washi paper … generous empty space."
- **Doorway** (16:9): "Straight-on, perfectly symmetrical photograph of the entrance of a traditional Kyoto machiya …
  A wide open doorway sits exactly in the centre of the frame, about a third of the frame wide and two thirds of its
  height; nothing hangs in it and nothing stands in it …"
- **Bead picture** (1:1): "A full moon with a branch of plum blossoms, in the style of a Song dynasty painting on dark
  night-blue silk … Bold simple shapes, high contrast, centred composition …"
- **Banner print** (21:9, no style line): "Flat artwork for a long horizontal luxury silk scarf, shown perfectly
  straight-on and filling the entire frame edge to edge: the printed design itself, not a photo of fabric …"

The full prompts are in the example's entries in `assets/examples/images.json`.

## Credits

Each image is 20 Skillsmart credits (a 4K image 40); failed generations aren't charged. Tell the user the count
before generating ("two pictures, 40 credits"). On **NOT ENOUGH CREDITS**, pass on the link from the message and run
the same command again once they've topped up. With `FAL_KEY=…` set on the command, the user's own fal.ai key is used
and no credits are spent.
