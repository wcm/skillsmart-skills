# The reference pages

Five pages: four built while the method was worked out, one per lab, and a fifth (`moka`) built afterwards with the
skill itself, as its first test on a new product. Each folder holds the page's `index.html` (fonts,
colours) and `page.json` (words, parts, lab) exactly as built; `subjects.json` holds their prompts in a project's
`tools/subjects.json` form. The pictures aren't shipped: the clips on
[skillsmart.io/skills/exploded-view](https://skillsmart.io/skills/exploded-view) show them.
`new_project.py … --from <page>` starts a new page from one of them.

| Page | Product | Place 1 → place 2 | Comes apart | Lab | Notes |
|---|---|---|---|---|---|
| `burger` | Night Shift's double smash burger | a diner counter at 1 a.m. → a picnic table, from above | a stack | ticket | the second photo needed the camera position spelled out ("looks steeply down at about 60 degrees"); `specks` clears the sauce drops the clips added, which flashed |
| `headphones` | Kissa One, walnut and aluminium | a Tokyo listening bar, on a stand → a train seat at golden hour, lying on its side | a mirror, labels in rows | sound | SAM 3's "headphones" left the stand out but kept its cradle under the headband: `detach1` with `patch1` and `erase1` took it out, and `dropx` the extra band the exploded view had grown from it; the second photo needed "solid walnut all over, with no grille" |
| `sneaker` | Strata Volt, a carbon-plated running shoe | a white concrete ledge at noon → a wet neon street at night | a stack, laces free | motion | SAM 3's "shoe" left the puddle's reflection out |
| `cabin` | Fjell 30, a prefab timber cabin | a fjord at blue hour → the desert at golden hour | an architect's drawing | energy | `noun` "cabin and its deck" keeps the deck with the house |
| `moka` | Caffè Riva, a stovetop moka pot | a sunlit Italian kitchen, on a gas flame → a rock by a lake at dawn, from above | a stack | ticket | SAM 3 needed `find` "coffee pot"; both photos needed `detach1`/`detach2` for the stove under the pot |

The burger's and the shoe's exploded views were edited from their first photo before the studio frame existed; their
`exploded` prompts here are in the skill's current form (an edit of the studio frame). Use the entries to see the shape
of a good one, not to copy: a new page's places, parts and motions are written for its own product.
