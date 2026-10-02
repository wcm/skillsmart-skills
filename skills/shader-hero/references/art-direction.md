# Art direction for Shader Hero

## Choosing colours

- **Three colours:** background (darkest or palest), main (the dominant colour in motion), highlight (small, bright accents).
- **Brand-first:** put the brand's primary colour in slot 2. Pick slot 3 as an analogous or complementary accent with higher lightness.
- **Avoid mud:** if slots 2 and 3 are complementary and both saturated, the mixes go grey. Lower one's saturation or move them closer on the wheel.
- **Dark heroes feel premium;** light heroes feel editorial. Match the brand.

## Font pairings (Google Fonts)

| Mood | Display | Body |
|---|---|---|
| Elegant / editorial | Instrument Serif | Inter |
| Modern premium | Fraunces (opsz, soft) | Inter |
| Tech / precise | Space Grotesk | IBM Plex Sans |
| Bold / loud | Archivo Black | Archivo |
| Friendly / rounded | Bricolage Grotesque | DM Sans |
| Luxury / fashion | Playfair Display | Manrope |

Display sizes: hero `clamp(48px, 9vw, 128px)`, tight leading (0.95), slight negative tracking.

## Copy

- Headline: a promise or a vivid image, not a feature list. "Money that moves at the speed of thought", not "Fast payments platform".
- One accent word in `<em>`: the emotional word.
- Sub-headline: who it's for + what changes for them.

## Tuning motion

| Attribute | Calm | Default | Lively |
|---|---|---|---|
| `data-speed` | 0.5 | 1 | 1.5 |
| `data-intensity` | 0.6 | 1 | 1.6 |
| `data-interaction` | 0.4 | 1 | 1.5 |

Luxury and wellness brands want calm; events and games want lively.
