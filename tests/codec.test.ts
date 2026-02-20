import { describe, it, expect } from 'vitest';
import { encode, decode } from '../utils/codec';
import { buildDetectionRegex } from '../utils/charsets';

// ---------------------------------------------------------------------------
// encode()
// ---------------------------------------------------------------------------

describe('encode', () => {
  it('maps ASCII characters to Tags block codepoints', () => {
    const result = encode('Hi');
    // 'H' = 0x48 -> 0xE0048, 'i' = 0x69 -> 0xE0069
    const codepoints = Array.from(result).map((ch) => ch.codePointAt(0));
    expect(codepoints).toEqual([0xe0048, 0xe0069]);
  });

  it('returns empty string for empty input', () => {
    expect(encode('')).toBe('');
  });

  it('encodes all printable ASCII correctly', () => {
    const input = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    const result = encode(input);
    const decoded = Array.from(result)
      .map((ch) => String.fromCodePoint((ch.codePointAt(0)!) - 0xe0000))
      .join('');
    expect(decoded).toBe(input);
  });

  it('encodes control characters (ASCII 0-31)', () => {
    // Newline is ASCII 10 -> 0xE000A
    const result = encode('\n');
    expect(result.codePointAt(0)).toBe(0xe000a);
  });

  it('produces output that is invisible (Tags block range)', () => {
    const result = encode('Hello');
    for (const ch of result) {
      const cp = ch.codePointAt(0)!;
      expect(cp).toBeGreaterThanOrEqual(0xe0000);
      expect(cp).toBeLessThanOrEqual(0xe007f);
    }
  });

  it('throws for non-ASCII input with position info', () => {
    // cafe + combining acute accent (U+0301)
    expect(() => encode('cafe\u0301')).toThrow();
    expect(() => encode('cafe\u0301')).toThrow(/non-ASCII/i);
  });

  it('throws for emoji input', () => {
    expect(() => encode('hello 😀')).toThrow();
  });

  it('throws for multi-byte characters', () => {
    expect(() => encode('café')).toThrow();
  });

  it('wraps output with wrapper characters when wrap=true', () => {
    const result = encode('Hi', { wrap: true });
    const codepoints = Array.from(result).map((ch) => ch.codePointAt(0));
    expect(codepoints[0]).toBe(0xe0001); // begin tag
    expect(codepoints[codepoints.length - 1]).toBe(0xe007f); // cancel tag
    // Inner chars should be the encoded 'H' and 'i'
    expect(codepoints[1]).toBe(0xe0048);
    expect(codepoints[2]).toBe(0xe0069);
    expect(codepoints.length).toBe(4);
  });

  it('does not wrap by default', () => {
    const result = encode('Hi');
    const codepoints = Array.from(result).map((ch) => ch.codePointAt(0));
    expect(codepoints[0]).toBe(0xe0048); // no wrapper prefix
    expect(codepoints.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// decode()
// ---------------------------------------------------------------------------

describe('decode', () => {
  it('round-trips with encode for ASCII strings', () => {
    const inputs = ['Hello', 'Test', '', 'abc123!@#', ' ', 'A'];
    for (const input of inputs) {
      expect(decode(encode(input))).toBe(input);
    }
  });

  it('round-trips with wrapped encode', () => {
    expect(decode(encode('Test', { wrap: true }))).toBe('Test');
  });

  it('strips wrapper characters (U+E0001, U+E007F)', () => {
    const wrapped = encode('AB', { wrap: true });
    const unwrapped = encode('AB');
    expect(decode(wrapped)).toBe(decode(unwrapped));
    expect(decode(wrapped)).toBe('AB');
  });

  it('handles mixed visible + invisible input', () => {
    const hidden = encode('hidden');
    const mixed = 'visible' + hidden;
    expect(decode(mixed)).toBe('visiblehidden');
  });

  it('preserves visible text unchanged', () => {
    expect(decode('just plain text')).toBe('just plain text');
  });

  it('returns empty string for empty input', () => {
    expect(decode('')).toBe('');
  });

  // Sensitivity level tests
  describe('sensitivity levels', () => {
    it('strips ZWSP (U+200B) in standard mode', () => {
      expect(decode('a\u200Bb', 'standard')).toBe('ab');
    });

    it('strips ZWSP (U+200B) in thorough mode (superset)', () => {
      expect(decode('a\u200Bb', 'thorough')).toBe('ab');
    });

    it('does NOT strip word joiner (U+2060) in standard mode', () => {
      expect(decode('a\u2060b', 'standard')).toBe('a\u2060b');
    });

    it('strips word joiner (U+2060) in thorough mode', () => {
      expect(decode('a\u2060b', 'thorough')).toBe('ab');
    });

    it('strips directional override (U+202A) in paranoid mode', () => {
      expect(decode('a\u202Ab', 'paranoid')).toBe('ab');
    });

    it('does NOT strip directional override (U+202A) in standard mode', () => {
      expect(decode('a\u202Ab', 'standard')).toBe('a\u202Ab');
    });

    it('does NOT strip directional override (U+202A) in thorough mode', () => {
      expect(decode('a\u202Ab', 'thorough')).toBe('a\u202Ab');
    });

    it('defaults to standard sensitivity', () => {
      // U+2060 should NOT be stripped with default sensitivity
      expect(decode('a\u2060b')).toBe('a\u2060b');
    });
  });

  // BOM handling
  describe('BOM handling', () => {
    it('skips U+FEFF at position 0 (legitimate BOM)', () => {
      expect(decode('\uFEFF' + 'text', 'standard')).toBe('text');
    });

    it('strips U+FEFF mid-string per preset', () => {
      expect(decode('te\uFEFFxt', 'standard')).toBe('text');
    });

    it('handles U+FEFF at position 0 even without explicit sensitivity', () => {
      expect(decode('\uFEFFhello')).toBe('hello');
    });
  });
});

// ---------------------------------------------------------------------------
// buildDetectionRegex()
// ---------------------------------------------------------------------------

describe('buildDetectionRegex', () => {
  it('standard regex matches U+200B (ZWSP)', () => {
    const regex = buildDetectionRegex('standard');
    expect(regex.test('\u200B')).toBe(true);
  });

  it('standard regex does NOT match U+2060 (word joiner)', () => {
    const regex = buildDetectionRegex('standard');
    // Reset lastIndex since regex has /g flag
    regex.lastIndex = 0;
    expect(regex.test('\u2060')).toBe(false);
  });

  it('thorough regex matches both U+200B and U+2060', () => {
    const regex = buildDetectionRegex('thorough');
    expect(regex.test('\u200B')).toBe(true);
    regex.lastIndex = 0;
    expect(regex.test('\u2060')).toBe(true);
  });

  it('paranoid regex matches U+202A (directional override)', () => {
    const regex = buildDetectionRegex('paranoid');
    expect(regex.test('\u202A')).toBe(true);
  });

  it('standard regex matches Tags block characters', () => {
    const regex = buildDetectionRegex('standard');
    const tagChar = String.fromCodePoint(0xe0041); // Tag 'A'
    expect(regex.test(tagChar)).toBe(true);
  });

  it('regex does not match normal visible ASCII', () => {
    const regex = buildDetectionRegex('standard');
    regex.lastIndex = 0;
    expect(regex.test('A')).toBe(false);
    regex.lastIndex = 0;
    expect(regex.test('hello world')).toBe(false);
  });
});
