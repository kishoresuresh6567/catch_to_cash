/* Launch sequence: the Silly Goose Studios goose, then the pond opening where a net
   scoops up the 2 and two fish turn into Catch and Cash, then the title screen.
   It waits for a first tap, because browsers block sound until then, and the game is built after that tap. After that,
   tapping skips ahead one step. The opening's animation timings are in style.css. */
(function () {
  const STUDIO_TIME = 3400;
  const PRESENTS_TIME = 6800;
  const FADE_TIME = 500;
  // When each sound plays, in milliseconds from the start of its screen. These match
  // the animation timings in style.css.
  const STUDIO_SOUNDS = [[1000, "gooseCall"]]; // As the goose lands.
  const OPENING_SOUNDS = [
    [1250, "splash"], // The net dips into the pond.
    [1500, "netLift"], // The net lifts the 2 out.
    [3750, "fishJump"], // The fish leap.
    [4250, "logoJingle"] // The fish turn into Catch and Cash.
  ];
  const el = document.getElementById("splash");
  let started = false, playing = false, step = 0, timer, soundTimers = [];

  function playSounds(list) {
    soundTimers.forEach(clearTimeout);
    soundTimers = list.map(([at, name]) => setTimeout(() => CTC.audio.play(name), at));
  }

  // Each letter bounces in on its own.
  const name = document.getElementById("studioName");
  name.innerHTML = [...name.textContent].map((ch, i) => (ch === " " ? " " : '<span style="animation-delay:' + (0.75 + i * 0.045) + 's">' + ch + "</span>")).join("");

  function advance() {
    clearTimeout(timer);
    step++;
    if (step === 1) {
      el.classList.add("presents");
      playSounds(OPENING_SOUNDS);
      timer = setTimeout(advance, PRESENTS_TIME);
    } else if (step === 2) {
      playSounds([]);
      el.classList.add("leaving");
      CTC.audio.holdMusic = false;
      timer = setTimeout(() => el.remove(), FADE_TIME);
    }
  }

  // Uses click because some phones only unlock sound on a completed tap.
  el.addEventListener("click", function start() {
    if (started) return;
    started = true;
    CTC.audio.holdMusic = true; // Keeps the music out of the way of the intro sounds.
    CTC.audio.init();
    // Answers the tap at once, then builds the game. The show starts when that's done, so it
    // doesn't stutter and its sounds stay in time.
    const button = document.getElementById("tapToStart");
    button.innerHTML = "<b>Loading...</b>";
    requestAnimationFrame(() => setTimeout(() => {
      CTC.loadMain();
      (function waitForGame() {
        if (!CTC.ready) { setTimeout(waitForGame, 50); return; }
        el.classList.remove("waiting");
        playing = true;
        playSounds(STUDIO_SOUNDS);
        timer = setTimeout(advance, STUDIO_TIME);
      })();
    }));
  });

  el.addEventListener("pointerdown", () => {
    if (!playing) return;
    CTC.audio.play("honk");
    advance();
  });
})();
