# Motion Reel — a Skillsmart skill

Turn **an idea into a looping motion-design reel**, drawn entirely in code: 20–40 seconds of
generative scenes cut on the beat, joined by bold transitions, with a soundtrack, looping without a
seam.

- **A library of 21 scenes.** 3D point clouds of any object (crystals that melt, Möbius strips, Klein
  bottles, galaxies, your own letters), type built from cells, fractures, fractal dives that never
  end, halftone that crumbles like sand, particles, ribbons, a chrome ball on a field, kinetic, glitch
  and pixel type, a data scene, a burst of quick shots, and a rewind of the whole reel.
- **Every scene bends to the idea.** Its forms, moves, shapes, words, colours and timing are options;
  scenes go in any order, play backwards or in slow motion that snaps, and hit on the beat.
- **Bold joins.** Zoom through a dot, punch in, whip pan, shatter, slices, spin, ink flood, a burst
  through a shape, pixelate, burn to white.
- **It loops.** The end opens onto the first frame, or the reel rewinds onto it; the soundtrack is cut
  to exactly one loop.
- **Vertical first.** 9:16 for Reels, TikTok and Shorts, plus 1:1, 4:5 and 16:9.

Best for abstract ideas, since nothing is filmed: entropy, infinity, gravity, time, growth, a belief.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab),
Codex, Cursor, Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/motion-reel](https://skillsmart.io/skills/motion-reel)**: click
**Get skill**, copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add motion-reel
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code,
`~/.agents/skills` for Codex, Cursor, Gemini CLI and OpenCode).

## Use

| Agent | Say |
| --- | --- |
| Claude Code | `/motion-reel entropy` |
| Codex | `$motion-reel a looping reel about momentum, falling cuts` |
| Any agent | "Make a looping motion-graphics reel about infinity for Instagram." |

The agent finds the idea's arc with you, casts a scene for every step of it, writes the words,
checks every scene and the loop on a contact sheet, and renders the MP4.

**What you need:** Node 18+, Google Chrome or Microsoft Edge (or Playwright's Chromium), and ffmpeg.
No credits and no API keys: everything is drawn in code, the fonts are embedded. The renderer
installs `playwright-core` once from npm into a cache folder, never into your project.

---

## What's inside

```
SKILL.md                       the workflow the agent follows (start here)
references/writing.md          from an idea to an arc, scenes, words and a look
references/craft.md            bars, pace, the loop, time effects, energy, the frame, type
references/scenes.md           all 21 scenes and every option
references/transitions.md      all the joins
references/custom.md           a scene or a transition of your own
references/audio.md            the soundtrack, or your own track
references/motion-rules.md     the rules every Skillsmart video follows
assets/engine/                 the engine, the transitions and the scenes
assets/templates/              four starters: rewind, zoom, fall, montage
assets/examples/               three finished reels: entropy, infinity, gravity
assets/fonts/                  the embedded fonts (SIL Open Font License)
scripts/new.mjs                start a reel from a starter or an example
scripts/check.mjs              the checks and a contact sheet
scripts/make.mjs               the page, the soundtrack and the MP4s in one go
scripts/render.mjs             the frame-by-frame renderer (also contact sheets and stills)
scripts/build.mjs  frames.mjs  audio.mjs  tempo.mjs  share.mjs  lib.mjs
```

### How a project is laid out

```
entropy/
  reel.js                      the reel: its scenes, words, palette and tempo (edit this)
  entropy.html                 the reel as one page: plays on a loop (?audio=out/entropy.wav)
  entropy-check.png            the contact sheet
  out/entropy.wav              the soundtrack, one loop
  out/entropy-9x16.mp4         the renders (and -1x1, -4x5, -16x9)
```
