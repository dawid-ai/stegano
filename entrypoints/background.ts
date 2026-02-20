/**
 * Background service worker for InvisibleUnicode extension.
 *
 * Handles:
 * - browser.action.onClicked toggle (scan on / scan off)
 * - browser.commands.onCommand for keyboard shortcuts (trigger-scan, quick-paste)
 * - Content script injection on first click
 * - Badge management (finding count, checkmark, clear on navigation)
 * - Restricted URL filtering (chrome://, about:, etc.)
 */

import { browser } from 'wxt/browser';
import { onMessage, sendMessage } from '@/utils/messaging';
import { primarySnippetSetting, scanModeSetting } from '@/utils/storage';

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

/**
 * Shared scan toggle logic used by both action.onClicked and trigger-scan command.
 * Injects content script if needed, starts or clears scan, updates badge.
 */
async function handleScanToggle(tabId: number, url: string | undefined): Promise<void> {
  if (isRestrictedUrl(url)) return;

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
}

/**
 * Copy the primary snippet to the clipboard via content script injection.
 * Fails silently on restricted pages or when no snippet is set.
 */
async function handleQuickPaste(tabId: number): Promise<void> {
  const snippet = await primarySnippetSetting.getValue();
  if (!snippet) return;

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: (text: string) => navigator.clipboard.writeText(text),
      args: [snippet],
    });
  } catch {
    // Clipboard write may fail on restricted pages or if page doesn't have focus
  }
}

export default defineBackground(() => {
  // Handle extension icon click — toggle scan on/off
  // Note: This only fires if popup is NOT registered. Currently dead code
  // since default_popup is set, but kept for if popup is ever removed.
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    await handleScanToggle(tab.id, tab.url);
  });

  // Handle triggerScan message from popup — popup sends this then closes itself
  onMessage('triggerScan', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await handleScanToggle(tab.id, tab.url);
    }
  });

  // Handle keyboard shortcut commands
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (!tab?.id) return;

    switch (command) {
      case 'trigger-scan':
        await handleScanToggle(tab.id, tab.url);
        break;
      case 'quick-paste':
        await handleQuickPaste(tab.id);
        break;
    }
  });

  // Log scan mode on install to confirm storage is accessible from service worker
  browser.runtime.onInstalled.addListener(async () => {
    const mode = await scanModeSetting.getValue();
    console.log(`InvisibleUnicode: installed, scan mode = ${mode}`);
  });

  // Clear badge when tab navigates to a new page
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      void browser.action.setBadgeText({ text: '', tabId });
    }
  });
});
