# Stat Reel — a Skillsmart skill

Turn **3–6 real numbers into a 15–30 second vertical reel**: each stat gets the chart its data needs, counts up
on a bold colour block and shows its source.

- **The chart picks itself.** A big counter, a ring for a share, before-and-after bars with the change worked out
  ("3.4× less"), columns over time, a ranking, or parts of a whole.
- **Three themes.** *Wrapped* (a saturated block for every stat), *ledger* (an annual report) and *night* (a glowing
  gradient).
- **Honest charts.** Every scale starts at zero, sources sit on screen, and the skill refuses invented numbers.
- **Vertical first.** 9:16 for Reels, TikTok and Stories, plus 16:9 and 1:1 from the same numbers.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/stat-reel](https://skillsmart.io/skills/stat-reel)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add stat-reel
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
|---|---|
| Claude Code | `/stat-reel our 2026 in five numbers` |
| Codex | `$stat-reel this quarter's metrics for investors, ledger theme` |
| Any agent | "Make a short video of these stats for Instagram." |

The agent writes the words with you, fills one block in the template, checks every scene on a contact sheet, and
renders the MP4s.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg for the MP4s. No
credits and no API keys: everything is drawn in code. The renderer installs `playwright-core` once from npm into a
cache folder, never into your project.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/stats.md              the chart kinds, the fields, the themes
assets/template/                 the reel: index.html (the numbers block), stat-reel.js, stat-reel.css, film.js, film.css
scripts/render.mjs               renders every frame to MP4 (or a contact sheet, a still, a transparent video)
references/motion-rules.md       the timing, easing, cut, type and honesty rules every film follows
```

### How a project is laid out

```
orbit-stats/
  index.html                     the reel (?format=9x16)
  out/orbit-stats-9x16.mp4       the renders (and -16x9, -1x1)
```

The film is a plain HTML page: preview it through any static server, edit the one block, render again.
