---
name: build-hero
description: Build a website hero where one scroll plays a film of the place being built, from bare ground to finished while the camera moves, then evening falls and the lights come on in order. Includes a scaffold of readouts, one-scroll auto-play and the page around it, with pictures and film generated through Skillsmart credits. Use for a new condo or tower launch, kitchens, renovations, pools and gardens, shop fit-outs, event styling and anything sold before it exists — or whenever someone wants a construction time-lapse, a building process animation or a scroll-built hero.
---

# Build Hero

One pinned hero section. As the visitor scrolls, an AI film plays from the raw materials to the finished place while the
camera moves, with counters and captions keeping time. Then the same frame falls to dusk with every light off, and
the lights switch on in an order that suits the place. One flick of the wheel plays the whole thing by itself in 3 s.

Four example pages ship with it (`assets/examples/README.md`): **Tidelight** (a tower), **Misura** (a kitchen), **Kebun**
(a pool and garden) and **Cerise** (a wedding dinner, as a time-lapse).

Why it is built this way (each was learned the hard way, so keep it):

- **One job per film segment.** Asked to build everything in one long take, the video model makes what's in the end
  picture appear early and slide into place: a sky garden rides up a tower from the ground, a flower runner creeps down a
  table, a crane sinks into a roof. Short segments between keyframes, each doing one job, fix this.
- **A real change of angle.** A film that only zooms out looks static. Start the camera somewhere truly different from
  where it ends: high above looking down, or low in a corner.
- **The base keeps its size.** The foundation in the first picture is exactly the size and place of what stands on it,
  or the building visibly shrinks as it goes up.
- **People make it believable indoors.** Things moving by themselves look forced. For rooms, make it a time-lapse: a
  crew as blurred streaks carry everything in.
- **Don't film what the model can't do.** It can't take a crane down or unfold a table without melting them. Let a crane
  climb out of the frame; start with the tables already standing.
- **No real places.** A real skyline in the wrong arrangement looks fake at once. Describe the kind of place and say "no
  famous landmarks, no recognisable skyline".
- **The title reads first**, the auto-play takes about 3 s, captions are about five words, nothing holds still between
  stages, and words stay sharp (a soft shade behind them, no filters on them).

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what gets built and who it's for | what the user said (e.g. `/build-hero a launch page for a riverside condo` in Claude Code, `$build-hero …` in Codex, or "make a build hero for …"); otherwise ask one short question |
| Skillsmart credits | pictures and film | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3 | tools, scaffolder | `node -v`, `python3 -V`; macOS `brew install node python` |
| ffmpeg | cuts the film into frames | `brew install ffmpeg` (macOS), `winget install ffmpeg` (Windows) |
| Chrome or Edge | `check.mjs` and `video.mjs` drive it headless | if there is none, check by hand (Step 7) |

**Cost in credits:** a picture is 20, a second of film 15. A typical page, with two takes where it matters, is about
**550 credits**: about 180 for pictures and 370 for 12 seconds of film. `node pictures.mjs <id> --cost` and
`node film.mjs <id> --cost` print exact figures. Tell the user before each paid step. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped up,
run the same step again (everything already made is kept). If the user wants to use their own fal.ai key instead, prefix
the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on the page (one short message, then go)

Decide, and say in a few lines what you chose:

- **What is built, and its stages**, in the order they really happen. Three to six stages. Ask yourself what reads at a
  glance from where the camera is.
- **The camera's move**: where it starts and where it ends. Exteriors usually start high looking down, or low and far
  round the side. Interiors start in a corner or under the ceiling.
- **Exterior or time-lapse.** A building can grow by itself as in a construction time-lapse. A room needs a crew.
- **The place**, generic and believable, in one sentence.
- **The evening**: which lights, and the order they come on (`rise`, `fall`, `sweep`, `sweep-left`, `radial` from a
  point, `scatter`; a gentle `flicker` for candles).
- **The look**: `plain` (the default starter) or the closest example, one display font and one body font, a palette and
  one signature readout that belongs to this business: a floor ruler for a tower, a working drawing for a kitchen,
  depth tiles for a pool, a pen line for a table. Never reuse an example's look as it is.

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from plain
cd <project-dir>/tools && npm install
```

This creates `site/engine/` (shared), `site/<id>/` (the page), `tools/` and `tools/scenes/<id>.json` (the prompts). `<id>`
is a short lowercase name; `<project-dir>` is `./build-<id>` unless the user named one. The examples' prompts land in
`tools/scenes/_tidelight.json` and so on: read the one closest to your brief before writing. Every slot to fill starts with `WRITE`.

## Step 2 — The pictures

`references/films.md` has the whole method, with the prompts that worked and the failures they prevent. Read it first.

In `tools/scenes/<id>.json` → `shots`, from `tools/`:

1. **`end`, the finished place**, from the camera's last position. Everything depends on it, so be demanding.
   `node pictures.mjs <id> end --n 2`, look at the takes with `node sheet.mjs out/<id>/end-take1.png out/<id>/end-take2.png --out out/<id>/takes.jpg`,
   then `--keep`.
2. **`staged`**, the same frame before the build. Check the foundation really matches what stands on it.
3. **`start`**, `staged` re-shot from the camera's first position. Look at it: the model sometimes barely moves the camera.
   If so, describe the new position more bluntly, or more extremely.
4. **Keyframes**, one between each pair of segments: edits of `end`, each with what stands at that moment. A `crop` makes
   one a tighter framing, so the camera pulls back from segment to segment; a `paste` makes one match another exactly
   except in one rectangle.

`node pictures.mjs <id> --cost`, tell the user, then make them. Show the user `end` and `start` before spending on film.

## Step 3 — The film

`film.segments` in the scene file: each has a `start`, an `end`, a `duration` (3–15 s; 4–5 is usual) and a prompt for its one job.

```bash
node film.mjs <id> --cost
node film.mjs <id> first --n 2       # run it in the background: a take takes several minutes
node film.mjs --strip out/<id>/film-first-take1.mp4 --n 30     # look at every take, closely
node film.mjs <id> --join first:2,second:1
node film.mjs --strip out/<id>/film.mp4 --n 40
```

Look through each take for what `references/films.md` lists: things growing by themselves, shapes melting, a base that
changes size. If a keyframe disagrees with the next one (a floor count, a chair stack in another place), fix the keyframe
rather than re-rolling: the film will morph between them whatever you ask. Show the user the joined film's sheet.

## Step 4 — The frames and the evening

```bash
node frames.mjs <id>                      # frames/, frames-phone/, out/<id>/film-last.png
node pictures.mjs <id> dusk lit           # 40 credits
node align.mjs <id> dusk lit              # fits them to the film's last frame
node frames.mjs <id> stills
```

Look at dusk: every light must really be off, or part of the lights-on moment is lost; redo it with `--fix` if a lamp is
lit. A stopped scroll blends two neighbouring frames, so frames far apart during fast motion show a double image: add
frames where the camera moves fast (`pick` or `retime` under `frames` in the scene file; see the top of `frames.mjs`).

## Step 5 — The page

`site/<id>/index.html`, `style.css`, `main.js` (`references/page.md` has every hook). Write the words: all slots marked
`WRITE`, and for an example page every word, number and place of the example. Then time them: find where each stage starts in
the film (the sheet's times, or `?p=0.4` in the address), as `p = film start + film share × film length` (with the
default `film: [0.04, 0.74]`, a stage 40% into the film starts at p 0.32), and set `data-ch-step`, `data-ch-in` and
`data-ch-count`. Readouts must agree with what shows at that moment. Add the signature readout and a short section or two below.

## Step 6 — Check

```bash
node check.mjs <id>     # → out/<id>/check-desktop.jpg, check-phone.jpg, and the auto-play's length
```

Fix everything it lists, then read both sheets yourself:

- The title reads on the first screen, on desktop and phone, with nothing still behind it.
- The camera truly changes angle. The building's base doesn't shrink. Nothing melts or flies.
- Captions and counters match what the film shows at each point.
- The evening lines up with the film (no jump at the hand-over); dusk has no lights on; the lights come on in the order you chose.
- On a phone the subject stays in the frame (`phone.focus` in `main.js`: `[film time, x, y]`).

## Step 7 — Hand over

Without a browser or Chrome: `python3 tools/serve.py`, give the user http://localhost:5190/<id>/ and the checklist
above, and fix what they report. Offer a video (`node video.mjs <id>`, or `--size 540x960 --scale 2` for vertical). Tell
the user what they should replace: every picture and film is AI-generated, so a real project's approved visuals, prices
and facts must be checked. `site/` is a static site: host it anywhere.

Problems: `references/troubleshooting.md`.
