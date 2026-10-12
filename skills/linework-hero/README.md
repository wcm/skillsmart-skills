# Linework Hero — a Skillsmart skill

**Draw my system:** describe a stack, pipeline, process or physical assembly and get an **animated isometric line
diagram** that answers the pointer, made to be the hero of a real page:

- **Correct by construction.** Labels are real text placed close to what they name and pushed apart when they
  overlap; links route themselves and carry packets; nodes lift on hover and open into layers on click.
- **Driven by the page.** Scroll builds it stop by stop, a timeline moves a parcel through it, a shop prices what's in
  it, a product page takes it apart: the page calls `send("step", n)`, `send("focus", id)` and `act("name")`.
- **Fourteen looks, or any hue:** paper, graphite, blueprint, riso, neon, clay, ink, terminal, cobalt, ledger,
  studio, console, signal, sage. Every drawing wears every look.
- **Or one object** that reacts: a potting bench whose plants grow, a synth whose knob turns, a card catalogue whose
  drawers slide out.

Four real pages ship as examples in `examples/pages/`: an engineering blog post (an event pipeline), a parcel tracker
(a warehouse to your door), a furniture shop (a living room in cutaway) and a lens product page (a camera lens taken
apart on scroll).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/linework-hero](https://skillsmart.io/skills/linework-hero)**: click
**Get skill**, copy the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add linework-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Describe the system, or name the object:

| Agent | Say |
|---|---|
| Claude Code | `/linework-hero draw my system: apps → collector → stream → warehouse → dashboard, as a blog post` |
| Codex | `$linework-hero our checkout flow, as the hero of the docs page` |
| Any agent | "Draw our parcel journey as an isometric diagram for the tracking page" |

The agent offers two or three concepts, lists the nodes and links, draws it, checks it in eighteen shots and every
look, and puts it on the page.

**What you need:** Node.js 18+ and a browser. The checker installs playwright-core once into a cache folder (not your
project) and drives your installed Chrome. No API keys, no credits.

---

## What's inside

```
SKILL.md                         the steps, the five rules, what goes wrong (start here)
references/
  systems.md                     draw my system: the kit of node kinds, links, packets, steps, focus, the page hooks
  parts.md                       the figure API: groups, parts, the answer, labels, inputs, cameras
  looks.md                       the fourteen looks and how to make one from a hue
  concepts.md                    finding the object, the features that give it away, the answer to borrow
engine/                          the Hairline kernel (unchanged, MIT), the Linework layer, the page around a figure
examples/systems/                pipeline and parcels (systems), room (a scene of pieces), camera (a labelled assembly)
examples/pages/                  each one as the hero of a real page: data, parcels, room, camera
examples/figures/                greenhouse (field), synth (scrub), catalog (pick and click), lens (explode on scroll)
templates/starter.js             the working figure new.mjs copies
scripts/                         new.mjs, build.mjs, check.mjs, inline.mjs (a page to one file)
```

### What you get

A figure or system file (`<name>.js`) and the page it lives on, plus `linework-<name>-check.png` (the checker's
contact sheet). `node scripts/inline.mjs page.html` makes any page one self-contained file to publish or send.

Built on [Hairline](https://hairline.lucasmarkes.com/) by Lucas Marques: its projection, rounded solids, springs,
tweens and frame loop are used as they are (`engine/LICENSE-hairline`, MIT).
