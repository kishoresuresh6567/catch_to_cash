/* Shows the game in 3D. Each frame this matches the 3D world to the game's state.
   Labels that must stay readable (prices, counts, buttons) go on a 2D layer above it. */
(function () {
  const G = CTC.game, Art = CTC.art, L = CTC.LAYOUT, St = CTC.stage, M = CTC.models, People = CTC.people;
  const W = L.width, H = L.height;
  const R = (CTC.render = { scale: 1 });
  const LAY = Math.PI / 2, HUD_X = 40, HUD_Y = 40;
  let canvas, c, vignette, world = null, builtFor = null, thrown, particles;
  const rings = {}, avatars = new Map(), tmp = new THREE.Vector3();
  let frameId = 0;

  R.init = function (el, scene3d) {
    canvas = el;
    c = canvas.getContext("2d");
    St.init(scene3d);
    M.initBanks();
    thrown = M.thrownNet();
    particles = M.particles();
    ["pad", "firePad", "hotPad", "stall", "shop", "kitchen", "hotel", "aim", "food"].forEach((k) => { rings[k] = M.ring("#ffffff"); });
    G.on("levelChanged", () => { builtFor = null; });
    People.load().catch((e) => console.error("Could not load the people", e));
  };

  R.resize = function (scale) {
    R.scale = Math.min(2.5, scale * (window.devicePixelRatio || 1));
    canvas.width = Math.round(W * R.scale);
    canvas.height = Math.round(H * R.scale);
    St.resize(scale);
    vignette = null;
  };

  const at = (obj, x, y, lift) => { obj.position.set(x, St.groundY(x, y) + (lift || 0), y); return obj; };

  /* ---------- building the place ---------- */
  function buildWorld() {
    const lv = G.level(), T = lv.theme, scene = St.scene;
    if (world) {
      scene.remove(world.root);
      world.root.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); });
    }
    avatars.forEach((a) => People.dispose(a));
    avatars.clear();
    St.applyTheme(T);
    const root = new THREE.Group();
    scene.add(root);
    const rnd = M.seeded(lv.id.length * 977 + 13);
    const add = (obj, x, y, lift) => { at(obj, x, y, lift); root.add(obj); return obj; };
    const w = (world = {
      root,
      pier: root.add(M.pier()),
      crate: add(M.crate(), L.crate.x, L.crate.y - 20),
      stall: add(M.stall(T), L.stall.x, L.stall.y - 25),
      shop: add(M.foodShop(), L.shop.x, L.shop.y - 28),
      fire: add(M.fireplace(), L.fire.x, L.fire.y),
      ship: add(M.ship(), L.ship.x, L.ship.y, 16),
      fence: add(M.fence(), 0, 0),
      kitchen: add(M.kitchen(), CTC.SEA.venues.kitchen.x, CTC.SEA.venues.kitchen.y - 52),
      hotel: add(M.hotel(), CTC.SEA.venues.hotel.x, CTC.SEA.venues.hotel.y - 56),
      machines: new Map(),
      trees: new Map(),
      belts: {}
    });
    w.fence.position.set(0, 0, 0);
    root.add(M.scenery(T, lv.id.length * 131 + 7));
    if (T.weather) { w.weather = M.weather(T.weather); root.add(w.weather); }
    G.trees.forEach((tr) => {
      const g = M.tree(T.decor, rnd, tr.i);
      add(g, tr.x, tr.y);
      const stump = add(M.stump(T.decor), tr.x, tr.y);
      w.trees.set(tr, { g, stump, base: g.scale.x });
    });
    [["chain", L.beltPath], ["feedBelt", L.feedBeltPath], ["hotBelt", L.hotBeltPath]].forEach(([id, P]) => {
      const b = M.belt();
      M.layBelt(b, P, 16);
      b.position.y = St.groundY(P[0][0], P[0][1]);
      root.add(b);
      w.belts[id] = b;
    });
    w.plates = [];
    for (let i = 0; i < 6; i++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 1.4, 16), new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.3 }));
      plate.position.set(-60 + i * 24, 43, 8);
      plate.castShadow = true;
      w.shop.add(plate);
      w.plates.push(plate);
    }
    builtFor = lv.id;
  }

  /* ---------- people ---------- */
  function person(owner, look, x, y, o) {
    if (!People.ready) return null;
    let a = avatars.get(owner);
    if (!a) {
      a = People.make(look, o);
      a.group.position.set(x, St.groundY(x, y), y);
      a.yaw = o.yaw === undefined ? 0 : o.yaw;
      a.px = x; a.pz = y;
      St.scene.add(a.group);
      avatars.set(owner, a);
    }
    a.seen = frameId;
    const dx = x - a.px, dz = y - a.pz;
    if (Math.hypot(dx, dz) > 0.25) a.want = Math.atan2(dx, dz);
    else if (o.yaw !== undefined) a.want = o.yaw;
    a.px = x; a.pz = y;
    if (a.want !== undefined) {
      let d = a.want - a.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.yaw += d * Math.min(1, R.dt * 11);
    }
    const ground = St.groundY(x, y) + (o.hop || 0);
    a.group.position.set(x, a.group.position.y + (ground - a.group.position.y) * Math.min(1, R.dt * 14), y);
    a.group.rotation.y = a.yaw;
    People.play(a, o.anim, o.speed);
    if (a.axeMesh) a.axeMesh.visible = !!o.tool;
    a.mixer.update(R.dt);
    return a;
  }

  // Removes people who have left.
  function sweepPeople() {
    avatars.forEach((a, owner) => { if (a.seen !== frameId) { People.dispose(a); avatars.delete(owner); } });
  }

  const SELLER_X = [16, -38, 60, -68], SHOP_X = [10, -34, 46, -62];
  const stallOwners = [], shopOwners = [];
  function syncPeople(t) {
    const s = G.s, p = G.player, defs = G.level().fish;
    // Player: runs, throws, chops.
    const heldYaw = G.net ? Math.atan2(G.net.x - p.x, G.net.y - p.y) : p.chopping && G.trees.length ? treeYaw(p) : undefined;
    const pa = person(p, Art.playerLook, p.x, p.y, {
      basket: true, axe: true, tool: p.chopping, yaw: heldYaw,
      anim: p.moving ? "Jog_Fwd_Loop" : p.chopping ? "Sword_Attack" : p.throwT > 0 ? "Interact" : "Idle_Loop",
      speed: p.moving ? 1.35 : p.chopping ? 1.5 : p.throwT > 0 ? 2.1 : 1
    });
    if (pa) fillBasket(pa, s.carried.map((sp) => defs[sp] || defs[0]), s.cookedBag.map((sp) => Art.cookedDef(defs[sp] || defs[0])), s.seaBag, t);
    // Stall and shop staff face their customers.
    for (let i = 0; i < G.sellerCount(); i++) {
      const o = (stallOwners[i] = stallOwners[i] || {});
      person(o, Art.sellerLooks[i], L.stall.x + SELLER_X[i], L.stall.y - 55, { yaw: 0, anim: s.stock.length && G.customers.length ? "Idle_Talking_Loop" : "Idle_Loop" });
    }
    if (s.fire) for (let i = 0; i < G.hotSellerCount(); i++) {
      const o = (shopOwners[i] = shopOwners[i] || {});
      person(o, Art.sellerLooks[i], L.shop.x + SHOP_X[i], L.shop.y - 54, { yaw: 0, anim: s.cookedStock.length && G.diners.length ? "Idle_Talking_Loop" : "Idle_Loop" });
    }
    G.customers.concat(G.diners).forEach((cu) => {
      if (cu.look.beard === undefined) cu.look.beard = !cu.look.style && Math.random() < 0.3;
      const leaving = cu.state === "leave";
      person(cu, cu.look, cu.x, cu.y, {
        yaw: -Math.PI / 2, hop: cu.joy * 8,
        anim: cu.moving ? "Walk_Loop" : "Idle_Loop", speed: cu.moving ? (leaving ? 2 : 1.7) : 1
      });
    });
    G.cutters.forEach((w) => {
      person(w, w.look, w.x, w.y, {
        axe: true, tool: w.chopping, yaw: w.tree ? Math.atan2(w.tree.x - w.x, w.tree.y - w.y) : undefined,
        anim: w.moving ? "Walk_Loop" : w.chopping ? "Sword_Attack" : "Idle_Loop", speed: w.moving ? 1.9 : w.chopping ? 1 : 1
      });
    });
    Object.keys(G.runners).forEach((v) => G.runners[v].forEach((w) => {
      const a = person(w, w.look, w.x, w.y, { basket: true, anim: w.moving ? "Jog_Fwd_Loop" : "PickUp_Table", speed: w.moving ? 0.95 : 0.9 });
      if (a) fillBasket(a, [], [], w.load, t);
    }));
  }
  function treeYaw(p) {
    const tree = G.trees.find((tr) => tr.state === "up" && Math.hypot(p.x - tr.x, p.y - tr.y) < 58);
    return tree ? Math.atan2(tree.x - p.x, tree.y - p.y) : undefined;
  }

  // Fish pile up in the wicker basket on their back, the most recent on top.
  function fillBasket(a, raw, cooked, sea) {
    if (!a.basketMesh) return;
    a.basketMesh.getWorldPosition(tmp);
    const yaw = a.yaw;
    const all = raw.concat(cooked), bx = tmp.x, by = tmp.y, bz = tmp.z;
    let n = 0;
    all.slice(-10).forEach((def, i) => {
      const a0 = i * 2.4, r = 3.5 + (i % 3) * 1.5;
      M.banks.fish.put(def, bx + Math.cos(a0) * r, by + 4 + i * 1.3, bz + Math.sin(a0) * r, a0, 0.55 / Math.max(0.8, def.size * 0.8) * def.size, 0, 0.5, 1.1);
      n++;
    });
    sea.slice(-4).forEach((kind, i) => {
      const a0 = i * 2.1 + 1;
      M.banks.sea[kind].add(bx + Math.cos(a0) * 3, by + 8 + (n + i) * 2, bz + Math.sin(a0) * 3, yaw + a0, 0.42);
    });
  }

  /* ---------- fish ---------- */
  function syncFish(t) {
    const lv = G.level(), defs = lv.fish, F = M.banks.fish;
    G.fish.forEach((f) => {
      const def = defs[f.species];
      const moving = Math.abs(f.vx) + Math.abs(f.vy) >= 4;
      f.yaw = moving ? -Math.atan2(f.vy, f.vx) : f.yaw || 0;
      const fade = f.fade === undefined ? 1 : f.fade;
      F.put(def, f.x, -9 - (1 - fade) * 20, f.y, f.yaw, 1.5 * (f.jit || 1) * def.size, f.wig);
      if (def.rare && Math.sin(t * 4 + f.wig) > 0.6) G.burst(f.x, f.y, 1, ["#fff", "#ffe46b"], 26, 0, 0.5);
    });
    const s = G.s;
    // Crate
    const cr = world.crate.position;
    s.crate.slice(0, 26).forEach((sp, i) => {
      const def = defs[sp] || defs[0], col = i % 6, row = Math.floor(i / 6);
      F.put(def, cr.x - 25 + col * 10 + row * 3, cr.y + 22 + row * 3.4 + (i % 2), cr.z - 10 + ((i * 7) % 4) * 6, (i * 1.7) % 6.28, 0.68, 0, LAY);
    });
    // Stall, on ice
    const st = world.stall.position;
    s.stock.slice(0, 14).forEach((sp, i) => {
      const def = defs[sp] || defs[0];
      F.put(def, st.x - 72 + (i % 7) * 24, st.y + 49 + (i >= 7 ? 3 : 0), st.z + (i >= 7 ? -6 : 8), i % 2 ? 0.14 : -0.1, 0.72, 0, LAY);
    });
    // Shop, on plates
    const sh = world.shop.position;
    world.plates.forEach((pl, i) => { pl.visible = i < s.cookedStock.length; });
    s.cookedStock.slice(0, 6).forEach((sp, i) => {
      F.put(Art.cookedDef(defs[sp] || defs[0]), sh.x - 60 + i * 24, sh.y + 46, sh.z + 8, 0, 0.62, 0, LAY);
    });
    // Grill and the cooked pile
    if (s.fire) {
      const fp = world.fire.position;
      s.grill.forEach((g, i) => {
        const k = Math.min(1, g.t / G.cookTime());
        const def = k > 0.55 ? Art.cookedDef(defs[g.sp]) : defs[g.sp];
        F.put(def, fp.x - 27 + (i % 4) * 18, fp.y + 43 + Math.floor(i / 4) * 0.2, fp.z - 8 + Math.floor(i / 4) * 12, Math.PI / 2, 0.55, 0, LAY);
      });
      s.cookedPile.slice(0, 9).forEach((sp, i) => {
        F.put(Art.cookedDef(defs[sp]), fp.x + 55 + (i % 3) * 15, fp.y + 18 + Math.floor(i / 3) * 3, fp.z + 6, 0.2, 0.52, 0, LAY);
      });
    }
    // Belts
    const belt = (P, items, cooked) => items.forEach((b) => {
      const pt = G.pointOnPath(P, b.d);
      const ahead = G.pointOnPath(P, b.d + 2);
      const yaw = -Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
      F.put(cooked ? Art.cookedDef(defs[b.species]) : defs[b.species], pt.x, St.groundY(pt.x, pt.y) + 21, pt.y, yaw, 0.7, 0, LAY);
    });
    if (G.has("chain")) belt(L.beltPath, G.belt);
    if (s.feedBelt) belt(L.feedBeltPath, G.feedItems);
    if (s.hotBelt) belt(L.hotBeltPath, G.hotBeltItems, true);
    // Sea creatures in the fence
    if (s.fence) G.pen.forEach((f) => {
      const bank = M.banks.sea[f.kind], C = CTC.SEA.creatures[f.kind];
      const yaw = f.face < 0 ? Math.PI : 0;
      bank.add(f.x, f.kind === "jellyfish" ? -2 + Math.sin(t + f.wig) * 3 : -8, f.y, yaw + Math.sin(f.wig * 0.2) * 0.3, C.size * 1.1);
    });
  }

  /* ---------- buildings and boats ---------- */
  const BELT_RAILS = ["#5e6b78", "#7f8e9c", "#a7b7c4", "#d4dde4", "#ffc531"];
  function syncBuildings(t) {
    const s = G.s, w = world;
    w.shop.visible = !!s.fire;
    w.fire.visible = !!s.fire;
    w.fence.visible = !!s.fence;
    w.kitchen.visible = !!s.kitchen;
    w.hotel.visible = !!s.hotel;
    w.stall.setUpgraded(s.upg.cart >= 2);
    w.stall.fancy.visible = s.upg.cart >= 1;
    w.stall.side.visible = s.upg.cart >= 4;
    w.shop.setUpgraded(s.upg.hotCart >= 2);
    w.shop.fancy.visible = s.upg.hotCart >= 1;
    if (s.kitchen) w.kitchen.smoke.forEach((b, i) => {
      const k = (t * 0.3 + i / 3) % 1;
      b.position.set(44 + Math.sin(k * 6 + i) * 6, 120 + k * 80, -22);
      b.scale.setScalar(0.7 + k * 2.4);
      b.material.opacity = 0.42 * (1 - k);
    });
    if (s.hotel) w.hotel.win.forEach((pane, i) => {
      pane.material = Math.sin(t * 0.25 + i * 2.3) > 0.1 ? materialLit() : materialGlass();
    });
    if (s.fire) {
      const burning = s.grill.length > 0;
      w.fire.flames.visible = burning || G.feedItems.length > 0;
      w.fire.flameMat.uniforms.uT.value = t;
      w.fire.glow.intensity = w.fire.flames.visible ? (4200 + Math.sin(t * 13) * 800 + Math.sin(t * 29) * 450) : 0;
      w.fire.pile.children.forEach((log, i) => { log.visible = i < Math.ceil((s.wood / CTC.COOKING.woodCap) * 12); });
    }
    // Trees
    w.trees.forEach((v, tr) => {
      const { g, stump } = v;
      stump.visible = tr.state === "stump" || tr.state === "fall";
      g.visible = tr.state !== "stump";
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      if (tr.state === "fall") {
        g.rotation.z = -tr.dir * tr.t * tr.t * 1.55;
        const k = Math.max(0, tr.t - 0.72) / 0.28;
        g.scale.setScalar(1 - k);
      } else if (tr.state === "grow") g.scale.setScalar(0.2 + 0.8 * tr.t);
      else if (tr.shake > 0) g.rotation.z = Math.sin(tr.shake * 26) * 0.03 * tr.shake;
      if (g.sway) { g.sway.rotation.z = Math.sin(t * 0.9 + tr.i) * 0.018; g.sway.rotation.x = Math.cos(t * 0.7 + tr.i) * 0.014; }
    });
    // Belts
    [["chain", s.upg.belt, G.beltSpeed()], ["feedBelt", s.upg.feed, G.feedBeltSpeed()], ["hotBelt", s.upg.hotBelt, G.hotBeltSpeed()]].forEach(([id, lv, speed]) => {
      const b = w.belts[id];
      b.visible = !!s[id];
      if (!b.visible) return;
      b.rails.color.set(BELT_RAILS[lv] || BELT_RAILS[0]);
      b.bands.forEach((band) => { band.tex.offset.y = -(t * speed) / 18; });
    });
    // Ship
    const shipX = L.ship.x - (G.mode === "sailing" ? Math.pow(G.sailT, 2) * 62 : 0);
    w.ship.position.set(shipX, 16 + Math.sin(t * 1.4) * 1.6, L.ship.y);
    w.ship.rotation.set(Math.sin(t * 1.1) * 0.02, 0, Math.sin(t * 0.8) * 0.012);
    M.animateShip(w.ship, t);
    // Cranes and trawlers
    G.machines.forEach((m) => {
      if (m.type !== "rig" && m.type !== "boat") return; // A hired seller is listed here too.
      let g = w.machines.get(m);
      if (!g) {
        g = m.type === "boat" ? M.trawler(G.level().theme) : M.crane();
        w.root.add(g);
        w.machines.set(m, g);
      }
      const pop = Art.popScale(m.pop);
      if (m.type === "rig") {
        at(g, m.x, m.y);
        g.scale.setScalar(pop);
        g.winch.rotation.z = t * (m.dip > 0 ? 7 : 1.2);
        const drop = 26 + m.dip * 64;
        M.stretch(g.rope, -112, 66, 0, -112, 66 - drop, 0);
        g.bag.position.y = 66 - drop;
      } else if (m.type === "boat") {
        const prevX = g.position.x, prevZ = g.position.z;
        g.position.set(m.bx, 7 + Math.sin(t * 2 + m.x) * 1, m.by);
        const dx = m.bx - prevX, dz = m.by - prevZ;
        if (Math.hypot(dx, dz) > 0.05) g.want = -Math.atan2(dz, dx);
        if (g.want !== undefined) {
          let d = g.want - g.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          g.rotation.y += d * Math.min(1, R.dt * 2.2);
        }
        g.rotation.z = Math.sin(t * 1.3 + m.x) * 0.018;
        g.scale.setScalar(pop);
        const down = m.state === "fish" ? 18 + (m.dip || 0) * 34 : 8;
        M.stretch(g.rope, -50, 24, 0, -50, 24 - down, 0);
        g.bag.position.y = 24 - down;
      }
    });
  }
  let litPane, darkPane;
  const materialLit = () => (litPane = litPane || new THREE.MeshStandardMaterial({ color: "#ffe9a3", emissive: "#ffcb6b", emissiveIntensity: 0.55 }));
  const materialGlass = () => (darkPane = darkPane || new THREE.MeshStandardMaterial({ color: "#7fb6d6", roughness: 0.1, metalness: 0.7 }));

  /* ---------- the thrown net ---------- */
  function syncNet() {
    const n = G.net;
    thrown.visible = !!n;
    thrown.rope.visible = !!n;
    if (!n) return;
    const r = G.netRadius(), p = G.player, defs = G.level().fish;
    const handY = St.groundY(p.x, p.y) + 48;
    let x, y, h, rad;
    if (n.phase === "fly") {
      const k = n.t / 0.42;
      x = p.x + (n.x - p.x) * k;
      y = p.y + (n.y - p.y) * k;
      h = handY * (1 - k) + Math.sin(k * Math.PI) * 95 + 3;
      rad = r * (0.25 + 0.75 * k);
    } else if (n.phase === "sink") {
      x = n.x; y = n.y; h = 5 - (n.t / 0.32) * 10; rad = r * (1 + Math.sin(n.t * 16) * 0.03);
    } else {
      const k = n.t / 0.34;
      x = n.x + (p.x - n.x) * k;
      y = n.y + (p.y - n.y) * k;
      h = -5 + (handY + 5) * k + Math.sin(k * Math.PI) * 34;
      rad = r * (1 - k * 0.72);
    }
    thrown.position.set(x, h, y);
    thrown.scale.set(rad, Math.max(rad * 0.45, 8), rad);
    M.stretch(thrown.rope, p.x, handY, p.y, x, h + rad * 0.15, y);
    if (n.phase !== "fly") {
      const held = n.phase === "pull" ? 1 - (n.t / 0.34) * 0.6 : 1;
      n.fish.forEach((f) => {
        f.wig += 0.5;
        const def = defs[f.species];
        M.banks.fish.put(def, x + f.ox * held, h - 5 + Math.sin(f.wig * 0.2) * 2, y + f.oy * held, f.wig * 0.1, 1.4 * def.size, f.wig);
      });
    }
  }

  /* ---------- flying things ---------- */
  function syncFlyers(t) {
    const defs = G.level().fish, B = M.banks;
    G.flyers.forEach((f) => {
      if (f.hud) return;
      const k = Math.min(1, f.t / f.dur);
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k;
      const g0 = St.groundY(f.x0, f.y0) + (f.z0 || 0), g1 = St.groundY(f.x1, f.y1) + (f.z1 || 0);
      const h = g0 + (g1 - g0) * k + Math.sin(k * Math.PI) * f.h;
      if (f.kind === "coin") B.coin.add(x, h, y, t * 9, 1, LAY);
      else if (f.kind === "food") {
        for (let i = 0; i < 7; i++) B.pellet.add(x + Math.cos(i * 2.4) * (4 + 16 * k), h, y + Math.sin(i * 2.4) * (3 + 10 * k), 0, 1);
      } else if (f.kind === "sea") B.sea[f.creature].add(x, h, y, k * 6, 0.65);
      else if (f.kind === "log") B.log.add(x, h, y, k * 3, 1, k * 8);
      else B.fish.put(f.cooked ? Art.cookedDef(defs[f.species]) : defs[f.species], x, h, y, k * 5, 0.8, t * 20, k * 7);
    });
  }

  /* ---------- rings on the ground ---------- */
  function syncRings(t) {
    const s = G.s, Z = CTC.SEA.venues;
    Object.values(rings).forEach((r) => { r.visible = false; });
    const set = (r, x, y, rad, color, fill, prog, h) => {
      r.place(x, y, rad, h);
      r.u.uC.value.set(color);
      r.u.uFill.value = fill;
      r.u.uProg.value = prog || 0;
      r.u.uT.value = t;
    };
    const next = G.mode === "play" ? G.nextBuild() : null;
    if (next && !s.campaignDone) {
      const spot = L.spots[next.spot];
      const dock = next.type === "ship";
      set(rings.pad, spot.x, spot.y, 50, s.cash > 0 ? "#ffd86b" : "#fff8e7", s.cash > 0 ? 0.3 : 0.14, s.paid / next.cost, dock ? St.groundY(spot.x, spot.y) : undefined);
    }
    if (!s.fire && G.cookingUnlocked()) set(rings.firePad, L.fire.x, L.fire.y, 44, "#ffe0a3", s.wood >= CTC.COOKING.buildWood && s.cash >= G.fireCash() ? 0.35 : 0.14);
    if (G.hotNext()) set(rings.hotPad, L.hotPad.x, L.hotPad.y, 44, "#ffe0a3", s.cash >= G.hotNext().cost ? 0.35 : 0.14);
    set(rings.stall, L.stallZone.x, L.stallZone.y, L.stallZone.r - 12, "#ffffff", 0.05);
    if (s.fire) set(rings.shop, L.shopZone.x, L.shopZone.y, L.shopZone.r - 8, "#ffe0a3", 0.06);
    if (s.kitchen) set(rings.kitchen, Z.kitchen.zone.x, Z.kitchen.zone.y, Z.kitchen.zone.r, "#ffe0a3", 0.06);
    if (s.hotel) set(rings.hotel, Z.hotel.zone.x, Z.hotel.zone.y, Z.hotel.zone.r, "#ffe0a3", 0.06);
    const a = G.aim;
    if (a && a.water && G.mode === "play" && !G.net) {
      if (G.foodArmed) set(rings.aim, a.x, a.y, 34, a.reach ? "#ffe0a3" : "#a08860", 0.25, 0, 0.5);
      else set(rings.aim, a.x, a.y, G.netRadius(), "#ffffff", a.reach ? 0.08 : 0.02, 0, 0.5);
    }
    const f = G.food;
    if (f) {
      set(rings.food, f.x, f.y, 26 + ((t * 0.5) % 1) * 90, "#ffe0a3", 0, 0, 0.6);
      const left = 1 - f.t / f.life;
      f.pellets.slice(0, Math.ceil(f.pellets.length * left)).forEach((q) => {
        M.banks.pellet.add(f.x + q.ox + Math.sin(t + q.p) * 3, 0.8, f.y + q.oy + Math.cos(t * 1.3 + q.p) * 2, q.p, q.r * 0.45);
      });
    }
  }

  /* ---------- the 2D label layer ---------- */
  function plaque(x, y, name, line, bg) {
    c.font = "800 14px Trebuchet MS, sans-serif";
    const w = Math.max(c.measureText(name).width, c.measureText(line).width, 50) + 22;
    c.fillStyle = bg;
    Art.rr(c, x - w / 2, y - 22, w, 44, 11);
    c.fill();
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.fillText(name, x, y - 4);
    c.font = "900 15px Trebuchet MS, sans-serif";
    c.fillStyle = "#ffd34d";
    c.fillText(line, x, y + 14);
  }

  function drawBubble(cu, defs) {
    if (cu.state === "leave") return;
    const p = St.project(cu.x, cu.y, 86);
    const x = p.x, y = p.y;
    c.fillStyle = "rgba(255,255,255,.94)";
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
    if (cu.patience < 14) {
      c.fillStyle = "#e4574c";
      c.fillRect(x - 18, y + 8, 36 * Math.max(0, cu.patience / 14), 2.5);
    }
  }

  function badgeAt(wx, wy, h, text, color, dx) {
    const p = St.project(wx, wy, h);
    Art.badge(c, p.x + (dx || 0), p.y, text, color);
  }

  // Screen position of a tappable chip.
  const chipScreen = (b) => St.project(b.x, b.y, b.h || 0);

  function drawLabels(t) {
    const s = G.s, defs = G.level().fish, p = G.player;
    c.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    c.clearRect(0, 0, W, H);
    if (G.mode !== "title") {
      G.customers.concat(G.diners).forEach((cu) => drawBubble(cu, defs));
      if (s.crate.length) badgeAt(L.crate.x, L.crate.y - 20, 48, String(s.crate.length), "#16324a");
      if (s.stock.length) badgeAt(L.stall.x, L.stall.y - 25, 66, s.stock.length + "/" + G.stockCap(), "#16324a", 92);
      if (s.fire) {
        if (s.cookedStock.length) badgeAt(L.shop.x, L.shop.y - 28, 60, s.cookedStock.length + "/" + G.hotCap(), "#b5702c", 80);
        if (s.cookedPile.length) badgeAt(L.fire.x + 72, L.fire.y + 6, 30, String(s.cookedPile.length), "#b5702c");
        if (s.grill.length) {
          const done = s.grill.reduce((a, g) => a + Math.min(1, g.t / G.cookTime()), 0) / s.grill.length;
          const at2 = St.project(L.fire.x, L.fire.y, 62);
          c.fillStyle = "rgba(0,0,0,.5)";
          c.fillRect(at2.x - 26, at2.y, 52, 5);
          c.fillStyle = done > 0.95 ? "#36c26b" : "#ffc531";
          c.fillRect(at2.x - 26, at2.y, 52 * done, 5);
        }
      }
      if (s.kitchen && s.kitchenStock.length) badgeAt(CTC.SEA.venues.kitchen.x, CTC.SEA.venues.kitchen.y, 30, String(s.kitchenStock.length), "#b5702c", 72);
      if (s.hotel && s.hotelStock.length) badgeAt(CTC.SEA.venues.hotel.x, CTC.SEA.venues.hotel.y, 30, String(s.hotelStock.length), "#b5702c", 76);
      if (G.bagCount()) badgeAt(p.x, p.y, 76, G.bagCount() + "/" + G.bagCap(), G.bagCount() >= G.bagCap() ? "#e4574c" : "#16324a", 26);
      G.trees.forEach((tr) => {
        if (tr.state === "up" && tr.hp < CTC.COOKING.logsPerTree) {
          const n = CTC.COOKING.logsPerTree, q = St.project(tr.x, tr.y, 0);
          for (let i = 0; i < n; i++) {
            c.fillStyle = i < tr.hp ? "#36c26b" : "rgba(13,40,60,.5)";
            c.fillRect(q.x - (n * 11) / 2 + i * 11, q.y + 8, 9, 4);
          }
        }
      });
      G.machines.forEach((m) => {
        if (m.type === "boat" && m.haul > 0) badgeAt(m.bx, m.by, 60, String(m.haul));
      });
      const next = G.mode === "play" ? G.nextBuild() : null;
      if (next && !s.campaignDone) {
        const spot = L.spots[next.spot], q = St.project(spot.x, spot.y, 0);
        plaque(q.x, q.y, next.name, G.fmt(Math.ceil(next.cost - s.paid)), "rgba(13,40,60,.88)");
      }
      if (!s.fire && G.cookingUnlocked()) {
        const q = St.project(L.fire.x, L.fire.y, 0);
        plaque(q.x, q.y, "Fireplace", CTC.COOKING.buildWood + " wood + " + G.fmt(G.fireCash()), "rgba(90,40,15,.9)");
      }
      const hot = G.hotNext();
      if (hot) {
        const q = St.project(L.hotPad.x, L.hotPad.y, 0);
        plaque(q.x, q.y, hot.name, G.fmt(hot.cost), "rgba(90,40,15,.9)");
      }
      if (G.mode === "play") {
        G.stallChips().forEach((b, i) => {
          const q = chipScreen(b), y = q.y + Math.sin(t * 5 + i) * 1.5;
          if (b.text) Art.badge(c, q.x, y, b.text, "#1a8f4a");
          else Art.upgradeArrow(c, q.x, y);
        });
        G.catchers().forEach((m) => {
          const lv = G.catcherLv(m), chip = G.chipPos(m);
          if (m.type === "rig") badgeAt(m.x, m.y, 70, lv + " fish", lv > 1 ? "#2f7fd6" : "#16324a");
          else badgeAt(m.bx, m.by, 30, "x" + lv, lv > 1 ? "#2f7fd6" : "#16324a", 42);
          if (G.chipVisible(m)) {
            const q = chipScreen(chip);
            Art.upgradeArrow(c, q.x, q.y + Math.sin(t * 5 + m.index) * 2);
          }
        });
      }
      if (G.food) badgeAt(G.food.x, G.food.y, 24, Math.ceil(G.food.life - G.food.t) + "s", "#b5712c");
      const belts = [["chain", L.beltPath, s.upg.belt, "#16324a"], ["feedBelt", L.feedBeltPath, s.upg.feed, "#16324a"], ["hotBelt", L.hotBeltPath, s.upg.hotBelt, "#b5702c"]];
      belts.forEach(([id, P, lv, col]) => {
        if (G.mode === "play" && s[id]) badgeAt(P[1][0], (P[1][1] + P[2][1]) / 2, 26, "Lv " + (lv + 1), col);
      });
    }
    // Water rings from splashes
    G.particles.forEach((q) => {
      if (!q.ring) return;
      const k = 1 - q.t / q.life, at2 = St.project(q.x, q.y, 0), scale = St.pixelsPerUnit(q.x, q.y);
      c.globalAlpha = k * 0.75;
      c.strokeStyle = q.c;
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(at2.x, at2.y, q.r * (1.2 - k) * scale, q.r * 0.68 * (1.2 - k) * scale, 0, 0, Math.PI * 2);
      c.stroke();
    });
    c.globalAlpha = 1;
    // Coins and logs flying up to the wallet
    G.flyers.forEach((f) => {
      if (!f.hud) return;
      const k = Math.min(1, f.t / f.dur), a = St.project(f.x0, f.y0, f.z0 || 0);
      const x = a.x + (HUD_X - a.x) * k, y = a.y + (HUD_Y - a.y) * k - Math.sin(k * Math.PI) * f.h;
      if (f.kind === "coin") Art.coin(c, x, y, 8, t + f.dur);
      else {
        c.save();
        c.translate(x, y);
        c.rotate(k * 8);
        c.fillStyle = "#8c6239";
        Art.rr(c, -11, -4, 22, 8, 3);
        c.fill();
        c.restore();
      }
    });
    if (!vignette) {
      const el = document.createElement("canvas");
      el.width = canvas.width;
      el.height = canvas.height;
      const x = el.getContext("2d");
      x.scale(R.scale, R.scale);
      const vg = x.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, W * 0.74);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(5,20,35,.3)");
      x.fillStyle = vg;
      x.fillRect(0, 0, W, H);
      vignette = el;
    }
    c.drawImage(vignette, 0, 0, W, H);
    if (G.mode === "play") drawGuideArrow(t);
    c.textAlign = "center";
    G.floats.forEach((f) => {
      const q = St.project(f.x, f.y, 34);
      c.globalAlpha = Math.min(1, (1.1 - f.t) * 3);
      c.font = "900 " + f.size + "px Trebuchet MS, sans-serif";
      c.lineWidth = 4;
      c.strokeStyle = "rgba(13,40,60,.85)";
      c.strokeText(f.text, q.x, q.y);
      c.fillStyle = f.color;
      c.fillText(f.text, q.x, q.y);
    });
    c.globalAlpha = 1;
  }

  function drawGuideArrow(t) {
    const g = G.guide();
    if (g.x === undefined) return;
    const q = St.project(g.x, g.y, 58);
    const x = q.x, y = q.y + Math.sin(t * 6) * 7;
    c.fillStyle = "#ffc531";
    c.strokeStyle = "#16324a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - 10, y - 26);
    c.lineTo(x + 10, y - 26);
    c.lineTo(x + 10, y - 8);
    c.lineTo(x + 21, y - 8);
    c.lineTo(x, y + 15);
    c.lineTo(x - 21, y - 8);
    c.lineTo(x - 10, y - 8);
    c.closePath();
    c.fill();
    c.stroke();
  }

  /* ---------- tapping things that stand above the ground ---------- */
  const ARROW_HIT = 26;
  R.chipAt = function (sx, sy) {
    const hit = G.catchers().find((m) => {
      if (!G.chipVisible(m)) return false;
      const q = chipScreen(G.chipPos(m));
      return Math.hypot(sx - q.x, sy - q.y) < ARROW_HIT;
    });
    if (hit) return { catcher: hit };
    const chip = G.stallChips().find((b) => {
      const q = chipScreen(b);
      return b.text ? Math.abs(sx - q.x) < 130 && Math.abs(sy - q.y) < 14 : Math.hypot(sx - q.x, sy - q.y) < ARROW_HIT;
    });
    return chip ? { chip } : null;
  };
  R.treeAt = function (sx, sy) {
    return G.trees.find((tr) => {
      if (tr.state !== "up") return false;
      const base = St.project(tr.x, tr.y, 0), top = St.project(tr.x, tr.y, 150);
      return Math.abs(sx - base.x) < 36 && sy < base.y + 12 && sy > top.y;
    });
  };

  /* ---------- each frame ---------- */
  let lastT = 0;
  R.draw = function () {
    if (!G.s) return;
    if (builtFor !== G.level().id) buildWorld();
    const t = G.time;
    R.dt = Math.min(0.1, Math.max(0, t - lastT)) || 0;
    lastT = t;
    frameId++;
    St.updateCamera();
    if (world.weather) world.weather.material.uniforms.uT.value = t;
    M.beginBanks();
    syncFish(t);
    syncPeople(t);
    sweepPeople();
    syncBuildings(t);
    syncNet();
    syncFlyers(t);
    syncRings(t);
    M.endBanks();
    particles.fill(G.particles);
    St.render(t);
    drawLabels(t);
  };
})();
