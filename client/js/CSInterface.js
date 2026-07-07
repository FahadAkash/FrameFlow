/*
 * CSInterface — compact functional build.
 * Wraps the CEP runtime bridge (window.__adobe_cep__) exposed inside a
 * Premiere Pro CEP panel. Only the surface this plugin uses is implemented.
 * Drop in Adobe's full CSInterface.js if you need the complete API.
 */

function SystemPath() {}
SystemPath.USER_DATA = "userData";
SystemPath.COMMON_FILES = "commonFiles";
SystemPath.MY_DOCUMENTS = "myDocuments";
SystemPath.APPLICATION = "application";
SystemPath.EXTENSION = "extension";
SystemPath.HOST_APPLICATION = "hostApplication";

function CSEvent(type, scope, appId, extensionId) {
    this.type = type;
    this.scope = scope || "APPLICATION";
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
}

function HostEnvironment(o) {
    this.appName = o.appName;
    this.appVersion = o.appVersion;
    this.appLocale = o.appLocale;
    this.appUILocale = o.appUILocale;
    this.appId = o.appId;
    this.isAppOnline = o.isAppOnline;
    this.appSkinInfo = o.appSkinInfo;
}

function CSInterface() {
    this.hostEnvironment = this.getHostEnvironment();
}

CSInterface.prototype.hostEnvironment = null;

/** Evaluate an ExtendScript string in the host app. Result is passed to callback as a string. */
CSInterface.prototype.evalScript = function (script, callback) {
    if (callback === null || callback === undefined) {
        callback = function () {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getHostEnvironment = function () {
    try {
        this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    } catch (e) {
        this.hostEnvironment = {};
    }
    return this.hostEnvironment;
};

CSInterface.prototype.getApplicationID = function () {
    return this.getHostEnvironment().appId;
};

CSInterface.prototype.getExtensionID = function () {
    return window.__adobe_cep__.getExtensionId();
};

CSInterface.prototype.getSystemPath = function (pathType) {
    var path = window.__adobe_cep__.getSystemPath(pathType);
    var OSVersion = this.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0) {
        path = path.replace("file:///", "").replace(/\//g, "\\");
    } else if (OSVersion.indexOf("Mac") >= 0) {
        path = path.replace("file://", "");
    }
    return decodeURIComponent(path);
};

CSInterface.prototype.getOSInformation = function () {
    var userAgent = navigator.userAgent;
    if (
        (navigator.platform === "Win32" || navigator.platform === "Windows") ||
        userAgent.indexOf("Windows") >= 0
    ) {
        return "Windows";
    } else if (
        (navigator.platform === "MacIntel" || navigator.platform === "Macintosh") ||
        userAgent.indexOf("Mac") >= 0
    ) {
        return "Mac";
    }
    return "Unknown";
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    window.__adobe_cep__.addEventListener(type, listener, obj);
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    window.__adobe_cep__.removeEventListener(type, listener, obj);
};

CSInterface.prototype.dispatchEvent = function (event) {
    if (typeof event.data === "object") {
        event.data = JSON.stringify(event.data);
    }
    window.__adobe_cep__.dispatchEvent(event);
};

CSInterface.prototype.requestOpenExtension = function (extensionId, params) {
    window.__adobe_cep__.requestOpenExtension(extensionId, params);
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    return window.cep.util.openURLInDefaultBrowser(url);
};

CSInterface.prototype.getExtensions = function (extensionIds) {
    var extensionIdsStr = JSON.stringify(extensionIds || []);
    var extensionsStr = window.__adobe_cep__.getExtensions(extensionIdsStr);
    try {
        return JSON.parse(extensionsStr);
    } catch (e) {
        return [];
    }
};

/** True when running inside a real CEP host. */
CSInterface.prototype.isHostAvailable = function () {
    return typeof window.__adobe_cep__ !== "undefined" && window.__adobe_cep__ !== null;
};
