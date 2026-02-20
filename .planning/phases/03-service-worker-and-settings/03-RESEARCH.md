# Phase 3: Service Worker and Settings - Research

**Researched:** 2026-02-20
**Domain:** Chrome commands API, service worker lifecycle, storage-based settings persistence, keyboard shortcuts, cold-start resilience
**Confidence:** HIGH

## Summary

Phase 3 adds three capabilities to the existing extension: configurable keyboard shortcuts (open popup, trigger scan, quick-paste snippet), persistent user settings (highlight color/style, scan mode preference), and service worker resilience against termination/restart. The existing codebase already has the background service worker (`entrypoints/background.ts`), storage definitions (`utils/storage.ts` with sync storage items for `highlightColor`, `scanMode`, `sensitivity`, `wrapperEnabled`), and a custom messaging system (`utils/messaging.ts`).

Keyboard shortcuts are implemented via the `commands` manifest key, configured through `wxt.config.ts`. Chrome provides a built-in UI at `chrome://extensions/shortcuts` for users to remap shortcuts. The `_execute_action` special command opens the popup/triggers `action.onClicked`, while custom commands fire `chrome.commands.onCommand`. The critical architectural constraint is that `_execute_action` fires `action.onClicked` only when NO popup is defined -- since Phase 4 adds a popup, the "open popup" shortcut must use `_execute_action` (which will naturally open the popup once it exists). The "trigger scan" command must be a custom command handled by `onCommand`.

For settings persistence, `wxt/utils/storage` (backed by `@wxt-dev/storage` v1.2.7) already provides `defineItem` with sync storage. The content script already reads `highlightColorSetting.getValue()` at scan time. To apply setting changes without page reload (SETT-01), the content script needs `storage.watch()` or `highlightColorSetting.watch()` to react to color changes and re-apply styles to existing highlight spans.

Service worker cold-start resilience requires: (1) all event listeners registered synchronously at the top level of `defineBackground()`'s main function, (2) no reliance on global variables for state that must survive termination, and (3) badge state re-derivation from storage or content script pings on restart. The current background.ts already follows good patterns (listeners in `defineBackground()`), but needs verification that `onCommand` listeners are also top-level.

**Primary recommendation:** Add `commands` to the manifest in `wxt.config.ts`, register `chrome.commands.onCommand` listener alongside the existing `action.onClicked` listener in background.ts, use `storage.watch()` in the content script for reactive highlight color updates, and avoid any global mutable state in the service worker.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KEYS-01 | User can open extension popup via configurable keyboard shortcut | Use `_execute_action` command in manifest `commands` with a `suggested_key`. When popup exists (Phase 4), this automatically opens it. Before popup exists, fires `action.onClicked`. Users remap at `chrome://extensions/shortcuts`. |
| KEYS-02 | User can trigger page scan via configurable keyboard shortcut | Define custom command (e.g. `"trigger-scan"`) in manifest `commands` with `suggested_key`. Handle in `chrome.commands.onCommand` listener in background.ts. Listener injects content script if needed and sends `startScan` message, same as current `action.onClicked` handler. |
| KEYS-03 | User can quick-paste primary snippet via configurable keyboard shortcut | Define custom command (e.g. `"quick-paste"`) in manifest `commands`. Handler in background.ts reads stored snippet from storage, then writes to clipboard. MV3 service workers cannot use `navigator.clipboard` directly -- must inject a content script or use offscreen document to call `navigator.clipboard.writeText()`. Alternatively, `document.execCommand('copy')` in an offscreen document. |
| SETT-01 | User can configure highlight color/style for detected invisible characters | `highlightColorSetting` already defined in `utils/storage.ts` with sync storage. Content script uses `highlightColorSetting.watch()` to detect changes and update `style.backgroundColor` on all existing `[data-iu-highlight]` spans without re-scanning. Settings UI comes in Phase 4 (popup). |
| SETT-02 | User can configure scan mode preference (persists across sessions) | `scanModeSetting` already defined in `utils/storage.ts` with sync storage and `'onDemand'` fallback. Value persists across sessions automatically via Chrome sync storage. Background service worker reads this on startup to determine behavior (on-demand vs auto-scan). |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.17 | Manifest generation including `commands`, background entrypoint, content script injection | Generates manifest.json from `wxt.config.ts`; handles MV2/MV3 command format conversion |
| wxt/utils/storage | built-in (@wxt-dev/storage 1.2.7) | `defineItem`, `getValue`, `setValue`, `watch` for settings | Already used for `highlightColorSetting`, `scanModeSetting`; `.watch()` enables reactive UI updates |
| wxt/browser | built-in | `browser.commands.onCommand`, `browser.action` APIs | Provides polyfilled browser API access |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom messaging (utils/messaging.ts) | n/a | `sendMessage`/`onMessage` for background-to-content communication | When triggering scan from keyboard shortcut via service worker |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom messaging in utils/messaging.ts | @webext-core/messaging `defineExtensionMessaging` | Custom messaging is already working and well-typed; switching would be churn with no benefit at this stage |
| Offscreen document for clipboard | Content script injection for clipboard write | Content script can use `navigator.clipboard.writeText()` directly if the page has focus; offscreen document needed only if no active tab is available |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/
  background.ts          # Add onCommand listener alongside existing onClicked
  content.ts             # Add storage.watch() for reactive highlight updates
utils/
  storage.ts             # Already has highlightColorSetting, scanModeSetting
  messaging.ts           # May need new message type for quick-paste
wxt.config.ts            # Add commands to manifest
```

### Pattern 1: Manifest Commands Declaration in WXT
**What:** Declare keyboard shortcut commands in `wxt.config.ts` manifest object.
**When to use:** Always -- WXT generates manifest.json from this config.
**Example:**
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/commands
// + https://wxt.dev/guide/essentials/config/manifest
export default defineConfig({
  manifest: {
    // ... existing config ...
    commands: {
      '_execute_action': {
        suggested_key: {
          default: 'Ctrl+Shift+U',
          mac: 'Command+Shift+U',
        },
        // description is ignored for _execute_action
      },
      'trigger-scan': {
        suggested_key: {
          default: 'Ctrl+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: 'Scan current page for invisible characters',
      },
      'quick-paste': {
        suggested_key: {
          default: 'Ctrl+Shift+V',
          mac: 'Command+Shift+V',
        },
        description: 'Paste primary invisible text snippet',
      },
    },
  },
});
```

### Pattern 2: onCommand Listener in Service Worker (Top-Level)
**What:** Register `chrome.commands.onCommand` synchronously inside `defineBackground()` main function.
**When to use:** For all custom commands (not `_execute_action`).
**Example:**
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/commands
export default defineBackground(() => {
  // MUST be top-level in main() -- not inside async callbacks or conditionals
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (!tab?.id) return;

    switch (command) {
      case 'trigger-scan':
        // Same logic as action.onClicked toggle
        await handleScanToggle(tab);
        break;
      case 'quick-paste':
        // Read snippet from storage, write to clipboard via content script
        await handleQuickPaste(tab);
        break;
    }
  });

  // Existing action.onClicked listener stays here too
  browser.action.onClicked.addListener(async (tab) => {
    // ... existing toggle logic ...
  });
});
```

### Pattern 3: Reactive Settings via storage.watch()
**What:** Content script watches for storage changes and applies them to existing highlights without re-scanning.
**When to use:** When SETT-01 requires setting changes to take effect on next scan without reload.
**Example:**
```typescript
// Source: https://wxt.dev/storage
import { highlightColorSetting } from '@/utils/storage';

// Inside content script main()
highlightColorSetting.watch((newColor) => {
  // Update all existing highlight spans
  const highlights = document.querySelectorAll('[data-iu-highlight]');
  for (const span of highlights) {
    (span as HTMLElement).style.backgroundColor = newColor;
  }
});
```

### Pattern 4: Stateless Service Worker (Cold-Start Safe)
**What:** Derive all state from storage or content script queries instead of global variables.
**When to use:** Always in MV3 service workers.
**Example:**
```typescript
// BAD: Global state lost on termination
let scanActivePerTab: Map<number, boolean> = new Map();

// GOOD: Derive state from badge (already done in current code)
const badgeText = await browser.action.getBadgeText({ tabId });
const isActive = badgeText !== '';

// GOOD: Read settings from storage (survives termination)
const scanMode = await scanModeSetting.getValue();
```

### Anti-Patterns to Avoid
- **Registering event listeners asynchronously:** `chrome.commands.onCommand.addListener` MUST be called synchronously in the top-level scope of the service worker's main function. If wrapped in `await` or inside a `.then()`, the listener will not be registered on cold start and events will be missed.
- **Storing scan state in global variables:** The service worker can terminate at any time. The current approach of using badge text as state indicator is correct. Do not add `Map` or `Set` objects at module scope for tracking per-tab state.
- **Using setTimeout for badge clear in service worker:** The existing `setTimeout(() => badge.clear(), 1500)` in `updateBadge()` could fail if the worker terminates within 1.5s. Use `chrome.alarms` for reliable delayed operations, or accept the rare edge case since badge clear is cosmetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcut management | Custom keyboard event listeners in content scripts | Chrome `commands` API via manifest | Users get `chrome://extensions/shortcuts` UI for free; works when extension popup is focused; cross-platform modifier key handling |
| Settings persistence | localStorage or IndexedDB wrapper | `wxt/utils/storage` `defineItem` with sync storage | Already set up; handles serialization, fallback values, cross-device sync, `.watch()` for reactive updates |
| Clipboard write from service worker | Attempting `navigator.clipboard` in SW | Offscreen document or content script injection | Service workers have no DOM; clipboard API requires secure context with user gesture or offscreen document |
| Service worker keep-alive | Custom heartbeat / periodic wake-up | Chrome's built-in event-driven wake-up | Service worker automatically wakes for `onCommand`, `onClicked`, `onInstalled` events; no keep-alive needed |

**Key insight:** Chrome's `commands` API handles the entire keyboard shortcut lifecycle (registration, conflict detection, user customization UI, cross-platform modifiers). Hand-rolling keyboard listeners in content scripts would miss shortcuts when the extension has no active content script on the page.

## Common Pitfalls

### Pitfall 1: Shortcut Conflicts with Browser/OS
**What goes wrong:** Suggested key combinations conflict with built-in browser shortcuts (e.g., Ctrl+S = Save, Ctrl+Shift+I = DevTools) and silently fail.
**Why it happens:** Chrome won't override browser shortcuts; the command simply doesn't register.
**How to avoid:** Test suggested shortcuts on Windows, Mac, and Linux. Use less common combinations like `Alt+Shift+U` or `Ctrl+Shift+Period`. Remember `Ctrl+Alt` combos are prohibited (AltGr key conflict). Always provide fallback: users can reassign at `chrome://extensions/shortcuts`.
**Warning signs:** Command works during development but users report it doesn't respond.

### Pitfall 2: _execute_action vs Custom Commands Confusion
**What goes wrong:** Defining `_execute_action` fires `action.onClicked` when there is NO popup, but opens the popup when one IS defined (Phase 4). Developer expects `onClicked` to always fire.
**Why it happens:** `_execute_action` does NOT fire `chrome.commands.onCommand`. It fires `action.onClicked` if no popup, or opens the popup if one exists.
**How to avoid:** Use `_execute_action` only for "open popup" (KEYS-01). Use a custom command for "trigger scan" (KEYS-02) since scan must work independently of popup state. Register both `onClicked` and `onCommand` listeners.
**Warning signs:** Scan shortcut stops working after popup is added in Phase 4.

### Pitfall 3: Event Listeners Not Registered on Cold Start
**What goes wrong:** `chrome.commands.onCommand` handler is not called when the service worker restarts after termination.
**Why it happens:** If `addListener` is inside an async function, `.then()`, or conditional block, Chrome cannot find it when dispatching the event to a freshly started worker.
**How to avoid:** ALL `addListener` calls must be synchronous and top-level within `defineBackground()` main. No conditional registration, no async wrapping.
**Warning signs:** Shortcuts work after install but stop working after idle period.

### Pitfall 4: Maximum 4 Suggested Shortcuts
**What goes wrong:** Defining more than 4 commands with `suggested_key` causes Chrome to ignore extras.
**Why it happens:** Chrome limits extensions to 4 suggested keyboard shortcuts. Users can add more manually.
**How to avoid:** Phase 3 needs exactly 3 commands (`_execute_action`, `trigger-scan`, `quick-paste`) -- well within the limit. Leave room for one more in future phases.
**Warning signs:** Fourth or fifth shortcut silently fails.

### Pitfall 5: Clipboard Write from Service Worker
**What goes wrong:** `navigator.clipboard.writeText()` throws in service worker context.
**Why it happens:** Service workers have no DOM and no secure browsing context required for Clipboard API.
**How to avoid:** For KEYS-03 (quick-paste), inject a tiny content script function that calls `navigator.clipboard.writeText()`, or create an offscreen document. Content script approach is simpler if there's an active tab with a non-restricted URL.
**Warning signs:** "Cannot read properties of undefined (reading 'writeText')" error in service worker console.

### Pitfall 6: storage.watch() Fires in All Contexts
**What goes wrong:** `highlightColorSetting.watch()` callback fires in both background and content script contexts. If both try to update DOM, errors occur in background (no DOM) or duplicate work in content.
**Why it happens:** Storage events are broadcast to all extension contexts listening on that key.
**How to avoid:** Only register DOM-related watch callbacks in the content script. Background should only watch settings that affect its own behavior (e.g., `scanModeSetting`).
**Warning signs:** "document is not defined" errors in service worker logs.

## Code Examples

Verified patterns from official sources:

### Manifest Commands Declaration
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/commands
// In wxt.config.ts manifest object:
commands: {
  '_execute_action': {
    suggested_key: {
      default: 'Ctrl+Shift+U',
      mac: 'Command+Shift+U',
    },
  },
  'trigger-scan': {
    suggested_key: {
      default: 'Alt+Shift+S',
      mac: 'Command+Shift+S',  // Ctrl maps to Command on Mac
    },
    description: 'Scan page for invisible characters',
  },
  'quick-paste': {
    suggested_key: {
      default: 'Alt+Shift+V',
      mac: 'Command+Shift+V',
    },
    description: 'Paste primary invisible text snippet',
  },
},
```

### Service Worker Command Handler (Cold-Start Safe)
```typescript
// Source: https://developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events
export default defineBackground(() => {
  // Synchronous, top-level registration -- survives cold start
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (!tab?.id) return;
    if (isRestrictedUrl(tab.url)) return;

    if (command === 'trigger-scan') {
      // Reuse exact same toggle logic as action.onClicked
      await handleScanToggle(tab.id, tab.url);
    } else if (command === 'quick-paste') {
      await handleQuickPaste(tab.id);
    }
  });

  // Existing action.onClicked stays top-level too
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    if (isRestrictedUrl(tab.url)) return;
    await handleScanToggle(tab.id, tab.url);
  });
});
```

### Quick-Paste via Content Script Injection
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/scripting
async function handleQuickPaste(tabId: number): Promise<void> {
  const snippet = await primarySnippetSetting.getValue();
  if (!snippet) return;

  // Inject a function that writes to clipboard in the page context
  await browser.scripting.executeScript({
    target: { tabId },
    func: (text: string) => {
      navigator.clipboard.writeText(text);
    },
    args: [snippet],
  });
}
```

### Reactive Highlight Color in Content Script
```typescript
// Source: https://wxt.dev/storage (defineItem .watch() API)
import { highlightColorSetting } from '@/utils/storage';

// In content script main():
highlightColorSetting.watch((newColor) => {
  const highlights = document.querySelectorAll<HTMLElement>('[data-iu-highlight]');
  for (const el of highlights) {
    el.style.backgroundColor = newColor;
  }
});
```

### Querying All Registered Commands
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/commands
// Useful for popup UI or debugging
const commands = await browser.commands.getAll();
for (const cmd of commands) {
  console.log(`${cmd.name}: ${cmd.shortcut || '(not set)'} — ${cmd.description}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `_execute_browser_action` (MV2) | `_execute_action` (MV3) | MV3 launch | WXT handles conversion automatically when targeting MV2 |
| Background pages with persistent state | Service workers with event-driven wake-up | MV3 launch | Must not rely on global variables; use storage for state |
| `chrome.browserAction.setBadge*` (MV2) | `chrome.action.setBadge*` (MV3) | MV3 launch | WXT `browser.action` handles this transparently |
| Manual listener re-registration | Top-level synchronous registration | MV3 best practice | Chrome wakes SW and dispatches to pre-registered listeners |
| `commands.update()` for programmatic shortcut changes | Only Firefox supports this | Firefox 63+ | Chrome has NO API to change shortcuts programmatically; user must use `chrome://extensions/shortcuts` |

**Deprecated/outdated:**
- `chrome.browserAction` / `chrome.pageAction`: Replaced by `chrome.action` in MV3
- Persistent background pages: Replaced by service workers in MV3
- `webextension-polyfill` for messaging: Project already uses direct `browser` from WXT

## Open Questions

1. **KEYS-03 Quick-Paste: Snippet Source**
   - What we know: The requirement says "primary snippet" which implies a stored encoded text. Phase 1 built the codec but no snippet storage is defined yet.
   - What's unclear: Where does the primary snippet come from? Is it the last encoded text? A user-pinned snippet?
   - Recommendation: Define a `primarySnippetSetting` in `utils/storage.ts` for Phase 3. Phase 5 (snippet management) can add full snippet library later. For now, store the most recently encoded text as the primary snippet.

2. **Keyboard Shortcut Defaults: Conflict Testing**
   - What we know: `Ctrl+Shift+U` is used by some Linux distributions for Unicode input. `Ctrl+Shift+S` may conflict with "Save As" in some apps.
   - What's unclear: Which shortcuts are safest across Windows/Mac/Linux.
   - Recommendation: Use `Alt+Shift+` prefix for custom commands (less conflict-prone). Use `Ctrl+Shift+U` for `_execute_action` since it's the most discoverable (U for Unicode). Accept that users can remap via `chrome://extensions/shortcuts`.

3. **Badge State After Service Worker Restart**
   - What we know: Badge text is per-tab and persists independently of the service worker. Chrome maintains badge state even when the SW terminates.
   - What's unclear: Whether badge state survives browser restart (likely not -- tabs are new).
   - Recommendation: Badge state does not need explicit persistence. On browser restart, tabs load fresh and no scan is active. The current approach of using badge text as scan-active indicator is sound.

4. **SETT-01 Timing: "Takes Effect on Next Scan" vs "Immediately"**
   - What we know: Success criterion says "takes effect on the next scan without requiring a page reload." The `storage.watch()` approach can also update existing highlights immediately.
   - What's unclear: Should existing highlights update immediately when color changes, or only on next scan?
   - Recommendation: Implement both: `storage.watch()` updates existing highlights immediately AND next scan uses new color. This exceeds the requirement and provides better UX at minimal cost.

## Sources

### Primary (HIGH confidence)
- [Chrome Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands) - Complete API reference for `commands` manifest key, `onCommand`, `_execute_action`, `getAll()`, keyboard shortcut syntax
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Termination timeouts (30s idle, 5min single request), cold start behavior, state persistence requirements
- [MDN commands manifest key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands) - Cross-browser compatibility matrix, Firefox-specific features
- [WXT Storage](https://wxt.dev/storage) - `defineItem`, `.watch()`, `.getValue()`, `.setValue()`, fallback, versioning
- [WXT Manifest Config](https://wxt.dev/guide/essentials/config/manifest) - How to add `commands` in `wxt.config.ts`

### Secondary (MEDIUM confidence)
- [Service Worker Termination Testing](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer) - Puppeteer-based cold-start testing patterns
- [Longer ESW Lifetimes Blog](https://developer.chrome.com/blog/longer-esw-lifetimes) - Chrome 114+ improvements to SW lifetime

### Tertiary (LOW confidence)
- Keyboard shortcut conflict assessment based on general OS knowledge (not empirically tested across all platforms)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new packages needed; all APIs are well-documented Chrome/WXT features
- Architecture: HIGH - Patterns verified against Chrome official docs and existing codebase structure
- Pitfalls: HIGH - Cold-start and event registration issues are well-documented by Chrome team
- KEYS-03 clipboard: MEDIUM - Offscreen document vs content script injection approach needs validation during implementation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable APIs, unlikely to change)
