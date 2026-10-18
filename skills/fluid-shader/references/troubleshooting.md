# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| A shader fails to compile with a cryptic error | `half`, `patch` and a few other names are reserved in GLSL ES 3.0; rename the variable |
| An edited file doesn't show | the browser cached the module; hard-reload, or serve with caching off |
| Black canvas, `html.no-gl` set | no WebGL2, or no float render targets; `--fallback` shows instead, so make it good |
| The cursor leaves swirls and eddies | too much force or curl: lower `touch`, `curl` and raise `calm`; or move the picture instead of the water, as Marble's stylus does |
| A pattern carried by the flow streaks or stalls | a coordinate stored in half floats is too coarse near 1; store a small offset from the pixel's own position instead, and let it ease back toward zero |
| Lines along the canvas edges, blocky shading | a sharp pattern read through a fluid-carried displacement shows the walls and the pressure solve's checkerboard; draw it from a formula (as Chrome does), and draw height maps a few texels past the canvas so slopes at the edge read real neighbours |
| Dye washes out to white | tone-map by brightness, not per channel (Dye does), so dense colour keeps its hue |
| Marble's edges go soft over time | every resample blurs a little; snap in-between pixels toward the nearer ink after each change (`crisp`) |
| Film looks flat or wrong-coloured | its thickness must run thin at the top and thick at the bottom; colour comes from the table, not from picking hues |
| Frame rate drops | lower `maxDpr`, the field resolutions (`dyeRes`, `inkRes`, `filmRes`) or the solver's `sim`; the engine also lowers its resolution by itself |
| A hidden preview tab shows nothing new | frames pause in hidden tabs; `__shaders[0].redraw()` draws one |
