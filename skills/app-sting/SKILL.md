---
name: app-sting
description: Make a 10–15 second looping app sting from the user's own screenshots — the logo, then 3–5 screens in a phone or a browser joined by speed-matched whip pans with motion blur, each screen doing one thing (a tap, a toast, a number counting up), and back to the logo so it loops without a seam. MP4 in 16:9, 9:16 and 1:1. Use for an app promo, UI animation, product sting, screens video, feature loop, App Store or social preview, conference bumper, or to animate device mockups, even when the user only sends screenshots.
---

# App Sting

You make a short loop that shows a product moving. Every cut is one whip pan in which the outgoing and the incoming
shot share the same move, so the speed always matches across the cut, and the last frame is the first, so it loops.
The sting is an HTML page on a frame-by-frame engine: it plays in a browser, and `scripts/render.mjs` renders every
frame to MP4.

`<skill>` below means this skill's folder: the folder this `SKILL.md` is in.

## What you need

| Need | Why | How |
|---|---|---|
| The user's screenshots | 3–5 of their own product: phone (9:19.5) or desktop (16:10) | ask for them; never draw an interface you haven't been given |
| A brief | the name or logo, the URL, the brand colours, what each screen does | what the user said (`/app-sting a 12-second loop of these four screenshots` in Claude Code, `$app-sting …` in Codex, or "animate these screens") |
| Node 18+ | the renderer | `node -v` |
| Chrome or Edge | renders the frames, headless | an installed Chrome or Edge; otherwise `npx playwright install chromium` |
| ffmpeg | turns the frames into MP4 | `ffmpeg -version`; install with `brew install ffmpeg`, `winget install Gyan.FFmpeg` or `apt install ffmpeg` |

No credits and no API keys. The sting loads its fonts from Google Fonts; the renderer installs `playwright-core` once
from npm into a cache folder (never into the project) and drives the installed browser.

## Steps

1. **Copy** `<skill>/assets/template/` to `./<brand>-sting/` and put the screenshots in `screens/`, in place of the
   sample Orbit screens.
2. **Order the shots** (`references/shots.md`): the screen people see first, then one number, then navigation, then
   the create action. Give each a 1–2 word `label`.
3. **Fill the `AppSting.film({...})` block**: `brand`, `logo`, `url`, `colors: { ground, ink, accent, hairline }`,
   `shots`. Tap points are fractions of the screenshot (`[0.5, 0.44]` is the middle, 44 % down).
4. **Preview**: serve the folder (`python3 -m http.server 5193 -d ./<brand>-sting`) and open it in your browser or
   preview tool; step to each tap with ← → and check it lands on the button. **Without a browser**, use the sheet and
   `render.mjs still … --t <seconds>` on each tap.
5. **Check**: `node <skill>/scripts/render.mjs sheet ./<brand>-sting/index.html --scenes --format all`.
6. **Render** at 60 fps (the pans are fast):
   ```bash
   node <skill>/scripts/render.mjs video ./<brand>-sting/index.html --format all --fps 60
   ```
7. **Hand over**: the MP4s (they loop: set them to repeat), the folder, and how to swap a screen.

## Rules

- Only the user's own screens. If a slot has no real screen (no navigation, no create action), drop the shot; never
  invent an interface or borrow someone else's.
- `number` only with a real figure; `toast` text says what the tap really does.
- One action per shot. A sting has no room for explanation; for that, make a launch video.

`assets/examples/tempo.html` is a second sting: four phone screens of a running app on lime, square.
