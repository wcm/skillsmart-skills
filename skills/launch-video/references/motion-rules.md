# Motion rules

The rulebook every Skillsmart video follows. Read it once per film. Each rule is short on purpose; the
templates already obey them, so these matter most when you change timing or add a scene.

## 1. One job per scene

- Write the scene's message in one line before you animate it. If you can't, the scene is two scenes or none.
- One thing moves at a time. A second motion may start only when the first is settling (its last 30 %).
- The viewer reads, then looks. Text lands first; the picture answers it.

## 2. Every frame is a function of time

- All motion goes through the timeline (`tl.to`, `tl.fn`). Never `setTimeout`, CSS `@keyframes`, `transition`,
  `Math.random()` or a running clock: the renderer jumps to frames out of order.
- Randomness comes from `Film.rand(seed)`, built once in `build()`.
- `tl.fn(at, dur, f)` must set everything it touches from its arguments alone (no `+=`).
- Elements you animate keep their CSS transform empty: centre them with `x`/`y` in the timeline, or wrap them.

## 3. One ease family

| Use | Ease | Curve |
| --- | --- | --- |
| something arrives | `out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| something leaves | `in` | `cubic-bezier(0.68, 0, 0.77, 0)`, the mirror of `out` |
| something moves on screen, the camera | `inOut` | `cubic-bezier(0.77, 0, 0.175, 1)` |
| kinetic type, a hard arrival | `snap` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| colour, light, glow | `soft` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| a physical thing (a dot, a card, a bead) | `spring` / `spring(0.3)` | overshoot 3–9 %, never more than `spring(0.35)` |
| constant motion (marquee, orbit, scroll) | `linear` | |
| stop motion, pixel art | `out@steps(8)`, `steps(6)` | played on twos |

- Never `in` for an arrival: it starts slow and lands hard. Never bounce text.
- Exits mirror their arrivals: if it came in from the right with `out`, it leaves to the left with `in`, same distance
  and duration. That is what makes a cut match speed (rule 5).

## 4. Timing

- 30 fps for films, 60 fps (`--fps 60`) for UI stings with fast moves. Time things on a 0.1 s grid.
- Durations: a small UI move 0.25–0.4 s, a word 0.35–0.6 s, a card or device 0.6–0.9 s, a camera move 0.9–1.6 s.
- Stagger: 0.03–0.06 s between letters, 0.06–0.12 s between words, 0.08–0.15 s between cards.
- Reading time: a headline stays fully legible for at least 1.2 s, plus 0.25 s for every word past three.
  A number that matters holds 1.5 s after it stops counting.
- Stillness before a reveal: 0.3–0.6 s of near-stillness makes the next move land.
- First frame: something is already on screen or moving by 0.2 s. Last 1.5 s: the logo or call to action, still.

## 5. Cuts and transitions

- Nothing is perfectly still on either side of a cut: carry motion through it.
- Speed-matched cut: the outgoing move ends with `in`, the incoming move starts with `out`, same direction, same
  distance per second. The eye reads one move.
- Bridge objects: the shape that ends a scene starts the next (the dot becomes the screen, the card becomes the
  button). Prefer this over any transition effect.
- At most two or three transition kinds per film. Repeat them; repetition reads as style.
- Lead with the background: when a scene changes, the background or field moves first (about 0.1–0.2 s) and
  the foreground follows.
- Flashes: no more than three full-frame flashes in any second (photosensitive viewers).

## 6. Type on screen

- Captions: at least 4.5 % of the short side (about 50 px in 1080 p), headlines 9–16 %.
- Safe area: 6 % from every edge. In 9:16, keep text out of the top 12 % and the bottom 20 % (app chrome).
- Short lines: 3–7 words per line, one idea per line, sentence case unless the style says otherwise.
- Contrast: 4.5:1 for captions against everything that passes behind them.

## 7. Honesty

- Numbers, quotes, logos and screenshots come from the user. Don't invent a metric, a customer or a feature.
  If a number is missing, cut the beat or ask; never fill it with a plausible one.
- Put the source of each number on screen in small type when it's a claim (a survey, a benchmark).
- Show the user's own interface. Never a competitor's, never someone else's logo or brand style.

## 8. Formats

- Every film renders 16:9 (1920 × 1080), 9:16 (1080 × 1920) and 1:1 (1080 × 1080); 4:5 (1080 × 1350) on request.
- Lay out with `F` (`F.w`, `F.h`, `F.u` = 1 % of the short side, `F.shape`) and CSS on `[data-shape]`, never fixed pixels.
- Check all three: text that fits 16:9 often overflows 9:16.

## 9. Check before the long render

1. `render.mjs sheet film.html --scenes`: two frames per scene (settling, and the frame before the next cut).
2. Look for clipped or overlapping text, an empty or dead frame, a frame where nothing is moving at a cut, a
   number that's still counting when the scene ends.
3. `--draft` renders a half-size, 15 fps video in seconds to check the rhythm.
4. Only then the full render, in all three formats.
