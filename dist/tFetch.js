"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.typedFetch = typedFetch;
exports.tFetch = tFetch;
const config_1 = require("./core/config");
const browser_registry_1 = require("./core/browser-registry");
const filter_1 = require("./core/filter");
const normalize_1 = require("./core/normalize");
const registry_1 = require("./core/registry");
const shape_1 = require("./core/shape");
const sync_1 = require("./core/sync");
const isNodeRuntime = typeof process !== "undefined" &&
    Boolean(process.versions) &&
    Boolean(process.versions.node);
const fetchFunction = (() => {
    if (typeof fetch === "function") {
        return fetch.bind(globalThis);
    }
    if (isNodeRuntime) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeFetch = require("node-fetch");
        return nodeFetch;
    }
    throw new Error("No fetch implementation available in this runtime.");
})();
function parsePathname(input) {
    if (typeof input === "string") {
        return new URL(input, "http://typed-fetch.local").pathname;
    }
    if (input instanceof URL) {
        return input.pathname;
    }
    const request = input;
    return new URL(request.url, "http://typed-fetch.local").pathname;
}
function isJsonContentType(contentType) {
    return Boolean(contentType && contentType.toLowerCase().includes("application/json"));
}
function isNodeWritableRuntime() {
    return isNodeRuntime;
}
function isOkStatus(status) {
    return (status === 200 ||
        status === 201 ||
        status === 202 ||
        status === 203 ||
        status === 204 ||
        status === 205 ||
        status === 206 ||
        status === 207 ||
        status === 208 ||
        status === 226);
}
function typedFetch(input, init, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const response = yield fetchFunction(input, init);
        const config = (0, config_1.loadConfig)(options === null || options === void 0 ? void 0 : options.config);
        const method = (_a = init === null || init === void 0 ? void 0 : init.method) !== null && _a !== void 0 ? _a : "GET";
        const endpointKey = (_b = options === null || options === void 0 ? void 0 : options.endpointKey) !== null && _b !== void 0 ? _b : (0, normalize_1.normalizeEndpointKey)({
            input,
            method,
            dynamicSegmentPatterns: config.dynamicSegmentPatterns,
        });
        let data = undefined;
        let shape = { kind: "unknown" };
        const contentType = response.headers.get("content-type");
        const jsonCandidate = isJsonContentType(contentType);
        if (jsonCandidate) {
            try {
                data = yield response.clone().json();
                shape = (0, shape_1.inferShape)(data, config);
            }
            catch (_c) {
                data = undefined;
                shape = { kind: "unknown" };
            }
        }
        else {
            shape = { kind: "unknown" };
        }
        try {
            const pathname = parsePathname(input);
            if ((0, filter_1.shouldTrackEndpoint)(pathname, config.include, config.exclude)) {
                const observation = {
                    endpointKey,
                    status: response.status,
                    shape,
                    observedAt: new Date().toISOString(),
                    source: isNodeRuntime ? "node" : "browser",
                };
                const mode = config.observerMode;
                if (mode === "none") {
                    // Explicitly disabled.
                }
                else if (mode === "file" || (mode === "auto" && isNodeWritableRuntime())) {
                    const registry = (0, registry_1.loadRegistry)(config.registryPath);
                    (0, registry_1.observeShape)({
                        registry,
                        endpointKey: observation.endpointKey,
                        status: observation.status,
                        shape: observation.shape,
                    });
                    (0, registry_1.saveRegistry)(config.registryPath, registry);
                }
                else if (mode === "localStorage" ||
                    (mode === "auto" && (0, browser_registry_1.hasLocalStorage)())) {
                    const registry = (0, browser_registry_1.loadBrowserRegistry)(config.browserStorageKey);
                    (0, registry_1.observeShape)({
                        registry,
                        endpointKey: observation.endpointKey,
                        status: observation.status,
                        shape: observation.shape,
                    });
                    (0, browser_registry_1.saveBrowserRegistry)(config.browserStorageKey, registry);
                }
                if (config.syncUrl) {
                    void (0, sync_1.pushObservation)({
                        syncUrl: config.syncUrl,
                        timeoutMs: config.syncTimeoutMs,
                        observation,
                    });
                }
            }
        }
        catch (_d) {
            // Observation failures must never block request handling.
        }
        const status = response.status;
        return {
            endpoint: endpointKey,
            status,
            ok: isOkStatus(status),
            data,
            response,
        };
    });
}
/**
 * Compatibility export. Existing code importing `tFetch` now receives
 * the typed status-aware helper result model.
 */
function tFetch(input, init, options) {
    return typedFetch(input, init, options);
}
exports.default = typedFetch;
