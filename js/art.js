/* Procedural sprites: every character and building is drawn with canvas paths. */
(function () {
  const Art = (CTC.art = {});
  const SKIN = ["#f6cfa8", "#e4ad80", "#b97a4f", "#8a5636", "#ffdcbf"];
  const SHIRT = ["#e4574c", "#3b82d6", "#2fb37a", "#a45fd6", "#f29a2e", "#e45f9d", "#3fb6c9"];
  const HAIR = ["#2b1d14", "#6a3d1e", "#d1a04b", "#a9a9b5", "#b0442b"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  Art.rr = rr;

  Art.shadow = function (c, x, y, w, h, a) {
    c.fillStyle = "rgba(10,30,45," + (a || 0.25) + ")";
    c.beginPath();
    c.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    c.fill();
  };

  /* ---------- fish ---------- */
  Art.fish = function (c, x, y, def, scale, angle, wig) {
    const s = scale * def.size;
    const tail = Math.sin(wig) * 0.45;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    if (Math.cos(angle) < 0) c.scale(1, -1);
    c.scale(s, s);
    c.fillStyle = def.fin;
    c.save();
    c.translate(-12, 0);
    c.rotate(tail);
    c.beginPath();
    c.moveTo(2, 0);
    c.quadraticCurveTo(-7, -3, -10, -8);
    c.quadraticCurveTo(-7, 0, -10, 8);
    c.quadraticCurveTo(-7, 3, 2, 0);
    c.fill();
    c.restore();
    c.beginPath();
    c.moveTo(-5, -5);
    c.quadraticCurveTo(0, -12, 6, -6);
    c.fill();
    c.fillStyle = def.body;
    c.beginPath();
    c.moveTo(-14, 0);
    c.bezierCurveTo(-7, -9, 9, -9, 15, 0);
    c.bezierCurveTo(9, 8, -7, 8, -14, 0);
    c.fill();
    c.fillStyle = def.belly;
    c.beginPath();
    c.moveTo(-10, 2);
    c.bezierCurveTo(-3, 7, 8, 7, 13, 1.5);
    c.bezierCurveTo(6, 3, -2, 3.5, -10, 2);
    c.fill();
    c.fillStyle = def.fin;
    c.beginPath();
    c.ellipse(1, 3, 4, 2.2, 0.5 + tail, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(9, -2, 2.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#123";
    c.beginPath();
    c.arc(9.6, -2, 1.3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  // The same fish, grilled golden brown with char marks.
  const cookedDefs = new WeakMap();
  Art.cookedDef = function (def) {
    if (!cookedDefs.has(def)) cookedDefs.set(def, { size: def.size, body: "#b5702c", belly: "#edbb78", fin: "#6e3f1c" });
    return cookedDefs.get(def);
  };

  Art.fireplace = function (c, x, y, t, grill, cookTime, defs, pile, burning, wood) {
    Art.shadow(c, x, y + 2, 46, 13, 0.25);
    // Logs
    c.lineCap = "round";
    c.strokeStyle = "#6e4426";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(x - 22, y - 6); c.lineTo(x + 20, y - 15);
    c.moveTo(x + 22, y - 6); c.lineTo(x - 20, y - 15);
    c.stroke();
    // Flames
    if (burning) {
      [["#ff5a3c", 22, 26], ["#ff9a3c", 16, 20], ["#ffe46b", 9, 12]].forEach((f, i) => {
        const h = f[2] + Math.sin(t * 13 + i * 2) * 4 + Math.sin(t * 21 + i) * 2;
        const lean = Math.sin(t * 6 + i) * 3;
        c.fillStyle = f[0];
        c.beginPath();
        c.moveTo(x - f[1] / 2 - 2, y - 10);
        c.quadraticCurveTo(x - f[1] / 2, y - 10 - h * 0.6, x + lean, y - 10 - h);
        c.quadraticCurveTo(x + f[1] / 2, y - 10 - h * 0.6, x + f[1] / 2 + 2, y - 10);
        c.closePath();
        c.fill();
      });
      c.fillStyle = "rgba(255,170,70," + (0.14 + 0.04 * Math.sin(t * 9)) + ")";
      c.beginPath();
      c.ellipse(x, y - 12, 56, 34, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Stone ring
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      c.fillStyle = i % 2 ? "#8d939a" : "#a6acb3";
      c.beginPath();
      c.ellipse(x + Math.cos(a) * 32, y - 6 + Math.sin(a) * 12, 9, 6.5, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Grill rack on two posts
    c.fillStyle = "#3a4552";
    c.fillRect(x - 40, y - 42, 4, 36);
    c.fillRect(x + 36, y - 42, 4, 36);
    c.fillRect(x - 40, y - 42, 80, 3);
    c.fillRect(x - 40, y - 37, 80, 2);
    grill.forEach((g, i) => {
      const gx = x - 27 + (i % 4) * 18, row = Math.floor(i / 4) * 22, k = Math.min(1, g.t / cookTime);
      c.globalAlpha = 1 - k;
      Art.fish(c, gx, y - 44 - row, defs[g.sp], 0.5, -Math.PI / 2, 0);
      c.globalAlpha = k;
      Art.fish(c, gx, y - 44 - row, Art.cookedDef(defs[g.sp]), 0.5, -Math.PI / 2, 0);
      c.globalAlpha = 1;
      c.fillStyle = "rgba(0,0,0,.45)";
      c.fillRect(gx - 7, y - 60 - row, 14, 3);
      c.fillStyle = k >= 1 ? "#36c26b" : "#ffc531";
      c.fillRect(gx - 7, y - 60 - row, 14 * k, 3);
    });
    // Cooked fish waiting on a plank
    if (pile.length) {
      c.fillStyle = "#a9713a";
      rr(c, x + 44, y - 16, 46, 16, 3);
      c.fill();
      pile.slice(0, 6).forEach((sp, i) => Art.fish(c, x + 52 + (i % 3) * 15, y - 18 - (i >= 3 ? 6 : 0), Art.cookedDef(defs[sp]), 0.5, 0, 0));
      Art.badge(c, x + 92, y - 24, "" + pile.length, "#b5702c");
    }
  };

  // The separate shop for cooked food: brick counter, red-and-yellow awning, steam.
  Art.foodShop = function (c, x, y, t, cooked, defs, sellers, cartLv, cap) {
    Art.shadow(c, x, y + 6, 84, 12, 0.22);
    c.fillStyle = "#5a3319";
    c.fillRect(x - 70, y - 84, 7, 84);
    c.fillRect(x + 63, y - 84, 7, 84);
    const SHOP_SELLER_X = [10, -34, 46, -62];
    sellers.forEach((o, i) => Art.person(c, x + SHOP_SELLER_X[i], y - 22, o));
    c.fillStyle = cartLv >= 2 ? "#7a3f9c" : "#a8452f";
    rr(c, x - 76, y - 36, 152, 40, 5);
    c.fill();
    c.fillStyle = cartLv >= 2 ? "#633280" : "#8c3825";
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) c.fillRect(x - 72 + i * 21 + (row % 2) * 10, y - 30 + row * 11, 16, 2);
    }
    if (cartLv >= 2) {
      c.fillStyle = "#ffc531";
      c.fillRect(x - 76, y - 34, 152, 3);
      c.fillRect(x - 76, y + 1, 152, 3);
    }
    // Serving plank and plates of food
    c.fillStyle = "#e9d3a5";
    rr(c, x - 78, y - 44, 156, 11, 4);
    c.fill();
    const n = Math.min(cooked.length, 6);
    for (let i = 0; i < n; i++) {
      const fx = x - 60 + i * 24;
      c.fillStyle = "#fff";
      c.beginPath();
      c.ellipse(fx, y - 44, 11, 4, 0, 0, Math.PI * 2);
      c.fill();
      Art.fish(c, fx, y - 47, Art.cookedDef(defs[cooked[i]] || defs[0]), 0.55, 0, 0);
      const k = (t * 0.7 + i * 0.27) % 1;
      c.fillStyle = "rgba(255,255,255," + 0.5 * (1 - k) + ")";
      c.beginPath();
      c.arc(fx + Math.sin(k * 6 + i) * 3, y - 54 - k * 20, 2 + k * 3, 0, Math.PI * 2);
      c.fill();
    }
    // Awning
    const stripes = 6, w = 164, ax = x - w / 2, ay = y - 110;
    for (let i = 0; i < stripes; i++) {
      c.fillStyle = i % 2 ? "#ffc531" : "#d9412f";
      const sx = ax + (i * w) / stripes, sw = w / stripes;
      c.beginPath();
      c.moveTo(sx + 7, ay);
      c.lineTo(sx + sw + 7, ay);
      c.lineTo(sx + sw, ay + 24);
      c.arc(sx + sw / 2, ay + 24, sw / 2, 0, Math.PI);
      c.closePath();
      c.fill();
    }
    if (cartLv >= 1) {
      const flags = ["#ffc531", "#d9412f", "#fff8e7", "#ff8a3c"];
      for (let i = 0; i < 7; i++) {
        const fx = x - 54 + i * 18, fy = y - 76 + Math.sin((i / 6) * Math.PI) * 7 + Math.sin(t * 2 + i) * 0.8;
        c.fillStyle = flags[i % 4];
        c.beginPath();
        c.moveTo(fx - 5, fy);
        c.lineTo(fx + 5, fy);
        c.lineTo(fx, fy + 9);
        c.fill();
      }
    }
    if (cartLv >= 4) {
      [-66, 66].forEach((dx) => {
        c.fillStyle = "rgba(255,190,80," + (0.3 + 0.1 * Math.sin(t * 3 + dx)) + ")";
        c.beginPath();
        c.arc(x + dx, y - 66, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ffd34d";
        rr(c, x + dx - 4, y - 72, 8, 12, 3);
        c.fill();
      });
    }
    c.save();
    c.translate(x, y - 120 + Math.sin(t * 1.5 + 2) * 1.2);
    if (cartLv >= 3) {
      c.fillStyle = "#ffc531";
      rr(c, -45, -15, 90, 30, 9);
      c.fill();
    }
    c.fillStyle = "#5a1f12";
    rr(c, -42, -12, 84, 24, 7);
    c.fill();
    c.fillStyle = "#ffd34d";
    c.font = "900 15px Trebuchet MS, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("HOT FOOD", 0, 1, 76);
    c.textBaseline = "alphabetic";
    c.restore();
    if (cooked.length) Art.badge(c, x + 78, y - 46, cooked.length + "/" + cap, "#b5702c");
  };

  Art.stump = function (c, x, y) {
    Art.shadow(c, x, y + 2, 18, 6);
    c.fillStyle = "#6e4a2c";
    rr(c, x - 12, y - 14, 24, 16, 3);
    c.fill();
    c.fillStyle = "#d9b98a";
    c.beginPath();
    c.ellipse(x, y - 14, 12, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#a9835a";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, y - 14, 6, 2.5, 0, 0, Math.PI * 2);
    c.stroke();
  };

  Art.axe = function (c, x, y, swing, face) {
    c.save();
    c.translate(x, y);
    c.scale(face, 1);
    c.rotate(-1.1 + swing * 1.5);
    c.strokeStyle = "#7c5230";
    c.lineWidth = 3.5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -24);
    c.stroke();
    c.fillStyle = "#c4ccd4";
    c.beginPath();
    c.moveTo(-1, -26); c.lineTo(11, -30); c.quadraticCurveTo(14, -22, 10, -15); c.lineTo(-1, -19);
    c.closePath();
    c.fill();
    c.restore();
  };

  Art.coin = function (c, x, y, r, t) {
    const w = Math.abs(Math.cos(t * 9)) * r + 1;
    c.fillStyle = "#c98a06";
    c.beginPath();
    c.ellipse(x, y + 1.5, w, r, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffd34d";
    c.beginPath();
    c.ellipse(x, y, w, r, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.6)";
    c.beginPath();
    c.ellipse(x - w * 0.25, y - r * 0.25, w * 0.3, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  };

  /* ---------- people ---------- */
  Art.makeCustomer = function (x, y, want) {
    return {
      x, y, tx: x, ty: y, want, wantStart: want, state: "queue", face: -1, walk: Math.random() * 6,
      moving: true, patience: 42 + Math.random() * 16, joy: 0, mood: null,
      look: {
        skin: pick(SKIN), shirt: pick(SHIRT), pants: pick(["#334a66", "#5a4638", "#3f5a4a", "#55406e"]),
        hair: pick(HAIR), style: Math.floor(Math.random() * 3), scale: 0.9 + Math.random() * 0.14
      }
    };
  };

  Art.person = function (c, x, y, o) {
    const look = o.look;
    const swing = o.moving ? Math.sin(o.walk) : 0;
    const hop = o.moving ? Math.abs(Math.cos(o.walk)) * 3 : Math.sin((o.idle || 0) * 2.2) * 0.8;
    const joy = o.joy || 0;
    Art.shadow(c, x, y, 17 * look.scale, 6 * look.scale);
    c.save();
    c.translate(x, y - joy * 8);
    c.scale((o.face || 1) * look.scale, look.scale);
    c.lineCap = "round";
    // Legs
    c.strokeStyle = look.pants;
    c.lineWidth = 6.5;
    c.beginPath();
    c.moveTo(-5, -17);
    c.lineTo(-5 + swing * 6, -3);
    c.moveTo(5, -17);
    c.lineTo(5 - swing * 6, -3);
    c.stroke();
    c.fillStyle = look.boots || "#3b2a1e";
    c.beginPath();
    c.ellipse(-4 + swing * 6, -2, 5, 3, 0, 0, Math.PI * 2);
    c.ellipse(6 - swing * 6, -2, 5, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(0, -hop);
    // Back arm
    c.strokeStyle = look.skin;
    c.lineWidth = 5;
    const armBack = o.throwing ? -1.9 : -swing * 0.8;
    c.beginPath();
    c.moveTo(-9, -33);
    c.lineTo(-9 + Math.sin(armBack) * 14, -33 + Math.cos(armBack) * 14);
    c.stroke();
    // Body
    c.fillStyle = look.shirt;
    rr(c, -11, -41, 22, 27, 8);
    c.fill();
    if (look.apron) {
      c.fillStyle = look.apron;
      rr(c, -8, -30, 16, 17, 4);
      c.fill();
    }
    // Front arm
    c.strokeStyle = look.skin;
    const armFront = o.throwing ? 2.6 : swing * 0.8 + joy * 2;
    c.beginPath();
    c.moveTo(9, -33);
    c.lineTo(9 + Math.sin(armFront) * 14, -33 + Math.cos(armFront) * 14);
    c.stroke();
    // Head
    c.fillStyle = look.skin;
    c.beginPath();
    c.arc(1, -51, 13, 0, Math.PI * 2);
    c.fill();
    // Hair
    if (look.hair) {
      c.fillStyle = look.hair;
      c.beginPath();
      c.arc(1, -57, 12.4, Math.PI * 0.92, Math.PI * 2.08);
      c.fill();
      if (look.style === 1) { rr(c, -14, -56, 8, 20, 4); c.fill(); }
      if (look.style === 2) { c.beginPath(); c.arc(-2, -66, 5.5, 0, Math.PI * 2); c.fill(); }
    }
    // Eyes and mouth
    c.fillStyle = "#14202b";
    c.beginPath();
    c.arc(8, -50, 1.8, 0, Math.PI * 2);
    c.arc(2, -50, 1.8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#7a3d2c";
    c.lineWidth = 1.5;
    c.beginPath();
    if (o.mood === "sad") c.arc(5, -41, 3, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(5, -46, 3, 0.2, Math.PI - 0.2);
    c.stroke();
    // Hat
    if (look.hat) {
      c.fillStyle = look.hat;
      c.beginPath();
      c.ellipse(1, -61, 21, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(1, -62, 11.5, Math.PI, Math.PI * 2);
      c.fill();
      c.fillStyle = look.hatBand || "#c0392b";
      c.fillRect(-10.5, -66, 23, 3.5);
    }
    c.restore();
  };

  Art.playerLook = { skin: "#eebb8f", shirt: "#2f7fd6", pants: "#27384d", hair: "#2b1d14", style: 0, scale: 1.06, hat: "#f4d57e", hatBand: "#c0392b", boots: "#7c2f22" };
  Art.sellerLooks = [
    { skin: "#d9a06e", shirt: "#ffffff", pants: "#27384d", hair: "#4a2b18", style: 2, scale: 0.98, apron: "#3fb6c9" },
    { skin: "#8a5636", shirt: "#ffffff", pants: "#27384d", hair: "#2b1d14", style: 0, scale: 1.02, apron: "#e4574c" },
    { skin: "#f6cfa8", shirt: "#ffffff", pants: "#27384d", hair: "#d1a04b", style: 1, scale: 0.94, apron: "#2fb37a" },
    { skin: "#b97a4f", shirt: "#ffffff", pants: "#27384d", hair: "#b0442b", style: 0, scale: 0.98, apron: "#f29a2e" }
  ];

  Art.cutterLooks = [
    { skin: "#d9a06e", shirt: "#c23b3b", pants: "#3f4a35", hair: "#4a2b18", style: 0, scale: 1 },
    { skin: "#8a5636", shirt: "#2f7a4a", pants: "#3f4a35", hair: "#2b1d14", style: 2, scale: 0.98 },
    { skin: "#f6cfa8", shirt: "#d98a1f", pants: "#3f4a35", hair: "#b0442b", style: 1, scale: 1.02 }
  ];

  /* ---------- buildings ---------- */
  Art.crate = function (c, x, y, fish, def, count) {
    Art.shadow(c, x, y + 4, 40, 9);
    c.fillStyle = "#8b5a2b";
    rr(c, x - 36, y - 34, 72, 38, 4);
    c.fill();
    c.fillStyle = "#a9713a";
    for (let i = 0; i < 3; i++) { rr(c, x - 36, y - 33 + i * 12.4, 72, 10.5, 2); c.fill(); }
    // Pile of fish spilling over the rim
    const n = Math.min(fish.length, 12);
    for (let i = 0; i < n; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      Art.fish(c, x - 26 + col * 13 + row * 5, y - 36 - row * 6, def[fish[i]], 0.62, (i * 1.7) % 0.6 - 0.3, 0);
    }
    if (count > 0) Art.badge(c, x + 36, y - 40, String(count));
    c.fillStyle = "#f3e0bd";
    c.font = "800 10px Trebuchet MS, sans-serif";
    c.textAlign = "center";
    c.fillText("CATCH", x, y - 12);
  };

  Art.badge = function (c, x, y, text, color) {
    c.font = "800 13px Trebuchet MS, sans-serif";
    const w = Math.max(22, c.measureText(text).width + 12);
    c.fillStyle = color || "#16324a";
    rr(c, x - w / 2, y - 10, w, 20, 10);
    c.fill();
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, x, y + 0.5);
    c.textBaseline = "alphabetic";
  };

  Art.upgradeArrow = function (c, x, y) {
    c.fillStyle = "#1e7ff0";
    c.strokeStyle = "#fff";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, 15, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff";
    c.beginPath();
    c.moveTo(x, y - 9);
    c.lineTo(x + 8, y);
    c.lineTo(x + 3, y);
    c.lineTo(x + 3, y + 8);
    c.lineTo(x - 3, y + 8);
    c.lineTo(x - 3, y);
    c.lineTo(x - 8, y);
    c.closePath();
    c.fill();
  };

  Art.stall = function (c, s, t, theme, stock, fishDefs, sellers, cartLv, cap) {
    const x = s.x, y = s.y;
    Art.shadow(c, x, y + 8, 100, 15, 0.22);
    // Back posts
    c.fillStyle = "#7c5230";
    c.fillRect(x - 86, y - 122, 8, 118);
    c.fillRect(x + 78, y - 122, 8, 118);
    const SELLER_X = [16, -38, 60, -68];
    sellers.forEach((o, i) => Art.person(c, x + SELLER_X[i], y - 26, o));
    // Max cart: extra crates of fish on both sides
    if (cartLv >= 4) {
      [-118, 118].forEach((dx) => {
        c.fillStyle = "#8b5a2b";
        rr(c, x + dx - 20, y - 26, 40, 30, 3);
        c.fill();
        for (let i = 0; i < 3; i++) Art.fish(c, x + dx - 11 + i * 11, y - 28, fishDefs[i], 0.55, 0.3 - i * 0.3, 0);
      });
    }
    // Counter
    c.fillStyle = cartLv >= 2 ? "#2f6f9f" : "#a9713a";
    rr(c, x - 92, y - 44, 184, 48, 6);
    c.fill();
    c.fillStyle = cartLv >= 2 ? "#245a84" : "#8b5a2b";
    for (let i = 0; i < 6; i++) c.fillRect(x - 86 + i * 30, y - 34, 3, 37);
    if (cartLv >= 2) {
      c.fillStyle = "#ffc531";
      c.fillRect(x - 92, y - 42, 184, 3);
      c.fillRect(x - 92, y - 2, 184, 3);
    }
    // Ice tray and displayed fish
    c.fillStyle = "#dff6ff";
    rr(c, x - 86, y - 56, 172, 16, 6);
    c.fill();
    c.fillStyle = "#b9e6f5";
    rr(c, x - 82, y - 46, 164, 5, 2);
    c.fill();
    const n = Math.min(stock.length, 14);
    for (let i = 0; i < n; i++) {
      Art.fish(c, x - 72 + (i % 7) * 24, y - 53 - (i >= 7 ? 6 : 0), fishDefs[stock[i]], 0.62, i % 2 ? 0.14 : -0.1, 0);
    }
    // Awning
    const stripes = 8, w = 200, ax = x - w / 2, ay = y - 146;
    for (let i = 0; i < stripes; i++) {
      c.fillStyle = i % 2 ? (cartLv >= 3 ? "#ffc531" : "#fff8e7") : theme.awning;
      const sx = ax + (i * w) / stripes, sw = w / stripes;
      c.beginPath();
      c.moveTo(sx + 8, ay);
      c.lineTo(sx + sw - 8 + (i === stripes - 1 ? 8 : 8), ay);
      c.lineTo(sx + sw, ay + 30);
      c.arc(sx + sw / 2, ay + 30, sw / 2, 0, Math.PI);
      c.closePath();
      c.fill();
    }
    // Upgraded carts get bunting and lanterns
    if (cartLv >= 1) {
      const flags = ["#e4574c", "#ffc531", "#3fb6c9", "#2fb37a", "#a45fd6"];
      for (let i = 0; i < 9; i++) {
        const fx = x - 80 + i * 20, fy = y - 104 + Math.sin((i / 8) * Math.PI) * 10 + Math.sin(t * 2 + i) * 0.8;
        c.fillStyle = flags[i % 5];
        c.beginPath();
        c.moveTo(fx - 6, fy);
        c.lineTo(fx + 6, fy);
        c.lineTo(fx, fy + 11);
        c.fill();
      }
      [-82, 82].forEach((dx) => {
        c.fillStyle = "rgba(255,210,90," + (0.28 + 0.1 * Math.sin(t * 3 + dx)) + ")";
        c.beginPath();
        c.arc(x + dx, y - 92, 15, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ffd34d";
        rr(c, x + dx - 5, y - 99, 10, 14, 3);
        c.fill();
      });
    }
    // Sign
    c.save();
    c.translate(x, y - 160 + Math.sin(t * 1.5) * 1.2);
    if (cartLv >= 3) {
      c.fillStyle = "#ffc531";
      rr(c, -49, -17, 98, 34, 10);
      c.fill();
    }
    c.fillStyle = "#16324a";
    rr(c, -46, -14, 92, 28, 8);
    c.fill();
    c.fillStyle = "#ffc531";
    c.font = "900 17px Trebuchet MS, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("FRESH FISH", 0, 1, 84);
    c.textBaseline = "alphabetic";
    c.restore();
    if (stock.length) Art.badge(c, x + 92, y - 58, stock.length + "/" + cap);
  };

  // Crane on the shore. Its net hangs over the water and dips on each cycle.
  Art.rig = function (c, m, t) {
    const x = m.x, y = m.y;
    const pop = popScale(m.pop);
    c.save();
    c.translate(x, y);
    c.scale(pop, pop);
    Art.shadow(c, 0, 4, 34, 9);
    c.fillStyle = "#7c5230";
    c.beginPath();
    c.moveTo(-20, 2); c.lineTo(-6, -62); c.lineTo(0, -62); c.lineTo(-11, 2); c.closePath();
    c.moveTo(20, 2); c.lineTo(6, -62); c.lineTo(0, -62); c.lineTo(11, 2); c.closePath();
    c.fill();
    c.fillStyle = "#3f6c8f";
    Art.rr(c, -14, -28, 28, 24, 4);
    c.fill();
    // Spinning winch
    c.save();
    c.translate(0, -16);
    c.rotate(t * (m.dip > 0 ? 7 : 1.2));
    c.strokeStyle = "#ffc531";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(0, -8); c.lineTo(0, 8);
    c.stroke();
    c.restore();
    // Arm
    c.strokeStyle = "#9b6c3c";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(16, -60);
    c.lineTo(-115, -62);
    c.stroke();
    // Rope and net
    const drop = 22 + m.dip * 46;
    c.strokeStyle = "#e9dcc0";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-112, -60);
    c.lineTo(-112, -60 + drop);
    c.stroke();
    Art.netBag(c, -112, -60 + drop, 15, t);
    c.restore();
  };

  Art.netBag = function (c, x, y, r, t) {
    c.save();
    c.translate(x, y);
    c.fillStyle = "rgba(233,220,192,.25)";
    c.strokeStyle = "#e9dcc0";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, r * 0.7, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * r * 0.4, 0);
      c.quadraticCurveTo(i * r * 0.8, r, 0, r * 1.7);
      c.stroke();
    }
    c.restore();
  };

  Art.boat = function (c, m, t, theme) {
    const bob = Math.sin(t * 2 + m.x) * 1.8;
    c.save();
    c.translate(m.bx, m.by + bob);
    c.scale(m.face * popScale(m.pop), popScale(m.pop));
    Art.shadow(c, 0, 12, 46, 9, 0.28);
    c.fillStyle = theme.weather === "snow" ? "#c23b3b" : "#2f7fd6";
    c.beginPath();
    c.moveTo(-44, -6);
    c.lineTo(46, -8);
    c.quadraticCurveTo(38, 14, 26, 14);
    c.lineTo(-34, 14);
    c.closePath();
    c.fill();
    c.fillStyle = "#fff8e7";
    c.fillRect(-42, -8, 86, 5);
    c.fillStyle = "#fff8e7";
    Art.rr(c, -4, -36, 28, 28, 3);
    c.fill();
    c.fillStyle = "#3fb6c9";
    c.fillRect(1, -31, 18, 10);
    c.fillStyle = "#16324a";
    c.fillRect(-6, -38, 32, 4);
    c.strokeStyle = "#7c5230";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-18, -6);
    c.lineTo(-18, -44);
    c.lineTo(-48, -22);
    c.stroke();
    if (m.state === "fish") {
      c.strokeStyle = "#e9dcc0";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-48, -22);
      c.lineTo(-48, -14 + (m.dip || 0) * 20);
      c.stroke();
      Art.netBag(c, -48, -14 + (m.dip || 0) * 20, 11, t);
    }
    c.restore();
    if (m.haul > 0) Art.badge(c, m.bx, m.by - 54 + bob, "" + m.haul);
  };

  Art.ship = function (c, x, y, t) {
    const bob = Math.sin(t * 1.4) * 3;
    c.save();
    c.translate(x, y + bob);
    c.rotate(Math.sin(t * 1.1) * 0.015);
    Art.shadow(c, 0, 28, 104, 15, 0.3);
    c.fillStyle = "#6e3f22";
    c.beginPath();
    c.moveTo(-100, -10);
    c.lineTo(110, -18);
    c.quadraticCurveTo(84, 30, 60, 30);
    c.lineTo(-74, 30);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffc531";
    c.fillRect(-92, -8, 190, 5);
    c.fillStyle = "#4b2a16";
    for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-60 + i * 34, 10, 5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "#5a3319";
    c.fillRect(-26, -120, 7, 112);
    c.fillRect(38, -96, 6, 84);
    const belly = Math.sin(t * 0.9) * 3;
    [[-22, -116, 66, 64], [41, -92, 44, 50]].forEach((sail) => {
      c.fillStyle = "#fff8e7";
      c.beginPath();
      c.moveTo(sail[0], sail[1]);
      c.quadraticCurveTo(sail[0] - sail[2] * 0.2 - belly, sail[1] + sail[3] / 2, sail[0], sail[1] + sail[3]);
      c.lineTo(sail[0] - sail[2], sail[1] + sail[3]);
      c.quadraticCurveTo(sail[0] - sail[2] * 0.6, sail[1] + sail[3] / 2, sail[0], sail[1]);
      c.fill();
    });
    c.fillStyle = "#e4574c";
    c.beginPath();
    c.moveTo(-26, -120);
    c.lineTo(-26 - 26, -126 + Math.sin(t * 5) * 2);
    c.lineTo(-26, -132);
    c.fill();
    c.restore();
  };

  Art.palm = function (c, x, y, t, i) {
    Art.shadow(c, x + 8, y + 2, 34, 9);
    const sway = Math.sin(t * 0.9 + i) * 0.05;
    c.strokeStyle = "#8c6239";
    c.lineWidth = 11;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + 12, y - 60, x + 8, y - 112);
    c.stroke();
    c.save();
    c.translate(x + 8, y - 114);
    c.rotate(sway);
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.04 + (k / 6) * Math.PI * 1.08 + Math.PI * -1.02;
      c.fillStyle = k % 2 ? "#3f9a4d" : "#4fb35a";
      c.save();
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(32, -18, 66, 8);
      c.quadraticCurveTo(32, 2, 0, 0);
      c.fill();
      c.restore();
    }
    c.fillStyle = "#7c5230";
    c.beginPath();
    c.arc(-5, 5, 5, 0, Math.PI * 2);
    c.arc(5, 6, 5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  Art.pine = function (c, x, y, t, i) {
    Art.shadow(c, x + 6, y + 2, 30, 8);
    c.fillStyle = "#6e4a2c";
    c.fillRect(x - 5, y - 22, 10, 22);
    const sway = Math.sin(t * 0.8 + i) * 1.3;
    for (let k = 0; k < 3; k++) {
      const w = 40 - k * 9, top = y - 72 - k * 26, bot = y - 18 - k * 24;
      c.fillStyle = "#2f6e58";
      c.beginPath();
      c.moveTo(x - w, bot);
      c.lineTo(x + sway * (k + 1), top);
      c.lineTo(x + w, bot);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.moveTo(x - w * 0.52, (bot + top) / 2);
      c.lineTo(x + sway * (k + 1), top);
      c.lineTo(x + w * 0.52, (bot + top) / 2);
      c.quadraticCurveTo(x, (bot + top) / 2 - 5, x - w * 0.52, (bot + top) / 2);
      c.fill();
    }
  };

  Art.coralTree = function (c, x, y, t, i) {
    Art.shadow(c, x, y + 2, 26, 7);
    const cols = ["#e8577a", "#ff8f5a", "#b05fd6"];
    c.strokeStyle = cols[i % 3];
    c.lineCap = "round";
    const sway = Math.sin(t * 0.9 + i) * 2;
    function branch(px, py, a, len, w) {
      const nx = px + Math.cos(a) * len + sway * 0.15, ny = py + Math.sin(a) * len;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(nx, ny);
      c.stroke();
      if (len > 13) {
        branch(nx, ny, a - 0.5, len * 0.72, w * 0.72);
        branch(nx, ny, a + 0.5, len * 0.72, w * 0.72);
      }
    }
    branch(x, y, -Math.PI / 2, 34, 8);
  };

  // Elastic overshoot used when a new building appears.
  function popScale(p) {
    if (p >= 1) return 1;
    return 1 - Math.pow(1 - p, 3) * Math.cos(p * 9);
  }
  Art.popScale = popScale;
})();
