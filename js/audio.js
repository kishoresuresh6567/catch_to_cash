/* All sound is synthesized live with Web Audio, so there are no audio files. */
(function () {
  const A = (CTC.audio = { muted: false, ctx: null });
  let master, noise, musicTimer;
  let lastCoin = 0;

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === "suspended") A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    master = A.ctx.createGain();
    master.gain.value = A.muted ? 0 : 0.8;
    master.connect(A.ctx.destination);
    noise = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startWaves();
    startMusic();
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.05);
  };

  function tone(freq, dur, type, vol, delay, slide) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + (delay || 0);
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function burst(dur, vol, from, to, delay) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + (delay || 0);
    const s = A.ctx.createBufferSource();
    s.buffer = noise;
    const f = A.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  // One goose honk: two buzzy tones through a nasal filter, with a slide in pitch.
  function gooseHonk(from, to, dur, delay, vol) {
    const t = A.ctx.currentTime + delay;
    const f = A.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(1000, t);
    f.Q.value = 1.6;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
    g.gain.setValueAtTime(vol, t + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(master);
    [["sawtooth", 1], ["square", 1.012]].forEach(([type, detune]) => {
      const o = A.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from * detune, t);
      o.frequency.exponentialRampToValueAtTime(to * detune, t + dur);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  }

  const SFX = {
    // The Silly Goose Studios call: honk, honk, then a big silly rising honk and a wobble.
    gooseCall() {
      gooseHonk(330, 280, 0.16, 0, 0.3);
      gooseHonk(350, 290, 0.16, 0.22, 0.3);
      gooseHonk(250, 560, 0.42, 0.46, 0.34);
      gooseHonk(520, 400, 0.1, 0.92, 0.22);
      gooseHonk(420, 520, 0.1, 1.03, 0.22);
      gooseHonk(500, 300, 0.2, 1.14, 0.24);
    },
    // The Catch 2 Cash jingle: a rising fanfare that ends in a coin cha-ching.
    logoJingle() {
      [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]].forEach(([f, d]) => {
        tone(f, 0.28, "triangle", 0.2, d);
        tone(f / 2, 0.28, "sawtooth", 0.05, d);
      });
      [523, 659, 784, 1047].forEach((f) => tone(f, 0.9, "triangle", 0.11, 0.48));
      tone(1568, 0.1, "square", 0.05, 0.62);
      tone(2093, 0.1, "square", 0.05, 0.7);
      tone(2637, 0.4, "square", 0.045, 0.78);
      burst(0.12, 0.05, 6000, 3000, 0.62);
    },
    netLift() { burst(0.5, 0.4, 700, 3000); tone(300, 0.45, "sine", 0.12, 0, 750); },
    fishJump() { burst(0.35, 0.28, 3000, 500); tone(420, 0.3, "triangle", 0.07, 0, 950); },
    throw() { burst(0.3, 0.16, 500, 2600); },
    splash() { burst(0.45, 0.4, 2400, 250); },
    catch() { tone(520, 0.1, "triangle", 0.2); tone(780, 0.14, "triangle", 0.2, 0.08); },
    miss() { tone(260, 0.2, "triangle", 0.12, 0, 170); },
    plop() { tone(620, 0.08, "sine", 0.1, 0, 300); },
    coin() {
      const now = A.ctx ? A.ctx.currentTime : 0;
      if (now - lastCoin < 0.07) return;
      lastCoin = now;
      tone(1320, 0.07, "square", 0.045);
      tone(1760, 0.16, "square", 0.045, 0.05);
    },
    honk() { tone(320, 0.16, "sawtooth", 0.12, 0, 240); tone(380, 0.22, "sawtooth", 0.12, 0.17, 250); },
    chop() { burst(0.1, 0.3, 1800, 500); tone(190, 0.08, "square", 0.06); },
    sizzle() { burst(0.35, 0.08, 5000, 2500); },
    pay() { tone(900 + Math.random() * 200, 0.05, "square", 0.025); },
    build() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.26, "triangle", 0.2, i * 0.09)); burst(0.25, 0.1, 1800, 400); },
    upgrade() { tone(660, 0.1, "triangle", 0.2); tone(990, 0.2, "triangle", 0.2, 0.08); },
    full() { tone(200, 0.15, "square", 0.05); },
    sail() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, "triangle", 0.18, i * 0.14)); tone(98, 1.6, "sawtooth", 0.1); }
  };
  A.play = function (name) { if (A.ctx && !A.muted && SFX[name]) SFX[name](); };

  // Soft surf: filtered noise with a slowly swelling volume.
  function startWaves() {
    const s = A.ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = A.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 480;
    const g = A.ctx.createGain();
    g.gain.value = 0.035;
    const lfo = A.ctx.createOscillator();
    const lg = A.ctx.createGain();
    lfo.frequency.value = 0.13;
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    s.connect(f).connect(g).connect(master);
    s.start();
    lfo.start();
  }

  // Gentle generative melody on a pentatonic scale.
  function startMusic() {
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
    const bass = [130.8, 98, 110, 87.3];
    let i = 3, beat = 0;
    musicTimer = setInterval(function () {
      if (A.muted || A.holdMusic || document.hidden) return;
      if (beat % 8 === 0) tone(bass[(beat / 8) % 4], 1.6, "sine", 0.05);
      if (Math.random() < 0.62) {
        i = Math.max(0, Math.min(scale.length - 1, i + Math.floor(Math.random() * 5) - 2));
        tone(scale[i], 0.5, "triangle", 0.03);
      }
      beat = (beat + 1) % 32;
    }, 300);
  }
})();
