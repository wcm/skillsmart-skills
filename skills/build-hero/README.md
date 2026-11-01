# Build Hero — a Skillsmart skill

Build a **website hero where one scroll builds the place**. An AI film plays from the raw materials to the finished
place while the camera moves; then evening falls and the lights come on.

- **A film with a real change of angle.** The camera starts high above or low in a corner and swings round as the place goes up. One flick of the wheel plays it all in 3 seconds.
- **Believable building.** The film is made in short segments between keyframes, each doing one job, so floors stack at the top, and a crew carries a room's tables and flowers in as a time-lapse.
- **Lights on.** Dusk falls with every light off, then they switch on in an order that suits the place: floor by floor, across a kitchen, outward from a pool, candles first.
- **The page around it.** Counters, a stage ruler and captions timed to the build, its own type and colours, a phone layout, a headless check and a video in one command.

Your agent generates the pictures and film with your Skillsmart credits, about 550 for a page. Four example pages ship in
`assets/examples/`: *Tidelight* (a tower), *Misura* (a kitchen), *Kebun* (a pool and garden) and *Cerise* (a wedding dinner).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/build-hero](https://skillsmart.io/skills/build-hero)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add build-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what gets built and who it's for:

| Agent | Say |
|---|---|
| Claude Code | `/build-hero A launch page for a new riverside condo tower, sold before it's built` |
| Codex | `$build-hero a kitchen maker's home page, from panels on the floor to the fitted kitchen` |
| Any agent | "Make a build hero for my pool company" |

The agent agrees the stages, the camera's move and the look with you, makes the pictures for you to check, then the film,
the evening and the page, and checks it in a headless browser.

**What you need**

- Skillsmart credits: a picture is 20, a second of film 15; about 550 for a page. The agent tells you the cost before each step. (Or your own fal.ai key, as `FAL_KEY`.)
- Node 18+, Python 3, ffmpeg, and Chrome or Edge.

## What's inside

```
SKILL.md                the steps your agent follows
references/             films.md (the method), page.md (every hook), troubleshooting.md
scripts/new_project.py  scaffolds a project
assets/template/        the engine, the tools and a plain starter page
assets/examples/        the four example pages and their prompts
```

A project looks like this:

```
site/engine/            the engine
site/<id>/              index.html, main.js, style.css, frames/, frames-phone/, img/
tools/                  pictures.mjs, film.mjs, frames.mjs, align.mjs, check.mjs, video.mjs …
tools/scenes/<id>.json  the page's prompts, film segments and frame choices
tools/out/<id>/         takes and masters
```
