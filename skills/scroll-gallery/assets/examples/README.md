# The example galleries

Four galleries, built while the engine was worked out and reviewed scene by scene. Each folder holds the page as
built: `index.html` (fonts, type), `page.json` (words, scenes, and every picture's prompt with the page's style line),
`images.json` and `img/` (the 900 px pictures; the 1800 px ones aren't shipped), `scene/` (its scenery) and, when it
has generated scenery, `scenery.json` (those prompts). Every brand, artist and title is made up; every picture was
generated. The live pages are at [demos.skillsmart.io/scroll-gallery](https://demos.skillsmart.io/scroll-gallery/).

`new_project.py <project-dir> <id> --from <name>` starts a new page from one of them (its scenes, type and scenery,
with slots for the words and pictures); add `--examples` to copy it as it is.

| Page | Subject | Scenes, in order | Pictures | Type |
|---|---|---|---|---|
| `ardent` | Ardent, a fashion house's autumn–winter lookbook | **Table** (`pile` · `table`: prints on a cutting mat round the title, dealt from a deck) → `fan` → **Runway** (`ring` · `surround`, `cloth`: silk panels on a rail in a dark venue, fog in front) → **Tiles** (`mosaic` · `tiles`: glazed tiles, waves of whole looks and a patchwork `mix`) → `fold` → **Lookbook** (`book` · `pages` on cobalt tissue paper) | 20 looks, 2:3, one model on a saturated backdrop | Bodoni Moda, Inter Tight |
| `side-b` | Side B, a record shop | **Slabs** (`deck` · `slabs`: thick covers with labels on their edges) → `reshape` → **Crate** (`deck` · `stack`: a walnut crate) → **Platter** (`ring` · `platter`: covers round a spinning record) → `reshape` → **Jukebox** (`ring` · `wheel`, 40 places: the risen record slides out its vinyl) | 20 album covers, 1:1, `disc: true` | Unbounded, Space Mono |
| `far-field` | Far Field, landscape photographs | **Trail** (`deck` · `trail`: follows the cursor, 16 places, dust) → **Arc** (`ring` · `arc`: small prints like a rainbow, the top one named) → `reshape` → **Band** (`ring` · `band`) → `dive` → **Sphere** (`sphere` · `dive`, 40 places, among stars, `end` on 04) | 20 places, 4:5, each glowing behind itself | Instrument Serif italic, Geist Mono |
| `kit-of-parts` | Kit of Parts, a library of design assets | **Board** (`pile` · `board`: a hero piece and six pinned round it on red threads, on linen) → **Sweep** (`deck` · `sweep`, with its switches) → `reshape` → **Ribbon** (`deck` · `ribbon`, 40 acrylic cards on black) → **Cube** (`mosaic` · `cube`: a glass cube that scrambles and solves, in a soft glow) | 20 assets, 4:5: 3D objects, posters, surfaces | Bricolage Grotesque, DM Mono |

What each taught (it is in the skill's rules now):

- **Ardent**: a first scene must leave the title readable (the table was made smaller and split above and below it);
  the runway only felt real once the pictures hung as silk; the tiles needed a wave of mixed pictures, not only whole
  ones.
- **Side B**: the jukebox reads as a circle only from above, with small records and the current one big; covers need
  their own coloured edges and the vinyl sliding out to feel like records.
- **Far Field**: the arc reads better flat and zoomed out with small prints than as a fan; the sphere needs smaller
  pictures and air between them; a trail must span the screen.
- **Kit of Parts**: the threads must never cross a picture; the ribbon needed the thickness and glowing edge of real
  acrylic; the cube must turn slowly, once.
