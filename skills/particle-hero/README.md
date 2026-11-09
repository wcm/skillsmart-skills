# Particle Hero — a Skillsmart skill

Build a **landing-page hero made of half a million particles**. Each of your subjects is rebuilt in glowing dust or
ink: a product, an animal, a portrait, an object. The grains swarm or melt from one subject into the next, they
part like smoke under the cursor, and the whole subject turns toward it in 3D.

- **A hover that feels real.** The grains have momentum: a hand through them leaves a soft wake that settles back by itself.
- **A real 3D point cloud.** Each subject has depth and turns toward the cursor, so moving the mouse round it shows its sides like an object you can look round.
- **Changes you can follow.** A swarm throws the grains out and the next subject comes into focus out of the cloud. A melt pairs every grain with a near one in the next subject, so one sneaker reshapes into the next.
- **Four looks on one engine:**
  - bone-white dust on black, with trackers and wind;
  - coloured ink on cream paper;
  - neon dust with coloured lights flashing on a beat;
  - a light one-colour print with callouts.
- **The page around it.** A title that reads first, a list to pick a subject, words for each one, a call to action, and a phone layout, checked headless in one command.

Your agent generates the subjects with your Skillsmart credits, about 88 for a four-subject page. Depth maps are made on
your computer for free. Four example pages ship in `assets/examples/`:
- *Fauna Borealis*, a museum exhibition;
- *Herbier*, a perfume house;
- *Afterglow*, a festival lineup;
- *Stride*, a sneaker range.

See them live at [demos.skillsmart.io/particle-hero](https://demos.skillsmart.io/particle-hero/).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/particle-hero](https://skillsmart.io/skills/particle-hero)**: click **Get skill**,
copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add particle-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the page is for and what the subjects are:

| Agent | Say |
|---|---|
| Claude Code | `/particle-hero A hero for our sneaker range where each model turns into the next` |
| Codex | `$particle-hero a museum exhibition of arctic animals in white dust on black` |
| Any agent | "Make a particle hero for my perfume brand: each ingredient becomes the bottle" |

The agent agrees the subjects, the look and the change with you. It makes the subjects for you to check, then writes the
page and checks it in a headless browser.

**What you need**

- Skillsmart credits: a subject is 22 (20 for the picture, 2 for the cut-out), your own photo 2. That's about 88 for four subjects. The agent tells you the cost first. (Or your own fal.ai key, as `FAL_KEY`.)
- Node 18+ and Python 3.
- Chrome or Edge for the headless check (optional).

## What's inside

```
SKILL.md                the steps your agent follows
references/             looks.md (the four looks, changes, the page), engine.md (every option),
                        pictures.md (writing and making subjects), troubleshooting.md
scripts/new_project.py  scaffolds a project
assets/template/        the engine, the tools and a plain starter page
assets/examples/        the four example pages with their subjects and the prompts that made them
```

## A project

```
my-hero/
  site/
    engine/             nuee.js (the engine), stage.js, hud.js, looks.js, match-worker.js
    <id>/               index.html, main.js, style.css, img/ (each subject's cut-out and depth map)
  tools/
    pictures/<id>.json  the subjects: prompts or your own photos
    pictures.mjs        makes them, cuts them out, adds depth maps, copies them into the page
    depth.mjs           depth maps on your computer (Depth Anything V2 Small)
    check.mjs           headless check on desktop and phone, with contact sheets
    serve.py            a local server
```

The site is static: host `site/` anywhere. The engine needs WebGL2, which every current browser has.

## Licence

MIT. The depth model is Depth Anything V2 Small (Apache-2.0), downloaded from Hugging Face on first use.
