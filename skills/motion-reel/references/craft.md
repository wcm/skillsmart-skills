# The craft

What keeps a reel working: the beat, the pace, the loop, the joins, the hits, the frame. The engine
keeps most of these for you; the ones marked **you** are choices in the reel file. Read
`motion-rules.md` too: the rules every Skillsmart video follows.

## Time

- **Whole bars.** A reel is bars of 4 beats: the scenes' `beats` (× their `slow`) must add up to a
  multiple of 4, so the loop lands on the downbeat and the music loops with it. `check.mjs` fails
  otherwise. At 120 BPM a beat is 0.5 s; 16 bars is 32 s.
- **Cuts land on beats**, and everything inside a scene moves on its beat grid.
- **Long enough to follow (you).** A scene holds the screen 2 s at least, a shot of a burst 1 s
  (`check.mjs` warns below that). Lengthen with `beats` first; `slow` plays a scene in slow motion.
- **The richer, the slower (you).** Type reads at a glance; dense motion (a point cloud, particles,
  a fractal) needs time. Give rich scenes more beats, keep the rest moving: the contrast is what
  makes the rich ones land.
- **Calm, fast, calm.** Open readable, speed up in the middle (a burst of quick shots about three
  quarters through), end on the name.

## Time effects (you)

Every frame is computed from its time, so a scene's time can be bent with `warp`:

| `warp` | What it does |
| --- | --- |
| `"reverse"` | plays the scene backwards |
| `"snap"` | slow motion that snaps to full speed: 55 % of the time for the first 12 % of the motion |
| `"rush"` | the reverse: fast, then a long slow tail |
| `"hold"` | plays through, then holds its last moment |
| `"boomerang"` | forwards, then back |
| `"stutter"` | three quick back-and-forths at the middle, like a scratch |
| `[[0, 0], [1, 0.42]]` | knots: plays only the first 42 % of the scene's motion, over its whole length |
| `[[0, 0.6], [1, 1]]` | plays only its end (from 60 %) |

Cuts and transitions keep to screen time; only what the scene draws is warped.

## The loop

The last frame must flow into the first. Three ways:

1. **Open onto it.** The last scene's `out` (iris by default for the end card, or zoom, whip, any
   transition) opens onto the first scene frozen at its first frame. The first scene must start calm:
   its ground and almost nothing on it.
2. **Rewind onto it.** A `rewind` scene last plays the whole reel backwards and lands on frame 0.
   Put the end card before it, with `out: null`.
3. **Fall onto it.** Any transition works as long as the first scene begins where it lands.

`check.mjs` measures the seam: the step from the last frame to the first must be no bigger than the
steps around it. The soundtrack is cut to exactly one loop, so the sound wraps too.

## Transitions (you)

`references/transitions.md` has them all. Use two or three kinds per reel and repeat them: that
reads as a style. Bridge with the dot when you can: most scenes start from a dot and end in one
(`s._.anchor`), and zoom, iris, flood and shape open from it.

## Energy (you)

`energy` (on the reel, or a scene's own) makes hits land: a shake, a punch-in, a white flash and a
colour split for a frame or two, and a swell on every beat (`pulse` scales it, `pulse: 0` for none).
A hard cut is a hit; so is every beat in a scene's `hits` (a word changing, a ball landing, a burst's
next shot). A transition carries its own impact, so a cut covered by one is not a hit.

Keep it to no more than three full-frame flashes in a second (photosensitive viewers): space hits a
beat or more apart at fast tempos.

## The frame

- **The HUD** is the reel's instrument panel: brackets on the safe area, the brand and edition top
  left, the beat and a line of your own top right, the scene's number and label bottom left, a
  readout bottom right. `hud: { right, readout, left, beats, vars, meter }` makes it tell the idea's
  story: `vars` are numbers that follow curves over the reel (a temperature, a depth, a distance),
  `meter` draws one as a gauge up the right edge. `hud: "minimal"` keeps the brackets and the scene;
  `hud: false` hides it.
- **The safe area.** Words that matter sit inside the brackets, clear of the apps' own buttons
  (`build.mjs`'s page has a safe-zones button).
- **Readable type.** Labels never render under 20 px (`minText`, on a 1080-wide frame): they read on
  a phone. Keep big words off the busiest part of a scene.
- **Formats.** 9:16 first. 1:1 and 4:5 work well; in 16:9 the scenes, composed for tall frames, sit
  smaller in the middle. Check every format you render on its own contact sheet (`check.mjs reel.js
  --format 1x1`).

## Colour

- **One accent** for what matters (the dot, the lit word, the heat); everything else ink, paper and
  the ground.
- **Change the ground at a cut**: light, dark, saturated in turn, so every cut reads.
- **Palettes are roles** (ink, paper, accent, cool, sun, blush, deep, sky); scenes ask for roles, so
  a new palette changes the whole reel at once. `ground: { gradient | radial }` paints a scene's ground.

## Type

Three families per reel: a heavy display face for big words, a serif for the human line, a mono for
every label. Variable weight is a motion (the title's words thin from 900 to a hairline); variable
width too (Archivo, `stretch`).

## Honesty

Numbers on screen are real: the user's, or true of the idea (a constant, a ratio) or of the reel
itself. The dashboard scene's numbers especially. Never invent a statistic to fill a scene: cut it.
