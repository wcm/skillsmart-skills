---
name: glass-shader
description: Build a landing-page hero where a pane of glass sits over the page and shows itself only by bending what's behind it — full-page reeded glass over a moving gradient, a fogged window you wipe to see a rainy street, water drops of every size on a photo, or a wall of thick frosted tiles over a glowing ball — in WebGL2 with no libraries, with the brand, copy and layout around it. Use whenever someone wants a glass, frosted, reeded, fluted, glassmorphism, fog, steam, droplet or refraction hero — even if they don't say shader. Photos come from the user or are generated with Skillsmart credits.
---

# Glass Shader

One page, one pane of glass, one backdrop. Glass is a layer in front of the page: every look draws a backdrop first (a
moving colour field, a photo, or a soft ball of colour) and reads it back, bent, frosted and split into red and blue
at the edges. Nothing is drawn on the glass: no outlines, no highlights, only the picture behind. Around it you build
a real landing page: a brand, a headline, copy and a call to action, in HTML over the canvas. The engine is fixed; a
page is its HTML, its CSS and one `mount()` call with a look and its options.

`assets/examples/` holds four complete pages. Read the one you start from in full and skim another before designing;
never ship one with only the words changed.

| Look | Example | Layout | Cursor / click |
|---|---|---|---|
| **Reeded**: fluted glass over the whole page, nearly flat behind the copy and deepening toward the sides; each flute a thick lens over a moving colour field | `reeded` (Pane, private analytics) | `center`: the copy in the middle | the glass stays still; the colour behind leans toward the cursor / a bloom of colour opens behind the glass |
| **Steam**: a fogged window onto a rainy street; the fog comes back within seconds, a wet rim where wiped glass meets fog, drops that run | `steam` (Monsoon Radio, live rain) | `window`: a framed pane in the page | press and drag to wipe the fog (hover leaves it alone) / a click wipes a spot |
| **Liquid**: water drops of every size on a photo, from big glass lenses to dew; near drops melt into one another | `liquid` (Dewfall, flowers by the week) | `split`: the photo on the right, fading into the copy | the big drop follows like a loupe and takes in the dew it passes / flicks out a droplet; drag any drop |
| **Tiles**: a wall of thick frosted glass blocks over a soft ball of colour, from the title to off the page | `tiles` (Sunbank, home batteries) | `split`: the copy on the left | the ball slowly follows, always under the glass / it swells for a moment |

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the brand and what the page sells | what the user said (e.g. `/glass-shader a launch page for Pane, privacy-first analytics` in Claude Code, `$glass-shader …` in Codex, or "make a glass hero for …"); otherwise ask one short question |
| Python 3 | the scaffold script | `python3 -V` |
| A browser preview | verifying is the job | your browser or preview tool on `python3 -m http.server 8000 -d <project>/site`; without one, see Step 3 |
| Network | fonts from Google Fonts | nothing else is loaded by the page |
| A photo (Steam, Liquid) | what the glass sits in front of | the user's own picture, the example's (shipped), or one generated with Node 18+ and Skillsmart credits (Step 1) |

Skillsmart credits are only for generating a photo: nothing to set up, the tool generates through the user's
Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer).
Check the balance with `npx --yes skillsmart@latest credits`. Reeded and Tiles need no photo and no credits.

## Step 0 — Decide (one short message, then keep going)

From the brief, decide:

- **The look** (table above): Reeded for a calm, architectural brand; Steam for weather, sound, cafés and anything
  cosy; Liquid for fresh, natural products; Tiles for energy, tech and a single bright idea.
- **The backdrop**: Reeded's field colours (a pale base and five blobs), the photo for Steam or Liquid (what's in it
  decides the whole mood), Tiles' ball (a deep core running out to two brighter colours) and its plain ground.
- **The layout**: `center`, `window`, `split`, `wings`, `disc`, `horizon` or `portal` (`references/design.md`).
- **The brand and the line**: a headline with a turn ("Privacy that lets the light in", "It's raining somewhere").
- **Type**: one display face with character from Google Fonts.

Anything the user specified wins. Say what you chose in two or three sentences and continue unless they object.

## Step 1 — Scaffold, and the photo

```bash
python3 <skill>/scripts/new_project.py <project-dir> --from <example>
```

`<skill>` is the folder this file is in; `<project-dir>` is `./<brand>-hero` unless the user named one. It writes
`site/index.html` (the example, running at once), `site/engine/`, `site/img/` (the examples' photos), `tools/` and a
`.gitignore`. Serve `site/` and look before changing anything.

For Steam and Liquid, the photo: the user's own (copy it into `site/img/` and point the page's `src` at it), or a new
one generated for the page:

```bash
cd <project-dir>/tools
node photo.mjs harbour --prompt "A harbour at dusk seen through a window, wet stones mirroring warm lights…"   # 20 credits
node photo.mjs harbour --fix "fewer boats, more reflections"                                                   # another 20
```

Each photo is 20 credits: say so before each run. It writes `site/img/<id>.jpg` and keeps the one it replaces as
`<id>.bak-N.jpg`; prompts live in `tools/photos.json` (the examples' are there to learn from). Ask for what the glass
shows off: strong colour, points of light, edges and contrast, no text. If a run stops with **NOT ENOUGH CREDITS**,
give the user the link from that message and wait for them to say they've topped up; a user with their own fal.ai
key can run it as `FAL_KEY=… node photo.mjs …` (an environment variable only; never echo it or write it to a file),
and no credits are used then.

## Step 2 — Design the page

Edit `site/index.html`. Work in this order, looking in the browser after each:

1. **Copy and brand**: title and meta description, nav, eyebrow, headline (one phrase in `<em>`), sub, calls to
   action, the short section under the hero, footer, favicon. Write it for this brand; nothing of the example's story
   may survive.
2. **Type and colour**: the variables at the top of the page's `<style>` (`--bg`, `--ink`, `--muted`, `--accent`,
   `--btn`, `--font-display`, `--title-size` …), the Google Fonts link, and `--fallback`, the CSS shown without
   WebGL2.
3. **The backdrop**: the field's colours, the photo (`src`, and `focus` for where it's cropped round), or the ball's
   colours, in the `mount()` options.
4. **The glass**: its options in the `mount()` call (`references/engine.md` lists every one with its default). Keep it
   thick: the refraction is the effect. Change one thing at a time.
5. **Layout**: `data-layout` on `.hero`, the elements the glass reads (Reeded's copy box, Tiles' `.tiles` grid), and
   the page's own rules for wide screens, tall windows and phones.

## Step 3 — Preview and verify

Serve `site/` and open it. Verify in a browser, not by reading code; the quality comes from two or three look-and-fix
passes:

- The console is clean, the photo has loaded, and on a laptop it holds a smooth frame rate.
- The glass reads as thick glass: what's behind it bends, repeats, frosts and fringes at the edges. If it looks like
  stripes or a light veil, the backdrop is too soft where the glass is deepest, or the glass too thin.
- Nothing is drawn on the glass: no white outlines or highlight lines.
- The interaction: Reeded's glass stays still while the colour moves; Steam wipes only on a press or drag and fogs
  back within a few seconds; Liquid's big drop follows and takes in dew; Tiles' ball never shows outside the tiles.
- The copy reads everywhere.
- Wide, a near-square window and a 390 px phone: the glass where the layout puts it, nothing overlapping, no
  horizontal scroll.
- With reduced motion it shows one still frame; with WebGL2 off, `--fallback` shows instead.

`window.__shaders[0]` is the running engine (`.redraw()` draws a frame, handy if a hidden preview tab paused it).
`references/troubleshooting.md` lists what has gone wrong before. If you can't open a browser yourself, start the
server, give the user the URL and the checklist above, ask them to look (a screenshot helps), and fix what they
report before handing over.

## Step 4 — Hand over

Tell the user what you built (the look, the backdrop, the layout, the brand and line, what the cursor and a click do)
and any credits spent, in a few lines; how to run it (`python3 -m http.server -d site`; `site/` deploys to any static
host as it is); and the knobs they're likely to tweak and where they live: the copy in the HTML, colours and fonts in
the page's `<style>`, the glass and backdrop in the `mount()` options, the photo in `site/img/`. Mention anything you
couldn't make work.

## Adding another page

`python3 <skill>/scripts/new_project.py <project-dir> --from <example> --as <name>` adds `site/<name>.html` beside
the first, sharing the engine and photos; then Steps 0–3 for it.
