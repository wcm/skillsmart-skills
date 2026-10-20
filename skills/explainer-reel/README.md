# Explainer Reel — a Skillsmart skill

Turn **a script, or just a topic, into a narrated explainer reel**: 20–90 seconds of glowing illustrations that
draw themselves while a calm voice tells the story, and captions light up word by word.

- **Illustrations made of light.** Thousands of particles take the shape of each scene's subject, then fly, swirl and
  re-form into the next: a Moon dissolves into a ruler, a body pours into the lining of a gut. Turning 3D forms (a
  cratered Moon, a red blood cell), flow fields of streaming light, engraved drawings, all under a halftone screen.
- **Busy, then still.** Scenes swing between dense particle simulations and almost empty frames, one thin line on
  black, so every point lands.
- **A real voice, on time.** A calm, intimate narrator (30 voices, with a style direction you write) reads the whole
  script in one take; every word is timed, so the pictures arrive on the word they answer to.
- **Every format.** MP4 in 9:16 for Reels, TikTok and Shorts, 4:5 and 1:1 for feeds, and 16:9 with the captions in a
  column beside the picture, all from one reel.
- **True numbers.** The skill writes the script when you give it a topic, checks the facts, and keeps the sources.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/explainer-reel](https://skillsmart.io/skills/explainer-reel)**: click **Get skill**,
copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add explainer-reel
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills`
for Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
| --- | --- |
| Claude Code | `/explainer-reel why the Moon is drifting away` |
| Codex | `$explainer-reel the 20-20-20 rule for tired eyes, 1:1` |
| Any agent | "Make a 30-second explainer reel about how your body rebuilds itself, with a calm voice-over." |

The agent writes (or takes) the script, shows you the plan and the cost, makes the voice-over, draws the pictures
against it, checks every scene on a contact sheet, and renders the MP4s.

**What you need:** Node 18+, ffmpeg, and Google Chrome or Microsoft Edge. The voice-over uses your Skillsmart credits:
10 credits per 1,000 characters, about 2 for a 20-second reel and 9 for a minute (or your own fal.ai key, with
`FAL_KEY`). No other keys. The renderer installs `playwright-core` once from npm into a cache folder, never into your
project.

---

## What's inside

```
SKILL.md                       the workflow the agent follows (start here)
references/style.md            the style: key subject, rhythm, cover, layouts, materials, colour
references/script.md           writing the script and the storyboard
references/voice.md            voices, style directions, cost, pace, your own recording
references/api.md              every call the reel can make, and the formats
references/shapes.md           the drawing library (shapes.jpg) and drawing your own
references/looks.md            eight looks (looks.jpg), palettes and sound beds
assets/engine/                 the engine: drawing, particles, 3D, looks, captions, sound
assets/templates/starter.js    a new reel
assets/examples/               three finished reels: moon, eyes, renew
scripts/new.mjs                start a reel from the starter or an example
scripts/voice.mjs              the voice-over and its word timing
scripts/check.mjs              the checks and a contact sheet
scripts/preview.mjs            a live preview to scrub and switch looks
scripts/make.mjs               the page, the soundtrack and the MP4s in one go
scripts/render.mjs             Skillsmart's frame-by-frame renderer
scripts/gen.mjs                generation with Skillsmart credits (or your fal.ai key)
scripts/page.mjs  browser.mjs  shapes.mjs
```

### How a project is laid out

```
reels/moon.js                  the reel: the script as beats, and the pictures (edit this)
reels/moon.timing.json         the voice's timing; reels/moon.vo.wav, the voice-over
reels/moon.voice/              the cached takes (a re-run with nothing changed costs nothing)
reels/moon-check.png           the contact sheet
reels/moon.html                the reel as one page
out/moon.wav                   the soundtrack
out/moon-9x16.mp4              the renders (and -4x5, -1x1, -16x9)
```

MIT licence. Fonts: Poppins, JetBrains Mono, VT323, Caveat, Fraunces (SIL Open Font License).
