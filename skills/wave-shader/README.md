# Wave Shader — a Skillsmart skill

Build a **landing-page hero over a live, wavy gradient shader** that drifts slowly and answers the cursor:

- **One engine, four looks.** A wavy surface of colour seen by a camera, lit and grained: warm silk folds seen from
  above, a ragged aurora curtain over a treeline, a satin sea rolling to a low sun, and a vivid silky ribbon in shallow
  focus. A new look is a new preset of the same engine.
- **Calm, premium motion.** The colour drifts slowly, the surface leans toward the cursor and a click sends a ring of
  waves across it.
- **A real page around it.** Your agent writes the brand, headline, copy and call to action, picks the type and colours
  to match the palette, and lays it out for wide screens, tall windows and phones.

Four complete pages ship as examples in `assets/examples/`: *Sorbet* (a palette tool, silk), *Kp9* (aurora alerts),
*Meltemi* (small-boat sailing, a sea) and *Brio* (global payroll, a ribbon).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/wave-shader](https://skillsmart.io/skills/wave-shader)**: click **Get skill**,
copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add wave-shader
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the page is for:

| Agent | Say |
|---|---|
| Claude Code | `/wave-shader a launch page for Sorbet, a colour palette tool, warm and soft` |
| Codex | `$wave-shader an aurora alerts app called Kp9, night sky` |
| Any agent | "Make a wave shader hero for our payroll product, bold and colourful on white" |

The agent picks the look and its palette, scaffolds the page from the closest example, writes the page and checks it
in a browser.

**What you need:** Python 3, a modern browser and an internet connection for Google Fonts. No API keys, no credits:
the colour is code (WebGL2, no libraries).

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  engine.md                      the page, mount(), every preset field and the three shapes
  design.md                      one feeling, colour, the layouts, copy and motion
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project, or adds a page to one, from an example
assets/engine/                   core.js (the WebGL2 runtime), wave.js (the engine), presets.js, glsl.js, page.css
assets/examples/                 haze, aurora, swell, ribbon: four complete pages
```

### How a generated project is laid out

```
sorbet-hero/
  site/                          serve this folder (python3 -m http.server 8000 -d site)
    index.html                   the page: copy, styles and the mount() call with its preset
    engine/                      the WebGL2 runtime, the wave engine, its presets and the page shell
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
Without WebGL2 the hero shows a CSS gradient, and with reduced motion a single still frame.
