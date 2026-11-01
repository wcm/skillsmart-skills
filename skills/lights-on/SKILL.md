---
name: lights-on
description: Build a website hero where one photographed place goes from day to night as real light — the sun drains toward the window, then each lamp, neon sign or candle comes on by itself and the page's words and colours follow. Nothing in the frame moves. Play it with a switch, by clicking an object, by choosing a material, or by scrolling through the day. Pictures are generated with Skillsmart credits. Use for cafés that become bars, hotels, restaurants, lighting and curtain shops, neon, shopfronts and any day/night, lights on/off or before/after-dark hero.
---

# Lights On

A hero built on one photograph seen in two lights. By day the place is calm and looks good with everything switched
off. Then the sun leaves, a beat of blue, and the lights come on one by one until it has a totally different mood. It
reads as a real room changing, because every picture is the same frame and the light is added the way light adds.

Four example pages ship with it (`assets/examples/`), one per way to play it:

| Example | Business | The interaction | Choose it when |
|---|---|---|---|
| `noble-gas` | neon and light boxes | one switch, or click the sign | one thing glows: a sign, a product, a display |
| `lueur` | a lighting shop | click a lamp: the evening falls, only that lamp lights, its card opens; a master switch lights all | several objects worth selling or naming |
| `pli` | made-to-measure curtains | pick a fabric, then Morning · Night; a loupe on the weave | a material changes what the light does: blinds, glass, paint, fabric |
| `deux-temps` | a café that becomes a jazz bar | scroll is the clock, 07:30 to 23:00; optional room sound | a place with two lives: a venue, a hotel, a street |

Why it is built this way (each was learned the hard way, so keep it):

- **It must read as real light, never a picture swap.** Ambient goes first, sources second, the interface last. No
  crossfade between two photos; the engine does this for you as long as the pictures line up.
- **Good by day, wow at night.** The day photo has to stand on its own: objects beautiful while off, a place you'd want
  to be in. Show a total change of mood at night, not just a darker picture.
- **Soft light reads as real.** Hard sun, dappled shadows and heavy contrast look staged in a generated interior. For a
  calm day use hazy or overcast light with soft shadows.
- **Nothing moves.** People and things stay put between shots unless the story needs a new crowd (`deux-temps`); then
  expect them to fade in with the dusk.
- **Subtle, elegant interactions.** A small switch, a click on the object, a scroll. Quiet controls; the room is the show.
- **The title reads first,** on calm wall or page, by day and by night. Words turn light only once what's behind them
  has gone dark, side by side with the room.
- **A believable place, not a famous one.** Describe the kind of place and add "no famous landmarks"; a real skyline
  in the wrong spot looks fake at once.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the place, and what changes at night | what the user said (e.g. `/lights-on a bakery that turns into a wine bar` in Claude Code, `$lights-on …` in Codex, or "make a day and night hero for …"); otherwise ask one short question |
| Skillsmart credits | the pictures | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3 | tools, scaffolder, measuring | `node -v`, `python3 -V`; macOS `brew install node python` |
| OpenCV, NumPy | line the pictures up and measure each light | `python3 -m venv .venv && .venv/bin/pip install opencv-python-headless numpy` in `tools/` |
| Chrome or Edge | `check.mjs` and `video.mjs` drive it headless | if there is none, check by hand (Step 5) |
| ffmpeg | only for `video.mjs` | `brew install ffmpeg` |

Cost in credits: **40 a picture at 4K** (`--res 2K`: 20, softer). A room needs a day photo (three takes are worth it),
a night, a dark and one photo per light: **about 320 for three lights**. `node shots.mjs <id> --cost` prints the exact
figure. Tell the user before you generate. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped
up, run the same step again (everything already made is kept). If the user wants to use their own fal.ai key instead,
prefix the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on the page (one short message, then go)

Decide, and say in a few lines what you chose: **the place** (what it looks like by day, what changes at night), **the
example to start from** (table above), **the lights** (two to six, each a thing you can point at), **the type and
colours**, and **the words** for day and night. Keep to one room and one camera position.

## Step 1 — Scaffold, and write the scene

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from noble-gas
cd <project-dir>/tools && npm install
python3 -m venv .venv && .venv/bin/pip install opencv-python-headless numpy
```

`<id>` is a short lowercase name for the page, and `<project-dir>` is `./lights-<id>` unless the user named one. Add
`--examples` to copy the example as it is, with its pictures (to show the user).

Rewrite `tools/scenes/<id>.json` for the new place (`references/pictures.md`): `solos` lists the lights in order (the
page's `lights` must match), and `shots` holds the prompts: `day` from nothing, `night` from `day`, `dark` from `night`,
one `solo-<light>` from `dark` per light. Keep the example's sentences that hold the frame still.

## Step 2 — The pictures

```bash
node shots.mjs <id> --cost            # tell the user
node shots.mjs <id> day --n 3         # three takes: tools/out/<id>/day-take1.png …
node shots.mjs <id> day --keep 2      # look at them yourself, keep the best
node shots.mjs <id>                   # the night, dark and each light, in order (run it in the background)
.venv/bin/python prep.py <id>         # line up, measure each light, write site/<id>/img/
```

Everything hangs on the day photo: judge it hard, and redo it rather than settle. Look at every shot before moving on.
Redo one with `node shots.mjs <id> night --force --fix "one sentence"` (the old one stays as `night.bak-1.png`); redoing
a shot means redoing what was made from it. `prep.py` prints how far each shot had to move to fit; under about 20 px on
a 5504 px picture is normal, and a shot left unfitted must be made again.

## Step 3 — The page

Rewrite `site/<id>/index.html` (words, fonts, alt text), `style.css` (colours, layout, where the title sits) and
`main.js` (the page's own data: names, prices, hotspots). `references/page.md` has the engine's options and calls. Take
hotspot positions from `site/<id>/img/scene.json`, which holds each light's measured centre. Keep the example's
interaction unless the brief needs another: they are short, and tested on phones.

## Step 4 — Sound (optional, only if the user brings it)

`engine/sound.js` crossfades a day loop and a night loop with the light, silent until the visitor clicks. The user
supplies the two files in `site/<id>/audio/`; the example `deux-temps` shows it. If there is no sound, remove its button.

## Step 5 — Check

```bash
node check.mjs <id>                   # → tools/out/<id>/check.jpg, and one line per check
```

It checks that no `WRITE` or example brand is left, that the shots line up and each has its light share, that everything
loads with a clean console, that the room darkens and each light adds light on its own, that it comes back to the day
photo, and that a phone gets no sideways scroll. Look at `check.jpg` (day, the sun leaving, blue hour, each light alone,
the night, a phone) and judge it against the rules at the top of this file: above all, ghosts or doubled edges, and text
you can't read. Then serve the page (`python3 serve.py`, then `http://localhost:5196/<id>/`) and try it in a visible
browser: `?night` opens on the night and `?t=0.5` holds the dusk. If you can't run a browser, start the server, give the
user the URL and the checks above as a list, ask them to try it, and fix what they report.
`references/troubleshooting.md` lists what has gone wrong before.

## Step 6 — A video (when the user wants one)

```bash
node video.mjs <id>                               # 1440 × 900 → tools/out/<id>/video-1440x900.mp4
node video.mjs <id> --size 540x960 --scale 2      # 1080 × 1920 for Reels and TikTok, laid out as on a phone
node video.mjs <id> --speed 1.5                   # quicker
```

## Step 7 — Hand over

Tell the user what you built (the interaction, the lights in order, the fonts), the credits spent, anything that didn't
come out right, and the knobs they'll want: the words (`index.html`, `main.js`), the colours (`style.css`), each light's
kind and the timing (`main.js`). The `site/` folder is a static site for any host; `site/index.html` opens the first
page. Masters and review sheets stay in `tools/out/` (keep it: nothing has to be paid for twice).

## Another page

Run the scaffolder again with a new id in the same project (`new_project.py <project-dir> <id2> --from …`): it adds
`site/<id2>/` and `tools/scenes/<id2>.json`.
