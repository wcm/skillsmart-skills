# The pieces

Pick by the brand's character and by the scheme the page needs. Each example is a full page you start from
(`new_project.py … --from <example>`).

## Urchin — prism rods from a core (`urchin`)

140 thick hexagonal rods around a chrome core; each facet pair is a 60° prism, seven wavelengths each, so white light
carried out along the rods fans into spectra. Slow spin, breathing rods, pulses of light running out from the core.

- **Suits:** AI, research, data, optics, anything about "one source, many results"; a bold first screen.
- **Scheme:** black void, white light. It works because the light is thin and hot against pure black.
- **Response:** rods pointing at the cursor reach for it; a tap blooms; drag tilts and rolls, a flick flings.
- **Knobs:** rod count and length, the spin, how far rods reach, the bloom's strength. `maxDpr` is 1.25 (it's heavy).

## Cubes — a wall of glass blocks (`cubes`)

Slightly smoky glass blocks with round arrises in front of a pearl light box ruled with dense black lines (two
crossing sets), refracted through each block's real thickness at 14 wavelengths; a thin-film tint adds angle-shifting
rainbow bands. A wave rolls through the blocks; the rules drift.

- **Suits:** architecture, interiors, materials, a light and calm brand; the only pale scheme.
- **Scheme:** a pale page shows colour only where the glass bends a dark line against light, so the rules are dense.
- **Response:** blocks near the cursor turn and lift; drag tilts the wall, which settles back.
- **Knobs:** grid size, block size and rounding, the rules' spacing and angle, the thin-film strength.

## Twist — a ribbed glass knot (`twist`)

A trefoil knot of thick clear glass with 72 fine ribs; each rib bends the coloured glows behind it and catches hot
softboxes and white glints at its own angle, with dark grooves between. It turns slowly; the ribs twist and flow.

- **Suits:** events, music, culture, creative tools; loud, saturated, nocturnal.
- **Scheme:** a smooth dark room with soft hot-orange, electric-blue and magenta glows (the `BACKDROP` shader) and a
  studio of matching softboxes (`ENV`). Swap the three hues for the brand's, keeping them saturated against near-black.
- **Response:** the cursor is a light whose glint slides along the ribs; drag tilts and rolls.
- **Knobs:** `RIBS`, `TWIST`, `RADIUS`, the knot's p/q (TorusKnotGeometry), the glow positions.

## Flower — glass petals through a soft lens (`flower`)

Thin, cupped glass petals glowing edge-on with hot spectral rims and twinkling dew, a bead heart in a sunflower
spiral, a stem and a bud, drawn through a soft old lens that splits each wavelength as it defocuses (`engine/lens.js`).
Petals breathe, the flower sways, its light shifts, the focus drifts.

- **Suits:** beauty, fragrance, fashion, wellness; soft, sensual, premium.
- **Scheme:** black with hot pink, orange, violet and electric blue. The lens's halation and grain make it filmic.
- **Response:** focus follows the cursor and the petals open toward it; drag tilts and turns; it settles back.
- **Knobs:** petal count, layers and cup, the colours along the rim, the lens's blur and split.

## Extras, light only (`halo`, `plume`)

- **Halo:** a ring of light drifting up through mist; the long exposure stacks its ghosts into one soft egg, with a
  rainbow arch and a low sun at its foot. A gradient sky, so no scrim (the copy sits high). Move to lean, hold to rise.
- **Plume:** white smoke on a live fluid simulation seen through a prism: every edge splits into a bold red-to-violet
  fringe. Move to stir, click for a puff. Heavier on the GPU than the glass pieces.

## Choosing quickly

| The brand is… | Start from |
|---|---|
| tech, AI, research, bold | `urchin` |
| architecture, materials, calm, light | `cubes` |
| an event, music, culture, loud | `twist` |
| beauty, fragrance, fashion, soft | `flower` |
| editorial, atmospheric, no object | `halo` or `plume` |
