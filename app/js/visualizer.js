(function () {
  "use strict";

  const CFG = {
    fps: 15,                 // frame cap — biggest CPU saver
    resScale: 0.35,          // render at 35% res, CSS-upscaled
    particles: 260,          // smoke grains around the ring
    baseRadius: 0.25,        // ring radius (fraction of min viewport dim)
    ringSpread: 0.2,        // radial thickness of the smoke band
    drift: 0.00012,          // how fast grains wander (rad/ms)
    swirl: 0.000045,         // slow global rotation
    breathe: 0.00007,        // ring "breathing" speed
    color: [165, 180, 205],  // soft cool tone
    maxAlpha: 0.2,         // per-grain opacity — keep it faint.
  };

  // --- Canvas setup ----------------------------------------------------------
  function makeCanvas() {
    const c = document.createElement("canvas");
    Object.assign(c.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "-1",
      pointerEvents: "none",
      filter: "blur(1px)",   // upscale + blur = smooth smoke for free
      opacity: "0.95",
    });
    c.className = "peregrin-bg-visualizer";
    document.body.appendChild(c);
    return c;
  }

  // Pre-render ONE soft particle sprite. Drawing a cached bitmap per grain is
  // ~10x cheaper than creating radial gradients every frame.
  function makeSprite([r, g, b]) {
    const s = document.createElement("canvas");
    const size = 32;
    s.width = s.height = size;
    const sctx = s.getContext("2d");
    const grad = sctx.createRadialGradient(
      size / 2, size / 2, 0, size / 2, size / 2, size / 2
    );
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
    return s;
  }

  function start() {
    if (document.querySelector(".peregrin-bg-visualizer")) return;

    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d", { alpha: true });
    const sprite = makeSprite(CFG.color);

    let W = 0, H = 0, cx = 0, cy = 0, R = 0;

    function resize() {
      W = Math.max(1, Math.floor(window.innerWidth * CFG.resScale));
      H = Math.max(1, Math.floor(window.innerHeight * CFG.resScale));
      canvas.width = W;
      canvas.height = H;
      cx = W / 2;
      cy = H / 2;
      R = Math.min(W, H) * CFG.baseRadius;
    }
    window.addEventListener("resize", resize, { passive: true });
    resize();

    // --- Grains: each lives on the ring with its own slow wander phases -----
    const grains = Array.from({ length: CFG.particles }, () => ({
      angle: Math.random() * Math.PI * 2,        // position on the ring
      radialOff: (Math.random() - 0.5) * 2,      // -1..1 band offset
      p1: Math.random() * Math.PI * 2,           // wander phases
      p2: Math.random() * Math.PI * 2,
      p3: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random(),                // individual tempo
      size: 0.4 + Math.random() * 1.1,           // grain scale
      alpha: 0.3 + Math.random() * 0.7,          // grain brightness
    }));

    const frameInterval = 1000 / CFG.fps;
    let last = 0;
    let running = true;

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      if (now - last < frameInterval) return;
      last = now;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter"; // grains add up like smoke

      const rot = now * CFG.swirl;
      // Whole-ring breathing: gentle expansion/contraction like a membrane.
      const breathe = 1 + 0.05 * Math.sin(now * CFG.breathe);
      const band = R * CFG.ringSpread;
      const spriteSize = Math.max(10, R * 0.22);

      for (let i = 0; i < grains.length; i++) {
        const gr = grains[i];
        const t = now * CFG.drift * gr.speed;

        // Layered sines = organic, non-repeating-looking wander.
        const wobbleA = Math.sin(t + gr.p1) * 0.25 + Math.sin(t * 0.37 + gr.p2) * 0.15;
        const wobbleR = Math.sin(t * 0.61 + gr.p3) * 0.8;

        const a = gr.angle + rot + wobbleA;
        // Asymmetric bulge → slightly "cellular" silhouette, not a perfect circle.
        const bulge = 1 + 0.10 * Math.sin(a * 3 + now * 0.00005) *
                          Math.sin(a * 2 - now * 0.00008);
        const rad = (R * breathe * bulge) + band * (gr.radialOff + wobbleR);

        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;

        // Grains fade in/out slowly so the texture keeps evolving.
        const flicker = 0.5 + 0.5 * Math.sin(t * 0.8 + gr.p2);
        ctx.globalAlpha = CFG.maxAlpha * gr.alpha * flicker;

        const s = spriteSize * gr.size;
        ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    requestAnimationFrame(frame);

    // Zero CPU when tab is hidden.
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) {
        last = 0;
        requestAnimationFrame(frame);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();