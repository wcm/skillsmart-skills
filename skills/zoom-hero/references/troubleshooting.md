# When something looks wrong

| You see | Why | Do |
|---|---|---|
| A jump when a close-up takes over | a weak match (rho under 0.5), or an old `levels.json` | `node align.mjs <id> <level>`; take again and keep a higher rho; `node publish.mjs <id>` |
| The close-up shows as a lighter or darker patch mid-dive | its tone differs a lot from the area | `publish.mjs` measures the tone match: run it again; if the colour is far off, take again with `--fix "keep the colours…"` |
| A spot sits on nothing | the rect was chosen for another take of the parent | `node look.mjs <id> <parent>`, fix the rect, remake the child; or move only the spot with `at` in `content` |
| A spot is under the words | `check.mjs` says so | move the spot with `at`, or the words; or choose another area |
| The title is hard to read | the first level's band isn't calm enough | remake the first level with the band described in the prompt; or add a scrim or a card; if you must remake it, everything below it follows |
| Words are hard to read on a level | busy or bright picture under them | a scrim in `style.css`, or `html[data-level="…"]` ink for that level |
| A white page, "the engine never showed" | a missing picture or a JS error | `check.mjs` lists them; `img.lp-first` and `img/levels.json` must exist (`publish.mjs`) |
| Everything is off to one side on a phone | the view leans to the main spot | set `focus` on that level in the tree, `publish.mjs` |
| **NOT ENOUGH CREDITS** | the account is short | give the user the link in the message; run the same step again afterwards |
| Tools stop with `unknown_skill` | the skill isn't on the account | install it from skillsmart.io/skills/zoom-hero, or use `FAL_KEY=…` |
