// Stage frame (4.1): `crop` draws four L-shaped crop marks (1 px --line-photo, inset 20, arm 16; phone 8 and 12) in
// .tour-frame, which Hide UI never hides. `inset` is drawn by the stage itself (R inset by 12 px, radius 10, the
// --paper gap shows through) and `none` draws nothing.

import { svg } from "../util.js";

export const frame = {
  name: "frame",
  mount(ctx) {
    this.kind = ctx.theme.frame?.kind ?? "none";
    this.svg = ctx.frameEl;
    if (this.kind === "crop") this.path = svg("path", { class: "tf-crop" }, this.svg);
  },
  layout(ctx) {
    if (!this.path) return;
    const w = ctx.stageEl.clientWidth, h = ctx.stageEl.clientHeight;
    const i = ctx.phone ? 8 : 20, a = ctx.phone ? 12 : 16, o = 0.5;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const L = i + o, R = w - i - o, T = i + o, B = h - i - o;
    this.path.setAttribute("d", [
      `M${L} ${T + a}V${T}H${L + a}`, `M${R - a} ${T}H${R}V${T + a}`,
      `M${R} ${B - a}V${B}H${R - a}`, `M${L + a} ${B}H${L}V${B - a}`,
    ].join(""));
  },
};
