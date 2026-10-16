# The loop (motion, matte, encode)

## How the loop is made

Skillsmart's `kling-v3-pro` model (Kling v3 pro, through `tools/gen.mjs`) with the still as **both** `start_image`
and `end_image`, so the clip starts and ends on the same frame and loops without a seam. No audio. 15 credits a
second: 60 for the pop's 4 s, 75 for a page's own 5 s motion. The prompt is the motion line plus
the shared `loop` line (locked-off camera, the backdrop still, the letters stay readable). Negatives are the shared
`negative`, the motion's own, and the page's own (`pages.<id>.negative`).

The default motion is the shared **pop** template, 4 s at `cfg` 0.8 (a higher cfg follows the motion more closely):

> **⟨subject⟩** float in mid-air. With a sudden springy pop they come alive: the whole cluster jolts upward a little
> and jiggles like a giant jelly, quick wobbles rippling through every letter, side to side and up and down, then
> quickly settling. Halfway through, a second, smaller jolt and jiggle. **⟨shine⟩** Every letter stays round, full
> and taut, floating in the same spot in the air. Snappy, springy, eye-catching motion.

- **subject**: the letters in a few words: `The glossy pink letters`, `The pink satin letters`.
- **shine**: what the material does as it moves, one sentence ending "as it jiggles": `The mirror-bright reflections
  flash and slide across the smooth pink as it jiggles.` For fur: the fibres ruffling. For matte rubber: the colours
  squishing where letters touch. This sentence is what makes the material feel real in motion.

A page can replace the pop with its own `motion` line (5 s at `cfg` 0.7), for a material that wants a different
action. Write it as one shared, repeated action (below). Two that worked:
- matte rubber: *The whole cluster of squishy rubber letters bounces like a jelly on a plate, again and again: it
  squashes down, springs up and wobbles from side to side, every letter jiggling with it while staying in its place
  in the cluster, the soft colours squishing into each other where the letters touch. Lively, bouncy, energetic
  motion from start to end.*
- faux fur: *The whole stack of fluffy letters bounces like a big plush pillow dropped on a bed, again and again:
  it drops, squashes wide, then stretches tall as it springs back up, three springy bounces with a soft wobble
  running through every letter, the fur ruffling with every bounce. Every letter stays in its place in the stack
  and keeps its shape. Lively, bouncy, energetic motion from start to end.*

## What we learned (each from a loop that went wrong)

1. **One shared action for the whole cluster, every letter in its place.** "Each letter bounces in turn" (a wave
   through the letters) was ignored, leaving one letter moving and the rest still, or it broke a letter mid-loop.
   With start and end pinned to the same frame, the model handles one action for the whole object best.
2. **Say only what should happen.** The positive prompt "…never squeezes inward and never wrinkles" produced a
   squeeze with wrinkles. Mentioning the thing invites it. Unwanted motion goes in the negatives.
3. **A size change is hard for a pinned loop.** "Puffs out bigger" came out as a squeeze (the cluster shrank to
   half its size and back). So the swell is done in code (the page's pop, `puff.js`), and the video brings what code
   can't: the material jiggling, sheen and fur moving.
4. **Gentle words give near-still loops.** "Softly", "breathes", "gently" gave loops where 1–3% of the letters
   changed: on the page it looked like nothing happened. Say *lively, snappy, springy, energetic*.
5. **Any bounce implies a floor.** "Bounces like a beach ball" made the letters drop and land on an invisible ground.
   Say *float in mid-air* and keep "falling, landing, hitting the ground" in the negatives.
6. **Too much is also wrong.** A big squash-and-stretch bounce read as "bouncing too much" on a hero you hover over
   repeatedly. The target is an active pop and small rebounds: eye-catching on the first hover, still pleasant on
   the tenth.

An earlier version of the pop template asked for the swell directly ("…the whole cluster puffs out bigger with a
sharp burst of air, every letter swelling round and taut, then springs back with a few quick, small, jelly-like
rebounds…", with the "never" clauses of point 2). On glossy letters it swelled the cluster to 105% and looked good;
on satin letters it squeezed them to half size with wrinkles. Both still looked fine to the person watching.
That is why the takes exist.

## Takes, and reading the numbers

`video.mjs <id> --takes 2` makes two loops from the same prompt, then writes `loop-takes.mp4` (the takes side by
side, playing three times) and `loop-takes.png` (twelve moments of each), and labels each take with two measures taken
from the raw clip (the backdrop is flat, so whatever differs from it is letters):

- **moves**: the share of the letters' area that differs from the first frame, on average (and at most, in the log);
- **size**: the letters' area at its smallest and largest, against the first frame.

| Reading | Means |
|---|---|
| moves under ~3% | barely moves: on the page, hovering seems to do nothing. Make the action stronger |
| moves 6–15%, max 35–65% | lively; the range the chosen loops fell in |
| max near 90–100% | something big happened: a landing, a letter morphing, the cluster jumping. Watch it |
| size down to ~85% or below | the letters squeezed in |
| size up to ~103% or above | they swelled |

The numbers flag problems; the person watching decides. Show `loop-takes.mp4` and let them pick (`--pick N`). Also
watch for: a letter that changes shape or swaps places, letters that leave the frame, flicker, and the last frame
matching the first (a jump at the loop point means the pin didn't hold; take another).

## Matte

Skillsmart's `birefnet-video` model (BiRefNet video, at 2K) returns a mask for every frame, at 2 credits a second of
the loop. The default variant is `"heavy"` (BiRefNet's general model, heavy); set the page's `"matte": "matting"` for
fur and other fuzzy edges. `video.mjs` then measures every frame: if a frame's border is mostly opaque, the matte
kept the backdrop there, and it stops before encoding. Try the other variant (`--from matte`). Look at `sheet.png` (six moments over a checkerboard) for halos, holes or a missing letter.

## Encode

The clip is cropped to the union of everywhere the letters go during the loop (so the page can size the letters by
their real extent), the mask is tightened slightly so no backdrop rims the letters, and three files are written:

- `puff.webm`: VP9 with alpha, for Chrome, Firefox and Edge (about 1 MB for 4 s at 1600 px). Encoded at
  `-cpu-used 4`: VP9's default speed takes many minutes a clip for almost no visible gain;
- `puff.mov`: HEVC with alpha, for Safari (about 5 MB). It needs macOS: ffmpeg encodes it with Apple's VideoToolbox.
  Elsewhere `video.mjs` skips it, and Safari shows the still and the pop without the loop;
- `puff.webp`: the first frame with alpha. The page shows it at rest, and its alpha decides what counts as "on the
  letters".

Time: a Kling loop takes about 2–7 minutes, the matte 1–5, each encode under a minute. Run loops in the background.
