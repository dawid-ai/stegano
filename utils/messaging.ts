/**
 * Type-safe messaging protocol for background/content script communication.
 *
 * Uses chrome.runtime messaging directly (no polyfill) with proper
 * sendResponse handling for MV3 service workers.
 *
 * @module messaging
 */

import { browser } from 'wxt/browser';

/** Result returned from a scan operation */
export interface ScanResult {
  /** Number of distinct findings (locations with invisible chars) */
  count: number;
}

/** All message types and their return values */
type MessageMap = {
  ping: { data: undefined; response: 'pong' };
  startScan: { data: undefined; response: ScanResult };
  clearScan: { data: undefined; response: void };
};

type MessageType = keyof MessageMap;

interface Message {
  type: MessageType;
  data?: unknown;
}

/**
 * Send a message to a content script in a specific tab,
 * or to the background if no tabId is provided.
 */
export function sendMessage<K extends MessageType>(
  type: K,
  data: MessageMap[K]['data'],
  tabId?: number,
): Promise<MessageMap[K]['response']> {
  const msg: Message = { type, data };
  if (tabId != null) {
    return browser.tabs.sendMessage(tabId, msg);
  }
  return browser.runtime.sendMessage(msg);
}

/**
 * Register a handler for a specific message type.
 * Uses sendResponse to ensure the async response reaches the sender.
 */
export function onMessage<K extends MessageType>(
  type: K,
  handler: (
    data: MessageMap[K]['data'],
  ) => MessageMap[K]['response'] | Promise<MessageMap[K]['response']>,
): void {
  browser.runtime.onMessage.addListener(
    (
      msg: Message,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (msg.type !== type) return false;
      const result = handler(msg.data as MessageMap[K]['data']);
      if (result instanceof Promise) {
        result.then(sendResponse).catch(() => sendResponse(undefined));
        return true; // keep channel open for async sendResponse
      }
      sendResponse(result);
      return false;
    },
  );
}
