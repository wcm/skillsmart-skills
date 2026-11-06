# The walk: pictures and moves

A walk is stops joined by moves. Each stop is one picture from one viewpoint; each move is one video clip that starts on
one stop's picture and ends on the next one's. The page scrubs the clips' frames with the scroll, so a stop is simply a
clip's first or last frame held still for a moment. Everything below serves one goal: a move that looks like a real
person walking through a real place, with nothing in the place changing.

## 1. The route

- **Three or four stops, two or three moves.** About 6–8 screens of scroll in all and a ~25 s recording. More stops make
  a longer page, not a better one.
- **Every stop a clearly different viewpoint.** Outside looking in through a door; across the room on a diagonal; along
  the pool. If two stops could be mistaken for each other, one of them is wasted.
- **One step per move:** through one doorway, across one room, out onto one terrace, a turn of up to about 60°. One clip
  of 6–8 s carries that easily. A longer route gets another stop, not a longer clip.
- **Never a change in place.** No room finishing itself, no lights coming on, no furniture arriving while the camera
  waits. The camera moves; the place stays as it is.
- **A cut between far rooms.** Two places that can't see each other (a lobby and a room upstairs) are joined by the
  engine's designed cut (a sheet rising with the next room's name), never by an invented corridor.
- **The first stop carries the title.** Choose a viewpoint with a calm surface for a big word (a wall above a door, a
  sky, a facade), and optionally something in front of it (a branch, low planting, the sofa) for the title to sit behind.

## 2. The pictures

### The master first

Write the most important stop as a full photograph description, and make it first: everything else is an edit of it,
so materials, furniture and light agree. Give the camera's position and direction ("standing in the living room near
the back wall, looking diagonally across the room towards the open glass doors"), the lens feel, every material by name,
the furniture, what is seen beyond the openings, the light and the time of day. The tools add a standard photographic
line (real architectural photography, 24 mm, verticals straight, no people, no text, no famous landmarks).

### The other stops: edits

Each other stop is an edit (`"from"`) of the master or of a neighbour, starting with `{same}` ("the same place, the same
moment and the same light… only the camera has moved") and then saying bluntly where the camera now stands and looks.
The model sometimes barely moves the camera: if the new picture looks like the old one, describe the new position more
extremely ("now outside in the entry court, five metres back, looking straight in through the open pivot door").
Then list what must agree with the walk:

- **Openings the camera passes are open in both pictures,** and stay open in the pictures after. If the picture after
  a doorway shows that doorway closed (a facade of closed screens where the camera has just stepped out), the video
  slides it shut. Say it: "at the far left, nearest the camera, the end of the open living room with its glass doors
  stacked open".
- **One sky.** Every view that shows the sky shows the same sky. Cloudless is safest: a clear gradient (deep indigo to a
  warm band at the horizon at dusk; a pale haze by day). Two different cloudscapes make the clouds race across the move.
  Make the sky an edit of its own ("change only the sky…") once the views are right.
- **Near walls at a calm distance.** If the next stop has a wall or facade close to the camera, it swings in fast at the
  end of the move and "pushes out". Put the camera further from it ("about one and a half metres further out on the
  deck, away from the house").
- **The same light.** One time of day and one weather for the whole walk. Calm daytime rooms want soft, low-contrast
  light (hazy sun, overcast); hard sun with dappled leaf shadows looks fake. At dusk, warm light only at its sources
  (lamps, a fire) and the rest in deep blue.

### Free variants

- `crop`: a tighter framing of a picture (`{ "zoom": 1.12, "center": [0.56, 0.5] }`). The way to remove something at
  an edge without repainting: a room corner that pops up during a turn, a stray object. Repainting a wall to remove a
  corner bent the floor line.
- `paste`: one rectangle of another picture pasted in with a soft edge: one sky shared by two views, or a fix that must
  leave the rest of the frame untouched.

### Checks before any video

Look at every picture whole and in crops: real material, light and detail first; then each stop truly different and
plausibly one building; openings, sky, near walls, light; no text, logos, people or famous landmarks; the title's calm
surface on the first stop. Show the user the stops before spending on video.

## 3. The moves

### The prompt

Start with `{move}` (a steady gimbal shot at walking pace, eye height 1.5 m, only the camera moves, nothing opens,
closes, slides or changes) and describe the path in plain words: where the camera starts, what it walks past or through,
which way it turns and by about how much, and where it comes to rest, "as in the last picture". Name the things that
must stay still ("the glass doors stay open the whole time", "the sky is still and cloudless"). Six to eight seconds;
two takes of each move.

Prompts that worked: "walks straight forward through the tall open doorway past the open teak pivot door, leaving the
frangipani behind on the right; while it is still passing through the doorway it is already turning slowly to the left,
about 40 degrees in all; it never looks to the right"; "walks out through the wide opening, past the glass doors that
stay stacked fully open, onto the deck; keeps walking to the middle of the deck, a little away from the house, and only
then turns slowly to the left".

### What to look for in every take

`moves.mjs --strip` shows the whole take; `--edges` shows each take's left and right edges over time, which is where
most failures hide.

| You see | Why | Fix |
|---|---|---|
| A sofa, a wall corner or a doorway appears at an edge and is gone a second later | no picture shows that part of the place, so the model invents it | prefer a take where it behaves like real furniture (appears from behind something, stays put, leaves with the turn); turn earlier in the move ("while still in the doorway"); or add a stop that shows that side |
| Doors or screens close, slide or swing by themselves | a later picture shows them closed | edit the later picture so they're open; make the move again |
| Clouds stream across the sky | the two pictures have different skies | give both the same sky (cloudless), make the move again |
| A wall or facade pushes out at the end of a turn | the end picture's camera stands too close to it | move the end picture's camera further away |
| A door jamb or stone wall smears as the camera passes close | the camera brushes it | accept a brief soft moment, or move the path off the jamb |
| The pool's edge or the floor line bows mid-turn | a wide turn | a smaller turn, or a stop in the middle |
| The camera barely moves, then jumps at the end | the pictures are too far apart for one step | add a stop between them |
| The take freezes for a moment at the start or end | the model eases in and holds | `--keep` trims still frames at both ends |

When a take fails because the pictures disagree, a new take of the same pictures fails the same way: fix the pictures.

## 4. Honest mode (a place people book)

A real hotel, holiday home or venue must not show rooms that don't exist. Build its walk only from its own photographs
(for a demo, make the "photographs" first, as a hotel photographer would deliver them, then nothing but the moves). Join
two photos with a move only when one can see the other (the entrance and the lobby through the door; the room and its
terrace through the shutters). Join far rooms with the engine's cut: a sheet rises with the next room's name, the
walk continues there. Say so in the footer.

## 5. A room to shop

- **Packshots first,** one per product, on a plain backdrop. The room is then furnished from them: an edit of the empty
  room with every packshot as a reference ("furnish the empty room with exactly these pieces, keeping their exact
  shapes, colours, materials and proportions"). The pieces in the room then match what the cards sell.
- **Keep moves near products short:** a product can drift in shape during a long glide. Glide round the room in two
  short moves rather than one long one.
- **A colour picker that changes the room:** make the stop's picture again in each colour as an edit ("the same
  picture; change only the sofa's fabric to oat bouclé"), cut the product's mask
  (`node mask.mjs <id> cut out/<id>/sofa.png "sofa" sofa`) and give the card's swatches a `recolour` (the engine
  cross-fades the picture inside the mask at that stop). Only ship it if it looks real at full size.

## 6. Three kinds of things to click

1. **Hotspots at the stops:** fixed dots on objects while the camera is still (`stops.*.hotspots`). Place them on
   `stops.mjs`'s grid; they open a card, a short fact pill, or a product.
2. **Tags that follow an object during a move:** `track.py` follows a point through a clip (seed it on stable texture
   — a stone joint, a corner — never on water, glass or a plain wall; `@last` seeds it on the last frame), and
   `moves.*.tags` rides a label on it. Start a tag once its point is well inside the frame.
3. **Artworks on the walls:** exact images laid onto blank canvases tracked through every frame
   (`references/gallery.md`).

## 7. Frames and weight

`frames.mjs` keeps every 2nd frame (12 a second), 1600 px wide for desktop and 960 px for phones, WebP at quality 64.
A page should stay under about 20 MB without its `-rec` frames: busy foliage costs most, so drop to `--q 56` there. The
`-rec` frames (every frame, quality 85) are only for recordings (`?record` for `video.mjs`, `?rec` for a screen recorder
that scrolls the page itself) and are never published.
