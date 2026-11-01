/* The 2D pieces: fish for menus and bubbles, badges and buttons, and how each person looks. */
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

  // Elastic overshoot used when a new building appears.
  function popScale(p) {
    if (p >= 1) return 1;
    return 1 - Math.pow(1 - p, 3) * Math.cos(p * 9);
  }
  Art.popScale = popScale;
})();
