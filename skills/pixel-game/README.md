# Pixel Game — a Skillsmart skill

Make a **retro pixel-art arcade game about anything in the news**: an old classic everyone has played, reskinned with
your story, as one page anyone can play on a phone and everyone can film.

- **The formula, not just the code.** Your agent finds the twist (the classic whose core verb *is* the story), draws
  the cast as pixel caricatures from real photos, and writes the jokes: a stamp and a punchline on every loss, an
  announcer, a running gag.
- **Made for vertical video.** A 9:16 screen with the action in the middle of the frame, an autopilot or CPU mode for
  hands-off B-roll, instant replays rebuilt from the run itself, and a 1080×1920 share card.
- **Game feel built in.** Neon bloom, scanlines, hit-stop, screen shake, slow-motion close calls, chiptune music and
  sound synthesised in the browser.
- **Proven, not hoped.** Headless checks show the autopilot gets through, the CPU is fair and every replay matches;
  screenshots of every screen; frame-exact demo videos with the game's own soundtrack.

Three complete games ship as examples, plus a starter: *Flappy Roadster* (Tesla's flying Roadster in four one-tap
games), *Model Kombat* (Sam Altman vs Dario Amodei after the AI-summit photo, a best-of-three fighter), *Meta Gear Solid*
(sneaking past smart glasses that record you) and *Pixel Hop* (a one-button runner, the smallest complete game). All
are fan-made parodies with no logos and no made-up quotes.

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/pixel-game](https://skillsmart.io/skills/pixel-game)**: click **Get skill**, copy
the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add pixel-game
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the game is about, and if you like, which old game it should feel like:

| Agent | Say |
|---|---|
| Claude Code | `/pixel-game turn Tesla's flying Roadster reveal into Flappy Bird` |
| Codex | `$pixel-game a Street Fighter parody of this week's CEO feud` |
| Any agent | "Make a retro arcade game about the new phone launch. Give me three ideas first." |

The agent researches the story, pitches the twist, scaffolds the game from the closest example, draws the cast,
builds and tunes the game, checks it headless and in a browser, and can render demo videos to post.

**What you need:** Python 3 and a browser to make and play it. Node 18+ for the checks and screenshots (the tools
install Playwright once and use your Google Chrome if Playwright's own browser isn't there), and ffmpeg for demo
videos. No credits and no API keys: everything is drawn and synthesised in code.

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  ideas.md                       the story, the classic, the twist, the joke system, parody rules
  look.md                        layout for vertical video, light, type, logos, juice, results, share cards
  pixel-art.md                   drawing real people and things from photos: caricature, maps, rigs, sizes
  gameplay.md                    deterministic rules, difficulty, autopilots and CPUs, balance, replays
  engine.md                      the engine's API and what each of a game's files does
  video.md                       rendering demo videos, picking moments, recording, captions
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project, or adds a game to one, from the starter or an example
assets/engine/                   core.js, screen.js, audio.js, ui.js, app.js: the shared engine
assets/games/                    hop (the starter), roadster, kombat, metagear: each game's scripts
assets/pages/                    each game's page, and the arcade's front page
assets/tools/                    headless checks, screenshots, demo videos, sprite sheets, and each game's part of them
assets/thumbs/                   the front page's thumbnails
```

### How a generated project is laid out

```
slop-invaders/
  slop-invaders.html             the page: open it through any static server
  engine/                        the shared engine
  games/slop-invaders/           sim.js (the rules), art.js (the cast), view.js (the scene), sfx.js (the sound),
                                 ui.js (the screens), main.js (the flow, input, share card)
  tools/                         node sim.mjs · node screens.mjs · node demo.mjs · node sheet.mjs (npm install once)
    games/slop-invaders/         this game's checks, screenshot flow, demo directors and sprite sheet
```

The result is a plain static site: no build step and no framework. Upload the folder to any static host (GitHub Pages,
Netlify, Vercel, a file host) and share the link.
