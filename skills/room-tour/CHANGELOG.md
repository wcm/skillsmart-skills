# Changelog

## 1.1.0 — 2026-11-06

- Moves are made with MiniMax H3 Max Turbo at 1080p, the model behind the Tembusu and Teluk Senja walks, instead of
  Kling v3 Pro: 11 credits a second instead of 15, so a three-stop page is about 500 credits.
- H3 takes no negative prompt: what must stay still is said in the prompt, and `{move}` now also keeps the walls, the
  furniture and the sky still. A walk file's `negative` and `cfg` are no longer used.
- A take's contact sheet no longer fails when the clip's file runs past its last frame, as H3's do.

## 1.0.0 — 2026-11-06

- First release: a scroll-driven walk through a place on a shared engine, with stops, one video move between each pair,
  a title that reads first, captions, a rail, a map with a red rippling you-are-here marker, hotspots, tracked tags,
  cards, a cut between far rooms, an artwork layer with lift, a fluid-outline cursor beside the visitor's own, and a
  recording mode.
- Tools: pictures and moves through Skillsmart credits (nano-banana-pro, kling-v3-pro), cut-outs (sam-3), frames,
  stop grids, a headless check and a video; optional OpenCV tools for tracked tags and exact artworks.
- Four example pages: Tembusu, Teluk Senja, ondo and Shedlight.
