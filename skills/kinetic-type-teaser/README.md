# Kinetic Type Teaser — a Skillsmart skill

Make a **10–30 second kinetic typography teaser** for a launch or an announcement, with no footage: big words on
hard cuts with one accent colour.

- **Five styles.** *Loud* (condensed capitals on black), *swiss* (flush left on a grid, red), *memphis* (pink, confetti
  shapes, bouncy), *xerox* (photocopy grain and halftone, stop motion) and *bauhaus* (primary shapes that rearrange).
- **Ten beats.** Tease, word, flash, stack, marquee and end for 12 s; type, split, count and grid for 20–30 s cuts.
- **Every format, frame-perfect.** Words fit themselves to 16:9, 9:16 and 1:1; every frame is rendered on its own.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/kinetic-type-teaser](https://skillsmart.io/skills/kinetic-type-teaser)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add kinetic-type-teaser
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
|---|---|
| Claude Code | `/kinetic-type-teaser a 12-second vertical teaser for Orbit 2.0 on 1 December, orbit.app` |
| Codex | `$kinetic-type-teaser a coming-soon teaser for our event, bauhaus style` |
| Any agent | "Make a short animated text teaser for our launch." |

The agent writes the words with you, fills one block in the template, checks every scene on a contact sheet, and
renders the MP4s.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg for the MP4s. No
credits and no API keys: everything is drawn in code. The renderer installs `playwright-core` once from npm into a
cache folder, never into your project.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/motion-script.md      the beats, their lengths and the five styles
assets/template/                 the teaser: index.html (the script block), kinetic.js, kinetic.css, film.js, film.css
assets/examples/long.html        a 24-second script with every beat
scripts/render.mjs               renders every frame to MP4 (or a contact sheet, a still, a transparent video)
references/motion-rules.md       the timing, easing, cut, type and honesty rules every film follows
```

### How a project is laid out

```
teaser-orbit/
  index.html                     the teaser (?style=xerox tries another style)
  out/teaser-orbit-16x9.mp4      the renders (and -9x16, -1x1)
```

The film is a plain HTML page: preview it through any static server, edit the one block, render again.
