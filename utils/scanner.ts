/**
 * Pure scanner logic for detecting invisible Unicode characters in text.
 *
 * DOM-free — operates on plain strings so it can be unit tested without
 * browser APIs. The content script consumes these functions to find
 * invisible characters and generate human-readable replacement text.
 *
 * @module scanner
 */

import { buildDetectionRegex, AI_WATERMARK_CHARS, type SensitivityLevel } from './charsets';

/** Tags block offset for mapping to/from ASCII */
const TAGS_OFFSET = 0xe0000;

/** Tags block content range (mapped ASCII 0x20-0x7E) */
const TAGS_CONTENT_START = 0xe0020;
const TAGS_CONTENT_END = 0xe007e;

/** Full Tags block range */
const TAGS_BLOCK_START = 0xe0000;
const TAGS_BLOCK_END = 0xe007f;

/**
 * A single finding of invisible characters within a text string.
 *
 * Offsets are in UTF-16 code units, compatible with String indices
 * and Text.splitText().
 */
export interface ScanFinding {
  /** UTF-16 offset within the text (inclusive) */
  start: number;
  /** UTF-16 offset end (exclusive) */
  end: number;
  /** The original invisible characters */
  original: string;
  /** Human-readable replacement text */
  replacement: string;
  /** Character class */
  type: 'tags' | 'zerowidth' | 'watermark';
}

/**
 * Decode a run of Tags block characters to readable ASCII.
 *
 * - Tags content chars (U+E0020-E007E) are mapped to ASCII by subtracting 0xE0000.
 * - Wrapper chars (U+E0001, U+E007F) are silently skipped.
 * - Other Tags block chars are silently skipped.
 *
 * @param text - A string containing Tags block characters
 * @returns The decoded ASCII text
 */
export function decodeTagsRun(text: string): string {
  const result: string[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp >= TAGS_CONTENT_START && cp <= TAGS_CONTENT_END) {
      result.push(String.fromCodePoint(cp - TAGS_OFFSET));
    }
    // Wrapper chars (U+E0001, U+E007F) and out-of-range Tags chars: skip
  }
  return result.join('');
}

/**
 * Check whether a codepoint falls within the Tags block range.
 */
function isTagsBlock(cp: number): boolean {
  return cp >= TAGS_BLOCK_START && cp <= TAGS_BLOCK_END;
}

/** Human-readable names for common zero-width characters */
const ZEROWIDTH_NAMES: ReadonlyMap<number, string> = new Map([
  [0x200B, 'Zero Width Space'],
  [0x200C, 'Zero Width Non-Joiner'],
  [0x200D, 'Zero Width Joiner'],
  [0x200E, 'Left-to-Right Mark'],
  [0x200F, 'Right-to-Left Mark'],
  [0xFEFF, 'BOM'],
  [0x2060, 'Word Joiner'],
  [0x2061, 'Function Application'],
  [0x2062, 'Invisible Times'],
  [0x2063, 'Invisible Separator'],
  [0x2064, 'Invisible Plus'],
  [0x00AD, 'Soft Hyphen'],
  [0x061C, 'Arabic Letter Mark'],
  [0x034F, 'Combining Grapheme Joiner'],
  [0x180E, 'Mongolian Vowel Separator'],
]);

/**
 * Classify a codepoint into its character class.
 * Priority: Tags block > watermark > zerowidth fallback.
 */
function classifyCodepoint(cp: number): 'tags' | 'watermark' | 'zerowidth' {
  if (isTagsBlock(cp)) return 'tags';
  if (AI_WATERMARK_CHARS.has(cp)) return 'watermark';
  return 'zerowidth';
}

/**
 * Scan a text string for invisible Unicode characters and return findings
 * with UTF-16 positions.
 *
 * Uses regex.exec() loop to get UTF-16 offsets that are compatible with
 * Text.splitText(). Adjacent Tags block characters are merged into a
 * single finding with the full decoded message.
 *
 * @param text - The text to scan
 * @param sensitivity - Detection sensitivity level (default: 'standard')
 * @returns Array of findings, sorted by start position
 */
export function findInvisibleChars(
  text: string,
  sensitivity: SensitivityLevel = 'standard'
): ScanFinding[] {
  if (text === '') return [];

  const regex = buildDetectionRegex(sensitivity);
  // Reset lastIndex in case regex was reused (it's /gu so it's stateful)
  regex.lastIndex = 0;

  // Phase 1: Collect all individual matches
  interface RawMatch {
    start: number;
    end: number;
    original: string;
    cp: number;
  }

  const rawMatches: RawMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const cp = match[0].codePointAt(0)!;
    rawMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      original: match[0],
      cp,
    });
  }

  if (rawMatches.length === 0) return [];

  // Phase 2: Merge adjacent Tags block matches, emit zero-width as-is
  const findings: ScanFinding[] = [];
  let i = 0;

  while (i < rawMatches.length) {
    const current = rawMatches[i];

    if (isTagsBlock(current.cp)) {
      // Start a Tags run — merge all contiguous Tags block matches
      const runStart = current.start;
      let runEnd = current.end;
      let runOriginal = current.original;
      let j = i + 1;

      while (j < rawMatches.length) {
        const next = rawMatches[j];
        if (isTagsBlock(next.cp) && next.start === runEnd) {
          runEnd = next.end;
          runOriginal += next.original;
          j++;
        } else {
          break;
        }
      }

      findings.push({
        start: runStart,
        end: runEnd,
        original: runOriginal,
        replacement: decodeTagsRun(runOriginal),
        type: 'tags',
      });

      i = j;
    } else {
      // Non-Tags character — classify as watermark or zerowidth
      const charType = classifyCodepoint(current.cp);
      let replacement: string;

      const hex = current.cp.toString(16).toUpperCase().padStart(4, '0');

      if (charType === 'watermark') {
        // Use named label from AI_WATERMARK_CHARS + Unicode code
        const name = AI_WATERMARK_CHARS.get(current.cp)!;
        replacement = `[${name} U+${hex}]`;
      } else {
        // Zerowidth — use name if available, plus Unicode code
        const name = ZEROWIDTH_NAMES.get(current.cp);
        replacement = name ? `[${name} U+${hex}]` : `[U+${hex}]`;
      }

      findings.push({
        start: current.start,
        end: current.end,
        original: current.original,
        replacement,
        type: charType,
      });
      i++;
    }
  }

  return findings;
}
