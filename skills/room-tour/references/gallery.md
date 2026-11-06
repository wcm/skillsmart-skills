# Exact artworks on the walls

A gallery's works must be exact: the real image, at true scale, never repainted by a model. So the rooms are generated
with **blank canvases**, flat chroma green inside thin real frames, and the page lays each artwork onto its canvas in
every frame of every move, keeping the canvas's own light. The same rooms can then hang a new show without new videos.
Shedlight (`assets/examples/shedlight/`) is the worked example.

Needs OpenCV for Python: `python3 -m pip install opencv-python-headless numpy`.

## 1. The rooms

- Every canvas is a flat, evenly lit chroma green (`#00B140`), matte, inside a thin black frame, square-on to its wall.
  Say it in the master's prompt and repeat it in every edit ("every canvas stays a flat chroma green in its thin black
  frame"). Give each canvas the proportion of the work that will hang there.
- Keep things out of the way of canvases where you can: a bench or a sculpture in front of a canvas is fine (the canvas
  mask keeps it in front), but a canvas wholly behind a jamb for most of a move gives the tracker little to hold.
- Polished concrete reflects the green: `frames.mjs --key` removes the spill everywhere.

## 2. The works

Make each work as a flat, frontal picture of the painting itself, filling the frame, at the canvas's proportion
(`"aspect"` in the walk file; wall labels give height × width): "photographed for the catalogue: perfectly flat and
straight on, the painted surface fills the whole image, no frame, no wall, no shadow". For a real gallery, use the real
photographs of the works instead. A sculpture or object is cut out of the room picture with
`node mask.mjs <id> cut … "<noun>" <name>` and lifts from that cut-out.

## 3. Track the canvases

```bash
python3 panels.py out/<id>/move-1.mp4 --proof ../site/<id>/img/art/w01.webp --min-area 0.0003
```

`panels.py` finds every canvas and follows its four corners through the clip (from its outline when whole; from the
wall's motion when it leaves the frame or slips behind a jamb), and writes `move-1.panels.json` beside the clip, with the
quads, a `full` flag and the canvas's median light per frame. `--proof` writes a video with art laid on every canvas:
**watch it frame by frame** for a canvas squeezed by a jamb, a corner drifting, or green showing at an edge.
`--min-area 0.0003` also finds small canvases in the next room. The console prints each canvas's id and centre in its
first frame: use them to say which work hangs where.

Copy the panels file next to the frames: `cp out/<id>/move-1.panels.json ../site/<id>/frames/move-1/panels.json`.

## 4. Key the frames

```bash
node frames.mjs <id> --key --rec
```

Each canvas becomes a neutral grey at its own brightness (the light map the page multiplies the artwork by), green
spill is removed everywhere, and every frame set gets `mask/NNNN.webp`: white where a canvas shows, so a jamb, a bench
or a visitor's path in front of a canvas stays in front of the art.

## 5. The page

In `tour.json`:

```jsonc
"artworks": {
  "w01": { "n": "01", "kind": "painting", "title": "06:40", "year": "2025", "medium": "Oil on linen", "size": ["180", "265"],
           "price": "€24,000", "src": "img/art/w01.webp", "thumb": "img/art/w01-thumb.webp", "wall": "Room 01, north wall",
           "tint": "#D1CFFF", "tintInk": "#9795E4", "at": { "move": "move-1", "t": 0.3 } },
  "w07": { "n": "07", "kind": "object", "title": "03:10", "cutout": "img/art/w07-cut.webp", "box": [0.7255, 0.5574, 0.0792, 0.2556], "stop": "hall" }
},
"moves": {
  "move-1": { "from": "entrance", "to": "side", "clips": ["frames/move-1"], "screens": 2.1,
              "panels": { "src": "frames/move-1/panels.json", "map": { "0": "w02", "1": "w01", "2": "w03" } } }
}
```

`panels.map` says which work hangs on which canvas id. Artworks are about 2000 px on the long side (WebP quality 85,
under 400 KB) so a lift stays sharp. A click lifts the work to fill the screen with its title, year, medium, size and
price; closing puts it back. Wall labels draw beside the works on fine leaders and stop above the map in their column.
`references/engine.md` ("Art layer") has every field.
