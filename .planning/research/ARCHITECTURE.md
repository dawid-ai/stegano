# Architecture Research

**Domain:** Chrome Manifest V3 Browser Extension (Unicode text encoding/detection)
**Researched:** 2026-02-19
**Confidence:** HIGH — all claims verified against official Chrome developer documentation

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHROME BROWSER UI                             │
│  ┌─────────────────────────────────┐  ┌──────────────────────────┐  │
│  │         TOOLBAR ICON            │  │       BADGE (count)      │  │
│  │  (click → opens Popup page)     │  │  set by Service Worker   │  │
│  └────────────────┬────────────────┘  └──────────────────────────┘  │
│                   │ user click                                        │
│  ┌────────────────▼────────────────────────────────────────────┐     │
│  │                     POPUP PAGE (popup.html)                  │     │
│  │  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐   │     │
│  │  │  Encode Tab  │  │   Decode Tab   │  │  Snippets Tab  │   │     │
│  │  │  (converter) │  │  (converter)   │  │  (saved clips) │   │     │
│  │  └──────────────┘  └────────────────┘  └────────────────┘   │     │
│  │  popup.js — chrome.runtime.sendMessage / chrome.storage      │     │
│  └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              SERVICE WORKER (background.js — Event-Driven)           │
│  Handles: badge updates, commands, context menus, alarms             │
│  Wakes on event → processes → terminates (30s idle timeout)         │
│  Persists data via chrome.storage (NOT in-memory globals)            │
└────────────┬──────────────────────────────┬────────────────────────┘
             │ chrome.tabs.sendMessage       │ chrome.action.setBadgeText
             │ (to specific tabId)           │ chrome.commands.onCommand
             ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│             CONTENT SCRIPT (content.js — Per Tab, ISOLATED world)    │
│  ┌──────────────────────────┐   ┌─────────────────────────────┐     │
│  │    Page Scanner          │   │    Inline Replacer           │     │
│  │  TreeWalker → text nodes │   │  DOM mutation / highlight    │     │
│  │  detect invisible chars  │   │  wrap spans, reveal chars    │     │
│  └──────────────────────────┘   └─────────────────────────────┘     │
│  Runtime: chrome.runtime.sendMessage (to service worker)             │
│  Injected: declaratively (manifest) OR programmatically (scripting)  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   CHROME STORAGE (Persistent State)                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ storage.sync   │  │  storage.local  │  │  storage.session    │  │
│  │ User settings  │  │  Saved snippets │  │  Scan results cache │  │
│  │ (sync'd across │  │  (large, local) │  │  (tab-lifetime)     │  │
│  │  devices)      │  │                 │  │                     │  │
│  └────────────────┘  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Popup** (popup.html + popup.js) | Encode/decode UI, snippet management UI, trigger page scan from UI | Service Worker (via runtime.sendMessage), Content Script (via tabs.sendMessage), chrome.storage directly |
| **Service Worker** (background.js) | Badge text/color, keyboard shortcut handling, context menu registration, alarm-based cleanup | Popup (responds to messages), Content Script (sends commands via tabs.sendMessage), chrome.action API, chrome.storage |
| **Content Script** (content.js) | Page DOM scanning for invisible Unicode, inline text replacement, result highlighting | Service Worker (sends scan results via runtime.sendMessage), Popup (receives scan trigger via runtime.onMessage) |
| **chrome.storage.sync** | User preferences (auto-scan toggle, highlight color, default encoding mode) | Read/written by Popup and Service Worker |
| **chrome.storage.local** | Saved snippets (named encode/decode pairs), larger data that should not sync | Read/written by Popup; read by Content Script if needed |
| **chrome.storage.session** | Per-session scan results cache, last-known badge count per tab | Written by Content Script/Service Worker, read by Popup on open |

## Recommended Project Structure

```
extension/
├── manifest.json               # MV3 manifest — declares all components
├── background.js               # Service worker entry point (ES module w/ "type":"module")
├── content.js                  # Content script (injected into pages)
├── popup/
│   ├── popup.html              # Popup page shell
│   ├── popup.js                # Popup logic (bundled by Vite/WXT)
│   └── popup.css               # Popup styles
├── src/
│   ├── core/
│   │   ├── unicode.js          # Pure functions: encode/decode Tags block + ZWC
│   │   ├── scanner.js          # TreeWalker-based DOM scanner (used in content.js)
│   │   └── constants.js        # Unicode range definitions, message type strings
│   ├── shared/
│   │   ├── storage.js          # Typed wrappers around chrome.storage
│   │   └── messaging.js        # Message type constants + typed send helpers
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── _locales/                   # Optional i18n
    └── en/
        └── messages.json
```

### Structure Rationale

- **src/core/**: Zero-dependency pure functions. `unicode.js` and `scanner.js` are shared between popup and content script — keep them framework-free so they can be imported by both bundle targets.
- **src/shared/messaging.js**: Centralizing message type constants prevents typos across the content-script/popup/service-worker boundary. Both sides import the same constants.
- **background.js at root**: Chrome requires the service worker path to be relative to the extension root; placing it at root avoids path confusion.
- **popup/ folder**: Kept separate because build tools (Vite/WXT) produce separate bundles per entry point. Popup is a full mini-app; isolation prevents accidental cross-contamination.

## Architectural Patterns

### Pattern 1: Message-Based Component Coordination

**What:** All cross-component communication uses the chrome.runtime messaging API. No shared memory, no globals across process boundaries.

**When to use:** Every time Popup or Service Worker needs to trigger content script action (scan, replace), or when Content Script needs to report results back.

**Trade-offs:** Async by nature (all messages are async). Adds boilerplate but is the only supported cross-process communication in MV3.

**Example:**
```javascript
// shared/messaging.js — define message types once
export const MSG = {
  SCAN_PAGE:     'SCAN_PAGE',
  SCAN_RESULT:   'SCAN_RESULT',
  REPLACE_INLINE:'REPLACE_INLINE',
  GET_SETTINGS:  'GET_SETTINGS',
};

// popup.js — trigger a page scan
async function requestScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.tabs.sendMessage(tab.id, { type: MSG.SCAN_PAGE });
  displayResults(result.findings);
}

// content.js — respond to scan request
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MSG.SCAN_PAGE) {
    const findings = scanPageForInvisibleUnicode();
    sendResponse({ findings });
  }
  return true; // keep channel open for async response
});
```

### Pattern 2: Storage-First State (No Global Variables in Service Worker)

**What:** The service worker must not store state in global variables because it terminates after 30 seconds of inactivity. All state that needs to outlive a single event cycle goes to `chrome.storage`.

**When to use:** Badge counts, user settings, snippet data, scan result caches — anything that must survive service worker restart.

**Trade-offs:** Adds async read overhead on each wake. For this project (small data, infrequent reads) this is negligible.

**Example:**
```javascript
// WRONG — global variable lost on service worker termination
let scanCount = 0;

// CORRECT — persist to storage, read back on next wake
async function incrementBadgeCount(tabId) {
  const data = await chrome.storage.session.get(`count_${tabId}`);
  const count = (data[`count_${tabId}`] ?? 0) + 1;
  await chrome.storage.session.set({ [`count_${tabId}`]: count });
  await chrome.action.setBadgeText({ text: String(count), tabId });
}
```

### Pattern 3: TreeWalker for Efficient DOM Text Scanning

**What:** Use `document.createTreeWalker` with `NodeFilter.SHOW_TEXT` to visit only text nodes without walking the entire element tree manually. Filter nodes whose text contains characters in the Tags block (U+E0000–U+E007F) or zero-width characters.

**When to use:** The page scan step in `content.js`. Must be fast to avoid blocking the page thread. TreeWalker is synchronous and extremely fast for this use case.

**Trade-offs:** Synchronous execution blocks the page JS thread briefly. For very large DOMs (100k+ text nodes) consider chunking with `requestIdleCallback`. For typical pages this is fine.

**Example:**
```javascript
// src/core/scanner.js
const INVISIBLE_REGEX = /[\uE0000-\uE007F\u200B\u200C\u200D\u2060\uFEFF]/u;

export function scanForInvisibleUnicode(rootNode = document.body) {
  const findings = [];
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (INVISIBLE_REGEX.test(node.textContent)) {
      findings.push({
        node,
        parentElement: node.parentElement?.tagName,
        sample: node.textContent.slice(0, 100),
      });
    }
  }
  return findings;
}
```

### Pattern 4: Declarative + Programmatic Content Script Injection

**What:** Declare content script in `manifest.json` for automatic injection on all pages (passive scanning). Use `chrome.scripting.executeScript` from service worker for on-demand injection into tabs that weren't matched at load time.

**When to use:** Declarative for "always scan" mode. Programmatic when user activates the extension on a tab opened before the extension was installed, or when auto-scan is off.

**Trade-offs:** Declarative injection requires broad host permissions (`<all_urls>` or specific matches). Programmatic injection with `activeTab` is less invasive and requires user interaction to trigger.

**Example:**
```javascript
// Service worker — inject on-demand when user triggers via popup/shortcut
async function ensureContentScriptInjected(tabId) {
  try {
    // Ping first — if content script already there, it responds
    await chrome.tabs.sendMessage(tabId, { type: MSG.PING });
  } catch {
    // Not injected yet — inject now
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  }
}
```

## Data Flow

### Encode/Decode Flow (Popup-Only, No Content Script Needed)

```
User types text in Popup
    ↓
popup.js calls unicode.encode(text) / unicode.decode(text)
    ↓ (pure function, no messaging)
Encoded/decoded result shown in Popup textarea
    ↓ (optional)
User clicks "Save Snippet"
    ↓
chrome.storage.local.set({ snippets: [...] })
```

### Page Scan Flow

```
User clicks "Scan Page" in Popup  OR  keyboard shortcut fires
    ↓
popup.js / service worker → chrome.tabs.sendMessage(tabId, SCAN_PAGE)
    ↓
content.js onMessage handler wakes
    ↓
scanner.js TreeWalker traverses DOM text nodes
    ↓
content.js → sendResponse({ findings: [...] })
    ↓
Service Worker: chrome.action.setBadgeText({ text: count, tabId })
    ↓
Popup: displays list of findings with location hints
```

### Inline Replacement Flow

```
User selects a finding in Popup → clicks "Reveal" or "Strip"
    ↓
popup.js → chrome.tabs.sendMessage(tabId, { type: REPLACE_INLINE, nodeIndex })
    ↓
content.js locates stored node reference
    ↓
content.js wraps node in <span> with highlight style OR strips invisible chars
    ↓
content.js → sendResponse({ success: true })
```

### Keyboard Shortcut Flow

```
User presses Ctrl+Shift+U (or configured shortcut)
    ↓
chrome.commands.onCommand fires in Service Worker
    ↓
Service Worker queries active tab → calls ensureContentScriptInjected(tabId)
    ↓
Service Worker → chrome.tabs.sendMessage(tabId, SCAN_PAGE)
    ↓
[same as Page Scan Flow above from content.js step]
```

### Settings Persistence Flow

```
User changes setting in Popup (e.g., "auto-scan on load")
    ↓
popup.js → chrome.storage.sync.set({ settings: { autoScan: true } })
    ↓ (storage.onChanged fires)
Service Worker (if awake) picks up change for badge logic
Content Script reads setting on next injection via chrome.storage.sync.get
```

## Scaling Considerations

This is a browser extension — traditional "scale" (users, servers) doesn't apply. Relevant scaling concerns are about page complexity and data volume per user.

| Concern | Small pages (<1k nodes) | Large pages (10k–100k nodes) | Extreme (500k+ nodes) |
|---------|-------------------------|------------------------------|----------------------|
| DOM scan speed | Synchronous TreeWalker, instant | Synchronous, may cause brief jank | Chunk with requestIdleCallback |
| Finding storage | In-memory in content script, passed via message | In-memory fine | Consider storage.session for persistence |
| Badge update | Per scan, immediate | Per scan, immediate | Throttle if auto-scanning on mutations |
| Snippet storage | storage.local (10MB limit) | Fine for hundreds of snippets | Fine for thousands; well under quota |
| Message payload | JSON findings array, tiny | May grow large; cap at 64MiB limit | Paginate findings, stream in batches |

### Scaling Priorities

1. **First concern: scan jank on massive DOMs.** TreeWalker is fast, but synchronous. For pages with 50k+ text nodes, chunk traversal using `requestIdleCallback` with a batch size of ~500 nodes per idle frame.
2. **Second concern: stale node references.** Content scripts store references to DOM nodes found during scan. If the page mutates between scan and replacement, references may be stale. Use a WeakRef or re-query by XPath before replacement.

## Anti-Patterns

### Anti-Pattern 1: Storing Scan State in Service Worker Global Variables

**What people do:** `let lastScanResults = [];` at the top of background.js, updated when content script reports findings.

**Why it's wrong:** The service worker terminates after 30 seconds of inactivity. The next time any event fires (badge click, shortcut), the service worker restarts with a fresh module scope. `lastScanResults` is empty again. Users see inconsistent badge counts and lost results.

**Do this instead:** Store scan results in `chrome.storage.session` (cleared on browser close, fast, in-memory) keyed by tabId. Read from storage on every service worker wake.

### Anti-Pattern 2: Direct DOM Manipulation from the Popup

**What people do:** Try to access `document` from popup.js to read/modify the current tab's page.

**Why it's wrong:** The popup's `document` is the popup's own HTML document, completely isolated from the tab's page. This is a hard browser security boundary.

**Do this instead:** Send a message to the content script running in the tab (`chrome.tabs.sendMessage`), which has actual access to the page DOM.

### Anti-Pattern 3: Using `eval()` or `innerHTML` on User-Provided Text

**What people do:** Display decoded Unicode text using `element.innerHTML = decodedText` to support rich formatting.

**Why it's wrong:** The decoded text is user-controlled input. Invisible Unicode could encode malicious HTML/JS. MV3 CSP also blocks eval. This is an XSS vector.

**Do this instead:** Always use `element.textContent = decodedText`. If formatting is needed, parse and sanitize with an allowlist before touching innerHTML.

### Anti-Pattern 4: Assuming Content Script Is Injected

**What people do:** Popup sends a message to the content script without checking whether it's present on the current tab (`tabs.sendMessage` throws if no listener).

**Why it's wrong:** The extension may not have been loaded when the tab was opened (extension just installed), the page may be a chrome:// URL where injection is blocked, or auto-scan may be off. Unhandled errors degrade UX.

**Do this instead:** Wrap `tabs.sendMessage` in try/catch. On failure, call `chrome.scripting.executeScript` to inject, then retry. Always validate that the page URL is injectable (not `chrome://`, `about:`, or Chrome Web Store pages).

### Anti-Pattern 5: Requesting `<all_urls>` Host Permission Upfront

**What people do:** Declare `"host_permissions": ["<all_urls>"]` for maximum scan coverage.

**Why it's wrong:** Chrome Web Store review flags broad permissions. Users see a scary permission prompt. Many users reject extensions with `<all_urls>`.

**Do this instead:** Start with `"activeTab"` permission + `chrome.scripting` for on-demand injection. Users see the extension only accesses the current tab when they explicitly activate it. Add `<all_urls>` as an optional permission that users can grant for auto-scan mode.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Chrome Web Store | Extension package (zip of extension dir) uploaded via Developer Dashboard | No runtime API integration; publishing is a manual deployment step |
| Chrome Sync | `chrome.storage.sync` | 102KB total quota, 8KB per key; suitable for settings only, not snippet corpus |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Popup ↔ Service Worker | `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` | Short-lived messages only; no long-lived port needed for this project |
| Popup ↔ Content Script | `chrome.tabs.sendMessage` (Popup → CS) + `chrome.runtime.sendMessage` (CS → extension) | Must always query active tab first to get `tabId`; popup cannot be open without an active tab |
| Service Worker ↔ Content Script | `chrome.tabs.sendMessage` (SW → CS) + `chrome.runtime.onMessage` (CS → SW) | SW must get tabId from event context or query `chrome.tabs.query` |
| Any Component ↔ Storage | `chrome.storage.*` async API | All components can read/write; coordinate via `storage.onChanged` events if needed |
| Content Script ↔ Page DOM | Direct JS DOM access (ISOLATED world) | Content script runs in its own JS context; page scripts cannot see content script variables |

## Build Order Implications

The component dependency graph dictates this build sequence:

```
1. src/core/unicode.js          ← no dependencies, pure functions
2. src/core/scanner.js          ← no dependencies, DOM API only
3. src/shared/constants.js      ← no dependencies
4. src/shared/storage.js        ← depends on constants
5. src/shared/messaging.js      ← depends on constants
6. content.js                   ← depends on core/scanner, shared/messaging
7. background.js                ← depends on shared/messaging, shared/storage
8. popup/popup.js               ← depends on core/unicode, shared/messaging, shared/storage
9. manifest.json                ← references all built files by path
```

**Recommended phase ordering for roadmap:**
- Phase 1: Core unicode functions + manifest skeleton (testable in isolation, no extension APIs)
- Phase 2: Content script + scanner (testable with basic page injection)
- Phase 3: Service worker + badge (wires up event handling)
- Phase 4: Popup UI (depends on messaging contracts from Phases 2–3 being stable)
- Phase 5: Snippet management (depends on storage layer from Phase 3)
- Phase 6: Polish — optional permissions, keyboard shortcuts, context menus

Starting with pure `core/` functions means the most critical logic (Unicode encoding/decoding, character detection) is verified before any extension plumbing is touched.

## Sources

- Chrome Developers: Extension service worker lifecycle — https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle (HIGH confidence — official)
- Chrome Developers: Content scripts — https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts (HIGH confidence — official)
- Chrome Developers: Message passing — https://developer.chrome.com/docs/extensions/develop/concepts/messaging (HIGH confidence — official)
- Chrome Developers: chrome.storage API — https://developer.chrome.com/docs/extensions/reference/api/storage (HIGH confidence — official)
- Chrome Developers: chrome.action API — https://developer.chrome.com/docs/extensions/reference/api/action (HIGH confidence — official)
- Chrome Developers: chrome.commands API — https://developer.chrome.com/docs/extensions/reference/api/commands (HIGH confidence — official)
- MDN: TreeWalker — https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker (HIGH confidence — official web standard)
- Chrome Developers: chrome.scripting API — https://developer.chrome.com/docs/extensions/reference/api/scripting (HIGH confidence — official)

---
*Architecture research for: Chrome MV3 Extension (InvisibleUnicode)*
*Researched: 2026-02-19*
