/**********************************************************************
 * MotionEase.jsx — ExtendScript host for the MotionEase panel.
 *
 * Exposes three entry points the panel calls via CSInterface.evalScript:
 *   MotionEase.ping()               -> "MotionEase <version>"
 *   MotionEase.getSelectionInfo()   -> JSON { clips, sequence }
 *   MotionEase.apply(payloadJson)   -> JSON { ok, applied, message, details }
 *
 * apply() reads the first & last keyframe of each selected property, then
 * bakes a dense set of keyframes between them following the shaped curve.
 * Dense baking reproduces the exact motion regardless of Premiere's limited
 * bezier-handle API — the value graph you drew is the value graph you get.
 **********************************************************************/

//@include "./lib/json2.jsx"

var MotionEase = (function () {
    "use strict";

    var VERSION = "1.0.0";

    // Premiere keyframe interpolation constants (best-effort; baking is dense
    // so the exact type barely affects the result).
    var KF = { LINEAR: 0, BEZIER: 2, HOLD: 1, TIME: 3 };

    // The interpolation type used for the "Ease my keyframes" (native) mode.
    // Premiere's enum has varied across versions; if native easing ever FREEZES
    // a value (Hold) instead of smoothing it, change this to 1.
    var BEZIER_INTERP = KF.BEZIER;

    // Panel prop id -> Premiere property displayName(s)
    var TARGETS = {
        position: ["Position"],
        scale: ["Scale"],
        rotation: ["Rotation"],
        opacity: ["Opacity"]
    };

    // ---- helpers ---------------------------------------------------------

    function activeSeq() {
        return app.project ? app.project.activeSequence : null;
    }

    function getSelectedItems(seq) {
        if (!seq) return [];
        // Newer API: sequence.getSelection() -> Array of TrackItem
        try {
            if (typeof seq.getSelection === "function") {
                var sel = seq.getSelection();
                if (sel && sel.length !== undefined) {
                    var arr = [];
                    for (var i = 0; i < sel.length; i++) arr.push(sel[i]);
                    return arr;
                }
            }
        } catch (e) {}
        // Fallback: walk tracks and test isSelected()
        var items = [];
        var groups = [seq.videoTracks, seq.audioTracks];
        for (var g = 0; g < groups.length; g++) {
            var tracks = groups[g];
            if (!tracks) continue;
            for (var t = 0; t < tracks.numTracks; t++) {
                var clips = tracks[t].clips;
                for (var c = 0; c < clips.numItems; c++) {
                    var clip = clips[c];
                    try { if (clip.isSelected()) items.push(clip); } catch (e2) {}
                }
            }
        }
        return items;
    }

    function keyTimeSeconds(k) {
        if (k === null || k === undefined) return null;
        if (typeof k === "number") return k;
        if (k.seconds !== undefined && k.seconds !== null) return k.seconds;
        var n = Number(k);
        return isNaN(n) ? null : n;
    }

    function isVector(v) {
        return v !== null && typeof v === "object" && v.length !== undefined;
    }

    function lerp(a, b, f) {
        if (isVector(a) && isVector(b)) {
            var out = [];
            for (var i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * f);
            return out;
        }
        return a + (b - a) * f;
    }

    // Find matching ComponentParams on a TrackItem for the requested props.
    function collectProps(item, wanted) {
        var found = []; // { id, param }
        var comps = item.components;
        if (!comps) return found;
        for (var ci = 0; ci < comps.numItems; ci++) {
            var comp = comps[ci];
            var params = comp.properties;
            if (!params) continue;
            for (var pi = 0; pi < params.numItems; pi++) {
                var param = params[pi];
                var name;
                try { name = param.displayName; } catch (e) { name = ""; }
                for (var w = 0; w < wanted.length; w++) {
                    var id = wanted[w];
                    var aliases = TARGETS[id] || [];
                    for (var a = 0; a < aliases.length; a++) {
                        if (name && name.toLowerCase() === aliases[a].toLowerCase()) {
                            found.push({ id: id, param: param, name: name });
                        }
                    }
                }
            }
        }
        return found;
    }

    function setKeyLinear(param, time) {
        try { param.setInterpolationTypeAtKey(time, KF.LINEAR, true); } catch (e) {}
    }

    // Bake the curve onto one ComponentParam between its outer keyframes.
    function bakeParam(param, curve) {
        var report = { applied: false, reason: "" };

        var timeVarying = false;
        try { timeVarying = param.isTimeVarying(); } catch (e) {}
        if (!timeVarying) { report.reason = "no keyframes"; return report; }

        var keys;
        try { keys = param.getKeys(); } catch (e) { keys = null; }
        if (!keys || keys.length < 2) { report.reason = "needs 2+ keyframes"; return report; }

        // outer keyframe times
        var times = [];
        for (var i = 0; i < keys.length; i++) {
            var s = keyTimeSeconds(keys[i]);
            if (s !== null) times.push(s);
        }
        times.sort(function (a, b) { return a - b; });
        var tStart = times[0], tEnd = times[times.length - 1];
        if (tEnd <= tStart) { report.reason = "zero-length range"; return report; }

        // read endpoint values BEFORE we clear the range
        var vStart, vEnd;
        try { vStart = param.getValueAtKey(tStart); } catch (e) { report.reason = "read start failed"; return report; }
        try { vEnd = param.getValueAtKey(tEnd); } catch (e) { report.reason = "read end failed"; return report; }

        // clear everything in the range, then rebuild from the curve
        try { param.removeKeyRange(tStart, tEnd, true); } catch (e) {}

        var span = tEnd - tStart;
        var count = 0;
        for (var c = 0; c < curve.length; c++) {
            var pt = curve[c];
            var time = tStart + pt.t * span;
            var value = lerp(vStart, vEnd, pt.v);
            try {
                param.addKey(time);
            } catch (eAdd) {}
            try {
                param.setValueAtKey(time, value, true);
                setKeyLinear(param, time);
                count++;
            } catch (eSet) {}
        }

        report.applied = count > 0;
        report.reason = report.applied ? (count + " keys") : "write failed";
        report.keys = count;
        return report;
    }

    // Native mode: keep the user's existing keyframes, just switch them to a
    // smooth bezier ease. No keyframes are added. This is Premiere's own ease
    // system — clean and hand-editable — but the exact drawn curve shape/influence
    // can't be scripted, so it's a smart ease rather than your literal bezier.
    //
    // The panel derives the curve's shape and passes easeStart / easeEnd flags:
    //   both  -> Ease In-Out  (first & last keyframe bezier)
    //   start -> Ease In      (only the first keyframe bezier; end stays snappy)
    //   end   -> Ease Out     (only the last keyframe bezier; start stays snappy)
    //   none  -> Linear
    function easeParamNative(param, opts) {
        var report = { applied: false, reason: "" };
        var easeStart = opts && opts.easeStart;
        var easeEnd = opts && opts.easeEnd;

        var timeVarying = false;
        try { timeVarying = param.isTimeVarying(); } catch (e) {}
        if (!timeVarying) { report.reason = "no keyframes"; return report; }

        var keys;
        try { keys = param.getKeys(); } catch (e) { keys = null; }
        if (!keys || keys.length < 2) { report.reason = "needs 2+ keyframes"; return report; }

        var times = [];
        for (var i = 0; i < keys.length; i++) {
            var s = keyTimeSeconds(keys[i]);
            if (s !== null) times.push(s);
        }
        times.sort(function (a, b) { return a - b; });

        var last = times.length - 1;
        var n = 0;
        for (var j = 0; j < times.length; j++) {
            var useBezier;
            if (j === 0) useBezier = easeStart;
            else if (j === last) useBezier = easeEnd;
            else useBezier = (easeStart || easeEnd); // interior keys: smooth if easing at all
            var type = useBezier ? BEZIER_INTERP : KF.LINEAR;
            try {
                param.setInterpolationTypeAtKey(times[j], type, true);
                n++;
            } catch (e) {}
        }

        report.applied = n > 0;
        report.reason = report.applied ? ("eased " + n + " keyframes") : "set interpolation failed";
        report.keys = n;
        return report;
    }

    // ---- public API ------------------------------------------------------

    function ping() {
        return "MotionEase " + VERSION;
    }

    function getSelectionInfo() {
        var seq = activeSeq();
        var info = { clips: 0, sequence: seq ? seq.name : "" };
        if (!seq) return JSON.stringify(info);
        info.clips = getSelectedItems(seq).length;
        return JSON.stringify(info);
    }

    function apply(payloadJson) {
        var result = { ok: false, applied: 0, message: "", details: [] };
        try {
            var payload = JSON.parse(payloadJson);
            var seq = activeSeq();
            if (!seq) { result.message = "No active sequence."; return JSON.stringify(result); }

            var items = getSelectedItems(seq);
            if (!items.length) { result.message = "No clips selected."; return JSON.stringify(result); }

            var curve = payload.curve;
            var method = payload.method || (payload.dense ? "bake" : "native");
            if (method === "bake" && (!curve || !curve.length)) {
                result.message = "No curve data."; return JSON.stringify(result);
            }

            var wanted = payload.props || [];
            var applied = 0, skipped = 0;

            // native ease shape; default to Ease In-Out if the panel sent nothing
            var easeOpts = {
                easeStart: payload.easeStart === undefined ? true : !!payload.easeStart,
                easeEnd: payload.easeEnd === undefined ? true : !!payload.easeEnd
            };

            for (var i = 0; i < items.length; i++) {
                var props = collectProps(items[i], wanted);
                for (var p = 0; p < props.length; p++) {
                    var rep = (method === "bake")
                        ? bakeParam(props[p].param, curve)
                        : easeParamNative(props[p].param, easeOpts);
                    result.details.push(props[p].name + ": " + rep.reason);
                    if (rep.applied) applied++; else skipped++;
                }
            }

            result.applied = applied;
            if (applied > 0) {
                result.ok = true;
                result.message = "Eased " + applied + " propert" + (applied > 1 ? "ies" : "y") +
                    (skipped ? " (" + skipped + " skipped — need 2+ keyframes)" : "");
            } else {
                result.message = "No easable properties. Set a start and end keyframe first.";
            }
        } catch (err) {
            result.message = "Error: " + err.toString();
        }
        return JSON.stringify(result);
    }

    return {
        ping: ping,
        getSelectionInfo: getSelectionInfo,
        apply: apply
    };
})();

// Expose bare functions too, in case evalScript targets the global scope.
function ME_ping() { return MotionEase.ping(); }
function ME_getSelectionInfo() { return MotionEase.getSelectionInfo(); }
function ME_apply(p) { return MotionEase.apply(p); }
