/*
 * main.js — panel controller. Wires the graph editor, presets, live preview
 * and the Apply action that hands a sampled curve to the ExtendScript host.
 */
(function () {
    "use strict";

    var cs = new CSInterface();
    var hostReady = cs.isHostAvailable();

    var els = {
        status: document.getElementById("hostStatus"),
        readout: document.getElementById("readout"),
        propAll: document.getElementById("propAll"),
        propGrid: document.getElementById("propGrid"),
        selectionHint: document.getElementById("selectionHint")
        
        
        applyBtn: document.getElementById("applyBtnMain"),
        
        
        
        
        
        
        
        
        
        
        toast: document.getElementById("toast")
    };

    

    // Derive the ease shape from the curve: is the start slow? the end slow?
    // Compares endpoint velocity against the curve's peak velocity.
    function computeEase(cp) {
        var vel = Bezier.sampleVelocity(cp, 60);
        var peak = vel.peak || 1e-9;
        var pts = vel.points;
        var startRatio = pts[0].v / peak;
        var endRatio = pts[pts.length - 1].v / peak;
        var easeStart = startRatio < 0.55;   // starts noticeably slower than peak
        var easeEnd = endRatio < 0.55;       // ends noticeably slower than peak
        var label = easeStart && easeEnd ? "In-Out"
                  : easeStart ? "In"
                  : easeEnd ? "Out"
                  : "Linear";
        return { easeStart: easeStart, easeEnd: easeEnd, label: label };
    }

    // ---- graph --------------------------------------------------------------
    var editor = new GraphEditor(document.getElementById("graph"), {
        cp: [0.42, 0.0, 0.58, 1.0],
        onChange: function (cp) {
            els.readout.textContent =
                "cubic-bezier(" + cp.map(function (n) { return n.toFixed(2); }).join(", ") + ")";
            
        }
    });
    editor.onChange(editor.cp, editor.mode);

    // ---- mode tabs ----------------------------------------------------------
    document.querySelectorAll(".seg-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".seg-btn").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            editor.setMode(btn.dataset.mode);
        });
    });

    // ---- property checkboxes ------------------------------------------------
    function propBoxes() {
        return Array.prototype.slice.call(els.propGrid.querySelectorAll("input[type=checkbox]"));
    }
    els.propAll.addEventListener("change", function () {
        propBoxes().forEach(function (b) { b.checked = els.propAll.checked; });
    });
    propBoxes().forEach(function (b) {
        b.addEventListener("change", function () {
            els.propAll.checked = propBoxes().every(function (x) { return x.checked; });
        });
    });
    function selectedProps() {
        return propBoxes().filter(function (b) { return b.checked; })
            .map(function (b) { return b.dataset.prop; });
    }


    });

    function performApply() {
        var props = selectedProps();
        if (!props.length) { toast("Pick a property", "err"); return; }
        if (!hostReady) { toast("Not running inside Premiere Pro", "err"); return; }

        var density = 16;
        var payload = {
            cp: editor.cp,
            mode: editor.mode,            // graph view: value | speed
            method: "bake",               // always bake — the reliable path in Premiere
            props: props,
            customWanted: [],
            segment: "playhead",
            samples: density,
            curve: Bezier.sampleCurveAdaptive(editor.cp, { tol: 0.006, maxPoints: density, minPoints: 3 })
        };
        var payloadStr = JSON.stringify(payload);
        
        els.applyBtn.disabled = true;
        els.applyBtn.textContent = "Applying…";

        cs.evalScript("FrameFlow.apply(" + JSON.stringify(payloadStr) + ")", function (res) {
            els.applyBtn.disabled = false;
            els.applyBtn.textContent = "Apply Ease";
            handleHostResult(res);
        });
    }

    els.applyBtn.addEventListener("click", performApply);

    function handleHostResult(res) {
        var r;
        try { r = JSON.parse(res); } catch (e) { r = null; }
        if (!r) { toast("Host error: " + String(res).slice(0, 80), "err"); return; }
        if (r.ok) {
            toast(r.message || ("Applied to " + r.applied + " properties"), "ok");
        } else {
            toast(r.message || "Nothing to apply", "err");
        }
    }

    // ---- selection polling --------------------------------------------------
    function setDot(prop, state) {
        var dot = els.propGrid.querySelector('.kf-dot[data-dot="' + prop + '"]');
        if (dot) dot.className = "kf-dot " + state;
    }
    function clearDots(state) {
        ["position", "scale", "rotation", "opacity"].forEach(function (p) { setDot(p, state); });
    }

    function pollSelection() {
        if (!hostReady) return;
        cs.evalScript("FrameFlow.scanSelection()", function (res) {
            var r; try { r = JSON.parse(res); } catch (e) { r = null; }
            if (!r) return;

            if (!r.clips) {
                els.selectionHint.textContent = "Select a clip with 2+ keyframes, then Apply.";
                clearDots("");
                return;
            }

            els.selectionHint.textContent =
                r.clips + " clip" + (r.clips > 1 ? "s" : "") + " selected" +
                (r.sequence ? " · " + r.sequence : "");

            // per-property keyframe dots: green=animated, dim=present, hollow=absent
            var p = r.props || {};
            ["position", "scale", "rotation", "opacity"].forEach(function (prop) {
                var s = p[prop] || {};
                setDot(prop, s.keyed ? "keyed" : (s.present ? "none" : "absent"));
            });
        });
    }

    // ---- host status --------------------------------------------------------
    function initHost() {
        if (!hostReady) {
            els.status.className = "status err";
            els.status.innerHTML = '<span class="dot"></span> Preview mode (no host)';
            els.selectionHint.textContent = "Open this panel inside Premiere Pro to apply curves.";
            return;
        }
        cs.evalScript("FrameFlow.ping()", function (res) {
            var ok = String(res).indexOf("FrameFlow") >= 0;
            els.status.className = ok ? "status ok" : "status err";
            els.status.innerHTML = '<span class="dot"></span> ' + (ok ? "Connected" : "Host not responding");
            if (ok) {
                pollSelection();
                setInterval(pollSelection, 1500);
                // sync undo button with any history the host still holds
                cs.evalScript("FrameFlow.undoCount()", function (c) {
                    setUndoEnabled(parseInt(c, 10) > 0);
                });
            }
        });
    }

    // ---- utils --------------------------------------------------------------
    var toastTimer = null;
    function toast(msg, kind) {
        els.toast.textContent = msg;
        els.toast.className = "toast show " + (kind || "");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { els.toast.className = "toast " + (kind || ""); }, 6000);
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
        });
    }

    // ---- boot ---------------------------------------------------------------
    renderPresets();
    initHost();
})();
