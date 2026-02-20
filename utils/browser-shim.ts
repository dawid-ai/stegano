/**
 * Minimal shim replacing webextension-polyfill for Chrome MV3.
 *
 * Chrome MV3 already provides Promise-based APIs on the `chrome` namespace,
 * so the full polyfill is unnecessary and its startup check
 * (`chrome.runtime.id`) can crash service worker registration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (globalThis as any).chrome;
