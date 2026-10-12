---
name: cloth-hero
description: Build a landing-page hero where a picture becomes real cloth that sags, ripples and answers the cursor — a printed sheet you pull and crease, split curtain panels you walk through, a bead curtain one bead per pixel, or a silk banner streaming in water or wind — on real-time cloth physics with three.js, plus the page's copy, brand and sound. Use whenever someone wants cloth, fabric, a curtain, silk, a flag or a banner on a website, a picture that ripples or drapes, or an interactive 3D hero with physics — even if they only bring a picture or a product.
---

# Cloth Hero

One page, one cloth, one picture on it. The cloth runs on real physics (a fixed 120 Hz clock, so it never shimmers)
and answers the cursor in the way that cloth would: pulled, parted, swept or pressed. Around it you design a real
landing-page hero: a brand, a headline with a turn in it, copy, a call to action and the small details that make
the world believable. The engine is fixed; you write one page module.

`assets/examples/` holds four complete pages, one per kind of cloth. Read the one you start from in full and skim
another before designing; never ship one with only the words changed.

| Kind | Example | The picture becomes | The cursor |
|---|---|---|---|
| A hanging sheet | `afterhours` (holographic vinyl, a digital-fashion label) | a print on vinyl, satin, canvas, paper | drag to pull and crease it; let go to drop it |
| Split panels | `noren` (an indigo shop curtain, a Kyoto atelier) | dye in linen, a print on a shop or stage curtain | press to lift a panel; a click walks a person through |
| A bead curtain | `moongate` (pearls in a moon gate, a jewellery house) | one bead per pixel, in pearl, onyx, coral, glass | sweep through the strands; they swing and re-form the picture |
| A streaming banner | `tide` (silk under water, a silk maison) | a long print along silk, a flag, a ribbon | rest a hand on it; the current carries the dent away |

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the brand and what the page sells | what the user said (e.g. `/cloth-hero a silk scarf brand called Mare` in Claude Code, `$cloth-hero …` in Codex, or "make a cloth hero for …"); otherwise ask one short question |
| Pictures | the picture on the cloth and the scene around it | the user's own picture, or generated with their Skillsmart credits (Step 2) |
| Python 3, Node 18+ | the scaffold script and the picture tools | `python3 -V`, `node -v` |
| A browser preview | verifying is the job | your browser or preview tool on `python3 -m http.server 5190 -d <project>/site`; if you have none, see Step 4 |
| Network | three.js loads from jsDelivr, fonts from Google Fonts | — |

## Step 0 — Decide (one short message, then keep going)

From the brief, decide: **the kind of cloth** (table above), **the picture on it** (the user's, or one you'll
generate), **the scene** behind it, **the brand and the line** (a headline with a turn, as in "Pull me closer." or
"Step through the blue."), **fonts, palette and sound** (`references/design.md`). Anything the user specified wins.
Say what you chose in two or three sentences and continue unless they object. `references/cloths.md` explains what
each kind is good at and which knobs change its feel.

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from <example> --name "<Name>" --brand "<Brand>"
cd <project-dir>/tools && npm install
```

`<skill>` is the folder this file is in. `<id>` is lowercase (e.g. `velvet`); `<project-dir>` is `./cloth-<id>` unless
the user named one. An existing Cloth Hero project (it has `site/themes/pages.json`) gets another page instead.
The new page is the example with its id, number and name changed and the example's pictures as placeholders, so it
runs at once: serve `site/` and open `/#<id>` before changing anything.

## Step 2 — Pictures

The page needs the picture on the cloth and usually one scene picture (backdrop, doorway, garden, water); the
example's entries in `tools/images.json` say what each one is for. `references/images.md` has what makes a picture
work on each kind of cloth, and prompts that have worked.

- **The user's picture:** `node images.mjs <id>-art --use <path>` puts it in place (no credits).
- **Generate:** rewrite the prompts in `tools/images.json` for this page, then `node images.mjs <id>` (every image of
  the page) or `node images.mjs <id>-plate` (one). Each image is **20 Skillsmart credits**, so a page is about 40–60;
  say so before the first one. The first run may open the browser once to connect this computer; check the balance
  with `npx --yes skillsmart@latest credits`. Failed generations aren't charged.
- If a run stops with **NOT ENOUGH CREDITS**, give the user the link from the message; when they've topped up, run
  the same command again. If they prefer their own fal.ai key, prefix the command with `FAL_KEY=…` (an env var only;
  never echo it or write it to a file) and no credits are used.

Look at each picture before building on it; regenerate with `--fix "…"` rather than working around a bad one.

## Step 3 — Design the page

Edit `site/themes/<id>.js` and `site/themes/<id>.css`. Work in this order, looking in the browser after each:

1. **Copy and brand** in `html.hero`: nav, kicker, headline, lede, call to action, facts, footer, the hint. Write it
   for this brand; nothing of the example's story may survive. `meta` (name, veil colours, display font, sound).
2. **Palette and type** in the CSS (keep every rule scoped by `[data-theme="<id>"]`) and the `@import` of its fonts.
3. **The material**: how the picture is baked onto the cloth (the example's `bake…` function) and the material
   settings. Keep the method, change the colours and details to fit the brand.
4. **The cloth's feel**: the constants at the top and the `new Cloth({…})` / `Strands` / `Banner` settings
   (`references/cloths.md`). Change one thing at a time.
5. **Layout** in `layout(w, h)`: the cloth beside the copy on wide screens, below it on tall ones and phones.

`references/engine.md` is the API: the page module contract, the stage, the cloth classes and the kit.

## Step 4 — Preview and verify

Serve `site/` and open `/#<id>`. Verify in a browser, not by reading code; the quality comes from two or three
look-and-fix passes:

- The console is clean; the cloth hangs still at rest (no shimmer) and is fully in frame, clear of the copy.
- The interaction does what the hint says, every time: pull, part, sweep or press, then let go and watch it settle.
- The picture reads on the cloth at rest; the copy reads over the scene.
- A near-square window and a 390 px phone: the cloth moves below the copy, nothing overlaps, no horizontal scroll.
- Sound (the dock button or S) plays a quiet bed and the cloth's rustle.

If the preview tab is hidden, frames pause: `__cloth.advance(2)` runs two seconds of physics and draws.
`references/troubleshooting.md` lists what has gone wrong before. If you can't open a browser yourself, start the
server, give the user the URL and the checklist above, ask them to look (a screenshot helps), and fix what they
report before handing over.

## Step 5 — Hand over

Tell the user what you built (the cloth, the picture, the brand and line, the interaction) in a few lines, how to run
it (`python3 -m http.server -d site`; the `site/` folder deploys to any static host), the credits spent, and the knobs
they're likely to tweak with where they live: the copy in `html`, colours in the CSS, the cloth's feel in the
constants at the top of `<id>.js`, prompts in `tools/images.json`. Mention anything you couldn't make work.

## Adding another page

Run `new_project.py <project-dir> <new-id> --from <example> --name …` in the same project, then Steps 0–4. With more
than one page the dock lists them; `1`–`9` and ← → switch.
