---
name: launch-video
description: Make a 20–40 second product launch video from a few lines and the user's own screenshots — hook, problem, product reveal, features, one proof number, logo and date — in one of five styles picked from the product (clean UI, technical drawing, cut paper, 8-bit pixel, bold type). One story renders to MP4 in 16:9, 9:16 and 1:1. Use for a launch video, product video, promo or announcement video, a feature or release video, a Product Hunt video, or a short film for a new app or version, even when all you get is a URL and some screenshots.
---

# Launch Video

You make a launch film from one story in six scenes, always in this order: hook → problem → product → features →
proof → end. Five styles change everything you see and how it moves. The film is an HTML page on a frame-by-frame
engine: it plays and scrubs in a browser, and `scripts/render.mjs` renders every frame to MP4.

`<skill>` below means this skill's folder: the folder this `SKILL.md` is in.

Output: a folder with `index.html` (the film, editable) and `out/<name>-16x9.mp4`, `-9x16.mp4`, `-1x1.mp4`.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | product name, what it does, launch date and URL, a real number if there is one | what the user said (`/launch-video Orbit 2.0 launches 1 December at orbit.app` in Claude Code, `$launch-video …` in Codex, or "make a launch video for …"); with only a URL, read the site for the words |
| The user's screenshots | 2–4 of their own product: 16:10 for a browser, 9:19.5 for a phone | ask for them; never draw an interface you haven't been given |
| Node 18+ | the renderer | `node -v` |
| Chrome or Edge | renders the frames, headless | an installed Chrome or Edge; otherwise `npx playwright install chromium` |
| ffmpeg | turns the frames into MP4 | `ffmpeg -version`; install with `brew install ffmpeg`, `winget install Gyan.FFmpeg` or `apt install ffmpeg` |

No credits and no API keys. The film loads its fonts from Google Fonts; the renderer installs `playwright-core` once
from npm into a cache folder (never into the project) and drives the installed browser.

## Steps

1. **Copy** `<skill>/assets/template/` to `./<brand>-launch/` and put the screenshots in its `screens/` folder, in place
   of the sample Orbit screens.
2. **Write the story** (`references/story.md`): a hook, 2–3 problem fragments, the product line, 1–4 features with a
   screenshot each, the proof (only a real, sourced number) and the end card. Read it aloud; cut every word you can.
3. **Pick the style** (`references/styles.md`) from the product and its audience. Set `style`, and `accent` to the
   brand colour.
4. **Fill the `LaunchVideo.film({...})` block** in `index.html`. Nothing else changes. Set `focus` on a feature when
   one part of its screenshot tells the story.
5. **Preview**: serve the folder (`python3 -m http.server 5191 -d ./<brand>-launch`) and open it in your browser or
   preview tool; `?style=paper` previews another style without editing. Space plays, ← → step a frame, `[` `]` jump
   between scenes. **Without a browser**, go straight to the contact sheet.
6. **Check** before the long render (`references/motion-rules.md`, section 9):
   ```bash
   node <skill>/scripts/render.mjs sheet ./<brand>-launch/index.html --scenes --format all
   ```
   Open the sheets (PNG images) and look for clipped or crowded text, especially in 9:16, and a screenshot whose
   important part is cropped (use `focus`). Fix the words first.
7. **Render**:
   ```bash
   node <skill>/scripts/render.mjs video ./<brand>-launch/index.html --format all
   ```
   `--draft` renders a quick half-size check, `--audio track.mp3` lays music under it, `--fps 60` smooths the clean
   style's slides. To try another style without editing: `--q:style bold`.
8. **Hand over**: the three MP4s, the folder, the style you picked and why in one line, and how to change a line.

## Rules

- Screenshots and numbers come from the user. Never invent a metric, a quote or a customer: no number, no proof
  scene. Never show someone else's product or logo.
- Keep the six scenes in order; drop `problem` or `proof` if there's nothing honest to say, rather than pad.
- Don't edit `launch-video.js` to make one film. To adjust a style, use `accent`, `colors` or `font`.
- Silent by default: suggest a track and mention `--audio`.
