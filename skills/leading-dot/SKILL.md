---
name: leading-dot
description: Make a 15–30 second explainer video where one dot carries the whole film with no cuts — it drops in, bounces across the words, grows into a phone screen, splits into features, draws a chart, becomes a progress ring, a button or a typing caret, floods the frame and lands as the dot of the logo's i. One story renders to MP4 in 16:9, 9:16 and 1:1. Use for a leading-dot or dot-transition video, a one-take explainer, an Apple-style product explainer, or a short motion piece about a product without footage.
---

# Leading Dot

You make a short explainer in which one dot carries the whole film. Each scene is a **move**: what the dot becomes
next. Every move starts exactly where the last one left the dot and ends with the dot whole again, so the film
never cuts. The film is an HTML page on a frame-by-frame engine: it plays and scrubs in a browser, and
`scripts/render.mjs` renders every frame to MP4, so nothing drops however busy a scene is.

`<skill>` below means this skill's folder: the folder this `SKILL.md` is in.

Output: a folder with `index.html` (the film, editable) and `out/<name>-16x9.mp4`, `-9x16.mp4`, `-1x1.mp4`.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | what the product does, its name, 4–8 short facts, the URL | what the user said (`/leading-dot explain how Nimbus turns meetings into notes` in Claude Code, `$leading-dot …` in Codex, or "make a dot explainer for …"); ask only for what you can't infer |
| Node 18+ | the renderer | `node -v` |
| Chrome or Edge | renders the frames, headless | an installed Chrome or Edge; otherwise `npx playwright install chromium` |
| ffmpeg | turns the frames into MP4 | `ffmpeg -version`; install with `brew install ffmpeg`, `winget install Gyan.FFmpeg` or `apt install ffmpeg` |

No credits and no API keys. The film loads its font from Google Fonts; the renderer installs `playwright-core` once
from npm into a cache folder (never into the project) and drives the installed browser.

## Steps

1. **Copy** `<skill>/assets/template/` to `./<brand>-dot/`. Never edit the skill's own files.
2. **Write the story first, as lines of text**, then pick a move for each line (`references/moves.md`):
   - Start with `drop` (or `pulse` for alerts and anything that "pings"). End with `logo`.
   - One idea per scene, 3–7 words per caption. 6–9 scenes make 20–30 s.
   - Pick moves by meaning: a product screen → `grow`; parts, steps or features → `split`; growth over time →
     `line`; a share or a score → `ring`; integrations → `orbit`; an action → `button`; a prompt or a search →
     `type`; a key line → `bounce`; a turn in the story → `fill`.
   - Never the same move twice in a row, and no move more than twice in a film.
3. **Fill the `LeadingDot.film({...})` block** in `index.html`: `theme`, `font`, `scenes`. Nothing else changes.
   `*word*` sets a word in the accent colour; use it once or twice per film.
4. **Theme**: `paper` (an ink dot on warm paper), `night` (coral on navy), `mono`, `citrus`, `sky`, or the brand's own
   `colors: { bg, dot, ink, accent }`. The dot and the background swap at every `fill`, so they must contrast both ways.
5. **Preview**: serve the folder (`python3 -m http.server 5190 -d ./<brand>-dot`) and open it in your browser or
   preview tool. Space plays, ← → step a frame, `[` `]` jump between scenes; the links under the film switch 16:9,
   9:16 and 1:1. **Without a browser**, go straight to the contact sheet: it shows every scene.
6. **Check** before the long render (`references/motion-rules.md`, section 9):
   ```bash
   node <skill>/scripts/render.mjs sheet ./<brand>-dot/index.html --scenes --format all
   ```
   Open the three sheets (they're PNG images) and look for clipped or overlapping text and captions that wrap badly
   in 9:16. Fix the wording, not the engine.
7. **Render**:
   ```bash
   node <skill>/scripts/render.mjs video ./<brand>-dot/index.html --format all
   ```
   `--draft` renders a quick half-size check, `--audio track.mp3` lays a track under it, `--fps 60` is smoother.
8. **Hand over**: the three MP4s, the folder, which moves and theme you chose and why, and how to change a line (edit
   `scenes`, render again).

## Rules

- Every number, quote and screenshot comes from the user. Without a real number, use moves that don't need one
  (`split`, `type`, `button`) instead of `line` or `ring`.
- `grow` takes `image: "screens/app.png"` (the user's own screenshot: 9:19.5 for `phone`, 16:10 for `browser`) or a
  `card` drawn in the film's colours. Never draw someone else's interface.
- Keep captions short enough to read. Each scene holds at least 1.2 s after its words land, but a seven-word
  caption on a 2 s scene still loses people; give a long line its own `bounce` or `fill`.
- Don't edit `leading-dot.js` for one film. If a move is missing, combine existing ones; if you must add one, follow
  the contract at the end of `references/moves.md` (starts at the previous dot, ends with one dot).
- Silent by default: suggest a track and mention `--audio`.

`assets/examples/` holds two more films on the same template: `beacon.html` (night, pulse, orbit, ring, button) and
`kitty.html` (sky, vertical).
