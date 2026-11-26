(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------------- zoom hero ---------------- */
  const zoom = document.querySelector(".zoom");
  const stage = document.querySelector(".stage");
  const scene = document.getElementById("scene");
  const matLayer = document.getElementById("matLayer");
  const fill = document.querySelector(".zoom-fill");
  const zoomValue = document.querySelector(".zoom-value");

  /* ---------------- locked layout ----------------
     Two fixed designs: computer (1440 x 900) and phone (390 x 844).
     Anything wider than it is tall gets the computer design; anything taller gets the phone one.
     --s scales the design to fit the screen (width and height), --sw to fit the width. */
  const root = document.documentElement;
  const DESIGNS = { desk: { w: 1440, h: 900 }, phone: { w: 390, h: 844 } };
  let mode = null;

  // camera frames, in hand-drawing units; the ratios match the two designs exactly
  const FRAMES = {
    desk:  { start: { x: -287, y: -16, w: 960, h: 600 }, endShift: 10.8 },
    phone: { start: { x: 127, y: -330, w: 400, h: 866 }, endShift: 0 }
  };
  const TIP = { x: 291, y: 75.6 };           // where the crane stands
  const END_W = 52;                          // width of the final view
  const DESK_GAP = 0.15;
  let START, END, C0, MAX_ZOOM;

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    const next = w / h < 1 ? "phone" : "desk";
    const d = DESIGNS[next];
    root.style.setProperty("--s", Math.min(w / d.w, h / d.h).toFixed(5));
    root.style.setProperty("--sw", (w / d.w).toFixed(5));
    if (next !== mode) {
      mode = next;
      root.dataset.mode = mode;
      const f = FRAMES[mode];
      START = f.start;
      MAX_ZOOM = START.w / END_W;
      const endH = START.h / MAX_ZOOM;
      // final view centred just above the fingertip (and right of it on computers, leaving room for the note)
      END = { x: TIP.x - f.endShift - END_W / 2, y: TIP.y - 2.6 - endH / 2, w: END_W, h: endH };
      C0 = { x: START.x + START.w / 2, y: START.y + START.h / 2 };
    }
  }
  layout();

  // Ease in on a log scale so the zoom feels steady instead of rushing at the end.
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function setView(t) {
    const z = Math.exp(lerp(0, Math.log(MAX_ZOOM), t)); // current magnification
    const w = START.w / z, h = START.h / z;
    // keep the camera centre moving from the start centre toward the tip
    const cx = lerp(START.x + START.w / 2, END.x + END.w / 2, ease(t));
    const cy = lerp(START.y + START.h / 2, END.y + END.h / 2, ease(t));
    scene.setAttribute("viewBox", `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    // the desk is a little farther from the camera than the hand (DESK_GAP, as a share of the
    // starting camera distance), so it magnifies less: perspective, not a flat zoom
    const k = 1 / (1 + z * DESK_GAP), B = k * (1 + DESK_GAP);
    const ax = cx + k * (C0.x - cx) - B * C0.x, ay = cy + k * (C0.y - cy) - B * C0.y;
    matLayer.setAttribute("transform", `translate(${ax.toFixed(3)} ${ay.toFixed(3)}) scale(${B.toFixed(5)})`);
    fill.style.width = (t * 100).toFixed(1) + "%";
    zoomValue.textContent = Math.round(z) + "×";
    stage.dataset.phase = t < 0.08 ? "start" : t > 0.9 ? "end" : "mid";
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const rect = zoom.getBoundingClientRect();
      const travel = zoom.offsetHeight - window.innerHeight;
      const raw = Math.min(1, Math.max(0, -rect.top / (travel * 0.85)));
      setView(raw);
      ticking = false;
    });
  }

  if (reduceMotion) {
    zoom.style.height = "100vh";
    setView(1);
    window.addEventListener("resize", () => { layout(); setView(1); });
  } else {
    setView(0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { layout(); onScroll(); });
    onScroll();
  }

  /* ---------------- gallery ---------------- */
  const crafts = window.CRAFTS || [];
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const chips = [...document.querySelectorAll(".chip")];
  const kindLabel = { figure: "Figure", tool: "Working tool" };
  let current = "all";
  let visible = [];

  const meta = document.getElementById("intro-meta");
  const factCount = document.getElementById("fact-count");
  if (factCount) factCount.textContent = crafts.length;
  if (meta && crafts.length) meta.textContent = crafts.length + (crafts.length === 1 ? " piece so far" : " pieces so far");

  chips.forEach(chip => {
    const f = chip.dataset.filter;
    const n = f === "all" ? crafts.length : crafts.filter(c => c.kind === f).length;
    chip.querySelector(".count").textContent = n;
    chip.addEventListener("click", () => {
      current = f;
      chips.forEach(c => c.setAttribute("aria-pressed", String(c === chip)));
      render();
    });
  });

  const playIcon = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';

  function render() {
    visible = crafts.filter(c => current === "all" || c.kind === current);
    grid.innerHTML = "";
    visible.forEach((c, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="card" aria-label="Open ${esc(c.title)}">
          <span class="card-media">
            <img src="${esc(c.image)}" alt="" loading="lazy" width="600" height="600">
            ${c.video ? `<span class="badge">${playIcon}${c.kind === "tool" ? "Watch it work" : "Watch video"}</span>` : ""}
          </span>
          <span class="card-title">${esc(c.title)}</span>
          <span class="card-size">${[c.zh, kindLabel[c.kind], c.size].filter(Boolean).map(esc).join(", ")}</span>
        </button>`;
      li.querySelector(".card").addEventListener("click", () => openViewer(i));
      grid.appendChild(li);
    });
    empty.hidden = visible.length > 0;
  }

  /* ---------------- viewer ---------------- */
  const viewer = document.getElementById("viewer");
  const vMedia = document.getElementById("v-media");
  const vKind = document.getElementById("v-kind");
  const vTitle = document.getElementById("v-title");
  const vSize = document.getElementById("v-size");
  const vDesc = document.getElementById("v-desc");
  const vPrev = document.getElementById("v-prev");
  const vNext = document.getElementById("v-next");
  let index = 0;
  let opener = null;

  function fillViewer() {
    const c = visible[index];
    vMedia.innerHTML = c.video
      ? `<video src="${esc(c.video)}" poster="${esc(c.image)}" controls autoplay muted loop playsinline></video>`
      : `<img src="${esc(c.image)}" alt="${esc(c.title)}">`;
    vKind.textContent = kindLabel[c.kind] || "";
    vTitle.textContent = c.title;
    vSize.textContent = [c.zh, c.size].filter(Boolean).join(", ");
    vSize.hidden = !vSize.textContent;
    vDesc.textContent = c.about || "";
    vPrev.disabled = index === 0;
    vNext.disabled = index === visible.length - 1;
  }

  function openViewer(i) {
    index = i;
    opener = document.activeElement;
    fillViewer();
    viewer.showModal();
  }
  function step(d) {
    const n = index + d;
    if (n < 0 || n >= visible.length) return;
    index = n;
    fillViewer();
  }

  vPrev.addEventListener("click", () => step(-1));
  vNext.addEventListener("click", () => step(1));
  document.getElementById("v-close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", e => { if (e.target === viewer) viewer.close(); }); // click outside the paper
  viewer.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  viewer.addEventListener("close", () => {
    vMedia.innerHTML = ""; // stops any video
    if (opener) opener.focus();
  });

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  render();
})();
