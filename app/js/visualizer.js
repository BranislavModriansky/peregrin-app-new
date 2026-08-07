(function () {
    "use strict";

    // ================== TUNABLE CONSTANTS ==================
    let rings = 8;
    let segments = 40;
    const COLOR_FALLBACK = "145, 148, 162"; // used if --orb-color is not defined
    const LINE_WIDTH = 1;

    let orbSize = 0.0225;
    const Y_FLATTEN = 0.95;
    const TILT_MIN = 0.25;
    const TILT_MAX = 0.45;
    const TILT_EASE = 0.0025;
    const ROLL_MAX = 0.1;

    // Base shape deformation
    const BASE_NOISE_SCALE = 2.25;
    const BASE_DEFORM = 0.005;

    // Spurs
    const SPUR_NOISE_SCALE = 1.85;
    const SPUR_DEFORM = 0.075;
    const SPUR_SIDE_POWER = 6.5;

    const MORPH_SPEED = 0.00015;
    const SCAN_SPEED = 0.00001;
    const POLE_ACCEL = 0.6;
    const FADE_ZONE = 0.05;

    // ---- Fancy extras (kept) ----
    let trailFade = 0.08;      // motion-trail persistence (lower = longer ghost trails)
    let lineWidth = LINE_WIDTH;
    let depthBuckets = 7;      // depth quantization levels
    let dprCap = 2;
    const DEPTH_DIM = 0.65;
    const DEPTH_THIN = 0;

    // ---- Position controls ----
    // "screen": position as % of screen width/height (POS_X / POS_Y)
    // "title":  position relative to the navbar title element,
    //           offset in rem (TITLE_OFFSET_X / TITLE_OFFSET_Y)
    // "off":    don't draw the orb at all (canvas is not created)
    let POS_MODE = "screen";
    const POS_X = 52.5;             // % of viewport width  (screen mode)
    const POS_Y = 50;             // % of viewport height (screen mode)
    let zIndex = 10;             // CSS z-index of the canvas (screen mode)
    const TITLE_SELECTOR = ".navbar-brand .app-title, .navbar-brand";
    const TITLE_ANCHOR = "center"; // "center" | "top" | "bottom" of the title
    const TITLE_OFFSET_X = 4.75;   // rem, added to the title anchor
    const TITLE_OFFSET_Y = 0.1;    // rem, added to the title anchor

    // Order used when cycling modes via the toggle button.
    const MODE_CYCLE = ["screen", "title", "off"];

    // Applies mode-dependent geometry for the *current* POS_MODE.
    function applyModeGeometry() {
        if (POS_MODE === "screen") {
            segments = 100;
            rings = 14;
            orbSize = 0.35;
            zIndex = 0;   // was -1: body's opaque background covered the canvas
            trailFade = 0.08;
            lineWidth = 1;
            depthBuckets = 7;
            dprCap = 2;
        } else {
            segments = 24;
            rings = 8;
            orbSize = 0.0225;
            zIndex = 10;
            trailFade = 0.5;      // no trails at tiny size — they just look like dirt
            lineWidth = 1;    // thinner strokes scale better on a small orb
            depthBuckets = 4;   // fewer buckets = fewer strokes, still smooth when tiny
            dprCap = 3;         // crisper on high-DPI screens; canvas area is tiny anyway
        }
    }
    applyModeGeometry();
    // ========================================================

    // ---------- Simple 3D value noise ----------
    const PERM = new Uint8Array(512);
    (function seedPerm() {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        let s = 1337;
        const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
    })();

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function hash3(x, y, z) {
        return PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 255;
    }
    function noise3(x, y, z) {
        const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        const xf = x - xi, yf = y - yi, zf = z - zi;
        const u = fade(xf), v = fade(yf), w = fade(zf);
        const n000 = hash3(xi, yi, zi),       n100 = hash3(xi + 1, yi, zi);
        const n010 = hash3(xi, yi + 1, zi),   n110 = hash3(xi + 1, yi + 1, zi);
        const n001 = hash3(xi, yi, zi + 1),   n101 = hash3(xi + 1, yi, zi + 1);
        const n011 = hash3(xi, yi + 1, zi + 1), n111 = hash3(xi + 1, yi + 1, zi + 1);
        return lerp(
            lerp(lerp(n000, n100, u), lerp(n010, n110, u), v),
            lerp(lerp(n001, n101, u), lerp(n011, n111, u), v),
            w
        ) * 2 - 1;
    }

    // ---------- Canvas setup ----------
    let running = false;   // whether an animation loop is active
    let teardown = null;   // cleanup function for the current instance

    function init() {
        if (running) return;
        if (POS_MODE === "off") return; // orb disabled — don't create the canvas
        running = true;

        const canvas = document.createElement("canvas");
        canvas.id = "orb-background";
        Object.assign(canvas.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            zIndex: zIndex,
            pointerEvents: "none",
        });
        document.body.prepend(canvas);
        const ctx = canvas.getContext("2d");

        let rafId = 0;
        let W, H, DPR;
        function resize() {
            DPR = Math.min(window.devicePixelRatio || 1, dprCap);
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W * DPR;
            canvas.height = H * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
        window.addEventListener("resize", resize);
        resize();

        // Theme-aware color: read --orb-color from CSS, refresh on theme change
        let colorRGB = COLOR_FALLBACK;
        let colorCheckFrames = 0; // frames left to keep re-checking after a DOM change

        function updateColor() {
            const v = getComputedStyle(document.documentElement)
                .getPropertyValue("--orb-color").trim();
            colorRGB = v || COLOR_FALLBACK;
        }
        updateColor();

        // The theme is swapped by injecting/replacing <style> elements (Shiny's
        // dynamic_theme output), so watch the whole document for style/link
        // changes and attribute flips, then re-read the CSS variable.
        const themeObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                // Attribute change on html/body (e.g. data-bs-theme from dark mode toggle)
                if (m.type === "attributes") { colorCheckFrames = 30; return; }
                // Style/link elements added, removed, or their text changed
                const nodes = [...m.addedNodes, ...m.removedNodes];
                if (m.type === "characterData" ||
                    nodes.some(n => n.nodeName === "STYLE" || n.nodeName === "LINK")) {
                    colorCheckFrames = 30;
                    return;
                }
            }
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "data-bs-theme", "data-theme"],
            childList: true,
            subtree: true,
            characterData: true,
        });

        let targetTilt = 0.35, tilt = 0.35;
        let targetRoll = 0, roll = 0;
        window.addEventListener("mousemove", (e) => {
            const yNorm = e.clientY / window.innerHeight;
            targetTilt = TILT_MIN + (TILT_MAX - TILT_MIN) * yNorm;
            const xNorm = e.clientX / window.innerWidth;
            targetRoll = (xNorm * 2 - 1) * ROLL_MAX;
        });

        // Precompute per-segment trig (constant across frames & rings)
        const cosTheta = new Float32Array(segments + 1);
        const sinTheta = new Float32Array(segments + 1);
        for (let j = 0; j <= segments; j++) {
            const theta = (j / segments) * Math.PI * 2;
            cosTheta[j] = Math.cos(theta);
            sinTheta[j] = Math.sin(theta);
        }

        // Precompute stroke styles / widths per depth bucket
        const bucketStyle = new Array(depthBuckets);
        const bucketWidth = new Float32Array(depthBuckets);
        for (let b = 0; b < depthBuckets; b++) {
            const depth = (b + 0.5) / depthBuckets;
            bucketWidth[b] = lineWidth * (1 - DEPTH_THIN * (1 - depth));
        }

        // Reusable point buffers (avoid per-frame allocation)
        const ptsX = new Float32Array(segments + 1);
        const ptsY = new Float32Array(segments + 1);
        const ptsBucket = new Uint8Array(segments + 1);

        // ---- Orb center resolution (cached, refreshed on resize) ----
        let centerX = W / 2, centerY = H / 2;
        let centerCheckFrames = 5; // re-resolve for a few frames on startup/resize

        function resolveCenter() {
            if (POS_MODE === "title") {   // was "screen" — inverted logic
                const el = document.querySelector(TITLE_SELECTOR);
                if (el) {
                    const rem = parseFloat(
                        getComputedStyle(document.documentElement).fontSize
                    ) || 16;
                    const r = el.getBoundingClientRect();
                    let ax = r.left + r.width / 2;
                    let ay = TITLE_ANCHOR === "top" ? r.top
                           : TITLE_ANCHOR === "bottom" ? r.bottom
                           : r.top + r.height / 2;
                    centerX = ax + TITLE_OFFSET_X * rem;
                    centerY = ay + TITLE_OFFSET_Y * rem;
                    return;
                }
                // fall through to absolute if title not found
            }
            centerX = (POS_X / 100) * W;
            centerY = (POS_Y / 100) * H;
        }
        window.addEventListener("resize", () => { centerCheckFrames = 5; });

        function draw(t) {
            // Re-read the theme color for a few frames after any style change
            // (covers CSS that applies asynchronously after DOM mutation)
            if (colorCheckFrames > 0) {
                colorCheckFrames--;
                updateColor();
            }
            if (centerCheckFrames > 0) {
                centerCheckFrames--;
                resolveCenter();
            }

            tilt += (targetTilt - tilt) * TILT_EASE;
            roll += (targetRoll - roll) * TILT_EASE;
            const cosR = Math.cos(roll);
            const sinR = Math.sin(roll);

            const cx = centerX;
            const cy = centerY;
            const baseR = Math.min(W, H) * orbSize;

            // Clear/fade only the region the orb occupies
            const pad = baseR * 1.4 + 4;
            if (trailFade >= 1) {
                ctx.clearRect(cx - pad, cy - pad, pad * 2, pad * 2);
            } else {
                ctx.globalCompositeOperation = "destination-out";
                ctx.fillStyle = `rgba(0, 0, 0, ${trailFade})`;
                ctx.fillRect(cx - pad, cy - pad, pad * 2, pad * 2);
                ctx.globalCompositeOperation = "source-over";
            }

            const morphT = t * MORPH_SPEED;
            const scanOffset = (t * SCAN_SPEED) % 1;

            for (let i = 0; i < rings; i++) {
                const u = (i / rings + 1 - scanOffset) % 1;
                const eased = Math.acos(1 - 2 * u) / Math.PI;
                const v = lerp(u, eased, POLE_ACCEL);

                const phi = v * Math.PI;
                const y0 = Math.cos(phi);
                const ringR = Math.sin(phi);
                if (ringR < 0.01) continue;

                const edge = Math.min(v, 1 - v);
                const ringAlpha = Math.min(1, edge / FADE_ZONE);
                if (ringAlpha <= 0) continue;

                const sideWeight = Math.pow(ringR, SPUR_SIDE_POWER);
                const invRingR = 1 / ringR;

                // Pass 1: compute all points + their depth bucket
                for (let j = 0; j <= segments; j++) {
                    const sx = cosTheta[j] * ringR;
                    const sz = sinTheta[j] * ringR;

                    const nBase = noise3(
                        sx * BASE_NOISE_SCALE + morphT,
                        y0 * BASE_NOISE_SCALE - morphT * 0.7,
                        sz * BASE_NOISE_SCALE + morphT * 0.5
                    );
                    const nSpur = noise3(
                        sx * SPUR_NOISE_SCALE - morphT * 0.6,
                        y0 * SPUR_NOISE_SCALE + morphT,
                        sz * SPUR_NOISE_SCALE + morphT * 0.8
                    );

                    const r = 1 + nBase * BASE_DEFORM + nSpur * SPUR_DEFORM * sideWeight;

                    const dx = sx * r * baseR;
                    const dy = -(y0 * Y_FLATTEN * r) * baseR + sz * r * baseR * tilt;

                    ptsX[j] = cx + dx * cosR - dy * sinR;
                    ptsY[j] = cy + dx * sinR + dy * cosR;

                    const depth = (sz * invRingR + 1) * 0.5; // 0 back .. 1 front
                    let b = (depth * depthBuckets) | 0;
                    if (b >= depthBuckets) b = depthBuckets - 1;
                    ptsBucket[j] = b;
                }

                // Pass 2: one stroke per depth bucket
                for (let b = 0; b < depthBuckets; b++) {
                    const depth = (b + 0.5) / depthBuckets;
                    const a = 0.85 * ringAlpha * (1 - DEPTH_DIM * (1 - depth));
                    if (a <= 0.01) continue;

                    ctx.strokeStyle = `rgba(${colorRGB}, ${a.toFixed(3)})`;
                    ctx.lineWidth = bucketWidth[b];
                    ctx.beginPath();
                    let open = false;
                    for (let j = 1; j <= segments; j++) {
                        if (ptsBucket[j] === b) {
                            if (!open) {
                                ctx.moveTo(ptsX[j - 1], ptsY[j - 1]);
                                open = true;
                            }
                            ctx.lineTo(ptsX[j], ptsY[j]);
                        } else {
                            open = false;
                        }
                    }
                    ctx.stroke();
                }
            }

            requestAnimationFrame(draw);
        }
        rafId = requestAnimationFrame(draw);

        // Save a teardown for when the mode changes.
        teardown = function () {
            running = false;
            cancelAnimationFrame(rafId);
            themeObserver.disconnect();
            canvas.remove();
        };
    }

    // Public: switch to an explicit mode, rebuilding the canvas.
    function setMode(mode) {
        if (!MODE_CYCLE.includes(mode)) return;
        POS_MODE = mode;
        applyModeGeometry();
        if (teardown) { teardown(); teardown = null; }
        init(); // no-op if mode is "off"
    }

    // Public: advance to the next mode in the cycle.
    function cycleMode() {
        const i = MODE_CYCLE.indexOf(POS_MODE);
        setMode(MODE_CYCLE[(i + 1) % MODE_CYCLE.length]);
    }

    // Expose a small control surface for external triggers (e.g. Shiny).
    window.OrbVisualizer = { setMode, cycleMode, getMode: () => POS_MODE };

    // React to Shiny custom messages, if Shiny is present.
    function registerShiny() {
        if (window.Shiny && Shiny.addCustomMessageHandler) {
            Shiny.addCustomMessageHandler("orb_set_mode", (msg) => {
                if (msg && typeof msg.mode === "string") setMode(msg.mode);
                else cycleMode();
            });
        }
    }
    if (window.Shiny) registerShiny();
    else document.addEventListener("shiny:connected", registerShiny);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();