# Designing the page

The cloth is the hero, but the page is a real landing page for a real-sounding brand. The examples set the bar:
every one has a brand with a reason to own this cloth, a headline with a turn in it, specific details (a price, opening
hours, a material spec, a collection name) and a hint that tells the visitor what to do.

## Composition

- **Wide screens:** copy on the left (about a third of the width), the cloth to its right, centred in the remaining
  space and fully in frame with room around it. Nav across the top, a quiet footer, the hint in the copy column.
- **Near-square windows and phones:** the cloth above or below the copy (each example's `layout(w, h)` handles three
  cases: phone, tall, wide). On a phone, keep the call to action reachable without scrolling; the page doesn't scroll.
- Nothing overlaps the cloth: hints, labels and footers sit beside or below it.

## Copy

- **Brand:** a short name with a reason to own this cloth (a silk maison owns a silk banner; a jeweller strings
  pearls). Invent one if the user didn't give one, and say so.
- **Headline:** six words or fewer, with a turn ("Pull me closer.", "Step through the blue.", "Silk, unweighted.",
  "A full moon. Strung by hand."). One accent: italic, outline or colour on one word.
- **Lede:** two sentences, concrete and sensory, saying what the thing is and what happens when you touch it.
- **Details:** a kicker (collection, issue, place), one or two facts, a footer with a place and a number. They make
  the world believable; keep them consistent with each other.
- **Hint:** what to do, in three short phrases ("Lift a panel · move through · click to walk in").

## Type and colour

- One display face with character (a serif for craft and luxury, a wide grotesque for tech and fashion) and Geist /
  Geist Mono for the small print. Load the display face with the `@import` at the top of the page's CSS.
- Take the palette from the pictures: the ground from the scene, the accent from the picture on the cloth. Check the
  copy against the busiest part of the scene behind it; add a soft text shadow or a gradient scrim if it fights.
- Set `meta.veil` / `meta.ink` to the page's ground and text so the loading veil matches.

## Sound

Off by default; the dock's Sound button turns it on. `meta.sound` picks the bed: `rain` (a night city, vinyl
crinkle), `street` (morning birds, linen), `night` (still, for bead knocks), `water` (deep swells, silk). Leave it
null for a page that should be silent.

## Checklist before hand-over

- Would the brand's art director recognise the page as theirs: the cloth, the picture, the words, the details?
- Does every element have a reason to be there, and does nothing from the example's story remain?
- Is the hint true, and is the interaction delightful within two seconds of trying it?
