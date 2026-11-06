# The shared UI system

The design behind the engine: one feeling, the layout, every component, the motion, the recording mode, four presets
(the four example pages) and the data format. The engine's comments point at its section numbers ("4.3" is the title
block). Read §1 and §7 before you choose a page's look, and the component you are changing before you change it. The
example pages are Tembusu (house), Teluk Senja (hotel), ondo (furniture) and Shedlight (gallery); "pick" numbers refer
to the web references they were drawn from, which are not shipped.

---

## 1. The one feeling: slow film, few words

The picture is a **slow film** the visitor drives with the scroll. It fills the screen, it is the hero, and it moves
only when they move. On top of it go **few words**: one big type moment, one line, and the one mark of the site's
idea. Everything else waits until the walk has started.

Six rules follow from it:

1. **The place leads.** UI lives in the top band, the bottom band and one corner, or on a line that leads to the thing
   it names. The only UI in the middle of the room is a label sitting on its own object.
2. **One big type moment per screen:** a title, a room name, a price, or a lifted work's year. All other text is
   14–20 px.
3. **First-screen budget.** The cover shows the title blocks, one statement line, the nav's brand and one CTA, and
   one mark of the site's idea. Nothing else (4.3).
4. **Lines, not boxes.** Plates are flat (see-through or solid) or absent. No glass rims, glossy highlights, drop
   shadows or gradients on UI. Blur is used once in the set: the hotel's booking card.
5. **Joined motion.** The walk moves on the first scroll. Words arrive while the camera is still settling. Nothing
   bounces. Nothing waits, except the walk while a card is open.
6. **Four presets, one engine.** The components, the bands and the motion are shared. The small print is **not**:
   each site speaks its own overlay vocabulary (below).

### 1.1 The overlay vocabulary is per site

The small print is where the four sites differ most, because it is what people read after the title.

| | house · Tembusu | hotel · Teluk Senja | furniture · ondo | gallery · Shedlight |
| --- | --- | --- | --- | --- |
| It speaks like | a drawing | a note from the night porter | a shop window | a room sheet |
| Small labels | Spline Sans Mono 400, caps, .05em, 14 px | Zodiak 400, `all-small-caps`, .06em, 15 px | Anybody 600 wdth 100, lowercase, 15 px | Archivo 500 wdth 100, caps, .04em, 14–15 px |
| Numbers | mono | Zodiak `tabular-nums` | Anybody `tabular-nums`; DM Mono only for the cart count | Archivo `tabular-nums` |
| Brackets | yes: `[M-02]`, `[ scroll — … ]` | no | no | no |
| FIG. lines, dimension lines | yes | no | no | no |
| Coordinates | only in the end plan's title block | no | no | no |
| Frame on the stage | four crop marks | none | a 12 px `--paper` inset border, radius 10 | none (crop marks on the map only) |
| Scroll hint | yes: it sells the build | no | no | no |

### 1.2 What makes it 2025–26 rather than a template

- The **title is part of the place**: huge, read first, with a real object in front of part of it (house: a
  frangipani branch, house 2 and tour 10; hotel: the planting by the door; furniture: the sofa, lamp and chair,
  furniture 4) or on paper around a window that grows into the walk (gallery 2).
- The **cover is nearly empty**: 3–5 elements, like the hospitality and studio covers on the boards (hotel 2, house 3).
- **Words rise** out of a hairline or a clip box (house 4, tour 7) and the cut is a **rising sheet** (tour 7).
- **One signal colour** used only for "you are here".
- Each site has **one strong idea** that only it does: the room builds itself (house), the name parts at the door
  (hotel), the room takes the colour you pick (furniture), the exact works hang in an enfilade (gallery).

**Never, on any site:** stat counters, glass kits (rims, rainbow blur), device mock-ups, service-card trios,
testimonial sliders, star ratings, marquees or tickers, stickers, Street View furniture (floor arrows, 360° badges,
zoom sliders), "scroll to explore ⌄" with a dot column, a pulsing dot on every hotspot, stock lines ("spaces that…",
"timeless", "elevate", "where nature meets luxury"), and any piece of the vocabulary in 1.1 on a site that doesn't
own it.

---

## 2. How a page is built

One page per site. A tall scroll section holds a **sticky stage** the size of the viewport. Scroll progress `p`
(0–1 over the walk) drives the walk; a few things run on the engine's clock (5.1).

```html
<body class="tour" data-site="house">
  <main class="tour-scroll">                 <!-- height set by the engine (below) -->
    <div class="tour-stage">                 <!-- position: sticky; top: 0; height: 100svh -->
      <canvas class="tour-canvas"></canvas>  <!-- WebGL2: frames, stills, art layer, recolour -->
      <div class="tour-wash"></div>          <!-- picture gradients (on the picture, under all text) -->
      <div class="tour-title"></div>         <!-- title blocks -->
      <canvas class="tour-occluder"></canvas><!-- the current picture drawn through the occluder mask -->
      <svg class="tour-lines"></svg>         <!-- frame marks, leaders, dimension lines, wall-label lines -->
      <div class="tour-ui"></div>            <!-- nav, rail, captions, hotspots, tags, walk bar, map -->
      <div class="tour-modal"></div>         <!-- scrim, cards, the lifted artwork -->
    </div>
  </main>
  <section class="tour-end"><!-- site HTML: plan / booking / cart / visit --></section>
  <footer class="tour-footer"><!-- site HTML --></footer>
</body>
```

- **Scroll height.** `W` = the walk's screens (stops, moves, cuts; 5.5), `E` = `theme.end.screens`, `P` =
  `theme.end.pin` (extra screens the stage stays pinned under the end, default 0). For `arrive: "sheet"`:
  `main.tour-scroll { height: calc((W + E + P + 1) * 100svh) }` and
  `section.tour-end { margin-top: calc(-1 * (E + P) * 100svh); position: relative; z-index: 2 }`. The end section's
  top then enters the viewport exactly as the walk ends, slides over the still-pinned stage, and the stage unpins only
  at `W + E + P`. For `arrive: "card"` (hotel), `E` is inside the walk and the end section is the card in the stage.
- **All text is DOM.** It is crisp and selectable. Nothing is drawn into a canvas, and no filter, blur, blend mode,
  mask or shadow ever touches text.
- A site is `index.html` (font links, the end panel and footer markup) + `style.css` (tokens and small overrides) +
  `tour.json` (section 8) + `frames/`, `tracks/`, `img/`. The engine reads `tour.json` and builds the rest.
- Site-only pieces (the house legend, the hotel booking line, the furniture cart and colourway) are **layers** passed to
  `boot()` (4.15). Sites never fork the engine.
- Suggested engine files (the engine agent decides): `engine/tour.js` (boot, timeline, scroll, clock, record mode),
  `engine/frames.js` (from `eclate/site/engine/frames.js`: coarse-to-fine loading, the nearest loaded frame is drawn,
  the wanted frame jumps the queue, an arriving nearer frame repaints; reads `manifest.json` from `tools/frames.py`,
  which has `map` and no `crop`), `engine/stage.js` (WebGL2: cover-fit, window, art layer, recolour, joins),
  `engine/ui/*.js` (one file per component), `engine/tour.css` (component CSS, tokens only).

---

## 3. Layout

### 3.1 The stage

- **Cover-fit with a focus point, into a rect.** The stage draws into a rect `R` (normally the viewport; smaller for
  the gallery's window and the furniture's inset frame). `s = max(R.w / fw, R.h / fh)`; the frame is offset so its
  `focus` point (frame fractions) lands as near `R`'s centre as the cover allows:
  `ox = R.x + clamp(R.w/2 − fx·fw·s, R.w − fw·s, 0)`, the same for y. `R` clips with its radius. At 1440×900 a
  16:9 frame loses 80 px each side (so a frame x of 0.05 is the viewport's left edge); at 390×844 only the middle
  **26 %** of the frame's width shows, so every stop sets `focus`, and moves ease between their two stops' focus
  points (or follow `focusKeys`).
- **One mapping for everything.** `toScreen([x, y])` turns frame fractions into viewport pixels with the current `R`,
  scale and offset. Hotspots, tags, leaders, the occluder, artwork quads, canvas masks, labels and dimension lines
  all go through it, every frame, so they agree while `R` changes.
- **Window** (`title.window`, gallery): `R` starts as a rect and eases to the viewport over `grow` screens (scroll,
  `inout`), its radius going to 0.
- **Inset frame** (`theme.frame.kind: "inset"`, furniture): `R` is the viewport inset by 12 px with radius 10; the
  gap shows `--paper`. It eases to the full viewport (inset and radius → 0) over the end sheet's arrival.
- **Recolour.** `setRecolour({ src, mask, opacity })` cross-fades a second picture over the current stop picture
  inside a mask texture. It is only exact over the picture the edit was made from, so a stop that recolours sets
  `sharp: true` and recolours over its still (furniture).
- **Frame sets.** Viewports wider than 900 px use the 1600 px set; others use `-phone` (960 px). `?record` uses `-rec`
  (6.1).
- **Joins at a stop.** A stop shows the incoming move's last frame. When the outgoing move starts, a 120 ms clock
  cross-fade to its first frame hides the small difference between the two clips' copies of the same still.
- **Joins inside a move** (a move made of several clips): drop clip N+1's first web frame, and cross-fade the last 2
  web frames of clip N with the first 2 of clip N+1, driven by scroll (no clock).
- **Sharp stills.** After 250 ms at rest on a stop, the engine may fade in the stop's 2560 px still over 300 ms, and
  fade it out as the next move starts. Only when `sharp: true` (the still matches the clip's end frame in colour and
  position to about 1 px; the site checks by flicking between them).

### 3.2 Bands and safe areas

Designed at **1440×900** (desktop) and **390×844** (phone). Sizes are px at those sizes; titles are in `vw`.

```
desktop 1440×900                                                    phone 390×844
┌────────────────────────────────────────────────────────────────┐  ┌──────────────────────┐
│  NAV BAND     y 20–76    brand · rail · chips · one CTA        │  │ NAV  y 8–56          │
│  UNDER-NAV    y 88–168   strips (hotel photos, gallery works)  │  │                      │
│                                                                │  │  TITLE BOX (phone)   │
│            TITLE BOX — per site (title.blocks[].box)           │  │                      │
│                                                                │  │                      │
│  CAPTION      x 40–620, bottom edge y 800      CORNER 200×140  │  │  CAPTION  ≤ y 772    │
│  BOTTOM BAND  y 824–880  counter · ruler/legend · meta/layer   │  │ BOTTOM  y 788–836    │
└────────────────────────────────────────────────────────────────┘  └──────────────────────┘
```

- **Margins:** 40 px desktop, 16 px phone. The furniture's 12 px inset sits outside the margins.
- **Corner box** (mini-map): 200×140, 40 px from the right edge, either 100 px from the bottom (`br`) or 96 px from
  the top (`tr`). Hidden on phone.
- **Cards:** desktop 440 px wide, 40 px from the right edge, between y 96 and y 800. Phone: bottom sheets.
- **Title boxes** never cross the nav band; the engine warns in the console if one does. Each still is generated to
  leave calm space in its title box.
- **Hotspot rule:** a dot always stays on its object. A plate that would cross a band, a caption's box or the viewport
  edge flips to the other side of its dot. Sites place hotspots so no dot falls inside a caption's box (re-check after
  measuring). A dot outside the visible slice of the frame (phone) hides with its plate.

### 3.3 Grid

- **Desktop:** 12 columns across the 1360 px between margins, 24 px gutters (one column ≈ 91 px), 8 px baseline.
  Captions take 5–6 columns, cards 4–5, end panels split 7 + 5.
- **Phone:** 4 columns across 358 px, 12 px gutters.
- **No sideways scroll at 390 px:** `overflow-x: clip` on `html` and `body`, titles in `vw` with a `max` in px, strips
  inside clipped boxes. Every site is checked at 390×844 and 1440×900.

### 3.4 Type rules

- **Nothing under 14 px**, desktop or phone. Labels 14–15 px; UI 15 px; body 17–18 px (16 on phone); caption headings
  40–56 px (28–32 on phone); titles 10–28 vw.
- **Text on pictures** sits over a picture gradient (drawn on the picture, under the text), on calm wall, or on a
  plate. Check ≥ 4.5:1 for small text and ≥ 3:1 for titles on the final stills.
- **Italics:** written `*word*` in `tour.json`. Each site uses them in one or two places only (see its direction); never
  as a formula on every heading.
- Numbers use tabular figures (`font-variant-numeric: tabular-nums`) wherever they change.

### 3.5 Layer order (bottom to top)

page paper → stage canvas (frames, art layer, recolour) → picture gradients → title → occluder → lines (frame marks,
leaders, dimension lines) → UI (plates and text) → scrim → card or lifted work → cursor.

---

## 4. Components

Each component gives **anatomy**, **states**, **motion**, **phone** and **knobs**. "Clock" means a timed animation on
the engine clock; "scroll" means it follows `p` (5.1).

### 4.1 Stage frame and Hide UI

- **Frame** (`theme.frame.kind`): `crop` (four L-shaped crop marks, 1 px `--line-photo`, inset 20, arm 16; phone
  inset 8, arm 12: house, tour 1), `inset` (furniture, 3.1) or `none` (hotel, gallery).
- **Hide UI:** a round 40 px chip with an eye icon at the right end of the nav (tour 5). It fades every UI element
  except the frame over 300 ms (clock). The `H` key toggles it; `?clean` loads the page with UI hidden. Hidden on the
  cover like every non-primary nav item (4.3).

### 4.2 Nav bar

- **Anatomy:** left, the brand (small wordmark in the display face, 18–24 px). Centre, the rail (4.5) or nothing.
  Right: 40 px round chips, links, an optional layer slot (the furniture cart) and **one** primary CTA (14–15 px,
  `--radius-button`).
- **States:** over the picture (`--on-photo`, no plate) / over the end sheet (`--ink`, or the sheet's own ink: the
  house's green sheet keeps bone), cross-fading in 200 ms as the sheet's top edge passes y 76.
- **On the cover** only the brand (unless the title *is* the brand) and the item marked `"primary": true` show. Every
  other nav item arrives with the UI group (4.3). The brand of the house, hotel and furniture fades in (300 ms clock)
  once their title has left; the gallery's title flies into the nav's centre (4.3).
- **Phone:** brand left; right a "Stops" chip (opens the rail as a list sheet: later, see 9) and the CTA as a compact
  chip.
- **Knobs:** `nav.left`, `nav.center`, `nav.right[]` (`chip | button | link | layer`, `do`, `primary`).

### 4.3 Title block and the first screen

The first screen is a still with the title on it, and the title reads first. A picture may cover part of it, or cross
it while moving; it never sits on top of it.

- **First-screen budget.** Stop 1 shows only: the title blocks (a block may carry a one-line kicker), one statement
  line (the house adds its scroll hint), the nav's brand and primary CTA, and **one mark** of the site's idea:

  | Site | The one mark on the cover |
  | --- | --- |
  | house | the 7.20 m dimension line and one dashed tag, `[M-02] Terrazzo` |
  | hotel | nothing extra (the door between the two halves of the name is the mark) |
  | furniture | four bare dots on the pieces (no leaders, no plates; a plate shows on hover) |
  | gallery | the window onto room 1 |

  The **UI group** (rail, walk bar, ruler or legend, strips, Hide UI, the other nav items) is hidden on the cover and
  fades in (300 ms clock, items 60 ms apart) when the title's exit passes 50 %; it fades out again when scrolling back
  above that point. The mini-map follows its own `theme.map.from`. `rail.hideOnTitle` and `walkbar.hideOnTitle`
  default to `true`.
- **Blocks.** The title is a list of blocks, each with its own `box` (desktop and phone), `align`, `size` (vw, with a
  px max) and CSS `class`. A box is in viewport fractions, or in frame fractions with `"space": "frame"`, mapped
  through `toScreen` so it stays locked to the picture (either side of the hotel's door, above the furniture's sofa
  line) at any aspect ratio.
- **Fit test** (frame-space boxes): map the box through `toScreen` and clip it to the margins (40 px desktop, 16 px
  phone). If the block's measured text is wider than the clipped box, the block uses its `stack` box instead (all the
  site's blocks switch together). No other rule decides it.
- **Picture gradients** (`title.gradients`): colour, opacity range and extent from one edge, drawn on a layer above
  the picture and under the text. They stay for the whole walk at `rest` opacity so captions and the walk bar keep
  their contrast. Prefer calm wall in the still to more gradient.
- **Occluder** (layered depth). The occluder is a **mask**, not a cut-out: the `tour-occluder` canvas draws the
  stage's *current* picture (frame or sharp still) through `title.occluder.masks`, with the stage's mapping and a 1.5 px
  feather, above the title. So it always matches what is under it, even while the camera glides.
  - `masks` is a pattern of greyscale WebP masks at web-frame size (1600 px and 960 px phone, lossless), one per web
    frame of move 1's first clip from `frames[0]` to `frames[1]`; past the last, the last mask holds. House and
    hotel use a single mask (`frames: [1, 1]`, the camera only creeps 4–7 px); furniture uses one per frame for its
    first second (`frames: [1, 13]`), because it glides at once.
  - Masks are cut from the **clip's own web frames**, never from the 4K still (sharpness and grade differ).
  - Its opacity follows the title's exit (1 → 0), so it is gone before the masks run out.
  - The site checks on screen that it covers only part of the title (a few letters, or their lower quarter to third)
  and that the word still reads at thumbnail size. On phone it may be off the slice; that's fine.
- **Window** (`title.window`): see 3.1 (gallery 2).
- **Exit** (scroll, over `title.exit.screens`, default 0.3; gallery 0.45, furniture 0.18; overlapping move 1):
  - `drift`: each block moves by its own `exit: { dx, dy }` (px or vw) and fades out. A rise is `dy: -56`; the
    hotel's halves are `dx: -6vw` and `dx: 6vw`.
  - `nav`: blocks fly into a nav slot (FLIP from their rect to the slot's span, scaling as a transform, which never
    blurs at rest). The slot's text is the **same string in the same face** as the blocks (gallery:
    `INES MOLL — HALF LIGHT`), so each block lands exactly on its span (`part: 0 | 1`); the joining dash fades in
    (150 ms clock) after both land.
- **On load:** no animation. The page opens on the finished first screen, because the recording's first frame is the
  cover.
- **Knobs:** `title.blocks`, `gradients`, `occluder`, `window`, `exit`.

### 4.4 Stop caption

- **Anatomy:** a heading (display or text face, 40–56 px), an optional one-sentence body (17–19 px), an optional label
  line (the site's label face: the house's FIG. line) and an optional row slot (the hotel's four facts) or price block.
- **Placement** (`theme.caption.place`, overridable per stop with `stops.*.caption.place`): `bottom-left` (caption
  zone), `top-left` (under the nav: furniture), `center` (upper third, centred: the gallery's wall text), `split`
  (heading, body and facts bottom-left; a price block bottom-right: the hotel's room).
- **Reveal** (clock, 900 ms, `out`): each line rises 56 px (32 on phone) out of its own clip box and fades in, 80 ms
  apart. With `caption.rule`, a hairline under the heading first draws left to right (400 ms) and the heading rises
  out of the box that sits on it (house 4). The label line arrives last.
- **Timing:** the reveal is triggered when the incoming move passes **88 %** (or `stops.*.caption.at`: the gallery's
  room name arrives as the camera passes the doorway, at 0.55). The exit (300 ms, fade and −16 px) is triggered when
  the outgoing move passes 5 %. Scrolling back past a trigger plays the other one.
- **Phone:** headings 28–32 px, body 15–16 px, full width, above the bottom band.
- **Knobs:** `caption.place`, `caption.rule`, `caption.case`.

### 4.5 Rail (where am I, where can I go)

- **Skins** (`theme.rail.skin`):
  - `index`: a text list in the nav centre, `01 Entry · 02 Living room · 03 Pool deck`. The current stop at 100 %,
    the others at 55 %; a 1 px underline under the next stop fills as you walk to it (house 8).
  - `strip`: under the nav at the right, a row of small thumbnails of the stops (64×40, 28 px apart), numbered in the
    site's label face beneath. Hairlines join thumbs that a move connects and fill with progress during that move; a
    cut is a plain gap. The current thumb has a 1 px `--signal` outline; the others sit at 60 %. One label line below
    names the current one (hotel 2).
  - `works`: under the nav, centred, the show's works as thumbnails (56 px tall, true aspect), numbered, with the
    count `(07)`. The work in view is underlined (gallery 10).
- **Click a stop:** the next or previous stop smooth-scrolls there over 1.2 s (`inout`) and the walk plays on the way.
  Further stops: a smooth scroll at 2× that speed through the walk (the clock cut for jumps is later, see 9).
  **Click a work:** glide to its `stop` or `at`, then lift it (4.13).
- **Phone:** `index` becomes the Stops chip, `strip` shows only `2 / 4`, `works` becomes `3 / 7`.

### 4.6 Walk bar

The bottom band is one row with three slots: **left** a counter (`02 / 03` + the stop name, or the stop's `bar`
text), **centre** the ruler, **right** site meta or a site layer (the house legend, the hotel booking line).
`walkbar.layout`: `center-ruler` (default; ruler 480 px centred), `left-ruler` (counter and ruler together at x
40–520, the right slot from x 560 to 1400: hotel), `no-ruler` (the right slot from x 840 to 1400: house).

- **Ruler `ticks`** (gallery, tour 2): thin ticks sliding under a **fixed centre needle** (1 px, 20 px tall). Normal
  ticks 8 px, stop ticks 16 px. Ticks behind the needle take `--signal`. Tied straight to `p` with the walk's
  smoothing; faded at both ends by a mask on the ruler (it holds no text).
  - `works: true`: each work is a tall tick that turns `--signal` once seen (gallery 3).
- **Ruler `profile`** (hotel, hotel 11): the ruler stands still; tick heights follow `ruler.profile`, an array of
  values 0–1 or `null` (no tick: the cut's stretch); `ruler.summits` lists the array indices of the stops' summits,
  which the engine places at the stops' `p` (ticks between are spread evenly); a `--signal` marker moves along it;
  labels above the summits in the label face.
- **Ruler `segments`** (furniture 5): one 2 px bar per move, numbered at the stops, each filling with its move.
- **Phone:** the ruler shrinks to 160 px; meta and layers hide unless the layer has a phone form.

### 4.7 Hotspot (level 1: fixed spots at the stops)

- **Anatomy:**
  - **Dot:** an 8 px core (`--dot`), a 1 px ring 24 px across (`--dot-ring`). Hit area 44 px. With `icon: "plus"` the
    core is a 12 px `+` (1.5 px strokes) in a soft ring (hotel 6).
  - **Halo** (`theme.hotspot.halo`): `off` (default) or `one`: a single halo (scale 1 → 1.8, opacity .35 → 0, 2.6 s
    loop, `inout`) on **one** dot at a time: the next beat's target, else the dot nearest the cursor (furniture 6).
  - **Leader** (optional, `leader: true`): 1 px, bent once: 20 px at 45°, then a horizontal run of 28–72 px (furniture
    7).
  - **Plate:** `pill` (code + name, house 5), `tag` (name — price, furniture 7), `none` (the dot opens a fact pill,
    hotel 6) or `wall` (gallery labels, 4.13). A plate has `state: "planned"` (dashed outline, no fill) or `"built"`
    (solid). `plateOn: "hover"` shows the plate only on hover or focus (the furniture cover).
- **States:** hidden → entering (clock: dot 240 ms scale .6 → 1 and fade; leader draws 280 ms; plate fades and rises
  8 px over 320 ms; hotspots stagger 120 ms) → idle → hover (ring to 30 px in 180 ms, plate to full ink, cursor verb)
  → open (core fills `--accent` while its card is open) → leaving (200 ms fade).
- **When:** enter when the incoming move passes **96 %** (stop 1: shown on load). Leave when the outgoing move passes
  4 %. At most **4** at once.
- **Carried hotspots.** A hotspot with `keys: [[t, x, y], …]` follows those keyframes through the outgoing move
  instead of leaving, and if the next stop has a hotspot with the same id it simply becomes it (the house's planned
  tags turn solid on the way and arrive as stop 2's hotspots). A carried hotspot may also `enterAt` a move fraction
  (the house's other two planned tags arrive with the UI group). Its `state` can change at a move event.
- **Knobs:** `theme.hotspot` (`icon`, `leader`, `plate`, `plateOn`, `opens`, `halo`), and per hotspot `at`, `side`,
  `label`, `code`, `price`, `pill`, `card`, `state`, `keys`, `enterAt`, plus `plateOn` and `leader` overrides (the
  furniture's bare cover dots).

### 4.8 Tracked tag (level 2: labels that follow an object while you walk)

- **Anatomy:** the site's label face on a small plate (`--plate` at 80 %, `--radius-plate`). No dot, no line. It sits
  12 px right of and 12 px above its point plus its own `offset` (tour 6). Brackets only where the site owns them
  (`[ M-05 SUKABUMI ]`, house).
- **Data:** a track file per clip (8.4) with one point per *source* frame; the engine finds a web frame's source frame
  in `manifest.json`'s `map`. A tag on a multi-clip move lists one track per clip.
- **States:** shown while quality `q ≥ 0.6`; hidden below 0.5 or when the point is missing (150 ms fades, clock). It
  also fades within 3 % of the frame edge and outside its `from`–`to` window (default 0.08–0.92 of the move).
- **Fallback** for a move that barely moves the camera (the house's build): keyframes `keys: [[t, x, y], …]`, linear.
- **Limit:** 3 on screen. Seed tracks on stable texture (stone edges, joints), never on water or glass.

### 4.9 Card (the walk waits)

One shell, three templates; the artwork has its own lift (4.13).

- **Shell:** desktop a 440 px panel (`--radius-card`, the site's material), 40 px from the right, vertically centred,
  max height y 96–800, scrolling inside if needed; a 40 px close chip (×) top-right. Phone: a bottom sheet, max 80svh.
- **Open** (clock): the scrim fades to `--scrim` over 300 ms; the card slides in from x + 40 px and fades in over
  480 ms (`out`); phone from y + 24 px. Focus moves into it (`role="dialog"`).
- **While open:** page scroll is locked at its position, so the walk can't move.
- **Close:** ×, Esc, a click on the scrim, or `next ↗` (cross-fades 300 ms to the next hotspot's card): 280 ms (`in`).
  Scroll unlocks at the same position.
- **Templates:**
  - `material` (house): code, name, one line, spec rows on hairlines with bracket labels `[Finish] [Origin] [Size]
    [Where] [Status]`, a swatch (a crop of the real surface from a still) (house 7).
  - `facts` (hotel): room name, label/value rows in small caps, the price, one button (hotel 4).
  - `product` (furniture): object number, huge name, picture with a ghost index numeral behind it, sizes as big
    numerals with superscript units, named fabric swatches, a stepper joined to the add bar, delivery line, `next ↗`
    (furniture 8, 9, 2). A swatch can carry a packshot, a recolour and a theme (8.2).
- **Fact pill** (not a card): a one-line pill beside a `+` dot, opening and closing in place (fade and 6 px slide,
  220 ms). It doesn't lock the scroll. One open at a time.

### 4.10 Mini-map

- **Anatomy:** a site-drawn SVG (`theme.map.svg`) with these ids: `#rooms [data-room]` room shapes, `#route` one path
  along the walk (a cut is a jump between subpaths), `#stops [data-stop]` small circles. The engine adds the walked
  part of the route (solid; the rest dashed), the **dot** (6 px, `--signal`), the current room's fill, and with
  `cone: true` a 40° view cone turned to the current heading (house 8, gallery 9).
- **When:** `theme.map.from`, a move id or `"ui"`: it fades in (300 ms clock) when that move starts, or with the UI
  group (house: `"move-2"`; gallery: `"ui"`).
- **Motion:** the dot moves along `#route` with walk progress (`getPointAtLength`, scroll); the heading eases between
  stop headings; a room's fill cross-fades in 300 ms (clock).
- **Frame** (`theme.map.frame`): `title-block` (a hairline box with a label row under it) or `crop` (crop marks at the
  box corners and a tiny legend).
- **Click** a room or stop circle: glide there.
- **Phone:** hidden.

### 4.11 The cut

For two photos that can't be joined by a believable move: the hotel's lobby → room. Designed, short and honest. It
never invents a corridor and is never a fade to black (tour 7, hotel 11).

- **Scroll version** (in the walk, `cut.screens` ≈ 0.9):
  - 0.00–0.60: the next stop's picture (`cut.sheet`: normally the next move's first web frame) rises from the bottom as
    a **sheet** (translateY 100 % → 0, `inout`) with a 1 px `--line-photo` along its top edge. The cut's `line` rides
    12 px above that edge in the label face, the `note` under it in the text face. The old frame drifts up (0 → −10 %)
    and darkens through a dark layer above it (opacity 0 → .6). No filter.
  - 0.55–1.00: the next stop's name rises line by line out of clip boxes (0.08 screens apart) in that stop's caption
    style. The ridge marker jumps across its gap.
- **Reduced motion:** a 200 ms cross-fade.

### 4.12 End sheet

The walk ends on the site's ask: Start a project, Book this room, Add all to cart, Opening night. The four endings are
built differently on purpose: a deep green drawing sheet (house), a frosted card over the view (hotel), a cream sheet
with the room seen through its letters (furniture), a white visit sheet with one violet band (gallery).

- **Arrival** (`theme.end.arrive`):
  - `sheet`: the end section slides up over the still-pinned stage (2) like paper laid on the photo.
  - `card`: the panel lives in the stage and opens at the last stop (hotel: the booking line grows into the card).
- **Stage under it** (`theme.end.frame`): `dim` (a dark layer up to `--scrim` with how much the sheet covers), `keep`
  (the picture stays clear; only the card is frosted: hotel), or `mask` (no dimming: the site's first end block is a
  sheet with the headline cut out of it as an inline SVG mask, so the pinned room shows through the letters: furniture;
  `end.pin` keeps the stage pinned until that block has scrolled away).
- **Content** is site HTML in `<section class="tour-end">`, styled by the site. Desktop: region A (7 columns) and
  region B (5 columns), then **one solid button**. Phone: stacked, the button sticky at the bottom of the viewport while
  the panel is in view.
- **Footer:** site HTML. Every footer carries: "Demo site: names, places, prices and pictures are made up."

### 4.13 Artwork layer and lift (gallery)

Level 3: exact artworks on tracked blank canvases.

- **Inputs:** per move, `panels.json` from `tools/panels.py` (four corners per chroma canvas per source frame, and
  `medians`: each canvas's median grey per source frame); frames made with `tools/frames.py --key` (each canvas becomes
  a neutral grey **light map**, green spill removed) plus a lossless greyscale **canvas mask** per web frame
  (`frames/<clip>/mask/NNNN.webp`); per work, a flat image.
- **Mapping:** panels.py numbers canvases by first appearance, so each move maps panel ids to works
  (`moves[].panels.map`), read off the `--proof` video, which prints each id on its canvas.
- **Drawing** (WebGL, after the frame): each visible quad gets its work through a **projective** mapping (a
  homography, never affine). The work's coverage is multiplied by the canvas mask, so anything in front of a canvas (a
  jamb, the bench) stays in front. The work is multiplied by the light map sampled softly (a lower mip), normalised
  by the canvas's median at the stop (`medians`, interpolated across the move) and clamped to 0.6–1.2, so the room's
  falloff lands on the painting; a 1 px anti-aliased edge and a 0.6 px blur so the paint sits in the video, not on
  it. A quad missing in a frame is not drawn. The mask is a separate file, never the WebP alpha channel (browsers
  premultiply decoded images, which wipes the grey light map where alpha is 0).
- **Wall labels** (`hotspot.plate: "wall"`): for up to **3** works (largest on screen first) each showing ≥ 30 % of
  its area, a 1 px `--ink` line runs from its nearer top corner (from the quad, every frame) to a label fixed in the
  left or right edge column (works on the left half go left; labels stack 8 px apart, sorted by y so lines never
  cross). The label: number, title (16 px, 600), year · medium (14 px, `--ink-2`), size with a hairline dimension bar
  (1 m = 24 px) and the size in italic 14 px (gallery 4, 5). Labels hold still while the lines stretch, during moves
  too. A label fades (200 ms) when its work drops under 30 %. A work counts as **seen** after its label has shown for
  600 ms, or once lifted. Labels start when the window has grown 50 %.
- **Objects** (`artworks.*.kind: "object"`: the gallery's plaster): a level-1 hotspot with a wall-style label at its
  stop; its lift flies a cut-out of the still (`cutout`, `box`) instead of a quad.
- **Lift:** click inside a quad (or an object's box) while the walk is at rest (no scroll for 300 ms):
  1. The work's corners fly from the quad to a centred upright rectangle (max 62svh tall, the work's aspect) over
     700 ms (`inout`), interpolated in screen space so it unfolds flat.
  2. The light-map multiply fades 1 → 0 during the flight: it lands as an evenly lit reproduction from the
     full-resolution file.
  3. A tint layer (the work's `tint`) fades over the stage to 96 % (gallery 7).
  4. From 200 ms: the facts rise in at the left (title large and light, then Year, Medium, Size with its bar, Price
     or **Enquire**, `previous —— next`) (gallery 8). A huge year in `tintInk` sits half behind the work's right edge;
     a caption runs up the work's left edge (rotated −90°).
  5. Close (×, Esc, click on the tint) plays it back onto the current quad in 520 ms. `previous / next` cross-fade
     (300 ms) to the neighbouring work without landing first.
- **Phone:** the lifted work fills the width minus 32 px; facts below it.
- **Lost quad:** hold the last good quad for up to 6 frames, then hide that work's art and label until it's found.

### 4.14 Cursor (optional, calm)

- **Anatomy:** a 20 px ring, 1 px, `--on-photo` at 70 %, following the pointer with a 0.2 lerp per frame. Over a
  hotspot or a canvas it grows to 40 px in 180 ms and shows a verb beside it in the label face (Open, Add, Lift, Pick).
- **Never:** trails, blend modes, magnetism, drawing. If a later round lets the cursor draw, the shape must look
  hand-drawn.
- Hidden on touch and with reduced motion. In `?record` the engine moves it along the beats (6.3).

### 4.15 Site layers (the hook)

```js
import { boot } from "../engine/tour.js";
import { legend } from "./legend.js";
const tour = await boot({ data: "tour.json", layers: [legend] });

export const legend = {
  mount(ctx) {},                 // build DOM in ctx.ui (or SVG in ctx.lines)
  update(state, ctx) {},         // each painted frame: { p, t, stop, move: { id, t }, card, lifted, seen }
  event(name, payload, ctx) {},  // "stop:enter", "stop:leave", "move:event", "card:open", "swatch", …
};
```

`ctx` gives `toScreen`, the tokens (and `setTokens(map, ms)` for a theme cross-fade), `clock`, `glide(stopId)`,
`openCard(id)`, `stage.setRecolour(…)`, `data` (the parsed `tour.json`), the end section's scroll position, and the
`ui` / `lines` / `modal` mount points. The examples' layers: house **legend** (and optional **leaf shade**); hotel **booking
line**; furniture **colourway**, **cart**, **loupe** and **end mask**. The gallery needs none (its art layer is core).

---

## 5. Motion

### 5.1 Two kinds of motion

- **Scroll (scrubbed):** frames, title exit, window growth, the inset frame, cuts, ruler, map dot, tracked tags,
  wall-label lines, joins inside a move, end-sheet dimming and the furniture knockout. Reversible and exact.
- **Clock (timed):** things that start when a threshold is crossed: the UI group, captions, hotspots, cards, lifts,
  hovers, rolling digits, the halo, the colourway cross-fade, the cart count. They play forward when the threshold is
  crossed going down and their exit going up. Everything runs on the engine clock, never CSS transitions or
  `setTimeout`, so `?record` can step it (pure hover styles may use CSS).

### 5.2 Smoothing

Shown progress eases toward the scroll target: `p += (target − p) · (1 − e^(−dt / 0.12 s))`. Off with reduced motion
and in `?record` (the timeline drives `p`).

### 5.3 Durations and easings

| Thing | Time | Ease |
| --- | --- | --- |
| hover, ring grow | 180 ms | `out` |
| UI group in / out | 300 ms, 60 ms apart | `out` |
| hotspot dot / leader / plate | 240 / 280 / 320 ms, stagger 120 ms | `out` |
| hotspot leave | 200 ms | `in` |
| caption lines in (rule first: +400 ms) | 900 ms, 80 ms per line | `out` |
| caption out | 300 ms | `in` |
| tracked tag fade | 150 ms | linear |
| fact pill | 220 ms | `out` |
| card in / out | 480 / 280 ms | `out` / `in` |
| lift / put back | 700 / 520 ms | `inout` |
| glide to the next stop | 1200 ms | `inout` |
| frame join cross-fade at a stop | 120 ms | linear |
| map room fill, map fade-in | 300 ms | linear |
| rolling digits (prices, counts, percentages) | 500 ms | `out` |
| halo breath (furniture, one dot) | 2600 ms loop | `inout` |
| furniture recolour / page theme | 300 / 600 ms | `inout` |
| house legend segment grows / reflows | 500 ms | `out` |

`out` = cubic-bezier(.16, 1, .3, 1); `in` = cubic-bezier(.7, 0, .84, 0); `inout` = cubic-bezier(.65, 0, .35, 1).

### 5.4 Text entrances

Fade plus a **56 px** rise (32 px on phone), out of a clip box, overlapping the motion before it (4.4). Nothing rises
further. Nothing scales text at rest, nothing blurs it. Nothing bounces or overshoots. The furniture halo is the only
loop (plus the house's optional leaf shade, on the picture, under text).

### 5.5 The scroll budget

A screen is 100svh of scrolling. Each walk is **6–8 screens**, with no dead zones.

| Segment | Screens | In the recording |
| --- | --- | --- |
| first screen (stop 1 with the title) | 0: the first scroll starts move 1 | held 0.9 s |
| move | **0.3 per second of source clip** (a 5 s clip = 1.5) | source seconds ÷ 1.1 (or `moves.*.rec`) |
| stop | **0.45** | 0.9 s |
| cut | 0.9 | 1.4 s |
| window growth (gallery) | 0.45, overlapping move 1 | inside move 1 |
| end | `sheet`: 1.2 (the arrival 1.0, its top edge travelling up the viewport, + 0.2 rest); hotel card 0.55; the rest of the end panel and the footer scroll on as normal page flow | 2.6–4.5 s (the recording scrolls on to the panel's button) |
| beat (scripted click) | 0 | 1.2–4.6 s |

- **A move made of several clips.** A move's `t` (0–1) is source seconds elapsed ÷ the total source seconds of all its
  clips (read from each manifest: `src.count / src.fps`). Each clip gets screens in proportion to its duration. Every
  `events[].at`, `tags[].from/to`, `keys` and `focusKeys` value uses that `t`.
- Frames map **linearly** to scroll inside a move; the clip's own pace and the smoothing make the soft starts. Never
  one ease across a whole move.
- Walk totals: house 7.8, hotel 7.6, furniture 6.8 (its end keeps the room pinned through the headline), gallery 6.3
  screens. Each direction has its table.

### 5.6 Reduced motion

No smoothing, halo or leaf shade. Entrances are fades without the rise. The cut is a 200 ms cross-fade; the lift a
250 ms cross-fade to the flat work. Cursor off. The walk itself still scrubs, because the user drives it.

---

## 6. Recording mode

`?record` (optionally `&fps=30`) turns the page into a deterministic film for screen capture at 1440×900,
**deviceScaleFactor 1**, so the 1600×900 frames land 1:1 on the viewport.

### 6.1 What changes

- The real cursor and scrollbars hide; smoothing is off. The page ignores the user's scroll. Time drives it through
  the **recording timeline**: the first screen held 0.9 s, moves at source pace × 1.1 (`record.speed`; a move's `rec`
  overrides it), stops held 0.9 s, the cut in 1.4 s, the beats, then the end.
- **Record frame sets.** The published sets keep every 2nd frame (12 fps), which would stutter in a 30 fps film. For
  recording, each clip also gets a full-rate set, made locally and never deployed:
  `tools/.venv/bin/python tools/frames.py <clip> <site>/frames/<clip>-rec --step 1 --quality 85` (add `--key` for the
  gallery; delete the `-rec-phone` folder it also writes; `frames/*-rec/` is in the site's `.gitignore`). The engine
  loads `-rec` only with `?record`.
- **Frame blending.** In `?record` the stage draws `mix(frame[floor(i)], frame[ceil(i)], fract(i))`, where `i` is the
  fractional source-frame index at that recording time (one extra texture). With 24 fps sources at × 1.1 into 30 fps,
  every recording frame is a new, evenly spaced picture.
- A frame is painted only when every image it needs has decoded. No lower-resolution stand-ins ever show.

### 6.2 `window.tour`

```js
window.tour = {
  ready,       // Promise: every frame, still, mask, art image and font has loaded
  timeline,    // { screens, duration, fps, frames, segments: [{ id, kind, p: [a, b], t: [a, b] }], beats: [...] }
               //   kind: "title" | "stop" | "move" | "cut" | "end" | "beat"; p = scroll progress, t = seconds
  duration,    // recording length in seconds
  fps,         // 30 by default
  frames,      // Math.ceil(duration * fps)
  seek(p),     // draw scroll progress p at once, no easing (checks, screenshots)
  frame(n),    // ?record only: draw recording frame n (t = n / fps); resolves after paint
  state(),     // { p, t, stop, move, card, lifted, seen, cart, colourway }
  clock,       // now(); in record mode step(dt)
};
```

A recorder waits for `tour.ready`, then for n = 0 … frames − 1 awaits `tour.frame(n)` and captures the viewport. The
same n always gives the same pixels (checked in build step 2, section 9).

### 6.3 Beats

Scripted clicks, because nobody can click in a video. Grammar:

- `at`: a stop id, or `"end"`. `after`: seconds after arriving there.
- `target`: `hotspot:<id>` | `card:<id>` | `art:<wid>` | `swatch:<card>:<name>` | `el:<css selector>`.
- `do`: `open` | `lift` | `swatch` | `add` | `hover`.
- `hold`: seconds to hold after the action. `then`: one follow-up `do` on the same target (e.g. `"add"` inside an open
  card). `close`: boolean, default `true` (closes cards and lifts; a swatch is not undone).

For each beat the engine moves its cursor to the target along a slight arc (0.6 s, `inout`), rests 0.25 s, clicks
(the ring pulses .9 → 1, 180 ms), performs the action and holds, then closes (cursor to ×, 0.5 s) unless
`close: false`. Beats add time, not scroll.

| Site | Beats |
| --- | --- |
| house | `{ at: "living", after: 0.35, do: "open", target: "hotspot:m04", hold: 2.2 }` |
| hotel | `{ at: "room", after: 0.4, do: "open", target: "hotspot:h-sauna", hold: 1.6 }` (the booking card opens by itself) |
| furniture | `{ at: "corner", after: 0.35, do: "open", target: "hotspot:p03", hold: 1.6, then: "add" }`, `{ at: "sofa", after: 0.3, do: "swatch", target: "swatch:p01:plum", hold: 1.2, close: false }`, `{ at: "end", after: 1.0, do: "add", target: "el:#add-all", hold: 1.0 }` |
| gallery | `{ at: "side", after: 0.3, do: "hover", target: "art:w04", hold: 1.2 }`, `{ at: "hall", after: 0.35, do: "lift", target: "art:w05", hold: 2.6 }` |

---

## 7. Presets

Each site sets tokens in `style.css` and theme fields in `tour.json`. The engine uses nothing else.

**Tokens** (on `:root`):
- Colour: `--paper`, `--paper-2`, `--ink`, `--ink-2`, `--on-photo`, `--on-photo-2`, `--line`, `--line-photo`,
  `--plate`, `--plate-ink`, `--accent`, `--accent-ink`, `--signal`, `--scrim`, `--dot`, `--dot-ring`.
- Type: `--font-display`, `--font-text`, `--font-ui`, `--font-label`, `--label-size`, `--label-case`
  (`uppercase | lowercase | all-small-caps`), `--label-tracking`, `--font-mono` (house; furniture's cart digits),
  `--display-weight`, `--display-wdth`, `--display-tracking`, `--display-case`.
- Shape: `--radius-plate`, `--radius-card`, `--radius-button`, `--grain` (a fine grain on flat paper only, never on
  the picture or text), `--card-blur` (0 everywhere except the hotel's end card).

**Theme fields:** `material`, `frame`, `label`, `hotspot`, `rail`, `ruler`, `walkbar`, `caption`, `map`, `end`,
`cursor`, `grain`.

| Knob | house · Tembusu | hotel · Teluk Senja | furniture · ondo | gallery · Shedlight |
| --- | --- | --- | --- | --- |
| One idea | Drawn, then built | Arrive at dusk | Pick the colour, the room follows | The room sheet, walking |
| Display | Newsreader 200, opsz 72 | Zodiak 400, caps | Anybody 900, wdth 150, lowercase | Archivo 900, wdth 62, caps |
| Text / UI | Newsreader 300 / Host Grotesk 400–500 | Zodiak 300 / Zodiak 400 | Anybody 500 wdth 100 / Anybody 500 | Archivo 300–600 wdth 100 / Archivo 500 |
| Labels | Spline Sans Mono 400 caps | Zodiak 400 small caps | Anybody 600 lowercase (DM Mono: cart count) | Archivo 500 caps, tabular |
| `--paper` | `#F1EDE4` bone | `#0B0F15` night | `#F3E6D0` cream (rust colourway) | `#F3F4F5` cool white |
| `--ink` | `#12291F` green-black | `#F2EFE9` sand white | `#4A1422` burgundy | `#0B0C0E` black |
| `--accent` | `#1E4634` deep green | `#F2EFE9` sand white (solid Book buttons) | `#B4441F` rust (follows the colourway) | `#0B0C0E` (buttons are black) |
| `--signal` | `#4F9A78` pool green | `#F3B76A` lamplight | the accent | `#6B2BFF` violet |
| Radius plate / card / button | 999 / 2 / 0 | 0 / 4 / 0 | 999 / 10 / 0 | 0 / 0 / 0 |
| Material | paper: opaque bone plates | night: flat see-through plates, one frosted card | solid: cream and colour blocks | wall: type straight on white walls |
| Frame | crop marks | none | 12 px inset, radius 10 | none |
| Grain on paper | 3 % | 4 % | 2 % | 0 |
| Title | right-aligned band over the concrete wall; frangipani occluder | split around the door, the planting kept below the letters | full-width band locked to the sofa line; sofa, lamp and chair occluder | two corners on paper + a growing window |
| Title exit | `drift` (rise), 0.3 | `drift` (halves part), 0.3 | `drift` (rise), 0.18 | `nav`, 0.45 |
| Caption | `bottom-left`, `rule`, FIG. line | `bottom-left`; the room `split` with facts + price | `top-left`, lowercase | `center` wall text |
| Hotspot | dot + `pill` (code + material), planned → built, no halo | `plus` → fact pill, no halo | dot + leader + `tag`; cover: plates on hover; halo `one` | wall labels on leaders; the plaster as a hotspot |
| Card | `material` (paper) | `facts` (night); booking card at the end | `product` (solid portrait) | lift (tint + year) |
| Rail | `index` in the nav | `strip` of the 4 hotel photos | `index`, lowercase | `works` (7 thumbs) |
| Walk bar | `no-ruler`: counter + legend bar | `left-ruler`: counter + ridge `profile`; booking line from stop 3 | `segments` 01–03 | `ticks` + `works`, `3 / 7 seen` |
| Map | plan + cone, `tr`, `title-block`, from move 2 | none (the strip is the map) | none | axonometric, room fill, `br`, `crop` |
| Cut | none | lobby → room | none | none |
| End | sheet, `dim`: the green drawing sheet + Start a project | card, `keep`: booking | sheet, `mask`, `pin` 1.0: the room through the letters, then the cart | sheet, `dim`: visit + the violet opening-night band |
| Accent motion | tags turn solid; legend segments grow and percentages roll | the name parts with the door; ridge marker | the page takes the sofa's colour; halo on one dot; cart count rolls | leaders stretch with the walk; seen ticks turn violet; lift tint |
| Cursor verbs | Open | Open | Open, Add, Pick | Lift |
| Site layers | legend, leaf shade (optional) | booking line | colourway, cart, loupe, end mask | none |

**Hue families.** House: green and bone. Hotel: dusk-sea indigo night and sand white, with a pale lamplight used only where light
comes from (strip outline, ridge marker). Furniture: rust, burgundy and cream (and its oat and plum colourways, which
the visitor picks). Gallery: cool white and black with violet for state and one band. No two sites share a family; no
two sites share a button colour (green, sand white, the sofa's colour, black).

---

## 8. Data format

### 8.1 Site folder

```
<site>/index.html            font links, end panel + footer markup, <script type="module"> boot
<site>/style.css             tokens + small overrides
<site>/tour.json             everything below
<site>/frames/<clip>/        0001.webp … manifest.json   (tools/frames.py; gallery also panels.json and mask/)
<site>/frames/<clip>-phone/
<site>/frames/<clip>-rec/    record-only, full rate, gitignored (6.1)
<site>/tracks/<clip>.json    tracked points (8.4)
<site>/img/                  stills (2560 px webp + 1280 px phone, only where sharp), occluder masks, swatches,
                             thumbs, art, map.svg, plan.svg
```

### 8.2 `tour.json`

Commented here; the real file is plain JSON. Positions are fractions of the 16:9 frame (0–1) unless marked as
viewport fractions. Prices, sizes and times are strings, so the copy shows exactly what's written.

```jsonc
{
  "version": 1,
  "site": "house",
  "meta": { "title": "Tembusu — Teduh House", "description": "…", "lang": "en" },

  "theme": {
    "material": "paper",                                     // paper | night | solid | wall
    "grain": 0.03,
    "frame": { "kind": "crop" },                             // crop | inset { inset: 12, radius: 10 } | none
    "label": { "brackets": true },                           // only the house owns brackets
    "hotspot": { "icon": "dot", "leader": false, "plate": "pill", "plateOn": "always",
                 "opens": "card", "halo": "off" },           // plate: pill | tag | none | wall; halo: off | one
    "rail": { "skin": "index", "case": "sentence", "hideOnTitle": true },             // index | strip | works
    "ruler": { "style": "none" },                            // ticks | profile | segments | none
                                                             //   ticks: { count, works }; profile: [0–1 | null, …]
    "walkbar": { "layout": "no-ruler", "right": "layer", "meta": null, "hideOnTitle": true },
                                                             // layout: center-ruler | left-ruler | no-ruler
    "caption": { "place": "bottom-left", "rule": true, "case": "sentence" },
    "map": { "svg": "img/map.svg", "corner": "tr", "frame": "title-block", "cone": true, "from": "move-2",
             "label": "TEDUH HOUSE · GF · 1:200" },          // or null
    "end": { "arrive": "sheet", "frame": "dim", "screens": 1.2, "pin": 0 },  // sheet | card; dim | keep | mask
    "cursor": { "on": true, "verbs": { "hotspot": "Open", "art": "Lift", "add": "Add", "swatch": "Pick" } }
  },

  "brand": { "name": "Tembusu", "wordmark": "Tembusu" },
  "nav": {
    "left": "wordmark",
    "center": "rail",                                        // rail | none
    "right": [ { "chip": "Plan", "do": "end#plan" }, { "chip": "hide" },
               { "button": "Start a project →", "do": "end#project", "primary": true } ]
               // do: end | end#<anchor> | stop:<id> | hide; furniture adds { "layer": "cart" }
  },

  "title": {
    "blocks": [
      { "id": "name", "lines": ["Tembusu"], "class": "t-title", "align": "right", "space": "viewport",
        "kicker": "Architecture & interiors · Singapore",
        "box": { "desktop": [0.20, 0.13, 0.772, 0.26], "phone": [0.04, 0.11, 0.92, 0.13] },   // x, y, w, h
        "stack": null,                                       // frame-space blocks: the fallback boxes (4.3)
        "size": { "desktop": "19vw", "phone": "23vw", "max": "300px" },
        "exit": { "dx": 0, "dy": -56 } }
      // gallery: "slot": "nav-center", "part": 0 | 1
    ],
    "gradients": [ { "edge": "top", "color": "#16140F", "opacity": [0.28, 0], "extent": 0.32, "rest": 0 } ],
    "occluder": { "masks": "img/occ/{n}.webp", "frames": [1, 1], "feather": 1.5 },   // or null
    "window": null,                                          // { desktop: [x, y, w, h], phone: [...], radius, grow }
    "exit": { "mode": "drift", "screens": 0.3 }              // drift | nav
  },

  "walk": ["entry", "move-1", "living", "move-2", "deck"],  // stop, move or cut, stop, …; the end follows

  "stops": {
    "entry": {
      "n": "01", "name": "Entry",
      "frame": "move-1:first",                               // <move>:first | <move>:last
      "still": null, "sharp": false,
      "focus": [0.57, 0.62],                                 // phone crop centre
      "screens": 0,                                          // the first screen: 0
      "bar": null,                                           // walk-bar text instead of "01 / 03 Entry"
      "caption": { "heading": null, "body": null, "label": null, "row": null, "price": null,
                   "place": null, "at": null },              // stop 1's statement is a title block
      "hotspots": [
        { "id": "m02", "at": [0.60, 0.88], "label": "Terrazzo", "code": "M-02", "card": "m02",
          "state": "planned", "side": "right", "keys": [[0.0, 0.60, 0.88], [1.0, 0.602, 0.896]] },
        { "id": "m04", "at": [0.10, 0.55], "label": "Limestone", "code": "M-04", "card": "m04",
          "state": "planned", "enterAt": "ui", "keys": [[0.0, 0.10, 0.55], [1.0, 0.072, 0.546]] }
      ],
      "lines": [ { "kind": "dim", "from": [0.247, 0.42], "to": [0.887, 0.42], "text": "7.20 m" } ],
      "map": { "stop": "s1", "room": "r-living", "heading": 180 },   // SVG ids; heading in degrees, 0 = up
      "photo": null                                          // hotel: { "n": 1, "of": 4, "label": "Entrance", "time": "17:02", "thumb": "img/thumb-1.webp" }
    }
  },

  "moves": {
    "move-1": {
      "from": "entry", "to": "living",
      "clips": ["frames/move-1a", "frames/move-1b", "frames/move-1c"],   // in order; "-phone" / "-rec" added by the engine
      "screens": 2.7, "rec": null,                           // default 0.3 × source s; rec default source s ÷ 1.1
      "tags": [],
      "panels": null,                                        // gallery: { "src": "frames/move-1/panels.json", "map": { "0": "w02" } }
      "events": [ { "at": 0.12, "name": "material", "id": "terrazzo" } ],  // to layers as "move:event"; at = move t (5.5)
      "focusKeys": null                                      // [[t, x, y], …]
    },
    "move-2": {
      "from": "living", "to": "deck", "clips": ["frames/move-2a", "frames/move-2b"],
      "tags": [ { "id": "t-suka", "text": "M-05 SUKABUMI", "offset": [40, -40],
                  "track": ["tracks/move-2a.json#coping", "tracks/move-2b.json#coping"],
                  "keys": null, "from": 0.12, "to": 0.9 } ],
      "events": [ { "at": 0.45, "name": "material", "id": "sukabumi" } ]
    }
  },

  "cuts": {                                                  // hotel only
    "cut-1": { "from": "lobby", "to": "room", "screens": 0.9, "rec": 1.4, "sheet": "frames/move-2:first",
               "line": "Along the shore · Villa 12 · The far end", "note": "The last villa on the bay, four minutes along the sand.",
               "title": ["VILLA 12", "*Karang*"] }
  },

  "cards": {
    "m02": { "type": "material", "code": "M-02", "name": "Terrazzo", "line": "…",
             "rows": [["Finish", "…"], ["Origin", "…"], ["Size", "…"], ["Where", "…"]],
             "status": { "planned": "Planned — goes in during step 2", "built": "Built" }, "swatch": "img/sw-terrazzo.webp" }
    // "facts":   { "type": "facts", "name": "…", "rows": [[label, value]], "price": "…", "button": { "label": "…", "do": "end" } }
    // "product": { "type": "product", "no": "03", "name": "lido", "kind": "lounge chair", "line": "…", "price": "€1,640",
    //              "sizes": [["72", "W"], ["86", "D"], ["70", "H"]], "material": "leather",
    //              "swatches": [{ "name": "cognac", "hex": "#8A4A24", "img": "img/sw-cognac.webp",
    //                             "packshot": "img/p03.webp", "recolour": null, "theme": null }],
    //              "img": "img/p03.webp", "ship": "…", "next": "p02" }
    //   a dune swatch: "recolour": { "src": "img/sofa-plum.webp", "mask": "img/sofa-mask.webp", "stop": "sofa" },
    //                  "theme": { "--paper": "#F1E3E4", "--ink": "#3A1020", "--accent": "#5A2232", … }
  },

  "artworks": {                                              // gallery only
    "w01": { "n": "01", "kind": "painting", "title": "06:40", "year": "2025", "medium": "Oil on linen",
             "size": ["180", "240"],                         // h, w in cm (objects: h, w, d)
             "price": "€24,000", "src": "img/art/w01.webp", "thumb": "img/art/w01-thumb.webp",
             "tint": "#D6DBF3", "tintInk": "#8E9BD8", "wall": "Room 01, north wall",
             "stop": null, "at": { "move": "move-1", "t": 0.30 } }   // where a strip click goes: a stop, or a move point
    // an object: "kind": "object", "cutout": "img/art/w07-cut.webp", "box": [x, y, w, h] at its stop, "stop": "hall"
  },

  "end": { "id": "end" },                                    // the end panel is site HTML; layers find it by id
  "footer": null,

  "record": { "fps": 30, "hold": 0.9, "speed": 1.1, "end": 4.0, "frames": "-rec",
              "beats": [ { "at": "living", "after": 0.35, "do": "open", "target": "hotspot:m04", "hold": 2.2 } ] }
}
```

### 8.3 Rules

- `walk` alternates stop, then move or cut, starting and ending on a stop.
- A stop's `frame` must exist; a move's first and last frames are its two stills as the video model made them.
- Hotspot positions in the direction files are approximate. Measure them on the final frames before shipping, and
  re-check that none falls in a caption box or outside the 1440×900 crop (frame x 0.05–0.95).
- Every visible control does something (glide, open, lift, add, pick, hide). No dead links in the demo.

### 8.4 Tracks file

```jsonc
{ "size": [1920, 1080], "fps": 24, "count": 145,
  "points": { "coping": [[x, y, q], [x, y, q], null, …] } }  // one entry per SOURCE frame, clip pixels, q = 0–1
```

One file per clip. Made with OpenCV Lucas–Kanade optical flow (`tools/.venv`) from a seed point on the clip's first
frame, run forwards then backwards; `q` from the forward–backward error (1 under 0.5 px, 0 over 3 px). Web frame `i`
uses source frame `manifest.map[i]`.

### 8.5 Panels file (gallery)

As `tools/panels.py` writes it (references/gallery.md):
`{ size, fps, count, panels: [{ id, quads: [[x0,y0,x1,y1,x2,y2,x3,y3] | null per source frame], full: [bool…],
medians: [grey | null per source frame] }] }`, corners top-left, top-right, bottom-right, bottom-left in clip pixels.

---

## 10. Weight and checks

### 10.1 Frames budget

- **Published:** desktop 1600×900 and phone 960×540, every 2nd frame (12 fps), WebP quality 72 (frames.py's one
  quality setting serves both). If phones look soft (at 390×844 a 960 px frame shows only ~250 source px across), use
  `--phone 1280`.
- **Record-only:** step 1, quality 85, desktop only, local (6.1).
- **Measured on the spike:** 31 KB per desktop frame and 16 KB per phone frame for the gallery clip (61 frames ≈ 1.9 MB
  per 5 s); expect 50–90 KB per frame for textured rooms.
- **Per site (desktop frames):** house ≈ 220 frames, ≤ 16 MB; hotel ≈ 190 frames, ≤ 15 MB; furniture ≈ 145 frames,
  ≤ 11 MB; gallery ≈ 170 frames, ≤ 7 MB, plus 7 artworks at ≤ 400 KB each (2000 px long side, q85: enough for a 62svh
  lift at 2× density). Stills at 2560 px q80 only where `sharp: true`. **≤ 20 MB per site; first paint ≤ 300 KB** (the
  cover frame, the fonts, the occluder mask).

### 10.2 Checks before a site is done

- [ ] At 1440×900 and 390×844 the cover holds only its budget (4.3); the title reads at a glance; the occluder covers
      only part of it, and it lines up while the title leaves.
- [ ] The first scroll moves the walk. No scroll range shows a frozen screen except the end rest.
- [ ] Captions arrive while the camera is still settling, with the 56 px rise.
- [ ] No text under 14 px. No filter, blur or shadow on any text. Small text ≥ 4.5:1 on its picture.
- [ ] The site uses only its own overlay vocabulary (1.1).
- [ ] Nothing scrolls sideways at 390 px.
- [ ] Hotspots sit on their objects at every stop, desktop and phone; none in a caption box.
- [ ] `?record` gives a smooth ~24–26 s film from the `-rec` sets; `tour.timeline` lists every segment;
      `tour.frame(n)` is deterministic.
- [ ] Reduced motion works.
- [ ] Weight within 10.1.
- [ ] The footer carries the demo line.

---
