# What has gone wrong before, and the fixes

| Symptom | Cause | Fix |
|---|---|---|
| A replay ends differently from the live run (`sim.mjs` says DRIFTS) | randomness or time outside the sim's own generator: `Math.random`, `R.fx` or the clock inside the sim; a planner that called `this.rand`; an input applied at a different step than it was recorded | all randomness in `this.rand`; the planner never touches it; record inputs inside `update()` at the step they apply |
| The autopilot dies where it shouldn't | its look-ahead steps differently from `update()`: another order, a speed change or a timer it ignores (the Roadster's FSF ignored Ludicrous ending mid-flip; Meta Gear's planner checked the wrong step and walked into cones) | plan by running copies of the real world; when the rules change, the planner's checks change with them |
| The autopilot is perfect and dull | it plays it safe | jump at the last good moment, now and then by a hair (close calls on camera), or add a Cinema mode |
| A run with no way through | hazards placed without a reach rule | the generator guarantees space: gaps longer than the longest move at that speed, guests whose reach starts after the last one's |
| CPU vs CPU is one-sided (Sam won 64% at first) | the supers aren't worth the same | one multiplier (Model Kombat's `SLOW_K`), tuned with a few hundred simulated rounds per level |
| Real people look like nobody | faces traced or simplified | caricature their few distinctive features, bigger; show the user headshots first (`pixel-art.md`) |
| Fighters' fall frames cut off | frames too small for the pose | wider frames (92×112) and room for rotated poses |
| Feet sink into the floor | the floor drawn after the cast, or the sprite's origin off by its outline | draw the floor first; anchor sprites at their feet |
| Raised fists cover the face | arm angles | lower the upper arms a little; check every pose on the sprite sheet |
| A word shows `?` | a character the pixel font doesn't have (an em dash, curly quotes, emoji) | use `-`, `·`, straight quotes; see `look.md` for the glyphs |
| Text touches art or other text | fixed y positions that collided when the layout moved | re-check every screen's shots; move lines, add `ui.backdrop` behind text over a busy scene |
| The hero gets lost in the scene | a bright, busy background (Pixel Hop's first skyline) | calmer, darker backdrops; the hero gets the brightest colours and a glow rim |
| Scenery crosses the text (a blimp over TAP TO PLAY, buildings over the moon) | background objects ignore the UI's layout | hide or move them during the title and get-ready; size scenery to the layout |
| A mirror ceiling looks confusing | reflecting everything | reflect only floors; give ceilings a plain lit surface |
| No sound | browsers start audio only after a gesture; or the saved level is muted | `R.audio.init()` on the first press (app.js does); check the sound button |
| A demo video's music plays on after a crash, or stops wrongly after a cut | a sound that ducks the music inside itself, unknown to the recorder | list it in the game's `duckers`, or duck from main with `A.seq.duck(true)` |
| The share card shows the menus, or nothing | no clean frame was taken | `view.wantSnap = true` a few frames after the crash |
| A scripted click lands on the wrong thing | buttons from the previous screen for one frame | tick a frame after a screen changes before pressing |
| `screens.mjs` can't start a browser | Playwright's Chromium isn't installed and neither is Chrome | install Google Chrome, or `npx playwright install chromium` in `tools/`; keep `playwright` pinned in package.json |
| It stops when you switch tabs | it pauses on purpose (`hidden()`) | tap RESUME |
| Blurry on a phone | the canvas scaled by a fraction | `app.fit()` picks whole-number scales; keep `#stage` filling the space and test at 390 px |
