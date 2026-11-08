# Design

How to give a Turntable page its own look while keeping what makes it work. Every choice below is a CSS rule or a
`start()` option; the four examples show them together.

## Rules that stay

- **The title reads first.** The gallery's first look is the title and the subjects, side by side or the title above. Subjects never sit on the title.
- **Words left, subject right.** On a page the words stand in the left third, centred on the screen, and the subject stands right of them with room round it. On phones the subject takes the top half and the words the bottom.
- **A colour for every page, from its subject.** Take each page's `--page` from the subject: a light tint of its main colour for light subjects, a deep shade for rich ones. Neighbouring pages must differ enough to feel the scroll.
- **A line you can see.** The line between pages is where one subject turns into the next. It needs contrast: two colours, a rim, a shadow or a torn edge.
- **The subject stays put.** Never move the stage between pages. Things may arrive and leave around it.
- **Short.** 3–6 subjects. Each page is one screen and a third long (`--page-h: 130vh`), with one action at the end.

## The line between pages: `line`

| `line` | Feel | Its size | Used by |
|---|---|---|---|
| `straight` | calm, a gallery, a catalogue | — | In the Round |
| `arc` | a round table, a plate, a stage | `--arc` (26vh): how far the middle rises | Lacquer, with a gold rim drawn by `.page + .page::before` |
| `slash` | speed, sport, a drop | `--slash` (22vh): how far the left side drops | Torque |
| `wave` | soft, playful | `--wave` (7vh): the height of three waves | — |
| `zigzag` | torn paper, a receipt, a ticket | `--wave`: the height of the teeth | SIP CLUB |

## How a page opens: `flood`

The page's colour fills the screen while the clicked subject flies from the gallery to the stage.

| `flood` | Where the colour comes from |
|---|---|
| `circle` | a circle from the subject in the gallery (dishes, models) |
| `rise` | up from the bottom of the screen (a gallery's calm) |
| `drop` | down from the top |
| `tile` | the clicked tile grows to the whole screen (tile galleries) |

## The gallery: `gallery`

| `gallery` | What it is | How it's set up |
|---|---|---|
| `row` | things standing in a row on a floor or on plinths | `.row` of `.item`s; each `img`'s bottom margin puts its ground line (`--ground`) on the floor; give items different plinth heights (`--h`) for rhythm |
| `ring` | items round an ellipse, slowly turning, the front one biggest; a click turns the ring to bring that subject to the front first | `ring: { cx, cy, rx, ry, back, speed }` (centre, radii as fractions of the gallery, the size at the back, radians a millisecond); the items' `--depth` dims the ones at the back |
| `lineup` | people standing side by side, each with a tilted colour card behind | `.lineup` of `.item`s with `--c` (colour) and `--r` (tilt) |
| `tiles` | a bento grid, each tile in its subject's colour, the first tile big | `.tiles` grid; works with `flood: "tile"` |

Each `.item` is a `<button data-subject="…">` with an `<img>`: the engine fills in its first frame. Add a name, a price or a number in the item.

## Behind and around the subject

- **The stage** (`.stage-box`) holds, back to front: your `[data-stage="back"]` props, `.base`, `.shadow`, the subject's canvas, `.fore` and your `[data-stage="front"]` props. All of them swap with the subject at the line.
- **A base:** a plinth (a photographed pedestal from `prop.mjs`, its top face at `--ground`), a lazy susan, a spotlight pool. Style `.stage .base` and `.stage .shadow`.
- **Props that arrive:** anything in a page marked `data-stage="back"` joins its stage. `--arrive` is 1 while the page rests and 0 by the time the line crosses, so props can fly in as the subject faces you. SIP CLUB's colour swatches and receipt use it.
- **A colour pop:** `--grey` is 1 mid-turn and 0 at rest: `.stage canvas { filter: grayscale(var(--grey)) }` turns the subject grey as it turns and pops it into colour as it faces you.
- **Big type behind:** a year, a model name or a name in another script, in `--deep`, behind the stage. Let it bleed off the edge: the page doesn't scroll sideways.
- **Other variables, per page:** `--q` (the page's progress: 0 when centred, ±0.5 when a line crosses the subject), `--angle` (the subject's turn) and `--fade` / `--rise` (the words'). `--p` on `body` is the whole page's progress.

## The words

- Per page: a small label (a room, a course, a number), the name big, a line or two, a few facts (`dl`), and the action.
- The page's own number shows in `[data-now]`; `[data-detail-only]` shows only on the pages; a `[data-index]` button flies back to the gallery (Esc does too).
- **The end** (`.end`, after the pages) is the one thing to do next: book, buy, visit, order, with a way back to the gallery.
- **Two typefaces:** a display face with character for names and the title, and a plain face for the rest. A mono for labels suits a gallery or a drop.

## The four examples

| | In the Round | Lacquer | SIP CLUB | Torque |
|---|---|---|---|---|
| For | an art gallery's show | a Cantonese restaurant's tasting menu | a drinks-themed fashion drop | a sneaker drop |
| Gallery | `row` on fluted plinths of three heights | `ring` on a lacquer table | `lineup` with tilted colour cards | `tiles`, the first big |
| Line | `straight` | `arc` with a gold rim | `zigzag` (a torn receipt) | `slash` |
| Opening | `rise` | `circle` | `circle` | `tile` |
| Behind the subject | the plinth, plaster walls tinted by the work, the year in giant type | a lacquer turntable top, a warm glow, the dish's name in vertical Chinese | the drink's swatches and receipt flying in, grey to colour | the model's name in giant italic, flick to spin |
| Words | a museum label: artist, year, medium, size, enquire | the course, the dish, the drink to match, the price | the drink, the pieces as a menu, the price | the spec sheet, sizes, add to bag |
| Type | Instrument Serif, Inter Tight, JetBrains Mono | Fraunces, Figtree, Noto Serif SC | Bricolage Grotesque, DM Mono, Caveat | Archivo (wide, italic), Space Mono |

## Phones

The engine moves the subject to the top half (`--stage-cy: 28vh`, `--stage-h: 46vh`) and pins the words to the bottom while their page is on screen. In your `@media (max-width: 760px)` block:
- give the words a backing in the page's colour (`color-mix(in oklab, var(--page), transparent 8%)`);
- hide long notes;
- shrink the big type;
- make sure the gallery fits on one screen.
