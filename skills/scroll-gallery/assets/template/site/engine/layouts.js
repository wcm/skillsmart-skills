// The six layouts and their sixteen variants. A scene in page.json names one: { "layout": "ring", "look": "arc" }.
// make(cfg, page, set) → a layout, where cfg is the scene from page.json and set its pictures: { n, k (item numbers),
// items, aspect, colors, looks }. A layout is {
//   hold            how long it stays, in screen heights of scroll
//   view(t, ctx)    where its camera stands and looks: { p, at, fov, dof } (dof: how soft things away from focus go)
//   setup(ctx)      recompute what depends on the screen;  prepare(t, ctx)   once a frame, before pose()
//   pose(b, t, ctx, o)   the card in place b (0…n−1) at t, 0–1 through the layout's stretch, into o (a Pose)
//   slots           (optional) its own list of item numbers, one per place, when it isn't one per picture (the cube)
//   enter(b, e, ctx, o), exit(b, x, ctx, o)   how a card arrives (e: 0 → 1) or leaves (x: 0 → 1) on its own, changing
//                   o, its pose at rest, in place. Cards that stay from one scene to the next fly between the two instead.
//   enterT(e), exitT(x)   for layouts that move by themselves: the t to pose at while arriving or leaving
//   pivot(t, ctx)   the middle of its shape, for a reshape (cards swing round it instead of flying straight)
//   hero(t, ctx)    the place in front (the label on the record, the glow behind the pictures)
//   focus(b, ctx)   { t, spin } that brings place b into view (t null: leave the scroll where it is), or null
//   floor(t, ctx)   { y, s, f } a floor the cards reflect in;  surface(ctx), titleAt(ctx)   where a photo or the title lies
//   fold, cover     the tiles fold into the book's cover;  controls, switches   switches shown while it is on screen
//   turnable, spin  dragging turns it;  hoverPull   how far a picture comes toward you when you point at it
//   props           scenery of its own: build(group, ctx, look), update(w, t, ctx); self.phase = { e, x }
// }
import { table, board } from "./layouts/pile.js";
import { arc, band, surround, platter, wheel } from "./layouts/ring.js";
import { stack, slabs, sweep, ribbon, trail } from "./layouts/deck.js";
import { dive } from "./layouts/sphere.js";
import { pages } from "./layouts/book.js";
import { tiles, cube } from "./layouts/mosaic.js";

export * from "./layouts/common.js";
export const LAYOUTS = {
  pile: { table, board },
  ring: { arc, band, surround, platter, wheel },
  deck: { stack, slabs, sweep, ribbon, trail },
  sphere: { dive },
  book: { pages },
  mosaic: { tiles, cube },
};
