/**
 * Background service worker for Stegano extension.
 *
 * Handles:
 * - browser.action.onClicked toggle (scan on / scan off)
 * - browser.commands.onCommand for keyboard shortcuts (trigger-scan)
 * - Content script injection on first click
 * - Badge management (finding count, checkmark, clear on navigation)
 * - Restricted URL filtering (chrome://, about:, etc.)
 * - Context menu for snippet pasting
 */

import { browser } from 'wxt/browser';
import { onMessage, sendMessage } from '@/utils/messaging';
import { scanModeSetting, snippetsSetting, snippetPasteModeSetting, passwordsSetting } from '@/utils/storage';
import { encryptToInvisible } from '@/utils/crypto';
import { decode } from '@/utils/codec';

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
      console.error('Stegano: scan failed', err);
    }
  }
}

/**
 * Build (or rebuild) the context menu for snippet pasting.
 * Called on install and whenever snippets change in storage.
 */
async function buildSnippetMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  const snippets = await snippetsSetting.getValue();
  if (snippets.length === 0) return;

  browser.contextMenus.create({
    id: 'stegano-snippets',
    title: 'Stegano - Paste Snippet',
    contexts: ['all'],
  });

  for (const snippet of snippets) {
    browser.contextMenus.create({
      id: `stegano-snippet-${snippet.id}`,
      parentId: 'stegano-snippets',
      title: snippet.name,
      contexts: ['all'],
    });
  }
}

export default defineBackground(() => {
  /**
   * Handle extension icon click -- toggle scan on/off.
   *
   * This listener only fires when no popup is registered (default_popup unset).
   * Currently inactive because the popup is set, but retained intentionally so
   * that removing the popup automatically re-enables click-to-scan behavior.
   */
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
  // Note: `tab` param may be undefined in MV3; fall back to querying active tab
  browser.commands.onCommand.addListener(async (command, tab) => {
    const activeTab = tab?.id
      ? tab
      : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    if (!activeTab?.id) return;

    switch (command) {
      case 'trigger-scan':
        await handleScanToggle(activeTab.id, activeTab.url);
        break;
    }
  });

  // Build context menus and confirm storage on install
  browser.runtime.onInstalled.addListener(async () => {
    const mode = await scanModeSetting.getValue();
    void mode; // Confirm storage is accessible from service worker on install
    await buildSnippetMenus();
  });

  // Rebuild context menus when snippets change
  snippetsSetting.watch(() => {
    void buildSnippetMenus();
  });

  // Handle context menu clicks for snippet paste/copy
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const menuId = String(info.menuItemId);
    if (!menuId.startsWith('stegano-snippet-')) return;

    const snippetId = menuId.replace('stegano-snippet-', '');
    const snippets = await snippetsSetting.getValue();
    const snippet = snippets.find((s) => s.id === snippetId);
    if (!snippet || !tab?.id) return;

    const mode = await snippetPasteModeSetting.getValue();

    // Determine content to send — encrypt if snippet has a linked password
    let contentToSend = snippet.content;
    if (snippet.passwordId) {
      const passwords = await passwordsSetting.getValue();
      const linkedPw = passwords.find((p) => p.id === snippet.passwordId);
      if (linkedPw) {
        const plaintext = decode(snippet.content);
        contentToSend = await encryptToInvisible(plaintext, linkedPw.password);
      }
      // If password was deleted (not found), fall back to unencrypted paste
    }

    // Try sending to content script
    try {
      await sendMessage('insertSnippet', { content: contentToSend, mode }, tab.id);
    } catch {
      // Content script not loaded — inject and retry
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/content.js'],
        });
        await sendMessage('insertSnippet', { content: contentToSend, mode }, tab.id);
      } catch {
        // Fallback: copy to clipboard via scripting API (restricted page)
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text: string) => navigator.clipboard.writeText(text),
            args: [contentToSend],
          });
        } catch {
          // Restricted page — fail silently
        }
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
