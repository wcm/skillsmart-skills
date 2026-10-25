---
name: scroll-gallery
description: Build a gallery page where the pictures fly from one 3D scene into the next as you scroll — prints dealt on a table rise into a runway of silk panels, glazed tiles fold like a map into a lookbook, records file into a walnut crate and spin on a jukebox, landscapes roll on an arc and you dive into a sphere of them. Click a picture to bring it forward with its details; an index jumps to any of them. Pictures are the user's own or generated with Skillsmart credits. Use for portfolios, lookbooks, collections, catalogues, album or product galleries and showcase pages — even if all you get is a theme.
---

# Scroll Gallery

A gallery page in about four scenes. Each scene lays the pictures out in one shape — a table of prints, a ring, a
deck, a ball, a book, a mosaic — and as the visitor scrolls, the pictures fly out of one shape into the next. The
pictures are real objects in one studio light: photo paper with a white edge, record sleeves, thick acrylic with a
glowing rim, glazed tiles, silk that hangs and sways. Clicking a picture brings it forward with its words beside it;
Index lists every picture and brings any of them into view in whatever scene is showing.

Four example galleries ship with it (`assets/examples/`): **Ardent** (a fashion lookbook: table → runway of silk panels
→ tiles → lookbook), **Side B** (a record shop: slabs → crate → turntable → jukebox), **Far Field** (landscape
photographs: trail → arc → band → sphere) and **Kit of Parts** (design assets: board on threads → sweep → acrylic
ribbon → glass cube).

Why it is built this way (each was learned the hard way, so keep it):

- **The title reads first.** On the first screen the pictures sit around the page's title, never on it: they may
  cross it only a little, or while they move. `check.mjs` measures it.
- **Only the picture in focus is big.** The others are smaller and have air around them. A screen full of big
  pictures has no point of focus and hides the scenery.
- **Real material and light, not flat planes.** Thickness, gloss, grain, an edge, cloth: every card is a slab lit by
  the same soft studio, only real glints bloom, and a fine film grain covers the frame. Pick the material that suits
  the pictures (`references/materials.md`).
- **Gentle motion.** Slow drift and soft easing; nothing spins fast, shakes or swirls. Scroll drives the scenes; time
  only adds a slow breath.
- **One page, one feeling.** The scenes differ in shape and colour but share type, material and pace. Each scene
  is a different look, so the page keeps surprising.
- **Bold, with few words.** A big title in a fashionable face, one strong colour per scene, the words only in the
  four corners; the pictures and how they move are the show.
- **Short.** About eight screens of scroll, so the whole page plays in a 25-second video.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what the gallery shows and who it's for | what the user said (e.g. `/scroll-gallery a lookbook for our autumn collection` in Claude Code, `$scroll-gallery …` in Codex, or "make a scroll gallery of …"); otherwise ask one short question |
| Pictures | the gallery's content | the user's own (a folder of JPG, PNG, WebP; free), or generated with Skillsmart credits, or the example's own to start |
| Skillsmart credits | only for generated pictures and scenery | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, Python 3 | tools, scaffolder | `node -v`, `python3 -V`; macOS `brew install node python` |
| Chrome or Edge | `check.mjs` and `video.mjs` drive it headless | if there is none, check by hand (Step 6) |
| ffmpeg | only for `video.mjs` | `brew install ffmpeg` |

Cost in credits: a picture is 20 (2K), a scenery piece 20 (a cut-out 22). A gallery of **12 generated pictures is
240 credits, 20 is 400**; the user's own pictures cost nothing. `node pictures.mjs <id> --cost` (and
`node scene.mjs <id> --cost`) prints the exact figure. Tell the user before you generate. Failed generations aren't
charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped
up, run the same step again (everything already made is kept). If the user wants to use their own fal.ai key instead,
prefix the commands with `FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on the gallery (one short message, then go)

Decide, and say in a few lines what you chose:

- **The subject and its pictures.** 6 to 40 pictures of one kind that look good together (a collection, a series, an
  album shelf, a body of work). With the user's own pictures, ask for the folder. Generated: about 12–20, one subject
  each, in one style (`references/pictures.md`).
- **The example to start from**, by the feel the brief wants (`references/layouts.md` has every scene):
  - `ardent`: editorial and luxurious, light then dark then light (fashion, products, portraits, interiors)
  - `side-b`: dark, warm, collectable (records, books, packaging, anything square or in a set)
  - `far-field`: cinematic and immersive (photography, travel, film stills, art)
  - `kit-of-parts`: bright, crisp, playful (design work, 3D, posters, UI, a studio's portfolio)
- **The scenes**: usually keep the example's four, then swap any look that doesn't suit the pictures — square
  pictures on the jukebox, tall ones on the runway, a body of work on the board. Never the same look twice; two looks
  of one layout in a row join best with `reshape`.
- **Type and colours**: one fashionable display face for the title and one plain face for the small words, and a
  background and ink colour per scene (`references/page.md`).

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from ardent --brand "Maison Vale" --title "Vale"
cd <project-dir>/tools && npm install
```

This creates `site/engine/` (the engine), `site/<id>/` (the page: `index.html` for fonts and colours, `page.json` for
words, scenes and pictures, and the example's scenery in `scene/`), and `tools/`. `<id>` is a short lowercase name for
the page, and `<project-dir>` is `./gallery-<id>` unless the user named one. Every word and prompt to write starts with
`WRITE`. Add `--examples` to copy the example as it is, with its pictures (to show the user, or to rebuild it).

## Step 2 — The pictures

Each picture is an item in `site/<id>/page.json` → `items`: `id` ("01"…), `title`, `meta` (two or three short lines:
look number and fabric, artist and year, place and lens), `text` (one sentence), `aspect` ("4:5"), and for a generated
one its `prompt`. Records also take `sub` (the artist) and `tracks`.

**The user's own pictures** (free):

```bash
node build.mjs <id> --from ~/Pictures/collection      # → tools/out/<id>/sheet.jpg
```

Every picture in the folder, in name order, becomes the next item (more items are added, or the extra ones dropped
with their places in the scenes), its aspect read from the picture. Look at `sheet.jpg`, then write each item's title,
meta and text from what you see and what the user told you.

**Generated pictures** (20 credits each):

1. Write the page's `style` line (what every picture shares: medium, light, backdrop, framing, and the "no text, no
   logos, no watermark, no border" endings) and each item's `prompt` (only what differs: the subject, its colour,
   pose, place). `references/pictures.md` has the method, the four examples' lines and the failures they prevent —
   above all: no brand name in the style line, and "flat, full-bleed, seen straight on" for anything graphic.
2. `node pictures.mjs <id> --cost`, tell the user, then `node pictures.mjs <id>` (four at a time; run it in the
   background for 12 or more).
3. `node build.mjs <id>` → `tools/out/<id>/sheet.jpg`. Look at every picture yourself, then show the user. Redo one
   with `node pictures.mjs <id> --only 04 --fix "one sentence"` (the old one is kept as `04.bak-1.png`); a thin border
   the model added: `"trim": true` on the item, or `"crop": [l, t, r, b]` in fractions, then `node build.mjs <id>`.

**The example's pictures**: scaffolded with `--examples`, the page has them already (its prompts are there to learn
from). Replace any with `--only`.

## Step 3 — The words

In `site/<id>/page.json` (`references/page.md`): `brand` (top left), `title` (the big word on the first screen: short,
one or two words), `kicker` and `count` (the small line under it: "Autumn–Winter 2027 · 20 looks"), `nav` (up to four
labels top right; give one `href` to make it a link and `current: true` to mark it), and each item's words. Keep them
short, concrete and in the brand's voice. Each scene's `name` shows bottom right as you scroll.

## Step 4 — The scenes

`site/<id>/page.json` → `sequence`, one entry per scene, in scroll order (`references/layouts.md` lists every layout
with its options, and which change suits which pair):

- `layout` and `look` (e.g. `"ring"`, `"arc"`), `name`, `hold` (screens of scroll it stays, 1.0–1.6).
- `cards`: which pictures it shows, as ids (`"all"` for every one), and `count` to repeat them round more places (a
  wheel of 40 from 20 records; the tiles need cols × rows). Put the strongest pictures first: the first places are the
  ones in front.
- `change`: how the pictures move from the scene before into this one: `reform` (the default), `reshape`, `dive`,
  `fan` or `fold`.
- `bg` (two colours, top and bottom) and `ink` (the words) for this scene, and `scene` for its scenery: a soft photo
  or a pattern behind, line drawings in the middle distance, fog or dust in front (`references/scenery.md`). The
  example's scenery files are in `site/<id>/scene/`; new pieces are generated with `node scene.mjs <id>` from
  `tools/scenery.json` (20 credits each).
- The page opens with `"open": "deal"` (a face-down deck dealt into the first scene, best with the table) or `"enter"`
  (the first scene comes in its own way).

Four scenes and three changes come to about eight screens: keep it there. Alternate light and dark scenes, and big
shapes with quiet ones.

## Step 5 — The look

`site/<id>/index.html`: the fonts (Google Fonts) and the type as custom properties (`--font-display`, `--font-ui`,
`--accent`, `--title-size`, `--title-case`, `--title-weight`, `--title-track`, …). `page.json` → `card` sets the
pictures' material for the whole page: `radius`, `back` (the colour of a card's back), `mat` (0 photo paper, 1 silk,
2 acrylic, 3 glazed tile), `thick`, `gloss`, `grain`, and `disc: true` for records that slide out of their sleeves.
Layouts set their own where it matters (the ribbon is acrylic, the tiles glazed). `references/materials.md` says which
to use when.

## Step 6 — Check

```bash
node check.mjs <id>                   # → tools/out/<id>/check.jpg, and one line per check
```

It serves `site/` and, in a headless Chrome: checks that no `WRITE` is left and every picture a scene names exists,
that everything loads with a clean console, that the pictures cover under a third of the title's letters on the first
screen, that some picture shows at every tenth of a screen of scroll, that hovering a picture labels it, clicking
brings it forward and Escape puts it back, that Index brings a picture into view, and that a phone gets no sideways
scroll. Look at `check.jpg` (the opening, every scene and change, an open picture, and three phone moments): judge it
against the rules at the top of this file. Then serve the page (`python3 serve.py`, then
`http://localhost:5190/<id>/`) and scroll it yourself in a visible browser. A hidden tab or background pane throttles
animation frames, so it lags; `accrochage.go(2.5)` in the console jumps to 2.5 screens down. If you can't run a
browser, start the server, give the user the URL and the checks above as a list, ask them to scroll it (a screenshot
helps), and fix what they report. `references/troubleshooting.md` lists what has gone wrong before.

## Step 7 — A video (when the user wants one)

```bash
node video.mjs <id>                               # 1440 × 900 → tools/out/<id>/video-1440x900.mp4
node video.mjs <id> --size 540x960 --scale 2      # 1080 × 1920 for Reels and TikTok, laid out as on a phone
```

It plays the opening, then scrolls the whole page at an even pace (`--secs`, default 2.5 a screen), drawn frame by
frame so it is smooth on any computer.

## Step 8 — Hand over

Tell the user what you built (the scenes in order, the fonts, the material), the credits spent, anything that didn't
come out right, and the knobs they'll want: words and pictures (`page.json` → `items`), the scenes' order, colours and
holds (`page.json` → `sequence`), the fonts and accent (`index.html`), the material (`page.json` → `card`). The `site/`
folder is a static site for any host; `site/index.html` opens the first page. Masters, review sheets and videos stay
in `tools/out/` (keep it: any picture can be rebuilt without paying again).

## Another gallery

Run the scaffolder again with a new id in the same project (`new_project.py <project-dir> <id2> --from …`): it adds
`site/<id2>/`, and `site/index.html` keeps opening the first page. Link the pages to each other with `nav` → `href`
(`"../<id2>/"`).
