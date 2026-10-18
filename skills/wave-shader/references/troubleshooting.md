# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| A shader fails to compile with a cryptic error | `half`, `patch` and a few other names are reserved in GLSL ES 3.0; rename the variable |
| An edited file doesn't show | the browser cached the module; serve with caching off (the preview server in Step 3 caches little, or hard-reload with Shift) |
| Black canvas, `html.no-gl` set | no WebGL2 (an old browser, or a disabled GPU); `--fallback` shows instead, so make it a good CSS gradient |
| Rows or bands look mechanical | too regular: raise `warp`, vary `glowShape`, let the colour be read along as well as across (`colorBy`) |
| Too busy, or "cheap" | lower `speed`, `amp`, the ribbon's twist (`shapeA[2]`, `shapeA[3]`) and `press` |
| A soft-focus ribbon looks blurry everywhere | the in-focus part must stay sharp: check `focus.distance` matches the camera's distance to the band and narrow `focus.range` |
| The aurora is dim or far on a phone | a phone sees only the middle of the arc: the `tall` override straightens it and brings it closer |
| Copy hard to read | move it to the calm part (layout), add `.has-scrim`, or lighten the stops behind it |
| Frame rate drops | `maxDpr` lower (1.25), or fewer fibres; the engine also lowers its resolution by itself after a few slow seconds |
| A hidden preview tab shows nothing new | frames pause in hidden tabs; `__shaders[0].redraw()` draws one |
