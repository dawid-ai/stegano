/**
 * Shared TypeScript types for InvisibleUnicode extension.
 *
 * This file contains types used across multiple modules.
 * Types specific to a single module should live in that module.
 */

/** Scan mode: on-demand (user clicks) or auto (content script runs on page load) */
export type ScanMode = 'onDemand' | 'auto';

/** Keyboard shortcut configuration for a snippet */
export interface SnippetShortcut {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
  /** Single key character (e.g., '1', 'a') */
  key: string;
}

/** A saved invisible Unicode text snippet */
export interface Snippet {
  /** Unique identifier (crypto.randomUUID) */
  id: string;
  /** User-assigned name */
  name: string;
  /** The invisible Unicode content (already encoded) */
  content: string;
  /** Optional keyboard shortcut for pasting */
  shortcut?: SnippetShortcut;
}

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
