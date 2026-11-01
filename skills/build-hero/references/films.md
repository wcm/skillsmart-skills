# Making the film

The film runs through a chain of pictures of one place. All of them are edits of the finished picture, so they agree;
the segments between them each do one job.

```
start ──segment──> keyframe ──segment──> keyframe ──segment──> end
(re-shoot of staged)   (edit of end)        (edit of end)      (finished)
```

## The chain for a building

From Tidelight (`tools/scenes/_tidelight.json`), which went wrong in every way below before it went right:

| Picture | How it's made | What matters |
|---|---|---|
| `end` | from a prompt | The whole subject in frame, off centre, calm space for words. Generic place: "no famous landmarks and no recognisable skyline" |
| `staged` | edit of `end` | Only the foundation stands, **as large as the building's own footprint, not wider** (a wide slab turns into a building that shrinks) |
| `start` | `staged` re-shot | A truly different position: "high above the river, turned thirty degrees, tilted down at fifty degrees" |
| `half-end` | edit of `end`, seeing `staged` | The building half up, what's above it not there yet. Stop well below any distinctive feature (a sky garden), or it can't be built in place |
| `half` | ×1.3 crop of `half-end` | The camera pulls back from here |
| `topped-end` | edit of `end`, seeing `staged` | Only used for its unfinished ground floor: edits change heights, so don't trust its tower |
| `topped-fit` | `paste`: `end` with `topped-end`'s ground floor | The tower exactly as in `end`, so nothing stretches in the last segment |
| `topped` | ×1.12 crop framed so the roof is **just out of the frame** | The crane climbs out of the top in the segment before; it's never taken down on screen |

## The chain for a room (a time-lapse)

From Cerise (`tools/scenes/_cerise.json`):

| Picture | How it's made | What matters |
|---|---|---|
| `end` | from a prompt | The finished room from the head of the table |
| `tables-end`, `flowers-end` | edits of `end` | One stage each, with what's waiting elsewhere in the room |
| `tables-fit` | `paste` | The chair stacks and crates **exactly where they are in the next keyframe**. Where two keyframes disagree the film dissolves one into the other, with nobody touching them |
| `bare-end`, `start` | edit, then re-shot from a corner | The tables already standing. Every take that had to unfold them from a pile invented black tables and slid the pile by itself |

Each segment's prompt says it's a time-lapse and who does what:

> A real time-lapse … filmed on a motorised camera slider that glides smoothly the whole time. Time runs fast: the crew
> show only as soft, see-through, motion-blurred streaks that flicker in and out, never sharp and never standing still;
> anyone who passes near the camera is blurred into a faint transparent streak. … Every change is made by the crew;
> nothing moves, slides or grows by itself.

## Writing a segment's prompt

- Start with "One continuous, unbroken shot" and the camera's move: where it starts, what it does, where it ends.
- Then the one job, in order, in the words a builder would use.
- Say what doesn't change: "floors already built never move", "the footprint never changes size or shape: it only grows
  taller", "the river, the city and the light stay the same".
- Use the `negative` for what went wrong: "a base that shrinks", "a tower that leans", "objects flying", "linen spreading over the floor".
- 3 to 5 s per job. Longer takes wander.

## What to look for in a take

Look at a 30-frame sheet of every take, and pull full frames where something looks off:

| You see | It means | Do |
|---|---|---|
| A feature appears low and slides up; floors push in underneath | one job too many, or a keyframe set above that feature | Split the segment; re-cut the keyframe lower |
| A roof goes on early and rises | same | Same |
| The base gets narrower | the foundation was wider than the building | Redo `staged` |
| Something changes size, or a floor count jumps, where it shouldn't | two keyframes disagree | `paste` so they match, then re-roll |
| A ghost dissolve: a thing fades in through another | the model has no way to build it | Shorter, simpler job; or let it enter from out of frame |
| A crane melts | it's being removed on screen | Let it climb out of the frame |
| Big sharp people right in front of the lens | a crew working at the camera's end of the room | Choose a take without them; ask for faint streaks near the camera |
| Only a zoom | keyframes in the same direction | Make the first segment a real move: a re-shot start |

A soft kink where two segments join is normal, and scroll-driven pages hide most of it. Choose takes whose camera is still
moving the same way across the join.

An ending that orbits as well as pulls back is tempting, but re-shot end pictures tend to make a wide base appear and then
shrink. A strong move in the first segment followed by a steady pull-back reads well.

## The evening

`dusk` is an edit of the film's last frame: only the light changes, every light off (name them). `lit` is an edit of
`dusk`: name each light and how it falls. `align.mjs` fits both to the frame. A lamp already lit at dusk spoils the moment:
redo the picture with `--fix "the promenade lamps are off"`.

## Pictures that aren't in the film

Name any other stills (an interior, a detail) under `shots` and `web` in the scene file. Their view should match the place in the film.
