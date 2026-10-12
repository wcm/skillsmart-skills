# The four kinds of cloth

Pick by what the brand would really hang, and by what you want the visitor to do. Each example is a full page you
start from (`new_project.py … --from <example>`); this file says what each is good at and which settings change its
feel. Change one setting at a time and look.

## A hanging sheet — `afterhours`

A square of material clipped to a wire (here black holographic vinyl with a printed digital human). The clips are set
closer than the sheet is wide (`SLACK`), so it hangs in swags.

- **Good for:** a printed product (a poster, a scarf, a tarp, a garment), a fashion or tech brand, a picture you want
  the visitor to *handle*.
- **Cursor:** press and drag pulls the nearest point (`grabSpeed` caps how fast it follows, so folds can't pass
  through the sheet); let go and it drops. The cursor is also a light (`torch`); the HUD reads the tension.
- **Feel:**

  | Setting | Example | Raise it for | Lower it for |
  |---|---|---|---|
  | `density` | 0.4 kg/m² | heavier canvas, slower swing | paper, tissue |
  | `bend` (compliance) | 0.06 | softer, more folds (satin) | stiffer (vinyl, card) |
  | `shear` | 1e-6 | — | keep tiny |
  | `damping` | 0.6 | calmer, settles sooner | livelier |
  | `kN` / `kT` | 2.4 / 0.12 | more air on the face / along it | — |
  | `SLACK` | 0.88 | flatter (1.0 = taut) | deeper swags |
  | `COLS`, `ROWS` | 53 × 53 | finer folds (costs physics time) | faster |

- **Material:** `MeshPhysicalMaterial` with clearcoat and iridescence for vinyl; drop iridescence and raise roughness
  (0.6–0.8) for cotton or canvas; add `sheen` for satin.

## Split panels — `noren`

Several tall panels on a pole, cut free at the slits (here four indigo hemp-linen panels in a Kyoto doorway). Each
particle is tethered to the pole by the cloth above it (`buildTethers`), so they hang straight and settle without
bounce; a draft that differs panel to panel keeps them moving on their own.

- **Good for:** a shop, studio, restaurant, hotel or theatre: anything with a doorway; a "come in" call to action.
- **Cursor:** press and drag lifts a panel; hovering eases the panels apart; a click (and the "Walk in" button) sends
  a whole person through the slits.
- **Feel:** `PANELS` (2–6), `PW` / `PH` (panel size, metres), `density` 0.62 (heavy linen), `bend` 0.2, `damping`
  1.2 and `kN` 7 (air drag across the face; this is what makes it settle calmly). Lighter cloth (gauze, a bead-less
  sheer curtain): lower `density` to ~0.15 and `damping` to ~0.5.
- **Scene:** the panels hang in the doorway of a photograph; `PLATE` says where that doorway is (its width as a
  fraction of the picture, its centre, the lintel). A new doorway picture needs those numbers re-measured.

## A bead curtain — `moongate`

Strands of beads inside a round gate cut in a wall (here 64 strands × 70 beads in an oxblood lacquer wall). One bead
per pixel of the picture: its darks and lights choose the bead kinds (pearl, glass, stone, gold).

- **Good for:** jewellery, a luxury or hospitality brand, a festival, anything precious; a picture with bold, simple
  shapes (a moon, a logo-like mark, a portrait in silhouette). Fine detail is lost at one bead per pixel.
- **Cursor:** a soft finger parts the strands; they drape straight down from where they're pushed, slip off if carried
  too far (`finger.maxPush`) and knock against each other (sound), then settle back into the picture.
- **Feel:** `COUNT` × `BEADS` (the picture's resolution), `PITCH` / `LINK` (spacing), `damping` 2.4 (heavy beads),
  `spans` (how far a bead can be from the ones above it: no stretch, no bounce), `sim.air` (the breeze).
- **The gate:** real geometry in front of the strands crops the curtain to its shape. A square or arched opening is a
  change to the wall's shape and to where the strands are anchored.

## A streaming banner — `tide`

A long banner held off-frame and streaming in a current (here 0.82 × 3.9 m of silk under water). Bends fed in near the
held end ride the whole length at the current's speed; its hems are cut long, so they ripple; its free end flutters.
It is already streaming when it appears (it settles off-screen first).

- **Good for:** silk, ribbons, flags, a long print, anything about water, wind or flow; a calm, luxurious page.
- **Cursor:** a hand that rests on the silk wherever it hovers and presses straight in (never drags it toward you);
  the current carries the dent downstream. Strokes leave swirls; a click releases bubbles.
- **Feel:** in `SILK`: `current` (speed), `waves` (the bends fed in), `twist`, `curl`, `flutter`, `turbulence`,
  `kN` 12 / `kT` 0.05 (water pushes hard on the face, hardly along it). For a flag in wind: `gravity` back to about
  `[0, -9.81, 0]`, `density` up, `current` up, and the rig (`RIGS`) pointing across the frame.
- **Rendering:** the banner is drawn as a smooth spline surface three times finer than the physics grid, so silk looks
  round and soft at no physics cost.

## Shared rules

- Physics runs at a fixed 120 Hz (`stage.step`), whatever the display does. Never step it from the frame time.
- The cloth is framed by lens shift (`stage.frame`), so it is seen face-on wherever it sits in the layout.
- Keep the physics under ~6 ms a frame on a laptop: grid size and `substeps` are the cost. Self-collision
  (`selfCollide`) is what lets folds slide off each other; keep it on for anything that gets folded.
