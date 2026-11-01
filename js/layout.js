/* Where things stand in the current place: the map's edges, buildings the player has moved,
   and everything that follows a building (selling circles, queues and belts).
   Moves are saved per place in s.moved as { id: [x, y] }. */
(function () {
  const G = CTC.game, L = CTC.LAYOUT, S = CTC.SEA;
  const K = S.venues.kitchen, H = S.venues.hotel;

  // box: the solid part, as left, top, right, bottom around the building's position.
  // zone: the selling circle, which needs to stay reachable. h: where its label floats.
  const ITEMS = {
    stall: { name: "Fresh Fish Stall", home: [L.stall.x, L.stall.y], box: [-92, -72, 92, 12], zone: L.stallZone, h: 225, built: () => true },
    crate: { name: "Catch Crate", home: [L.crate.x, L.crate.y], box: [-40, -47, 40, 7], h: 70, built: () => true },
    fire: { name: "Fireplace", home: [L.fire.x, L.fire.y], box: [-38, -28, 38, 28], h: 80, built: () => G.s.fire },
    shop: { name: "Hot Food Shop", home: [L.shop.x, L.shop.y], box: [-78, -52, 78, 12], zone: L.shopZone, h: 190, built: () => G.s.fire },
    kitchen: { name: "Cloud Kitchen", home: [K.x, K.y], box: [-88, -110, 88, 2], zone: K.zone, h: 130, built: () => G.s.kitchen },
    hotel: { name: "Hotel", home: [H.x, H.y], box: [-94, -116, 94, 2], zone: H.zone, h: 215, built: () => G.s.hotel }
  };
  const CRANE_BOX = [-30, -24, 30, 24];
  const CRANE_FROM_SHORE = 92; // Keeps its arm over the water.

  G.layoutV = 0;

  const moved = (id) => (G.s.moved && G.s.moved[id]) || ITEMS[id].home;
  const set = (o, x, y) => { o.x = x; o.y = y; };

  // A belt that leaves a building sideways or from its end, then turns toward the next one.
  function sideways(a, b) {
    const midX = (a[0] + b[0]) / 2;
    return [a, [midX, a[1]], [midX, b[1]], b];
  }
  function downward(a, b) {
    const midY = (a[1] + b[1]) / 2;
    if (Math.abs(a[0] - b[0]) < 1) return [a, [a[0], midY], b];
    return [a, [a[0], midY], [b[0], midY], b];
  }
  function layBelts() {
    const c = L.crate, st = L.stall, f = L.fire, sh = L.shop;
    const right = st.x >= c.x ? 1 : -1;
    L.beltPath = sideways([c.x + right * 38, c.y - 10], [st.x - right * 82, st.y - 30]);
    const below = f.y >= c.y ? 1 : -1;
    L.feedBeltPath = below > 0 ? downward([c.x - 10, c.y + 10], [f.x + 15, f.y - 52]) : downward([c.x - 10, c.y - 50], [f.x + 15, f.y + 30]);
    const toShop = sh.x >= f.x ? 1 : -1, end = [sh.x - toShop * 83, sh.y - 18], start = [f.x, f.y + (sh.y >= f.y ? 15 : -30)];
    L.hotBeltPath = [start, [start[0], (start[1] + end[1]) / 2], [start[0], end[1]], end];
  }

  // Puts everything where this save says, starting from the original map.
  G.applyLayout = function () {
    let p = moved("stall");
    set(L.stall, p[0], p[1]); set(L.stallZone, p[0] - 45, p[1] + 60); set(L.queue, p[0] + 70, p[1] + 55);
    p = moved("shop");
    set(L.shop, p[0], p[1]); set(L.shopZone, p[0] - 93, p[1] + 28); set(L.hotPad, p[0] - 125, p[1] - 50); set(L.shopQueue, p[0] + 95, p[1] - 2);
    p = moved("crate");
    set(L.crate, p[0], p[1]);
    p = moved("fire");
    set(L.fire, p[0], p[1]);
    p = moved("kitchen");
    set(K, p[0], p[1]); set(K.zone, p[0], p[1] + 35); S.builds[1].at = [p[0], p[1] + 10];
    p = moved("hotel");
    set(H, p[0], p[1]); set(H.zone, p[0], p[1] + 38); S.builds[2].at = [p[0], p[1] - 50];
    layBelts();
    G.layoutV++;
  };

  /* ---------- what is solid ---------- */
  let solid = { key: null, list: [] };
  G.solidBoxes = function () {
    const key = G.layoutV + "," + G.s.fire + G.s.kitchen + G.s.hotel;
    if (solid.key === key) return solid.list;
    const list = [];
    Object.keys(ITEMS).forEach((id) => {
      if (!ITEMS[id].built()) return;
      const p = moved(id), b = ITEMS[id].box;
      list.push([p[0] + b[0], p[1] + b[1], p[0] + b[2], p[1] + b[3]]);
    });
    solid = { key, list };
    return list;
  };

  /* ---------- moving things ---------- */
  G.moveMode = false;
  G.moveSel = null;
  G.toggleMove = function (on) {
    G.moveMode = on === undefined ? !G.moveMode : on;
    G.moveSel = null;
    G.moveGhost = null;
    G.foodArmed = false;
    CTC.camera.forMoving(G.moveMode);
  };

  // Everything that can be moved right now. Trawlers, the ship and the sea fence stay put.
  G.moveItems = function () {
    const list = [];
    Object.keys(ITEMS).forEach((id) => {
      if (!ITEMS[id].built()) return;
      const p = moved(id);
      list.push({ id, name: ITEMS[id].name, x: p[0], y: p[1], box: ITEMS[id].box, h: ITEMS[id].h });
    });
    G.machines.forEach((m) => {
      if (m.type === "rig") list.push({ id: "m" + m.index, name: m.name, x: m.x, y: m.y, box: CRANE_BOX, h: 112, crane: m });
    });
    return list;
  };

  const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

  // The building plus room to reach its selling circle.
  function roomOf(box, x, y, zone) {
    const r = [x + box[0], y + box[1], x + box[2], y + box[3]];
    if (zone) {
      const cx = x + (zone.x - zone.ox), cy = y + (zone.y - zone.oy), z = zone.r * 0.7;
      r[0] = Math.min(r[0], cx - z); r[1] = Math.min(r[1], cy - z); r[2] = Math.max(r[2], cx + z); r[3] = Math.max(r[3], cy + z);
    }
    return r;
  }
  function zoneOf(id) {
    const it = ITEMS[id];
    if (!it || !it.zone) return null;
    const p = moved(id);
    return { x: it.zone.x, y: it.zone.y, ox: p[0], oy: p[1], r: it.zone.r };
  }

  // Whether this exact spot works. Only solid parts need clear ground: walking is never blocked
  // by a tree or a neighbour's selling circle, so those may overlap a selling circle.
  function checkSpot(item, x, y) {
    const B = L.bounds;
    const no = (why) => ({ ok: false, why, x, y });
    if (item.crane) {
      x = G.shoreX(y) + CRANE_FROM_SHORE;
      if (y < B.y0 + 40 || y > B.y1 - 40) return no("Too close to the edge of the map");
      if (Math.abs(y - (L.pier.y0 + L.pier.y1) / 2) < 75) return no("The pier is in the way");
      if (G.machines.some((m) => m !== item.crane && m.type === "rig" && Math.abs(m.y - y) < 70)) return no("Too close to another crane");
    }
    const solid = [x + item.box[0], y + item.box[1], x + item.box[2], y + item.box[3]];
    const room = roomOf(item.box, x, y, zoneOf(item.id));
    if (!item.crane) {
      if (room[0] < B.x0 || room[2] > B.x1 - 20 || room[1] < B.y0 + 20 || room[3] > B.y1 - 20) return no("Too close to the edge of the map");
      for (let yy = solid[1]; yy <= solid[3]; yy += 20) if (solid[0] < G.shoreX(yy) + 24) return no("Too close to the water");
      const P = L.pier;
      if (overlap(solid, [P.x0, P.y0 - 10, P.x1 + 20, P.y1 + 10])) return no("The pier is in the way");
    }
    const blocked = G.moveItems().some((o) => {
      if (o.id === item.id) return false;
      const theirs = [o.x + o.box[0], o.y + o.box[1], o.x + o.box[2], o.y + o.box[3]];
      return overlap(solid, roomOf(o.box, o.x, o.y, zoneOf(o.id))) || overlap(room, theirs);
    });
    if (blocked) return no("Another building is in the way");
    if (G.trees.some((t) => t.x > solid[0] - 12 && t.x < solid[2] + 12 && t.y > solid[1] - 10 && t.y < solid[3] + 10)) return no("A tree is in the way");
    const blocksPad = (px, py) => px > solid[0] - 30 && px < solid[2] + 30 && py > solid[1] - 30 && py < solid[3] + 30;
    if (G.level().builds.slice(G.s.built).some((b) => { const q = L.spots[b.spot]; return blocksPad(q.x, q.y); })) return no("That spot is saved for your next build");
    if (!item.crane && item.id !== "fire" && !G.s.fire && G.cookingUnlocked() && blocksPad(L.fire.x, L.fire.y)) return no("That spot is saved for your fireplace");
    if (!item.crane && item.id !== "shop" && G.hotNext() && blocksPad(L.hotPad.x, L.hotPad.y)) return no("That spot is saved for your food seller");
    return { ok: true, x, y };
  }

  // Where the item lands if dropped here: this spot, or the closest one that works.
  G.placeAt = function (item, x, y) {
    const exact = checkSpot(item, x, y);
    if (exact.ok) return exact;
    for (let r = 30; r <= 180; r += 30) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, spot = checkSpot(item, x + Math.cos(a) * r, y + Math.sin(a) * r);
        if (spot.ok) return spot;
      }
    }
    return exact;
  };

  // Tries to put the picked building down. It stays picked if the spot doesn't work.
  G.moveDrop = function (x, y) {
    const sel = G.moveItems().find((o) => o.id === G.moveSel);
    if (!sel) return false;
    const spot = G.placeAt(sel, x, y);
    if (!spot.ok) {
      G.emit("toast", spot.why + ". Try another spot.");
      CTC.audio.play("full");
      return false;
    }
    if (sel.crane) { sel.crane.x = spot.x; sel.crane.y = spot.y; }
    G.s.moved[sel.id] = [Math.round(spot.x), Math.round(spot.y)];
    G.moveSel = null;
    G.moveGhost = null;
    G.applyLayout();
    G.stat("moved");
    G.burst(spot.x, spot.y, 24, ["#ffe46b", "#fff", "#c79a5a"], 170);
    G.shake = 3;
    CTC.audio.play("build");
    G.save();
    return true;
  };

  // First tap picks a building, the next tap puts it down. Tapping the same one lets go.
  G.moveTap = function (x, y, shown) {
    const sel = G.moveSel && G.moveItems().find((o) => o.id === G.moveSel);
    if (!sel) {
      if (shown) { G.moveSel = shown.id; CTC.audio.play("plop"); }
      return;
    }
    if (shown && shown.id === sel.id) { G.moveSel = null; G.moveGhost = null; return; }
    G.moveDrop(x, y);
  };

  // A saved crane goes back where the player put it.
  G.placeCrane = function (m) {
    const p = G.s.moved && G.s.moved["m" + m.index];
    if (p) { m.x = p[0]; m.y = p[1]; }
  };
})();
