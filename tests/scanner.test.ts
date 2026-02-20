import { describe, it, expect } from 'vitest';
import { findInvisibleChars, decodeTagsRun } from '../utils/scanner';

// ---------------------------------------------------------------------------
// Helper: encode ASCII text into Tags block characters (mirrors codec.ts logic)
// ---------------------------------------------------------------------------
const TAGS_OFFSET = 0xe0000;
const TAG_BEGIN = 0xe0001;
const TAG_CANCEL = 0xe007f;

function tagsEncode(text: string): string {
  return Array.from(text)
    .map((ch) => String.fromCodePoint(ch.codePointAt(0)! + TAGS_OFFSET))
    .join('');
}

function tagsEncodeWrapped(text: string): string {
  return (
    String.fromCodePoint(TAG_BEGIN) +
    tagsEncode(text) +
    String.fromCodePoint(TAG_CANCEL)
  );
}

// ---------------------------------------------------------------------------
// decodeTagsRun()
// ---------------------------------------------------------------------------

describe('decodeTagsRun', () => {
  it('decodes Tags content characters to ASCII', () => {
    const encoded = tagsEncode('secret');
    expect(decodeTagsRun(encoded)).toBe('secret');
  });

  it('returns empty string for empty input', () => {
    expect(decodeTagsRun('')).toBe('');
  });

  it('silently skips wrapper characters (U+E0001, U+E007F)', () => {
    const wrapped = tagsEncodeWrapped('hi');
    expect(decodeTagsRun(wrapped)).toBe('hi');
  });

  it('skips non-content Tags block characters', () => {
    // U+E0000 is Tags block but below content range (U+E0020-E007E)
    const input = String.fromCodePoint(0xe0000) + tagsEncode('ok');
    expect(decodeTagsRun(input)).toBe('ok');
  });

  it('decodes all printable ASCII range', () => {
    const printable =
      ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    const encoded = tagsEncode(printable);
    expect(decodeTagsRun(encoded)).toBe(printable);
  });
});

// ---------------------------------------------------------------------------
// findInvisibleChars() — basic cases
// ---------------------------------------------------------------------------

describe('findInvisibleChars', () => {
  it('returns empty array for empty string', () => {
    expect(findInvisibleChars('')).toEqual([]);
  });

  it('returns empty array for string with no invisible characters', () => {
    expect(findInvisibleChars('hello world')).toEqual([]);
  });

  // --- Tags block detection ---

  it('detects Tags block characters encoding "secret"', () => {
    const hidden = tagsEncode('secret');
    const text = 'before' + hidden + 'after';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('tags');
    expect(findings[0].replacement).toBe('secret');
    expect(findings[0].start).toBe('before'.length);
    // Each Tags char is a surrogate pair (2 UTF-16 code units)
    expect(findings[0].end).toBe('before'.length + hidden.length);
    expect(findings[0].original).toBe(hidden);
  });

  it('detects wrapped Tags block characters', () => {
    const hidden = tagsEncodeWrapped('msg');
    const text = 'x' + hidden + 'y';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('tags');
    // Decoded text should be just the content, not wrapper chars
    expect(findings[0].replacement).toBe('msg');
  });

  it('merges adjacent Tags block characters into one finding', () => {
    // Two separate Tags chars that are adjacent should merge
    const part1 = tagsEncode('hel');
    const part2 = tagsEncode('lo');
    const text = 'start' + part1 + part2 + 'end';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('tags');
    expect(findings[0].replacement).toBe('hello');
    expect(findings[0].start).toBe('start'.length);
    expect(findings[0].end).toBe('start'.length + part1.length + part2.length);
  });

  // --- Zero-width character detection ---

  it('detects U+200B (zero-width space)', () => {
    const text = 'a\u200Bb';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('zerowidth');
    expect(findings[0].replacement).toBe('[Zero Width Space U+200B]');
    expect(findings[0].start).toBe(1);
    expect(findings[0].end).toBe(2);
    expect(findings[0].original).toBe('\u200B');
  });

  it('detects U+200C (zero-width non-joiner)', () => {
    const text = 'x\u200Cy';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe('[Zero Width Non-Joiner U+200C]');
    expect(findings[0].type).toBe('zerowidth');
  });

  it('detects U+200D (zero-width joiner)', () => {
    const text = '\u200D';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe('[Zero Width Joiner U+200D]');
    expect(findings[0].type).toBe('zerowidth');
  });

  it('detects U+FEFF (BOM / zero-width no-break space)', () => {
    const text = 'a\uFEFFb';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe('[BOM U+FEFF]');
    expect(findings[0].type).toBe('zerowidth');
  });

  it('detects U+200E (left-to-right mark)', () => {
    const text = 'test\u200Ehere';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe('[Left-to-Right Mark U+200E]');
    expect(findings[0].type).toBe('zerowidth');
  });

  it('detects U+200F (right-to-left mark)', () => {
    const text = 'x\u200Fy';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe('[Right-to-Left Mark U+200F]');
    expect(findings[0].type).toBe('zerowidth');
  });

  // --- Mixed content ---

  it('detects multiple findings with correct offsets and no overlap', () => {
    const hidden = tagsEncode('abc');
    // "hello" + ZWS + Tags("abc") + "world" + ZWNJ
    const text = 'hello\u200B' + hidden + 'world\u200C';
    const findings = findInvisibleChars(text);

    expect(findings.length).toBeGreaterThanOrEqual(3);

    // ZWS at index 5
    const zwsFinding = findings.find((f) => f.replacement === '[Zero Width Space U+200B]');
    expect(zwsFinding).toBeDefined();
    expect(zwsFinding!.start).toBe(5);
    expect(zwsFinding!.end).toBe(6);

    // Tags block
    const tagsFinding = findings.find((f) => f.type === 'tags');
    expect(tagsFinding).toBeDefined();
    expect(tagsFinding!.replacement).toBe('abc');
    expect(tagsFinding!.start).toBe(6); // after "hello" + ZWS

    // ZWNJ at end
    const zwnjFinding = findings.find((f) => f.replacement === '[Zero Width Non-Joiner U+200C]');
    expect(zwnjFinding).toBeDefined();

    // No overlapping ranges
    for (let i = 0; i < findings.length - 1; i++) {
      expect(findings[i].end).toBeLessThanOrEqual(findings[i + 1].start);
    }
  });

  it('handles Tags block followed by zero-width characters', () => {
    const hidden = tagsEncode('x');
    const text = hidden + '\u200B';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(2);
    expect(findings[0].type).toBe('tags');
    expect(findings[1].type).toBe('zerowidth');
  });

  // --- Sensitivity levels ---

  it('thorough sensitivity detects variation selectors (U+FE00-FE0F)', () => {
    const text = 'a\uFE00b';
    // Standard should NOT detect it
    const standardFindings = findInvisibleChars(text, 'standard');
    expect(standardFindings).toHaveLength(0);

    // Thorough SHOULD detect it
    const thoroughFindings = findInvisibleChars(text, 'thorough');
    expect(thoroughFindings).toHaveLength(1);
    expect(thoroughFindings[0].replacement).toBe('[U+FE00]');
    expect(thoroughFindings[0].type).toBe('zerowidth');
  });

  it('thorough sensitivity detects word joiner (U+2060)', () => {
    const text = 'a\u2060b';
    const standardFindings = findInvisibleChars(text, 'standard');
    expect(standardFindings).toHaveLength(0);

    const thoroughFindings = findInvisibleChars(text, 'thorough');
    expect(thoroughFindings).toHaveLength(1);
    expect(thoroughFindings[0].replacement).toBe('[Word Joiner U+2060]');
  });

  it('paranoid sensitivity detects directional overrides (U+202A-202E)', () => {
    const text = 'a\u202Ab';
    const standardFindings = findInvisibleChars(text, 'standard');
    expect(standardFindings).toHaveLength(0);

    const thoroughFindings = findInvisibleChars(text, 'thorough');
    expect(thoroughFindings).toHaveLength(0);

    const paranoidFindings = findInvisibleChars(text, 'paranoid');
    expect(paranoidFindings).toHaveLength(1);
    expect(paranoidFindings[0].replacement).toBe('[U+202A]');
  });

  it('paranoid sensitivity detects soft hyphen (U+00AD)', () => {
    const text = 'hel\u00ADlo';
    const standardFindings = findInvisibleChars(text, 'standard');
    expect(standardFindings).toHaveLength(0);

    const paranoidFindings = findInvisibleChars(text, 'paranoid');
    expect(paranoidFindings).toHaveLength(1);
    expect(paranoidFindings[0].replacement).toBe('[Soft Hyphen U+00AD]');
  });

  // --- Edge cases ---

  it('handles string that is entirely Tags block characters', () => {
    const text = tagsEncode('hidden message');
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe('hidden message');
    expect(findings[0].start).toBe(0);
    expect(findings[0].end).toBe(text.length);
  });

  it('handles multiple separate Tags block runs', () => {
    const run1 = tagsEncode('first');
    const run2 = tagsEncode('second');
    const text = 'a' + run1 + 'b' + run2 + 'c';
    const findings = findInvisibleChars(text);

    const tagsFindings = findings.filter((f) => f.type === 'tags');
    expect(tagsFindings).toHaveLength(2);
    expect(tagsFindings[0].replacement).toBe('first');
    expect(tagsFindings[1].replacement).toBe('second');
  });

  it('handles multiple adjacent zero-width characters of different types', () => {
    const text = 'a\u200B\u200Cb';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(2);
    expect(findings[0].replacement).toBe('[Zero Width Space U+200B]');
    expect(findings[1].replacement).toBe('[Zero Width Non-Joiner U+200C]');
    expect(findings[0].end).toBeLessThanOrEqual(findings[1].start);
  });
});

// ---------------------------------------------------------------------------
// Watermark detection
// ---------------------------------------------------------------------------

describe('watermark detection', () => {
  it('classifies U+202F (NNBSP) as watermark with named label and Unicode code', () => {
    const text = 'hello\u202Fworld';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('watermark');
    expect(findings[0].replacement).toBe('[Narrow No-Break Space U+202F]');
    expect(findings[0].start).toBe(5);
    expect(findings[0].end).toBe(6);
  });

  it('classifies U+2003 (Em Space) as watermark', () => {
    const text = 'a\u2003b';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('watermark');
    expect(findings[0].replacement).toBe('[Em Space U+2003]');
  });

  it('keeps U+200B classified as zerowidth (not watermark)', () => {
    const text = 'a\u200Bb';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('zerowidth');
    expect(findings[0].replacement).toBe('[Zero Width Space U+200B]');
  });

  it('keeps Tags block characters classified as tags', () => {
    const hidden = tagsEncode('test');
    const findings = findInvisibleChars(hidden);

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('tags');
    expect(findings[0].replacement).toBe('test');
  });

  it('correctly classifies mixed text with all three classes', () => {
    const tagsHidden = tagsEncode('msg');
    // Tags + zerowidth + watermark
    const text = tagsHidden + '\u200B' + '\u202F';
    const findings = findInvisibleChars(text);

    expect(findings).toHaveLength(3);

    const tagsFinding = findings.find((f) => f.type === 'tags');
    expect(tagsFinding).toBeDefined();
    expect(tagsFinding!.replacement).toBe('msg');

    const zwFinding = findings.find((f) => f.type === 'zerowidth');
    expect(zwFinding).toBeDefined();
    expect(zwFinding!.replacement).toBe('[Zero Width Space U+200B]');

    const wmFinding = findings.find((f) => f.type === 'watermark');
    expect(wmFinding).toBeDefined();
    expect(wmFinding!.replacement).toBe('[Narrow No-Break Space U+202F]');
  });

  it('uses named labels with Unicode codes from AI_WATERMARK_CHARS', () => {
    // Test all 6 watermark characters have named labels with Unicode codes
    const watermarks = [
      { char: '\u202F', label: '[Narrow No-Break Space U+202F]' },
      { char: '\u2003', label: '[Em Space U+2003]' },
      { char: '\u2002', label: '[En Space U+2002]' },
      { char: '\u2009', label: '[Thin Space U+2009]' },
      { char: '\u200A', label: '[Hair Space U+200A]' },
      { char: '\u205F', label: '[Medium Mathematical Space U+205F]' },
    ];

    for (const { char, label } of watermarks) {
      const findings = findInvisibleChars(`x${char}y`);
      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('watermark');
      expect(findings[0].replacement).toBe(label);
    }
  });
});
