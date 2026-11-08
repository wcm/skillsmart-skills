# Subjects

How to write `tools/subjects/<id>.json`, the prompts that worked for each kind, and how to read what comes back.
The four example sites' own files are in `tools/subjects/_<name>.json`.

## What turns well

- **Good:** a single thing with a clear silhouette that is worth seeing from every side. Sculpture, a vase, a lamp, a bottle, a chair, a shoe, a bag, a dish, a cake, a person in a pose.
- **Hard:**
  - thin loose parts (fringes, wires, loose hair), which flicker;
  - clear glass and mirror chrome, which the cut-out loses;
  - text and logos, which warp as they turn;
  - flat things (a poster turns to a line);
  - several loose items, which drift apart.
- **One kind per page,** all photographed the same way: same framing, same light, same backdrop. The page then reads as one set.

## The file

```json
{
  "aspect": "3:4",
  "shot": "Studio product photograph of {subject}. …",
  "turn": "Turntable shot. The object slowly rotates in place …",
  "turns": { "back": "… the same, plus what its back looks like" },
  "cut": "heavy",
  "stage": { "w": 900, "h": 1200, "axis": 450, "ground": 1110, "fit": "height", "size": 900, "groundFrom": "front" },
  "count": 72,
  "quality": 76,
  "props": { "pedestal": { "prompt": "…", "keep": "pedestal", "aspect": "9:16" } },
  "subjects": [
    { "id": "teapot", "prompt": "a hand-thrown stoneware teapot …" },
    { "id": "lamp", "photo": "photos/lamp.jpg" },
    { "id": "lamp-2", "photo": "photos/lamp-2.jpg", "restage": true, "prompt": "brass table lamp" },
    { "id": "look-2", "from": "look-1", "prompt": "Change her outfit … Keep the exact same young woman …" },
    { "id": "vase", "prompt": "…", "turn": "back", "scale": 0.92 }
  ]
}
```

Each subject is one of these:
- **Made:** a `prompt` (what it is: shape, material, colours, details), set into `shot` at `{subject}`.
- **The user's photo:** a `photo` (relative to `tools/`). It needs a front view of the whole subject on a plain background with nothing touching it. Add `"restage": true` (20 credits) to put it on the page's backdrop and framing first, the subject itself unchanged.
- **An edit:** `from` another subject (listed earlier), with a `prompt` that says what changes and what must stay. This is how one model keeps her face across looks.

Per subject on the page: `scale` nudges its size against the others, `air` lifts a jump off the ground (a fraction of the stage's height), `reverse` plays its film the other way, `turn` picks a prompt from `turns`, `cut` overrides the cut-out model.

## The four kinds

### A standing object: sculpture, a vase, a lamp, a bottle (In the Round)

- `aspect`: `9:16` for tall things, `3:4` for most products.
- `cut`: `heavy`.
- `stage`: `{ "w": 900, "h": 1200, "axis": 450, "ground": 1110, "fit": "height", "size": 940, "groundFrom": "front" }`. Add `"sink": 0.012` when it stands on a plinth, so it sits into the top face instead of hovering on its rim. For wide things (a teapot with its spout and handle, a chair), widen it: `{ "w": 1200, "h": 1000, "axis": 600, "ground": 930, "fit": "height", "size": 760, "groundFrom": "front" }`.
- **Make the turn show:** a plain round vase or bottle looks the same from every side, so nobody sees it turn (and `subjects.mjs` warns that it looks almost the same halfway round). Pick or describe something with a handle, a spout, a pattern, a label-free detail on one side, or an uneven shape.
- `shot`:
  > Museum-quality studio photograph of a contemporary sculpture: {subject}. It stands upright on its own, centred in the frame, seen straight on at eye level, the whole sculpture occupying about 62% of the frame height, with generous empty space above and below and on both sides. Plain seamless light warm-grey studio backdrop and floor, soft diffuse skylight from above, a faint soft contact shadow under the base. Photorealistic, sharp detail of the surface. No plinth, no pedestal, no text, no other objects.
- `turn`:
  > Turntable shot. The sculpture slowly rotates in place, as if on a hidden turntable, through one full 360-degree turn at a steady, even speed, always turning the same way, and ends exactly as it started. The camera is locked off: no camera movement, no zoom, no pan. The backdrop, floor and light stay exactly the same. The sculpture keeps its exact shape, size, surface and base throughout.
- **Its back:** the film invents the back. A draped torso first came back with a bare back. Its own turn prompt then said what the back looks like ("Seen from behind, the finely pleated drapery covers the whole back… no bare skin anywhere"), and the next film was right.

### A dish (Lacquer)

- `aspect`: `16:9`.
- `cut`: `matting`.
- `stage`: `{ "w": 1080, "h": 810, "axis": 540, "ground": 621, "fit": "width", "size": 900 }`.
- `shot`. Seen from 35° above, so the food reads:
  > Fine-dining food photograph of {subject}. The dish is centred and seen from a three-quarter angle about 35 degrees above, filling about 55% of the frame width, with clear empty space all around it. Plain seamless deep charcoal backdrop, one warm spotlight from the upper left, soft falloff. Photorealistic, appetising, glossy, crisp detail. No table, no cutlery, no chopsticks, no props, no text.
- `turn`:
  > Turntable shot. The dish slowly rotates in place, as if on a hidden turntable, through one full 360-degree turn at a steady, even speed, always turning the same way, and ends exactly as it started. The camera is locked off: no camera movement, no zoom, no pan. The food keeps its exact arrangement and the plate its exact shape throughout. The backdrop and light stay the same.
- `plate`: `"plate"` (or `"bowl"`, `"platter"`, on a subject). The cut-out keeps the food but treats a white plate as background: on charcoal it kept some plates and lost others, on mid-grey it lost them all, whichever cut-out model. With `plate` set, `subjects.mjs` asks SAM 3 for the plate in every frame of the turn and puts it back as a solid shape (8 credits).
- **Plates:** name the plate in each subject's prompt ("on a round white porcelain plate with a thin gold rim"). Light plates and bowls work best: the plate is found against black, so a black plate is hard to find. Steam is fine; it is cut away.

### A floating product: a shoe, a bag, headphones (Torque)

- `aspect`: `16:9`.
- `cut`: `heavy`.
- `stage`: `{ "w": 1200, "h": 800, "axis": 600, "centre": 380, "float": true, "fit": "width", "size": 1040 }`. With `float` the product is centred on the stage instead of standing on a ground line.
- `shot`:
  > Studio product photograph of one {subject}. Seen exactly side-on from its outer side, toe pointing to the left, floating in mid-air in the centre of the frame, level. The shoe spans about 55% of the frame width, with clear empty space all around it. Plain seamless light grey backdrop, soft even studio light, no shadow on the ground. Photorealistic, crisp material detail. No logos, no brand marks, no text.
- `turn`:
  > Turntable shot. The floating shoe slowly rotates in mid-air around its vertical axis through one full 360-degree turn at a steady, even speed, always turning the same way, and ends exactly as it started, side-on with the toe pointing left. The camera is locked off: no camera movement, no zoom, no pan. The shoe keeps its exact shape, colours and details throughout. The plain backdrop and light stay the same.

### A person: one model in several looks (SIP CLUB)

- `aspect`: `9:16`.
- `cut`: `matting`.
- `stage`: `{ "w": 760, "h": 1340, "axis": 380, "ground": 1295, "fit": "frame", "size": 1358 }`. `frame` gives everyone one scale, so a raised arm or a jump doesn't shrink anyone.
- **The first look** is written in full, with `"shot": "{subject}"`. Say:
  - who she is and how she looks: age, face, hair;
  - the outfit, piece by piece, and what she holds;
  - the pose, with energy (a wave, a kick, a peace sign, a jump);
  - the framing: the whole figure head to toe, about 64% of the frame height, centred, generous space round her;
  - the backdrop and light: plain seamless white-grey, bright even flash, a soft shadow on the floor;
  - "no text, no logos, no other people".
- **The other looks** are edits of the first (`"from": "<first id>"`). Each prompt starts with what changes and repeats what stays: "Change her outfit, hair styling and pose for a new look in the same lookbook. Keep the exact same young woman: the same face, features, skin tone and build. She now wears … Keep the same plain seamless white-grey studio backdrop, the same bright even studio flash and the same full-length framing…".
- **The outfits:** light and current. Give each look its own style and silhouette (a gingham mini dress, a sporty crop set, a tennis skirt, wide cargo trousers, a slip dress). Five similar outfits read as one look five times, and heavy layers hide the turn.
- `turns`:
  - `hold`: "The model holds this exact pose perfectly still, frozen like a statue, while the hidden turntable she stands on slowly rotates a full 360 degrees at a steady, even speed, always turning the same way, and ends exactly as it started. She does not move her arms, hands, legs, head or face at all… The camera is locked off… Her face, hair and outfit stay exactly the same throughout."
  - `jump`: "Bullet-time frozen moment: time is completely stopped and the model hangs perfectly still in mid-air exactly as in the photo, her hair and clothes frozen. The view orbits a full 360 degrees around her at a steady, even speed, always the same way, and ends exactly where it started. She does not fall, land or move at all…". On the page, give a jump `"air": 0.16`, so she floats above the others' ground.

## Reading what comes back

`subjects.mjs` writes, for each subject in `tools/out/<id>/`:

- **`<name>.png`, the photo.** Check that the subject is whole, centred, front-on and alone on the backdrop. Redo with `--redo photo --fix "…"`.
- **`<name>-sheet.jpg`, eight moments of the film.** The first and last moments match, the middle ones show the sides and the back, and the subject keeps its shape. Redo with `--redo turn --fix "…"` when:
  - it rocks back and forth instead of turning (the tool warns when the middle barely differs from the start);
  - the camera moves;
  - the subject changes shape or size;
  - the back is wrong. Say in the fix what the back looks like.
- **`<name>-cut.jpg`, eight cut-out frames on blue and red.** Look for:
  - a halo: the backdrop was too close to the subject's colour. Redo the photo on a backdrop that contrasts;
  - missing parts: a plate's rim, a thin handle. For plates, set `plate` (or run `plate.mjs` with another word).

## Making frames

`node frames.mjs <id>` reads the cut-outs and writes `site/<id>/frames/<name>/001.webp …` with a `manifest.json`: 72 frames a turn, about 3 MB a subject. The stage, in its own pixels:

| Field | What it does |
|---|---|
| `w`, `h` | the stage canvas. The page scales it to `--stage-h` tall |
| `axis` | where the turning axis stands (x) |
| `ground` | where subjects rest (y). The page gets it as `--ground` (a fraction of the height), for plinths and shadows |
| `float`, `centre` | for things that hover: centred on `centre` (y) instead |
| `fit` | `height`: the tallest a subject gets over its turn becomes `size` px (standing things). `width`: the widest (dishes, shoes). `frame`: one scale for all, `size` px per film height (people) |
| `groundFrom` | `"front"`: rest by the lowest point of the front view, not of the whole turn |
| `sink` | push subjects this fraction of the stage into the surface (a plinth's top face) |

`frames.mjs` prints each subject's scale and warns when one is cut off by the stage's edge (lower `size` or that subject's `scale`, or widen the stage).

**Which way they turn.** The films don't all turn the same way. `subjects.mjs` measures each one (`turn.json`), and `frames.mjs` reverses a subject that clearly turns against the others. A round, plain subject looks the same either way, so it is left alone. If one still turns the wrong way on the page, set `"reverse": true` (or `false`) on it.

## Costs

| Step | Credits |
|---|---|
| A photo (`nano-banana-pro`, 2K) | 20 |
| A turn (`h3-max-turbo`, 10 s at 1080p, 11 a second) | 110 |
| A cut-out (`birefnet-video`, 4 s of frames, 2 a second) | 8 |
| **A subject** | **about 138** (the user's own photo: about 118) |
| A prop (photo and `sam-3` cut-out) | 22 |
| A plate put back (`sam-3-video` on the 4 s turn) | 8 |
