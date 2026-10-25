# Changelog

## 1.3.1 — 2026-10-25
- The rebuild plays on a first visit over a slow connection. Both clips' frames now load together, coarse to fine
  (every eighth frame of each, then every fourth, and so on), eight at a time, and the frame the page needs next jumps
  the queue. Before, clip b waited for all of clip a, so on a phone the product could stay exploded through the
  rebuild. On a 9 Mbps first visit, someone scrolling at a steady pace now reaches the rebuild with 61 of its 121
  frames instead of 1.
- A frame that arrives repaints the page when it's nearer the one being shown, so someone who stops mid-clip sees it
  fill in without scrolling again.
- Pages built with an earlier version: copy `frames.js` and `explode.js` from `assets/template/site/engine/` into the
  project's `site/engine/`.

## 1.3.0 — 2026-10-19
- The last scene's words fade in and rise a little again, with the gradient behind them, and they're in as the product
  closes up instead of after the clip. The page still ends on a short stop on that finished scene (700% tall again).
- Phones load their own frames: sized from the page's layout so they look as sharp on a phone as the full ones on a
  retina laptop, about 40% fewer bytes. Every frame also sheds the faint alpha that cost bytes without showing (the
  full frames are about 7% lighter).
- Five preview clips that open and close on a short still moment.

## 1.2.0 — 2026-10-18
- The last scene's words scroll up into place from below the window instead of fading in, and the page ends on a
  short stop on that finished scene (the last 5% of the scroll; the page is 740% of the window tall to keep the pace).
- The scene rail at the bottom left is optional (`steps` in page.json); the reference pages leave it out.
- Cleaner cut-outs. `patch1`/`patch2`: polygons around something in front of the product (a stand's cradle under a
  headband), where the cut-out takes the detach edit, which painted in what the thing hid. `dropx`: points on a part
  the exploded view shouldn't have, painted out of the picture before the clips. `specks`: clears small drops or crumbs
  that flash in the clips. A detach edit is reused while nothing it depends on changed.
- Reference pages: the burger's sauce drops no longer flash, and the headphones leave their stand's cradle behind and
  come apart without the extra band it had turned into (new clips).

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
