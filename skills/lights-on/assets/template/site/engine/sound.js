// Room sound for a demo: a day loop and a night loop that crossfade with the light. Silent until the visitor turns it
// on (browsers only allow sound after a click); the toggle is any button with aria-pressed.
//
//   roomSound(jn, button, { day: "audio/day.mp3", night: "audio/night.mp3", mix: (s) => s.sun })
export function roomSound(jn, button, { day, night, mix = (s) => s.sun, volume = 0.8 } = {}) {
  const loops = [day, night].map((src) => {
    const a = new Audio(src);
    a.loop = true;
    a.preload = "none";
    a.volume = 0;
    return a;
  });
  let on = false, level = 0, raf = 0;
  const target = () => Math.min(1, Math.max(0, mix(jn.state, jn)));

  // ease the two volumes toward the light, and toward silence when off
  const fade = () => {
    const k = on ? target() : 0;
    level += ((on ? 1 : 0) - level) * 0.08;
    const gains = [(1 - k) * level * volume, k * level * volume];
    loops.forEach((a, i) => {
      a.volume = Math.min(1, Math.max(0, gains[i]));
      if (on && a.paused && gains[i] > 0.001) a.play().catch(() => {});
    });
    if (!on && level < 0.002) { loops.forEach((a) => a.pause()); raf = 0; return; }
    raf = requestAnimationFrame(fade);
  };

  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    on = !on;
    button.setAttribute("aria-pressed", String(on));
    if (on) loops.forEach((a) => { a.preload = "auto"; });
    if (!raf) raf = requestAnimationFrame(fade);
  });
  return { get on() { return on; } };
}
