---
name: shader-hero
description: Build a landing page whose hero is a dramatic, interactive WebGL shader — liquid chrome, aurora, ink in water, glowing particles, a refracting glass lens, sculpted dunes or retro plasma — that reacts to the cursor, scroll and clicks while the headline stays readable. Use whenever someone wants a "wow" hero, an animated/interactive background, a shader or WebGL landing page, a "Stripe/Linear-style" gradient hero, or a premium launch page — even if they don't say "shader".
---

# Shader Hero

Builds a fast, accessible landing page with a full-bleed interactive shader behind the hero. The output is a plain folder (`index.html`, `styles.css`, `shader-hero.js`, `presets.js`) with no build step and no dependencies — it opens in any browser and deploys to any static host.

## What you need

Nothing beyond a browser. The user may bring: brand name, what the product does, colours or a logo, tone of voice, and a reference page they like.

## Step 1 — Brief (one short message, then decide)

Ask only what you can't infer: product name, one-line value, audience, and any brand colours. Fill gaps with sensible defaults and say what you chose.

## Step 2 — Pick a preset and palette

Read `references/art-direction.md`. Choose **one** preset that fits the brand's personality:

| Preset | Feels like | Good for |
|---|---|---|
| `aurora` | calm, premium, night sky | AI, fintech, wellness |
| `liquid-chrome` | bold, futuristic, luxurious | launches, hardware, fashion |
| `ink` | editorial, artistic, organic | studios, publishing, culture |
| `particles` | technical, cosmic, precise | dev tools, data, infra |
| `glass` | playful, tactile, modern | consumer apps, design tools |
| `dunes` | warm, natural, slow | travel, hospitality, craft |
| `plasma` | loud, retro, energetic | music, events, games |

Colours are `data-colors="background,main,highlight"`. Start from `PALETTES` in `presets.js`, then shift toward the brand. Colour 1 must also be `--bg` in `styles.css`; colour 2 is a good `--accent`.

## Step 3 — Scaffold

Copy `assets/template/` into the user's project folder (e.g. `./<brand>-site/`). Do not edit the skill's own files.

## Step 4 — Write the page

In `index.html` replace every `{{PLACEHOLDER}}`:
- `HEADLINE_HTML`: 3–7 words, one `<em>` around the accent word. `HEADLINE_PLAIN` is the same text without tags.
- `SUBHEAD`: one sentence, under 22 words, concrete benefit.
- Features (3), steps (3), CTA: short and specific to the product. No lorem ipsum, no generic "Lightning fast" filler unless true.
- Set `data-preset`, `data-colors`, and tune `data-speed` (0.5 calm – 1.5 lively), `data-intensity`, `data-interaction`.
- Fonts: pick a pairing from `references/art-direction.md`, update the Google Fonts link and `--font-display` / `--font-body`.

## Step 5 — Legibility (do not skip)

The headline must be readable over every frame of the shader:
- Dark backgrounds (`aurora`, `liquid-chrome`, `particles`, `plasma`, `glass`): light text, `--scrim` 0.3–0.5.
- Light backgrounds (`ink`, `dunes` with pale colours): set `--ink` to a near-black, `--muted` to a dark grey, `.btn--primary` to dark, and `--scrim` to 0 or use a light scrim (`rgba(255,255,255,…)`).
- Check contrast ≥ 4.5:1 for body text at the darkest and lightest points behind the text.

## Step 6 — Preview and check

Serve the folder (`python3 -m http.server 5180 -d <folder>`) and open it. Check:
1. The shader runs, follows the cursor and pulses on click.
2. Headline legible; nothing overlaps on a 375 px wide phone.
3. With "reduce motion" on, the hero shows a still frame.
4. Scroll down — the shader pauses when off-screen (CPU drops).

If you can take screenshots, capture desktop and mobile and review them yourself before showing the user.

## Step 7 — Hand over

Tell the user: which preset and colours you chose and why, how to tweak (`data-speed`, `data-intensity`, colours, `--scrim`), and that the folder deploys as-is to Netlify, Vercel, GitHub Pages or Cloudflare Pages.

## Rules

- Never load extra libraries (no three.js) — the runtime is ~5 KB on purpose.
- Keep the fallback: `.hero` has a CSS gradient for devices without WebGL.
- Don't put text inside the canvas; text stays in HTML for accessibility and SEO.
- Custom shaders: if the user wants a new effect, add a preset in `presets.js` using the same uniforms; keep loops ≤ 5 iterations of `fbm` per pixel for mobile performance.

`references/troubleshooting.md` covers black screens, banding, jank and Safari quirks.
