# Changelog

## 1.1.0 — 2026-10-18
- No pauses between scenes: the product starts to move on the first scroll, the labels leave as soon as the last one is
  in, and the scroll ends as the second scene's words arrive. The page is 700% of the window tall instead of 880%, so
  every move keeps its pace. `window.explode.timeline` exposes the timeline, and `check.mjs` reads its moments from it.
- A fifth reference page, *Caffè Riva* (a stovetop moka pot, from a sunlit Italian kitchen to a lake at dawn), built
  with the skill itself: `new_project.py … --from moka`.
- Five preview clips, about 10 seconds each, with no pauses.

## 1.0.0 — 2026-10-18
- First release on Skillsmart (developed as Éclaté): a scroll page in three scenes, from a real photo through an
  exploded view with a label on every part to a second photo at a new angle, all generated with Skillsmart credits.
  Photos and cut-outs lined up through one stage-to-screen transform so every hand-off is invisible; cut-outs by SAM 3
  and BiRefNet with a detach and an erase fallback; four labs (ticket, sound, motion, energy); four reference pages
  (burger, headphones, running shoe, prefab cabin); a scaffold, a label-dot check and a headless check.
