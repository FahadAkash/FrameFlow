/* ================================================================
   FrameFlow — Landing Page JavaScript
   Handles: Nav scroll, mobile menu, scroll-reveal, animated
   bezier curve canvases, and smooth interactions.
   ================================================================ */

(function () {
    "use strict";

    // ---- Nav scroll effect ----
    var nav = document.getElementById("nav");
    window.addEventListener("scroll", function () {
        nav.classList.toggle("scrolled", window.scrollY > 40);
    });

    // ---- Mobile menu toggle ----
    var toggle = document.getElementById("mobileToggle");
    var links = document.getElementById("navLinks");
    toggle.addEventListener("click", function () {
        links.classList.toggle("open");
    });
    // Close on link click
    links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { links.classList.remove("open"); });
    });

    // ---- Scroll reveal ----
    var reveals = document.querySelectorAll("[data-reveal]");
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("revealed");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -60px 0px" });
    reveals.forEach(function (el) { observer.observe(el); });

    // ---- Animated Bezier Curve (Hero Canvas) ----
    var heroCanvas = document.getElementById("heroCanvas");
    if (heroCanvas) { drawAnimatedCurve(heroCanvas, true); }

    var featureCanvas = document.getElementById("featureCurveCanvas");
    if (featureCanvas) { drawAnimatedCurve(featureCanvas, false); }

    function drawAnimatedCurve(canvas, animated) {
        var ctx = canvas.getContext("2d");
        var dpr = window.devicePixelRatio || 1;
        var w = canvas.width;
        var h = canvas.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.scale(dpr, dpr);

        var pad = 40;
        var gw = w - pad * 2;
        var gh = h - pad * 2;

        // Bezier control points (normalized 0-1)
        var cp = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
        var targetCp = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };

        // Preset cycle for animation
        var presets = [
            { x1: 0.42, y1: 0, x2: 0.58, y2: 1, name: "Ease In-Out" },
            { x1: 0.0, y1: 0.8, x2: 0.2, y2: 1.4, name: "Overshoot" },
            { x1: 0.68, y1: -0.55, x2: 0.27, y2: 1.55, name: "Elastic" },
            { x1: 0.22, y1: 1, x2: 0.36, y2: 1, name: "Ease Out" },
            { x1: 0.85, y1: 0, x2: 0.15, y2: 1, name: "Snap" }
        ];
        var presetIndex = 0;
        var morphProgress = 1;

        // Update preset label in mockup
        var presetEls = document.querySelectorAll(".mp");

        function lerpVal(a, b, t) { return a + (b - a) * t; }

        function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

        function graphX(t) { return pad + t * gw; }
        function graphY(v) { return pad + (1 - v) * gh; }

        function cubicBezier(t, p1, p2) {
            // Simple cubic bezier Y for given T (approximate via sampling)
            var x0 = 0, y0 = 0, x3 = 1, y3 = 1;
            var cx = 3 * p1, bx = 3 * (p2 - p1) - cx, ax = 1 - cx - bx;
            var cy = 3 * cp.y1, by = 3 * (cp.y2 - cp.y1) - cy, ay = 1 - cy - by;
            return ((ay * t + by) * t + cy) * t;
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);

            // Grid
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.lineWidth = 1;
            for (var i = 0; i <= 4; i++) {
                var gx = pad + (i / 4) * gw;
                var gy = pad + (i / 4) * gh;
                ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, pad + gh); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(pad + gw, gy); ctx.stroke();
            }

            // Axis labels
            ctx.font = "10px 'Inter', sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.textAlign = "center";
            ctx.fillText("0", pad, pad + gh + 16);
            ctx.fillText("1", pad + gw, pad + gh + 16);
            ctx.textAlign = "right";
            ctx.fillText("0", pad - 8, pad + gh + 4);
            ctx.fillText("1", pad - 8, pad + 4);

            // Diagonal reference
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(graphX(0), graphY(0));
            ctx.lineTo(graphX(1), graphY(1));
            ctx.stroke();
            ctx.setLineDash([]);

            // Control point handles
            var hx1 = graphX(cp.x1), hy1 = graphY(cp.y1);
            var hx2 = graphX(cp.x2), hy2 = graphY(cp.y2);

            // Handle lines
            ctx.strokeStyle = "rgba(232,145,45,0.4)";
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(graphX(0), graphY(0)); ctx.lineTo(hx1, hy1); ctx.stroke();
            ctx.strokeStyle = "rgba(232,145,45,0.4)";
            ctx.beginPath(); ctx.moveTo(graphX(1), graphY(1)); ctx.lineTo(hx2, hy2); ctx.stroke();

            // The bezier curve
            ctx.strokeStyle = "#5daee8";
            ctx.lineWidth = 2.5;
            ctx.shadowColor = "rgba(93,174,232,0.4)";
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(graphX(0), graphY(0));
            ctx.bezierCurveTo(hx1, hy1, hx2, hy2, graphX(1), graphY(1));
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Endpoint dots
            ctx.fillStyle = "#5daee8";
            ctx.beginPath(); ctx.arc(graphX(0), graphY(0), 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(graphX(1), graphY(1), 5, 0, Math.PI * 2); ctx.fill();

            // Handle dots
            ctx.fillStyle = "#e8912d";
            ctx.beginPath(); ctx.arc(hx1, hy1, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "rgba(232,145,45,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(hx1, hy1, 10, 0, Math.PI * 2); ctx.stroke();

            ctx.fillStyle = "#e8912d";
            ctx.beginPath(); ctx.arc(hx2, hy2, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "rgba(232,145,45,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(hx2, hy2, 10, 0, Math.PI * 2); ctx.stroke();

            // Moving dot along the curve
            if (animated) {
                var animT = (Date.now() % 3000) / 3000;
                var eased = animT;
                // Parametric cubic bezier approximation
                var t = animT;
                var mt = 1 - t;
                var bx = 3 * mt * mt * t * cp.x1 + 3 * mt * t * t * cp.x2 + t * t * t;
                var by = 3 * mt * mt * t * cp.y1 + 3 * mt * t * t * cp.y2 + t * t * t;
                ctx.fillStyle = "#fff";
                ctx.shadowColor = "rgba(255,255,255,0.5)";
                ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(graphX(bx), graphY(by), 4, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        function animate() {
            if (animated) {
                // Morph between presets
                if (morphProgress >= 1) {
                    morphProgress = 0;
                    presetIndex = (presetIndex + 1) % presets.length;
                    targetCp = presets[presetIndex];
                    // Update UI labels
                    if (presetEls.length) {
                        presetEls.forEach(function (el) { el.classList.remove("active"); });
                        if (presetEls[presetIndex % presetEls.length]) {
                            presetEls[presetIndex % presetEls.length].classList.add("active");
                        }
                    }
                }
                morphProgress += 0.004;
                var ease = easeInOutCubic(Math.min(morphProgress, 1));
                cp.x1 = lerpVal(cp.x1, targetCp.x1, ease * 0.08);
                cp.y1 = lerpVal(cp.y1, targetCp.y1, ease * 0.08);
                cp.x2 = lerpVal(cp.x2, targetCp.x2, ease * 0.08);
                cp.y2 = lerpVal(cp.y2, targetCp.y2, ease * 0.08);
            }

            draw();
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ---- Smooth anchor scroll ----
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
            var target = document.querySelector(a.getAttribute("href"));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
})();
