# The page

A page is a folder in `site/`: `index.html` (fonts and type), `page.json` (words, scenes, pictures), and what the
tools write: `images.json` and `img/` (the pictures), `scene/` (the scenery). The engine in `site/engine/` is shared by
every page. `page.json` keeps one line per key, per scene and per picture; the tools rewrite it in that layout.

## page.json

| Key | What | Example |
|---|---|---|
| `brand` | the name top left (it links to `../`) | `"ARDENT"` |
| `title` | the big word on the first screen, set in the display face; one or two short words | `"Ardent"` |
| `kicker`, `count` | the small line under the title, joined by a dot | `"Autumn–Winter 2027"`, `"20 looks"` |
| `nav` | up to four labels top right: `{ label, href?, current? }`; with `href` a link (the one for this page is marked), without it a plain label; `current: true` marks one | `[{ "label": "Collection", "current": true }, { "label": "Atelier" }]` |
| `card` | the pictures' material for the whole page (`materials.md`) | `{ "radius": 0.04, "back": "#f7f5f0" }` |
| `open` | how the page opens: `"deal"` (a face-down deck dealt into the first scene) or `"enter"` (the first scene comes in its own way) | `"deal"` |
| `sequence` | the scenes in scroll order (`layouts.md`) | |
| `style` | the line every generated picture's prompt ends with (`pictures.md`) | |
| `items` | the pictures | |

### An item

| Key | What |
|---|---|
| `id` | `"01"`, `"02"`… (scenes name pictures by it) |
| `title` | the picture's name: on the label under the cursor, in Index and beside the opened picture |
| `sub` | a second name, for records the artist (it also goes on the slab's edge label) |
| `meta` | two or three short lines beside the opened picture: "Look 04", "Coat · double-faced wool"; "Erg Chebbi, Morocco", "Sunrise", "1/1000 s · 400 mm" |
| `text` | one sentence about it |
| `tracks` | a record's track list (shown numbered) |
| `aspect` | its shape, `"4:5"`, `"1:1"`, `"2:3"`: the card is cut to it (`build.mjs --from` reads it from your picture) |
| `prompt` | a generated picture's own words (`pictures.md`) |
| `trim`, `crop` | `true`, or `[left, top, right, bottom]` in fractions: cut off a border the model added (then `build.mjs`) |

### A scene

`{ "layout", "look", "name", "hold", "change", "len", "cards", "count", "bg", "ink", "scene" }` plus the look's own
options; `layouts.md` has them all. `bg` is `["#top", "#bottom"]`; the background wipes from one scene's to the next
as you scroll, and the words take the scene's `ink`.

## index.html

The page's fonts (from Google Fonts) and its type, as custom properties on `:root`:

| Property | What | Ardent · Side B · Far Field · Kit of Parts |
|---|---|---|
| `--font-display` | the title, the scene name, an opened picture's title | Bodoni Moda · Unbounded · Instrument Serif · Bricolage Grotesque |
| `--font-ui` | everything small | Inter Tight · Space Mono · Geist Mono · DM Mono |
| `--accent` | one brand colour: the label of the record on the turntable, and a background pattern's third colour unless the scene gives one | `#2340ff` · `#ff5b14` · `#e9c27a` · `#c6ff2e` |
| `--title-size` | the title's size | `clamp(80px, 19vw, 330px)` |
| `--title-case`, `--title-weight`, `--title-track`, `--title-style`, `--title-stretch` | the title's case, weight, letter spacing, italic, width | `uppercase`, `500`, `0.03em` |
| `--brand-size`, `--brand-track`, `--brand-case`, `--brand-weight`, `--brand-style` | the brand top left | `22px`, `0.24em` |
| `--scene-size` | the scene name bottom right | `clamp(34px, 3.4vw, 54px)` |

Pick one fashionable display face with character (a high-contrast serif, a wide or a condensed grotesque, an italic
serif) and a plain sans or mono for the small words. Load only the weights you use. `body { font-size: 12px; }` suits a
mono. The `<title>` is the brand and what the page is.

## What the visitor can do

- **Scroll**: the scenes play in order; the corner shows the scene's number, name and progress.
- **Point** at a picture: it comes forward a little and its label follows the cursor.
- **Click** a picture: it comes forward, big, with its words beside it (the 1800 px picture loads then); click again,
  press Escape or scroll to put it back.
- **Index** (bottom left): the list of every picture; hovering an entry shows its details, clicking brings that
  picture into view in a scene it is in.
- **Drag** the sphere, the jukebox and the cube to turn them; the sweep's switches change its corners, size and flow; the trail
  follows the cursor.
- On a phone every layout has its own arrangement, and the page reads the same with reduced motion (the scroll still
  plays the scenes; nothing moves on its own).

## For checks and video

`window.accrochage.go(v)` jumps to `v` screens of scroll and draws it at once; `.ready` resolves when every picture
and piece of scenery has loaded; `.record(true)` stops the page drawing on its own and `.tick(v, dt)` draws one frame
`dt` seconds after the last; `.restart()` replays the opening. `check.mjs` and `video.mjs` use these.
