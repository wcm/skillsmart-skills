# The example pages

Four pages, one per way to play the effect. Each folder holds the page as built: `index.html`, `style.css`, `main.js`,
`scene.json` (every shot's prompt), `img/` (the 1600 px pictures, the measured light shares and `scene.json`; the larger
pictures aren't shipped). Every brand and name is made up; every picture was generated. The live pages are at
[demos.skillsmart.io/lights-on](https://demos.skillsmart.io/lights-on/). These pictures were made with GPT Image 2.5;
the skill makes yours with Nano Banana Pro, so expect a similar result rather than the same one.

`new_project.py <project-dir> <id> --from <name>` starts a new page from one of them; add `--examples` to copy it as it is.

| Page | Business | Lights | Interaction | Type |
|---|---|---|---|---|
| `noble-gas` | Noble Gas, neon and light boxes | a neon strike, then a light box swelling in | a switch, or the sign itself; a blush on hover by day | Inter Tight, IBM Plex Mono |
| `lueur` | Lueur, a lighting shop | five lamps, each on its own | click a lamp: evening, that lamp, its card; a master switch for all five | see its `index.html` |
| `pli` | Pli, curtains made to measure | a floor lamp and a table lamp, on four fabrics | hang-tags draw a fabric across the window; Morning · Night; a loupe on the weave | see its `index.html` |
| `deux-temps` | Deux Temps, a café and jazz bar | pendants, candles, the back bar, the stage | scroll is the clock; Café · Bar glides the whole day; optional room sound | Archivo variable |

What each taught (it is in the skill's rules now):

- **Noble Gas**: the title needs its own flip, since its side of the room darkens last; the night words wait for the
  neon's first strike; only the neon flickers, the box swells.
- **Lueur**: lamps must look like objects worth buying while off; one lamp at a time is more striking than all at once.
- **Pli**: the point is practical, so say how much light passes (72, 38, 6, 0%); the fabric needs its own photo set.
- **Deux Temps**: the first day photo had hard golden sun and looked staged. A light-only edit to a hazy morning fixed
  it and kept every night shot. The page follows the room, never leads it.
