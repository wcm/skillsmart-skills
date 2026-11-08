---
name: particle-hero
description: Build a landing-page hero made of half a million particles — each subject (a product, an animal, a portrait, an object) is rebuilt in glowing dust or ink, the grains swarm or melt from one subject into the next, and they part like smoke under the cursor. Four looks (dust on black with trackers, ink on paper, neon with lights on the beat, a light one-colour print with callouts). Subjects are generated through Skillsmart credits, depth made locally. Use for a particle hero, particle animation, point-cloud or morphing hero, product range, collection, lineup or exhibition page.
---

# Particle Hero

A hero whose subjects are made of dust. Each subject is turned into hundreds of thousands of grains:
- **Where they go.** Grains pack where the picture is bright (or, on paper, dark) and along its edges. A depth map pushes them back, so the subject has relief and turns slightly toward the pointer.
- **Changing subject.** The grains are thrown out and gather into the next subject. A **swarm** goes through a cloud; a **melt** reshapes one shape into the next.
- **The hand.** The cursor carries nearby grains along, like a hand through smoke, and they drift home on their own.
- **The page.** Round it sit a title that reads first, a list to pick a subject, a line of words for each, and one call to action.

Four example pages ship with it (`assets/examples/README.md`, live on demos.skillsmart.io/particle-hero):
- **Fauna Borealis**, a museum exhibition: bone-white dust on black, trackers, wind.
- **Herbier**, a perfume house: ink on cream paper, plant → mist → bottle.
- **Afterglow**, a festival lineup: neon dust with lights on the beat, the name standing behind the dust.
- **Stride**, a sneaker range: a light orange print with callouts, each model melting into the next.

Why it is built this way. Each point was learned the hard way, so keep it:

- **A real simulation, not a tween.** Grains have momentum. A push settles back by itself, and a change can be interrupted at any moment without a jump. That is what makes the hover feel natural.
- **A drag, not a swirl.** The hand takes grains along its path and spreads them a little. Repulsion bubbles and swirls read as fake.
- **The next subject comes into focus.** Arriving grains land slightly out of focus, so the next subject appears first as a soft cloud of its own colours, then sharpens. A long shapeless cloud in the middle loses people: the pull home builds early.
- **Melts need matched grains.** Pairing grains by a space-filling curve looks blocky (rectangles, cracks). The engine pairs each grain with a near one in the next subject, worked out in the background. A melt only works between shapes of the same kind and pose; between different shapes use a swarm.
- **One ink never piles darker than itself.** On paper, `inkCap` keeps a one-colour print light. `levels` stretches each subject's own tones, so a black shoe keeps its seams instead of flattening into a blob.
- **The title reads first.** It gets its own band, and the subject sits beside it (`frame`). On the neon look the title can stand **behind** the dust instead.
- **Contrast inside the subject.** On black, light subjects with rim light read best. On white, dark products print best. Portraits cut off at the waist fade out (`fade`) instead of ending on a line.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what the page is for, the subjects, what visitors should do | what the user said (`/particle-hero our sneaker range, each model turning into the next` in Claude Code, `$particle-hero …` in Codex, or "make a particle hero for …"); otherwise ask one short question |
| Skillsmart credits | the subjects' pictures and cut-outs | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3 | the tools, the scaffolder, a local server | `node -v`, `python3 -V`; macOS `brew install node python` |
| Chrome or Edge | `check.mjs` drives it headless | if there is none, check by hand (Step 5) |

**Cost in credits:** a subject's picture is 20 and its cut-out 2, so a four-subject page is about **88 credits**. The user's own photos cost only the cut-out. Depth maps are made on this computer for free: the first run downloads a 27 MB model once. `node pictures.mjs <id> --dry` prints the exact figure. Tell the user before each paid step. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message. When they say they've topped up, run the same step again; everything already made is kept. If the user wants to use their own fal.ai key instead, prefix the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file). No credits are used then.

## Step 0: Agree on the page (one short message, then go)

From the brief, decide and say in a few lines:

1. **The subjects:** 3–5 of them, each a single thing that reads as a silhouette. Use the user's own photos where they have them (products, a logo); otherwise generate them.
2. **The look** (`references/looks.md`):
   - `dust`: heritage, nature, objects;
   - `ink`: luxury, natural, crafted;
   - `neon`: people, music, nightlife;
   - `print`: a range of products.

   Then the brand's colours on top.
3. **The change:**
   - swarm, for subjects that differ;
   - mist, a gentle swarm for calm brands;
   - melt, for one kind of thing in one pose, such as a range of shoes in side profile.
4. **The words:** the title, a line for each subject, and the one action at the end.

Ask only what you can't decide (usually nothing beyond the subjects). Make every brand, name and price up unless the user gives them.

## Step 1: Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from plain --look dust
```

- `--from plain` is a three-subject hero with words to WRITE, in the `--look` you pick.
- `--from fauna|herbier|afterglow|stride` copies an example page *with its pictures*, so it runs at once. Use one when its layout suits the brief, then replace everything.

You get:
- `site/engine/`;
- `site/<id>/` (`index.html`, `main.js`, `style.css`);
- `tools/`;
- `tools/pictures/<id>.json`, plus every example's subjects as `tools/pictures/_<name>.json` to learn from.

Then `cd <project-dir>/tools && npm install` (only `sharp`).

## Step 2: The subjects

Write `tools/pictures/<id>.json` (`references/pictures.md`):
- `background`: `black` for dust and neon, `white` for ink and print;
- `aspect`;
- a shared `style` sentence;
- one entry per subject: a `prompt` (the subject alone: what it is, its pose, what it's made of) or a `photo`.

For a melt, give every subject the same pose and direction.

```bash
node pictures.mjs <id> --dry      # tell the user: "N subjects, X credits"
node pictures.mjs <id>
```

Look at `tools/out/<id>/sheet.jpg`. Check that each subject is whole and inside the frame, the cut-out is clean (no shadow, no stand), and near parts are white in the depth. Redo a bad one with `node pictures.mjs <id> <name> --force --fix "…"`.

## Step 3: The page

Edit `site/<id>/main.js`:
- `subjects` (the ids from the list, names, lines) and `LOOK`;
- `frame`: where the subject sits. Keep the title's band clear.
- Any option over the look: the brand's colours, `travel`, `hold`, the hand. Options are in `references/engine.md`; choices are in `references/looks.md`.
- Per-picture options where needed: `fade` for portraits, `levels` for dark products.

Then `index.html` and `style.css`:
- every WRITE replaced;
- the brand's fonts (two faces);
- a list to pick a subject;
- one call to action;
- a phone layout (the starter has one).

For callouts (print) or trackers (dust), set `hudCanvas` and `hud` as the examples do.

## Step 4: Look at it

```bash
node check.mjs <id>
```

It opens the page headless at 1440 × 900 and on a phone. It writes `tools/out/<id>/check-desktop.jpg` and `check-phone.jpg`:
- the first subject formed;
- a change at four moments;
- a hand pushed through the subject;
- the settled result.

It fails on page errors, missing pictures, words still to WRITE, text under 10 px and sideways scrolling. **Read both sheets** and check:

- [ ] The title reads on the first screen. The subject sits beside it, never on it.
- [ ] Every subject is clearly itself: a readable silhouette, enough detail (not a flat blob), not burnt to white.
- [ ] A change goes through a short cloud (about a second) and the next subject sharpens. A melt keeps the shape's identity.
- [ ] The hand leaves a soft wake that settles.
- [ ] The phone layout has the title on top, the subject in the middle and the list at the bottom.

Fix with the table in `references/troubleshooting.md` and run it again.

## Step 5: Hand it over

Serve the page with `python3 tools/serve.py` and give the user `http://localhost:5206/<id>/`. Tell them:
- what to try: move the mouse through the subject, click the list;
- what it cost;
- how to swap a subject: edit the list, `node pictures.mjs <id> <name> --force`.

**No browser here?** Skip `check.mjs` and give the user the URL and the checklist above, then fix what they report.

The site is static: `site/` can be hosted anywhere.
