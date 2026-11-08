# The engine

`site/engine/turntable.js` (with `frames.js` and `turntable.css`) turns a plain HTML page into a Turntable site. It has
no dependencies and draws on a 2D canvas, so it runs in every current browser.

## The page

```html
<link rel="stylesheet" href="../engine/turntable.css">
<link rel="stylesheet" href="style.css">

<header>
  <span data-detail-only><b data-now>01</b> / 05</span>         <!-- the page number, shown only on the pages -->
  <button data-index data-detail-only>All pieces</button>         <!-- back to the gallery (Esc does it too) -->
</header>

<section class="gallery" data-gallery>                             <!-- one screen, first -->
  <h1>…</h1>
  <button class="item" data-subject="volt"><img alt="…"> …</button> <!-- one per subject; the engine fills the img -->
  …
</section>

<main class="detail" data-detail>
  <article class="page" data-subject="volt" style="--page:#e2ff3b; --deep:#d0f01c">
    <div class="words">…</div>                                      <!-- sticks centred while its page is on screen -->
    <div data-stage="back">…</div>                                  <!-- optional: joins the stage, behind the subject -->
  </article>
  …                                                                 <!-- one .page per subject, in gallery order -->
  <section class="end" style="--page:#111; --ink:#fff">…</section>  <!-- optional: the last stop -->
</main>

<script type="module">
  import { start } from "../engine/turntable.js";
  start({ line: "slash", flood: "tile", gallery: "tiles" });
</script>
```

Each subject's frames are `frames/<id>/001.webp …` with `manifest.json`, written by `tools/frames.mjs`.

## `start(options)`

| Option | Default | What it does |
|---|---|---|
| `line` | `"straight"` | the line between pages: `straight`, `arc`, `slash`, `wave`, `zigzag` |
| `flood` | `"circle"` | how a page's colour fills the screen on opening: `circle`, `rise`, `drop`, `tile` |
| `gallery` | `"row"` | `row`, `ring` (items round a slowly turning ellipse), `lineup`, `tiles`. Only `ring` changes what the engine does; the others are names for your CSS (`body[data-layout]`) |
| `ring` | `{ cx: .5, cy: .56, rx: .36, ry: .22, back: .62, speed: .00006 }` | the ring: centre and radii as fractions of the gallery, the size of items at the back, its speed in radians a millisecond |
| `snap` | `{ ms: 1150 }` | one gesture = one eased turn of `ms` to the next page. `false` scrolls freely (the turn follows the scroll) |
| `turn` | `360` | degrees a subject turns from its page to the next |
| `dir` | `1` | `-1` plays every turn the other way |
| `flick` | `false` | a drag that's let go keeps spinning and slows down (shoes) |
| `dragDeg` | `0.42` | degrees of turn per pixel dragged |
| `openMs` | `1100` | how long the flight from the gallery takes |
| `record` | `{ subject: 1, pages: 4, hold: 1.2, open: 1.25, rest: 0.95, close: 1, end: 0.7 }` | the `?record` script: which subject opens, how many turns follow (cut to the pages there are), and the seconds for each part |

`start()` returns the API, also at `window.turntable`:
- `open(k)`, `close()`, `next()`, `prev()`;
- `p`: the progress, 0 on the first page, 1 on the second;
- `ready`: a promise that resolves once every frame of every subject has loaded;
- `stages`, `turns`.

## How it works

- **A stage in every page.** Each `.page` gets its own `position: fixed` stage (`.stage > .stage-box` with `.base`, `.shadow`, a canvas and `.fore`). It is clipped by the page's `clip-path`, so a page shows its own subject only inside its own shape. The line between two pages is therefore the line between two subjects.
- **Progress.** `p = i` when page `i`'s middle is at the stage's middle. A page's subject is drawn at `(p − i) × turn` degrees, so neighbours always share the angle where they meet.
- **Even turns.** The manifest's `cum` says how far through the turn each frame is, by how much it changes, and the engine finds the frame for an angle from it. Two frames are blended for in-between angles.
- **Loading.** Frames load coarse to fine (every 12th, 6th, 3rd, then all), the open subject first, six at a time. A frame that isn't loaded yet shows the nearest one that is.
- **Snapping.** The wheel, a swipe (over 36 px), arrow keys, Page Up/Down, Space, Home and End each start one eased turn, and nothing else can start until it ends. A trackpad's fading momentum is ignored: only a push that speeds up, or one after 0.6 s of quiet, starts a new turn. Any other scroll (the scrollbar, find in page) lands on the nearest page 0.16 s after it stops.
- **Dragging.** A grab area over the subject turns it by hand. Moving to another page, or closing, turns it back to face you.
- **Opening and closing.** A click flies a copy of the gallery picture to the stage while the page's colour floods in. With `ring`, the ring first turns the item to the front. Closing turns the subject to face you, then flies it home.

## CSS

`turntable.css` holds the mechanics. Your `style.css` sets the look and these variables:

| Variable | On | Default | What it is |
|---|---|---|---|
| `--stage-cx`, `--stage-cy` | `body` | `68vw`, `52vh` | where the subject's stage is centred |
| `--stage-h` | `body` | `84vh` | the stage's height (its width follows the frames' shape) |
| `--page-h` | `body` | `135vh` | one page's length |
| `--slash`, `--arc`, `--wave` | `body` | `22vh`, `26vh`, `7vh` | the size of a slanted, round, wavy or zigzag line |
| `--page`, `--ink` | each `.page`, `.end` | | its colour and its text colour |

The engine sets these:

| Variable | On | What it is |
|---|---|---|
| `--stage-ratio`, `--ground` | `body` | the frames' width ÷ height, and where subjects stand as a fraction of the stage's height (for gallery pictures, plinths and shadows) |
| `--q` | each page | its progress: 0 when centred, −0.5 / +0.5 when a line crosses the subject |
| `--angle` | each page | its subject's turn |
| `--arrive` | each page | 1 while the page rests, 0 once a line crosses (for props that fly in) |
| `--grey` | each page | 0 at rest, 1 mid-turn (a colour pop: `filter: grayscale(var(--grey))`) |
| `--fade`, `--rise` | each page | the words' opacity and offset, used by `.words` |
| `--p` | `body` | the whole page's progress |

States on `html`: `is-gallery`, `is-opening`, `is-detail`. On `body`: `data-line`, `data-layout`, `data-snap="on"`.

Phones (`max-width: 760px`): the stage moves to the top half (`--stage-cy: 28vh`, `--stage-h: 46vh`), pages are `120vh`, and the words stick to the bottom of the screen.

## URL switches

- `?subject=2` opens that subject straight away.
- `?record` replaces scrolling with a fixed script, for `check.mjs` and `video.mjs`: `window.turntable.timeline = { duration, marks, seek(t) }`. It holds the gallery, opens a subject, rests and turns page after page, then flies back to the gallery, so a video of it loops.
