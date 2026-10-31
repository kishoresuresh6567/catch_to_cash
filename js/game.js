/* Game rules and world simulation. Drawing lives in art.js and render.js. */
(function () {
  const L = CTC.LAYOUT;
  const SAVE_KEY = "catchToCash.v1";
  const THROW_RANGE = 310;

  const G = (CTC.game = {
    mode: "title", // title | play | sailing | complete
    time: 0,
    s: null,
    player: null,
    fish: [], schools: [], customers: [], particles: [], floats: [], flyers: [],
    machines: [], belt: [],
    net: null, aim: null, keys: {}, shake: 0, sailT: 0,
    cam: { z: 1, x: 0, y: 0, heldUntil: 0 },
    pendingThrow: null, cratePending: 0,
    listeners: {}
  });

  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  G.fmt = function (n) {
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (n >= 1e4) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + Math.floor(n).toLocaleString("en-US");
  };

  /* ---------- geometry ---------- */
  G.shoreX = (y) => 470 + 28 * Math.sin(y * 0.012 + 1) + 12 * Math.sin(y * 0.031);
  G.inWater = (x, y) => x < G.shoreX(y) && !G.onPier(x, y);
  G.onPier = (x, y) => x >= L.pier.x0 && x <= L.pier.x1 && y >= L.pier.y0 && y <= L.pier.y1;
  function walkable(x, y) {
    if (x > 1262 || y < 74 || y > 706) return false;
    if (x < G.shoreX(y) + 10 && !G.onPier(x, y)) return false;
    if (x > 850 && x < 1030 && y > 385 && y < 466) return false; // stall
    if (G.s && G.s.fire && x > 880 && x < 1030 && y > 600 && y < 660) return false; // cooked food shop
    return true;
  }

  function clearLine(ax, ay, bx, by) {
    const steps = Math.ceil(dist(ax, ay, bx, by) / 12);
    for (let i = 1; i <= steps; i++) {
      if (!walkable(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps)) return false;
    }
    return true;
  }
  // Corners the player can route through to get around the stall and pier.
  const WAYPOINTS = [[838, 372], [1044, 372], [838, 480], [1044, 480], [548, 360], [868, 592], [1042, 592], [868, 668], [1042, 668]];
  // Next point to head for on the shortest route to (tx, ty).
  function nextStep(p, tx, ty) {
    if (clearLine(p.x, p.y, tx, ty)) return { x: tx, y: ty };
    const best = WAYPOINTS.map((w, i) => (clearLine(w[0], w[1], tx, ty) ? dist(w[0], w[1], tx, ty) : Infinity));
    for (let pass = 0; pass < WAYPOINTS.length; pass++) {
      WAYPOINTS.forEach((a, i) => WAYPOINTS.forEach((b, j) => {
        if (i !== j && best[j] < Infinity && clearLine(a[0], a[1], b[0], b[1])) {
          best[i] = Math.min(best[i], dist(a[0], a[1], b[0], b[1]) + best[j]);
        }
      }));
    }
    let step = { x: tx, y: ty }, min = Infinity;
    WAYPOINTS.forEach((w, i) => {
      const d = dist(p.x, p.y, w[0], w[1]);
      if (d > 4 && best[i] + d < min && clearLine(p.x, p.y, w[0], w[1])) { min = best[i] + d; step = { x: w[0], y: w[1] }; }
    });
    return step;
  }

  G.nextStep = nextStep;

  /* ---------- level / derived values ---------- */
  G.level = () => CTC.LEVELS[G.s.level];
  G.count = (type) => G.level().builds.slice(0, G.s.built).filter((b) => b.type === type).length;
  const SHOP_BUILDS = ["fire", "chain", "feedBelt", "hotBelt", "hotSeller", "fence", "kitchen", "hotel"];
  G.has = (type) => (SHOP_BUILDS.includes(type) ? !!G.s[type] : G.count(type) > 0);
  G.cookingUnlocked = () => G.s.fire || G.has("cashier");
  // The ship stays hidden until the Sea Farm runs on its own.
  G.nextBuild = () => {
    const b = G.level().builds[G.s.built] || null;
    return b && b.type === "ship" && !CTC.sea.ready() ? null : b;
  };
  G.bagCap = () => Math.min(20, 6 + 2 * G.s.upg.bag);
  G.netRadius = () => 60 + 11 * G.s.upg.net;
  G.netCatch = () => 3 + G.s.upg.net;
  G.speed = () => 235 * Math.pow(1.12, G.s.upg.boots);
  G.priceMult = () => Math.pow(1.15, G.s.upg.price) * (1 + 0.1 * G.s.upg.cart) * CTC.player.priceBonus();
  G.stockCap = () => 30 + 15 * G.s.upg.cart;
  G.beltSpeed = () => 110 + 45 * G.s.upg.belt;
  G.beltGap = () => 0.6 / ((1 + 0.5 * G.s.upg.belt) * G.demandBoost());
  G.sellerCount = () => (G.has("cashier") ? 1 + G.s.upg.sellers : 0);
  G.machineEvery = () => G.level().machineEvery * Math.pow(0.85, G.s.upg.rig);
  G.catcherLv = (m) => G.s.catcherLv[m.index] || 1;
  G.catchers = () => G.machines.filter((m) => m.type === "rig" || m.type === "boat");
  G.catcherMaxed = (m) => G.catcherLv(m) >= CTC.CATCHER_UPGRADE.max;
  G.catcherCost = (m) => {
    const U = CTC.CATCHER_UPGRADE;
    return Math.round(U[m.type] * Math.pow(U.growth, G.catcherLv(m) - 1) * G.level().costScale);
  };
  // More fish needs more sales: word spreads and the whole chain speeds up.
  G.demandBoost = () => 1 + 0.1 * G.catchers().reduce((a, m) => a + G.catcherLv(m) - 1, 0);
  G.customerEvery = () => (G.level().customerEvery * Math.pow(0.85, G.s.upg.traffic)) / (G.demandBoost() * (1 + 0.5 * G.s.upg.sellers));
  G.crateCap = () => 24 + G.catchers().reduce((a, m) => a + G.catcherLv(m) * (m.type === "boat" ? 24 : 12), 0);
  G.fishValue = (i) => Math.round(G.level().fish[i].value * G.priceMult());
  G.cookedValue = (i) => Math.round(G.fishValue(i) * CTC.COOKING.priceMult * (1 + 0.1 * G.s.upg.hotCart));
  G.hotCap = () => CTC.COOKING.pileCap + 10 * G.s.upg.hotCart;
  G.hotSellerCount = () => (G.s.hotSeller ? 1 + G.s.upg.hotSellers : 0);
  G.hotBeltSpeed = () => 110 + 45 * G.s.upg.hotBelt;
  G.feedBeltSpeed = () => 110 + 45 * G.s.upg.feed;
  G.beltCost = (id) => G.level().beltCosts[id];
  G.beltLocked = (b) => !!b.needs && !G.has(b.needs);
  G.canBuyBelt = (b) => !G.has(b.id) && !G.beltLocked(b) && G.s.cash >= G.beltCost(b.id);
  G.buyBelt = function (id) {
    const b = CTC.BELTS.find((x) => x.id === id);
    if (!b || !G.canBuyBelt(b)) return false;
    G.s.cash -= G.beltCost(id);
    G.s[id] = true;
    G.stat("build_" + id);
    const P = { chain: L.beltPath, feedBelt: L.feedBeltPath, hotBelt: L.hotBeltPath }[id];
    const mid = G.pointOnPath(P, G.pathLength(P) / 2);
    G.burst(mid.x, mid.y, 40, ["#ffe46b", "#fff", "#9fe8b8"], 220, 340, 1.1);
    G.shake = 4;
    CTC.audio.play("build");
    G.emit("toast", b.name + ": " + b.says);
    G.save();
    return true;
  };
  G.grillSlots = () => CTC.COOKING.grillSlots + 2 * G.s.upg.grill;
  G.cookTime = () => CTC.COOKING.cookTime * Math.pow(0.9, G.s.upg.grill);
  // The next thing to build for the Hot Food shop, once the fireplace exists.
  G.hotNext = function () {
    const s = G.s, C = CTC.COOKING, scale = G.level().costScale;
    if (!s.fire) return null;
    if (!s.hotSeller) return { key: "hotSeller", name: "Hire a Food Seller", cost: C.hotSellerCost * scale, says: "Hot food customers get served while you're away." };
    return null;
  };
  G.fireCash = () => Math.round(CTC.COOKING.buildCash * G.level().costScale);
  G.bagCount = () => G.s.carried.length + G.s.cookedBag.length + G.s.seaBag.length;
  G.upgradeCost = (u) => Math.round(u.base * Math.pow(u.growth, G.s.upg[u.id]) * G.level().costScale);
  G.upgradeLocked = (u) => !!u.needs && !u.needs.some(G.has);

  G.foodQuality = () => G.s.upg.foodQuality;
  G.foodDurationAt = (n) => CTC.FISH_FOOD.duration + CTC.FISH_FOOD.timePerLevel * n;
  G.foodDuration = () => G.foodDurationAt(G.s.upg.foodTime);
  G.foodCost = () => Math.round(CTC.FISH_FOOD.cost * G.level().costScale * (1 + 0.6 * G.s.upg.foodQuality) * (1 + 0.1 * G.s.upg.foodTime));

  // No argument: a wild fish. With a food quality: a fish drawn in by that food,
  // where better food unlocks and favours bigger fish.
  G.rollFish = function (quality) {
    const fed = quality !== undefined;
    const weight = (f) => {
      if ((f.food || 0) > (fed ? quality : 0)) return 0;
      if (!fed) return f.weight;
      const pull = 1 + quality * Math.max(0, f.size - 0.7) * 3;
      return f.weight * pull * (f.rare ? CTC.FISH_FOOD.rareBoost : 1);
    };
    const list = G.level().fish;
    let r = Math.random() * list.reduce((a, f) => a + weight(f), 0);
    for (let i = 0; i < list.length; i++) { r -= weight(list[i]); if (r <= 0) return i; }
    return 0;
  };

  G.on = (name, fn) => { (G.listeners[name] = G.listeners[name] || []).push(fn); };
  G.emit = function (name, a) { (G.listeners[name] || []).forEach((f) => f(a)); };

  /* ---------- save / load ---------- */
  function freshSave(level, cash) {
    return {
      level, cash: cash || 0, built: 0, paid: 0, time: 0,
      earned: 0, caught: 0, sold: 0,
      upg: { net: 0, bag: 0, boots: 0, price: 0, rig: 0, traffic: 0, foodTime: 0, foodQuality: 0, sellers: 0, cart: 0, belt: 0, hotSellers: 0, hotCart: 0, hotBelt: 0, grill: 0, feed: 0, cutters: 0, fenceSize: 0, kitchenUp: 0, hotelUp: 0, kitchenRunners: 0, hotelRunners: 0 },
      catcherLv: {},
      carried: [], crate: [], stock: [], campaignDone: false,
      noHomes: true, beltsInPanel: true, wood: 0, fire: false, chain: false, feedBelt: false, hotBelt: false, hotSeller: false, fuel: 0, grill: [], cookedPile: [], cookedBag: [], cookedStock: [],
      fence: false, kitchen: false, hotel: false, seaToast: false, seaBag: [], kitchenStock: [], hotelStock: []
    };
  }
  G.freshSave = freshSave;
  // Older saves were made when every place had a Home Delivery build at position 5.
  // Without this, their build count would skip the next build in the list.
  // The market belt used to be a pad in each place's build list. It's now in the Upgrades panel.
  function migrateChainBuild(raw) {
    if (raw.beltsInPanel) return;
    raw.beltsInPanel = true;
    const index = [2, 1, 1][raw.level];
    raw.chain = raw.built > index;
    if (raw.chain) raw.built--;
    const levels = {};
    Object.keys(raw.catcherLv).forEach((key) => {
      const i = Number(key);
      levels[i > index ? i - 1 : i] = raw.catcherLv[key];
    });
    raw.catcherLv = levels;
  }

  function migrateHomeBuild(raw) {
    if (raw.noHomes) return;
    raw.noHomes = true;
    const HOME_INDEX = 5;
    if (raw.built > HOME_INDEX) raw.built--;
    const levels = {};
    Object.keys(raw.catcherLv).forEach((key) => {
      const i = Number(key);
      if (i !== HOME_INDEX) levels[i > HOME_INDEX ? i - 1 : i] = raw.catcherLv[key];
    });
    raw.catcherLv = levels;
  }
  G.save = function () {
    if (!G.s || G.saveLocked) return;
    CTC.player.save();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.s)); } catch (e) { /* storage may be blocked */ }
  };
  G.loadSave = function () {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (raw && CTC.LEVELS[raw.level]) {
        raw.upg = Object.assign(freshSave(0).upg, raw.upg);
        raw.catcherLv = raw.catcherLv || {};
        migrateHomeBuild(raw);
        migrateChainBuild(raw);
        return Object.assign(freshSave(raw.level), raw);
      }
    } catch (e) { /* corrupt or blocked storage starts fresh */ }
    return null;
  };
  G.wipeSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    CTC.player.reset();
  };

  /* ---------- world setup ---------- */
  G.startLevel = function (save) {
    G.s = save;
    G.player = { x: L.start.x, y: L.start.y, tx: null, ty: null, face: -1, walk: 0, moving: false, throwT: 0, cool: 0, moveCool: 0 };
    G.fish = []; G.schools = []; G.customers = []; G.particles = []; G.floats = []; G.flyers = [];
    G.machines = []; G.belt = []; G.net = null; G.pendingThrow = null; G.cratePending = 0;
    G.sailT = 0;
    G.food = null; G.foodArmed = false; G.foodFlying = false;
    G.trees = L.trees.map((t, i) => ({ x: t[0], y: t[1], i, hp: CTC.COOKING.logsPerTree, state: "up", t: 0, shake: 0 }));
    G.cutters = [];
    CTC.sea.startLevel();
    G.chopT = 0; G.noticeT = 0; G.diners = []; G.hotBeltItems = []; G.feedItems = [];
    G.timers = { customer: 1, transfer: 0, serve: 0, belt: 0, payFx: 0, respawn: 0 };
    G.earnLog = [];
    for (let i = 0; i < 5; i++) {
      G.schools.push({ x: rand(60, 400), y: rand(100, 680), tx: rand(60, 400), ty: rand(100, 680) });
    }
    for (let i = 0; i < G.level().fishCount; i++) spawnFish(true);
    G.level().builds.slice(0, save.built).forEach((b, i) => addMachine(b, false, i));
    G.emit("levelChanged");
  };
  G.newGame = function () { G.wipeSave(); G.startLevel(freshSave(0)); G.save(); };
  G.nextLevel = function () {
    const n = G.s.level + 1;
    if (CTC.LEVELS[n]) {
      const save = freshSave(n, G.s.cash);
      // Your basket and fish food recipe stay with you between levels.
      ["bag", "foodTime", "foodQuality"].forEach((k) => { save.upg[k] = G.s.upg[k]; });
      G.startLevel(save);
      G.save();
      G.mode = "play";
    }
    else { G.s.campaignDone = true; G.save(); G.mode = "play"; }
  };

  // Small fish crowd into big schools, while big fish keep to the small groups.
  const SCHOOL_SHARE = [0.45, 0.27, 0.16, 0.08, 0.04];
  function pickSchool(def) {
    if (def.size >= 1.15) return 3 + Math.floor(Math.random() * 2);
    let r = Math.random();
    for (let i = 0; i < SCHOOL_SHARE.length; i++) { r -= SCHOOL_SHARE[i]; if (r <= 0) return i; }
    return 0;
  }

  function spawnFish(initial, quality) {
    const species = G.rollFish(quality);
    const def = G.level().fish[species];
    const school = pickSchool(def);
    const sc = G.schools[school];
    G.fish.push({
      species, school,
      x: initial ? sc.x + rand(-40, 40) : -30,
      y: initial ? sc.y + rand(-40, 40) : rand(90, 680),
      vx: 0, vy: 0, jit: rand(0.85, 1.18),
      ox: rand(-42, 42), oy: rand(-34, 34),
      wig: rand(0, 6), speed: def.speed * rand(0.85, 1.2)
    });
  }

  function addMachine(b, fresh, index) {
    const spot = L.spots[b.spot];
    const m = { index, name: b.name, casts: 0, type: b.type, x: spot.x, y: spot.y, t: rand(0, 2), pop: fresh ? 0 : 1, dip: 0, haul: 0 };
    if (b.type === "boat") {
      m.dockX = G.shoreX(spot.y) - 60; m.dockY = spot.y;
      m.bx = m.dockX; m.by = m.dockY; m.state = "out"; m.face = -1;
      m.tx = rand(60, 360); m.ty = rand(90, 680);
    }
    if (b.type !== "ship") G.machines.push(m);
    return m;
  }

  /* ---------- effects ---------- */
  G.float = function (x, y, text, color, size) { G.floats.push({ x, y, text, color: color || "#fff", size: size || 20, t: 0 }); };
  G.fly = function (o) { G.flyers.push(Object.assign({ t: 0, dur: 0.5, h: 50 }, o)); };
  G.burst = function (x, y, n, colors, power, gravity, life) {
    if (G.particles.length > 420) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = rand(0.3, 1) * (power || 120);
      G.particles.push({
        x, y, vx: Math.cos(a) * p, vy: Math.sin(a) * p - (power || 120) * 0.4,
        g: gravity === undefined ? 340 : gravity,
        life: rand(0.4, 1) * (life || 0.8), t: 0,
        r: rand(1.5, 4.5), c: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  };
  G.splash = function (x, y, big) {
    G.burst(x, y, big ? 26 : 12, ["#ffffff", "#c9f3ff", "#8fe0f0"], big ? 170 : 110);
    G.particles.push({ ring: true, x, y, t: 0, life: 0.7, r: big ? 60 : 30, vx: 0, vy: 0, g: 0, c: "#ffffff" });
  };

  function addCash(v, x, y) {
    const s = G.s;
    s.cash += v; s.earned += v;
    G.stat("earned", v);
    G.earnLog.push({ t: G.time, v });
    G.float(x, y - 30, "+" + G.fmt(v), "#ffe46b", v >= G.level().fish[0].value * 4 ? 26 : 20);
    const coins = Math.min(3, 1 + Math.floor(v / (G.level().fish[0].value * 3)));
    for (let i = 0; i < coins; i++) {
      G.fly({ kind: "coin", x0: x, y0: y - 20, x1: G.cam.x + 40 / G.cam.z, y1: G.cam.y + 40 / G.cam.z, dur: 0.6 + i * 0.07, h: 70, done: () => G.emit("coinArrived") });
    }
    CTC.audio.play("coin");
  }

  G.addCash = addCash;

  G.earnRate = function () {
    const now = G.time;
    while (G.earnLog.length && now - G.earnLog[0].t > 15) G.earnLog.shift();
    return G.earnLog.reduce((a, e) => a + e.v, 0) / 15;
  };

  /* ---------- player input actions ---------- */
  const ARROW_HIT = 24;
  const CUTTER_START = { x: 790, y: 250 };
  G.moveTo = function (x, y) { G.player.tx = x; G.player.ty = y; G.pendingThrow = null; };

  G.clickWorld = function (x, y) {
    if (G.mode !== "play") return;
    const hit = G.catchers().find((m) => {
      if (!G.chipVisible(m)) return false;
      const chip = G.chipPos(m);
      return dist(x, y, chip.x, chip.y) < ARROW_HIT;
    });
    if (hit) { G.upgradeCatcher(hit); return; }
    const stallChip = G.stallChips().find((b) => (b.text ? Math.abs(x - b.x) < 130 && Math.abs(y - b.y) < 13 : dist(x, y, b.x, b.y) < ARROW_HIT));
    if (stallChip) {
      if (stallChip.sea) CTC.sea.buy(stallChip.id);
      else if (stallChip.belt) G.buyBelt(stallChip.id);
      else G.buyUpgrade(stallChip.id);
      return;
    }
    if (G.foodArmed) {
      G.foodArmed = false;
      if (G.inWater(x, y)) {
        const p = G.player;
        if (dist(p.x, p.y, x, y) <= THROW_RANGE) G.throwFood(x, y);
        else {
          const sy = Math.max(80, Math.min(700, y));
          p.tx = G.shoreX(sy) + 16; p.ty = sy;
          G.pendingThrow = { x, y, food: true };
        }
        return;
      }
    }
    // Clicking a standing tree walks up to it so you can start chopping.
    const tree = G.trees.find((tr) => tr.state === "up" && Math.abs(x - tr.x) < 50 && y < tr.y + 12 && y > tr.y - 140);
    if (tree && G.cookingUnlocked()) { G.moveTo(tree.x + (G.player.x < tree.x ? -24 : 24), Math.max(80, tree.y + 6)); return; }
    if (G.inWater(x, y)) {
      const p = G.player;
      if (dist(p.x, p.y, x, y) <= THROW_RANGE) G.throwAt(x, y);
      else {
        // Walk to the closest point of the shore, then throw automatically.
        const sy = Math.max(80, Math.min(700, y));
        p.tx = G.shoreX(sy) + 16; p.ty = sy;
        G.pendingThrow = { x, y };
      }
    } else G.moveTo(x, y);
  };

  G.throwAt = function (x, y) {
    const s = G.s, p = G.player;
    if (G.mode !== "play" || G.net || p.cool > 0) return false;
    if (G.bagCount() >= G.bagCap()) {
      G.float(p.x, p.y - 80, "Basket full! Go sell", "#ffb3a8", 20);
      CTC.audio.play("full");
      p.cool = 0.5;
      return false;
    }
    const d = dist(p.x, p.y, x, y);
    if (d > THROW_RANGE) { x = p.x + ((x - p.x) * THROW_RANGE) / d; y = p.y + ((y - p.y) * THROW_RANGE) / d; }
    if (!G.inWater(x, y)) return false;
    p.face = x < p.x ? -1 : 1;
    p.throwT = 0.35;
    p.tx = null;
    G.net = { x0: p.x, y0: p.y - 40, x, y, t: 0, phase: "fly", fish: [] };
    CTC.audio.play("throw");
    return true;
  };

  G.canBuyFood = () => G.mode === "play" && !G.food && !G.foodFlying && G.s.cash >= G.foodCost();

  G.throwFood = function (x, y) {
    const p = G.player, cost = G.foodCost();
    const d = dist(p.x, p.y, x, y);
    if (d > THROW_RANGE) { x = p.x + ((x - p.x) * THROW_RANGE) / d; y = p.y + ((y - p.y) * THROW_RANGE) / d; }
    if (!G.canBuyFood() || !G.inWater(x, y)) return false;
    G.s.cash -= cost;
    G.stat("food");
    G.foodFlying = true;
    p.face = x < p.x ? -1 : 1;
    p.throwT = 0.35;
    p.tx = null;
    G.float(p.x, p.y - 90, "-" + G.fmt(cost), "#ffb3a8", 20);
    CTC.audio.play("throw");
    G.fly({ kind: "food", x0: p.x, y0: p.y - 45, x1: x, y1: y, dur: 0.5, h: 80, done: () => landFood(x, y) });
    return true;
  };

  function landFood(x, y) {
    const F = CTC.FISH_FOOD;
    G.foodFlying = false;
    if (G.mode !== "play") return;
    const pellets = Array.from({ length: 16 }, () => ({ ox: rand(-30, 30), oy: rand(-22, 22), r: rand(1.8, 3.4), p: rand(0, 6) }));
    G.food = { x, y, t: 0, life: G.foodDuration(), pellets };
    G.splash(x, y, false);
    CTC.audio.play("splash");
    const quality = G.foodQuality();
    for (let i = 0; i < F.extraFish + F.extraPerQuality * quality; i++) {
      const a = rand(0, Math.PI * 2), d = rand(170, 260);
      const fy = Math.max(90, Math.min(690, y + Math.sin(a) * d));
      spawnFish(true, quality);
      const f = G.fish[G.fish.length - 1];
      f.x = Math.max(-20, Math.min(G.shoreX(fy) - 30, x + Math.cos(a) * d));
      f.y = fy;
      f.extra = true;
      f.fade = 0;
    }
  }

  // Space bar: aim at the richest spot within reach.
  G.autoThrow = function () {
    const p = G.player;
    let best = null, bestN = -1;
    const r = G.netRadius();
    const all = G.fish.concat(G.pen);
    all.forEach((f) => {
      if (dist(p.x, p.y, f.x, f.y) > THROW_RANGE) return;
      let n = 0;
      all.forEach((o) => { if (dist(f.x, f.y, o.x, o.y) < r) n++; });
      if (n > bestN) { bestN = n; best = f; }
    });
    if (best) return G.throwAt(best.x, best.y);
    G.float(p.x, p.y - 80, "No fish in reach", "#fff", 18);
    return false;
  };

  // The clickable upgrade button that appears on a catcher you can afford to level up.
  G.chipVisible = (m) => !G.catcherMaxed(m) && G.s.cash >= G.catcherCost(m);
  G.chipPos = (m) => (m.type === "boat" ? { x: m.bx, y: m.by - 84 } : { x: m.x, y: m.y - 100 });

  // Same kind of buttons for the stall, shown beside it when affordable.
  G.stallChips = function () {
    const chips = [];
    // Upgrades are a blue arrow above the item, with no words. They appear when affordable.
    const add = (id, x, y) => {
      const u = CTC.UPGRADES.find((x) => x.id === id);
      if (G.s.upg[id] >= u.max || G.upgradeLocked(u) || G.s.cash < G.upgradeCost(u)) return;
      chips.push({ id, x, y });
    };
    add("cart", 900, 258);
    add("sellers", 980, 258);
    add("belt", 775, 350);
    add("feed", 655, 450);
    add("grill", 640, 512);
    add("hotBelt", 720, 610);
    add("hotCart", 925, 497);
    add("hotSellers", 985, 497);
    // Words and price for the first woodcutter. After that, an arrow above them.
    const cutters = CTC.UPGRADES.find((u) => u.id === "cutters");
    if (G.s.upg.cutters === 0 && !G.upgradeLocked(cutters) && G.s.cash >= G.upgradeCost(cutters)) {
      chips.push({ id: "cutters", x: 790, y: 300, text: "\u25B2 Hire woodcutter: " + G.fmt(G.upgradeCost(cutters)) });
    } else if (G.cutters[0]) add("cutters", G.cutters[0].x, Math.max(20, G.cutters[0].y - 76));
    add("fenceSize", 280, 80);
    add("kitchenUp", 870, 50);
    add("hotelUp", 1130, 28);
    CTC.sea.chips().forEach((b) => chips.push(b));
    // A button beside each belt's route as soon as it can be bought.
    const BELT_CHIPS = { chain: [738, 402], feedBelt: [738, 470], hotBelt: [705, 600] };
    CTC.BELTS.filter(G.canBuyBelt).forEach((b) => {
      chips.push({ belt: true, id: b.id, x: BELT_CHIPS[b.id][0], y: BELT_CHIPS[b.id][1], text: "\u25B2 Build belt: " + G.fmt(G.beltCost(b.id)) });
    });
    return chips;
  };

  G.upgradeCatcher = function (m) {
    const s = G.s;
    if (G.catcherMaxed(m)) return false;
    const cost = G.catcherCost(m);
    if (s.cash < cost) return false;
    s.cash -= cost;
    s.catcherLv[m.index] = G.catcherLv(m) + 1;
    G.stat("catcherUps");
    m.pop = 0;
    const at = m.type === "boat" ? { x: m.bx, y: m.by } : m;
    G.burst(at.x, at.y - 30, 24, ["#ffe46b", "#fff", "#9fe8b8"], 170);
    CTC.audio.play("upgrade");
    G.save();
    return true;
  };

  G.buyUpgrade = function (id) {
    const u = CTC.UPGRADES.find((x) => x.id === id);
    if (!u || G.s.upg[id] >= u.max || G.upgradeLocked(u)) return false;
    const cost = G.upgradeCost(u);
    if (G.s.cash < cost) return false;
    G.s.cash -= cost;
    G.s.upg[id]++;
    G.stat("upgrades");
    CTC.sea.onUpgrade(id);
    CTC.audio.play("upgrade");
    G.burst(G.player.x, G.player.y - 40, 16, ["#ffe46b", "#fff", "#9fe8b8"], 130);
    if (id === "cutters") {
      G.burst(CUTTER_START.x, CUTTER_START.y - 30, 24, ["#ffe46b", "#fff", "#c79a5a"], 170);
      if (G.s.upg.cutters === 1) {
        G.stat("build_cutter");
        G.emit("toast", "Woodcutter hired: wood now gets chopped while you're away.");
      }
    }
    if (id === "belt") {
      const mid = G.beltPoint(150);
      G.burst(mid.x, mid.y, 30, ["#ffe46b", "#fff", "#9fe8b8"], 190);
    }
    if (id === "hotSellers" || id === "hotCart" || id === "hotBelt" || id === "grill" || id === "feed") {
      const at = id === "grill" ? L.fire : L.shop;
      G.burst(at.x, at.y - 50, 30, ["#ffe46b", "#fff", "#ff8a3c"], 190);
    }
    if (id === "sellers" || id === "cart") {
      G.burst(L.stall.x, L.stall.y - 70, 30, ["#ffe46b", "#fff", "#9fe8b8"], 190);
    }
    G.save();
    return true;
  };

  /* ---------- simulation ---------- */
  G.update = function (dt) {
    G.time += dt;
    updateAmbient(dt);
    if (G.mode === "play" && G.s) {
      G.s.time += dt;
      CTC.player.tick(dt);
      updatePlayer(dt);
      updateNet(dt);
      updateTransfers(dt);
      updateChopping(dt);
      updateFire(dt);
      updateHotLine(dt);
      updateFeedBelt(dt);
      updateCustomers(dt);
      updateShop(dt);
      updateSelling(dt);
      updateMachines(dt);
      updateBelt(dt);
      updatePad(dt);
      CTC.sea.update(dt);
    }
    if (G.mode === "sailing") {
      G.sailT += dt;
      if (G.sailT > 3.0) { G.mode = "complete"; G.emit("complete"); }
    }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 18);
  };

  function updateAmbient(dt) {
    if (!G.s) return;
    G.schools.forEach((sc) => {
      const d = dist(sc.x, sc.y, sc.tx, sc.ty);
      if (d < 20) { sc.tx = rand(40, G.shoreX(sc.y) - 70); sc.ty = rand(95, 685); }
      sc.x += ((sc.tx - sc.x) / (d || 1)) * 34 * dt;
      sc.y += ((sc.ty - sc.y) / (d || 1)) * 34 * dt;
    });
    G.fish.forEach((f) => {
      const sc = G.schools[f.school];
      f.wig += dt * 9;
      let wx = sc.x + f.ox + Math.sin(f.wig * 0.13) * 22;
      let wy = sc.y + f.oy + Math.cos(f.wig * 0.1) * 18;
      let speed = f.speed;
      if (G.food && (f.extra || dist(f.x, f.y, G.food.x, G.food.y) < CTC.FISH_FOOD.pull)) {
        wx = G.food.x + f.ox; wy = G.food.y + f.oy; speed *= 1.8;
      } else if (f.extra) {
        wx = -60; wy = f.y; speed *= 1.5; // Extra fish leave once the food is gone.
      }
      if (f.fade !== undefined) f.fade = Math.min(1, f.fade + dt * 1.5);
      const d = dist(f.x, f.y, wx, wy) || 1;
      const sp = Math.min(speed, d * 2.2);
      f.vx += ((((wx - f.x) / d) * sp) - f.vx) * Math.min(1, dt * 3);
      f.vy += ((((wy - f.y) / d) * sp) - f.vy) * Math.min(1, dt * 3);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const limit = G.shoreX(f.y) - 18;
      if (f.x > limit) f.x = limit;
    });
    if (G.food) {
      G.food.t += dt;
      if (G.food.t >= G.food.life) G.food = null;
    } else if (G.fish.some((f) => f.extra && f.x < -25)) {
      G.fish = G.fish.filter((f) => !(f.extra && f.x < -25));
    }
    if (G.mode === "play") {
      G.timers.respawn -= dt;
      if (G.fish.length < G.level().fishCount + CTC.sea.extraFish() && G.timers.respawn <= 0) { spawnFish(false); G.timers.respawn = 0.5; }
    }
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) G.particles.splice(i, 1);
    }
    for (let i = G.floats.length - 1; i >= 0; i--) {
      const f = G.floats[i];
      f.t += dt; f.y -= 42 * dt;
      if (f.t > 1.1) G.floats.splice(i, 1);
    }
    for (let i = G.flyers.length - 1; i >= 0; i--) {
      const f = G.flyers[i];
      f.t += dt;
      if (f.t >= f.dur) { G.flyers.splice(i, 1); if (f.done) f.done(); }
    }
    G.machines.forEach((m) => { if (m.pop < 1) m.pop = Math.min(1, m.pop + dt * 2.4); });
  }

  function updatePlayer(dt) {
    const p = G.player, k = G.keys;
    let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (dx || dy) { p.tx = null; G.pendingThrow = null; }
    else if (p.tx !== null) {
      const d = dist(p.x, p.y, p.tx, p.ty);
      if (d < 6) p.tx = null;
      else {
        const step = nextStep(p, p.tx, p.ty);
        const sd = dist(p.x, p.y, step.x, step.y) || 1;
        dx = (step.x - p.x) / sd; dy = (step.y - p.y) / sd;
      }
    }
    const len = Math.hypot(dx, dy);
    p.moving = len > 0;
    if (len) {
      const sp = G.speed() * dt;
      const mx = (dx / len) * sp, my = (dy / len) * sp;
      const ox = p.x, oy = p.y;
      if (walkable(p.x + mx, p.y)) p.x += mx;
      if (walkable(p.x, p.y + my)) p.y += my;
      if (Math.abs(mx) > 0.05) p.face = mx < 0 ? -1 : 1;
      p.walk += dt * 11;
      // Stop click-walking when blocked, so the player doesn't jog on the spot.
      if (p.tx !== null && dist(ox, oy, p.x, p.y) < sp * 0.15) p.tx = null;
    }
    // Throw once in reach, or as far as possible after arriving at the shore.
    if (G.pendingThrow && (p.tx === null || dist(p.x, p.y, G.pendingThrow.x, G.pendingThrow.y) <= THROW_RANGE - 5)) {
      const t = G.pendingThrow;
      G.pendingThrow = null;
      if (t.food) G.throwFood(t.x, t.y);
      else G.throwAt(t.x, t.y);
    }
    p.throwT = Math.max(0, p.throwT - dt);
    p.cool = Math.max(0, p.cool - dt);
  }

  function updateNet(dt) {
    const n = G.net;
    if (!n) return;
    n.t += dt;
    if (n.phase === "fly" && n.t >= 0.42) {
      n.phase = "sink"; n.t = 0;
      G.splash(n.x, n.y, true);
      G.shake = 3;
      CTC.audio.play("splash");
      const r = G.netRadius();
      let room = Math.min(G.netCatch(), G.bagCap() - G.bagCount());
      n.sea = CTC.sea.netCatch(n.x, n.y, r, room);
      room -= n.sea.length;
      // The net always holds on to the most valuable fish it covers.
      const defs = G.level().fish;
      const caught = G.fish.filter((f) => dist(f.x, f.y, n.x, n.y) < r)
        .sort((a, b) => defs[b.species].value - defs[a.species].value)
        .slice(0, Math.max(0, room));
      caught.forEach((f) => n.fish.push({ species: f.species, ox: (f.x - n.x) * 0.5, oy: (f.y - n.y) * 0.5, wig: f.wig }));
      G.fish = G.fish.filter((f) => !caught.includes(f));
    } else if (n.phase === "sink" && n.t >= 0.32) {
      n.phase = "pull"; n.t = 0;
    } else if (n.phase === "pull" && n.t >= 0.34) {
      const p = G.player;
      if (n.fish.length || n.sea.length) {
        n.fish.forEach((f) => G.s.carried.push(f.species));
        n.sea.forEach((kind, i) => {
          G.s.seaBag.push(kind);
          G.fly({ kind: "sea", creature: kind, x0: n.x, y0: n.y, x1: p.x, y1: p.y - 55, dur: 0.3 + i * 0.05, h: 50 });
        });
        const total = n.fish.length + n.sea.length;
        G.s.caught += total;
        G.stat("netCaught", total);
        G.stat("rare", n.fish.filter((f) => G.level().fish[f.species].rare).length);
        G.stat("big", n.fish.filter((f) => G.level().fish[f.species].size >= 1.5).length);
        const rare = n.fish.some((f) => G.level().fish[f.species].rare);
        const big = n.fish.some((f) => G.level().fish[f.species].size >= 1.5);
        const label = rare ? "RARE CATCH!" : big ? "BIG CATCH!" : "+" + total + " fish";
        G.float(p.x, p.y - 90, label, rare || big ? "#ffe46b" : "#fff", rare || big ? 28 : 22);
        G.burst(p.x, p.y - 50, rare ? 28 : 8, rare ? ["#ffe46b", "#fff"] : ["#c9f3ff", "#fff"], 130);
        CTC.audio.play("catch");
      } else {
        G.float(p.x, p.y - 90, "Missed! Aim at the fish", "#d9ecff", 18);
        CTC.audio.play("miss");
      }
      G.net = null;
    }
  }

  function updateTransfers(dt) {
    const s = G.s, p = G.player;
    G.timers.transfer -= dt;
    if (G.timers.transfer > 0) return;
    if (dist(p.x, p.y, L.shopZone.x, L.shopZone.y) < L.shopZone.r && s.cookedBag.length && s.cookedStock.length < G.hotCap()) {
      const sp = s.cookedBag.pop();
      s.cookedStock.push(sp);
      G.fly({ kind: "fish", cooked: true, species: sp, x0: p.x, y0: p.y - 55, x1: L.shop.x - 20 + rand(-40, 40), y1: L.shop.y - 46, dur: 0.28, h: 40 });
      CTC.audio.play("plop");
      G.timers.transfer = 0.09;
      return;
    }
    if (dist(p.x, p.y, L.stallZone.x, L.stallZone.y) < L.stallZone.r && s.carried.length && s.stock.length < G.stockCap()) {
      const sp = s.carried.pop();
      s.stock.push(sp);
      G.fly({ kind: "fish", species: sp, x0: p.x, y0: p.y - 55, x1: L.stall.x - 20 + rand(-40, 40), y1: L.stall.y - 52, dur: 0.28, h: 40 });
      CTC.audio.play("plop");
      G.timers.transfer = 0.09;
    } else if (dist(p.x, p.y, L.crate.x, L.crate.y) < 70 && s.crate.length && G.bagCount() < G.bagCap()) {
      const sp = s.crate.pop();
      s.carried.push(sp);
      G.fly({ kind: "fish", species: sp, x0: L.crate.x, y0: L.crate.y - 20, x1: p.x, y1: p.y - 55, dur: 0.22, h: 26 });
      CTC.audio.play("plop");
      G.timers.transfer = 0.09;
    }
  }

  function updateChopping(dt) {
    const s = G.s, p = G.player, C = CTC.COOKING;
    G.trees.forEach((tr) => {
      tr.shake = Math.max(0, tr.shake - dt * 3);
      if (tr.state === "fall") {
        tr.t += dt * 1.5;
        if (tr.t >= 1) { tr.state = "stump"; tr.t = 0; }
      } else if (tr.state === "stump") {
        tr.t += dt;
        if (tr.t >= C.regrow) { tr.state = "grow"; tr.t = 0; }
      } else if (tr.state === "grow") {
        tr.t += dt * 0.6;
        if (tr.t >= 1) { tr.state = "up"; tr.hp = C.logsPerTree; tr.t = 0; }
      }
    });
    G.noticeT = Math.max(0, G.noticeT - dt);
    updateCutters(dt);
    p.chopping = false;
    if (p.moving || !G.cookingUnlocked()) { G.chopT = 0; return; }
    const tree = G.trees.find((tr) => tr.state === "up" && dist(p.x, p.y, tr.x, tr.y) < 58);
    if (!tree) { G.chopT = 0; return; }
    if (s.wood >= C.woodCap) {
      if (G.noticeT <= 0) { G.float(p.x, p.y - 90, "Wood is full", "#ffd2c9", 18); G.noticeT = 3; }
      return;
    }
    p.chopping = true;
    p.face = tree.x < p.x ? -1 : 1;
    p.throwT = 0.15;
    G.chopT += dt;
    if (G.chopT < C.chopTime) return;
    G.chopT = 0;
    chopTree(tree, p.x);
    if (tree.state === "fall") G.shake = 3;
  }

  function chopTree(tree, fromX) {
    tree.hp--;
    tree.shake = 1;
    G.s.wood++;
    G.stat("wood");
    G.burst(tree.x, tree.y - 20, 8, ["#c79a5a", "#8c6239", "#e9d3a5"], 110);
    G.float(tree.x, tree.y - 55, "+1 wood", "#ffe0a3", 18);
    G.fly({ kind: "log", x0: tree.x, y0: tree.y - 20, x1: G.cam.x + 40 / G.cam.z, y1: G.cam.y + 40 / G.cam.z, dur: 0.55, h: 60 });
    CTC.audio.play("chop");
    if (tree.hp <= 0) {
      tree.state = "fall"; tree.t = 0;
      tree.dir = fromX < tree.x ? 1 : -1;
    }
  }

  // Hired woodcutters each walk to the nearest free tree and stop when the wood is full.
  function updateCutters(dt) {
    const s = G.s, C = CTC.COOKING;
    while (G.cutters.length < s.upg.cutters) {
      G.cutters.push({ x: CUTTER_START.x, y: CUTTER_START.y, face: 1, walk: 0, moving: false, chopping: false, chopT: 0, tree: null, look: CTC.art.cutterLooks[G.cutters.length] });
    }
    G.cutters.forEach((w) => {
      w.moving = false; w.chopping = false;
      if (w.tree && w.tree.state !== "up") w.tree = null;
      if (s.wood >= C.woodCap) { w.tree = null; return; }
      if (!w.tree) {
        const free = G.trees.filter((tr) => tr.state === "up" && !G.cutters.some((o) => o.tree === tr));
        free.sort((a, b) => dist(w.x, w.y, a.x, a.y) - dist(w.x, w.y, b.x, b.y));
        if (!free[0]) return;
        w.tree = free[0];
        w.tx = w.tree.x + (w.x < w.tree.x ? -24 : 24);
        w.ty = Math.max(80, w.tree.y + 6);
      }
      if (dist(w.x, w.y, w.tx, w.ty) > 6) {
        const step = nextStep(w, w.tx, w.ty);
        const d = dist(w.x, w.y, step.x, step.y) || 1;
        w.x += ((step.x - w.x) / d) * C.cutterSpeed * dt;
        w.y += ((step.y - w.y) / d) * C.cutterSpeed * dt;
        if (Math.abs(step.x - w.x) > 1) w.face = step.x < w.x ? -1 : 1;
        w.moving = true;
        w.walk += dt * 9;
        return;
      }
      w.face = w.tree.x < w.x ? -1 : 1;
      w.chopping = true;
      w.chopT += dt;
      if (w.chopT >= C.cutterChop) { w.chopT = 0; chopTree(w.tree, w.x); }
    });
  }

  // Runs the belt that carries raw fish from the crate to the grill. Each fish pays its
  // wood when it sets off, so a fish on the belt always has fuel waiting.
  function updateFeedBelt(dt) {
    const s = G.s, C = CTC.COOKING;
    if (!s.feedBelt || !s.fire) return;
    G.timers.feed = (G.timers.feed || 0) - dt;
    if (G.timers.feed <= 0 && s.crate.length && s.grill.length + G.feedItems.length < G.grillSlots()) {
      if (s.fuel > 0 || s.wood > 0) {
        if (s.fuel <= 0) { s.wood--; s.fuel = C.fishPerLog; }
        s.fuel--;
        G.feedItems.push({ species: s.crate.pop(), d: 0 });
        G.timers.feed = 0.6 / (1 + 0.5 * s.upg.feed);
      } else if (G.noticeT <= 0) {
        G.float(L.fire.x, L.fire.y - 62, "No wood! Chop a tree", "#ffb3a8", 18);
        G.noticeT = 3;
      }
    }
    for (let i = G.feedItems.length - 1; i >= 0; i--) {
      const b = G.feedItems[i];
      b.d += G.feedBeltSpeed() * dt;
      if (b.d >= G.pathLength(L.feedBeltPath)) {
        s.grill.push({ sp: b.species, t: 0 });
        G.feedItems.splice(i, 1);
        CTC.audio.play("plop");
      }
    }
  }

  // Builds the food seller, then runs the belt from the fire to the shop.
  function updateHotLine(dt) {
    const s = G.s, p = G.player, next = G.hotNext();
    if (next && dist(p.x, p.y, L.hotPad.x, L.hotPad.y) < 50 && s.cash >= next.cost) {
      s.cash -= next.cost;
      s[next.key] = true;
      G.stat("upgrades");
      G.burst(L.hotPad.x, L.hotPad.y - 20, 50, ["#ffe46b", "#ff8a3c", "#ff5a3c", "#fff"], 240, 300, 1.2);
      G.shake = 5;
      CTC.audio.play("build");
      G.emit("toast", next.name + ": " + next.says);
      G.save();
    }
    if (!s.hotBelt) return;
    G.timers.hotBelt = (G.timers.hotBelt || 0) - dt;
    if (G.timers.hotBelt <= 0 && s.cookedPile.length && s.cookedStock.length + G.hotBeltItems.length < G.hotCap()) {
      G.hotBeltItems.push({ species: s.cookedPile.pop(), d: 0 });
      G.timers.hotBelt = 0.6 / (1 + 0.5 * s.upg.hotBelt);
    }
    for (let i = G.hotBeltItems.length - 1; i >= 0; i--) {
      const b = G.hotBeltItems[i];
      b.d += G.hotBeltSpeed() * dt;
      if (b.d >= G.pathLength(L.hotBeltPath)) {
        s.cookedStock.push(b.species);
        G.hotBeltItems.splice(i, 1);
        CTC.audio.play("plop");
      }
    }
  }

  function updateFire(dt) {
    const s = G.s, p = G.player, C = CTC.COOKING;
    if (!G.cookingUnlocked()) return;
    const near = dist(p.x, p.y, L.fire.x, L.fire.y) < 75;
    if (!s.fire) {
      if (near && s.wood >= C.buildWood && s.cash >= G.fireCash()) {
        s.wood -= C.buildWood;
        s.cash -= G.fireCash();
        s.fire = true;
        G.stat("fires");
        G.burst(L.fire.x, L.fire.y - 20, 50, ["#ffe46b", "#ff8a3c", "#ff5a3c", "#fff"], 240, 300, 1.2);
        G.shake = 5;
        CTC.audio.play("build");
        G.emit("toast", "Fireplace and Hot Food shop open! Cook raw fish here and sell them at the shop for " + C.priceMult + "x the price.");
        G.save();
      } else if (near && G.noticeT <= 0 && (p.moving === false)) {
        const lack = s.wood < C.buildWood ? "Need " + (C.buildWood - s.wood) + " more wood" : "Need " + G.fmt(G.fireCash()) + " for the fireplace";
        G.float(L.fire.x, L.fire.y - 62, lack, "#ffe0a3", 18);
        G.noticeT = 3;
      }
      return;
    }
    s.grill.forEach((g) => { if (g.t < G.cookTime()) g.t += dt; });
    for (let i = s.grill.length - 1; i >= 0; i--) {
      if (s.grill[i].t >= G.cookTime() && s.cookedPile.length < C.pileCap) {
        s.cookedPile.push(s.grill[i].sp);
        G.stat("cooked");
        s.grill.splice(i, 1);
        G.burst(L.fire.x, L.fire.y - 34, 6, ["#ffffff", "#ffe0a3"], 60);
        G.float(L.fire.x, L.fire.y - 70, "Cooked!", "#ffe0a3", 18);
        CTC.audio.play("sizzle");
      }
    }
    if (G.mode === "play" && s.grill.length && Math.random() < dt * 22) {
      G.particles.push({ x: L.fire.x + rand(-16, 16), y: L.fire.y - 26, vx: rand(-12, 12), vy: -rand(40, 80), g: -20, t: 0, life: 0.7, r: rand(1.5, 3.2), c: Math.random() < 0.5 ? "#ffb347" : "#ff6a3c" });
    }
    if (!near) return;
    G.timers.cook = (G.timers.cook || 0) - dt;
    if (G.timers.cook > 0) return;
    const hasFuel = s.fuel > 0 || s.wood > 0;
    if (s.carried.length && s.grill.length + G.feedItems.length < G.grillSlots() && hasFuel) {
      if (s.fuel <= 0) { s.wood--; s.fuel = C.fishPerLog; }
      s.fuel--;
      const sp = s.carried.pop();
      s.grill.push({ sp, t: 0 });
      G.fly({ kind: "fish", species: sp, x0: p.x, y0: p.y - 55, x1: L.fire.x, y1: L.fire.y - 30, dur: 0.25, h: 30 });
      CTC.audio.play("plop");
      G.timers.cook = 0.15;
    } else if (s.cookedPile.length && G.bagCount() < G.bagCap()) {
      const sp = s.cookedPile.pop();
      s.cookedBag.push(sp);
      G.fly({ kind: "fish", cooked: true, species: sp, x0: L.fire.x, y0: L.fire.y - 30, x1: p.x, y1: p.y - 55, dur: 0.22, h: 26 });
      CTC.audio.play("plop");
      G.timers.cook = 0.12;
    } else if (s.carried.length && !hasFuel && G.noticeT <= 0) {
      G.float(L.fire.x, L.fire.y - 62, "No wood! Chop a tree", "#ffb3a8", 18);
      G.noticeT = 3;
    }
  }

  function runQueue(list, q, dt) {
    let idx = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].x > 1340 || list[i].y > 760) list.splice(i, 1);
    }
    list.forEach((c) => {
      if (c.state !== "leave") {
        c.tx = q.x + q.gap * idx; c.ty = q.y; idx++;
        c.patience -= dt;
        if (c.patience <= 0) {
          c.state = "leave"; c.mood = "sad";
          G.float(c.x, c.y - 70, c.cooked ? "No food?" : "No fish?", "#ffc9c2", 16);
        }
      } else { c.tx = 1350; c.ty = c.cooked ? 712 : 690; }
      const d = dist(c.x, c.y, c.tx, c.ty);
      c.moving = d > 3;
      if (c.moving) {
        const sp = (c.state === "leave" ? 130 : 105) * dt;
        c.face = c.tx < c.x ? -1 : 1;
        c.x += ((c.tx - c.x) / d) * Math.min(sp, d);
        c.y += ((c.ty - c.y) / d) * Math.min(sp, d);
        c.walk += dt * 9;
      } else if (c.state !== "leave") c.face = -1;
      c.joy = Math.max(0, c.joy - dt * 2.5);
    });
  }

  function updateCustomers(dt) {
    const q = L.queue;
    G.timers.customer -= dt;
    const waiting = G.customers.filter((c) => c.state !== "leave");
    if (G.timers.customer <= 0 && waiting.length < q.max) {
      G.customers.push(CTC.art.makeCustomer(1320, q.y + rand(-4, 4), 1 + Math.floor(Math.random() * 3)));
      G.timers.customer = G.customerEvery() * rand(0.8, 1.2);
    }
    runQueue(G.customers, q, dt);
  }

  // The cooked food shop has its own customers, served by you or its sellers.
  function updateShop(dt) {
    const s = G.s, p = G.player, q = L.shopQueue, C = CTC.COOKING;
    if (!s.fire) return;
    G.timers.diner = (G.timers.diner || 0) - dt;
    if (G.timers.diner <= 0 && G.diners.filter((c) => c.state !== "leave").length < q.max) {
      const c = CTC.art.makeCustomer(1320, q.y, 1 + Math.floor(Math.random() * C.dinerMaxWant));
      c.cooked = true;
      G.diners.push(c);
      G.timers.diner = (C.dinerEvery / (1 + 0.5 * s.upg.hotSellers)) * rand(0.8, 1.2);
    }
    runQueue(G.diners, q, dt);
    G.timers.shopServe = (G.timers.shopServe || 0) - dt;
    if (G.timers.shopServe > 0 || !s.cookedStock.length) return;
    const playerThere = dist(p.x, p.y, L.shopZone.x, L.shopZone.y) < L.shopZone.r;
    const hotSellers = G.hotSellerCount();
    if (!playerThere && !hotSellers) return;
    const c = G.diners.find((x) => x.state !== "leave");
    if (!c || dist(c.x, c.y, q.x, q.y) > 16) return;
    const sp = s.cookedStock.shift();
    s.sold++;
    G.fly({ kind: "fish", cooked: true, species: sp, x0: L.shop.x + 30, y0: L.shop.y - 50, x1: c.x, y1: c.y - 60, dur: 0.3, h: 36 });
    addCash(G.cookedValue(sp), c.x, c.y);
    G.stat("sold");
    G.stat("cookedSold");
    c.want--;
    c.joy = 1;
    if (c.want <= 0) { G.stat("customers"); c.state = "leave"; c.mood = "happy"; G.burst(c.x, c.y - 60, 6, ["#ff8fa3", "#ffe46b"], 70); }
    G.timers.shopServe = Math.min(playerThere ? 0.3 : Infinity, hotSellers ? 0.55 / hotSellers : Infinity);
  }

  function updateSelling(dt) {
    const s = G.s, p = G.player;
    const playerThere = dist(p.x, p.y, L.stallZone.x, L.stallZone.y) < L.stallZone.r;
    const sellers = G.sellerCount();
    G.timers.serve -= dt;
    if (G.timers.serve > 0 || !s.stock.length || !(playerThere || sellers)) return;
    const c = G.customers.find((x) => x.state !== "leave");
    if (!c || dist(c.x, c.y, L.queue.x, L.queue.y) > 16) return;
    const sp = s.stock.shift();
    const v = G.fishValue(sp);
    s.sold++;
    G.fly({ kind: "fish", species: sp, x0: L.stall.x + 30, y0: L.stall.y - 56, x1: c.x, y1: c.y - 60, dur: 0.3, h: 36 });
    addCash(v, c.x, c.y);
    G.stat("sold");
    c.want--;
    c.joy = 1;
    if (c.want <= 0) { G.stat("customers"); c.state = "leave"; c.mood = "happy"; G.burst(c.x, c.y - 60, 6, ["#ff8fa3", "#ffe46b"], 70); }
    const sellerPace = sellers ? 0.48 / (G.demandBoost() * sellers) : Infinity;
    G.timers.serve = Math.min(playerThere ? 0.3 : Infinity, sellerPace);
  }

  function updateMachines(dt) {
    const s = G.s, every = G.machineEvery();
    const room = () => s.crate.length + G.cratePending < G.crateCap();
    const toCrate = (x, y, species, delay) => {
      G.cratePending++;
      G.fly({
        kind: "fish", species, x0: x, y0: y,
        x1: L.crate.x + rand(-16, 16), y1: L.crate.y - 22,
        dur: 0.8 + (delay || 0), h: 100,
        done: () => { G.cratePending--; s.crate.push(species); s.caught++; G.stat("machine"); }
      });
    };
    G.machines.forEach((m) => {
      if (m.type === "rig") {
        m.t += dt;
        const phase = m.t / every;
        // Net dips during the last 30% of the cycle and comes up with a fish.
        m.dip = phase > 0.7 ? Math.sin(((phase - 0.7) / 0.3) * Math.PI) : 0;
        if (phase > 0.85 && !m.splashed) { m.splashed = true; G.splash(m.x - 115, m.y + 18, false); }
        if (phase >= 1) {
          m.t = 0; m.splashed = false;
          if (room()) {
            for (let k = 0; k < G.catcherLv(m) && room(); k++) toCrate(m.x - 112, m.y - 8, G.rollFish(), k * 0.12);
          } else if (G.time - (m.lastFull || -9) > 6) { m.lastFull = G.time; G.float(m.x, m.y - 90, "Crate full", "#ffd2c9", 16); }
        }
      } else if (m.type === "boat") updateBoat(m, dt, every, room, toCrate);
    });
  }

  function updateBoat(m, dt, every, room, toCrate) {
    const HOLD = 6;
    if (m.state === "out" || m.state === "home") {
      const d = dist(m.bx, m.by, m.tx, m.ty);
      if (d < 6) {
        if (m.state === "out") { m.state = "fish"; m.t = 0; }
        else { m.state = "unload"; m.t = 0; }
      } else {
        const sp = 72 * dt;
        m.face = m.tx < m.bx ? -1 : 1;
        m.bx += ((m.tx - m.bx) / d) * sp;
        m.by += ((m.ty - m.by) / d) * sp;
        if (Math.random() < dt * 14) G.particles.push({ x: m.bx - m.face * 34, y: m.by + 8, vx: 0, vy: 0, g: 0, t: 0, life: 0.9, r: rand(2, 4), c: "rgba(255,255,255,.8)" });
      }
    } else if (m.state === "fish") {
      m.t += dt;
      m.dip = Math.sin((m.t / (every * 0.5)) * Math.PI * 2) * 0.5 + 0.5;
      if (m.t >= every * 0.5) {
        m.t = 0; m.casts++; m.haul += G.catcherLv(m);
        G.splash(m.bx - m.face * 42, m.by + 10, false);
        if (m.casts >= HOLD) { m.casts = 0; m.state = "home"; m.tx = m.dockX; m.ty = m.dockY; m.dip = 0; }
        else if (m.casts % 2 === 0) { m.tx = rand(60, 360); m.ty = rand(90, 680); m.state = "out"; m.dip = 0; }
      }
    } else if (m.state === "unload") {
      m.t += dt;
      if (m.t > 0.35 / G.catcherLv(m) && m.haul > 0) {
        if (room()) { toCrate(m.bx, m.by - 18, G.rollFish()); m.haul--; m.t = 0; }
      } else if (m.haul === 0 && m.t > 0.4) {
        m.state = "out"; m.tx = rand(60, 360); m.ty = rand(90, 680);
      }
    }
  }

  const BELT_LEN = L.beltPath.reduce((a, pt, i) => (i ? a + dist(pt[0], pt[1], L.beltPath[i - 1][0], L.beltPath[i - 1][1]) : 0), 0);
  G.pathLength = (P) => P.reduce((a, pt, i) => (i ? a + dist(pt[0], pt[1], P[i - 1][0], P[i - 1][1]) : 0), 0);
  G.beltPoint = (d) => G.pointOnPath(L.beltPath, d);
  G.pointOnPath = function (P, d) {
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      const seg = dist(a[0], a[1], b[0], b[1]);
      if (d <= seg) return { x: a[0] + ((b[0] - a[0]) * d) / seg, y: a[1] + ((b[1] - a[1]) * d) / seg };
      d -= seg;
    }
    const last = P[P.length - 1];
    return { x: last[0], y: last[1] };
  };

  function updateBelt(dt) {
    if (!G.has("chain")) return;
    const s = G.s;
    G.timers.belt -= dt;
    if (G.timers.belt <= 0 && s.crate.length && s.stock.length + G.belt.length < G.stockCap()) {
      G.belt.push({ species: s.crate.pop(), d: 0 });
      G.timers.belt = G.beltGap();
    }
    for (let i = G.belt.length - 1; i >= 0; i--) {
      const b = G.belt[i];
      b.d += G.beltSpeed() * dt;
      if (b.d >= BELT_LEN) {
        s.stock.push(b.species);
        G.belt.splice(i, 1);
        CTC.audio.play("plop");
      }
    }
  }

  function updatePad(dt) {
    const b = G.nextBuild(), s = G.s, p = G.player;
    if (!b || s.cash <= 0) return;
    const spot = L.spots[b.spot];
    if (dist(p.x, p.y, spot.x, spot.y) > 50) return;
    const left = b.cost - s.paid;
    const pay = Math.min(left, s.cash, Math.max(b.cost * 0.7, 25) * dt);
    s.cash -= pay;
    s.paid += pay;
    G.timers.payFx -= dt;
    if (G.timers.payFx <= 0) {
      G.timers.payFx = 0.07;
      G.fly({ kind: "coin", x0: p.x, y0: p.y - 50, x1: spot.x, y1: spot.y, dur: 0.3, h: 40 });
      CTC.audio.play("pay");
    }
    if (s.paid >= b.cost - 0.001) completeBuild(b, spot);
  }

  function completeBuild(b, spot) {
    const s = G.s;
    s.built++;
    s.paid = 0;
    G.stat("build_" + b.type);
    addMachine(b, true, s.built - 1);
    G.burst(spot.x, spot.y - 20, 50, ["#ffe46b", "#ff8fa3", "#7fe0ff", "#9fe8b8", "#fff"], 260, 380, 1.3);
    G.shake = 5;
    if (b.type === "ship") {
      CTC.audio.play("sail");
      G.mode = "sailing";
      G.sailT = 0;
      G.net = null;
    } else {
      CTC.audio.play("build");
      if (b.type === "cashier") G.emit("toast", b.name + ": " + b.says + " NEW: click a tree to chop wood, then build a fireplace and cook!");
      else if (b.says) G.emit("toast", b.name + ": " + b.says);
    }
    G.save();
  }

  /* ---------- tutorial guide ---------- */
  G.guide = function () {
    const s = G.s, b = G.nextBuild(), p = G.player;
    if (G.foodArmed) return { text: "Click the water to throw the fish food" };
    const F = L.fire;
    if (s.fire && !s.hotBelt && s.cookedPile.length && G.bagCount() < G.bagCap()) return { text: "Cooked fish ready! Collect it at the fire", x: F.x, y: F.y - 40 };
    if (s.cookedBag.length) return { text: "Take your cooked fish to the Hot Food shop", x: L.shopZone.x, y: L.shopZone.y - 20 };
    if (s.cookedStock.length && G.diners.some((c) => c.state !== "leave")) {
      const there = dist(p.x, p.y, L.shopZone.x, L.shopZone.y) < L.shopZone.r;
      if (there && !s.hotSeller) return { text: "Serving hot food. Stay here until it's sold" };
    }
    if (s.seaBag.length && (s.kitchen || s.hotel)) {
      const zone = CTC.SEA.venues[s.kitchen ? "kitchen" : "hotel"].zone;
      return { text: "Take your sea creatures to the Cloud Kitchen or Hotel", x: zone.x, y: zone.y - 20 };
    }
    if (G.food && G.bagCount() < G.bagCap()) return { text: "Fish are swarming to the food. Throw your net there!" };
    if (s.campaignDone) return { text: "You conquered every sea! More levels coming soon." };
    if (b) {
      const spot = L.spots[b.spot], left = b.cost - s.paid;
      if (s.cash >= left) return { text: "Stand on the pad: " + b.name + " (" + G.fmt(left) + ")", x: spot.x, y: spot.y - 30 };
    }
    const cap = G.bagCap();
    const zone = L.stallZone;
    const atStall = dist(p.x, p.y, zone.x, zone.y) < zone.r;
    const seaStep = !b && G.seaUnlocked() && !s.campaignDone && CTC.sea.steps().find((x) => !x.done);
    const saving = b ? "Next: " + b.name + " · " + G.fmt(b.cost - s.paid) + " to go" : seaStep ? "To unlock the ship: " + seaStep.name + " · " + G.fmt(seaStep.cost) : "";
    if (G.bagCount() >= cap || (s.carried.length && !G.net && s.carried.length >= 3)) {
      return { text: "Take your fish to the stall", x: zone.x, y: zone.y + 15 };
    }
    if (atStall && !G.has("cashier") && s.stock.length) {
      return { text: "Selling... stay here until the stall is empty" };
    }
    if (!G.has("cashier") && s.stock.length >= 3) return { text: "Customers are waiting. Go to the stall", x: zone.x, y: zone.y + 15 };
    if (!G.has("chain") && s.crate.length) return { text: "Collect fish from the crate. " + saving, x: L.crate.x, y: L.crate.y - 50 };
    if (!G.has("rig") && !G.has("boat")) return { text: "Click a school of fish to throw your net" };
    if (!s.fire && G.cookingUnlocked()) {
      return { text: s.wood < CTC.COOKING.buildWood
        ? "Click a tree to chop wood for a fireplace (" + s.wood + "/" + CTC.COOKING.buildWood + ")"
        : "Stand on the fireplace pad to build it" };
    }
    const belt = CTC.BELTS.find(G.canBuyBelt);
    if (seaStep) return { text: saving };
    if (belt) return { text: "Open Upgrades to build a belt: " + belt.name + " (" + G.fmt(G.beltCost(belt.id)) + ")" };
    const hot = G.hotNext();
    if (hot && s.cash >= hot.cost) return { text: "Stand on the pad: " + hot.name + " (" + G.fmt(hot.cost) + ")", x: L.hotPad.x, y: L.hotPad.y - 30 };
    return { text: saving };
  };
})();
