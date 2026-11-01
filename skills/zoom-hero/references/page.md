# Writing the page

A page is three files in `site/<id>/`, on the shared `site/engine/` (`loupe.js` the zoom, `ui.js` and `ui.css` the viewfinder interface; don't edit them for one page, override in the page's `style.css`). The header comments of `loupe.js` and `ui.js` are the full reference.

## index.html

The stage with its layers, and the elements `ui.js` fills in, placed wherever the page wants them:

| Element | What it shows |
|---|---|
| `[data-lp="copy"]` | the level's words, swapped on arrival |
| `[data-lp="span"]`, `mag`, `depth`, `name` | live: field width, zoom, level number, level name |
| `[data-lp="ruler"]` | the log scale; `data-orient="h"` lays it along the bottom |
| `[data-lp="crumbs"]` | the way back up, with round pictures |
| `[data-lp="back"]` | zooms out one level |
| `[data-lp="hint"]` | shown until the first dive |

Keep the zones the pictures' spots avoid: navigation along the top, crumbs under it, words bottom left, readouts bottom right, the scale bottom centre. Update `<title>`, the description, the fonts, the brand, the title, and `img.lp-first` (the first level's `-1600.webp`, with alt text): it shows until the engine is ready and stays if WebGL is missing.

## style.css

Set the tokens, then lay out the page:

```css
:root { --lp-ink: …; --lp-accent: …; --lp-glass: …; --lp-ui: "…", monospace; }
```

`--lp-ink` is the lines and small type over the picture, `--lp-accent` the one accent, `--lp-glass` the tint behind chips, `--lp-ui` the small readout face. `ui.js` writes on `<html>`: `data-level`, `data-depth`, `data-moving`, `data-dir` and `--lp-depth` (continuous, 0 on the first level), so CSS can fade the title as the dive starts: `opacity: calc(1 - var(--lp-depth) * 4)`. Use `html[data-level="…"]` when a level needs its own ink. Add scrims wherever words sit on busy picture. Phone rules matter: on a tall screen the first level is cropped to its middle and the view leans to the main spot, so a title on a wall may need a frosted card (see Surface Theory).

## main.js

```js
const content = {
  vine: {
    name: "Old vines",          // crumbs and the scale
    spot: "The old vines",      // the chip on the spot in the level above
    kicker: "The old vines", title: "Grenache, planted <em>in 1962.</em>", text: "Deep roots, small crops…",
    facts: [["Age", "63 years"]],
    notes: [{ at: [0.47, 0.7], text: "Trunk · 63 years", side: "right" }],   // pinned to the picture, at rest
    at: [0.5, 0.4],             // optional: the spot's place inside its area
    cursor: "Look",             // optional: the word in the ring over the spot
  },
};
const levels = await (await fetch("img/levels.json")).json();
const lp = await Loupe.create(document.getElementById("loupe"), { levels, base: "img/" });
const ui = bindUI(lp, stage, { content, thumbs });
lp.on("arrive", ({ level }) => { /* a card at the bottom of the dive */ });
if (new URLSearchParams(location.search).has("tour")) ui.tour();
Object.assign(window, { lp, ui });      // the tools need these
```

Words: short, plain, concrete. A title per level, one or two sentences, a few facts. Notes sit on details you can really see, never over a spot or under the words.

- `lp.go(id)` dives or climbs to any level (a climb of several levels is one eased move); `lp.back()`; `lp.level`, `lp.path`, `lp.children(id)`.
- `lp.on("arrive" | "depart" | "frame", fn)`; `lp.screenRect(id)` is a level's frame on screen, for anything you pin to a picture yourself.
- `ui.lock(id, true)` hides a spot until a game unlocks it; `ui.tour({ plan, hold })` plays moves on its own.
- `Loupe.create(canvas, { levels, base, pace, blur, breathe, lean, grain })`: `pace` above 1 dives faster; `blur`, `breathe` and `lean` tune the motion, gently.

## What each example adds

- **Pruine**: a giant word with two small notes in the sky, the shop card at the last level.
- **Understory**: letters veiled by a mist gradient, a counter that counts up, the donation card with the path of the dive.
- **Surface Theory**: the light theme, calipers (`main.js`, `calipers`) measuring what you see, a scan line over the face, the bottle's label printed in HTML over a blank one, a product card.
- **Where's Pip?**: sticker-style overrides of every shared part, a mis-registered title, the game (`ui.lock`, clue cards, a tracker, confetti), and `plan` for the tour.
