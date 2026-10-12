# Looks

A figure never names a colour. Its parts carry roles (`.lw-o` is a silhouette, `.lw-t` the face toward the
viewer, `.lit` the one highlight), and a look fills the roles in. So every figure wears every look, and the page
switches between them live.

## Fourteen, and the generator

| Look | What it is | Effects | Reach for it when |
| --- | --- | --- | --- |
| `paper` | Hairline's own: white, grey hairlines, one ink accent | none | a product page, docs, anything quiet |
| `graphite` | the same in the dark | none | a dark product UI |
| `blueprint` | Prussian blue, white lines, amber accent | grid | engineering, hardware, how-it's-made, exploded views |
| `riso` | cream paper, blue ink, fluoro-pink accent, the pink plate printed a little off | offset, grain | editorial, playful, print, culture |
| `neon` | near-black, violet lines, lime accent | glow | music, nightlife, gaming, launches |
| `clay` | warm sand, filled faces in three tones, terracotta accent | grain | homes, food, plants, craft, anything tactile |
| `ink` | ivory, heavy black brush line, vermilion seal | wobble, grain | stories, essays, hand-made, Japanese stationery |
| `terminal` | phosphor green on black | glow, scanlines | dev tools, infra, status, security |
| `cobalt` | white and cobalt, tonal faces, a faint grid: the classic system diagram | grid | architecture, data, any technical explainer |
| `ledger` | ivory paper, deep green ink, a vermilion seal | grain | finance, compliance, records, legal |
| `studio` | charcoal, dark tonal faces, a brass accent | none | premium hardware, product pages |
| `console` | near-black navy, slate faces, a mint accent with a soft glow | glow | developer docs, APIs, infrastructure |
| `signal` | concrete grey, black ink, safety-orange accent | none | logistics, warehouses, transport, industry |
| `sage` | soft sage, warm tonal faces, a terracotta accent | none | interiors, furniture, homes, wellness |
| `hue:<0-360>` / `hue:<h>:dark` | a whole look from one hue, in OKLCH so every hue keeps the same contrast | none | a brand colour; try `hue:285`, `hue:160:dark` |

Pick the default from the subject, then let the switcher show the rest. Four figures in one series read best in
four different looks.

## Roles

| Role | Fills | Notes |
| --- | --- | --- |
| `ground` | the page and the stage | |
| `plate` | every solid's sides; it hides what is behind | make it the ground for a line look, a tone for a filled one |
| `shade` | sides facing screen-right | equal to `plate` in line looks; darker in `clay` |
| `top` | the face toward the viewer | lighter than `plate` in `clay` |
| `edge` | silhouettes | at least 3:1 against `ground` |
| `crease` | the one inner line; dim dots; openings (`hole`) | visibly weaker than `edge` |
| `mid` | lines, guides, dots | between the two |
| `accent` | the one highlight's strokes and dots | the strongest colour in the look |
| `accentTop` | the lit thing's top face | a tint of `accent`, or `top` |
| `ink2` | the second ink in `offset` | |
| `glow` | the halo in `glow` | |
| `ink`, `muted`, `line` | the page around the figure: text, secondary text, borders | |

## Effects

`grain` (paper noise), `grid` (blueprint lines; plates hide it), `glow` (a halo on silhouettes, a stronger one on
the accent), `offset` (the whole drawing printed again underneath in `ink2`, a little off register), `wobble`
(a hand-drawn line), `scan` (scanlines). They combine: `fx: "offset grain"`.

## A new look

Pass an object anywhere a look name goes, `look: { … }` in the figure or `handle.setLook({ … })`:

```js
{
  label: "Mint", dark: false, w: 1, fx: "grain",
  c: { ground: "#eef6f1", plate: "#eef6f1", shade: "#eef6f1", top: "#eef6f1", edge: "#2f6b55", crease: "#bfd9cc",
       mid: "#6f9e8a", accent: "#e4572e", accentTop: "#fbd5c8", ink2: "#e4572e", glow: "transparent",
       ink: "#1f3d32", muted: "#5d7f71", line: "#d6e7de" },
}
```

To add it to the switcher for good, add it to `LOOKS` in `engine/linework.js`; that is the one engine edit that
is allowed. Run the check after: the look strip shows it on the figure, and the console stays clean.
