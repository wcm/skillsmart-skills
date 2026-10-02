# Troubleshooting Shader Hero

| Symptom | Cause | Fix |
|---|---|---|
| Black hero, console shows a GLSL error | Typo in a custom preset | Read the error line; WebGL 1 GLSL has no `int`→`float` auto-cast (`1` vs `1.0`), and `pow(x, y)` is undefined for negative `x` |
| Black hero, no error | Page opened as `file://` (module scripts blocked) | Serve over http: `python3 -m http.server` |
| Gradient fallback shows instead of the shader | WebGL disabled or unavailable | Expected on some devices; keep the fallback looking good |
| Visible banding in dark gradients | 8-bit output on dark colours | Raise colour 1's lightness slightly or add subtle noise: `col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;` |
| Choppy on laptops | Too many pixels | Lower `dprCap` in `shader-hero.js`, or reduce `fbm` octaves in the preset |
| Text hard to read | Busy shader behind the headline | Raise `--scrim`, lower `data-intensity`, or switch to a calmer preset |
| Cursor effect feels laggy | Smoothing too strong | Raise `data-interaction` (it also scales smoothing) |
| iOS Safari shows nothing until tap | Low-power mode limits WebGL | Fallback gradient covers this; nothing to fix |
