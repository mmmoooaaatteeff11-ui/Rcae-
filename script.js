
(() => {
  function initGame() {
    const canvas = document.getElementById("road");
    if (!canvas) {
      console.error("Missing #road canvas. Check the HTML panel.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const $ = id => document.getElementById(id);

    const overlay = $("overlay");
    const startBtn = $("start");
    const heading = $("heading");
    const description = $("description");
    const scoreEl = $("score");
    const speedEl = $("speed");
    const nitroFill = $("nitroFill");

    let W = 0, H = 0, dpr = 1;
    let active = false, paused = false, ended = false;
    let score = 0, speed = 120, nitro = 100;
    let roadTime = 0, spawnTime = 0, lastTime = 0;
    let nitroHeld = false;
    let lane = 1, playerX = 0;
    let traffic = [];
    let best = 0;

    const carColors = [
      "#ff3658", "#f5a623", "#eaf2ff",
      "#525d79", "#16c8b6", "#b45bff"
    ];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      playerX = laneX(lane, H * .79);
    }

    window.addEventListener("resize", resize);

    function road(y) {
      const p = Math.max(0, Math.min(1,
        (y - H * .25) / (H * .75)
      ));
      const width = W * (.22 + p * .70);
      const center = W / 2 +
        Math.sin(roadTime * .00025 + p * 2) * p * W * .025;
      return { p, width, center };
    }

    function laneX(n, y) {
      const r = road(y);
      return r.center + (n - 1) * r.width * .30;
    }

    function poly(points, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fill();
    }

    function drawWorld() {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#071027");
      sky.addColorStop(.28, "#345267");
      sky.addColorStop(.48, "#172a30");
      sky.addColorStop(1, "#101820");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // City buildings
      for (let i = 0; i < 20; i++) {
        const bw = W / 12;
        const x = i * bw - (roadTime * .012 % bw);
        const bh = H * (.04 + ((i * 19) % 8) / 100);
        ctx.fillStyle = i % 2 ? "#101a30" : "#17243a";
        ctx.fillRect(x, H * .29 - bh, bw * .8, bh);

        ctx.fillStyle = "#6beaff88";
        for (let wy = H * .29 - bh + 6; wy < H * .28; wy += 11) {
          for (let wx = x + 4; wx < x + bw * .65; wx += 9) {
            if (Math.floor(wx + wy) % 3 === 0) {
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
      }

      // Road
      const top = H * .27;
      poly([
        [W * .40, top], [W * .60, top],
        [W * 1.25, H], [-W * .25, H]
      ], "#333c47");

      for (let y = top; y < H; y += 4) {
        const r = road(y);
        ctx.fillStyle = Math.floor(y / 12) % 2 ?
          "#222c36" : "#252f39";
        ctx.fillRect(r.center - r.width / 2, y, r.width, 4);
      }

      // Road edges and lane markings
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let y = top; y <= H; y += 7) {
          const r = road(y);
          const x = r.center + side * r.width / 2;
          if (y === top) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "#d4e9f2";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (let divider = 0; divider < 2; divider++) {
        for (let i = 0; i < 13; i++) {
          const p = (i / 13 + roadTime / 800) % 1;
          const y = top + p * (H - top);
          const r = road(y);
          const x = r.center + (divider - .5) * r.width / 3;
          ctx.fillStyle = "#d7e4e9";
          ctx.fillRect(x - 1, y, 2 + p * 2, 4 + p * 22);
        }
      }

      // Roadside lights
      for (let i = 0; i < 7; i++) {
        const p = (i / 7 + roadTime / 1000) % 1;
        const y = top + p * (H - top);
        const r = road(y);

        for (const side of [-1, 1]) {
          const x = r.center + side * (r.width / 2 + 8 + p * 15);
          ctx.strokeStyle = "#93b4c9";
          ctx.lineWidth = 1 + p * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 24 * p);
          ctx.stroke();

          ctx.fillStyle = "#8af4ff";
          ctx.shadowColor = "#00dfff";
          ctx.shadowBlur = 12 * p;
          ctx.beginPath();
          ctx.arc(x, y - 24 * p, 2 + p * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    function drawCar(x, y, scale, color, isPlayer = false) {
      const cw = W * .105 * scale;
      const ch = cw * 1.7;

      ctx.save();
      ctx.translate(x, y);

      // Shadow
      ctx.fillStyle = "#0009";
      ctx.beginPath();
      ctx.ellipse(0, ch * .35, cw * .7, ch * .16,
        0, 0, Math.PI * 2);
      ctx.fill();

      // Wheels
      ctx.fillStyle = "#080b11";
      for (const side of [-1, 1]) {
        ctx.fillRect(side * cw * .4 - cw * .1,
          -ch * .18, cw * .22, ch * .25);
        ctx.fillRect(side * cw * .4 - cw * .1,
          ch * .15, cw * .22, ch * .23);
      }

      // Body
      poly([
        [-cw * .3, -ch * .5],
        [cw * .3, -ch * .5],
        [cw * .46, -ch * .22],
        [cw * .48, ch * .25],
        [cw * .32, ch * .47],
        [-cw * .32, ch * .47],
        [-cw * .48, ch * .25],
        [-cw * .46, -ch * .22]
      ], color);

      // Rear windshield
      poly([
        [-cw * .29, -ch * .24],
        [-cw * .2, -ch * .42],
        [cw * .2, -ch * .42],
        [cw * .29, -ch * .24],
        [cw * .31, -ch * .02],
        [-cw * .31, -ch * .02]
      ], "#142a3c");

      // Rear spoiler
      if (isPlayer) {
        ctx.fillStyle = "#111820";
        ctx.fillRect(-cw * .46, -ch * .04, cw * .92, ch * .04);
      }

      // Tail lights
      ctx.fillStyle = "#ff2346";
      ctx.shadowColor = "#ff163e";
      ctx.shadowBlur = isPlayer ? 12 : 5;
      ctx.fillRect(-cw * .38, ch * .25, cw * .23, ch * .07);
      ctx.fillRect(cw * .15, ch * .25, cw * .23, ch * .07);
      ctx.shadowBlur = 0;

      // Nitro flames
      if (isPlayer && nitroHeld && active && !paused) {
        for (const side of [-1, 1]) {
          poly([
            [side * cw * .19, ch * .44],
            [side * cw * .08, ch * .44],
            [side * cw * .14, ch * (.65 + Math.random() * .18)]
          ], Math.random() > .5 ? "#00eaff" : "#2385ff");
        }
      }

      ctx.restore();
    }

    function spawnCar() {
      const n = Math.floor(Math.random() * 3);
      if (traffic.some(c => c.lane === n && c.y < H * .43)) return;

      traffic.push({
        lane: n,
        y: H * .27,
        color: carColors[Math.floor(Math.random() * carColors.length)],
        speed: .75 + Math.random() * .55,
        passed: false
      });
    }

    function render() {
      drawWorld();

      traffic.sort((a, b) => a.y - b.y);
      for (const car of traffic) {
        const p = Math.max(0, Math.min(1,
          (car.y - H * .27) / (H * .73)));
        drawCar(laneX(car.lane, car.y),
          car.y, .22 + p * .8, car.color);
      }

      playerX += (laneX(lane, H * .79) - playerX) * .2;
      drawCar(playerX, H * .79, 1, "#00bfff", true);

      if (nitroHeld && active && !paused) {
        ctx.strokeStyle = "#4befff55";
        for (let i = 0; i < 12; i++) {
          const x = (i * 83 + roadTime * .7) % W;
          const y = (i * 137 + roadTime * 1.8) % H;
          ctx.lineWidth = 1 + i % 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 15 + i * 2);
          ctx.stroke();
        }
      }
    }

    function move(dir) {
      if (!active || paused) return;
      lane = Math.max(0, Math.min(2, lane + dir));
    }

    function update(dt) {
      if (!active || paused || ended) return;

      const boost = nitroHeld && nitro > 0;
      if (boost) nitro = Math.max(0, nitro - dt * .025);
      else nitro = Math.min(100, nitro + dt * .012);

      const factor = boost ? 1.7 : 1;
      speed = Math.round(120 + Math.min(score / 2, 90) +
        (boost ? 60 : 0));

      roadTime += dt * factor * (speed / 100);
      score += dt * .012 * factor;
      spawnTime += dt;

      if (spawnTime > Math.max(400, 900 - score * 1.3)) {
        spawnCar();
        spawnTime = 0;
      }

      const py = H * .79;

      for (const car of traffic) {
        car.y += dt * (.13 + car.speed * .13) * factor;

        if (!car.passed && car.y > py + 38) {
          car.passed = true;
          score += 10;
        }

        if (car.lane === lane && Math.abs(car.y - py) < 45) {
          endGame();
          return;
        }
      }

      traffic = traffic.filter(c => c.y < H + 100);

      scoreEl.textContent = Math.floor(score).toString();
      speedEl.textContent = speed;
      nitroFill.style.width = nitro + "%";
    }

    function startGame() {
      score = 0;
      speed = 120;
      nitro = 100;
      roadTime = 0;
      spawnTime = 0;
      traffic = [];
      lane = 1;
      playerX = laneX(1, H * .79);
      ended = false;
      paused = false;
      active = true;
      nitroHeld = false;

      $("pause").textContent = "Ⅱ";
      overlay.classList.add("hidden");
    }

    function endGame() {
      active = false;
      ended = true;
      nitroHeld = false;
      best = Math.max(best, Math.floor(score));

      heading.textContent = "RACE OVER";
      description.textContent =
        "Score: " + Math.floor(score) + " · Best: " + best;
      startBtn.textContent = "RACE AGAIN ↻";
      overlay.classList.remove("hidden");
    }

    function togglePause() {
      if (!active && !paused) return;

      paused = !paused;
      nitroHeld = false;
      $("pause").textContent = paused ? "▶" : "Ⅱ";

      if (paused) {
        heading.textContent = "PAUSED";
        description.textContent = "Ready when you are.";
        startBtn.textContent = "RESUME RACE ▶";
        overlay.classList.remove("hidden");
      } else {
        overlay.classList.add("hidden");
      }
    }

    startBtn.addEventListener("click", () => {
      if (paused && !ended) {
        paused = false;
        $("pause").textContent = "Ⅱ";
        overlay.classList.add("hidden");
      } else {
        startGame();
      }
    });

    $("pause").addEventListener("click", togglePause);
    $("left").addEventListener("pointerdown", e => {
      e.preventDefault();
      move(-1);
    });
    $("right").addEventListener("pointerdown", e => {
      e.preventDefault();
      move(1);
    });

    const boostButton = $("boost");

    boostButton.addEventListener("pointerdown", e => {
      e.preventDefault();
      nitroHeld = true;
      try { boostButton.setPointerCapture(e.pointerId); } catch (_) {}
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach(event => {
      boostButton.addEventListener(event, () => {
        nitroHeld = false;
      });
    });

    window.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") move(-1);
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") move(1);
      if (e.code === "Space") {
        e.preventDefault();
        nitroHeld = true;
      }
    });

    window.addEventListener("keyup", e => {
      if (e.code === "Space") nitroHeld = false;
    });

    // Swipe controls
    let touchX = 0, touchY = 0;
    canvas.addEventListener("touchstart", e => {
      const t = e.changedTouches[0];
      touchX = t.clientX;
      touchY = t.clientY;
    }, { passive: true });

    canvas.addEventListener("touchend", e => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;

      if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? 1 : -1);
      }
    }, { passive: true });

    function frame(time) {
      const dt = lastTime ? Math.min(time - lastTime, 40) : 16;
      lastTime = time;

      update(dt);
      render();
      requestAnimationFrame(frame);
    }

    resize();
    playerX = W / 2;
    requestAnimationFrame(frame);
    console.log("STREET RUSH initialized successfully");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGame, { once: true });
  } else {
    initGame();
  }
})();
