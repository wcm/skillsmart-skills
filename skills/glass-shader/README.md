# Glass Shader — a Skillsmart skill

Build a **landing-page hero where a pane of glass sits over the page** and shows itself only by bending what's
behind it:

- **Four kinds of glass:** full-page reeded glass over a moving gradient, a fogged window you wipe to see a rainy
  street, water drops of every size on a photo, and a wall of thick frosted tiles over a glowing ball.
- **Real refraction, nothing painted on.** What's behind is magnified, squeezed, frosted and split into red and blue at
  the edges; no outlines or highlights are drawn. The glass stays still while the backdrop answers the cursor.
- **A real page around it.** Your agent writes the brand, headline, copy and call to action, picks the type and colours,
  and lays it out for wide screens, tall windows and phones.

Four complete pages ship as examples in `assets/examples/`: *Pane* (privacy analytics, reeded), *Monsoon Radio* (live
rain, steam), *Dewfall* (flowers by the week, drops) and *Sunbank* (home batteries, tiles), with their two photos.
For an abstract 3D glass object instead, see [Glass Hero](https://skillsmart.io/skills/glass-hero).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/glass-shader](https://skillsmart.io/skills/glass-shader)**: click **Get skill**,
copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add glass-shader
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the page is for:

| Agent | Say |
|---|---|
| Claude Code | `/glass-shader a launch page for Pane, privacy-first web analytics` |
| Codex | `$glass-shader a live rain radio called Monsoon, fogged window` |
| Any agent | "Make a frosted glass hero for our home battery, warm and bright" |

The agent picks the glass and its backdrop, scaffolds the page from the closest example, writes the page and checks it
in a browser.

**What you need:** Python 3, a modern browser and an internet connection for Google Fonts. Reeded and Tiles need
nothing else. Steam and Liquid sit over a photo: your own, the example's, or a new one generated through your
Skillsmart account (Node 18+, 20 credits a photo).

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  engine.md                      the page, mount(), the backdrops and every option of every look
  design.md                      how glass shows itself, backdrops, layouts and copy
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project, or adds a page to one, from an example
assets/engine/                   core.js (the WebGL2 runtime), backdrop.js, looks/, glsl.js, page.css
assets/examples/                 reeded, steam, liquid, tiles: four complete pages
assets/img/                      the examples' photos (a rainy street, flowers)
assets/tools/                    photo.mjs + photos.json (generate a photo with credits), gen.mjs
```

### How a generated project is laid out

```
pane-hero/
  site/                          serve this folder (python3 -m http.server 8000 -d site)
    index.html                   the page: copy, styles and the mount() call with its options
    engine/                      the WebGL2 runtime, the backdrops, the four looks and the page shell
    img/                         the photos a look sits over
  tools/                         node photo.mjs <id> --prompt "…" (20 credits) → site/img/<id>.jpg
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
Without WebGL2 the hero shows a CSS fallback, and with reduced motion a single still frame.
