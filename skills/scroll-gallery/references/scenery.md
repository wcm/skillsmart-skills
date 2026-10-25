# Scenery

What a scene stands in: something behind the pictures, sometimes something between or in front of them. It gives the
page depth (shapes in front, a world behind, the pictures big in between) and each scene its own place. Keep it
quieter than the pictures: soft, dim, or far away. A scene with none just shows its `bg` gradient.

## In page.json

A scene's `scene` holds any of these:

| Key | What | Options |
|---|---|---|
| `back: { img }` | a soft photo (`scene/<img>.webp`) far behind the pictures | `dist` (how far, 40), `dim` (0–1, darker) |
| `back: { img, surface: true }` | the photo lying on the layout's own surface: the table under the prints, the ground under the book, the wall behind the board | `tile: true` repeats it instead of cropping it |
| `back: { shader }` | a pattern instead of a photo | `"paper"`, `"linen"`, `"dots"`, `"halftone"`, `"stars"`, `"glow"`, `"beams"`, `"tunnel"`; colours `a`, `b`, `c` (default: the scene's `bg` and the page's accent) |
| `back: { glow: true }` | the picture in front, blurred into a wash of its own light behind everything | `a` (how strong, 0.4–0.55) |
| `mid: [{ img }]` | line drawings between the background and the pictures (a turntable taken apart, a synth), white lines tinted the scene's `ink`; each draws itself in from the middle as the scene arrives | `x`, `y` (−1…1), `w` (of the view's width) or `h` (of its height), `dist`, `tint`, `a` (opacity), `drift` [x, y] with the scroll |
| `front: [{ img }]` | shapes in front of the pictures: fog, clouds, a skyline | `x`, `y`, `w`, `dist` (3–4: close), `a`, `drift`, `sway` [x, y, speed] (a slow sway with time), `tint` |
| `dust: { color, size }` | motes floating in the light, in front | `color`, `size` (0.5 fine) |
| `rain: { color }` | thin rain streaks in front | `color` (a pale blue by default) |

Everything stands where the scene's camera looks from halfway through it, so the camera's own moves give parallax.
The examples: Ardent's table lies on a cutting-mat photo, its runway stands in a dark venue with fog rolling over the
floor in front, its book on cobalt tissue paper; Side B's four scenes have line drawings of a speaker, a synth, a tape
deck and a turntable on paper; Far Field glows with its own pictures' light, with dust, and ends among stars; Kit of
Parts pins its board on linen and floats the cube in a soft glow. The walnut of the crate, the turntable and the
jukebox is a scenery file too (`scene/walnut.webp`).

## Making new pieces

Each page's pieces are in `tools/scenery.json` → `pages` → `<id>` → `<name>`: `{ kind, aspect, blur, prompt }`.

| Kind | What the model draws | What the page gets |
|---|---|---|
| `back` | a soft photo of a place | the photo, blurred a little (`blur`) so the pictures stay the sharpest thing |
| `surface` | a sharp photo of a material, seen straight down: a cutting mat, tissue paper, walnut, linen | the photo, nearly sharp |
| `cutout` | an object on plain white (a leaf, a chair) | the object cut out (2 credits more), blurred as if out of focus |
| `luma` | a bright shape on black: fog, clouds, light | its brightness becomes its opacity, so soft edges stay soft |
| `ink` | a black shape on white: a skyline, branches | its darkness becomes its opacity |
| `lines` | a white line drawing on black: a technical drawing | clean white lines, tinted on the page |

Write the prompt like a picture's: the subject, the framing ("seen straight down from above", "isolated on a plain
pure black background, thickest along the bottom of the frame"), the light. The shared lines at the top of
`scenery.json` (`style` for `back`, `surfaceStyle`, `linesStyle`) are added to every prompt of that kind: leave them.

```bash
node tools/scene.mjs <id> --cost             # credits for every piece the page doesn't have yet (20, a cut-out 22)
node tools/scene.mjs <id>                    # make them, then the web files → site/<id>/scene/ and scene.json
node tools/scene.mjs <id> --only fog --fix "thinner, only along the bottom"
node tools/scene.mjs <id> --build            # only remake the web files (free), after changing a blur
```

Look at `tools/out/scene/<id>/sheet.jpg` (on grey, so cut-outs and lines show), then use the piece in a scene by its
name.
