# When something goes wrong

| Problem | Do |
|---|---|
| **NOT ENOUGH CREDITS** | Give the user the link from the message. When they've topped up, run the same step again |
| A take is still running | A film take takes several minutes, sometimes twenty. Run it in the background and look when it's done |
| `start` looks just like `staged` | The model didn't move the camera. Say it more bluntly: how high, how far round, how steeply it looks down; ask for what fills the frame |
| A picture has a thin border | Add "no border, no frame, full bleed" with `--fix` |
| The film jumps where two segments meet | The keyframes are fine but the takes end differently: try the other take. A small kink in camera speed is normal |
| A double image when the scroll stops | Neighbouring frames are far apart. Add frames there with `pick` or `retime` under `frames` in the scene file, and run `frames.mjs` |
| The evening jumps at the hand-over | Run `align.mjs` again, after `frames.mjs` (it fits to `film-last.png`). A low rho means the edit moved things: redo the picture |
| A lamp is on at dusk | `node pictures.mjs <id> dusk --force --fix "…is off"`, then `lit` again from it, `align.mjs`, `frames.mjs <id> stills` |
| The auto-play isn't 3 s | `glide: 3000` in `main.js`; `glideTo` if the page's own end comes later |
| The first screen's title sits on the subject | Frame it with `focus`, or move the title; don't shrink it |
| On a phone the subject leaves the frame | `phone.focus` keys, in film time. For a tall subject set `phoneCrop` in the scene file and `mode: "cover"` |
| The page is too heavy | `--q 54` on `frames.mjs`, or fewer frames where little moves (`pick`) |
| `sharp` fails to install | Run `npm install` in `tools/` again with Node 18 or newer |
| `check.mjs` finds no browser | Install Chrome, or check by hand: `python3 tools/serve.py`, and go through Step 6 |
