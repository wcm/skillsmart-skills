---
name: logo-sting
description: Make a 5–8 second animated logo reveal or outro from the user's SVG, transparent PNG or just a wordmark — the outline drawing itself, particles flying in, a liquid bead the mark grows out of, ink blooming into paper, a glass lens sweeping across, or polished chrome under a moving light — ending on the real logo, crisp. MP4 in 16:9, 9:16 and 1:1, plus a transparent ProRes .mov and WebM to drop over any edit. Use for a logo animation, logo reveal, logo sting, intro or outro, animated logo, bumper or end card, even when the user only names their brand.
---

# Logo Sting

You make a short logo reveal in one of six looks. The sting is an HTML page on a frame-by-frame engine (WebGL for
liquid, ink, glass and chrome): it plays in a browser, and `scripts/render.mjs` renders every frame to MP4, or to a
transparent ProRes 4444 `.mov` and VP9 `.webm` with `--alpha`.

`<skill>` below means this skill's folder: the folder this `SKILL.md` is in.

## What you need

| Need | Why | How |
|---|---|---|
| The logo | the mark the sting reveals | the user's **SVG** (best) or a **transparent PNG** at least 1200 px wide; no file → set the name as a `wordmark` in their typeface (any Google font) |
| A brief | the look, the colours, the length | what the user said (`/logo-sting reveal logo.svg in liquid, 6 seconds` in Claude Code, `$logo-sting …` in Codex, or "animate my logo"); colours from their site or brand board |
| Node 18+ | the renderer | `node -v` |
| Chrome or Edge | renders the frames, headless, with the GPU | an installed Chrome or Edge; otherwise `npx playwright install chromium` |
| ffmpeg | MP4, ProRes and WebM | `ffmpeg -version`; install with `brew install ffmpeg`, `winget install Gyan.FFmpeg` or `apt install ffmpeg` |

No credits and no API keys. A wordmark loads its font from Google Fonts; the renderer installs `playwright-core` once
from npm into a cache folder (never into the project) and drives the installed browser.

## Steps

1. **Copy** `<skill>/assets/template/` to `./<brand>-sting/` and put the logo file in it.
2. **Pick the look** (`references/looks.md`) from the brand's character, and the length (5–8 s; 6 is a good default,
   8 for the end of a longer film).
3. **Fill the `LogoSting.film({...})` block**: `look`, `logo: "logo.svg"` (or `wordmark`), `colors`, `tagline` (the URL
   or a short line, optional), `duration`. Nothing else changes.
4. **Preview**: serve the folder (`python3 -m http.server 5192 -d ./<brand>-sting`) and open it in your browser or
   preview tool; `?look=ink` tries another look without editing. **Without a browser**, go straight to the sheet.
5. **Check**: `node <skill>/scripts/render.mjs sheet ./<brand>-sting/index.html --frames 8 --format all`. Open the
   sheets: the last frames must show the logo exactly as the file draws it, and the mark must not touch the frame
   edge in 9:16.
6. **Render**:
   ```bash
   node <skill>/scripts/render.mjs video ./<brand>-sting/index.html --format all
   node <skill>/scripts/render.mjs video ./<brand>-sting/index.html --format 16x9 --alpha
   ```
   The `--alpha` files have no background: ProRes 4444 for Premiere, Final Cut and Resolve, WebM for the web.
7. **Hand over**: the MP4s, the transparent files if asked, which look and why, and how to change colours or timing.

## Rules

- Only the user's own logo. Never recreate or trace someone else's mark.
- Every look except `chrome` ends on the user's actual file, so the colours and shapes are exactly theirs. `chrome`
  ends in chrome; offer it only when a metallic finish suits the brand.
- Thin, detailed or very wide marks: prefer `line`, `particles` or `ink`; `liquid` and `chrome` need some weight.
- Silent by default: `--audio whoosh.wav` lays a sound under it.

`assets/examples/orbit.html` reveals an SVG mark (`orbit-mark.svg`) instead of a wordmark.
