# Logo Sting — a Skillsmart skill

Make a **5–8 second logo reveal or outro** from your SVG, transparent PNG or just your name, ending on your real
logo, crisp.

- **Six looks.** *Line* (the outline draws itself, traced from your file), *particles* (thousands of specks settle into
  the mark), *liquid* (a glossy bead the mark swells out of), *ink* (blooming into grained paper), *glass* (a lens
  sweeps across) and *chrome* (a light wipe raises it as polished metal).
- **Drop it over anything.** Besides MP4 in 16:9, 9:16 and 1:1, it renders a transparent ProRes 4444 `.mov` and WebM.
- **Your file, exactly.** Every look but chrome settles on your own logo file, colours and all.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/logo-sting](https://skillsmart.io/skills/logo-sting)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add logo-sting
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
|---|---|
| Claude Code | `/logo-sting reveal logo.svg in liquid, 6 seconds` |
| Codex | `$logo-sting an ink outro for our wordmark, with a transparent version` |
| Any agent | "Animate my logo for the end of our video." |

The agent writes the words with you, fills one block in the template, checks every scene on a contact sheet, and
renders the MP4s.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg for the MP4s. No
credits and no API keys: everything is drawn in code. The renderer installs `playwright-core` once from npm into a
cache folder, never into your project.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/looks.md              the six looks, the fields and the timing
assets/template/                 the sting: index.html (the block you edit), logo-sting.js (WebGL and SVG),
                                 logo-sting.css, film.js, film.css
assets/examples/orbit.html       an SVG mark instead of a wordmark
scripts/render.mjs               renders every frame to MP4 (or a contact sheet, a still, a transparent video)
references/motion-rules.md       the timing, easing, cut, type and honesty rules every film follows
```

### How a project is laid out

```
nimbus-sting/
  index.html                     the sting (?look=ink tries another look)
  logo.svg                       your mark
  out/nimbus-sting-16x9.mp4      the renders; with --alpha, -16x9.mov and -16x9.webm without a background
```

The film is a plain HTML page: preview it through any static server, edit the one block, render again.
