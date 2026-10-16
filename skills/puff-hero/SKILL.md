---
name: puff-hero
description: Build a loud, poster-like landing page whose hero is a word in overinflated, wildly deformed 3D letters — satin vinyl, glossy bubblegum, squishy matte rubber, faux fur — floating over fashionable type and a still, code-drawn pattern. The letters are generated (a still, a seamless video loop and its cut-out, paid with Skillsmart credits); they lean toward the cursor, pop when touched and jiggle on hover. Use for puffy, inflated, balloon, bubble, squishy, jelly or plush lettering, a Y2K or playful hero, or a launch, drop or event page with a big tactile title — even if all you get is one word.
---

# Puff Hero

One poster-like page. Its hero is a short phrase in **puffy letters**: overinflated until the counters close, every
letter warped its own way, tumbling into one lumpy cluster, in a tactile material. They float over a page built in
code (fashionable type, a still pattern, the copy) and they are **the only thing on the page that moves**:

- **rest:** the loop's first frame, drifting a hair;
- **lean:** wherever the cursor is, the letters slide and turn toward it on a soft spring, their shadow sliding away;
- **pop:** when the cursor reaches the letters (or a finger taps them, or the page opens), they swell ~8% and rebound;
- **loop:** while the cursor stays on them the loop plays; when it leaves, the loop runs on to its end, which is its
  first frame, so it always stops where it started.

This shape is the result of several rejected tries, and the reasons matter when you are tempted to change it.
Modelling the letters in three.js (inflated meshes, springs) looked stiff. Layering a WebGL light-and-dent effect over
the video looked like two things fighting. Text baked into a generated poster can't be edited and moves with the
loop. So: the letters are generated as one isolated object, everything else is code, and only the letters move.

`<skill>` below is the folder this file is in.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the words and the brand | what the user said (e.g. `/puff-hero POP STAR for a record label` in Claude Code, `$puff-hero …` in Codex, or "make a puffy-letter hero for …"); otherwise ask one short question |
| The words | the hero | 1–3 short lines, 2–6 letters each; capitals. Split a long word across lines (HUG / GER) |
| Skillsmart credits | stills, loops and the cut-out | nothing to set up: the tools generate through the user's Skillsmart account with `npx skillsmart@latest` (the first run may open the browser once to connect this computer). Check the balance with `npx --yes skillsmart@latest credits` |
| Node 18+, ffmpeg, Python 3 | tools, encoding, scaffolder | `node -v`, `ffmpeg -version`, `python3 -V`; macOS `brew install node ffmpeg python` |
| macOS (for Safari) | Safari plays only HEVC with alpha, which ffmpeg encodes with Apple's VideoToolbox | elsewhere the page still works; Safari shows the still and the pop without the loop |
| Chrome or Edge | `check.mjs` drives it headless | if there is none, check by hand (Step 6) |

Cost in credits: a still is 20, a loop 15 a second (60 for the default 4 s pop, 75 for 5 s), the cut-out 2 a second
of the loop. A page is usually 3 stills (60) + 2 loop takes (120) + 1 cut-out (8) ≈ **190 credits**, plus any redos.
Tell the user before the first still and before the loops. Failed generations aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they say they've topped
up, run the same step again. If the user wants to use their own fal.ai key instead, prefix the commands with
`FAL_KEY=…` (an env var only; never echo it or write it to a file): no credits are used then.

## Step 0 — Agree on intent (one short message, then go)

Decide, and say in a few lines what you chose:

- **Words.** The user's phrase or brand word, as 1–3 short lines. Playful, tactile words suit best. If it is long,
  propose a split or a shorter hero phrase and put the rest in the code-built copy.
- **Material** that fits the brand: start from the tested ones in `references/prompt-formula.md` (satin vinyl, gloss
  bubblegum, matte soft-touch rubber, faux fur) or write a new one the same way.
- **Page colour**, which is also the still's backdrop (so the cut-out's soft edges carry the page's own colour), and
  the copy's ink.
- **Background**: a still, code-drawn pattern that belongs to the brand (`references/backgrounds.md`), calmer than
  the letters.
- **Type and copy** (`references/page.md`): one loud, fashionable display face that contrasts with the round letters,
  brand, a few nav links, one label, one call to action.

Real brands only when they are the user's own; don't recreate someone else's logo.

## Step 1 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> --brand "Sour Records" --words "POP/STAR" \
  --bg "#b4ea4c" --ink "#0b0b0b" --backdrop "lime green"
cd <project-dir>/tools && npm install
```

This creates `site/` (the page, `puff.js`, `backgrounds.js`) and `tools/` (`pages.json`, `generate.mjs`,
`video.mjs`, `check.mjs`, `gen.mjs`). The words go into the prompt and the page; the frame ratio is chosen from their
shape. It prints the page's id (from the words, or `--id`), written `<id>` below. `<project-dir>` is `./puff-<id>`
unless the user named one.

## Step 2 — Fill in the page's prompt slots

In `tools/pages.json`, the page has three slots left to write: `material`, `subject` and `shine`
(`references/prompt-formula.md` and `references/motion.md` explain each, with tested examples;
`assets/examples/pages.json` has the four reference pages' entries). Leave the shared
lines (`deform`, `camera`, `frame`, `loop`, `motion`, `negative`) as they are: each one fixes a failure we saw
(the model falling back to a neat bubble font in rows, letters standing on a floor with flat bottoms, loops that
land or squeeze). Change one only for a reason that reference names.

## Step 3 — Stills: three takes, pick one

```bash
node generate.mjs <id> --takes 3      # 60 credits → tools/out/<id>/takes.png
node generate.mjs <id> --pick 2       # the chosen take becomes still.png (free)
```

Look at `takes.png` yourself first, then show it to the user. A good take: the words spelled exactly and readable;
letters deformed and tumbling into one cluster (not a tidy font in rows); round all the way under, floating, with no
floor and no shadow on the backdrop; nothing touching the frame's edge; the material right (no stray stripes,
seams or crimps). Takes vary a lot, so a second round of three is normal (say so: another 60 credits). For a small
fault use `--fix "one sentence"`; for a material fault, rewrite the material sentence.

## Step 4 — The loop: two takes, pick one, cut it out

```bash
node video.mjs <id> --takes 2         # 120 credits for two 4 s takes; minutes, so run it in the background
node video.mjs <id> --pick 1          # cut-out (8 credits), crop, encode → site/img/<id>/puff.{webm,mov,webp}
```

`loop-takes.mp4` plays the takes side by side; each is labelled with how much it moves and how its size changes
(`references/motion.md` → reading the numbers). Watch them yourself, show the user, and let them choose: the
numbers flag a loop that barely moves or squeezes, but eyes decide. If neither is right, make two more (say what
that costs), or adjust `shine` or the page's `negative` first. After `--pick`, open `tools/out/<id>/sheet.png`
(six moments over a checkerboard) and check the matte's edges. The encoder stops on its own if the matte kept the
backdrop on any frame; then set the page's `"matte"` to the other variant (`"heavy"` ↔ `"matting"`) and run
`node video.mjs <id> --from matte`.

## Step 5 — The page

Edit `site/index.html`, `style.css` and `main.js` (`references/page.md`):

- The puffy letters are the hero: big (60–80% of the window's height), on top, centred or nearly.
- All other text is HTML: brand, nav, label, call to action, headlines, small print. None of it is in the image.
- Pick the background recipe in `main.js` (or write one) and keep it off the copy (`keepOut`).
- Fonts from Google Fonts, flat and sharp against the round letters; the letters' shadow tinted from the page colour.

## Step 6 — Check

```bash
node check.mjs        # → tools/out/check.png, and one line per check
```

It serves `site/`, then in a headless browser checks: no console errors, the loop loads, the letters lean toward
the cursor, they pop when it reaches them and the loop plays, the loop finishes on its first frame after the cursor
leaves, reduced motion holds them still, and at phone size they fit with no sideways scroll. Look at `check.png`.
Then preview it in a visible browser (`python3 -m http.server 5183 -d site`) and move over the letters yourself:
hidden tabs and background panes don't play video or run animation frames, so they look frozen. If you can't run a
browser at all, start the server, give the user the URL and the checks above as a list, ask them to look (a
screenshot helps), and fix what they report. `references/troubleshooting.md` lists what has gone wrong before.

## Step 7 — Hand over

Tell the user what you built (words, material, background, fonts), which takes were chosen and why, the credits
spent, anything that didn't come out right, and the knobs they'll want: the letters' size and position (`mountPuff`
options in `main.js`), the lean and pop strength (same options), the background recipe and its colours, the copy.
The `site/` folder is a static site for any host. Masters, raw clips, masks and takes stay in `tools/out/`
(gitignored) so any step can be redone without paying for the earlier ones.

## Another page or a variant

Add an id to `tools/pages.json` (its own words, material, `bg`, `ratio`), run Steps 3–4 for it, and give it its
own HTML page whose `main.js` points `mountPuff` at `img/<id>/puff`.
