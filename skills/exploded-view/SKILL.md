---
name: exploded-view
description: Build a scroll page that takes a product apart — it lifts out of a real-looking photo, splits into labelled parts over a lab of floating data, then comes back together and lands at a new angle in a second place. The photos, the exploded view and both clips are generated (paid with Skillsmart credits) and lined up so every hand-off is invisible. Use for exploded views, teardowns, what's-inside or how-it's-made product pages and scroll-driven launch pages for food, gadgets, shoes, furniture or buildings — even if all you get is a product name.
---

# Exploded View

One scroll page in three scenes:

1. **The place.** A real-looking photo of the product where it belongs (a diner counter, a listening bar, a concrete
   ledge, a fjord), the product on the right, the brand's words on the left.
2. **Inside.** As the visitor scrolls, the product lifts out of the photo, the place blurs into a "lab" (an order
   ticket, a sound lab, a motion lab, an energy model), and the product comes apart in the middle while a label draws
   in for every part, beside a panel of numbers.
3. **The new place.** The parts fly back together while the product turns, and it lands whole in a second photo (a
   picnic table, a train seat, a neon street, the desert) on the left, the words now on the right.

Why it is built this way (each was learned the hard way, so keep it):

- **The real photo at rest.** When nothing moves the visitor sees the generated photo itself, with its real light and
  shadows. A cut-out pasted on a background looks fake. The cut-out only shows while the product moves, and it comes
  out of that same photo, so the swap can't be seen.
- **One stage, one transform.** The clips, the "studio" frames (the cut-out alone on a plain backdrop) and the
  exploded view share one 16:9 stage, and every picture of the product is drawn through one stage-to-screen
  transform, solved so the cut-out lands exactly on the product in each photo.
- **Generated, then cut out.** Edits that must replace a busy background fail half the time, so nothing is ever asked
  of a busy photo except removing the product. The exploded view and both clips are made from the clean studio frame.
- **Words, labels and data are HTML and SVG**, drawn in code over the pictures: crisp, editable, translatable.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the product and what the page is for | what the user said (e.g. `/exploded-view our walnut headphones` in Claude Code, `$exploded-view …` in Codex, or "make an exploded-view page for …"); otherwise ask one short question |
| Skillsmart credits | the photos, the exploded view, the clips and their cut-outs | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, ffmpeg, Python 3 | tools, frame extraction, scaffolder | `node -v`, `ffmpeg -version`, `python3 -V`; macOS `brew install node ffmpeg python` |
| Chrome or Edge | `check.mjs` drives it headless | if there is none, check by hand (Step 6) |

Cost in credits: an image is 20, a video 15 a second, a video cut-out 2 a second, an image cut-out or an object picked
out by name 2. A page is usually the **stills** (3 images and 5 cut-outs ≈ 70) and the **motion** (2 plates and two
5 s clips with their cut-outs ≈ 210): about **280 credits**, plus redos (a still 20, a clip 75, a detach 22).
`node build.mjs <id> --stills --cost` (or `--motion --cost`) prints the exact figure. Tell the user before the
stills and again before the motion. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped
up, run the same step again (everything already made is kept). If the user wants to use their own fal.ai key instead,
prefix the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on the page (one short message, then go)

Decide, and say in a few lines what you chose (`references/subjects.md` has the method and the scored examples):

- **The product**, made up or the user's own (real brands only when they are the user's). It must come apart into
  5–10 big, different-looking parts. Tiny repeated parts (keyboard keys), text on parts, thin wires and liquids go
  wrong.
- **Two places**, each a real, photogenic setting, and one clear change between them: night to day, at rest to on the
  move, the same thing in an opposite world, where it's made to where it's used. In both, the product **rests directly
  on a surface**: no stand, hook, tray or stove under it and no reflection of it, or the cut-out takes them along.
- **How it comes apart**: straight up (a stack), sideways in a mirror (two halves), up and down from the middle (a
  burst), or an architect's exploded drawing. And its parts, in order.
- **The lab** and the reference page to start from: `burger` (ticket: food and drink), `headphones` (sound: audio and
  tech), `sneaker` (motion: sport and anything worn), `cabin` (energy: buildings, appliances, vehicles), `moka` (ticket again,
  for drinks and kitchen things).
- **Type and colours**: one fashionable display face and a mono for data, a palette per place, the backdrop colour
  (`references/page.md` lists the five reference looks).

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from headphones --brand "Kissa" --noun "headphones" \
  [--backdrop "#e9e5de" --backdrop-name "pale warm grey"]
cd <project-dir>/tools && npm install
```

This creates `site/engine/` (the engine), `site/<id>/` (the page: `index.html` and `page.json`, copied from the
reference page), and `tools/` (`subjects.json`, `build.mjs`, `anchors.mjs`, `check.mjs`, `gen.mjs`). `<id>` is a
short lowercase name for the page, and `<project-dir>` is `./exploded-<id>` unless the user named one. The backdrop is
the plain colour the product is cut out on and the lab's background: dark for a light product, light for a dark one.

## Step 2 — Write the prompts

In `tools/subjects.json` → `subjects` → `<id>`, write the slots that start with `WRITE:` (`references/prompts.md`
explains each one with the five reference entries; `_example` beside them is the reference page's own):

- `place1`: the product in its first place, on the right of the frame, the left half calm for the headline.
- `place2`: the same product whole again in the second place, on the left, **at a clearly different angle**. Say the
  new camera position and what it now shows ("high above, looking steeply down at about 60 degrees, so we see the top
  of the lid"); a change of pose (lying on its side, tilted, toe first) is more reliable than an angle alone.
- `exploded`: how it comes apart and every part in order, and how much of the frame the assembly fills.
- `remove1`, `remove2`: the product taken out of each place, saying what stays.
- `explode`, `rebuild`: one motion each for the clips. One action, described plainly; no negations in them.
- `find` (optional): the common word SAM 3 knows the product by ("coffee pot" for a moka pot), when `noun` is unusual.

Leave the shared lines at the top of the file alone: each prevents a failure we saw.

## Step 3 — The stills (about 70 credits)

```bash
node build.mjs <id> --stills          # → tools/out/<id>/stills.jpg
```

`stills.jpg` shows the three pictures (first place, exploded view, second place) and, below them, their cut-outs on a
checkerboard. Look at it yourself first, then show the user. A good set: the product is the same object in all three;
the second place is at a clearly different angle; the exploded view is clean, its parts apart and level, nothing
invented or text on it; the cut-outs hold only the product, whole, with no stand, stove, tray, reflection or specks.

To fix:
- a picture: `node build.mjs <id> --only place2 --fix "one sentence"`, or rewrite its prompt and run `--stills` again
  (everything made from it is remade; earlier versions are kept as `*.bak-N.png`). To compare first photos, run
  `--takes 3 --only place1` (60 credits) and `--pick <n> --stills`.
- a cut-out: climb the ladder in `references/cut-outs.md`: another word in `find`, then `detach1`/`detach2` naming
  what clings ("the stove grate under it", 22 credits), with `patch1` polygons when the thing sits in front of the
  product (a stand's cradle under a headband), then `erase1`/`erase2` polygons (free). Redo with `--only cut1` (or
  `cut2`). Anything of the place left in `cut1` ends up in the studio frame, so the clips grow it into a part: fix it
  now.

Don't start the motion until the stills are right: the clips are made from them.

## Step 4 — The motion (about 210 credits)

```bash
node build.mjs <id> --motion          # minutes: run it in the background → out/<id>/frames-a.jpg, frames-b.jpg
```

It makes the two empty places (plates), the two Kling clips (studio 1 → exploded, exploded → studio 2), cuts both clips
out frame by frame, and writes the page's files: `site/<id>/img/`, `site/<id>/frames/` and `site/<id>/layout.json`.
`frames-a.jpg` and `frames-b.jpg` show six moments of each clip on a checkerboard: the parts should separate in order
and come back together without melting, extra parts or the backdrop showing. If a clip is wrong, make two takes and let
the user choose: `node build.mjs <id> --takes 2 --only clips` (300 credits), then `--pick a2,b1 --motion`. When only
one clip is wrong, redo just that one: `--only clips,mattes,frames,web --clip a` (or `b`). Small drops
or crumbs that come and go between frames flash on the page: set `"specks": 0.03` and redo `--only cutx,frames,web`
(free). A part the product doesn't have: `dropx` (references/cut-outs.md), then redo the clips.

## Step 5 — The page

- **Words and data** in `site/<id>/page.json` (`references/page.md`): brand, nav, the three scenes' copy, the
  parts' names and specs, and the lab's numbers (`steps` adds a scene rail at the bottom left, if the user wants one).
  Keep the words short and concrete; invented numbers must be plausible and labelled as examples when the product isn't
  real.
- **Label dots**: run `node anchors.mjs <id> --grid` and look at `out/<id>/anchors.png` with its grid: set each part's
  `at` to `[u, v]` (u across, v down, 0–1) on the part, at the edge that faces its label, and its `side`. Then run
  `node anchors.mjs <id>` and check every dot sits on its part. The lab's own points (`drivers`, `flow`) work the same way.
- **The look** in `site/<id>/index.html`: fonts from Google Fonts and the colours as custom properties
  (`references/page.md`). Keep `--lab-bg` the same as the backdrop, so the cut-outs' soft edges disappear.
- **The lab** (`references/labs.md`): keep the reference page's lab or switch to another (`page.json` → `lab.style`)
  and fill in its data. Panels sit in the left column and labels on the right, so they never collide.

## Step 6 — Check

```bash
node check.mjs <id>                   # → out/<id>/check.jpg, and one line per check
```

It serves `site/` and, in a headless browser: waits for every frame, checks that the cut-out lands exactly on the
product in both photos (the hand-offs), that every label is on screen and none overlaps another, that a phone gets no
sideways scroll and a legend instead of labels, that reduced motion still scrubs, and that the console is clean. Look
at `check.jpg` (six desktop moments and three on a phone). Then open the page in a visible browser
(`python3 -m http.server 5190 -d site`, then `http://localhost:5190/<id>/`) and scroll it yourself. A hidden tab or
background pane throttles animation frames, so it lags; `explode.seek(0.5)` in the console jumps straight to a moment
(0 is the start, 1 the end). If you can't run a browser, start the server, give the user the URL and the checks above as
a list, ask them to scroll it (a screenshot helps), and fix what they report. `references/troubleshooting.md` lists
what has gone wrong before.

## Step 7 — Hand over

Tell the user what you built (product, places, lab, fonts), the credits spent, anything that didn't come out right,
and the knobs they'll want: the words and numbers (`page.json`), the colours and fonts (`index.html`), where the
exploded product sits (`page.json` → `stage`), the labels' side, and the pace (`T` at the top of `site/engine/explode.js`:
fractions of the scroll). The `site/` folder is a static site for any host. Masters, masks, raw clips and review sheets
stay in `tools/out/` (keep it: any step can be redone without paying for the earlier ones).

## Another product or page

Run the scaffolder again with a new id in the same project (`new_project.py <project-dir> <id2> --from …`): it adds
`site/<id2>/` and a new entry in `subjects.json`, and `site/index.html` keeps opening the first page.
