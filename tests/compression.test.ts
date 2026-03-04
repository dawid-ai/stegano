import { describe, it, expect } from 'vitest';
import {
  compress,
  decompress,
  maybeCompress,
  COMPRESSION_FLAG,
} from '../utils/compression';

describe('COMPRESSION_FLAG', () => {
  it('equals 0x08 (bit 3 of version byte)', () => {
    expect(COMPRESSION_FLAG).toBe(0x08);
  });
});

describe('compress / decompress round-trip', () => {
  it('round-trips "Hello, World!" via UTF-8', async () => {
    const original = new TextEncoder().encode('Hello, World!');
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toEqual(original);
  });

  it('round-trips repeated text (100 chars of "abcabc...")', async () => {
    const text = 'abc'.repeat(34).slice(0, 100);
    const original = new TextEncoder().encode(text);
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toEqual(original);
  });

  it('round-trips empty Uint8Array', async () => {
    const original = new Uint8Array(0);
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toEqual(original);
  });
});

describe('maybeCompress', () => {
  it('returns { compressed: false } for short input (5 chars)', async () => {
    const original = new TextEncoder().encode('Hello');
    const result = await maybeCompress(original);
    expect(result.compressed).toBe(false);
    expect(result.data).toEqual(original);
  });

  it('returns { compressed: true } for long repeated input (100+ chars)', async () => {
    const text = 'abcdefghij'.repeat(20); // 200 chars, highly compressible
    const original = new TextEncoder().encode(text);
    const result = await maybeCompress(original);
    expect(result.compressed).toBe(true);
    expect(result.data.length).toBeLessThan(original.length);
  });

  it('compressed output is actually smaller than input for repeated text', async () => {
    const text = 'abc'.repeat(100); // 300 chars
    const original = new TextEncoder().encode(text);
    const compressed = await compress(original);
    expect(compressed.length).toBeLessThan(original.length);
  });

  it('returns original data when compressed is not smaller', async () => {
    const original = new TextEncoder().encode('Hi');
    const result = await maybeCompress(original);
    expect(result.compressed).toBe(false);
    // Data should be the original, not compressed
    expect(result.data).toEqual(original);
  });
});
