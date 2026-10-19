---
name: stat-reel
description: Turn 3–6 real numbers into a 15–30 second vertical video — each stat gets the chart its data needs (a big counter, a progress ring, before-and-after bars with the change worked out, columns over time, a ranking, parts of a whole), counts up on a bold colour block, shows its source, and wipes to the next. Three themes (wrapped colour blocks, ledger report, night glow); MP4 in 9:16, 16:9 and 1:1. Use for a stats video, numbers reel, year in review, wrapped-style recap, metrics post, investor update, milestone or impact report video.
---

# Stat Reel

You turn numbers into a reel. The chart comes from the shape of each stat, every scale starts at zero, and each
number can carry its source on screen. The reel is an HTML page on a frame-by-frame engine: it plays in a browser,
and `scripts/render.mjs` renders every frame to MP4.

`<skill>` below means this skill's folder: the folder this `SKILL.md` is in.

## What you need

| Need | Why | How |
|---|---|---|
| The numbers | 3–6 **real** figures, what each measures, where each comes from | what the user said (`/stat-reel our 2026 in five numbers` in Claude Code, `$stat-reel …` in Codex, or "make a video of these stats"); plus a title, the brand, the URL, a closing line |
| Node 18+ | the renderer | `node -v` |
| Chrome or Edge | renders the frames, headless | an installed Chrome or Edge; otherwise `npx playwright install chromium` |
| ffmpeg | turns the frames into MP4 | `ffmpeg -version`; install with `brew install ffmpeg`, `winget install Gyan.FFmpeg` or `apt install ffmpeg` |

No credits and no API keys. The reel loads its fonts from Google Fonts; the renderer installs `playwright-core` once
from npm into a cache folder (never into the project) and drives the installed browser.

## Steps

1. **Copy** `<skill>/assets/template/` to `./<brand>-stats/`.
2. **Write the stats** (`references/stats.md`): one number per stat, a label that says what it measures in 3–7 words,
   the source. Order them: the biggest or most surprising first, the most human last.
3. **Pick the theme**: `wrapped` (saturated colour blocks, the recap look), `ledger` (an annual report: paper, mono
   figures, one green), `night` (dark with a glowing gradient). Or set `colors`.
4. **Fill the `StatReel.film({...})` block**. Nothing else changes.
5. **Preview**: serve the folder (`python3 -m http.server 5194 -d ./<brand>-stats`) and open it with `?format=9x16`
   in your browser or preview tool. **Without a browser**, go straight to the sheet.
6. **Check**: `node <skill>/scripts/render.mjs sheet ./<brand>-stats/index.html --scenes --format 9x16`. Open the sheet:
   every number must finish counting before its scene leaves, and no label may wrap past two lines.
7. **Render**:
   ```bash
   node <skill>/scripts/render.mjs video ./<brand>-stats/index.html --format 9x16,16x9,1x1
   ```
8. **Hand over**: the MP4s and the folder; say which chart each stat got.

## Rules

- Never invent, round up or "estimate" a number. A missing number means no stat; a claim without a source gets no
  scene.
- Charts start at zero; don't add a `max` or axis tricks to make a change look bigger.
- `compare` writes its own headline from the two values ("3.4× less"); check it reads right, or set `headline`.
- Be clear about time in each label: "per week", "in 2026", "since launch".
