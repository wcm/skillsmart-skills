/**
 * Parcels: one parcel's journey, from a warehouse shelf to a front door. A belt runs from the
 * front of the shelving through a sorter to the truck's tailgate; a road runs to the local hub,
 * the van and the house. The page's tracking timeline sends a stage; your parcel (the lit one)
 * travels there stop by stop, and for the last one the van drives it to the door. The figure
 * says "arrived" (lw:arrived) when the parcel has stopped moving.
 */
{
  const STAGES = ["rack", "sorter", "truck", "hub", "van", "house"];
  const G = 40, DRIVE = 26;
  const at = { rack: [0, 0.3], sorter: [1.65, 0.3], truck: [3.45, 0.3], hub: [3.45, 2.05], van: [5.05, 2.05], house: [6.55, 2.05] };
  const W = (id) => [at[id][0] * G, at[id][1] * G];
  // where your parcel sits at each stage, in world units
  const SLOT = {
    rack: [W("rack")[0] + 20, W("rack")[1], 5.1],
    sorter: [W("sorter")[0], W("sorter")[1], 5.1],
    truck: [W("truck")[0] - 22, W("truck")[1], 5.1],
    hub: [W("hub")[0] + 4, W("hub")[1] + 18, 0.4],
    van: [W("van")[0] - 5, W("van")[1] + 11, 0.4],
    house: [W("house")[0] + 3, W("house")[1] + 18, 0.4],
  };
  // the last leg: into the van, the van drives to the house, out to the doorstep
  const INVAN = (tx) => [W("van")[0] - 4 + tx, W("van")[1], 4];
  const SIDE = (tx) => [W("van")[0] - 5 + tx, W("van")[1] + 11, 0.4];
  const PATH = [SIDE(DRIVE)[0] + 12, SLOT.house[1] + 1, 0.4]; // round the house's corner, not through it
  const DELIVER = [{ p: INVAN(0) }, { van: DRIVE, ride: true }, { p: SIDE(DRIVE) }, { p: PATH }, { p: SLOT.house }];
  const UNDELIVER = [{ p: PATH }, { p: SIDE(DRIVE) }, { p: INVAN(DRIVE) }, { van: 0, ride: true }, { p: SLOT.van }];

  linework(LW.system({
    name: "parcels",
    means: "A parcel's journey: picked from a shelf, sorted, carried by truck to the local hub, driven by van to the door.",
    look: "signal",
    frame: [330, 236],
    nodes: [
      { id: "rack", kind: "rack", at: at.rack, label: "Fulfilment", sub: "Leipzig · shelf B-14", dx: -8, dy: -14 },
      { id: "sorter", kind: "scanner", at: at.sorter, label: "Sorter", sub: "lane 7 · 4,200/h", dy: -14 },
      { id: "truck", kind: "truck", at: at.truck, label: "Linehaul", sub: "Leipzig → Berlin", dx: 6, dy: -14 },
      { id: "hub", kind: "shed", at: at.hub, label: "Local hub", sub: "Berlin-Mitte", dx: -10, dy: -14 },
      { id: "van", kind: "van", at: at.van, label: "Van 12", sub: "stop 9 of 31", dy: -14 },
      { id: "house", kind: "house", at: at.house, label: "Your door", sub: "Kastanienallee 41", dx: 4, dy: -14 },
    ],
    links: [
      // one belt from the front of the shelving, through the sorter's arch, to the truck's tailgate
      { from: "rack", to: "truck", style: "belt", packets: 4, parcel: true, speed: 0.6, trim: [16, 17] },
      { from: "truck", to: "hub", style: "road" },
      { from: "hub", to: "van", style: "road" },
      { from: "van", to: "house", style: "road" },
    ],
    draw(s, ctx) {
      // your parcel: a lit box with tape, walked through a queue of moves by the clock
      const p = s.group({ x: SLOT.rack[0], y: SLOT.rack[1], z: SLOT.rack[2], hidden: 0 });
      p.box((v) => ({ x: v.x - 3.5, y: v.y - 3.5, z: v.z, w: 7, d: 7, h: 5.4, r: 0.7, b: 0, hide: v.hidden > 0.5 }));
      p.line((v) => ({ pts: [[v.x, v.y - 3.5, v.z + 5.4], [v.x, v.y + 3.5, v.z + 5.4], [v.x, v.y + 3.5, v.z + 2.4]], hide: v.hidden > 0.5 }), { cls: "lo" });
      p.el.classList.add("hot");
      s.occluder(p); // belt parcels go behind yours, never through it
      ctx.parcel = p;
      ctx.stage = 0;
      ctx.queue = [];
      let busy = 0, moving = false;
      ctx.riding = false;
      s.loop((dt, now) => {
        // riding: your parcel is inside the van and goes where it goes
        if (ctx.riding) p.set({ x: INVAN(0)[0] + ctx.nodes.van.g.v.tx });
        const o = s.orderFor([p.v.x - 3.5, p.v.y - 3.5, p.v.z, p.v.x + 3.5, p.v.y + 3.5, p.v.z + 5.4], p);
        p.order = o.order;
        if ((o.hidden ? 1 : 0) !== p.v.hidden) p.set({ hidden: o.hidden ? 1 : 0 });
        if (now < busy) return;
        ctx.riding = false;
        if (!ctx.queue.length) {
          if (moving) { moving = false; ctx.emit("arrived", { stage: ctx.stage, at: STAGES[ctx.stage] }); }
          return;
        }
        moving = true;
        const step = ctx.queue.shift();
        if (step.van != null) {
          ctx.nodes.van.g.to({ tx: step.van }, { ease: true, dur: 1400 });
          ctx.riding = !!step.ride;
          busy = now + 1450;
        } else {
          p.to({ x: step.p[0], y: step.p[1], z: step.p[2] }, { ease: true, dur: 620 });
          busy = now + 680;
        }
      });
    },
    answer(input, ctx) {
      // reset: back to the shelf at once, for a replay
      if (input.action === "reset") {
        ctx.queue.length = 0;
        ctx.riding = false;
        ctx.parcel.set({ x: SLOT.rack[0], y: SLOT.rack[1], z: SLOT.rack[2] });
        ctx.nodes.van.g.set({ tx: 0 });
        ctx.stage = 0;
        ctx.rest = "rack";
        return undefined;
      }
      const want = input.stage ?? ctx.stage;
      if (want !== ctx.stage) {
        const a = ctx.stage, dir = want > a ? 1 : -1;
        for (let i = a + dir; dir > 0 ? i <= want : i >= want; i += dir) {
          if (dir > 0 && i === 5) ctx.queue.push(...DELIVER);
          else if (dir < 0 && i === 4) ctx.queue.push(...UNDELIVER);
          else ctx.queue.push({ p: SLOT[STAGES[i]] });
        }
        ctx.stage = want;
      }
      ctx.rest = STAGES[ctx.stage];
      return undefined;
    },
  }));
}
