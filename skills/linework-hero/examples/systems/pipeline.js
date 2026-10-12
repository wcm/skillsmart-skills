/**
 * Pipeline: an event pipeline, from a tap on a phone to a chart. Built step by step as the
 * article scrolls; events travel every live link; hover a stage to lift it; click the
 * warehouse to see its tables.
 */
{
  linework(LW.system({
    name: "pipeline",
    means: "An event pipeline: apps send events to a collector, a stream orders them, processors clean them, and the warehouse feeds a dashboard.",
    look: "cobalt",
    rest: "dashboard",
    frame: [300, 214],
    nodes: [
      { id: "phone", kind: "phone", at: [0, 0], label: "Mobile app", sub: "SDK · batched", step: 0, platform: 13, dy: -14 },
      { id: "web", kind: "laptop", at: [0, 1.35], label: "Web app", sub: "beacon API", step: 0, platform: 15, dx: -12, dy: -10 },
      { id: "collector", kind: "gateway", at: [1.55, 0.68], label: "Collector", sub: "12k events/s", step: 1, platform: true },
      { id: "stream", kind: "queue", at: [3.1, 0.68], label: "Event stream", sub: "7-day retention", step: 2, platform: 21, dx: 4, dy: -16 },
      { id: "lake", kind: "lake", at: [4.75, 0.68], label: "Raw lake", sub: "every event, as sent", step: 4, platform: 20, dx: 4, dy: -14 },
      { id: "processor", kind: "server", at: [3.1, 2.2], h: 24, units: 3, label: "Processors", sub: "dedupe · join · enrich", step: 3, platform: true, dx: -16, dy: -10 },
      { id: "warehouse", kind: "database", at: [3.1, 3.7], label: "Warehouse", sub: "click to open", step: 5, platform: true, dx: -16, dy: -6 },
      { id: "dashboard", kind: "screen", at: [4.65, 3.7], label: "Dashboard", sub: "fresh in 48 s", step: 6, platform: 17, dx: 16, dy: -8 },
    ],
    links: [
      { from: "phone", to: "collector", via: "y" },
      { from: "web", to: "collector", via: "y" },
      { from: "collector", to: "stream", packets: 3 },
      { from: "stream", to: "lake" },
      { from: "stream", to: "processor", packets: 3 },
      { from: "processor", to: "warehouse" },
      { from: "warehouse", to: "dashboard", packets: 1, speed: 0.7 },
    ],
  }));
}
