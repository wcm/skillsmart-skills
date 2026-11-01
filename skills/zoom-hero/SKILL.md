---
name: zoom-hero
description: Build a website hero you can dive into — one wide scene with spots to click, where the camera zooms into a tiny detail until it fills the screen, then closer still, and back out in one go. A hill becomes one grape becomes the wild yeast on its skin; a face becomes a drop of serum becomes a molecule. Every close-up is generated from a crop of the level above with Skillsmart credits so it lines up exactly. Use for deep zoom, infinite zoom or powers-of-ten pages, landing pages about craft, ingredients, materials, wildlife or science, and seek-and-find games — even if all you get is a business name.
---

# Zoom Hero

One big scene fills the screen. Click a spot and the camera dives into a tiny detail until it fills the screen; click again and it dives again. Every level is one 16:9 picture. Each close-up is made from an enlarged crop of the level above, and its exact place is measured, so the detail comes into focus with no jump.

Four example sites ship with it (`assets/examples/`): **Pruine** (natural wine: the hill → old vines → one grape's bloom → wild yeast), **Understory** (a rainforest trust: canopy → branch → glass frog → its eye), **Surface Theory** (skincare: face → cheek → a drop → skin cells → a molecule, on a light interface) and **Where's Pip?** (a picture book as a clue game: a riso harbour town → window → note → boat → lighthouse → Pip).

Why it is built this way (each was learned the hard way, so keep it):

- **The zoom must reveal the reason to buy.** Choose subjects where something you can't see from normal distance is the point: the yeast, the hand-polished screw, the frog on the leaf. A zoom into nothing in particular is a gimmick.
- **The title reads first.** The first level keeps a calm band (sky, mist, a plain wall) where the title sits, and no spot goes there.
- **One place, one light.** Every level looks like the same place, season and light as the one above it, down to the last.
- **Real material up close.** Texture, gloss, droplets, grain: the detail a real camera or microscope would find. One clear subject per level, prominent even at thumbnail size.
- **Spots stay clear of the interface.** The words, readouts and scale sit on every level, so each spot has to land where they leave free.
- **Calm motion.** Dives are eased, at rest the view only breathes; nothing spins or shakes. The visitor's own cursor stays, because a drawn one always lags; a ring opens on the spot it is over.
- **Short.** A main way down of 3 or 4 steps and 1 or 2 side ways, 6 to 9 levels in all, so the whole page plays in a 20-second video.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what the page is about and what is hidden in it | what the user said (e.g. `/zoom-hero a natural-wine estate` in Claude Code, `$zoom-hero …` in Codex, or "make a zoom hero for …"); otherwise ask one short question |
| Skillsmart credits | the pictures | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3 | tools, scaffolder | `node -v`, `python3 -V`; macOS `brew install node python` |
| Chrome or Edge | `check.mjs`, `shot.mjs`, `video.mjs` drive it headless | if there is none, check by hand (step 6) |
| ffmpeg | only for `video.mjs` | `brew install ffmpeg` |

Cost in credits: a picture is 20. **A page of 8 levels with two takes each is about 320 credits**; `node pictures.mjs <id> --takes 2 --cost` prints the figure for the levels still missing. A first level can be the user's own photo, free (`"image"` in the tree). Tell the user the cost before you generate. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped up, run the same step again (everything already made is kept). If the user wants to use their own fal.ai key instead, prefix the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on the dive (one short message, then go)

Decide, and say in a few lines what you chose:

- **What is hidden.** The one tiny thing the page exists to show, and the line it earns ("We add nothing"). The main way down leads to it.
- **The tree.** The wide scene, the main way down (3 or 4 steps, each level one clear subject that holds the next), and 1 or 2 side ways of 2 steps.
- **The ending.** What appears at the bottom of the main way: a product, a booking, a donation, a found character.
- **The example to start from**, by the feel the brief wants:
  - `pruine`: warm and editorial, dark glass on a photograph, a giant serif name (food, drink, craft, places)
  - `understory`: quiet, scientific, field notes, thin wide type veiled in mist (nature, travel, research, causes)
  - `surface-theory`: light and clinical, measurements on the picture, a frosted interface (beauty, health, science, technology)
  - `wheres-pip`: an illustrated print, sticker chips, a game with clues that unlock spots (children, games, cities, culture)

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from pruine --brand "Maison Vale"
cd <project-dir>/tools && npm install
```

`<id>` is a short lowercase name for the page. Add `--examples` to copy an example as it is, to look at it. Nothing is generated and no credits are spent. Serve the site any time with `python3 tools/serve.py`.

## Step 2 — Write the tree

Rewrite `tools/trees/<id>.json`: every `WRITE`, and the levels' names as your story needs (`references/pictures.md`). The first level comes first in the file, and the first child of a level is its main way down.

## Step 3 — Make the pictures, parents first

Follow `references/pictures.md`; in short, from `tools/`:

```bash
node pictures.mjs <id> <first-level> --takes 3      # 60 credits
node takes.mjs <id> <first-level>                   # look at the sheet (a .jpg), choose
node pictures.mjs <id> <first-level> --keep 2
node look.mjs <id> <first-level>                    # a grid: choose each child's rect, write it in the tree
node pictures.mjs <id> <child> --takes 2            # 40 credits
node takes.mjs <id> <child>                         # the crop beside the takes, each with its match (rho)
node pictures.mjs <id> <child> --keep 1             # also measures where it sits
```

Repeat down the tree. Look at every sheet, and be demanding: the pictures decide whether the page is any good. `node sheet.mjs <id>` shows the whole tree. Changing a parent means remaking every level under it, so get each level right before going deeper. Then:

```bash
node publish.mjs <id>                               # web pictures and img/levels.json into site/<id>/img/
```

## Step 4 — Write the page

`site/<id>/` holds three files from the example: `index.html` (brand, title, fonts, the first level's `lp-first` picture and its alt text), `style.css` (colours, type, layout) and `main.js` (`content`: every level's words, spot label and notes, by level id). Rewrite them for the subject; the guide is `references/page.md`. Pick a fashionable display face for the title and a plain one for the rest, one accent colour, and words in short plain sentences. Pin notes on real details you can see in the pictures. Drop what the example added for its own story (a shop card, calipers, a game) or rewrite it for yours.

## Step 5 — Check

```bash
node check.mjs <id>
```

It walks every level on a desktop and a phone screen, fails on errors, unwritten `WRITE`s and spots under the words or off the screen, and writes contact sheets (`out/<id>/check-desktop.jpg`, `check-phone.jpg`). Look at them: does the title read on the first screen, do the words read on every level (add a scrim where they don't), do notes and spots sit on real things? Then film a dive and look at the hand-over:

```bash
node shot.mjs <id> --film <child> 8 out/<id>/dive.jpg
```

## Step 6 — Without a browser

If no browser can be driven: start `python3 tools/serve.py`, give the user the address and this checklist, and fix what they report: the title reads; every spot can be clicked; each dive lands with no jump; the words read on every level; Esc and the breadcrumbs zoom back out; it works on a phone.

## Step 7 — Hand it over

Say where the page is (`site/<id>/`, a static folder to host anywhere, `site/engine/` included), how to run it, and what it cost. If they want a video: `node video.mjs <id>` (add `--size 540x960 --scale 2` for vertical, `--plan a,b,c,<first-level>` to choose the moves). `?tour` in the page's address plays the dives on its own.

## Reference

- `references/pictures.md`: the tree file, every tool, where spots may go, what good looks like, and what to do when a take misses
- `references/page.md`: the page's parts, the engine's `content` fields and events, each example's extras
- `references/troubleshooting.md`: when something looks wrong
- `assets/examples/README.md`: the four examples
