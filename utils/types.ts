/**
 * Shared TypeScript types for InvisibleUnicode extension.
 *
 * This file contains types used across multiple modules.
 * Types specific to a single module should live in that module.
 */

/** Scan mode: on-demand (user clicks) or auto (content script runs on page load) */
export type ScanMode = 'onDemand' | 'auto';

/** Result of scanning a text node for hidden Unicode characters */
export interface ScanMatch {
  /** The hidden character found */
  char: string;
  /** Unicode code point (e.g., 0xE0001) */
  codePoint: number;
  /** Index within the text node */
  index: number;
  /** Human-readable name of the character range */
  rangeName: string;
}
