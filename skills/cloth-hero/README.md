# Cloth Hero — a Skillsmart skill

Build a **landing-page hero where a picture becomes real cloth** that sags, ripples and answers the cursor:

- **Four kinds of cloth** on real-time physics: a printed sheet you pull and crease, split curtain panels you walk
  through, a bead curtain that strings your picture one bead per pixel, and a silk banner streaming in water or wind.
- **Any picture.** Bring your own, or let your agent generate the picture and the scene around it with your
  Skillsmart credits.
- **A real page around it.** Your agent writes the brand, headline, copy and details, picks the type, palette and
  sound, and lays it out for wide screens, tall windows and phones.

Four complete pages ship as examples in `assets/examples/`: *Afterhours* (holographic vinyl), *Noren* (indigo linen
panels), *Moon Gate* (a pearl bead curtain) and *Tide* (silk under water).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/cloth-hero](https://skillsmart.io/skills/cloth-hero)**: click **Get skill**, copy
the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add cloth-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the page is for, and optionally which cloth and picture:

| Agent | Say |
|---|---|
| Claude Code | `/cloth-hero a silk scarf brand called Mare, the scarf streaming under water` |
| Codex | `$cloth-hero a ramen shop with a noren curtain you walk through` |
| Any agent | "Make a cloth hero for my poster shop, with this print hanging as vinyl: print.png" |

The agent picks the cloth, scaffolds the page from the closest example, makes or places the pictures, writes the
page and checks it in a browser.

**What you need**

| | |
|---|---|
| Pictures | your own, or generated: each image is **20 Skillsmart credits**, about 40–60 for a page. Every account starts with 300; buy more on [your account page](https://skillsmart.io/account). Prefer your own fal.ai key? Set `FAL_KEY` and no credits are used |
| Python 3, Node.js 18+ | the scaffold script and the picture tools; on macOS `brew install python node` |
| A browser and an internet connection | three.js loads from jsDelivr, fonts from Google Fonts |

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  cloths.md                      the four kinds of cloth: what each is for and the settings that change its feel
  images.md                      what pictures each kind needs, prompts that worked, credits
  design.md                      composition, copy, type, colour, sound
  engine.md                      the page-module contract, the stage, Cloth, Strands, Banner, the kit
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project, or adds a page to one, from an example
assets/template/site/            index.html, main.js, base.css, engine/ (cloth physics, stage, sound)
assets/examples/                 afterhours, noren, moongate, tide: each a page module + CSS, their pictures, images.json
assets/tools/                    images.mjs (pictures), gen.mjs (generation with credits)
```

### How a generated project is laid out

```
cloth-velvet/
  site/                          serve this folder (python3 -m http.server 5190 -d site), open /#velvet
    index.html main.js base.css
    engine/                      cloth physics, the stage, sound
    themes/
      pages.json, index.js       the pages (index.js is generated)
      velvet.js, velvet.css      the page: copy, scene, cloth, interaction, layout, styles
    img/                         velvet-art.webp, velvet-plate.webp, …
  tools/
    images.json                  the prompts
    images.mjs, gen.mjs          node images.mjs velvet
    out/                         2K masters and earlier versions (gitignored)
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.

Physics: XPBD cloth with small steps (Macklin et al. 2019) and Matthias Müller's Ten Minute Physics, written for
this skill.
