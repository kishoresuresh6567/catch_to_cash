/* The full-screen river behind the mission screen, with fish leaping in and out of it. */
(function () {
  const WATER_Y = 470, W = 1280, H = 720;
  const COUNT = 6, LOOP = 2.6, LEAP = 0.7; // LEAP is the share of each loop a fish spends in the air.
  let running = false, canvas = null, c = null, right = 500;

  // A steady random number for one fish on one jump, so its path doesn't change in mid-air.
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

  function drawScene(t, T) {
    const sky = c.createLinearGradient(0, 0, 0, WATER_Y);
    sky.addColorStop(0, "#7cc8ee");
    sky.addColorStop(1, "#dff4fb");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, WATER_Y);
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.arc(150, 90, 46, 0, Math.PI * 2);
    c.fill();
    // Far bank
    c.fillStyle = T.groundDark;
    c.beginPath();
    c.moveTo(0, WATER_Y);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, 360 + Math.sin(x * 0.009) * 34 + Math.sin(x * 0.023) * 12);
    c.lineTo(W, WATER_Y);
    c.closePath();
    c.fill();
    c.fillStyle = T.ground;
    c.fillRect(0, WATER_Y - 34, W, 34);
    // River
    const water = c.createLinearGradient(0, WATER_Y, 0, H);
    water.addColorStop(0, T.shallow);
    water.addColorStop(0.25, T.mid);
    water.addColorStop(1, T.deep);
    c.fillStyle = water;
    c.fillRect(0, WATER_Y, W, H - WATER_Y);
    c.strokeStyle = "rgba(255,255,255,.35)";
    c.lineWidth = 3;
    c.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const y = WATER_Y + 22 + (i % 7) * 34, x = ((i * 193 + t * (18 + (i % 3) * 12)) % (W + 120)) - 60;
      c.beginPath();
      c.moveTo(x - 28, y);
      c.quadraticCurveTo(x, y - 7, x + 28, y);
      c.stroke();
    }
  }

  function drawSplash(x, y, age) {
    if (age < 0 || age > 1) return;
    c.strokeStyle = "rgba(255,255,255," + 0.85 * (1 - age) + ")";
    c.lineWidth = 4;
    for (let i = 0; i < 2; i++) {
      const r = 16 + i * 22 + age * 50;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.32, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "rgba(255,255,255," + (1 - age) + ")";
    for (let i = 0; i < 9; i++) {
      const dir = (i - 4) * 0.34;
      c.beginPath();
      c.arc(x + Math.sin(dir) * age * 74, y - Math.cos(dir) * age * 96 + age * age * 80, 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawFish(t, defs) {
    const hop = Math.min(170, Math.max(70, (right - 60) * 0.45));
    for (let i = 0; i < COUNT; i++) {
      const time = t / LOOP + i / COUNT, round = Math.floor(time), k = time - round;
      const x0 = 30 + hash(i, round) * Math.max(10, right - hop - 60);
      const y0 = WATER_Y + 26 + hash(round, i) * 150;
      const rise = 210 + hash(i + 9, round) * 150, x1 = x0 + hop;
      const air = k / LEAP;
      drawSplash(x0, y0, air / 0.45);
      drawSplash(x1, y0, (air - 1) / 0.6);
      if (air > 1) continue;
      const def = defs[i % defs.length];
      const x = x0 + hop * air, y = y0 - Math.sin(air * Math.PI) * rise;
      const angle = Math.atan2(-Math.cos(air * Math.PI) * Math.PI * rise, hop);
      CTC.art.fish(c, x, y, def, 2.3 / Math.max(1, def.size), angle, t * 20 + i);
    }
  }

  function frame(ms) {
    if (!running) return;
    const level = CTC.game.level(), t = ms / 1000;
    c.setTransform(1, 0, 0, 1, 0, 0);
    drawScene(t, level.theme);
    drawFish(t, level.fish.filter((f) => !f.food));
    requestAnimationFrame(frame);
  }

  CTC.leap = {
    start() {
      canvas = document.getElementById("leapCanvas");
      c = canvas.getContext("2d");
      // Fish stay in the open water to the left of the card.
      const box = canvas.getBoundingClientRect(), card = document.querySelector("#briefing .card").getBoundingClientRect();
      right = ((card.left - box.left) / (box.width || 1)) * W;
      if (!running) { running = true; requestAnimationFrame(frame); }
    },
    stop() { running = false; }
  };
})();
