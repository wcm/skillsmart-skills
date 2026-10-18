# Choosing the product, its two places and how it comes apart

## The product

Score an idea from 1 to 5 on six questions before you commit to it. The reference pages scored 26–29 of 30;
anything under about 22 will be hard work.

| Question | What a 5 looks like |
|---|---|
| **Split** | it comes apart into 5–10 big parts that look different from each other (a bun, pickles, two patties, onions, a heel) |
| **Inside** | the split shows something you never normally see (a carbon plate, a driver, insulation, a funnel of coffee) |
| **Places** | it has two great real settings, one for each end of the page |
| **Data** | there are real numbers worth labelling (grams, degrees, decibels, hours, percent) |
| **Safe** | the image and video models will draw and animate it right |
| **Buyers** | the page sells something people buy |

What scores low on **Safe**: tiny repeated parts (keyboard keys, bearings, screws), text or logos on parts, thin wires,
strings and spokes, liquids (broth, cocktails), glass that must stay transparent, and anything whose parts are all the
same material (they read as one blob when apart). Brand look-alikes (a phone that is obviously one brand's) are out.

How the ideas we scored came out (Split, Inside, Places, Data, Safe, Buyers):

| Idea | Score | Note |
|---|---|---|
| Running shoe | 29 | hidden foam and plate; laces are the only risk |
| Headphones | 28 | richest data; keep it away from a white-void Apple look |
| Burger | 27 | the clearest split there is; the places must beat the cliché |
| Prefab cabin | 27 | biggest wow and proves scale; walls can bend in the clip |
| Moka pot | 26 | safe and shows how it works; all-silver parts look quiet |
| Mechanical watch, perfume | 26 | strong, but many tiny parts (watch) or liquid (perfume) |
| Puffer jacket, e-bike, drone, film camera | 24–25 | cloth layers, spokes, propellers and tiny parts go wrong |
| Ramen, cocktail | 21–23 | beautiful, but floating liquid won't hold its shape |
| Skateboard, sunglasses, lipstick | 21–22 | too few parts for a strong split |
| Mechanical keyboard | 21 | the letters on the keys come out garbled |

## The two places

Each place is a real, photogenic setting, and the two are different in one clear way:

- **Flip the light**: a 1 a.m. diner → a sunny picnic (burger); a noon concrete ledge → a wet neon street (shoe).
- **At rest → on the move**: a listening bar → a train seat at golden hour (headphones).
- **The same thing in an opposite world**: a fjord at blue hour → the desert at golden hour (cabin: "placed anywhere").
- **Where it's made → where it's used**: a workshop bench → a kitchen; a stove → a campsite.

Rules that keep the cut-outs clean (the product is cut out of both photos):

- **It rests directly on a matte surface**: a counter, a table, a seat, a rock, the ground. No stand it hangs on, no
  hook, tray, plate or stove under it, nothing leaning on it. If the place needs one (a moka pot on a stove), plan on
  `detach` (references/cut-outs.md).
- **No reflection of it**: no puddle, mirror, glossy floor or water right under it. (The reference shoe stands in a
  neon puddle; that page needed SAM 3 to leave the reflection out.)
- **It sits on one side**: right in the first place, left in the second, with the other half calm (sky, wall, soft
  blur) for the words, and nothing in front of it.
- **Nothing readable**: neon tubes as abstract shapes, signs without words, no labels on bottles.

The second place shows the product **at a clearly different angle**. Image edits hold on to the old angle unless the
prompt names the new camera position and what it now shows, and a change of pose (lying on its side, seen from above,
toe first, from the back) is more reliable than an angle alone.

## How it comes apart

| Kind | For | Prompt words | Labels |
|---|---|---|---|
| **Stack** | layered things: food, shoes, a phone, a moka pot | "its layers lift straight up and hang in an evenly spaced vertical stack, each layer level" | one column on the right |
| **Mirror** | things with two halves: headphones, glasses, a car seen from the front | "both halves come apart outward along their own axis, mirroring each other" | rows above and below (`"labels": "rows"`) |
| **Burst** | a shell around a core: a speaker, a helmet, a lamp | "the parts move outward from the middle in every direction, evenly spaced" | one column |
| **Architect's drawing** | buildings, furniture, vehicles | "a clean exploded axonometric view, like an architect's presentation model: the roof lifts, the walls slide outward, the floors part" | one column |

List the parts in order (top to bottom, or outside in) in the `exploded` prompt, and name the same parts on the page.
Five to eight labels read well; more than nine crowd the column.

## The lab

The scene in the middle is a lab drawn in code behind and around the exploded product. Pick the one whose data fits:

| Lab | Reference page | For | Shows |
|---|---|---|---|
| **ticket** | `burger` | food and drink, anything ordered | an order ticket with weights, temperatures and macros, a timer, a giant outlined number behind, a glowing grill and smoke |
| **sound** | `headphones` | audio and tech | a frequency curve through the product, rings from the drivers, a dot-matrix readout, foam wedges |
| **motion** | `sneaker` | sport and anything worn | a running track, motion-capture markers, a foot-pressure map that strides, a big percentage and bars |
| **energy** | `cabin` | buildings, appliances, vehicles | site contour lines, the sun's path, energy flowing through the parts, a heat-loss scale |

`references/labs.md` has each lab's data and how to write a new one.
