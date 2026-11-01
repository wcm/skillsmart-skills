# Lights On — a Skillsmart skill

Build a **website hero where one photographed place goes from day to night as real light**. Nothing in the frame moves:
the sun drains toward the window, a beat of blue, then each lamp, sign or candle comes on by itself, and the page's words
and colours follow the room.

- **Four ways to play it.** A single switch, click an object to light it, pick a material and see it morning and night,
  or scroll through the whole day.
- **Real light, not a crossfade.** Your agent generates one day photo and edits of it, lines them up, and measures each
  light's share from a photo of it alone. Lamps warm up, neon strikes, candles flicker.
- **A real page around it.** Copy and type for your subject, a phone layout, a fallback without WebGL, optional room
  sound that stays off until asked, a headless check and a video in one command.

Four example pages ship in `assets/examples/`: *Noble Gas* (neon and light boxes), *Lueur* (a lighting shop), *Pli*
(curtains) and *Deux Temps* (a café that becomes a jazz bar).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/lights-on](https://skillsmart.io/skills/lights-on)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add lights-on
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the place is and what changes at night:

| Agent | Say |
|---|---|
| Claude Code | `/lights-on A café by day that turns into a jazz bar by night` |
| Codex | `$lights-on a neon studio: good-looking by day, totally different at night` |
| Any agent | "Make a day and night hero for my lighting shop, where you click a lamp to light it" |

The agent picks the example closest to what you want, writes the prompts, generates the day photo for you to check,
makes the night, the dark and each light, builds the page, and checks it in a headless browser.

**What you need**

| | |
|---|---|
| Skillsmart credits | 40 a picture, so **about 320 for a room with three lights**. Every account starts with 300; buy more on [your account page](https://skillsmart.io/account). Prefer your own fal.ai key? Set `FAL_KEY` and no credits are used |
| Node.js 18+, Python 3 | the tools; OpenCV and NumPy install once with pip. On macOS `brew install node python` |
| Chrome or Edge | for the headless check and the video; fonts load from Google Fonts |
| ffmpeg | only for the video |

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  pictures.md                    the chain of shots, and how to write their prompts
  page.md                        the engine's options and calls, and the rules for the page
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project from one of the examples
assets/template/site/engine/     jour-nuit.js (the light), ui.js, ui.css, sound.js
assets/template/tools/           shots.mjs (generate), prep.py + align.py (line up and measure), check.mjs (headless
                                 checks), video.mjs, serve.py, gen.mjs (credits)
assets/examples/                 the four example pages, with their prompts
```

### How a generated project is laid out

```
lights-bakery/
  site/                          serve this folder (python3 tools/serve.py)
    engine/                      the light engine, shared by every page
    bakery/
      index.html style.css main.js   the words, the look, the interaction
      img/                       written by prep.py: the pictures in three sizes and the measured light shares
  tools/
    scenes/bakery.json           the shots and their prompts
    shots.mjs prep.py            node shots.mjs bakery · .venv/bin/python prep.py bakery
    check.mjs video.mjs          node check.mjs bakery · node video.mjs bakery
    out/bakery/                  masters, takes and review sheets (keep it: nothing has to be paid for twice)
```
