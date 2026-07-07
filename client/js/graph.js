/*
 * graph.js — the interactive bezier graph editor.
 *
 * Model: a cubic bezier with anchors fixed at (0,0) and (1,1) and two
 * draggable control points P1=(x1,y1), P2=(x2,y2). This is the same object
 * an AE editor shapes; "Value" and "Speed" are just two views of it:
 *   - Value view  -> position over time  (the ease curve itself)
 *   - Speed view  -> velocity over time  (its derivative)
 * Both views edit the same two control points, so the handles stay consistent.
 */
(function (root) {
    "use strict";

    var Y_MIN = -0.6, Y_MAX = 1.6; // display window; allows overshoot/anticipation
    var PAD = { l: 34, r: 20, t: 22, b: 30 };
    var HIT = 14;

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    function GraphEditor(canvas, opts) {
        opts = opts || {};
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.cp = (opts.cp || [0.42, 0.0, 0.58, 1.0]).slice();
        this.mode = "value";
        this.onChange = opts.onChange || function () {};
        this.dragging = null;
        this.dpr = window.devicePixelRatio || 1;
        this._bindEvents();
        this.resize();
    }

    GraphEditor.prototype.setCp = function (cp) {
        this.cp = cp.slice();
        this.render();
        this.onChange(this.cp, this.mode);
    };

    GraphEditor.prototype.setMode = function (mode) {
        this.mode = mode;
        this.render();
    };

    GraphEditor.prototype.resize = function () {
        var rect = this.canvas.getBoundingClientRect();
        var w = rect.width || this.canvas.width;
        var h = (w * 300) / 560; // keep authoring aspect ratio
        this.canvas.style.height = h + "px";
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.W = w;
        this.H = h;
        this.render();
    };

    // ---- coordinate mapping -------------------------------------------------
    GraphEditor.prototype.plot = function () {
        return { x: PAD.l, y: PAD.t, w: this.W - PAD.l - PAD.r, h: this.H - PAD.t - PAD.b };
    };
    GraphEditor.prototype.toPx = function (cx, cy) {
        var p = this.plot();
        return {
            x: p.x + cx * p.w,
            y: p.y + (1 - (cy - Y_MIN) / (Y_MAX - Y_MIN)) * p.h
        };
    };
    GraphEditor.prototype.fromPx = function (px, py) {
        var p = this.plot();
        return {
            x: (px - p.x) / p.w,
            y: Y_MIN + (1 - (py - p.y) / p.h) * (Y_MAX - Y_MIN)
        };
    };

    // ---- events -------------------------------------------------------------
    GraphEditor.prototype._localPt = function (e) {
        var rect = this.canvas.getBoundingClientRect();
        var t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };

    GraphEditor.prototype._hitHandle = function (pt) {
        var h1 = this.toPx(this.cp[0], this.cp[1]);
        var h2 = this.toPx(this.cp[2], this.cp[3]);
        if (Math.hypot(pt.x - h1.x, pt.y - h1.y) <= HIT) return 1;
        if (Math.hypot(pt.x - h2.x, pt.y - h2.y) <= HIT) return 2;
        return 0;
    };

    GraphEditor.prototype._bindEvents = function () {
        var self = this;
        var down = function (e) {
            var pt = self._localPt(e);
            var h = self._hitHandle(pt);
            if (h) { self.dragging = h; e.preventDefault(); }
        };
        var move = function (e) {
            if (!self.dragging) {
                var pt0 = self._localPt(e);
                self.canvas.style.cursor = self._hitHandle(pt0) ? "grab" : "crosshair";
                return;
            }
            e.preventDefault();
            var pt = self._localPt(e);
            var c = self.fromPx(pt.x, pt.y);
            var free = e.shiftKey;
            var x = clamp(c.x, 0, 1);
            // snap x to 0/1 near the edges unless Shift is held
            if (!free) {
                if (x < 0.03) x = 0;
                if (x > 0.97) x = 1;
            }
            var y = free ? c.y : clamp(c.y, Y_MIN, Y_MAX);
            if (self.dragging === 1) { self.cp[0] = x; self.cp[1] = y; }
            else { self.cp[2] = x; self.cp[3] = y; }
            self.render();
            self.onChange(self.cp, self.mode);
        };
        var up = function () {
            if (self.dragging) { self.dragging = null; self.onChange(self.cp, self.mode); }
        };

        this.canvas.addEventListener("mousedown", down);
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
        this.canvas.addEventListener("touchstart", down, { passive: false });
        this.canvas.addEventListener("touchmove", move, { passive: false });
        window.addEventListener("touchend", up);
        window.addEventListener("resize", function () { self.resize(); });
    };

    // ---- rendering ----------------------------------------------------------
    GraphEditor.prototype._css = function (name, fallback) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name);
        return (v && v.trim()) || fallback;
    };

    GraphEditor.prototype.render = function () {
        var ctx = this.ctx;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        ctx.clearRect(0, 0, this.W, this.H);

        var p = this.plot();
        var grid = this._css("--grid", "rgba(255,255,255,0.05)");
        var curveCol = this._css("--curve", "#3b82f6");
        var colA = this._css("--handle-a", "#c084fc");
        var colB = this._css("--handle-b", "#f59e0b");

        // grid: thirds
        ctx.strokeStyle = grid;
        ctx.lineWidth = 1;
        for (var i = 0; i <= 3; i++) {
            var gx = p.x + (i / 3) * p.w;
            ctx.beginPath(); ctx.moveTo(gx, p.y); ctx.lineTo(gx, p.y + p.h); ctx.stroke();
        }
        // horizontal reference lines at value 0 and 1
        [0, 1].forEach(function (v) {
            var yy = this.toPx(0, v).y;
            ctx.beginPath(); ctx.moveTo(p.x, yy); ctx.lineTo(p.x + p.w, yy); ctx.stroke();
        }, this);

        if (this.mode === "value") this._drawValue(ctx, curveCol);
        else this._drawSpeed(ctx, curveCol);

        // control handle guide lines
        var a0 = this.toPx(0, 0), a1 = this.toPx(1, 1);
        var h1 = this.toPx(this.cp[0], this.cp[1]);
        var h2 = this.toPx(this.cp[2], this.cp[3]);

        ctx.strokeStyle = "rgba(192,132,252,0.5)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(h1.x, h1.y); ctx.stroke();
        ctx.strokeStyle = "rgba(245,158,11,0.5)";
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(h2.x, h2.y); ctx.stroke();
        ctx.setLineDash([]);

        // anchors
        this._dot(ctx, a0.x, a0.y, 5, "#ffffff", "#0e1116");
        this._dot(ctx, a1.x, a1.y, 5, "#ffffff", "#0e1116");
        // control handles
        this._dot(ctx, h1.x, h1.y, 7, colA, "#0e1116");
        this._dot(ctx, h2.x, h2.y, 7, colB, "#0e1116");

        ctx.restore();
    };

    GraphEditor.prototype._drawValue = function (ctx, col) {
        var ease = Bezier.CubicBezier(this.cp);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (var i = 0; i <= 120; i++) {
            var x = i / 120;
            var pt = this.toPx(x, ease(x));
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    };

    GraphEditor.prototype._drawSpeed = function (ctx, col) {
        var vel = Bezier.sampleVelocity(this.cp, 120);
        var peak = vel.peak || 1;
        // faint value curve behind for reference
        ctx.strokeStyle = "rgba(59,130,246,0.25)";
        ctx.lineWidth = 1.5;
        var ease = Bezier.CubicBezier(this.cp);
        ctx.beginPath();
        for (var k = 0; k <= 120; k++) {
            var xx = k / 120, pv = this.toPx(xx, ease(xx));
            if (k === 0) ctx.moveTo(pv.x, pv.y); else ctx.lineTo(pv.x, pv.y);
        }
        ctx.stroke();
        // velocity curve, normalized so peak maps to 1
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (var i = 0; i < vel.points.length; i++) {
            var d = vel.points[i];
            var pt = this.toPx(d.t, d.v / peak);
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    };

    GraphEditor.prototype._dot = function (ctx, x, y, r, fill, ring) {
        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = ring; ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
    };

    root.GraphEditor = GraphEditor;
})(typeof window !== "undefined" ? window : this);
