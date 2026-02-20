/**
 * Background service worker for InvisibleUnicode extension.
 *
 * Handles:
 * - browser.action.onClicked toggle (scan on / scan off)
 * - Content script injection on first click
 * - Badge management (finding count, checkmark, clear on navigation)
 * - Restricted URL filtering (chrome://, about:, etc.)
 */

import { browser } from 'wxt/browser';
import { sendMessage } from '@/utils/messaging';

/** URLs where content script injection is not allowed */
const RESTRICTED_PREFIXES = ['chrome://', 'about:', 'chrome-extension://'];
const RESTRICTED_HOSTS = ['chromewebstore.google.com'];

/**
 * Check if a URL is restricted (cannot inject content scripts).
 */
function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  if (RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix))) return true;
  try {
    const parsed = new URL(url);
    if (RESTRICTED_HOSTS.includes(parsed.hostname)) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Update the extension badge for a tab.
 *
 * - count > 0: red badge with finding count (max "999+")
 * - count === 0: green checkmark badge, auto-clears after 1.5s
 */
function updateBadge(tabId: number, count: number): void {
  if (count > 0) {
    const text = count > 999 ? '999+' : count.toString();
    void browser.action.setBadgeText({ text, tabId });
    void browser.action.setBadgeBackgroundColor({ color: '#F44336', tabId });
  } else {
    void browser.action.setBadgeText({ text: '\u2713', tabId });
    void browser.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId });
    setTimeout(() => {
      void browser.action.setBadgeText({ text: '', tabId });
    }, 1500);
  }
}

export default defineBackground(() => {
  // Handle extension icon click — toggle scan on/off
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    if (isRestrictedUrl(tab.url)) return;

    const tabId = tab.id;
    const badgeText = await browser.action.getBadgeText({ tabId });

    if (badgeText !== '') {
      // Scan is active — toggle OFF
      try {
        await sendMessage('clearScan', undefined, tabId);
      } catch {
        // Content script may have been unloaded — ignore
      }
      await browser.action.setBadgeText({ text: '', tabId });
    } else {
      // No scan active — toggle ON
      try {
        // Try to ping existing content script
        await sendMessage('ping', undefined, tabId);
      } catch {
        // Content script not injected — inject it
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['/content-scripts/content.js'],
        });
      }

      try {
        const result = await sendMessage('startScan', undefined, tabId);
        updateBadge(tabId, result.count);
      } catch (err) {
        console.error('InvisibleUnicode: scan failed', err);
      }
    }
  });

  // Clear badge when tab navigates to a new page
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      void browser.action.setBadgeText({ text: '', tabId });
    }
  });
});
