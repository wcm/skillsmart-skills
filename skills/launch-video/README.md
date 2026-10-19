# Launch Video — a Skillsmart skill

Make a **20–40 second product launch film** from a few lines and your own screenshots: hook, problem, product
reveal, features, one proof number, logo and date.

- **Five styles, one story.** *Clean* (soft light, a tilted browser, speed-matched slides), *drafting* (a technical
  drawing with dimension lines and callouts), *paper* (cut paper and printed screenshots, stop motion), *pixel* (an
  8-bit night with dithered screens) and *bold* (huge capitals on hard cuts). Your agent picks one from the product.
- **Your product on screen.** Real screenshots in a browser or phone, with slow zooms into the part that matters.
- **Honest by design.** No proof scene without a real, sourced number; no invented customers.
- **Every format, frame-perfect.** 16:9, 9:16 and 1:1 from one story, every frame rendered on its own.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/launch-video](https://skillsmart.io/skills/launch-video)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add launch-video
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
|---|---|
| Claude Code | `/launch-video Orbit 2.0 launches 1 December at orbit.app` (attach screenshots) |
| Codex | `$launch-video our 3.0 release next Tuesday, bold style` |
| Any agent | "Make a launch video for our app from these screenshots." |

The agent writes the words with you, fills one block in the template, checks every scene on a contact sheet, and
renders the MP4s.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg for the MP4s. No
credits and no API keys: everything is drawn in code. The renderer installs `playwright-core` once from npm into a
cache folder, never into your project.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/story.md              the six scenes and what to write for each
references/styles.md             the five styles: how they look and move, and what each suits
assets/template/                 the film: index.html (the story block), launch-video.js, launch-video.css, film.js,
                                 film.css and sample screens/
scripts/render.mjs               renders every frame to MP4 (or a contact sheet, a still, a transparent video)
references/motion-rules.md       the timing, easing, cut, type and honesty rules every film follows
```

### How a project is laid out

```
orbit-launch/
  index.html                     the film (?style=paper previews another style)
  screens/                       your screenshots
  launch-video.js, launch-video.css, film.js, film.css
  out/orbit-launch-16x9.mp4      the renders (and -9x16, -1x1)
```

The film is a plain HTML page: preview it through any static server, edit the one block, render again.
