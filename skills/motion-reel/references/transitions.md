# The transitions

Generated from `assets/engine/transitions.js` by the project's `scripts/docs.mjs`.

Bobine transitions: the joins between scenes, as a library.

A scene takes one as its out (it plays over the scene's last beats, onto the next scene frozen
at its first frame) or its in (over its first beats, from the scene before frozen at its last
frame). Either way a transition gets k (0 → 1 through it), its options o and X: the outgoing
picture A and the incoming B (X.picA(), X.picB() paint them into layers), the scenes X.a and
X.b, their anchors (X.anchorA(), X.anchorB(): the dot each one hands on, [x, y, r]), and the
clock X.t. Every one is a pure function of k, so it seeks, blurs and loops like the scenes.

  { type, beats, ease, … }    beats: how long it runs (0.5 by default), in the scene's beats

  zoom     dive into A's anchor until it fills the frame, B waiting inside it (hole: "dot" the
           anchor's dot, "none" a cross-fade near the end, or a shape spec); ratio, spin (deg),
           blur. B's own anchor lands where A's was, so zooms chain scene into scene.
  punch    a smash cut that hits: B (in) slams in oversized and springs back, with shake and a
           flash; as an out, A rushes at the camera for the last moment, then the cut.
  whip     a whip pan: both pictures fly along dir, streaked; tilt rolls the camera (deg).
  shatter  A breaks into shards round its anchor (or at) that crack, then fly and fall, B
           behind; pieces, power, gravity, spin.
  slice    B arrives in bands from alternate sides over A, streaked; bands, stagger.
  spin     A spins away (turns, scale), B spins in the other way, a flash at the swap.
  flood    B floods out of A's anchor inside a wobbling blob with an accent edge (color).
  shape    an iris through a shape spec (shape, default star-5) that turns as it grows.
  pixel    A breaks into blocks up to size px, B resolves out of them.
  burn     A burns out to white (color), B develops out of it.

## Drawn by the engine itself

  smear    (out) the scene slides away along dir, streaked, over the next scene's ground; (in) it slides in
  iris     (out) the next scene opens out of the scene's anchor (its dot) as a growing circle: the end
           card's default, which is how a reel loops through the dot
  wipe     (out) the next scene wipes across at an angle (dir)
  cut      no transition (the default): a hard cut on the beat. With energy, a hard cut is a hit.

## Using them

- A transition is one scene's `out` (it plays over that scene's last beats, onto the next scene frozen at its
  first frame) or the next scene's `in` (over its first beats, from the scene before frozen at its last frame).
  Give a cut one or the other, not both.
- Any scene may follow any other: the transition carries the hand-off. Scenes that end on a dot (most do) hand it
  on to zoom, iris, flood and shape, which open from the anchor.
- Two or three kinds per reel, repeated, read as a style: Entropy breaks (shatter, slice, pixel, burn), Infinity
  dives (zoom, every cut), Gravity falls (whip down).
- The loop: the last scene's `out` opens onto the first scene's first frame (iris, zoom, whip and the rest all
  do), or a rewind lands on it.
