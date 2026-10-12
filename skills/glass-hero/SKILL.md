---
name: glass-hero
description: Build a landing-page hero around an abstract 3D glass object that splits white light into vivid rainbows and turns under the cursor — prism rods bursting from a core, a wall of glass blocks, a ribbed glass knot in coloured light, a glass flower through a soft lens — each in its own colour scheme, with the brand, copy and layout around it, in WebGL with three.js. Use whenever someone wants a glass, prism, crystal, refraction or rainbow hero, a premium abstract 3D object on a landing page, or a "wow" first screen for a launch — even if they don't say glass.
---

# Glass Hero

One page, one glass object, one colour scheme. The glass is real dispersive refraction (several wavelengths
followed through the object's actual thickness), always moving a little on its own; hover makes a quiet change, drag
tilts and rolls it like a ball under the finger. Around it you design a real landing-page hero: a brand, a headline,
copy and a call to action. The engine is fixed; you write one page module.

`assets/examples/` holds four complete pages and two extras. Read the one you start from in full and skim another
before designing; never ship one with only the words changed.

| Piece | Example | Scheme | Hover / drag |
|---|---|---|---|
| Prism rods from a core | `urchin` (Spectra, an AI vision lab) | black void, white light | rods reach for the cursor; tap to bloom / tilt and roll, fling |
| A wall of glass blocks | `cubes` (Brique, a glass-block maker) | pearl page, a black-ruled light box | blocks near the cursor turn and lift / tilt the wall; it settles back |
| A ribbed glass knot | `twist` (Loop, a design festival) | dark room, hot orange, electric blue, magenta glows | the cursor is a light sliding along the ribs / tilt and roll, fling |
| Glass petals through a soft lens | `flower` (Maison Iris, a perfume) | black, hot pink, violet, electric blue | focus follows the cursor; petals open toward it / tilt and turn |
| Extras, light only | `halo`, `plume` | a long-exposure ring over a rainbow arch; prism-fringed smoke | lean and rise; stir and puff |

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the brand and what the page sells | what the user said (e.g. `/glass-hero a launch page for Halden, an AI camera` in Claude Code, `$glass-hero …` in Codex, or "make a glass hero for …"); otherwise ask one short question |
| Python 3 | the scaffold script | `python3 -V` |
| A browser preview | verifying is the job | your browser or preview tool on `python3 -m http.server 5191 -d <project>/site`; if you have none, see Step 3 |
| Network | three.js loads from jsDelivr, fonts from Google Fonts | — |

No API keys, no credits, no build step. Nothing is generated: the glass and its light are code.

## Step 0 — Decide (one short message, then keep going)

From the brief, decide: **the piece** (table above; `references/pieces.md` says what each suits), **the colour
scheme** (keep the piece's rule: thin, hot light against darkness, or dense dark lines on a pale page),
**the brand and the line** (a headline with a turn: "One image, every colour.", "Bend light."), **type** (one display
face with character, `references/design.md`). Anything the user specified wins. Say what you chose in two or three
sentences and continue unless they object.

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> <id> --from <example> --name "<Name>" --brand "<Brand>"
```

`<skill>` is the folder this file is in. `<id>` is lowercase (e.g. `halden`); `<project-dir>` is `./glass-<id>` unless
the user named one. An existing Glass Hero project (it has `site/themes/pages.json`) gets another page instead.
The new page is the example with its id, number and name changed, so it runs at once: serve `site/` and open
`/#<id>` before changing anything.

## Step 2 — Design the page

Edit `site/themes/<id>.js` and `site/themes/<id>.css`. Work in this order, looking in the browser after each:

1. **Copy and brand** in `html.hero`: nav, kicker, headline (one phrase in `<em>`), lede, call to action, hint,
   footer. Write it for this brand; nothing of the example's story may survive. `meta` (name, `bg`, `ink`, title).
2. **Type and colour** in the CSS (keep every rule scoped by `[data-theme="<id>"]`): `--bg`, `--ink`, `--display`,
   the `@import` of the display face, the headline and button details.
3. **The light**: the backdrop shader and the studio (`ENV`) in the page module are where its colours come from.
   Shift hues to the brand, keeping the contrast that makes dispersion show (`references/glass.md`).
4. **The object**: the constants at the top (counts, sizes, spin) and the material settings (`ior`, `spread`,
   `samples`, `saturation`). Change one thing at a time.
5. **Motion and response**: the `Trackball` settings, what hover does, what a tap does.

`references/glass.md` is the API: the page module contract, the stage and slot, `GlassStage`, `glassMaterial` and its
hooks, `bakeEnv`, `backdrop`, the lens and post passes, the trackball.

## Step 3 — Preview and verify

Serve `site/` and open `/#<id>`. Verify in a browser, not by reading code; the quality comes from two or three
look-and-fix passes:

- The console is clean; the object sits in its slot, fully in frame, clear of the copy; no flickering black blocks.
- The rainbow is strong where the object meets the light, and the scheme reads as one palette with the copy.
- Hover makes its quiet change; drag tilts and rolls; let go and it flings, then spins on or settles back.
- The copy reads over the light (the scrim behind it is `--scrim`); a near-square window and a 390 px phone put the
  object below the copy with nothing overlapping and no horizontal scroll.
- On a laptop it holds a smooth frame rate (the stage lowers resolution on its own if it can't).

If the preview tab is hidden, frames pause: `__glass.advance(2)` draws two seconds. `references/troubleshooting.md`
lists what has gone wrong before. If you can't open a browser yourself, start the server, give the user the URL and
the checklist above, ask them to look (a screenshot helps), and fix what they report before handing over.

## Step 4 — Hand over

Tell the user what you built (the piece, the scheme, the brand and line, what hover and drag do) in a few lines, how
to run it (`python3 -m http.server -d site`; the `site/` folder deploys to any static host), and the knobs they're
likely to tweak with where they live: the copy in `html`, colours and fonts in the CSS, the light in the backdrop and
`ENV` shaders, the object's counts, sizes and spin in the constants at the top. Mention anything you couldn't make work.

## Adding another page

Run `new_project.py <project-dir> <new-id> --from <example> --name …` in the same project, then Steps 0–3. With more
than one page the dock lists them; `1`–`9` and ← → switch.
