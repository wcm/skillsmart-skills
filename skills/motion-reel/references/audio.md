# Sound

The video loops, so the sound must too. Every soundtrack `make.mjs` lays on is exactly one loop
long, to the sample (frames ÷ fps), with no fade, so the sound wraps with the picture.

## The generated track (the default)

`make.mjs` writes `out/<name>.wav` from the reel itself, in code (no samples, nothing to license):
four on the floor at the reel's tempo, offbeat hats, a clap on 2 and 4, a bass on the offbeats, chord
stabs and a pad through a four-chord loop in the reel's key, a tick on every cut, a fill into the
last scene and a quieter breakdown under it, and a swell that lands on the first beat as the reel
wraps (with a crash). Tails of the last notes are folded onto the start: no click, no gap.

```js
Reel.make({ …, bpm: 120, music: { key: "E", mood: "minor" } })   // key A–G#, mood minor | major
```

- **A rewind** scene plays the track itself backwards at the picture's speed: it slows to a stop,
  runs back faster and faster (darker and hissier with speed, as tape does) and brakes into the
  first beat.
- **`music.shepard`** (1 is moderate, 1.6 clear) adds a Shepard tone, a pitch that seems to rise for
  ever; it climbs a whole number of octaves per loop, so it wraps seamlessly.

`node <skill>/scripts/audio.mjs reel.js` writes just the track; `--key D --mood major` overrides.

It is a bed, not a song. For a post that matters, their own track is better.

## Their track

1. `node <skill>/scripts/tempo.mjs song.mp3` prints the tempo and the beat times.
2. Set the reel's `bpm` to that tempo (decimals are fine).
3. Pick where the loop starts: a downbeat, usually a few bars in where the track is full.
4. `node <skill>/scripts/make.mjs reel.js --audio song.mp3 --at 31.42` cuts one loop from there and
   cross-fades the bar after the loop into its head, so the wrap continues the music.

Rights are the user's business; say so if they hand you a commercial track. On Instagram and TikTok
they can also post the reel silent and add a track from the app's library: set the reel's `bpm` to
that track's tempo so the cuts still land.

## Silent

`make.mjs reel.js --audio none`.
