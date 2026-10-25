# Layouts and changes

A scene is one layout (`"layout"`) in one of its looks (`"look"`). Six layouts, sixteen looks. Every look takes any
number of pictures (`cards`, repeated round `count` places), but each has a number it looks best with, given below.
`hold` is how many screens of scroll the scene stays (1.0–1.6); while it holds, its pictures and camera move with the
scroll.

## The looks

| Layout · look | What it is | Pictures | Its own options | Suits |
|---|---|---|---|---|
| `pile` · `table` | prints lying on a surface, each with a soft shadow, three above the title and three below it, so the title reads between them | 6 | — | a first scene; anything printed: photos, looks, cards. Put a surface photo behind (`back: { img, surface: true }`: a cutting mat, a desk, linen) |
| `pile` · `board` | one big picture in the middle, the others pinned round it on threads, like an inspiration wall | 5–9 | `thread` (the threads' colour, `"#e8261d"`) | a first scene for a body of work, a moodboard; put linen behind (`shader: "linen"`) |
| `ring` · `arc` | a huge circle facing you, far bigger than the screen; the pictures roll along its rim like a rainbow and the one at the top is named under it | 10–14 | — | a calm, airy scene for photographs; small pictures, lots of sky |
| `ring` · `band` | the circle tilts back; the pictures stand round it facing out, bent to it, turning in haze | 12–20 | `front` (which place starts in front: 0.8 is just past the first) | after the arc (`change: "reshape"`), a big turning shape |
| `ring` · `surround` | you stand inside the ring near its back, with a wide lens: pictures huge at both edges, small straight ahead; `cloth: true` hangs each as a silk panel from a rail | 10–16 | `ring` (places in a full circle, 7), `cloth` | a runway, a show, anything tall and full length |
| `ring` · `platter` | the pictures stand round a spinning record on a walnut turntable, bent to the ring | 8–12 | — | records, square covers; needs `walnut` (below) |
| `ring` · `wheel` | records on edge round an upright axis, seen from above like a jukebox; the one that comes round to you rises, opens wide and slides its vinyl out | 24–40 (`count`) | `turn` (how far the wheel turns over the hold, 0.13) | a last scene for a collection of square pictures; needs `walnut` (below) |
| `deck` · `stack` | records face to face in a walnut crate; you flip through them and the front one lifts out | 10–14 | `run` (how much of the deck goes by, 0.75) | records, books, prints; needs `walnut` (below) |
| `deck` · `slabs` | covers as thick slabs piled down the screen, a label (title and `sub`) on each one's edge; the middle one opens | 7–10 | — | a first scene for a shop or catalogue |
| `deck` · `sweep` | a C-shaped curve going into depth, the front picture largest; the deck flows along it; three switches change corners, size and flow | 12–20 | — | products, design work, a playful middle scene |
| `deck` · `ribbon` | a long deck of thick acrylic cards twisting through space, turned along it, glowing at the edges | 30–40 (`count`) | `flow` (how fast it flows, 0.22) | after the sweep (`reshape`), on black |
| `deck` · `trail` | the deck follows the cursor (or draws a slow path of its own), each picture bigger than the one behind it | 12–20 (`count`) | `shrink` (each one's size against the next, 0.9) | a first scene for photographs; feels alive |
| `sphere` · `dive` | you fly in through a ball of pictures until they are all round you; it turns, and the camera closes in on one until it fills the screen | 30–40 (`count`) | `end` (the id it closes in on) | a last scene; `change: "dive"` |
| `book` · `pages` | a thin glossy lookbook lying on a textured ground; it arrives closed, opens, and its pages turn with the scroll | 6–10 | — | a last scene for an editorial page; put tissue paper or linen behind (`back: { img, surface: true }`) |
| `mosaic` · `tiles` | a grid of tiles as tall as the screen; it starts as many pictures, one on each tile, then waves of tiles turn over, each wave making one picture of the whole grid | cols × rows (`count`) | `cols`, `rows` (4 × 5), `looks` (the waves: ids, or `"mix"` for a patchwork of all), `aspect` | a middle scene; before the book (`change: "fold"`) |
| `mosaic` · `cube` | a picture on each face of a glass cube, cut into nine; it scrambles, turns once round slowly and solves itself | 6 | — | a last scene for design work, on a soft glow |

The crate, the turntable and the jukebox are made of walnut: the page needs `scene/walnut.webp` and its size in
`scene/scene.json`. Side B has them; for another page copy both from `<skill>/assets/examples/side-b/scene/` (the
entry is `"walnut": { "w": 2400, "h": 1340 }`), or generate a wood of your own as a `surface` (`scenery.md`).

Every scene also takes `bg` (two colours: top, bottom), `ink` (the words' colour while it shows), `name` (shown
bottom right) and `scene` (its scenery, `scenery.md`).

## The changes

`change` on a scene says how the pictures arrive from the scene before it. Pictures that are in both scenes fly from
their place in one to their place in the next; the others leave and arrive each layout's own way.

| Change | What happens | Use it |
|---|---|---|
| `reform` (the default) | every shared picture flies straight to its new place, over the top when it has far to go | anywhere |
| `reshape` | the same, but together, swinging round the middle of each shape: a circle tilts into a band | between two rings (arc → band, platter → wheel) or two decks (slabs → crate, sweep → ribbon) |
| `dive` | a reshape the camera flies through | into the sphere |
| `fan` | the pictures rise into an arch in front of you and turn over, one after another, into the next ones | a big moment early on: table → runway |
| `fold` | the tiles fold up like a map into the next scene's closed book, which then opens | only tiles → book |

`len` on a scene sets the change's length in screens (1).

## Composing a page

- **Four scenes**, each a different look, about eight screens in all (holds of 1.0–1.6 plus 1 per change). More
  scenes make a long page and a long video; three can be enough.
- **The first scene frames the title**: table, board, slabs or trail. The ring looks, the ribbon and the tiles fill
  the screen; keep them later.
- **The last scene is a finale**: the sphere, the jukebox, the cube or the book.
- **Alternate**: light and dark backgrounds, busy and quiet scenes, wide and close.
- **Share pictures between scenes** so they visibly fly from one shape into the next; a change with no picture in
  common is just a cut.
- **The strongest pictures first** in `cards`: the first places are the ones in front, at the top of the arc, open in
  the crate.
- **Few pictures?** Give the big shapes a `count` (a wheel of 40 from 12 pictures), and pick the looks that want few
  (table, board, slabs, cube, book).

The four examples, scene by scene, are in `assets/examples/README.md`.
