---
name: kinetic-type-teaser
description: Make a 10–15 second kinetic typography teaser video — big words snapping, wiping and scrolling on hard cuts with one accent colour — for launches, events, announcements and social posts, built in HTML/CSS and recorded to MP4/WebM in 16:9 or vertical 9:16. Use for "teaser video", "launch video", "animated text video", "kinetic type", "motion graphics for my announcement" or short promo reels without footage.
---

# Kinetic Type Teaser

Output: `teaser.html` (plays in the browser, click to replay) and `out/teaser.webm` (+ `out/teaser.mp4` if ffmpeg is available).

## What you need

- The message: what's launching/happening, the brand, a date or URL.
- Node 18+, Chrome/Edge or Playwright's Chromium. **ffmpeg** (optional) to convert to MP4 — `brew install ffmpeg` / `winget install Gyan.FFmpeg`.

## Steps

1. **Copy** `assets/template/teaser.html` and `scripts/render.mjs` into `./teaser-<name>/`.
2. **Write the script** (`references/motion-script.md`): 6 beats, each 1–3 words. Pattern: tease → word → flash word → three-line stack → marquee → brand + date/URL.
3. **Fill placeholders.** Keep words short: ≤ 8 characters at 300 px (16:9). For vertical, set `--w: 1080px; --h: 1920px;` and reduce `.word` to ~200 px.
4. **Style.** `--bg`, `--ink`, `--accent` (one loud accent), display font (Anton default; alternatives in the reference).
5. **Timing.** Adjust `at`/`dur` in `SHOTS`. Total 10–15 s. Keep cuts on a steady rhythm (multiples of ~0.2 s feel musical).
6. **Preview** by opening it in a browser (serve it: `python3 -m http.server 5181`); click to replay.
7. **Record:**
   ```bash
   npm i --no-save playwright-core
   node render.mjs video teaser.html --out out/teaser.webm --width 1920 --height 1080 --duration 12.5
   ffmpeg -y -i out/teaser.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart out/teaser.mp4   # optional
   ```
   Use `--width 1080 --height 1920` for vertical. `--duration` = total timeline + 0.3 s.
8. **Check** the video yourself if you can (extract a few frames with ffmpeg: `ffmpeg -i out/teaser.webm -vf fps=2 out/frame-%02d.png`) for clipped words. Fix and re-record.

## Rules

- No audio is added; suggest the user add a track in their editor or social app.
- Respect flashing-content safety: no more than 3 full-screen flashes per second.
