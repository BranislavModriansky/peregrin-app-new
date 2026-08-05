(function () {
    "use strict";

    // ================== TUNABLE CONSTANTS ==================
    const RINGS = 14;              // number of horizontal contour lines
    const SEGMENTS = 100;          // points per ring (smoothness)
    const COLOR = "rgba(145, 148, 162, 0.75)";
    const LINE_WIDTH = 1;

    const ORB_SIZE = 0.34;         // orb radius as fraction of min(viewport w,h)
    const Y_FLATTEN = 0.925;        // vertical squash of the sphere
    const TILT = 0.45;             // fake 3D tilt of rings

    // Base shape deformation (big, slow, water-drop-like undulation)
    const BASE_NOISE_SCALE = 2.25;  // spatial frequency of base deformation
    const BASE_DEFORM = 0.05;      // strength (small => stays orb-like)

    // Spurs (gentle smaller bumps, kept subtle so lines stay clean)
    const SPUR_NOISE_SCALE = 1.05; // higher = more, smaller spurs
    const SPUR_DEFORM = 0.125;     // spur height
    const SPUR_SIDE_POWER = 6.0;   // how tightly spurs stick to the sides
                                   // (1 = broad falloff, higher = only near the equator)

    const MORPH_SPEED = 0.00015;    // shape morphing speed
    const SCAN_SPEED = 0.000005;    // scan cycle speed
    const POLE_ACCEL = 0.5;        // 0 = linear scan, 1 = full "laser" easing
                                   // (lines move faster near top/bottom tips)
    const FADE_ZONE = 0.05;        // fraction of sphere near poles where lines fade out
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
        ) * 2 - 1; // -1 .. 1
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

        function draw(t) {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = COLOR;
            ctx.lineWidth = LINE_WIDTH;

            const cx = W / 2;
            const cy = H / 2;
            const baseR = Math.min(W, H) * ORB_SIZE;

            const morphT = t * MORPH_SPEED;
            const scanOffset = (t * SCAN_SPEED) % 1;

            for (let i = 0; i < RINGS; i++) {
                // uniform scan position, 0..1
                const u = (i / RINGS + 1 - scanOffset) % 1;

                // "laser" easing: slow in the middle, fast at the tips.
                // Linear u -> eased v via inverse-cosine mapping blended by POLE_ACCEL.
                const eased = Math.acos(1 - 2 * u) / Math.PI;
                const v = lerp(u, eased, POLE_ACCEL);

                const phi = v * Math.PI;
                const y0 = Math.cos(phi);
                const ringR = Math.sin(phi);
                if (ringR < 0.01) continue;

                // smooth fade near the poles
                const edge = Math.min(v, 1 - v);
                const alpha = Math.min(1, edge / FADE_ZONE);
                if (alpha <= 0) continue;

                ctx.globalAlpha = alpha;

                // spurs only on the sides: 1 at equator, 0 at the poles
                const sideWeight = Math.pow(ringR, SPUR_SIDE_POWER);

                ctx.beginPath();
                for (let j = 0; j <= SEGMENTS; j++) {
                    const theta = (j / SEGMENTS) * Math.PI * 2;
                    const sx = Math.cos(theta) * ringR;
                    const sz = Math.sin(theta) * ringR;

                    // large, gentle base undulation (water-drop feel)
                    const nBase = noise3(
                        sx * BASE_NOISE_SCALE + morphT,
                        y0 * BASE_NOISE_SCALE - morphT * 0.7,
                        sz * BASE_NOISE_SCALE + morphT * 0.5
                    );
                    // subtle smaller spurs
                    const nSpur = noise3(
                        sx * SPUR_NOISE_SCALE - morphT * 0.6,
                        y0 * SPUR_NOISE_SCALE + morphT,
                        sz * SPUR_NOISE_SCALE + morphT * 0.8
                    );

                    const r = 1 + nBase * BASE_DEFORM + nSpur * SPUR_DEFORM * sideWeight;

                    const px = cx + sx * r * baseR;
                    const py = cy - (y0 * Y_FLATTEN * r) * baseR + sz * r * baseR * TILT;

                    if (j === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

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