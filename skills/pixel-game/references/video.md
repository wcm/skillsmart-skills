# Demo videos and posting

These games are made to be filmed. Two ways to get video: render it (frame-exact, with the game's own soundtrack), or
screen-record a phone.

## Rendering: tools/demo.mjs

`node tools/demo.mjs <game>` (or a video's name) writes `tools/out/demo-<video>.mp4`: 1080×1920 at 30 fps, H.264, the
soundtrack mixed to -16 LUFS (what social apps play at). How it works:

- The page runs on the manual clock: two 1/60 s ticks per video frame, so nothing is dropped however slow the capture.
- Every sound is logged with its video time instead of played, then the whole soundtrack is rendered offline (an
  OfflineAudioContext) in time with the frames: the sequencer replayed through the logged song, intensity and duck
  changes, then each logged sound at its moment.
- A **skip** is a hard cut: the game runs on unrecorded, one-off sounds are dropped, the music keeps its state.

A **director** in `tools/games/<game>/demo.mjs` plays it:

```js
export const duckers = []; // sounds that silence the music by themselves (better: duck from main)
export const videos = {
  'my-game': {
    async run(r) {
      await r.act(() => { R.seeds.push(20261019); __fr.game.auto = 1; __alog.length = 0; }); // seed, autopilot, forget menu clicks
      await r.rec(1.6);                                   // the title
      await r.act(() => __fr.tap());                      // start
      await r.rec(10);                                    // the first stretch
      await r.skip("w.score >= 28 || g.state === 'over'"); // cut to a faster road
      await r.rec(6);
      await r.act(() => __fr.game.world.takeOver());      // hands off: the next obstacle wins
      await r.rec(8, "g.state === 'over'");               // the crash and the stamp
      await r.act(() => (__fr.game.run.msg = 'THE PUNCHLINE YOU WANT.'));
      await r.rec(3);
      await r.act(() => __fr.press('replay'));
      await r.rec(8, "g.state === 'over'");
    },
  },
};
```

`r.rec(secs, until)` records up to `secs`, stopping early when `until` is true; `r.skip(until, cap)` runs on unrecorded
until it is; `r.act(fn, arg)` runs code in the page; `r.peek(expr)` reads a value. `until` and `expr` are JavaScript
expressions over `g` (main's state) and `w` (its world or round). A file is about 50 MB for 45 s; make smaller copies to
send (below).

## Picking the moments: simulate ahead

The best moments are found, not hoped for. In Node, with the same sim (`tools/games/<game>/sim.mjs` shows how to load
it), run many seeds headless and score them by their events, then hard-code the winners in the director:

- Model Kombat's two videos are the same three CPU-vs-CPU rounds on MAX, one ending for each fighter, picked for
  supers, clashes and combos near each K.O., with a cut to the last six seconds before each K.O.
- Meta Gear Solid's ghost run was picked for a lively stretch in each of three rooms and a moment in the wedding where
  walking on gets you seen within a second; the director takes over there and walks into view.
- Flappy Roadster's runs use the Cinema autopilot (close calls on purpose), one seed, and stop at each new zone.

Seeds and step numbers change meaning when the sim changes; re-pick them then.

## What a good demo shows

1. **The first second says what it is**: the title with the game's name and logo, or the get-ready screen.
2. **The best stretch of play** on the hands-off mode: close calls, combos, a new zone.
3. **A loss**: the hit, the stamp, the punchline typed out (set the one you want).
4. **The replay**, in slow motion.

Demos run 30–50 s. Posts do better at 8–20 s; cut those from a demo, or render a shorter director.

## Recording a phone or a browser

1. Open the page on the phone (or a browser window sized like one). Turn on the hands-off mode for flawless B-roll.
2. Start on the ready screen, so the first frame shows the game's name. Play, lose, watch the punchline, tap REPLAY.
3. For trending audio, set SOUND to SFX ONLY: the game's effects stay under the track.
4. SHARE CARD saves a 1080×1920 poster for the thumbnail and copies a caption.

## Captions

Short, lower case, the hook first, one line of joke, a question that invites replies, a few tags. The post for three
of the Roadster's games:

> turned tesla's roadster into 3 retro games 🚗💨
> every crash delays production another year 💀
> 1. flappy bird but it's the roadster 🐦
> 2. tony hawk but you jump teslas 🛹
> 3. the ceiling is the road now 🙃
> which one do you like best? 👇

…and for X, one line: "turned tesla's flying roadster into retro games 🚗💨 every crash delays production another year
💀". The game's running gag makes the best second line.

## Smaller copies and looping previews

```bash
# A copy to send: same picture, about a fifth of the size
ffmpeg -i demo.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 128k -movflags +faststart demo-small.mp4

# A silent 12 s loop from 20 s in, for a website: the last 0.6 s fades into the first, 648×1152 (3× the game's pixels)
ffmpeg -ss 20 -t 12.6 -i demo.mp4 -filter_complex \
  "[0:v]split[a][b];[a]trim=0.6:12.6,setpts=PTS-STARTPTS[body];[b]trim=0:0.6,setpts=PTS-STARTPTS[head];[body][head]xfade=transition=fade:duration=0.6:offset=11.4,scale=648:1152:flags=area,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -crf 26 -preset slow -movflags +faststart preview.mp4
```

Scaling by a whole fraction of 5× (3× is 648×1152, 2× is 432×768) keeps the pixels crisp.
