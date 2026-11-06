# Troubleshooting

| Problem | Fix |
|---|---|
| A step stops with NOT ENOUGH CREDITS | give the user the link from the message; when they've topped up, run the same step again (everything made is kept) |
| `sharp` or `ffmpeg` missing | `cd tools && npm install`; `brew install ffmpeg` / `winget install ffmpeg` / `apt install ffmpeg` |
| An edit barely moved the camera | describe the new position more bluntly and further away ("now outside, five metres back, looking straight in through the door"); edit from a closer neighbour; try two takes |
| Two stops look alike | one of them is wasted: move its camera somewhere truly different, or drop it |
| A move invents a sofa, a wall corner or a doorway at an edge | the place's unseen side: keep the take where it behaves like real furniture; turn earlier; add a stop that shows that side (`references/walks.md` §3) |
| Doors or screens close during a move | a later picture shows them closed: edit it so they're open, then make the move again |
| Clouds race across the sky | the pictures have different skies: give them one (cloudless) sky with a sky-only edit or a `paste` |
| A wall pushes out at the end of a turn | the end picture stands too close to it: move that camera further away and remake the move |
| A room corner pops up beside the furniture as the camera turns | it's in the end picture's edge: `crop` the picture past it (never repaint a wall: lines bend) |
| The scroll stalls at the start or end of a move | keep the take again with `moves.mjs --keep` (it trims the still frames the model adds) |
| The page shows old frames after a move was re-made | the browser cached them: serve with `python3 tools/serve.py` (caching off), or reload with the cache cleared |
| The title's letters look nibbled at the bottom | the occluder only grazes them: raise the title clear of the object, or lower it so the object covers the lower quarter properly; check on the screenshot |
| `mask.mjs` came back empty | use a shorter or different noun ("plant" instead of "tropical planting") |
| A hotspot is off its object | measure again on `out/<id>/stops.jpg` (the stop shows the move's own frame, not the picture); on phones, adjust the stop's `focus` |
| A label runs off a phone screen | shorter label text; the plate flips side only left/right |
| The page is over 20 MB | `node frames.mjs <id> --q 56`; fewer frames with `--step 3` for a slow move; phone frames at 960 px |
| `check.mjs` reports text under 14 px | raise it in `style.css` (labels, captions, map labels) |
| The recording isn't about 25 s | `moves.*.rec` (seconds per move), `record.hold`, `record.end`, beats' `hold` in `tour.json` |
| No WebGL2 in a headless check on Linux | `browser.mjs` uses SwiftShader there; update Chrome, or check by hand |
| `track.py` loses its point | seed it on stable texture (a stone joint, a corner), not on water, glass or a plain wall; seed at the end with `@last` |
| A gallery canvas shows green at an edge, or a work slides | re-run `panels.py --proof` and watch it frame by frame; `--min-area 0.0003` for small canvases (`references/gallery.md`) |
