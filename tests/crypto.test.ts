import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptToInvisible,
  decryptFromInvisible,
  DecryptionError,
} from '../utils/crypto';

// ---------------------------------------------------------------------------
// encrypt / decrypt
// ---------------------------------------------------------------------------

describe('encrypt/decrypt', () => {
  it('encrypt returns a non-empty string', async () => {
    const result = await encrypt('hello', 'password');
    expect(result.length).toBeGreaterThan(0);
  });

  it('encrypt output is valid Base64', async () => {
    const result = await encrypt('hello', 'password');
    // atob should not throw for valid Base64
    expect(() => atob(result)).not.toThrow();
  });

  it('wire format: decoded bytes have correct minimum length (>= 42)', async () => {
    const result = await encrypt('X', 'pw');
    const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
    // version(1) + salt(16) + iv(12) + tag(12) + ciphertext(>=1) = 42
    expect(bytes.length).toBeGreaterThanOrEqual(42);
  });

  it('wire format: version byte is 0x00 or 0x08', async () => {
    const result = await encrypt('hello', 'pw');
    const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
    expect([0x00, 0x08]).toContain(bytes[0]);
  });

  it('round-trip: decrypt(encrypt("hello", "pw"), "pw") === "hello"', async () => {
    const encrypted = await encrypt('hello', 'pw');
    const decrypted = await decrypt(encrypted, 'pw');
    expect(decrypted).toBe('hello');
  });

  it('round-trip: works for single character "X"', async () => {
    const encrypted = await encrypt('X', 'pw');
    expect(await decrypt(encrypted, 'pw')).toBe('X');
  });

  it('round-trip: works for 100 chars of mixed content', async () => {
    const input = 'abcdefghij'.repeat(10);
    const encrypted = await encrypt(input, 'pw');
    expect(await decrypt(encrypted, 'pw')).toBe(input);
  });

  it('round-trip: works for 1000 chars', async () => {
    const input = 'Hello World! '.repeat(77).slice(0, 1000);
    const encrypted = await encrypt(input, 'pw');
    expect(await decrypt(encrypted, 'pw')).toBe(input);
  });

  it('round-trip: works for 10000 chars (long message)', async () => {
    const input = 'Long message test. '.repeat(527).slice(0, 10000);
    const encrypted = await encrypt(input, 'pw');
    expect(await decrypt(encrypted, 'pw')).toBe(input);
  });

  it('round-trip: works for Unicode plaintext', async () => {
    const input = 'caf\u00e9 \u{1F600} \u4e16\u754c';
    const encrypted = await encrypt(input, 'pw');
    expect(await decrypt(encrypted, 'pw')).toBe(input);
  });

  it('wrong password: decrypt throws DecryptionError', async () => {
    const encrypted = await encrypt('secret', 'correct');
    await expect(decrypt(encrypted, 'wrong')).rejects.toThrow(DecryptionError);
  });

  it('wrong password: error message contains "wrong password or corrupted data"', async () => {
    const encrypted = await encrypt('secret', 'correct');
    await expect(decrypt(encrypted, 'wrong')).rejects.toThrow(
      /wrong password or corrupted data/
    );
  });

  it('corrupted payload: decrypt throws DecryptionError', async () => {
    const encrypted = await encrypt('hello', 'pw');
    // Corrupt the middle of the base64 string
    const corrupted =
      encrypted.slice(0, 20) + 'XXXX' + encrypted.slice(24);
    await expect(decrypt(corrupted, 'pw')).rejects.toThrow(DecryptionError);
  });

  it('empty payload: decrypt throws DecryptionError', async () => {
    await expect(decrypt('', 'pw')).rejects.toThrow(DecryptionError);
  });

  it('randomness: two encryptions of same input produce different output', async () => {
    const a = await encrypt('same', 'pw');
    const b = await encrypt('same', 'pw');
    expect(a).not.toBe(b);
  });

  it('compress option: encrypt with { compress: false } round-trips correctly', async () => {
    const encrypted = await encrypt('hello world', 'pw', { compress: false });
    const decrypted = await decrypt(encrypted, 'pw');
    expect(decrypted).toBe('hello world');
  });

  it('compress option: { compress: false } produces longer payload than default for compressible text', async () => {
    const longText = 'a'.repeat(500);
    const withCompression = await encrypt(longText, 'pw');
    const withoutCompression = await encrypt(longText, 'pw', { compress: false });
    // Without compression should be longer (more Base64 chars)
    expect(withoutCompression.length).toBeGreaterThan(withCompression.length);
  });

  it('compression: encrypting 200 chars of "abc" repeated sets compression flag', async () => {
    const input = 'abc'.repeat(67).slice(0, 200);
    const result = await encrypt(input, 'pw');
    const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
    // Version byte should have compression flag (bit 3) set
    expect(bytes[0] & 0x08).toBe(0x08);
  });
});

// ---------------------------------------------------------------------------
// encryptToInvisible / decryptFromInvisible
// ---------------------------------------------------------------------------

describe('encryptToInvisible/decryptFromInvisible', () => {
  it('encryptToInvisible produces Tags block output', async () => {
    const result = await encryptToInvisible('hello', 'pw');
    for (const char of result) {
      const cp = char.codePointAt(0)!;
      expect(cp).toBeGreaterThanOrEqual(0xe0000);
      expect(cp).toBeLessThanOrEqual(0xe007f);
    }
  });

  it('decryptFromInvisible round-trips with encryptToInvisible', async () => {
    const invisible = await encryptToInvisible('hello', 'pw');
    const result = await decryptFromInvisible(invisible, 'pw');
    expect(result).toBe('hello');
  });

  it('decryptFromInvisible with plain (non-encrypted) Tags text returns null', async () => {
    // Encode some plain text into Tags block (not encrypted)
    const { encode } = await import('../utils/codec');
    const plainTags = encode('just plain text');
    const result = await decryptFromInvisible(plainTags, 'pw');
    expect(result).toBeNull();
  });
});
