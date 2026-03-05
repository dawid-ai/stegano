/**
 * Shared TypeScript types for InvisibleUnicode extension.
 *
 * This file contains types used across multiple modules.
 * Types specific to a single module should live in that module.
 */

/** Scan mode: on-demand (user clicks) or auto (content script runs on page load) */
export type ScanMode = 'onDemand' | 'auto';

/** A saved invisible Unicode text snippet */
export interface Snippet {
  /** Unique identifier (crypto.randomUUID) */
  id: string;
  /** User-assigned name */
  name: string;
  /** The invisible Unicode content (already encoded) */
  content: string;
  /** Optional link to a SavedPassword for encrypted paste */
  passwordId?: string;
}

/** A saved password for encrypting snippet content */
export interface SavedPassword {
  /** Unique identifier (crypto.randomUUID) */
  id: string;
  /** User-assigned name for this password */
  name: string;
  /** The password value */
  password: string;
}

