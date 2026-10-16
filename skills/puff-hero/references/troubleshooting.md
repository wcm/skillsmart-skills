# Troubleshooting

What has gone wrong before, and what fixed it.

## Stills

| Symptom | Fix |
|---|---|
| A neat bubble font in tidy rows | Variance: take three more. Check the shared `deform` line wasn't edited (it is what moves the model off a font). Stronger adjectives don't help |
| Letters stand on a floor, flat bottoms, a shadow under them | The `frame` line was edited or dropped: restore "floating in mid-air… no floor… no shadow falling on the backdrop… its bottom as round as its top" |
| A letter cut off by the frame | Restore "clear empty space on every side; nothing touches an edge"; or the ratio is too narrow for the words: pick a wider one |
| Stripes, marbling, seams, crimps, a balloon knot | The material sentence needs its "must not" clause: "one perfectly even pink with no marbling, no swirls, no stripes…", "one continuous skin with no seams or crimps" |
| Hard to read | Lines too long or too many. Shorten to 2–6 letters a line, at most 3 lines; move words into the HTML copy |
| Misspelled letters | Quote the letters exactly in `words`; take more; fewer letters a line |
| A refusal | Usually a real brand's logo or a trademarked character in the words. Use the user's own words |

## Loops

| Symptom | Fix |
|---|---|
| It barely moves (moves under ~3%) | Gentle words in the motion ("softly", "breathes"). Use the pop template, or one strong shared action ("…again and again…"), and "lively, snappy" |
| Only one letter moves | A per-letter action ("each letter in turn"). Describe one action for the whole cluster, letters in their places |
| The letters drop and land | A bounce implies a floor. "Float in mid-air", and "falling, landing, hitting the ground" in the negatives |
| It squeezes in or wrinkles (size well under 100%) | Don't ask for a size change or name it ("never squeezes" invites it). The swell is the page's code pop. Take another, or accept it if it looks good (a satin squeeze was liked) |
| Too much: bouncing around | Ask for an active pop and small rebounds, not squash-and-stretch bounces |
| A jump where the loop restarts | The start/end pin didn't hold this time. Take another |
| A letter morphs or swaps | Already in the negatives; take another |

## Matte and encode

| Symptom | Fix |
|---|---|
| "the matte kept the backdrop on N frames" | Set the page's `"matte"` to the other variant (`"matting"` ↔ `"heavy"`) and run `--from matte` (8–10 credits) |
| A halo or rim on the page | The backdrop wasn't the page colour: reshoot on the page colour, or bring `--bg` closer to the backdrop |
| Fur edges chopped | `"matte": "matting"` |
| Safari shows a still, no loop | `puff.mov` is missing: it is encoded only on macOS (VideoToolbox). Run `video.mjs <id> --from encode` on a Mac |
| Encoding takes forever | VP9 at its default speed. The template uses `-cpu-used 4`; check it wasn't removed |

## Page and preview

| Symptom | Fix |
|---|---|
| The letters look frozen in a preview pane or background tab | Browsers pause video and animation frames in hidden tabs. Check in a visible window, or with `check.mjs` (headless runs normally) |
| Edits don't show | The static server caches: hard-reload (Cmd/Ctrl+Shift+R) |
| `Address already in use` | A server is already running on that port: open it, or pick another port |
| The loop plays when the cursor is on empty space | The hit test reads `puff.webp`'s alpha: make sure it is the cut-out first frame `video.mjs` wrote |
| The background covers the copy | Pass the copy's boxes as `keepOut`, or add `.backed` to the copy |
| `check.mjs` can't start a browser | It drives an installed Chrome or Edge; install one, or `npx playwright install chromium` |
