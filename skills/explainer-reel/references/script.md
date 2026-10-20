# Script and storyboard

## Their script, or yours

- **They gave a script:** keep their words. Your job is to split it into beats (spoken phrases of 2–9 words,
  breaking where a voice would breathe), mark one to three key words per beat with `*…*`, and add the list
  beats ("*One.*") if it is a list. Fix nothing but obvious typos; ask before cutting anything for length.
- **They gave a topic:** write it. Pick a format below, write it out loud (read it at speaking pace: 60 s is
  about 150–170 words), then show it with the plan before you build (see SKILL.md).

## Formats that work

| Format | Shape | Pictures | Example |
| --- | --- | --- | --- |
| **List** | hook with a number → N items, each "*One.*" + 2–4 lines → turn → ask → loop | the number, then one picture per item; progress dots | "5 tiny habits that calm your nervous system" |
| **Ritual** | the promise → the rule → steps in time order (Tonight… Tomorrow… After lunch…) → proof → ask | a clock or a path in time | "Say this before you sleep" |
| **How it works** | the question → the parts, one per line → the trick → the payoff in one line | the thing, big and labelled; a lens for the detail | "How noise-cancelling headphones work" |
| **Number reveal** | a small input → the time or rate → the big result (count it up) → what it's made of → the lesson | the number, then the chart | "What $100 a month becomes" |
| **Myth / truth** | the belief → why it's wrong (one mechanism) → what's true → what to do | a pair: the belief beside the truth | "You don't need 8 glasses of water" |
| **Before / after** | the old state → the switch → the new state → how to get there | two figures side by side (the second in `accent`) | "Your future self is already deciding" |

## Writing rules

1. **The hook is a promise with a number or a stake**, under 1.5 s: "*8* weird habits…", "Do you want *proof*…?".
2. **Second person, present tense, concrete.** "Hum for 30 seconds", not "humming can be beneficial".
3. **One idea per line.** If a line needs two pictures, it's two lines.
4. **Every line earns a picture.** Write the picture next to the line as you go (the storyboard below). A line
   you can't draw is a line to cut or rewrite.
5. **Numbers are gifts**: durations, counts, rates, prices. They become timers, counters and charts.
6. **Name things** the drawing can label: the vagus nerve, the cochlea, the chip, the balance.
7. **The turn** ("But here's the part nobody tells you…") two-thirds of the way through earns the ending.
8. **The ask is one action**: save, comment a word, follow. With "comment WORD", the pill reads `COMMENT WORD` and
   swaps to `✓ ON ITS WAY` when the voice promises to send it.
9. **Claims must be true.** Health, money and science reels get checked numbers (show the working in a comment
   at the top of the reel file, as every reel in `assets/examples/` does). Soften what's soft ("can", "helps"); never invent studies.

## Storyboard: one row per beat

Before writing code, write the table. It is the reel; the code is a transcription.

| # | Caption (with `*bold*`) | On the keyword | What appears / changes | Layout |
| --- | --- | --- | --- | --- |
| 1 | `*5* tiny habits` | — | a big dotted "5" draws on | type |
| 2 | `that *reset* your *nervous system.*` | reset / nervous | 5 morphs into the bust; its nerves light up | object |
| 3 | `*One.*` | — | dot 1 fills | object |
| 4 | `Breathe out *longer* than you breathe in.` | longer | lungs with a dot fill; breath chart draws under them | object + chart |
| … | | | | |
| n | `Save this for your next *hard day.*` | Save / day | pill; swaps to Saved | object |
| — | (pause 2 s) | | back to the dotted "5" | type |

Check the table before you build:
- every row has something in *What appears*, and no row has more than two things;
- the layout changes every few rows, and a motif carries across;
- colours follow their roles (`references/style.md`), one accent at a time;
- each new picture clears the last (`clear({ keep: [motif] })`) and the last row returns to the first frame.

## Timing

Write the reel against estimated timing (about 170 words a minute, with pauses at punctuation); every `at`
names a word, so the same file stays in sync when a real voice-over replaces the estimate. Add `{ hold: 0.3 }`
to a beat that needs a moment after it ("*One.*", a big number); `pause(sec)` is silence with pictures (the
loop home, a reveal).
