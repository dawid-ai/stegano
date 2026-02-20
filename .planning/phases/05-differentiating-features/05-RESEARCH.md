# Phase 5: Differentiating Features - Research

**Researched:** 2026-02-20
**Domain:** AI watermark detection, snippet management, scan result export, Chrome extension keyboard shortcuts, storage patterns
**Confidence:** MEDIUM

## Summary

Phase 5 adds three distinct feature groups to the extension: (1) AI watermark character detection as a third character class in the scanner, (2) a named snippets system for saving and pasting invisible Unicode text, and (3) scan result export as JSON. Each feature touches different parts of the codebase but shares common infrastructure (storage, messaging, content script).

The AI watermark detection is the most research-intensive feature. The primary character is U+202F (Narrow No-Break Space), which GPT-o3, o4-mini, and GPT-5 models insert frequently. However, the concept of "AI watermark" characters is fuzzy -- many of the characters cited as watermarks (U+200B, U+200C, U+200D, U+FEFF, U+2060) are already detected by the existing scanner as zero-width characters. The differentiator is a curated subset of characters that are specifically associated with LLM output patterns, particularly U+202F and U+2003 (Em Space), which are NOT currently in the scanner's standard detection set. The scanner architecture already supports a `type` field on `ScanFinding` -- extending it from `'tags' | 'zerowidth'` to `'tags' | 'zerowidth' | 'watermark'` is straightforward.

The snippet system faces a key constraint: Chrome's `commands` API only allows statically-defined keyboard shortcuts in the manifest (max 4 suggested). Since users want to assign shortcuts to arbitrary snippets, the approach must use content script `keydown` event listeners for custom snippet shortcuts, with the manifest `quick-paste` command reserved for the primary snippet. Snippets should be stored in sync storage for cross-device availability, but the 8KB per-item limit means the entire snippet array must stay under that threshold.

**Primary recommendation:** Add a curated `AI_WATERMARK_CHARS` set to `charsets.ts`, extend `ScanFinding.type` to include `'watermark'`, store snippets as a single sync storage array item, and use content script keydown listeners for snippet-specific shortcuts beyond the single manifest command.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCAN-03 | Extension detects AI watermark characters (U+202F narrow no-break space and related LLM patterns) | Curated watermark character list researched from multiple sources; U+202F confirmed as primary marker; extend charsets.ts with watermark-specific ranges; scanner classifies matches as type 'watermark' |
| SCAN-06 | Scanner discriminates between Tags block, zero-width, and AI watermark character classes | ScanFinding.type already supports 'tags' and 'zerowidth'; add 'watermark' variant; content script uses different highlight colors per class; scanner checks watermark set before falling through to zerowidth |
| SNIP-01 | User can save named invisible Unicode snippets in extension settings | Store as typed array in sync storage via WXT defineItem; snippet model includes id, name, content, optional shortcut; settings page provides CRUD UI |
| SNIP-02 | User can paste a saved snippet via its assigned keyboard shortcut | Manifest quick-paste command handles primary snippet (existing); content script keydown listener handles additional snippet shortcuts; clipboard writeText injects text |
| SNIP-03 | User can edit and delete saved snippets | Settings page list UI with edit/delete actions; sync storage watch() propagates changes reactively |
| SCAN-09 | User can export scan results as JSON report (clipboard or download) | Two export paths: clipboard copy (existing copyToClipboard util) and file download (anchor click with blob URL or data URL, no downloads permission needed); structured JSON schema for findings |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.17 | Extension framework, storage, entrypoints | Already the project foundation |
| Preact | 10.28.4 | Settings and popup UI components | Already used for popup; needed for snippet management UI |
| @webext-core/messaging | 2.3.0 | Background-content script communication | Already in use; needed for snippet paste messages |
| wxt/storage (built-in) | built-in | Snippet persistence, settings | Already configured; defineItem supports typed arrays |
| Tailwind CSS 4.x | 4.2.0 | UI styling for settings pages | Already configured via @tailwindcss/vite |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.x | Unit tests for watermark detection, snippet storage | Test new scanner classification logic |
| @webext-core/fake-browser | 1.3.4 | Mock browser APIs in tests | Test storage operations for snippets |

### No New Dependencies
Phase 5 requires zero new npm packages. File download uses standard DOM APIs (Blob, URL.createObjectURL, anchor click). Keyboard listeners use standard DOM events. All storage uses WXT built-in storage utilities.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Content script keydown listeners | Chrome commands API for snippet shortcuts | Commands API requires static manifest declaration, max 4 suggested shortcuts; keydown listeners allow unlimited dynamic shortcuts |
| Anchor click for file download | chrome.downloads API | downloads API requires adding "downloads" permission to manifest; anchor click works without any extra permission |
| Sync storage for snippets | Local storage for snippets | storage.ts comment says "local storage" for snippets, but prior decision says sync for all settings; sync enables cross-device snippet sharing but has 8KB per-item limit |

## Architecture Patterns

### Recommended Project Structure (Phase 5 additions)
```
invisible-unicode/
  entrypoints/
    content.ts          # [MODIFY] Add watermark classification, snippet keydown listener
    background.ts       # [MODIFY] Add snippet paste handling, export message routing
    popup/App.tsx        # [MODIFY] Add export button to scanner results
  utils/
    charsets.ts          # [MODIFY] Add AI_WATERMARK_CHARS set and watermark detection
    scanner.ts           # [MODIFY] Add 'watermark' type classification
    storage.ts           # [MODIFY] Add snippets storage item
    messaging.ts         # [MODIFY] Add pasteSnippet, exportResults messages
    types.ts             # [MODIFY] Add Snippet interface, ScanReport type
    export.ts            # [NEW] JSON report generation logic
  entrypoints/
    settings/            # [NEW or EXTEND] Settings page with snippets management
      main.tsx
      App.tsx
```

### Pattern 1: Three-Class Character Classification
**What:** The scanner must check each detected character against three classification tiers in a specific order: (1) Tags block (U+E0000-E007F), (2) AI watermark (curated set), (3) zero-width/other invisible. The watermark check must happen BEFORE the generic zero-width fallback because some watermark characters overlap with the zero-width ranges already detected.
**When to use:** Every scan finding classification in `findInvisibleChars()`.

```typescript
// utils/charsets.ts - Add watermark character set
/**
 * Characters specifically associated with AI/LLM output patterns.
 * These are checked separately from general zero-width characters
 * to provide distinct labeling in scan results.
 *
 * Primary source: U+202F (Narrow No-Break Space) confirmed in GPT-o3,
 * o4-mini, GPT-5 outputs. Others are frequently cited in AI watermark
 * detection tools.
 */
export const AI_WATERMARK_CHARS: ReadonlyMap<number, string> = new Map([
  [0x202f, 'Narrow No-Break Space (NNBSP)'],     // PRIMARY: GPT-o3/o4-mini/GPT-5
  [0x2003, 'Em Space'],                            // Cited by GetGPT detector
  [0x2002, 'En Space'],                            // Related typographic space
  [0x2009, 'Thin Space'],                          // Related typographic space
  [0x200a, 'Hair Space'],                          // Related typographic space
  [0x00a0, 'Non-Breaking Space'],                  // Common in LLM outputs
  [0x2014, 'Em Dash'],                             // Visible but used as marker
]);

// Note: U+200B-U+200F, U+FEFF, U+2060 are already detected as zero-width.
// They overlap with watermark detection but are classified as 'zerowidth'
// because they have broader use cases beyond AI watermarking.
// The watermark set focuses on characters that are PRIMARILY indicators
// of AI-generated text, not general invisible characters.
```

**Design decision -- Em Dash (U+2014):** This character is VISIBLE, unlike all other watermark characters. It should be excluded from the watermark detection set because the scanner is designed for invisible/hidden characters. If a user types an em dash, flagging it as AI watermark would be a false positive. The scanner should focus on invisible characters only.

**Revised watermark set (recommended):**
```typescript
export const AI_WATERMARK_CHARS: ReadonlyMap<number, string> = new Map([
  [0x202f, 'Narrow No-Break Space'],       // PRIMARY indicator
  [0x2003, 'Em Space'],                     // Wider than normal space
  [0x2002, 'En Space'],                     // Width of letter N
  [0x2009, 'Thin Space'],                   // Thinner than normal space
  [0x200a, 'Hair Space'],                   // Thinnest space
  [0x00a0, 'Non-Breaking Space'],           // Common LLM artifact
  [0x205f, 'Medium Mathematical Space'],    // Rare in normal text
]);
```

### Pattern 2: Scanner Classification Priority
**What:** When classifying a detected character, check in order: Tags block > Watermark > Zero-width.

```typescript
// utils/scanner.ts - Modified classification
import { AI_WATERMARK_CHARS } from './charsets';

function classifyCodepoint(cp: number): ScanFinding['type'] {
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'tags';
  if (AI_WATERMARK_CHARS.has(cp)) return 'watermark';
  return 'zerowidth';
}
```

**Important:** Some watermark characters (e.g., U+00A0, U+202F) are NOT currently in the scanner's standard detection ranges. The detection regex in charsets.ts must be updated to include watermark characters. This means either:
- (a) Adding watermark ranges to the STANDARD_RANGES array, or
- (b) Building a separate watermark regex and combining results, or
- (c) Adding watermark ranges as their own sensitivity tier

**Recommendation:** Option (a) is simplest. Add watermark character ranges to `STANDARD_RANGES` so they are always detected. The classification logic in scanner.ts then determines the `type` field.

### Pattern 3: Snippet Data Model and Storage
**What:** Snippets are stored as a typed array in sync storage. Each snippet has an ID, name, encoded content, and optional keyboard shortcut definition.

```typescript
// utils/types.ts
export interface Snippet {
  /** Unique identifier (nanoid or crypto.randomUUID) */
  id: string;
  /** User-assigned name for the snippet */
  name: string;
  /** The invisible Unicode content (already encoded) */
  content: string;
  /** Optional keyboard shortcut (e.g., { alt: true, shift: true, key: '1' }) */
  shortcut?: SnippetShortcut;
}

export interface SnippetShortcut {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
  /** Single key character or special key name */
  key: string;
}
```

```typescript
// utils/storage.ts
export const snippetsSetting = storage.defineItem<Snippet[]>(
  'sync:snippets',
  { fallback: [] },
);
```

**Storage quota consideration:** Sync storage has an 8,192 byte per-item limit. Each snippet's content is invisible Unicode characters (2-4 bytes each in JSON). A typical snippet of 100 characters is ~400 bytes of content + ~50 bytes metadata = ~450 bytes. The 8KB limit allows roughly 15-18 snippets before hitting the quota. This is likely sufficient for most users. If needed, the storage key can be changed to `local:snippets` to get the 10MB limit, but cross-device sync would be lost.

### Pattern 4: Content Script Keyboard Listener for Snippet Shortcuts
**What:** Since Chrome commands API cannot handle dynamic shortcuts, register a keydown listener in the content script that checks pressed key combinations against stored snippet shortcuts.

```typescript
// In content.ts - Snippet shortcut handler
import { snippetsSetting } from '@/utils/storage';

let snippets: Snippet[] = [];

// Load snippets and watch for changes
snippetsSetting.getValue().then(s => { snippets = s; });
snippetsSetting.watch(s => { snippets = s; });

document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Only process when Alt+Shift prefix is held (per prior decision)
  if (!e.altKey || !e.shiftKey) return;

  const match = snippets.find(s =>
    s.shortcut &&
    s.shortcut.key.toLowerCase() === e.key.toLowerCase() &&
    s.shortcut.alt === e.altKey &&
    s.shortcut.shift === e.shiftKey &&
    s.shortcut.ctrl === e.ctrlKey
  );

  if (match) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(match.content).catch(() => {
      // Fallback: use messaging to background for clipboard write
    });
  }
}, true); // useCapture to intercept before page handlers
```

**Key constraint:** Content script keydown listeners only work when the page has focus. They do not work on chrome:// pages, extension pages, or when the browser UI has focus. This is acceptable because pasting into a text field requires page focus anyway.

### Pattern 5: Scan Result Export as JSON
**What:** The scanner collects findings during a scan. These findings can be serialized to a structured JSON report and exported via clipboard copy or file download.

```typescript
// utils/export.ts
import type { ScanFinding } from './scanner';

export interface ScanReport {
  version: 1;
  url: string;
  timestamp: string;
  summary: {
    total: number;
    tags: number;
    zerowidth: number;
    watermark: number;
  };
  findings: ScanReportFinding[];
}

interface ScanReportFinding {
  type: ScanFinding['type'];
  /** The decoded/labeled text */
  replacement: string;
  /** Character codepoints as hex strings */
  codepoints: string[];
  /** Surrounding visible text for context */
  context: string;
  /** Position in source text */
  position: { start: number; end: number };
}
```

**Export via clipboard:** Use existing `copyToClipboard()` utility with `JSON.stringify(report, null, 2)`.

**Export via file download (no extra permissions needed):**
```typescript
function downloadJson(report: ScanReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invisible-unicode-report-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Note on context:** The popup runs in the extension context and cannot directly access page DOM. The content script must collect and send findings to the popup/background. The content script already stores `totalFindings` but does not retain the full findings array. This must be changed: the content script should store all findings (or at minimum, a summary) so they can be requested for export.

### Pattern 6: Per-Class Highlight Colors
**What:** SCAN-06 requires visual discrimination between character classes. The Phase 2 research noted color-coding was deferred to Phase 5. Now is the time to implement it.

```typescript
// Recommended color scheme for three character classes
const CLASS_COLORS = {
  tags: '#FFEB3B',      // Yellow (existing default) - Tags block messages
  zerowidth: '#FF9800', // Orange - Zero-width invisible chars
  watermark: '#E91E63', // Pink/Magenta - AI watermark indicators
} as const;
```

The content script's `highlightFindings()` function already receives a `color` parameter. Instead of a single color, it should select color based on `finding.type`. This also means the `highlightColorSetting` may need to become a per-class color map or the three colors can be hardcoded defaults with a settings override.

### Anti-Patterns to Avoid
- **Putting all watermark chars in zero-width ranges:** The whole point of SCAN-06 is discrimination. Keep watermark detection separate from generic invisible char detection.
- **Using chrome.commands for snippet shortcuts:** The API only supports static manifest declarations with max 4 suggested shortcuts. Content script keydown listeners are the correct approach for dynamic user-defined shortcuts.
- **Storing each snippet as a separate storage key:** This wastes sync storage MAX_ITEMS quota (512 items) and makes atomic updates impossible. Store as a single array item.
- **Collecting findings only at scan time then discarding:** The export feature needs access to findings after the scan completes. Store the findings array in content script module state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique IDs for snippets | Custom counter or timestamp | `crypto.randomUUID()` | Built-in, collision-free, available in extension contexts |
| JSON file download | Custom fetch/xhr download | Blob + URL.createObjectURL + anchor click | Standard DOM pattern, no permissions needed |
| Clipboard copy | Raw navigator.clipboard | Existing `copyToClipboard()` utility | Already handles fallback for older browsers |
| Storage reactivity | Manual polling or event wiring | WXT `storage.watch()` | Built-in, fires on cross-context changes |
| Key combo matching | String comparison of shortcut strings | Structured `SnippetShortcut` object matching | Avoids locale/keyboard layout issues |

**Key insight:** The export and snippet features are primarily UI/data problems, not complex algorithmic challenges. The main risk is getting the data flow right between content script, background, and popup contexts.

## Common Pitfalls

### Pitfall 1: Watermark Character Overlap with Existing Detection
**What goes wrong:** U+00A0 (Non-Breaking Space) is added to the watermark set, but it is also a legitimate character in normal web content (e.g., &nbsp; in HTML). Users see false positives everywhere.
**Why it happens:** Unlike zero-width characters, some watermark candidates are visible/functional characters that appear in normal text.
**How to avoid:** Be conservative with the watermark set. U+202F is the strongest indicator. U+00A0 should probably NOT be in the default watermark set because it appears in virtually every web page via &nbsp;. Consider making watermark detection sensitivity configurable, or only flag U+00A0 when it appears in patterns (e.g., replacing normal spaces within a text block).
**Warning signs:** Every web page shows dozens or hundreds of "AI watermark" findings.
**Recommendation:** Start with a minimal watermark set: U+202F only at standard sensitivity. Add U+2003, U+2002, U+2009, U+200A, U+205F at thorough/paranoid levels. Exclude U+00A0 entirely from watermark classification (it is too common in normal HTML).

### Pitfall 2: Sync Storage Quota Exceeded for Snippets
**What goes wrong:** User saves many long snippets; the serialized array exceeds 8,192 bytes; all snippet operations fail silently or throw.
**Why it happens:** sync storage has a per-item byte limit. Invisible Unicode characters use 2-4 bytes each in JSON (escaped as \uXXXX).
**How to avoid:** Validate snippet size before saving. Show a warning when approaching the limit. Consider a fallback to local storage if sync quota is exceeded.
**Warning signs:** `chrome.runtime.lastError` after storage.set calls; snippets disappearing after save.

### Pitfall 3: Keydown Listener Conflicts with Page Shortcuts
**What goes wrong:** The snippet keyboard shortcut (e.g., Alt+Shift+1) conflicts with a website's own keyboard shortcuts, or a user's system-level shortcut.
**Why it happens:** Content script keydown listeners fire in the page context alongside the page's own handlers.
**How to avoid:** Use `e.preventDefault()` and `e.stopPropagation()` with `useCapture: true` when a snippet match is found. Use the Alt+Shift prefix (per prior decision) which is rarely used by websites. Allow users to customize shortcuts to avoid conflicts.
**Warning signs:** Pressing snippet shortcut triggers both snippet paste and a page action.

### Pitfall 4: Findings Not Available for Export After Scan
**What goes wrong:** The popup tries to export scan results, but the content script has no stored findings -- they were discarded after highlighting.
**Why it happens:** The current `performFullScan()` returns only `{ count: number }`. Individual findings are used for highlighting and then garbage collected.
**How to avoid:** Store the full findings array in content script module state. Add a `getFindings` message type that the popup can use to retrieve findings for export.
**Warning signs:** Export produces empty JSON or only a count.

### Pitfall 5: File Download Blocked in Popup Context
**What goes wrong:** `URL.createObjectURL()` works in the popup, but the anchor click download does not trigger because the popup closes when focus leaves it.
**Why it happens:** Popup windows close when they lose focus (clicking the download dialog causes focus loss).
**How to avoid:** Two options: (1) Use `chrome.downloads.download()` with a data URL (requires "downloads" permission), or (2) route the download through the background service worker using an offscreen document, or (3) copy JSON to clipboard instead of file download from the popup. Simplest approach: offer clipboard copy as the primary export from the popup, and file download only from a full settings/results page.
**Warning signs:** Download appears to start but no file is saved; popup flickers closed.

### Pitfall 6: Content Script Not Injected When Snippet Shortcut Pressed
**What goes wrong:** User presses a snippet shortcut on a page where the content script is not yet injected. Nothing happens.
**Why it happens:** Content script keydown listeners only exist after the content script is loaded. With on-demand injection, the content script may not be present.
**How to avoid:** For snippet shortcuts to work everywhere, the content script needs to be injected on all pages. This requires either: (a) using declarative registration with `matches: ['<all_urls>']` (already the case in the current codebase), or (b) requesting the optional `all_urls` permission. Since the current content.ts already uses `matches: ['<all_urls>']`, the snippet keydown listener can be added alongside the existing scanner message handlers and will be active on all pages.
**Warning signs:** Snippets only paste on pages where the user has already run a scan.

## Code Examples

### Extending ScanFinding Type
```typescript
// utils/scanner.ts - Updated type
export interface ScanFinding {
  start: number;
  end: number;
  original: string;
  replacement: string;
  type: 'tags' | 'zerowidth' | 'watermark';  // Added 'watermark'
}
```

### Adding Watermark Ranges to Detection Regex
```typescript
// utils/charsets.ts - Add to STANDARD_RANGES or create WATERMARK_RANGES
const WATERMARK_RANGES: CharRange[] = [
  { start: 0x202f, end: 0x202f, name: 'Narrow No-Break Space (AI watermark)' },
];

const THOROUGH_WATERMARK_ADDITIONS: CharRange[] = [
  { start: 0x2002, end: 0x2003, name: 'En/Em Space (AI watermark)' },
  { start: 0x2009, end: 0x200a, name: 'Thin/Hair Space (AI watermark)' },
  { start: 0x205f, end: 0x205f, name: 'Medium Mathematical Space (AI watermark)' },
];
```

### Snippet CRUD with WXT Storage
```typescript
// utils/storage.ts
import type { Snippet } from './types';

export const snippetsSetting = storage.defineItem<Snippet[]>(
  'sync:snippets',
  { fallback: [] },
);

// Helper functions for snippet operations
export async function addSnippet(snippet: Snippet): Promise<void> {
  const current = await snippetsSetting.getValue();
  await snippetsSetting.setValue([...current, snippet]);
}

export async function updateSnippet(id: string, updates: Partial<Snippet>): Promise<void> {
  const current = await snippetsSetting.getValue();
  await snippetsSetting.setValue(
    current.map(s => s.id === id ? { ...s, ...updates } : s)
  );
}

export async function deleteSnippet(id: string): Promise<void> {
  const current = await snippetsSetting.getValue();
  await snippetsSetting.setValue(current.filter(s => s.id !== id));
}
```

### Export Findings Message Flow
```typescript
// utils/messaging.ts - Add new message types
type MessageMap = {
  ping: { data: undefined; response: 'pong' };
  startScan: { data: undefined; response: ScanResult };
  clearScan: { data: undefined; response: void };
  getFindings: { data: undefined; response: ScanReportData };  // NEW
  pasteSnippet: { data: { content: string }; response: void }; // NEW
};

interface ScanReportData {
  findings: Array<{
    type: 'tags' | 'zerowidth' | 'watermark';
    replacement: string;
    original: string;
    codepoints: string[];
    context: string;
    position: { start: number; end: number };
  }>;
  url: string;
  timestamp: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No AI watermark detection | U+202F flagged as primary AI indicator | Late 2024-2025 | GPT-o3/o4-mini models insert NNBSP; detection tools emerged |
| Single character class (invisible) | Three-class discrimination (tags/zerowidth/watermark) | This phase | Users can distinguish intentional encoding from artifacts from AI markers |
| Static extension commands only | Content script keydown + manifest commands | Ongoing pattern | Enables unlimited user-defined shortcuts for snippets |
| Individual storage keys | Array-in-single-key pattern | Best practice | Atomic operations, quota-friendly for sync storage |

**Context on AI watermarks:** OpenAI has officially stated that U+202F insertion is "a quirk of large-scale reinforcement learning" rather than intentional watermarking. Whether intentional or not, these characters ARE present in LLM outputs and ARE invisible to users. Detecting them serves the extension's core purpose regardless of OpenAI's intent.

## Open Questions

1. **U+00A0 (Non-Breaking Space) in watermark set**
   - What we know: It appears in virtually every web page via `&nbsp;`. Multiple sources list it as an AI watermark character.
   - What's unclear: Whether flagging it would cause too many false positives to be useful.
   - Recommendation: Exclude from watermark detection entirely. It is too common in normal HTML to be a meaningful AI indicator. If users want to detect it, it falls under the "paranoid" sensitivity level already.

2. **Snippet storage area: sync vs local**
   - What we know: Prior decision says "sync storage for all settings." The storage.ts comment says "Snippets: local storage." Sync has 8KB/item limit, local has 10MB.
   - What's unclear: Whether the 8KB limit will be problematic in practice.
   - Recommendation: Use sync storage (honor the prior decision). 8KB allows ~15-18 snippets of reasonable size. Add validation to warn users when approaching the limit. If users hit the limit, that is a future enhancement to migrate to local storage.

3. **File download from popup vs settings page**
   - What we know: Popup closes on focus loss, which interrupts file downloads. The "downloads" permission adds to the manifest footprint.
   - What's unclear: Whether clipboard-only export from popup is sufficient, or if file download is expected.
   - Recommendation: Offer clipboard copy as the primary export from the popup. If a dedicated "scan results" page exists (settings page or a new tab), file download can work there without popup focus issues.

4. **Settings page for snippet management**
   - What we know: Snippets need full CRUD UI (list, create, edit, delete). The popup is too small for this.
   - What's unclear: Whether a dedicated settings/options page exists yet, or if it needs to be created in this phase.
   - Recommendation: Create a WXT options page (`entrypoints/settings/`) if one does not exist. The popup can link to it. Snippet management lives on the settings page; the popup shows a quick-access list.

## Sources

### Primary (HIGH confidence)
- [Chrome Developers: chrome.commands API](https://developer.chrome.com/docs/extensions/reference/api/commands) -- Verified: max 4 suggested shortcuts, commands must be static in manifest, Alt or Ctrl required
- [Chrome Developers: chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- Verified: sync QUOTA_BYTES_PER_ITEM = 8,192 bytes, MAX_ITEMS = 512
- [Chrome Developers: chrome.downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads) -- Data URL download approach for MV3

### Secondary (MEDIUM confidence)
- [Rumidocs: New ChatGPT Models Seem to Leave Watermarks](https://www.rumidocs.com/newsroom/new-chatgpt-models-seem-to-leave-watermarks-on-text) -- U+202F as primary marker in GPT-o3/o4-mini
- [OpenAI Community: GPT-5 outputs U+202F](https://community.openai.com/t/gpt-5-non-reasoning-outputs-u-202f-narrow-no-break-space-instead-of-normal-spaces-breaks-text-rendering-on-macos-apps/1362321) -- GPT-5 confirmed to insert U+202F
- [GetGPT Watermark Detector](https://getgpt.app/watermark) -- Lists 34+ characters scanned, specific codepoints documented
- [GPT Cleanup Watermark Detector](https://www.gptcleanup.com/watermark-detector) -- U+200B, U+200C, U+200D, U+2060, U+00A0 listed
- [4fsh: Invisible Unicode flags AI content](https://www.4fsh.com/blog/invisible-unicode-is-what-flags-your-content-as-ai-generated/) -- Comprehensive codepoint list including U+202F, U+2003, directional marks
- [GPT Watermark Remover: Invisible Characters](https://gpt-watermark-remover.com/blog/invisible-characters-chatgpt) -- Character list with U+200B, U+200C, U+200D, U+00AD, U+2060, U+FEFF

### Tertiary (LOW confidence)
- Em Dash (U+2014) as watermark -- Only mentioned by GetGPT; it is a VISIBLE character and should not be in the watermark set for an invisible character detector
- Exact patterns of U+202F insertion (positional, frequency-based) -- No formal specification found; "systematic rather than random" per multiple sources but no published algorithm
- Whether OpenAI intentionally watermarks or it is a training artifact -- OpenAI denies intentional watermarking; sources disagree

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all features use existing libraries and browser APIs
- AI watermark characters: MEDIUM -- U+202F is well-confirmed across multiple sources as primary indicator; full character set is less certain; false positive risk for U+00A0
- Scanner architecture: HIGH -- Extending existing ScanFinding.type is straightforward; charsets.ts pattern is established
- Snippet system: HIGH -- Standard CRUD over WXT typed storage; well-understood patterns
- Keyboard shortcuts: HIGH -- Chrome commands API limitations confirmed via official docs; content script keydown is standard fallback
- Export feature: MEDIUM -- Clipboard export is straightforward; file download from popup has known focus-loss issue requiring workaround
- Pitfalls: HIGH -- Storage quotas, keydown conflicts, and popup focus loss are well-documented issues

**Research date:** 2026-02-20
**Valid until:** 2026-03-06 (14 days -- AI watermark landscape is evolving rapidly; character patterns may change with new model releases)
