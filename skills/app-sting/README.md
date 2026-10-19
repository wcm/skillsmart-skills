# App Sting — a Skillsmart skill

Make a **10–15 second looping sting** from your own screenshots: your logo, then your screens in a phone or a
browser, joined by whip pans, and back to the logo.

- **Cuts that feel like one move.** The outgoing and incoming screens share every pan, so the speed always matches,
  with motion blur at the fastest frames.
- **One action per screen.** A tap (with a cursor on desktop screens), a toast that says what happened, or a sticker
  that counts up to a real number.
- **A seamless loop.** The last frame is the first; corner labels and a hairline frame in your colours.
- **Every format, frame-perfect.** 16:9, 9:16 and 1:1, rendered frame by frame at 60 fps.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/app-sting](https://skillsmart.io/skills/app-sting)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add app-sting
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
|---|---|
| Claude Code | `/app-sting a 12-second loop of these four screenshots, brand colour #4B4BE8` |
| Codex | `$app-sting a square loop of our running app's screens` |
| Any agent | "Animate these app screenshots into a short loop for social." |

The agent writes the words with you, fills one block in the template, checks every scene on a contact sheet, and
renders the MP4s.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg for the MP4s. No
credits and no API keys: everything is drawn in code. The renderer installs `playwright-core` once from npm into a
cache folder, never into your project.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/shots.md              the shots, their actions, colours and timing
assets/template/                 the sting: index.html (the block you edit), app-sting.js, app-sting.css, film.js,
                                 film.css and sample screens/
assets/examples/tempo.html       a second sting: a running app's phone screens on lime
scripts/render.mjs               renders every frame to MP4 (or a contact sheet, a still, a transparent video)
references/motion-rules.md       the timing, easing, cut, type and honesty rules every film follows
```

### How a project is laid out

```
orbit-sting/
  index.html                     the sting
  screens/                       your screenshots
  out/orbit-sting-16x9.mp4       the renders (and -9x16, -1x1); they loop
```

The film is a plain HTML page: preview it through any static server, edit the one block, render again.
