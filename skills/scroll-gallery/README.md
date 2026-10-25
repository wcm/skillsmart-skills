# Scroll Gallery — a Skillsmart skill

Build a **gallery page where the pictures fly from one 3D scene into the next as you scroll**. Each scene lays the
pictures out in one shape, and the pictures you were looking at fly across into the next:

- **Sixteen scenes to choose from.** Prints dealt on a table, a moodboard on threads, a runway of silk panels, a
  rainbow arc, a tilting band, a spinning turntable, a jukebox, a walnut crate, thick slabs, a sweeping deck, an
  acrylic ribbon, a trail that follows the cursor, a sphere you dive into, a lookbook whose pages turn, glazed tiles
  that turn over in waves, a glass cube that solves itself. Five ways to change between them.
- **Pictures as real objects.** Photo paper with a white edge, record sleeves, thick acrylic with a glowing rim,
  glazed tiles, silk that hangs and sways, all in one soft studio light with a fine film grain.
- **A real gallery around them.** Click a picture to bring it forward with its words; Index lists every picture and
  brings any of them into view. Brand, links and type chosen for the subject, a layout for every phone, and a
  scroll-through video in one command.

Bring your own pictures (free), or your agent generates them with your Skillsmart credits. Four example galleries ship
in `assets/examples/`: *Ardent* (a fashion lookbook), *Side B* (a record shop), *Far Field* (landscape photographs)
and *Kit of Parts* (a library of design assets).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/scroll-gallery](https://skillsmart.io/skills/scroll-gallery)**: click **Get
skill**, copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add scroll-gallery
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the gallery shows, and where the pictures are if they're yours:

| Agent | Say |
|---|---|
| Claude Code | `/scroll-gallery A lookbook for our autumn–winter collection, from the photos in ~/Pictures/aw27` |
| Codex | `$scroll-gallery a gallery of 12 landscape photographs, cinematic and dark` |
| Any agent | "Make a scroll gallery for my design studio's portfolio" |

The agent picks the example closest to the feel you want, the scenes, the type and the colours, scaffolds the page,
imports or generates the pictures for you to check, writes the words, and checks the page in a headless browser.

**What you need**

| | |
|---|---|
| Pictures | your own (a folder of JPG, PNG or WebP), or generated: 20 credits a picture, so **240 credits for 12, 400 for 20**. Every account starts with 300; buy more on [your account page](https://skillsmart.io/account). Prefer your own fal.ai key? Set `FAL_KEY` and no credits are used |
| Node.js 18+, Python 3 | the tools and the scaffold; on macOS `brew install node python` |
| Chrome or Edge | for the headless check and the video; fonts load from Google Fonts and three.js from jsDelivr |
| ffmpeg | only for the video |

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  layouts.md                     the sixteen scenes, their options, and the five changes between them
  page.md                        page.json, index.html and what the visitor can do
  pictures.md                    your own pictures; writing the style line and prompts, and what went wrong before
  scenery.md                     what a scene stands in: photos, patterns, line drawings, fog, dust
  materials.md                   paper, silk, acrylic and glaze, and the studio light
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project from one of the examples
assets/template/site/engine/     accrochage.js (the gallery), layouts/, card.js (the cards' material), scenery.js,
                                 post.js (bloom and grain), cloth/ (the silk)
assets/template/tools/           pictures.mjs (generate), build.mjs (web images, or import your own), scene.mjs
                                 (scenery), check.mjs (headless checks), video.mjs, serve.py, gen.mjs (credits)
assets/examples/                 the four example galleries, with their prompts
```

### How a generated project is laid out

```
gallery-vale/
  site/                          serve this folder (python3 tools/serve.py)
    engine/                      the gallery engine, shared by every page
    vale/
      index.html page.json       the fonts and type; the words, scenes and pictures
      images.json img/ scene/    written by the tools: the pictures (900 and 1800 px) and the scenery
  tools/
    pictures.mjs build.mjs       node pictures.mjs vale · node build.mjs vale [--from ~/Pictures/aw27]
    scene.mjs scenery.json       the scenery and its prompts
    check.mjs video.mjs          node check.mjs vale · node video.mjs vale
    out/                         2K masters, review sheets and videos (gitignored)
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
