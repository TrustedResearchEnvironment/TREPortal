// Exposes the libraries that page scripts reference as globals (bootstrap.Modal, XLSX).
import * as bootstrap from 'bootstrap';
import * as XLSX from 'xlsx';
import { callTrustApi, resolveOperationName } from './api/client.js';

window.bootstrap = bootstrap;
window.XLSX = XLSX;

// Pages call window.loomeApi.runApiRequest(name, params).
// TrustAPI operations from the catalog go to the direct client. Everything else (Portal - * and
// unknown names) is passed unchanged to the host's original runApiRequest.
function installRunApiRequest(api) {
    const hostRunApiRequest = typeof api.runApiRequest === 'function' ? api.runApiRequest : null;

    api.runApiRequest = function runApiRequest(name, params) {
        const operationName = resolveOperationName(name);
        if (operationName) return callTrustApi(operationName, params);

        if (!hostRunApiRequest) {
            return Promise.reject(new Error(`window.loomeApi.runApiRequest is not available for "${name}"`));
        }
        return hostRunApiRequest.call(api, name, params);
    };

    return api;
}

// Wrap the existing object in place so Portal calls keep the same window.loomeApi reference.
// The setter also wraps an object the host assigns after this bundle has loaded.
let loomeApi = installRunApiRequest(window.loomeApi ?? {});
try {
    Object.defineProperty(window, 'loomeApi', {
        configurable: true,
        enumerable: true,
        get: () => loomeApi,
        set: (value) => {
            loomeApi = value ? installRunApiRequest(value) : value;
        },
    });
} catch {
    // window.loomeApi is not redefinable; the in-place wrapper above still applies.
}
