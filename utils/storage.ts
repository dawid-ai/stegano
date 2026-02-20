/**
 * Typed storage item declarations for InvisibleUnicode extension.
 *
 * Storage area allocation:
 * - Settings: sync storage — syncs across devices, small data (well under 100KB)
 * - Snippets: sync storage — syncs across devices, ~15-18 snippets within 8KB per-item limit
 * - Scan results (Phase 2): session storage — vanish on browser close
 * - No usage stats or counters — nothing to track (per user decision)
 */

import { storage } from 'wxt/utils/storage';
import type { WxtStorageItem } from 'wxt/utils/storage';
import type { SensitivityLevel } from './charsets';
import type { ScanMode, Snippet } from './types';

/** Structured result for storage write operations */
export type StorageResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unknown'; message: string };

/** Wrap a storage write in error handling that returns a structured result */
async function safeStorageWrite<T>(
  item: WxtStorageItem<T, Record<string, unknown>>,
  value: T,
): Promise<StorageResult> {
  try {
    await item.setValue(value);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('QUOTA_BYTES')) {
      return {
        ok: false,
        reason: 'quota',
        message:
          'Storage is full. Please delete some snippets to save new ones.',
      };
    }
    return { ok: false, reason: 'unknown', message: 'Failed to save. Please try again.' };
  }
}

/** Current sensitivity level for detection */
export const sensitivitySetting = storage.defineItem<SensitivityLevel>(
  'sync:sensitivity',
  { fallback: 'standard' },
);

/** Theme preference: dark (default) or light */
export const themeSetting = storage.defineItem<'dark' | 'light'>(
  'sync:theme',
  { fallback: 'dark' },
);

/** Per-class highlight color for Tags block characters */
export const tagsColorSetting = storage.defineItem<string>(
  'sync:tagsColor',
  { fallback: '#FFEB3B' },
);

/** Per-class highlight color for zero-width characters */
export const zerowColorSetting = storage.defineItem<string>(
  'sync:zerowColor',
  { fallback: '#FF9800' },
);

/** Per-class highlight color for AI watermark characters */
export const watermarkColorSetting = storage.defineItem<string>(
  'sync:watermarkColor',
  { fallback: '#E91E63' },
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

/** Saved invisible Unicode snippets for quick-paste */
export const snippetsSetting = storage.defineItem<Snippet[]>(
  'sync:snippets',
  { fallback: [] },
);

/** Add a new snippet to storage */
export async function addSnippet(snippet: Snippet): Promise<StorageResult> {
  const current = await snippetsSetting.getValue();
  return safeStorageWrite(snippetsSetting, [...current, snippet]);
}

/** Update an existing snippet by ID */
export async function updateSnippet(
  id: string,
  updates: Partial<Omit<Snippet, 'id'>>,
): Promise<StorageResult> {
  const current = await snippetsSetting.getValue();
  return safeStorageWrite(
    snippetsSetting,
    current.map((s) => (s.id === id ? { ...s, ...updates } : s)),
  );
}

/** Delete a snippet by ID */
export async function deleteSnippet(id: string): Promise<StorageResult> {
  const current = await snippetsSetting.getValue();
  return safeStorageWrite(snippetsSetting, current.filter((s) => s.id !== id));
}
