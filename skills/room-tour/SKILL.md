---
name: room-tour
description: Build a website you walk through as you scroll — a room tour where each scroll moves the camera from one real viewpoint of a place to the next, through doorways and out onto terraces, with labels on materials, product cards, exact artworks to lift and a booking or enquiry ending. Pictures and moves are generated through Skillsmart credits. Use for interior designers, new homes sold before they're built, hotels and resorts, furniture shops (shop the room), galleries and showrooms — or whenever someone wants a room tour, a virtual walkthrough or a scroll-driven house tour.
---

# Room Tour

A page that walks the visitor through a place. Each stop is a still moment from a real viewpoint; each scroll between
stops plays one continuous camera move (a short AI video cut into frames) through a doorway, across a room or out onto a
terrace. Over the walk sit a title that reads first, captions, a rail of stops, a corner map with a red you-are-here
marker, and things to click: material tags that open cards, facts, products with prices and colours, or artworks that
lift off the wall. It ends on what the visitor should do next: a plan and an enquiry, a booking card, a cart, visit
details.

Four example pages ship with it (`assets/examples/README.md`, live on demos.skillsmart.io/room-tour):
**Tembusu** (a tropical house sold before it's built), **Teluk Senja** (a resort at dusk, made only from its own
photos), **ondo** (one room you can shop, with a sofa that takes the colour you pick) and **Shedlight** (a gallery whose
exact works hang on the walls and lift when clicked).

Why it is built this way (each was learned the hard way, so keep it):

- **The camera always moves.** Every stop is a clearly different viewpoint and the camera travels between them. Never
  hold one angle while the place changes around it: a room that "builds itself" in place reads as a slideshow, not a walk.
- **One move per clip, one step each:** through a doorway, across a room, a turn of up to about 60°. One clip of 6–8 s
  carries a whole walk through a door and into the next room.
- **The pictures agree with the walk.** The video model morphs whatever two pictures disagree on. Doors the camera walks
  through stay open in every picture after (a picture with closed screens where the camera has just stepped out makes
  them slide shut); views that share a sky share one sky, cloudless is safest (two skies make the clouds race); the next
  stop keeps near walls at a calm distance (a wall close to the camera at the end of a turn pushes out suddenly).
- **The model invents what no picture shows.** Walking through a door and turning, it furnished the room's unseen side
  with a daybed and a wall corner in every take, whatever the prompt said. Look at the edges of every take and keep the
  one where anything invented behaves like real furniture: it comes out from behind something, stays put, and leaves
  with the turn.
- **Crop, don't repaint,** to take something out at an edge of a picture: a repainted wall came back with a bent floor.
- **A place people book is shown honestly:** only from the place's own photographs, moves only between photos that can
  see each other, and a designed cut between far rooms, never an invented corridor.
- **Exact things stay exact.** Artworks are laid onto blank canvases by the page and never repainted; products come
  from their packshots, and a colour change happens inside the product's mask.
- **The title reads first:** big on the first screen. A foreground object may cover its lower quarter, cleanly; a soft
  cut-out nibbling at the letters looks like a glitch, so clear it or cover it properly.
- **The page never stalls:** the first scroll moves the camera, stops are short still moments, captions are about five
  words and rise from a hairline, text is 14 px or more and never filtered, the visitor's own cursor always shows (the
  drawn cursor is only a fluid outline beside it), and a recording of the walk is about 25 s.
- **Soft light reads real** for calm daytime rooms (hard sun with dappled shadows looks fake); at dusk, warm light only
  at its sources. No real places or landmarks, no people and no text in the pictures; every brand and price made up.

`<skill>` below is the folder this file is in. "design system 4.3" in the engine's comments means
`references/design-system.md`, section 4.3.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the place, who it's for, what they should do | what the user said (`/room-tour a walk-through for our new pool house` in Claude Code, `$room-tour …` in Codex, or "make a room tour for …"); otherwise ask one short question |
| Skillsmart credits | pictures, moves, cut-outs | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3 | tools, scaffolder, local server | `node -v`, `python3 -V`; macOS `brew install node python` |
| ffmpeg | cuts the moves into frames | `brew install ffmpeg` (macOS), `winget install ffmpeg` (Windows), `apt install ffmpeg` |
| Chrome or Edge | `check.mjs` and `video.mjs` drive it headless | if there is none, check by hand (Step 7) |
| OpenCV for Python (optional) | labels that follow an object through a move (`track.py`), artworks laid on canvases (`panels.py`) | `python3 -m pip install opencv-python-headless numpy` |

**Cost in credits:** a picture is 20, a second of video 15, a cut-out 2. A three-stop page with two moves of 7 s, two
takes of each move and a few picture retakes is about **600 credits** (about 180 for pictures, 420 for video). A gallery
adds its artworks; a shop its packshots. `node pictures.mjs <id> --cost` and `node moves.mjs <id> --cost` print exact
figures. Tell the user before each paid step. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped up,
run the same step again (everything already made is kept). If the user wants to use their own fal.ai key instead, prefix
the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on the page (one short message, then go)

Decide, and say in a few lines what you chose:

- **The business and the one thing a visitor should do** at the end: enquire, book, buy the room, visit the show.
- **The place**, generic and believable, in one sentence, with its light and time of day. A house is shown in soft
  daylight; a resort or lodge at dusk; a shop in warm afternoon light; a gallery in cool skylight.
- **The route:** three or four stops and two or three moves, each move one step. Name each stop's viewpoint. Make the
  first stop the title's screen (an entrance, a doorway, the whole room) and the last the one that sells.
- **What you click:** materials (tags → cards), facts (dots → short pills), products (dots → product cards, a colour
  picker, a cart), artworks (the works themselves → lift). One kind is enough; never all four.
- **Honest or imagined:** a real place people book is made from its own photos with cuts between far rooms
  (`references/walks.md`, "Honest mode"). A house not yet built, a staged room or a show can be imagined.
- **The look:** the closest example as a reference, one display face and one text face, a palette in one hue family
  that no other part of the site shares, and one signature that belongs to this business (a drawing sheet for an
  architect, a ruled booking line for a hotel, a colourway for a sofa, wall labels for a gallery). Never reuse an
  example's look as it is. `references/design-system.md` §1 and §7 show how the four differ.

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from plain
cd <project-dir>/tools && npm install
```

This creates `site/engine/` (shared), `site/<id>/` (the page), `tools/` and `tools/walks/<id>.json` (the pictures and
moves). `<id>` is a short lowercase name; `<project-dir>` is `./tour-<id>` unless the user named one. `--from tembusu`
(or `teluk-senja`, `ondo`, `shedlight`) starts from an example page instead. Every example's walk file lands in
`tools/walks/_<name>.json`: read the one closest to your brief before writing. Every slot to fill starts with `WRITE`.

## Step 2 — The walk file

`references/walks.md` has the whole method, with the prompts that worked and the failures they prevent. Read it first.

In `tools/walks/<id>.json`:

- `style`: one sentence every picture shares (the place, materials, light, season, time of day); `{style}` in a
  prompt is replaced by it.
- `shots`: one picture per stop. Write the **most important stop first**, as a full description (it is made from the
  prompt alone); the others are edits of it (`"from"`), starting with `{same}` and saying where the camera now stands
  and what must agree with the walk. `crop` and `paste` make a variant for free.
- `moves`: for each move, its `start` and `end` pictures, a `duration` (6–8 s) and the camera's path in plain words,
  starting with `{move}`, ending "as in the last picture".

## Step 3 — The pictures

```bash
node pictures.mjs <id> --cost          # tell the user
node pictures.mjs <id> living --n 2    # the master: two takes, look at both
node pictures.mjs <id> living --keep 1
node pictures.mjs <id>                 # the rest, as edits of it
```

Look at every picture whole and in crops (pictures you open arrive downscaled; crop the full file to judge detail):
realism first (material, light and detail like a real architecture photograph), then the walk's rules: each stop a
truly different viewpoint and plausibly the same building; the same light and sky; doors the camera will pass open;
near walls not too close; no text, logos or people. Fix a picture with `--fix "…"` or a better prompt before any video:
the video can only morph between the pictures it's given. **Show the user the stop pictures before spending on video.**

## Step 4 — The moves

```bash
node moves.mjs <id> --cost
node moves.mjs <id> move-1 --n 2       # run it in the background: a take takes a few minutes
node moves.mjs <id> move-1 --edges     # the left and right edges of every take, over time
node moves.mjs --strip out/<id>/move-1-take2.mp4 --n 30    # a denser look at one take
node moves.mjs <id> --keep move-1:2    # trims the still frames at both ends and sizes it to 1920 × 1080
```

Look through each take for what `references/walks.md` lists: walls or furniture that appear at an edge and vanish,
doors or screens closing, clouds moving, a jamb smearing as the camera passes, a wall pushing out at the end of a turn,
floors bowing. When the picture is the cause (two skies, a door shown closed, a wall too near), fix the picture and
make the move again; a new take of the same pictures fails the same way. Show the user each kept move's strip.

## Step 5 — Frames, masks, tracks

```bash
node frames.mjs <id> --rec             # site/<id>/frames/<move>/, -phone/, and -rec/ for recordings
node stops.mjs <id>                    # each stop frame with a 5 % grid → out/<id>/stops.jpg
node mask.mjs <id> occluder "branch"   # optional: the title's foreground object, from the first frame
python3 track.py out/<id>/move-2.mp4 ../site/<id>/tracks/move-2.json --point coping=0.63,0.74@last   # optional
```

Keep each page under about 20 MB without the `-rec` frames (`--q 56` for busy foliage). A gallery's canvases and
artworks: `references/gallery.md`. A shop's packshots, recolour pair and sofa mask: `references/walks.md`, "A room to
shop".

## Step 6 — The page

`site/<id>/tour.json` holds the whole page: the walk, stops, moves, captions, hotspots, cards, the map, the end and
the recording (`references/engine.md` has every field, with examples; `references/design-system.md` has every
component's design). `index.html` holds the fonts, the end section and the footer; `style.css` the tokens and the
page's own pieces; a site layer (a small `.js` file, see the examples) adds anything the engine doesn't.

- Write every word. Captions are about five words with one sentence under them.
- Place each hotspot by measuring `out/<id>/stops.jpg` (its grid is in the frame shares `at` uses). A stop shows the
  move's own first or last frame, not the generated picture. Keep dots out of the caption's box.
- `focus` per stop keeps the subject in a phone's narrow crop.
- A map (`theme.map`): a small SVG plan with `#route`, `#stops` and `#rooms`; put it in a corner the captions don't use
  (`corner`: `tr`, `br`, `bl`, `tl`), big enough to read, with the red rippling you-are-here marker.
- Time the recording to about 25 s (`moves.*.rec`, `record.hold`, `record.end`) and add one beat (`record.beats`) that
  opens a card or lifts a work, so a video shows what you can click.

## Step 7 — Check

```bash
node check.mjs <id>     # → out/<id>/check-desktop.jpg, check-phone.jpg, and what's wrong
```

Fix everything it lists, then read both sheets yourself:

- The title reads on the first screen, on desktop and phone; anything in front of it covers only its lower part, cleanly.
- The first scroll moves the camera; every stop is a different viewpoint; nothing morphs, closes, races or pops in.
- Captions arrive as the camera settles, with words that match what shows.
- Hotspots sit on their objects at every stop, desktop and phone; none under a caption or the map.
- No text under 14 px, no filter on any text, nothing scrolls sideways at 390 px, the visitor's cursor always visible.
- The recording is about 25 s and its beat lands on something clickable.

## Step 8 — Hand over

`python3 tools/serve.py` serves `site/` at http://localhost:5190/<id>/ with caching off (a plain static server lets the
browser keep the old frames after a move is re-made). Without Chrome, give the user that address and the checklist
above, and fix what they report. Offer a video: `node video.mjs <id>` (1440 × 900), or `--size 540x960 --scale 2` for
a vertical one. Tell the user what they should replace: every picture and move is AI-generated, so a real project's
photographs, plans, prices and facts must be checked; a real hotel or shop should be rebuilt from its own photos.
`site/` is a static site: host it anywhere, without the `frames/*-rec/` folders.

Problems: `references/troubleshooting.md`.
