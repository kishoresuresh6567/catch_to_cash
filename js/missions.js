/* Player level and missions. This progress is separate from the places
   (Sunny Cove and so on) and carries across all of them.

   There are 100 missions and 100 player levels. Mission XP is scaled so that
   finishing the last mission lands exactly on level 100.

   One mission runs at a time, against a deadline. Missing it fails the player level.
   Each mission is sized when it starts, from what the player can do right now, so it
   stays a job of 2 to 5 minutes all through the game.

   To add a kind of mission, add a line to KINDS. stat is the counter the game increases,
   see the G.stat(...) calls in game.js. rate is the fish (or cash, or wood) per second that a
   steady player makes, used when the player's own recent pace is lower. */
(function () {
  const G = CTC.game;
  const PROFILE_KEY = "catchToCash.player";
  const MAX_LEVEL = 100;
  const MISSION_COUNT = 100;
  const PRICE_PER_LEVEL = 0.005; // Each player level adds 0.5% to all fish prices.
  const MINUTES = [2, 3, 4, 5]; // How long the missions take, in turn.
  const DEADLINE_SPARE = 1.5; // The deadline allows this much longer than the job takes.
  const PACE_WINDOW = 30;
  const PACE_SHARE = 0.55; // Recent pace includes bursts no one can keep up, so aim below it.

  const machineRate = () => G.catchers().reduce((a, m) => a + G.catcherLv(m), 0) * (0.45 / G.machineEvery());
  const KINDS = [
    { stat: "netCaught", text: "Catch {n} fish with your net", rate: () => Math.min(G.netCatch(), G.bagCap()) / 10, can: () => true },
    { stat: "sold", text: "Sell {n} fish", rate: () => 0.3, can: () => true },
    { stat: "earned", text: "Earn {n}", money: true, rate: () => 0.3 * G.fishValue(1) * 2, can: () => true },
    { stat: "customers", text: "Serve {n} customers", rate: () => 0.12, can: () => true },
    { stat: "food", text: "Throw fish food {n} times", rate: () => 0.03, can: () => G.s.cash >= G.foodCost() * 8 },
    { stat: "machine", text: "Have your machines catch {n} fish", rate: machineRate, can: () => G.catchers().length > 0 },
    { stat: "wood", text: "Chop {n} wood", rate: () => 0.05, can: () => G.cookingUnlocked() && G.s.wood <= 8 },
    { stat: "cooked", text: "Cook {n} fish", rate: () => 0.08, can: () => G.s.fire },
    { stat: "cookedSold", text: "Sell {n} cooked fish at the Hot Food shop", rate: () => 0.05, can: () => G.s.fire }
  ];

  const fmtCount = (n) => Math.floor(n).toLocaleString("en-US");

  const needFor = (level) => 100 + 20 * (level - 1); // XP from this level to the next
  let totalXp = 0;
  for (let l = 1; l < MAX_LEVEL; l++) totalXp += needFor(l);

  // Total XP needed to reach a (possibly fractional) level.
  const xpAtLevel = (x) => {
    let sum = 0, l = 1;
    for (; l + 1 <= x; l++) sum += needFor(l);
    return sum + (x - l) * needFor(l);
  };
  // Each mission moves you just under one level along, so no level is ever
  // skipped, and the last mission lands exactly on level 100.
  const XP = [];
  let assigned = 0;
  for (let i = 0; i < MISSION_COUNT; i++) {
    const target = xpAtLevel(1 + ((MAX_LEVEL - 1) * (i + 1)) / MISSION_COUNT);
    XP[i] = i === MISSION_COUNT - 1 ? totalXp - assigned : Math.round(target - assigned);
    assigned += XP[i];
  }

  function freshProfile() {
    return { xp: 0, index: 0, current: null, pace: {}, stats: {} };
  }

  const P = (CTC.player = { count: MISSION_COUNT, maxLevel: MAX_LEVEL, data: freshProfile() });

  P.load = function () {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (raw) {
        P.data = Object.assign(freshProfile(), raw);
        // Saves from before timed missions counted finished missions in a list.
        if (raw.done) P.data.index = Math.min(raw.done.length, MISSION_COUNT);
        delete P.data.done;
        delete P.data.active;
      }
    } catch (e) { /* corrupt or blocked storage starts fresh */ }
  };
  P.save = function () {
    if (G.saveLocked) return;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(P.data)); } catch (e) { /* ignore */ }
  };
  P.reset = function () {
    try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
    P.data = freshProfile();
  };

  P.levelInfo = function () {
    let level = 1, left = P.data.xp;
    while (level < MAX_LEVEL && left >= needFor(level)) { left -= needFor(level); level++; }
    return { level, into: left, need: level < MAX_LEVEL ? needFor(level) : 0 };
  };
  P.priceBonus = () => 1 + PRICE_PER_LEVEL * (P.levelInfo().level - 1);

  P.activeList = () => (P.data.current ? [P.data.current] : []);
  P.current = () => P.data.current;
  P.progress = (m) => Math.min(m.n, (P.data.stats[m.stat] || 0) - m.base);

  // A tidy number, rounded up, so targets read like 45 or 1,200 and not 1,187.
  function tidy(n) {
    if (n <= 10) return Math.max(1, Math.ceil(n));
    const unit = Math.pow(10, Math.floor(Math.log10(n)) - 1) * 5;
    return Math.ceil(n / unit) * unit;
  }

  function startMission() {
    const d = P.data, i = d.index;
    if (i >= MISSION_COUNT) return;
    G.s.unhappy = 0;
    G.markRetry();
    let kind = KINDS[0];
    for (let k = 0; k < KINDS.length; k++) {
      const next = KINDS[(i + k) % KINDS.length];
      if (next.can()) { kind = next; break; }
    }
    const seconds = MINUTES[i % MINUTES.length] * 60;
    const rate = Math.max(kind.rate(), (d.pace[kind.stat] || 0) * PACE_SHARE);
    const n = tidy(rate * seconds);
    const shown = kind.money ? G.fmt(n) : fmtCount(n);
    d.current = {
      id: kind.stat + "-" + i, stat: kind.stat, n, money: !!kind.money,
      text: kind.text.replace("{n}", shown).replace(" 1 times", " once"),
      base: d.stats[kind.stat] || 0, xp: XP[i], cash: 20 + i * 8,
      limit: seconds * DEADLINE_SPARE, left: seconds * DEADLINE_SPARE,
      // Fresh fish until the hot food shop is open. Then odd levels check fresh fish, even levels hot food.
      watch: G.s.shopOpen && P.levelInfo().level % 2 === 0 ? "hot" : "fresh"
    };
  }

  G.stat = function (name, n) {
    P.data.stats[name] = (P.data.stats[name] || 0) + (n === undefined ? 1 : n);
  };

  function complete(m) {
    const before = P.levelInfo().level;
    P.data.current = null;
    P.data.index++;
    P.data.xp += m.xp;
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

  // A new place, or a new try at one: paces and the running mission start over.
  P.newPlace = function () {
    P.data.current = null;
    P.data.pace = {};
    paceBase = null;
  };

  let levelReached = 0, paceT = 0, paceBase = null;
  // Remembers how fast each counter has been climbing lately.
  function trackPace(dt) {
    paceT += dt;
    if (paceT < PACE_WINDOW) return;
    const d = P.data;
    if (paceBase) {
      KINDS.forEach((k) => {
        const now = ((d.stats[k.stat] || 0) - (paceBase[k.stat] || 0)) / paceT;
        d.pace[k.stat] = (d.pace[k.stat] || now) * 0.7 + now * 0.3;
      });
    }
    paceBase = Object.assign({}, d.stats);
    paceT = 0;
  }

  P.tick = function (dt) {
    trackPace(dt);
    if (!P.data.current && !G.s.campaignDone) startMission();
    const m = P.data.current;
    if (!m) return;
    if (P.progress(m) >= m.n) {
      complete(m);
      if (!G.s.campaignDone) startMission();
    } else if (!G.s.campaignDone) {
      m.left -= dt;
      if (m.left <= 0) { G.failLevel("You ran out of time on your mission: " + m.text + "."); return; }
    }
    if (levelReached) { G.emit("levelUp", levelReached); levelReached = 0; }
  };

  P.watchesHot = (m) => m.watch === "hot";
  P.watchName = (m) => (P.watchesHot(m) ? "hot food" : "fresh fish");

  P.fmtValue = (m, v) => (m.money ? G.fmt(v) : fmtCount(v));

  P.load();
})();
