# Looks, changes and the page

One feeling runs through every Particle Hero: **a subject made of dust that gathers, holds, and gives way to the next,
and parts like smoke under a hand.** The looks differ in ground, ink, light and type; the feeling stays.

## The four looks (`looks.js`)

| Look | Ground | Grains | Change | Extras | Example |
|---|---|---|---|---|---|
| `dust` | black | bone-white dust (the picture's tones in one warm tint) | swarm: thrown out, a cloud, the next subject comes into focus | wind taking grains off one side, trackers with coordinates, a ruled frame | Fauna (a museum) |
| `ink` | cream paper | the picture's own colours as ink, mixing like ink | swarm as a mist: the subject evaporates from the bottom up, the next condenses out of it | none: clean editorial | Herbier (perfume) |
| `neon` | plum black, see-through | the picture's colours, boosted | swarm burst on a downbeat | three coloured lights circling and flashing on a beat, streaks, the pointer as a warm light, a giant title behind the dust | Afterglow (a festival) |
| `print` | off-white paper | one ink (safety orange) in fine round dots that never pile darker than the ink | melt: one shape reshapes into the next, toe to heel | a scan line through the depth, callouts on leader lines | Stride (sneakers) |

Pick by the brand and the subjects:
- **Living things and heritage** (animals, artefacts, sculpture, architecture): `dust`.
- **Natural, luxurious, crafted** (perfume, food, flowers, skincare, wine): `ink`.
- **People and nightlife** (music, events, sport, fashion campaigns): `neon`.
- **Products in a range** (shoes, chairs, bottles, gadgets, cars), where each model should turn into the next: `print`, or `melt` in any look.

Change the colours to the brand's own:
- `tint` for dust;
- `background` for the paper;
- `inkColor` for print;
- the lamp colours and `hot` for neon.

Keep one hue family per page. The look carries the feeling, so don't add a second effect.

### Light or heavy

The user may say a page feels heavy (too dark, too dense, too much ink) or flat. Turn these:
- **Paper:**
  - `exposure` down (0.5–0.8) for lighter;
  - `inkCap: 3.22` so ink never goes past its own colour;
  - `levels: { gamma: 1.5–2 }` so mid-tones stay light and dark subjects keep their details;
  - thinner type (weight 200–300) and thin rules.
- **Dark:**
  - `exposure` up for brighter, `mono` toward 1 for calmer;
  - `flightDim` up if a change burns to white;
  - `relief` up (1–1.2) for more depth when it looks flat.

## Changes

- **Swarm** suits subjects that differ (a stag to an owl, a singer to a saxophonist). Tune with:
  - `kick`: the burst;
  - `blur` and `ramp`: how soon the next subject shows through;
  - `spread` and `gather`: the length (a change lasts about `spread + gather` seconds; keep it 1.8–2.6).
- **Mist** is a gentle swarm: `kick` 0.5–0.8, `air` ~1.1, `order: { dir: [0, 1, 0.2], jitter: 0.55 }` (from the bottom up). Use it for luxury and calm.
- **Melt** suits subjects of the same kind and pose, with matched grains (the pairing is worked out in the background):
  - a range of shoes, all in side profile facing the same way;
  - bottles, all upright;
  - chairs, all at three-quarters.

  `order: { dir: [1, 0, 0] }` sweeps it left to right. Between very different shapes it looks patchy: use a swarm.
- Any picture can carry its own `move`, to change **into** it differently (a melt between two shoes, then a swarm to a logo).

The change should land on a timer the eye can follow:
- hold each subject 4–5 s;
- a click holds it longer (`pick`);
- on a music page, change on a downbeat (Afterglow uses `hold: 1e9` and calls `next()` every three bars).

## The hand

The hand is soft but loose. It takes nearby grains along, spreads them sideways and in depth, and lets them drift back over a second or two. A still pointer parts them very slightly. Raise `hand.drag` and `hand.reach` for a bolder smear, or set `hand.strength: 0` for none. A drag-like wake reads as "real" far better than a swirl or a repulsion bubble, so don't add swirls. On the neon look the pointer also carries a warm light (`hot`).

## The page round it

- **The title reads first.** Give it a band of its own and place the subject (`frame`) beside it. Dust may cross the title during a change or a push, but never sit on it. Options:
  - **dust:** the title on the left third, the subject on the right two-thirds, the wind blowing away from the title;
  - **ink:** the title left, the subject centre-right, a list of scents or products on the right;
  - **neon:** a giant title behind the dust along the bottom (`transparent: true`, the `<h1>` before the canvas), with the subject standing over one end of it, and the lineup on the left;
  - **print:** a huge, thin model name top-left, the product centre-right with callouts, model tabs along the bottom.
- **A list to pick a subject**, with its number, name and a thin line that fills while it holds. It doubles as the page's progress.
- **Words for each subject**: a name and one line (a Latin name, notes, a slot time, a price). Keep them short.
- **One call to action** (book, add to bag, tickets), always visible.
- **Type**: one display face and one text face that fit the brand:
  - Instrument Serif and Manrope for a museum;
  - Cormorant Garamond and Jost for perfume;
  - Anton and Space Grotesk for a festival;
  - Archivo (wide, light) and IBM Plex Mono for products.
- **Phone**: the title on top, the subject in the middle, the list along the bottom; fewer grains (automatic); trackers show fewer labels.
- **Callouts** (print): three short specs per product, each pinned to a point on it (`at` in picture space), with labels away from the title.
- **Trackers** (dust): 8 labelled and 14 small. Turn `links` off when the subject is busy.
