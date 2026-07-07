/*
 * bezier.js — cubic-bezier easing evaluation (CSS timing-function semantics).
 *
 * A curve is defined by two control points (x1,y1) and (x2,y2). Anchors are
 * fixed at (0,0) and (1,1). ease(x) solves the parametric curve for the y
 * that corresponds to a given progress x in [0,1] using Newton-Raphson with a
 * bisection fallback — the same technique browsers use for cubic-bezier().
 */
(function (root) {
    "use strict";

    function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
    function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
    function C(a1) { return 3.0 * a1; }

    // x(t) for a given parameter t
    function calcBezier(t, a1, a2) {
        return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
    }
    // dx/dt
    function slope(t, a1, a2) {
        return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
    }

    function solveT(x, x1, x2) {
        if (x1 === x2 && x2 === undefined) return x;
        var t = x;
        // Newton-Raphson
        for (var i = 0; i < 8; i++) {
            var currentSlope = slope(t, x1, x2);
            if (currentSlope === 0.0) break;
            var currentX = calcBezier(t, x1, x2) - x;
            t -= currentX / currentSlope;
        }
        // Bisection fallback to guarantee we stay in range
        var lo = 0.0, hi = 1.0;
        t = x;
        if (t < lo) return lo;
        if (t > hi) return hi;
        for (var j = 0; j < 20; j++) {
            var cx = calcBezier(t, x1, x2);
            if (Math.abs(cx - x) < 1e-6) return t;
            if (x > cx) lo = t; else hi = t;
            t = (lo + hi) * 0.5;
        }
        return t;
    }

    /**
     * Cubic bezier easing.
     * @param {number[]} cp - [x1, y1, x2, y2]
     * @returns {function(number):number} ease(x) -> y
     */
    function CubicBezier(cp) {
        var x1 = cp[0], y1 = cp[1], x2 = cp[2], y2 = cp[3];
        return function ease(x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            var t = solveT(x, x1, x2);
            return calcBezier(t, y1, y2);
        };
    }

    /**
     * Sample the curve into N+1 evenly-time-spaced points.
     * @returns {Array<{t:number, v:number}>} where t and v are 0..1
     */
    function sampleCurve(cp, steps) {
        steps = steps || 40;
        var ease = CubicBezier(cp);
        var out = [];
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            out.push({ t: t, v: ease(t) });
        }
        return out;
    }

    /** Normalized velocity (dv/dt) sampled across time, scaled so peak ~= 1. */
    function sampleVelocity(cp, steps) {
        steps = steps || 40;
        var ease = CubicBezier(cp);
        var raw = [];
        var prev = ease(0);
        var maxV = 1e-9;
        for (var i = 1; i <= steps; i++) {
            var t = i / steps;
            var v = ease(t);
            var dv = (v - prev) * steps; // dv/dt
            raw.push({ t: t - 0.5 / steps, v: dv });
            if (dv > maxV) maxV = dv;
            prev = v;
        }
        return { points: raw, peak: maxV };
    }

    var api = {
        CubicBezier: CubicBezier,
        sampleCurve: sampleCurve,
        sampleVelocity: sampleVelocity
    };

    root.Bezier = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
