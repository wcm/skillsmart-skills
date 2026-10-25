# Troubleshooting

What has gone wrong before, and the fix.

## The page

| Symptom | Cause | Fix |
|---|---|---|
| The title is covered on the first screen (`check.mjs` → title) | the first scene is too big or too full | a first scene that frames the title (table, board, slabs, trail), fewer `cards` in it, or a smaller hold-on picture; never cover more than a third of the letters |
| Every picture is big; nothing stands out | too many pictures, or a layout that fills the screen | fewer `cards`, a `count` with smaller places; only the one in focus big |
| A screen with no picture (`check.mjs` → cards) | a change between two scenes that share no pictures, or a scene with too few | share pictures between the two scenes; more `cards` or a `count` |
| A picture clips through another in a change | two shapes crossing (a slab into the crate) | `change: "reshape"` between scenes of one family, or a longer `len` |
| Grey numbered cards | no picture for those items yet | make them (`pictures.mjs`), bring them (`build.mjs --from`), or drop the items |
| `404 … scene/walnut.webp` | the crate, the turntable or the jukebox on a page without walnut | copy `walnut.webp` and its `scene.json` entry from `<skill>/assets/examples/side-b/scene/` |
| `404 … scene/<name>.webp` | a scene names scenery the page doesn't have | `node scene.mjs <id>` (its prompt in `tools/scenery.json`), or take the name out of the scene |
| `no layout ring / ark` in the console | a misspelt `layout` or `look` | the names in `layouts.md` |
| Nothing moves in a visible browser tab, or it lags | a hidden tab or a background pane throttles animation | bring the tab to the front; `accrochage.go(v)` jumps to a moment |
| The page doesn't load from `file://` | modules and JSON need a server | `python3 tools/serve.py` |
| Index or a picture won't click | something over it took the pointer (a custom element with `pointer-events`) | keep custom elements out of the corners, or give them `pointer-events: none` |
| The silk panels are stiff on a phone | the cloth is simulated on desktop only | as designed |

## The pictures

| Symptom | Fix |
|---|---|
| The brand or a stray word printed in the pictures | no brand name in the style line; "no signs, no text or lettering anywhere" (`pictures.md`) |
| A poster came back as a mockup on a wall | "flat artwork that fills the whole frame from edge to edge, seen perfectly straight on… No mockup" |
| A white border round a picture | `"trim": true` (a plain border) or `"crop": [l, t, r, b]` on the item, then `node build.mjs <id>` |
| The series doesn't match | the shared parts belong in `style`, only the differences in each `prompt`; redo the odd ones with `--only` |
| `pictures.mjs` says 0 to make after you rewrote a prompt | a picture the page already shows counts as made: `--only <ids>` |
| NOT ENOUGH CREDITS | give the user the link from the message; when they've topped up, run the same command again (made pictures are kept) |

## The tools

| Symptom | Fix |
|---|---|
| `check.mjs` or `video.mjs`: no Chrome found | install Google Chrome, or `npx playwright install chromium` |
| `check.mjs`: could not install playwright-core | it needs npm and the network once; or check by hand (SKILL.md, Step 6) |
| `video.mjs`: needs ffmpeg | `brew install ffmpeg` (macOS), `winget install ffmpeg` (Windows) |
| `sharp` fails to install | Node 18 or newer; then `npm install` in `tools/` again |
