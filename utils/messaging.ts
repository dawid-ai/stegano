/**
 * Type-safe messaging protocol for background/content script communication.
 *
 * Uses @webext-core/messaging with a ProtocolMap to provide compile-time
 * type safety for all cross-context messages.
 *
 * @module messaging
 */

import { defineExtensionMessaging } from '@webext-core/messaging';

/** Result returned from a scan operation */
export interface ScanResult {
  /** Number of distinct findings (locations with invisible chars) */
  count: number;
}

/**
 * Protocol map defining all messages exchanged between background
 * service worker and content scripts.
 *
 * Function syntax: parameter type is the data, return type is the response.
 */
interface ProtocolMap {
  /** Health check — verify content script is injected and responsive */
  ping(): 'pong';
  /** Trigger a scan of the current page DOM */
  startScan(): ScanResult;
  /** Clear all scan highlights and restore original DOM */
  clearScan(): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
