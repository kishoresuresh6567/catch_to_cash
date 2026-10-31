/* The Sea Farm: a fence in the sea full of sea creatures, sold at a Cloud Kitchen and a Hotel.
   It unlocks in each place once only the ship is left to buy. Data is in CTC.SEA in levels.js. */
(function () {
  const G = CTC.game, S = CTC.SEA;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const Sea = (CTC.sea = {});

  /* ---------- rules ---------- */
  G.seaUnlocked = () => !!G.s && G.s.built >= G.level().builds.length - 1;
  Sea.cost = (b) => b.cost * G.level().costScale;
  Sea.locked = (b) => (b.needs || []).some((n) => !G.s[n]);
  Sea.canBuy = (b) => G.seaUnlocked() && !G.s[b.id] && !Sea.locked(b) && G.s.cash >= Sea.cost(b);
  Sea.value = (kind, venue) => {
    const lvl = G.s.upg[S.venues[venue].upgrade];
    return Math.round(S.creatures[kind].value * G.level().costScale * S.venues[venue].priceMult * (1 + 0.2 * lvl));
  };
  Sea.stockCap = (venue) => 20 + 10 * G.s.upg[S.venues[venue].upgrade];
  Sea.carry = (venue) => S.runnerCarry + S.carryPerUpgrade * (G.s.upg[S.venues[venue].runners] - 1);
  const penCap = () => 8 + 4 * G.s.upg.fenceSize;
  Sea.extraFish = () => (G.s.fence ? 10 + 5 * G.s.upg.fenceSize : 0);

  Sea.buy = function (id) {
    const b = S.builds.find((x) => x.id === id);
    if (!b || !Sea.canBuy(b)) return false;
    const at = b.at;
    G.s.cash -= Sea.cost(b);
    G.s[id] = true;
    G.stat("build_" + id);
    G.burst(at[0], at[1], 40, ["#ffe46b", "#fff", "#9fe8b8"], 220, 340, 1.1);
    G.shake = 4;
    CTC.audio.play("build");
    G.emit("toast", b.name + ": " + b.says);
    G.save();
    return true;
  };

  // Green buttons with words and a price the first time. After that, an arrow above the first delivery person.
  Sea.chips = function () {
    const chips = S.builds.filter(Sea.canBuy).map((b) => ({ sea: true, id: b.id, x: b.at[0], y: b.at[1], text: "\u25B2 " + b.name + ": " + G.fmt(Sea.cost(b)) }));
    Object.keys(S.venues).forEach((v) => {
      const V = S.venues[v], u = CTC.UPGRADES.find((x) => x.id === V.runners), lvl = G.s.upg[u.id];
      if (!G.seaUnlocked() || lvl >= u.max || G.upgradeLocked(u) || G.s.cash < G.upgradeCost(u)) return;
      const first = G.runners[v][0];
      if (lvl === 0) chips.push({ id: u.id, x: V.hireAt[0], y: V.hireAt[1], text: "\u25B2 " + V.label + " delivery person: " + G.fmt(G.upgradeCost(u)) });
      else if (first) chips.push({ id: u.id, x: first.x, y: Math.max(20, first.y - 76) });
    });
    return chips;
  };

  Sea.onUpgrade = function (id) {
    const v = Object.keys(S.venues).find((k) => S.venues[k].runners === id);
    if (!v) return;
    G.burst(S.pickup.x, S.pickup.y - 30, 24, ["#ffe46b", "#fff", "#9fe8b8"], 170);
    if (G.s.upg[id] === 1) G.emit("toast", S.venues[v].label + " delivery person hired: creatures now get carried from the fence.");
  };

  // Everything needed before the ship appears, in order.
  Sea.steps = function () {
    const builds = S.builds.map((b) => ({ name: b.name, cost: Sea.cost(b), done: !!G.s[b.id], buy: () => Sea.buy(b.id) }));
    const people = Object.keys(S.venues).map((v) => {
      const u = CTC.UPGRADES.find((x) => x.id === S.venues[v].runners);
      return { name: u.name, cost: u.base * G.level().costScale, done: G.s.upg[u.id] > 0, buy: () => G.buyUpgrade(u.id) };
    });
    return builds.concat(people);
  };
  Sea.ready = () => Sea.steps().every((x) => x.done);

  function rollKind() {
    const list = Object.keys(S.creatures);
    let r = Math.random() * list.reduce((a, k) => a + S.creatures[k].weight, 0);
    for (const k of list) { r -= S.creatures[k].weight; if (r <= 0) return k; }
    return list[0];
  }
  const penPoint = () => ({ x: rand(S.pen.x0 + 22, S.pen.x1 - 22), y: rand(S.pen.y0 + 22, S.pen.y1 - 22) });
  function spawn() {
    const at = penPoint(), to = penPoint();
    G.pen.push({ kind: rollKind(), x: at.x, y: at.y, tx: to.x, ty: to.y, face: 1, wig: rand(0, 6) });
  }

  // Takes the best creatures under the net. They can't be caught until there's somewhere to sell them.
  Sea.netCatch = function (x, y, r, room) {
    const inReach = G.pen.filter((f) => dist(f.x, f.y, x, y) < r);
    if (!inReach.length) return [];
    if (!G.s.kitchen && !G.s.hotel) {
      G.float(x, y - 40, "Build a Cloud Kitchen or Hotel first", "#ffe0a3", 18);
      return [];
    }
    const caught = inReach.sort((a, b) => S.creatures[b.kind].value - S.creatures[a.kind].value).slice(0, Math.max(0, room));
    G.pen = G.pen.filter((f) => !caught.includes(f));
    return caught.map((f) => f.kind);
  };

  /* ---------- simulation ---------- */
  Sea.update = function (dt) {
    const s = G.s;
    if (G.seaUnlocked() && !s.seaToast) {
      s.seaToast = true;
      G.emit("toast", "New in Upgrades: build a Sea Fence, Cloud Kitchen and Hotel with delivery people to unlock the ship!");
    }
    if (Sea.ready() && !s.shipToast && s.built < G.level().builds.length) {
      s.shipToast = true;
      G.emit("toast", "Your Cloud Kitchen and Hotel are running. You can buy the ship now!");
    }
    if (!s.fence) return;
    G.penTimer -= dt;
    if (G.pen.length < penCap() && G.penTimer <= 0) {
      spawn();
      G.penTimer = G.pen.length < 6 ? 0.15 : 1.4 / (1 + 0.5 * s.upg.fenceSize);
    }
    G.pen.forEach((f) => {
      const C = S.creatures[f.kind];
      f.wig += dt * 5;
      const d = dist(f.x, f.y, f.tx, f.ty);
      if (d < 6) { const to = penPoint(); f.tx = to.x; f.ty = to.y; return; }
      f.x += ((f.tx - f.x) / d) * C.speed * dt;
      f.y += ((f.ty - f.y) / d) * C.speed * dt;
      f.face = f.tx < f.x ? -1 : 1;
    });
    Object.keys(S.venues).forEach((v) => updateVenue(v, dt));
  };

  function updateVenue(venue, dt) {
    const s = G.s, V = S.venues[venue], p = G.player;
    if (!s[venue]) return;
    const stock = s[V.stock];
    // By hand.
    G.seaTimers[venue + "Hand"] = (G.seaTimers[venue + "Hand"] || 0) - dt;
    if (dist(p.x, p.y, V.zone.x, V.zone.y) < V.zone.r && s.seaBag.length && stock.length < Sea.stockCap(venue) && G.seaTimers[venue + "Hand"] <= 0) {
      const kind = s.seaBag.pop();
      stock.push(kind);
      G.fly({ kind: "sea", creature: kind, x0: p.x, y0: p.y - 55, x1: V.x, y1: V.y - 40, dur: 0.28, h: 40 });
      CTC.audio.play("plop");
      G.seaTimers[venue + "Hand"] = 0.09;
    }
    updateRunners(venue, dt);
    // The staff sell what's in stock.
    G.seaTimers[venue] = (G.seaTimers[venue] || 0) - dt;
    if (stock.length && G.seaTimers[venue] <= 0) {
      const kind = stock.shift();
      G.addCash(Sea.value(kind, venue), V.x + rand(-30, 30), V.y - 70);
      G.stat("seaSold");
      G.seaTimers[venue] = V.sellEvery / (1 + 0.4 * s.upg[V.upgrade]);
    }
  }

  // Delivery people load up at the shore beside the fence, then walk to their building.
  function updateRunners(venue, dt) {
    const s = G.s, V = S.venues[venue], list = G.runners[venue], stock = s[V.stock];
    // One person for each building. Upgrades let them hold more.
    if (!list.length && s.upg[V.runners] > 0) {
      list.push({ x: S.pickup.x, y: S.pickup.y, face: 1, walk: 0, moving: false, load: [], loadT: 0, going: false, look: RUNNER_LOOKS[venue] });
    }
    list.forEach((w) => {
      const spot = w.going ? { x: V.zone.x, y: V.zone.y } : { x: S.pickup.x, y: S.pickup.y + (venue === "hotel" ? 60 : 0) };
      w.moving = false;
      if (dist(w.x, w.y, spot.x, spot.y) > 6) {
        const step = G.nextStep(w, spot.x, spot.y);
        const d = dist(w.x, w.y, step.x, step.y) || 1;
        w.x += ((step.x - w.x) / d) * S.runnerSpeed * dt;
        w.y += ((step.y - w.y) / d) * S.runnerSpeed * dt;
        if (Math.abs(step.x - w.x) > 1) w.face = step.x < w.x ? -1 : 1;
        w.moving = true;
        w.walk += dt * 10;
        return;
      }
      w.loadT -= dt;
      if (w.loadT > 0) return;
      if (w.going) {
        if (w.load.length && stock.length < Sea.stockCap(venue)) {
          const kind = w.load.pop();
          stock.push(kind);
          G.fly({ kind: "sea", creature: kind, x0: w.x, y0: w.y - 55, x1: V.x, y1: V.y - 40, dur: 0.28, h: 40 });
          CTC.audio.play("plop");
          w.loadT = 0.2;
        } else if (!w.load.length) w.going = false;
      } else if (w.load.length >= Sea.carry(venue) || (w.load.length && !G.pen.length)) {
        w.going = true;
      } else if (G.pen.length) {
        const f = G.pen[Math.floor(Math.random() * G.pen.length)];
        G.pen.splice(G.pen.indexOf(f), 1);
        w.load.push(f.kind);
        G.fly({ kind: "sea", creature: f.kind, x0: f.x, y0: f.y, x1: w.x, y1: w.y - 55, dur: 0.35, h: 50 });
        w.loadT = 0.4;
      }
    });
  }

  const RUNNER_LOOKS = {
    kitchen: { skin: "#d9a06e", shirt: "#2f7fd6", pants: "#27384d", hair: "#2b1d14", style: 0, scale: 1 },
    hotel: { skin: "#f6cfa8", shirt: "#ffd21f", pants: "#27384d", hair: "#4a2b18", style: 2, scale: 0.97 }
  };

  /* ---------- drawing ---------- */
  Sea.drawCreature = function (c, kind, x, y, scale, t, face) {
    const C = S.creatures[kind];
    c.save();
    c.translate(x, y);
    c.scale((face || 1) * scale * C.size, scale * C.size);
    CREATURES[kind](c, t, C);
    c.restore();
  };

  function blob(c, x, y, rx, ry, color, a) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, a || 0, 0, Math.PI * 2);
    c.fill();
  }
  function eyes(c, x, y, gap, r) {
    [-gap, gap].forEach((d) => { blob(c, x + d, y, r, r, "#fff"); blob(c, x + d, y, r * 0.5, r * 0.5, "#16324a"); });
  }
  function limb(c, color, width, x0, y0, x1, y1, x2, y2) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(x1, y1, x2, y2);
    c.stroke();
  }

  const CREATURES = {
    prawn(c, t, C) {
      for (let i = 0; i < 4; i++) limb(c, C.dark, 1.6, -4 + i * 4, 3, -5 + i * 4, 8, -6 + i * 4, 10 + Math.sin(t * 8 + i));
      limb(c, C.color, 9, -11, 3, 2, -8, 11, 1);
      limb(c, C.dark, 1.4, 11, -3, 18, -9, 22, -2);
      eyes(c, 10, -3, 0, 2.2);
    },
    starfish(c, t, C) {
      c.fillStyle = C.color;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * 0.8) * 0.05, r = i % 2 ? 6 : 15;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      blob(c, 0, 0, 3, 3, C.dark);
      eyes(c, 0, -3, 3, 1.8);
    },
    jellyfish(c, t, C) {
      for (let i = 0; i < 4; i++) limb(c, C.dark, 2, -8 + i * 5.3, 3, -10 + i * 5.3 + Math.sin(t * 3 + i) * 4, 12, -8 + i * 5.3, 20);
      c.fillStyle = C.color;
      c.beginPath();
      c.arc(0, 2, 14, Math.PI, 0);
      c.closePath();
      c.fill();
      eyes(c, 0, -4, 4, 2);
    },
    squid(c, t, C) {
      for (let i = 0; i < 4; i++) limb(c, C.dark, 2.4, -2 + i * 1.5, 5 - i * 3, -14, 6 - i * 4 + Math.sin(t * 4 + i) * 3, -24, 7 - i * 5);
      blob(c, 5, 0, 15, 7, C.color);
      c.fillStyle = C.color;
      c.beginPath();
      c.moveTo(14, -6); c.lineTo(26, 0); c.lineTo(14, 6);
      c.closePath();
      c.fill();
      blob(c, -4, -2, 2.4, 2.4, "#fff");
      blob(c, -4, -2, 1.2, 1.2, "#16324a");
    },
    lobster(c, t, C) {
      for (let i = 0; i < 3; i++) [-1, 1].forEach((d) => limb(c, C.dark, 2, -6 + i * 5, d * 4, -7 + i * 5, d * 11, -9 + i * 5, d * 13));
      blob(c, -15, 0, 6, 8, C.dark);
      blob(c, -2, 0, 13, 6.5, C.color);
      [-1, 1].forEach((d) => {
        limb(c, C.color, 3.4, 9, d * 4, 16, d * 11, 21, d * 8);
        blob(c, 24, d * 8, 5.5, 4, C.dark, Math.sin(t * 3) * 0.2 * d);
      });
      eyes(c, 9, 0, 3, 1.8);
    },
    octopus(c, t, C) {
      for (let i = 0; i < 6; i++) {
        const x = -11 + i * 4.4;
        limb(c, C.dark, 3.4, x, 4, x * 1.5 + Math.sin(t * 3 + i) * 4, 13, x * 1.9, 20 + Math.cos(t * 3 + i) * 2);
      }
      blob(c, 0, -3, 13, 12, C.color);
      eyes(c, 0, -3, 5, 3);
    },
    shark(c, t, C) {
      const tail = Math.sin(t * 5) * 4;
      c.fillStyle = C.dark;
      c.beginPath();
      c.moveTo(-24, 0); c.lineTo(-38, -10 + tail); c.lineTo(-34, 0); c.lineTo(-38, 10 + tail);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(-3, -8); c.lineTo(4, -20); c.lineTo(9, -7);
      c.closePath();
      c.fill();
      blob(c, 0, 0, 28, 9.5, C.color);
      blob(c, 2, 4, 23, 5, "#e8eef2");
      blob(c, 17, -3, 1.8, 1.8, "#16324a");
      limb(c, "#16324a", 1.2, 15, 4, 20, 6, 25, 3);
    }
  };

  function post(c, x, y) {
    c.fillStyle = "rgba(10,40,60,.28)";
    c.fillRect(x - 3, y + 2, 9, 5);
    c.fillStyle = "#8b5a2b";
    c.fillRect(x - 4, y - 18, 8, 22);
    c.fillStyle = "#b5824a";
    c.fillRect(x - 4, y - 20, 8, 4);
  }

  function drawFence(c) {
    const P = S.pen, GAP = 42;
    c.fillStyle = "rgba(255,255,255,.07)";
    c.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
    c.strokeStyle = "rgba(255,248,231,.85)";
    c.lineWidth = 2.5;
    [-14, -7].forEach((d) => c.strokeRect(P.x0, P.y0 + d, P.x1 - P.x0, P.y1 - P.y0));
    for (let x = P.x0; x <= P.x1; x += GAP) { post(c, x, P.y0); post(c, x, P.y1); }
    for (let y = P.y0 + GAP; y < P.y1; y += GAP) { post(c, P.x0, y); post(c, P.x1, y); }
  }

  function drawKitchen(c, x, y, t, count) {
    CTC.art.shadow(c, x, y + 2, 92, 12, 0.22);
    // Chimney and smoke
    c.fillStyle = "#7a4a34";
    c.fillRect(x + 40, y - 112, 20, 40);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.5 + i / 3) % 1;
      blob(c, x + 50 + Math.sin(k * 6) * 6, y - 116 - k * 34, 5 + k * 7, 5 + k * 7, "rgba(255,255,255," + 0.6 * (1 - k) + ")");
    }
    c.fillStyle = "#fff4e0";
    c.fillRect(x - 78, y - 74, 156, 74);
    c.fillStyle = "#c9472f";
    c.beginPath();
    c.moveTo(x - 90, y - 70); c.lineTo(x, y - 104); c.lineTo(x + 90, y - 70);
    c.closePath();
    c.fill();
    // Serving window with a cook
    c.fillStyle = "#3a2a22";
    c.fillRect(x - 54, y - 56, 108, 34);
    blob(c, x, y - 36, 9, 9, "#d9a06e");
    c.fillStyle = "#fff";
    c.fillRect(x - 9, y - 52, 18, 9);
    c.fillStyle = "#e9d3a5";
    c.fillRect(x - 60, y - 24, 120, 8);
    sign(c, x, y - 74, "CLOUD KITCHEN", "#7a2a18");
    if (count) CTC.art.badge(c, x + 72, y - 18, String(count), "#b5702c");
  }

  function drawHotel(c, x, y, t, count) {
    CTC.art.shadow(c, x, y + 2, 100, 12, 0.22);
    c.fillStyle = "#f3d7a8";
    c.fillRect(x - 84, y - 138, 168, 138);
    c.fillStyle = "#b5824a";
    c.fillRect(x - 90, y - 146, 180, 10);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const lit = Math.sin(t * 0.5 + row * 3 + col * 2) > -0.3;
        c.fillStyle = lit ? "#ffe9a3" : "#7fb6d6";
        c.fillRect(x - 70 + col * 38, y - 124 + row * 38, 24, 26);
      }
    }
    // Door and awning
    c.fillStyle = "#6b3a22";
    c.fillRect(x - 15, y - 36, 30, 36);
    c.fillStyle = "#2f7fd6";
    c.fillRect(x - 32, y - 44, 64, 10);
    sign(c, x, y - 140, "HOTEL", "#16324a");
    if (count) CTC.art.badge(c, x + 76, y - 18, String(count), "#b5702c");
  }

  function sign(c, x, y, text, color) {
    c.font = "800 15px Trebuchet MS, sans-serif";
    const w = c.measureText(text).width + 18;
    c.fillStyle = color;
    CTC.art.rr(c, x - w / 2, y - 12, w, 23, 6);
    c.fill();
    c.fillStyle = "#ffd34d";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, x, y);
    c.textBaseline = "alphabetic";
  }

  function drawZone(c, Z) {
    c.strokeStyle = "rgba(255,224,163,.8)";
    c.lineWidth = 3;
    c.setLineDash([8, 8]);
    c.beginPath();
    c.ellipse(Z.x, Z.y, Z.r, Z.r * 0.55, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }

  // Water layer: the fence and everything inside it.
  Sea.drawWater = function (c, t) {
    if (!G.s.fence) return;
    drawFence(c);
    G.pen.forEach((f) => Sea.drawCreature(c, f.kind, f.x, f.y, 0.9, t + f.wig, f.face));
  };

  // Ground layer: the selling circles.
  Sea.drawGround = function (c) {
    const s = G.s;
    if (s.kitchen) drawZone(c, S.venues.kitchen.zone);
    if (s.hotel) drawZone(c, S.venues.hotel.zone);
  };

  // Buildings, sorted with the people standing around them.
  Sea.addDepth = function (list, c, t) {
    const s = G.s, K = S.venues.kitchen, H = S.venues.hotel;
    if (s.kitchen) list.push({ y: K.y, draw: () => drawKitchen(c, K.x, K.y, t, s.kitchenStock.length) });
    if (s.hotel) list.push({ y: H.y, draw: () => drawHotel(c, H.x, H.y, t, s.hotelStock.length) });
    Object.keys(G.runners).forEach((v) => G.runners[v].forEach((w) => list.push({
      y: w.y,
      draw: () => {
        CTC.art.person(c, w.x, w.y, { look: w.look, face: w.face, walk: w.walk, moving: w.moving, idle: t });
        w.load.forEach((kind, i) => Sea.drawCreature(c, kind, w.x, w.y - 82 - i * Math.min(12, 84 / w.load.length), 0.55, t, w.face));
      }
    })));
  };

  Sea.startLevel = function () {
    G.pen = [];
    G.penTimer = 0;
    G.seaTimers = {};
    G.runners = { kitchen: [], hotel: [] };
  };
})();
