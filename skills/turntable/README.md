# Turntable — a Skillsmart skill

Build a **website where every subject turns on the spot as you scroll**. A gallery comes first. Click a subject and its
page opens: words on the left, the subject on the right. Every scroll is one whole, eased turn to the next page, and the
line between two pages is where one subject turns into the next, in the same place.

- **Seen from every side.** Each subject turns all the way round between its page and the next, so visitors see the back of a sculpture, the sole of a shoe, the far side of a dish.
- **It snaps.** One scroll, swipe or key press is one turn of about a second; it never rests halfway, and a trackpad's momentum never adds a second turn. Visitors can also drag the subject round by hand.
- **Real subjects.** Your agent photographs each subject, films it turning a full 360° from that photo, and cuts it out; your own photos work too. Plates under dishes are found and kept.
- **Four example sites on one engine:**
  - an art gallery, with sculptures on fluted plinths;
  - a restaurant, with dishes on a turning ring;
  - a fashion label, with one model in five looks;
  - a sneaker drop, with colour tiles and giant names.
- **The whole site.** A gallery, a page per subject in its own colour, an ending with one call to action, and a phone layout, checked headless in one command.

Your agent makes the subjects with your Skillsmart credits, about 138 a subject (a five-subject page is about 690). Four
example pages ship in `assets/examples/`:
- *In the Round*, an art gallery's sculpture show;
- *Lacquer*, a Cantonese restaurant's tasting menu;
- *SIP CLUB*, a drinks-themed fashion drop;
- *Torque*, a sneaker drop.

See them live at [demos.skillsmart.io/turntable](https://demos.skillsmart.io/turntable/).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/turntable](https://skillsmart.io/skills/turntable)**: click **Get skill**, copy the
one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add turntable
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say what the site is for and what the subjects are:

| Agent | Say |
|---|---|
| Claude Code | `/turntable A page for our five new sneakers, each in its own colour` |
| Codex | `$turntable a gallery's sculpture show where each work turns on its plinth` |
| Any agent | "Make a turntable site for our restaurant's six signature dishes" |

The agent agrees the subjects and the look with you. It makes the subjects for you to check, then writes the site and
checks it in a headless browser.

**What you need**

- Skillsmart credits: a subject is about 138 (20 for its photo, 110 for its 10-second turn, 8 for the cut-out; a dish 8 more for its plate). The agent tells you the cost first. (Or your own fal.ai key, as `FAL_KEY`.)
- Node 18+, Python 3 and ffmpeg.
- Chrome or Edge for the headless check (optional).

## What's inside

```
SKILL.md                the steps your agent follows
references/             subjects.md (the prompts that work for each kind of subject), design.md (lines, galleries,
                        props, the four looks), engine.md (every option), troubleshooting.md
scripts/new_project.py  scaffolds a project
assets/template/        the engine, the tools and a starter page
assets/examples/        the four example pages with the subjects and prompts that made them
```

## A project

```
my-site/
  site/
    engine/               turntable.js (the engine), frames.js, turntable.css
    <id>/                 index.html, style.css, frames/<subject>/ (72 frames a turn), img/ (props)
  tools/
    subjects/<id>.json    the subjects: prompts or your own photos, the turn, the stage
    subjects.mjs          photos, turning films and cut-outs (credits)
    frames.mjs            every subject on one stage, as the page's frames
    prop.mjs, plate.mjs   a plinth or stand for the stage; a plate put back under a dish
    check.mjs, video.mjs  a headless check with contact sheets; a looping video of the site
    serve.py              a local server
```

The site is static: host `site/` anywhere. Each subject is about 3 MB of frames, loaded coarse to fine.

## Licence

MIT.
