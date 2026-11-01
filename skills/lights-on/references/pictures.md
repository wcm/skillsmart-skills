# The pictures

A page is one day photo and its edits, each made from the one before, so every picture shares its frame:

```
day → night → dark → solo-<light> (one per light)
```

- `day`: the place by day, everything off.
- `night`: the same frame with the lights on (and, if the story wants it, a new crowd).
- `dark`: the night with every light off: the blue hour, the base the lights are added to.
- `solo-<light>`: the dark photo with one light on. What it adds over `dark` is that light's share of the night.

Variants (fabrics, finishes) are more sets, edited from the day photo: `day-voile` from `day`, `night-voile` from
`day-voile`, `dark-voile` from `night-voile`. See `assets/examples/pli/scene.json`.

## The scene file

`tools/scenes/<id>.json`:

```json
{
  "solos": ["pendants", "candles"],
  "shots": {
    "day": { "prompt": "…" },
    "night": { "from": "day", "prompt": "Edit this photograph: … Keep the camera, the framing, … only the light changes." },
    "dark": { "from": "night", "prompt": "Edit this photograph: switch off every light … {keep} …" },
    "solo-pendants": { "from": "dark", "prompt": "Edit this photograph: switch on only the pendants … {keep} …" }
  }
}
```

`{keep}` expands to the sentence in `tools/photo.json`: same camera, nothing added, removed or moved, change only the
light. Use it on every solo and every dark shot. In `solos`, the name `rest` means "whatever the others don't account
for" and needs no photo: handy for a second light that's hard to isolate (`noble-gas`).

Up to six measured lights. The page's `lights` must list them in the same order.

## Writing the day prompt

- Say it's a real photograph, and name the camera position: straight-on or three-quarter, at eye level.
- Put every light in the frame, by name, **switched off**, each a thing worth looking at. Unlit things need saying:
  "unlit glass, no flame", or the model lights them.
- Leave a calm band of wall or page for the title, and say where.
- Keep the light soft: "soft morning daylight, gentle soft shadows, low contrast". Hard raking sun and dappled shadows
  are what makes a generated room look staged.
- The kind of place, not a famous one: "a tree-lined street", "no famous landmarks".
- End with no text, no logos, no signage (`photo.json` adds it).

## Writing the night prompt

Say what time it is, name each light again with its colour temperature (2700 K for lamps), what's outside the windows
(deep blue with soft bokeh), and how far each light reaches. "Slight halation around the lamps, deep blacks with
detail" helps. A new crowd is allowed here; blur the people walking past so it reads as busy without many sharp faces.

## What to look at

| Shot | Good | Redo when |
|---|---|---|
| day | you'd want to be there; lights clearly off | a light glows, a candle has a flame, text appeared |
| night | a new mood; every light clearly on | the frame changed, an object moved or vanished |
| dark | blue, with detail, no warm light left | a lamp still glows |
| solo | one light, falling off naturally | others came on, or the light has no reach |

Nano Banana Pro returns 5504 × 3072, a little wider than 16:9. Keep every shot at that size (the tools do): cropping it
to 16:9 makes each edit in the chain creep about 0.8%.
