/*
 * The bench: the page around one figure. It owns the look switcher, the camera,
 * the intensity slider, play, the read-out and the line under the stage, and the
 * address parameters the check script uses:
 *
 *   ?look=riso | hue:285 | hue:285:dark   ?camera=low   ?intensity=0..1   ?at=x,y | auto
 *   ?play=1   ?w=240 (a thumbnail)   ?bare=1 (the plate alone)   ?report=1 (post a report to the parent)
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement, params = new URLSearchParams(location.search);
  const errors = [];
  addEventListener("error", (e) => {
    const msg = String((e.error && e.error.message) || e.message);
    errors.push(msg);
    $("error").hidden = false;
    $("error").textContent = msg;
  });

  let started = false;
  LW.onfigure((fig) => {
    if (started) return;
    started = true;
    start(fig);
  });

  function start(fig) {
    const scrolly = (fig.inputs || []).includes("scroll") && !params.has("bare");
    if (scrolly) document.body.classList.add("scrolly");
    if (params.get("bare") === "1") document.body.classList.add("bare");
    const w = Number(params.get("w"));
    if (w > 0) document.querySelector("main").style.maxWidth = w + "px";

    // intensity to the figure's own number: two straight lines that meet at 0.5, as in Hairline
    const [lo, mid, hi] = fig.range || [0, 0.5, 1];
    const toValue = (i) => Math.round((i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid)) * 1000) / 1000;
    const slider = $("intensity");
    const iq = Number(params.get("intensity"));
    if (params.has("intensity") && Number.isFinite(iq)) slider.value = String(Math.min(1, Math.max(0, iq)));
    $("ilabel").textContent = fig.rangeLabel || "intensity";

    let lookKey = params.get("look") || fig.look || "paper";
    let camKey = params.get("camera") || fig.camera || "iso";
    let handle = null;

    document.title = fig.title || "Linework · " + fig.name;
    $("title").textContent = fig.name;
    $("name").textContent = fig.name;
    $("means").textContent = fig.means || "";
    $("hint").textContent = fig.hint || "";

    const paint = (L) => {
      root.style.setProperty("--bg", L.c.ground);
      root.style.setProperty("--ink", L.c.ink);
      root.style.setProperty("--muted", L.c.muted);
      root.style.setProperty("--line", L.c.line);
      root.style.setProperty("--accent", L.c.accent);
      root.style.colorScheme = L.dark ? "dark" : "light";
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = L.c.ground;
    };
    const remember = () => {
      const q = new URLSearchParams(location.search);
      if (typeof lookKey === "string") q.set("look", lookKey); else q.delete("look");
      if (camKey !== (fig.camera || "iso")) q.set("camera", camKey); else q.delete("camera");
      history.replaceState(null, "", "?" + q.toString());
    };

    function mountIt() {
      if (handle) handle.destroy();
      handle = LW.mount($("stage"), fig, {
        look: lookKey,
        camera: camKey,
        value: toValue(Number(slider.value)),
        scroll: scrolly ? $("track") : null,
        onread: (t) => { $("read").textContent = t; },
      });
      $("read").textContent = handle.readout || "rest";
      paint(handle.look);
      window.linework.figure = handle;
      if (playing) handle.play();
    }

    /* looks */
    const looks = $("looks");
    // a figure may bring its own look object; it gets the first chip
    const own = typeof fig.look === "object" && fig.look ? fig.look : null;
    const keys = (own ? ["own"] : []).concat(Object.keys(LW.LOOKS), "hue");
    const hueRow = $("huerow"), hue = $("hue"), hueDark = $("huedark");
    const fromKey = (k) => (k === "hue" ? `hue:${hue.value}${hueDark.checked ? ":dark" : ""}` : k === "own" ? own : k);
    if (typeof lookKey === "string" && lookKey.startsWith("hue")) {
      const [, h, d] = lookKey.split(":");
      hue.value = h || "285";
      hueDark.checked = d === "dark";
    }
    for (const k of keys) {
      const L = k === "hue" ? LW.hueLook(Number(hue.value), false) : k === "own" ? LW.resolve(own) : LW.LOOKS[k];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("role", "radio");
      b.dataset.key = k;
      b.innerHTML = `<span class="sw"><i style="background:${L.c.ground}"></i><i style="background:${L.c.edge}"></i><i style="background:${L.c.accent}"></i></span>${L.label}`;
      b.addEventListener("click", () => setLook(fromKey(k)));
      looks.appendChild(b);
    }
    function setLook(k) {
      lookKey = k;
      const L = handle.setLook(k);
      paint(L);
      const fam = typeof k !== "string" ? "own" : k.startsWith("hue") ? "hue" : k;
      for (const b of looks.children) b.setAttribute("aria-checked", String(b.dataset.key === fam));
      hueRow.hidden = fam !== "hue";
      $("hueval").textContent = hue.value;
      remember();
    }
    hue.addEventListener("input", () => setLook(fromKey("hue")));
    hueDark.addEventListener("change", () => setLook(fromKey("hue")));

    /* camera */
    const cams = $("cams");
    for (const k in LW.CAMS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = LW.CAMS[k].label;
      b.dataset.key = k;
      b.addEventListener("click", () => {
        camKey = k;
        for (const x of cams.children) x.setAttribute("aria-pressed", String(x.dataset.key === k));
        mountIt();
        remember();
      });
      cams.appendChild(b);
    }
    for (const x of cams.children) x.setAttribute("aria-pressed", String(x.dataset.key === camKey));

    /* intensity */
    const show = () => { $("value").textContent = String(toValue(Number(slider.value))); };
    slider.addEventListener("input", () => { show(); handle.set(toValue(Number(slider.value))); });
    show();

    /* play: an unseen pointer walks the figure's tour until a hand arrives */
    let playing = false;
    const play = $("play");
    play.addEventListener("click", () => {
      playing = !playing;
      if (playing) handle.play(); else handle.stop();
      play.setAttribute("aria-pressed", String(playing));
    });

    mountIt();
    setLook(lookKey);
    if (params.get("play") === "1") play.click();

    /* ?at=x,y holds the pointer still, for tools that cannot hover; auto is the tour's first stop */
    const at = params.get("at");
    if (at) {
      const p = at === "auto" ? (handle.stops || []).find(Boolean) : at.split(",").map(Number);
      if (p && p.length === 2 && p.every(Number.isFinite)) handle.hold(p);
    }

    /* ?report=1: tell the parent what the figure shows, once it has settled */
    if (params.get("report") === "1" && parent !== window) {
      setTimeout(() => parent.postMessage(Object.assign({ type: "linework-report", url: location.search, errors }, handle.report()), "*"), 1800);
    }
  }
})();
