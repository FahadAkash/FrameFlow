/*
 * presets.js — built-in easing library + user presets (localStorage).
 * Control points are [x1, y1, x2, y2] with anchors fixed at (0,0)/(1,1).
 * y may exceed [0,1] (e.g. Overshoot) — the editor and baker both honor that.
 */
(function (root) {
    "use strict";

    var BUILTIN = [
        { name: "Linear",         cp: [0.00, 0.00, 1.00, 1.00] },
        { name: "Ease In",        cp: [0.42, 0.00, 1.00, 1.00] },
        { name: "Ease In +",      cp: [0.55, 0.06, 0.68, 0.19] },
        { name: "Ease Out",       cp: [0.00, 0.00, 0.58, 1.00] },
        { name: "Ease Out +",     cp: [0.16, 1.00, 0.30, 1.00] },
        { name: "In-Out",         cp: [0.42, 0.00, 0.58, 1.00] },
        { name: "In-Out Str.",    cp: [0.65, 0.00, 0.35, 1.00] },
        { name: "Overshoot",      cp: [0.34, 1.56, 0.64, 1.00] },
        { name: "Anticipate",     cp: [0.36, -0.4, 0.66, 1.00] },
        { name: "Snap",           cp: [0.90, 0.00, 0.10, 1.00] }
    ];

    var STORAGE_KEY = "frameflow.userpresets.v1";

    function loadUser() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function saveUser(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {}
    }

    function addUser(name, cp) {
        var list = loadUser();
        list.push({ name: name, cp: cp.slice(), user: true });
        saveUser(list);
        return list;
    }

    function removeUser(index) {
        var list = loadUser();
        list.splice(index, 1);
        saveUser(list);
        return list;
    }

    /** Export a preset as a shareable string (base64 of JSON). */
    function serialize(name, cp) {
        var payload = JSON.stringify({ n: name, c: cp });
        try { return "ME1:" + btoa(payload); } catch (e) { return "ME1:" + payload; }
    }

    /** Parse a shared preset string back into {name, cp}. */
    function deserialize(str) {
        if (!str || str.indexOf("ME1:") !== 0) return null;
        var body = str.slice(4);
        try {
            var json = JSON.parse(atob(body));
            if (json && json.c && json.c.length === 4) {
                return { name: json.n || "Shared", cp: json.c };
            }
        } catch (e) {}
        return null;
    }

    root.Presets = {
        BUILTIN: BUILTIN,
        loadUser: loadUser,
        addUser: addUser,
        removeUser: removeUser,
        serialize: serialize,
        deserialize: deserialize
    };
})(typeof window !== "undefined" ? window : this);
