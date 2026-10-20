---
name: explainer-reel
description: Make narrated explainer videos — a script or just a topic becomes a 20–90 second reel with a calm voice-over, captions that light up word by word, and glowing illustrations made of thousands of particles that fly from one subject to the next, turning 3D forms, flow fields and engraved drawings. Voices come from the user's Skillsmart credits, timed word by word. MP4 in 9:16, 4:5, 1:1 and 16:9. Use for /explainer-reel <topic or script>, faceless explainers, science, health or wellness reels, "animate this script", or a voice-over video for Reels, TikTok, Shorts or YouTube.
---

# Explainer Reel

You make a narrated explainer reel. You write one file, the reel: `build()` reads like the script, a caption per
beat and the picture each beat brings. The engine draws everything (particles, 3D forms, flow fields, engraved
lines, labels, captions, sound); you choose and place.

`<skill>` below is this skill's folder (the one this `SKILL.md` is in). Reels and renders go in the user's working
folder: `reels/<name>.js` and `out/`. Invoked as `/explainer-reel <topic or script>` in Claude Code,
`$explainer-reel <topic or script>` in Codex, or in plain words ("make an explainer reel about …").

## What you need

| Need | Why | How |
| --- | --- | --- |
| A topic or a script | the words | what the user said; with only a topic, you write the script |
| Skillsmart credits | the voice-over: 10 credits per 1,000 characters, about 2 for a 20 s reel, 9 for a minute | nothing to set up: `voice.mjs` generates through the user's Skillsmart account (`npx skillsmart@latest`; the first run may open the browser once to connect this computer). Balance: `npx --yes skillsmart@latest credits` |
| Node 18+, ffmpeg | scripts, encoding | `node -v`, `ffmpeg -version`; macOS `brew install node ffmpeg` |
| Chrome or Edge | the renderer and the checks run it headless | `CHROME_PATH` picks one; the first run installs `playwright-core` once into a cache folder |

Tell the user the voice-over's cost in credits before you make it. If a step stops with **NOT ENOUGH CREDITS**, give
the user the link from that message and run the step again once they've topped up. If they'd rather use their own
fal.ai key, prefix the voice command with `FAL_KEY=…` (an environment variable only: never write it to a file or
echo it): no credits are used then. Without credits or a key, the reel can still be made silent or with the user's
own recording (`references/voice.md`).

## 1. Script and plan

- **A script came with the request:** keep their words. Split it into beats (spoken phrases of 2–9 words), mark one
  to three key words per beat with `*…*`. Fix nothing but typos; ask before cutting for length.
- **Only a topic:** write the script. `references/script.md` has the formats and rules; `references/style.md` is the
  style itself. Read both the first time. 20–30 s is about 35–45 words at this calm pace; 60 s about 120–140.
- **Claims must be true.** Check every number, write the sources in a comment at the top of the reel, soften what's
  soft ("can", "about").

Then show, in one message: the script as beats with key words; a storyboard (one row per beat: the key subject,
whether the scene is **busy** or **empty**, what appears on the keyword); the cover (the first frame); the look and
palette with a reason (`references/looks.md`); the voice and its style direction; the format(s); and the cost in
credits. Wait for a yes unless they asked for a finished video in one go.

## 2. Voice first

The voice sets the rhythm; the pictures follow it.

```bash
node <skill>/scripts/new.mjs <name> --look halftone      # reels/<name>.js from the starter (--example moon to start from an example)
node <skill>/scripts/voice.mjs reels/<name>.js           # the voice-over and its word timing (credits)
```

Write the beats into the reel first (captions only is fine), with `voice: { voice, style }`, `{ hold }` where a line
needs air and `pause()` for silences. `voice.mjs --audition` reads the opening lines in eight voices so the user can
choose by ear (about 8–16 credits). Voices, style directions, pace, languages, recordings: `references/voice.md`.

## 3. Write the pictures

Now draw against the real timing. The API is `references/api.md`, the drawings `references/shapes.md` (and
`shapes.jpg`); `<skill>/assets/examples/` has three finished reels to borrow from (moon: a 3D Moon dissolving into a
ruler; eyes: a particle number that becomes a screen; renew: a body of particles that pours into tissues).

1. **One key subject per scene, unmistakable at thumbnail size:** the biggest, brightest, most detailed thing on
   screen (60–90 % of the width): a swarm of thousands of points (`add.swarm`), a turning 3D form (`add.shape3d`),
   an engraved drawing (`hatch`, `dots`). Never a thin icon. Labels and companions stay small at the edges.
2. **A rhythm.** Swing between **busy** scenes (swarms, flow fields, 3D, light running along paths) and **empty**,
   focused ones (one thin line, one small figure on a horizon, one number on black).
3. **Particles carry the story.** Keep one swarm through the reel and re-form it into each scene's subject
   (`.form`), scatter it (`.scatter`) or burst it; it can wait unseen inside one shape and fly out of it later.
4. **One new thing per beat, on its keyword** (`at: "word"`). Never two beats in a row with nothing new.
5. **The cover is the first frame.** Start with the subject already formed (`in: "cut"`, `at: -0.05`), dense and
   bright; end on it (a `pause()` that brings it back), so the reel loops.
6. **Show the number.** Durations become timers, amounts counters, scales rulers, change a chart.
7. **Colour is meaning.** One main tint (`ink` or `accent`), one or two meaning colours used sparingly (`alert`,
   `info`, `calm`, `life`); roles, never hex.
8. **Stay in the band.** Write in the 1080 × 1920 design frame: subject inside x 120–960, picture between y 200
   and 1300; captions and the pill are placed by the format. Text stays crisp and 20 px or more.

## 4. Check

```bash
node <skill>/scripts/check.mjs reels/<name>.js [--format 16x9]
```

It renders a still per beat into `reels/<name>-check.png` and checks the console, the pace, the length, the layout
(words off the frame, under Instagram's buttons, over the caption or each other, crossed by a drawing) and the cover
(a nearly empty first frame warns). Fix every `FAIL`, read every `warn`, then look at the sheet (it's a PNG you can
read): is each scene's subject big and clear, does it show what its caption says, is the rhythm there, does the last
frame match the first? `--at 4.2,9` shows chosen moments, `--scale 1` full size.

`node <skill>/scripts/preview.mjs reels/<name>.js` serves a live preview (scrub, beats, look and palette switchers,
safe zones) for a person to open. **No browser?** The check's PNG is the review: read it, describe it to the user, and
fix what they ask for.

## 5. Make and hand over

```bash
node <skill>/scripts/make.mjs reels/<name>.js --format 9x16        # or 4x5, 1x1, 16x9, all, or a list
```

It writes `reels/<name>.html` (the reel as one page), `out/<name>.wav` (the voice over the ambient bed, the bed
ducking under it, levelled) and `out/<name>-<format>.mp4` (H.264, 30 fps, rendered frame by frame by
`scripts/render.mjs`). `--draft` is half size and quick. A 20 s reel takes about a minute per format.

Hand over the MP4s and the check sheet, and say in a line each: the look and why, the voice and what it cost, the
formats, and anything you couldn't verify.

Changing words later: edit the beat, run `voice.mjs` again (a whole new take: the same few credits), then check and
make. Changing a `hold` or `pause()` is free.

## What goes wrong

| If you catch yourself | Do this instead |
| --- | --- |
| a key subject that's small, thin, or as plain as what's round it | make it big, dense and bright: `add.swarm`, `add.shape3d`, `hatch` |
| every scene equally busy, or equally empty | alternate: a swarm or flow field, then one thin line on black |
| a new swarm for every scene | keep one and `.form` it into the next subject |
| a cover that draws on from nothing | start formed (`in: "cut"`, `at: -0.05`) and come back to it at the end |
| every picture in the same circle, centred, the same size | change the layout; a ring only when it means something |
| a hex colour in the reel | a role (`accent`, `life`…), or `colors: {…}` at the top for a brand colour |
| times in seconds everywhere | `at: "word"`, so a real voice keeps it in sync |
| drawing the pictures before the voice exists | voice first; the rhythm decides how much fits in a beat |
| a line that needs a moment rushed by the voice | `{ hold: 0.5 }` on that beat, or `pause(0.8)` after it, then voice again (free) |
| a sentence as a label, text inside the drawing | a caption beat, or a bracketed name `[ STOMA ]` and one fact |
| a shape that reads as a blob | fewer strokes, bigger `scale`, a closed outline with `dots` or `hatch`; check it on the sheet |
| editing the engine to get a picture | compose it: `S.path`, `merge`, `place`, a generator loop; or add a shape |

## References

| File | Read it |
| --- | --- |
| `references/style.md` | the style: key subject, rhythm, cover, layouts, materials, colour, labels, motion |
| `references/script.md` | formats and rules for writing the script; the storyboard |
| `references/voice.md` | voices, style directions, cost, pace, languages, your own recording |
| `references/api.md` | every call: beats, elements, swarms, 3D, flow fields, camera, formats |
| `references/shapes.md` + `shapes.jpg` | the drawing library and how to draw your own |
| `references/looks.md` + `looks.jpg` | the eight looks, the palettes, the sound beds |
