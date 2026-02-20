/**
 * Sensitivity preset definitions for hidden Unicode character detection.
 *
 * Three presets control which character ranges are flagged:
 * - Standard: Most common hidden characters (tags block, zero-width, BOM)
 * - Thorough: Standard + invisible operators, variation selectors
 * - Paranoid: Thorough + directional overrides, deprecated format chars, etc.
 *
 * Character ranges are sourced from the locked project decisions.
 */

/** Sensitivity level identifiers */
export type SensitivityLevel = 'standard' | 'thorough' | 'paranoid';

/** A contiguous range of Unicode code points */
export interface CharRange {
  /** Start code point (inclusive) */
  start: number;
  /** End code point (inclusive) */
  end: number;
  /** Human-readable name for this range */
  name: string;
}

/** A sensitivity preset with its label and character ranges */
export interface SensitivityPreset {
  level: SensitivityLevel;
  label: string;
  ranges: CharRange[];
}

// ---------------------------------------------------------------------------
// Standard ranges — the most common hidden/invisible characters
// ---------------------------------------------------------------------------

const STANDARD_RANGES: CharRange[] = [
  { start: 0xe0000, end: 0xe007f, name: 'Tags block' },
  { start: 0x200b, end: 0x200f, name: 'Zero-width & direction marks' },
  { start: 0xfeff, end: 0xfeff, name: 'BOM / Zero-width no-break space' },
];

// ---------------------------------------------------------------------------
// Thorough additions — invisible operators and variation selectors
// ---------------------------------------------------------------------------

const THOROUGH_ADDITIONS: CharRange[] = [
  { start: 0x2060, end: 0x2064, name: 'Invisible operators & word joiner' },
  { start: 0xfe00, end: 0xfe0f, name: 'Variation selectors' },
];

// ---------------------------------------------------------------------------
// Paranoid additions — directional overrides, deprecated format chars, etc.
// ---------------------------------------------------------------------------

const PARANOID_ADDITIONS: CharRange[] = [
  { start: 0x202a, end: 0x202e, name: 'Directional overrides' },
  { start: 0x2066, end: 0x2069, name: 'Directional isolates' },
  { start: 0x206a, end: 0x206f, name: 'Deprecated format characters' },
  { start: 0x180b, end: 0x180e, name: 'Mongolian variation selectors' },
  { start: 0x00ad, end: 0x00ad, name: 'Soft hyphen' },
  { start: 0x061c, end: 0x061c, name: 'Arabic letter mark' },
  { start: 0x034f, end: 0x034f, name: 'Combining grapheme joiner' },
];

// ---------------------------------------------------------------------------
// Presets — each level includes all ranges from lower levels
// ---------------------------------------------------------------------------

export const PRESETS: Record<SensitivityLevel, SensitivityPreset> = {
  standard: {
    level: 'standard',
    label: 'Standard',
    ranges: [...STANDARD_RANGES],
  },
  thorough: {
    level: 'thorough',
    label: 'Thorough',
    ranges: [...STANDARD_RANGES, ...THOROUGH_ADDITIONS],
  },
  paranoid: {
    level: 'paranoid',
    label: 'Paranoid',
    ranges: [
      ...STANDARD_RANGES,
      ...THOROUGH_ADDITIONS,
      ...PARANOID_ADDITIONS,
    ],
  },
};

/**
 * Build a detection regex from the character ranges of a given sensitivity level.
 *
 * Returns a regex with the /gu flags that matches any single character in the
 * combined ranges of the preset.
 *
 * @param sensitivity - The sensitivity level to build the regex for
 * @returns A RegExp matching any hidden character in the preset's ranges
 */
export function buildDetectionRegex(sensitivity: SensitivityLevel): RegExp {
  const preset = PRESETS[sensitivity];
  const parts = preset.ranges.map((range) => {
    const start = range.start.toString(16).toUpperCase();
    const end = range.end.toString(16).toUpperCase();
    if (range.start === range.end) {
      return `\\u{${start}}`;
    }
    return `[\\u{${start}}-\\u{${end}}]`;
  });
  return new RegExp(parts.join('|'), 'gu');
}
