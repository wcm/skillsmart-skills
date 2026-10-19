# Leading Dot — a Skillsmart skill

Make a **15–30 second explainer where one dot carries the whole film**, with no cuts: it drops in, bounces
across the words, grows into a phone screen, splits into features, draws a chart, types a prompt, floods the frame
and lands as the dot of your logo's *i*.

- **Twelve moves, one continuous take.** Drop, bounce, grow, split, line, ring, pulse, orbit, button, type, fill and
  logo. Every move starts where the last one left the dot, so the film never cuts; dots split and merge like liquid.
- **Your story, not a template.** Your agent writes the story first, then picks the move that means each line: a
  screen for the product, a split for features, a line for growth, a ring for a share.
- **Every format from one story.** 16:9, 9:16 and 1:1 lay themselves out; five themes or your own colours.
- **Frame-perfect.** Each frame is rendered on its own, so busy scenes never stutter.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/leading-dot](https://skillsmart.io/skills/leading-dot)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add leading-dot
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
|---|---|
| Claude Code | `/leading-dot explain how Nimbus turns meetings into notes` |
| Codex | `$leading-dot a 20-second explainer for our incident alerts, night theme` |
| Any agent | "Make a dot explainer for our savings app, vertical." |

The agent writes the words with you, fills one block in the template, checks every scene on a contact sheet, and
renders the MP4s.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg for the MP4s. No
credits and no API keys: everything is drawn in code. The renderer installs `playwright-core` once from npm into a
cache folder, never into your project.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/moves.md              the twelve moves: what each needs and how long it runs
assets/template/                 the film: index.html (the story block is the only part you edit), leading-dot.js,
                                 leading-dot.css, film.js and film.css (the engine)
assets/examples/                 beacon.html (night) and kitty.html (sky, vertical)
scripts/render.mjs               renders every frame to MP4 (or a contact sheet, a still, a transparent video)
references/motion-rules.md       the timing, easing, cut, type and honesty rules every film follows
```

### How a project is laid out

```
nimbus-dot/
  index.html                     the film: open it through any static server to play and scrub it
  leading-dot.js, leading-dot.css, film.js, film.css
  out/nimbus-dot-16x9.mp4        the renders (and -9x16, -1x1)
```

The film is a plain HTML page: preview it through any static server, edit the one block, render again.
