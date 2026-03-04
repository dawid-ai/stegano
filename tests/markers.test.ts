import { describe, it, expect } from 'vitest';
import {
  ENCRYPTED_PREFIX,
  wrapEncrypted,
  detectEncrypted,
} from '../utils/markers';
import { encode } from '../utils/codec';

describe('ENCRYPTED_PREFIX', () => {
  it('equals "ENC1:"', () => {
    expect(ENCRYPTED_PREFIX).toBe('ENC1:');
  });
});

describe('wrapEncrypted', () => {
  it('prepends ENC1: to payload', () => {
    expect(wrapEncrypted('abc')).toBe('ENC1:abc');
  });

  it('handles empty payload', () => {
    expect(wrapEncrypted('')).toBe('ENC1:');
  });

  it('output is ASCII-safe for codec.encode()', () => {
    const wrapped = wrapEncrypted('SGVsbG8gV29ybGQ=');
    // Should not throw -- all characters are ASCII
    expect(() => encode(wrapped)).not.toThrow();
  });
});

describe('detectEncrypted', () => {
  it('detects ENC1: prefixed string', () => {
    const result = detectEncrypted('ENC1:payload');
    expect(result.encrypted).toBe(true);
    if (result.encrypted) {
      expect(result.payload).toBe('payload');
      expect(result.version).toBe(1);
    }
  });

  it('returns encrypted: false for plain text', () => {
    const result = detectEncrypted('plain text');
    expect(result.encrypted).toBe(false);
    if (!result.encrypted) {
      expect(result.plaintext).toBe('plain text');
    }
  });

  it('returns encrypted: false for empty string', () => {
    const result = detectEncrypted('');
    expect(result.encrypted).toBe(false);
    if (!result.encrypted) {
      expect(result.plaintext).toBe('');
    }
  });

  it('returns encrypted: false for partial prefix "ENC"', () => {
    const result = detectEncrypted('ENC');
    expect(result.encrypted).toBe(false);
  });

  it('returns encrypted: false for wrong version "ENC2:data"', () => {
    const result = detectEncrypted('ENC2:data');
    expect(result.encrypted).toBe(false);
  });

  it('returns encrypted: false for "XENC1:data" (prefix not at start)', () => {
    const result = detectEncrypted('XENC1:data');
    expect(result.encrypted).toBe(false);
  });

  it('integration: wrapEncrypted output passes through codec.encode without error', () => {
    const wrapped = wrapEncrypted('base64data');
    // encode() throws for non-ASCII -- this must not throw
    expect(() => encode(wrapped)).not.toThrow();
  });
});
