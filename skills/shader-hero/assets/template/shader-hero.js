// Shader Hero runtime: renders a fragment shader full-bleed behind a hero section.
// No dependencies. Handles DPR caps, off-screen pausing, reduced motion, slow devices
// and a CSS fallback when WebGL is unavailable.
//
// <section data-shader-hero data-preset="aurora" data-colors="#0b1020,#6d5dfc,#22d3ee"
//          data-speed="1" data-intensity="1" data-interaction="1">…</section>

import { PRESETS, COMMON } from "./presets.js";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
  }
  return s;
}

export function mountShaderHero(host) {
  const preset = host.dataset.preset || "aurora";
  const fragBody = PRESETS[preset];
  if (!fragBody) {
    console.warn(`[shader-hero] unknown preset "${preset}", using aurora`);
  }
  const colors = (host.dataset.colors || "#0b1020,#6d5dfc,#22d3ee").split(",").map(hexToRgb);
  while (colors.length < 3) colors.push(colors[colors.length - 1]);
  const speed = Number(host.dataset.speed || 1);
  const intensity = Number(host.dataset.intensity || 1);
  const interaction = Number(host.dataset.interaction || 1);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "shader-hero__canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);

  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) {
    host.classList.add("shader-hero--fallback");
    return;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, COMMON + (fragBody || PRESETS.aurora)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.error("[shader-hero]", err);
    host.classList.add("shader-hero--fallback");
    canvas.remove();
    return;
  }

  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(program, name);
  const U = {
    res: u("u_res"), time: u("u_time"), mouse: u("u_mouse"), scroll: u("u_scroll"),
    click: u("u_click"), c1: u("u_c1"), c2: u("u_c2"), c3: u("u_c3"), intensity: u("u_intensity"),
  };
  gl.uniform3fv(U.c1, colors[0]);
  gl.uniform3fv(U.c2, colors[1]);
  gl.uniform3fv(U.c3, colors[2]);
  gl.uniform1f(U.intensity, intensity);

  // Device pixel ratio: capped, and lowered automatically on slow devices.
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  let dprCap = isSmall ? 1 : 1.5;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.max(1, Math.floor(host.clientWidth * dpr));
    const h = Math.max(1, Math.floor(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(U.res, w, h);
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // Pointer, scroll and click, smoothed so motion feels fluid.
  const target = { x: 0.5, y: 0.5 };
  const mouse = { x: 0.5, y: 0.5 };
  let clickAt = -100;
  function point(clientX, clientY) {
    const r = host.getBoundingClientRect();
    target.x = (clientX - r.left) / r.width;
    target.y = 1 - (clientY - r.top) / r.height;
  }
  window.addEventListener("pointermove", (e) => point(e.clientX, e.clientY), { passive: true });
  host.addEventListener("pointerdown", (e) => {
    point(e.clientX, e.clientY);
    clickAt = performance.now() / 1000;
  });

  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) loop();
  }).observe(host);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loop();
  });

  const start = performance.now();
  let raf = 0;
  let slowFrames = 0;
  let last = start;

  function frame(now) {
    const t = ((now - start) / 1000) * speed;
    const k = 0.08 * interaction;
    mouse.x += (target.x - mouse.x) * k;
    mouse.y += (target.y - mouse.y) * k;
    const scroll = Math.min(1, window.scrollY / Math.max(1, host.offsetHeight));
    gl.uniform1f(U.time, t);
    gl.uniform2f(U.mouse, 0.5 + (mouse.x - 0.5) * interaction, 0.5 + (mouse.y - 0.5) * interaction);
    gl.uniform1f(U.scroll, scroll);
    gl.uniform1f(U.click, now / 1000 - clickAt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop() {
    cancelAnimationFrame(raf);
    if (reduced) {
      frame(start + 3000);
      return;
    }
    const tick = (now) => {
      if (!visible || document.hidden) return;
      // If frames take longer than ~40 ms for a while, render at a lower resolution.
      if (now - last > 40) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 45 && dprCap > 0.75) {
        dprCap = Math.max(0.75, dprCap - 0.25);
        slowFrames = 0;
        resize();
      }
      last = now;
      frame(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  host.classList.add("shader-hero--ready");
  loop();
}

document.querySelectorAll("[data-shader-hero]").forEach(mountShaderHero);
