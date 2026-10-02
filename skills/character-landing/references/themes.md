# Themes: fonts, title style, background

`theme` in character.json (all optional — omitted keys fall back to the defaults: Instrument Serif titles, Inter body, italic accent, mesh gradient):

```json
"theme": {
  "fonts": "https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=DM+Sans:wght@400;500&display=swap",
  "title": "\"Syne\", \"Helvetica Neue\", sans-serif",
  "body": "\"DM Sans\", system-ui, sans-serif",
  "titleWeight": 800,
  "titleTracking": "-0.035em",
  "titleScale": 0.82,
  "em": "highlight",
  "gradient": "poster"
}
```

- `fonts`: a Google Fonts CSS URL; the page loads it when the character is shown.
- `titleScale`: wide/heavy display faces need ~0.75–0.85 so titles don't overflow; condensed or light serifs can stay at 1.
- `em`: `"italic"` (default) or `"highlight"` (a marker stripe in the scene's accent colour — good for faces without a real italic, and for bold/graphic looks).
- `gradient`: `"mesh"` (soft, airy, blended colour points) or `"poster"` (flat organic colour shapes with crisp edges — graphic, illustrated). Switching characters cross-fades between them.

## Choosing when the user gave no instructions

Match the character's medium and personality, and prefer contrast between title and body faces.

| Character feel | Title / body | em | gradient |
|---|---|---|---|
| Soft, cute, plush, Pixar/3D, warm | Instrument Serif / Inter (default) | italic | mesh |
| Editorial, fashion, elegant, portrait | Fraunces (opsz, 600) or Playfair Display / Inter | italic | mesh |
| Flat illustration, bold, vibrant, Gen-Z | Syne 800 / DM Sans | highlight | poster |
| Playful, chunky, toy-like, kids | Bricolage Grotesque 700–800 / Inter | highlight | poster |
| Techy, minimal, AI / product | Space Grotesk 600 / Inter | italic | mesh |
| Streetwear, skate, loud | Unbounded 700 (titleScale ~0.75) / DM Sans | highlight | poster |

Palettes: build 5 scene palettes from the reference image's dominant and accent colours plus complements. Vibrant references → saturated palettes with a different hue family per scene. Soft references → pastels. A single dark "night" scene (scene 3 works well) adds contrast; give it a light `ink`.
