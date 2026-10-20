/*
 * The page around a reel: plays it on a loop in real time, with a scrubber, the scenes as chips,
 * a seam button (the last second and a half, through the wrap) and the reel UI's safe zones.
 * ?record=1 strips it to the bare canvas for the recorder. ?f=<frame> opens paused on a frame.
 * Keys: space play/pause · ←/→ a frame · shift+←/→ a beat · S seam · Z safe zones · H HUD
 */
(function () {
  "use strict";
  const q = new URLSearchParams(location.search), record = q.has("record");
  const css = `
    html,body{margin:0;background:#0b0b0d;color:#cfcac2;font:12px/1.4 "JetBrains Mono",ui-monospace,monospace;height:100%}
    body{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 16px;box-sizing:border-box}
    .stage{position:relative;flex:1;min-height:0;display:flex;justify-content:center;width:100%}
    canvas{height:100%;max-width:100%;object-fit:contain;display:block;box-shadow:0 10px 40px #000a;border-radius:6px}
    .safe{position:absolute;inset:0;margin:auto;pointer-events:none;display:none}
    .safe.on{display:block}
    .bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center;max-width:980px;width:100%}
    .bar button{background:#1c1c21;color:#e9e4da;border:1px solid #2c2c33;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}
    .bar button.on{background:#e9e4da;color:#0e0d12}
    .bar input[type=range]{flex:1;min-width:220px;accent-color:#e8643a}
    .chips{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:980px}
    .chips button{background:none;border:1px solid #2c2c33;color:#8d887f;border-radius:20px;padding:2px 8px;font:11px/1.4 inherit;cursor:pointer}
    .chips button.on{border-color:#e8643a;color:#e9e4da}
    .read{min-width:300px;text-align:center;color:#8d887f}
    .warn{color:#ecd152;max-width:980px;text-align:center}
    .record body,body.record{padding:0;background:#000}`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const canvas = document.createElement("canvas");
  /* ?render=1 is the Skillsmart renderer (render.mjs): a bare canvas the size of the format, and
     window.__film { ready, duration, fps, labels, seek(t) }, each frame drawn with motion blur */
  const film = q.has("render");
  if (record || film) { document.body.classList.add("record"); document.body.style.cssText = "margin:0;padding:0;display:block;overflow:hidden;background:#000"; document.body.appendChild(canvas); canvas.style.cssText = "display:block"; }
  window.addEventListener("DOMContentLoaded", () => {});

  const mounted = Reel.mount(canvas);
  if (film) {
    const samples = +(q.get("samples") || 6);
    let n = 1;
    window.__film = {
      ready: mounted.then((info) => {
        canvas.style.width = info.w + "px"; canvas.style.height = info.h + "px";
        n = info.frames;
        Object.assign(window.__film, { duration: info.frames / info.fps, fps: info.fps, labels: info.scenes.map((s) => ({ name: s.label, at: s.from / info.fps })) });
        return window.__film;
      }),
      seek(t) { Reel.draw(Math.max(0, Math.min(n - 1, Math.round(t * window.__film.fps))), { samples }); },
    };
  }
  mounted.then((info) => {
    window.REEL_INFO = info;
    if (record || film) { Reel.draw(+q.get("f") || 0); window.REEL_READY = true; return; }
    build(info);
  }).catch((e) => { document.body.textContent = String(e && e.stack || e); console.error(e); });

  function build(info) {
    const N = info.frames, fps = info.fps;
    const stage = el("div", "stage"); stage.appendChild(canvas);
    const safe = el("canvas", "safe"); stage.appendChild(safe);
    document.body.appendChild(stage);
    const bar = el("div", "bar"), chips = el("div", "chips"), read = el("span", "read");
    const play = btn("❚❚"), seam = btn("seam"), zones = btn("safe zones"), hudB = btn("HUD"), speed = btn("1×");
    const range = el("input"); range.type = "range"; range.min = 0; range.max = N - 1; range.value = 0;
    bar.append(play, range, read, seam, speed, zones, hudB);
    document.body.append(bar, chips);
    const warn = el("div", "warn"); document.body.appendChild(warn);
    hudB.classList.add("on");
    const chipEls = info.scenes.map((s) => { const b = el("button"); b.textContent = `${String(s.i + 1).padStart(2, "0")} ${s.label.toLowerCase()} · ${+(s.len ?? s.beats).toFixed(2)}b${s.slow && s.slow !== 1 ? ` (×${s.slow} slow)` : ""}`; b.onclick = () => go(s.from); chips.appendChild(b); return b; });

    let playing = !q.has("f"), frame = +q.get("f") || 0, rate = 1, t0 = performance.now(), f0 = frame, last = -1;
    const audio = q.get("audio") ? Object.assign(new Audio(q.get("audio")), { loop: true }) : null;
    const go = (f) => { frame = ((Math.round(f) % N) + N) % N; f0 = frame; t0 = performance.now(); if (audio) audio.currentTime = frame / fps; };
    const toggle = () => { playing = !playing; play.textContent = playing ? "❚❚" : "▶"; go(frame); if (audio) playing ? audio.play().catch(() => {}) : audio.pause(); };
    play.onclick = toggle;
    range.oninput = () => { go(+range.value); if (playing) toggle(); };
    seam.onclick = () => { go(N - Math.round(1.5 * fps)); if (!playing) toggle(); };
    speed.onclick = () => { rate = rate === 1 ? 0.5 : rate === 0.5 ? 0.25 : 1; speed.textContent = rate + "×"; go(frame); if (audio) audio.playbackRate = rate; };
    zones.onclick = () => { zones.classList.toggle("on"); safe.classList.toggle("on"); drawSafe(); };
    hudB.onclick = () => { hudB.classList.toggle("on"); Reel.setHud(hudB.classList.contains("on")); last = -1; };
    addEventListener("keydown", (e) => {
      const beat = N / info.beats;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") { if (playing) toggle(); go(frame + (e.shiftKey ? beat : 1)); }
      else if (e.key === "ArrowLeft") { if (playing) toggle(); go(frame - (e.shiftKey ? beat : 1)); }
      else if (e.key === "s") seam.onclick();
      else if (e.key === "z") zones.onclick();
      else if (e.key === "h") hudB.onclick();
    });
    if (audio && playing) audio.play().catch(() => {
      /* browsers hold sound until a gesture: start it, in sync, on the first click or key */
      const start = () => { if (playing) { audio.currentTime = frame / fps; audio.play().catch(() => {}); } removeEventListener("pointerdown", start); removeEventListener("keydown", start); };
      addEventListener("pointerdown", start); addEventListener("keydown", start);
      read.title = "click anywhere for sound";
    });

    const tick = () => {
      if (playing) frame = audio && !audio.paused ? Math.floor(audio.currentTime * fps) % N : (f0 + Math.floor(((performance.now() - t0) / 1000) * fps * rate)) % N;
      if (frame !== last) {
        Reel.draw(frame); last = frame; range.value = frame;
        const B = (frame / N) * info.beats, s = info.scenes.find((x) => frame >= x.from && frame < x.to) || info.scenes.at(-1);
        read.textContent = `F${String(frame).padStart(4, "0")} · ${(frame / fps).toFixed(2)}s · bar ${Math.floor(B / 4) + 1} beat ${(Math.floor(B) % 4) + 1}`;
        chipEls.forEach((c, i) => c.classList.toggle("on", i === s.i));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const w = Reel.warnings(); if (w.length) warn.textContent = "⚠ " + w.join(" · ");
    setTimeout(() => { const w2 = Reel.warnings(); if (w2.length) warn.textContent = "⚠ " + w2.join(" · "); }, 2000);

    /* approximate reel UI: header, caption and the action column (9:16 only) */
    function drawSafe() {
      const r = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      safe.style.left = r.left - sr.left + "px"; safe.style.top = r.top - sr.top + "px"; safe.style.width = r.width + "px"; safe.style.height = r.height + "px"; safe.style.margin = "0";
      safe.width = info.w; safe.height = info.h;
      const x = safe.getContext("2d"); x.clearRect(0, 0, info.w, info.h); x.fillStyle = "rgba(255,40,80,.22)";
      if (info.h / info.w > 1.5) { x.fillRect(0, 0, info.w, 220); x.fillRect(0, info.h - 400, info.w, 400); x.fillRect(info.w - 130, info.h * 0.5, 130, info.h * 0.5); }
    }
    addEventListener("resize", () => safe.classList.contains("on") && drawSafe());
  }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function btn(txt) { const b = el("button"); b.textContent = txt; return b; }
})();
