# Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| A film rocks back and forth, or stops short of a full turn | the turn prompt was too loose | redo with `--redo turn`; keep "one full 360-degree turn … always turning the same way, and ends exactly as it started" and "the camera is locked off" |
| `subjects.mjs` warns a subject looks almost the same halfway round | it rocks, or it is plain and round, so its turn can't be seen | look at `<name>-sheet.jpg`. If it turned, give the subject a detail that shows the turn (a handle, a pattern, an uneven shape) or keep it and accept a quiet turn |
| The subject changes shape, size or colour as it turns | the film drifted | redo with `--redo turn --fix "it keeps its exact shape, size and colours"` |
| The back is wrong (a draped figure with a bare back, a missing handle) | the film invents what it can't see | redo with `--redo turn --fix "seen from behind, …"` describing the back |
| The camera moves or zooms | the film added a camera move | redo the turn; the prompt must say "no camera movement, no zoom, no pan" |
| A halo or backdrop shows round the edges | the backdrop is close to the subject's colour | redo the photo on a backdrop that contrasts (`--redo photo --fix "on a plain light grey backdrop"`) |
| A dish's plate is missing or see-through | the cut-out treats the plate as background | set `"plate": "plate"` (or `"bowl"`) and run `subjects.mjs` again, or `node plate.mjs <id> <name> --keep "platter"` |
| `frames.mjs` says a subject was shrunk to fit | it is wider or taller than the stage | widen the stage (`w`, and `axis` at its middle) or lower `size`; or accept it smaller |
| One subject is bigger or smaller than the rest | they differ in shape | `"scale"` on that subject (0.9 is 10% smaller) |
| One subject turns the other way | its film turned the other way and wasn't caught | `"reverse": true` on it (or `false` if it was reversed by mistake), then `node frames.mjs <id> --only <name>` |
| A subject floats above its plinth or the floor | a square base dips lower at 45° than facing front | `"groundFrom": "front"`, and `"sink": 0.01` to sit it into the surface |
| A person shrinks on the page with a raised arm | `fit` by height | `"fit": "frame"` for people |
| A jump stands on the ground | no lift | `"air": 0.16` on that subject |
| The subject covers the words | the stage is too far left or too big | raise `--stage-cx` or lower `--stage-h`; narrow `.words` |
| The line between pages is hard to see | neighbouring `--page` colours are too close | pick colours further apart, or draw the line (a rim, a shadow, a torn edge) |
| One wheel notch turns two pages | (fixed in the engine) a trackpad's momentum | make sure the page loads `turntable.js` from the skill and `snap` isn't `false` |
| A turn stutters on first scroll | frames still loading | normal for a second on a slow line; the frames load coarse to fine. Lower `count` (48) or `quality` (70) in the subjects file for lighter pages |
| `check.mjs`: "no frames" | `frames.mjs` hasn't run, or the ids differ | the page's `data-subject` values must match the subjects file's ids |
| `check.mjs`: "text under 11 px" | small labels | at least 11 px; 13 px or more for anything people should read |
| `check.mjs`: "the page scrolls sideways" | something is wider than the screen | find it with the browser's inspector; giant type is fine (`.detail` clips it) |
| NOT ENOUGH CREDITS | the balance ran out | give the user the link from the message; run the same command again after they top up |
