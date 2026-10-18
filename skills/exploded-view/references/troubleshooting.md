# Troubleshooting

What went wrong while the method was worked out, and the fix.

## The pictures

| Symptom | Fix |
|---|---|
| The second photo has the same angle as the first | name the new camera position and what it shows, or change the pose (references/prompts.md → place2); redo with `--only place2` and then `--stills` |
| The product changes between pictures (a grille appears, the handle moves) | describe the material again in that prompt ("the outer caps are solid oiled walnut all over, with no grille and no mesh"); the shared `same` line is already there |
| The exploded view kept the place behind it | it is made from the studio frame, so this means `studio1.png` is wrong: check `cut1` first |
| Parts of the exploded view are invented, merged or have text on them | list every part in order in `exploded`; say "nothing else"; `--fix "…"` naming the stray thing |
| A first photo you don't like | `--takes 3 --only place1` (60 credits), then `--pick <n> --stills` |
| Readable text on a sign | it reads as abstract only when blurred: say "neon tubes bent into abstract shapes, no words"; a headline over it hides the rest |

## The cut-outs

See `references/cut-outs.md`. In short: a stand, stove, tray or reflection in a cut-out → another word in `find`, then
`detach1`/`detach2`, then `erase1`/`erase2`; SAM 3 finds nothing → a plainer word; specks → they're dropped
automatically (only the biggest blob stays).

## The clips

| Symptom | Fix |
|---|---|
| Parts melt or new parts appear mid-clip | two takes and pick (`--takes 2 --only clips`, then `--pick a<n>,b<n> --motion`); simplify `explode`/`rebuild` to one motion |
| A small object floats in from nowhere (a block over a headband) | another take; if it keeps coming, the studio frame has a speck in it: check the cut-out |
| The camera moves or zooms | the shared `clip` and `negative` lines prevent it; check they weren't edited |
| The backdrop flickers, so the frames' edges glow | the matte cleans most of it; keep `--lab-bg` equal to the backdrop so what's left disappears |

## The page

| Symptom | Fix |
|---|---|
| The page says its pictures aren't built yet | run `node build.mjs <id> --motion` (it writes `layout.json`, `img/`, `frames/`) |
| A pop where the photo hands over to the cut-out | `check.mjs` measures it (`lift` and `landing`); rebuild `cuts` and then `web` (`--only cut1,cut2,web` won't remake clips) |
| A label sits off its part | move its `at` (`node anchors.mjs <id> --grid`) |
| Labels crowd or run off the bottom | fewer parts (five to eight), shorter specs, or a smaller `stage.area` height |
| The words are hard to read on a photo | a stronger `--scrim1`/`--scrim3`, or swap light and dark ink for that scene |
| The page lags or looks frozen in a preview | background panes and hidden tabs throttle animation frames; open it in a visible window, or use `explode.seek(p)` |
| A blank flash on a fast scroll early on | the frames are still loading (every fourth frame comes first); `check.mjs` waits for all of them |

## The tools

| Symptom | Fix |
|---|---|
| `build.mjs` refuses to start | it names the slots still starting with `WRITE:` in `subjects.json` |
| sharp hands back three channels where one was expected | `one8()` in `build.mjs` checks for it: after an operation on a raw buffer, add `.extractChannel(0)` |
| A cut-out has no transparency | `removeAlpha()` runs last in a sharp chain whatever order it's written in, so it strips an alpha joined in the same chain: don't combine them |
| `check.mjs` can't start a browser | install Google Chrome, or `npx playwright install chromium`; or check by hand (SKILL.md, step 6) |
