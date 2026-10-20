# Voice

The voice-over sets the rhythm. Make it before the pictures: the reel's beats and every `at: "word"` cue take their
times from it, so the drawings land where the voice says the word.

## How it's made

`node <skill>/scripts/voice.mjs reels/<name>.js` sends the whole script to Skillsmart in one request. One of
Gemini's voices reads it in a single take (so the intonation runs on from line to line), with the reel's style
direction, and Whisper times every word of that take. The script then cuts the take between lines by those word
times and lays it out again: the voice's own pauses kept, at least a breath after a sentence, plus every `hold` and
`pause()`, so the pictures line up. It writes `<name>.vo.wav` and `<name>.timing.json` next to the reel; preview,
check and make pick them up.

It's paid with the user's Skillsmart credits (no API key). The first run may open the browser once to connect the
computer; `npx --yes skillsmart@latest credits` shows the balance. With `FAL_KEY=…` set on the command (an
environment variable only: never write it to a file or echo it), it uses the user's own fal.ai key and no credits.

## Cost

10 credits per 1,000 characters of script, at least 1 a take. Speech runs about 12–14 characters a second.

| Reel | Characters | Credits |
| --- | --- | --- |
| 20 s | about 200–250 | 2–3 |
| 60 s | about 750–850 | 8–9 |
| 90 s | about 1,100–1,300 | 11–13 |
| an audition of 8 voices | the opening lines, 8 times | 8–16 |

Tell the user the cost before each voicing. Takes are cached next to the reel by the exact text and settings, so a
re-run with nothing changed costs nothing, and changing a `hold` or `pause()` is free (the cached take is laid out
again). Changing any word, the punctuation, the voice or the style reads the whole script again (the same few
credits). Failed requests aren't charged.

If a step stops with **NOT ENOUGH CREDITS**, give the user the link from that message; when they've topped up, run
the same step again.

## Choosing the voice

| Feeling | Voices (Google's description) |
| --- | --- |
| intimate, calm, soothing (wellness, sleep, the body, wonder) | **Callirrhoe** (easy-going; the default), Achernar (soft), Vindemiatrix (gentle), Sulafat (warm), Despina (smooth) |
| bright, young, curious (habits, learning, tips) | Leda (youthful), Aoede (breezy), Autonoe (bright), Laomedeia (upbeat), Erinome (clear) |
| clear, informative, deeper (science, money, how things work) | Charon (informative), Iapetus (clear), Algieba (smooth), Schedar (even), Sadaltager (knowledgeable), Gacrux (mature) |
| warm, friendly, casual (stories, everyday life) | Achird (friendly), Umbriel (easy-going), Zubenelgenubi (casual), Puck (upbeat) |

The rest: Algenib (gravelly), Alnilam (firm), Enceladus (breathy), Fenrir (excitable), Kore (firm), Orus (firm),
Pulcherrima (forward), Rasalgethi (informative), Sadachbia (lively), Zephyr (bright).

To let the user choose by ear: `voice.mjs reels/<name>.js --audition` reads the opening lines in eight gentle voices
into `<name>-voices.wav` (pass `--voices Charon,Iapetus,…` for others, `--line "…"` for other words). Keep the
choice in the reel: `voice: { voice: "Callirrhoe", style: "…" }`.

## The style direction

`style` tells the voice how to read: pace, closeness, mood. It isn't billed. It does more than the voice name, so
write it for the reel:

- **Intimate:** "A gentle young woman, speaking slowly and softly, close to the microphone: relaxed, warm and intimate,
  like quietly telling one person a calm story at night. A soft, low, rounded pitch, never high or sharp. Unhurried,
  with natural pauses between sentences. Clear spoken voice, not a whisper."
- **Bright explainer:** "Friendly and bright, a little quicker, smiling, like a favourite teacher sharing a surprising
  fact. Clear and crisp."
- **Documentary:** "Measured and warm, like a nature documentary narrator. Unhurried, with weight on the numbers."

Avoid asking for a whisper: whispered takes come back breathy and hard to follow.

## Pace and pauses

`voice.mjs` prints the words a minute while speaking. 110–170 suits these reels; over 190 feels rushed. Slow it with
the style ("slowly", "unhurried"), give a line air with `{ hold: 0.6 }` on its beat, or a silence with pictures with
`pause(1.2)`. A beat can say something other than its caption with `{ say: "…" }` (numbers as words, an abbreviation
spelled out); its words still match by their alignment.

## Languages

Gemini's voices read most languages; write the script in that language and set `voice: { language: "es" }` (a
two-letter code) so the word timing knows it.

## Your own recording, or no voice yet

- **Your recording:** `voice.mjs reels/<name>.js --audio take.wav` splits it at its pauses (leave a clear pause
  between lines); `--words words.json` (a list of `{ word, start, end }`, e.g. from Whisper) times every word exactly.
  It's levelled and laid out like a take, holds and pauses added on top. A plain re-run re-lays it for free.
- **A free system voice** (`--provider say` on macOS, `--provider espeak` on Linux) reads line by line, words spread by
  syllables: fine for checking timing before spending credits, not for publishing.
- **No voice:** skip this step. The reel runs on estimated timing (~170 words a minute) and can be voiced later
  without touching its code.
