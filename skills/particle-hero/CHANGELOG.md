# Changelog

## 1.1.0 — 2026-11-09

- Deeper point clouds that turn toward the cursor. The subject turns toward the pointer, measured from its own centre (about 20° side to side and 12° up and down), follows in two soft stages and eases back when the pointer leaves or a finger lifts. New options `tilt` and `lens` (a wider view, so near parts grow as they turn), and the drift calms while a hand is on the page.
- More depth: `relief` 1.1 by default, and 1.35 / 0.75 / 1.0 / 0.8 on the dust, ink, neon and print looks and their example pages.
- Clean depth edges: each grain reads the depth at its own point, so steep drops are smooth instead of parting into lines, and grains on a sudden step fade as the subject turns (`steps`: on dark they read as shadow; on paper they stay as a veil).

## 1.0.0 — 2026-11-08

- First release: a hero made of particles. Subjects become grains in a GPU simulation, with swarm, mist and melt changes (melts pair grains by an approximate optimal transport), a natural hand through the grains, and four looks (dust, ink, neon, print).
- Tools: subjects through Skillsmart credits (nano-banana-pro, birefnet-image), depth maps made locally with Depth Anything V2 Small, and a headless check with contact sheets.
- Four example pages: Fauna Borealis, Herbier, Afterglow and Stride.
