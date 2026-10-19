---
name: pixel-game
description: Make a retro pixel-art arcade game that reskins an old classic (Flappy Bird, Street Fighter, Metal Gear, Space Invaders, Frogger, Pong…) with a news story, a launch or an in-joke — a 9:16 canvas game made for short videos, with an autopilot or CPU mode for B-roll, instant replays, a 1080×1920 share card, chiptune sound and a joke on every loss. Static files on a shared engine, no libraries, no credits. Use whenever someone wants a pixel, 8-bit, retro or arcade game, a parody game, or a game about something in the news.
---

# Pixel Game

You make one small arcade game per brief: an old classic everyone has played, reskinned with a story, as a page
anyone can open on a phone. Every game runs on the same engine (`assets/engine/`): a 216×384 pixel screen (exactly
1080×1920 at 5×) with neon bloom, scanlines and screen shake, sound and music synthesised in the browser, a UI kit drawn
into the pixels, and a deterministic simulation at 120 Hz, which is what makes the autopilots, the replays and the
headless checks possible.

What makes these games spread is the formula, not the code: a mechanic that *is* the joke, a cast that looks like the
real thing, the action in the middle of a vertical frame, a hands-off mode for B-roll, and a stamp and a punchline on
every loss. The references hold that formula; the examples show it built.

| Start from | What it is | Start here for |
|---|---|---|
| `hop` | **Pixel Hop**, the starter: a robot on a neon road, tap to jump, hold to jump higher. Every part of a game (rules, autopilot, art, scene, sound, screens, replay, share card, checks, demo video) in about 1,000 lines | most new games, and any genre the others don't cover |
| `roadster` | **Flappy Roadster**: Tesla's flying Roadster in four one-tap games (Flappy Bird, a traffic jumper with kickflips, a gravity-flip tunnel, a drag-race tree), a predictive autopilot, four zones, a production-ETA running gag | one-button games, vehicles, several modes around one event |
| `kombat` | **Model Kombat**: Sam Altman vs Dario Amodei after the AI-summit photo; a best-of-three fighter on an on-screen pad, CPU levels, specials, supers, a finisher, caricature portraits | two people in a feud, any versus game |
| `metagear` | **Meta Gear Solid**: hold to sneak past smart-glasses wearers, let go to hide in a cardboard box; view cones on patterns of the clock, a planning autopilot, a codec briefing | stealth, dodging, timing, anything about being watched |

Read the one you start from in full (its `main.js` first) and skim another before you design. Never ship one with only
the names and colours changed.

## What you need

| Need | Why | How |
|---|---|---|
| A brief | the story and the game | what the user said (e.g. `/pixel-game turn Tesla's flying Roadster reveal into Flappy Bird` in Claude Code, `$pixel-game …` in Codex, or "make a retro game about …"); if they only have a topic or ask for ideas, pitch (Step 0) |
| Web access | the facts, and photos of anyone or anything real | your search and fetch tools; Wikimedia Commons for freely licensed photos |
| Python 3 | the scaffold script | `python3 -V` |
| A browser preview | playing it is the test | your browser or preview tool on `python3 -m http.server 8000 -d <project>`; without one, see Step 4 |
| Node 18+ | the checks, screenshots and demo videos in `tools/` | `node -v`; once, `npm install` in `tools/` (Playwright). The tools use Playwright's Chromium if installed, else Google Chrome or Edge |
| ffmpeg | demo videos only | `ffmpeg -version` |

No credits and no API keys: everything is drawn and synthesised in code. The page loads two fonts from Google Fonts for
its side panels; the game itself loads nothing.

## Step 0 — Pitch (one short message, then keep going)

Decide, from the brief (`references/ideas.md` has the method and how each example was found):

- **The story**: what happened, when, who, and the details people already joke about. Look it up first (Step 1).
- **The classic and the twist**: an old game whose core verb *is* the story (a flying car → Flappy Bird; two CEOs who
  wouldn't hold hands → a fighting game; glasses that film you → a stealth game whose view cones are cameras). The twist
  is the rule that turns the story into play; the story's own objects become the game's objects.
- **The cast and the world**: who and what is on screen, and where.
- **The name and its logo**: a pun on the classic ("Model Kombat", "Meta Gear Solid", "Flappy Roadster").
- **The joke system**: the stamp on a loss, punchlines picked by how you lost, the announcer, a running gag.
- **The clip**: the moment someone will post (the liftoff, the K.O. replay, the "!" when you're seen).

If the user asked for ideas or gave only a topic, pitch two or three in one line each (classic, twist, why it's funny)
and recommend one; wait for their pick. Otherwise say what you chose in a few sentences and continue unless they
object. Anything the user specified wins.

**Parody rules, in every game:** no logos or brand marks. No made-up quotes presented as anyone's real words: jokes live
in move names, the announcer, punchlines and made-up characters. Treat rivals the same (equal stats, mirrored moves, as
many punchlines each). Factual lines must match sources you keep in the README. Never make a game about a private
person. The "fan-made parody, not affiliated with …" line goes on the page beside the game and on the share card, not
in the game's own screens.

## Step 1 — Research

- **The facts**: dates, places, names, numbers, and quotes exactly as reported. Keep the links: they go in the README's
  sources, and the page's side panel says where the idea comes from.
- **The look of everything real**: two or three photos of each person, product or place, from different angles. Write
  down what makes each one recognisable, biggest first (a silhouette, a hair shape, glasses, a chin, a car's wedge and
  light bar). Prefer Wikimedia Commons; link the photos, don't ship them.

## Step 2 — Scaffold

```bash
python3 <skill>/scripts/new_project.py <project-dir> --from hop|roadster|kombat|metagear --as <game> --title "<Title>"
```

`<skill>` is the folder this file is in; `<project-dir>` is `./<game>` unless the user named one; `<game>` is the
game's short name (lowercase, dashes). It writes `<game>.html`, `engine/`, `games/<game>/` (a copy of the game you
start from, its saves in their own namespace), `tools/` (with `tools/games/<game>/`) and a `.gitignore`. Serve the
folder, open the page and play the copy before you change anything. Then run `npm install` in `tools/` once.

## Step 3 — Build it, layer by layer

Keep each file's job (`references/engine.md` has the engine and every file's role). Look in the browser after each
layer.

1. **The rules** (`games/<game>/sim.js`): the world, its fixed 1/120 s step, its seeded random generator, the inputs it
   records and the events it emits. It draws nothing and never calls `Math.random` or `R.fx`. Write the autopilot or
   the CPU here too, planning with copies of the same world, and its check in `tools/games/<game>/sim.mjs` before
   anything is drawn: the autopilot gets through, bots that play like people get a fair median, CPU vs CPU splits 50/50,
   a replay ends exactly like its live run. (`references/gameplay.md`)
2. **The cast** (`art.js`): sprites as rows of characters, drawn from the photos; caricature what's recognisable. Check
   them on the sprite sheet (`tools/games/<game>/sheet.html`, `node tools/sheet.mjs <game>`). For real people, show the
   user big headshots before going on. (`references/pixel-art.md`)
3. **The world** (`view.js`): the place, its light and reflections, and each event's effect: dust, sparks, debris,
   shake, flash, zoom. (`references/look.md`)
4. **The sound** (`sfx.js`): each event's sound from the synth primitives, and two songs for the sequencer.
5. **The screens and the flow** (`ui.js`, `main.js`): the logo, title, get-ready, HUD, the result (stamp, punchline, one
   line of stats), the replay, the pause; input; hit-stop and slow motion; the share card. (`references/look.md`,
   `references/gameplay.md`)
6. **The page** (`<game>.html`): the title, the side panels (how to play; for creators; where the idea comes from and
   the parody line), the canvas's label.

## Step 4 — Verify

Play it, then run the checks. The quality comes from two or three look-and-fix passes.

- `node tools/sim.mjs <game>` passes: the autopilot reaches its cap or the CPU splits evenly at every level, the bots'
  medians are fair, no replay drifts.
- `node tools/screens.mjs <game>` shoots the game from the title to the replay (keep its flow in
  `tools/games/<game>/screens.mjs` in step with the game). Open every shot in `tools/out/screens/` and check:
  - The action sits in the middle of the frame; nothing that matters in the top 30 px or the bottom 60 px of the
    384, where video apps put their captions and buttons.
  - Every word reads at phone size, nothing overlaps, every character draws (the pixel fonts have capitals, digits and
    a few symbols; anything else shows as `?`).
  - Each mode's name and logo are on screen before play starts, so the first frame of a clip says what game it is.
  - Every loss gets a stamp and a punchline; the replay plays; the share card is a 1080×1920 PNG.
- In the browser: 60 fps on a laptop; taps, holds and keys respond; the first tap starts the sound; the hands-off mode
  plays by itself and a tap takes over; it pauses when the tab is hidden; it fits a 390 px phone and a wide screen
  (side panels); reduced motion calms the shake and flashes.
- `references/troubleshooting.md` lists what has gone wrong before and the fixes.

If you can't open a browser yourself, start the server, give the user the URL and the checklist above, ask them to play
(a screen recording helps), and fix what they report before handing over.

## Step 5 — Demo videos (when the user wants something to post)

`node tools/demo.mjs <game>` renders frame-exact 1080×1920 MP4s with the game's own soundtrack into `tools/out/`. A
director in `tools/games/<game>/demo.mjs` plays the page on its manual clock, recording the best stretches and cutting
the rest; seeds and moments are picked by simulating ahead with the same sim. `references/video.md` covers directors,
picking moments, captions and posting.

## Step 6 — Hand over

In a few lines, tell the user what you built (the story, the classic and twist, the cast, the hands-off mode, the
jokes), how to play it (`python3 -m http.server -d <project>`) and host it (the whole folder, on any static host), and
where the knobs are: the rules' numbers at the top of `sim.js`, the cast in `art.js`, colours and scene in `view.js`, the
jokes in `main.js`, the side panels in the page. Mention anything you couldn't make work and anything not yet tried on
a real phone.

## Adding another game

`python3 <skill>/scripts/new_project.py <project-dir> --from <game-or-example> --as <another>` adds a game beside the
first, sharing the engine and the tools. `--examples` adds the starter and the three examples unchanged, with the
arcade's front page (`index.html`) linking them: a starting point for an arcade of several games.
