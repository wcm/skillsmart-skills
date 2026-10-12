# Glass Hero — a Skillsmart skill

Build a **landing-page hero around an abstract 3D glass object** that splits white light into vivid rainbows and
answers the cursor:

- **Real dispersive glass.** Several wavelengths are followed through the object's actual thickness, so every edge
  splits into its spectrum, live, in WebGL.
- **Four pieces, each with its own light:** prism rods bursting from a core on black, a wall of glass blocks on a pale
  ruled page, a ribbed glass knot in a dark room of coloured glows, and a glass flower seen through a soft old lens.
  Two light-only extras: a long-exposure halo and prism-fringed smoke.
- **A real page around it.** Your agent writes the brand, headline, copy and call to action, picks the type and
  colours to match the light, and lays it out for wide screens, tall windows and phones.

Four complete pages ship as examples in `assets/examples/`: *Spectra* (an AI lab), *Brique* (glass blocks), *Loop*
(a design festival) and *Iris Nº 4* (a perfume).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/glass-hero](https://skillsmart.io/skills/glass-hero)**: click **Get skill**, copy
the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add glass-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the page is for:

| Agent | Say |
|---|---|
| Claude Code | `/glass-hero a launch page for Halden, an AI camera that sees in the dark` |
| Codex | `$glass-hero a perfume called Nuit, soft and glowing` |
| Any agent | "Make a glass hero for our architecture studio, light and calm" |

The agent picks the piece and its light, scaffolds the page from the closest example, writes the page and checks it in
a browser.

**What you need:** Python 3, a modern browser and an internet connection (three.js loads from jsDelivr, fonts from
Google Fonts). No API keys, no credits: the glass and its light are code.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  pieces.md                      the four pieces and two extras: what each suits and the knobs that change it
  glass.md                       the page-module contract, the stage and slot, the glass material and its hooks,
                                 the studio, backdrop, lens, post and trackball
  design.md                      composition, copy, type and colour
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project, or adds a page to one, from an example
assets/template/site/            index.html, main.js, base.css, engine/ (glass, stage, lens, post, trackball)
assets/examples/                 urchin, cubes, twist, flower (+ halo, plume): each a page module + CSS
```

### How a generated project is laid out

```
glass-halden/
  site/                          serve this folder (python3 -m http.server 5191 -d site), open /#halden
    index.html main.js base.css
    engine/                      the glass, the stage, lens, post, trackball
    themes/
      pages.json, index.js       the pages (index.js is generated)
      halden.js, halden.css      the page: copy, light, object, motion, styles
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
