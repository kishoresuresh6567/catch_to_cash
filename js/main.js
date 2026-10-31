/* Boot, input handling and the main loop. */
(function () {
  const G = CTC.game, L = CTC.LAYOUT;
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  let scale = 1, portrait = false;

  function fit() {
    const w = window.innerWidth, h = window.innerHeight;
    scale = Math.min(w / L.width, h / L.height);
    stage.style.transform = "translate(" + (w - L.width * scale) / 2 + "px," + (h - L.height * scale) / 2 + "px) scale(" + scale + ")";
    CTC.render.resize(scale);
    // On small screens, enlarge the interface so that it stays readable and tappable.
    const uiScale = Math.max(1, Math.min(1.7, 0.85 / scale));
    stage.classList.toggle("compact", uiScale > 1.2);
    document.querySelectorAll("#hud, #drawer, #missionPanel, #toast, .overlay").forEach((el) => { el.style.zoom = uiScale; });
    const touch = window.matchMedia("(pointer: coarse)").matches;
    // The game is landscape only. Upright phones see only the turn-your-phone screen.
    portrait = touch && h > w;
    document.getElementById("rotate").classList.toggle("hidden", !portrait);
  }

  // Stage position inside the camera view.
  function toStage(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * L.width, y: ((e.clientY - r.top) / r.height) * L.height };
  }
  function toWorld(e) {
    const s = toStage(e), cam = G.cam;
    return { x: cam.x + s.x / cam.z, y: cam.y + s.y / cam.z };
  }

  /* ---------- camera ---------- */
  const MAX_ZOOM = 3;
  const FOLLOW_DELAY = 2500;
  function clampCam() {
    const cam = G.cam;
    cam.x = Math.max(0, Math.min(L.width - L.width / cam.z, cam.x));
    cam.y = Math.max(0, Math.min(L.height - L.height / cam.z, cam.y));
  }
  // Zooms while keeping the point under (sx, sy) in the same place on screen.
  function zoomAt(factor, sx, sy) {
    const cam = G.cam;
    const wx = cam.x + sx / cam.z, wy = cam.y + sy / cam.z;
    cam.z = Math.max(1, Math.min(MAX_ZOOM, cam.z * factor));
    cam.x = wx - sx / cam.z;
    cam.y = wy - sy / cam.z;
    clampCam();
  }
  function touchedCamera() { G.cam.heldUntil = performance.now() + FOLLOW_DELAY; }
  function followPlayer() {
    const cam = G.cam, p = G.player;
    if (cam.z <= 1 || G.mode !== "play" || performance.now() < cam.heldUntil) return;
    cam.x += (p.x - L.width / (2 * cam.z) - cam.x) * 0.08;
    cam.y += (p.y - 30 - L.height / (2 * cam.z) - cam.y) * 0.08;
    clampCam();
  }
  CTC.camera = { zoomAt };

  /* ---------- pointer: tap acts, drag pans, two fingers pinch ---------- */
  const TAP_SLOP = 10;
  const touches = new Map();
  let drag = null, pinch = null;

  canvas.addEventListener("pointerdown", (e) => {
    CTC.audio.init();
    document.getElementById("drawer").classList.remove("open");
    document.getElementById("missionPanel").classList.remove("open");
    CTC.ui.togglePanel(false);
    CTC.ui.toggleTop(false);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers can't be captured */ }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) {
      drag = { x: e.clientX, y: e.clientY, sx: toStage(e).x, sy: toStage(e).y, moved: false };
    } else if (touches.size === 2) {
      drag = null;
      pinch = pinchInfo();
    }
  });

  function pinchInfo() {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" && G.s && G.player) {
      const w = toWorld(e);
      G.aim = { x: w.x, y: w.y, water: G.inWater(w.x, w.y), reach: Math.hypot(w.x - G.player.x, w.y - G.player.y) <= 310 };
    }
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cssToStage = L.width / canvas.getBoundingClientRect().width;
    if (pinch && touches.size >= 2) {
      const now = pinchInfo();
      const r = canvas.getBoundingClientRect();
      zoomAt(now.d / pinch.d, (now.x - r.left) * cssToStage, (now.y - r.top) * cssToStage);
      G.cam.x -= ((now.x - pinch.x) * cssToStage) / G.cam.z;
      G.cam.y -= ((now.y - pinch.y) * cssToStage) / G.cam.z;
      clampCam();
      touchedCamera();
      pinch = now;
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > TAP_SLOP) drag.moved = true;
      if (drag.moved) {
        G.cam.x -= (dx * cssToStage) / G.cam.z;
        G.cam.y -= (dy * cssToStage) / G.cam.z;
        clampCam();
        if (G.cam.z > 1) touchedCamera();
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
    }
  });

  function endPointer(e, cancelled) {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    const wasTap = drag && !drag.moved;
    drag = null;
    if (wasTap && !cancelled && touches.size === 0) {
      const w = toWorld(e);
      G.clickWorld(w.x, w.y);
    }
  }
  canvas.addEventListener("pointerup", (e) => endPointer(e, false));
  canvas.addEventListener("pointercancel", (e) => endPointer(e, true));
  canvas.addEventListener("pointerleave", () => { G.aim = null; });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const s = toStage(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), s.x, s.y);
    touchedCamera();
  }, { passive: false });
  // Safari's own page pinch would otherwise take over from the game's zoom.
  ["gesturestart", "gesturechange", "gestureend"].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
  document.addEventListener("dblclick", (e) => e.preventDefault());

  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down"
  };
  window.addEventListener("keydown", (e) => {
    if (KEYMAP[e.code]) { G.keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.code === "Space" && G.mode === "play") { e.preventDefault(); CTC.audio.init(); if (!e.repeat) G.autoThrow(); }
    if (e.code === "KeyF" && G.mode === "play" && !e.repeat) { CTC.audio.init(); CTC.ui.toggleFood(); }
    if (e.code === "KeyM" && G.mode === "play") CTC.ui.toggleMissions();
    if (e.code === "KeyO" && G.mode === "play") CTC.ui.togglePanel();
    if (e.code === "KeyT" && G.mode === "play") CTC.ui.toggleTop();
    if (e.code === "KeyU" && G.mode === "play") document.getElementById("btnUpgrades").click();
    if (e.code === "Escape" && (G.mode === "play" || G.mode === "paused")) CTC.ui.toggleMenu();
  });
  window.addEventListener("keyup", (e) => { if (KEYMAP[e.code]) G.keys[KEYMAP[e.code]] = false; });
  window.addEventListener("blur", () => { G.keys = {}; });
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  // Browsers only allow a landscape lock in full screen, after a tap. Some phones refuse, and
  // then the turn-your-phone screen still applies.
  function lockLandscape() {
    if (!window.matchMedia("(pointer: coarse)").matches || location.protocol === "file:") return;
    const el = document.documentElement;
    const full = el.requestFullscreen ? el.requestFullscreen() : Promise.reject();
    full.then(() => screen.orientation.lock("landscape")).catch(() => {});
  }
  document.addEventListener("pointerup", lockLandscape, { once: true });
  if (window.matchMedia("(pointer: coarse)").matches) {
    document.getElementById("helpMouse").classList.add("hidden");
    document.getElementById("helpTouch").classList.remove("hidden");
  }
  // Installing and offline play need a web address, so skip this when opened as a file.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && G.mode !== "title") G.save(); });
  window.addEventListener("beforeunload", () => { if (G.mode !== "title") G.save(); });
  setInterval(() => { if (G.mode === "play") G.save(); }, 5000);

  // The title screen shows the saved level, or the first level for new players.
  CTC.render.init(canvas);
  const saved = G.loadSave();
  G.startLevel(saved || G.freshSave(0));
  CTC.ui.init();
  fit();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.mode !== "paused" && !CTC.manualStep && !portrait) G.update(dt);
    followPlayer();
    CTC.render.draw();
    CTC.ui.update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
