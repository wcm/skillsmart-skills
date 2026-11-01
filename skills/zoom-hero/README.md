# Zoom Hero — a Skillsmart skill

Build a **website hero you can dive into**. One wide scene fills the screen; click a spot and the camera zooms into a tiny detail until it fills the screen; click again and it dives again, then back out in one go. A hill becomes one grape becomes the wild yeast on its skin.

- **A real zoom, with no jump.** Each close-up is generated from a crop of the level above and measured to sit exactly over it, so detail comes into focus as you dive.
- **A viewfinder interface.** Size labels on the spots, brackets that grow with each dive, live readouts of field width and zoom, a scale from kilometres to nanometres, breadcrumbs with round pictures and notes pinned to the picture. Scroll, arrow keys, Esc and number keys work too.
- **Made for your subject.** Your agent plans the dive around the one tiny thing that is your reason to buy, and chooses the words, type and colours.

Four example sites ship in `assets/examples/`: *Pruine* (natural wine), *Understory* (a rainforest trust), *Surface Theory* (skincare) and *Where's Pip?* (a picture book as a clue game). See them at [demos.skillsmart.io/zoom-hero](https://demos.skillsmart.io/zoom-hero/).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor, Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/zoom-hero](https://skillsmart.io/skills/zoom-hero)**: click **Get skill**, copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add zoom-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the business is, and what is hidden in it if you know:

| Agent | Say |
|---|---|
| Claude Code | `/zoom-hero A natural-wine estate: from the hill down to the wild yeast on a grape` |
| Codex | `$zoom-hero A natural-wine estate: from the hill down to the wild yeast on a grape` |
| Any agent | "Make a zoom hero for a natural-wine estate, from the hill down to the wild yeast on a grape" |

## What you need

- **Skillsmart credits**: 20 a picture, about 320 for a page of 8 levels with two takes each. Nothing to set up: the first run signs this computer in once. Your own photo can be the first level, free. With your own fal.ai key (`FAL_KEY=…` on the command), no credits are used.
- **Node 18+** and **Python 3**.
- **Chrome or Edge** for the headless check and the video (otherwise you check by hand), and **ffmpeg** for the video.

## What's inside

- `SKILL.md`: the steps your agent follows
- `references/`: making the pictures, writing the page, troubleshooting
- `scripts/new_project.py`: starts a project
- `assets/template/`: the engine and the tools
- `assets/examples/`: the four sites, with their prompts

## What a project looks like

```
<project>/
  site/engine/          the zoom and the interface
  site/<id>/            index.html, style.css, main.js, img/   a static folder, host it anywhere
  tools/trees/<id>.json the levels: prompts, areas, sizes
  tools/out/<id>/       full-size pictures and review sheets (not needed to host)
```

MIT licensed. Generated pictures are imagined: don't use them to prove a real specification.
