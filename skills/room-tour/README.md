# Room Tour — a Skillsmart skill

Build a **website you walk through as you scroll**. Each scroll moves the camera from one real viewpoint of a place to
the next: through the front door, across the living room, out onto the terrace. Over the walk sit a title that reads
first, captions, a map with a red you-are-here marker, and things to click.

- **A real walk.** Every stop is a different viewpoint, and one continuous camera move joins each to the next. Nothing in the place morphs, closes or pops in: the pictures are made to agree with the walk before any video is made.
- **Things to click.** Material tags that open spec cards, facts with a price and a booking card, products with prices, colours and a cart (pick a colour and the sofa in the room changes), or a gallery's exact artworks that lift off the wall.
- **Honest where it matters.** A place people book is made only from its own photographs, with a designed cut between rooms that can't see each other, never an invented corridor.
- **The page around it.** Its own type and colours, a phone layout, a headless check, and a video of the walk in one command.

Your agent generates the pictures and moves with your Skillsmart credits, about 500 for a three-stop page. Four example
pages ship in `assets/examples/`: *Tembusu* (a tropical house sold before it's built), *Teluk Senja* (a resort at
dusk), *ondo* (a room you can shop) and *Shedlight* (a gallery show). See them live at
[demos.skillsmart.io/room-tour](https://demos.skillsmart.io/room-tour/).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/room-tour](https://skillsmart.io/skills/room-tour)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add room-tour
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the place is and who it's for:

| Agent | Say |
|---|---|
| Claude Code | `/room-tour A walk-through for our new tropical house with a pool, sold before it's built` |
| Codex | `$room-tour a resort's page: from the front door to a villa's terrace over the sea, ending on booking` |
| Any agent | "Make a room tour for my furniture shop where people can shop the room" |

The agent agrees the route, what you click and the look with you, makes the pictures for you to check, then the moves
and the page, and checks it in a headless browser.

**What you need**

- Skillsmart credits: a picture is 20, a second of video 11, a cut-out 2; about 500 for a three-stop page. The agent tells you the cost before each step. (Or your own fal.ai key, as `FAL_KEY`.)
- Node 18+, Python 3, ffmpeg, and Chrome or Edge.
- Optional: OpenCV for Python (`pip install opencv-python-headless numpy`) for labels that follow objects and for exact artworks.

## What's inside

```
SKILL.md                the steps your agent follows
references/             walks.md (the method), design-system.md (the page's design), engine.md (every tour.json
                        field), gallery.md (exact artworks), troubleshooting.md
scripts/new_project.py  scaffolds a project
assets/template/        the engine, the tools and a plain starter page
assets/examples/        the four example pages and the prompts that made them
```

A project looks like this:

```
site/engine/            the engine
site/<id>/              index.html, style.css, tour.json, frames/, img/, tracks/
tools/                  pictures.mjs, moves.mjs, frames.mjs, stops.mjs, mask.mjs, check.mjs, video.mjs, serve.py …
tools/walks/<id>.json   the page's pictures, moves and frame choices
tools/out/<id>/         takes and masters
```
