---
name: brand-board
description: Create a one-page brand board from a name and a few adjectives — wordmark and monogram, a 5-colour palette with accessibility contrast checks, a display/body font pairing with type scale, voice principles and do/don't usage — exported as PNG plus reusable CSS design tokens. Use for "brand identity", "style guide", "mood/brand board", "pick colours and fonts for my brand", or starting a new project's visual identity.
---

# Brand Board

Output: `board.html` (editable), `out/brand-board.png` (1600×1000 @2×) and `tokens.css` with the palette and fonts as CSS variables.

## Steps

1. **Brief.** Get the brand name, what it does, audience, and 3 adjectives (e.g. "warm, crafted, trustworthy"). If the user has existing colours or a logo, keep them.
2. **Copy** `assets/template/board.html` and `scripts/render.mjs` into `./brand-<name>/`.
3. **Decide the system** with `references/brand-method.md`:
   - Palette: primary, secondary, accent, dark, light. Name each colour (e.g. "Forest", "Saffron").
   - **Compute contrast** for each swatch's text colour (WCAG formula in the reference) and write the ratio + AA/AAA in `{{AA_n}}` (e.g. "8.9:1 AAA"). Adjust colours until text-on-colour pairs used in the board pass AA (4.5:1).
   - Fonts: one display + one body pairing from Google Fonts, matched to the adjectives. Update the `<link>` and `--display` / `--body`.
   - Wordmark: the brand name set in the display font; use `<em>` for a stylistic twist only if it adds meaning. Monogram: 1–2 letters.
   - Voice: 3 short principles ("Plain words, warm tone", …).
4. **Fill** every `{{PLACEHOLDER}}` and the CSS variables.
5. **Export:** `npm i --no-save playwright-core && node render.mjs png board.html --selector .board --scale 2 --out out`
6. **Review the PNG yourself**: nothing overflowing, wordmark fits its cell, ratios correct.
7. **Write `tokens.css`** next to the board:
   ```css
   :root { --color-primary: …; --color-secondary: …; --color-accent: …; --color-text: …; --color-bg: …;
           --font-display: "…", serif; --font-body: "…", sans-serif; }
   ```
8. **Hand over:** show the board, explain each choice in one line, and offer one alternative direction.

## Rules

- No trademark lookalikes: don't imitate a famous brand's wordmark or palette.
- The board is a starting point, not a full logo design; say so if the user expects a logo mark.
