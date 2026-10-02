# Brand method

## Adjectives → choices

| Adjectives | Palette direction | Display font | Body font |
|---|---|---|---|
| warm, crafted, honest | earthy greens, ochre, terracotta | Fraunces | Inter |
| bold, modern, confident | black, white, one electric colour | Archivo Black | Archivo |
| calm, clean, trustworthy | deep blue, sky, soft grey | Manrope 700 | Manrope |
| playful, friendly, young | candy pastels + a dark ink | Bricolage Grotesque | DM Sans |
| luxurious, refined, quiet | ink, ivory, gold or oxblood | Playfair Display | Manrope |
| technical, precise, smart | graphite, cyan, signal yellow | Space Grotesk | IBM Plex Sans |

## Building the palette

1. Primary = the brand's main personality colour (60% of usage).
2. Secondary = a supporting colour, lighter or analogous (30%).
3. Accent = a contrasting pop for buttons and highlights (10%).
4. Dark = text colour, not pure black (#1a1a1a–#222).
5. Light = background, not pure white (#f7f3ea, #fafaf9).

## WCAG contrast

Relative luminance per sRGB channel c (0–1): `c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`.
L = 0.2126 R + 0.7152 G + 0.0722 B. Ratio = (L1 + 0.05) / (L2 + 0.05) with L1 the lighter.
AA: ≥ 4.5 (body text), ≥ 3 (large text 24 px+). AAA: ≥ 7.

Compute it with a quick script rather than guessing:

```bash
node -e 'const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const [a,b]=process.argv.slice(1).map(L).sort((x,y)=>y-x);console.log(((a+.05)/(b+.05)).toFixed(1)+":1")' "#1f4d3a" "#f7f3ea"
```
