/* Draws the whole scene each frame. Static ground is cached in offscreen layers. */
(function () {
  const G = CTC.game, Art = CTC.art, L = CTC.LAYOUT;
  const W = L.width, H = L.height;
  const R = (CTC.render = { scale: 1 });
  let canvas, c, waterLayer, landLayer, vignette, builtFor = null;
  let snow = [];

  R.init = function (el) {
    canvas = el;
    c = canvas.getContext("2d");
    for (let i = 0; i < 70; i++) snow.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random(), p: Math.random() * 6 });
    G.on("levelChanged", () => { builtFor = null; });
  };

  R.resize = function (scale) {
    R.scale = Math.min(2.5, scale * (window.devicePixelRatio || 1));
    canvas.width = Math.round(W * R.scale);
    canvas.height = Math.round(H * R.scale);
    builtFor = null;
  };

  function layer() {
    const l = document.createElement("canvas");
    l.width = canvas.width;
    l.height = canvas.height;
    const x = l.getContext("2d");
    x.scale(R.scale, R.scale);
    return { el: l, c: x };
  }

  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function shorePath(x, offset) {
    x.moveTo(G.shoreX(-10) + offset, -10);
    for (let y = 0; y <= H + 10; y += 10) x.lineTo(G.shoreX(y) + offset, y);
  }

  function buildLayers() {
    const lv = G.level(), T = lv.theme;
    const rnd = seeded(lv.id.length * 977 + 13);

    /* Water */
    const wl = layer(), w = wl.c;
    const g = w.createLinearGradient(0, 0, 520, 0);
    g.addColorStop(0, T.deep);
    g.addColorStop(0.62, T.mid);
    g.addColorStop(0.96, T.shallow);
    w.fillStyle = g;
    w.fillRect(0, 0, W, H);
    for (let i = 0; i < 55; i++) {
      const x = rnd() * 480, y = rnd() * H, r = 8 + rnd() * 26;
      if (T.seabed === "rock") {
        w.fillStyle = "rgba(8,40,70," + (0.06 + rnd() * 0.1) + ")";
        w.beginPath();
        w.ellipse(x, y, r, r * 0.65, rnd(), 0, Math.PI * 2);
        w.fill();
      } else if (T.seabed === "coral") {
        w.fillStyle = ["rgba(255,120,150,.28)", "rgba(255,190,110,.26)", "rgba(190,110,230,.25)"][i % 3];
        for (let k = 0; k < 5; k++) {
          w.beginPath();
          w.arc(x + (rnd() - 0.5) * r * 1.6, y + (rnd() - 0.5) * r, r * 0.3 * (0.6 + rnd()), 0, Math.PI * 2);
          w.fill();
        }
      } else {
        w.fillStyle = "rgba(235,250,255," + (0.04 + rnd() * 0.08) + ")";
        w.beginPath();
        w.moveTo(x - r, y);
        w.lineTo(x - r * 0.3, y - r * 0.7);
        w.lineTo(x + r, y - r * 0.2);
        w.lineTo(x + r * 0.5, y + r * 0.6);
        w.closePath();
        w.fill();
      }
    }
    waterLayer = wl.el;

    /* Land */
    const ll = layer(), l = ll.c;
    l.beginPath();
    shorePath(l, 0);
    l.lineTo(W + 10, H + 10);
    l.lineTo(W + 10, -10);
    l.closePath();
    l.fillStyle = T.sand;
    l.fill();
    l.save();
    l.clip();
    // Wet sand along the waterline
    l.beginPath();
    shorePath(l, 9);
    l.strokeStyle = T.sandDark;
    l.lineWidth = 26;
    l.globalAlpha = 0.65;
    l.stroke();
    l.globalAlpha = 1;
    // Inland ground
    l.beginPath();
    l.moveTo(790, -10);
    for (let y = 0; y <= H + 10; y += 20) l.lineTo(740 + 24 * Math.sin(y * 0.018) + 10 * Math.sin(y * 0.07), y);
    l.lineTo(W + 10, H + 10);
    l.lineTo(W + 10, -10);
    l.closePath();
    l.fillStyle = T.ground;
    l.fill();
    for (let i = 0; i < 1700; i++) {
      const x = 430 + rnd() * 860, y = rnd() * H;
      const inland = x > 760;
      l.fillStyle = inland ? T.groundDark : T.sandDark;
      l.globalAlpha = 0.25 + rnd() * 0.45;
      if (inland) { l.fillRect(x, y, 2, 4 + rnd() * 5); }
      else { l.beginPath(); l.arc(x, y, rnd() * 1.7, 0, Math.PI * 2); l.fill(); }
    }
    l.globalAlpha = 1;
    // Footpath customers walk on
    l.strokeStyle = T.path;
    l.lineWidth = 58;
    l.lineCap = "round";
    l.beginPath();
    l.moveTo(1320, L.queue.y + 3);
    l.lineTo(860, L.queue.y + 3);
    l.stroke();
    l.setLineDash([9, 13]);
    l.lineWidth = 3;
    l.strokeStyle = "rgba(255,255,255,.35)";
    l.beginPath();
    l.moveTo(1320, L.queue.y + 3);
    l.lineTo(860, L.queue.y + 3);
    l.stroke();
    l.setLineDash([]);
    // Flowers or pebbles
    for (let i = 0; i < 60; i++) {
      const x = 790 + rnd() * 480, y = 200 + rnd() * 510;
      if (Math.abs(y - L.queue.y) < 46) continue;
      l.fillStyle = T.decor === "pine" ? "rgba(150,180,205,.6)" : ["#fff", "#ffd34d", "#ff8fa3", "#c7a7ff"][i % 4];
      l.beginPath();
      l.arc(x, y, 2.4, 0, Math.PI * 2);
      l.fill();
    }
    l.restore();
    // Pier, with planks and posts
    const p = L.pier;
    l.fillStyle = "rgba(5,30,50,.28)";
    l.fillRect(p.x0, p.y1 - 2, p.x1 - p.x0, 11);
    l.fillStyle = "#6e4426";
    for (let x = p.x0 + 16; x < p.x1 - 40; x += 62) {
      l.fillRect(x, p.y0 - 8, 9, 12);
      l.fillRect(x, p.y1 - 2, 9, 18);
    }
    l.fillStyle = "#b9834c";
    l.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    l.fillStyle = "rgba(70,40,20,.35)";
    for (let x = p.x0 + 2; x < p.x1; x += 15) l.fillRect(x, p.y0, 1.6, p.y1 - p.y0);
    l.fillStyle = "rgba(255,240,210,.14)";
    l.fillRect(p.x0, p.y0, p.x1 - p.x0, 6);
    landLayer = ll.el;

    /* Vignette */
    const vl = layer();
    const vg = vl.c.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(5,20,35,.34)");
    vl.c.fillStyle = vg;
    vl.c.fillRect(0, 0, W, H);
    if (T.tint) { vl.c.fillStyle = T.tint; vl.c.fillRect(0, 0, W, H); }
    vignette = vl.el;

    builtFor = lv.id;
  }

  function drawWater(t, T) {
    c.drawImage(waterLayer, 0, 0, W, H);
    // Sun rays drifting through the water
    c.save();
    c.globalAlpha = 0.07;
    c.fillStyle = "#fff";
    for (let i = 0; i < 6; i++) {
      const x = ((i * 110 + t * 8) % 720) - 120;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 46, 0);
      c.lineTo(x - 90, H);
      c.lineTo(x - 175, H);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawShimmer(t) {
    c.save();
    c.strokeStyle = "rgba(255,255,255,.24)";
    c.lineWidth = 2;
    c.lineCap = "round";
    for (let i = 0; i < 30; i++) {
      const y = (i * 25 + t * 5) % H;
      const base = ((i * 149) % 430) + Math.sin(t * 0.5 + i) * 22;
      const len = 26 + (i % 5) * 7;
      if (base + len > G.shoreX(y) - 12) continue;
      c.globalAlpha = 0.4 + 0.5 * Math.sin(t * 1.6 + i * 1.7) ** 2;
      c.beginPath();
      c.moveTo(base, y);
      c.quadraticCurveTo(base + len / 2, y + 4 * Math.sin(t * 2 + i), base + len, y);
      c.stroke();
    }
    c.restore();
  }

  function drawFoam(t, T) {
    c.save();
    c.strokeStyle = T.foam;
    c.lineCap = "round";
    [[0, 5, 0.85], [1.9, 14, 0.45], [3.6, 25, 0.22]].forEach((f) => {
      c.globalAlpha = f[2];
      c.lineWidth = 4;
      c.beginPath();
      for (let y = -6; y <= H + 6; y += 12) {
        const surge = Math.sin(t * 0.9 + f[0]) * 7 + Math.sin(y * 0.05 + t * 1.4 + f[0]) * 3;
        const x = G.shoreX(y) - f[1] + surge;
        if (y === -6) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    });
    c.restore();
  }

  const BELT_LOOKS = [
    { rail: "#5e6b78", bed: "#343d47", link: "#ffc531" },
    { rail: "#7f8e9c", bed: "#2d3640", link: "#5fe08a" },
    { rail: "#a7b7c4", bed: "#26303a", link: "#4fc3ff" },
    { rail: "#d4dde4", bed: "#232033", link: "#c58bff" },
    { rail: "#ffc531", bed: "#1d1b2a", link: "#ff7a5c" }
  ];

  function drawBelt(t, P, items, lv, speed, cooked) {
    const look = BELT_LOOKS[lv] || BELT_LOOKS[0];
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    const line = () => { c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); };
    c.strokeStyle = "rgba(20,30,40,.28)";
    c.lineWidth = 34;
    c.translate(0, 4);
    line();
    c.stroke();
    c.translate(0, -4);
    c.strokeStyle = cooked ? "#8c5a3c" : look.rail;
    c.lineWidth = 32;
    line();
    c.stroke();
    c.strokeStyle = look.bed;
    c.lineWidth = 24;
    line();
    c.stroke();
    // Moving chain links
    c.strokeStyle = cooked && lv === 0 ? "#ff8a3c" : look.link;
    c.lineWidth = 15;
    c.lineCap = "butt";
    c.setLineDash([5, 15]);
    c.lineDashOffset = -t * speed;
    line();
    c.stroke();
    c.restore();
    items.forEach((b) => {
      const pt = G.pointOnPath(P, b.d);
      const def = G.level().fish[b.species];
      Art.fish(c, pt.x, pt.y - 3, cooked ? Art.cookedDef(def) : def, 0.72, 0, b.d * 0.08);
    });
    if (G.mode === "play") Art.badge(c, P[1][0], (P[1][1] + P[2][1]) / 2, "Lv " + (lv + 1), cooked ? "#b5702c" : "#16324a");
  }

  function drawPad(b, s, t) {
    const spot = L.spots[b.spot];
    const pct = s.paid / b.cost;
    const can = s.cash > 0;
    const pulse = 1 + Math.sin(t * 4) * 0.035;
    c.save();
    c.translate(spot.x, spot.y);
    c.scale(pulse, pulse * 0.72);
    c.fillStyle = can ? "rgba(255,197,49,.3)" : "rgba(255,255,255,.2)";
    c.beginPath();
    c.arc(0, 0, 50, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#fff8e7";
    c.lineWidth = 4;
    c.setLineDash([14, 9]);
    c.lineDashOffset = -t * 22;
    c.beginPath();
    c.arc(0, 0, 50, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    if (pct > 0) {
      c.strokeStyle = "#36c26b";
      c.lineWidth = 9;
      c.lineCap = "round";
      c.beginPath();
      c.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      c.stroke();
    }
    c.restore();
    const left = b.cost - s.paid;
    c.font = "800 14px Trebuchet MS, sans-serif";
    const nameW = c.measureText(b.name).width;
    const w = Math.max(nameW, 50) + 22;
    c.fillStyle = "rgba(13,40,60,.88)";
    Art.rr(c, spot.x - w / 2, spot.y - 22, w, 44, 11);
    c.fill();
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.fillText(b.name, spot.x, spot.y - 4);
    c.font = "900 15px Trebuchet MS, sans-serif";
    c.fillStyle = "#ffd34d";
    c.fillText(G.fmt(Math.ceil(left)), spot.x, spot.y + 14);
  }

  function drawNetThrow(t) {
    const n = G.net;
    if (!n) return;
    const r = G.netRadius();
    const p = G.player;
    let x, y, rad, alpha = 1;
    if (n.phase === "fly") {
      const k = n.t / 0.42;
      x = n.x0 + (n.x - n.x0) * k;
      y = n.y0 + (n.y - n.y0) * k - Math.sin(k * Math.PI) * 95;
      rad = r * (0.25 + 0.75 * k);
    } else if (n.phase === "sink") {
      x = n.x; y = n.y; rad = r * (1 + Math.sin(n.t * 16) * 0.03); alpha = 0.9;
    } else {
      const k = n.t / 0.34;
      x = n.x + (p.x - n.x) * k;
      y = n.y + (p.y - 40 - n.y) * k - Math.sin(k * Math.PI) * 30;
      rad = r * (1 - k * 0.72);
    }
    c.save();
    c.strokeStyle = "rgba(245,235,210,.8)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(p.x + p.face * 12, p.y - 42);
    c.quadraticCurveTo((p.x + x) / 2, Math.min(p.y, y) - 30, x, y);
    c.stroke();
    if (n.phase !== "fly") {
      const held = n.phase === "pull" ? 1 - n.t / 0.34 * 0.6 : 1;
      n.fish.forEach((f) => {
        f.wig += 0.5;
        Art.fish(c, x + f.ox * held, y + f.oy * held, G.level().fish[f.species], 0.9, Math.sin(f.wig * 0.35) * 0.7, f.wig);
      });
    }
    c.globalAlpha = alpha;
    c.translate(x, y);
    c.scale(1, 0.82);
    c.fillStyle = "rgba(245,235,210,.14)";
    c.beginPath();
    c.arc(0, 0, rad, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(245,235,210,.9)";
    c.lineWidth = 1.3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      c.beginPath();
      c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      c.lineTo(-Math.cos(a) * rad, -Math.sin(a) * rad);
      c.stroke();
    }
    for (let k = 1; k <= 3; k++) {
      c.beginPath();
      c.arc(0, 0, (rad * k) / 3, 0, Math.PI * 2);
      c.stroke();
    }
    c.lineWidth = 3;
    c.strokeStyle = "#d9bd7f";
    c.beginPath();
    c.arc(0, 0, rad, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawFood(t) {
    const f = G.food;
    if (!f) return;
    const left = 1 - f.t / f.life;
    c.save();
    // Ripples spreading from the food
    c.strokeStyle = "rgba(255,240,190,.7)";
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.5 + i / 3) % 1;
      c.globalAlpha = (1 - k) * 0.7;
      c.beginPath();
      c.ellipse(f.x, f.y, 20 + k * 90, (20 + k * 90) * 0.72, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // Pellets get eaten as the timer runs down
    c.globalAlpha = 1;
    f.pellets.slice(0, Math.ceil(f.pellets.length * left)).forEach((q) => {
      c.fillStyle = "#b5712c";
      c.beginPath();
      c.arc(f.x + q.ox + Math.sin(t + q.p) * 3, f.y + q.oy + Math.cos(t * 1.3 + q.p) * 2, q.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#e7b061";
      c.beginPath();
      c.arc(f.x + q.ox + Math.sin(t + q.p) * 3 - 0.7, f.y + q.oy + Math.cos(t * 1.3 + q.p) * 2 - 0.7, q.r * 0.45, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
    Art.badge(c, f.x, f.y - 54, Math.ceil(f.life - f.t) + "s", "#b5712c");
  }

  function drawFoodAim(a) {
    c.save();
    c.translate(a.x, a.y);
    c.scale(1, 0.72);
    c.fillStyle = "rgba(231,176,97,.25)";
    c.strokeStyle = a.reach ? "#ffe0a3" : "rgba(255,224,163,.5)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 34, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }

  function drawAim(t) {
    const a = G.aim;
    if (a && a.water && G.foodArmed && G.mode === "play") { drawFoodAim(a); return; }
    if (!a || !a.water || G.net || G.mode !== "play") return;
    const r = G.netRadius();
    c.save();
    c.translate(a.x, a.y);
    c.scale(1, 0.82);
    c.strokeStyle = a.reach ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.35)";
    c.lineWidth = 2.5;
    c.setLineDash([10, 8]);
    c.lineDashOffset = -t * 30;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawStack(p, t) {
    const s = G.s, defs = G.level().fish;
    const n = Math.min(s.carried.length, 20);
    const sway = (p.moving ? Math.sin(p.walk) * 0.8 : Math.sin(t * 2) * 0.2);
    let rise = 0;
    for (let i = 0; i < n; i++) {
      const def = defs[s.carried[i]] || defs[0];
      rise += 7 * Math.max(0.8, def.size * 0.8);
      Art.fish(c, p.x - p.face * 4 + sway * i * 0.55, p.y - 73 - rise, def, 0.68, p.face < 0 ? Math.PI : 0, 0);
    }
    s.cookedBag.slice(0, 20 - n).forEach((sp, j) => {
      const def = Art.cookedDef(defs[sp] || defs[0]);
      rise += 7 * Math.max(0.8, def.size * 0.8);
      Art.fish(c, p.x - p.face * 4 + sway * (n + j) * 0.55, p.y - 73 - rise, def, 0.68, p.face < 0 ? Math.PI : 0, 0);
    });
    s.seaBag.slice(0, Math.max(0, 20 - n - s.cookedBag.length)).forEach((kind, j) => {
      rise += 11;
      CTC.sea.drawCreature(c, kind, p.x - p.face * 4 + sway * (n + j) * 0.55, p.y - 73 - rise, 0.55, t, p.face);
    });
    if (G.bagCount()) {
      const full = G.bagCount() >= G.bagCap();
      Art.badge(c, p.x + 28, p.y - 76, G.bagCount() + "/" + G.bagCap(), full ? "#e4574c" : "#16324a");
    }
  }

  function drawBubble(cu, defs) {
    if (cu.state === "leave") return;
    const x = cu.x, y = cu.y - 92;
    c.fillStyle = "#fff";
    Art.rr(c, x - 22, y - 15, 44, 28, 10);
    c.fill();
    c.beginPath();
    c.moveTo(x - 5, y + 12);
    c.lineTo(x + 4, y + 20);
    c.lineTo(x + 6, y + 12);
    c.fill();
    Art.fish(c, x - 8, y - 1, cu.cooked ? Art.cookedDef(defs[3]) : defs[0], 0.55, 0, 0);
    c.fillStyle = "#16324a";
    c.font = "800 13px Trebuchet MS, sans-serif";
    c.textAlign = "center";
    c.fillText("x" + cu.want, x + 12, y + 4);
    // Patience meter
    if (cu.patience < 14) {
      c.fillStyle = "#e4574c";
      c.fillRect(x - 18, y + 8, 36 * Math.max(0, cu.patience / 14), 2.5);
    }
  }

  function drawTree(tr, t, fn) {
    if (tr.state === "stump") { Art.stump(c, tr.x, tr.y); return; }
    c.save();
    c.translate(tr.x, tr.y);
    if (tr.state === "fall") {
      c.rotate(tr.dir * tr.t * tr.t * 1.5);
      c.globalAlpha = 1 - Math.max(0, tr.t - 0.6) / 0.4;
    } else if (tr.state === "grow") {
      c.scale(0.2 + 0.8 * tr.t, 0.2 + 0.8 * tr.t);
    } else if (tr.shake > 0) {
      c.rotate(Math.sin(tr.shake * 26) * 0.05 * tr.shake);
    }
    fn(c, 0, 0, t, tr.i);
    c.restore();
    if (tr.state === "up" && tr.hp < CTC.COOKING.logsPerTree) {
      const n = CTC.COOKING.logsPerTree;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i < tr.hp ? "#36c26b" : "rgba(13,40,60,.5)";
        c.fillRect(tr.x - (n * 11) / 2 + i * 11, tr.y + 8, 9, 4);
      }
    }
  }

  function drawDecor(list, t, decor) {
    const fn = decor === "palm" ? Art.palm : decor === "pine" ? Art.pine : Art.coralTree;
    G.trees.forEach((tr) => list.push({ y: tr.y, draw: () => drawTree(tr, t, fn) }));
  }

  function drawHotPad(next, t) {
    const H = L.hotPad, can = G.s.cash >= next.cost;
    const pulse = 1 + Math.sin(t * 4) * 0.03;
    c.save();
    c.translate(H.x, H.y);
    c.scale(pulse, pulse * 0.72);
    c.fillStyle = can ? "rgba(255,138,60,.34)" : "rgba(255,255,255,.18)";
    c.strokeStyle = "#ffe0a3";
    c.lineWidth = 3;
    c.setLineDash([9, 8]);
    c.lineDashOffset = -t * 18;
    c.beginPath();
    c.arc(0, 0, 44, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    c.font = "800 13px Trebuchet MS, sans-serif";
    const w = Math.max(c.measureText(next.name).width, 60) + 20;
    c.fillStyle = "rgba(90,40,15,.9)";
    Art.rr(c, H.x - w / 2, H.y - 20, w, 40, 10);
    c.fill();
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.fillText(next.name, H.x, H.y - 4);
    c.fillStyle = "#ffd34d";
    c.fillText(G.fmt(next.cost), H.x, H.y + 13);
  }

  function drawFirePad(t) {
    const F = L.fire, C = CTC.COOKING, s = G.s;
    const ready = s.wood >= C.buildWood && s.cash >= G.fireCash();
    const pulse = 1 + Math.sin(t * 4) * 0.03;
    c.save();
    c.translate(F.x, F.y);
    c.scale(pulse, pulse * 0.72);
    c.fillStyle = ready ? "rgba(255,138,60,.34)" : "rgba(255,255,255,.18)";
    c.strokeStyle = "#ffe0a3";
    c.lineWidth = 3;
    c.setLineDash([9, 8]);
    c.lineDashOffset = -t * 18;
    c.beginPath();
    c.arc(0, 0, 44, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    const line = C.buildWood + " wood + " + G.fmt(G.fireCash());
    c.font = "800 13px Trebuchet MS, sans-serif";
    const w = Math.max(c.measureText(line).width, 60) + 20;
    c.fillStyle = "rgba(90,40,15,.9)";
    Art.rr(c, F.x - w / 2, F.y - 20, w, 40, 10);
    c.fill();
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.fillText("Fireplace", F.x, F.y - 4);
    c.fillStyle = "#ffd34d";
    c.fillText(line, F.x, F.y + 13);
  }

  // Shows how many fish each catcher lands, plus a blue arrow when an upgrade is affordable.
  function drawCatcherTags(t) {
    G.stallChips().forEach((b, i) => {
      const y = b.y + Math.sin(t * 5 + i) * 1.5;
      if (b.text) Art.badge(c, b.x, y, b.text, "#1a8f4a");
      else Art.upgradeArrow(c, b.x, y);
    });
    G.catchers().forEach((m) => {
      const lv = G.catcherLv(m);
      const chip = G.chipPos(m);
      if (m.type === "rig") Art.badge(c, m.x, m.y - 74, lv + " fish", lv > 1 ? "#2f7fd6" : "#16324a");
      else Art.badge(c, m.bx + 42, m.by - 30, "x" + lv, lv > 1 ? "#2f7fd6" : "#16324a");
      if (G.chipVisible(m)) Art.upgradeArrow(c, chip.x, chip.y + Math.sin(t * 5 + m.index) * 2);
    });
  }

  function drawWeather(t, T) {
    if (!T.weather) return;
    snow.forEach((f) => {
      const snowy = T.weather === "snow";
      const y = (f.y + t * (snowy ? 40 : 18) * f.s) % H;
      const x = (f.x + Math.sin(t * 0.8 + f.p) * 26 + (snowy ? 0 : t * 14 * f.s)) % W;
      c.fillStyle = snowy ? "rgba(255,255,255,.85)" : "rgba(255,190,205,.8)";
      c.beginPath();
      if (snowy) c.arc(x, y, 1.1 + f.s * 1.3, 0, Math.PI * 2);
      else c.ellipse(x, y, 3.4, 1.9, t + f.p, 0, Math.PI * 2);
      c.fill();
    });
  }

  function drawGuideArrow(t) {
    if (G.mode !== "play") return;
    const g = G.guide();
    if (g.x === undefined) return;
    const y = g.y - 44 + Math.sin(t * 6) * 7;
    c.fillStyle = "#ffc531";
    c.strokeStyle = "#16324a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(g.x - 10, y - 26);
    c.lineTo(g.x + 10, y - 26);
    c.lineTo(g.x + 10, y - 8);
    c.lineTo(g.x + 21, y - 8);
    c.lineTo(g.x, y + 15);
    c.lineTo(g.x - 21, y - 8);
    c.lineTo(g.x - 10, y - 8);
    c.closePath();
    c.fill();
    c.stroke();
  }

  R.draw = function () {
    if (!G.s) return;
    if (builtFor !== G.level().id) buildLayers();
    const t = G.time, s = G.s, lv = G.level(), T = lv.theme, defs = lv.fish, p = G.player;
    const cam = G.cam, view = R.scale * cam.z;
    c.setTransform(view, 0, 0, view, -cam.x * view, -cam.y * view);
    if (G.shake > 0) c.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);

    drawWater(t, T);
    // Fish silhouettes and bodies under the surface
    G.fish.forEach((f) => {
      const def = defs[f.species];
      const a = Math.abs(f.vx) + Math.abs(f.vy) < 4 ? 0 : Math.atan2(f.vy, f.vx);
      c.globalAlpha = 0.18;
      c.fillStyle = "#04263c";
      c.beginPath();
      c.ellipse(f.x + 4, f.y + 8, 13 * def.size, 5 * def.size, a, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = f.fade === undefined ? 1 : f.fade;
      Art.fish(c, f.x, f.y, def, f.jit || 1, a, f.wig);
      c.globalAlpha = 1;
      if (def.rare && Math.sin(t * 4 + f.wig) > 0.6) G.burst(f.x, f.y, 1, ["#fff", "#ffe46b"], 26, 0, 0.5);
    });
    drawShimmer(t);
    drawFood(t);

    const shipX = L.ship.x - (G.mode === "sailing" ? Math.pow(G.sailT, 2) * 62 : 0);
    Art.ship(c, shipX, L.ship.y, t);
    CTC.sea.drawWater(c, t);
    G.machines.forEach((m) => { if (m.type === "boat") Art.boat(c, m, t, T); });

    c.drawImage(landLayer, 0, 0, W, H);
    drawFoam(t, T);

    if (G.has("chain")) drawBelt(t, L.beltPath, G.belt, s.upg.belt, G.beltSpeed(), false);
    if (s.feedBelt) drawBelt(t, L.feedBeltPath, G.feedItems, s.upg.feed, G.feedBeltSpeed(), false);
    if (s.hotBelt) drawBelt(t, L.hotBeltPath, G.hotBeltItems, s.upg.hotBelt, G.hotBeltSpeed(), true);
    CTC.sea.drawGround(c);
    const next = G.nextBuild();
    if (next && !s.campaignDone) drawPad(next, s, t);
    if (!s.fire && G.cookingUnlocked()) drawFirePad(t);
    const hotNext = G.hotNext();
    if (hotNext) drawHotPad(hotNext, t);

    // Stall sales zone marker
    const z = L.stallZone;
    c.save();
    c.translate(z.x, z.y);
    c.scale(1, 0.55);
    c.strokeStyle = "rgba(255,255,255,.55)";
    c.lineWidth = 3;
    c.setLineDash([8, 8]);
    c.beginPath();
    c.arc(0, 0, z.r - 12, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    if (s.fire) {
      const sz = L.shopZone;
      c.save();
      c.translate(sz.x, sz.y);
      c.scale(1, 0.55);
      c.strokeStyle = "rgba(255,224,163,.75)";
      c.lineWidth = 3;
      c.setLineDash([8, 8]);
      c.beginPath();
      c.arc(0, 0, sz.r - 8, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    // Depth sort everything standing on land
    const list = [];
    drawDecor(list, t, T.decor);
    CTC.sea.addDepth(list, c, t);
    const hotSellers = Array.from({ length: G.hotSellerCount() }, (_, i) => ({ look: Art.sellerLooks[i], face: 1, idle: t + i * 2, moving: false, joy: 0 }));
    if (s.fire) list.push({ y: L.shop.y, draw: () => Art.foodShop(c, L.shop.x, L.shop.y, t, s.cookedStock, defs, hotSellers, s.upg.hotCart, G.hotCap()) });
    if (s.fire) list.push({ y: L.fire.y, draw: () => Art.fireplace(c, L.fire.x, L.fire.y, t, s.grill, G.cookTime(), defs, s.cookedPile, s.grill.length > 0, s.wood) });
    list.push({ y: L.crate.y, draw: () => Art.crate(c, L.crate.x, L.crate.y, s.crate, defs, s.crate.length) });
    const sellers = Array.from({ length: G.sellerCount() }, (_, i) => ({ look: Art.sellerLooks[i], face: 1, idle: t + i, moving: false, joy: 0 }));
    list.push({ y: L.stall.y, draw: () => Art.stall(c, L.stall, t, T, s.stock, defs, sellers, s.upg.cart, G.stockCap()) });
    G.machines.forEach((m) => { if (m.type === "rig") list.push({ y: m.y, draw: () => Art.rig(c, m, t) }); });
    G.customers.concat(G.diners).forEach((cu) => {
      list.push({ y: cu.y, draw: () => { cu.idle = t + cu.walk; Art.person(c, cu.x, cu.y, cu); drawBubble(cu, defs); } });
    });
    G.cutters.forEach((w) => list.push({
      y: w.y,
      draw: () => {
        Art.person(c, w.x, w.y, { look: w.look, face: w.face, walk: w.walk, moving: w.moving, idle: t, throwing: w.chopping });
        if (w.chopping) Art.axe(c, w.x + w.face * 18, w.y - 38, Math.min(1, w.chopT / CTC.COOKING.cutterChop), w.face);
      }
    }));
    list.push({
      y: p.y,
      draw: () => {
        const o = { look: Art.playerLook, face: p.face, walk: p.walk, moving: p.moving, idle: t, throwing: p.throwT > 0 };
        Art.person(c, p.x, p.y, o);
        if (p.chopping) Art.axe(c, p.x + p.face * 18, p.y - 38, Math.min(1, G.chopT / CTC.COOKING.chopTime), p.face);
        drawStack(p, t);
      }
    });
    list.sort((a, b) => a.y - b.y);
    list.forEach((e) => e.draw());

    if (G.mode === "play") drawCatcherTags(t);

    drawNetThrow(t);
    drawAim(t);

    // Flying fish and coins
    G.flyers.forEach((f) => {
      const k = Math.min(1, f.t / f.dur);
      const x = f.x0 + (f.x1 - f.x0) * k;
      const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * f.h;
      if (f.kind === "coin") Art.coin(c, x, y, 8, t + f.dur);
      else if (f.kind === "food") {
        c.fillStyle = "#b5712c";
        for (let i = 0; i < 7; i++) {
          c.beginPath();
          c.arc(x + Math.cos(i * 2.4) * (4 + 16 * k), y + Math.sin(i * 2.4) * (3 + 10 * k), 2.6, 0, Math.PI * 2);
          c.fill();
        }
      }
      else if (f.kind === "sea") CTC.sea.drawCreature(c, f.creature, x, y, 0.7, t, 1);
      else if (f.kind === "log") {
        c.save();
        c.translate(x, y);
        c.rotate(k * 8);
        c.fillStyle = "#8c6239";
        Art.rr(c, -11, -4, 22, 8, 3);
        c.fill();
        c.restore();
      } else Art.fish(c, x, y, f.cooked ? Art.cookedDef(defs[f.species]) : defs[f.species], 0.8, k * 7, t * 20);
    });

    // Particles
    G.particles.forEach((q) => {
      const k = 1 - q.t / q.life;
      if (q.ring) {
        c.globalAlpha = k * 0.75;
        c.strokeStyle = q.c;
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(q.x, q.y, q.r * (1.2 - k), q.r * 0.72 * (1.2 - k), 0, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.globalAlpha = k;
        c.fillStyle = q.c;
        c.beginPath();
        c.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        c.fill();
      }
    });
    c.globalAlpha = 1;

    drawWeather(t, T);
    c.drawImage(vignette, 0, 0, W, H);
    drawGuideArrow(t);

    // Floating text sits above the vignette so it stays readable
    c.textAlign = "center";
    G.floats.forEach((f) => {
      c.globalAlpha = Math.min(1, (1.1 - f.t) * 3);
      c.font = "900 " + f.size + "px Trebuchet MS, sans-serif";
      c.lineWidth = 4;
      c.strokeStyle = "rgba(13,40,60,.85)";
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    });
    c.globalAlpha = 1;
  };
})();
