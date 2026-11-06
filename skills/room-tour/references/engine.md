# Room Tour engine

The shared engine behind the four room-tour sites (`house/`, `hotel/`, `furniture/`, `gallery/`). A site is
`index.html` + `style.css` (tokens) + `tour.json`; the engine builds the rest. Plain ES modules, no build step, no
framework, WebGL2 for the stage. The spec is `../design-system.md`; this file is the contract.

Built: design-system section 9, steps 1–9: the stage, the timeline and clock with the recording mode, the title,
captions, walk bar and rail (1–4); hotspots, the stops' drawn lines, tracked tags, cards and the fact pill (5); the
mini-map (6); the cut's words and the end sheet (7); the art layer, wall labels and the lift (8); the recording's beats,
the calm cursor and the layer hook (9). Plus the `tour.json` loader, the theming and `tools/track.py` (the tracks file).

```
engine/
  tour.js        boot(): page skeleton, scroll + smoothing, the clock loop, events, record mode, window.tour
  timeline.js    walk → scroll segments and the recording timeline; multi-clip move t; stop and sheet pictures
  stage.js       WebGL2: cover-fit + focus into R, toScreen, window, inset frame, joins, sharp stills, recolour,
                 the cut's rising sheet, record-mode frame blending, the occluder canvas, passes
  frames.js      WebP frame sequences (tools/frames.py): coarse-to-fine preload, nearest loaded frame, ensure(i)
  clock.js       Clock, Fade, Switch: every timed animation runs on the engine clock
  schema.js      tour.json schema, validate() (warnings, never a crash), normalize() (defaults, repairs)
  util.js        helpers: easings (5.3), lengths, colours, fillPx/snap, DOM helpers
  ui/frame.js    stage frame: crop marks (inset is drawn by the stage)
  ui/nav.js      nav bar, Hide UI chip, layer slots
  ui/title.js    title blocks, fit test, gradients, occluder opacity, drift and nav exits
  ui/caption.js  stop captions: four placements, rule reveal
  ui/walkbar.js  walk bar: three layouts; ticks (+ works), profile, segments rulers
  ui/rail.js     rail: index, strip, works; glide on click
  ui/hotspots.js hotspots (dot / plus, halo, leader, pill / tag / wall plates, planned → built, keys, enterAt), the
                 stops' lines (dimension lines), the fact pill
  ui/tags.js     tracked tags (tracks files from tools/track.py, or keyframes)
  ui/cards.js    the card shell (scrim, scroll lock, focus, Esc, next ↗), material / facts / product, swatches
  ui/map.js      the mini-map: route walked, dot, cone, room fills, from, frames, clicks
  ui/cut.js      the cut's words: the sheet's hairline, line and note (its title rises in caption.js)
  ui/end.js      the end: the dim layer under a sheet, the end card in the stage
  ui/art.js      artworks on tracked canvases (a WebGL pass), wall labels, seen, the lift, objects
  artgl.js       the art layer's WebGL program: homography, light map ÷ median, canvas mask, AA edge
  ui/cursor.js   the calm cursor (a fluid outline beside the visitor's own cursor, verbs) and ?record's beats
  tour.css       component CSS, tokens only, in the `enfilade` cascade layer
  test/          a working tour on the spike's data, four presets + a broken one; tools/check.mjs drives it
```

## How a site boots it

```html
<head>
  <link rel="stylesheet" href="../engine/tour.css">   <!-- optional: boot() adds it if missing -->
  <link rel="stylesheet" href="style.css">            <!-- tokens on :root, small overrides -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?…">
</head>
<body class="tour" data-site="house">
  <main class="tour-scroll"><div class="tour-stage"></div></main>   <!-- optional: boot() creates both -->
  <section class="tour-end" id="end">…site HTML…</section>
  <footer class="tour-footer">… Demo site: names, places, prices and pictures are made up.</footer>
  <script type="module">
    import { boot } from "../engine/tour.js";
    import { legend } from "./legend.js";
    const tour = await boot({ data: "tour.json", layers: [legend] });
  </script>
</body>
```

`boot({ data, layers, core })`: `data` is a URL (paths in it resolve against its folder) or an object; `layers` are site
layers (below); `core` replaces the engine's own component list (default `CORE` from `tour.js`). It resolves to
`window.tour` once the first screen is painted. Engine rules sit in `@layer enfilade`, so any unlayered rule in the
site's `style.css` wins over them whatever the load order.

The engine fills `.tour-stage` with `canvas.tour-canvas`, `.tour-wash`, `.tour-title`, `canvas.tour-occluder`,
`svg.tour-lines`, `svg.tour-frame`, `.tour-ui`, `.tour-modal` (layer order 3.5), and sets the scroll height:
`main { height: (W + E + P + 1) × 100svh }`; for `end.arrive: "sheet"` the end section gets
`margin-top: −(E + P) × 100svh`, `min-height: (E + P) × 100svh`, `position: relative; z-index: 2`, so it slides over the
pinned stage and the footer never slides under it.

Body classes the engine sets: `tour-ready` (first screen painted; `tour-loading` before), `tour-phone` (< 768 px),
`tour-record`, `tour-reduced`, `tour-clean`, `tour-hidden` (Hide UI), `tour-title-stacked` (the fit test chose the stack
boxes); `data-material`, `data-frame`, `data-label-case`.

Query parameters: `?record` (and `&fps=30`) recording mode · `?rec` the recording frames (full rate, blended) on the
live page, for a screen recorder that scrolls the page itself · `?clean` loads with the UI hidden · `?reduce` forces
reduced motion (as does `prefers-reduced-motion`). `H` toggles Hide UI.

Frame sets: viewports wider than 900 px load `<clip>/`, others `<clip>-phone/`, `?record` and `?rec` load `<clip>-rec/` (each falls
back to `<clip>/` with a warning). Each folder is `tools/frames.py` output: `0001.webp …` + `manifest.json`
(`count, fps, pattern, pad, size, src { fps, count, size }, map`).

## tour.json (design-system.md 8.2)

`validate()` logs one `[tour] tour.json: …` warning per problem (unknown field, missing field, wrong type, value outside
its list, a walk out of order, a move whose `from`/`to` disagrees with the walk, a frame reference to nothing) and the
page still runs: `normalize()` fills defaults, drops what can't be used (a title block without `lines`, an item out of
turn in the walk), puts a bad theme value back to its default and coerces small slips (a number heading becomes text).
`window.tour.problems` lists the messages. `test/tour-broken.json` exercises this.

Every field below is supported; the steps 5–9 fields are described with examples under "Components" further down.

| Field | |
| --- | --- |
| `version`, `site`, `meta.{title, description, lang}` | ✓ (`site` → `body[data-site]`, `meta.title` → `<title>` if empty) |
| `theme.material` | ✓ `body[data-material]` (styling is the site's) |
| `theme.grain` | ✓ written to `--grain` if the site didn't set it (paper only, the site's CSS) |
| `theme.frame.{kind, inset, radius}` | ✓ `crop` marks · `inset` (R inset, radius; eases to 0 over the end's arrival) · `none`; inset/radius may be `{desktop, phone}` |
| `theme.label.brackets` | ✓ `ctx.label(s)` → `[ s ]` (caption label lines) |
| `theme.rail.{skin, case, hideOnTitle, pop}` | ✓ `index` · `strip` · `works` · `none`; `pop` = the strip's hover text with `{n} {of} {label} {time} {name}` |
| `theme.ruler.{style, count, works, profile, summits}` | ✓ `ticks` (+ `works`) · `profile` · `segments` · `none` |
| `theme.walkbar.{layout, right, meta, hideOnTitle, counter}` | ✓ `center-ruler` · `left-ruler` · `no-ruler`; `meta` fills `{seen} {works} {n} {of} {stop}`; `right: "layer"` leaves `ctx.slots.walkbarRight` to a layer; `counter`: `name` (default) · `number` · `none` |
| `theme.caption.{place, rule, case}` | ✓ `bottom-left` · `top-left` · `center` · `split`; `case`: `sentence` · `upper` · `lower`. Each caption box carries `data-stop` and `--in` (0 → 1 as it arrives), so a site can put one stop's caption on a panel that fades in with it |
| `theme.hotspot.{icon, leader, plate, plateOn, opens, halo}` | ✓ hotspots (below) |
| `theme.map.{svg, corner, frame, cone, from, label}` | ✓ mini-map (below) |
| `theme.cursor.{on, verbs}` | ✓ the calm cursor; `verbs`: `hotspot`, `art`, `add`, `swatch`, `button` |
| `theme.end.{arrive, frame, screens, pin, at}` | ✓ `sheet` · `card` (opens at the last incoming segment's `at`, default 0.92); `dim` · `keep` · `mask`; `pin` (below) |
| `brand.{name, wordmark, cover}` | ✓ wordmark in the nav; on the cover only when the title isn't the brand (a block or run of blocks spelling it), else it fades in once the title has left; `cover: true/false` overrides |
| `nav.left` | ✓ `"wordmark"` (any value shows the brand; null hides it) |
| `nav.center` | ✓ `"rail"` (the index skin goes here) · `"none"` · any other string = a text line (the gallery's flight target) |
| `nav.right[]` | ✓ `{chip, do}` · `{chip: "hide"}` · `{button, do}` · `{link, do}` · `{layer, do}` (an empty `span.tn-layer` in `ctx.slots.layers[name]`); `primary: true` shows on the cover, the rest join the UI group. `do`: `end` · `end#<anchor>` · `stop:<id>` · `#<selector>` · `hide` |
| `title.blocks[]` | ✓ `id, lines[], class, tag, align, valign, space, kicker, kickerAt, box, stack, stackAlign, size {desktop, phone, max, min, stack}, exit {dx, dy}, hidden, slot: "nav-center", part`; any of `align, valign, space, box, stack, kickerAt` may be `{desktop, phone}`; `hidden: {phone: true}` hides on one device |
| `title.gradients[]` | ✓ `edge, color, opacity [edge, far], extent, start, rest, device`; `opacity/extent/start/rest` may be `{desktop, phone}`; `start` = edge opacity on the cover, `rest` = for the walk (both default `opacity[0]`) |
| `title.occluder.{masks, frames, feather}` | ✓ masks `{n}` → 0001…; the phone set is the sibling `-phone` folder |
| `title.window.{desktop, phone, radius, grow}` | ✓ R eases from the box to the viewport over `grow` screens |
| `title.exit.{mode, screens}` | ✓ `drift` · `nav` |
| `walk` | ✓ stop, move or cut, stop, … |
| `stops.*` | ✓ `n, name, frame (<move or clip>:first/last), still ({desktop, phone} or string), stillPhone, sharp, focus, screens, bar, caption {heading, body, label, row, price, place, at, rule}, photo {n, of, label, time, thumb, thumbLg}, thumb, hotspots, lines, map` |
| `stops.*.caption.row` | ✓ `[[label, value], …]` or `[{label, value}]` or strings |
| `stops.*.caption.price` | ✓ a string, or `{pre, amount, unit, note, link {label, do}}` |
| `moves.*` | ✓ `from, to, clips[], screens, rec, events [{at, name, id}], focusKeys [[t, x, y]], tags, panels` |
| `cuts.*` | ✓ `from, to, screens, rec, sheet` (the picture transition), `line, note, title` (its words) |
| `cards`, `artworks` | ✓ (below) |
| `end.id` | ✓ the end section (`#end`, else `section.tour-end`) |
| `record.{fps, hold, speed, end, frames, beats, endTo}` | ✓ timeline; `beats` are timed, listed and played by the cursor (below); `endTo`: the recording's end scrolls on to a selector or by N extra screens |

## Components (steps 5–9): fields and examples

All positions are fractions of the 16:9 frame unless marked. Every component goes through `ctx.toScreen` each frame, so
it agrees with the picture while `R` changes (window, inset, focus).

### Hotspots (4.7) — `ui/hotspots.js`

```jsonc
"theme": { "hotspot": { "icon": "dot", "leader": false, "plate": "pill", "plateOn": "always", "opens": "card", "halo": "off" } },
"stops": { "shell": { "hotspots": [
  { "id": "m02", "at": [0.60, 0.88], "label": "Terrazzo", "code": "M-02", "card": "m02", "state": "planned",
    "keys": [[0, 0.60, 0.88], [1, 0.602, 0.896]] },                      // carried through the outgoing move
  { "id": "m04", "at": [0.10, 0.55], "label": "Limestone", "code": "M-04", "card": "m04", "state": "planned",
    "enterAt": "ui", "keys": [[0, 0.10, 0.55], [1, 0.072, 0.546]], "turn": { "at": "limestone", "state": "built" } },
  { "id": "p01", "at": [0.40, 0.66], "label": "dune", "price": "€4,900", "card": "p01", "plateOn": "hover", "leader": false },
  { "id": "h-sauna", "at": [0.90, 0.50], "pill": "Sauna for two · cedar" },  // plate "none": the dot opens a fact pill
  { "id": "o-07", "at": [0.79, 0.70], "work": "w07", "plate": "wall" }      // an object: opens its lift
] } }
```

- `icon` `dot` (8 px core, 24 px ring, 44 px hit area) · `plus` (a 12 px + in a soft disc). `halo` `off` · `one` (one
  breathing halo: the next beat's target at this stop, else the dot nearest the pointer, else the first dot with a card).
- `plate` `pill` (code + name; `[M-02]` in brackets where the site owns them) · `tag` (name — price) · `none` · `wall`
  (an artwork's number, title, year · medium). `plateOn: "hover"` shows it on hover or focus only. `leader` (1 px, 20 px
  at 45°, a 40 px run). Per hotspot overrides: `icon, plate, plateOn, leader, side` (`left | right | auto`).
- `state` `planned` (dashed, no fill) · `built` (solid); the plate cross-fades 300 ms when a carried hotspot turns: at
  `turn: { at: <move t or move-event id>, state }`, else at the move event whose `id` is the hotspot's id, card or
  label (lowercase), else halfway.
- Timing: in at the incoming move's 0.96 (stop 1 on load; `enterAt` a fraction of the outgoing move, or `"ui"`); out
  at the outgoing move's 0.04 (the last stop's when an end sheet starts to arrive; an end card keeps them); at most 4.
  A hotspot with `keys` rides through the outgoing move (move t of the frame on screen) and becomes the next stop's
  hotspot with the same id without leaving.
- The rule (3.2): a plate that would cross the viewport edge, a band, the stop's caption box or the map flips to the
  other side; a dot off the visible picture (a phone's slice) hides with its plate; a dot inside its stop's caption box
  is warned at layout.
- Click: `opens` `card` (`card` id) · `pill` · `none`; a hotspot with `work` lifts that work. `.th[data-hotspot=id]`.

`stops.*.lines`: `[{ "kind": "dim", "from": [0.247, 0.42], "to": [0.887, 0.42], "text": "7.20 m" }]` (or `"kind":
"line"`): 1 px `--line-photo` in `.tour-lines`, end ticks for `dim`, the text in a break (label face), drawing in over
280 ms with the stop's hotspots; clipped to the visible picture (a phone shows part of it; too short for its words, the
words hide).

### Tracked tags (4.8) — `ui/tags.js`

```jsonc
"moves": { "move-2": { "clips": ["frames/move-2a", "frames/move-2b"], "tags": [
  { "id": "t-suka", "text": "M-05 SUKABUMI", "offset": [40, -40],
    "track": ["tracks/move-2a.json#coping", "tracks/move-2b.json#coping"], "from": 0.12, "to": 0.9 },
  { "id": "t-teak", "text": "TEAK", "keys": [[0, 0.30, 0.50], [1, 0.22, 0.52]] }          // no track: keyframes
] } }
```

The label face on a `--plate` 80 % plate, 12 px right of and above its point + `offset` (px), brackets where the site
owns them. Read at the source frame the stage drew (`ctx.view`), one track per clip. In at q ≥ 0.6, out under 0.5 or
lost, outside `from`–`to` (default 0.08–0.92), faded within 3 % of the picture's edge; 150 ms; at most 3. Make the
tracks with `tools/track.py` (below).

### Cards and the fact pill (4.9) — `ui/cards.js`

```jsonc
"cards": {
  "m02": { "type": "material", "code": "M-02", "name": "Terrazzo", "line": "…", "swatch": "img/sw-terrazzo.webp",
           "rows": [["Finish", "…"], ["Origin", "…"], ["Size", "…"], ["Where", "…"]],
           "status": { "planned": "Planned — goes in during step 2", "built": "Built" } },   // follows the hotspot's state
  "room-12": { "type": "facts", "name": "Room 12", "sub": "Second floor · south-east", "line": "…",
               "rows": [["Size", "28 m²"], ["Bed", "King"]], "price": "€420 a night", "button": { "label": "Book this room", "do": "end#book" } },
  "p01": { "type": "product", "no": "01", "name": "dune", "kind": "modular sofa", "line": "…", "price": "€4,900",
           "sizes": [["86", "H"], ["240", "W"], ["98", "D"]], "unit": "cm", "material": "corduroy", "img": "img/p01.webp",
           "ship": "ships in 6 weeks", "next": "p02", "add": "add to cart",
           "swatches": [
             { "name": "rust", "hex": "#B4441F", "packshot": "img/p01.webp", "recolour": null, "theme": { "--accent": "#B4441F" } },
             { "name": "plum", "hex": "#5A2232", "img": "img/sw-plum.webp", "packshot": "img/p01-plum.webp",
               "recolour": { "src": "img/sofa-plum.webp", "mask": "img/sofa-mask.webp", "stop": "sofa" },
               "theme": { "--paper": "#F1E3E4", "--ink": "#3A1020", "--accent": "#5A2232" } } ] }
}
```

- Shell: 440 px at the right (y 96–800, scrolling inside), a 40 px × chip; phone a bottom sheet (80svh). Open: scrim
  300 ms, card from x + 40 px over 480 ms (`out`; phone y + 24); focus moves in; the page scroll is held (wheel, touch,
  keys and the scroll position) while the card's own body scrolls (`[data-tour-scrolls]`). Close: ×, Esc, the scrim,
  280 ms (`in`); focus returns to the opener. `next ↗` cross-fades 300 ms.
- Swatches: the packshot cross-fades 300 ms; at the recolour's `stop` (or anywhere when the card has none) the stage
  re-colours inside the mask (`stage.setRecolour`, 300 ms, 2 px feather; a swatch with `recolour: null` puts the
  original back; oat → plum cross-fades with no rust between) and the page takes `theme` (`ctx.setTokens`, 600 ms).
  Elsewhere a swatch changes only the card. Any element with `data-swatch="<card>:<name>"` (a site's colour row) picks
  the same way.
- Open one from anywhere: a hotspot, `ctx.openCard(id)`, or any `do` string `"card:<id>"` (a caption's price link).
- Fact pill: a hotspot with `plate: "none"` (or `opens: "pill"`) shows `pill` (else `label`) beside its dot: 220 ms fade
  and 6 px slide, no scroll lock, one at a time; Esc or a click elsewhere closes it.

### Mini-map (4.10) — `ui/map.js`

```jsonc
"theme": { "map": { "svg": "img/map.svg", "corner": "tr", "frame": "title-block", "cone": true, "from": "move-2",
                    "label": "TEDUH HOUSE · GF · 1:200" } },
"stops": { "living": { "map": { "stop": "s2", "room": "r-living", "heading": 180 } } }
```

The SVG (site-drawn, any viewBox; scripts are stripped) carries `#route` (one path along the walk; a cut is a jump
between subpaths), `#stops [data-stop]` and `#rooms [data-room]`. The engine dashes the route and draws the walked part
solid, moves a 6 px `--signal` dot along it (each stop sits at the route's point nearest its circle; moves interpolate),
turns a 40° cone (`cone: true`) between the stops' headings (0 = up, clockwise), fills the current room (`--map-fill`,
default `--signal` at `--map-fill-o` .24, 300 ms). `from`: `"ui"` (with the UI group) or a move id (fades in as it
starts). It fades as an end sheet's top reaches it. `frame`: `title-block` (a hairline box with the label row) or
`crop` (corner marks). `corner`: `tr`, `br`, `bl` or `tl` (200×140 by default; a site sets a larger box in its CSS, and
the art layer's wall labels stop above a map in their column). Click a room (glides to the last stop in it) or a stop
circle. Hidden on phones. Knobs:
`--map-bg`, `--map-ink`, `--map-line`, `--map-fill`, `--map-fill-o`, `--map-here` (the red marker and cone), `--map-here-ring`.

### The cut's words (4.11) — `ui/cut.js`, `ui/caption.js`

```jsonc
"cuts": { "cut-1": { "from": "lobby", "to": "room", "sheet": "frames/move-2:first",
                     "line": "Upstairs · Room 12 · Second floor", "note": "Forty-two steps of old larch.",
                     "title": ["ROOM 12", "*Grat*"] } }
```

0–0.6: a 1 px `--line-photo` hairline rides the rising sheet's top edge with `line` 12 px above it (label face) and
`note` under it (text face); they fade as the edge nears the nav. 0.55–1: `title` rises line by line (0.08 screens
apart, scroll-driven) as the next stop's caption heading, in its caption style, and stays as that heading (it replaces
`caption.heading`); the rest of the caption arrives on the clock as usual. Reduced motion: the words fade in place.

### The end (4.12) — `ui/end.js`

```jsonc
"theme": { "end": { "arrive": "sheet", "frame": "dim", "screens": 1.2, "pin": 0 } }       // house, gallery
"theme": { "end": { "arrive": "card", "frame": "keep", "screens": 0.55, "at": 0.92 } }    // hotel
"theme": { "end": { "arrive": "sheet", "frame": "mask", "screens": 1.3, "pin": 1.0 } }    // furniture
```

`sheet`: the end section slides over the pinned stage (the scroll height and pin are in "How a site boots it").
`dim`: `.tour-dim` (`--scrim`) over the picture, as strong as the share of the viewport the sheet covers. `keep`: no
dimming. `mask`: no dimming; the site's first end block cuts its headline out of the sheet (an inline SVG mask; the test's
preset d shows one). `card`: the end section moves into the stage as `.tour-end-card` (440 px, right 40, bottom 100,
`--card-bg`, `--card-blur`; phone a bottom sheet, 72svh) and opens when the last incoming segment passes `at` (600 ms
fade and 24 px rise). A layer that draws its own opening (the hotel's booking line growing into the card) sets
`ctx.endCard.manual = true` and reads `ctx.endCard.sw` (`on`, `age`). `.tour-sticky-cta` keeps a button at the bottom
of the viewport while its panel is in view (phone).

### The art layer and the lift (4.13) — `ui/art.js`, `artgl.js`

```jsonc
"moves": { "move-1": { "clips": ["frames/move-1"],                                   // frames.py --key: light map + mask/
                       "panels": { "src": "frames/move-1/panels.json", "map": { "0": "w02", "1": "w01" } } } },
"theme": { "hotspot": { "plate": "wall" }, "cursor": { "on": true, "verbs": { "art": "Lift" } } },
"artworks": {
  "w01": { "n": "01", "title": "06:40", "year": "2025", "medium": "Oil on linen", "size": ["180", "240"], "price": "€24,000",
           "src": "img/art/w01.webp", "thumb": "img/art/w01-thumb.webp", "tint": "#D6DBF3", "tintInk": "#8E9BD8",
           "wall": "Room 01, north wall", "caption": "Room 01 · north wall", "at": { "move": "move-1", "t": 0.30 },
           "enquire": "end#visit" },
  "w07": { "n": "07", "kind": "object", "title": "…", "cutout": "img/art/w07-cut.webp", "box": [0.74, 0.58, 0.08, 0.22], "stop": "hall" }
}
```

- Drawing: a WebGL pass after the frame; each quad (panels.json, per source frame, read at the frame the stage drew;
  `src` may list one panels file per clip) gets its work through a homography; coverage × the canvas mask
  (`frames/<clip>/mask/NNNN.webp` when the manifest has `mask`; without masks the work isn't clipped); × the light map
  (9 soft taps over ±2 frame px, canvas pixels only) ÷ the canvas's median at the stop frames (`medians`, interpolated;
  without medians, estimated once from the clip's first and last frames), clamped 0.6–1.2; a 1 px anti-aliased edge
  and ~0.6 px softening. A missing quad holds the last good one for 6 source frames, then hides.
- Wall labels (`plate: "wall"`): up to 3 (1 on a phone, low in the left column), largest first, ≥ 30 % showing, from
  when the window has grown 50 %; a 1 px `--ink` line from the nearer top corner to the label in the edge column (left
  half → left); stacked 8 px apart in their works' order; held still while the lines stretch; 200 ms; seen after 600 ms
  (`ctx.seen`); `ctx.inView` = the largest work on screen (the works rail underlines it).
- Lift: a click inside a quad at rest (300 ms without scrolling), a label, a works-rail click (glides first), a beat,
  `ctx.lift(id)` or `do: "lift:<id>"`. 700 ms flight in screen space (light map and mask fade out), tint to 96 %, the
  facts from 200 ms at the left, the year (`tintInk`) half behind the right edge, the caption up the left edge;
  `previous / next` (←, →) cross-fade 300 ms; close (×, Esc, the tint) flies back onto the current quad in 520 ms.
  Objects fly their `cutout` from `box`. Reduced motion: 250 ms cross-fades. Phone: full width, facts below.

### Beats and the cursor (6.3, 4.14) — `ui/cursor.js`

```jsonc
"theme": { "cursor": { "on": true, "verbs": { "hotspot": "Open", "art": "Lift", "add": "Add", "swatch": "Pick" } } },
"record": { "beats": [
  { "at": "corner", "after": 0.35, "do": "open", "target": "hotspot:p03", "hold": 1.6, "then": "add" },
  { "at": "sofa", "after": 0.3, "do": "swatch", "target": "swatch:p01:plum", "hold": 1.2, "close": false },
  { "at": "hall", "after": 0.35, "do": "lift", "target": "art:w05", "hold": 2.6 },
  { "at": "side", "after": 0.3, "do": "hover", "target": "art:w04", "hold": 1.2 },
  { "at": "end", "after": 1.0, "do": "add", "target": "el:#add-all", "hold": 1.0 }
] }
```

Live (`cursor.on`, a fine pointer, no reduced motion): a hand-drawn 20 px ring (an uneven loop whose ends overshoot,
`--cursor-ink`, 70 %) follows the pointer (0.2 lerp per frame) and grows to 40 px in 180 ms with the verb beside it over
anything with `data-verb` (hotspot dots, swatches, add buttons) or an artwork. In `?record` it plays the beats: fade in
near the target, a slight arc to it (0.6 s, `inout`), 0.25 s rest, the click (ring pulse .9 → 1, 180 ms), the action
and `hold`; `then` reaches the open card's add button and acts again; `close` (default for `open` and `lift`) moves to
the × (0.5 s), clicks and closes. Targets: `hotspot:<id>` · `card:<id>` · `art:<id>` · `swatch:<card>:<name>` (any
visible `[data-swatch]`) · `el:<selector>`. Actions fire when the recording clock crosses their moment, so a replay
from the cover reaches the same state (same n, same pixels; checked).

## How a site adds its own layer (4.15)

A layer is a plain object passed to `boot({ layers })`. It never forks the engine: it builds its DOM in a mount point,
reads the per-frame state and listens to events, and runs its timed motion on the engine clock.

```js
// legend.js — the house's legend bar in the walk bar's right slot (theme.walkbar.right: "layer")
export const legend = {
  mount(ctx) {
    this.el = document.createElement("div");
    this.el.className = "legend t-label";
    ctx.slots.walkbarRight.append(this.el);          // or ctx.ui, ctx.lines (SVG), ctx.modal, ctx.slots.layers.cart
    this.grow = new ctx.Fade(ctx.clock, 0);          // timed motion: the clock, never CSS transitions or setTimeout
  },
  layout(ctx) { this.w = this.el.clientWidth; },     // measure here, never in step
  step(state, ctx) {},                               // logic only (thresholds, Fade targets): replays in ?record
  update(state, ctx) {                               // write the DOM from state, every painted frame
    this.el.style.setProperty("--k", this.grow.value.toFixed(3));
  },
  event(name, payload, ctx) {
    if (name === "move:event" && payload.name === "material") this.grow.to(1, 500, "out");
    if (name === "card:add") ctx.extra.cart = (ctx.extra.cart ?? 0) + payload.qty;   // shows in tour.state()
  },
  reset(ctx) { this.grow.snap(0); },                 // back to the cover (?record replays call it)
  beat(beat, ctx) {},                                // ?record: the beat running now ({ beat, k }) or null
  ready: null,                                       // a promise tour.ready waits for (images, data)
};
```

What a layer gets (`ctx`, and `window.tour.ctx`): `data`, `state`, `toScreen` / `fromScreen` / `map`, `view` (what the
stage drew), `viewT()` (the move t of the frame on screen), `clock`, `Fade`, `Switch`, `ease`, `setTokens(map, ms)`,
`token(name)`, `glide(to)`, `go(action)` (`end`, `end#id`, `stop:id`, `card:id`, `lift:id`, `#selector`, `hide`),
`openCard(id)`, `closeCard()`, `pickSwatch(card, name)`, `openHotspot(id)`, `hoverHotspot(id, on)`, `lift(id, { force })`,
`unlift()`, `stage.setRecolour({ src, mask, stop, opacity, ms, feather })` (synchronous: the fade starts now, the
pictures load on their own), `stage.addPass({ draw(info) })`, `lockScroll(on)`, `atRest(ms)`, `pointer`,
`target(name, fn)` (a beat or cursor target of its own), `addNeed(fn)` (?record waits for its images), `endCard`,
`endTop()`, `card`, `lifted`, `seen`, `inView`, `extra`, `uiGroup.add(el)`, `keepAlive(on)`, `invalidate()`, and the
mount points. A layer's swatch buttons only need `data-swatch="<card>:<name>"`; its clickable things `data-verb`.

Events (besides the step 1–4 ones): `card:open { id, from }` · `card:close { id }` · `card:next { from, to }` ·
`card:add { id, qty, price }` · `swatch { card, name, swatch, page }` · `pill:open / pill:close { id }` ·
`hotspot:hover { id, on }` · `lift / unlift { id }` · `art:hover { id }` · `end:open / end:close`.

The test's `test/layers.js` has two small ones (preset d): a nav cart counting `card:add`, and a colour row of
`data-swatch` buttons at stop "sofa" that a beat clicks.

## tools/track.py (the tracks file, 8.4)

```sh
tools/.venv/bin/python tools/track.py tools/out/house/move-2a.mp4 house/tracks/move-2a.json --point coping=1210,804
tools/.venv/bin/python tools/track.py clip.mp4 out.json --point coping=0.63,0.74          # fractions of the frame
tools/.venv/bin/python tools/track.py clip.mp4 out.json --point rail=880,610@120          # seed on source frame 120
tools/.venv/bin/python tools/track.py clip.mp4 out.json --point a=… --point b=… --smooth 1 --merge
```

Lucas–Kanade (pyramidal, 21 px window, 3 levels) from the seed forwards to the clip's end, then backwards to frame 0;
each step is tracked back again and q comes from the forward–backward error (1 under 0.5 px, 0 over 3 px). The seed
snaps to the strongest corner within 10 px (`--snap 0` keeps it exact; a seed on an edge or a row of bars slides). A
point that leaves the frame, fails, or drifts (an error over 6 px, or three steps over 3 px) is null from there on.
Output: `{ size, fps, count, points: { name: [[x, y, q] | null per source frame] }, seeds }` in clip pixels. Proven
on the spike: the radiator's top-left corner tracks through all 121 frames of `move.mp4` with q = 1 (a proof strip in
`test/shots/track-proof.png`); a seed on the radiator's fins is lost at the first step, as it should be.

## Theming (design-system.md 7)

Tokens on `:root` (site `style.css`): `--paper --paper-2 --ink --ink-2 --on-photo --on-photo-2 --line --line-photo
--plate --plate-ink --accent --accent-ink --signal --scrim --dot --dot-ring --font-display --font-text --font-ui
--font-label --font-mono --label-size --label-case --label-tracking --display-weight --display-wdth --display-tracking
--display-case --radius-plate --radius-card --radius-button --grain --card-blur`. Engine-only knobs with defaults:
`--label-weight` (400), `--title-ink` (`--on-photo`), `--nav-ink-photo` / `--nav-ink-sheet` (the nav over the picture
and over the end sheet), `--caption-ink`, `--caption-ink-2`, `--bar-ink`, `--rail-ink`. `--label-case` may be
`uppercase | lowercase | all-small-caps` (the engine turns it into `text-transform` or `font-variant-caps` on `.t-label`).
`ctx.setTokens(map, ms)` cross-fades colour tokens on the clock (a colourway); other values switch at once.

Classes the engine gives text: `.t-label` (the site's label face), `.t-num` (tabular figures), `.tt-block` (+ the block's
`class`; `.t-statement` and `.t-hint` are small blocks in the text and label faces), `.tc-heading`, `.tc-body`, … (see
`tour.css`). No component puts a filter, blur, shadow, mask or blend on text; nothing is under 14 px.

## Extension points (engine components and site layers)

**Two kinds of plug-in, one shape.** Engine components (`engine/ui/*.js`, listed in `CORE` in `tour.js`, mount order =
paint order in `.tour-ui`) and site layers (`boot({ layers })`) are plain objects:

```js
export const hotspots = {
  name: "hotspots",
  mount(ctx) {},                 // build DOM in ctx.ui / ctx.lines / ctx.modal / a ctx.slots.* slot; register in the UI group
  layout(ctx) {},                // after fonts load and on resize: measure here (never in step)
  step(state, ctx) {},           // logic only: thresholds, Fade/Switch targets; no DOM reads or writes, no wall clock
  paint(state, ctx) {},          // write the DOM from state (layers name this update(state, ctx))
  event(name, payload, ctx) {},  // engine events (below)
  reset(ctx) {},                 // back to the cover; clear every paint cache (record replays call it)
  beat(beat, ctx) {},            // ?record: the beat running now ({ beat, k: seconds into it }) or null
  post(state, ctx) {},           // after every paint/update (the cursor: DOM targets are where they are now)
  ready: promise,                // optional: tour.ready waits for it (art images, tracks)
};
```

`CORE` = `[frame, nav, title, caption, walkbar, rail, map, hotspots, tags, cut, end, art, cards, cursor]`. Never store
state on a property that shares a hook's name (a component's `this.beat = …` would replace its `beat()` hook).

**Per frame.** Each animation frame the engine calls `step(state)` on everything, then draws the stage, then
`paint(state)` / `update(state)`. `state`:

- `p` (0–1), `screens` (p × total screens), `dir`, `seg` (the segment object), `kind` (`title | stop | move | cut | end`),
  `k` (0–1 inside the segment), `t` / `now` (clock seconds / ms), `phone`, `reduced`, `record`, `hidden`, `ui` (UI group on)
- `stop` (id at a stop or the title, else null), `last` (the last stop reached), `next`, `index`, `stops`
- `move`: `{ id, t, clip, path, web, src, seq, frame }` (the wanted frame; `t` is the multi-clip move t of 5.5; `frame.join`
  holds the scroll-driven join between two clips), `cut`: `{ id, k, from, to, sheetTop }`, `end` (k inside the end)
- `title.exit` (0–1), `scrollY`, `endTop` (the end section's top, px from the viewport top), `card` (the open card's id),
  `lifted` (the lifted work's id), `seen` (a Set of work ids), `inView` (the largest work on screen)
- `view` (in paint): **what the stage actually drew** — `{ move, clip, path, seq, web, src, pics, map, exact, segment }`.
  Outside `?record` the stage shows the nearest frame that has loaded, so tracked tags and art quads must read
  `view.src` (the source frame, fractional while blending), not `state.move.src`. `view.pics` lists every drawn picture
  with its weight (joins, blends).

`ctx.toScreen([x, y])` maps frame fractions to viewport px with the mapping just drawn (`ctx.map`: `{ R, s, ox, oy, dw,
dh, focus }`); `ctx.fromScreen` inverts it. Everything placed on the picture goes through it every frame. `svg.tour-lines`
uses CSS px as user units and is clipped to R (the gallery's window, the inset frame).

**Events** (`event(name, payload)` on components and layers, or `ctx.on(name, fn)` → unsubscribe):
`segment:enter` / `segment:leave` `{ id, kind, dir }` · `stop:enter` / `stop:leave` `{ id, dir }` · `move:start` /
`move:end` `{ id, dir }` · `move:event` `{ move, at, name, id, dir }` (each `moves.*.events[]` crossing, either way) ·
`ui:in` / `ui:out` · `caption:in` / `caption:out` `{ id }` · `hide` `{ hidden }` · `work:select` `{ id }` (a works-rail
click when no `ctx.lift`) · and from steps 5–9: `card:open` `{ id, from }` · `card:close` · `card:next` `{ from, to }` ·
`card:add` `{ id, qty, price }` · `swatch` `{ card, name, swatch, page }` · `pill:open` / `pill:close` `{ id }` ·
`hotspot:hover` `{ id, on }` · `lift` / `unlift` `{ id }` · `art:hover` `{ id }` · `end:open` / `end:close`. `dir` is +1
down the walk, −1 back, 0 on load.

**ctx** (`window.tour.ctx` too): `data` (normalized tour.json), `theme`, `tl` (Timeline: `segments`, `stops`, `moves`,
`cuts`, `pOf(target)`, `frameAt(move, t)`, `stopPic(id)`), `stage` (below), `clock`, `Fade`, `Switch`, `ease`, `base`,
`record`, `reduced`, `clean`, `phone`, `hidden`, `state`, `view`, `margin` (40 / 16), `navBottom` (76 / 56), `toScreen`,
`fromScreen`, `map`, `rise(56)` (the text rise: 32 on phone, 0 reduced), `label(s)`, `on`, `emit`, `invalidate()`,
`keepAlive(on)`, `uiGroup.add(el, order)` (hidden on the cover, in with the title's exit), `glide(target)` (a stop id,
`"end"`, `"#selector"`, a p, `{ move, t }`), `go(action)` (nav `do` strings, plus `card:<id>` and `lift:<id>`),
`setTokens`, `token(name)`, `setHidden`, `endTop()`, `pOf`, `seen` (a Set), `card`, `lifted`, `inView`, `extra` (merged
into `tour.state()`), and from steps 5–9: `openCard(id, { from })`, `closeCard()`, `pickSwatch(card, name)`,
`openHotspot(id)`, `hoverHotspot(id, on)`, `hotspotState(id)`, `lift(id, { force })`, `unlift()`, `endCard`,
`lockScroll(on)` / `locked`, `atRest(ms)`, `viewT()`, `pointer`, `target(name, fn)` / `targetAt(name)`, `addNeed(fn)`. Mount points: `root` (body), `scroll`, `stageEl`, `canvas`, `wash`, `title`, `lines`, `frameEl`, `ui`,
`modal`, `end`, and `slots`: `navLeft`, `navCenter`, `navRight`, `layers[name]`, `walkbar`, `walkbarLeft`, `walkbarRight`,
`ruler`. A walk-bar layer that has a phone form sets `data-phone` on `walkbarRight`.

**Stage** (`ctx.stage`): `toScreen`, `fromScreen`, `map`, `rectAt(state)`, `mappingFor(R, focus)`,
`setRecolour({ src, mask, opacity, ms, stop, feather })` (a second picture inside a mask over the stop picture),
`addPass({ draw(info) })` → remove fn: WebGL drawn after the pictures each paint, `info = { renderer, gl, map, pics, state,
toScreen, dpr, stage }` (`renderer.draw({ imgs, weights, dst, clip, radius, alpha, dark, mask, maskMix, feather })` and
`renderer.tex(img)` are there for the art layer; `artgl.js` shows a second program sharing the context), `occAlpha`,
`still` (the sharp still's Fade), `view`, `stats`, `image(url)` (a cached picture). `setRecolour` is synchronous (the fade
starts now; the pictures load on their own and ?record waits for them); a new picture over an old one keeps the old one
under it until it is in.

**Clock rules** (they keep `?record` exact): timed motion uses `new ctx.Fade(ctx.clock)` (`to(target, ms, ease, delay)`,
`value`, `snap`) or `new ctx.Switch(ctx.clock)` (`set(on)`, `age`), never CSS transitions or `setTimeout`; pure hover
styles may use CSS. Retarget in `step`, read in `paint` (a layer's `update` doesn't run during ?record's replays, so
logic there would depend on which frames were painted). `seek(p)` and the first screen run with `clock.instant` (every
Fade lands at once). A hairline that fills uses `fillPx(el, f, totalPx)` (whole-pixel widths: a `scaleX` edge
anti-aliases differently depending on what was painted before); a moving tick uses `snap(px)`; moving text in record
mode is given its own layer by CSS (`.tour-record .tt-block, .tc, .tc-ln, …`; add yours). An SVG whose inside changes
(the map) repaints whole in ?record (a transparent outline whose offset flips), since a partial repaint anti-aliases
shared edges differently. A WebGL pass makes each texture unit active before it fetches (and so may create) a texture:
creating one binds it to the active unit.

## Record contract (design-system.md 6)

`?record[&fps=30]`, viewport 1440×900, `deviceScaleFactor: 1` (the stage renders at dpr 1, so 1600×900 frames land
1:1). The real cursor and scrollbars hide, wheel and touch are ignored, smoothing is off, the `-rec` frame sets load.

```js
await page.goto(".../?record");
await page.evaluate(() => window.tour.ready);      // every frame, still, mask, font and layer `ready`
const { frames, fps, duration, timeline } = await page.evaluate(() => ({ ...window.tour }));
for (let n = 0; n < frames; n++) {
  await page.evaluate((n) => window.tour.frame(n), n);   // resolves after the paint
  await page.screenshot({ path: `f${n}.png` });
}
```

- `window.tour = { ready, timeline, duration, fps, frames, problems, seek(p), frame(n), state(), clock { now, step },
  stats(), resetStats(), ctx, glide(target), setHidden(h) }`.
- `timeline = { screens, walk, end, pin, duration, fps, frames, segments: [{ id, kind, p: [a, b], screens: [a, b],
  t: [a, b], clips? }], beats: [...] }`; kinds `title | stop | move | cut | end | beat`. The title is held `record.hold`
  (0.9 s), moves take source seconds ÷ `record.speed` (1.1) or `moves.*.rec`, stops `record.hold`, cuts `cuts.*.rec`
  (1.4 s), beats add time at their stop (`after` seconds in), the end `record.end` (4 s) with p eased to 1 over 85 % of it.
- `frame(n)` draws t = n / fps. From `n = previous + 1` it steps once; any other `n` replays from the cover, so **the
  same n always gives the same pixels** (checked by hashing repeat renders, below). Frames blend
  `mix(frame[floor(i)], frame[ceil(i)], fract(i))` at the fractional source frame; the paint waits until every image it
  needs has loaded and decoded (no stand-ins).
- Frame sets: `tools/.venv/bin/python tools/frames.py <clip> <site>/frames/<clip>-rec --step 1 --quality 85` (`--key`
  for the gallery), then delete the `-rec-phone` folder; keep `frames/*-rec/` in the site's `.gitignore`.

## The test tour

`test/index.html?preset=a|b|c|d|broken` runs the spike's gallery clip (`test/frames/`, made by
`test/tools/make-frames.sh` with `frames.py --key`, so every set has canvas masks; it also runs `track.py` and
`panels.py`; the rest of the data by `test/tools/make_data.py`) as four presets of the engine, each set like one site.
Each preset's end section is a `<template>` in `index.html` (site HTML).

| preset | like | steps 1–4 | steps 5–9 |
| --- | --- | --- | --- |
| a "Northlight" | house | crop marks, brackets, index rail in the nav, `no-ruler` walk bar with meta, `bottom-left` ruled captions, frame-space title with the single-mask occluder, gradients with `start`/`rest`, a two-clip move (join inside a move), the sharp still, `focusKeys`, move events, `endTo` | dot + `pill` hotspots, planned → built (carried on keys through the two-clip move, turning at the `plaster` move event), `enterAt: "ui"`, a `dim` line on the cover, material cards with swatch pictures and status, a tracked tag on move 2 (`track.py`'s radiator), the map (plan, cone, `tr`, `title-block`, `from: "move-2"`), the green `dim` end sheet, the live cursor, a beat opening a card |
| b "Abendrot" | hotel | split title in frame space with a shared stack box (stacks on phone and at 1000×1000), kicker hidden on phone, strip rail with hover pop, `left-ruler` + profile ridge, the `split` caption with facts and a price, a cut, per-device gradients | `plus` dots with fact pills, a `facts` card from the caption's price link (`do: "card:room-12"`), the cut's words (line, note, and its title rising as the room's heading), the end `card` (`keep`, frosted, opening at move 2's 0.92), a beat opening a pill |
| c "Shedlight" | gallery | the window that grows, the `nav` exit (FLIP into the nav line), works rail, ticks + works marks, `{seen} / {works}` meta, `center` captions with `at: 0.55` | the art layer on all three canvases (a two-clip move with one panels file per clip, a reversed one), light maps ÷ medians, canvas masks, wall labels and seen marks, the lift (click, works rail, ← →, Esc), an object (the radiator's cut-out) as a `wall`-plate hotspot, the map (room fills, `br`, `crop`, `from: "ui"`), the `dim` end sheet, beats: hover a work, lift a work |
| d "ondo" | furniture | inset frame (eases out under the end), per-frame occluder masks `[1, 13]`, `top-left` lowercase captions, `segments` ruler, a nav layer slot, `pin: 1.0` | `tag` plates with leaders, the cover's bare dots with plates on hover, halo `one`, `product` cards (sizes, swatches, stepper, add, `next ↗`), a swatch that re-colours the radiator at its stop and re-themes the page (oat → plum without rust between), the `mask` end sheet (the room through "shop the room"), two site layers (`test/layers.js`: the cart, a colour row), beats: open + `then: "add"`, a swatch with `close: false`, `el:#add-all` at the end |
| broken | — | unknown/missing/mistyped fields, a walk out of order, a missing clip: warnings, no crash | |

`test/probe.js` is a sample layer: it logs every event to `window.__probe.events` and reads `ctx.view` each frame; with
`?probe` on preset c it outlines the tracked canvases from `panels.json`.

`node engine/test/tools/check.mjs [presets] [--only=shots,features,smooth,record,misc]` (headless Chrome with WebGL2)
writes `test/shots/` and prints a JSON summary: `<preset>-<desktop|phone>-<place>.png` (cover, exit, stops, mid-moves,
the cut's words and title, the end) with contact sheets `<preset>-<size>.jpg`; the features (`a-<size>-card.png`,
`a-desktop-cursor.png`, `b-<size>-pill.png`, `b-<size>-card.png`, `c-<size>-lift-flight.png`, `c-<size>-lift.png`,
`c-<size>-lift-next.png`, `c-<size>-lift-object.png`, `c-desktop-rail-lift.png`, `d-<size>-card.png`,
`d-<size>-swatch.png`, `d-<size>-swatch-room.png`, `d-desktop-hover.png`); record frames `rec-<preset>-NNNN.png` (the
beats' frames included) and `rec-<preset>.jpg`; `a-desktop-clean.png`, `a-desktop-reduced-stop.png`,
`b-desktop-reduced-cut.png`, `b-square-cover.png`, `a-desktop-recolour-test.png`; and `track-proof.png` (track.py on the
spike). Last run (2026-11-01, after steps 5–9): zero console errors and zero warnings for a–d at 1440×900 and 390×844, no
sideways scroll, nothing under 14 px (`broken`: 19–21 warnings and the missing clip's 404, no crash). Features at both
sizes: the cards open with the focus inside and the scroll held (a wheel or scroll doesn't move it), Esc and the scrim
close them and the focus returns to the hotspot; the fact pill opens beside its dot; a click inside a quad lifts the
work, next cross-fades, Esc flies it back and unlocks; the object lifts from its box; a works-rail click glides, then
lifts; the plum swatch re-colours the radiator (recolour 1) and moves `--accent` from rust to plum; the cover's hover
plate shows; the cursor shows "Open" over a dot. Record: `frame(n)` identical on repeat for 18–22 frames per preset
(16 spread over the film plus two inside each beat) and sequential = jumped, for all four presets; the beats open
cards, add, pick a swatch, hover and lift, and the cursor travels to each target (recordings 20.0, 20.0, 23.0 and
26.8 s on the test data). Scrubbing the whole walk in 5 s showed 121 of 121 wanted frames (100 % exact) warm and cold;
on a throttled 3.2 Mbit/s line from boot it showed the nearest loaded frame (24 distinct for 121 wanted, never blank);
paint p95 ≈ 10–12 ms. Reduced motion, `?clean`, H, the fit test, glides and resizing pass as before. The PNG shots are
gitignored (`engine/.gitignore`); the `.jpg` sheets are small.

## Known gaps

- Not checked in a real (non-headless) browser or on a real phone; every check ran in headless Chrome with GPU WebGL2.
- The test pictures are the spike's gallery room, so the presets are about mechanics, not looks: the canvases show grey
  light maps on presets a, b and d; the object's cut-out is upscaled from a 60 px crop (soft when lifted); the 960 px
  phone frames look soft at 390×844 (`frames.py --phone 1280` is the design-system.md's remedy). The art layer was also
  tried on the gallery's own move 1 (`gallery/frames/move-1`, its masks and `tools/out/gallery/move-1.panels.json`, an
  arbitrary panel → work map): the works sat on their canvases and the doorway's jamb stayed in front of the far one.
- Wall labels hold still while their lines stretch; a label moves to the other column (a 300 ms fade) only when its work
  has crossed well into the other half (35 % / 65 %). A painting hard against the screen edge can still sit under its
  column; the placement tries the other column, then just below the painting.
- A phone shows one wall label, low in the left column above the walk bar; the lift on a phone hides the big year and
  the side caption (the work fills the width).
- The map's current room switches halfway through a move (no room geometry test); a stop without a `#stops` circle sits
  between its neighbours on the route.
- A hotspot's plate is measured when its version renders; a layer that changes a plate's text should call
  `ctx.invalidate()` after a layout (resize) to re-measure. Plates flip left/right only (a band above or below isn't
  avoided by moving vertically).
- `theme.cursor.on` adds a fluid outline that trails the visitor's own cursor, which always stays visible (over a work
  on the canvas it turns to the pointer hand); the live outline needs a fine pointer.
- The end card's own opening is a fade and a 24 px rise; the hotel's booking line → card morph is the site's layer
  (`ctx.endCard.manual`).
- A beat whose target is off screen (an end button not yet scrolled to) still acts, but the cursor travels off screen;
  time `after` so the recording has scrolled there (`record.endTo`).
- From steps 1–4, unchanged: the cut has no clock version for rail jumps (later, per section 9); phone list sheets for
  Stops, the strip and the works are later (the Stops chip glides to the next stop; strip and works show `n / N`); the
  fit test and title warnings run at layout on the cover's mapping; the frame set is chosen once at load; occluder masks
  follow move 1's first clip's published numbering; without WebGL2 the stage falls back to a 2D canvas with no masks, no
  recolour and no art layer; sharp stills, focus points and occluder coverage are the site's to check.
