/* DOM interface: wallet, objective, upgrades drawer and overlay screens. */
(function () {
  const G = CTC.game;
  const $ = (id) => document.getElementById(id);
  const UI = (CTC.ui = {});
  let toastTimer, lastObjective, lastCash = -1, lastRoadKey = "", upgradeKey = "", trackKey = "", missionKey = "";

  UI.init = function () {
    $("btnUpgrades").onclick = () => { CTC.audio.init(); $("drawer").classList.toggle("open"); UI.togglePanel(false); upgradeKey = ""; };
    $("btnMove").onclick = () => { CTC.audio.init(); UI.togglePanel(false); UI.toggleTop(false); G.toggleMove(true); };
    $("btnMoveDone").onclick = () => G.toggleMove(false);
    $("closeDrawer").onclick = () => $("drawer").classList.remove("open");
    $("btnBasket").onclick = () => { CTC.audio.init(); G.buyUpgrade("bag"); };
    $("btnFood").onclick = () => { CTC.audio.init(); UI.toggleFood(); };
    $("btnFoodTime").onclick = () => { CTC.audio.init(); G.buyUpgrade("foodTime"); };
    $("btnFoodQuality").onclick = () => { CTC.audio.init(); G.buyUpgrade("foodQuality"); };
    $("playerBadge").onclick = () => { UI.toggleTop(false); UI.toggleMissions(); };
    $("closeMissions").onclick = () => $("missionPanel").classList.remove("open");
    // Releasing focus stops the browser leaving a highlight ring on the arrows after a tap.
    $("panelTab").onclick = () => { UI.togglePanel(); $("panelTab").blur(); };
    $("topTab").onclick = () => { UI.toggleTop(); $("topTab").blur(); };
    $("btnSound").onclick = () => {
      CTC.audio.init();
      CTC.audio.setMuted(!CTC.audio.muted);
      $("btnSound").classList.toggle("muted", CTC.audio.muted);
      try { localStorage.setItem("catchToCash.muted", CTC.audio.muted ? "1" : ""); } catch (e) { /* ignore */ }
    };
    $("btnMenu").onclick = () => { UI.togglePanel(false); UI.toggleMenu(); };
    $("btnResume").onclick = () => UI.toggleMenu(false);
    $("btnReset").onclick = () => {
      if (!confirm("Erase all progress and start over?")) return;
      G.wipeSave();
      G.saveLocked = true; // Stops the exit autosave from restoring what was just erased.
      location.reload();
    };
    $("btnPlay").onclick = () => {
      if (G.loadSave() && !confirm("Start over? Your saved game will be erased.")) return;
      CTC.audio.init();
      G.newGame();
      $("title").classList.add("hidden");
      UI.showBriefing();
    };
    $("btnContinue").onclick = () => {
      CTC.audio.init();
      if (G.s.built >= G.level().builds.length) {
        begin();
        if (!G.s.campaignDone) { G.mode = "complete"; UI.showComplete(); }
        return;
      }
      $("title").classList.add("hidden");
      UI.showBriefing();
    };
    $("btnBrief").onclick = () => {
      $("briefing").classList.add("hidden");
      if (briefIsLevelUp) {
        $("hud").classList.remove("hidden");
        G.mode = "play";
      } else begin();
    };
    $("btnNext").onclick = () => {
      $("complete").classList.add("hidden");
      const hasNext = !!CTC.LEVELS[G.s.level + 1];
      G.nextLevel();
      if (hasNext) UI.showBriefing();
      else showLevelBanner();
    };
    try {
      if (localStorage.getItem("catchToCash.muted")) { CTC.audio.muted = true; $("btnSound").classList.add("muted"); }
    } catch (e) { /* ignore */ }

    if (G.s && G.loadSave()) $("btnContinue").classList.remove("hidden");

    G.on("toast", UI.toast);
    G.on("levelUp", UI.showLevelUp);
    G.on("complete", UI.showComplete);
    G.on("coinArrived", () => {
      const el = $("cash");
      el.classList.remove("punch");
      void el.offsetWidth;
      el.classList.add("punch");
    });
    G.on("levelChanged", () => { lastRoadKey = ""; upgradeKey = ""; lastObjective = null; });
  };

  function begin() {
    $("title").classList.add("hidden");
    $("hud").classList.remove("hidden");
    G.mode = "play";
    showLevelBanner();
  }

  // Pauses the game with the missions to do next on a card over the world.
  function showMissionScreen(kicker, title, text, rows) {
    G.mode = "briefing";
    $("hud").classList.add("hidden");
    $("briefKicker").textContent = kicker;
    $("briefTitle").textContent = title;
    $("briefText").textContent = text;
    $("briefList").innerHTML = rows.map((r) => '<li class="' + (r.done ? "done" : "") + '"><b>' + r.name + "</b><span>" + r.value + "</span></li>").join("");
    $("briefing").classList.remove("hidden");
    CTC.audio.play("fishJump");
  }

  UI.showLevelUp = function (level) {
    if (G.mode !== "play") return;
    const P = CTC.player, bonus = Math.round((P.priceBonus() - 1) * 1000) / 10;
    briefIsLevelUp = true;
    const rows = P.activeList().map((m) => ({ name: m.text, value: P.fmtValue(m, P.progress(m)) + "/" + P.fmtValue(m, m.n) }));
    const goal = level < P.maxLevel ? "Missions to perform to reach level " + (level + 1) + ":" : "You reached the top level!";
    showMissionScreen("Level up!", "Player Level " + level, "All fish now sell for " + bonus + "% more. " + goal, rows);
  };

  UI.showBriefing = function () {
    const s = G.s, lv = G.level(), next = CTC.LEVELS[s.level + 1];
    briefIsLevelUp = false;
    // Starts close enough to see the people. Zoom out for the whole map.
    Object.assign(G.cam, { z: CTC.START_ZOOM, x: G.player.x - CTC.LAYOUT.width / (2 * CTC.START_ZOOM), y: G.player.y - CTC.LAYOUT.height / (2 * CTC.START_ZOOM) });
    const ship = lv.builds[lv.builds.length - 1];
    const builds = lv.builds.slice(0, -1).map((b, i) => ({ name: b.name, cost: b.cost, done: i < s.built }));
    const rows = builds.concat(CTC.sea.steps(), ship).map((b) => ({ name: b.name, value: G.fmt(b.cost), done: b.done }));
    showMissionScreen("Place " + (s.level + 1), lv.name, next ? "Missions to complete to reach " + next.name + ":" : "Missions to complete to conquer this place:", rows);
  };

  let briefIsLevelUp = false;

  function showLevelBanner() {
    const lv = G.level();
    // The goal box starts hidden, so new players get their first instruction here.
    UI.toast(G.s.caught ? lv.name + ": " + lv.tagline : "Tap a school of fish in the water to throw your net!");
  }

  UI.toast = function (text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3400);
  };

  UI.toggleMenu = function (force) {
    const el = $("menu");
    const show = force === undefined ? el.classList.contains("hidden") : force;
    el.classList.toggle("hidden", !show);
    if (G.mode === "play" || G.mode === "paused") G.mode = show ? "paused" : "play";
    G.save();
  };

  UI.showComplete = function () {
    const s = G.s, lv = G.level();
    const next = CTC.LEVELS[s.level + 1];
    const mins = Math.floor(s.time / 60), secs = String(Math.floor(s.time % 60)).padStart(2, "0");
    $("doneTitle").textContent = lv.name + " conquered!";
    $("doneStats").innerHTML =
      stat(s.caught.toLocaleString("en-US"), "fish caught") +
      stat(s.sold.toLocaleString("en-US"), "fish sold") +
      stat(G.fmt(s.earned), "cash earned") +
      stat(mins + ":" + secs, "time");
    $("doneNext").textContent = next
      ? "Next stop: " + next.name + ". " + next.tagline
      : "You've conquered every sea so far. More levels are coming!";
    $("btnNext").textContent = next ? "Sail to " + next.name : "Keep fishing";
    $("complete").classList.remove("hidden");
    G.save();
  };

  function stat(value, label) { return "<div><b>" + value + "</b><span>" + label + "</span></div>"; }

  function renderRoadmap() {
    const s = G.s, builds = G.level().builds;
    const key = s.level + ":" + s.built + ":" + Math.floor((s.paid / (builds[s.built] ? builds[s.built].cost : 1)) * 20);
    if (key === lastRoadKey) return;
    lastRoadKey = key;
    $("levelName").textContent = "Place " + (s.level + 1) + " · " + G.level().name + " · " + Math.min(s.built, builds.length) + "/" + builds.length + " built";
    $("roadmap").innerHTML = builds.map((b, i) => {
      const w = i < s.built ? 100 : i === s.built ? (s.paid / b.cost) * 100 : 0;
      return '<div class="step' + (i === s.built ? " next" : "") + '" title="' + b.name + '"><i style="width:' + w + '%"></i></div>';
    }).join("");
  }

  UI.toggleMissions = function () {
    missionKey = "";
    $("missionPanel").classList.toggle("open");
  };

  function renderPlayer() {
    const P = CTC.player, info = P.levelInfo();
    const label = "Player Level " + info.level;
    if ($("playerLevel").textContent !== label) $("playerLevel").textContent = label;
    $("xpFill").style.width = (info.need ? (info.into / info.need) * 100 : 100) + "%";
    const xp = info.need ? info.into + " / " + info.need + " XP" : "Max level!";
    if ($("xpText").textContent !== xp) $("xpText").textContent = xp;

    const active = P.activeList();
    const key = active.map((m) => m.id + ":" + Math.floor(P.progress(m))).join();
    if (key !== trackKey) {
      trackKey = key;
      $("missionTracker").innerHTML = "<h4>Missions · " + P.data.done.length + "/" + P.missions.length + "</h4>" + (active.length ? active.map((m) => {
        const have = P.progress(m);
        return '<div class="track"><span>' + P.fmtValue(m, have) + "/" + P.fmtValue(m, m.n) + "</span><b>" + m.text + '</b><div class="xpbar"><i style="width:' + (have / m.n) * 100 + '%"></i></div></div>';
      }).join("") : "<b>Every mission complete!</b>");
    }

    if (!$("missionPanel").classList.contains("open")) return;
    const panelKey = P.data.done.length + ":" + key;
    if (panelKey === missionKey) return;
    missionKey = panelKey;
    $("missionSummary").textContent = "Finish missions to earn XP. Each player level adds 0.5% to all fish prices (now +" + Math.round((P.priceBonus() - 1) * 1000) / 10 + "%). This stays with you in every place.";
    $("missionList").innerHTML = P.missions.map((m, i) => {
      const done = P.isDone(m), on = P.data.active[m.id] !== undefined;
      const state = done ? "done" : on ? "active" : "locked";
      const note = on ? " (" + P.fmtValue(m, P.progress(m)) + "/" + P.fmtValue(m, m.n) + ")" : "";
      return '<div class="mission ' + state + '"><span class="num">' + (i + 1) + '</span><span class="txt">' + m.text + note + '</span><span class="xp">' + (done ? "Done" : "+" + m.xp + " XP") + "</span></div>";
    }).join("");
  }

  function renderWood() {
    const s = G.s, C = CTC.COOKING;
    const text = "Wood " + s.wood + "/" + C.woodCap + (s.fire ? " · Fire " + s.grill.length + "/" + G.grillSlots() : "");
    const el = $("woodInfo");
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle("hidden", !G.cookingUnlocked());
  }

  function renderBasket() {
    const s = G.s, u = CTC.UPGRADES.find((x) => x.id === "bag");
    const maxed = s.upg.bag >= u.max, cost = G.upgradeCost(u);
    const text = "Basket " + G.bagCount() + "/" + G.bagCap() + (maxed ? " · MAX" : " · ▲ " + (G.bagCap() + 2) + " for " + G.fmt(cost));
    const btn = $("btnBasket");
    if (btn.textContent !== text) btn.textContent = text;
    btn.disabled = maxed || s.cash < cost;
  }

  UI.togglePanel = function (force) {
    const open = $("leftDock").classList.toggle("open", force);
    $("panelTab").setAttribute("aria-expanded", open);
    $("panelTab").setAttribute("aria-label", open ? "Hide options" : "Show options");
  };

  UI.toggleTop = function (force) {
    const open = $("topDock").classList.toggle("open", force);
    $("topTab").setAttribute("aria-expanded", open);
    $("topTab").setAttribute("aria-label", open ? "Hide goal and player level" : "Show goal and player level");
  };

  UI.toggleFood = function () {
    G.foodArmed = !G.foodArmed && G.canBuyFood();
    // Clear the panel out of the way so that the water can be tapped.
    if (G.foodArmed) UI.togglePanel(false);
  };

  // A red dot on the closed tab means something in the panel is ready to use.
  function renderPanelDot() {
    const ready = ["btnBasket", "btnFoodTime", "btnFoodQuality"].some((id) => !$(id).disabled) || !$("upBadge").classList.contains("hidden");
    $("panelDot").classList.toggle("hidden", !ready);
  }

  function renderFood() {
    if (G.foodArmed && !G.canBuyFood()) G.foodArmed = false;
    let text = "Fish Food · Q" + G.foodQuality() + " · " + G.foodDuration() + "s · " + G.fmt(G.foodCost()) + (window.matchMedia("(pointer: coarse)").matches ? "" : " (F)");
    if (G.foodArmed) text = "Click the water · Cancel";
    else if (G.food) text = "Fish feeding · " + Math.ceil(G.food.life - G.food.t) + "s";
    const btn = $("btnFood");
    if (btn.textContent !== text) btn.textContent = text;
    btn.disabled = !G.foodArmed && !G.canBuyFood();
    btn.classList.toggle("armed", G.foodArmed);
    renderFoodUpgrade("btnFoodTime", "foodTime", "Time", (n) => G.foodDurationAt(n) + "s");
    renderFoodUpgrade("btnFoodQuality", "foodQuality", "Quality", (n) => "Q" + n);
  }

  function renderFoodUpgrade(id, key, label, show) {
    const s = G.s, u = CTC.UPGRADES.find((x) => x.id === key);
    const maxed = s.upg[key] >= u.max, cost = G.upgradeCost(u);
    const text = maxed ? label + " " + show(s.upg[key]) + " · MAX" : "\u25B2 " + label + " " + show(s.upg[key] + 1) + " · " + G.fmt(cost);
    const btn = $(id);
    if (btn.textContent !== text) btn.textContent = text;
    btn.disabled = maxed || s.cash < cost;
  }

  function renderFishGuide(list) {
    const h = document.createElement("h3");
    h.textContent = "Fish guide";
    list.appendChild(h);
    const defs = G.level().fish.slice().sort((a, b) => a.value - b.value);
    const q = G.foodQuality();
    defs.forEach((f) => {
      const row = document.createElement("div");
      const locked = (f.food || 0) > q;
      row.className = "fishrow" + (locked ? " locked" : "");
      const icon = document.createElement("canvas");
      icon.width = 144; icon.height = 72;
      const c = icon.getContext("2d");
      c.scale(2, 2);
      CTC.art.fish(c, 34, 18, f, 0.9, 0, 0);
      row.appendChild(icon);
      const where = (f.food ? "Food quality " + f.food + (locked ? " needed" : "") : f.rare ? "Rare, wild" : "Wild") +
        (G.cookingUnlocked() ? " · cooked " + G.fmt(G.cookedValue(G.level().fish.indexOf(f))) : "");
      const info = document.createElement("div");
      info.innerHTML = "<b>" + f.name + "</b><small>" + where + "</small>";
      row.appendChild(info);
      const price = document.createElement("b");
      price.className = "price";
      price.textContent = G.fmt(G.fishValue(G.level().fish.indexOf(f)));
      row.appendChild(price);
      list.appendChild(row);
    });
  }

  function renderUpgrades() {
    const s = G.s;
    const affordable = CTC.UPGRADES.filter((u) => s.upg[u.id] < u.max && !G.upgradeLocked(u) && s.cash >= G.upgradeCost(u)).length + G.catchers().filter(G.chipVisible).length + CTC.BELTS.filter(G.canBuyBelt).length + CTC.SEA.builds.filter(CTC.sea.canBuy).length;
    $("upBadge").textContent = affordable;
    $("upBadge").classList.toggle("hidden", !affordable);
    if (!$("drawer").classList.contains("open")) return;
    const key = CTC.UPGRADES.map((u) => s.upg[u.id] + (s.cash >= G.upgradeCost(u) ? "y" : "n") + (G.upgradeLocked(u) ? "l" : "")).join() +
      G.catchers().map((m) => G.catcherLv(m) + (s.cash >= G.catcherCost(m) ? "y" : "n")).join() +
      CTC.BELTS.map((b) => (G.has(b.id) ? "b" : G.canBuyBelt(b) ? "y" : G.beltLocked(b) ? "l" : "n")).join() +
      (G.seaUnlocked() ? CTC.SEA.builds.map((b) => (s[b.id] ? "b" : CTC.sea.canBuy(b) ? "y" : "n")).join() : "");
    if (key === upgradeKey) return;
    upgradeKey = key;
    const list = $("upgradeList");
    list.textContent = "";
    const heading = (text) => {
      const h = document.createElement("h3");
      h.textContent = text;
      list.appendChild(h);
    };
    heading("Fish catchers");
    if (!G.catchers().length) {
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "Build a crane first, then level it up here.";
      list.appendChild(none);
    }
    G.catchers().forEach((m) => {
      const lv = G.catcherLv(m), maxed = G.catcherMaxed(m), cost = G.catcherCost(m);
      const row = document.createElement("div");
      row.className = "up";
      row.innerHTML = "<b>" + m.name + "</b><small>Catches " + lv + " fish each time" + (maxed ? "" : ", next " + (lv + 1)) + '</small><div class="pips">' +
        Array.from({ length: CTC.CATCHER_UPGRADE.max }, (_, i) => '<i class="' + (i < lv ? "on" : "") + '"></i>').join("") + "</div>";
      const btn = document.createElement("button");
      btn.className = "btn gold";
      btn.textContent = maxed ? "MAX" : G.fmt(cost);
      btn.disabled = maxed || s.cash < cost;
      btn.onclick = () => { if (G.upgradeCatcher(m)) upgradeKey = ""; };
      row.appendChild(btn);
      list.appendChild(row);
    });
    heading("Belts");
    CTC.BELTS.filter((b) => !b.needs || G.cookingUnlocked()).forEach((b) => {
      const built = G.has(b.id), locked = G.beltLocked(b);
      const row = document.createElement("div");
      row.className = "up";
      row.innerHTML = "<b>" + b.name + "</b><small>" + (locked ? "Build the fireplace first" : b.desc) + "</small>";
      const btn = document.createElement("button");
      btn.className = "btn gold";
      btn.textContent = built ? "Built" : G.fmt(G.beltCost(b.id));
      btn.disabled = !G.canBuyBelt(b);
      btn.onclick = () => { if (G.buyBelt(b.id)) upgradeKey = ""; };
      row.appendChild(btn);
      list.appendChild(row);
    });
    const upgradeRow = (u) => {
      const lvl = s.upg[u.id], maxed = lvl >= u.max, locked = G.upgradeLocked(u), cost = G.upgradeCost(u);
      const row = document.createElement("div");
      row.className = "up";
      row.innerHTML = "<b>" + u.name + "</b><small>" + (locked ? (u.lockedText || "Build a crane or trawler first") : u.desc) + '</small><div class="pips">' +
        Array.from({ length: u.max }, (_, i) => '<i class="' + (i < lvl ? "on" : "") + '"></i>').join("") + "</div>";
      const btn = document.createElement("button");
      btn.className = "btn gold";
      btn.textContent = maxed ? "MAX" : G.fmt(cost);
      btn.disabled = maxed || locked || s.cash < cost;
      btn.onclick = () => { if (G.buyUpgrade(u.id)) upgradeKey = ""; };
      row.appendChild(btn);
      list.appendChild(row);
    };
    heading("Your cart");
    CTC.UPGRADES.filter((u) => u.group === "cart").forEach(upgradeRow);
    if (G.cookingUnlocked()) {
      heading("Hot Food shop");
      CTC.UPGRADES.filter((u) => u.group === "hot").forEach(upgradeRow);
    }
    if (G.seaUnlocked()) {
      heading("Sea Farm");
      CTC.SEA.builds.forEach((b) => {
        const row = document.createElement("div");
        row.className = "up";
        row.innerHTML = "<b>" + b.name + "</b><small>" + (CTC.sea.locked(b) ? "Build the " + b.needs.filter((n) => !s[n]).map((n) => CTC.SEA.builds.find((x) => x.id === n).name).join(" and ") + " first" : b.desc) + "</small>";
        const btn = document.createElement("button");
        btn.className = "btn gold";
        btn.textContent = s[b.id] ? "Built" : G.fmt(CTC.sea.cost(b));
        btn.disabled = !CTC.sea.canBuy(b);
        btn.onclick = () => { if (CTC.sea.buy(b.id)) upgradeKey = ""; };
        row.appendChild(btn);
        list.appendChild(row);
      });
      CTC.UPGRADES.filter((u) => u.group === "sea").forEach(upgradeRow);
      const prices = document.createElement("p");
      prices.className = "none";
      prices.textContent = "Cloud Kitchen prices: " + Object.keys(CTC.SEA.creatures).map((k) => CTC.SEA.creatures[k].name + " " + G.fmt(CTC.sea.value(k, "kitchen"))).join(", ");
      list.appendChild(prices);
    }
    heading("Your gear");
    CTC.UPGRADES.filter((u) => !u.group).forEach(upgradeRow);
    renderFishGuide(list);
  }

  UI.update = function () {
    if (!G.s || G.mode === "title") return;
    const s = G.s;
    const shown = Math.floor(s.cash);
    if (shown !== lastCash) { $("cash").textContent = G.fmt(shown); lastCash = shown; }
    $("rate").textContent = G.fmt(G.earnRate()).replace(/^\$/, "$") + "/s";
    const moving = G.moveMode && G.mode === "play";
    $("moveBar").classList.toggle("hidden", !moving);
    $("btnMove").classList.toggle("hidden", moving);
    const obj = G.guide().text;
    if (moving && $("moveHint").textContent !== obj) $("moveHint").textContent = obj;
    if (obj !== lastObjective) { $("objective").textContent = obj; lastObjective = obj; }
    renderRoadmap();
    renderBasket();
    renderPlayer();
    renderWood();
    renderFood();
    renderPanelDot();
    renderUpgrades();
  };
})();
