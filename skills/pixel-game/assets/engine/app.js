/* Pixel Game engine · app: boots a game page. It fits the canvas to the page, runs the frame loop,
   routes input (buttons first, then the game), keeps a manual clock for tests (window.__fr),
   saves files (the claude.ai viewer's downloads capability, else a plain link), shows toasts and
   connects the viewer's hot-reload hooks.

   A game calls R.app.run(game) with:
     view          an R.Screen (or a subclass) on the page's canvas
     g             the game's state object, exposed to tests as __fr.game
     boot(data)    build the first scene; data is what snapshot() returned before a hot reload
     tick(dt)      one frame: simulate, draw, present
     press(id)     a UI button was pressed
     down(x, y, ts, id)     a pointer went down, not on a button; x, y in pixels of the buffer, id
                            the pointer (several fingers can be down at once)
     move(x, y, id), up(id) that pointer moved or lifted
     keydown(ev), keyup(ev)
     hidden()      the page was hidden (pause here)
     snapshot()    the state to keep across a hot reload
     tap(ts)       the game's main action, for tests */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const H = R.H;
  const app = (R.app = { toast: '', toastT: 0, dl: null, game: null, view: null, manual: false });
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  app.canvas = canvas;

  // The artifact viewer offers saves through the downloads capability; elsewhere a plain link works.
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude
      .use('downloads')
      .then((d) => {
        app.dl = d;
      })
      .catch(() => {});
  }

  app.say = function (msg) {
    app.toast = msg;
    app.toastT = 2.2;
  };

  app.save = function (blob, filename, ok) {
    if (app.dl) {
      app.dl
        .save({ filename, data: blob })
        .then(() => app.say(ok))
        .catch((err) => {
          const code = err && err.code;
          app.say(code === 'declined' ? 'SAVE CANCELLED' : code === 'rate_limited' ? 'ONE MOMENT, TRY AGAIN' : 'SAVING IS OFF IN THIS VIEW');
        });
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.say(ok);
    } catch (e) {
      app.say('SAVING IS OFF IN THIS VIEW');
    }
  };

  // A 1080×1920 share card: the last clean frame of the game, shaded for text. Returns R.canvas.
  app.card = function () {
    const c = R.canvas(1080, 1920);
    const x = c.x;
    const snap = app.view && app.view.snap;
    if (snap) {
      x.imageSmoothingEnabled = true;
      x.drawImage(snap, 0, 0, 1080, 1920);
    } else {
      x.fillStyle = '#0b0618';
      x.fillRect(0, 0, 1080, 1920);
    }
    const shade = x.createLinearGradient(0, 0, 0, 1920);
    shade.addColorStop(0, 'rgba(5,2,14,0.82)');
    shade.addColorStop(0.45, 'rgba(5,2,14,0.55)');
    shade.addColorStop(1, 'rgba(5,2,14,0.9)');
    x.fillStyle = shade;
    x.fillRect(0, 0, 1080, 1920);
    x.imageSmoothingEnabled = false;
    return c;
  };
  app.saveCanvas = function (c, filename, ok) {
    c.c.toBlob((blob) => {
      if (blob) app.save(blob, filename, ok);
    }, 'image/png');
  };
  // Copy a caption for the post; never fails loudly.
  app.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
  };

  // ---------------- layout ----------------
  app.fit = function () {
    const r = stage.getBoundingClientRect();
    let w = r.width;
    let h = (w * H) / W;
    if (h > r.height) {
      h = r.height;
      w = (h * W) / H;
    }
    canvas.style.width = Math.floor(w) + 'px';
    canvas.style.height = Math.floor(h) + 'px';
    const view = app.view;
    if (!view) return;
    const dpr = window.devicePixelRatio || 1;
    view.resize(R.clamp(Math.ceil((h * dpr) / H), 2, view.lite ? 3 : 5));
    // Upscaling a smaller backing store: keep the pixels square and sharp.
    canvas.style.imageRendering = view.k * H < h * dpr - 1 ? 'pixelated' : 'auto';
  };

  // ---------------- input ----------------
  function toLogical(ev) {
    const r = canvas.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H];
  }
  // A button press: the click sound and the pressed look, then the game.
  app.press = function (id) {
    if (R.audio) {
      R.audio.init();
      R.audio.ui();
    }
    R.ui.pressed = id;
    R.ui.pressedT = 0.12;
    if (app.game && app.game.press) app.game.press(id);
  };

  // ---------------- the loop ----------------
  let last = 0;
  let slowFrames = 0;
  app.step = function (dt) {
    app.toastT -= dt;
    // Adaptive quality: a view drops its heavier extras when frames run long.
    if (dt > 0.026) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 0.5);
    if (slowFrames > 90 && app.view && !app.view.lite) {
      app.view.lite = true;
      app.fit();
    }
    app.game.tick(dt);
  };
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000;
    let dt = last ? now - last : 1 / 60;
    last = now;
    if (dt > 0.1) dt = 1 / 60;
    if (!app.manual) app.step(dt);
  }

  app.run = function (game) {
    app.game = game;
    app.view = game.view;
    window.addEventListener('resize', app.fit);
    canvas.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const [x, y] = toLogical(ev);
      const b = R.ui.hit(x, y);
      if (b) {
        if (b.id !== 'noop') app.press(b.id);
        return;
      }
      if (R.audio) R.audio.init();
      if (game.down) {
        try {
          canvas.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* capture is a nicety */
        }
        game.down(x, y, ev.timeStamp, ev.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!game.move || !ev.buttons) return;
      const [x, y] = toLogical(ev);
      game.move(x, y, ev.pointerId);
    });
    const up = (ev) => {
      if (game.up) game.up(ev.pointerId);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    window.addEventListener('keydown', (ev) => {
      if (game.keydown) game.keydown(ev);
    });
    window.addEventListener('keyup', (ev) => {
      if (game.keyup) game.keyup(ev);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.hidden) game.hidden();
    });

    // A manual clock for tests and frame-exact captures: __fr.manual(true); __fr.tick(1 / 60, n).
    window.__fr = {
      app,
      game: game.g,
      view: game.view,
      manual(on) {
        app.manual = !!on;
      },
      tick(dt, n) {
        for (let i = 0; i < (n || 1); i++) app.step(dt || 1 / 60);
      },
      press: app.press,
      tap: (ts) => game.tap && game.tap(ts),
    };

    const start = (data) => {
      game.boot(data && typeof data === 'object' ? data : {});
      app.fit();
      requestAnimationFrame(frame);
    };
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === 'function' && game.snapshot) hot.snapshot(() => game.snapshot());
    if (hot && typeof hot.ready === 'function') hot.ready(start);
    else start((hot && hot.data) || {});
  };
})();
