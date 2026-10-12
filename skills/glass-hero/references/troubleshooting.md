# Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| Flickering black blocks | a NaN in a shader, smeared by bloom | guard every colour you compute: `if (any(isnan(c))) c = vec3(0.0);`; clamp divisions and `pow`/`sqrt` inputs |
| Pale, milky glass with little colour | no thin bright light against darkness behind it | add hot, thin strips to the studio (`STRIP`), darken the room; on a pale page, dense dark lines behind the glass |
| Banding in the rainbow | too few wavelengths | raise `samples` (8 → 12–14) for that piece; it costs speed |
| The object is cut off or under the copy | it isn't aimed at the slot, or the radius is too big | `aim(camera, w, h, stage.slot, radius)` in `resize`; lower `radius` |
| Low frame rate on a laptop | heavy shading at a high pixel ratio | `maxDpr: 1.25`; fewer `samples`; smaller `bgScale`/`backScale` on `GlassStage`; the stage also lowers resolution on its own |
| Nothing moves in a hidden preview | `requestAnimationFrame` pauses in background tabs | `__glass.advance(2)` in the console draws two seconds |
| Dragging over a button rotates the glass | the element isn't recognised as UI | make it an `a` or `button`, or add `data-ui` |
| The headline wraps badly or runs into the glass | the line is too long for the copy column | shorten it to two short lines; lower the page's `h1` size |
| Blank page, CORS errors | opened as a file | serve it: `python3 -m http.server -d site` |
| A tap blooms when it shouldn't | the trackball treats any press that doesn't move as a tap | check `ball.up()`'s return before acting on it |
