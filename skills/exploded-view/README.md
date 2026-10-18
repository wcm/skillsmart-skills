# Exploded View — a Skillsmart skill

Build a **scroll page that takes your product apart**. It starts as a real-looking photo of the product where it
belongs; as you scroll, the product lifts out of the photo, comes apart in the middle of the screen with a label on
every part, then flies back together and lands at a new angle in a second place:

- **A real place at each end.** Generated photos with real light and shadows: a diner counter at 1 a.m., a Tokyo
  listening bar, a concrete ledge in hard noon sun, a fjord at blue hour. The product is cut out of the photo itself, so
  the moment it starts to move can't be seen.
- **The inside, explained.** The exploded view and the clips in and out of it are generated for your product. Each
  part gets a label drawn in code, beside a lab made for its kind of product: an order ticket for food, a sound lab
  for audio, a motion lab for sport, an energy model for buildings.
- **A real page around it.** Brand, nav, headlines, labels and numbers in HTML you can edit, type and colours chosen
  for the brand, layouts for desktop and phone. Your agent makes the pictures with your Skillsmart credits.

Five reference pages ship in `assets/examples/`: *Night Shift* (a double smash burger, diner to picnic), *Kissa One*
(walnut headphones, listening bar to train), *Strata Volt* (a carbon-plated running shoe, concrete ledge to neon
street), *Fjell 30* (a prefab cabin, fjord to desert) and *Caffè Riva* (a stovetop moka pot, Italian kitchen to a lake
at dawn).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/exploded-view](https://skillsmart.io/skills/exploded-view)**: click **Get skill**,
copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add exploded-view
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say the product and what the page is for:

| Agent | Say |
|---|---|
| Claude Code | `/exploded-view A launch page for our walnut wireless headphones, from a Tokyo listening bar to a train at golden hour` |
| Codex | `$exploded-view our carbon-plated running shoe, from a sunlit ledge to a neon street` |
| Any agent | "Make an exploded-view scroll page for our moka pot" |

The agent picks the two places, how the product comes apart, the lab, the type and the colours, scaffolds the page,
generates the photos and the exploded view for you to check, then the clips, cuts everything out, places the labels
and checks the page in a headless browser.

**What you need**

| | |
|---|---|
| Skillsmart credits | an image is 20, a video 15 a second, a cut-out 2: about **280 credits** a page. Every account starts with 300; buy more on [your account page](https://skillsmart.io/account). Prefer your own fal.ai key? Set `FAL_KEY` and no credits are used |
| Node.js 18+, ffmpeg, Python 3 | the tools, frame extraction and the scaffold; on macOS `brew install node ffmpeg python` |
| Chrome or Edge | for the headless check; fonts load from Google Fonts |

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  subjects.md                    choosing the product, its two places and how it comes apart
  prompts.md                     every prompt, with what each shared line prevents
  cut-outs.md                    the isolation ladder: SAM 3 by name, detach, erase
  page.md                        page.json, the look, the scroll
  labs.md                        the four labs and how to write one
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project from one of the reference pages
assets/template/site/engine/     explode.js (the scroll stage), labs.js, frames.js, explode.css
assets/template/tools/           subjects.json (prompts), build.mjs (every picture), anchors.mjs (label dots),
                                 check.mjs (headless checks), gen.mjs (generation with credits)
assets/examples/                 the five reference pages and their prompts
```

### How a generated project is laid out

```
exploded-kissa/
  site/                          serve this folder (python3 -m http.server 5190 -d site)
    engine/                      the scroll stage, shared by every page
    kissa/
      index.html page.json       the look; the words, parts and lab
      layout.json img/ frames/   written by tools/build.mjs: photos, cut-outs and both clips as frames (full size and
                                 for phones)
  tools/
    subjects.json                the prompts
    build.mjs                    node build.mjs kissa --stills · node build.mjs kissa --motion
    anchors.mjs check.mjs gen.mjs
    out/                         2K masters, masks, raw clips and review sheets (gitignored)
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
