# character.json

One file per character at `site/characters/<id>/character.json`. The page reads `name`, `theme`, `scenes`, `eyes`, `blink`, `peek`; the generator reads `generate`. `assets/examples/pip.character.json` shows a complete file — for structure only; write every value fresh for the new character.

```jsonc
{
  "id": "juno",                       // matches the folder name
  "name": "Juno",                     // shown in the tab (when several characters) — the hero title usually says it too
  "theme": { … },                     // optional — fonts, title style, background look (see themes.md)
  "scenes": [ 5 × scene ],            // hero + 4 side scenes
  "eyes": [ … ],                      // pointer-following eyes (see eyes.md); [] = off
  "blink": true,                      // optional: bead/dot eyes blink every few seconds
  "peek": 0.55,                       // optional: share of the figure visible in the hero (auto = enough to show the eyes)
  "generate": { … }                   // prompts and settings for tools/generate.mjs
}
```

## scenes

Exactly 5. Scene 0 is the hero (big peeking character, title centred above). Scene 1 shows the rest pose; scenes 2, 3, 4 show poses 1, 2, 3. Write each title for the pose it sits next to — the pairing of words and pose is where the humour/charm comes from.

```json
{ "title": "Drawing <em>conclusions</em>.", "sub": "Mostly on napkins.",
  "colors": ["#2E5BFF", "#7FA6FF", "#C9D7FF", "#FFC21A"], "ink": "#0a1033" }
```

- `title`: 2–6 words reads best at display size. `<em>` marks one accent word (italic, or a marker stripe in `"em": "highlight"` themes). Titles are the main message — subtitles are small.
- `sub`: one short line that pays off or extends the title. `""` hides it.
- `colors`: 4 colours that drift as the background. `colors[2]` is also the page base colour, `colors[3]` the accent (marker highlight). Pull them from the reference image and its complements; vary hue family per scene so scrolling feels like a journey. One dark "night" scene is a nice contrast beat — give it a light `ink`.
- `ink`: text colour; must read clearly on all four colours.

## generate

```jsonc
{
  "refs": ["ref/reference.jpg"],      // reference images (paths relative to the project). Empty = text-to-image.
  "key": { "color": "#00B140" },      // chroma-key screen; or { "color": "#0047FF", "despill": "blue" }
  "imagePrompt": "…{KEY}…",           // the rest still. {KEY} is replaced with key.color
  "poseNote": "…",                    // appended to every pose prompt: what must stay the same
  "poses": [                          // exactly 3, in scene order 2, 3, 4
    { "name": "sketch",
      "pose": "She turns three-quarters to her left, holding an open sketchbook …",   // the still
      "move": "She turns to her left, lifts a sketchbook and starts sketching." }     // the motion into it
  ],
  "reviewBg": "#e83e8c"               // optional: backdrop for the keyed-frame review sheet
}
```

### Writing `imagePrompt` (rest still)

Cover, in this order:
1. **Style lock.** With a reference: "Recreate this exact character in exactly the same art style as the reference image: …" and list the distinctive features (hair, eyes, accessories, outfit, palette) so they survive. Without one: name the style concretely ("Pixar-style 3D animated-movie character render", "flat 2D vector editorial illustration, NOT 3D").
2. **The character** — features, outfit, expression. Invent the missing parts (e.g. lower body from a portrait) "drawn in exactly the same style".
3. **Pose & framing** — facing the camera, relaxed, arms at sides. Full: "Full body visible head to feet, both feet clearly drawn, centered with generous margin, figure about 72–80% of the frame height." Waist: "Waist-up medium shot … cropped at the waist by the bottom edge of the frame, head near the top."
4. **Background** — "Perfectly flat solid chroma-key {KEY} background, no shadow, no floor, no reflection, no text, no logos."

For a photo of a person: "Turn the person in this reference photo into a <style> character called <Name> … Keep his/her recognisable likeness: …". Ask for unbranded clothing ("no logos") — models add sneaker swooshes and fake shirt text otherwise.

### Writing poses

- **Dynamic and turned**: three-quarter views, mid-action, weight shifted, props welcome (sketchbook, iced coffee, skateboard ollie, balloon). Front-facing stiff poses read as "still"; full 360° turns aren't needed.
- **Match the titles**: decide the 4 scene titles and the 3 poses together.
- **Props** must not be the key colour (no green props on green screen, no blue splashes on blue).
- **Same framing** as the rest still — the `poseNote` should restate framing and the must-keep features (hair, accessories like earrings drift easily).
- **`move`**: one plain sentence describing the transition from the previous pose, including props appearing/disappearing ("…a sketchbook appears in her arm…"). Keep it natural; don't list things *not* to do.

### poseNote template

"Keep the exact same character and exactly the same <style>: <face, hair, key accessories, outfit, colours>. <Framing sentence>. Change the pose and body angle as described — a dynamic, expressive, mid-action moment, turned partly away from the front. Same overall scale in the frame, centered, full body/figure and any props fully visible with margin. Same perfectly flat solid chroma-key <colour> background with no shadow and no floor. No props or elements in <key colour> tones. No text."
