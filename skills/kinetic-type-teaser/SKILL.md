---
name: kinetic-type-teaser
description: Make a 10–30 second kinetic typography teaser video — big words snapping, wiping, splitting, counting and scrolling on hard cuts with one accent colour — for launches, events, announcements and social posts, in five styles (loud, swiss, memphis, xerox, bauhaus). One script renders to MP4 in 16:9, vertical 9:16 and 1:1. Use for a teaser video, launch or coming-soon video, animated text video, kinetic type, motion graphics for an announcement, or a short promo reel without footage.
---

# Kinetic Type Teaser

You make a short typographic teaser: big words on hard cuts, one accent. Each beat is a short shot; five styles
change the type, the colours, the shapes around the words and how they move. The teaser is an HTML page on a
frame-by-frame engine: it plays and scrubs in a browser, and `scripts/render.mjs` renders every frame to MP4.

`<skill>` below means this skill's folder: the folder this `SKILL.md` is in.

Output: a folder with `index.html` (the teaser, editable) and `out/<name>-16x9.mp4`, `-9x16.mp4`, `-1x1.mp4`.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what's launching or happening, the brand, a date or URL, a real number if any | what the user said (`/kinetic-type-teaser a 12-second teaser for Orbit 2.0 on 1 December` in Claude Code, `$kinetic-type-teaser …` in Codex, or "make a teaser video for …") |
| Node 18+ | the renderer | `node -v` |
| Chrome or Edge | renders the frames, headless | an installed Chrome or Edge; otherwise `npx playwright install chromium` |
| ffmpeg | turns the frames into MP4 | `ffmpeg -version`; install with `brew install ffmpeg`, `winget install Gyan.FFmpeg` or `apt install ffmpeg` |

No credits and no API keys. The teaser loads its fonts from Google Fonts; the renderer installs `playwright-core` once
from npm into a cache folder (never into the project) and drives the installed browser.

## Steps

1. **Copy** `<skill>/assets/template/` to `./teaser-<name>/`.
2. **Write the script** (`references/motion-script.md`): 6 beats for 12 s (tease → word → flash → stack → marquee →
   end), or 9–10 beats for 20–24 s with `type`, `split`, `count` and `grid` (see `assets/examples/long.html`). One to
   three words per beat.
3. **Pick the style** from the brand: `loud` (black, acid accent, condensed capitals), `swiss` (white, red, flush left
   on a grid), `memphis` (pink, confetti shapes, bouncy), `xerox` (photocopy grain and halftone, stop motion), `bauhaus`
   (cream, primary shapes that rearrange). `accent` sets the brand colour.
4. **Fill the `KineticTeaser.film({...})` block** in `index.html`. Nothing else changes.
5. **Preview**: serve the folder (`python3 -m http.server 5195 -d ./teaser-<name>`) and open it in your browser or
   preview tool (`?style=xerox` tries another style). Space plays, ← → step a frame, `[` `]` jump between beats.
   **Without a browser**, go straight to the sheet.
6. **Check**: `node <skill>/scripts/render.mjs sheet ./teaser-<name>/index.html --scenes --format all`. Open the sheets
   and look for words running off the frame in 9:16 (shorten them) and an accent that disappears on its background.
7. **Render**:
   ```bash
   node <skill>/scripts/render.mjs video ./teaser-<name>/index.html --format all
   ```
   `--audio track.mp3` lays a track under it; `--draft` renders a quick half-size check.
8. **Hand over** the MP4s and the folder, and say which style you chose and why.

## Rules

- Words fit themselves to the frame, so long words get small. Keep `word` and `flash` beats to one short word.
- `count` only with a real number.
- Flashing-content safety: no more than 3 full-screen flashes per second. Beats last at least 1.2 s; don't shorten a
  `flash` below 0.4 s.
- Text stays crisp: grain, halftone and shapes go behind the words, never over them.
- No audio is added: suggest a track and mention `--audio`.
