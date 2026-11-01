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
      else if (first) chips.push({ id: u.id, x: first.x, y: first.y, h: 92 });
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
      G.fly({ kind: "sea", creature: kind, x0: p.x, y0: p.y, z0: 55, x1: V.x, y1: V.y, z1: 40, dur: 0.28, h: 40 });
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
          G.fly({ kind: "sea", creature: kind, x0: w.x, y0: w.y, z0: 55, x1: V.x, y1: V.y, z1: 40, dur: 0.28, h: 40 });
          CTC.audio.play("plop");
          w.loadT = 0.2;
        } else if (!w.load.length) w.going = false;
      } else if (w.load.length >= Sea.carry(venue) || (w.load.length && !G.pen.length)) {
        w.going = true;
      } else if (G.pen.length) {
        const f = G.pen[Math.floor(Math.random() * G.pen.length)];
        G.pen.splice(G.pen.indexOf(f), 1);
        w.load.push(f.kind);
        G.fly({ kind: "sea", creature: f.kind, x0: f.x, y0: f.y, x1: w.x, y1: w.y, z1: 55, dur: 0.35, h: 50 });
        w.loadT = 0.4;
      }
    });
  }

  const RUNNER_LOOKS = {
    kitchen: { skin: "#d9a06e", shirt: "#2f7fd6", pants: "#27384d", hair: "#2b1d14", style: 0, scale: 1 },
    hotel: { skin: "#f6cfa8", shirt: "#ffd21f", pants: "#27384d", hair: "#4a2b18", style: 2, scale: 0.97 }
  };

  Sea.startLevel = function () {
    G.pen = [];
    G.penTimer = 0;
    G.seaTimers = {};
    G.runners = { kitchen: [], hotel: [] };
  };
})();
