---
name: turntable
description: Build a website where each subject turns on the spot as you scroll. A gallery comes first; click a subject and its page opens, words on the left and the subject on the right. Every scroll is one whole eased turn to the next page, and the line between two pages is where one subject turns into the next. The subjects (sculpture, dishes, products, shoes, a model in several looks) are filmed turning 360° from one photo through Skillsmart credits, then cut out. Four example sites ship with it: an art gallery, a restaurant, a fashion lookbook and a sneaker drop. Use for a 360° product page, a turntable or "scroll to spin" showcase, a collection, lookbook, menu or exhibition page.
---

# Turntable

A website whose subjects turn on the spot:
- **The gallery.** One screen with every subject: in a row, on a turning ring, in a line-up or in tiles. Click one and it flies to its page.
- **The pages.** One per subject, each in a colour of its own: words on the left, the subject on the right. The subject never moves on screen.
- **The turn.** Each scroll, swipe or key press is one whole eased turn (about a second) to the next page. The subject turns all the way round while the line between the two pages sweeps across it, so it becomes the next subject in the same spot.
- **The rest.** Drag the subject to turn it by hand. A page count, a way back to the gallery, and an ending with one call to action.

Four example sites ship with it (`assets/examples/README.md`, live on demos.skillsmart.io/turntable):
- **In the Round**, an art gallery: six sculptures on fluted plinths, plaster rooms, a straight line between pages.
- **Lacquer**, a restaurant: six dishes on a turning ring, a lacquer table, a round line with a gold rim.
- **SIP CLUB**, a fashion label: one model in five drink-coloured looks, receipts and swatches behind her, a torn-paper line. She turns in grey and pops into colour as she faces you.
- **Torque**, a sneaker drop: colour tiles, a slanted line, giant names, flick to spin.

Why it is built this way. Each point was learned the hard way, so keep it:

- **One photo, one turn.** Each subject is a photo, then a 10-second film that starts and ends on that same photo, so it makes exactly one full turn. All 30 films made for the examples turned all the way round. A person holds her pose, frozen, while a hidden turntable turns her. A jump is a bullet-time orbit with her frozen in the air.
- **The line is the swap.** Every page has its own fixed copy of the stage, clipped by the page's shape. While the line crosses the subject, the part below it already shows the next subject and the part above it still the current one, at the same angle. No crossfade, no flash: a clean cut.
- **It snaps; it never rests halfway.** One gesture is one whole turn. A trackpad's fading momentum never starts a second one: only a push that speeds up, or one after a pause, does. The scrollbar and find-in-page land on the nearest page.
- **Even turns.** The films slow down as the subject comes round to the front. `frames.mjs` measures how much each frame changes, and the engine spreads the turn by that, so it turns evenly and settles facing you.
- **One stage for every subject.** `frames.mjs` puts every subject on the same axis, ground line and size. Standing things rest by the front view's lowest point (a square base dips lower at 45°). People share one scale, so a raised arm or a jump never shrinks anyone.
- **Plates are found, not hoped for.** The cut-out keeps the food but treats a white plate as background, on any backdrop. For dishes, a second pass (SAM 3 on the turn) finds the plate in every frame and puts it back, solid.
- **The turn must show.** A plain round vase looks the same from every side, so its turn can't be seen. Give each subject something that shows it turning: a handle, a spout, a pattern, a detail on one side.
- **The title reads first.** It owns the gallery's first look. Subjects sit beside or below it, never on it.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what the page is for, the subjects, what visitors should do | what the user said (`/turntable our five new sneakers, each in its own colour` in Claude Code, `$turntable …` in Codex, or "make a turntable page for …"); otherwise ask one short question |
| Skillsmart credits | the photos, the turning films and the cut-outs | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3, ffmpeg | the tools, the scaffolder, a local server, frames out of the films | `node -v`, `python3 -V`, `ffmpeg -version`; macOS `brew install node python ffmpeg` |
| Chrome or Edge | `check.mjs` drives it headless | if there is none, check by hand (Step 5) |

**Cost in credits:** a subject is about **138**: its photo 20, its 10-second turn 110 (11 a second) and its cut-out 8. A dish adds 8 for its plate. A five-subject page is about 690. The user's own photo saves the 20. A prop such as a plinth is 22. `node subjects.mjs <id> --dry` prints the exact figure. Tell the user before each paid step. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message. When they say they've topped up, run the same step again; everything already made is kept. If the user wants to use their own fal.ai key instead, prefix the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file). No credits are used then.

## Step 0: Agree on the page (one short message, then go)

From the brief, decide and say in a few lines:

1. **The subjects:** 3–6 of one kind, each a single thing with a clear silhouette that is worth seeing from every side. Use the user's photos where they have them (front view, whole subject, plain background).
2. **The kind**, which sets the photo, the turn and the stage (`references/subjects.md`):
   - a standing object (sculpture, vase, lamp, bottle);
   - a dish;
   - a floating product (a shoe, a bag);
   - a person (one model in several looks).
3. **The look** (`references/design.md`): the gallery's layout, the line between pages, how a page opens, each page's colour from its subject, and what stands behind the subject. Start from the closest example.
4. **The words:** a title, a name and a line for each subject, a few facts, and the one action at the end.

Ask only what you can't decide (usually nothing beyond the subjects). Make every brand, name, price and date up unless the user gives them.

## Step 1: Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from starter
```

- `--from starter` is a three-subject page with words to WRITE: a row gallery and a straight line between pages.
- `--from in-the-round|lacquer|sip-club|torque` copies an example page's code (not its frames). Use one when its layout suits the brief, then replace every word, colour and subject.

You get:
- `site/engine/` (`turntable.js`, `frames.js`, `turntable.css`);
- `site/<id>/` (`index.html`, `style.css`);
- `tools/`;
- `tools/subjects/<id>.json`, plus every example's subjects as `tools/subjects/_<name>.json` to learn from.

Then `cd <project-dir>/tools && npm install` (only `sharp`).

## Step 2: The subjects

Write `tools/subjects/<id>.json`. `references/subjects.md` has the prompts that worked for each kind; the examples' own files are beside it.
- `aspect`: the photo's shape. `9:16` for tall things and people, `16:9` for dishes and shoes, `3:4` for most products.
- `shot`: the photo prompt, with `{subject}` where each subject's prompt goes. Front view, centred, about 60% of the frame with generous space all round, a plain seamless backdrop that contrasts with the subject, soft light, no props, no text.
- `turn`: the turntable prompt. One full turn at a steady speed, always the same way, ending exactly as it started; the camera locked off; the subject keeps its exact shape. A subject that needs its own (what its back looks like, a jump) names one from `turns`.
- `cut`: `heavy` for objects and shoes, `matting` for people and food.
- `stage`: where every subject stands, in its own pixels (copy the kind's stage from `references/subjects.md`).
- One entry per subject: an `id` (the page uses it), and a `prompt` (what it is: shape, material, colours), or a `photo`, or `from` another subject with an edit prompt (the same model in a new look).

```bash
node subjects.mjs <id> --dry      # tell the user: "N subjects, X credits"
node subjects.mjs <id>            # about five minutes, three at a time
```

Look at `tools/out/<id>/<name>-sheet.jpg` (eight moments of each film) and `<name>-cut.jpg` (eight cut-out frames on blue and red). Check that:
- each film turns once, all the way round, and the subject keeps its shape;
- the back makes sense;
- the edges are clean and nothing is missing (a plate's rim, a handle).

Redo one with `node subjects.mjs <id> <name> --redo turn --fix "…"` (or `--redo photo`); the fix is a sentence added to that prompt. Then:

```bash
node frames.mjs <id>
```

It puts every subject on one stage, writes `site/<id>/frames/<name>/` and prints each subject's size. A subject too wide or tall for the stage is shrunk to fit, with a warning (widen the stage for wide things like teapots and chairs). A subject that turns the other way from the rest is reversed for you; `"reverse": true` or `false` decides it yourself. Nudge one subject's size with `"scale"`.

A plinth, stand or turntable top for the stage or the gallery: put it in `props` and run `node prop.mjs <id> <name>` (22 credits). Dishes: set `"plate": "plate"` (or `"bowl"`) on the page or on a subject, and `subjects.mjs` puts the plate back by itself (8 credits). To try another word for one dish: `node plate.mjs <id> <name> --keep "platter"`.

## Step 3: The page

Edit `site/<id>/index.html` and `style.css`:
- one gallery `.item` and one `.page` per subject, with the same ids in the same order (and the count, `01 / 05`);
- every WRITE replaced;
- each page's `--page` colour taken from its subject, and `--deep`, a step darker, for big type behind it;
- `start({ line, flood, gallery, … })`: the options are in `references/engine.md`, the choices in `references/design.md`;
- `--stage-cx`, `--stage-cy` and `--stage-h`, so the subject stands right of the words with room round it;
- the brand's fonts (two faces), one call to action at the end, and the phone layout (the starter has one).

## Step 4: Look at it

```bash
node check.mjs <id>
```

It uses the page the way a visitor would, at 1440 × 900: a click on the first subject, one wheel notch and one key press (each must land exactly one page on), and Escape back to the gallery. Then it draws the page's recording script on a contact sheet, on desktop and on a phone: `tools/out/<id>/check-desktop.jpg` and `check-phone.jpg`. It fails on page errors, missing frames, words still to WRITE, gallery items that don't match the pages, text under 11 px, sideways scrolling, and a scroll that doesn't land on the next page. **Read both sheets** and check:

- [ ] The title reads on the first screen, and the gallery shows every subject clearly.
- [ ] At rest each subject faces you, as big as the others and on the same ground (or on its plinth's top face).
- [ ] At "turn 50%" the line crosses the subject: the next subject below it and this one above, at the same angle, with no gap or jump.
- [ ] The words sit left of the subject, never on it. On the phone the subject is in the top half and the words at the bottom.
- [ ] Every page has a colour of its own, and the line between pages is easy to see.

Fix with the table in `references/troubleshooting.md` and run it again.

## Step 5: Hand it over

Serve the page with `python3 tools/serve.py` and give the user `http://localhost:5207/<id>/`. Tell them:
- what to try: click a subject, scroll once, drag the subject, press Esc;
- what it cost;
- how to swap a subject: change it in the subjects file, then `node subjects.mjs <id> <name> --redo photo` and `node frames.mjs <id>`.

For a video of the page (the gallery, an opening, a few turns, the way back; it loops): `node video.mjs <id>` writes `tools/out/<id>/<id>.mp4`.

**No browser here?** Skip `check.mjs` and give the user the URL and the checklist above, then fix what they report.

The site is static: `site/` can be hosted anywhere. Each subject is about 3 MB of frames, loaded coarse to fine, the open subject first.
