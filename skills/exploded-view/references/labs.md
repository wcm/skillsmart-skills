# The labs

Scene 2's background and panel, drawn in code (`site/engine/labs.js`, styles at the end of `explode.css`). A page picks
one in `page.json` → `lab.style` and gives it data. Points on the product (`drivers`, `flow`) are `[u, v]` on the
exploded view like the parts' `at`: place them with `node anchors.mjs <id> --grid`.

## ticket (food and drink)

A dark lab with a flat-top glowing at the bottom, smoke rising and a giant outlined number behind the product. The
panel is a kitchen order ticket that prints line by line, fills its bars and runs a timer as the visitor scrolls.

```json
"lab": {
  "style": "ticket",
  "numeral": "820", "numeralUnit": "kcal",
  "ticket": {
    "head": "NIGHT SHIFT", "order": "#0147",
    "lines": [["1 × The Double", "$14.00"], ["Patties", "2 × 90 g"], ["Total", "820 kcal"]],
    "macros": [["Protein", 48, "g"], ["Fat", 52, "g"], ["Carbs", 38, "g"]],
    "timer": 90, "timerLabel": "On the flat-top",
    "foot": "Served hot · 01:12 a.m."
  }
}
```

The last line of `lines` is set in bold. `timer` is in seconds. On a ticket page the labels are tickets too (cream
paper, red numbers).

## sound (audio and tech)

A pale lab of soft anechoic foam. A frequency-response curve draws itself through the product, rings pulse out of the
drivers, and the panel is a dot-matrix readout with a meter and four facts.

```json
"lab": {
  "style": "sound",
  "drivers": [[0.325, 0.632], [0.675, 0.632]],
  "readout": { "caption": "Active noise cancelling", "value": 42, "unit": "dB", "level": 0.86 },
  "facts": [["Driver", "40 mm"], ["Range", "4 Hz – 40 kHz"], ["Battery", "60 h"], ["Weight", "254 g"]]
}
```

`drivers` are where the rings start (the curve runs through the first one's height). The readout counts up to
`value` (shown as minus decibels) and lights `level` of the meter.

## motion (sport and anything worn)

A dark lab with running-track lanes in perspective and motion-capture markers over the product. The panel is a big
percentage with comparison bars and four facts, and a foot-pressure map whose heat walks heel to toe, over and over.

```json
"lab": {
  "style": "motion",
  "markers": 16,
  "heat": { "caption": "Pressure through one stride", "low": "Low", "high": "High" },
  "big": { "value": 87, "caption": "Energy return" },
  "compare": [["Strata PEBA", 87], ["Standard EVA", 65]],
  "facts": [["198 g", "US 9"], ["39 mm", "heel stack"], ["8 mm", "drop"], ["2 mm", "lugs"]]
}
```

The pressure map is a shoe sole; for something worn that isn't a shoe, leave `heat` out of your copy of the lab or
change the outline in `labs.js`.

## energy (buildings, appliances, vehicles)

A pale lab of site contour lines with the sun's path (its sun moves through the day as the visitor scrolls). Energy
flows in a dashed line from the midday sun through points on the product, each tagged, and the panel is a heat-loss
scale with four facts.

```json
"lab": {
  "style": "energy",
  "flow": [[0.545, 0.116], [0.5, 0.573], [0.475, 0.717]],
  "flowTags": [["6.4 kWp", "solar roof"], ["13.5 kWh", "battery"], ["Warm floor", "21 m²"]],
  "legend": { "caption": "Heat lost through the shell", "low": "Low", "high": "High" },
  "facts": [["30 m²", "inside"], ["6 weeks", "to build"], ["18 t", "CO₂ held in the timber"], ["−30 °C", "rated to"]]
}
```

The flow can carry anything that moves through the product: heat through a kettle, water up through a moka pot,
charge through an e-bike.

## A new lab

Add a function to `labs.js` and its name to `export const labs = { … }`. It gets `api`:

| | |
|---|---|
| `api.page` | the page's `page.json` (`api.page.lab` is your data) |
| `api.bg`, `api.fg` | the layers behind and in front of the product: fill them with HTML or SVG |
| `api.toScreen(u, v)` | a point on the exploded view → window pixels (after a resize) |
| `api.vw`, `api.vh`, `api.mobile` | the window |

It returns any of `layout()` (after a resize: place what follows the product), `update(p, t)` (each scroll step;
`t.explode`, `t.chart` and `t.hold` run 0 → 1 through the explosion, the panel's entrance and the hold) and
`idle(ms)` (every animation frame, for motion that runs on its own). Style it at the end of `explode.css` with a short
class prefix, keep its panel in the left column, and give its idle motion a `prefers-reduced-motion` rule.
