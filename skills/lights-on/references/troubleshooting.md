# What has gone wrong before

| You see | Why | Fix |
|---|---|---|
| Doubled edges or a ghost in the dusk | a shot drifted from the day photo | read `prep.py`'s `moved_px`; make that shot again, adding "do not move, crop or re-frame anything" |
| `moved too far to fit` in `check.mjs` | the frame crept along the chain, usually after cropping shots by hand | keep every shot at the model's size; remake the shot from its parent |
| A candle lit or a lamp on by day | the model loves a glow | "switched off, unlit glass, no flame" in the day prompt, or edit the day photo |
| Looks staged, too dramatic | hard sun and heavy contrast | a light-only edit: "change the light to a hazy early morning, soft shadows, low contrast" with `{keep}`: the night shots still line up |
| Faint people at dusk | a night crowd fades in with the sun, not the lamps | keep the crowd out of the sunniest areas, or use an empty room by night |
| A light adds nothing in `check.mjs` | its solo shot didn't change, or `solos` and `lights` are in different orders | check the order; redo the solo |
| Colours spill across lights | two solos light the same area | that's fine for close lights; or use `rest` for the second |
| Title unreadable mid-dusk | words flip with the whole room | give that block its own flip by what's behind it (`noble-gas`: `--flip-left`) |
| Lag in a hidden tab | browsers throttle animation frames in the background | judge motion in a visible window, or with `video.mjs` |
| The sound doesn't play | browsers need a click first | that's the design: `roomSound` starts on its button |
