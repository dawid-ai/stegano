# Phase 1: Foundation - Research

**Researched:** 2026-02-20
**Domain:** WXT project scaffolding, Unicode Tags block encode/decode, sensitivity presets, no-network enforcement, MV3 manifest
**Confidence:** HIGH

## Summary

Phase 1 builds two independent deliverables: (1) pure TypeScript encode/decode functions for invisible Unicode with three sensitivity presets, verified by unit tests, and (2) a WXT project skeleton that produces a loadable MV3 extension with no network access, correct permissions, and documented storage allocation.

The Unicode logic is straightforward -- Tags block encoding maps ASCII codepoints by adding 0xE0000, and decoding reverses that. Zero-width character decoding is pattern-matching against known codepoint ranges. The key subtlety is that Tags block characters are non-BMP (above U+FFFF), requiring `String.fromCodePoint()` / `codePointAt()` and the `/u` flag on all regexes. WXT handles the build pipeline, manifest generation, and Vite integration. There is no official WXT Preact template, so setup requires the React template (or vanilla) plus `@preact/preset-vite` configured in `wxt.config.ts`.

**Primary recommendation:** Start with `pnpm dlx wxt@latest init` using the vanilla template, then add Preact via `@preact/preset-vite`. Build encode/decode as pure functions in a `utils/` directory (auto-imported by WXT). Test with Vitest using the `WxtVitest` plugin. Enforce no-network via ESLint `no-restricted-globals` rule plus a strict CSP in the manifest.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three named sensitivity presets: Standard (default), Thorough, Paranoid
- **Standard:** Tags block (U+E0000-E007F) + zero-width joiners/marks (U+200B-200F, U+FEFF)
- **Thorough:** Standard + word joiner (U+2060), invisible operators (U+2061-2064), variation selectors
- **Paranoid:** Thorough + directional overrides (U+202A-202E), invisible separators, deprecated format chars
- Decode function respects the current sensitivity level -- only decodes character classes within the active preset
- Sensitivity presets defined as data in Phase 1; UI for switching them comes in Phase 3 (settings)
- Encode produces Tags block (U+E0000-E007F) output only -- no zero-width encoding mode
- ASCII input only; reject non-ASCII with a clear error message
- Wrapper characters (U+E0001 begin / U+E007F cancel) are a settings toggle -- user chooses wrapped vs raw output
- Wrapper setting defined as a data default in Phase 1; UI toggle comes in Phase 3
- Auto-detect which encoding is present in input (Tags block vs zero-width) -- no user selection needed
- Decodes only character classes covered by the user's current sensitivity preset
- Snippets (Phase 5): local storage -- per-device, 10MB limit, no sync
- Scan results: session storage only -- vanish when tab/browser closes
- No usage stats or counters -- nothing to track, nothing to explain
- Visible "Local only" indicator in the popup UI -- builds user trust actively

### Claude's Discretion
- U+FEFF (BOM) handling: whether to skip at position 0 or flag everywhere
- Settings sync vs local storage choice
- No-network enforcement method (ESLint, build check, or both)
- CSP configuration in manifest
- Privacy claim prominence in store listing
- Exact character lists for Thorough and Paranoid presets beyond the categories listed above

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-01 | Extension uses Chrome Manifest V3 | WXT generates MV3 manifest automatically; `wxt.config.ts` manifest configuration documented below; permissions model researched |
| PLAT-02 | All processing happens locally -- no data leaves the browser | ESLint `no-restricted-globals` rule blocks `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`; CSP restricts to `'self'` only; no external URLs in build output |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.17 | Extension framework, manifest generation, HMR dev mode | Only actively maintained MV3 framework in 2026; Vite-based; auto-generates manifest from entrypoint files |
| TypeScript | 5.x | Type safety across all extension contexts | Non-negotiable for Unicode codepoint handling and cross-context messaging |
| Preact | 10.x | Popup UI framework (Phase 4+, but configured now) | 3KB gzip vs React's 45KB; WXT supports via `@preact/preset-vite` |
| Tailwind CSS | 4.x | Styling (Phase 4+, but configured now) | Uses `@tailwindcss/vite` plugin; zero dead CSS; works with WXT pipeline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @preact/preset-vite | latest | Vite plugin for Preact JSX/TSX support | Always -- required for Preact to work with WXT's Vite build |
| @tailwindcss/vite | latest | Tailwind CSS v4 Vite plugin | Always -- Tailwind v4 uses Vite plugin instead of PostCSS |
| Vitest | 2.x | Unit testing | All test files; use `WxtVitest` plugin for extension API polyfilling |
| @webext-core/messaging | 2.3.0 | Type-safe message passing (Phase 2+) | Install now for contract definition; active use in later phases |
| wxt/storage | built-in | Typed storage via `storage.defineItem()` | All storage access; WXT has built-in storage wrapper -- no need for separate `@webext-core/storage` |
| @webext-core/fake-browser | latest | In-memory browser API polyfill for tests | Automatically used by `WxtVitest` plugin |
| ESLint | 9.x | Linting + no-network enforcement | Use flat config format; `no-restricted-globals` rule for network blocking |
| @typescript-eslint | 8.x | TypeScript-aware ESLint rules | Catches type errors across extension contexts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @preact/preset-vite (manual setup) | WXT React template + alias hack | Fragile; @preact/preset-vite is the official Preact approach for Vite |
| wxt/storage (built-in) | @webext-core/storage (separate package) | WXT's built-in `storage.defineItem()` is better integrated; use it instead |
| ESLint no-restricted-globals | Custom build-time grep script | ESLint catches violations at write-time in IDE; grep only catches at build |

**Installation:**
```bash
# Scaffold project (choose vanilla template, then add Preact)
pnpm dlx wxt@latest init invisible-unicode --template vanilla --pm pnpm

# Core runtime dependencies
pnpm add preact

# Dev dependencies -- framework
pnpm add -D @preact/preset-vite

# Dev dependencies -- styling (configured now, used in Phase 4)
pnpm add -D @tailwindcss/vite

# Dev dependencies -- testing
pnpm add -D vitest @webext-core/fake-browser

# Dev dependencies -- linting
pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Messaging (install now, use in Phase 2+)
pnpm add @webext-core/messaging
```

## Architecture Patterns

### Recommended Project Structure
```
invisible-unicode/
├── entrypoints/
│   ├── popup/              # Popup page (Phase 4+, stub now)
│   │   └── index.html
│   ├── background.ts       # Service worker (Phase 3+, stub now)
│   └── content.ts          # Content script (Phase 2+, stub now)
├── utils/                   # Auto-imported by WXT
│   ├── codec.ts            # encode() and decode() pure functions
│   ├── charsets.ts         # Sensitivity preset character range definitions
│   ├── types.ts            # Shared TypeScript types
│   └── storage.ts          # storage.defineItem() declarations for all storage keys
├── public/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── wxt.config.ts           # WXT + Preact + Tailwind config
├── vitest.config.ts        # Vitest + WxtVitest plugin
├── eslint.config.mjs       # ESLint flat config with no-network rules
├── tsconfig.json           # Generated by WXT
└── package.json
```

### Pattern 1: Pure Functions for Encode/Decode
**What:** Encode and decode are stateless pure functions that take input and return output. No side effects, no browser API calls, no DOM access.
**When to use:** Always for the core codec logic.
**Why:** Pure functions are trivially testable with Vitest, importable from any extension context (popup, content script, background), and have zero dependencies.

```typescript
// utils/codec.ts

import { type SensitivityPreset, CHARSETS } from './charsets';

const TAGS_OFFSET = 0xE0000;

export function encode(text: string, options?: { wrap?: boolean }): string {
  // Validate ASCII-only input
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 127) {
      throw new Error(`Non-ASCII character at position ${i}: U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }

  const encoded = Array.from(text, (char) =>
    String.fromCodePoint(char.charCodeAt(0) + TAGS_OFFSET)
  ).join('');

  if (options?.wrap) {
    // U+E0001 LANGUAGE TAG (begin) + encoded + U+E007F CANCEL TAG (end)
    return String.fromCodePoint(0xE0001) + encoded + String.fromCodePoint(0xE007F);
  }

  return encoded;
}
```

### Pattern 2: Data-Driven Sensitivity Presets
**What:** Character ranges for each sensitivity level defined as static data objects, not scattered regex patterns.
**When to use:** All detection and decode operations reference these preset definitions.
**Why:** Single source of truth for character coverage. Easy to test each preset independently. UI (Phase 3) just reads the preset names and current selection.

```typescript
// utils/charsets.ts

export type SensitivityLevel = 'standard' | 'thorough' | 'paranoid';

export interface CharRange {
  start: number;
  end: number;
  name: string;
}

export interface SensitivityPreset {
  level: SensitivityLevel;
  label: string;
  ranges: CharRange[];
}

export const PRESETS: Record<SensitivityLevel, SensitivityPreset> = {
  standard: {
    level: 'standard',
    label: 'Standard',
    ranges: [
      { start: 0xE0000, end: 0xE007F, name: 'Tags block' },
      { start: 0x200B, end: 0x200F, name: 'Zero-width & direction marks' },
      { start: 0xFEFF, end: 0xFEFF, name: 'Zero-width no-break space (BOM)' },
    ],
  },
  thorough: {
    level: 'thorough',
    label: 'Thorough',
    ranges: [
      // Inherits all Standard ranges
      { start: 0xE0000, end: 0xE007F, name: 'Tags block' },
      { start: 0x200B, end: 0x200F, name: 'Zero-width & direction marks' },
      { start: 0xFEFF, end: 0xFEFF, name: 'Zero-width no-break space (BOM)' },
      // Thorough additions
      { start: 0x2060, end: 0x2064, name: 'Invisible operators & word joiner' },
      { start: 0xFE00, end: 0xFE0F, name: 'Variation selectors' },
    ],
  },
  paranoid: {
    level: 'paranoid',
    label: 'Paranoid',
    ranges: [
      // Inherits all Thorough ranges
      { start: 0xE0000, end: 0xE007F, name: 'Tags block' },
      { start: 0x200B, end: 0x200F, name: 'Zero-width & direction marks' },
      { start: 0xFEFF, end: 0xFEFF, name: 'Zero-width no-break space (BOM)' },
      { start: 0x2060, end: 0x2064, name: 'Invisible operators & word joiner' },
      { start: 0xFE00, end: 0xFE0F, name: 'Variation selectors' },
      // Paranoid additions
      { start: 0x202A, end: 0x202E, name: 'Directional overrides' },
      { start: 0x2066, end: 0x2069, name: 'Directional isolates' },
      { start: 0x2063, end: 0x2063, name: 'Invisible separator' },
      { start: 0x206A, end: 0x206F, name: 'Deprecated format characters' },
      { start: 0x180B, end: 0x180E, name: 'Mongolian variation selectors' },
      { start: 0x00AD, end: 0x00AD, name: 'Soft hyphen' },
      { start: 0x061C, end: 0x061C, name: 'Arabic letter mark' },
      { start: 0x034F, end: 0x034F, name: 'Combining grapheme joiner' },
    ],
  },
};
```

### Pattern 3: WXT Storage Items as Typed Declarations
**What:** Use `storage.defineItem()` from `wxt/storage` to create typed, versioned storage items with defaults.
**When to use:** Every storage key used by the extension gets a `defineItem` declaration.
**Why:** Type-safe across all extension contexts. Provides `.watch()` for reactive updates. Works with WXT's fake-browser in tests.

```typescript
// utils/storage.ts
import { storage } from 'wxt/storage';
import type { SensitivityLevel } from './charsets';

// Settings -- sync storage (syncs across devices, small data)
export const sensitivitySetting = storage.defineItem<SensitivityLevel>(
  'sync:sensitivity',
  { fallback: 'standard' }
);

export const wrapperEnabledSetting = storage.defineItem<boolean>(
  'sync:wrapperEnabled',
  { fallback: false }  // Default: raw output (no wrapper tags)
);

export const highlightColorSetting = storage.defineItem<string>(
  'sync:highlightColor',
  { fallback: '#ffeb3b' }
);

export const scanModeSetting = storage.defineItem<'onDemand' | 'auto' | 'badgeOnly'>(
  'sync:scanMode',
  { fallback: 'onDemand' }
);

// Session storage -- ephemeral scan results (vanish on browser close)
// Actual scan result items created dynamically per tab in Phase 2
```

### Anti-Patterns to Avoid
- **Hardcoding character ranges in regex strings:** Define ranges as data in `charsets.ts`; generate regexes from them. Prevents drift between encode/decode/detect logic.
- **Using `charCodeAt()` for Tags block:** Tags block characters are non-BMP. `charCodeAt()` returns surrogate pair halves, not codepoints. Always use `codePointAt()` and iterate with `for...of` or `Array.from()`.
- **Using `String.fromCharCode()` for Tags block:** Cannot produce codepoints above U+FFFF. Use `String.fromCodePoint()`.
- **Omitting the `/u` flag on regex:** Without `/u`, regex character classes like `[\uE0000-\uE007F]` silently fail for non-BMP codepoints. Always use `/u` flag with `\u{XXXXX}` syntax.
- **Storing settings in `chrome.storage.local` without reason:** `sync` storage is appropriate for small settings (100KB total, 8KB per item) -- it syncs across devices automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest generation | Manual manifest.json | WXT auto-generation from entrypoint files + `wxt.config.ts` manifest property | WXT handles browser differences, icon discovery, content script declarations |
| Storage type safety | Raw `chrome.storage.local.get/set` wrappers | `storage.defineItem()` from `wxt/storage` | Built-in type inference, fallback values, `.watch()` reactivity, versioning |
| Extension API mocking in tests | Manual `vi.mock('chrome')` stubs | `WxtVitest` plugin + `@webext-core/fake-browser` | In-memory storage implementation; auto-configures auto-imports and aliases |
| Vite config for Preact | Manual JSX transform config | `@preact/preset-vite` | Handles JSX pragma, devtools integration, aliasing |
| Build + zip pipeline | Custom webpack/esbuild scripts | `wxt build` and `wxt zip` | Handles MV3 validation, asset bundling, multi-browser output |

**Key insight:** WXT exists specifically to eliminate extension build boilerplate. Every hand-rolled manifest field, storage wrapper, or build script is a bug surface that WXT already handles.

## Common Pitfalls

### Pitfall 1: Tags Block Characters Require Non-BMP Handling
**What goes wrong:** `str.charCodeAt(i)` and `str[i]` treat Tags block characters (U+E0000+) as surrogate pairs, returning two 16-bit values instead of one codepoint. Regex without `/u` flag silently fails to match.
**Why it happens:** JavaScript strings are UTF-16. Characters above U+FFFF occupy two code units (surrogate pair).
**How to avoid:** Use `String.fromCodePoint()` for encoding, `codePointAt()` for decoding, `for...of` loops for iteration (iterates by codepoint, not code unit), and `/u` flag on all regexes with `\u{XXXXX}` syntax.
**Warning signs:** Encode output is twice the expected length. Decode produces garbled output. Regex match returns `null` on strings that visibly contain Tags characters.

### Pitfall 2: U+FEFF BOM at Position 0
**What goes wrong:** U+FEFF at the start of a string is a legitimate Byte Order Mark. Flagging it as "invisible character detected" produces false positives on files with BOMs.
**Why it happens:** U+FEFF has dual meaning -- BOM at position 0, zero-width no-break space elsewhere.
**How to avoid:** **Recommendation (Claude's discretion):** Skip U+FEFF at position 0 during detection/decode. Flag U+FEFF at all other positions. This avoids false positives on legitimate BOM usage while still catching U+FEFF used for steganography mid-string.
**Warning signs:** Every file pasted from Notepad triggers a detection alert.

### Pitfall 3: Wrapper Character Confusion
**What goes wrong:** U+E0001 (LANGUAGE TAG) and U+E007F (CANCEL TAG) are used as wrapper delimiters in the Tags block encoding scheme. If the decode function doesn't strip them, they appear as garbage in decoded output. If it strips them unconditionally, it corrupts encodings that don't use wrappers.
**Why it happens:** The wrapper is optional per user setting. Decode must handle both wrapped and unwrapped input.
**How to avoid:** In decode, detect whether input starts with U+E0001. If yes, treat as wrapped (strip begin/cancel tags before decoding). If no, decode raw. This is the "auto-detect" behavior specified in the locked decisions.
**Warning signs:** Decoded text starts with a random character or ends with a garbage character.

### Pitfall 4: WXT Has No Preact Template
**What goes wrong:** Running `pnpm dlx wxt@latest init --template preact` fails. Developer wastes time looking for a non-existent template.
**Why it happens:** WXT officially ships templates for Vanilla, Vue, React, Svelte, and Solid. Not Preact.
**How to avoid:** Use the vanilla template, then add Preact manually: install `preact` and `@preact/preset-vite`, configure the Vite plugin in `wxt.config.ts`. The popup HTML entrypoint loads a TSX file that renders Preact components.
**Warning signs:** Init command fails or produces a project without JSX support.

### Pitfall 5: ESLint Flat Config vs Legacy Config
**What goes wrong:** Examples online use `.eslintrc.json` (legacy format). ESLint 9.x uses flat config (`eslint.config.mjs`) by default. Mixing formats causes silent config failures.
**Why it happens:** ESLint migrated to flat config in v9 (2024). Most blog posts still show legacy format.
**How to avoid:** Use `eslint.config.mjs` with flat config format. Import `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` using the new `tseslint.config()` pattern.

## Code Examples

### Encode Function (Tags Block)
```typescript
// Source: Unicode Tags block mapping (U+E0000 maps to U+0000, etc.)
// Verified: Unicode.org Tags block specification + MDN String.fromCodePoint

const TAGS_OFFSET = 0xE0000;

export function encode(text: string, options: { wrap: boolean } = { wrap: false }): string {
  // Validate ASCII-only
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp > 127) {
      throw new Error(
        `Non-ASCII character "${char}" (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) at position ${text.indexOf(char)}. Only ASCII input is supported.`
      );
    }
  }

  const encoded = Array.from(text, (char) =>
    String.fromCodePoint(char.codePointAt(0)! + TAGS_OFFSET)
  ).join('');

  if (options.wrap) {
    return String.fromCodePoint(0xE0001) + encoded + String.fromCodePoint(0xE007F);
  }
  return encoded;
}
```

### Decode Function (Auto-Detect + Sensitivity-Aware)
```typescript
// Source: Unicode Tags block reverse mapping + zero-width character ranges

export function decode(input: string, sensitivity: SensitivityLevel = 'standard'): string {
  const preset = PRESETS[sensitivity];
  const result: string[] = [];

  // Build a Set of active codepoints for O(1) lookup
  const activeRanges = preset.ranges;

  // Iterate by codepoint (handles surrogate pairs correctly)
  for (const char of input) {
    const cp = char.codePointAt(0)!;

    // Tags block decode: reverse the offset
    if (cp >= 0xE0020 && cp <= 0xE007E) {
      result.push(String.fromCodePoint(cp - TAGS_OFFSET));
      continue;
    }

    // Skip wrapper characters (U+E0001 begin, U+E007F cancel)
    if (cp === 0xE0001 || cp === 0xE007F) {
      continue;
    }

    // Check if codepoint is in any active invisible range
    const isInvisible = activeRanges.some(
      (range) => cp >= range.start && cp <= range.end
    );

    // Skip invisible characters that are in the active preset
    // (they are "detected" but produce no decoded output)
    if (isInvisible && cp < 0xE0000) {
      continue; // Zero-width chars are stripped, not decoded to ASCII
    }

    // Pass through visible characters unchanged
    result.push(char);
  }

  return result.join('');
}
```

### Regex Generation from Preset Ranges
```typescript
// Build a detection regex from a sensitivity preset's character ranges
export function buildDetectionRegex(sensitivity: SensitivityLevel): RegExp {
  const preset = PRESETS[sensitivity];
  const parts = preset.ranges.map((range) => {
    if (range.start === range.end) {
      return `\\u{${range.start.toString(16)}}`;
    }
    return `\\u{${range.start.toString(16)}}-\\u{${range.end.toString(16)}}`;
  });
  return new RegExp(`[${parts.join('')}]`, 'gu');
}
```

### WXT Configuration
```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',  // Optional: organize source in src/
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: {
    name: 'InvisibleUnicode',
    description: 'Detect and reveal hidden Unicode text on any web page',
    permissions: ['storage', 'activeTab', 'scripting'],
    optional_permissions: ['<all_urls>'],  // For auto-scan mode
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
});
```

### ESLint No-Network Enforcement
```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // PLAT-02: No network calls -- all processing local
      'no-restricted-globals': ['error',
        { name: 'fetch', message: 'Network calls are forbidden. All processing must be local (PLAT-02).' },
        { name: 'XMLHttpRequest', message: 'Network calls are forbidden. All processing must be local (PLAT-02).' },
        { name: 'WebSocket', message: 'Network calls are forbidden. All processing must be local (PLAT-02).' },
        { name: 'EventSource', message: 'Network calls are forbidden. All processing must be local (PLAT-02).' },
      ],
      'no-restricted-properties': ['error',
        { object: 'navigator', property: 'sendBeacon', message: 'Network calls are forbidden (PLAT-02).' },
      ],
    },
  }
);
```

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
});
```

### Unit Test Example
```typescript
// tests/codec.test.ts
import { describe, it, expect } from 'vitest';
import { encode, decode } from '../utils/codec';

describe('encode', () => {
  it('encodes ASCII text to Tags block', () => {
    const result = encode('Hi');
    // 'H' = U+0048 -> U+E0048, 'i' = U+0069 -> U+E0069
    expect(result.codePointAt(0)).toBe(0xE0048);
    expect(result.codePointAt(2)).toBe(0xE0069); // offset 2 because surrogate pair
  });

  it('rejects non-ASCII input', () => {
    expect(() => encode('caf\u00e9')).toThrow(/Non-ASCII/);
  });

  it('wraps output when wrap option is true', () => {
    const result = encode('A', { wrap: true });
    const codepoints = Array.from(result, (c) => c.codePointAt(0)!);
    expect(codepoints[0]).toBe(0xE0001); // LANGUAGE TAG
    expect(codepoints[codepoints.length - 1]).toBe(0xE007F); // CANCEL TAG
  });
});

describe('decode', () => {
  it('decodes Tags block back to ASCII', () => {
    const encoded = encode('Hello');
    expect(decode(encoded)).toBe('Hello');
  });

  it('strips wrapper characters during decode', () => {
    const wrapped = encode('Test', { wrap: true });
    expect(decode(wrapped)).toBe('Test');
  });

  it('passes through visible characters', () => {
    const mixed = 'visible' + encode('hidden');
    expect(decode(mixed)).toBe('visiblehidden');
  });

  it('respects sensitivity level for zero-width chars', () => {
    const zwsp = '\u200B'; // Zero-width space
    expect(decode('a' + zwsp + 'b', 'standard')).toBe('ab'); // stripped
    expect(decode('a' + zwsp + 'b', 'standard')).not.toContain('\u200B');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual manifest.json + webpack | WXT auto-generates manifest from entrypoints | WXT 0.x (2024+) | No more manifest drift; entrypoint files ARE the manifest source |
| `@webext-core/storage` (separate) | `wxt/storage` (built-in) with `storage.defineItem()` | WXT 0.18+ | Built-in typed storage; no extra dependency needed |
| `.eslintrc.json` (legacy) | `eslint.config.mjs` (flat config) | ESLint 9.x (2024) | Must use flat config format for new projects |
| PostCSS for Tailwind CSS | `@tailwindcss/vite` plugin | Tailwind CSS 4.x (2025) | Simpler config; no `tailwind.config.js` needed |
| `charCodeAt()` for all strings | `codePointAt()` for non-BMP | Always (ES2015+) | Critical for Tags block (U+E0000+); `charCodeAt()` returns surrogate halves |

## Discretion Decisions (Recommendations)

### U+FEFF BOM Handling
**Recommendation:** Skip U+FEFF at position 0 during decode/detection. Flag it at all other positions.
**Rationale:** Position 0 FEFF is a legitimate BOM in files exported from Windows editors. Flagging it produces false positives. FEFF anywhere else in a string is suspicious and should be detected.

### Settings Storage: sync vs local
**Recommendation:** Use `chrome.storage.sync` for settings (sensitivity, highlight color, scan mode, wrapper toggle).
**Rationale:** Settings are tiny (well under 100KB total limit). Sync provides cross-device consistency. Users expect their preferences to follow them across machines. Use `storage.defineItem('sync:...')` prefix.

### No-Network Enforcement Method
**Recommendation:** Both ESLint rule AND strict CSP. Belt and suspenders.
**Rationale:** ESLint catches violations at development time (IDE feedback). CSP catches any that slip through at runtime. The CSP `script-src 'self'; object-src 'self';` is the MV3 minimum and prevents external script loading. The ESLint `no-restricted-globals` rule with custom messages provides developer-facing documentation of why network calls are banned.

### CSP Configuration
**Recommendation:** Use the strict MV3 minimum: `"script-src 'self'; object-src 'self';"` for extension_pages. Do not add `'wasm-unsafe-eval'` (not needed). Do not add any external origins.
**Rationale:** This is the Chrome Web Store expectation for privacy-focused extensions. Adding anything beyond `'self'` increases review scrutiny.

### Wrapper Default
**Recommendation:** Default `wrapperEnabled` to `false` (raw output without begin/cancel tags).
**Rationale:** Raw output is more flexible for copy-paste. Wrapping is a power-user feature for structured data embedding. Default should serve the common use case.

## Character Lists for Sensitivity Presets

### Standard
| Range | Name | Count | Notes |
|-------|------|-------|-------|
| U+E0000-E007F | Tags block | 128 | ASCII steganography; primary encode target |
| U+200B | Zero-width space | 1 | Common fingerprinting/steganography |
| U+200C | Zero-width non-joiner | 1 | Used in Arabic shaping (but also in fingerprinting) |
| U+200D | Zero-width joiner | 1 | Used in emoji sequences (but also in fingerprinting) |
| U+200E | Left-to-right mark | 1 | Directional mark |
| U+200F | Right-to-left mark | 1 | Directional mark |
| U+FEFF | Zero-width no-break space | 1 | BOM at pos 0 skipped; flagged elsewhere |

### Thorough (Standard plus)
| Range | Name | Count | Notes |
|-------|------|-------|-------|
| U+2060 | Word joiner | 1 | Invisible word joiner |
| U+2061 | Function application | 1 | Invisible math operator |
| U+2062 | Invisible times | 1 | Invisible math operator |
| U+2063 | Invisible separator | 1 | Invisible separator |
| U+2064 | Invisible plus | 1 | Invisible math operator |
| U+FE00-FE0F | Variation selectors 1-16 | 16 | Modify preceding character's glyph |

### Paranoid (Thorough plus)
| Range | Name | Count | Notes |
|-------|------|-------|-------|
| U+202A | Left-to-right embedding | 1 | Directional override |
| U+202B | Right-to-left embedding | 1 | Directional override |
| U+202C | Pop directional formatting | 1 | Directional override |
| U+202D | Left-to-right override | 1 | Directional override |
| U+202E | Right-to-left override | 1 | Directional override (Trojan source attacks) |
| U+2066 | Left-to-right isolate | 1 | Directional isolate |
| U+2067 | Right-to-left isolate | 1 | Directional isolate |
| U+2068 | First strong isolate | 1 | Directional isolate |
| U+2069 | Pop directional isolate | 1 | Directional isolate |
| U+206A-206F | Deprecated format chars | 6 | Inhibit/activate symmetric swapping, digit shapes |
| U+180B-180E | Mongolian free variation selectors | 4 | Mongolian script modifiers |
| U+00AD | Soft hyphen | 1 | Invisible unless at line break |
| U+061C | Arabic letter mark | 1 | Invisible directional mark |
| U+034F | Combining grapheme joiner | 1 | Invisible combining mark |

## Open Questions

1. **`for...of` iteration performance on large strings**
   - What we know: `for...of` correctly iterates by codepoint (not code unit), handling surrogate pairs. `Array.from()` does the same.
   - What's unclear: Whether `for...of` has measurable overhead vs manual surrogate-pair-aware indexing for very large strings (100KB+).
   - Recommendation: Use `for...of` for correctness. Optimize only if profiling shows it's a bottleneck (unlikely for encode/decode of user-pasted text).

2. **Zero-width character "decoding" output**
   - What we know: Tags block decodes to ASCII (reverse the offset). But zero-width characters (U+200B etc.) don't encode any text.
   - What's unclear: When the decode function encounters U+200B in standard mode, should it strip it silently, or include a placeholder like `[ZWSP]`?
   - Recommendation: Strip silently for the `decode()` function. A separate `detect()` function (Phase 2) can provide character-level breakdown with names and positions.

3. **WXT `srcDir` decision**
   - What we know: WXT supports `srcDir: 'src'` to nest source code under `src/`. Without it, `entrypoints/` and `utils/` live at root.
   - What's unclear: Whether srcDir causes issues with any WXT auto-import paths.
   - Recommendation: Use flat structure (no `srcDir`) to match WXT defaults and documentation examples. Less config risk.

## Sources

### Primary (HIGH confidence)
- WXT official documentation -- project structure, entrypoints, storage, testing, manifest configuration (wxt.dev)
- MDN -- String.fromCodePoint(), String.prototype.codePointAt() (developer.mozilla.org)
- Unicode.org -- Tags block specification, Unicode 17.0.0 Chapter 23 (unicode.org)
- Chrome Developers -- Manifest V3 CSP, content_security_policy (developer.chrome.com)
- ESLint -- no-restricted-globals rule documentation (eslint.org)

### Secondary (MEDIUM confidence)
- invisible-characters.com -- comprehensive invisible character list with codepoints
- Mathias Bynens -- JavaScript Unicode handling articles (mathiasbynens.be)
- Knostic.ai -- Zero-width Unicode character risks research

### Tertiary (LOW confidence)
- None -- all critical claims verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- WXT, Preact, Vitest all verified via official docs; versions confirmed
- Architecture: HIGH -- WXT project structure, entrypoint conventions, storage API all documented officially
- Unicode encoding: HIGH -- Tags block mapping verified against Unicode specification; JavaScript non-BMP handling verified via MDN
- Character lists: MEDIUM -- Standard preset characters well-documented; Thorough/Paranoid preset selections based on Unicode specification + security research sources
- Pitfalls: HIGH -- non-BMP handling, ESLint config, WXT template availability all verified

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days -- stable domain, no rapid changes expected)
