# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| A shader fails to compile with a cryptic error | `half`, `patch` and a few other names are reserved in GLSL ES 3.0; rename the variable |
| An edited file doesn't show | the browser cached the module; hard-reload, or serve with caching off |
| The photo never appears | open the page through the server (`http://localhost…`), not as a file; check the `src` path (`img/<id>.jpg`, relative to the page) |
| Black canvas, `html.no-gl` set | no WebGL2; `--fallback` shows instead, so make it a good CSS stand-in |
| The glass looks like stripes or a veil | too thin, or too soft a backdrop where it's deepest: raise `thickness` / `refract`, and put strong edges and points of light under the deepest glass |
| White outlines or highlight lines on the glass | something drew them; take them out and let the rims carry what's behind, bent |
| A line along each side of the canvas | a slope read from a clamped edge texel; draw height maps a few texels past the canvas |
| Steam wipes on hover | wiping must follow a press: the look wipes only while the pointer is down |
| Dragging over the copy selects text | Steam turns selection off during a wipe; keep the page's own handlers from re-enabling it |
| Tiles' ball shows bare outside the blocks | check `title` (wide) and `clear` (tall) point at the right elements; the ball is clamped to where the blocks begin |
| Liquid's drops crowd and merge on phones | the photo's band is short on a tall screen: drops scale down there; lower the count with a larger `spacing` |
| Frame rate drops | lower `maxDpr`; for Liquid a larger `spacing`, for Tiles a lower `frost`; the engine also lowers its resolution by itself |
| A photo run stops with NOT ENOUGH CREDITS | give the user the link from the message; when they've topped up, run it again (failed runs aren't charged) |
