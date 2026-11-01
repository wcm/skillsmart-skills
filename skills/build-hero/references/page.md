# The page

The header of `site/engine/chantier.js` lists every option, and that of `site/engine/hud.css` every scaffold part.

## Timing

`p` is the hero's scroll progress: 0 when its top meets the window's top, 1 at its end. A page says when things happen in p:

| Hook | Does |
|---|---|
| `data-ch-in="0.1 0.3"` | fades in and rises at 0.1, leaves at 0.3 (one number: it stays; `"0"` is in from the start). `data-ch-fade="0.02 0.012"` sets how long it takes |
| `data-ch-count` | a number: `data-from`, `data-to`, `data-at="a b"`, `data-format` (`int`, `pad2`, `pad3`, `comma`, `clock`, `dec1`) |
| `data-ch-step="0.4"` | gets `.is-done` once p passes 0.4; the last one passed also `.is-now` |
| `data-ch-bar="a b"` | gets `--k`, 0 → 1 across a..b, for bars and dials in CSS |
| `data-ch-hint` | leaves on the first scroll |
| `data-reveal` | below the hero: fades in and lifts as it comes into view (call `reveal()`) |

On the section the engine sets `--p`, `--film`, `--dusk`, `--lit` (0..1) and where the frame lies on the stage (`--fx`,
`--fy`, `--fw`, `--fh` in px), so a callout can sit on a part of the picture. Don't use the CSS `translate` property on
`data-ch-in` elements: the engine moves them with it. `onUpdate: ({ p, dusk }) => …` in `mountBuild` is for anything else.

In the address: `?p=0.6` opens the page at that point; `?record` turns smoothing and the auto-play off. `window.chantier`
is the running engine: `.at(p)`, `.p`, `.options`, `.redraw()`.

## mountBuild

```js
await mountBuild(document.getElementById("build"), {
  frames: "frames",                 // frames/ on wide screens, frames-phone/ under 760 px
  film: [0.04, 0.74],               // where the film plays, in p
  lit: { dusk: "img/dusk", src: "img/lit", at: [0.76, 0.92], split: 0.4, reveal: "rise", noise: 0.3 },
  focus: [0.5, 0.5],                // what stays in view on narrower stages; or keys [[film time, x, y], …]
  zoom: 1,                          // a little over 1 gives the frame room to lean
  phone: { mode: "cover", zoom: 1, focus: [[0, 0.5, 0.5], [1, 0.6, 0.5]] },   // or mode: "band", a wide band with a blurred copy around it
  glide: 3000,                      // one scroll plays everything, in ms; glideTo sets where it stops if not the end of the lights
});
```

`reveal`: `rise` (bottom first), `fall`, `sweep` (left first), `sweep-left`, `radial` (from `origin`, in frame units) or
`scatter`. `noise` (0–1) breaks the order up, `cells` sets its grain, `soft` widens the edge, `flicker` (0–0.2) keeps lit
areas flickering gently, like candles.

Set `lit.origin` from where the light really starts in `lit.png`. `--ch-length` on `.ch` sets how long the hero scrolls
(default 420vh).

## Words and look

- **The title reads first.** On the first screen it must read clearly, on desktop and phone, with nothing still behind
  it. Frame the first screen so the subject sits clear of it, or shift the frame with `focus`.
- **Captions about five words.** In the auto-play each shows for about a quarter of a second. Short stage names help.
- **Nothing under 13 px** (HUD labels) or 15 px (body). Words over the film get a soft shade behind them, never a blur or filter on the text.
- **No pauses.** The film moves on the first scroll; the next stage starts when one ends. Still moments only on the lit last frame.
- **Own look.** One display font, one body font, one palette, one signature readout from the business's own world. Keep
  the shared scaffold's mono labels if they suit it, restyle them with the `--hud-…` variables if not.
- **Short.** About eight screens in all, the hero four of them, so the page plays in a short video.
- **Real content only.** No fake reviews or client counts. Mark what's a placeholder.

## Examples worth reading

- Tidelight (`assets/examples/tidelight/main.js`): a floor ruler that counts floors, then lights them; a time map.
- Cerise (`…/cerise/main.js`): a hand-drawn pen line drawn by film time, a notched frame, a clock.
- Misura (`…/misura/`): the film framed in a working drawing, a frame that fits the stage.
- Kebun (`…/kebun/`): a window that opens to full screen on the first scroll; depth tiles.
