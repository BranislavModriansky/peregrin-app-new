(function () {
    "use strict";

    // ================== TUNABLE CONSTANTS ==================
    const RINGS = 14;
    const SEGMENTS = 100;
    const COLOR_FALLBACK = "145, 148, 162"; // used if --orb-color is not defined
    const LINE_WIDTH = 1;

    const ORB_SIZE = 0.34;
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
    const TRAIL_FADE = 0.08;   // motion-trail persistence (lower = longer ghost trails)
    const DEPTH_DIM = 0.65;    // how much the "far" side of a ring dims (0..1)
    const DEPTH_THIN = 0;    // how much line width thins on the far side
    const DEPTH_BUCKETS = 7;   // depth quantization levels (fewer = faster, more = smoother)
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
    function init() {
        const canvas = document.createElement("canvas");
        canvas.id = "orb-background";
        Object.assign(canvas.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            zIndex: "-1",
            pointerEvents: "none",
        });
        document.body.prepend(canvas);
        const ctx = canvas.getContext("2d");

        let W, H, DPR;
        function resize() {
            DPR = Math.min(window.devicePixelRatio || 1, 2);
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
        const cosTheta = new Float32Array(SEGMENTS + 1);
        const sinTheta = new Float32Array(SEGMENTS + 1);
        for (let j = 0; j <= SEGMENTS; j++) {
            const theta = (j / SEGMENTS) * Math.PI * 2;
            cosTheta[j] = Math.cos(theta);
            sinTheta[j] = Math.sin(theta);
        }

        // Precompute stroke styles / widths per depth bucket
        const bucketStyle = new Array(DEPTH_BUCKETS);
        const bucketWidth = new Float32Array(DEPTH_BUCKETS);
        for (let b = 0; b < DEPTH_BUCKETS; b++) {
            const depth = (b + 0.5) / DEPTH_BUCKETS; // 0 back .. 1 front
            bucketWidth[b] = LINE_WIDTH * (1 - DEPTH_THIN * (1 - depth));
        }

        // Reusable point buffers (avoid per-frame allocation)
        const ptsX = new Float32Array(SEGMENTS + 1);
        const ptsY = new Float32Array(SEGMENTS + 1);
        const ptsBucket = new Uint8Array(SEGMENTS + 1);

        function draw(t) {
            // Re-read the theme color for a few frames after any style change
            // (covers CSS that applies asynchronously after DOM mutation)
            if (colorCheckFrames > 0) {
                colorCheckFrames--;
                updateColor();
            }

            tilt += (targetTilt - tilt) * TILT_EASE;
            roll += (targetRoll - roll) * TILT_EASE;
            const cosR = Math.cos(roll);
            const sinR = Math.sin(roll);

            // Motion trails: fade previous frame instead of clearing it
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = `rgba(0, 0, 0, ${TRAIL_FADE})`;
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = "source-over";

            const cx = W / 2;
            const cy = H / 2;
            const baseR = Math.min(W, H) * ORB_SIZE;

            const morphT = t * MORPH_SPEED;
            const scanOffset = (t * SCAN_SPEED) % 1;

            for (let i = 0; i < RINGS; i++) {
                const u = (i / RINGS + 1 - scanOffset) % 1;
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
                for (let j = 0; j <= SEGMENTS; j++) {
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
                    let b = (depth * DEPTH_BUCKETS) | 0;
                    if (b >= DEPTH_BUCKETS) b = DEPTH_BUCKETS - 1;
                    ptsBucket[j] = b;
                }

                // Pass 2: one stroke per depth bucket (few state changes,
                // few stroke() calls) instead of per-segment strokes
                for (let b = 0; b < DEPTH_BUCKETS; b++) {
                    const depth = (b + 0.5) / DEPTH_BUCKETS;
                    const a = 0.85 * ringAlpha * (1 - DEPTH_DIM * (1 - depth));
                    if (a <= 0.01) continue;

                    ctx.strokeStyle = `rgba(${colorRGB}, ${a.toFixed(3)})`;
                    ctx.lineWidth = bucketWidth[b];
                    ctx.beginPath();
                    let open = false;
                    for (let j = 1; j <= SEGMENTS; j++) {
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
        requestAnimationFrame(draw);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();