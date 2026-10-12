# Designing the page

The glass is the hero, but the page is a real landing page: a brand with a reason to own this object, a headline with
a turn, two sentences of copy, a call to action with a concrete detail beside it, a hint, and a quiet footer.

## Composition

- **Wide screens:** copy left (about a third of the width, vertically centred), the object right of it in
  `stage.slot`, nav across the top, footer along the bottom. A soft scrim (`body::after`) keeps light behind the copy
  from fighting the text; `--scrim` sets its strength (switch it off for a gradient sky, as `halo` does).
- **Near-square windows and phones:** the copy on top, the object below it (the slot moves on its own). The hint
  hides; on phones the nav links and the CTA's side note hide too.
- Never let the headline run into the object: shorten the line or lower the page's `h1` size before anything else.

## Copy

- **Brand:** short, with a reason to own glass and light (a lab that "splits" images, a glass-block maker, a festival
  of light, a perfume that "blooms"). Invent one if the user didn't give one, and say so.
- **Headline:** two short lines, the second in `<em>` (it takes the spectrum gradient, or the page's own accent):
  "One image, *every colour.*", "Glass block, *made for daylight.*", "Bend *light.*", "Bloom, *in soft focus.*"
- **Lede:** two sentences, concrete: what it is, then the image that ties it to the glass.
- **CTA detail:** a number that makes it real (a price, a date, a size, a count).
- **Hint:** what hover and drag do, in short phrases.

## Type and colour

- One display face with character for the headline (`--display`, loaded by the `@import` at the top of the page's
  CSS): Geist light for tech, an architectural serif (Instrument Serif) for materials, a loud grotesque (Syne) for an
  event, a perfumer's serif (Cormorant Garamond) for beauty. Geist and Geist Mono for everything else.
- Take `--bg` from the scene's darkest (or palest) tone, so page and canvas meet without a seam; `--ink` for text.
- The accent in the headline should echo the light: the spectrum, or the scene's two or three hues.

## Checklist before hand-over

- Would the brand's art director recognise the page as theirs?
- Does nothing of the example's story remain (names, numbers, places)?
- Is the rainbow vivid on the object, and does the scheme read as one palette with the copy?
