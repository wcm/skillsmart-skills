# Fluid Shader — a Skillsmart skill

Build a **landing-page hero around a gentle liquid** that you can touch:

- **Four liquids on the GPU**, kept thick and calm: glowing colour clouds in dark water and a soap film with true
  thin-film interference colour (both a real fluid simulation), ink floating on water the way marbled paper is made,
  and liquid chrome you light with the cursor.
- **A delicate touch.** The cursor draws the liquid along (or, on the chrome, moves the light) and a click lets
  something open slowly: a bloom, a ring, a new drop, a fresh film. Nothing churns.
- **A real page around it.** Your agent writes the brand, headline, copy and call to action, picks the type and colours,
  and lays it out for wide screens, tall windows and phones.

Four complete pages ship as examples in `assets/examples/`: *Tincture* (colour grading, dye), *Ingot* (headphones,
chrome), *Endpaper* (marbled notebooks) and *Bulle* (a skin tint, soap film).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/fluid-shader](https://skillsmart.io/skills/fluid-shader)**: click **Get skill**,
copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add fluid-shader
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the page is for:

| Agent | Say |
|---|---|
| Claude Code | `/fluid-shader a launch page for Tincture, a colour-grading app` |
| Codex | `$fluid-shader marbled notebooks from a small bindery called Endpaper` |
| Any agent | "Make a liquid chrome hero for our headphones" |

The agent picks the look and its palette, scaffolds the page from the closest example, writes the page and checks it
in a browser.

**What you need:** Python 3, a modern browser and an internet connection for Google Fonts. No API keys, no credits:
the liquid is code (WebGL2, no libraries).

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  engine.md                      the page, mount(), the solver's API and every option of every look
  design.md                      the gentle touch, colour, the layouts and copy
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project, or adds a page to one, from an example
assets/engine/                   core.js (the WebGL2 runtime), fluid.js (the solver), looks/, glsl.js, page.css
assets/examples/                 dye, chrome, marble, film: four complete pages
```

### How a generated project is laid out

```
tincture-hero/
  site/                          serve this folder (python3 -m http.server 8000 -d site)
    index.html                   the page: copy, styles and the mount() call with its options
    engine/                      the WebGL2 runtime, the solver, the four looks and the page shell
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
Without WebGL2 the hero shows a CSS fallback, and with reduced motion a single still frame.
