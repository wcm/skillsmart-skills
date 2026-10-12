---
name: linework-hero
description: Draw animated isometric line diagrams that answer the pointer and put them to work as the hero of a real page — "draw my system" for a stack, pipeline, process or physical assembly (a data pipeline, a parcel's route through a warehouse, a room to shop, a camera lens taken apart), with correct labels, packets on the links, hover lifts, click-to-open layers and scroll-built steps — or one interactive object. Fourteen looks or any hue. Use for an architecture or data-flow diagram, an exploded product view, a blog or docs figure, an interactive hero or an empty state.
---

# Linework Hero

You write one short file, the figure or the system; the engine (Linework, in `<skill>/engine/`) draws it as an
isometric line drawing in any look and does the rest. `<skill>` is the folder this file is in; never edit its engine,
except to add a look. What you make goes in the user's working directory.

Invoke it with what to draw: `/linework-hero draw my system: apps → collector → stream → warehouse → dashboard`
in Claude Code, `$linework-hero …` in Codex, or "draw my system as an isometric diagram" in any agent.
Node 18+ runs the scripts; a browser checks the result.

## 0. Which one

| They want | Make | Start from |
|---|---|---|
| a stack, pipeline, process, request path, architecture | a **system** | `LW.system({...})`, `examples/systems/pipeline.js`, `parcels.js` |
| a physical thing taken apart, with named parts | a **figure with labels** | `examples/systems/camera.js` |
| a place with things in it (a room, a shop floor) | a **scene** of pieces | `examples/systems/room.js` |
| an object that reacts (a hero, an empty state, a playful illustration) | a **figure** | `node <skill>/scripts/new.mjs <name>`, `examples/figures/` |

And ask where it will live. A drawing is worth most as the hero of the page that explains it: a blog post that builds
it as you scroll, a tracking page whose timeline moves it, a shop where you buy what's in it, a product page that takes
it apart. `examples/pages/` has one of each; copy the nearest and change the words. Draw it large, on the page itself
(`clear: true`, the look's ground as the page background, a fading grid or light behind it), never in a bordered box.

## 1. Concept

Offer two or three one-line concepts and wait for a pick (skip it if they arrived with the content):

> **Name.** What it shows. What the reader does to it (hover, scroll, a button). The look, and why.

For a system, list the nodes (kind, label, one fact each) and the links before drawing. For a figure,
`references/concepts.md` has how to find the object, the features that give it away, and the answer to borrow.

## 2. Write it

- **A system:** `references/systems.md`. Nodes are kinds from the kit on a grid, links route themselves, labels are
  real text. The page drives it with `send("step", n)`, `send("focus", id)` and `act("name")`, and hears back through
  `onpick`, `onread` and `lw:*` events.
- **A figure:** `references/parts.md`. Groups of parts, each a function of the group's numbers, and one answer.
- **Labels** (`g.label`) are HTML, so they are always correct; the engine pushes overlapping ones apart. Name things
  in the reader's words, a label and one fact, never a sentence.
- **A look:** `references/looks.md` (paper, graphite, blueprint, riso, neon, clay, ink, terminal, cobalt, ledger,
  studio, console, signal, sage, or one made from a hue).

Five rules. The engine keeps the rest (paint order, hit areas from the rest pose, springs and tweens, the frame,
sleeping offscreen, every colour):

1. **One idea.** One object or one system, one thing the reader does to it.
2. **Rest is the thumbnail.** Uneven, composed, already saying what it is, one thing lit.
3. **One accent.** `s.accent` takes one thing; a system lights the hovered node, the step, or `rest`.
4. **Draw what it is.** Each part gets the features that make it that thing; a plain block is nothing.
5. **Words only in labels.** Never on a face; labels name and count.

## 3. Check

`node <skill>/scripts/check.mjs <name>.js` builds a bench page, takes eighteen shots (rest, answer, thumbnail, slider
ends, two cameras, ten looks), runs each to the end and writes `linework-<name>-check.png`. Fix every `FAIL`. (Its
first run installs playwright-core once into a cache folder, never into the project, and drives your installed Chrome.)

Then look at the sheet and the page itself in a browser, at desktop and phone widths: can you name it from the
thumbnail, does every label read, does every look hold, does the page's own interaction (scroll steps, buttons) do
what the copy says. The console must be clean.

If you can't open a browser yourself, serve the folder (`python3 -m http.server`), give the user the URL and the
checklist above, ask them to look (a screenshot helps), and fix what they report before handing over.

## 4. Hand over

`node <skill>/scripts/inline.mjs <page.html>` makes a single file of a page (engine and figure inlined), ready to
publish or send. Say, a line each: what it shows, what the reader does, the look and why, and anything you could not
verify.

## 5. Adjust

Edit only the figure or system file and the page's words; check again. A new palette is a look object
(`references/looks.md`), never a colour in the figure.

## What goes wrong

| If you catch yourself | Do this instead |
|---|---|
| writing a colour, fill or filter in the figure | pick a look or write a look object |
| a label on a face, or text in the drawing | `label` / `sub` on the node, or `g.label` |
| labels piling up on one side | give `dx`/`dy` so they point outward; the declutter does the rest |
| links crossing nodes | move a node, or route with `via: "y"` or waypoints |
| a system with fifteen nodes | it is two diagrams; or group them as layers of a `stack` |
| a diagram in a bordered card | make it the hero: `clear: true`, the page's background is the look's ground |
| labels far from what they name | `dy` about -14; `dx` only to point outward |
| testing the pointer against what is drawn now | `input.hit`, `s.ground(...)`, or the targets you set |
| a timer or `requestAnimationFrame` | `g.to(...)`, `s.loop(...)` for ambient motion, `ctx.trace(...)` for a packet |
| reading `input.action` inside a later callback | copy it first: `const action = input.action` |
