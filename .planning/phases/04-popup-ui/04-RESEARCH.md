# Phase 4: Popup UI - Research

**Researched:** 2026-02-20
**Domain:** WXT popup entrypoint with Preact, Tailwind CSS v4, clipboard API in extension popup, encode/decode converter UI
**Confidence:** HIGH

## Summary

Phase 4 builds the popup UI -- the primary user-facing interface for encoding text to invisible Unicode and decoding it back. The popup is a self-contained mini-app that imports the existing `encode()` and `decode()` functions from `utils/codec.ts` directly (no messaging needed for conversion -- it is a pure function call). The popup runs in an extension page context with full access to `navigator.clipboard.writeText()` and Chrome storage APIs.

The codebase is well-prepared for this phase. The `wxt.config.ts` already configures `@preact/preset-vite` and `@tailwindcss/vite` plugins, Preact is installed (`preact@^10.28.4`), and the `_execute_action` command in the manifest will automatically open the popup once it is defined. The `action: {}` in the manifest means no popup is set yet -- adding the popup entrypoint will cause WXT to auto-generate the `default_popup` field. The existing `action.onClicked` listener in `background.ts` fires ONLY when no popup is defined, so once the popup entrypoint exists, that listener will stop firing. This is expected and correct -- the popup replaces the click-to-scan behavior with a full converter UI.

The clipboard strategy for the popup is straightforward: `navigator.clipboard.writeText()` works directly inside extension popup pages because they are secure contexts with user activation (the user just clicked). No offscreen documents or content script injection needed. The fallback for CONV-04 uses a textarea-based `document.execCommand('copy')` approach or a "select all" visual hint, providing coverage for edge cases where the async Clipboard API might fail.

**Primary recommendation:** Create a `entrypoints/popup/` directory with `index.html`, `main.tsx`, `App.tsx`, and `style.css`. Use Preact's `render()` function (not createRoot) to mount the app. Use Tailwind CSS v4 via `@import "tailwindcss"` in the CSS file. Import `encode`/`decode` from `utils/codec.ts` directly. Use `navigator.clipboard.writeText()` for copy with `document.execCommand('copy')` textarea fallback.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | User can type or paste text and get invisible Unicode encoded output (Tags block mapping) | Import `encode()` from `utils/codec.ts`. Call on input change or button click. Display result in a readonly textarea. `encode()` throws on non-ASCII input -- catch and display error inline. |
| CONV-02 | User can paste invisible Unicode text and get decoded plaintext | Import `decode()` from `utils/codec.ts`. Call on input change. Display decoded plaintext in a readonly output area. Invisible chars paste correctly into textarea elements. |
| CONV-03 | User can copy encoded output to clipboard with visual confirmation | Use `navigator.clipboard.writeText(encodedText)` in the popup (secure context, user activation from click). Show "Copied!" text/icon for 1.5-2 seconds, then revert. |
| CONV-04 | User can copy via manual button as fallback | Create a hidden textarea, set its value to encoded text, select it, call `document.execCommand('copy')`. Alternatively, show a "Select All" button that selects the output textarea text for manual Ctrl+C. Both approaches work in extension popup context. |
| CONV-05 | User can clear/reset both input fields | Single "Reset" or "Clear" button that sets both input and output textareas to empty strings. Reset component state (clear error messages, hide copy confirmation). |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.17 | Popup entrypoint auto-detection from `entrypoints/popup/index.html`; manifest `default_popup` generation | File-based entrypoints -- just create the directory |
| Preact | 10.28.4 | Lightweight UI framework for popup component tree | Already installed; 3KB gzipped vs 40KB React; `@preact/preset-vite` already in `wxt.config.ts` |
| @preact/preset-vite | ^2.10.3 | Vite plugin enabling JSX/TSX with Preact | Already configured in `wxt.config.ts` |
| Tailwind CSS 4.x | ^4.2.0 (via @tailwindcss/vite) | Utility-first CSS for popup styling | Already installed as devDependency; plugin already in `wxt.config.ts`; v4 uses `@import "tailwindcss"` -- no config file needed |
| utils/codec.ts | n/a | `encode()` and `decode()` pure functions | Already built in Phase 1; direct import, no messaging overhead |
| utils/storage.ts | n/a | `wrapperEnabledSetting`, `sensitivitySetting` for encode/decode options | Already defined; popup reads/writes directly |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wxt/browser | built-in | Access to `browser.tabs.query()` if popup needs to trigger content script actions | Only if popup adds a "Scan Page" button (not required by Phase 4 requirements, but natural UX addition) |
| utils/messaging.ts | n/a | `sendMessage()` for popup-to-content-script communication | Only if scan trigger is added to popup UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Preact `render()` | Preact `hydrate()` | `render()` is correct for client-side-only mounting; `hydrate()` is for SSR rehydration -- not applicable |
| Direct `encode()`/`decode()` import | Message to background service worker | Adds async overhead and messaging complexity for zero benefit; codec is a pure function with no browser API dependency |
| Tailwind CSS v4 | Inline styles or plain CSS | Tailwind is already configured; provides consistent utility classes, responsive design, dark mode support with minimal CSS |
| `navigator.clipboard.writeText()` | `document.execCommand('copy')` only | Clipboard API is modern, Promise-based, works in popup secure context; execCommand is deprecated fallback |

**Installation:** No new packages needed. Everything is already installed.

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/
  popup/
    index.html       # HTML shell with <div id="root"> and <script type="module" src="./main.tsx">
    main.tsx          # Preact render() mount point
    App.tsx           # Root component with encode/decode tabs or sections
    style.css         # @import "tailwindcss" + custom popup styles
  background.ts      # Existing -- no changes needed for Phase 4 core requirements
  content.ts         # Existing -- no changes needed
utils/
  codec.ts           # Existing encode()/decode() -- imported by App.tsx
  storage.ts         # Existing settings -- imported by App.tsx for sensitivity/wrapper prefs
  clipboard.ts       # NEW: clipboard write helper with async API + execCommand fallback
```

### Pattern 1: WXT Popup Entrypoint with Preact
**What:** Create `entrypoints/popup/` directory with `index.html` as the entry. WXT auto-detects this and sets `manifest.action.default_popup`.
**When to use:** Always -- this is how WXT discovers popup entrypoints.
**Example:**
```html
<!-- entrypoints/popup/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InvisibleUnicode</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

```tsx
// entrypoints/popup/main.tsx
import { render } from 'preact';
import { App } from './App';
import './style.css';

render(<App />, document.getElementById('root')!);
```

```css
/* entrypoints/popup/style.css */
@import "tailwindcss";
```

### Pattern 2: Encode/Decode UI with Direct Codec Import
**What:** Import `encode()` and `decode()` directly into the popup component. No messaging, no service worker involvement.
**When to use:** For all CONV-01 and CONV-02 functionality.
**Example:**
```tsx
// Source: utils/codec.ts (project codebase)
import { encode, decode } from '@/utils/codec';
import { useState } from 'preact/hooks';

function EncodeSection() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  function handleEncode() {
    try {
      setError('');
      setOutput(encode(input));
    } catch (err) {
      setError((err as Error).message);
      setOutput('');
    }
  }

  return (
    <div>
      <textarea value={input} onInput={(e) => setInput(e.currentTarget.value)} />
      <button onClick={handleEncode}>Encode</button>
      {error && <p class="text-red-500">{error}</p>}
      <textarea readOnly value={output} />
    </div>
  );
}
```

### Pattern 3: Clipboard Write with Fallback
**What:** Try `navigator.clipboard.writeText()` first; if it fails, fall back to textarea + `document.execCommand('copy')`.
**When to use:** For CONV-03 (primary copy) and CONV-04 (manual fallback).
**Example:**
```typescript
// utils/clipboard.ts
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: textarea + execCommand
    return execCommandCopy(text);
  }
}

function execCommandCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}
```

### Pattern 4: Copy Confirmation with Auto-Clear
**What:** Show visual feedback ("Copied!") after clipboard write, auto-clear after delay.
**When to use:** For CONV-03 copy confirmation UX.
**Example:**
```tsx
import { useState, useRef } from 'preact/hooks';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number>(0);

  async function handleCopy() {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
```

### Pattern 5: Popup Dimensions via CSS
**What:** Set explicit dimensions on the popup body to avoid Chrome's auto-sizing quirks. Chrome popup max is 800x600, min is 25x25.
**When to use:** Always for extension popups.
**Example:**
```css
/* Set in style.css or via Tailwind classes on root element */
body {
  width: 380px;
  min-height: 480px;
}
```

### Anti-Patterns to Avoid
- **Using `innerHTML` to display decoded text:** Decoded content is user-controlled input. Always use `textContent` or Preact's text interpolation (JSX `{text}`) which auto-escapes. Never use `dangerouslySetInnerHTML`.
- **Messaging for encode/decode:** The codec is a pure function. Sending messages to the background service worker adds latency (SW may need cold-start wake-up) for zero benefit. Import directly.
- **Using React imports with Preact:** The project uses `@preact/preset-vite` which provides JSX transforms. Import from `preact` and `preact/hooks` directly, not from `react`. The `preact/compat` layer is NOT needed unless using a React-specific library.
- **Not setting popup width:** Without explicit width, Chrome auto-sizes the popup to content, which can result in jittery resizing as the user types. Set a fixed width.
- **Real-time encoding on every keystroke:** Calling `encode()` on every `onInput` event is fine for small texts but may cause jank for very long inputs. Use a button-triggered encode, or debounce the input handler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard write + fallback | Custom clipboard manager | Simple `navigator.clipboard.writeText()` + textarea `execCommand('copy')` fallback | Two well-known patterns cover all cases; no library needed for this |
| Unicode encode/decode | Popup-specific encoding logic | `encode()` / `decode()` from `utils/codec.ts` | Already built, tested, handles edge cases (BOM, wrappers, sensitivity levels) |
| CSS framework/reset | Custom CSS reset or component library | Tailwind CSS v4 (already installed) | Utility-first, zero config in v4, includes preflight reset |
| Form state management | Redux, Zustand, or other state library | Preact `useState` hooks | Popup state is simple (two text fields, a boolean, an error string); no need for external state management |
| Settings read/write | Direct `chrome.storage` calls | `utils/storage.ts` `defineItem` wrappers | Already typed, with `.getValue()`, `.setValue()`, `.watch()` |

**Key insight:** The popup is a simple two-panel converter with copy/clear buttons. Total component state is ~5 values. No external state management or complex form libraries are needed. Preact hooks + direct codec imports are sufficient.

## Common Pitfalls

### Pitfall 1: action.onClicked Stops Firing After Popup Is Added
**What goes wrong:** The `action.onClicked` listener in `background.ts` no longer fires because WXT auto-generates `default_popup` in the manifest once `entrypoints/popup/index.html` exists.
**Why it happens:** Chrome's `action.onClicked` only fires when there is NO popup. Once a popup URL is set, clicking the icon opens the popup instead.
**How to avoid:** This is expected behavior. The popup replaces the click-to-scan UX. The `trigger-scan` keyboard shortcut (KEYS-02) still works via `commands.onCommand`. If a "Scan Page" button is desired in the popup, it should use `sendMessage('startScan')` via the content script messaging channel.
**Warning signs:** "Scan on icon click" stops working after Phase 4 is implemented.

### Pitfall 2: Invisible Characters Not Visible in Output Textarea
**What goes wrong:** After encoding, the output textarea appears empty because Tags block characters are invisible.
**Why it happens:** Tags block characters (U+E0000-E007F) render as zero-width in all fonts and rendering engines. The textarea genuinely contains text but it is visually blank.
**How to avoid:** Add a character count label next to the output (e.g., "142 invisible characters"). Add a visual indicator (colored border, icon) that confirms encoding succeeded. The copy button and its "Copied!" feedback are the primary UX signal.
**Warning signs:** Users think encoding failed because the output looks empty.

### Pitfall 3: Popup Closes on External Focus
**What goes wrong:** The popup closes when the user clicks outside it (e.g., to paste encoded text elsewhere), losing all state.
**Why it happens:** Chrome closes extension popups on any loss of focus. This is a hard platform constraint.
**How to avoid:** Copy to clipboard BEFORE the user needs to leave the popup. Auto-encode on input so the output is always ready to copy. Consider persisting the last encode/decode values to session storage so they can be restored when the popup reopens. Accept that the popup is transient by design.
**Warning signs:** Users report losing their encoded text when they click away.

### Pitfall 4: encode() Throws on Non-ASCII Input
**What goes wrong:** `encode()` throws an Error with position and codepoint for any character with codepoint > 127. Unhandled, this crashes the UI.
**Why it happens:** The codec only supports ASCII-to-Tags-block mapping by design.
**How to avoid:** Wrap `encode()` calls in try/catch. Display the error message inline in the UI. Clear the error when the user modifies input. Consider pre-validation to detect non-ASCII before calling encode.
**Warning signs:** Uncaught exception logged to console; UI freezes or shows blank output.

### Pitfall 5: Tailwind CSS Not Loading in Popup
**What goes wrong:** Popup appears unstyled despite Tailwind classes being present in the markup.
**Why it happens:** The `style.css` file with `@import "tailwindcss"` was not imported in `main.tsx`, or the `@tailwindcss/vite` plugin is not scanning the popup entrypoint files.
**How to avoid:** Ensure `import './style.css'` is in `main.tsx`. The `@tailwindcss/vite` plugin in `wxt.config.ts` should automatically detect utility classes in all files Vite processes. Verify the dev build includes the popup CSS bundle.
**Warning signs:** Popup loads but has no styling; raw HTML elements visible.

### Pitfall 6: Popup Layout Jumps During Typing
**What goes wrong:** The popup resizes as content changes (output text appears/disappears, error messages toggle), causing visual jank.
**Why it happens:** Chrome auto-sizes the popup to fit content. Dynamic content changes cause re-layout.
**How to avoid:** Set fixed dimensions on the body or root element (`width: 380px; min-height: 480px`). Use `overflow-y: auto` for content that may overflow. Keep the layout stable by reserving space for error messages and output areas even when empty.
**Warning signs:** Popup "jumps" or "flickers" as user interacts.

## Code Examples

Verified patterns from official sources and project codebase:

### WXT Popup HTML Entrypoint
```html
<!-- Source: https://wxt.dev/guide/essentials/entrypoints.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InvisibleUnicode</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

### Preact Mount in Popup
```tsx
// Source: https://preactjs.com/guide/v10/api-reference/#render
import { render } from 'preact';
import { App } from './App';
import './style.css';

render(<App />, document.getElementById('root')!);
```

### Tailwind CSS v4 Entry
```css
/* Source: https://tailwindcss.com/blog/tailwindcss-v4 */
@import "tailwindcss";

/* Custom popup-level overrides */
body {
  width: 380px;
  min-height: 480px;
}
```

### Clipboard Write with Fallback
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
// + https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for contexts where async Clipboard API fails
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch {
      success = false;
    }
    document.body.removeChild(textarea);
    return success;
  }
}
```

### Reading Settings in Popup
```tsx
// Source: utils/storage.ts (project codebase)
import { sensitivitySetting, wrapperEnabledSetting } from '@/utils/storage';
import { useState, useEffect } from 'preact/hooks';

function useStorageSetting<T>(setting: { getValue: () => Promise<T>; setValue: (v: T) => Promise<void>; watch: (cb: (v: T) => void) => () => void }, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    setting.getValue().then(setValue);
    const unwatch = setting.watch(setValue);
    return unwatch;
  }, []);

  const update = async (v: T) => {
    await setting.setValue(v);
    // Watch callback will update local state
  };

  return [value, update] as const;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | 2018+ (Clipboard API) | Modern async API; `execCommand` deprecated but still works as fallback |
| `ReactDOM.createRoot()` + React | `render()` from Preact | Preact 10+ | Preact uses direct `render()` call, not createRoot pattern |
| Tailwind v3 (`@tailwind base/components/utilities`) | Tailwind v4 (`@import "tailwindcss"`) | Jan 2025 | Single CSS import, zero config, first-party Vite plugin |
| `tailwind.config.js` configuration file | CSS-first configuration via `@theme` | Tailwind v4 | No more JS config file; theme customization done in CSS |
| Browser extension popup with inline styles | Tailwind utility classes in framework components | Standard practice | Consistent, scannable styling without CSS-in-JS overhead |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Deprecated but functional. Keep as fallback only.
- Tailwind v3 `@tailwind` directives: Replaced by `@import "tailwindcss"` in v4.
- `tailwind.config.js`: No longer needed in v4. Use CSS `@theme` for customization.

## Open Questions

1. **Popup State Persistence Across Open/Close**
   - What we know: Chrome destroys the popup DOM when it loses focus. All component state is lost.
   - What's unclear: Should the last encode/decode values be persisted to session storage so they restore when the popup reopens?
   - Recommendation: Do NOT persist encode/decode state for v1. The popup is transient by design. Users should copy before closing. Persisting state adds complexity (storage sync, stale state) for a minor UX improvement. Revisit if user feedback requests it.

2. **Live Encode vs Button-Triggered Encode**
   - What we know: `encode()` is fast for typical inputs (under 1000 chars). For very long texts, per-keystroke encoding could cause jank.
   - What's unclear: Should encoding happen on every keystroke (`onInput`) or only on button click?
   - Recommendation: Use button-triggered encoding for v1. It is simpler, avoids the debounce complexity, and gives the user explicit control. The decode side can be live (auto-decode on paste) since that is the natural UX for pasting invisible text.

3. **Popup "Scan Page" Button**
   - What we know: Phase 4 requirements are CONV-01 through CONV-05 only (converter). Scan trigger is already handled by keyboard shortcut (KEYS-02) and icon click (Phase 2).
   - What's unclear: Should the popup include a "Scan Page" button for discoverability?
   - Recommendation: Defer to Phase 5 or planner discretion. It is not a Phase 4 requirement. If added, it would use the existing `sendMessage('startScan')` to the content script.

4. **Dark Mode / Theme Support**
   - What we know: Tailwind v4 supports `dark:` variants natively. Chrome extensions can detect `prefers-color-scheme`.
   - What's unclear: Should the popup support dark mode?
   - Recommendation: Defer dark mode to post-v1. Style with a neutral light theme for v1. Tailwind makes adding dark mode later straightforward.

## Sources

### Primary (HIGH confidence)
- [WXT Entrypoints](https://wxt.dev/guide/essentials/entrypoints.html) - Popup entrypoint file structure, HTML meta config
- [Preact API Reference](https://preactjs.com/guide/v10/api-reference/) - `render()` function, hooks API
- [Tailwind CSS v4 Announcement](https://tailwindcss.com/blog/tailwindcss-v4) - `@import "tailwindcss"` setup, Vite plugin
- [Chrome Clipboard API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) - `navigator.clipboard.writeText()` specification
- [MDN WebExtensions Clipboard](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard) - Extension clipboard access patterns
- [Chrome Extension Popup Dimensions](https://developer.chrome.com/docs/extensions/mv2/reference/browserAction) - Max 800x600, min 25x25, auto-sized to content

### Secondary (MEDIUM confidence)
- [WXT React Popup Template](https://github.com/wxt-dev/wxt/tree/main/templates/react/entrypoints/popup) - File structure reference (React, but pattern applies to Preact)
- [Preact Switching Guide](https://preactjs.com/guide/v10/switching-to-preact/) - Differences from React, import paths

### Tertiary (LOW confidence)
- Popup state persistence strategy based on general extension development experience (not empirically tested for this project)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and configured; no new dependencies
- Architecture: HIGH - WXT popup entrypoint pattern is well-documented; Preact render pattern is straightforward
- Pitfalls: HIGH - Popup focus loss, invisible output, clipboard API behavior are well-known extension development issues
- Clipboard fallback: MEDIUM - `document.execCommand('copy')` is deprecated but still works in all current browsers; future removal date unknown

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable APIs and libraries)
