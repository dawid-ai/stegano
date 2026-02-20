/**
 * Unicode encode/decode codec for invisible text steganography.
 *
 * Encodes ASCII text into invisible Tags block (U+E0000-E007F) characters
 * and decodes them back, with sensitivity-aware stripping of other
 * invisible Unicode characters.
 *
 * @module codec
 */

import { PRESETS, type SensitivityLevel } from './charsets';

/** Offset to map ASCII codepoints into the Tags block */
const TAGS_OFFSET = 0xe0000;

/** Tags block content range (mapped ASCII 0x20-0x7E) */
const TAGS_CONTENT_START = 0xe0020;
const TAGS_CONTENT_END = 0xe007e;

/** Wrapper / delimiter codepoints */
const TAG_BEGIN = 0xe0001;
const TAG_CANCEL = 0xe007f;

/** BOM codepoint */
const BOM = 0xfeff;

/** Options for the encode function */
export interface EncodeOptions {
  /** Wrap output in U+E0001 (begin) and U+E007F (cancel) delimiters */
  wrap?: boolean;
}

/**
 * Encode an ASCII string into invisible Tags block Unicode characters.
 *
 * Each ASCII character (codepoint 0-127) is mapped to the Tags block by
 * adding the 0xE0000 offset. Non-ASCII input throws an Error with the
 * position and codepoint of the offending character.
 *
 * @param text - The ASCII text to encode
 * @param options - Encoding options
 * @returns An invisible string of Tags block characters
 * @throws {Error} If input contains non-ASCII characters (codepoint > 127)
 */
export function encode(text: string, options?: EncodeOptions): string {
  if (text === '') return '';

  const wrap = options?.wrap ?? false;
  const encoded: string[] = [];

  let position = 0;
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp > 127) {
      throw new Error(
        `Non-ASCII character at position ${position}: U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${char})`
      );
    }
    encoded.push(String.fromCodePoint(cp + TAGS_OFFSET));
    position++;
  }

  const result = encoded.join('');

  if (wrap) {
    return String.fromCodePoint(TAG_BEGIN) + result + String.fromCodePoint(TAG_CANCEL);
  }

  return result;
}

/**
 * Check whether a codepoint falls within any of the ranges of the given preset.
 */
function isInPresetRanges(cp: number, sensitivity: SensitivityLevel): boolean {
  const preset = PRESETS[sensitivity];
  for (const range of preset.ranges) {
    if (cp >= range.start && cp <= range.end) {
      return true;
    }
  }
  return false;
}

/**
 * Decode a string containing Tags block invisible characters back to plaintext.
 *
 * - Tags block characters (U+E0020-E007E) are reversed to ASCII.
 * - Wrapper characters (U+E0001, U+E007F) are silently stripped.
 * - Other Tags block characters (outside content range) are stripped.
 * - Zero-width and invisible characters matching the active sensitivity
 *   preset are stripped.
 * - U+FEFF at position 0 is skipped (legitimate BOM); at other positions
 *   it is stripped if within the preset ranges.
 * - All other (visible) characters pass through unchanged.
 *
 * @param input - The string to decode (may contain mixed visible and invisible text)
 * @param sensitivity - Sensitivity level for invisible character stripping (default: 'standard')
 * @returns The decoded plaintext string
 */
export function decode(input: string, sensitivity: SensitivityLevel = 'standard'): string {
  if (input === '') return '';

  const output: string[] = [];
  let position = 0;

  for (const char of input) {
    const cp = char.codePointAt(0)!;

    // BOM at position 0: skip silently (legitimate BOM)
    if (position === 0 && cp === BOM) {
      position++;
      continue;
    }

    // Tags block content range: reverse to ASCII
    if (cp >= TAGS_CONTENT_START && cp <= TAGS_CONTENT_END) {
      output.push(String.fromCodePoint(cp - TAGS_OFFSET));
      position++;
      continue;
    }

    // Tags block characters outside content range but within Tags block
    // (includes wrappers U+E0001, U+E007F and others): strip silently
    if (cp >= 0xe0000 && cp <= 0xe007f) {
      position++;
      continue;
    }

    // Other invisible characters: strip if in preset ranges
    if (isInPresetRanges(cp, sensitivity)) {
      position++;
      continue;
    }

    // Visible character: pass through
    output.push(char);
    position++;
  }

  return output.join('');
}
