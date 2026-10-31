/* Player level and missions. This progress is separate from the places
   (Sunny Cove and so on) and carries across all of them.

   There are 100 missions and 100 player levels. Mission XP is scaled so that
   finishing the last mission lands exactly on level 100.

   To change a mission, edit MISSION_SETS or MILESTONES below. Keep the total at 100.
   - rank decides the order. Three missions with the lowest ranks are active at once.
   - stat is the counter that the game increases, see the G.stat(...) calls in game.js. */
(function () {
  const G = CTC.game;
  const PROFILE_KEY = "catchToCash.player";
  const MAX_LEVEL = 100;
  const ACTIVE_SLOTS = 3;
  const PRICE_PER_LEVEL = 0.005; // Each player level adds 0.5% to all fish prices.

  // Repeating goals. Progress counts from the moment the mission becomes active.
  const MISSION_SETS = [
    { stat: "netCaught", text: "Catch {n} fish with your net", start: 1, step: 10, targets: [10, 30, 60, 100, 200, 400, 700, 1000, 2000] },
    { stat: "sold", text: "Sell {n} fish", start: 3, step: 10, targets: [20, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 15000] },
    { stat: "earned", text: "Earn {n} in total", money: true, start: 5, step: 10, targets: [100, 500, 2000, 5000, 20000, 50000, 150000, 500000, 1500000, 5000000] },
    { stat: "customers", text: "Serve {n} customers", start: 7, step: 13, targets: [5, 15, 40, 100, 200, 400, 800, 1500] },
    { stat: "food", text: "Throw fish food {n} times", start: 9, step: 14, targets: [1, 5, 10, 20, 40, 70, 100] },
    { stat: "wood", text: "Chop {n} wood", start: 26, step: 10, targets: [3, 10, 25, 50, 100, 200, 400] },
    { stat: "rare", text: "Catch {n} rare fish with your net", start: 14, step: 14, targets: [1, 3, 6, 10, 20, 35, 60] },
    { stat: "cooked", text: "Cook {n} fish", start: 30, step: 10, targets: [5, 15, 40, 80, 150, 300, 500, 800] },
    { stat: "cookedSold", text: "Sell {n} cooked fish at the Hot Food shop", start: 32, step: 10, targets: [5, 15, 40, 80, 150, 300, 500, 800] },
    { stat: "machine", text: "Have your machines catch {n} fish", start: 20, step: 11, targets: [10, 50, 150, 400, 1000, 3000, 8000] },
    { stat: "big", text: "Catch {n} big fish (use quality food)", start: 30, step: 10, targets: [1, 5, 15, 30, 60, 100, 200] }
  ];

  // One-off goals. These count everything you've done since the start.
  const MILESTONES = [
    { rank: 2, stat: "build_rig", n: 1, text: "Build your first Auto-Net Crane" },
    { rank: 8, stat: "upgrades", n: 3, text: "Buy 3 upgrades" },
    { rank: 28, stat: "fires", n: 1, text: "Build a fireplace" },
    { rank: 40, stat: "build_cutter", n: 1, text: "Hire a woodcutter" },
    { rank: 15, stat: "build_chain", n: 1, text: "Build the Catch to Fresh Fish Market belt" },
    { rank: 22, stat: "catcherUps", n: 3, text: "Level up your fish catchers 3 times" },
    { rank: 25, stat: "build_cashier", n: 1, text: "Hire a seller" },
    { rank: 35, stat: "build_ship", n: 1, text: "Sail to a new place" },
    { rank: 38, stat: "upgrades", n: 15, text: "Buy 15 upgrades" },
    { rank: 48, stat: "build_boat", n: 1, text: "Build a trawler" },
    { rank: 65, stat: "build_ship", n: 2, text: "Sail to 2 new places" },
    { rank: 90, stat: "build_ship", n: 3, text: "Conquer 3 places" }
  ];

  const fmtCount = (n) => Math.floor(n).toLocaleString("en-US");

  function buildMissions() {
    const list = [];
    MISSION_SETS.forEach((set) => {
      set.targets.forEach((n, i) => {
        const shown = set.money ? G.fmt(n) : fmtCount(n);
        list.push({ id: set.stat + "-" + n, stat: set.stat, n, money: !!set.money, rank: set.start + set.step * i, text: set.text.replace("{n}", shown).replace(" 1 times", " once") });
      });
    });
    MILESTONES.forEach((m) => list.push({ id: "m-" + m.stat + "-" + m.n, stat: m.stat, n: m.n, rank: m.rank, text: m.text, once: true }));
    list.sort((a, b) => a.rank - b.rank);
    return list;
  }

  const needFor = (level) => 100 + 20 * (level - 1); // XP from this level to the next
  let totalXp = 0;
  for (let l = 1; l < MAX_LEVEL; l++) totalXp += needFor(l);

  const missions = buildMissions();
  // Total XP needed to reach a (possibly fractional) level.
  const xpAtLevel = (x) => {
    let sum = 0, l = 1;
    for (; l + 1 <= x; l++) sum += needFor(l);
    return sum + (x - l) * needFor(l);
  };
  // Each mission moves you just under one level along, so no level is ever
  // skipped, and the last mission lands exactly on level 100.
  let assigned = 0;
  missions.forEach((m, i) => {
    const target = xpAtLevel(1 + ((MAX_LEVEL - 1) * (i + 1)) / missions.length);
    m.xp = i === missions.length - 1 ? totalXp - assigned : Math.round(target - assigned);
    assigned += m.xp;
    m.cash = 20 + i * 8;
  });

  function freshProfile() {
    return { xp: 0, done: [], active: {}, stats: {} };
  }

  const P = (CTC.player = { missions, maxLevel: MAX_LEVEL, data: freshProfile() });

  P.load = function () {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (raw) P.data = Object.assign(freshProfile(), raw);
      // Drop missions that no longer exist, so they can't hold a mission slot.
      const known = (id) => missions.some((m) => m.id === id);
      P.data.done = P.data.done.filter(known);
      Object.keys(P.data.active).forEach((id) => { if (!known(id)) delete P.data.active[id]; });
    } catch (e) { /* corrupt or blocked storage starts fresh */ }
    fillSlots();
  };
  P.save = function () {
    if (G.saveLocked) return;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(P.data)); } catch (e) { /* ignore */ }
  };
  P.reset = function () {
    try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
    P.data = freshProfile();
    fillSlots();
  };

  P.levelInfo = function () {
    let level = 1, left = P.data.xp;
    while (level < MAX_LEVEL && left >= needFor(level)) { left -= needFor(level); level++; }
    return { level, into: left, need: level < MAX_LEVEL ? needFor(level) : 0 };
  };
  P.priceBonus = () => 1 + PRICE_PER_LEVEL * (P.levelInfo().level - 1);

  P.isDone = (m) => P.data.done.includes(m.id);
  P.activeList = () => missions.filter((m) => P.data.active[m.id] !== undefined);
  P.progress = function (m) {
    const have = P.data.stats[m.stat] || 0;
    return Math.min(m.n, m.once ? have : have - (P.data.active[m.id] || 0));
  };

  function fillSlots() {
    for (const m of missions) {
      if (Object.keys(P.data.active).length >= ACTIVE_SLOTS) break;
      if (!P.isDone(m) && P.data.active[m.id] === undefined) P.data.active[m.id] = P.data.stats[m.stat] || 0;
    }
  }

  G.stat = function (name, n) {
    P.data.stats[name] = (P.data.stats[name] || 0) + (n === undefined ? 1 : n);
  };

  function complete(m) {
    const before = P.levelInfo().level;
    delete P.data.active[m.id];
    P.data.done.push(m.id);
    P.data.xp += m.xp;
    fillSlots();
    const cash = Math.round(m.cash * G.level().costScale);
    G.s.cash += cash;
    const p = G.player;
    G.float(p.x, p.y - 110, "Mission done! +" + m.xp + " XP", "#9fe8b8", 22);
    G.emit("toast", "Mission complete: " + m.text + " (+" + m.xp + " XP, +" + G.fmt(cash) + ")");
    CTC.audio.play("upgrade");
    const after = P.levelInfo().level;
    if (after > before) {
      G.burst(p.x, p.y - 50, 60, ["#ffe46b", "#ff8fa3", "#7fe0ff", "#9fe8b8", "#fff"], 280, 380, 1.3);
      G.float(p.x, p.y - 140, "LEVEL " + after + "!", "#ffe46b", 34);
      CTC.audio.play("build");
      levelReached = after;
    }
    P.save();
  }

  let checkT = 0, levelReached = 0;
  P.tick = function (dt) {
    checkT -= dt;
    if (checkT > 0) return;
    checkT = 0.25;
    P.activeList().forEach((m) => { if (P.progress(m) >= m.n) complete(m); });
    // Wait until every finished mission is counted, so the screen lists the new ones.
    if (levelReached) { G.emit("levelUp", levelReached); levelReached = 0; }
  };

  P.fmtValue = (m, v) => (m.money ? G.fmt(v) : fmtCount(v));

  P.load();
})();
