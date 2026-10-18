---
name: fluid-shader
description: Build a landing-page hero around a gentle liquid you can touch — glowing colour clouds in dark water or a soap film with true rainbow interference (a real GPU fluid solver), marbled-paper ink combed like a stylus, or liquid chrome you light with the cursor — in WebGL2 with no libraries, with the brand, copy and layout around it. The cursor draws the liquid along and a click lets something open slowly, never splash. Use whenever someone wants a fluid, liquid, ink, smoke, dye, marbling, chrome, bubble or soap-film hero, or an interactive liquid first screen — even if they don't say shader.
---

# Fluid Shader

One page, one liquid, one palette. Dye and Film run a real fluid simulation on the GPU (stable fluids: velocity,
pressure, vorticity, advection), kept thick and calm; Marble moves its ink with the exact maps marblers' tools make;
Chrome is liquid metal drawn from a formula and lit by the cursor. Around it you build a real landing page: a brand, a
headline, copy and a call to action, in HTML over the canvas. The engine is fixed; a page is its HTML, its CSS and
one `mount()` call with a look and its options.

`assets/examples/` holds four complete pages. Read the one you start from in full and skim another before designing;
never ship one with only the words changed.

| Look | Example | Layout | Cursor / click |
|---|---|---|---|
| **Dye**: colour poured into dark water, softened and bloomed into glowing cloud; three slow emitters keep it alive | `dye` (Tincture, colour grading) | `center`: full-bleed, the title on top | draws the water gently along, leaving a little colour / a soft bloom of new colour opens |
| **Chrome**: liquid metal, slow smooth folds mirroring a dark studio with light strips | `chrome` (Ingot, headphones) | `wings`: metal on both sides, the title on black | a lamp held over the metal: the folds facing it catch its light / a slow ring spreads through it |
| **Marble**: ink floating on water, the way marbled paper is made: exact drops, a stone pattern combed by a slow rake | `marble` (Endpaper, marbled notebooks) | `wings`: marbled endpapers round a title page | a stylus drawing the ink along its path, with no swirl / drops a new colour that pushes the rest aside |
| **Film**: a soap film in a wand, real thin-film interference colour, draining slowly to gold and black at the top | `film` (Bulle, a skin tint) | `disc`: the film beside the copy | a light breath across the film / pops it; a fresh film rises |

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the brand and what the page sells | what the user said (e.g. `/fluid-shader a launch page for Tincture, a colour-grading app` in Claude Code, `$fluid-shader …` in Codex, or "make a fluid hero for …"); otherwise ask one short question |
| Python 3 | the scaffold script | `python3 -V` |
| A browser preview | verifying is the job | your browser or preview tool on `python3 -m http.server 8000 -d <project>/site`; without one, see Step 3 |
| Network | fonts from Google Fonts | nothing else is loaded |

No API keys, no credits, no build step. Nothing is generated: the liquid is code.

## Step 0 — Decide (one short message, then keep going)

From the brief, decide:

- **The look** (table above): Dye for colour, light and creative tools; Chrome for hardware, audio and anything
  machined; Marble for craft, paper, books and stationery; Film for beauty, skin, soap and iridescence.
- **The palette**: Dye's five colours and its dark water; Chrome's tint and warm strip; Marble's inks and paper;
  Film's colours are physics (only the wire and the page around it change). In a series of pages, no two share a
  hue family.
- **The layout**: `center`, `wings`, `split`, `disc`, `horizon`, `portal` or `window` (`references/design.md`).
- **The brand and the line**: a headline with a turn ("Pour colour into every frame", "Sound, poured in metal").
- **Type**: one display face with character from Google Fonts.

Anything the user specified wins. Say what you chose in two or three sentences and continue unless they object.

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> --from <example>
```

`<skill>` is the folder this file is in; `<project-dir>` is `./<brand>-hero` unless the user named one. It writes
`site/index.html` (the example, running at once), `site/engine/` and a `.gitignore`. Serve `site/` and look before
changing anything.

## Step 2 — Design the page

Edit `site/index.html`. Work in this order, looking in the browser after each:

1. **Copy and brand**: title and meta description, nav, eyebrow, headline (one phrase in `<em>`), sub, calls to
   action, the short section under the hero, footer, favicon. Write it for this brand; nothing of the example's story
   may survive.
2. **Type and colour**: the variables at the top of the page's `<style>` (`--bg`, `--ink`, `--muted`, `--accent`,
   `--btn`, `--font-display`, `--title-size` …), the Google Fonts link, and `--fallback`, the CSS shown without
   WebGL2.
3. **The look**: the options in the `mount()` call at the bottom (colours first). `references/engine.md` lists every
   option of every look with its default; change one thing at a time.
4. **Layout**: `data-layout` on `.hero`, and the page's own rules for wide screens, tall windows and phones.
5. **Motion**: keep it gentle. Thick, calm water; a cursor that draws the liquid along rather than churning it; a
   click that lets something open slowly. Turbulence and swirls behind the cursor have always been sent back
   (`references/design.md`).

## Step 3 — Preview and verify

Serve `site/` and open it. Verify in a browser, not by reading code; the quality comes from two or three look-and-fix
passes:

- The console is clean, and on a laptop it holds a smooth frame rate (the engine lowers its resolution on its own if
  it can't).
- The liquid reads as intended: Dye as soft glowing cloud, not paint; Chrome smooth, with no lines along the canvas
  edges and no blocky shading; Marble's lines crisp; Film's bands in the true order.
- Move the cursor quickly across it: nothing swirls or churns behind it. Click: something opens slowly.
- The copy reads everywhere over the liquid.
- Wide, a near-square window and a 390 px phone: the liquid where the layout puts it, nothing overlapping, no
  horizontal scroll.
- With reduced motion it shows one still frame; with WebGL2 off, `--fallback` shows instead.

`window.__shaders[0]` is the running engine (`.redraw()` draws a frame, handy if a hidden preview tab paused it).
`references/troubleshooting.md` lists what has gone wrong before. If you can't open a browser yourself, start the
server, give the user the URL and the checklist above, ask them to look (a screenshot helps), and fix what they
report before handing over.

## Step 4 — Hand over

Tell the user what you built (the look, the palette, the layout, the brand and line, what the cursor and a click do)
in a few lines, how to run it (`python3 -m http.server -d site`; `site/` deploys to any static host as it is), and the
knobs they're likely to tweak and where they live: the copy in the HTML, colours and fonts in the page's `<style>`,
the liquid's colours, speed and touch in the `mount()` options. Mention anything you couldn't make work.

## Adding another page

`python3 <skill>/scripts/new_project.py <project-dir> --from <example> --as <name>` adds `site/<name>.html` beside
the first, sharing the engine; then Steps 0–3 for it.
