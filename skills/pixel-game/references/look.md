# The look

Neon arcade at night: dark scenes, light that glows, chunky type, and something happening on every input. Every game
shares the engine's light, type and UI kit; each gets its own scene, palette and logo.

## The screen and the layout

- **216×384 logical pixels**, 9:16. The canvas scales by whole numbers (2× to 5×) so pixels stay square; 5× is exactly
  1080×1920, the size of a vertical video. Draw in logical pixels and never think about the device again.
- **The action sits in the middle of the frame.** The play band sits between about 60% and 80% of the height: the
  Roadster's road is at y 272, Kombat's stage floor at 252, Meta Gear's player at 300, Pixel Hop's road at 272.
- **The title**: the logo and your numbers at the top, TAP TO PLAY in the middle (H / 2), the subject on the road or
  stage, and the settings (sound, the autopilot or CPU mode, difficulty, a car or fighter picker) under the action.
- **Leave the edges for the video app**: nothing that matters in the top ~30 px (status and progress bars) or the
  bottom ~60 px (captions, buttons). A HUD's score at the top is fine; a hint at the very bottom is fine.
- **Less text.** One-line names, no subtitles under them, one row of stats on a result, no explanation lines in the
  game. The first Roadster build had all of these; cutting them made it better to watch, and these games are watched
  as much as played.

## Light

- **Two buffers.** `view.base` is the colour; `view.glow` is what emits light. Draw anything that glows into both (eyes,
  lamps, neon edges, coins, sparks, the sun); the engine blurs `glow` into bloom. Glow is a seasoning: the hero, the
  hazards and the effects, not the whole scene.
- **The palette** (`R.UIC`): night `#05030a`–`#0e0820`, cyan `#2ef6ff`, pink `#ff3fd2`, yellow `#ffe14d`, red `#ff2a3d`,
  green `#39ff7a`, dim `#9a8fc4`. Type gradients in `R.GRAD`: chrome, neon, gold, ice, heat, rainbow.
- **A scene per game, inside the neon.** The Roadster: rainy Giga City, a synthwave Skyway, low Earth orbit, Mars.
  Kombat: the summit stage with an LED wall, spotlights, a back row holding hands and a mirror floor. Meta Gear: a café,
  a gym, a wedding aisle, a tech expo, each with its own floor. Pixel Hop: a striped synthwave sun over two skylines.
  Give the hero the brightest, most saturated colours; keep backgrounds darker and calmer than the cast (a busy, bright
  skyline swallowed Pixel Hop's first hero).
- **Reflections.** `view.reflect(b, gl, t, y)` mirrors everything above `y` into the floor below it, rippled and dimmed:
  a wet street, a polished stage. Draw the floor's edge line and markings after it.
- **Backgrounds are baked once** (skylines two screens wide with a glow twin, scrolled at their own parallax speeds),
  never redrawn pixel by pixel each frame.
- **The finish**: scanlines and a vignette always; chromatic split (`aber`), glitch slices, flash, shake and zoom
  punches on events, via `view.hit(kind, amount)`. With reduced motion the engine calms all of them.

## Type

- **In the canvas**, the engine's two bitmap fonts: `big` (5×7) and `small` (3×5). Capitals, digits and
  `! " # % & ' ( ) * + , - . / : ; < = > ? @ · × – ™ ↑ ↓ ▶ ◀ ● ★ ⚡` (`small` has no `;`). Lower case draws as capitals;
  anything else (an em dash, curly quotes, emoji) draws as `?`. Scale by whole numbers; `italic` leans big type; add an
  `outline` (`C.ink`) on anything over the scene; per-row `gradient`s make chrome and heat letters.
- **On the page**, Silkscreen (headings) and VT323 (text) from Google Fonts, for the side panels only.

## Logos

Each game, and each mode of a game, gets its own animated logo, shown on the title, on the get-ready screen (so the
first frame of any clip says what game this is) and on the share card:

- FLAPPY ROADSTER: chrome letters that bob in a wave, with a pair of beating pixel wings.
- KICKFLIP ROADSTER: gold letters on a red skate sticker that pop and kickflip one after another.
- UPSIDE-DOWN ROADSTER: a rainbow word over a neon ceiling, ROADSTER hanging from it upside down.
- GREEN LIGHT ROADSTER: a dot-matrix sign that runs a drag tree.
- MODEL KOMBAT: a medallion, MODEL in chrome, KOMBAT in molten heat.
- META GEAR SOLID: META GEAR in steel, a heavy SOLID in heat that flickers.
- PIXEL HOP: PIXEL in chrome, HOP in heat, its letters hopping in turn.

The tools: `ui.letterLine` draws a line letter by letter so each can lift, squash or flip; `ui.shine` sweeps a light
across what's already drawn (draw the logo on its own canvas first, so the light only touches the letters);
`ui.sticker` makes a leaning slab; `ui.pixels` draws tiny emblems.

## Juice: every input and event has a sight and a sound

| Moment | Look | Sound |
|---|---|---|
| An input (jump, flap, punch) | squash and stretch, a puff of dust or jets | a short blip |
| Scoring | the number bumps | a tick |
| A close call | zoom punch, chromatic split, CLOSE CALL! 2 PX; bullet time for ~0.4 s | a whoosh and a sparkle; the music goes underwater (`A.seq.slow`) |
| A hit | sparks, shake, 0.05–0.07 s of hit-stop, a combo popup | a smack that grows with the combo |
| A big moment (a super, a new zone, faster) | a banner sweeping across, the music's intensity up | a sting |
| The loss | hit-stop, a white flash, a glitch, debris that bounces on the floor, slow motion | a crash, the music ducked, a sad trombone on an early fail |

Hit-stop and slow motion change how fast main steps the simulation; the sim itself never knows. Particles (`view.puff`,
`burst`, `chunk`, `confetti`, rings and streaks) live in the view, run on real time, and use `R.fx`, never the sim's
random generator.

## The result screen

The stamp slams down (tilted, red, with a thump), the punchline types itself out, then a panel rises: the score big,
NEW BEST or BEST, one line of stats, and the buttons RETRY (the big one), REPLAY, TITLE and SHARE CARD. After a second,
a tap anywhere retries.

## The share card

1080×1920: the last clean frame of the game (a snapshot without the UI, taken just after the crash) under a dark shade,
the logo at 5×, the stamp, the score huge, the best, the punchline, a line of stats and, at the bottom, the parody line.
Saving it also copies a caption for the post.

## The page around the game

The game's canvas in the middle of a dark page with a soft glow. On wide screens, two side panels: **How to play** (the
controls with `<kbd>` keys, the rules in a few lines) and **For creators** (the hands-off mode, the replay, the share
card, every key), then where the idea comes from and the parody line. Under 860 px the panels hide and the game fills
the screen.
