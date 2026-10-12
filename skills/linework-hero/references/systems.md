# Draw my system

A system is a list of nodes on a grid and the links between them. `LW.system(spec)` turns it into a figure:
isometric parts from the kit, links that route themselves and carry packets, labels that are real text, and an
answer that already does hover, click-to-open, steps and focus. You add only what is particular to this system.

```js
{
  linework(LW.system({
    name: "pipeline",
    means: "One sentence for screen readers.",
    look: "cobalt",
    rest: "dashboard",                 // what is lit when nothing else is
    frame: [300, 214],                 // optional: the drawing's box in the 400 × 320 view; smaller leaves room for labels
    nodes: [
      { id: "web", kind: "laptop", at: [0, 1.35], label: "Web app", sub: "beacon API", step: 0, platform: 15, dx: -24, dy: -8 },
      …
    ],
    links: [{ from: "web", to: "collector", via: "y", packets: 2 }, …],
    draw(s, ctx) {},                   // optional: extra parts
    answer(input, ctx) {},             // optional: page actions; return a string to override the read-out
  }));
}
```

## Nodes

| Field | Meaning |
| --- | --- |
| `id` | unique; it is the node's `pick`, so `input.hit`, `onpick` and `focus` use it |
| `kind` | from the kit below |
| `at` | `[gx, gy]` on the grid; one cell is 40 world units. +gx runs down-right, +gy down-left. Fractions are fine |
| `label`, `sub` | the name and one fact (`"Collector"`, `"12k events/s"`) |
| `dx`, `dy` | where the label sits from the node's top, in view units; default `0, -24` (straight up). Point labels outward from the diagram |
| `step` | when it appears, if the page builds the system in steps |
| `platform` | `true` or a radius: a round plinth under the node |
| kind options | `h`, `units` (server), `R`, `disks` (database), `len` (queue), `layers: ["TLS", "Auth", …]` (stack), `bars` (screen), `w` |

## The kit

| Kind | Looks like | Use for |
| --- | --- | --- |
| `server` | a rack with unit slots and lights | services, compute, workers |
| `database` | stacked disks; click to separate them | databases, warehouses, any store with layers |
| `queue` | a belt with cards riding on it | streams, queues, buses |
| `gateway` | an arch | ingress, collectors, firewalls, intake |
| `stack` | plates with named layers; click to open | gateways, middleware, protocol layers |
| `laptop`, `phone` | the devices | clients, apps, users' machines |
| `screen` | a monitor with a bar chart | dashboards, BI, admin |
| `cache` | two short disks and a bolt | caches |
| `lake` | an open basin of water | object storage, data lakes, buckets |
| `vault` | a safe with a round door | archives, secrets, backups |
| `person` | a figure | people, roles, teams |
| `block` | a thick slab with a seal | ledger entries, records, blocks; `seal` lights it |
| `globe` | a sphere with meridians | edge, CDN, regions, the internet |
| `chip` | a die on a board | hardware, models, accelerators |
| `function` | a cube with a prompt | serverless functions, jobs, scripts |
| `rack` | shelving with boxes on three levels | warehouses, inventory, fulfilment |
| `scanner` | an arch over a belt, with a scan curtain | sorters, scanners, checkpoints |
| `truck`, `van` | a box truck, a delivery van | linehaul, last mile, fleets |
| `house`, `shed` | a house with a hip roof; a hub with roll-up doors | homes, customers, hubs, depots, stores |

A new kind is a function in your file: `LW.kit.printer = (g, cx, cy, b, o, s, back) => { g.box((v) => ({ x: cx - 10, y: cy - 8, z: b(v), … })); return { top: () => 18, r: 12 }; }`.
`b(v)` is the node's base height (it includes the lift and the drop-in); return its height and footprint radius.
Something you can pass through (an arch, a gate) puts its far half in `back` and returns `pass: true`, so a packet
in the passage is covered by the near half and not by the far one.

Packets and traced parcels are hidden only while they are inside a solid, and otherwise drawn in front of or
behind each node by where they really are (`s.orderFor`). Two belts meeting in a node give two streams that
overlap there: run one link through it instead.

## Links

`{ from, to }` routes along the grid: along x, then y (or `via: "y"` for y first), or through waypoints
`via: [[gx, gy], …]`. `style`: `"tube"` (default, a conduit), `"road"` (a flat band with a dashed centre line)
or `"belt"` (a raised conveyor with rollers). `packets` (default 2 on tubes, 0 otherwise) travel it at `speed`
(default 1); `parcel: true` makes them taped boxes. A link appears once both ends have. `link.hold = 0.55` draws
it only part way (a broken chain); `null` gives it back.

## What the answer already does

- **Hover** lifts the node, lights it and its label, and reports its id to the page's `onpick`.
- **Click** opens a `database` or `stack` (and closes it again).
- **Steps:** `handle.send("step", n)` shows the nodes and links whose `step` ≤ n and lights the ones at n.
- **Focus:** `handle.send("focus", id | [ids] | null)` lights nodes from the page (for docs text that points at the diagram).
- **Rest:** `spec.rest`, or `ctx.rest` if your answer changes it.

## Your answer, and `ctx`

`answer(input, ctx)` runs after all that, on every input. Copy `input.action` before any callback uses it.

| `ctx.` | What it is |
| --- | --- |
| `nodes[id]` | `{ g, cx, cy, kind, label, explode, open, raised, … }`; `g` is the group: `g.to({ seal: 1 })`, `g.v` |
| `links` | each `{ from, to, g, pts, hold, flowing, packets }`; `flowing = false` stops its packets |
| `trace(path, { speed, dwell, onhop(i, node), ondone(ok) })` | sends one lit packet along node ids; `onhop` returning `false` stops it there |
| `tracing()` | whether a traced packet is on its way |
| `emit(name, detail)` | the page hears it as an `lw:<name>` event on the figure's host element |
| `keepAccent` | `true` while your code owns the highlight (during a trace) |
| `rest` | what to light when nothing else is |
| `hover` | the hovered node, if any |
| `route(a, b)` | the ground path between two nodes |

## The page

Make the drawing the hero, not a picture in a box: mount it with `clear: true` (no stage background, labels may
run past its edge) and `fill: true`, make the page's background the look's `ground`, and put a grid or a soft light
behind it that fades out (`examples/pages/*.html` show three ways). Keep labels close: `dy` of about -14, `dx` only
to point outward.

**Fill.** Without it, the host is a 5:4 box with the drawing in its middle three quarters. With `fill`, the host is
any box you size in CSS (positioned with insets, or given a height) and the drawing, labels included, is scaled to
fill it: as large as it fits, centred, or aligned with `fill: [x, y]` from 0 to 1 (`[1, 0.5]` holds it to the right
edge). Size the host to all the space the drawing may take, less room to breathe: the hero's height below the nav
less about 48px top and bottom, and everything beside the column of words. Give the section around it `overflow:
clip` (not `hidden`, which stops a sticky stage sticking). A stage held while words scroll past shares one grid cell
with them (`grid-area: 1 / 1`, `align-self: start`, as in `data.html`), never a negative margin, which lets it ride
over whatever follows. Labels that appear only later (the callouts
of an exploded view) are not in the measured box: pass `crop: [x0, y0, x1, y1]` in viewBox units (`report().box`
gives the drawing's) with room for them. `handle.crop(box)` moves the view at any time; `camera.html` pulls back
from the whole lens to its parts as you scroll.

**Words.** Few, and where the drawing leaves room: a title of a few words, one line, the controls. The facts are
the labels. In a scroll story, each step is a short heading and one line.

```js
const handle = LW.mount(document.getElementById("fig"), LW.figures.pipeline, {
  clear: true, fill: true,                // on the page, filling #fig
  onpick: (id) => showCaption(id),        // hover, or null when the pointer leaves
  onread: (text) => {},                   // the read-out, whenever it changes
  scroll: document.getElementById("track") // optional: input.scroll from this element's scroll progress
});
handle.send("step", 2);                   // lasting: step, focus
handle.act("verify");                     // once: input.action
host.addEventListener("lw:verify", (e) => e.detail);
```

Patterns in `examples/pages/`: `data.html` (an engineering post: one drawing held on screen beside the words, the
whole system first, then built stop by stop as you scroll), `parcels.html` (a tracking page: the scene fills the
screen beside the tracking card, whose timeline moves one lit parcel through a warehouse, a truck and a van to a
door), `room.html` (a furniture shop: the room fills the hero beside the words; every piece has a price tag,
a click adds it to the bag, a switch rearranges the room), `camera.html` (a product page: the whole lens fills the
screen, then the view pulls back as it comes apart on scroll, with a callout per part). `examples/systems/room.js`
is a scene built without `LW.system`, piece by piece.
