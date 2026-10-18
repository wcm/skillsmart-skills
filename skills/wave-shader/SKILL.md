---
name: wave-shader
description: Build a landing-page hero over a live, wavy gradient shader — warm silk folds, a ragged aurora curtain, a satin sea rolling to a low sun, or a vivid silky ribbon in shallow focus (Stripe-style) — one WebGL2 engine with no libraries, with the brand, copy and layout around it. The colour drifts slowly, leans toward the cursor and ripples where you click. Use whenever someone wants an animated or mesh gradient, aurora, silk, wave or ShaderGradient-style hero, a moving colour background or a calm premium first screen — even if they don't say shader.
---

# Wave Shader

One page, one look, one palette. Every look is the same engine: a wavy surface of colour seen by a camera, lit and
grained. Its shape, camera, palette and light decide what it reads as: a plane seen from above is silk, the same plane
from a low camera is a sea, a hanging sheet that glows is an aurora, a long twisting strip is a ribbon. Around it you
build a real landing page: a brand, a headline, copy and a call to action, in HTML over the canvas. The engine is
fixed; a page is its HTML, its CSS and one `mount()` call with a preset.

`assets/examples/` holds four complete pages. Read the one you start from in full and skim another before designing;
never ship one with only the words changed.

| Look | Example | Layout | Cursor / click |
|---|---|---|---|
| **Haze**: big soft folds of warm silk from above, misting toward the top | `haze` (Sorbet, a palette tool) | `center`: full-bleed, the title on top | lifts the silk where it points / a ring of waves runs out |
| **Aurora**: a glowing curtain over a treeline, ragged at every edge, green fading up to violet, under stars | `aurora` (Kp9, aurora alerts) | `wings`: light on both sides, a clear starry middle | bends the curtain toward you, brighter / a surge runs through it |
| **Swell**: a satin sea rolling to a low sun, a glitter path, fog into the horizon | `swell` (Meltemi, small-boat sailing) | `horizon`: the sea low, the copy in the sky | lifts the sea and leans the sun / a ring of waves |
| **Ribbon**: a wide band of saturated orange, pink, violet and periwinkle, made of silky strands, in shallow focus | `ribbon` (Brio, global payroll) | `split`: the band on the right, a two-word headline on white | pushes the band / a ripple runs along it |

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the brand and what the page sells | what the user said (e.g. `/wave-shader a launch page for Sorbet, a palette tool` in Claude Code, `$wave-shader …` in Codex, or "make a wave shader hero for …"); otherwise ask one short question |
| Python 3 | the scaffold script | `python3 -V` |
| A browser preview | verifying is the job | your browser or preview tool on `python3 -m http.server 8000 -d <project>/site`; without one, see Step 3 |
| Network | fonts from Google Fonts | nothing else is loaded |

No API keys, no credits, no build step. Nothing is generated: the colour is code.

## Step 0 — Decide (one short message, then keep going)

From the brief, decide:

- **The look** (table above): silk for a calm product, an aurora for night, a sea for travel or the outdoors, a ribbon
  for a confident, colourful brand. A new mood is a new preset of the same engine, not a new effect: the skill's one
  feeling is the wave.
- **The palette**: five stops, low to high, all in one hue family, plus the page colours around it. For a loud page,
  saturated colour on white or black; for a calm one, close values. In a series of pages, no two share a hue family.
- **The layout**: `center`, `wings`, `split`, `horizon`, `portal`, `disc` or `window` (`references/design.md`); the
  copy always sits where the shader is calmest.
- **The brand and the line**: a headline with a turn ("Colour, by feel.", "Payday, everywhere."). Shorter is better
  over a busy look; Ribbon wants two words.
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
   `--btn`, `--font-display`, `--title-size` …), the Google Fonts link, and `--fallback`, the CSS gradient shown
   without WebGL2, in the same palette.
3. **The look**: the `mount()` call at the bottom, `mount(canvas, wave, { ...haze, colors: [ … ] })`. Override the
   preset's fields (colours first, then light and sky, then camera, shape and waves); `engine/presets.js` documents
   every field at its top and `references/engine.md` explains them with ranges. Change one thing at a time.
4. **Layout**: `data-layout` on `.hero`, and the page's own rules for wide screens, tall windows and phones (each
   preset has a `tall` override for phones; give a new look one too).
5. **Motion**: `speed`, `press`, `ripple`, `lean`. Keep it slow and soft: drift you notice after a few seconds, a
   cursor that nudges, a click that ripples. Big twists, fast drift and strong pushes read as cheap
   (`references/design.md`).

## Step 3 — Preview and verify

Serve `site/` and open it. Verify in a browser, not by reading code; the quality comes from two or three look-and-fix
passes:

- The console is clean, and on a laptop it holds a smooth frame rate (the engine lowers its resolution on its own if
  it can't).
- The look reads as intended: folds, not stripes; light that fades out raggedly, not in clean bands; the palette as
  one family with the page.
- The copy reads everywhere over the shader; nothing important sits on its busiest part.
- Hover nudges and a click ripples, gently.
- Wide, a near-square window and a 390 px phone: the shader where the layout puts it, nothing overlapping, no
  horizontal scroll.
- With reduced motion it shows one still frame; with WebGL2 off, `--fallback` shows instead.

`window.__shaders[0]` is the running engine (`.redraw()` draws a frame, handy if a hidden preview tab paused it).
`references/troubleshooting.md` lists what has gone wrong before. If you can't open a browser yourself, start the
server, give the user the URL and the checklist above, ask them to look (a screenshot helps), and fix what they
report before handing over.

## Step 4 — Hand over

Tell the user what you built (the look, the palette, the layout, the brand and line, what hover and a click do) in a
few lines, how to run it (`python3 -m http.server -d site`; `site/` deploys to any static host as it is), and the
knobs they're likely to tweak and where they live: the copy in the HTML, colours and fonts in the page's `<style>`,
the look in the `mount()` call (colours, speed, light). Mention anything you couldn't make work.

## Adding another page

`python3 <skill>/scripts/new_project.py <project-dir> --from <example> --as <name>` adds `site/<name>.html` beside
the first, sharing the engine; then Steps 0–3 for it.
