# Gameplay

Short runs, instant restarts, a hands-off mode that plays well on camera, and losses that look deserved and funny.

## The sim: rules that replay exactly

- **One class runs the game** (a `World` or a `Round`) with `update()`: one fixed step of 1/120 s (`R.DT`). It owns a
  seeded random generator (`this.rand = R.rng(seed)`), records every change of input as `[step, bits]`, emits events
  (`{ type, … }`) for main to turn into sound and effects, and draws nothing.
- **Determinism is the whole trick.** Same seed and same inputs give the same run, so a replay is just
  `new World({ seed, replay: { inputs } })`, an autopilot can test its plan on a copy, and Node can check the game
  without a browser. Inside the sim never call `Math.random` or `R.fx` (`R.fx` is for effects), never read the clock,
  never depend on the frame rate.
- **Inputs**: a held flag (Pixel Hop, Meta Gear) or bit flags (Model Kombat: left, right, up, punch, kick, special).
  Main sets them before each step; the sim takes edges (`held && !prev`) as presses. Buffer a press that comes a moment
  early (Pixel Hop: 0.1 s before landing still jumps). For reaction games, time from the input event's timestamp to the
  first frame that showed the signal (Green Light Roadster).
- **States**: ready → play (or run, fight) → dying (caught, finish) → dead (done). The first press in ready starts the
  run and does nothing else.
- **What it keeps**: the score and the run's stats. What main keeps: the best score and anything that persists.

## Main's loop

```js
g.acc += dt * scale;            // scale: 1, 0 in hit-stop, 0.35 in bullet time, 0.5 or 0.25 in a replay
let n = 0;
while (g.acc >= R.DT && n < 16) { w.update(); for (const e of w.events) onEvent(e, w); g.acc -= R.DT; n++; }
if (n >= 16) g.acc = 0;         // never spiral after a stall
view.update(dt * Math.max(scale, 0.25), w); view.screen(dt); ui.update(dt);
view.drawWorld(w, g.t); view.present(w, (ctx) => ui.draw(ctx, g, g.t));
```

Shake and flashes decay in real time (`view.screen(dt)`), so a frozen hit-stop frame still shakes.

## Difficulty and fairness

- **Ramp inside a run**: speed with the score, tighter gaps, new kinds of obstacle after a few points, a banner when it
  steps up. **Levels or modes** as plain parameters: Model Kombat's `R.LEVELS` (the CPU's reaction time, blocking,
  aggression, projectiles, anti-airs, jumps); the Roadster's drive modes (Chill, Sport, Ludicrous, Plaid).
- **Always beatable.** The generator guarantees a way through. Pixel Hop places obstacles further apart than the
  longest jump at the speed they'll be met. Meta Gear places each guest so the stretch of path it can ever see or hear
  starts a safe gap after the last one's, gives false wakes only to guests who merely glance at boxes, and makes a
  guest facing the wall face it long enough to walk past.
- **Forgiving hitboxes**: a few pixels inside the sprite. Near misses feel great; every death must look deserved.
- **Tune with bots that play like people**: a reaction time, a timing error, a hold length. Report medians and bests,
  and aim for a casual median that makes a short clip and a best that makes a long one. Meta Gear's careful bots
  reach a median of about 56 m and a best of about 290 m; in Model Kombat a casual player wins about three rounds in
  four on TURBO, two in five on PRO and one in twenty on MAX.

## The hands-off mode

Every game has one: it's the B-roll, the demo and the attract mode. An **autopilot** for one-player games (FSF in the
Roadster, GHOST MODE in Meta Gear, AUTOPILOT in Pixel Hop) or **CPU vs CPU** for versus games. It's a toggle on the
title, and a tap anywhere takes over ("YOU HAVE CONTROL", a two-tone chime).

- **Plan with the real physics.** Copy the world and run it forward with each candidate input; take the plan that
  survives. Pixel Hop's `tryJump(delay, ob, need)` tries each hold length and jumps at the last step from which one still
  clears; the Roadster's `rollout()` rolls the real flight forward. A planner that steps in a different order, or forgets
  a speed change or a timer, dies in ways it never saw: FSF once ignored Ludicrous ending mid-flip; Meta Gear's planner
  was once a step off and walked into cones.
- **Never touch `this.rand` in a planner.** Replays don't run the planner (they replay its inputs), and copies must not
  spawn. Derive any variety from the seed and positions instead (Pixel Hop picks one obstacle in four for a close call
  with a hash of the seed and the obstacle's position).
- **Make it cinematic.** Jump at the last good moment, sometimes by a hair: close calls on camera. A Cinema mode can
  skim the edges on purpose.
- **CPU opponents** think every `react` seconds, with randomness from the round's own generator, so CPU fights replay
  too. Model Kombat's `think(f)`: block when threatened, anti-air a jumper, close the distance, throw when the special is
  ready, use the super when the meter's full.
- **Balance by simulation.** CPU vs CPU should split about 50/50 at every level. Fix asymmetry with one number: doubling
  your own speed is worth more than halving the rival's, so Model Kombat's SLOW DOWN lasts 1.3× longer (`SLOW_K`).

## Replays

No video is kept. Rebuild the run from its seed and inputs (and, where the autopilot played first, the step a player
took over), fast-forward to about two seconds before the end, and play it at half speed, a quarter around the hit,
with a zoom, under a camcorder overlay (`ui.drawCamcorder`: a blinking dot, the date, TAP TO SKIP). Model Kombat's
K.O. REPLAY, Meta Gear's POV FOOTAGE in a phone frame, the Roadster's killcam. Check it headless: the replay's last
state must equal the live run's.

## Results, saving, sharing

- **On a loss**: the stamp for how the run ended, a punchline from that cause's list plus the shared list, the score,
  NEW BEST, one line of stats (`ui.statLine` drops trailing parts until it fits).
- **What persists** (`R.store`, each game in its own namespace): the best score, the sound level, the hands-off toggle,
  first-run flags (a briefing seen once), unlocks, and the running gag (the production ETA, the feud's tally).
- **The share card** (`app.card()` plus your drawing, `app.saveCanvas`) and its caption (`app.copy`). A clean frame for
  it is taken just after the crash: set `view.wantSnap = true` a few frames in.

## Input

- **Touch first**: a tap or hold anywhere that isn't a button. Several fingers count as one hold; app.js gives each
  pointer an id and captures it.
- **Keys**: Space, ↑ or W to act; Enter to start; P or Escape to pause; M for sound; a letter for the hands-off mode; R
  for the replay. Mention them in the side panel.
- **A pad** for complex controls: Model Kombat's `R.KPAD` rectangles, hit-tested on down, move and up, with hold
  buttons and a special button that changes label (SUPER, DEPRECATE!).
- **Sound** starts on the first press (browsers need a gesture): app.js calls `R.audio.init()`.
- **Pause** when the tab is hidden (`hidden()`), with RESUME and a way back to the title.

## The flow every game follows

title → ready → play → dying → over → replay, and paused from ready or play. `games/hop/main.js` is the smallest
complete version: start there, and look at the examples for what each adds (modes, rounds and a finisher, a briefing).
