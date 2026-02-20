/**
 * Typed storage item declarations for InvisibleUnicode extension.
 *
 * Storage area allocation:
 * - Settings: sync storage — syncs across devices, small data (well under 100KB)
 * - Snippets (Phase 5): local storage — per-device, 10MB limit
 * - Scan results (Phase 2): session storage — vanish on browser close
 * - No usage stats or counters — nothing to track (per user decision)
 */

import { storage } from 'wxt/utils/storage';
import type { SensitivityLevel } from './charsets';
import type { ScanMode } from './types';

/** Current sensitivity level for detection */
export const sensitivitySetting = storage.defineItem<SensitivityLevel>(
  'sync:sensitivity',
  { fallback: 'standard' },
);

/**
 * Whether to wrap encoded output with Tags block wrapper characters.
 * - true: output wrapped with U+E0001 (begin) and U+E007F (cancel)
 * - false: raw output without wrappers (default — better for copy-paste)
 */
export const wrapperEnabledSetting = storage.defineItem<boolean>(
  'sync:wrapperEnabled',
  { fallback: false },
);

/** Highlight color for detected hidden characters in the page */
export const highlightColorSetting = storage.defineItem<string>(
  'sync:highlightColor',
  { fallback: '#ffeb3b' },
);

/** Scan mode: on-demand (user clicks scan) or auto (scan on page load) */
export const scanModeSetting = storage.defineItem<ScanMode>(
  'sync:scanMode',
  { fallback: 'onDemand' },
);

/** Primary invisible text snippet for quick-paste (KEYS-03). Phase 5 adds full snippet library. */
export const primarySnippetSetting = storage.defineItem<string>(
  'sync:primarySnippet',
  { fallback: '' },
);
